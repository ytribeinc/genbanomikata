import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { join } from "path";

Font.register({
  family: "NotoSansJP",
  fonts: [
    { src: join(process.cwd(), "public/fonts/NotoSansJP.ttf"), fontWeight: 400 },
    { src: join(process.cwd(), "public/fonts/NotoSansJP.ttf"), fontWeight: 700 },
  ],
});

const s = StyleSheet.create({
  page:       { fontFamily: "NotoSansJP", fontSize: 9, padding: 36, color: "#1a1a1a" },
  header:     { flexDirection: "row", justifyContent: "space-between", marginBottom: 20, borderBottomWidth: 2, borderBottomColor: "#059669", paddingBottom: 10 },
  title:      { fontSize: 22, fontWeight: 700, color: "#059669" },
  companyBlock:{ alignItems: "flex-end" },
  companyName: { fontSize: 11, fontWeight: 700 },
  companySub:  { fontSize: 8, color: "#6b7280", marginTop: 2 },
  metaRow:    { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  toBlock:    { flex: 1 },
  toName:     { fontSize: 14, fontWeight: 700, borderBottomWidth: 1, borderBottomColor: "#111", paddingBottom: 2, marginBottom: 4 },
  toSub:      { fontSize: 8, color: "#6b7280" },
  infoBlock:  { width: 180 },
  infoRow:    { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  infoLabel:  { fontSize: 8, color: "#6b7280", width: 70 },
  infoValue:  { fontSize: 8, color: "#111" },
  totalBox:   { backgroundColor: "#059669", borderRadius: 4, padding: 8, marginBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 10, color: "#fff" },
  totalValue: { fontSize: 16, fontWeight: 700, color: "#fff" },
  paidBox:    { backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#86efac", borderRadius: 4, padding: 6, marginBottom: 12, flexDirection: "row", justifyContent: "space-between" },
  paidLabel:  { fontSize: 9, color: "#166534" },
  paidValue:  { fontSize: 9, fontWeight: 700, color: "#166534" },
  table:      { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 2, marginBottom: 16 },
  tableHead:  { flexDirection: "row", backgroundColor: "#059669" },
  tableRow:   { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  tableRowEven:{ backgroundColor: "#f9fafb" },
  th:         { paddingVertical: 5, paddingHorizontal: 4, fontSize: 8, color: "#fff", fontWeight: 700 },
  td:         { paddingVertical: 5, paddingHorizontal: 4, fontSize: 8, color: "#111" },
  colNo:    { width: "5%" },
  colName:  { flex: 1 },
  colQty:   { width: "8%" },
  colUnit:  { width: "7%" },
  colPrice: { width: "14%" },
  colAmt:   { width: "16%" },
  sumBlock: { alignItems: "flex-end", marginBottom: 16 },
  sumRow:   { flexDirection: "row", justifyContent: "flex-end", marginBottom: 3 },
  sumLabel: { fontSize: 8, color: "#6b7280", width: 80, textAlign: "right", marginRight: 8 },
  sumValue: { fontSize: 8, color: "#111", width: 90, textAlign: "right" },
  sumBorder:{ borderTopWidth: 1, borderTopColor: "#111", paddingTop: 3, marginTop: 3 },
  sumBold:  { fontWeight: 700, fontSize: 10, color: "#059669" },
  notesTitle:{ fontSize: 9, fontWeight: 700, color: "#374151", marginBottom: 4 },
  notesBox: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 2, padding: 8, fontSize: 8, color: "#374151", minHeight: 40 },
  footer:   { position: "absolute", bottom: 20, left: 36, right: 36, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 4, flexDirection: "row", justifyContent: "center" },
  footerText:{ fontSize: 7, color: "#9ca3af" },
});

function fmtYen(v: number) { return "¥" + Math.round(v).toLocaleString("ja-JP"); }
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "下書き", SENT: "請求済み", PARTIAL: "一部入金", PAID: "入金済み", OVERDUE: "期限超過",
};

export type InvoicePDFProps = {
  invoice: {
    invoiceNo: string;
    title: string;
    issueDate: string;
    dueDate: string | null;
    status: string;
    taxRate: number;
    notes: string | null;
    paidAmount: number;
    paidDate: string | null;
    customer: { name: string; address: string | null; phone: string | null } | null;
    project:  { name: string; address: string | null } | null;
    items: { name: string; description: string | null; quantity: number; unit: string; unitPrice: number; amount: number }[];
  };
  company: { name: string; address?: string | null; phone?: string | null };
};

export function InvoicePDF({ invoice, company }: InvoicePDFProps) {
  const subtotal   = invoice.items.reduce((s, i) => s + i.amount, 0);
  const tax        = Math.round(subtotal * invoice.taxRate / 100);
  const total      = subtotal + tax;
  const remaining  = Math.max(0, total - invoice.paidAmount);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>請　求　書</Text>
          <View style={s.companyBlock}>
            <Text style={s.companyName}>{company.name}</Text>
            {company.address && <Text style={s.companySub}>{company.address}</Text>}
            {company.phone   && <Text style={s.companySub}>TEL: {company.phone}</Text>}
          </View>
        </View>

        <View style={s.metaRow}>
          <View style={s.toBlock}>
            <Text style={s.toName}>{invoice.customer?.name ?? "　"} 御中</Text>
            {invoice.customer?.address && <Text style={s.toSub}>{invoice.customer.address}</Text>}
            {invoice.project && <Text style={[s.toSub, { marginTop: 4 }]}>件名：{invoice.title}</Text>}
            {invoice.project && <Text style={s.toSub}>現場：{invoice.project.name}</Text>}
          </View>
          <View style={s.infoBlock}>
            {[
              ["請求番号",   invoice.invoiceNo],
              ["発行日",     fmtDate(invoice.issueDate)],
              ["支払期限",   fmtDate(invoice.dueDate)],
              ["ステータス", STATUS_LABEL[invoice.status] ?? invoice.status],
            ].map(([label, value]) => (
              <View key={label} style={s.infoRow}>
                <Text style={s.infoLabel}>{label}</Text>
                <Text style={s.infoValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.totalBox}>
          <Text style={s.totalLabel}>
            {invoice.status === "PARTIAL" ? "ご請求金額（税込）/ 残額" : "ご請求金額（税込）"}
          </Text>
          <Text style={s.totalValue}>
            {invoice.status === "PARTIAL" ? `${fmtYen(total)} / 残${fmtYen(remaining)}` : fmtYen(total)}
          </Text>
        </View>

        {(invoice.status === "PAID" || invoice.status === "PARTIAL") && invoice.paidAmount > 0 && (
          <View style={s.paidBox}>
            <Text style={s.paidLabel}>入金済み金額{invoice.paidDate ? `（${fmtDate(invoice.paidDate)}）` : ""}</Text>
            <Text style={s.paidValue}>{fmtYen(invoice.paidAmount)}</Text>
          </View>
        )}

        <View style={s.table}>
          <View style={s.tableHead}>
            <Text style={[s.th, s.colNo]}>No.</Text>
            <Text style={[s.th, s.colName]}>工事項目</Text>
            <Text style={[s.th, s.colQty]}>数量</Text>
            <Text style={[s.th, s.colUnit]}>単位</Text>
            <Text style={[s.th, s.colPrice]}>単価</Text>
            <Text style={[s.th, s.colAmt]}>金額</Text>
          </View>
          {invoice.items.map((item, idx) => (
            <View key={idx} style={[s.tableRow, idx % 2 === 1 ? s.tableRowEven : {}]}>
              <Text style={[s.td, s.colNo]}>{idx + 1}</Text>
              <View style={[s.colName, { paddingVertical: 5, paddingHorizontal: 4 }]}>
                <Text style={{ fontSize: 8, color: "#111" }}>{item.name}</Text>
                {item.description && <Text style={{ fontSize: 7, color: "#6b7280", marginTop: 1 }}>{item.description}</Text>}
              </View>
              <Text style={[s.td, s.colQty]}>{item.quantity}</Text>
              <Text style={[s.td, s.colUnit]}>{item.unit}</Text>
              <Text style={[s.td, s.colPrice]}>{fmtYen(item.unitPrice)}</Text>
              <Text style={[s.td, s.colAmt]}>{fmtYen(item.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={s.sumBlock}>
          {[["小計", subtotal], [`消費税（${invoice.taxRate}%）`, tax]].map(([label, val]) => (
            <View key={String(label)} style={s.sumRow}>
              <Text style={s.sumLabel}>{label}</Text>
              <Text style={s.sumValue}>{fmtYen(Number(val))}</Text>
            </View>
          ))}
          <View style={[s.sumRow, s.sumBorder]}>
            <Text style={[s.sumLabel, s.sumBold]}>合計（税込）</Text>
            <Text style={[s.sumValue, s.sumBold]}>{fmtYen(total)}</Text>
          </View>
          {invoice.paidAmount > 0 && (
            <>
              <View style={s.sumRow}>
                <Text style={s.sumLabel}>入金済み</Text>
                <Text style={s.sumValue}>- {fmtYen(invoice.paidAmount)}</Text>
              </View>
              <View style={[s.sumRow, s.sumBorder]}>
                <Text style={[s.sumLabel, s.sumBold]}>残額</Text>
                <Text style={[s.sumValue, s.sumBold]}>{fmtYen(remaining)}</Text>
              </View>
            </>
          )}
        </View>

        {invoice.notes && (
          <View>
            <Text style={s.notesTitle}>備考</Text>
            <View style={s.notesBox}><Text>{invoice.notes}</Text></View>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
