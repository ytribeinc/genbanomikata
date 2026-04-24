import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/photos/[id]/tags - タグ追加
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const { id: photoId } = await params;
    const body = await request.json();
    const { tagId } = body;

    if (!tagId) {
      return NextResponse.json({ error: "tagId は必須です" }, { status: 400 });
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

    // タグが自社のものか確認
    const tag = await prisma.tag.findFirst({
      where: { id: tagId, companyId: session.user.companyId },
    });
    if (!tag) {
      return NextResponse.json(
        { error: "タグが見つかりません" },
        { status: 404 }
      );
    }

    const photoTag = await prisma.photoTag.upsert({
      where: { photoId_tagId: { photoId, tagId } },
      create: { photoId, tagId },
      update: {},
    });

    return NextResponse.json({ photoTag }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/photos/[id]/tags]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

// DELETE /api/photos/[id]/tags - タグ削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const { id: photoId } = await params;
    const body = await request.json();
    const { tagId } = body;

    if (!tagId) {
      return NextResponse.json({ error: "tagId は必須です" }, { status: 400 });
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

    await prisma.photoTag.deleteMany({
      where: { photoId, tagId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/photos/[id]/tags]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
