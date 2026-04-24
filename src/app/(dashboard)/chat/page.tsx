"use client"

export const dynamic = "force-dynamic";;

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useChat } from "@/hooks/useChat";

interface Project {
  id: string;
  name: string;
  status: string;
}

interface Room {
  id: string;
}

export default function ChatPage() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .finally(() => setLoadingProjects(false));
  }, []);

  const selectProject = useCallback(async (project: Project) => {
    setSelectedProject(project);
    setRoom(null);
    setLoadingRoom(true);
    try {
      const res = await fetch(`/api/rooms?projectId=${project.id}`);
      if (res.ok) {
        const d = await res.json();
        setRoom(d.room);
      }
    } finally {
      setLoadingRoom(false);
    }
  }, []);

  // 最初のプロジェクトを自動選択
  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      selectProject(projects[0]);
    }
  }, [projects, selectedProject, selectProject]);

  const { messages, sendMessage, isConnected } = useChat(room?.id ?? "");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (loadingProjects) {
    return <div className="py-16"><LoadingSpinner label="読み込み中..." /></div>;
  }

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-500">
        案件が登録されていません
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
      {/* 左：案件リスト */}
      <div className="w-56 flex-shrink-0 border-r border-gray-200 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">案件チャット</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => selectProject(p)}
              className={[
                "w-full text-left px-4 py-3 text-sm transition-colors border-b border-gray-50",
                selectedProject?.id === p.id
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-700 hover:bg-gray-50",
              ].join(" ")}
            >
              <p className="truncate">{p.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 右：チャット本体 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ヘッダー */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {selectedProject?.name ?? "案件を選択"}
          </p>
          <span className={[
            "text-xs px-2 py-0.5 rounded-full",
            isConnected
              ? "bg-green-50 text-green-700"
              : "bg-gray-100 text-gray-500",
          ].join(" ")}>
            {isConnected ? "接続中" : "未接続"}
          </span>
        </div>

        {/* メッセージ */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loadingRoom ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner label="チャット読み込み中..." />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              まだメッセージがありません
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender.id === session?.user?.id;
              return (
                <div
                  key={msg.id}
                  className={["flex gap-2", isMine ? "flex-row-reverse" : "flex-row"].join(" ")}
                >
                  {!isMine && (
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0 mt-0.5">
                      {msg.sender.name.slice(0, 1)}
                    </div>
                  )}
                  <div className={["max-w-xs lg:max-w-md", isMine ? "items-end" : "items-start", "flex flex-col gap-0.5"].join(" ")}>
                    {!isMine && (
                      <p className="text-xs text-gray-500 px-1">{msg.sender.name}</p>
                    )}
                    <div
                      className={[
                        "px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words",
                        isMine
                          ? "bg-blue-600 text-white rounded-tr-sm"
                          : "bg-gray-100 text-gray-900 rounded-tl-sm",
                      ].join(" ")}
                    >
                      {msg.content}
                    </div>
                    <p className="text-xs text-gray-400 px-1">
                      {new Date(msg.createdAt).toLocaleTimeString("ja-JP", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* 入力 */}
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="flex gap-2">
            <textarea
              className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px] max-h-32"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力… (Enter で送信)"
              disabled={!room || loadingRoom}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !room || loadingRoom}
              className="flex-shrink-0 h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="h-5 w-5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Shift+Enter で改行</p>
        </div>
      </div>
    </div>
  );
}
