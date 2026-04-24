import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=&projectId=
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const userId = searchParams.get("userId");
  const projectId = searchParams.get("projectId");

  const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const toDate = to ? new Date(to + "T23:59:59") : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

  const workLogs = await prisma.workLog.findMany({
    where: {
      startTime: { gte: fromDate },
      endTime: { lte: toDate },
      ...(userId ? { userId } : {}),
      dailyReport: {
        project: { companyId: session.user.companyId },
        ...(projectId ? { projectId } : {}),
      },
    },
    include: {
      user: { select: { id: true, name: true, role: true, subcontractorName: true } },
      dailyReport: {
        select: {
          id: true,
          workDate: true,
          project: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  // ユーザーごとに集計
  const userMap = new Map<string, {
    user: { id: string; name: string; role: string; subcontractorName: string | null };
    logs: typeof workLogs;
    totalMinutes: number;
    workDays: Set<string>;
  }>();

  for (const log of workLogs) {
    const uid = log.user.id;
    if (!userMap.has(uid)) {
      userMap.set(uid, { user: log.user, logs: [], totalMinutes: 0, workDays: new Set() });
    }
    const entry = userMap.get(uid)!;
    const actualMinutes = Math.max(
      0,
      (log.endTime.getTime() - log.startTime.getTime()) / 60000 - log.breakMinutes
    );
    entry.logs.push(log);
    entry.totalMinutes += actualMinutes;
    entry.workDays.add(log.dailyReport.workDate.toISOString().slice(0, 10));
  }

  const summary = Array.from(userMap.values()).map((entry) => ({
    user: entry.user,
    workDays: entry.workDays.size,
    totalMinutes: Math.round(entry.totalMinutes),
    avgMinutesPerDay: entry.workDays.size > 0
      ? Math.round(entry.totalMinutes / entry.workDays.size)
      : 0,
  }));

  // 日別詳細（ユーザー×日付）
  const details = workLogs.map((log) => ({
    id: log.id,
    userId: log.user.id,
    userName: log.user.name,
    workDate: log.dailyReport.workDate.toISOString().slice(0, 10),
    projectId: log.dailyReport.project.id,
    projectName: log.dailyReport.project.name,
    dailyReportId: log.dailyReport.id,
    startTime: log.startTime.toISOString(),
    endTime: log.endTime.toISOString(),
    breakMinutes: log.breakMinutes,
    actualMinutes: Math.round(
      Math.max(0, (log.endTime.getTime() - log.startTime.getTime()) / 60000 - log.breakMinutes)
    ),
    workContent: log.workContent,
  }));

  return NextResponse.json({ summary, details });
}
