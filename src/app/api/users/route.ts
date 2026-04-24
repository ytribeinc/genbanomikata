import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/users - 自社ユーザー一覧
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { companyId: session.user.companyId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      subcontractorName: true,
      createdAt: true,
      companyId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ users });
}

// POST /api/users - ユーザー追加（ADMIN/MANAGERのみ）
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { role: callerRole, companyId } = session.user;

  if (callerRole !== "ADMIN" && callerRole !== "MANAGER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, email, password, role, subcontractorName } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "name, email, password は必須です" },
        { status: 400 }
      );
    }

    // MANAGERはADMINを作成できない
    if (callerRole === "MANAGER" && role === "ADMIN") {
      return NextResponse.json(
        { error: "MANAGERはADMINユーザーを作成できません" },
        { status: 403 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "このメールアドレスはすでに使用されています" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        companyId,
        name,
        email,
        passwordHash,
        role: role ?? "WORKER",
        subcontractorName: subcontractorName ?? null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        subcontractorName: true,
        createdAt: true,
        companyId: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/users]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
