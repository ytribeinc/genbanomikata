"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

// ─── 型定義 ───────────────────────────────────────────────────────────────────
interface TemplateSection { name: string; placeholder: string }
interface EstimateItem    { name: string; unit: string; unitPrice: number }
interface ScheduleTask    { name: string; durationDays: number }

interface Template {
  id: string;
  name: string;
  type: string;
  content: Record<string, any>;
  createdAt: string;
}

// ─── タブ定義 ─────────────────────────────────────────────────────────────────
const TABS = [
  { value: "REPORT",         label: "日報",   color: "blue"   },
  { value: "ESTIMATE",       label: "見積書", color: "green"  },
  { value: "SCHEDULE",       label: "工程表", color: "orange" },
  { value: "PURCHASE_ORDER", label: "発注書", color: "purple" },
  { value: "INVOICE",        label: "請求書", color: "red"    },
] as const;

type TabValue = typeof TABS[number]["value"];

// ─── フォーム初期値 ───────────────────────────────────────────────────────────
const DEFAULT_FORM = {
  name: "",
  // 日報
  sections:     [{ name: "", placeholder: "" }] as TemplateSection[],
  defaultStart: "08:00",
  defaultEnd:   "17:00",
  defaultBreak: "60",
  reportNotes:  "",
  // 見積書
  estimateNotes:   "",
  paymentTerms:    "",
  defaultTaxRate:  "10",
  validityDays:    "30",
  estimateItems:   [] as EstimateItem[],
  // 工程表
  scheduleTasks:   [] as ScheduleTask[],
  excludeWeekends: false,
  // 発注書
  poNotes:         "",
  poPaymentTerms:  "",
  deliveryNotes:   "",
  // 請求書
  invoiceNotes:    "",
  bankInfo:        "",
  dueDays:         "30",
  invoicePaymentTerms: "",
};

