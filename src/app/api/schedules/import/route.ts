import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DOC_TYPE_DESCRIPTIONS: Record<string, string> = {
  schedule: "工程表",
  estimate: "見積書",
  contract: "請負契約書",
  order: "注文書・発注書",
  other: "建設関連書類",
};

function buildPrompt(docType: string): string {
  const docName = DOC_TYPE_DESCRIPTIONS[docType] ?? "建設関連書類";

  const taskInstruction = docType === "schedule"
    ? "- tasks: 工程タスクの配列（各要素: { name: string, startDate: string|null, endDate: string|null }）。工程バーや作業項目から抽出すること。"
    : docType === "estimate"
    ? "- tasks: 見積明細の工事項目の配列（各要素: { name: string, startDate: null, endDate: null }）。基礎工事・内装工事などの工種レベルで抽出すること。"
    : "- tasks: 主要な工事項目があれば配列で（各要素: { name: string, startDate: null, endDate: null }）。なければ空配列。";

  const amountInstruction = (docType === "estimate" || docType === "contract")
    ? "- contractAmount: 契約金額・見積金額の合計（数値、税抜き優先。不明な場合はnull）"
    : "- contractAmount: null";

  return `あなたは建設業の書類を解析する専門AIです。
アップロードされた${docName}から以下の情報を抽出し、必ずJSONのみで返答してください。

抽出項目:
- customerName: 施主名・発注者名・注文者名（不明な場合はnull）
- projectName: 工事名・案件名（必須、不明な場合は"工事"）
- address: 現場住所・工事場所（不明な場合はnull）
- startDate: 工期開始日（YYYY-MM-DD形式、不明な場合はnull）
- endDate: 工期終了日・完成日（YYYY-MM-DD形式、不明な場合はnull）
${taskInstruction}
${amountInstruction}

注意:
- 日付は必ずYYYY-MM-DD形式に変換すること（例: 令和8年4月1日 → 2026-04-01）
- 住所は都道府県から始まる形式に整形すること
- 金額は数値のみ（カンマや円マーク不要）

返答形式（JSONのみ、説明文・コードブロック不要）:
{
  "customerName": "田中太郎",
  "projectName": "〇〇邸新築工事",
  "address": "東京都新宿区西新宿1-1-1",
  "startDate": "2026-04-01",
  "endDate": "2026-09-30",
  "contractAmount": 15000000,
  "tasks": [
    { "name": "基礎工事", "startDate": "2026-04-01", "endDate": "2026-04-30" }
  ]
}`;
}

// ExcelデータをClaudeが読みやすいテキストに変換
function excelToText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    lines.push(`=== シート: ${sheetName} ===`);
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    const rows = csv.split("\n").filter((r) => r.replace(/,/g, "").trim() !== "").slice(0, 120);
    lines.push(...rows);
  }
  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AIキーが設定されていません（ANTHROPIC_API_KEY）" }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const docType = (formData.get("docType") as string) || "other";

    if (!file) {
      return NextResponse.json({ error: "ファイルが必要です" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mime = file.type;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const prompt = buildPrompt(docType);

    let message: Anthropic.MessageParam;

    if (ext === "xlsx" || ext === "xls" || mime.includes("spreadsheet") || mime.includes("excel")) {
      const text = excelToText(buffer);
      message = {
        role: "user",
        content: `${prompt}\n\n以下はExcelファイルのデータです:\n\n${text}`,
      };
    } else if (mime === "application/pdf" || mime.startsWith("image/") || ext === "pdf") {
      const base64 = buffer.toString("base64");
      const imageMediaType = (mime.startsWith("image/") ? mime : "image/jpeg") as
        "image/jpeg" | "image/png" | "image/gif" | "image/webp";

      message = {
        role: "user",
        content: mime === "application/pdf" || ext === "pdf"
          ? [
              { type: "text" as const, text: prompt },
              { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 } },
            ]
          : [
              { type: "text" as const, text: prompt },
              { type: "image" as const, source: { type: "base64" as const, media_type: imageMediaType, data: base64 } },
            ],
      };
    } else {
      return NextResponse.json(
        { error: "対応していないファイル形式です。Excel・PDF・画像（JPG/PNG）をアップロードしてください" },
        { status: 400 }
      );
    }

    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      messages: [message],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("予期しないレスポンス形式");

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSONの抽出に失敗しました");

    const extracted = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ extracted });
  } catch (error) {
    console.error("[POST /api/schedules/import]", error);
    const msg = error instanceof Error ? error.message : "解析に失敗しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
