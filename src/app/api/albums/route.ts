import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/albums?projectId=
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    const albums = await prisma.album.findMany({
      where: {
        project: { companyId: session.user.companyId },
        ...(projectId ? { projectId } : {}),
      },
      include: {
        coverPhoto: { select: { id: true, url: true, thumbnailUrl: true } },
        _count: { select: { albumPhotos: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ albums });
  } catch (error) {
    console.error("[GET /api/albums]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

// POST /api/albums - アルバム作成
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId, name } = body;

    if (!projectId || !name) {
      return NextResponse.json(
        { error: "projectId, name は必須です" },
        { status: 400 }
      );
    }

    // プロジェクトが自社のものか確認
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId: session.user.companyId },
    });
    if (!project) {
      return NextResponse.json(
        { error: "プロジェクトが見つかりません" },
        { status: 404 }
      );
    }

    const album = await prisma.album.create({
      data: { projectId, name },
    });

    return NextResponse.json({ album }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/albums]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
