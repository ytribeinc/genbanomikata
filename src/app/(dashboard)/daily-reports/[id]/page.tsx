"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const WEATHER_LABELS: Record<string, string> = {
  SUNNY: "☀️ 晴れ", CLOUDY: "☁️ 曇り", RAINY: "🌧️ 雨", SNOWY: "❄️ 雪",
};

interface Photo {
  id: string;
  url: string;
  originalFilename: string | null;
  caption: string | null;
  createdAt: string;
  uploadedBy: { id: string; name: string };
}

interface WorkLog {
  id: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  workContent: string | null;
  user: { id: string; name: string; avatarUrl: string | null };
}

interface DailyReport {
  id: string;
  workDate: string;
  summary: string | null;
  weather: string;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string };
  project: { id: string; name: string; address: string | null };
  workLogs: WorkLog[];
  photos: Photo[];
}

function calcMinutes(start: string, end: string, breakMins: number) {
  const s = new Date(start), e = new Date(end);
  return Math.max(0, (e.getTime() - s.getTime()) / 60000 - breakMins);
}

export default function DailyReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // 写真アップロード
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/daily-reports/${id}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setReport(d.dailyReport);
    } catch {
      setError("日報の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !report) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        form.append("projectId", report.project.id);
        form.append("dailyReportId", report.id);
        if (caption.trim()) form.append("caption", caption.trim());
        const res = await fetch("/api/photos/upload", { method: "POST", body: form });
        if (!res.ok) {
          const d = await res.json();
          setUploadError(d.error ?? "アップロードに失敗しました");
          return;
        }
      }
      setCaption("");
      fetchReport();
    } catch {
      setUploadError("アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownloadPDF() {
    if (!report) return;
    setPdfLoading(true);
    try {
      const res = await fetch("/api/documents/generate/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyReportId: report.id }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error ?? "PDF生成に失敗しました");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date(report.workDate).toLocaleDateString("ja-JP", {
        year: "numeric", month: "2-digit", day: "2-digit",
      }).replace(/\//g, "");
      a.href = url;
      a.download = `日報_${dateStr}_${report.user.name}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("PDF生成中にエラーが発生しました");
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (!confirm("この写真を削除しますか？")) return;
    await fetch(`/api/photos/${photoId}`, { method: "DELETE" });
    setReport((prev) => prev ? { ...prev, photos: prev.photos.filter((p) => p.id !== photoId) } : prev);
  }

  if (loading) return <div className="py-16"><LoadingSpinner label="読み込み中..." /></div>;
  if (error || !report) {
    return (
      <div className="space-y-4">
        <Link href="/daily-reports"><Button variant="ghost" size="sm">← 日報一覧</Button></Link>
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? "日報が見つかりません"}
        </div>
      </div>
    );
  }

  const isOwner = session?.user?.id === report.user.id;
  const isManagerOrAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";
  const canUpload = isOwner || isManagerOrAdmin;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/daily-reports" className="hover:text-blue-600 transition-colors">日報一覧</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">
          {new Date(report.workDate).toLocaleDateString("ja-JP")} - {report.user.name}
        </span>
      </div>

      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {new Date(report.workDate).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {report.project.name}　{WEATHER_LABELS[report.weather] ?? report.weather}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {pdfLoading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            PDF出力
          </button>
          <Badge variant="active">{report.user.name}</Badge>
        </div>
      </div>

      {/* 概要 */}
      {report.summary && (
        <Card padding="md" shadow="sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">作業概要</h2>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{report.summary}</p>
        </Card>
      )}

      {/* 作業ログ */}
      <Card padding="md" shadow="sm">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          作業ログ（{report.workLogs.length}件）
        </h2>
        {report.workLogs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">作業ログがありません</p>
        ) : (
          <div className="space-y-3">
            {report.workLogs.map((log) => {
              const mins = calcMinutes(log.startTime, log.endTime, log.breakMinutes);
              return (
                <div key={log.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">
                      {new Date(log.startTime).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                      {" 〜 "}
                      {new Date(log.endTime).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                      {log.breakMinutes > 0 && `（休憩${log.breakMinutes}分）`}
                    </span>
                    <span className="text-xs text-gray-400">
                      実働 {Math.floor(mins / 60)}時間{mins % 60 > 0 ? `${mins % 60}分` : ""}
                    </span>
                  </div>
                  {log.workContent && (
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{log.workContent}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 写真 */}
      <Card padding="md" shadow="sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            写真（{report.photos.length}枚）
          </h2>
          {canUpload && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {uploading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              )}
              写真を追加
            </button>
          )}
        </div>

        {/* キャプション入力 */}
        {canUpload && (
          <div className="mb-4">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="写真のキャプション（任意）"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />

        {uploadError && (
          <p className="text-sm text-red-600 mb-3">{uploadError}</p>
        )}

        {report.photos.length === 0 ? (
          <div
            className={[
              "border-2 border-dashed border-gray-300 rounded-lg p-8 text-center",
              canUpload ? "cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors" : "",
            ].join(" ")}
            onClick={() => canUpload && fileInputRef.current?.click()}
          >
            <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">
              {canUpload ? "クリックして写真を追加" : "写真がありません"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {report.photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
                onClick={() => setLightbox(photo)}
              >
                <img
                  src={photo.url}
                  alt={photo.caption ?? photo.originalFilename ?? "写真"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                {photo.caption && (
                  <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-xs px-2 py-1 truncate">
                    {photo.caption}
                  </div>
                )}
              </div>
            ))}
            {/* 追加ボタン */}
            {canUpload && (
              <div
                className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ライトボックス */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="bg-white rounded-xl overflow-hidden max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gray-900 flex items-center justify-center">
              <img
                src={lightbox.url}
                alt={lightbox.caption ?? "写真"}
                className="max-h-[70vh] max-w-full object-contain"
              />
            </div>
            <div className="p-4 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {lightbox.caption && <p className="font-medium text-gray-900 mb-0.5">{lightbox.caption}</p>}
                <span>{lightbox.uploadedBy.name}</span>
                <span className="mx-1">·</span>
                <span>{new Date(lightbox.createdAt).toLocaleDateString("ja-JP")}</span>
              </div>
              <div className="flex gap-3">
                <a href={lightbox.url} download className="text-sm text-blue-600 hover:underline">
                  保存
                </a>
                {canUpload && (
                  <button
                    onClick={() => { handleDeletePhoto(lightbox.id); setLightbox(null); }}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    削除
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
