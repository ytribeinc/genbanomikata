"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useChat } from "@/hooks/useChat";

type ProjectStatus = "PLANNING" | "IN_PROGRESS" | "COMPLETED" | "PAUSED";
type MemberRole = "LEADER" | "MEMBER";
type UserRole = "ADMIN" | "MANAGER" | "WORKER";
type EstimateStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED";
type InvoiceStatus = "DRAFT" | "SENT" | "PARTIAL" | "PAID" | "OVERDUE";
type POStatus = "DRAFT" | "SENT" | "RECEIVED" | "CANCELLED";

interface User { id: string; name: string; email: string; avatarUrl: string | null; role: UserRole }
interface Member { projectId: string; userId: string; role: MemberRole; user: User }
interface Customer { id: string; name: string; phone: string | null; address: string | null; email: string | null }
interface Project {
  id: string; name: string; address: string | null; status: ProjectStatus;
  startDate: string | null; endDate: string | null; description: string | null;
  createdAt: string; customer: Customer | null; members: Member[];
}
interface DocItem { id: string; name: string; quantity: number; unitPrice: number; amount: number }
interface Estimate {
  id: string; estimateNo: string; title: string; status: EstimateStatus;
  issueDate: string; expiryDate: string | null; taxRate: number;
  customer: { id: string; name: string } | null; items: DocItem[];
}
interface Invoice {
  id: string; invoiceNo: string; title: string; status: InvoiceStatus;
  issueDate: string; dueDate: string | null; taxRate: number; paidAmount: number;
  customer: { id: string; name: string } | null; items: DocItem[];
}
interface PurchaseOrder {
  id: string; orderNo: string; vendorName: string; title: string; status: POStatus;
  issueDate: string; deliveryDate: string | null; taxRate: number; items: DocItem[];
}
interface BudgetItem { id?: string; category: string; budgetAmount: number; memo: string | null }
interface AttendanceSummary {
  user: { id: string; name: string; role: string; subcontractorName: string | null };
  workDays: number; totalMinutes: number;
}
interface DailyReport {
  id: string; workDate: string; summary: string | null; weather: string;
  user: { id: string; name: string };
}

const STATUS_LABELS: Record<ProjectStatus, string> = { PLANNING: "計画中", IN_PROGRESS: "進行中", COMPLETED: "完了", PAUSED: "停止中" };
const STATUS_BADGE: Record<ProjectStatus, "pending" | "active" | "completed" | "cancelled"> = { PLANNING: "pending", IN_PROGRESS: "active", COMPLETED: "completed", PAUSED: "cancelled" };
const MEMBER_ROLE_LABELS: Record<MemberRole, string> = { LEADER: "リーダー", MEMBER: "メンバー" };
const USER_ROLE_LABELS: Record<UserRole, string> = { ADMIN: "管理者", MANAGER: "マネージャー", WORKER: "作業員" };

const EST_STATUS: Record<EstimateStatus, { label: string; cls: string }> = {
  DRAFT:    { label: "下書き",   cls: "bg-gray-100 text-gray-600" },
  SENT:     { label: "送付済み", cls: "bg-blue-50 text-blue-700" },
  APPROVED: { label: "承認済み", cls: "bg-green-50 text-green-700" },
  REJECTED: { label: "却下",     cls: "bg-red-50 text-red-600" },
};
const INV_STATUS: Record<InvoiceStatus, { label: string; cls: string }> = {
  DRAFT:   { label: "下書き",   cls: "bg-gray-100 text-gray-600" },
  SENT:    { label: "請求済み", cls: "bg-blue-50 text-blue-700" },
  PARTIAL: { label: "一部入金", cls: "bg-yellow-50 text-yellow-700" },
  PAID:    { label: "入金済み", cls: "bg-green-50 text-green-700" },
  OVERDUE: { label: "期限超過", cls: "bg-red-50 text-red-600" },
};
const PO_STATUS: Record<POStatus, { label: string; cls: string }> = {
  DRAFT:     { label: "下書き",   cls: "bg-gray-100 text-gray-600" },
  SENT:      { label: "送付済み", cls: "bg-blue-50 text-blue-700" },
  RECEIVED:  { label: "受領済み", cls: "bg-green-50 text-green-700" },
  CANCELLED: { label: "キャンセル", cls: "bg-red-50 text-red-600" },
};
const WEATHER_LABELS: Record<string, string> = { SUNNY: "晴れ", CLOUDY: "曇り", RAINY: "雨", SNOWY: "雪" };

