import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import React from "react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePDF } from "@/lib/pdf/generate";
import { SchedulePDF } from "@/lib/pdf/templates/SchedulePDF";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;

  const schedule = await prisma.schedule.findFirst({
    where: { id, project: { companyId: session.user.companyId } },
    include: {
      project: { select: { name: true, address: true } },
      tasks: {
        orderBy: { sortOrder: "asc" },
        include: { assignedUser: { select: { name: true } } },
      },
      // company経由で取得
    },
  });

  if (!schedule) return NextResponse.json({ error: "工程表が見つかりません" }, { status: 404 });

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { name: true, },
  });

  const element = React.createElement(SchedulePDF, {
    schedule: {
      title:   schedule.title,
      project: schedule.project,
      tasks:   schedule.tasks.map(t => ({
        name:         t.name,
        startDate:    t.startDate.toISOString(),
        endDate:      t.endDate.toISOString(),
        status:       t.status as "TODO" | "IN_PROGRESS" | "DONE",
        color:        t.color,
        assignedUser: t.assignedUser,
      })),
    },
    company:   { name: company?.name ?? "" },
    issueDate: new Date().toISOString(),
  });

  const pdfBuffer = await generatePDF(element);
  const filename  = `工程表_${schedule.project.name}_${schedule.title}.pdf`;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
