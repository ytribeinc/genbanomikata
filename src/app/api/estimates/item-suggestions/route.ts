import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/estimates/item-suggestions?customerId=&projectId=
// 過去見積の明細から工種名・単位・平均単価を返す
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const projectId  = searchParams.get("projectId");

  const items = await prisma.estimateItem.findMany({
    where: {
      estimate: {
        companyId: session.user.companyId,
        ...(projectId  ? { projectId }  : {}),
        ...(customerId ? { customerId } : {}),
      },
    },
    select: { name: true, unit: true, unitPrice: true, quantity: true, description: true },
    orderBy: { createdAt: "desc" },
  });

  // 工種名ごとに集計：最頻単位・平均単価・最新の説明・出現回数
  const map = new Map<string, { units: string[]; prices: number[]; description: string; count: number }>();
  for (const item of items) {
    if (!item.name.trim()) continue;
    if (!map.has(item.name)) {
      map.set(item.name, { units: [], prices: [], description: item.description ?? "", count: 0 });
    }
    const entry = map.get(item.name)!;
    entry.units.push(item.unit);
    entry.prices.push(Number(item.unitPrice));
    if (item.description && !entry.description) entry.description = item.description;
    entry.count++;
  }

  function mode(arr: string[]): string {
    const freq = new Map<string, number>();
    for (const v of arr) freq.set(v, (freq.get(v) ?? 0) + 1);
    return [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "式";
  }
  function avg(arr: number[]): number {
    return arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
  }

  const suggestions = [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, { units, prices, description }]) => ({
      name,
      unit: mode(units),
      unitPrice: avg(prices),
      quantity: 1,
      description,
    }));

  return NextResponse.json({ suggestions });
}
