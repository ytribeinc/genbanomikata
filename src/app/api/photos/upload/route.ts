import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

// POST /api/photos/upload  (multipart/form-data)
// fields: file, projectId, dailyReportId?(optional), caption?(optional)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const dailyReportId = formData.get("dailyReportId") as string | null;
    const caption = formData.get("caption") as string | null;

    if (!file || !projectId) {
      return NextResponse.json(
        { error: "file と projectId は必須です" },
        { status: 400 }
      );
    }

    // プロジェクトが自社のものか確認
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId: session.user.companyId },
    });
    if (!project) {
      return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 });
    }

    // 日報が指定されている場合は存在確認
    if (dailyReportId) {
      const report = await prisma.dailyReport.findFirst({
        where: { id: dailyReportId, projectId },
      });
      if (!report) {
        return NextResponse.json({ error: "日報が見つかりません" }, { status: 404 });
      }
    }

    // ファイル保存
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const uploadDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), buffer);

    const url = `/uploads/${filename}`;

    const photo = await prisma.photo.create({
      data: {
        projectId,
        uploadedById: session.user.id,
        dailyReportId: dailyReportId ?? null,
        url,
        originalFilename: file.name,
        fileSize: file.size,
        caption: caption ?? null,
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/photos/upload]", error);
    return NextResponse.json({ error: "アップロードに失敗しました" }, { status: 500 });
  }
}
