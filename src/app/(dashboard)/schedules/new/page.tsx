"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

// ─── 型定義 ──────────────────────────────────────────────────────────────────
interface TaskRow {
  id: string;
  name: string;
  durationDays: number | string;
  memo: string;
  // 計算後
  startDate?: string;
  endDate?: string;
}

interface Milestone {
  id: string;
  label: string;
  date: string;
}

// ─── ユーティリティ ───────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2); }
function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function calcEndDate(start: Date, workingDays: number, excludeWeekends: boolean): Date {
  if (!excludeWeekends) return addDays(start, workingDays - 1);
  let count = 1;
  let cur = new Date(start);
  // 開始日が週末なら次の平日へ
  while (cur.getDay() === 0 || cur.getDay() === 6) cur = addDays(cur, 1);
  const actualStart = new Date(cur);
  while (count < workingDays) {
    cur = addDays(cur, 1);
    if (cur.getDay() !== 0 && cur.getDay() !== 6) count++;
  }
  return cur;
}

function nextWorkday(d: Date): Date {
  let r = addDays(d, 1);
  while (r.getDay() === 0 || r.getDay() === 6) r = addDays(r, 1);
  return r;
}

function calcSchedule(tasks: TaskRow[], startDate: string, excludeWeekends: boolean): TaskRow[] {
  if (!startDate) return tasks;
  let cur = new Date(startDate + "T00:00:00");
  if (excludeWeekends) {
    while (cur.getDay() === 0 || cur.getDay() === 6) cur = addDays(cur, 1);
  }
  return tasks.map(task => {
    const days = Number(task.durationDays) || 1;
    const start = new Date(cur);
    const end = calcEndDate(start, days, excludeWeekends);
    const next = excludeWeekends ? nextWorkday(end) : addDays(end, 1);
    cur = next;
    return { ...task, startDate: toDateStr(start), endDate: toDateStr(end) };
  });
}

