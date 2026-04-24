import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/templates — 自社テンプレート一覧
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const templates = await prisma.template.findMany({
    where: { companyId: session.user.companyId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ templates });
}

// POST /api/templates — テンプレート作成（ADMIN/MANAGER のみ）
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (session.user.role === "WORKER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = await request.json();
  const { name, type, content } = body;

  if (!name || !type) {
    return NextResponse.json(
      { error: "name と type は必須です" },
      { status: 400 }
    );
  }

  const template = await prisma.template.create({
    data: {
      companyId: session.user.companyId,
      name,
      type,
      content: content ?? {},
    },
  });

  return NextResponse.json({ template }, { status: 201 });
}
