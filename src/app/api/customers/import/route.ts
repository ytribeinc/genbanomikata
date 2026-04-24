import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// POST /api/customers/import
// multipart/form-data: file (xlsx/xls/csv)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "ファイルが必要です" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      return NextResponse.json({ error: "xlsx / xls / csv ファイルを選択してください" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (rows.length === 0) {
      return NextResponse.json({ error: "データが空です" }, { status: 400 });
    }

    // 列名の正規化（日本語・英語・大小文字・スペース・全角を吸収）
    function normalize(s: string) {
      return String(s).replace(/[\s　]/g, "").toLowerCase();
    }

    function findVal(row: Record<string, string>, candidates: string[]): string {
      for (const key of Object.keys(row)) {
        if (candidates.includes(normalize(key))) return String(row[key]).trim();
      }
      return "";
    }

    const NAME_KEYS    = ["顧客名", "name", "氏名", "施主名", "顧客"];
    const PHONE_KEYS   = ["電話番号", "phone", "tel", "電話", "携帯"];
    const EMAIL_KEYS   = ["メールアドレス", "email", "メール", "mail"];
    const ADDRESS_KEYS = ["住所", "address", "addr"];
    const MEMO_KEYS    = ["メモ", "memo", "備考", "note", "notes"];

    const records: { companyId: string; name: string; phone: string | null; email: string | null; address: string | null; memo: string | null }[] = [];
    const skipped: number[] = [];

    rows.forEach((row, i) => {
      const name = findVal(row, NAME_KEYS);
      if (!name) { skipped.push(i + 2); return; } // 1-indexed + header row
      records.push({
        companyId: session.user.companyId,
        name,
        phone:   findVal(row, PHONE_KEYS)   || null,
        email:   findVal(row, EMAIL_KEYS)   || null,
        address: findVal(row, ADDRESS_KEYS) || null,
        memo:    findVal(row, MEMO_KEYS)    || null,
      });
    });

    if (records.length === 0) {
      return NextResponse.json({ error: "「顧客名」列が見つかりません。列名を確認してください" }, { status: 400 });
    }

    await prisma.customer.createMany({ data: records, skipDuplicates: false });

    return NextResponse.json({
      imported: records.length,
      skipped: skipped.length,
      skippedRows: skipped,
    });
  } catch (error) {
    console.error("[POST /api/customers/import]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
