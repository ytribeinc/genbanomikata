import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import React from "react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePDF } from "@/lib/pdf/generate";
import { InvoicePDF } from "@/lib/pdf/templates/InvoicePDF";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId: session.user.companyId },
    include: {
      customer: { select: { name: true, address: true, phone: true } },
      project:  { select: { name: true, address: true } },
      items:    { orderBy: { sortOrder: "asc" } },
      company:  { select: { name: true } },
    },
  });

  if (!invoice) return NextResponse.json({ error: "請求書が見つかりません" }, { status: 404 });

  const element = React.createElement(InvoicePDF, {
    invoice: {
      ...invoice,
      issueDate: invoice.issueDate.toISOString(),
      dueDate:   invoice.dueDate?.toISOString()   ?? null,
      paidDate:  invoice.paidDate?.toISOString()  ?? null,
    },
    company: { name: invoice.company.name },
  });

  const pdfBuffer = await generatePDF(element);
  const filename  = `請求書_${invoice.invoiceNo}.pdf`;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
