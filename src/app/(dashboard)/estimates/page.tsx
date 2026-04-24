"use client"

export const dynamic = "force-dynamic";;

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface Estimate {
  id: string;
  estimateNo: string;
  title: string;
  issueDate: string;
  expiryDate: string | null;
  status: string;
  taxRate: number;
  customer: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  items: { amount: number }[];
}

const STATUS_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "DRAFT", label: "下書き" },
  { value: "SENT", label: "送付済み" },
  { value: "APPROVED", label: "承認済み" },
  { value: "REJECTED", label: "却下" },
];

const STATUS_BADGE: Record<string, "pending" | "active" | "inactive"> = {
  DRAFT: "inactive", SENT: "pending", APPROVED: "active", REJECTED: "inactive",
};

function totalWithTax(items: { amount: number }[], taxRate: number) {
  const sub = items.reduce((s, i) => s + i.amount, 0);
  return sub + Math.round(sub * taxRate / 100);
}

export default function EstimatesPage() {
  const router = useRouter();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchEstimates = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/estimates${params}`);
      if (res.ok) { const d = await res.json(); setEstimates(d.estimates ?? []); }
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchEstimates(); }, [fetchEstimates]);

  const totalAmount = estimates.reduce((s, e) => s + totalWithTax(e.items, e.taxRate), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">見積管理</h1>
          <p className="mt-1 text-sm text-gray-500">{loading ? "..." : `${estimates.length}件`}</p>
        </div>
        <Link href="/estimates/new">
          <Button variant="primary" size="md">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            見積を作成
          </Button>
        </Link>
      </div>

      {/* 集計 */}
      {!loading && estimates.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATUS_OPTIONS.slice(1).map((opt) => {
            const filtered = estimates.filter(e => e.status === opt.value);
            const amt = filtered.reduce((s, e) => s + totalWithTax(e.items, e.taxRate), 0);
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
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16"><LoadingSpinner label="読み込み中..." /></div>
      ) : estimates.length === 0 ? (
        <Card padding="lg" shadow="sm">
          <div className="text-center py-10">
            <p className="text-sm font-medium text-gray-900">見積がありません</p>
            <p className="text-sm text-gray-500 mt-1">「見積を作成」から新しい見積を作成できます</p>
          </div>
        </Card>
      ) : (
        <Card padding="none" shadow="sm">
          {/* デスクトップ */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">見積番号</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">件名</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">顧客</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">発行日</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">金額（税込）</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">状態</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {estimates.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => router.push(`/estimates/${e.id}`)}>
                    <td className="px-5 py-4 font-mono text-xs text-gray-500">{e.estimateNo}</td>
                    <td className="px-5 py-4 font-medium text-gray-900">{e.title}</td>
                    <td className="px-5 py-4 text-gray-600">{e.customer?.name ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-4 text-gray-500 text-xs">{new Date(e.issueDate).toLocaleDateString("ja-JP")}</td>
                    <td className="px-5 py-4 text-right font-medium text-gray-900">
                      ¥{totalWithTax(e.items, e.taxRate).toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={STATUS_BADGE[e.status] ?? "inactive"}>
                        {STATUS_OPTIONS.find(o => o.value === e.status)?.label ?? e.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(ev) => ev.stopPropagation()}>
                        {e.status === "APPROVED" && (
                          <Link href={`/invoices/new?estimateId=${e.id}`}>
                            <Button variant="primary" size="sm">請求書を作成</Button>
                          </Link>
                        )}
                        <Link href={`/estimates/${e.id}`}>
                          <Button variant="ghost" size="sm">詳細</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="px-5 py-3 font-semibold text-gray-700" colSpan={4}>合計</td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900">¥{totalAmount.toLocaleString()}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
          {/* モバイル */}
          <div className="md:hidden divide-y divide-gray-100">
            {estimates.map((e) => (
              <div key={e.id} className="px-4 py-4 hover:bg-gray-50">
                <Link href={`/estimates/${e.id}`} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{e.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{e.estimateNo} · {e.customer?.name ?? "顧客未設定"}</p>
                      <p className="text-sm font-medium text-blue-700 mt-1">¥{totalWithTax(e.items, e.taxRate).toLocaleString()}</p>
                    </div>
                    <Badge variant={STATUS_BADGE[e.status] ?? "inactive"}>
                      {STATUS_OPTIONS.find(o => o.value === e.status)?.label ?? e.status}
                    </Badge>
                  </div>
                </Link>
                {e.status === "APPROVED" && (
                  <div className="mt-2">
                    <Link href={`/invoices/new?estimateId=${e.id}`}>
                      <Button variant="primary" size="sm">請求書を作成</Button>
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
