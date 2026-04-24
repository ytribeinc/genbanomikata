import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/projects/[id]/members - メンバー一覧
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const project = await prisma.project.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  });

  if (!project) {
    return NextResponse.json(
      { error: "案件が見つかりません" },
      { status: 404 }
    );
  }

  const members = await prisma.projectMember.findMany({
    where: { projectId: params.id },
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
  });

  return NextResponse.json({ members });
}

// POST /api/projects/[id]/members - メンバー追加 { userId, role }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
    });

    if (!project) {
      return NextResponse.json(
        { error: "案件が見つかりません" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { userId, role } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId は必須です" },
        { status: 400 }
      );
    }

    // 同一会社のユーザーか確認
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId: session.user.companyId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "指定されたユーザーが見つかりません" },
        { status: 404 }
      );
    }

    // すでにメンバーか確認
    const existingMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: params.id, userId: user.id } },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "すでにメンバーです" },
        { status: 409 }
      );
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId: params.id,
        userId: user.id,
        role: role ?? "MEMBER",
      },
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
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects/[id]/members]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/members - メンバー削除 { userId }
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
    });

    if (!project) {
      return NextResponse.json(
        { error: "案件が見つかりません" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId は必須です" },
        { status: 400 }
      );
    }

    const existingMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: params.id, userId } },
    });

    if (!existingMember) {
      return NextResponse.json(
        { error: "メンバーが見つかりません" },
        { status: 404 }
      );
    }

    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId: params.id, userId } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/projects/[id]/members]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
