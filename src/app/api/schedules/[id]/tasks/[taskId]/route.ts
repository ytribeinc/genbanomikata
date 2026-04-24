import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function findTask(taskId: string, scheduleId: string, companyId: string) {
  return prisma.scheduleTask.findFirst({
    where: {
      id: taskId,
      scheduleId,
      schedule: {
        OR: [
          { companyId },
          { project: { companyId } },
        ],
      },
    },
    include: { schedule: { select: { projectId: true } } },
  });
}

// タスクが進行中になったら案件を「進行中」に自動更新（PLANNING→IN_PROGRESSのみ）
async function syncProjectToInProgress(scheduleId: string) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: { projectId: true },
  });
  if (!schedule?.projectId) return;

  const project = await prisma.project.findUnique({
    where: { id: schedule.projectId },
    select: { status: true },
  });
  if (!project || project.status !== "PLANNING") return;

  await prisma.project.update({
    where: { id: schedule.projectId },
    data: { status: "IN_PROGRESS" },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id: scheduleId, taskId } = await params;

  try {
    const existing = await findTask(taskId, scheduleId, session.user.companyId);
    if (!existing) return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 });

    const body = await request.json();
    const { name, startDate, endDate, assignedUserId, color, sortOrder, status } = body;

    if (assignedUserId !== undefined && assignedUserId !== null) {
      const user = await prisma.user.findFirst({
        where: { id: assignedUserId, companyId: session.user.companyId },
      });
      if (!user) return NextResponse.json({ error: "担当者が見つかりません" }, { status: 404 });
    }

    const task = await prisma.scheduleTask.update({
      where: { id: taskId },
      data: {
        ...(name !== undefined && { name }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(assignedUserId !== undefined && { assignedUserId }),
        ...(color !== undefined && { color }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(status !== undefined && { status }),
      },
      include: { assignedUser: { select: { id: true, name: true, avatarUrl: true } } },
    });

    // IN_PROGRESSになったら案件を「進行中」に自動更新
    if (status === "IN_PROGRESS") {
      await syncProjectToInProgress(scheduleId);
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error("[PATCH /api/schedules/[id]/tasks/[taskId]]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id: scheduleId, taskId } = await params;

  try {
    const existing = await findTask(taskId, scheduleId, session.user.companyId);
    if (!existing) return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 });

    await prisma.scheduleTask.delete({ where: { id: taskId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/schedules/[id]/tasks/[taskId]]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
