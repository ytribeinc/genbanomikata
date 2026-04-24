"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type ProjectStatus = "PLANNING" | "IN_PROGRESS" | "COMPLETED" | "PAUSED";

interface Customer {
  id: string;
  name: string;
}

interface OwnUser {
  id: string;
  name: string;
  role: string;
}

interface Project {
  id: string;
  name: string;
  address: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  createdAt: string;
  customer: Customer | null;
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "計画中",
  IN_PROGRESS: "進行中",
  COMPLETED: "完了",
  PAUSED: "停止中",
};

const STATUS_BADGE: Record<ProjectStatus, "pending" | "active" | "completed" | "cancelled"> = {
  PLANNING: "pending",
  IN_PROGRESS: "active",
  COMPLETED: "completed",
  PAUSED: "cancelled",
};

type FilterStatus = "ALL" | ProjectStatus;

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "ALL", label: "すべて" },
  { value: "IN_PROGRESS", label: "進行中" },
  { value: "COMPLETED", label: "完了" },
  { value: "PLANNING", label: "計画中" },
  { value: "PAUSED", label: "停止中" },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [ownUsers, setOwnUsers] = useState<OwnUser[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  // 新規作成フォーム
  const [formData, setFormData] = useState({
    name: "",
    customerId: "",
    address: "",
    status: "PLANNING" as ProjectStatus,
    startDate: "",
    endDate: "",
    description: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [addrInherited, setAddrInherited] = useState(false);
  const [newProject, setNewProject] = useState<{ id: string; name: string } | null>(null);

  const fetchProjects = useCallback(async (status: FilterStatus) => {
    setLoading(true);
    setError(null);
    try {
      const url =
        status === "ALL"
          ? "/api/projects"
          : `/api/projects?status=${status}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("取得に失敗しました");
      const data = await res.json();
      setProjects(data.projects ?? []);
    } catch {
      setError("案件データの取得に失敗しました。ページを再読み込みしてください。");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/customers");
      if (!res.ok) return;
      const data = await res.json();
      setCustomers(data.customers ?? []);
    } catch {
      // 顧客取得失敗は無視
    }
  }, []);

  useEffect(() => {
    fetchProjects(filter);
  }, [filter, fetchProjects]);

  useEffect(() => {
    fetchCustomers();
    fetch("/api/users")
      .then(r => r.json())
      .then(d => setOwnUsers((d.users ?? []).filter((u: any) => !u.subcontractorName)));
  }, [fetchCustomers]);

  function resetForm() {
    setFormData({ name: "", customerId: "", address: "", status: "PLANNING", startDate: "", endDate: "", description: "" });
    setFormError(null);
    setAddrInherited(false);
    setSelectedMemberIds(new Set());
  }

  function toggleMember(userId: string) {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  }

  async function handleZipChange(zip: string) {
    const clean = zip.replace(/[^0-9]/g, "");
    if (clean.length === 7) {
      setZipLoading(true);
      try {
        const res = await fetch(`/api/zipcode?code=${clean}`);
        const data = await res.json();
        if (data.address) {
          setFormData(f => ({ ...f, address: data.address }));
          setAddrInherited(false);
        }
      } catch { /* ignore */ } finally { setZipLoading(false); }
    }
  }

  async function handleCustomerChange(customerId: string) {
    setFormData(f => ({ ...f, customerId }));
    setAddrInherited(false);
    if (!customerId) return;
    // 前回案件の住所を引き継ぐ
    try {
      const res = await fetch(`/api/customers/${customerId}/last-address`);
      const data = await res.json();
      if (data.address) {
        setFormData(f => ({ ...f, address: data.address }));
        setAddrInherited(true);
      }
    } catch { /* ignore */ }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError("案件名は必須です");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          customerId: formData.customerId || undefined,
          address: formData.address || undefined,
          status: formData.status,
          startDate: formData.startDate || undefined,
          endDate: formData.endDate || undefined,
          description: formData.description || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error ?? "作成に失敗しました");
        return;
      }
      const { project } = await res.json();

      // 選択した担当者を一括登録
      await Promise.all(
        Array.from(selectedMemberIds).map(userId =>
          fetch(`/api/projects/${project.id}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, role: "MEMBER" }),
          })
        )
      );

      setModalOpen(false);
      resetForm();
      fetchProjects(filter);
      setNewProject({ id: project.id, name: project.name });
    } catch {
      setFormError("サーバーエラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ページタイトル */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">案件一覧</h1>
          <p className="mt-1 text-sm text-gray-500">
            {loading ? "..." : `${projects.length} 件`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            新規案件
          </Button>
        </div>
      </div>

      {/* 案件作成後の見積作成バナー */}
      {newProject && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>「{newProject.name}」を作成しました。続けて見積を作成しますか？</span>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link href={`/estimates/new?projectId=${newProject.id}`}>
              <Button variant="primary" size="sm">見積を作成</Button>
            </Link>
            <button onClick={() => setNewProject(null)} className="text-blue-400 hover:text-blue-600 text-sm px-1">✕</button>
          </div>
        </div>
      )}

      {/* ステータスフィルタ */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={[
              "px-4 py-2 rounded-full text-sm font-medium transition-colors",
              filter === opt.value
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50",
            ].join(" ")}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 案件カード一覧 */}
      {loading ? (
        <div className="py-16">
          <LoadingSpinner label="案件データを読み込み中..." />
        </div>
      ) : projects.length === 0 ? (
        <Card padding="md" shadow="sm">
          <div className="py-12 text-center text-gray-500">
            <svg
              className="h-12 w-12 mx-auto mb-3 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            案件が登録されていません
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card
                padding="md"
                shadow="sm"
                className="h-full hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
              >
                <div className="flex flex-col h-full gap-3">
                  {/* ヘッダ */}
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-gray-900 leading-snug line-clamp-2">
                      {project.name}
                    </h2>
                    <Badge
                      variant={STATUS_BADGE[project.status]}
                      className="flex-shrink-0"
                    >
                      {STATUS_LABELS[project.status]}
                    </Badge>
                  </div>

                  {/* 顧客名 */}
                  {project.customer && (
                    <p className="text-sm text-gray-500 flex items-center gap-1.5">
                      <svg
                        className="h-4 w-4 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {project.customer.name}
                    </p>
                  )}

                  {/* 住所 */}
                  {project.address && (
                    <p className="text-sm text-gray-500 flex items-center gap-1.5 truncate">
                      <svg
                        className="h-4 w-4 text-gray-400 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {project.address}
                    </p>
                  )}

                  {/* 期間 */}
                  {(project.startDate || project.endDate) && (
                    <p className="text-xs text-gray-400 mt-auto flex items-center gap-1.5">
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {project.startDate
                        ? new Date(project.startDate).toLocaleDateString("ja-JP")
                        : "—"}
                      {" 〜 "}
                      {project.endDate
                        ? new Date(project.endDate).toLocaleDateString("ja-JP")
                        : "—"}
                    </p>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* 新規案件作成モーダル */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="新規案件を作成"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}

          <Input
            label="案件名"
            required
            value={formData.name}
            onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
            placeholder="例: 渋谷マンション外壁改修工事"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">顧客</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.customerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
            >
              <option value="">顧客を選択（任意）</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">郵便番号</label>
            <div className="flex gap-2 items-center">
              <input
                className="w-36 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例：1600022"
                maxLength={8}
                onChange={e => handleZipChange(e.target.value)}
              />
              {zipLoading && <span className="text-xs text-gray-400">検索中...</span>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">現場住所</label>
            {addrInherited && (
              <p className="text-xs text-blue-500 -mb-1">前回案件の住所を引き継ぎました（変更可）</p>
            )}
            <input
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.address}
              onChange={(e) => { setFormData((d) => ({ ...d, address: e.target.value })); setAddrInherited(false); }}
              placeholder="例: 東京都渋谷区..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">ステータス</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.status}
              onChange={(e) =>
                setFormData((d) => ({
                  ...d,
                  status: e.target.value as ProjectStatus,
                }))
              }
            >
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="開始日"
              type="date"
              value={formData.startDate}
              onChange={(e) =>
                setFormData((d) => ({ ...d, startDate: e.target.value }))
              }
            />
            <Input
              label="終了日"
              type="date"
              value={formData.endDate}
              onChange={(e) =>
                setFormData((d) => ({ ...d, endDate: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">説明</label>
            <textarea
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData((d) => ({ ...d, description: e.target.value }))
              }
              placeholder="工事の概要や特記事項など"
            />
          </div>

          {/* 担当者 */}
          {ownUsers.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">担当者</label>
              <div className="rounded-md border border-gray-200 divide-y divide-gray-100 max-h-40 overflow-y-auto">
                {ownUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded text-blue-600 focus:ring-blue-500"
                      checked={selectedMemberIds.has(u.id)}
                      onChange={() => toggleMember(u.id)}
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0">
                        {u.name.slice(0, 1)}
                      </div>
                      <span className="text-sm text-gray-900 truncate">{u.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {u.role === "ADMIN" ? "管理者" : u.role === "MANAGER" ? "マネージャー" : "作業員"}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
              {selectedMemberIds.size > 0 && (
                <p className="text-xs text-blue-600">{selectedMemberIds.size}名を担当者に設定</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setModalOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={submitting}
            >
              作成する
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
