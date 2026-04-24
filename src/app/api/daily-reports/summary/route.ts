import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/daily-reports/summary?projectId=&userId=&from=&to=
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const projectId = searchParams.get("projectId");
  const userId = searchParams.get("userId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const dateFilter =
    from || to
      ? {
          workDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {};

  const dailyReports = await prisma.dailyReport.findMany({
    where: {
      project: { companyId: session.user.companyId },
      ...(projectId ? { projectId } : {}),
      ...(userId ? { userId } : {}),
      ...dateFilter,
    },
    include: {
      user: {
        select: { id: true, name: true },
      },
      project: {
        select: { id: true, name: true },
      },
      workLogs: {
        select: {
          id: true,
          userId: true,
          startTime: true,
          endTime: true,
          breakMinutes: true,
        },
      },
    },
    orderBy: { workDate: "asc" },
  });

  // workMinutes = (endTime - startTime) / 60000 - breakMinutes
  function calcWorkMinutes(
    startTime: Date,
    endTime: Date,
    breakMinutes: number
  ): number {
    const diffMs = endTime.getTime() - startTime.getTime();
    return Math.max(0, Math.floor(diffMs / 60000) - breakMinutes);
  }

  // byUser 集計
  const userMap = new Map<
    string,
    { userId: string; name: string; totalMinutes: number; reportCount: number }
  >();

  // byProject 集計
  const projectMap = new Map<
    string,
    { projectId: string; name: string; totalMinutes: number }
  >();

  // dailyTotals 集計
  const dailyMap = new Map<string, { date: string; totalMinutes: number }>();

  for (const report of dailyReports) {
    const dateKey = report.workDate.toISOString().slice(0, 10);
    let reportMinutes = 0;

    for (const log of report.workLogs) {
      const mins = calcWorkMinutes(log.startTime, log.endTime, log.breakMinutes);
      reportMinutes += mins;

      // byUser: ログの userId でも集計
      const logUserId = log.userId;
      if (!userMap.has(logUserId)) {
        // ユーザー名はレポートの user から引けない場合があるため別途取得対象
        userMap.set(logUserId, {
          userId: logUserId,
          name: "",
          totalMinutes: 0,
          reportCount: 0,
        });
      }
      const u = userMap.get(logUserId)!;
      u.totalMinutes += mins;
    }

    // byUser: reportCount はレポート作成者 (report.userId) で集計
    if (!userMap.has(report.userId)) {
      userMap.set(report.userId, {
        userId: report.userId,
        name: report.user.name,
        totalMinutes: 0,
        reportCount: 0,
      });
    }
    const reportUser = userMap.get(report.userId)!;
    if (!reportUser.name) reportUser.name = report.user.name;
    reportUser.reportCount += 1;

    // byProject
    if (!projectMap.has(report.projectId)) {
      projectMap.set(report.projectId, {
        projectId: report.projectId,
        name: report.project.name,
        totalMinutes: 0,
      });
    }
    projectMap.get(report.projectId)!.totalMinutes += reportMinutes;

    // dailyTotals
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { date: dateKey, totalMinutes: 0 });
    }
    dailyMap.get(dateKey)!.totalMinutes += reportMinutes;
  }

  // ユーザー名を補完（workLog userId がレポート作成者と異なる場合）
  const userIds = [...userMap.keys()].filter(
    (id) => !userMap.get(id)!.name
  );
  if (userIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, companyId: session.user.companyId },
      select: { id: true, name: true },
    });
    for (const u of users) {
      if (userMap.has(u.id)) {
        userMap.get(u.id)!.name = u.name;
      }
    }
  }

  return NextResponse.json({
    byUser: [...userMap.values()],
    byProject: [...projectMap.values()],
    dailyTotals: [...dailyMap.values()].sort((a, b) =>
      a.date.localeCompare(b.date)
    ),
  });
}
