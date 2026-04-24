"use client"

export const dynamic = "force-dynamic";;

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface OrderItem {
  id?: string;
  name: string; description: string;
  quantity: number | string; unit: string;
  unitPrice: number | string; amount: number;
}
interface PurchaseOrder {
  id: string;
  orderNo: string;
  vendorName: string;
  title: string;
  issueDate: string;
  deliveryDate: string | null;
  status: string;
  taxRate: number;
  notes: string | null;
  project: { id: string; name: string; address: string | null } | null;
  items: OrderItem[];
}

const STATUS_OPTIONS = [
  { value: "DRAFT",     label: "下書き" },
  { value: "SENT",      label: "発注済み" },
  { value: "RECEIVED",  label: "納品済み" },
  { value: "CANCELLED", label: "キャンセル" },
];
const STATUS_BADGE: Record<string, "pending" | "active" | "inactive" | "warning"> = {
  DRAFT: "inactive", SENT: "pending", RECEIVED: "active", CANCELLED: "inactive",
};

function calcAmount(qty: number | string, price: number | string) {
  return (Number(qty) || 0) * (Number(price) || 0);
}
function newItem(): OrderItem {
  return { name: "", description: "", quantity: 1, unit: "式", unitPrice: 0, amount: 0 };
}

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order,      setOrder]      = useState<PurchaseOrder | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [formError,  setFormError]  = useState<string | null>(null);

  const [vendorName,   setVendorName]   = useState("");
  const [title,        setTitle]        = useState("");
  const [issueDate,    setIssueDate]    = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [status,       setStatus]       = useState("DRAFT");
  const [taxRate,      setTaxRate]      = useState(10);
  const [notes,        setNotes]        = useState("");
  const [items,        setItems]        = useState<OrderItem[]>([newItem()]);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/purchase-orders/${id}`);
      if (!res.ok) throw new Error();
      const { order } = await res.json();
      setOrder(order);
    } catch { setError("発注書の取得に失敗しました"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  function startEdit() {
    if (!order) return;
    setVendorName(order.vendorName);
    setTitle(order.title);
    setIssueDate(order.issueDate.slice(0, 10));
    setDeliveryDate(order.deliveryDate?.slice(0, 10) ?? "");
    setStatus(order.status);
    setTaxRate(order.taxRate);
    setNotes(order.notes ?? "");
    setItems(order.items.map(i => ({ ...i, description: i.description ?? "" })));
    setFormError(null);
    setEditing(true);
  }

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

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!vendorName.trim()) { setFormError("発注先は必須です"); return; }
    setSaving(true); setFormError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorName, title, issueDate,
          deliveryDate: deliveryDate || null,
          status, taxRate, notes: notes || null,
          items: items.map((item, idx) => ({ ...item, sortOrder: idx })),
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const { order: updated } = await res.json();
      setOrder(updated);
      setEditing(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm("この発注書を削除しますか？")) return;
    await fetch(`/api/purchase-orders/${id}`, { method: "DELETE" });
    router.push("/purchase-orders");
  }

  async function handlePDF() {
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/purchase-orders/${id}/pdf`, { method: "POST" });
      if (!res.ok) { alert("PDF生成に失敗しました"); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `発注書_${order?.orderNo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setPdfLoading(false); }
  }

  if (loading) return <div className="py-16"><LoadingSpinner label="読み込み中..." /></div>;
  if (error || !order) return (
    <div className="space-y-4">
      <Link href="/purchase-orders"><Button variant="ghost" size="sm">← 発注一覧</Button></Link>
      <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error ?? "発注書が見つかりません"}</div>
    </div>
  );

  const subtotal = order.items.reduce((s, i) => s + Number(i.amount), 0);
  const tax      = Math.round(subtotal * order.taxRate / 100);
  const total    = subtotal + tax;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/purchase-orders" className="hover:text-violet-600">発注管理</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{order.orderNo}</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{order.title}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-gray-500 font-mono">{order.orderNo}</span>
            <Badge variant={STATUS_BADGE[order.status] ?? "inactive"}>
              {STATUS_OPTIONS.find(o => o.value === order.status)?.label}
            </Badge>
            <span className="text-sm text-gray-500">発注先：{order.vendorName}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={handlePDF} disabled={pdfLoading}>
            {pdfLoading ? "生成中..." : "📄 PDF出力"}
          </Button>
          <Button variant="ghost" size="sm" onClick={startEdit}>編集</Button>
          <button onClick={handleDelete} className="px-3 py-1.5 rounded-lg text-sm text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors">削除</button>
        </div>
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-5">
          {formError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{formError}</div>}

          <Card padding="md" shadow="sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">基本情報</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="発注先" required value={vendorName} onChange={e => setVendorName(e.target.value)} />
                <Input label="件名" required value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input label="発注日" type="date" required value={issueDate} onChange={e => setIssueDate(e.target.value)} />
                <Input label="納期" type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">ステータス</label>
                  <select className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white" value={status} onChange={e => setStatus(e.target.value)}>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">消費税率（%）</label>
                  <input type="number" min="0" max="30" className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">備考</label>
                <textarea className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
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
                      <td className="py-2"><button type="button" onClick={() => setItems(p => p.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 text-lg">×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 border-t border-gray-200 pt-4 space-y-1.5 text-sm text-right">
              {[["小計", items.reduce((s,i)=>s+i.amount,0)], [`消費税（${taxRate}%）`, Math.round(items.reduce((s,i)=>s+i.amount,0)*taxRate/100)]].map(([label, val]) => (
                <div key={String(label)} className="flex justify-end gap-8">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-900 w-32 text-right">¥{Number(val).toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-end gap-8 border-t border-gray-300 pt-2">
                <span className="font-bold text-gray-900">合計（税込）</span>
                <span className="font-bold text-violet-700 text-lg w-32 text-right">
                  ¥{(items.reduce((s,i)=>s+i.amount,0)+Math.round(items.reduce((s,i)=>s+i.amount,0)*taxRate/100)).toLocaleString()}
                </span>
              </div>
            </div>
          </Card>

          <div className="flex justify-between gap-3">
            <Button type="button" variant="ghost" size="md" onClick={() => setEditing(false)}>キャンセル</Button>
            <Button type="submit" variant="primary" size="md" loading={saving}>保存する</Button>
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          <Card padding="md" shadow="sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">基本情報</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {[
                ["発注日",   new Date(order.issueDate).toLocaleDateString("ja-JP")],
                ["納期",     order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("ja-JP") : "—"],
                ["発注先",   order.vendorName],
                ["案件",     order.project?.name ?? "—"],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-gray-500 mb-0.5">{label}</dt>
                  <dd className="font-medium text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
            {order.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">備考</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}
          </Card>

          <div className="grid grid-cols-3 gap-3">
            {[["小計", subtotal], ["消費税", tax], ["合計（税込）", total]].map(([label, val]) => (
              <Card key={String(label)} padding="md" shadow="sm">
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`font-bold mt-0.5 ${label === "合計（税込）" ? "text-xl text-violet-700" : "text-lg text-gray-900"}`}>
                  ¥{Number(val).toLocaleString()}
                </p>
              </Card>
            ))}
          </div>

          <Card padding="none" shadow="sm">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">明細（{order.items.length}件）</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["品目・工事項目", "数量", "単位", "単価", "金額"].map(h => (
                      <th key={h} className={`px-4 py-3 font-semibold text-gray-600 ${h === "金額" || h === "単価" ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {order.items.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? "bg-gray-50" : ""}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        {item.description && <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-gray-600">{item.unit}</td>
                      <td className="px-4 py-3 text-right text-gray-600">¥{Number(item.unitPrice).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">¥{Number(item.amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