export default function TemplatesPage() {
  const { data: session } = useSession();
  const isManagerOrAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  const [tab,       setTab]       = useState<TabValue>("REPORT");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form,      setForm]      = useState({ ...DEFAULT_FORM });

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/templates");
      if (res.ok) { const d = await res.json(); setTemplates(d.templates ?? []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const tabTemplates = templates.filter(t => t.type === tab);

  function setF(key: keyof typeof DEFAULT_FORM, value: any) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...DEFAULT_FORM });
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(t: Template) {
    setEditingId(t.id);
    const c = t.content;
    setForm({
      ...DEFAULT_FORM,
      name:                t.name,
      sections:            c.sections?.length      ? c.sections            : [{ name: "", placeholder: "" }],
      defaultStart:        c.defaultWorkTime?.start ?? "08:00",
      defaultEnd:          c.defaultWorkTime?.end   ?? "17:00",
      defaultBreak:        String(c.defaultWorkTime?.break ?? 60),
      reportNotes:         c.notes                 ?? "",
      estimateNotes:       c.estimateNotes         ?? "",
      paymentTerms:        c.paymentTerms          ?? "",
      defaultTaxRate:      String(c.defaultTaxRate ?? 10),
      validityDays:        String(c.validityDays   ?? 30),
      estimateItems:       c.estimateItems         ?? [],
      scheduleTasks:       c.scheduleTasks         ?? [],
      excludeWeekends:     c.excludeWeekends       ?? false,
      poNotes:             c.poNotes               ?? "",
      poPaymentTerms:      c.poPaymentTerms        ?? "",
      deliveryNotes:       c.deliveryNotes         ?? "",
      invoiceNotes:        c.invoiceNotes          ?? "",
      bankInfo:            c.bankInfo              ?? "",
      dueDays:             String(c.dueDays        ?? 30),
      invoicePaymentTerms: c.invoicePaymentTerms   ?? "",
    });
    setFormError(null);
    setShowForm(true);
  }

  function buildContent(): Record<string, any> {
    switch (tab) {
      case "REPORT":
        return {
          sections: form.sections.filter(s => s.name.trim()),
          defaultWorkTime: { start: form.defaultStart, end: form.defaultEnd, break: parseInt(form.defaultBreak || "60") },
          notes: form.reportNotes.trim() || undefined,
        };
      case "ESTIMATE":
        return {
          estimateNotes:  form.estimateNotes.trim()  || undefined,
          paymentTerms:   form.paymentTerms.trim()   || undefined,
          defaultTaxRate: Number(form.defaultTaxRate),
          validityDays:   Number(form.validityDays),
          estimateItems:  form.estimateItems.filter(i => i.name.trim()),
        };
      case "SCHEDULE":
        return {
          scheduleTasks:  form.scheduleTasks.filter(t => t.name.trim()),
          excludeWeekends: form.excludeWeekends,
        };
      case "PURCHASE_ORDER":
        return {
          poNotes:        form.poNotes.trim()        || undefined,
          poPaymentTerms: form.poPaymentTerms.trim() || undefined,
          deliveryNotes:  form.deliveryNotes.trim()  || undefined,
        };
      case "INVOICE":
        return {
          invoiceNotes:        form.invoiceNotes.trim()        || undefined,
          bankInfo:            form.bankInfo.trim()            || undefined,
          dueDays:             Number(form.dueDays),
          invoicePaymentTerms: form.invoicePaymentTerms.trim() || undefined,
        };
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError("テンプレート名を入力してください"); return; }
    setFormError(null);
    setSaving(true);
    try {
      const url    = editingId ? `/api/templates/${editingId}` : "/api/templates";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), type: tab, content: buildContent() }),
      });
      if (!res.ok) { const d = await res.json(); setFormError(d.error ?? "保存に失敗しました"); return; }
      setShowForm(false);
      fetchTemplates();
    } catch { setFormError("サーバーエラーが発生しました"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("このテンプレートを削除しますか？")) return;
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  if (loading) return <div className="py-16"><LoadingSpinner label="読み込み中..." /></div>;

  const tabColor: Record<TabValue, string> = {
    REPORT:         "blue",
    ESTIMATE:       "emerald",
    SCHEDULE:       "orange",
    PURCHASE_ORDER: "violet",
    INVOICE:        "rose",
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/settings" className="hover:text-blue-600">設定</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">書類テンプレート</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">書類テンプレート</h1>
          <p className="mt-1 text-sm text-gray-500">各書類のフォーマットを登録・管理します</p>
        </div>
        {isManagerOrAdmin && !showForm && (
          <Button variant="primary" size="md" onClick={openCreate}>+ テンプレートを追加</Button>
        )}
      </div>

      {/* タブ */}
      <div className="flex gap-1.5 flex-wrap border-b border-gray-200 pb-0">
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => { setTab(t.value); setShowForm(false); }}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              tab === t.value
                ? "border-blue-600 text-blue-600 bg-blue-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            {t.label}
            {templates.filter(x => x.type === t.value).length > 0 && (
              <span className="ml-1.5 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                {templates.filter(x => x.type === t.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* フォーム */}
      {showForm && (
        <Card padding="md" shadow="sm">
          <h2 className="text-base font-semibold text-gray-900 mb-5">
            {editingId ? "テンプレートを編集" : `${TABS.find(t => t.value === tab)?.label}テンプレートを作成`}
          </h2>
          <div className="space-y-5">
            <Input label="テンプレート名" required placeholder="例：標準フォーマット" value={form.name} onChange={e => setF("name", e.target.value)} />

            {tab === "REPORT" && <ReportFields form={form} setF={setF} />}
            {tab === "ESTIMATE" && <EstimateFields form={form} setF={setF} />}
            {tab === "SCHEDULE" && <ScheduleFields form={form} setF={setF} />}
            {tab === "PURCHASE_ORDER" && <PurchaseOrderFields form={form} setF={setF} />}
            {tab === "INVOICE" && <InvoiceFields form={form} setF={setF} />}

            {formError && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{formError}</div>}
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <Button variant="ghost" size="md" onClick={() => setShowForm(false)}>キャンセル</Button>
              <Button variant="primary" size="md" loading={saving} onClick={handleSave}>{editingId ? "保存" : "作成"}</Button>
            </div>
          </div>
        </Card>
      )}

      {/* 一覧 */}
      {tabTemplates.length === 0 && !showForm ? (
        <Card padding="lg" shadow="sm">
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-3 text-sm font-medium text-gray-900">{TABS.find(t => t.value === tab)?.label}テンプレートがありません</p>
            <p className="mt-1 text-sm text-gray-500">フォーマットを登録しておくと作成時の初期値として使えます</p>
            {isManagerOrAdmin && (
              <div className="mt-4"><Button variant="primary" size="sm" onClick={openCreate}>テンプレートを追加</Button></div>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {tabTemplates.map(t => (
            <Card key={t.id} padding="md" shadow="sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-gray-900">{t.name}</p>
                  <TemplateSummary template={t} />
                </div>
                {isManagerOrAdmin && (
                  <div className="flex gap-3 flex-shrink-0">
                    <button onClick={() => openEdit(t)} className="text-sm text-gray-500 hover:text-blue-600">編集</button>
                    <button onClick={() => handleDelete(t.id)} className="text-sm text-gray-500 hover:text-red-600">削除</button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 日報フォームフィールド ───────────────────────────────────────────────────
function ReportFields({ form, setF }: { form: typeof DEFAULT_FORM; setF: (k: any, v: any) => void }) {
  return (
    <>
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">デフォルト作業時間</p>
        <div className="grid grid-cols-3 gap-3">
          <Input label="開始" type="time" value={form.defaultStart} onChange={e => setF("defaultStart", e.target.value)} />
          <Input label="終了" type="time" value={form.defaultEnd}   onChange={e => setF("defaultEnd",   e.target.value)} />
          <Input label="休憩（分）" type="number" min="0" step="5" value={form.defaultBreak} onChange={e => setF("defaultBreak", e.target.value)} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">報告項目</p>
          <button type="button" onClick={() => setF("sections", [...form.sections, { name: "", placeholder: "" }])} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ 追加</button>
        </div>
        <div className="space-y-2">
          {form.sections.map((sec, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <Input label={idx === 0 ? "項目名" : ""} value={sec.name} onChange={e => { const s = [...form.sections]; s[idx] = { ...s[idx], name: e.target.value }; setF("sections", s); }} placeholder="例：本日の作業内容" />
                <Input label={idx === 0 ? "入力ガイド" : ""} value={sec.placeholder} onChange={e => { const s = [...form.sections]; s[idx] = { ...s[idx], placeholder: e.target.value }; setF("sections", s); }} placeholder="例：実施した作業を記載..." />
              </div>
              {form.sections.length > 1 && (
                <button type="button" onClick={() => setF("sections", form.sections.filter((_, i) => i !== idx))} className={`text-gray-400 hover:text-red-500 text-lg leading-none ${idx === 0 ? "mt-6" : ""}`}>×</button>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">備考・注意事項</label>
        <textarea className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={2} value={form.reportNotes} onChange={e => setF("reportNotes", e.target.value)} placeholder="日報作成時のルールや注意事項..." />
      </div>
    </>
  );
}

// ─── 見積書フォームフィールド ─────────────────────────────────────────────────
function EstimateFields({ form, setF }: { form: typeof DEFAULT_FORM; setF: (k: any, v: any) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Input label="デフォルト消費税率（%）" type="number" min="0" max="30" value={form.defaultTaxRate} onChange={e => setF("defaultTaxRate", e.target.value)} />
        <Input label="有効期限（日数）" type="number" min="1" value={form.validityDays} onChange={e => setF("validityDays", e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">支払条件</label>
        <input className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.paymentTerms} onChange={e => setF("paymentTerms", e.target.value)} placeholder="例：工事完了後30日以内" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">デフォルト備考・特記事項</label>
        <textarea className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={3} value={form.estimateNotes} onChange={e => setF("estimateNotes", e.target.value)} placeholder="例：本見積は消費税を含みます。材料費の変動により金額が変わる場合があります。" />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">定型明細項目</p>
          <button type="button" onClick={() => setF("estimateItems", [...form.estimateItems, { name: "", unit: "式", unitPrice: 0 }])} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ 追加</button>
        </div>
        {form.estimateItems.length === 0 && <p className="text-xs text-gray-400">追加しておくと見積作成時に自動入力できます</p>}
        <div className="space-y-2">
          {form.estimateItems.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="工事項目名" value={item.name} onChange={e => { const items = [...form.estimateItems]; items[idx] = { ...items[idx], name: e.target.value }; setF("estimateItems", items); }} />
              <input className="w-14 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="単位" value={item.unit} onChange={e => { const items = [...form.estimateItems]; items[idx] = { ...items[idx], unit: e.target.value }; setF("estimateItems", items); }} />
              <input type="number" className="w-28 rounded border border-gray-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="単価" value={item.unitPrice} onChange={e => { const items = [...form.estimateItems]; items[idx] = { ...items[idx], unitPrice: Number(e.target.value) }; setF("estimateItems", items); }} />
              <button type="button" onClick={() => setF("estimateItems", form.estimateItems.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 text-lg">×</button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── 工程表フォームフィールド ─────────────────────────────────────────────────
function ScheduleFields({ form, setF }: { form: typeof DEFAULT_FORM; setF: (k: any, v: any) => void }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="excludeWeekends" checked={form.excludeWeekends} onChange={e => setF("excludeWeekends", e.target.checked)} className="rounded" />
        <label htmlFor="excludeWeekends" className="text-sm text-gray-700">土日を除いて工期計算する</label>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">標準工程タスク</p>
          <button type="button" onClick={() => setF("scheduleTasks", [...form.scheduleTasks, { name: "", durationDays: 1 }])} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ 追加</button>
        </div>
        {form.scheduleTasks.length === 0 && <p className="text-xs text-gray-400">標準的な工程を登録しておくと工程表作成時に自動入力できます</p>}
        <div className="space-y-2">
          {form.scheduleTasks.map((task, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="工程名（例：基礎工事）" value={task.name} onChange={e => { const tasks = [...form.scheduleTasks]; tasks[idx] = { ...tasks[idx], name: e.target.value }; setF("scheduleTasks", tasks); }} />
              <div className="flex items-center gap-1">
                <input type="number" min="1" className="w-16 rounded border border-gray-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500" value={task.durationDays} onChange={e => { const tasks = [...form.scheduleTasks]; tasks[idx] = { ...tasks[idx], durationDays: Number(e.target.value) }; setF("scheduleTasks", tasks); }} />
                <span className="text-xs text-gray-500">日</span>
              </div>
              <button type="button" onClick={() => setF("scheduleTasks", form.scheduleTasks.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 text-lg">×</button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── 発注書フォームフィールド ─────────────────────────────────────────────────
function PurchaseOrderFields({ form, setF }: { form: typeof DEFAULT_FORM; setF: (k: any, v: any) => void }) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">支払条件</label>
        <input className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.poPaymentTerms} onChange={e => setF("poPaymentTerms", e.target.value)} placeholder="例：月末締め翌月末払い" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">納品条件・納品場所</label>
        <input className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.deliveryNotes} onChange={e => setF("deliveryNotes", e.target.value)} placeholder="例：現場持込、搬入立会いあり" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">デフォルト備考</label>
        <textarea className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={3} value={form.poNotes} onChange={e => setF("poNotes", e.target.value)} placeholder="例：本発注書に基づき施工をお願いします。変更がある場合は事前にご連絡ください。" />
      </div>
    </>
  );
}

// ─── 請求書フォームフィールド ─────────────────────────────────────────────────
function InvoiceFields({ form, setF }: { form: typeof DEFAULT_FORM; setF: (k: any, v: any) => void }) {
  return (
    <>
      <Input label="お支払い期限（日数）" type="number" min="1" value={form.dueDays} onChange={e => setF("dueDays", e.target.value)} />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">支払条件</label>
        <input className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.invoicePaymentTerms} onChange={e => setF("invoicePaymentTerms", e.target.value)} placeholder="例：銀行振込（手数料はご負担願います）" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">振込先口座情報</label>
        <textarea className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={3} value={form.bankInfo} onChange={e => setF("bankInfo", e.target.value)} placeholder={"例：〇〇銀行 △△支店\n普通 1234567\nカ）〇〇建設"} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">デフォルト備考</label>
        <textarea className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={3} value={form.invoiceNotes} onChange={e => setF("invoiceNotes", e.target.value)} placeholder="例：上記金額をご請求申し上げます。何卒よろしくお願いいたします。" />
      </div>
    </>
  );
}

// ─── テンプレートサマリー ─────────────────────────────────────────────────────
function TemplateSummary({ template }: { template: Template }) {
  const c = template.content;
  switch (template.type) {
    case "REPORT":
      return (
        <div className="mt-1 space-y-0.5 text-sm text-gray-500">
          {c.sections?.length > 0 && <p>報告項目：{c.sections.map((s: any) => s.name).filter(Boolean).join("・")}</p>}
          {c.defaultWorkTime && <p className="text-xs text-gray-400">{c.defaultWorkTime.start}〜{c.defaultWorkTime.end}（休憩{c.defaultWorkTime.break}分）</p>}
        </div>
      );
    case "ESTIMATE":
      return (
        <div className="mt-1 space-y-0.5 text-sm text-gray-500">
          <p>消費税 {c.defaultTaxRate}%・有効期限 {c.validityDays}日</p>
          {c.estimateItems?.length > 0 && <p className="text-xs text-gray-400">定型明細：{c.estimateItems.map((i: any) => i.name).join("・")}</p>}
          {c.paymentTerms && <p className="text-xs text-gray-400">支払条件：{c.paymentTerms}</p>}
        </div>
      );
    case "SCHEDULE":
      return (
        <div className="mt-1 space-y-0.5 text-sm text-gray-500">
          {c.scheduleTasks?.length > 0 && <p>標準工程：{c.scheduleTasks.map((t: any) => `${t.name}(${t.durationDays}日)`).join(" → ")}</p>}
          {c.excludeWeekends && <p className="text-xs text-gray-400">土日除外あり</p>}
        </div>
      );
    case "PURCHASE_ORDER":
      return (
        <div className="mt-1 space-y-0.5 text-sm text-gray-500">
          {c.poPaymentTerms && <p>支払条件：{c.poPaymentTerms}</p>}
          {c.deliveryNotes  && <p className="text-xs text-gray-400">納品：{c.deliveryNotes}</p>}
        </div>
      );
    case "INVOICE":
      return (
        <div className="mt-1 space-y-0.5 text-sm text-gray-500">
          <p>支払期限：{c.dueDays}日以内</p>
          {c.invoicePaymentTerms && <p className="text-xs text-gray-400">{c.invoicePaymentTerms}</p>}
          {c.bankInfo && <p className="text-xs text-gray-400 whitespace-pre-line">{c.bankInfo}</p>}
        </div>
      );
    default:
      return null;
  }
}