// ─── 予測変換コンポーネント ───────────────────────────────────────────────────
function SuggestInput({
  value, onChange, suggestions, placeholder, className,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = value.trim()
    ? suggestions.filter(s => s.includes(value) && s !== value).slice(0, 8)
    : [];

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        className={className}
        value={value}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-white border border-gray-200 rounded-md shadow-lg text-sm max-h-48 overflow-y-auto">
          {filtered.map(s => (
            <li
              key={s}
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-gray-800"
              onMouseDown={() => { onChange(s); setOpen(false); }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── ガントミニプレビュー ─────────────────────────────────────────────────────
function MiniGantt({ tasks }: { tasks: TaskRow[] }) {
  const dated = tasks.filter(t => t.startDate && t.endDate);
  if (dated.length === 0) return null;

  const starts = dated.map(t => new Date(t.startDate!));
  const ends   = dated.map(t => new Date(t.endDate!));
  const min = new Date(Math.min(...starts.map(d => d.getTime())));
  const max = new Date(Math.max(...ends.map(d => d.getTime())));
  const total = Math.max(1, (max.getTime() - min.getTime()) / 86400000 + 1);

  const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899"];

  return (
    <div className="space-y-1">
      {dated.map((task, idx) => {
        const s = new Date(task.startDate!);
        const e = new Date(task.endDate!);
        const left  = ((s.getTime() - min.getTime()) / 86400000 / total) * 100;
        const width = Math.max(1, ((e.getTime() - s.getTime()) / 86400000 + 1) / total * 100);
        return (
          <div key={task.id} className="flex items-center gap-2 text-xs">
            <span className="w-28 truncate text-gray-600 flex-shrink-0">{task.name || "—"}</span>
            <div className="flex-1 h-4 bg-gray-100 rounded relative overflow-hidden">
              <div
                className="absolute top-0 h-full rounded"
                style={{ left: `${left}%`, width: `${width}%`, backgroundColor: COLORS[idx % COLORS.length] }}
              />
            </div>
            <span className="text-gray-400 w-24 flex-shrink-0 text-right">
              {task.startDate?.slice(5)} 〜 {task.endDate?.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────────────────────────
export default function ScheduleNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);

  // Step1: 基本設定
  const [title,           setTitle]           = useState("");
  const [startDate,       setStartDate]       = useState("");
  const [completionDate,  setCompletionDate]  = useState("");
  const [excludeWeekends, setExcludeWeekends] = useState(true);
  const [constraints,     setConstraints]     = useState("");
  const [milestones,      setMilestones]      = useState<Milestone[]>([]);

  // Step2: 作業リスト
  const [tasks,       setTasks]       = useState<TaskRow[]>([{ id: uid(), name: "", durationDays: 1, memo: "" }]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Step3: 案件紐づけ & 保存
  const [projects,   setProjects]   = useState<{ id: string; name: string }[]>([]);
  const [projectId,  setProjectId]  = useState(searchParams.get("projectId") ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/schedules/suggestions").then(r => r.json()).then(d => setSuggestions(d.suggestions ?? []));
    fetch("/api/projects").then(r => r.json()).then(d => setProjects(d.projects ?? []));
  }, []);

  // タスクに日付を計算（リアルタイム）
  const scheduledTasks = startDate ? calcSchedule(tasks, startDate, excludeWeekends) : tasks;

  // ─── タスク操作 ───────────────────────────────────────────────────────────
  function addTask() {
    setTasks(p => [...p, { id: uid(), name: "", durationDays: 1, memo: "" }]);
  }
  function updateTask(id: string, field: keyof TaskRow, value: string | number) {
    setTasks(p => p.map(t => t.id === id ? { ...t, [field]: value } : t));
  }
  function removeTask(id: string) {
    setTasks(p => p.filter(t => t.id !== id));
  }
  function moveTask(id: string, dir: -1 | 1) {
    setTasks(p => {
      const idx = p.findIndex(t => t.id === id);
      if (idx < 0) return p;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= p.length) return p;
      const arr = [...p];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  }

  // ─── マイルストーン操作 ──────────────────────────────────────────────────
  function addMilestone() {
    setMilestones(p => [...p, { id: uid(), label: "", date: "" }]);
  }
  function updateMilestone(id: string, field: keyof Milestone, value: string) {
    setMilestones(p => p.map(m => m.id === id ? { ...m, [field]: value } : m));
  }

  // ─── バリデーション ──────────────────────────────────────────────────────
  function step1Valid() { return projectId && title.trim() && startDate; }
  function step2Valid() { return tasks.some(t => t.name.trim()); }

  // ─── 保存 ────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        title,
        projectId: projectId || null,
        tasks: scheduledTasks
          .filter(t => t.name.trim() && t.startDate && t.endDate)
          .map(t => ({
            name:      t.name,
            startDate: t.startDate,
            endDate:   t.endDate,
            status:    "TODO",
          })),
      };
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      router.push("/schedules");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally { setSubmitting(false); }
  }

  // ─── ステップ指示バー ─────────────────────────────────────────────────────
  const STEPS = ["① 基本設定", "② 作業リスト", "③ 確認・保存"];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/schedules" className="hover:text-blue-600">工程表</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">新規作成</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">工程表を作成</h1>

      {/* ステップバー */}
      <div className="flex gap-2">
        {STEPS.map((label, i) => (
          <div
            key={i}
            className={`flex-1 py-2 text-center text-sm font-medium rounded-lg border transition-colors ${
              step === i + 1
                ? "bg-blue-600 text-white border-blue-600"
                : step > i + 1
                ? "bg-blue-50 text-blue-600 border-blue-200"
                : "bg-gray-50 text-gray-400 border-gray-200"
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* ── ステップ1: 基本設定 ── */}
      {step === 1 && (
        <div className="space-y-5">
          <Card padding="md" shadow="sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">① ゴールを決める</h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">案件 <span className="text-red-500">*</span></label>
                <select
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  required
                >
                  <option value="">案件を選択</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">工程表タイトル <span className="text-red-500">*</span></label>
                <input
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例：○○邸新築工事　工程表"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">工事開始日 <span className="text-red-500">*</span></label>
                  <input type="date" className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">引渡し予定日</label>
                  <input type="date" className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={completionDate} onChange={e => setCompletionDate(e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded text-blue-600" checked={excludeWeekends} onChange={e => setExcludeWeekends(e.target.checked)} />
                <span className="text-sm text-gray-700">土日を除いて日程を計算する</span>
              </label>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">制約・注意事項（任意）</label>
                <textarea
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2}
                  placeholder="例：近隣への騒音制限あり（平日8〜17時のみ）、屋根工事は雨天NG"
                  value={constraints}
                  onChange={e => setConstraints(e.target.value)}
                />
              </div>
            </div>
          </Card>

          {/* マイルストーン */}
          <Card padding="md" shadow="sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">マイルストーン</h2>
                <p className="text-xs text-gray-500 mt-0.5">ズラせない日を先に押さえます（検査日、材料搬入日、足場解体日など）</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={addMilestone}>+ 追加</Button>
            </div>
            {milestones.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">マイルストーンはありません（任意）</p>
            ) : (
              <div className="space-y-2">
                {milestones.map(m => (
                  <div key={m.id} className="flex gap-2 items-center">
                    <input
                      className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="例：検査日"
                      value={m.label}
                      onChange={e => updateMilestone(m.id, "label", e.target.value)}
                    />
                    <input
                      type="date"
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={m.date}
                      onChange={e => updateMilestone(m.id, "date", e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setMilestones(p => p.filter(x => x.id !== m.id))}
                      className="text-gray-400 hover:text-red-500 text-lg"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="flex justify-end">
            <Button variant="primary" size="md" onClick={() => setStep(2)} disabled={!step1Valid()}>
              次へ：作業リスト →
            </Button>
          </div>
        </div>
      )}

      {/* ── ステップ2: 作業リスト ── */}
      {step === 2 && (
        <div className="space-y-5">
          <Card padding="md" shadow="sm">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-gray-900">② 作業リストを入力</h2>
              <Button type="button" variant="ghost" size="sm" onClick={addTask}>+ 行を追加</Button>
            </div>
            <p className="text-xs text-gray-500 mb-4">上から順番に施工順序で入力してください。作業名は過去の入力から予測変換されます。</p>

            {/* ヘッダー */}
            <div className="grid grid-cols-[1.8fr_80px_1fr_auto] gap-2 text-xs font-medium text-gray-500 pb-1 border-b border-gray-200 mb-1">
              <span>作業内容</span>
              <span>所要日数</span>
              <span>メモ（任意）</span>
              <span className="w-16" />
            </div>

            {/* タスク行 */}
            <div className="space-y-1.5">
              {tasks.map((task, idx) => (
                <div key={task.id} className="grid grid-cols-[1.8fr_80px_1fr_auto] gap-2 items-start">
                  <SuggestInput
                    value={task.name}
                    onChange={v => updateTask(task.id, "name", v)}
                    suggestions={suggestions}
                    placeholder="例：基礎工事"
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={task.durationDays}
                      onChange={e => updateTask(task.id, "durationDays", e.target.value)}
                    />
                    <span className="text-xs text-gray-500 whitespace-nowrap">日</span>
                  </div>
                  <input
                    className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="メモ"
                    value={task.memo}
                    onChange={e => updateTask(task.id, "memo", e.target.value)}
                  />
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveTask(task.id, -1)}
                      disabled={idx === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-20 px-1"
                    >↑</button>
                    <button
                      type="button"
                      onClick={() => moveTask(task.id, 1)}
                      disabled={idx === tasks.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-20 px-1"
                    >↓</button>
                    {tasks.length > 1 && (
                      <button type="button" onClick={() => removeTask(task.id)} className="text-gray-400 hover:text-red-500 px-1">×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 日程プレビュー */}
            {startDate && tasks.some(t => t.name.trim()) && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-3">日程プレビュー（{excludeWeekends ? "土日除く" : "カレンダー日数"}）</p>
                <MiniGantt tasks={scheduledTasks} />
                {completionDate && scheduledTasks.at(-1)?.endDate && scheduledTasks.at(-1)!.endDate! > completionDate && (
                  <p className="mt-2 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded">
                    ⚠ 最終作業の終了日（{scheduledTasks.at(-1)!.endDate}）が引渡し予定日（{completionDate}）を超えています
                  </p>
                )}
              </div>
            )}
          </Card>

          <div className="flex justify-between">
            <Button variant="ghost" size="md" onClick={() => setStep(1)}>← 戻る</Button>
            <Button variant="primary" size="md" onClick={() => setStep(3)} disabled={!step2Valid()}>
              次へ：確認 →
            </Button>
          </div>
        </div>
      )}

      {/* ── ステップ3: 確認・保存 ── */}
      {step === 3 && (
        <div className="space-y-5">
          {/* サマリー */}
          <Card padding="md" shadow="sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">③ 確認・保存</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mb-5">
              <div>
                <dt className="text-gray-500">タイトル</dt>
                <dd className="font-medium text-gray-900 mt-0.5">{title}</dd>
              </div>
              <div>
                <dt className="text-gray-500">開始日</dt>
                <dd className="font-medium text-gray-900 mt-0.5">{startDate}</dd>
              </div>
              <div>
                <dt className="text-gray-500">引渡し予定</dt>
                <dd className="font-medium text-gray-900 mt-0.5">{completionDate || "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">作業数</dt>
                <dd className="font-medium text-gray-900 mt-0.5">{tasks.filter(t => t.name.trim()).length}件</dd>
              </div>
              <div>
                <dt className="text-gray-500">総日数</dt>
                <dd className="font-medium text-gray-900 mt-0.5">
                  {(() => {
                    const dated = scheduledTasks.filter(t => t.startDate && t.endDate && t.name.trim());
                    if (!dated.length) return "—";
                    const last = dated.at(-1)!;
                    const start = new Date(startDate + "T00:00:00");
                    const end   = new Date(last.endDate! + "T00:00:00");
                    return `${Math.round((end.getTime() - start.getTime()) / 86400000) + 1}日`;
                  })()}
                </dd>
              </div>
            </dl>

            {/* ガントプレビュー */}
            <div className="mb-5 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 mb-3">ガントチャートプレビュー</p>
              <MiniGantt tasks={scheduledTasks.filter(t => t.name.trim())} />
            </div>

            {/* マイルストーン表示 */}
            {milestones.filter(m => m.label && m.date).length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-medium text-gray-500 mb-2">マイルストーン</p>
                <div className="flex flex-wrap gap-2">
                  {milestones.filter(m => m.label && m.date).map(m => (
                    <span key={m.id} className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs rounded-full font-medium">
                      {m.label}：{m.date}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 案件紐づけ */}
            <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-4">
              <label className="text-sm font-medium text-gray-700">紐づける案件</label>
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
              >
                <option value="">なし（後で紐づける）</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </Card>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" size="md" onClick={() => setStep(2)}>← 戻る</Button>
            <Button variant="primary" size="md" loading={submitting} onClick={handleSave}>
              工程表を保存する
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
