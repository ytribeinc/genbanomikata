import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/daily-reports/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await params;
  const dailyReport = await prisma.dailyReport.findFirst({
    where: {
      id,
      project: { companyId: session.user.companyId },
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true, role: true },
      },
      project: {
        select: { id: true, name: true, status: true, address: true },
      },
      workLogs: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { startTime: "asc" },
      },
      photos: {
        orderBy: { createdAt: "asc" },
        include: {
          uploadedBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!dailyReport) {
    return NextResponse.json(
      { error: "日報が見つかりません" },
      { status: 404 }
    );
  }

  return NextResponse.json({ dailyReport });
}

// PATCH /api/daily-reports/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const { id } = await Promise.resolve(params);
    const existing = await prisma.dailyReport.findFirst({
      where: {
        id,
        project: { companyId: session.user.companyId },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "日報が見つかりません" },
        { status: 404 }
      );
    }

    // WORKERは自分の日報のみ編集可
    if (
      session.user.role === "WORKER" &&
      existing.userId !== session.user.id
    ) {
      return NextResponse.json(
        { error: "他の人の日報を編集する権限がありません" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { summary, weather } = body;

    const dailyReport = await prisma.dailyReport.update({
      where: { id },
      data: {
        ...(summary !== undefined ? { summary } : {}),
        ...(weather !== undefined ? { weather } : {}),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, role: true },
        },
        project: {
          select: { id: true, name: true, status: true },
        },
        workLogs: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
          orderBy: { startTime: "asc" },
        },
      },
    });

    return NextResponse.json({ dailyReport });
  } catch (error) {
    console.error("[PATCH /api/daily-reports/[id]]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

// DELETE /api/daily-reports/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const { id } = await Promise.resolve(params);
    const existing = await prisma.dailyReport.findFirst({
      where: {
        id,
        project: { companyId: session.user.companyId },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "日報が見つかりません" },
        { status: 404 }
      );
    }

    // WORKERは自分の日報のみ削除可
    if (
      session.user.role === "WORKER" &&
      existing.userId !== session.user.id
    ) {
      return NextResponse.json(
        { error: "他の人の日報を削除する権限がありません" },
        { status: 403 }
      );
    }

    await prisma.workLog.deleteMany({ where: { dailyReportId: id } });
    await prisma.dailyReport.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/daily-reports/[id]]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
