import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/templates/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (session.user.role === "WORKER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const existing = await prisma.template.findFirst({
    where: { id, companyId: session.user.companyId },
  });
  if (!existing) {
    return NextResponse.json({ error: "テンプレートが見つかりません" }, { status: 404 });
  }

  const body = await request.json();
  const { name, content } = body;

  const template = await prisma.template.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(content !== undefined ? { content } : {}),
    },
  });

  return NextResponse.json({ template });
}

// DELETE /api/templates/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (session.user.role === "WORKER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const existing = await prisma.template.findFirst({
    where: { id, companyId: session.user.companyId },
  });
  if (!existing) {
    return NextResponse.json({ error: "テンプレートが見つかりません" }, { status: 404 });
  }

  await prisma.template.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
