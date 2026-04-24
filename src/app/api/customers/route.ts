import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/customers - 顧客一覧（?search=で名前検索可）
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");

  const customers = await prisma.customer.findMany({
    where: {
      companyId: session.user.companyId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
              { address: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { projects: true } },
    },
  });

  return NextResponse.json({ customers });
}

// POST /api/customers - 顧客新規作成
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, phone, address, email, memo } = body;

    if (!name) {
      return NextResponse.json(
        { error: "name は必須です" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.create({
      data: {
        companyId: session.user.companyId,
        name,
        phone: phone ?? null,
        address: address ?? null,
        email: email ?? null,
        memo: memo ?? null,
      },
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/customers]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
