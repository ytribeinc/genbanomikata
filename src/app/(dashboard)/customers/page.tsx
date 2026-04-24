"use client";

import { useState, useEffect, useCallback, FormEvent, useRef } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  memo: string | null;
  createdAt: string;
  _count?: { projects: number };
}

const emptyForm = { name: "", phone: "", address: "", email: "", memo: "", zipcode: "" };

async function fetchAddressByZip(zip: string): Promise<string | null> {
  const clean = zip.replace(/[^0-9]/g, "");
  if (clean.length !== 7) return null;
  try {
    const res = await fetch(`/api/zipcode?code=${clean}`);
    const data = await res.json();
    return data.address ?? null;
  } catch { /* ignore */ }
  return null;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // モーダル状態
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipFilled, setZipFilled] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 削除確認
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Excelインポート
  const [importModal, setImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCustomers = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/customers${q ? `?search=${encodeURIComponent(q)}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCustomers(data.customers ?? []);
    } catch {
      setError("顧客データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCustomers(debouncedSearch); }, [debouncedSearch, fetchCustomers]);

  async function handleZipChange(zip: string) {
    setForm(f => ({ ...f, zipcode: zip }));
    setZipFilled(false);
    const clean = zip.replace(/[^0-9]/g, "");
    if (clean.length === 7) {
      setZipLoading(true);
      const address = await fetchAddressByZip(clean);
      if (address) {
        setForm(f => ({ ...f, address }));
        setZipFilled(true);
      }
      setZipLoading(false);
    }
  }

  function openAdd() {
    setForm(emptyForm);
    setFormError(null);
    setModal("add");
  }

  function openEdit(c: Customer) {
    setEditTarget(c);
    setForm({
      name: c.name,
      phone: c.phone ?? "",
      address: c.address ?? "",
      email: c.email ?? "",
      memo: c.memo ?? "",
    });
    setFormError(null);
    setModal("edit");
  }

  function closeModal() {
    setModal(null);
    setEditTarget(null);
    setForm(emptyForm);
    setFormError(null);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("顧客名は必須です"); return; }
    setSaving(true);
    setFormError(null);
    try {
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        email: form.email.trim() || null,
        memo: form.memo.trim() || null,
      };

      if (modal === "add") {
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "作成に失敗しました"); }
        const { customer } = await res.json();
        setCustomers((prev) => [customer, ...prev]);
      } else if (modal === "edit" && editTarget) {
        const res = await fetch(`/api/customers/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "更新に失敗しました"); }
        const { customer } = await res.json();
        setCustomers((prev) => prev.map((c) => c.id === customer.id ? { ...c, ...customer } : c));
      }
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  function openImport() {
    setImportFile(null);
    setImportResult(null);
    setImportError(null);
    setImportModal(true);
  }

  function downloadTemplate() {
    const header = ["顧客名", "電話番号", "メールアドレス", "住所", "メモ"];
    const sample = ["田中太郎", "090-1234-5678", "tanaka@example.com", "東京都新宿区1-2-3", "VIP顧客"];
    const csv = [header, sample].map(row => row.join(",")).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "顧客インポートテンプレート.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      const res = await fetch("/api/customers/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setImportError(data.error ?? "インポートに失敗しました"); return; }
      setImportResult({ imported: data.imported, skipped: data.skipped });
      fetchCustomers(debouncedSearch);
    } catch {
      setImportError("通信エラーが発生しました");
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/customers/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error ?? "削除に失敗しました");
        return;
      }
      setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">顧客管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            {loading ? "..." : `${customers.length} 件登録`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="md" onClick={openImport}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Excelから一括登録
          </Button>
          <Button variant="primary" size="md" onClick={openAdd}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            顧客を追加
          </Button>
        </div>
      </div>

      {/* 検索 */}
      <Card padding="md" shadow="sm">
        <div className="flex gap-3 flex-col sm:flex-row">
          <div className="flex-1">
            <Input
              type="search"
              placeholder="顧客名・電話番号・住所で検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {search && (
            <Button type="button" variant="ghost" size="md" onClick={() => setSearch("")}>
              クリア
            </Button>
          )}
        </div>
      </Card>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* 一覧 */}
      <Card padding="none" shadow="sm">
        {loading ? (
          <div className="py-16"><LoadingSpinner label="読み込み中..." /></div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-900">
              {debouncedSearch ? `「${debouncedSearch}」に一致する顧客が見つかりません` : "顧客が登録されていません"}
            </p>
            {!debouncedSearch && (
              <p className="text-sm text-gray-500 mt-1">「顧客を追加」から登録してください</p>
            )}
          </div>
        ) : (
          <>
            {/* デスクトップ */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">顧客名</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">電話番号</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden lg:table-cell">メールアドレス</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden lg:table-cell">住所</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">案件数</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">登録日</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <Link
                          href={`/customers/${c.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                        >
                          {c.name}
                        </Link>
                        {c.memo && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{c.memo}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-gray-600">
                        {c.phone
                          ? <a href={`tel:${c.phone}`} className="hover:text-blue-600">{c.phone}</a>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-gray-600 hidden lg:table-cell">
                        {c.email
                          ? <a href={`mailto:${c.email}`} className="hover:text-blue-600 truncate block max-w-[180px]">{c.email}</a>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-gray-600 hidden lg:table-cell max-w-xs">
                        <span className="truncate block">{c.address ?? <span className="text-gray-300">—</span>}</span>
                      </td>
                      <td className="px-5 py-4">
                        {c._count !== undefined ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            c._count.projects > 0 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                          }`}>
                            {c._count.projects}件
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-gray-400 text-xs">
                        {new Date(c.createdAt).toLocaleDateString("ja-JP")}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 justify-end">
                          <Link href={`/customers/${c.id}`}>
                            <Button variant="ghost" size="sm">詳細</Button>
                          </Link>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>編集</Button>
                          <button
                            onClick={() => setDeleteTarget(c)}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors px-1"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* モバイル */}
            <div className="md:hidden divide-y divide-gray-100">
              {customers.map((c) => (
                <div key={c.id} className="px-4 py-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`/customers/${c.id}`} className="font-semibold text-gray-900 hover:text-blue-600">
                        {c.name}
                      </Link>
                      {c.phone && (
                        <p className="text-sm text-gray-600 mt-0.5">
                          <a href={`tel:${c.phone}`}>{c.phone}</a>
                        </p>
                      )}
                      {c.address && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{c.address}</p>
                      )}
                      {c._count !== undefined && c._count.projects > 0 && (
                        <p className="text-xs text-blue-600 mt-1">案件 {c._count.projects}件</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <Link href={`/customers/${c.id}`}>
                        <Button variant="ghost" size="sm">詳細</Button>
                      </Link>
                      <button
                        onClick={() => openEdit(c)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        編集
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* 追加/編集モーダル */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                {modal === "add" ? "顧客を追加" : "顧客情報を編集"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-4 space-y-4">
              {formError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{formError}</div>
              )}
              <Input
                label="顧客名（施主名）"
                required
                placeholder="例：田中太郎"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                label="電話番号"
                type="tel"
                placeholder="例：090-1234-5678"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <Input
                label="メールアドレス"
                type="email"
                placeholder="例：tanaka@example.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">郵便番号</label>
                <div className="flex gap-2 items-center">
                  <input
                    className="w-36 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="例：1600022"
                    value={form.zipcode}
                    onChange={e => handleZipChange(e.target.value)}
                    maxLength={8}
                  />
                  {zipLoading && <span className="text-xs text-gray-400">検索中...</span>}
                  {!zipLoading && zipFilled && (
                    <span className="text-xs text-blue-500">住所を自動入力しました</span>
                  )}
                </div>
              </div>
              <Input
                label="住所"
                placeholder="例：東京都新宿区..."
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">メモ</label>
                <textarea
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  placeholder="備考・特記事項など"
                  value={form.memo}
                  onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" size="md" onClick={closeModal}>キャンセル</Button>
                <Button type="submit" variant="primary" size="md" loading={saving}>
                  {modal === "add" ? "追加する" : "保存する"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excelインポートモーダル */}
      {importModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setImportModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Excelから一括登録</h2>
              <button onClick={() => setImportModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* 説明 */}
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700 space-y-1">
                <p className="font-medium">対応列名（日本語・英語どちらでもOK）</p>
                <p>顧客名（必須）、電話番号、メールアドレス、住所、メモ</p>
              </div>

              {/* テンプレートDL */}
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                テンプレート（CSV）をダウンロード
              </button>

              {/* ファイル選択 */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${importFile ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); setImportError(null); }}
                />
                {importFile ? (
                  <div>
                    <svg className="h-8 w-8 mx-auto mb-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm font-medium text-blue-700">{importFile.name}</p>
                    <p className="text-xs text-blue-500 mt-0.5">クリックでファイルを変更</p>
                  </div>
                ) : (
                  <div>
                    <svg className="h-8 w-8 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <p className="text-sm font-medium text-gray-700">クリックしてファイルを選択</p>
                    <p className="text-xs text-gray-400 mt-0.5">xlsx / xls / csv に対応</p>
                  </div>
                )}
              </div>

              {/* エラー */}
              {importError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{importError}</div>
              )}

              {/* 結果 */}
              {importResult && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                  <p className="font-medium">インポート完了</p>
                  <p>{importResult.imported} 件登録しました{importResult.skipped > 0 ? `（顧客名なし ${importResult.skipped} 行をスキップ）` : ""}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" size="md" onClick={() => setImportModal(false)}>
                  {importResult ? "閉じる" : "キャンセル"}
                </Button>
                {!importResult && (
                  <Button variant="primary" size="md" loading={importing} onClick={handleImport} disabled={!importFile}>
                    登録する
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900 mb-2">顧客を削除</h2>
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-medium">{deleteTarget.name}</span> を削除しますか？<br />
              この操作は取り消せません。案件が紐づいている場合は削除できません。
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" size="md" onClick={() => setDeleteTarget(null)}>キャンセル</Button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
