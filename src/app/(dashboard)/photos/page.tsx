"use client"

export const dynamic = "force-dynamic";;

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface Photo {
  id: string;
  url: string;
  originalFilename: string | null;
  caption: string | null;
  fileSize: number | null;
  createdAt: string;
  dailyReportId: string | null;
  uploadedBy: { id: string; name: string; avatarUrl: string | null };
  photoTags: { tag: { id: string; name: string; color: string | null } }[];
}

interface Project {
  id: string;
  name: string;
}

function PhotosPageInner() {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId") ?? "";

  const [projects, setProjects] = useState<Project[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Photo | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []));
  }, []);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const url = selectedProjectId
        ? `/api/photos?projectId=${selectedProjectId}`
        : "/api/photos";
      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        setPhotos(d.photos ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  async function handleDelete(id: string) {
    if (!confirm("この写真を削除しますか？")) return;
    await fetch(`/api/photos/${id}`, { method: "DELETE" });
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">写真</h1>
        <span className="text-sm text-gray-500">{photos.length}枚</span>
      </div>

      {/* フィルター */}
      <div className="flex gap-3 flex-wrap">
        <select
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
        >
          <option value="">すべての案件</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-16"><LoadingSpinner label="読み込み中..." /></div>
      ) : photos.length === 0 ? (
        <Card padding="lg" shadow="sm">
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-3 text-sm font-medium text-gray-900">写真がありません</p>
            <p className="mt-1 text-sm text-gray-500">日報から写真をアップロードできます</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
              onClick={() => setSelected(photo)}
            >
              <img
                src={photo.url}
                alt={photo.caption ?? photo.originalFilename ?? "写真"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
              {photo.dailyReportId && (
                <div className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  日報
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </div>
          ))}
        </div>
      )}

      {/* ライトボックス */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-xl overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 overflow-hidden bg-gray-900 flex items-center justify-center min-h-0">
              <img
                src={selected.url}
                alt={selected.caption ?? "写真"}
                className="max-h-[60vh] max-w-full object-contain"
              />
            </div>
            <div className="p-4 space-y-2">
              {selected.caption && (
                <p className="text-sm font-medium text-gray-900">{selected.caption}</p>
              )}
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  <span>{selected.uploadedBy.name}</span>
                  <span className="mx-1">·</span>
                  <span>{new Date(selected.createdAt).toLocaleDateString("ja-JP")}</span>
                  {selected.dailyReportId && (
                    <>
                      <span className="mx-1">·</span>
                      <Link
                        href={`/daily-reports/${selected.dailyReportId}`}
                        className="text-blue-600 hover:underline"
                        onClick={() => setSelected(null)}
                      >
                        日報を見る
                      </Link>
                    </>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  削除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PhotosPage() {
  return (
    <Suspense fallback={<div />}>
      <PhotosPageInner />
    </Suspense>
  );
}
