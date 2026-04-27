import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signJwt } from "@/lib/jwt";

interface RegisterBody {
  companyName: string;
  name: string;
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RegisterBody = await request.json();
    const { companyName, name, email, password } = body;

    if (!companyName || !name || !email || !password) {
      return NextResponse.json(
        { error: "すべてのフィールドを入力してください" },
        { status: 400 }
      );
    }

    // メールアドレスの重複チェック
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

    // Company と ADMIN User をトランザクションで作成
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { user } = await prisma.$transaction(async (tx: any) => {
      const company = await tx.company.create({
        data: { name: companyName },
      });

      const newUser = await tx.user.create({
        data: {
          companyId: company.id,
          name,
          email,
          passwordHash,
          role: "ADMIN",
        },
      });

      return { company, user: newUser };
    });

    const token = await signJwt({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    });

    return NextResponse.json(
      {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/auth/register]", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました", detail: message },
      { status: 500 }
    );
  }
}
