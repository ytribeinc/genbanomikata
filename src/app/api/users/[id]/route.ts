import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatarUrl: true,
  subcontractorName: true,
  createdAt: true,
  companyId: true,
} as const;

// GET /api/users/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: USER_SELECT,
  });

  if (!user) {
    return NextResponse.json(
      { error: "ユーザーが見つかりません" },
      { status: 404 }
    );
  }

  // 自社のユーザーのみ参照可能
  if (user.companyId !== session.user.companyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  return NextResponse.json({ user });
}

// PATCH /api/users/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await params;
  const { role: callerRole, companyId, id: callerId } = session.user;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { companyId: true },
  });

  if (!target) {
    return NextResponse.json(
      { error: "ユーザーが見つかりません" },
      { status: 404 }
    );
  }

  if (target.companyId !== companyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, role, avatarUrl, subcontractorName } = body;

    // role 変更は ADMIN のみ
    if (role !== undefined && callerRole !== "ADMIN") {
      return NextResponse.json(
        { error: "ロールの変更はADMINのみ可能です" },
        { status: 403 }
      );
    }

    // 自分以外への更新は ADMIN/MANAGER のみ
    if (id !== callerId && callerRole !== "ADMIN" && callerRole !== "MANAGER") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(subcontractorName !== undefined && { subcontractorName: subcontractorName || null }),
      },
      select: USER_SELECT,
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("[PATCH /api/users/[id]]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await params;
  const { role: callerRole, companyId, id: callerId } = session.user;

  // 自分自身の削除は不可
  if (id === callerId) {
    return NextResponse.json(
      { error: "自分自身を削除することはできません" },
      { status: 400 }
    );
  }

  if (callerRole !== "ADMIN" && callerRole !== "MANAGER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { companyId: true },
  });

  if (!target) {
    return NextResponse.json(
      { error: "ユーザーが見つかりません" },
      { status: 404 }
    );
  }

  if (target.companyId !== companyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  // MANAGERはADMINを削除できない
  if (callerRole === "MANAGER") {
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });
    if (targetUser?.role === "ADMIN") {
      return NextResponse.json(
        { error: "MANAGERはADMINユーザーを削除できません" },
        { status: 403 }
      );
    }
  }

  await prisma.user.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
