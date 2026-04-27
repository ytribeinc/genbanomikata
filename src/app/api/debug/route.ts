import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const info: Record<string, unknown> = {
    DATABASE_URL: process.env.DATABASE_URL ? "設定済み (" + process.env.DATABASE_URL.split("@")[1] + ")" : "未設定",
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "設定済み" : "未設定",
    NODE_ENV: process.env.NODE_ENV,
  };

  try {
    const result = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    info.db_status = "接続成功";
    info.table_count = Number(result[0]?.count ?? 0);

    if (Number(result[0]?.count ?? 0) === 0) {
      info.db_warning = "テーブルが存在しません。prisma db push が必要です。";
    }
  } catch (e) {
    info.db_status = "接続失敗";
    info.db_error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(info);
}
