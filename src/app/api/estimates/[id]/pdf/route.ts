import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import React from "react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePDF } from "@/lib/pdf/generate";
import { EstimatePDF } from "@/lib/pdf/templates/EstimatePDF";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  const estimate = await prisma.estimate.findFirst({
    where: { id, companyId: session.user.companyId },
    include: {
      customer: { select: { name: true, address: true, phone: true } },
      project: { select: { name: true, address: true } },
      items: { orderBy: { sortOrder: "asc" } },
      company: { select: { name: true } },
    },
  });

  if (!estimate) return NextResponse.json({ error: "見積が見つかりません" }, { status: 404 });

  const element = React.createElement(EstimatePDF, {
    estimate: {
      ...estimate,
      issueDate: estimate.issueDate.toISOString(),
      expiryDate: estimate.expiryDate?.toISOString() ?? null,
    },
    company: { name: estimate.company.name },
  });

  const pdfBuffer = await generatePDF(element);
  const filename = `見積書_${estimate.estimateNo}.pdf`;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
