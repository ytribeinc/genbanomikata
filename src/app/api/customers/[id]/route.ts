import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/customers/[id] - 顧客詳細（関連案件一覧も含める）
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id: params.id,
      companyId: session.user.companyId,
    },
    include: {
      projects: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) {
    return NextResponse.json(
      { error: "顧客が見つかりません" },
      { status: 404 }
    );
  }

  return NextResponse.json({ customer });
}

// PATCH /api/customers/[id] - 顧客更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const existing = await prisma.customer.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "顧客が見つかりません" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, phone, address, email, memo } = body;

    const customer = await prisma.customer.update({
      where: { id: params.id },
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
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

// DELETE /api/customers/[id] - 顧客削除（案件がある場合は400エラー）
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const existing = await prisma.customer.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
      include: { projects: { select: { id: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "顧客が見つかりません" },
        { status: 404 }
      );
    }

    if (existing.projects.length > 0) {
      return NextResponse.json(
        { error: "この顧客には案件が存在するため削除できません" },
        { status: 400 }
      );
    }

    await prisma.customer.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/customers/[id]]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
