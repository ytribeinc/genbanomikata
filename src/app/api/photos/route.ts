import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/photos?projectId=&tagId=&albumId=
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const tagId = searchParams.get("tagId");
    const albumId = searchParams.get("albumId");

    const photos = await prisma.photo.findMany({
      where: {
        project: { companyId: session.user.companyId },
        ...(projectId ? { projectId } : {}),
        ...(tagId
          ? { photoTags: { some: { tagId } } }
          : {}),
        ...(albumId
          ? { albumPhotos: { some: { albumId } } }
          : {}),
      },
      include: {
        photoTags: { include: { tag: true } },
        uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ photos });
  } catch (error) {
    console.error("[GET /api/photos]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
