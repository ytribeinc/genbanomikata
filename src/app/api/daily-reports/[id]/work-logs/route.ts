import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  const dailyReport = await prisma.dailyReport.findFirst({
    where: { id, project: { companyId: session.user.companyId } },
  });
  if (!dailyReport) return NextResponse.json({ error: "日報が見つかりません" }, { status: 404 });

  const workLogs = await prisma.workLog.findMany({
    where: { dailyReportId: id },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } } },
    orderBy: { startTime: "asc" },
  });
  return NextResponse.json({ workLogs });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { id } = await params;
    const dailyReport = await prisma.dailyReport.findFirst({
      where: { id, project: { companyId: session.user.companyId } },
    });
    if (!dailyReport) return NextResponse.json({ error: "日報が見つかりません" }, { status: 404 });

    const body = await request.json();
    const { userId, startTime, endTime, breakMinutes, workContent } = body;
    if (!startTime || !endTime) return NextResponse.json({ error: "startTime, endTime は必須です" }, { status: 400 });

    const targetUserId = userId ?? session.user.id;
    if (userId && userId !== session.user.id) {
      const user = await prisma.user.findFirst({ where: { id: userId, companyId: session.user.companyId } });
      if (!user) return NextResponse.json({ error: "指定されたユーザーが見つかりません" }, { status: 400 });
    }

    const workLog = await prisma.workLog.create({
      data: {
        dailyReportId: id,
        userId: targetUserId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        breakMinutes: breakMinutes ?? 0,
        workContent: workContent ?? null,
      },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } } },
    });
    return NextResponse.json({ workLog }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/daily-reports/[id]/work-logs]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
