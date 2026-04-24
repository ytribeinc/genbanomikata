"use client"

export const dynamic = "force-dynamic";;

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

// ─── 型定義 ─────────────────────────────────────────────────────────────────

interface Document {
  id: string;
  title: string;
  pdfUrl: string | null;
  data: Record<string, unknown>;
  createdAt: string;
  createdBy: { id: string; name: string };
  template: { id: string; name: string; type: string } | null;
}

interface DailyReport {
  id: string;
  workDate: string;
  summary: string | null;
  weather: string;
  user: { name: string };
}

interface Photo {
  id: string;
  caption: string | null;
  takenAt: string | null;
  thumbnailUrl: string | null;
  url: string;
}

// ─── ヘルパー ────────────────────────────────────────────────────────────────

function getDocumentType(doc: Document): string {
  const data = doc.data as { type?: string };
  if (data?.type === "daily-report") return "日報PDF";
  if (data?.type === "photo-report") return "写真報告書";
  return "書類";
}

const WEATHER_LABELS: Record<string, string> = {
  SUNNY: "晴れ",
  CLOUDY: "曇り",
  RAINY: "雨",
  SNOWY: "雪",
};

// ─── メインページ ─────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 日報PDFモーダル
  const [showDailyReportModal, setShowDailyReportModal] = useState(false);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [dailyReportsLoading, setDailyReportsLoading] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [generatingDailyReport, setGeneratingDailyReport] = useState(false);

  // 写真報告書モーダル
  const [showPhotoReportModal, setShowPhotoReportModal] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [photoReportTitle, setPhotoReportTitle] = useState("");
  const [generatingPhotoReport, setGeneratingPhotoReport] = useState(false);

  // 削除中
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ─── データ取得 ──────────────────────────────────────────────────────────

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents?projectId=${projectId}`);
      if (!res.ok) throw new Error("取得に失敗しました");
      const data = await res.json();
      setDocuments(data.documents ?? []);
    } catch {
      setError("書類データの取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // 日報一覧を取得
  const openDailyReportModal = async () => {
    setShowDailyReportModal(true);
    setSelectedReportId("");
    setDailyReportsLoading(true);
    try {
      const res = await fetch(`/api/daily-reports?projectId=${projectId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDailyReports(data.dailyReports ?? []);
    } catch {
      setDailyReports([]);
    } finally {
      setDailyReportsLoading(false);
    }
  };

  // 写真一覧を取得
  const openPhotoReportModal = async () => {
    setShowPhotoReportModal(true);
    setSelectedPhotoIds(new Set());
    setPhotoReportTitle("");
    setPhotosLoading(true);
    try {
      const res = await fetch(`/api/photos?projectId=${projectId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPhotos(data.photos ?? []);
    } catch {
      setPhotos([]);
    } finally {
      setPhotosLoading(false);
    }
  };

  // ─── PDF生成 ─────────────────────────────────────────────────────────────

  const generateDailyReportPDF = async () => {
    if (!selectedReportId) return;
    setGeneratingDailyReport(true);
    try {
      const res = await fetch("/api/documents/generate/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyReportId: selectedReportId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "生成に失敗しました");
      }
      const data = await res.json();
      // ダウンロード開始
      window.open(data.downloadUrl, "_blank");
      setShowDailyReportModal(false);
      await fetchDocuments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "PDF生成に失敗しました");
    } finally {
      setGeneratingDailyReport(false);
    }
  };

  const generatePhotoReportPDF = async () => {
    if (selectedPhotoIds.size === 0 || !photoReportTitle.trim()) return;
    setGeneratingPhotoReport(true);
    try {
      const res = await fetch("/api/documents/generate/photo-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          photoIds: Array.from(selectedPhotoIds),
          title: photoReportTitle.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "生成に失敗しました");
      }
      const data = await res.json();
      window.open(data.downloadUrl, "_blank");
      setShowPhotoReportModal(false);
      await fetchDocuments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "PDF生成に失敗しました");
    } finally {
      setGeneratingPhotoReport(false);
    }
  };

  // ─── ダウンロード ─────────────────────────────────────────────────────────

  const handleDownload = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
      }
    } catch {
      alert("ダウンロードURLの取得に失敗しました");
    }
  };

  // ─── 削除 ────────────────────────────────────────────────────────────────

  const handleDelete = async (docId: string, title: string) => {
    if (!confirm(`「${title}」を削除しますか？`)) return;
    setDeletingId(docId);
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch {
      alert("削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  };

  // ─── 写真選択トグル ───────────────────────────────────────────────────────

  const togglePhoto = (photoId: string) => {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  // ─── レンダリング ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/projects" className="hover:text-blue-600 transition-colors">
          案件一覧
        </Link>
        <span>/</span>
        <Link
          href={`/projects/${projectId}`}
          className="hover:text-blue-600 transition-colors"
        >
          案件詳細
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">書類</span>
      </div>

      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">書類管理</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={openDailyReportModal}>
            日報PDFを生成
          </Button>
          <Button variant="primary" size="sm" onClick={openPhotoReportModal}>
            写真報告書を生成
          </Button>
        </div>
      </div>

      {/* 書類一覧テーブル */}
      <Card padding="none" shadow="sm">
        {loading ? (
          <div className="py-16">
            <LoadingSpinner label="書類を読み込み中..." />
          </div>
        ) : error ? (
          <div className="px-5 py-4 text-sm text-red-600">{error}</div>
        ) : documents.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-400">
            書類がまだありません。上のボタンからPDFを生成してください。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    タイトル
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    種別
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    作成者
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    作成日
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {doc.title}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                        {getDocumentType(doc)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {doc.createdBy.name}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(doc.createdAt).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(doc.id)}
                        >
                          ダウンロード
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          loading={deletingId === doc.id}
                          onClick={() => handleDelete(doc.id, doc.title)}
                        >
                          削除
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ─── 日報PDF生成モーダル ─────────────────────────────────────────── */}
      <Modal
        open={showDailyReportModal}
        onClose={() => setShowDailyReportModal(false)}
        title="日報PDFを生成"
        size="md"
      >
        <div className="space-y-4">
          {dailyReportsLoading ? (
            <LoadingSpinner label="日報を読み込み中..." />
          ) : dailyReports.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              この案件に日報がありません
            </p>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                日報を選択
              </label>
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {dailyReports.map((report) => (
                  <label
                    key={report.id}
                    className={[
                      "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors",
                      selectedReportId === report.id ? "bg-blue-50" : "",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="dailyReport"
                      value={report.id}
                      checked={selectedReportId === report.id}
                      onChange={() => setSelectedReportId(report.id)}
                      className="text-blue-600"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(report.workDate).toLocaleDateString("ja-JP")}
                        {"　"}
                        <span className="text-gray-500 font-normal">
                          {WEATHER_LABELS[report.weather] ?? report.weather}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {report.user.name}
                        {report.summary && ` · ${report.summary}`}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDailyReportModal(false)}
            >
              キャンセル
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!selectedReportId}
              loading={generatingDailyReport}
              onClick={generateDailyReportPDF}
            >
              PDF生成
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── 写真報告書生成モーダル ──────────────────────────────────────── */}
      <Modal
        open={showPhotoReportModal}
        onClose={() => setShowPhotoReportModal(false)}
        title="写真報告書を生成"
        size="xl"
      >
        <div className="space-y-4">
          {/* タイトル入力 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={photoReportTitle}
              onChange={(e) => setPhotoReportTitle(e.target.value)}
              placeholder="例: 施工写真報告書 2024年1月"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 写真選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              写真を選択{" "}
              <span className="text-gray-400 font-normal">
                ({selectedPhotoIds.size}枚選択中)
              </span>
            </label>
            {photosLoading ? (
              <LoadingSpinner label="写真を読み込み中..." />
            ) : photos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                この案件に写真がありません
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg p-2">
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo) => {
                    const selected = selectedPhotoIds.has(photo.id);
                    return (
                      <label
                        key={photo.id}
                        className={[
                          "relative cursor-pointer rounded-lg overflow-hidden border-2 transition-colors",
                          selected
                            ? "border-blue-500"
                            : "border-transparent hover:border-gray-300",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => togglePhoto(photo.id)}
                          className="sr-only"
                        />
                        {/* サムネイル */}
                        <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                          {photo.thumbnailUrl || photo.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo.thumbnailUrl ?? photo.url}
                              alt={photo.caption ?? "写真"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-gray-300 text-xs">
                              No image
                            </span>
                          )}
                        </div>
                        {/* 選択チェックマーク */}
                        {selected && (
                          <div className="absolute top-1 right-1 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                            ✓
                          </div>
                        )}
                        {/* キャプション */}
                        {photo.caption && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                            <p className="text-white text-xs truncate">
                              {photo.caption}
                            </p>
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPhotoReportModal(false)}
            >
              キャンセル
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={selectedPhotoIds.size === 0 || !photoReportTitle.trim()}
              loading={generatingPhotoReport}
              onClick={generatePhotoReportPDF}
            >
              PDF生成
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
