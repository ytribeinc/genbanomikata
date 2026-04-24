"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface PurchaseOrder {
  id: string;
  orderNo: string;
  vendorName: string;
  title: string;
  issueDate: string;
  deliveryDate: string | null;
  status: string;
  taxRate: number;
  project: { id: string; name: string } | null;
  items: { amount: number }[];
}

const STATUS_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "DRAFT",     label: "下書き" },
  { value: "SENT",      label: "発注済み" },
  { value: "RECEIVED",  label: "納品済み" },
  { value: "CANCELLED", label: "キャンセル" },
];

const STATUS_BADGE: Record<string, "pending" | "active" | "inactive" | "warning"> = {
  DRAFT: "inactive", SENT: "pending", RECEIVED: "active", CANCELLED: "inactive",
};

function totalWithTax(items: { amount: number }[], taxRate: number) {
  const sub = items.reduce((s, i) => s + i.amount, 0);
  return sub + Math.round(sub * taxRate / 100);
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/purchase-orders${params}`);
      if (res.ok) { const d = await res.json(); setOrders(d.orders ?? []); }
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const totalAmount = orders
    .filter(o => o.status !== "CANCELLED")
    .reduce((s, o) => s + totalWithTax(o.items, o.taxRate), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">発注管理</h1>
          <p className="mt-1 text-sm text-gray-500">{loading ? "..." : `${orders.length}件`}</p>
        </div>
        <Link href="/purchase-orders/new">
          <Button variant="primary" size="md">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            発注書を作成
          </Button>
        </Link>
      </div>

      {/* 集計 */}
      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATUS_OPTIONS.slice(1).map((opt) => {
            const filtered = orders.filter(o => o.status === opt.value);
            const amt = filtered.reduce((s, o) => s + totalWithTax(o.items, o.taxRate), 0);
            return (
              <Card key={opt.value} padding="md" shadow="sm">
                <p className="text-xs text-gray-500">{opt.label}</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{filtered.length}件</p>
                <p className="text-xs text-gray-400">¥{amt.toLocaleString()}</p>
              </Card>
            );
          })}
        </div>
      )}

      {/* フィルター */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              statusFilter === opt.value
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16"><LoadingSpinner label="読み込み中..." /></div>
      ) : orders.length === 0 ? (
        <Card padding="lg" shadow="sm">
          <div className="text-center py-10">
            <p className="text-sm font-medium text-gray-900">発注書がありません</p>
            <p className="text-sm text-gray-500 mt-1">「発注書を作成」から新しい発注書を作成できます</p>
          </div>
        </Card>
      ) : (
        <Card padding="none" shadow="sm">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">発注番号</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">件名</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">発注先</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">案件</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">発注日</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">金額（税込）</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">状態</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => router.push(`/purchase-orders/${o.id}`)}>
                    <td className="px-5 py-4 font-mono text-xs text-gray-500">{o.orderNo}</td>
                    <td className="px-5 py-4 font-medium text-gray-900">{o.title}</td>
                    <td className="px-5 py-4 text-gray-600">{o.vendorName}</td>
                    <td className="px-5 py-4 text-gray-500 text-xs">{o.project?.name ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-4 text-gray-500 text-xs">{new Date(o.issueDate).toLocaleDateString("ja-JP")}</td>
                    <td className="px-5 py-4 text-right font-medium text-gray-900">¥{totalWithTax(o.items, o.taxRate).toLocaleString()}</td>
                    <td className="px-5 py-4">
                      <Badge variant={STATUS_BADGE[o.status] ?? "inactive"}>
                        {STATUS_OPTIONS.find(opt => opt.value === o.status)?.label ?? o.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/purchase-orders/${o.id}`} onClick={(ev) => ev.stopPropagation()}>
                        <Button variant="ghost" size="sm">詳細</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="px-5 py-3 font-semibold text-gray-700" colSpan={5}>合計（キャンセル除く）</td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900">¥{totalAmount.toLocaleString()}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="md:hidden divide-y divide-gray-100">
            {orders.map((o) => (
              <Link key={o.id} href={`/purchase-orders/${o.id}`} className="block px-4 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{o.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{o.orderNo} · {o.vendorName}</p>
                    <p className="text-sm font-medium text-violet-700 mt-1">¥{totalWithTax(o.items, o.taxRate).toLocaleString()}</p>
                  </div>
                  <Badge variant={STATUS_BADGE[o.status] ?? "inactive"}>
                    {STATUS_OPTIONS.find(opt => opt.value === o.status)?.label ?? o.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
