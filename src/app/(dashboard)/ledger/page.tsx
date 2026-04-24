"use client"

export const dynamic = "force-dynamic";;

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface LedgerRow {
  id: string;
  name: string;
  address: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  customer: { id: string; name: string } | null;
  contractAmount: number;
  paidAmount: number;
  purchaseAmount: number;
  budgetAmount: number | null;
  grossProfit: number;
  grossMargin: number | null;
}

const PROJECT_STATUS: Record<string, string> = {
  PLANNING: "計画中", IN_PROGRESS: "進行中", COMPLETED: "完了", PAUSED: "中断",
};
const PROJECT_STATUS_BADGE: Record<string, "pending" | "active" | "inactive" | "warning"> = {
  PLANNING: "inactive", IN_PROGRESS: "active", COMPLETED: "pending", PAUSED: "inactive",
};

function fmtY(v: number | null) {
  if (v === null) return "—";
  return "¥" + v.toLocaleString();
}

export default function LedgerPage() {
  const [rows, setRows]     = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");

  useEffect(() => {
    fetch("/api/ledger")
      .then(r => r.json())
      .then(d => setRows(d.ledger ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter(r =>
    r.name.includes(search) ||
    (r.customer?.name ?? "").includes(search) ||
    (r.address ?? "").includes(search)
  );

  // 合計行
  const totals = filtered.reduce(
    (acc, r) => ({
      contract:  acc.contract  + r.contractAmount,
      paid:      acc.paid      + r.paidAmount,
      purchase:  acc.purchase  + r.purchaseAmount,
      profit:    acc.profit    + r.grossProfit,
    }),
    { contract: 0, paid: 0, purchase: 0, profit: 0 }
  );
  const totalMargin = totals.contract > 0
    ? Math.round((totals.profit / totals.contract) * 1000) / 10
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">工事台帳</h1>
        <p className="mt-1 text-sm text-gray-500">案件ごとの受注額・発注額・粗利を一覧表示します</p>
      </div>

      {/* サマリーカード */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card padding="md" shadow="sm">
            <p className="text-xs text-gray-500">受注総額</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">¥{totals.contract.toLocaleString()}</p>
          </Card>
          <Card padding="md" shadow="sm">
            <p className="text-xs text-gray-500">入金済み</p>
            <p className="text-lg font-bold text-emerald-600 mt-0.5">¥{totals.paid.toLocaleString()}</p>
          </Card>
          <Card padding="md" shadow="sm">
            <p className="text-xs text-gray-500">発注総額</p>
            <p className="text-lg font-bold text-orange-600 mt-0.5">¥{totals.purchase.toLocaleString()}</p>
          </Card>
          <Card padding="md" shadow="sm">
            <p className="text-xs text-gray-500">粗利合計</p>
            <p className={`text-lg font-bold mt-0.5 ${totals.profit >= 0 ? "text-blue-700" : "text-red-600"}`}>
              ¥{totals.profit.toLocaleString()}
              {totalMargin !== null && (
                <span className="text-sm font-normal ml-1 text-gray-500">（{totalMargin}%）</span>
              )}
            </p>
          </Card>
        </div>
      )}

      {/* 検索 */}
      <div>
        <input
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="案件名・顧客名で検索"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-16"><LoadingSpinner label="読み込み中..." /></div>
      ) : filtered.length === 0 ? (
        <Card padding="lg" shadow="sm">
          <div className="text-center py-10">
            <p className="text-sm font-medium text-gray-900">案件がありません</p>
            <p className="text-sm text-gray-500 mt-1">
              <Link href="/projects/new" className="text-blue-600 hover:underline">案件を登録</Link>
              してから請求・発注を入力すると台帳に反映されます
            </p>
          </div>
        </Card>
      ) : (
        <Card padding="none" shadow="sm">
          {/* デスクトップ */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">案件名</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">顧客</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">状態</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">受注額</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">発注額</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">実行予算</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">粗利</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">粗利率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/projects/${r.id}`} className="font-medium text-blue-600 hover:underline">
                        {r.name}
                      </Link>
                      {r.address && <p className="text-xs text-gray-400 mt-0.5">{r.address}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{r.customer?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={PROJECT_STATUS_BADGE[r.status] ?? "inactive"}>
                        {PROJECT_STATUS[r.status] ?? r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">{fmtY(r.contractAmount)}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{fmtY(r.purchaseAmount)}</td>
                    <td className="px-4 py-3 text-right text-blue-600">
                      {r.budgetAmount !== null ? fmtY(r.budgetAmount) : <span className="text-gray-300">未設定</span>}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${r.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {fmtY(r.grossProfit)}
                    </td>
                    <td className={`px-4 py-3 text-right text-xs font-medium ${(r.grossMargin ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {r.grossMargin !== null ? `${r.grossMargin}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  <td className="px-4 py-3 text-gray-700" colSpan={3}>合計</td>
                  <td className="px-4 py-3 text-right text-gray-900">¥{totals.contract.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-orange-600">¥{totals.purchase.toLocaleString()}</td>
                  <td className="px-4 py-3" />
                  <td className={`px-4 py-3 text-right ${totals.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    ¥{totals.profit.toLocaleString()}
                  </td>
                  <td className={`px-4 py-3 text-right text-xs ${(totalMargin ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {totalMargin !== null ? `${totalMargin}%` : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* モバイル */}
          <div className="lg:hidden divide-y divide-gray-100">
            {filtered.map((r) => (
              <Link key={r.id} href={`/projects/${r.id}`} className="block px-4 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-gray-900">{r.name}</p>
                  <Badge variant={PROJECT_STATUS_BADGE[r.status] ?? "inactive"}>
                    {PROJECT_STATUS[r.status] ?? r.status}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mb-2">{r.customer?.name ?? ""}</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-gray-400">受注</p>
                    <p className="font-medium text-gray-900">{fmtY(r.contractAmount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">発注</p>
                    <p className="font-medium text-orange-600">{fmtY(r.purchaseAmount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">粗利</p>
                    <p className={`font-medium ${r.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {fmtY(r.grossProfit)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
