import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteS3Object } from "@/lib/s3";

// GET /api/photos/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const photo = await prisma.photo.findFirst({
      where: {
        id,
        project: { companyId: session.user.companyId },
      },
      include: {
        photoTags: { include: { tag: true } },
        uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    if (!photo) {
      return NextResponse.json(
        { error: "写真が見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({ photo });
  } catch (error) {
    console.error("[GET /api/photos/[id]]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

// PATCH /api/photos/[id]
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
    const { caption, takenAt } = body;

    const existing = await prisma.photo.findFirst({
      where: {
        id,
        project: { companyId: session.user.companyId },
      },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "写真が見つかりません" },
        { status: 404 }
      );
    }

    const photo = await prisma.photo.update({
      where: { id },
      data: {
        ...(caption !== undefined ? { caption } : {}),
        ...(takenAt !== undefined ? { takenAt: new Date(takenAt) } : {}),
      },
    });

    return NextResponse.json({ photo });
  } catch (error) {
    console.error("[PATCH /api/photos/[id]]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

// DELETE /api/photos/[id]
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

    const photo = await prisma.photo.findFirst({
      where: {
        id,
        project: { companyId: session.user.companyId },
      },
    });
    if (!photo) {
      return NextResponse.json(
        { error: "写真が見つかりません" },
        { status: 404 }
      );
    }

    // S3オブジェクトを削除（pending でなければ）
    if (photo.url && photo.url !== "pending") {
      try {
        // URLからキーを抽出
        const url = new URL(photo.url);
        const key = url.pathname.replace(/^\//, "");
        await deleteS3Object(key);
      } catch (s3Err) {
        console.error("[DELETE /api/photos/[id]] S3 delete failed:", s3Err);
        // S3削除失敗でもDBレコードは削除を継続
      }
    }

    await prisma.photo.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/photos/[id]]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
