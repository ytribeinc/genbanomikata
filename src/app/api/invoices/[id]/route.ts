import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const INCLUDE = {
  customer: { select: { id: true, name: true, address: true, phone: true } },
  project:  { select: { id: true, name: true, address: true } },
  estimate: { select: { id: true, estimateNo: true } },
  createdBy:{ select: { id: true, name: true } },
  items:    { orderBy: { sortOrder: "asc" as const } },
  company:  { select: { id: true, name: true } },
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId: session.user.companyId },
    include: INCLUDE,
  });

  if (!invoice) return NextResponse.json({ error: "請求書が見つかりません" }, { status: 404 });
  return NextResponse.json({ invoice });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await prisma.invoice.findFirst({ where: { id, companyId: session.user.companyId } });
    if (!existing) return NextResponse.json({ error: "請求書が見つかりません" }, { status: 404 });

    const body = await request.json();
    const { customerId, projectId, title, issueDate, dueDate, status, taxRate, notes, paidAmount, paidDate, items } = body;

    await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        ...(customerId  !== undefined ? { customerId: customerId || null }           : {}),
        ...(projectId   !== undefined ? { projectId:  projectId  || null }           : {}),
        ...(title       !== undefined ? { title }                                    : {}),
        ...(issueDate   !== undefined ? { issueDate: new Date(issueDate) }           : {}),
        ...(dueDate     !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(status      !== undefined ? { status }                                   : {}),
        ...(taxRate     !== undefined ? { taxRate }                                  : {}),
        ...(notes       !== undefined ? { notes: notes || null }                     : {}),
        ...(paidAmount  !== undefined ? { paidAmount: Number(paidAmount) || 0 }      : {}),
        ...(paidDate    !== undefined ? { paidDate: paidDate ? new Date(paidDate) : null } : {}),
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

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("[PATCH /api/invoices/[id]]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await prisma.invoice.findFirst({ where: { id, companyId: session.user.companyId } });
    if (!existing) return NextResponse.json({ error: "請求書が見つかりません" }, { status: 404 });

    await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
    await prisma.invoice.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/invoices/[id]]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
