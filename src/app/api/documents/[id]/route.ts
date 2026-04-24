import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPresignedDownloadUrl, deleteS3Object } from "@/lib/s3";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/documents/[id]
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await params;

  const document = await prisma.document.findFirst({
    where: {
      id,
      project: { companyId: session.user.companyId },
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      template: { select: { id: true, name: true, type: true } },
      project: { select: { id: true, name: true } },
    },
  });

  if (!document) {
    return NextResponse.json(
      { error: "書類が見つかりません" },
      { status: 404 }
    );
  }

  // pdfUrl からS3キーを抽出してpresigned URLを再発行
  let downloadUrl: string | null = null;
  if (document.pdfUrl) {
    try {
      // pdfUrl がフルURLの場合はS3キーを抽出
      const urlObj = new URL(document.pdfUrl);
      // パスの先頭の "/" を除く
      const s3Key = urlObj.pathname.replace(/^\//, "");
      downloadUrl = await getPresignedDownloadUrl(s3Key);
    } catch {
      // URLのパース失敗時はnull
      downloadUrl = null;
    }
  }

  return NextResponse.json({ document, downloadUrl });
}

// DELETE /api/documents/[id]
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await params;

  const document = await prisma.document.findFirst({
    where: {
      id,
      project: { companyId: session.user.companyId },
    },
  });

  if (!document) {
    return NextResponse.json(
      { error: "書類が見つかりません" },
      { status: 404 }
    );
  }

  // S3オブジェクトを削除
  if (document.pdfUrl) {
    try {
      const urlObj = new URL(document.pdfUrl);
      const s3Key = urlObj.pathname.replace(/^\//, "");
      await deleteS3Object(s3Key);
    } catch (error) {
      console.warn("[DELETE /api/documents/[id]] S3削除に失敗:", error);
      // S3削除失敗してもDBレコードは削除する
    }
  }

  // Documentレコードを削除
  await prisma.document.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
