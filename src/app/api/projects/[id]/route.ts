import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MEMBER_INCLUDE = {
  include: {
    user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
  },
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  const isSubcontractor = !!session.user.subcontractorName;

  const project = await prisma.project.findFirst({
    where: {
      id,
      companyId: session.user.companyId,
      ...(isSubcontractor ? { members: { some: { userId: session.user.id } } } : {}),
    },
    include: { customer: true, members: MEMBER_INCLUDE },
  });

  if (!project) return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await prisma.project.findFirst({ where: { id, companyId: session.user.companyId } });
    if (!existing) return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });

    const body = await request.json();
    const { customerId, name, address, status, startDate, endDate, description } = body;

    if (customerId !== undefined && customerId !== null) {
      const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId: session.user.companyId } });
      if (!customer) return NextResponse.json({ error: "指定された顧客が見つかりません" }, { status: 400 });
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(customerId !== undefined ? { customerId } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
        ...(description !== undefined ? { description } : {}),
      },
      include: { customer: true, members: MEMBER_INCLUDE },
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error("[PATCH /api/projects/[id]]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await prisma.project.findFirst({ where: { id, companyId: session.user.companyId } });
    if (!existing) return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });

    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/projects/[id]]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
