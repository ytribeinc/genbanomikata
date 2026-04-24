import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/schedules/suggestions
// 会社のタスク名履歴（重複なし）を返す
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
    select: { name: true },
    orderBy: { name: "asc" },
  });

  // 重複除去
  const names = [...new Set(tasks.map(t => t.name))].sort();
  return NextResponse.json({ suggestions: names });
}
