import { NextRequest, NextResponse } from "next/server";

// Socket.io は Next.js の標準 Route Handler では直接統合できないため、
// カスタムサーバー (server.ts) 経由で初期化する。
// このルートは Socket.io の接続状態を確認するためのエンドポイント。
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  return NextResponse.json({
    message: "Socket.io is managed via custom server.",
    path: "/api/socket/io",
  });
}
