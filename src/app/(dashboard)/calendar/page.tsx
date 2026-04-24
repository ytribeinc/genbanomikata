"use client"

export const dynamic = "force-dynamic";;

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface CalendarTask {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  color: string | null;
  schedule: {
    id: string;
    title: string;
    project: { id: string; name: string } | null;
  };
  assignedUser: { id: string; name: string } | null;
}

const STATUS_LABEL: Record<string, string> = { TODO: "未着手", IN_PROGRESS: "進行中", DONE: "完了" };
const STATUS_COLOR: Record<string, string> = {
  TODO: "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  DONE: "bg-emerald-100 text-emerald-700",
};

function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }

function taskColor(task: CalendarTask): string {
  if (task.color) return task.color;
  if (task.status === "DONE") return "#10b981";
  if (task.status === "IN_PROGRESS") return "#3b82f6";
  return "#6b7280";
}

export default function CalendarPage() {
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // フィルター
  const [filterScheduleId, setFilterScheduleId] = useState(""); // "" = すべて
  const [filterStatus, setFilterStatus] = useState(""); // "" = すべて

  useEffect(() => {
    fetch("/api/calendar/tasks")
      .then(r => r.json())
      .then(d => setTasks(d.tasks ?? []))
      .finally(() => setLoading(false));
  }, []);

  const year  = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay   = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toDateStr(new Date());

  // ユニークなスケジュール一覧（フィルター用）
  const schedules = Array.from(
    new Map(tasks.map(t => [t.schedule.id, t.schedule])).values()
  ).sort((a, b) => a.title.localeCompare(b.title, "ja"));

  // フィルター適用済みタスク
  const filteredTasks = tasks.filter(t => {
    if (filterScheduleId && t.schedule.id !== filterScheduleId) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    return true;
  });

  function tasksForDay(dateStr: string): CalendarTask[] {
    return filteredTasks.filter(t =>
      t.startDate.slice(0, 10) <= dateStr && t.endDate.slice(0, 10) >= dateStr
    );
  }

  const selectedDayTasks = selectedDay ? tasksForDay(selectedDay) : [];

  const WEEK_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

  // 今月のタスク数サマリー
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthEnd   = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const monthTasks = filteredTasks.filter(t =>
    t.startDate.slice(0, 10) <= monthEnd && t.endDate.slice(0, 10) >= monthStart
  );
  const monthDone = monthTasks.filter(t => t.status === "DONE").length;
  const monthInProgress = monthTasks.filter(t => t.status === "IN_PROGRESS").length;
  const monthTodo = monthTasks.filter(t => t.status === "TODO").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">全体カレンダー</h1>
          <p className="mt-1 text-sm text-gray-500">全工程表のタスクをまとめて確認できます</p>
        </div>
        <Link href="/schedules" className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          工程表管理へ
        </Link>
      </div>

      {loading ? (
        <div className="py-20"><LoadingSpinner label="読み込み中..." /></div>
      ) : (
        <>
          {/* フィルター */}
          <Card padding="md" shadow="sm">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1 min-w-[180px]">
                <label className="text-xs font-medium text-gray-500">工程表</label>
                <select
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={filterScheduleId}
                  onChange={e => { setFilterScheduleId(e.target.value); setSelectedDay(null); }}
                >
                  <option value="">すべての工程表</option>
                  {schedules.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.project ? `[${s.project.name}] ` : ""}{s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">ステータス</label>
                <select
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={filterStatus}
                  onChange={e => { setFilterStatus(e.target.value); setSelectedDay(null); }}
                >
                  <option value="">すべて</option>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {(filterScheduleId || filterStatus) && (
                <button
                  className="text-sm text-gray-400 hover:text-gray-600 px-2 py-2"
                  onClick={() => { setFilterScheduleId(""); setFilterStatus(""); setSelectedDay(null); }}
                >
                  クリア
                </button>
              )}
            </div>
          </Card>

          {/* 月サマリー */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "今月のタスク", value: monthTasks.length, color: "text-gray-900", bg: "bg-white" },
              { label: "未着手", value: monthTodo, color: "text-gray-600", bg: "bg-gray-50" },
              { label: "進行中", value: monthInProgress, color: "text-blue-700", bg: "bg-blue-50" },
              { label: "完了", value: monthDone, color: "text-emerald-700", bg: "bg-emerald-50" },
            ].map(item => (
              <Card key={item.label} padding="md" shadow="sm" className={item.bg}>
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className={`text-2xl font-bold mt-1 ${item.color}`}>{item.value}<span className="text-sm font-normal ml-1">件</span></p>
              </Card>
            ))}
          </div>

          {/* カレンダー本体 */}
          <Card padding="none" shadow="sm">
            {/* ナビゲーション */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <button
                onClick={() => { setCurrentMonth(new Date(year, month - 1, 1)); setSelectedDay(null); }}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-gray-900">{year}年{month + 1}月</span>
                <button
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded border border-blue-200 hover:bg-blue-50"
                  onClick={() => { setCurrentMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelectedDay(null); }}
                >
                  今月
                </button>
              </div>
              <button
                onClick={() => { setCurrentMonth(new Date(year, month + 1, 1)); setSelectedDay(null); }}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>

            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {WEEK_LABELS.map((w, i) => (
                <div key={w} className={`py-2 text-center text-xs font-semibold ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"}`}>{w}</div>
              ))}
            </div>

            {/* グリッド */}
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-gray-100 bg-gray-50/50" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                const dayTasks = tasksForDay(ds);
                const isToday    = ds === today;
                const isSun      = new Date(year, month, i + 1).getDay() === 0;
                const isSat      = new Date(year, month, i + 1).getDay() === 6;
                const isSelected = ds === selectedDay;

                return (
                  <div
                    key={ds}
                    className={`min-h-[100px] border-b border-r border-gray-100 p-1.5 cursor-pointer transition-colors hover:bg-blue-50/50 ${isSelected ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : ""}`}
                    onClick={() => setSelectedDay(ds === selectedDay ? null : ds)}
                  >
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold mb-1 ${
                      isToday ? "bg-blue-600 text-white" : isSun ? "text-red-500" : isSat ? "text-blue-500" : "text-gray-700"
                    }`}>
                      {i + 1}
                    </span>
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map(task => (
                        <div
                          key={task.id}
                          className="text-[10px] leading-tight px-1.5 py-0.5 rounded truncate text-white font-medium"
                          style={{ backgroundColor: taskColor(task) }}
                          title={`${task.name}（${task.schedule.title}）`}
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
          </Card>

          {/* 選択日の詳細 */}
          {selectedDay && (
            <Card padding="md" shadow="sm">
              <p className="text-sm font-semibold text-gray-900 mb-3">
                {new Date(selectedDay + "T00:00:00").toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
                <span className="ml-2 text-gray-400 font-normal text-xs">{selectedDayTasks.length}件のタスク</span>
              </p>
              {selectedDayTasks.length === 0 ? (
                <p className="text-sm text-gray-400">この日のタスクはありません</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayTasks.map(task => (
                    <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: taskColor(task) }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{task.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          <Link href={`/schedules`} className="hover:text-blue-600">
                            {task.schedule.project ? `${task.schedule.project.name} ／ ` : ""}{task.schedule.title}
                          </Link>
                          {task.assignedUser && ` · ${task.assignedUser.name}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-400">
                          {task.startDate.slice(0, 10)} 〜 {task.endDate.slice(0, 10)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[task.status]}`}>
                          {STATUS_LABEL[task.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
