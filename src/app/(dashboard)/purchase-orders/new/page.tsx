"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Project { id: string; name: string }
interface OrderItem {
  name: string; description: string;
  quantity: number | string; unit: string;
  unitPrice: number | string; amount: number;
}

function newItem(): OrderItem {
  return { name: "", description: "", quantity: 1, unit: "式", unitPrice: 0, amount: 0 };
}
function calcAmount(qty: number | string, price: number | string) {
  return (Number(qty) || 0) * (Number(price) || 0);
}

export default function PurchaseOrderNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);

  const [projects,    setProjects]    = useState<Project[]>([]);
  const [projectId,   setProjectId]   = useState(searchParams.get("projectId") ?? "");
  const [vendorName,  setVendorName]  = useState("");
  const [title,       setTitle]       = useState("");
  const [issueDate,   setIssueDate]   = useState(today);
  const [deliveryDate,setDeliveryDate]= useState("");
  const [taxRate,     setTaxRate]     = useState(10);
  const [notes,       setNotes]       = useState("");
  const [items,       setItems]       = useState<OrderItem[]>([newItem()]);
  const [submitting,  setSubmitting]  = useState(false);
  const [formError,   setFormError]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(d => setProjects(d.projects ?? []));
  }, []);

  function updateItem(idx: number, field: keyof OrderItem, value: string | number) {
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
    if (!projectId)          { setFormError("案件を選択してください"); return; }
    if (!vendorName.trim()) { setFormError("発注先は必須です"); return; }
    if (!title.trim())      { setFormError("件名は必須です");   return; }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId:    projectId    || null,
          vendorName, title, issueDate,
          deliveryDate: deliveryDate || null,
          taxRate, notes: notes || null,
          items: items.map((item, idx) => ({ ...item, sortOrder: idx })),
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const { order } = await res.json();
      router.push(`/purchase-orders/${order.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/purchase-orders" className="hover:text-violet-600">発注管理</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">新規発注書作成</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">発注書を作成</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {formError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{formError}</div>}

        <Card padding="md" shadow="sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">基本情報</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="発注先（下請業者名）" required placeholder="例：○○工業株式会社" value={vendorName} onChange={e => setVendorName(e.target.value)} />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">案件 <span className="text-red-500">*</span></label>
                <select className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white" value={projectId} onChange={e => setProjectId(e.target.value)} required>
                  <option value="">案件を選択</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <Input label="件名" required placeholder="例：○○邸新築工事　内装工事　発注書" value={title} onChange={e => setTitle(e.target.value)} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Input label="発注日" type="date" required value={issueDate} onChange={e => setIssueDate(e.target.value)} />
              <Input label="納期" type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">消費税率（%）</label>
                <input type="number" min="0" max="30" className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">備考</label>
              <textarea className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" rows={3} placeholder="支払条件・特記事項など" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card padding="md" shadow="sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">明細</h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => setItems(p => [...p, newItem()])}>+ 行を追加</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-xs">
                  <th className="text-left pb-2 font-medium">品目・工事項目</th>
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
                      <input className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" placeholder="品目名" value={item.name} onChange={e => updateItem(idx, "name", e.target.value)} />
                      <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 mt-1 focus:outline-none focus:ring-1 focus:ring-violet-500" placeholder="摘要（任意）" value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} />
                    </td>
                    <td className="py-2 pr-2"><input type="number" min="0" className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-violet-500" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} /></td>
                    <td className="py-2 pr-2"><input className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" value={item.unit} onChange={e => updateItem(idx, "unit", e.target.value)} /></td>
                    <td className="py-2 pr-2"><input type="number" min="0" className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-violet-500" value={item.unitPrice} onChange={e => updateItem(idx, "unitPrice", e.target.value)} /></td>
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
              <span className="font-bold text-violet-700 text-lg w-32 text-right">¥{total.toLocaleString()}</span>
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/purchase-orders"><Button type="button" variant="ghost" size="md">キャンセル</Button></Link>
          <Button type="submit" variant="primary" size="md" loading={submitting}>発注書を作成</Button>
        </div>
      </form>
    </div>
  );
}
