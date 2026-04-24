import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/calendar/tasks
// 会社全体のすべての工程表タスクをスケジュール・案件情報付きで返す
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const tasks = await prisma.scheduleTask.findMany({
    where: {
      schedule: {
        OR: [
          { companyId: session.user.companyId },
          { project: { companyId: session.user.companyId } },
        ],
      },
    },
    include: {
      schedule: {
        select: {
          id: true,
          title: true,
          project: { select: { id: true, name: true } },
        },
      },
      assignedUser: { select: { id: true, name: true } },
    },
    orderBy: { startDate: "asc" },
  });

  return NextResponse.json({ tasks });
}
