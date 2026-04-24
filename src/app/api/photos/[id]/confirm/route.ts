import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/photos/[id]/confirm
export async function POST(
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
    const { key, takenAt } = body;

    if (!key) {
      return NextResponse.json({ error: "key は必須です" }, { status: 400 });
    }

    // 自社の写真か確認
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

    const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION ?? "ap-northeast-1"}.amazonaws.com/${key}`;

    const updated = await prisma.photo.update({
      where: { id },
      data: {
        url,
        takenAt: takenAt ? new Date(takenAt) : new Date(),
      },
    });

    return NextResponse.json({ photo: updated });
  } catch (error) {
    console.error("[POST /api/photos/[id]/confirm]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
