import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import React from "react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePDF } from "@/lib/pdf/generate";
import { PurchaseOrderPDF } from "@/lib/pdf/templates/PurchaseOrderPDF";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  const order = await prisma.purchaseOrder.findFirst({
    where: { id, companyId: session.user.companyId },
    include: {
      project: { select: { name: true, address: true } },
      items:   { orderBy: { sortOrder: "asc" } },
      company: { select: { name: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "発注書が見つかりません" }, { status: 404 });

  const element = React.createElement(PurchaseOrderPDF, {
    order: {
      ...order,
      issueDate:    order.issueDate.toISOString(),
      deliveryDate: order.deliveryDate?.toISOString() ?? null,
    },
    company: { name: order.company.name },
  });

  const pdfBuffer = await generatePDF(element);
  const filename  = `発注書_${order.orderNo}.pdf`;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
