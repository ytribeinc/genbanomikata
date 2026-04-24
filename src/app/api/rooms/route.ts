import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/rooms?projectId= — ルーム取得（なければ自動作成）
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId は必須です" },
      { status: 400 }
    );
  }

  // companyId でデータ分離チェック
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: session.user.companyId },
  });

  if (!project) {
    return NextResponse.json(
      { error: "プロジェクトが見つかりません" },
      { status: 404 }
    );
  }

  // 既存ルームを探す（なければ自動作成）
  let room = await prisma.talkRoom.findFirst({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });

  if (!room) {
    room = await prisma.talkRoom.create({
      data: { projectId },
    });
  }

  return NextResponse.json({ room });
}
