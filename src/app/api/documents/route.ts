import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/documents?projectId=
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId は必須です" },
      { status: 400 }
    );
  }

  // プロジェクトがこの会社に属しているか確認
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: session.user.companyId },
  });

  if (!project) {
    return NextResponse.json(
      { error: "プロジェクトが見つかりません" },
      { status: 404 }
    );
  }

  const documents = await prisma.document.findMany({
    where: { projectId },
    include: {
      createdBy: { select: { id: true, name: true } },
      template: { select: { id: true, name: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ documents });
}
