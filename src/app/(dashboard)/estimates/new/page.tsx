"use client"

export const dynamic = "force-dynamic";;

import { useState, useEffect, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Customer { id: string; name: string }
interface Project  { id: string; name: string; customerId: string | null }
interface EstimateItem {
  name: string; description: string;
  quantity: number | string; unit: string;
  unitPrice: number | string; amount: number;
}
interface Suggestion { name: string; unit: string; unitPrice: number; quantity: number; description: string }

function newItem(): EstimateItem {
  return { name: "", description: "", quantity: 1, unit: "式", unitPrice: 0, amount: 0 };
}

function calcAmount(qty: number | string, price: number | string) {
  return (Number(qty) || 0) * (Number(price) || 0);
}

function EstimateNewPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [customerId, setCustomerId] = useState(searchParams.get("customerId") ?? "");
  const [projectId,  setProjectId]  = useState(searchParams.get("projectId")  ?? "");
  const [title,      setTitle]      = useState("");
  const [issueDate,  setIssueDate]  = useState(today);
  const [expiryDate, setExpiryDate] = useState("");
  const [taxRate,    setTaxRate]    = useState(10);
  const [notes,      setNotes]      = useState("");
  const [items,      setItems]      = useState<EstimateItem[]>([newItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState<string | null>(null);

  // 過去データサジェスト
  const [suggestions,     setSuggestions]     = useState<Suggestion[]>([]);
  const [suggestLoading,  setSuggestLoading]  = useState(false);
  const [suggestApplied,  setSuggestApplied]  = useState(false);

  useEffect(() => {
    fetch("/api/customers").then(r => r.json()).then(d => setCustomers(d.customers ?? []));
    fetch("/api/projects").then(r => r.json()).then(d => setProjects(d.projects ?? []));
  }, []);

  // 案件・顧客が変わったらサジェストを取得
  useEffect(() => {
    if (!projectId && !customerId) { setSuggestions([]); return; }
    setSuggestLoading(true);
    setSuggestApplied(false);
    const params = new URLSearchParams();
    if (projectId)  params.set("projectId",  projectId);
    if (customerId) params.set("customerId", customerId);
    fetch(`/api/estimates/item-suggestions?${params}`)
      .then(r => r.json())
      .then(d => setSuggestions(d.suggestions ?? []))
      .finally(() => setSuggestLoading(false));
  }, [projectId, customerId]);

  // 案件選択時に顧客を自動セット
  function handleProjectChange(pid: string) {
    setProjectId(pid);
    if (pid) {
      const proj = projects.find(p => p.id === pid);
      if (proj?.customerId) setCustomerId(proj.customerId);
    }
  }

  function applysuggestions() {
    if (suggestions.length === 0) return;
    setItems(suggestions.map(s => ({
      name: s.name,
      description: s.description ?? "",
      quantity: s.quantity,
      unit: s.unit,
      unitPrice: s.unitPrice,
      amount: calcAmount(s.quantity, s.unitPrice),
    })));
    setSuggestApplied(true);
  }

  function updateItem(idx: number, field: keyof EstimateItem, value: string | number) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      updated.amount = calcAmount(
        field === "quantity" ? value : updated.quantity,
        field === "unitPrice" ? value : updated.unitPrice,
      );
      return updated;
    }));
  }

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const tax   = Math.round(subtotal * taxRate / 100);
  const total = subtotal + tax;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!projectId)     { setFormError("案件を選択してください"); return; }
    if (!title.trim()) { setFormError("件名は必須です"); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || null,
          projectId:  projectId  || null,
          title, issueDate,
          expiryDate: expiryDate || null,
          taxRate, notes: notes || null,
          items: items.map((item, idx) => ({ ...item, sortOrder: idx })),
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const { estimate } = await res.json();
      router.push(`/estimates/${estimate.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/estimates" className="hover:text-blue-600">見積管理</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">新規見積作成</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">見積を作成</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {formError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{formError}</div>}

        <Card padding="md" shadow="sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">基本情報</h2>
          <div className="space-y-4">
            <Input label="件名" required placeholder="例：〇〇邸新築工事　御見積" value={title} onChange={e => setTitle(e.target.value)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">案件 <span className="text-red-500">*</span></label>
                <select className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={projectId} onChange={e => handleProjectChange(e.target.value)} required>
                  <option value="">案件を選択</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">顧客（施主）</label>
                <select className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                  <option value="">顧客を選択（任意）</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Input label="発行日" type="date" required value={issueDate} onChange={e => setIssueDate(e.target.value)} />
              <Input label="有効期限" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">消費税率（%）</label>
                <input type="number" min="0" max="30" className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">備考</label>
              <textarea className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={3} placeholder="支払条件・特記事項など" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card padding="md" shadow="sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">明細</h2>
            <div className="flex items-center gap-2">
              {/* 過去データ自動入力ボタン */}
              {suggestions.length > 0 && !suggestApplied && (
                <button
                  type="button"
                  onClick={applysuggestions}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700 font-medium hover:bg-amber-100 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  過去データから自動入力（{suggestions.length}件）
                </button>
              )}
              {suggestApplied && (
                <span className="text-xs text-emerald-600 flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  自動入力済み（内容は変更できます）
                </span>
              )}
              {suggestLoading && <span className="text-xs text-gray-400">過去データを確認中...</span>}
              <Button type="button" variant="ghost" size="sm" onClick={() => setItems(p => [...p, newItem()])}>+ 行を追加</Button>
            </div>
          </div>

          {suggestApplied && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700">
              過去の見積から{suggestions.length}件の工種を自動入力しました。単価・数量は自由に変更できます。
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-xs">
                  <th className="text-left pb-2 font-medium">工事項目</th>
                  <th className="text-left pb-2 font-medium w-16">数量</th>
                  <th className="text-left pb-2 font-medium w-14">単位</th>
                  <th className="text-left pb-2 font-medium w-28">単価</th>
                  <th className="text-right pb-2 font-medium w-28">金額</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 pr-2">
                      <input className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="工事項目名" value={item.name} onChange={e => updateItem(idx, "name", e.target.value)} />
                      <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 mt-1 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="摘要（任意）" value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} />
                    </td>
                    <td className="py-2 pr-2"><input type="number" min="0" className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} /></td>
                    <td className="py-2 pr-2"><input className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" value={item.unit} onChange={e => updateItem(idx, "unit", e.target.value)} /></td>
                    <td className="py-2 pr-2"><input type="number" min="0" className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500" value={item.unitPrice} onChange={e => updateItem(idx, "unitPrice", e.target.value)} /></td>
                    <td className="py-2 text-right font-medium text-gray-900 pr-2">¥{item.amount.toLocaleString()}</td>
                    <td className="py-2">
                      {items.length > 1 && <button type="button" onClick={() => setItems(p => p.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 text-lg">×</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 border-t border-gray-200 pt-4 space-y-1.5 text-sm text-right">
            {[["小計", subtotal], [`消費税（${taxRate}%）`, tax]].map(([label, val]) => (
              <div key={String(label)} className="flex justify-end gap-8">
                <span className="text-gray-500">{label}</span>
                <span className="text-gray-900 w-32 text-right">¥{Number(val).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-end gap-8 border-t border-gray-300 pt-2">
              <span className="font-bold text-gray-900">合計（税込）</span>
              <span className="font-bold text-blue-700 text-lg w-32 text-right">¥{total.toLocaleString()}</span>
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/estimates"><Button type="button" variant="ghost" size="md">キャンセル</Button></Link>
          <Button type="submit" variant="primary" size="md" loading={submitting}>見積を作成</Button>
        </div>
      </form>
    </div>
  );
}

export default function EstimateNewPage() {
  return (
    <Suspense fallback={<div />}>
      <EstimateNewPageInner />
    </Suspense>
  );
}
