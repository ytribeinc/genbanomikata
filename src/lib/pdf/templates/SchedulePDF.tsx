import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { join } from "path";

Font.register({
  family: "NotoSansJP",
  fonts: [
    { src: join(process.cwd(), "public/fonts/NotoSansJP.ttf"), fontWeight: 400 },
    { src: join(process.cwd(), "public/fonts/NotoSansJP.ttf"), fontWeight: 700 },
  ],
});

// ─── 日付ユーティリティ ───────────────────────────────────────────────────────
function parseDate(s: string) { return new Date(s.slice(0, 10) + "T00:00:00"); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86400000); }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function nextMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

// ─── スタイル ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page:        { fontFamily: "NotoSansJP", fontSize: 8, padding: 20, color: "#1a1a1a", backgroundColor: "#fff" },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12, borderBottomWidth: 2, borderBottomColor: "#1d4ed8", paddingBottom: 8 },
  titleBlock:  { flexDirection: "column" },
  docTitle:    { fontSize: 18, fontWeight: 700, color: "#1d4ed8" },
  projectName: { fontSize: 10, fontWeight: 700, color: "#1a1a1a", marginTop: 2 },
  companyBlock:{ alignItems: "flex-end" },
  companyName: { fontSize: 9, fontWeight: 700 },
  metaText:    { fontSize: 7, color: "#6b7280", marginTop: 1 },

  // Gantt テーブル
  gantt:       { flexDirection: "column", borderWidth: 1, borderColor: "#d1d5db" },
  monthHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#d1d5db", backgroundColor: "#1d4ed8" },
  weekHeader:  { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#d1d5db", backgroundColor: "#dbeafe" },
  taskRow:     { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", minHeight: 18 },
  taskRowAlt:  { backgroundColor: "#f9fafb" },

  // 左カラム（タスク情報）
  labelCol:    { width: 120, paddingHorizontal: 5, paddingVertical: 3, borderRightWidth: 1, borderRightColor: "#d1d5db", justifyContent: "center" },
  labelHead:   { width: 120, paddingHorizontal: 5, paddingVertical: 3, borderRightWidth: 1, borderRightColor: "#93c5fd" },
  taskName:    { fontSize: 8, color: "#1a1a1a", fontWeight: 700 },
  taskSub:     { fontSize: 6.5, color: "#6b7280", marginTop: 1 },

  // ガントセル
  cellBase:    { borderRightWidth: 1, borderRightColor: "#e5e7eb", flexDirection: "row", alignItems: "center", paddingHorizontal: 1 },
  cellHead:    { borderRightWidth: 1, borderRightColor: "#93c5fd", alignItems: "center", justifyContent: "center", paddingVertical: 3 },
  monthText:   { fontSize: 7, color: "#fff", fontWeight: 700 },
  weekText:    { fontSize: 6, color: "#1e40af" },

  // バー
  barDone:     { borderRadius: 2, backgroundColor: "#10b981" },
  barProgress: { borderRadius: 2, backgroundColor: "#3b82f6" },
  barTodo:     { borderRadius: 2, backgroundColor: "#9ca3af" },

  // 凡例
  legend:      { flexDirection: "row", marginTop: 8, gap: 12 },
  legendItem:  { flexDirection: "row", alignItems: "center", gap: 3 },
  legendDot:   { width: 8, height: 8, borderRadius: 2 },
  legendText:  { fontSize: 7, color: "#374151" },

  footer:      { position: "absolute", bottom: 12, left: 20, right: 20, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 3, flexDirection: "row", justifyContent: "space-between" },
  footerText:  { fontSize: 6.5, color: "#9ca3af" },
});

// ─── 型定義 ──────────────────────────────────────────────────────────────────
export type SchedulePDFProps = {
  schedule: {
    title: string;
    project: { name: string; address: string | null };
    tasks: {
      name: string;
      startDate: string;
      endDate: string;
      status: "TODO" | "IN_PROGRESS" | "DONE";
      color: string | null;
      assignedUser: { name: string } | null;
    }[];
  };
  company: { name: string; address?: string | null; phone?: string | null };
  issueDate: string;
};

