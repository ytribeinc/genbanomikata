import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { id, logId } = await params;
    const existing = await prisma.workLog.findFirst({
      where: { id: logId, dailyReportId: id, dailyReport: { project: { companyId: session.user.companyId } } },
    });
    if (!existing) return NextResponse.json({ error: "作業ログが見つかりません" }, { status: 404 });

    const body = await request.json();
    const { startTime, endTime, breakMinutes, workContent } = body;
    const workLog = await prisma.workLog.update({
      where: { id: logId },
      data: {
        ...(startTime !== undefined ? { startTime: new Date(startTime) } : {}),
        ...(endTime !== undefined ? { endTime: new Date(endTime) } : {}),
        ...(breakMinutes !== undefined ? { breakMinutes } : {}),
        ...(workContent !== undefined ? { workContent } : {}),
      },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } } },
    });
    return NextResponse.json({ workLog });
  } catch (error) {
    console.error("[PATCH /api/daily-reports/[id]/work-logs/[logId]]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { id, logId } = await params;
    const existing = await prisma.workLog.findFirst({
      where: { id: logId, dailyReportId: id, dailyReport: { project: { companyId: session.user.companyId } } },
    });
    if (!existing) return NextResponse.json({ error: "作業ログが見つかりません" }, { status: 404 });

    await prisma.workLog.delete({ where: { id: logId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/daily-reports/[id]/work-logs/[logId]]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
