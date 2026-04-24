import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/albums/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, coverPhotoId } = body;

    const existing = await prisma.album.findFirst({
      where: {
        id,
        project: { companyId: session.user.companyId },
      },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "アルバムが見つかりません" },
        { status: 404 }
      );
    }

    const album = await prisma.album.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(coverPhotoId !== undefined ? { coverPhotoId } : {}),
      },
    });

    return NextResponse.json({ album });
  } catch (error) {
    console.error("[PATCH /api/albums/[id]]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

// DELETE /api/albums/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const existing = await prisma.album.findFirst({
      where: {
        id,
        project: { companyId: session.user.companyId },
      },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "アルバムが見つかりません" },
        { status: 404 }
      );
    }

    await prisma.album.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/albums/[id]]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
