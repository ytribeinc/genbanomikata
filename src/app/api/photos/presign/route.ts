import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPresignedUploadUrl } from "@/lib/s3";

// POST /api/photos/presign
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId, filename, contentType, fileSize } = body;

    if (!projectId || !filename || !contentType) {
      return NextResponse.json(
        { error: "projectId, filename, contentType は必須です" },
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

    const ext = filename.split(".").pop() ?? "bin";
    const uuid = crypto.randomUUID();
    const key = `photos/${session.user.companyId}/${projectId}/${uuid}.${ext}`;

    // Photoレコードを先にDBに作成（url="pending"）
    const photo = await prisma.photo.create({
      data: {
        projectId,
        uploadedById: session.user.id,
        url: "pending",
        originalFilename: filename,
        fileSize: fileSize ?? null,
      },
    });

    const uploadUrl = await getPresignedUploadUrl(key, contentType);

    return NextResponse.json({ uploadUrl, key, photoId: photo.id }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/photos/presign]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
