import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { join } from "path";

// サーバーサイドでの絶対パスでフォント登録
Font.register({
  family: "NotoSansJP",
  fonts: [
    {
      src: join(process.cwd(), "public/fonts/NotoSansJP.ttf"),
      fontWeight: 400,
    },
    {
      src: join(process.cwd(), "public/fonts/NotoSansJP.ttf"),
      fontWeight: 700,
    },
  ],
});

const FONT_FAMILY = "NotoSansJP";

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    padding: 30,
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#1d4ed8",
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  companyName: {
    fontSize: 10,
    color: "#6b7280",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1d4ed8",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  dateText: {
    fontSize: 10,
    color: "#374151",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1d4ed8",
    marginBottom: 6,
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#bfdbfe",
    paddingBottom: 2,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  infoLabel: {
    width: 80,
    fontSize: 9,
    color: "#6b7280",
    fontWeight: "bold",
  },
  infoValue: {
    flex: 1,
    fontSize: 9,
    color: "#111827",
  },
  table: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1d4ed8",
  },
  tableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  tableRowEven: {
    backgroundColor: "#f9fafb",
  },
  tableCell: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 8,
    color: "#111827",
  },
  tableHeaderCell: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 8,
    color: "#ffffff",
    fontWeight: "bold",
  },
  colName: { width: "14%" },
  colStart: { width: "10%" },
  colEnd: { width: "10%" },
  colBreak: { width: "10%" },
  colActual: { width: "10%" },
  colContent: { flex: 1 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
  },
  footerText: {
    fontSize: 8,
    color: "#9ca3af",
  },
});

export type DailyReportPDFProps = {
  report: {
    workDate: string;
    weather: string;
    summary: string | null;
    project: { name: string; address: string | null };
    user: { name: string };
    workLogs: Array<{
      startTime: string;
      endTime: string;
      breakMinutes: number;
      workContent: string | null;
      user: { name: string };
    }>;
  };
  company: { name: string };
};

const WEATHER_LABELS: Record<string, string> = {
  SUNNY: "晴れ",
  CLOUDY: "曇り",
  RAINY: "雨",
  SNOWY: "雪",
};

function calcActualMinutes(
  startTime: string,
  endTime: string,
  breakMinutes: number
): number {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  return Math.max(0, diffMin - breakMinutes);
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

export function DailyReportPDF({ report, company }: DailyReportPDFProps) {
  const workDate = new Date(report.workDate);
  const dateLabel = workDate.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{company.name}</Text>
            <Text style={styles.title}>作業日報</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.dateText}>{dateLabel}</Text>
            <Text style={styles.dateText}>
              作成者: {report.user.name}
            </Text>
          </View>
        </View>

        {/* 現場情報 */}
        <Text style={styles.sectionTitle}>現場情報</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>現場名</Text>
          <Text style={styles.infoValue}>{report.project.name}</Text>
        </View>
        {report.project.address && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>住所</Text>
            <Text style={styles.infoValue}>{report.project.address}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>天気</Text>
          <Text style={styles.infoValue}>
            {WEATHER_LABELS[report.weather] ?? report.weather}
          </Text>
        </View>
        {report.summary && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>概要</Text>
            <Text style={styles.infoValue}>{report.summary}</Text>
          </View>
        )}

        {/* 作業員テーブル */}
        <Text style={styles.sectionTitle}>作業記録</Text>
        <View style={styles.table}>
          {/* テーブルヘッダー */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colName]}>氏名</Text>
            <Text style={[styles.tableHeaderCell, styles.colStart]}>開始</Text>
            <Text style={[styles.tableHeaderCell, styles.colEnd]}>終了</Text>
            <Text style={[styles.tableHeaderCell, styles.colBreak]}>休憩</Text>
            <Text style={[styles.tableHeaderCell, styles.colActual]}>実働</Text>
            <Text style={[styles.tableHeaderCell, styles.colContent]}>作業内容</Text>
          </View>
          {/* テーブル行 */}
          {report.workLogs.map((log, index) => {
            const actual = calcActualMinutes(
              log.startTime,
              log.endTime,
              log.breakMinutes
            );
            return (
              <View
                key={index}
                style={[
                  styles.tableRow,
                  index % 2 === 1 ? styles.tableRowEven : {},
                ]}
              >
                <Text style={[styles.tableCell, styles.colName]}>
                  {log.user.name}
                </Text>
                <Text style={[styles.tableCell, styles.colStart]}>
                  {formatTime(log.startTime)}
                </Text>
                <Text style={[styles.tableCell, styles.colEnd]}>
                  {formatTime(log.endTime)}
                </Text>
                <Text style={[styles.tableCell, styles.colBreak]}>
                  {log.breakMinutes}分
                </Text>
                <Text style={[styles.tableCell, styles.colActual]}>
                  {formatMinutes(actual)}
                </Text>
                <Text style={[styles.tableCell, styles.colContent]}>
                  {log.workContent ?? ""}
                </Text>
              </View>
            );
          })}
          {report.workLogs.length === 0 && (
            <View style={styles.tableRow}>
              <Text
                style={[
                  styles.tableCell,
                  { flex: 1, textAlign: "center", color: "#9ca3af" },
                ]}
              >
                作業記録なし
              </Text>
            </View>
          )}
        </View>

        {/* フッター */}
        <View style={styles.footer} fixed>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
