import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/schedules/[id]/tasks
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: scheduleId } = await params;

  // companyId でデータ分離チェック
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, project: { companyId: session.user.companyId } },
  });

  if (!schedule) {
    return NextResponse.json(
      { error: "工程表が見つかりません" },
      { status: 404 }
    );
  }

  const tasks = await prisma.scheduleTask.findMany({
    where: { scheduleId },
    orderBy: { sortOrder: "asc" },
    include: {
      assignedUser: {
        select: { id: true, name: true, avatarUrl: true },
      },
    },
  });

  return NextResponse.json({ tasks });
}

// POST /api/schedules/[id]/tasks
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: scheduleId } = await params;

  try {
    // companyId でデータ分離チェック
    const schedule = await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        project: { companyId: session.user.companyId },
      },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: "工程表が見つかりません" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, startDate, endDate, assignedUserId, color, sortOrder } = body;

    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { error: "name, startDate, endDate は必須です" },
        { status: 400 }
      );
    }

    // assignedUser が同一 company か確認
    if (assignedUserId) {
      const user = await prisma.user.findFirst({
        where: { id: assignedUserId, companyId: session.user.companyId },
      });
      if (!user) {
        return NextResponse.json(
          { error: "担当者が見つかりません" },
          { status: 404 }
        );
      }
    }

    const task = await prisma.scheduleTask.create({
      data: {
        scheduleId,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        assignedUserId: assignedUserId ?? null,
        color: color ?? null,
        sortOrder: sortOrder ?? 0,
      },
      include: {
        assignedUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/schedules/[id]/tasks]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
