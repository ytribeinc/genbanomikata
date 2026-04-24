"use client"

export const dynamic = "force-dynamic";;

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

// ─── 型定義 ──────────────────────────────────────────────────────────────────
interface Project  { id: string; name: string }
interface Schedule { id: string; title: string; projectId: string | null; project: { id: string; name: string } | null }
interface User     { id: string; name: string }
interface Task {
  id: string;
  scheduleId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  color: string | null;
  sortOrder: number;
  assignedUser: { id: string; name: string } | null;
}

// ─── 定数 ────────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = { TODO: "未着手", IN_PROGRESS: "進行中", DONE: "完了" };
const STATUS_COLOR: Record<string, string> = {
  TODO: "bg-gray-200 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  DONE: "bg-emerald-100 text-emerald-700",
};
const TASK_COLORS = [
  { label: "青", value: "#3b82f6" }, { label: "緑", value: "#10b981" },
  { label: "橙", value: "#f59e0b" }, { label: "赤", value: "#ef4444" },
  { label: "紫", value: "#8b5cf6" }, { label: "灰", value: "#6b7280" },
];

// ─── 日付ユーティリティ ───────────────────────────────────────────────────────
function parseDate(s: string) { return new Date(s.slice(0, 10) + "T00:00:00"); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86400000); }
function startOfWeek(d: Date) { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); return r; }
function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }
function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

