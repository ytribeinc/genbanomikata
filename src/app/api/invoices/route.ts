import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const INCLUDE = {
  customer: { select: { id: true, name: true } },
  project:  { select: { id: true, name: true } },
  estimate: { select: { id: true, estimateNo: true } },
  createdBy:{ select: { id: true, name: true } },
  items:    { orderBy: { sortOrder: "asc" as const } },
};

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status     = searchParams.get("status");
  const projectId  = searchParams.get("projectId");
  const customerId = searchParams.get("customerId");

  const invoices = await prisma.invoice.findMany({
    where: {
      companyId: session.user.companyId,
      ...(status     ? { status: status as any } : {}),
      ...(projectId  ? { projectId }             : {}),
      ...(customerId ? { customerId }             : {}),
    },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invoices });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const body = await request.json();
    const { customerId, projectId, estimateId, title, issueDate, dueDate, taxRate, notes, items } = body;

    if (!title || !issueDate) {
      return NextResponse.json({ error: "件名と発行日は必須です" }, { status: 400 });
    }

    // 請求番号自動採番 INV-YYYY-NNN
    const year  = new Date(issueDate).getFullYear();
    const count = await prisma.invoice.count({
      where: { companyId: session.user.companyId, invoiceNo: { startsWith: `INV-${year}-` } },
    });
    const invoiceNo = `INV-${year}-${String(count + 1).padStart(3, "0")}`;

    const invoice = await prisma.invoice.create({
      data: {
        companyId:   session.user.companyId,
        createdById: session.user.id,
        customerId:  customerId  || null,
        projectId:   projectId   || null,
        estimateId:  estimateId  || null,
        invoiceNo,
        title,
        issueDate: new Date(issueDate),
        dueDate:   dueDate ? new Date(dueDate) : null,
        taxRate:   taxRate ?? 10,
        notes:     notes   || null,
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

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/invoices]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