function calcTotal(items: DocItem[], taxRate: number) {
  const sub = items.reduce((s, i) => s + i.amount, 0);
  return sub * (1 + taxRate / 100);
}
function fmtYen(n: number) { return `¥${Math.round(n).toLocaleString()}`; }
function fmtDate(s: string) { return new Date(s).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" }); }
function fmtHM(min: number) { return `${Math.floor(min / 60)}h${min % 60 > 0 ? `${min % 60}m` : ""}`; }

type TabId = "overview" | "estimates" | "purchase-orders" | "invoices" | "budget" | "reports" | "attendance" | "photos" | "schedule" | "chat";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview",        label: "概要" },
  { id: "estimates",       label: "見積" },
  { id: "purchase-orders", label: "発注" },
  { id: "invoices",        label: "請求" },
  { id: "budget",          label: "予算" },
  { id: "reports",         label: "日報" },
  { id: "attendance",      label: "勤怠" },
  { id: "photos",          label: "写真" },
  { id: "schedule",        label: "工程" },
  { id: "chat",            label: "チャット" },
];

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const isManagerOrAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  const [project,    setProject]    = useState<Project | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [activeTab,  setActiveTab]  = useState<TabId>("overview");

  // tab data
  const [estimates,   setEstimates]   = useState<Estimate[] | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[] | null>(null);
  const [invoices,    setInvoices]    = useState<Invoice[] | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[] | null>(null);
  const [budgetEditing, setBudgetEditing] = useState(false);
  const [budgetDraft,  setBudgetDraft]  = useState<BudgetItem[]>([]);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [dailyReports, setDailyReports] = useState<DailyReport[] | null>(null);
  const [attendance,  setAttendance]  = useState<AttendanceSummary[] | null>(null);

  // chat
  const [chatRoomId,  setChatRoomId]  = useState<string | null>(null);
  const [chatInput,   setChatInput]   = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // member invite
  const [inviteEmail,   setInviteEmail]   = useState("");
  const [inviting,      setInviting]      = useState(false);
  const [inviteError,   setInviteError]   = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProject(data.project ?? null);
    } catch { setError("案件データの取得に失敗しました"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  // lazy-load tab data
  useEffect(() => {
    if (activeTab === "estimates" && estimates === null) {
      fetch(`/api/estimates?projectId=${id}`).then(r => r.json()).then(d => setEstimates(d.estimates ?? []));
    }
    if (activeTab === "purchase-orders" && purchaseOrders === null) {
      fetch(`/api/purchase-orders?projectId=${id}`).then(r => r.json()).then(d => setPurchaseOrders(d.orders ?? []));
    }
    if (activeTab === "invoices" && invoices === null) {
      fetch(`/api/invoices?projectId=${id}`).then(r => r.json()).then(d => setInvoices(d.invoices ?? []));
    }
    if (activeTab === "budget" && budgetItems === null) {
      fetch(`/api/budgets/${id}`).then(r => r.json()).then(d => setBudgetItems(d.budget?.items ?? []));
    }
    if (activeTab === "reports" && dailyReports === null) {
      fetch(`/api/daily-reports?projectId=${id}`).then(r => r.json()).then(d => setDailyReports(d.dailyReports ?? []));
    }
    if (activeTab === "attendance" && attendance === null) {
      fetch(`/api/attendance?projectId=${id}`).then(r => r.json()).then(d => setAttendance(d.summary ?? []));
    }
    if (activeTab === "chat" && id && !chatRoomId) {
      fetch(`/api/rooms?projectId=${id}`).then(r => r.json()).then(d => { if (d.room) setChatRoomId(d.room.id); });
    }
  }, [activeTab, id, estimates, purchaseOrders, invoices, budgetItems, dailyReports, attendance, chatRoomId]);

  const { messages: chatMessages, sendMessage, isConnected } = useChat(chatRoomId ?? "");
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  function handleChatSend() {
    if (!chatInput.trim()) return;
    sendMessage(chatInput.trim()); setChatInput("");
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true); setInviteError(null); setInviteSuccess(null);
    try {
      const res = await fetch(`/api/projects/${id}/members`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const d = await res.json();
      if (!res.ok) { setInviteError(d.error ?? "追加に失敗しました"); return; }
      setInviteSuccess(`${d.member.user.name} を追加しました`);
      setInviteEmail(""); fetchProject();
    } catch { setInviteError("サーバーエラーが発生しました"); }
    finally { setInviting(false); }
  }

  async function handleRemoveMember(userId: string, name: string) {
    if (!confirm(`${name} をメンバーから外しますか？`)) return;
    try {
      await fetch(`/api/projects/${id}/members`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      fetchProject();
    } catch { alert("削除に失敗しました"); }
  }

  function startBudgetEdit() {
    setBudgetDraft(budgetItems ? budgetItems.map(i => ({ ...i })) : []);
    setBudgetEditing(true);
  }
  function addBudgetRow() {
    setBudgetDraft(d => [...d, { category: "", budgetAmount: 0, memo: null }]);
  }
  async function saveBudget() {
    setBudgetSaving(true);
    try {
      const res = await fetch(`/api/budgets/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: budgetDraft }),
      });
      const d = await res.json();
      setBudgetItems(d.budget?.items ?? budgetDraft);
      setBudgetEditing(false);
    } catch { alert("保存に失敗しました"); }
    finally { setBudgetSaving(false); }
  }

  if (loading) return <div className="py-16"><LoadingSpinner label="案件データを読み込み中..." /></div>;
  if (error || !project) return (
    <div className="space-y-4">
      <Link href="/projects"><Button variant="ghost" size="sm">← 案件一覧に戻る</Button></Link>
      <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error ?? "案件が見つかりません"}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/projects" className="hover:text-blue-600 transition-colors">案件一覧</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium truncate">{project.name}</span>
      </div>

      {/* ページタイトル */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <Badge variant={STATUS_BADGE[project.status]}>{STATUS_LABELS[project.status]}</Badge>
          </div>
          {project.address && <p className="mt-1 text-sm text-gray-500">{project.address}</p>}
        </div>
        <Link href={`/daily-reports/new?projectId=${project.id}`}>
          <Button variant="primary" size="md">日報を作成</Button>
        </Link>
      </div>

      {/* タブ */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={[
                "px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
              ].join(" ")}
            >{tab.label}</button>
          ))}
        </nav>
      </div>

      {/* ── 概要 ── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card padding="md" shadow="sm">
              <h2 className="text-base font-semibold text-gray-900 mb-4">案件情報</h2>
              <dl className="space-y-3">
                <div className="flex gap-4">
                  <dt className="text-sm text-gray-500 w-24 flex-shrink-0">ステータス</dt>
                  <dd><Badge variant={STATUS_BADGE[project.status]}>{STATUS_LABELS[project.status]}</Badge></dd>
                </div>
                {project.address && (
                  <div className="flex gap-4">
                    <dt className="text-sm text-gray-500 w-24 flex-shrink-0">現場住所</dt>
                    <dd className="text-sm text-gray-900">{project.address}</dd>
                  </div>
                )}
                {(project.startDate || project.endDate) && (
                  <div className="flex gap-4">
                    <dt className="text-sm text-gray-500 w-24 flex-shrink-0">工期</dt>
                    <dd className="text-sm text-gray-900">
                      {project.startDate ? new Date(project.startDate).toLocaleDateString("ja-JP") : "—"}
                      {" 〜 "}
                      {project.endDate ? new Date(project.endDate).toLocaleDateString("ja-JP") : "—"}
                    </dd>
                  </div>
                )}
                {project.description && (
                  <div className="flex gap-4">
                    <dt className="text-sm text-gray-500 w-24 flex-shrink-0">説明</dt>
                    <dd className="text-sm text-gray-900 whitespace-pre-wrap">{project.description}</dd>
                  </div>
                )}
                <div className="flex gap-4">
                  <dt className="text-sm text-gray-500 w-24 flex-shrink-0">作成日</dt>
                  <dd className="text-sm text-gray-900">{new Date(project.createdAt).toLocaleDateString("ja-JP")}</dd>
                </div>
              </dl>
            </Card>
            {project.customer && (
              <Card padding="md" shadow="sm">
                <h2 className="text-base font-semibold text-gray-900 mb-4">顧客情報</h2>
                <dl className="space-y-3">
                  <div className="flex gap-4">
                    <dt className="text-sm text-gray-500 w-24 flex-shrink-0">顧客名</dt>
                    <dd className="text-sm font-medium text-gray-900">{project.customer.name}</dd>
                  </div>
                  {project.customer.phone && (
                    <div className="flex gap-4">
                      <dt className="text-sm text-gray-500 w-24 flex-shrink-0">電話番号</dt>
                      <dd className="text-sm text-gray-900">{project.customer.phone}</dd>
                    </div>
                  )}
                  {project.customer.email && (
                    <div className="flex gap-4">
                      <dt className="text-sm text-gray-500 w-24 flex-shrink-0">メール</dt>
                      <dd className="text-sm text-gray-900">{project.customer.email}</dd>
                    </div>
                  )}
                  {project.customer.address && (
                    <div className="flex gap-4">
                      <dt className="text-sm text-gray-500 w-24 flex-shrink-0">住所</dt>
                      <dd className="text-sm text-gray-900">{project.customer.address}</dd>
                    </div>
                  )}
                </dl>
              </Card>
            )}
          </div>
          <div>
            <Card padding="md" shadow="sm">
              <h2 className="text-base font-semibold text-gray-900 mb-4">メンバー ({project.members.length}名)</h2>
              {project.members.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">メンバーが登録されていません</p>
              ) : (
                <ul className="space-y-3 mb-4">
                  {project.members.map(member => (
                    <li key={member.userId} className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-700 flex-shrink-0">
                        {member.user.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{member.user.name}</p>
                        <p className="text-xs text-gray-400">{MEMBER_ROLE_LABELS[member.role]} · {USER_ROLE_LABELS[member.user.role]}</p>
                      </div>
                      {isManagerOrAdmin && (
                        <button onClick={() => handleRemoveMember(member.userId, member.user.name)}
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors">外す</button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {isManagerOrAdmin && (
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <p className="text-xs font-medium text-gray-600">メールアドレスでメンバーを追加</p>
                  <p className="text-xs text-gray-400">下請け業者も登録済みメールで追加できます</p>
                  <div className="flex gap-2">
                    <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                      placeholder="worker@example.com" onKeyDown={e => e.key === "Enter" && handleInvite()} />
                    <Button type="button" variant="primary" size="sm" loading={inviting} onClick={handleInvite}>追加</Button>
                  </div>
                  {inviteError   && <p className="text-xs text-red-600">{inviteError}</p>}
                  {inviteSuccess && <p className="text-xs text-green-600">{inviteSuccess}</p>}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ── 見積 ── */}
      {activeTab === "estimates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{estimates === null ? "..." : `${estimates.length} 件`}</p>
            <Link href={`/estimates/new?projectId=${id}`}>
              <Button variant="primary" size="sm">+ 見積を作成</Button>
            </Link>
          </div>
          <Card padding="none" shadow="sm">
            {estimates === null ? (
              <div className="py-12"><LoadingSpinner label="読み込み中..." /></div>
            ) : estimates.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                <p>この案件の見積はまだありません</p>
                <div className="mt-3"><Link href={`/estimates/new?projectId=${id}`}><Button variant="primary" size="sm">見積を作成</Button></Link></div>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {estimates.map(e => {
                  const total = calcTotal(e.items, e.taxRate);
                  const st = EST_STATUS[e.status];
                  return (
                    <li key={e.id}>
                      <Link href={`/estimates/${e.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-400 font-mono">{e.estimateNo}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">{e.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">発行日: {fmtDate(e.issueDate)}{e.expiryDate ? ` / 有効期限: ${fmtDate(e.expiryDate)}` : ""}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-gray-900">{fmtYen(total)}</p>
                          <p className="text-xs text-gray-400">税込</p>
                        </div>
                        <svg className="h-4 w-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* ── 発注 ── */}
      {activeTab === "purchase-orders" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{purchaseOrders === null ? "..." : `${purchaseOrders.length} 件`}</p>
            <Link href={`/purchase-orders/new?projectId=${id}`}>
              <Button variant="primary" size="sm">+ 発注書を作成</Button>
            </Link>
          </div>
          <Card padding="none" shadow="sm">
            {purchaseOrders === null ? (
              <div className="py-12"><LoadingSpinner label="読み込み中..." /></div>
            ) : purchaseOrders.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                <p>この案件の発注書はまだありません</p>
                <div className="mt-3"><Link href={`/purchase-orders/new?projectId=${id}`}><Button variant="primary" size="sm">発注書を作成</Button></Link></div>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {purchaseOrders.map(po => {
                  const total = calcTotal(po.items, po.taxRate);
                  const st = PO_STATUS[po.status];
                  return (
                    <li key={po.id}>
                      <Link href={`/purchase-orders/${po.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-400 font-mono">{po.orderNo}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">{po.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            発注先: {po.vendorName} / 発行日: {fmtDate(po.issueDate)}
                            {po.deliveryDate ? ` / 納期: ${fmtDate(po.deliveryDate)}` : ""}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-gray-900">{fmtYen(total)}</p>
                          <p className="text-xs text-gray-400">税込</p>
                        </div>
                        <svg className="h-4 w-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* ── 請求 ── */}
      {activeTab === "invoices" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{invoices === null ? "..." : `${invoices.length} 件`}</p>
            <Link href={`/invoices/new?projectId=${id}`}>
              <Button variant="primary" size="sm">+ 請求書を作成</Button>
            </Link>
          </div>
          <Card padding="none" shadow="sm">
            {invoices === null ? (
              <div className="py-12"><LoadingSpinner label="読み込み中..." /></div>
            ) : invoices.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                <p>この案件の請求書はまだありません</p>
                <div className="mt-3"><Link href={`/invoices/new?projectId=${id}`}><Button variant="primary" size="sm">請求書を作成</Button></Link></div>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {invoices.map(inv => {
                  const total = calcTotal(inv.items, inv.taxRate);
                  const st = INV_STATUS[inv.status];
                  return (
                    <li key={inv.id}>
                      <Link href={`/invoices/${inv.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-400 font-mono">{inv.invoiceNo}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">{inv.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            発行日: {fmtDate(inv.issueDate)}
                            {inv.dueDate ? ` / 支払期限: ${fmtDate(inv.dueDate)}` : ""}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-gray-900">{fmtYen(total)}</p>
                          {inv.paidAmount > 0 && <p className="text-xs text-green-600">入金 {fmtYen(inv.paidAmount)}</p>}
                        </div>
                        <svg className="h-4 w-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* ── 予算 ── */}
      {activeTab === "budget" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {budgetItems !== null && !budgetEditing && `合計 ${fmtYen(budgetItems.reduce((s, i) => s + i.budgetAmount, 0))}`}
            </p>
            {!budgetEditing && (
              <Button variant="secondary" size="sm" onClick={startBudgetEdit}>
                {budgetItems && budgetItems.length > 0 ? "編集" : "予算を登録"}
              </Button>
            )}
          </div>
          <Card padding="md" shadow="sm">
            {budgetItems === null ? (
              <div className="py-12"><LoadingSpinner label="読み込み中..." /></div>
            ) : budgetEditing ? (
              <div className="space-y-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="pb-2 text-left font-medium">カテゴリ</th>
                      <th className="pb-2 text-right font-medium w-36">予算金額</th>
                      <th className="pb-2 text-left font-medium pl-3">メモ</th>
                      <th className="pb-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {budgetDraft.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 pr-2">
                          <input className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={item.category} onChange={e => setBudgetDraft(d => d.map((x, i) => i === idx ? { ...x, category: e.target.value } : x))} placeholder="材料費" />
                        </td>
                        <td className="py-1.5 px-2">
                          <input className="w-full rounded border border-gray-200 px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            type="number" value={item.budgetAmount}
                            onChange={e => setBudgetDraft(d => d.map((x, i) => i === idx ? { ...x, budgetAmount: Number(e.target.value) } : x))} />
                        </td>
                        <td className="py-1.5 pl-2">
                          <input className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={item.memo ?? ""} onChange={e => setBudgetDraft(d => d.map((x, i) => i === idx ? { ...x, memo: e.target.value || null } : x))} placeholder="備考" />
                        </td>
                        <td className="py-1.5 pl-2">
                          <button onClick={() => setBudgetDraft(d => d.filter((_, i) => i !== idx))}
                            className="text-gray-300 hover:text-red-400 transition-colors">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={addBudgetRow} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  行を追加
                </button>
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <Button variant="primary" size="sm" loading={budgetSaving} onClick={saveBudget}>保存</Button>
                  <Button variant="ghost" size="sm" onClick={() => setBudgetEditing(false)}>キャンセル</Button>
                </div>
              </div>
            ) : budgetItems.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                <p>予算がまだ登録されていません</p>
                <div className="mt-3"><Button variant="primary" size="sm" onClick={startBudgetEdit}>予算を登録</Button></div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="pb-2 text-left font-medium">カテゴリ</th>
                    <th className="pb-2 text-right font-medium">予算金額</th>
                    <th className="pb-2 text-left font-medium pl-4">メモ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {budgetItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-medium text-gray-900">{item.category}</td>
                      <td className="py-2 text-right text-gray-900">{fmtYen(item.budgetAmount)}</td>
                      <td className="py-2 pl-4 text-gray-400 text-xs">{item.memo ?? ""}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-200">
                    <td className="pt-2 text-sm font-semibold text-gray-900">合計</td>
                    <td className="pt-2 text-right text-sm font-semibold text-gray-900">{fmtYen(budgetItems.reduce((s, i) => s + i.budgetAmount, 0))}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* ── 日報 ── */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{dailyReports === null ? "..." : `${dailyReports.length} 件`}</p>
            <Link href={`/daily-reports/new?projectId=${id}`}>
              <Button variant="primary" size="sm">+ 日報を作成</Button>
            </Link>
          </div>
          <Card padding="none" shadow="sm">
            {dailyReports === null ? (
              <div className="py-12"><LoadingSpinner label="読み込み中..." /></div>
            ) : dailyReports.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                <p>この案件の日報はまだありません</p>
                <div className="mt-3"><Link href={`/daily-reports/new?projectId=${id}`}><Button variant="primary" size="sm">日報を作成</Button></Link></div>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {dailyReports.map(r => (
                  <li key={r.id}>
                    <Link href={`/daily-reports/${r.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex-shrink-0 text-center w-12">
                        <p className="text-xs text-gray-400">{new Date(r.workDate).toLocaleDateString("ja-JP", { month: "short" })}</p>
                        <p className="text-2xl font-bold text-gray-800 leading-none">{new Date(r.workDate).getDate()}</p>
                        <p className="text-xs text-gray-400">{new Date(r.workDate).toLocaleDateString("ja-JP", { weekday: "short" })}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{r.user.name} <span className="text-xs text-gray-400 font-normal ml-1">{WEATHER_LABELS[r.weather] ?? r.weather}</span></p>
                        {r.summary && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{r.summary}</p>}
                      </div>
                      <svg className="h-4 w-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* ── 勤怠 ── */}
      {activeTab === "attendance" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">日報に紐づく作業時間の集計です</p>
          <Card padding="none" shadow="sm">
            {attendance === null ? (
              <div className="py-12"><LoadingSpinner label="読み込み中..." /></div>
            ) : attendance.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                <p>作業ログがまだ記録されていません</p>
                <p className="mt-1 text-xs">日報作成時に作業時間を記録してください</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-5 py-3 text-left font-medium">氏名</th>
                    <th className="px-5 py-3 text-left font-medium hidden sm:table-cell">区分</th>
                    <th className="px-5 py-3 text-right font-medium">出勤日数</th>
                    <th className="px-5 py-3 text-right font-medium">総労働時間</th>
                    <th className="px-5 py-3 text-right font-medium hidden sm:table-cell">日平均</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {attendance.map(a => (
                    <tr key={a.user.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0">
                            {a.user.name.slice(0, 1)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{a.user.name}</p>
                            {a.user.subcontractorName && (
                              <p className="text-xs text-violet-600">{a.user.subcontractorName}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${a.user.subcontractorName ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}>
                          {a.user.subcontractorName ? "下請け" : "自社"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900">{a.workDays}日</td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900">{fmtHM(a.totalMinutes)}</td>
                      <td className="px-5 py-3 text-right text-gray-500 hidden sm:table-cell">
                        {a.workDays > 0 ? fmtHM(Math.round(a.totalMinutes / a.workDays)) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* ── 写真 ── */}
      {activeTab === "photos" && (
        <Card padding="md" shadow="sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">写真</h2>
          <p className="text-sm text-gray-400 text-center py-8">写真機能は別途実装予定です</p>
        </Card>
      )}

      {/* ── 工程 ── */}
      {activeTab === "schedule" && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <Link href={`/schedules/new?projectId=${id}`}>
              <Button variant="primary" size="sm">+ 工程表を作成</Button>
            </Link>
          </div>
          <Card padding="md" shadow="sm">
            <p className="text-sm text-gray-400 text-center py-8">工程表機能は別途実装予定です</p>
          </Card>
        </div>
      )}

      {/* ── チャット ── */}
      {activeTab === "chat" && (
        <div className="flex flex-col h-[calc(100vh-18rem)] rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <p className="text-sm font-semibold text-gray-900">{project.name} のチャット</p>
            <span className={["text-xs px-2 py-0.5 rounded-full", isConnected ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"].join(" ")}>
              {isConnected ? "接続中" : "未接続"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {!chatRoomId ? (
              <div className="flex justify-center py-8"><LoadingSpinner label="チャット読み込み中..." /></div>
            ) : chatMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">まだメッセージがありません</div>
            ) : (
              chatMessages.map(msg => {
                const isMine = msg.sender.id === session?.user?.id;
                return (
                  <div key={msg.id} className={["flex gap-2", isMine ? "flex-row-reverse" : "flex-row"].join(" ")}>
                    {!isMine && (
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0 mt-0.5">
                        {msg.sender.name.slice(0, 1)}
                      </div>
                    )}
                    <div className={["max-w-xs lg:max-w-md flex flex-col gap-0.5", isMine ? "items-end" : "items-start"].join(" ")}>
                      {!isMine && <p className="text-xs text-gray-500 px-1">{msg.sender.name}</p>}
                      <div className={["px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words",
                        isMine ? "bg-blue-600 text-white rounded-tr-sm" : "bg-gray-100 text-gray-900 rounded-tl-sm"].join(" ")}>
                        {msg.content}
                      </div>
                      <p className="text-xs text-gray-400 px-1">
                        {new Date(msg.createdAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>
          <div className="border-t border-gray-100 px-4 py-3 flex-shrink-0">
            <div className="flex gap-2">
              <textarea
                className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px] max-h-28"
                rows={1} value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                placeholder="メッセージを入力… (Enter で送信)" disabled={!chatRoomId}
              />
              <button onClick={handleChatSend} disabled={!chatInput.trim() || !chatRoomId}
                className="flex-shrink-0 h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <svg className="h-5 w-5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
