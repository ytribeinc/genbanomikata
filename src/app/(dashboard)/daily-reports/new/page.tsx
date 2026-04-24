"use client";

import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface DraftSources {
  hasTemplate: boolean;
  scheduleTasksCount: number;
  pastReportsCount: number;
  aiGenerated: boolean;
}

type Weather = "SUNNY" | "CLOUDY" | "RAINY" | "SNOWY";

const WEATHER_OPTIONS: { value: Weather; label: string; icon: string }[] = [
  { value: "SUNNY", label: "晴れ", icon: "☀️" },
  { value: "CLOUDY", label: "曇り", icon: "☁️" },
  { value: "RAINY", label: "雨", icon: "🌧️" },
  { value: "SNOWY", label: "雪", icon: "❄️" },
];

interface Project { id: string; name: string }
interface User { id: string; name: string; role: string }

interface WorkLogRow {
  id: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  workContent: string;
}

function createEmptyWorkLog(): WorkLogRow {
  return {
    id: Math.random().toString(36).slice(2),
    startTime: "08:00",
    endTime: "17:00",
    breakMinutes: "60",
    workContent: "",
  };
}

function calcMinutes(start: string, end: string, breakMins: number): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm) - breakMins);
}

export default function DailyReportNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const initialProjectId = searchParams.get("projectId") ?? "";

  const isManagerOrAdmin =
    session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [workDate, setWorkDate] = useState(today);
  const [weather, setWeather] = useState<Weather>("SUNNY");
  const [summary, setSummary] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [workLogs, setWorkLogs] = useState<WorkLogRow[]>([createEmptyWorkLog()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftSources, setDraftSources] = useState<DraftSources | null>(null);

  // 写真ステージング
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stagedPhotos, setStagedPhotos] = useState<{ file: File; preview: string }[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, userRes] = await Promise.all([
        fetch("/api/projects"),
        isManagerOrAdmin ? fetch("/api/users") : Promise.resolve(null),
      ]);
      if (projRes.ok) {
        const d = await projRes.json();
        setProjects(d.projects ?? []);
      }
      if (userRes?.ok) {
        const d = await userRes.json();
        setUsers(d.users ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [isManagerOrAdmin]);

  useEffect(() => {
    if (session) fetchData();
  }, [session, fetchData]);

  function addWorkLog() {
    setWorkLogs((prev) => [...prev, createEmptyWorkLog()]);
  }
  function removeWorkLog(id: string) {
    setWorkLogs((prev) => prev.filter((l) => l.id !== id));
  }
  function updateWorkLog(id: string, field: keyof WorkLogRow, value: string) {
    setWorkLogs((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  }

  async function handleAiDraft() {
    if (!projectId) {
      setFormError("案件を選択してからAI生成してください");
      return;
    }
    setFormError(null);
    setDraftLoading(true);
    try {
      const res = await fetch("/api/daily-reports/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          workDate,
          userId: isManagerOrAdmin && targetUserId ? targetUserId : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error ?? "AI生成に失敗しました");
        return;
      }
      const { draft, sources } = await res.json();
      if (draft.summary) setSummary(draft.summary);
      if (draft.weather) setWeather(draft.weather);
      if (Array.isArray(draft.workLogs) && draft.workLogs.length > 0) {
        setWorkLogs(
          draft.workLogs.map((l: { startTime: string; endTime: string; breakMinutes: number; workContent: string }) => ({
            id: Math.random().toString(36).slice(2),
            startTime: l.startTime ?? "08:00",
            endTime: l.endTime ?? "17:00",
            breakMinutes: String(l.breakMinutes ?? 60),
            workContent: l.workContent ?? "",
          }))
        );
      }
      setDraftSources(sources);
    } catch {
      setFormError("AI生成中にエラーが発生しました");
    } finally {
      setDraftLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!projectId) return setFormError("案件を選択してください");
    if (!workDate) return setFormError("作業日を入力してください");

    setSubmitting(true);
    try {
      const reportRes = await fetch("/api/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          workDate,
          summary: summary || undefined,
          weather,
          // MANAGER/ADMIN のみ targetUserId を送信
          ...(isManagerOrAdmin && targetUserId ? { targetUserId } : {}),
        }),
      });

      if (!reportRes.ok) {
        const data = await reportRes.json();
        setFormError(data.error ?? "日報の作成に失敗しました");
        return;
      }

      const { dailyReport } = await reportRes.json();

      for (const log of workLogs.filter((l) => l.startTime && l.endTime)) {
        await fetch(`/api/daily-reports/${dailyReport.id}/work-logs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startTime: `${workDate}T${log.startTime}:00`,
            endTime: `${workDate}T${log.endTime}:00`,
            breakMinutes: parseInt(log.breakMinutes || "0", 10),
            workContent: log.workContent || undefined,
            userId: isManagerOrAdmin && targetUserId ? targetUserId : session?.user?.id,
          }),
        });
      }

      // ステージングされた写真をアップロード
      for (const { file } of stagedPhotos) {
        const form = new FormData();
        form.append("file", file);
        form.append("projectId", projectId);
        form.append("dailyReportId", dailyReport.id);
        await fetch("/api/photos/upload", { method: "POST", body: form });
      }

      router.push(`/daily-reports/${dailyReport.id}`);
    } catch {
      setFormError("サーバーエラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="py-16"><LoadingSpinner label="読み込み中..." /></div>;
  }

  // 選択中のユーザー名（MANAGER/ADMINが他の人を選んでいる場合に表示）
  const selectedUserName = isManagerOrAdmin && targetUserId
    ? users.find((u) => u.id === targetUserId)?.name
    : session?.user?.name;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/daily-reports" className="hover:text-blue-600 transition-colors">
          日報一覧
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">新規日報作成</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">日報を作成</h1>
        {/* 誰の日報か明示 */}
        <p className="mt-1 text-sm text-gray-500">
          作業者：
          <span className="font-medium text-gray-700">
            {selectedUserName ?? "（未選択）"}
          </span>
          {isManagerOrAdmin && (
            <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
              代理入力モード
            </span>
          )}
        </p>
      </div>

      {/* AI自動生成バナー */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-800">AI自動生成</p>
          <p className="text-xs text-blue-600 mt-0.5">
            工程表・過去の日報・自社テンプレートをもとに下書きを自動生成します
          </p>
          {draftSources && (
            <p className="text-xs text-blue-500 mt-1">
              工程タスク{draftSources.scheduleTasksCount}件・過去日報{draftSources.pastReportsCount}件を参照
              {draftSources.aiGenerated ? "・AI生成済み" : "（APIキー未設定のため工程表のみ）"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleAiDraft}
          disabled={draftLoading || !projectId}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {draftLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              生成中...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI下書き生成
            </>
          )}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {formError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        <Card padding="md" shadow="sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">基本情報</h2>
          <div className="space-y-4">

            {/* MANAGER/ADMIN のみ：作業員選択 */}
            {isManagerOrAdmin && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                  作業員
                  <span className="ml-2 text-xs text-gray-400 font-normal">
                    （空白 = 自分の日報）
                  </span>
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                >
                  <option value="">自分（{session?.user?.name}）</option>
                  {users
                    .filter((u) => u.id !== session?.user?.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}（{u.role === "WORKER" ? "職人" : u.role === "MANAGER" ? "監督" : "管理者"}）
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* 案件選択 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                案件<span className="ml-1 text-red-500">*</span>
              </label>
              <select
                required
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">案件を選択してください</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* 作業日 */}
            <Input
              label="作業日"
              type="date"
              required
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
            />

            {/* 天気 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">天気</label>
              <div className="flex gap-2 flex-wrap">
                {WEATHER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setWeather(opt.value)}
                    className={[
                      "px-4 py-2 rounded-full text-sm font-medium border transition-colors",
                      weather === opt.value
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 作業概要 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">作業概要</label>
              <textarea
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="本日の作業の概要を入力..."
              />
            </div>
          </div>
        </Card>

        {/* 作業ログ */}
        <Card padding="md" shadow="sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              作業ログ（{workLogs.length}件）
            </h2>
            <Button type="button" variant="ghost" size="sm" onClick={addWorkLog}>
              + 行を追加
            </Button>
          </div>

          <div className="space-y-4">
            {workLogs.map((log, idx) => {
              const mins = log.startTime && log.endTime
                ? calcMinutes(log.startTime, log.endTime, parseInt(log.breakMinutes || "0", 10))
                : 0;
              return (
                <div key={log.id} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">作業 {idx + 1}</span>
                    <div className="flex items-center gap-3">
                      {mins > 0 && (
                        <span className="text-xs text-gray-500 bg-white border border-gray-200 rounded px-2 py-0.5">
                          実働 {Math.floor(mins / 60)}時間{mins % 60 > 0 ? `${mins % 60}分` : ""}
                        </span>
                      )}
                      {workLogs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeWorkLog(log.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
                          aria-label="削除"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Input label="開始時間" type="time" value={log.startTime}
                      onChange={(e) => updateWorkLog(log.id, "startTime", e.target.value)} />
                    <Input label="終了時間" type="time" value={log.endTime}
                      onChange={(e) => updateWorkLog(log.id, "endTime", e.target.value)} />
                    <Input label="休憩（分）" type="number" min="0" step="5" value={log.breakMinutes}
                      onChange={(e) => updateWorkLog(log.id, "breakMinutes", e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">作業内容</label>
                    <textarea
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={2}
                      value={log.workContent}
                      onChange={(e) => updateWorkLog(log.id, "workContent", e.target.value)}
                      placeholder="作業内容の詳細..."
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 写真 */}
        <Card padding="md" shadow="sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              作業写真（{stagedPhotos.length}枚）
            </h2>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + 写真を追加
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              const newPhotos = files.map((file) => ({
                file,
                preview: URL.createObjectURL(file),
              }));
              setStagedPhotos((prev) => [...prev, ...newPhotos]);
              e.target.value = "";
            }}
          />

          {stagedPhotos.length === 0 ? (
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-gray-500">タップして写真を選択</p>
              <p className="text-xs text-gray-400 mt-1">日報提出時に自動でアップロードされます</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {stagedPhotos.map(({ preview }, idx) => (
                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img src={preview} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setStagedPhotos((prev) => {
                      URL.revokeObjectURL(prev[idx].preview);
                      return prev.filter((_, i) => i !== idx);
                    })}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div
                className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/daily-reports">
            <Button type="button" variant="ghost" size="md">キャンセル</Button>
          </Link>
          <Button type="submit" variant="primary" size="md" loading={submitting}>
            日報を提出{stagedPhotos.length > 0 ? `（写真${stagedPhotos.length}枚）` : ""}
          </Button>
        </div>
      </form>
    </div>
  );
}
