"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface User { id: string; name: string; role: string }
interface Project { id: string; name: string }

interface Summary {
  user: { id: string; name: string; role: string; subcontractorName: string | null };
  workDays: number;
  totalMinutes: number;
  avgMinutesPerDay: number;
}

interface Detail {
  id: string;
  userId: string;
  userName: string;
  workDate: string;
  projectId: string;
  projectName: string;
  dailyReportId: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  actualMinutes: number;
  workContent: string | null;
}

function fmtMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export default function AttendancePage() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(lastDay);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [details, setDetails] = useState<Detail[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"summary" | "detail">("summary");

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(d => setUsers(d.users ?? []));
    fetch("/api/projects").then(r => r.json()).then(d => setProjects(d.projects ?? []));
  }, []);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (selectedUserId) params.set("userId", selectedUserId);
      if (selectedProjectId) params.set("projectId", selectedProjectId);
      const res = await fetch(`/api/attendance?${params}`);
      if (res.ok) {
        const d = await res.json();
        setSummary(d.summary ?? []);
        setDetails(d.details ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [from, to, selectedUserId, selectedProjectId]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  // 集計合計
  const totalDays = summary.reduce((s, r) => s + r.workDays, 0);
  const totalMinutes = summary.reduce((s, r) => s + r.totalMinutes, 0);

  // 詳細をユーザー×日付でグループ化
  const groupedDetails = details.reduce<Record<string, Detail[]>>((acc, d) => {
    const key = `${d.userId}_${d.workDate}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  const groupedEntries = Object.entries(groupedDetails).sort(([a], [b]) => {
    const [, dateA] = a.split("_");
    const [, dateB] = b.split("_");
    return dateB.localeCompare(dateA);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">勤怠管理</h1>
          <p className="mt-1 text-sm text-gray-500">日報の作業ログから自動集計</p>
        </div>
      </div>

      {/* フィルター */}
      <Card padding="md" shadow="sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">開始日</label>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">終了日</label>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">作業員</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">全員</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">案件</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              <option value="">全案件</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* 集計カード */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "対象人数", value: `${summary.length}人` },
          { label: "延べ出勤日数", value: `${totalDays}日` },
          { label: "延べ労働時間", value: fmtMinutes(totalMinutes) },
        ].map((c) => (
          <Card key={c.label} padding="md" shadow="sm">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{c.value}</p>
          </Card>
        ))}
      </div>

      {/* タブ */}
      <div className="flex border-b border-gray-200">
        {(["summary", "detail"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "summary" ? "人別集計" : "日別詳細"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16"><LoadingSpinner label="集計中..." /></div>
      ) : (
        <>
          {/* 人別集計 */}
          {activeTab === "summary" && (
            <Card padding="none" shadow="sm">
              {summary.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400">
                  対象期間に作業ログがありません
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-5 py-3 font-semibold text-gray-600">氏名</th>
                        <th className="text-left px-5 py-3 font-semibold text-gray-600">区分</th>
                        <th className="text-right px-5 py-3 font-semibold text-gray-600">出勤日数</th>
                        <th className="text-right px-5 py-3 font-semibold text-gray-600">総労働時間</th>
                        <th className="text-right px-5 py-3 font-semibold text-gray-600">1日平均</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {summary.map((row) => (
                        <tr key={row.user.id} className="hover:bg-gray-50">
                          <td className="px-5 py-4 font-medium text-gray-900">{row.user.name}</td>
                          <td className="px-5 py-4 text-gray-500 text-xs">
                            {row.user.subcontractorName
                              ? <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{row.user.subcontractorName}</span>
                              : <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">自社</span>}
                          </td>
                          <td className="px-5 py-4 text-right text-gray-900">{row.workDays}日</td>
                          <td className="px-5 py-4 text-right font-medium text-gray-900">{fmtMinutes(row.totalMinutes)}</td>
                          <td className="px-5 py-4 text-right text-gray-500">{fmtMinutes(row.avgMinutesPerDay)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td className="px-5 py-3 font-semibold text-gray-700" colSpan={2}>合計</td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-700">{totalDays}日</td>
                        <td className="px-5 py-3 text-right font-bold text-gray-900">{fmtMinutes(totalMinutes)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* 日別詳細 */}
          {activeTab === "detail" && (
            <Card padding="none" shadow="sm">
              {groupedEntries.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400">
                  対象期間に作業ログがありません
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {groupedEntries.map(([key, logs]) => {
                    const first = logs[0];
                    const dayTotal = logs.reduce((s, l) => s + l.actualMinutes, 0);
                    return (
                      <div key={key} className="px-5 py-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-900">{first.userName}</span>
                            <span className="text-sm text-gray-500">
                              {new Date(first.workDate).toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}
                            </span>
                            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                              {first.projectName}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-gray-900">{fmtMinutes(dayTotal)}</span>
                            <Link
                              href={`/daily-reports/${first.dailyReportId}`}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              日報を見る
                            </Link>
                          </div>
                        </div>
                        <div className="space-y-1 ml-1">
                          {logs.map((log) => (
                            <div key={log.id} className="flex items-center gap-2 text-xs text-gray-500">
                              <span className="tabular-nums">
                                {fmtTime(log.startTime)} 〜 {fmtTime(log.endTime)}
                              </span>
                              {log.breakMinutes > 0 && (
                                <span className="text-gray-400">（休憩{log.breakMinutes}分）</span>
                              )}
                              <span className="text-gray-400">実働 {fmtMinutes(log.actualMinutes)}</span>
                              {log.workContent && (
                                <span className="text-gray-600 truncate max-w-xs">— {log.workContent}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