// ─── ガントチャート ───────────────────────────────────────────────────────────
function GanttChart({ tasks, rangeStart, totalDays, onEdit, onStatusChange }: {
  tasks: Task[]; rangeStart: Date; totalDays: number;
  onEdit: (task: Task) => void; onStatusChange: (task: Task, status: string) => void;
}) {
  const months: { label: string; left: number; width: number }[] = [];
  let cur = new Date(rangeStart);
  while (daysBetween(rangeStart, cur) < totalDays) {
    const monthStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const monthEnd   = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const left  = Math.max(0, daysBetween(rangeStart, monthStart));
    const right = Math.min(totalDays, daysBetween(rangeStart, monthEnd) + 1);
    months.push({ label: `${cur.getFullYear()}年${cur.getMonth() + 1}月`, left: (left / totalDays) * 100, width: ((right - left) / totalDays) * 100 });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  const todayPct = (daysBetween(rangeStart, new Date()) / totalDays) * 100;
  const showToday = todayPct >= 0 && todayPct <= 100;

  return (
    <div className="flex flex-col">
      <div className="relative h-7 border-b border-gray-200 bg-gray-50 flex-shrink-0 ml-[200px]">
        {months.map(m => (
          <div key={m.label} className="absolute top-0 h-full flex items-center px-2 border-r border-gray-200 text-xs font-medium text-gray-500" style={{ left: `${m.left}%`, width: `${m.width}%` }}>
            {m.label}
          </div>
        ))}
      </div>
      <div className="flex flex-col divide-y divide-gray-100">
        {tasks.map(task => {
          const s = parseDate(task.startDate);
          const e = parseDate(task.endDate);
          const leftPct  = (Math.max(0, daysBetween(rangeStart, s)) / totalDays) * 100;
          const widthPct = (Math.max(1, daysBetween(s, addDays(e, 1))) / totalDays) * 100;
          const barColor = task.color || (task.status === "DONE" ? "#10b981" : task.status === "IN_PROGRESS" ? "#3b82f6" : "#6b7280");
          return (
            <div key={task.id} className="flex h-10 items-center hover:bg-gray-50 group">
              <div className="w-[200px] flex-shrink-0 flex items-center gap-2 px-3 border-r border-gray-200">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: barColor }} />
                <span className="text-xs text-gray-800 truncate flex-1">{task.name}</span>
                <button onClick={() => onEdit(task)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-500 transition-opacity flex-shrink-0">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 relative h-full">
                {showToday && <div className="absolute top-0 bottom-0 w-px bg-red-400 opacity-50 z-10 pointer-events-none" style={{ left: `${todayPct}%` }} />}
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-5 rounded cursor-pointer hover:opacity-80 transition-opacity flex items-center px-1.5 overflow-hidden"
                  style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0.5)}%`, backgroundColor: barColor, opacity: task.status === "DONE" ? 0.6 : 1 }}
                  onClick={() => { const next = task.status === "TODO" ? "IN_PROGRESS" : task.status === "IN_PROGRESS" ? "DONE" : "TODO"; onStatusChange(task, next); }}
                  title={`${task.name}\n${task.startDate.slice(0,10)} 〜 ${task.endDate.slice(0,10)}\nクリックでステータス変更`}
                >
                  <span className="text-white text-[10px] font-medium truncate leading-none">{task.name}</span>
                </div>
              </div>
            </div>
          );
        })}
        {tasks.length === 0 && <div className="h-20 flex items-center justify-center text-sm text-gray-400">タスクがありません。「+ タスクを追加」から追加してください</div>}
      </div>
    </div>
  );
}

// ─── カレンダービュー ─────────────────────────────────────────────────────────
function CalendarView({ tasks }: { tasks: Task[] }) {
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedDay, setSelectedDay]   = useState<string | null>(null);

  const year  = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  // 各日のタスク
  function tasksForDay(date: Date): Task[] {
    const ds = toDateStr(date);
    return tasks.filter(t => t.startDate.slice(0, 10) <= ds && t.endDate.slice(0, 10) >= ds);
  }

  const WEEK_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
  const today = toDateStr(new Date());

  return (
    <div>
      {/* ナビゲーション */}
      <div className="flex items-center justify-between mb-4 px-1">
        <button onClick={prevMonth} className="p-1.5 rounded hover:bg-gray-100 text-gray-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-base font-semibold text-gray-900">{year}年{month + 1}月</span>
        <button onClick={nextMonth} className="p-1.5 rounded hover:bg-gray-100 text-gray-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {WEEK_LABELS.map((w, i) => (
          <div key={w} className={`py-2 text-center text-xs font-medium ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"}`}>{w}</div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7">
        {/* 空白（月初の曜日まで） */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-gray-100 bg-gray-50" />
        ))}
        {/* 日付セル */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const date = new Date(year, month, i + 1);
          const ds   = toDateStr(date);
          const dayTasks = tasksForDay(date);
          const isToday  = ds === today;
          const isSun    = date.getDay() === 0;
          const isSat    = date.getDay() === 6;
          const isSelected = ds === selectedDay;

          return (
            <div
              key={ds}
              className={`min-h-[80px] border-b border-r border-gray-100 p-1 cursor-pointer transition-colors hover:bg-blue-50 ${isSelected ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : ""}`}
              onClick={() => setSelectedDay(ds === selectedDay ? null : ds)}
            >
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-0.5 ${
                isToday ? "bg-blue-600 text-white" : isSun ? "text-red-500" : isSat ? "text-blue-500" : "text-gray-700"
              }`}>
                {i + 1}
              </span>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map(task => (
                  <div
                    key={task.id}
                    className="text-[10px] leading-tight px-1 py-0.5 rounded truncate text-white"
                    style={{ backgroundColor: task.color || (task.status === "DONE" ? "#10b981" : task.status === "IN_PROGRESS" ? "#3b82f6" : "#6b7280") }}
                  >
                    {task.name}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-[10px] text-gray-400 px-1">+{dayTasks.length - 3}件</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 選択日の詳細 */}
      {selectedDay && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">
            {new Date(selectedDay + "T00:00:00").toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}
          </p>
          {tasksForDay(new Date(selectedDay + "T00:00:00")).length === 0 ? (
            <p className="text-sm text-gray-400">タスクなし</p>
          ) : (
            <div className="space-y-1.5">
              {tasksForDay(new Date(selectedDay + "T00:00:00")).map(task => (
                <div key={task.id} className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: task.color || "#6b7280" }} />
                  <span className="text-gray-800">{task.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLOR[task.status]}`}>{STATUS_LABEL[task.status]}</span>
                  {task.assignedUser && <span className="text-xs text-gray-400">{task.assignedUser.name}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── タスク編集モーダル ───────────────────────────────────────────────────────
function TaskModal({ task, users, suggestions, onSave, onDelete, onClose }: {
  task: Partial<Task> & { scheduleId: string }; users: User[]; suggestions: string[];
  onSave: (data: Partial<Task>) => void; onDelete?: () => void; onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [name,           setName]           = useState(task.name           ?? "");
  const [startDate,      setStartDate]      = useState(task.startDate?.slice(0, 10) ?? today);
  const [endDate,        setEndDate]        = useState(task.endDate?.slice(0, 10)   ?? today);
  const [status,         setStatus]         = useState(task.status         ?? "TODO");
  const [color,          setColor]          = useState(task.color          ?? TASK_COLORS[0].value);
  const [assignedUserId, setAssignedUserId] = useState(task.assignedUser?.id ?? "");
  const [saving,         setSaving]         = useState(false);
  const [open,           setOpen]           = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = name.trim() ? suggestions.filter(s => s.includes(name) && s !== name).slice(0, 6) : [];
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{task.id ? "タスクを編集" : "タスクを追加"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">タスク名 *</label>
            <div ref={ref} className="relative">
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例：基礎工事" value={name} required autoFocus
                onChange={e => { setName(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
              />
              {open && filtered.length > 0 && (
                <ul className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-white border border-gray-200 rounded-md shadow-lg text-sm max-h-40 overflow-y-auto">
                  {filtered.map(s => (
                    <li key={s} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-gray-800" onMouseDown={() => { setName(s); setOpen(false); }}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">開始日</label>
              <input type="date" className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">終了日</label>
              <input type="date" className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">ステータス</label>
              <select className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={status} onChange={e => setStatus(e.target.value)}>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">担当者</label>
              <select className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={assignedUserId} onChange={e => setAssignedUserId(e.target.value)}>
                <option value="">未割当</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">バーの色</label>
            <div className="flex gap-2">
              {TASK_COLORS.map(c => (
                <button key={c.value} type="button" className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${color === c.value ? "border-gray-800 scale-110" : "border-transparent"}`} style={{ backgroundColor: c.value }} onClick={() => setColor(c.value)} title={c.label} />
              ))}
            </div>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            {onDelete ? <button type="button" onClick={onDelete} className="text-sm text-red-500 hover:text-red-700">削除</button> : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>キャンセル</Button>
              <Button
                variant="primary" size="sm" loading={saving}
                onClick={() => { setSaving(true); onSave({ name, startDate, endDate, status: status as Task["status"], color, assignedUser: users.find(u => u.id === assignedUserId) ?? null }); }}
              >
                {task.id ? "保存" : "追加"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 案件紐づけモーダル ───────────────────────────────────────────────────────
function LinkProjectModal({ schedule, projects, onLink, onClose }: {
  schedule: Schedule; projects: Project[]; onLink: (projectId: string) => void; onClose: () => void;
}) {
  const [projectId, setProjectId] = useState(schedule.projectId ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">案件に紐づける</h3>
          <p className="text-xs text-gray-500 mt-0.5">「{schedule.title}」を案件に紐づけます</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">紐づけなし</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>キャンセル</Button>
            <Button
              variant="primary" size="sm" loading={saving}
              onClick={() => { setSaving(true); onLink(projectId); }}
            >
              紐づける
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────────────────────────
export default function SchedulesPage() {
  const [projects,     setProjects]     = useState<Project[]>([]);
  const [schedules,    setSchedules]    = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [tasks,        setTasks]        = useState<Task[]>([]);
  const [users,        setUsers]        = useState<User[]>([]);
  const [suggestions,  setSuggestions]  = useState<string[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [viewTab,      setViewTab]      = useState<"gantt" | "calendar">("gantt");
  const [editingTask,  setEditingTask]  = useState<(Partial<Task> & { scheduleId: string }) | null>(null);
  const [linkingSchedule, setLinkingSchedule] = useState<Schedule | null>(null);
  const [pdfLoading,   setPdfLoading]   = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(d => setProjects(d.projects ?? []));
    fetch("/api/users").then(r => r.json()).then(d => setUsers(d.users ?? []));
    fetch("/api/schedules/suggestions").then(r => r.json()).then(d => setSuggestions(d.suggestions ?? []));
    fetch("/api/schedules").then(r => r.json()).then(d => {
      const list = d.schedules ?? [];
      setSchedules(list);
      if (list.length > 0) setSelectedScheduleId(list[0].id);
    });
  }, []);

  const fetchTasks = useCallback(async (sid: string) => {
    if (!sid) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/schedules/${sid}/tasks`);
      if (res.ok) { const d = await res.json(); setTasks(d.tasks ?? []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedScheduleId) fetchTasks(selectedScheduleId);
    else setTasks([]);
  }, [selectedScheduleId, fetchTasks]);

  const { rangeStart, totalDays } = (() => {
    if (tasks.length === 0) { const s = new Date(); s.setDate(1); return { rangeStart: s, totalDays: 90 }; }
    const dates = tasks.flatMap(t => [parseDate(t.startDate), parseDate(t.endDate)]);
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    const start = addDays(startOfWeek(min), -7);
    const end   = addDays(max, 14);
    return { rangeStart: start, totalDays: Math.max(60, daysBetween(start, end)) };
  })();

  async function handlePDF() {
    if (!selectedScheduleId) return;
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/schedules/${selectedScheduleId}/pdf`, { method: "POST" });
      if (!res.ok) { alert("PDF生成に失敗しました"); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `工程表_${schedules.find(s => s.id === selectedScheduleId)?.title ?? ""}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setPdfLoading(false); }
  }

  async function handleTaskSave(data: Partial<Task>) {
    if (!editingTask) return;
    const sid = editingTask.scheduleId;
    if (editingTask.id) {
      const res = await fetch(`/api/schedules/${sid}/tasks/${editingTask.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, startDate: data.startDate, endDate: data.endDate, status: data.status, color: data.color, assignedUserId: data.assignedUser?.id ?? null }),
      });
      if (res.ok) { const { task } = await res.json(); setTasks(p => p.map(t => t.id === task.id ? task : t)); }
    } else {
      const res = await fetch(`/api/schedules/${sid}/tasks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, startDate: data.startDate, endDate: data.endDate, status: data.status, color: data.color, assignedUserId: data.assignedUser?.id ?? null, sortOrder: tasks.length }),
      });
      if (res.ok) { const { task } = await res.json(); setTasks(p => [...p, task]); }
    }
    setEditingTask(null);
    // サジェスト更新
    fetch("/api/schedules/suggestions").then(r => r.json()).then(d => setSuggestions(d.suggestions ?? []));
  }

  async function handleTaskDelete() {
    if (!editingTask?.id) return;
    if (!confirm("このタスクを削除しますか？")) return;
    await fetch(`/api/schedules/${editingTask.scheduleId}/tasks/${editingTask.id}`, { method: "DELETE" });
    setTasks(p => p.filter(t => t.id !== editingTask.id));
    setEditingTask(null);
  }

  async function handleStatusChange(task: Task, status: string) {
    const res = await fetch(`/api/schedules/${task.scheduleId}/tasks/${task.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    if (res.ok) { const { task: updated } = await res.json(); setTasks(p => p.map(t => t.id === updated.id ? updated : t)); }
  }

  async function handleLink(projectId: string) {
    if (!linkingSchedule) return;
    const res = await fetch(`/api/schedules/${linkingSchedule.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: projectId || null }),
    });
    if (res.ok) {
      const { schedule } = await res.json();
      setSchedules(p => p.map(s => s.id === schedule.id ? schedule : s));
    }
    setLinkingSchedule(null);
  }

  const doneCount = tasks.filter(t => t.status === "DONE").length;
  const progress  = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
  const selectedSchedule = schedules.find(s => s.id === selectedScheduleId);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">工程表</h1>
          <p className="mt-1 text-sm text-gray-500">案件の工事スケジュールを管理します</p>
        </div>
        <Link href="/schedules/new">
          <Button variant="primary" size="md">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            工程表を作成
          </Button>
        </Link>
      </div>

      {/* 工程表セレクター */}
      <Card padding="md" shadow="sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-gray-700">工程表を選択</label>
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={selectedScheduleId}
              onChange={e => setSelectedScheduleId(e.target.value)}
            >
              <option value="">工程表を選択</option>
              {schedules.map(s => (
                <option key={s.id} value={s.id}>
                  {s.project ? `[${s.project.name}] ` : "【未紐づけ】"}{s.title}
                </option>
              ))}
            </select>
          </div>
          {selectedSchedule && (
            <div className="flex items-center gap-2">
              {selectedSchedule.project ? (
                <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                  {selectedSchedule.project.name}
                </span>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">未紐づけ</span>
              )}
              <Button
                variant="ghost" size="sm"
                onClick={() => setLinkingSchedule(selectedSchedule)}
              >
                {selectedSchedule.project ? "案件を変更" : "案件に紐づける"}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {!selectedScheduleId ? (
        <Card padding="lg" shadow="sm">
          <div className="text-center py-10">
            <p className="text-sm font-medium text-gray-900">工程表を選択してください</p>
            <p className="text-sm text-gray-500 mt-1">または「工程表を作成」から新しく作成できます</p>
          </div>
        </Card>
      ) : loading ? (
        <div className="py-16"><LoadingSpinner label="読み込み中..." /></div>
      ) : (
        <>
          {/* 進捗バー */}
          {tasks.length > 0 && (
            <Card padding="md" shadow="sm">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>進捗</span>
                    <span>{doneCount} / {tasks.length} タスク完了</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <span className={`text-lg font-bold ${progress === 100 ? "text-emerald-600" : "text-gray-900"}`}>{progress}%</span>
              </div>
              <div className="flex gap-3 mt-3 text-xs flex-wrap">
                {Object.entries(STATUS_LABEL).map(([status, label]) => (
                  <span key={status} className={`px-2 py-0.5 rounded-full ${STATUS_COLOR[status]}`}>
                    {label}: {tasks.filter(t => t.status === status).length}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* タブ切り替え + ガント/カレンダー */}
          <Card padding="none" shadow="sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex gap-1">
                {(["gantt", "calendar"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setViewTab(tab)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      viewTab === tab ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {tab === "gantt" ? "ガント" : "カレンダー"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handlePDF} disabled={pdfLoading || tasks.length === 0}>
                  {pdfLoading ? "生成中..." : "📄 PDF出力"}
                </Button>
                <Button variant="primary" size="sm" onClick={() => setEditingTask({ scheduleId: selectedScheduleId })}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  タスクを追加
                </Button>
              </div>
            </div>

            {viewTab === "gantt" ? (
              <>
                <div className="overflow-x-auto" ref={scrollRef}>
                  <div style={{ minWidth: `${Math.max(800, totalDays * 14)}px` }}>
                    <GanttChart
                      tasks={tasks} rangeStart={rangeStart} totalDays={totalDays}
                      onEdit={task => setEditingTask({ ...task, scheduleId: selectedScheduleId })}
                      onStatusChange={handleStatusChange}
                    />
                  </div>
                </div>
                <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-3 h-px bg-red-400 inline-block" /> 今日</span>
                  <span>バーをクリックでステータス変更 / 鉛筆アイコンで編集</span>
                </div>
              </>
            ) : (
              <div className="p-4">
                <CalendarView tasks={tasks} />
              </div>
            )}
          </Card>
        </>
      )}

      {editingTask && (
        <TaskModal
          task={editingTask} users={users} suggestions={suggestions}
          onSave={handleTaskSave}
          onDelete={editingTask.id ? handleTaskDelete : undefined}
          onClose={() => setEditingTask(null)}
        />
      )}

      {linkingSchedule && (
        <LinkProjectModal
          schedule={linkingSchedule} projects={projects}
          onLink={handleLink}
          onClose={() => setLinkingSchedule(null)}
        />
      )}
    </div>
  );
}