export function SchedulePDF({ schedule, company, issueDate }: SchedulePDFProps) {
  const tasks = schedule.tasks;

  // 日付レンジ計算
  const allDates = tasks.flatMap(t => [parseDate(t.startDate), parseDate(t.endDate)]);
  const minDate  = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date();
  const maxDate  = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : addDays(new Date(), 90);

  // 月の開始から終了まで
  const rangeStart = startOfMonth(minDate);
  const rangeEnd   = endOfMonth(maxDate);
  const totalDays  = daysBetween(rangeStart, rangeEnd) + 1;

  // 月一覧生成
  const months: { label: string; start: Date; days: number }[] = [];
  let cur = new Date(rangeStart);
  while (cur <= rangeEnd) {
    const mStart = startOfMonth(cur);
    const mEnd   = endOfMonth(cur);
    const start  = mStart < rangeStart ? rangeStart : mStart;
    const end    = mEnd   > rangeEnd   ? rangeEnd   : mEnd;
    months.push({
      label: `${cur.getFullYear()}/${String(cur.getMonth() + 1).padStart(2, "0")}`,
      start,
      days: daysBetween(start, end) + 1,
    });
    cur = nextMonth(cur);
  }

  // 週一覧（月ヘッダーの下の細かいヘッダー）
  const weeks: { label: string; start: Date; days: number }[] = [];
  let wCur = new Date(rangeStart);
  while (wCur <= rangeEnd) {
    const wEnd = addDays(wCur, 6);
    const end  = wEnd > rangeEnd ? rangeEnd : wEnd;
    const startDay = wCur.getDate();
    weeks.push({
      label: `${startDay}`,
      start: new Date(wCur),
      days: daysBetween(wCur, end) + 1,
    });
    wCur = addDays(wCur, 7);
  }

  // バー描画用：タスクの左オフセット・幅を計算（百分率）
  function taskBar(task: SchedulePDFProps["schedule"]["tasks"][0]) {
    const s = parseDate(task.startDate);
    const e = parseDate(task.endDate);
    const left  = (daysBetween(rangeStart, s)              / totalDays) * 100;
    const width = (daysBetween(s, addDays(e, 1))           / totalDays) * 100;
    return { left: Math.max(0, left), width: Math.min(100 - Math.max(0, left), Math.max(0.5, width)) };
  }

  const CELL_WIDTH_FACTOR = 100 / totalDays; // 1日あたりの%

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* ヘッダー */}
        <View style={s.header}>
          <View style={s.titleBlock}>
            <Text style={s.docTitle}>工　程　表</Text>
            <Text style={s.projectName}>{schedule.project.name}　{schedule.title}</Text>
            {schedule.project.address && (
              <Text style={[s.metaText, { marginTop: 2 }]}>所在地：{schedule.project.address}</Text>
            )}
          </View>
          <View style={s.companyBlock}>
            <Text style={s.companyName}>{company.name}</Text>
            {company.address && <Text style={s.metaText}>{company.address}</Text>}
            {company.phone   && <Text style={s.metaText}>TEL: {company.phone}</Text>}
            <Text style={[s.metaText, { marginTop: 4 }]}>作成日：{new Date(issueDate).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}</Text>
          </View>
        </View>

        {/* ガントチャート */}
        <View style={s.gantt}>
          {/* 月ヘッダー */}
          <View style={s.monthHeader}>
            <View style={[s.labelHead, { justifyContent: "center" }]}>
              <Text style={[s.monthText, { fontSize: 7 }]}>工事項目</Text>
            </View>
            {months.map((m) => (
              <View
                key={m.label}
                style={[s.cellHead, {
                  width: `${(m.days / totalDays) * 100}%`,
                  borderRightColor: "#2563eb",
                }]}
              >
                <Text style={s.monthText}>{m.label}</Text>
              </View>
            ))}
          </View>

          {/* タスク行 */}
          {tasks.map((task, idx) => {
            const bar = taskBar(task);
            const barStyle =
              task.status === "DONE"        ? s.barDone :
              task.status === "IN_PROGRESS" ? s.barProgress : s.barTodo;
            const barColor = task.color ??
              (task.status === "DONE" ? "#10b981" : task.status === "IN_PROGRESS" ? "#3b82f6" : "#9ca3af");

            return (
              <View key={idx} style={[s.taskRow, idx % 2 === 1 ? s.taskRowAlt : {}]}>
                {/* タスク名 */}
                <View style={s.labelCol}>
                  <Text style={s.taskName}>{task.name}</Text>
                  {task.assignedUser && (
                    <Text style={s.taskSub}>{task.assignedUser.name}</Text>
                  )}
                  <Text style={[s.taskSub, { marginTop: 1 }]}>
                    {task.startDate.slice(5, 10).replace("-", "/")} 〜 {task.endDate.slice(5, 10).replace("-", "/")}
                  </Text>
                </View>

                {/* ガントバーエリア（相対配置） */}
                <View style={{ flex: 1, position: "relative", paddingVertical: 3 }}>
                  {/* 月区切り縦線 */}
                  {months.slice(0, -1).map((m, mi) => {
                    const lineLeft = months.slice(0, mi + 1).reduce((sum, mm) => sum + mm.days, 0);
                    return (
                      <View
                        key={mi}
                        style={{
                          position: "absolute",
                          top: 0, bottom: 0,
                          left: `${(lineLeft / totalDays) * 100}%`,
                          width: 0.5,
                          backgroundColor: "#d1d5db",
                        }}
                      />
                    );
                  })}

                  {/* バー */}
                  <View
                    style={{
                      position: "absolute",
                      top: 3, bottom: 3,
                      left: `${bar.left}%`,
                      width: `${bar.width}%`,
                      backgroundColor: barColor,
                      borderRadius: 2,
                      opacity: task.status === "DONE" ? 0.7 : 1,
                    }}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* 凡例 */}
        <View style={s.legend}>
          {[
            { label: "未着手", color: "#9ca3af" },
            { label: "進行中", color: "#3b82f6" },
            { label: "完了",   color: "#10b981" },
          ].map(({ label, color }) => (
            <View key={label} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: color }]} />
              <Text style={s.legendText}>{label}</Text>
            </View>
          ))}
          <Text style={[s.legendText, { marginLeft: 8 }]}>※ タスクの色は設定色を使用</Text>
        </View>

        {/* フッター */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{company.name}　{schedule.project.name}　{schedule.title}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
