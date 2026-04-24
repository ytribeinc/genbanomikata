import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/projects/[id] - 案件詳細（メンバー・顧客情報をinclude）
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const isSubcontractor = !!session.user.subcontractorName;

  const project = await prisma.project.findFirst({
    where: {
      id: params.id,
      companyId: session.user.companyId,
      // 下請けユーザーはメンバーとして登録された案件のみアクセス可
      ...(isSubcontractor ? { members: { some: { userId: session.user.id } } } : {}),
    },
    include: {
      customer: true,
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json(
      { error: "案件が見つかりません" },
      { status: 404 }
    );
  }

  return NextResponse.json({ project });
}

// PATCH /api/projects/[id] - 案件更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const existing = await prisma.project.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "案件が見つかりません" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { customerId, name, address, status, startDate, endDate, description } = body;

    // customerId が指定された場合、同一会社の顧客か確認
    if (customerId !== undefined && customerId !== null) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId: session.user.companyId },
      });
      if (!customer) {
        return NextResponse.json(
          { error: "指定された顧客が見つかりません" },
          { status: 400 }
        );
      }
    }

    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...(customerId !== undefined ? { customerId } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(startDate !== undefined
          ? { startDate: startDate ? new Date(startDate) : null }
          : {}),
        ...(endDate !== undefined
          ? { endDate: endDate ? new Date(endDate) : null }
          : {}),
        ...(description !== undefined ? { description } : {}),
      },
      include: {
        customer: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error("[PATCH /api/projects/[id]]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - 案件削除
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const existing = await prisma.project.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "案件が見つかりません" },
        { status: 404 }
      );
    }

    await prisma.project.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/projects/[id]]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
