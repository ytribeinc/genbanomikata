import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

// グローバルシングルトン
const globalForIo = globalThis as unknown as {
  io: SocketIOServer | undefined;
};

export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
  if (globalForIo.io) {
    return globalForIo.io;
  }

  const io = new SocketIOServer(httpServer, {
    path: "/api/socket/io",
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // JWT 認証ミドルウェア
  io.use(async (socket: Socket, next) => {
    try {
      const token = await getToken({
        req: socket.request as Parameters<typeof getToken>[0]["req"],
        secret: process.env.NEXTAUTH_SECRET,
      });

      if (!token) {
        return next(new Error("認証が必要です"));
      }

      // socket.data にユーザー情報を格納
      socket.data.userId = token.id as string;
      socket.data.name = token.name as string;
      socket.data.companyId = token.companyId as string;

      next();
    } catch (err) {
      next(new Error("認証エラー"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const { userId, name, companyId } = socket.data as {
      userId: string;
      name: string;
      companyId: string;
    };

    console.log(`[Socket.io] connected: ${name} (${userId})`);

    // client→server: "join_room" { roomId }
    socket.on("join_room", async ({ roomId }: { roomId: string }) => {
      try {
        // companyId でデータ分離チェック
        const room = await prisma.talkRoom.findFirst({
          where: {
            id: roomId,
            project: { companyId },
          },
        });

        if (!room) {
          socket.emit("error", { message: "ルームが見つかりません" });
          return;
        }

        socket.join(roomId);

        // server→client: "user_joined" { userId, name }
        io.to(roomId).emit("user_joined", { userId, name });
      } catch (err) {
        console.error("[Socket.io] join_room error:", err);
        socket.emit("error", { message: "ルーム参加に失敗しました" });
      }
    });

    // client→server: "send_message" { roomId, content }
    socket.on(
      "send_message",
      async ({ roomId, content }: { roomId: string; content: string }) => {
        try {
          // companyId でデータ分離チェック
          const room = await prisma.talkRoom.findFirst({
            where: {
              id: roomId,
              project: { companyId },
            },
          });

          if (!room) {
            socket.emit("error", { message: "ルームが見つかりません" });
            return;
          }

          const message = await prisma.message.create({
            data: {
              roomId,
              senderId: userId,
              content,
            },
            include: {
              sender: {
                select: { id: true, name: true, avatarUrl: true },
              },
            },
          });

          // server→client: "new_message" { message }
          io.to(roomId).emit("new_message", { message });
        } catch (err) {
          console.error("[Socket.io] send_message error:", err);
          socket.emit("error", { message: "メッセージ送信に失敗しました" });
        }
      }
    );

    socket.on("disconnect", () => {
      console.log(`[Socket.io] disconnected: ${name} (${userId})`);
    });
  });

  globalForIo.io = io;
  return io;
}

export function getSocketIO(): SocketIOServer | undefined {
  return globalForIo.io;
}
