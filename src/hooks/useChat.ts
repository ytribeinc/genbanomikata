"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export interface ChatMessage {
  id: string;
  roomId: string;
  content: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (content: string) => void;
  isConnected: boolean;
}

export function useChat(roomId: string): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // 過去メッセージを取得
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages?roomId=${encodeURIComponent(roomId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch (err) {
      console.error("[useChat] fetchMessages error:", err);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    fetchMessages();

    const socket = io({
      path: "/api/socket/io",
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join_room", { roomId });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    // server→client: "new_message" { message }
    socket.on("new_message", ({ message }: { message: ChatMessage }) => {
      setMessages((prev) => {
        // 重複排除
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    socket.on("connect_error", (err) => {
      console.error("[useChat] connect_error:", err.message);
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, fetchMessages]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim()) return;
      const socket = socketRef.current;
      if (socket?.connected) {
        socket.emit("send_message", { roomId, content });
      } else {
        // WebSocket 未接続時は REST API にフォールバック
        fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, content }),
        })
          .then((res) => res.json())
          .then(({ message }) => {
            if (message) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === message.id)) return prev;
                return [...prev, message];
              });
            }
          })
          .catch((err) => console.error("[useChat] REST fallback error:", err));
      }
    },
    [roomId]
  );

  return { messages, sendMessage, isConnected };
}
