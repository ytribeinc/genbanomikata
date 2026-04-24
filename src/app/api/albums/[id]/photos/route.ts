import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/albums/[id]/photos - 写真をアルバムに追加
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const { id: albumId } = await params;
    const body = await request.json();
    const { photoId, sortOrder } = body;

    if (!photoId) {
      return NextResponse.json({ error: "photoId は必須です" }, { status: 400 });
    }

    // アルバムが自社のものか確認
    const album = await prisma.album.findFirst({
      where: {
        id: albumId,
        project: { companyId: session.user.companyId },
      },
    });
    if (!album) {
      return NextResponse.json(
        { error: "アルバムが見つかりません" },
        { status: 404 }
      );
    }

    // 写真が自社のものか確認
    const photo = await prisma.photo.findFirst({
      where: {
        id: photoId,
        project: { companyId: session.user.companyId },
      },
    });
    if (!photo) {
      return NextResponse.json(
        { error: "写真が見つかりません" },
        { status: 404 }
      );
    }

    const albumPhoto = await prisma.albumPhoto.upsert({
      where: { albumId_photoId: { albumId, photoId } },
      create: {
        albumId,
        photoId,
        sortOrder: sortOrder ?? 0,
      },
      update: {
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
    });

    return NextResponse.json({ albumPhoto }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/albums/[id]/photos]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

// DELETE /api/albums/[id]/photos - 写真をアルバムから削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const { id: albumId } = await params;
    const body = await request.json();
    const { photoId } = body;

    if (!photoId) {
      return NextResponse.json({ error: "photoId は必須です" }, { status: 400 });
    }

    // アルバムが自社のものか確認
    const album = await prisma.album.findFirst({
      where: {
        id: albumId,
        project: { companyId: session.user.companyId },
      },
    });
    if (!album) {
      return NextResponse.json(
        { error: "アルバムが見つかりません" },
        { status: 404 }
      );
    }

    await prisma.albumPhoto.deleteMany({
      where: { albumId, photoId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/albums/[id]/photos]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
