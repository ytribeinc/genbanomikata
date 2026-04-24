import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id, companyId: session.user.companyId },
    include: { projects: { orderBy: { createdAt: "desc" } } },
  });

  if (!customer) return NextResponse.json({ error: "顧客が見つかりません" }, { status: 404 });
  return NextResponse.json({ customer });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await prisma.customer.findFirst({
      where: { id, companyId: session.user.companyId },
    });
    if (!existing) return NextResponse.json({ error: "顧客が見つかりません" }, { status: 404 });

    const body = await request.json();
    const { name, phone, address, email, memo } = body;
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(memo !== undefined ? { memo } : {}),
      },
    });
    return NextResponse.json({ customer });
  } catch (error) {
    console.error("[PATCH /api/customers/[id]]", error);
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
    const existing = await prisma.customer.findFirst({
      where: { id, companyId: session.user.companyId },
      include: { projects: { select: { id: true } } },
    });
    if (!existing) return NextResponse.json({ error: "顧客が見つかりません" }, { status: 404 });
    if (existing.projects.length > 0) {
      return NextResponse.json({ error: "この顧客には案件が存在するため削除できません" }, { status: 400 });
    }
    await prisma.customer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/customers/[id]]", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
