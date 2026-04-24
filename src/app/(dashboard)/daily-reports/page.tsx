"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type Weather = "SUNNY" | "CLOUDY" | "RAINY" | "SNOWY";
type ReportType = "own" | "subcontractor";

const WEATHER_LABELS: Record<Weather, string> = { SUNNY: "晴れ", CLOUDY: "曇り", RAINY: "雨", SNOWY: "雪" };
const WEATHER_BADGE: Record<Weather, "sunny" | "cloudy" | "rainy" | "snowy"> = { SUNNY: "sunny", CLOUDY: "cloudy", RAINY: "rainy", SNOWY: "snowy" };

interface Project { id: string; name: string }
interface DailyReport {
  id: string;
  projectId: string;
  userId: string;
  workDate: string;
  summary: string | null;
  weather: Weather;
  createdAt: string;
  project: Project;
  user: { id: string; name: string; avatarUrl: string | null; subcontractorName: string | null };
}

export default function DailyReportsPage() {
  const searchParams    = useSearchParams();
  const initialProjectId = searchParams.get("projectId") ?? "";

  const [tab,           setTab]           = useState<ReportType>("own");
  const [dailyReports,  setDailyReports]  = useState<DailyReport[]>([]);
  const [projects,      setProjects]      = useState<Project[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [filterDate,    setFilterDate]    = useState("");
  const [filterProjectId, setFilterProjectId] = useState(initialProjectId);

  const fetchReports = useCallback(async (date: string, projectId: string, type: ReportType) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type });
      if (date)      params.set("date",      date);
      if (projectId) params.set("projectId", projectId);
      const res = await fetch(`/api/daily-reports?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDailyReports(data.dailyReports ?? []);
    } catch {
      setError("日報データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(d => setProjects(d.projects ?? []));
  }, []);

  useEffect(() => {
    fetchReports(filterDate, filterProjectId, tab);
  }, [filterDate, filterProjectId, tab, fetchReports]);

  // 下請けタブ用：業者名ごとにグループ化して件数表示
  const subcontractorGroups = dailyReports.reduce<Record<string, number>>((acc, r) => {
    const name = r.user.subcontractorName ?? "不明";
    acc[name] = (acc[name] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">日報</h1>
          <p className="mt-1 text-sm text-gray-500">{loading ? "..." : `${dailyReports.length} 件`}</p>
        </div>
        {tab === "own" && (
          <Link href="/daily-reports/new">
            <Button variant="primary" size="md">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              日報を作成
            </Button>
          </Link>
        )}
      </div>

      {/* タブ */}
      <div className="flex gap-0 border-b border-gray-200">
        {([
          { value: "own",          label: "自社の日報",         desc: "自社スタッフが作成した日報" },
          { value: "subcontractor", label: "下請け業者からの日報", desc: "下請け業者が提出した日報" },
        ] as const).map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.value
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 下請けタブの業者サマリー */}
      {tab === "subcontractor" && !loading && Object.keys(subcontractorGroups).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(subcontractorGroups).map(([name, count]) => (
            <span key={name} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 border border-violet-100 text-sm text-violet-700">
              <span className="font-medium">{name}</span>
              <span className="text-violet-400 text-xs">{count}件</span>
            </span>
          ))}
        </div>
      )}

      {/* フィルタ */}
      <Card padding="md" shadow="sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input type="date" label="日付" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">案件</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterProjectId}
              onChange={e => setFilterProjectId(e.target.value)}
            >
              <option value="">すべての案件</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {(filterDate || filterProjectId) && (
            <div className="flex items-end">
              <Button variant="ghost" size="md" onClick={() => { setFilterDate(""); setFilterProjectId(""); }}>クリア</Button>
            </div>
          )}
        </div>
      </Card>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* 一覧 */}
      <Card padding="none" shadow="sm">
        {loading ? (
          <div className="py-16"><LoadingSpinner label="読み込み中..." /></div>
        ) : dailyReports.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium text-gray-900">
              {tab === "own" ? "自社の日報がありません" : "下請け業者からの日報がありません"}
            </p>
            {tab === "own" && (
              <div className="mt-3">
                <Link href="/daily-reports/new"><Button variant="primary" size="sm">日報を作成</Button></Link>
              </div>
            )}
            {tab === "subcontractor" && (
              <p className="mt-1 text-xs text-gray-400">下請け業者のユーザーを登録すると日報が表示されます</p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {dailyReports.map(report => (
              <li key={report.id}>
                <Link href={`/daily-reports/${report.id}`} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  {/* 日付 */}
                  <div className="flex-shrink-0 text-center w-14">
                    <p className="text-xs text-gray-400">{new Date(report.workDate).toLocaleDateString("ja-JP", { month: "short" })}</p>
                    <p className="text-2xl font-bold text-gray-800 leading-none">{new Date(report.workDate).getDate()}</p>
                    <p className="text-xs text-gray-400">{new Date(report.workDate).toLocaleDateString("ja-JP", { weekday: "short" })}</p>
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900 truncate">{report.project.name}</p>
                      <Badge variant={WEATHER_BADGE[report.weather]}>{WEATHER_LABELS[report.weather]}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm text-gray-500 flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-gray-100 text-xs font-semibold text-gray-600 flex-shrink-0">
                          {report.user.name.slice(0, 1)}
                        </span>
                        {report.user.name}
                      </p>
                      {report.user.subcontractorName && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100">
                          {report.user.subcontractorName}
                        </span>
                      )}
                    </div>
                    {report.summary && <p className="text-sm text-gray-400 mt-1 line-clamp-1">{report.summary}</p>}
                  </div>

                  <svg className="h-5 w-5 text-gray-300 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
