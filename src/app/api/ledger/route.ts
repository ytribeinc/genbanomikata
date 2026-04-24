import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { companyId: session.user.companyId },
    select: {
      id: true,
      name: true,
      address: true,
      status: true,
      startDate: true,
      endDate: true,
      customer: { select: { id: true, name: true } },
      invoices: {
        select: {
          status: true,
          taxRate: true,
          paidAmount: true,
          items: { select: { amount: true } },
        },
      },
      purchaseOrders: {
        where: { status: { not: "CANCELLED" } },
        select: {
          taxRate: true,
          items: { select: { amount: true } },
        },
      },
      budget: {
        include: { items: { select: { budgetAmount: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const ledger = projects.map((p) => {
    // 受注額（請求書の合計、税込）
    const contractAmount = p.invoices.reduce((sum, inv) => {
      const sub = inv.items.reduce((s, i) => s + i.amount, 0);
      return sum + sub + Math.round(sub * inv.taxRate / 100);
    }, 0);

    // 入金済み額
    const paidAmount = p.invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);

    // 発注額（税込、CANCELLED除く）
    const purchaseAmount = p.purchaseOrders.reduce((sum, po) => {
      const sub = po.items.reduce((s, i) => s + i.amount, 0);
      return sum + sub + Math.round(sub * po.taxRate / 100);
    }, 0);

    // 予算額
    const budgetAmount = p.budget
      ? p.budget.items.reduce((sum, i) => sum + i.budgetAmount, 0)
      : null;

    // 粗利 = 受注額 - 発注額
    const grossProfit = contractAmount - purchaseAmount;
    const grossMargin = contractAmount > 0 ? Math.round((grossProfit / contractAmount) * 1000) / 10 : null;

    return {
      id: p.id,
      name: p.name,
      address: p.address,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate,
      customer: p.customer,
      contractAmount,
      paidAmount,
      purchaseAmount,
      budgetAmount,
      grossProfit,
      grossMargin,
    };
  });

  return NextResponse.json({ ledger });
}
