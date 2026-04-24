export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// ---- モックデータ ----
const summaryCards = [
  {
    label: "進行中の案件",
    value: "12",
    sub: "今月 +3",
    color: "text-blue-600",
    bg: "bg-blue-50",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    label: "今日の日報提出",
    value: "8 / 10",
    sub: "2名未提出",
    color: "text-amber-600",
    bg: "bg-amber-50",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: "顧客数",
    value: "34",
    sub: "今月 +1",
    color: "text-green-600",
    bg: "bg-green-50",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: "今月の写真枚数",
    value: "152",
    sub: "先月比 +24",
    color: "text-purple-600",
    bg: "bg-purple-50",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

const recentProjects = [
  { id: "1", name: "〇〇マンション 外壁改修", customer: "田中建設株式会社", status: "active" as const, updatedAt: "2026-04-23" },
  { id: "2", name: "△△ビル 内装リフォーム", customer: "山田工務店", status: "active" as const, updatedAt: "2026-04-22" },
  { id: "3", name: "□□住宅 屋根補修", customer: "鈴木建築", status: "pending" as const, updatedAt: "2026-04-21" },
  { id: "4", name: "◇◇工場 電気設備更新", customer: "佐藤電気工業", status: "completed" as const, updatedAt: "2026-04-20" },
  { id: "5", name: "★★公民館 改修工事", customer: "高橋建設", status: "active" as const, updatedAt: "2026-04-19" },
];

const statusLabel: Record<string, string> = {
  active: "進行中",
  pending: "準備中",
  completed: "完了",
  cancelled: "中止",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role === "WORKER") {
    redirect("/daily-reports");
  }

  return (
    <div className="space-y-8">
      {/* ページタイトル */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="mt-1 text-gray-500 text-sm">
          おはようございます、{session?.user.name ?? "ユーザー"} さん
        </p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.label} padding="md" shadow="sm">
            <div className="flex items-center gap-4">
              <div className={["rounded-xl p-3 flex-shrink-0", card.bg].join(" ")}>
                <span className={card.color}>{card.icon}</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 最近の案件一覧 */}
      <Card padding="none" shadow="sm">
        <CardHeader className="px-5 pt-5 pb-4">
          <CardTitle>最近の案件</CardTitle>
        </CardHeader>

        <div className="divide-y divide-gray-100">
          {recentProjects.map((project) => (
            <div
              key={project.id}
              className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{project.name}</p>
                <p className="text-sm text-gray-500 truncate">{project.customer}</p>
              </div>
              <div className="ml-4 flex items-center gap-4 flex-shrink-0">
                <span className="text-xs text-gray-400 hidden sm:block">
                  {project.updatedAt}
                </span>
                <Badge variant={project.status}>
                  {statusLabel[project.status]}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-gray-100">
          <a
            href="/projects"
            className="text-sm text-blue-600 font-medium hover:underline"
          >
            すべての案件を見る →
          </a>
        </div>
      </Card>
    </div>
  );
}
