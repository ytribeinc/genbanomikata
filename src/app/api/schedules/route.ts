import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/schedules?projectId=  （projectId省略時は会社全体）
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const projectId = searchParams.get("projectId");

  if (projectId) {
    // 案件が自社のものか確認
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId: session.user.companyId },
    });
    if (!project) return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 });

    const schedules = await prisma.schedule.findMany({
      where: { projectId },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ schedules });
  }

  // 会社全体のスケジュール（未紐づけ含む）
  const schedules = await prisma.schedule.findMany({
    where: {
      OR: [
        { companyId: session.user.companyId },
        { project: { companyId: session.user.companyId } },
      ],
    },
    include: { project: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ schedules });
}

// POST /api/schedules
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const body = await request.json();
    const { projectId, title, tasks } = body;

    if (!title) return NextResponse.json({ error: "title は必須です" }, { status: 400 });

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, companyId: session.user.companyId },
      });
      if (!project) return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 });
    }

    const schedule = await prisma.schedule.create({
      data: {
        companyId: session.user.companyId,
        projectId: projectId || null,
        title,
        tasks: tasks ? {
          create: tasks.map((t: any, idx: number) => ({
            name:           t.name,
            startDate:      new Date(t.startDate),
            endDate:        new Date(t.endDate),
            status:         t.status ?? "TODO",
            color:          t.color ?? null,
            assignedUserId: t.assignedUserId ?? null,
            sortOrder:      idx,
          })),
        } : undefined,
      },
      include: {
        project: { select: { id: true, name: true } },
        tasks:   { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/schedules]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
