import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const INCLUDE = {
  project:   { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  items:     { orderBy: { sortOrder: "asc" as const } },
};

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status    = searchParams.get("status");
  const projectId = searchParams.get("projectId");

  const orders = await prisma.purchaseOrder.findMany({
    where: {
      companyId: session.user.companyId,
      ...(status    ? { status: status as any } : {}),
      ...(projectId ? { projectId }             : {}),
    },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const body = await request.json();
    const { projectId, vendorName, title, issueDate, deliveryDate, taxRate, notes, items } = body;

    if (!vendorName || !title || !issueDate) {
      return NextResponse.json({ error: "発注先・件名・発注日は必須です" }, { status: 400 });
    }

    // PO-YYYY-NNN 自動採番
    const year  = new Date(issueDate).getFullYear();
    const count = await prisma.purchaseOrder.count({
      where: { companyId: session.user.companyId, orderNo: { startsWith: `PO-${year}-` } },
    });
    const orderNo = `PO-${year}-${String(count + 1).padStart(3, "0")}`;

    const order = await prisma.purchaseOrder.create({
      data: {
        companyId:   session.user.companyId,
        createdById: session.user.id,
        projectId:   projectId   || null,
        orderNo,
        vendorName,
        title,
        issueDate:    new Date(issueDate),
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        taxRate:      taxRate ?? 10,
        notes:        notes   || null,
        items: {
          create: (items ?? []).map((item: any, idx: number) => ({
            sortOrder:   idx,
            name:        item.name,
            description: item.description || null,
            quantity:    Number(item.quantity)  || 1,
            unit:        item.unit || "式",
            unitPrice:   Number(item.unitPrice) || 0,
            amount:      (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
          })),
        },
      },
      include: INCLUDE,
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/purchase-orders]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
