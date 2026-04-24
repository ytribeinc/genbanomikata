import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const INCLUDE = {
  project:   { select: { id: true, name: true, address: true } },
  createdBy: { select: { id: true, name: true } },
  items:     { orderBy: { sortOrder: "asc" as const } },
  company:   { select: { id: true, name: true } },
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  const order = await prisma.purchaseOrder.findFirst({
    where: { id, companyId: session.user.companyId },
    include: INCLUDE,
  });

  if (!order) return NextResponse.json({ error: "発注書が見つかりません" }, { status: 404 });
  return NextResponse.json({ order });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await prisma.purchaseOrder.findFirst({ where: { id, companyId: session.user.companyId } });
    if (!existing) return NextResponse.json({ error: "発注書が見つかりません" }, { status: 404 });

    const body = await request.json();
    const { projectId, vendorName, title, issueDate, deliveryDate, status, taxRate, notes, items } = body;

    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });

    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(projectId    !== undefined ? { projectId: projectId || null }                         : {}),
        ...(vendorName   !== undefined ? { vendorName }                                           : {}),
        ...(title        !== undefined ? { title }                                                : {}),
        ...(issueDate    !== undefined ? { issueDate: new Date(issueDate) }                       : {}),
        ...(deliveryDate !== undefined ? { deliveryDate: deliveryDate ? new Date(deliveryDate) : null } : {}),
        ...(status       !== undefined ? { status }                                               : {}),
        ...(taxRate      !== undefined ? { taxRate }                                              : {}),
        ...(notes        !== undefined ? { notes: notes || null }                                 : {}),
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

    return NextResponse.json({ order });
  } catch (error) {
    console.error("[PATCH /api/purchase-orders/[id]]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await prisma.purchaseOrder.findFirst({ where: { id, companyId: session.user.companyId } });
    if (!existing) return NextResponse.json({ error: "発注書が見つかりません" }, { status: 404 });

    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    await prisma.purchaseOrder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/purchase-orders/[id]]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
