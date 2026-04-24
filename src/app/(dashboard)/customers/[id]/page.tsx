"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const PROJECT_STATUS_LABEL: Record<string, string> = {
  PLANNING: "計画中",
  IN_PROGRESS: "進行中",
  COMPLETED: "完了",
  ON_HOLD: "保留中",
};

const PROJECT_STATUS_VARIANT: Record<string, "active" | "inactive" | "pending"> = {
  PLANNING: "pending",
  IN_PROGRESS: "active",
  COMPLETED: "inactive",
  ON_HOLD: "inactive",
};

interface Project {
  id: string;
  name: string;
  address: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  memo: string | null;
  createdAt: string;
  projects: Project[];
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 編集
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "", email: "", memo: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 削除
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCustomer(data.customer);
    } catch {
      setError("顧客情報の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchCustomer(); }, [fetchCustomer]);

  function startEdit() {
    if (!customer) return;
    setForm({
      name: customer.name,
      phone: customer.phone ?? "",
      address: customer.address ?? "",
      email: customer.email ?? "",
      memo: customer.memo ?? "",
    });
    setFormError(null);
    setEditing(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("顧客名は必須です"); return; }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          email: form.email.trim() || null,
          memo: form.memo.trim() || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "更新に失敗しました"); }
      const { customer: updated } = await res.json();
      setCustomer((prev) => prev ? { ...prev, ...updated } : prev);
      setEditing(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error ?? "削除に失敗しました");
        return;
      }
      router.push("/customers");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div className="py-16"><LoadingSpinner label="読み込み中..." /></div>;
  if (error || !customer) {
    return (
      <div className="space-y-4">
        <Link href="/customers"><Button variant="ghost" size="sm">← 顧客一覧</Button></Link>
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? "顧客が見つかりません"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/customers" className="hover:text-blue-600 transition-colors">顧客管理</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{customer.name}</span>
      </div>

      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          <p className="mt-1 text-sm text-gray-400">
            登録日: {new Date(customer.createdAt).toLocaleDateString("ja-JP")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={startEdit}>編集</Button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-1.5 rounded-lg text-sm text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
          >
            削除
          </button>
        </div>
      </div>

      {/* 基本情報 */}
      {editing ? (
        <Card padding="md" shadow="sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">基本情報を編集</h2>
          <form onSubmit={handleSave} className="space-y-4">
            {formError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{formError}</div>
            )}
            <Input
              label="顧客名（施主名）"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="電話番号"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <Input
                label="メールアドレス"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <Input
              label="住所"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">メモ</label>
              <textarea
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                value={form.memo}
                onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="ghost" size="md" onClick={() => setEditing(false)}>キャンセル</Button>
              <Button type="submit" variant="primary" size="md" loading={saving}>保存する</Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card padding="md" shadow="sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">基本情報</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-gray-500 mb-0.5">電話番号</dt>
              <dd className="text-gray-900 font-medium">
                {customer.phone
                  ? <a href={`tel:${customer.phone}`} className="text-blue-600 hover:underline">{customer.phone}</a>
                  : <span className="text-gray-300">未登録</span>}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 mb-0.5">メールアドレス</dt>
              <dd className="text-gray-900 font-medium">
                {customer.email
                  ? <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline">{customer.email}</a>
                  : <span className="text-gray-300">未登録</span>}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-gray-500 mb-0.5">住所</dt>
              <dd className="text-gray-900 font-medium">
                {customer.address ?? <span className="text-gray-300">未登録</span>}
              </dd>
            </div>
            {customer.memo && (
              <div className="sm:col-span-2">
                <dt className="text-gray-500 mb-0.5">メモ</dt>
                <dd className="text-gray-900 whitespace-pre-wrap">{customer.memo}</dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      {/* 紐づき案件 */}
      <Card padding="md" shadow="sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            関連案件（{customer.projects.length}件）
          </h2>
          <Link href={`/projects/new?customerId=${customer.id}`}>
            <Button variant="ghost" size="sm">+ 案件を作成</Button>
          </Link>
        </div>

        {customer.projects.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">この顧客に関連する案件がありません</p>
            <Link href={`/projects/new?customerId=${customer.id}`} className="mt-2 inline-block text-sm text-blue-600 hover:underline">
              案件を作成する →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {customer.projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 group-hover:text-blue-700 truncate">{p.name}</p>
                  {p.address && <p className="text-xs text-gray-500 mt-0.5 truncate">{p.address}</p>}
                  {(p.startDate || p.endDate) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.startDate ? new Date(p.startDate).toLocaleDateString("ja-JP") : "—"}
                      {" 〜 "}
                      {p.endDate ? new Date(p.endDate).toLocaleDateString("ja-JP") : "—"}
                    </p>
                  )}
                </div>
                <Badge variant={PROJECT_STATUS_VARIANT[p.status] ?? "inactive"}>
                  {PROJECT_STATUS_LABEL[p.status] ?? p.status}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* 削除確認 */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900 mb-2">顧客を削除</h2>
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-medium">{customer.name}</span> を削除しますか？<br />
              {customer.projects.length > 0
                ? <span className="text-red-600">この顧客には案件が{customer.projects.length}件あるため削除できません。</span>
                : "この操作は取り消せません。"}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" size="md" onClick={() => setConfirmDelete(false)}>キャンセル</Button>
              {customer.projects.length === 0 && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleting ? "削除中..." : "削除する"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
