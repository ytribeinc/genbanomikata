import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import React from "react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePDF } from "@/lib/pdf/generate";
import { DailyReportPDF } from "@/lib/pdf/templates/DailyReportPDF";

// POST /api/documents/generate/daily-report
// PDFバッファを直接レスポンスとして返す（S3不使用）
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { dailyReportId } = body;

    if (!dailyReportId) {
      return NextResponse.json({ error: "dailyReportId は必須です" }, { status: 400 });
    }

    const report = await prisma.dailyReport.findFirst({
      where: {
        id: dailyReportId,
        project: { companyId: session.user.companyId },
      },
      include: {
        user: { select: { id: true, name: true } },
        project: {
          select: {
            id: true,
            name: true,
            address: true,
            companyId: true,
            company: { select: { id: true, name: true } },
          },
        },
        workLogs: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { startTime: "asc" },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "日報が見つかりません" }, { status: 404 });
    }

    const reportData = {
      workDate: report.workDate.toISOString(),
      weather: report.weather,
      summary: report.summary,
      project: { name: report.project.name, address: report.project.address },
      user: { name: report.user.name },
      workLogs: report.workLogs.map((log) => ({
        startTime: log.startTime.toISOString(),
        endTime: log.endTime.toISOString(),
        breakMinutes: log.breakMinutes,
        workContent: log.workContent,
        user: { name: log.user.name },
      })),
    };

    const element = React.createElement(DailyReportPDF, {
      report: reportData,
      company: { name: report.project.company.name },
    });
    const pdfBuffer = await generatePDF(element);

    const dateStr = report.workDate.toLocaleDateString("ja-JP", {
      year: "numeric", month: "2-digit", day: "2-digit",
    }).replace(/\//g, "");
    const filename = `日報_${dateStr}_${report.user.name}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error("[POST /api/documents/generate/daily-report]", error);
    return NextResponse.json({ error: "PDF生成中にエラーが発生しました" }, { status: 500 });
  }
}
