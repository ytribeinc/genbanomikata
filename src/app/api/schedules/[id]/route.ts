import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function findSchedule(id: string, companyId: string) {
  return prisma.schedule.findFirst({
    where: {
      id,
      OR: [
        { companyId },
        { project: { companyId } },
      ],
    },
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  const schedule = await prisma.schedule.findFirst({
    where: { id, OR: [{ companyId: session.user.companyId }, { project: { companyId: session.user.companyId } }] },
    include: {
      project: { select: { id: true, name: true, address: true } },
      tasks: {
        orderBy: { sortOrder: "asc" },
        include: { assignedUser: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });

  if (!schedule) return NextResponse.json({ error: "工程表が見つかりません" }, { status: 404 });
  return NextResponse.json({ schedule });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  try {
    const existing = await findSchedule(id, session.user.companyId);
    if (!existing) return NextResponse.json({ error: "工程表が見つかりません" }, { status: 404 });

    const body = await request.json();
    const { title, projectId } = body;

    const schedule = await prisma.schedule.update({
      where: { id },
      data: {
        ...(title     !== undefined ? { title }                        : {}),
        ...(projectId !== undefined ? { projectId: projectId || null } : {}),
      },
      include: { project: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error("[PATCH /api/schedules/[id]]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  try {
    const existing = await findSchedule(id, session.user.companyId);
    if (!existing) return NextResponse.json({ error: "工程表が見つかりません" }, { status: 404 });

    await prisma.schedule.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/schedules/[id]]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
