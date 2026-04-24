"use client"

export const dynamic = "force-dynamic";;

import { useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type DocType = "schedule" | "estimate" | "contract" | "order" | "other";
type Step = "upload" | "confirm" | "done";

interface ExtractedTask {
  name: string;
  startDate: string | null;
  endDate: string | null;
}

interface Extracted {
  customerName: string | null;
  projectName: string | null;
  address: string | null;
  startDate: string | null;
  endDate: string | null;
  contractAmount: number | null;
  tasks: ExtractedTask[];
}

const DOC_TYPES: { value: DocType; label: string; icon: string; desc: string }[] = [
  { value: "schedule", label: "工程表",     icon: "📅", desc: "工期・工程タスクを抽出" },
  { value: "estimate", label: "見積書",     icon: "📋", desc: "施主名・工事項目・金額を抽出" },
  { value: "contract", label: "請負契約書", icon: "📝", desc: "施主名・工期・契約金額を抽出" },
  { value: "order",    label: "注文書",     icon: "📬", desc: "発注者名・工事名・工期を抽出" },
  { value: "other",    label: "その他",     icon: "📄", desc: "書類から情報を抽出" },
];

export default function ScheduleImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [docType, setDocType] = useState<DocType>("schedule");

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [address, setAddress] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [contractAmount, setContractAmount] = useState("");
  const [tasks, setTasks] = useState<ExtractedTask[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!file) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("docType", docType);
      const res = await fetch("/api/schedules/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setAnalyzeError(data.error ?? "解析に失敗しました"); return; }
      const e: Extracted = data.extracted;
      setCustomerName(e.customerName ?? "");
      setProjectName(e.projectName ?? "");
      setAddress(e.address ?? "");
      setStartDate(e.startDate ?? "");
      setEndDate(e.endDate ?? "");
      setContractAmount(e.contractAmount != null ? String(e.contractAmount) : "");
      setTasks(e.tasks ?? []);
      setStep("confirm");
    } catch {
      setAnalyzeError("解析中にエラーが発生しました");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!projectName.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      let customerId: string | null = null;
      if (customerName.trim()) {
        const r = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: customerName.trim() }),
        });
        if (r.ok) { const { customer } = await r.json(); customerId = customer.id; }
      }

      const projRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName.trim(),
          address: address.trim() || null,
          customerId,
          startDate: startDate || null,
          endDate: endDate || null,
          status: "PLANNING",
        }),
      });
      if (!projRes.ok) {
        const d = await projRes.json();
        setSaveError(d.error ?? "案件の作成に失敗しました");
        return;
      }
      const { project } = await projRes.json();

      for (const task of tasks.filter((t) => t.name.trim())) {
        await fetch(`/api/schedules/${project.id}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: task.name.trim(), startDate: task.startDate || null, endDate: task.endDate || null }),
        }).catch(() => {});
      }

      setStep("done");
      setTimeout(() => router.push(`/projects/${project.id}`), 1500);
    } catch {
      setSaveError("保存中にエラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  function updateTask(idx: number, field: keyof ExtractedTask, value: string) {
    setTasks((prev) => prev.map((t, i) => i === idx ? { ...t, [field]: value || null } : t));
  }

  const showAmount = docType === "estimate" || docType === "contract";
  const taskLabel = docType === "estimate" ? "見積工事項目" : "工程タスク";

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/projects" className="hover:text-blue-600 transition-colors">案件一覧</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">書類インポート</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">書類から案件を登録</h1>
        <p className="mt-1 text-sm text-gray-500">
          工程表・見積書・契約書・注文書をアップロードすると、AIが情報を自動抽出します
        </p>
      </div>

      {/* ステップ */}
      <div className="flex items-center gap-2">
        {(["upload", "confirm", "done"] as Step[]).map((s, i) => {
          const labels = ["アップロード", "内容確認", "完了"];
          const active = s === step;
          const done = (step === "confirm" && i === 0) || step === "done";
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                done ? "bg-green-500 text-white" : active ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"
              }`}>
                {done ? "✓" : i + 1}
              </div>
              <span className={`text-sm ${active ? "font-medium text-gray-900" : "text-gray-400"}`}>{labels[i]}</span>
              {i < 2 && <span className="text-gray-300 mx-1">→</span>}
            </div>
          );
        })}
      </div>

      {/* Step 1: アップロード */}
      {step === "upload" && (
        <div className="space-y-5">
          {/* 書類種別 */}
          <Card padding="md" shadow="sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">書類の種類を選択</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DOC_TYPES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDocType(d.value)}
                  className={`flex flex-col items-start gap-1 p-3 rounded-lg border-2 text-left transition-colors ${
                    docType === d.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-xl">{d.icon}</span>
                  <span className={`text-sm font-medium ${docType === d.value ? "text-blue-700" : "text-gray-900"}`}>
                    {d.label}
                  </span>
                  <span className="text-xs text-gray-400 leading-tight">{d.desc}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* ファイルアップロード */}
          <Card padding="md" shadow="sm">
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                dragging ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files[0];
                if (f) { setFile(f); setAnalyzeError(null); }
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex justify-center gap-3 mb-3 text-4xl">
                <span>📊</span><span>📄</span><span>🖼️</span>
              </div>
              <p className="text-base font-medium text-gray-700">
                ここにファイルをドロップ、またはクリックして選択
              </p>
              <p className="text-sm text-gray-400 mt-1">Excel (.xlsx/.xls) ・ PDF ・ 画像 (JPG/PNG)</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.pdf,.jpg,.jpeg,.png,.heic"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setFile(f); setAnalyzeError(null); }
                e.target.value = "";
              }}
            />

            {file && (
              <div className="mt-4 flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {file.name.match(/\.pdf$/i) ? "📄" : file.name.match(/\.xlsx?$/i) ? "📊" : "🖼️"}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
                <button onClick={() => setFile(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
              </div>
            )}

            {analyzeError && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {analyzeError}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button variant="primary" size="md" onClick={handleAnalyze} disabled={!file || analyzing} loading={analyzing}>
                {analyzing ? "AIが解析中..." : "AIで解析する"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Step 2: 確認・編集 */}
      {step === "confirm" && (
        <form onSubmit={handleSave} className="space-y-5">
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            AIが書類から情報を抽出しました。内容を確認・修正してから保存してください。
          </div>

          {saveError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{saveError}</div>
          )}

          <Card padding="md" shadow="sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">顧客・案件情報</h2>
            <div className="space-y-4">
              <Input
                label="施主名・発注者名"
                placeholder="例：田中太郎"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <Input
                label="案件名・工事名"
                required
                placeholder="例：〇〇邸新築工事"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
              <Input
                label="現場住所"
                placeholder="例：東京都新宿区..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input label="工期開始" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <Input label="工期終了" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              {showAmount && (
                <Input
                  label="契約金額（税抜）"
                  type="number"
                  placeholder="例：15000000"
                  value={contractAmount}
                  onChange={(e) => setContractAmount(e.target.value)}
                />
              )}
            </div>
          </Card>

          <Card padding="md" shadow="sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">
                {taskLabel}（{tasks.length}件）
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setTasks((p) => [...p, { name: "", startDate: null, endDate: null }])}
              >
                + 追加
              </Button>
            </div>

            {tasks.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">項目がありません</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="工程名・工事項目名"
                        value={task.name}
                        onChange={(e) => updateTask(idx, "name", e.target.value)}
                      />
                      <input
                        type="date"
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={task.startDate ?? ""}
                        onChange={(e) => updateTask(idx, "startDate", e.target.value)}
                      />
                      <input
                        type="date"
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={task.endDate ?? ""}
                        onChange={(e) => updateTask(idx, "endDate", e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setTasks((p) => p.filter((_, i) => i !== idx))}
                      className="text-gray-400 hover:text-red-500 transition-colors text-lg flex-shrink-0"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="flex justify-between gap-3">
            <Button type="button" variant="ghost" size="md" onClick={() => setStep("upload")}>← 戻る</Button>
            <Button type="submit" variant="primary" size="md" loading={saving}>登録する</Button>
          </div>
        </form>
      )}

      {/* Step 3: 完了 */}
      {step === "done" && (
        <Card padding="lg" shadow="sm">
          <div className="text-center py-6">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">登録完了</h2>
            <p className="text-sm text-gray-500">案件ページへ移動します...</p>
          </div>
        </Card>
      )}
    </div>
  );
}
