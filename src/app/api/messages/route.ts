import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/messages?roomId=&before=&limit=
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const roomId = searchParams.get("roomId");
  const before = searchParams.get("before");
  const limitStr = searchParams.get("limit");
  const limit = limitStr ? Math.min(parseInt(limitStr, 10), 100) : 30;

  if (!roomId) {
    return NextResponse.json({ error: "roomId は必須です" }, { status: 400 });
  }

  // companyId でデータ分離チェック
  const room = await prisma.talkRoom.findFirst({
    where: {
      id: roomId,
      project: { companyId: session.user.companyId },
    },
  });

  if (!room) {
    return NextResponse.json(
      { error: "ルームが見つかりません" },
      { status: 404 }
    );
  }

  const messages = await prisma.message.findMany({
    where: {
      roomId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      sender: {
        select: { id: true, name: true, avatarUrl: true },
      },
    },
  });

  // 新しい順で取得して返す（クライアント側で逆順表示）
  return NextResponse.json({ messages: messages.reverse() });
}

// POST /api/messages
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { roomId, content, attachmentUrl } = body;

    if (!roomId || (!content && !attachmentUrl)) {
      return NextResponse.json(
        { error: "roomId と content または attachmentUrl は必須です" },
        { status: 400 }
      );
    }

    // companyId でデータ分離チェック
    const room = await prisma.talkRoom.findFirst({
      where: {
        id: roomId,
        project: { companyId: session.user.companyId },
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: "ルームが見つかりません" },
        { status: 404 }
      );
    }

    const message = await prisma.message.create({
      data: {
        roomId,
        senderId: session.user.id,
        content: content ?? null,
        attachmentUrl: attachmentUrl ?? null,
      },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/messages]", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
