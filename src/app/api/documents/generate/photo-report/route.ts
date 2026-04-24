import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import React from "react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePDF } from "@/lib/pdf/generate";
import { PhotoReportPDF } from "@/lib/pdf/templates/PhotoReportPDF";
import {
  uploadBufferToS3,
  getPresignedDownloadUrl,
  getPresignedDownloadUrl as getPhotoUrl,
} from "@/lib/s3";

// POST /api/documents/generate/photo-report
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId, photoIds, title } = body as {
      projectId: string;
      photoIds: string[];
      title: string;
    };

    if (!projectId || !photoIds || !Array.isArray(photoIds) || !title) {
      return NextResponse.json(
        { error: "projectId, photoIds, title は必須です" },
        { status: 400 }
      );
    }

    // プロジェクト + Company を取得
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId: session.user.companyId },
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "プロジェクトが見つかりません" },
        { status: 404 }
      );
    }

    // Photo + Tags を取得（指定されたIDのもの、順序維持）
    const photos = await prisma.photo.findMany({
      where: {
        id: { in: photoIds },
        projectId,
      },
      include: {
        photoTags: {
          include: {
            tag: { select: { id: true, name: true } },
          },
        },
      },
    });

    // photoIds の順序に並べ替え
    type PhotoWithTags = (typeof photos)[number];
    const photoMap = new Map<string, PhotoWithTags>(
      photos.map((p: PhotoWithTags) => [p.id, p] as [string, PhotoWithTags])
    );
    const orderedPhotos = photoIds
      .map((id) => photoMap.get(id))
      .filter((p): p is PhotoWithTags => p !== undefined);

    // 各写真のS3 presigned download URLを取得
    // photo.url はS3キーまたはフルURLのどちらかを想定
    // フルURLの場合はそのまま使い、キーの場合はpresignedURLを発行
    const photosWithUrls = await Promise.all(
      orderedPhotos.map(async (photo: PhotoWithTags) => {
        let downloadUrl: string;
        if (photo.url.startsWith("http")) {
          // すでにURLの場合はそのまま使用
          downloadUrl = photo.url;
        } else {
          // S3キーとして扱い presigned URL を取得
          downloadUrl = await getPhotoUrl(photo.url);
        }
        return {
          url: downloadUrl,
          caption: photo.caption,
          takenAt: photo.takenAt?.toISOString() ?? null,
          tags: photo.photoTags.map((pt: PhotoWithTags["photoTags"][number]) => ({ name: pt.tag.name })),
        };
      })
    );

    const company = project.company;

    // PDF生成
    const element = React.createElement(PhotoReportPDF, {
      title,
      project: {
        name: project.name,
        address: project.address,
      },
      company: { name: company.name },
      photos: photosWithUrls,
      createdAt: new Date().toISOString(),
    });
    const pdfBuffer = await generatePDF(element);

    // S3にアップロード
    const timestamp = Date.now();
    const s3Key = `documents/${company.id}/photo-report-${projectId}-${timestamp}.pdf`;
    const pdfUrl = await uploadBufferToS3(s3Key, pdfBuffer, "application/pdf");

    // Documentレコードを作成
    const document = await prisma.document.create({
      data: {
        projectId,
        createdById: session.user.id,
        templateId: null,
        title,
        pdfUrl,
        data: {
          type: "photo-report",
          photoIds,
        },
      },
    });

    // presigned download URL を発行
    const downloadUrl = await getPresignedDownloadUrl(s3Key);

    return NextResponse.json(
      { documentId: document.id, downloadUrl, pdfUrl },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/documents/generate/photo-report]", error);
    return NextResponse.json(
      { error: "PDF生成中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
