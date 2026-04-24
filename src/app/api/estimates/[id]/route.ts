import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const INCLUDE = {
  customer: { select: { id: true, name: true, address: true, phone: true, email: true } },
  project: { select: { id: true, name: true, address: true } },
  createdBy: { select: { id: true, name: true } },
  items: { orderBy: { sortOrder: "asc" as const } },
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  const estimate = await prisma.estimate.findFirst({
    where: { id, companyId: session.user.companyId },
    include: INCLUDE,
  });

  if (!estimate) return NextResponse.json({ error: "見積が見つかりません" }, { status: 404 });
  return NextResponse.json({ estimate });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await prisma.estimate.findFirst({ where: { id, companyId: session.user.companyId } });
    if (!existing) return NextResponse.json({ error: "見積が見つかりません" }, { status: 404 });

    const body = await request.json();
    const { customerId, projectId, title, issueDate, expiryDate, status, taxRate, notes, items } = body;

    // 明細を全削除→再作成
    await prisma.estimateItem.deleteMany({ where: { estimateId: id } });

    const estimate = await prisma.estimate.update({
      where: { id },
      data: {
        ...(customerId !== undefined ? { customerId: customerId || null } : {}),
        ...(projectId !== undefined ? { projectId: projectId || null } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(issueDate !== undefined ? { issueDate: new Date(issueDate) } : {}),
        ...(expiryDate !== undefined ? { expiryDate: expiryDate ? new Date(expiryDate) : null } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(taxRate !== undefined ? { taxRate } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
        items: {
          create: (items ?? []).map((item: any, idx: number) => ({
            sortOrder: idx,
            name: item.name,
            description: item.description || null,
            quantity: Number(item.quantity) || 1,
            unit: item.unit || "式",
            unitPrice: Number(item.unitPrice) || 0,
            amount: (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
          })),
        },
      },
      include: INCLUDE,
    });

    return NextResponse.json({ estimate });
  } catch (error) {
    console.error("[PATCH /api/estimates/[id]]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await prisma.estimate.findFirst({ where: { id, companyId: session.user.companyId } });
    if (!existing) return NextResponse.json({ error: "見積が見つかりません" }, { status: 404 });

    await prisma.estimateItem.deleteMany({ where: { estimateId: id } });
    await prisma.estimate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/estimates/[id]]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
