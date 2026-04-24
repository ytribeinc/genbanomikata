"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface Project { id: string; name: string; status: string }
interface BudgetItem { id?: string; category: string; budgetAmount: number | string; memo: string }
interface Budget { id: string; projectId: string; items: BudgetItem[] }

const DEFAULT_CATEGORIES = ["材工費", "労務費", "外注費", "機械費", "仮設費", "諸経費"];

function newBudgetItem(): BudgetItem {
  return { category: "", budgetAmount: 0, memo: "" };
}

export default function BudgetPage() {
  const [projects, setProjects]         = useState<Project[]>([]);
  const [selectedId, setSelectedId]     = useState("");
  const [budget, setBudget]             = useState<Budget | null>(null);
  const [purchaseTotal, setPurchaseTotal] = useState(0);
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [items, setItems]               = useState<BudgetItem[]>([newBudgetItem()]);
  const [saved, setSaved]               = useState(false);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(d => {
      const list = d.projects ?? [];
      setProjects(list);
      if (list.length > 0) setSelectedId(list[0].id);
    });
  }, []);

  const fetchBudget = useCallback(async (pid: string) => {
    if (!pid) return;
    setLoadingBudget(true);
    try {
      const [budgetRes, ordersRes] = await Promise.all([
        fetch(`/api/budgets/${pid}`),
        fetch(`/api/purchase-orders?projectId=${pid}`),
      ]);
      if (budgetRes.ok) {
        const { budget: b } = await budgetRes.json();
        setBudget(b);
        if (b?.items?.length > 0) {
          setItems(b.items.map((i: any) => ({ ...i, memo: i.memo ?? "" })));
        } else {
          setItems(DEFAULT_CATEGORIES.map(cat => ({ category: cat, budgetAmount: 0, memo: "" })));
        }
      }
      if (ordersRes.ok) {
        const { orders } = await ordersRes.json();
        const total = orders
          .filter((o: any) => o.status !== "CANCELLED")
          .reduce((s: number, o: any) => {
            const sub = o.items.reduce((ss: number, i: any) => ss + i.amount, 0);
            return s + sub + Math.round(sub * o.taxRate / 100);
          }, 0);
        setPurchaseTotal(total);
      }
    } finally { setLoadingBudget(false); }
  }, []);

  useEffect(() => {
    if (selectedId) fetchBudget(selectedId);
  }, [selectedId, fetchBudget]);

  function updateItem(idx: number, field: keyof BudgetItem, value: string | number) {
    setItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, [field]: value }));
  }

  const budgetTotal = items.reduce((s, i) => s + (Number(i.budgetAmount) || 0), 0);
  const diff = budgetTotal - purchaseTotal;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false);
    try {
      const res = await fetch(`/api/budgets/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.filter(i => i.category.trim()).map((item, idx) => ({ ...item, sortOrder: idx })),
        }),
      });
      if (!res.ok) throw new Error();
      const { budget: b } = await res.json();
      setBudget(b);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  const selectedProject = projects.find(p => p.id === selectedId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">予算管理</h1>
        <p className="mt-1 text-sm text-gray-500">案件ごとの実行予算を設定し、発注実績と比較します</p>
      </div>

      {/* 案件選択 */}
      <Card padding="md" shadow="sm">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">案件を選択</label>
          <select
            className="flex-1 min-w-[200px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
          >
            <option value="">案件を選択してください</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </Card>

      {!selectedId ? null : loadingBudget ? (
        <div className="py-16"><LoadingSpinner label="読み込み中..." /></div>
      ) : (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-3 gap-3">
            <Card padding="md" shadow="sm">
              <p className="text-xs text-gray-500">実行予算合計</p>
              <p className="text-lg font-bold text-blue-700 mt-0.5">¥{budgetTotal.toLocaleString()}</p>
            </Card>
            <Card padding="md" shadow="sm">
              <p className="text-xs text-gray-500">発注実績（税込）</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">¥{purchaseTotal.toLocaleString()}</p>
            </Card>
            <Card padding="md" shadow="sm">
              <p className="text-xs text-gray-500">予算残</p>
              <p className={`text-lg font-bold mt-0.5 ${diff >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {diff >= 0 ? "+" : ""}¥{diff.toLocaleString()}
              </p>
            </Card>
          </div>

          {/* 予算入力フォーム */}
          <form onSubmit={handleSave}>
            <Card padding="md" shadow="sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">
                  {selectedProject?.name} の実行予算
                </h2>
                <Button type="button" variant="ghost" size="sm" onClick={() => setItems(p => [...p, newBudgetItem()])}>
                  + 行を追加
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 text-xs">
                      <th className="text-left pb-2 font-medium">費目</th>
                      <th className="text-left pb-2 font-medium w-40">予算額（円）</th>
                      <th className="text-left pb-2 font-medium">メモ</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 pr-3">
                          <input
                            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="費目名（例：労務費）"
                            value={item.category}
                            onChange={e => updateItem(idx, "category", e.target.value)}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number" min="0"
                            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={item.budgetAmount}
                            onChange={e => updateItem(idx, "budgetAmount", e.target.value)}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="メモ（任意）"
                            value={item.memo}
                            onChange={e => updateItem(idx, "memo", e.target.value)}
                          />
                        </td>
                        <td className="py-2">
                          {items.length > 1 && (
                            <button type="button" onClick={() => setItems(p => p.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 text-lg">×</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td className="px-2 py-3 font-semibold text-gray-700">合計</td>
                      <td className="px-2 py-3 text-right font-bold text-blue-700">¥{budgetTotal.toLocaleString()}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                {saved && <p className="text-sm text-emerald-600">保存しました</p>}
                {!saved && <span />}
                <Button type="submit" variant="primary" size="md" loading={saving}>予算を保存</Button>
              </div>
            </Card>
          </form>

          {/* 発注実績との比較テーブル */}
          {purchaseTotal > 0 && (
            <Card padding="md" shadow="sm">
              <h2 className="text-base font-semibold text-gray-900 mb-3">予算 vs 発注実績</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-500">
                      <th className="text-left pb-2 font-medium">費目</th>
                      <th className="text-right pb-2 font-medium">予算額</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.filter(i => i.category.trim()).map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 text-gray-700">{item.category}</td>
                        <td className="py-2 text-right text-gray-900">¥{Number(item.budgetAmount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 text-sm font-semibold">
                      <td className="py-2 px-1 text-gray-700">発注合計（実績）</td>
                      <td className="py-2 px-1 text-right text-gray-900">¥{purchaseTotal.toLocaleString()}</td>
                    </tr>
                    <tr className={`text-sm font-bold ${diff >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      <td className="py-2 px-1">予算残</td>
                      <td className="py-2 px-1 text-right">{diff >= 0 ? "+" : ""}¥{diff.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
