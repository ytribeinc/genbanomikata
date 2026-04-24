import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";

/**
 * POST /api/daily-reports/draft
 * 日報の下書きをAIで自動生成する
 *
 * body: { projectId, workDate, userId? }
 *
 * 3つのソースを組み合わせ:
 * 1. 自社テンプレート（登録済みフォーマット）
 * 2. 今日の工程タスク（工程表から転記）
 * 3. 過去の日報パターン（AIが学習して生成）
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const body = await request.json();
  const { projectId, workDate, userId } = body;

  if (!projectId || !workDate) {
    return NextResponse.json(
      { error: "projectId と workDate は必須です" },
      { status: 400 }
    );
  }

  const targetUserId = userId ?? session.user.id;

  // ── 1. プロジェクト情報を取得 ──────────────────────────────────
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: session.user.companyId },
    include: {
      customer: { select: { name: true } },
    },
  });
  if (!project) {
    return NextResponse.json(
      { error: "プロジェクトが見つかりません" },
      { status: 404 }
    );
  }

  // ── 2. 自社テンプレートを取得（最新のREPORTタイプ）──────────────
  const template = await prisma.template.findFirst({
    where: {
      companyId: session.user.companyId,
      type: "REPORT",
    },
    orderBy: { createdAt: "desc" },
  });

  // ── 3. 今日の工程タスクを取得 ──────────────────────────────────
  const targetDate = new Date(workDate);
  const scheduleTasks = await prisma.scheduleTask.findMany({
    where: {
      schedule: { projectId },
      startDate: { lte: targetDate },
      endDate: { gte: targetDate },
    },
    include: {
      assignedUser: { select: { id: true, name: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  // ── 4. 過去の日報を取得（最新20件）──────────────────────────────
  const pastReports = await prisma.dailyReport.findMany({
    where: {
      projectId,
      userId: targetUserId,
    },
    include: {
      workLogs: {
        include: { user: { select: { name: true } } },
        orderBy: { startTime: "asc" },
      },
    },
    orderBy: { workDate: "desc" },
    take: 20,
  });

  // ── 5. 作業者情報 ────────────────────────────────────────────
  const targetUser = await prisma.user.findFirst({
    where: { id: targetUserId, companyId: session.user.companyId },
    select: { name: true },
  });

  // ── 6. 工程タスクから作業ログ候補を生成 ──────────────────────────
  const workLogsFromSchedule = scheduleTasks
    .filter(
      (t) => !t.assignedUserId || t.assignedUserId === targetUserId
    )
    .map((task) => ({
      startTime: "08:00",
      endTime: "17:00",
      breakMinutes: 60,
      workContent: task.name,
      source: "schedule" as const,
    }));

  // ── 7. Claude APIで下書き生成 ─────────────────────────────────
  const templateContent = template?.content as {
    sections?: Array<{ name: string; placeholder: string }>;
    defaultWorkTime?: { start: string; end: string; break: number };
  } | null;

  const pastReportsSummary = pastReports
    .slice(0, 10)
    .map((r) => {
      const logs = r.workLogs
        .map((l) => `  ・${l.workContent ?? "（内容なし）"}`)
        .join("\n");
      return `【${new Date(r.workDate).toLocaleDateString("ja-JP")}】\n概要: ${r.summary ?? "なし"}\n${logs}`;
    })
    .join("\n\n");

  const scheduleTasksText =
    scheduleTasks.length > 0
      ? scheduleTasks.map((t) => `・${t.name}（${t.status}）`).join("\n")
      : "本日の工程タスクはありません";

  const templateText =
    templateContent?.sections
      ? `テンプレートセクション:\n${templateContent.sections
          .map((s) => `・${s.name}: ${s.placeholder}`)
          .join("\n")}`
      : "テンプレートは未設定です";

  let aiDraft: {
    summary: string;
    workLogs: Array<{
      startTime: string;
      endTime: string;
      breakMinutes: number;
      workContent: string;
    }>;
  } = {
    summary: "",
    workLogs: workLogsFromSchedule,
  };

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 2000,
        thinking: { type: "adaptive" },
        system: `あなたは建設・塗装・リフォーム現場の日報作成アシスタントです。
過去の日報パターンと本日の工程表を分析し、今日の作業日報の下書きを生成してください。
必ずJSON形式で返してください。`,
        messages: [
          {
            role: "user",
            content: `以下の情報をもとに、本日（${workDate}）の日報下書きをJSON形式で生成してください。

## 現場情報
- 現場名: ${project.name}
- 住所: ${project.address ?? "未設定"}
- 作業者: ${targetUser?.name ?? "不明"}

## 本日の工程タスク
${scheduleTasksText}

## 自社テンプレート
${templateText}

## 過去の日報（参考パターン）
${pastReportsSummary || "過去の日報はありません"}

## 出力形式（必ずこのJSONのみを返してください）
{
  "summary": "本日の作業概要（200字以内）",
  "workLogs": [
    {
      "startTime": "08:00",
      "endTime": "17:00",
      "breakMinutes": 60,
      "workContent": "具体的な作業内容"
    }
  ]
}

工程タスクがある場合はそれを優先し、過去の日報パターンも参考にして自然な日報を作成してください。`,
          },
        ],
      });

      // thinking以外のtextブロックを取得
      const textBlock = response.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          aiDraft = {
            summary: parsed.summary ?? "",
            workLogs: Array.isArray(parsed.workLogs) ? parsed.workLogs : workLogsFromSchedule,
          };
        }
      }
    } catch (err) {
      console.error("[draft] Claude API error:", err);
      // AI失敗時は工程表ベースのデータを返す
      aiDraft = {
        summary: scheduleTasks.map((t) => t.name).join("、") || "",
        workLogs: workLogsFromSchedule,
      };
    }
  } else {
    // APIキー未設定時は工程表ベースのデータを返す
    aiDraft = {
      summary: scheduleTasks.map((t) => t.name).join("、") || "",
      workLogs:
        workLogsFromSchedule.length > 0
          ? workLogsFromSchedule
          : [{ startTime: "08:00", endTime: "17:00", breakMinutes: 60, workContent: "" }],
    };
  }

  return NextResponse.json({
    draft: {
      summary: aiDraft.summary,
      workLogs: aiDraft.workLogs,
      weather: "SUNNY", // デフォルト
    },
    sources: {
      hasTemplate: !!template,
      scheduleTasksCount: scheduleTasks.length,
      pastReportsCount: pastReports.length,
      aiGenerated: !!process.env.ANTHROPIC_API_KEY,
    },
    template: templateContent,
  });
}
