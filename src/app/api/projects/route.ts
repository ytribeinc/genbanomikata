import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/projects - 案件一覧（?status=, ?customerId=でフィルタ）
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const customerId = searchParams.get("customerId");

  const isSubcontractor = !!session.user.subcontractorName;

  const projects = await prisma.project.findMany({
    where: {
      companyId: session.user.companyId,
      ...(status ? { status: status as any } : {}),
      ...(customerId ? { customerId } : {}),
      // 下請けユーザーは自分がメンバーの案件のみ
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
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ projects });
}

// POST /api/projects - 案件新規作成
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { customerId, name, address, status, startDate, endDate, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "name は必須です" },
        { status: 400 }
      );
    }

    // customerId が指定された場合、同一会社の顧客か確認
    if (customerId) {
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

    const project = await prisma.project.create({
      data: {
        companyId: session.user.companyId,
        customerId: customerId ?? null,
        name,
        address: address ?? null,
        status: status ?? "PLANNING",
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        description: description ?? null,
      },
      include: {
        customer: true,
        members: true,
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
