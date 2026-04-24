import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const INCLUDE = {
  customer: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  items: { orderBy: { sortOrder: "asc" as const } },
};

// GET /api/estimates?status=&projectId=&customerId=
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const projectId = searchParams.get("projectId");
  const customerId = searchParams.get("customerId");

  const estimates = await prisma.estimate.findMany({
    where: {
      companyId: session.user.companyId,
      ...(status ? { status: status as any } : {}),
      ...(projectId ? { projectId } : {}),
      ...(customerId ? { customerId } : {}),
    },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ estimates });
}

// POST /api/estimates
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const body = await request.json();
    const { customerId, projectId, title, issueDate, expiryDate, taxRate, notes, items } = body;

    if (!title || !issueDate) {
      return NextResponse.json({ error: "件名と発行日は必須です" }, { status: 400 });
    }

    // 見積番号を自動採番（EST-YYYY-NNN）
    const year = new Date(issueDate).getFullYear();
    const count = await prisma.estimate.count({
      where: { companyId: session.user.companyId, estimateNo: { startsWith: `EST-${year}-` } },
    });
    const estimateNo = `EST-${year}-${String(count + 1).padStart(3, "0")}`;

    const estimate = await prisma.estimate.create({
      data: {
        companyId: session.user.companyId,
        createdById: session.user.id,
        customerId: customerId || null,
        projectId: projectId || null,
        estimateNo,
        title,
        issueDate: new Date(issueDate),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        taxRate: taxRate ?? 10,
        notes: notes || null,
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

    return NextResponse.json({ estimate }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/estimates]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
