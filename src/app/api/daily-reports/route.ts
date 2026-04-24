import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/daily-reports?projectId=&userId=&date=
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const projectId = searchParams.get("projectId");
  const userId    = searchParams.get("userId");
  const date      = searchParams.get("date");
  const type      = searchParams.get("type"); // "own" | "subcontractor"

  const dailyReports = await prisma.dailyReport.findMany({
    where: {
      project: { companyId: session.user.companyId },
      ...(projectId ? { projectId } : {}),
      ...(userId    ? { userId }    : {}),
      ...(date      ? { workDate: new Date(date) } : {}),
      ...(type === "own"
        ? { user: { subcontractorName: null } }
        : type === "subcontractor"
        ? { user: { subcontractorName: { not: null } } }
        : {}),
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true, role: true, subcontractorName: true },
      },
      project: {
        select: { id: true, name: true, status: true },
      },
    },
    orderBy: { workDate: "desc" },
  });

  return NextResponse.json({ dailyReports });
}

// POST /api/daily-reports
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId, workDate, summary, weather, targetUserId } = body;

    if (!projectId || !workDate) {
      return NextResponse.json(
        { error: "projectId, workDate は必須です" },
        { status: 400 }
      );
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId: session.user.companyId },
    });

    if (!project) {
      return NextResponse.json(
        { error: "プロジェクトが見つかりません" },
        { status: 404 }
      );
    }

    // MANAGER/ADMIN は targetUserId で他の人の日報を作成可能
    let reportUserId = session.user.id;
    if (targetUserId && ["ADMIN", "MANAGER"].includes(session.user.role ?? "")) {
      const targetUser = await prisma.user.findFirst({
        where: { id: targetUserId, companyId: session.user.companyId },
      });
      if (!targetUser) {
        return NextResponse.json(
          { error: "指定したユーザーが見つかりません" },
          { status: 404 }
        );
      }
      reportUserId = targetUserId;
    }

    const dailyReport = await prisma.dailyReport.create({
      data: {
        projectId,
        userId: reportUserId,
        workDate: new Date(workDate),
        summary: summary ?? null,
        weather: weather ?? "SUNNY",
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, role: true },
        },
        project: {
          select: { id: true, name: true, status: true },
        },
        workLogs: true,
      },
    });

    // 工程表の最終タスク終了日以降の日報が提出されたら案件を「完了」に自動更新
    await tryCompleteProject(projectId, dailyReport.workDate);

    return NextResponse.json({ dailyReport }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/daily-reports]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

async function tryCompleteProject(projectId: string, workDate: Date) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });
    // すでに完了・停止中の場合はスキップ
    if (!project || project.status === "COMPLETED" || project.status === "PAUSED") return;

    // 案件に紐づく工程表の最終タスク終了日を取得
    const lastTask = await prisma.scheduleTask.findFirst({
      where: { schedule: { projectId } },
      orderBy: { endDate: "desc" },
      select: { endDate: true },
    });
    if (!lastTask) return;

    // 日報の日付が最終タスク終了日以降であれば案件を「完了」に
    if (workDate >= lastTask.endDate) {
      await prisma.project.update({
        where: { id: projectId },
        data: { status: "COMPLETED" },
      });
    }
  } catch {
    // 自動更新の失敗は日報作成を妨げない
  }
}
