import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { projectId } = await params;

  // 案件がこの会社のものか確認
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: session.user.companyId },
    select: { id: true, name: true },
  });
  if (!project) return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });

  const budget = await prisma.projectBudget.findUnique({
    where: { projectId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ budget, project });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { projectId } = await params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId: session.user.companyId },
    });
    if (!project) return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });

    const { items } = await request.json();

    // 既存のbudgetItemsを削除してから再作成（upsert）
    const existing = await prisma.projectBudget.findUnique({ where: { projectId } });

    if (existing) {
      await prisma.projectBudgetItem.deleteMany({ where: { budgetId: existing.id } });
      const budget = await prisma.projectBudget.update({
        where: { projectId },
        data: {
          items: {
            create: (items ?? []).map((item: any, idx: number) => ({
              sortOrder:    idx,
              category:     item.category,
              budgetAmount: Number(item.budgetAmount) || 0,
              memo:         item.memo || null,
            })),
          },
        },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
      return NextResponse.json({ budget });
    } else {
      const budget = await prisma.projectBudget.create({
        data: {
          projectId,
          companyId: session.user.companyId,
          items: {
            create: (items ?? []).map((item: any, idx: number) => ({
              sortOrder:    idx,
              category:     item.category,
              budgetAmount: Number(item.budgetAmount) || 0,
              memo:         item.memo || null,
            })),
          },
        },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
      return NextResponse.json({ budget }, { status: 201 });
    }
  } catch (error) {
    console.error("[PUT /api/budgets/[projectId]]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
