// AIA G703 — Continuation Sheet for the G702 Application and Certificate
// for Payment. Per-line breakdown matching the project's Schedule of
// Values. Like G702 this is a credible facsimile, not a pixel-perfect
// reproduction (the official AIA form is copyrighted).
//
// Columns approximate the official G703:
//   A. Item No (line number)
//   B. Description of Work
//   C. Scheduled Value (current_amount, including approved CO impacts)
//   D. Work Completed — Previous Applications
//   E. Work Completed — This Period
//   F. Materials Presently Stored
//   G. Total Completed and Stored to Date (D + E + F)
//   H. Percent (G / C × 100)
//   I. Balance to Finish (C - G)
//   J. Retainage (this period)

import { Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export type AiaG703Line = {
  itemNumber: string;
  description: string;
  scheduledValue: number;
  previouslyBilled: number;
  thisPeriod: number;
  storedMaterials: number;
  retentionThisPeriod: number;
};

export type AiaG703Data = {
  applicationNumber: string;
  periodTo: string;
  projectName: string;
  projectNumber: string;
  lines: AiaG703Line[];
};

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 7,
    fontFamily: 'Helvetica',
    color: '#0f172a',
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 7,
    color: '#475569',
    textAlign: 'center',
    marginTop: 3,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    border: '1pt solid #0f172a',
    marginBottom: 8,
  },
  metaCell: {
    flex: 1,
    padding: 4,
    borderRight: '1pt solid #0f172a',
  },
  metaCellLast: {
    flex: 1,
    padding: 4,
  },
  metaLabel: {
    fontSize: 6,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  table: {
    border: '1pt solid #0f172a',
  },
  thead: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottom: '1pt solid #0f172a',
  },
  th: {
    padding: 3,
    borderRight: '1pt solid #0f172a',
    fontSize: 6,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  thLast: {
    padding: 3,
    fontSize: 6,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  tr: {
    flexDirection: 'row',
    borderBottom: '1pt solid #cbd5e1',
  },
  trLast: {
    flexDirection: 'row',
  },
  td: {
    padding: 3,
    borderRight: '1pt solid #cbd5e1',
    fontSize: 7,
  },
  tdLast: {
    padding: 3,
    fontSize: 7,
  },
  totalsRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderTop: '1pt solid #0f172a',
  },
  // Column flex weights summing to roughly 100. Tuned so item + description
  // get the most width and amounts get enough for $1,234,567.89.
  colItem: { flex: 5, textAlign: 'center' },
  colDesc: { flex: 22 },
  colScheduled: { flex: 11, textAlign: 'right' },
  colPrev: { flex: 11, textAlign: 'right' },
  colThis: { flex: 11, textAlign: 'right' },
  colStored: { flex: 9, textAlign: 'right' },
  colTotal: { flex: 11, textAlign: 'right' },
  colPct: { flex: 6, textAlign: 'right' },
  colBalance: { flex: 11, textAlign: 'right' },
  colRetainage: { flex: 9, textAlign: 'right' },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 30,
    right: 30,
    fontSize: 6,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

export function AiaG703Page({ data }: { data: AiaG703Data }) {
  const totals = data.lines.reduce(
    (acc, l) => {
      const total = l.previouslyBilled + l.thisPeriod + l.storedMaterials;
      return {
        scheduled: acc.scheduled + l.scheduledValue,
        previously: acc.previously + l.previouslyBilled,
        thisPeriod: acc.thisPeriod + l.thisPeriod,
        stored: acc.stored + l.storedMaterials,
        total: acc.total + total,
        retainage: acc.retainage + l.retentionThisPeriod,
      };
    },
    {
      scheduled: 0,
      previously: 0,
      thisPeriod: 0,
      stored: 0,
      total: 0,
      retainage: 0,
    },
  );

  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <Text style={styles.title}>CONTINUATION SHEET</Text>
      <Text style={styles.subtitle}>
        AIA Document G703 — facsimile · Application #{data.applicationNumber} ·
        Period ending {data.periodTo}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Project</Text>
          <Text>{data.projectName}</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Project No.</Text>
          <Text>{data.projectNumber}</Text>
        </View>
        <View style={styles.metaCellLast}>
          <Text style={styles.metaLabel}>Application No.</Text>
          <Text>{data.applicationNumber}</Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.thead}>
          <Text style={[styles.th, styles.colItem]}>A{'\n'}Item</Text>
          <Text style={[styles.th, styles.colDesc]}>B{'\n'}Description</Text>
          <Text style={[styles.th, styles.colScheduled]}>C{'\n'}Scheduled</Text>
          <Text style={[styles.th, styles.colPrev]}>D{'\n'}Previous</Text>
          <Text style={[styles.th, styles.colThis]}>E{'\n'}This Period</Text>
          <Text style={[styles.th, styles.colStored]}>F{'\n'}Stored</Text>
          <Text style={[styles.th, styles.colTotal]}>G{'\n'}Total</Text>
          <Text style={[styles.th, styles.colPct]}>H{'\n'}%</Text>
          <Text style={[styles.th, styles.colBalance]}>I{'\n'}Balance</Text>
          <Text style={[styles.thLast, styles.colRetainage]}>
            J{'\n'}Retainage
          </Text>
        </View>
        {data.lines.map((line, idx) => {
          const isLast = idx === data.lines.length - 1;
          const total = line.previouslyBilled + line.thisPeriod + line.storedMaterials;
          const pct = line.scheduledValue > 0
            ? (total / line.scheduledValue) * 100
            : 0;
          const balance = line.scheduledValue - total;
          return (
            <View
              key={`${line.itemNumber}-${idx}`}
              style={isLast ? styles.trLast : styles.tr}
            >
              <Text style={[styles.td, styles.colItem]}>{line.itemNumber}</Text>
              <Text style={[styles.td, styles.colDesc]}>{line.description}</Text>
              <Text style={[styles.td, styles.colScheduled]}>
                {formatMoney(line.scheduledValue)}
              </Text>
              <Text style={[styles.td, styles.colPrev]}>
                {formatMoney(line.previouslyBilled)}
              </Text>
              <Text style={[styles.td, styles.colThis]}>
                {formatMoney(line.thisPeriod)}
              </Text>
              <Text style={[styles.td, styles.colStored]}>
                {formatMoney(line.storedMaterials)}
              </Text>
              <Text style={[styles.td, styles.colTotal]}>{formatMoney(total)}</Text>
              <Text style={[styles.td, styles.colPct]}>{pct.toFixed(0)}%</Text>
              <Text style={[styles.td, styles.colBalance]}>
                {formatMoney(balance)}
              </Text>
              <Text style={[styles.tdLast, styles.colRetainage]}>
                {formatMoney(line.retentionThisPeriod)}
              </Text>
            </View>
          );
        })}
        <View style={styles.totalsRow}>
          <Text style={[styles.td, styles.colItem]}></Text>
          <Text style={[styles.td, styles.colDesc, { fontWeight: 'bold' }]}>
            GRAND TOTAL
          </Text>
          <Text style={[styles.td, styles.colScheduled, { fontWeight: 'bold' }]}>
            {formatMoney(totals.scheduled)}
          </Text>
          <Text style={[styles.td, styles.colPrev, { fontWeight: 'bold' }]}>
            {formatMoney(totals.previously)}
          </Text>
          <Text style={[styles.td, styles.colThis, { fontWeight: 'bold' }]}>
            {formatMoney(totals.thisPeriod)}
          </Text>
          <Text style={[styles.td, styles.colStored, { fontWeight: 'bold' }]}>
            {formatMoney(totals.stored)}
          </Text>
          <Text style={[styles.td, styles.colTotal, { fontWeight: 'bold' }]}>
            {formatMoney(totals.total)}
          </Text>
          <Text style={[styles.td, styles.colPct]}></Text>
          <Text style={[styles.td, styles.colBalance, { fontWeight: 'bold' }]}>
            {formatMoney(totals.scheduled - totals.total)}
          </Text>
          <Text style={[styles.tdLast, styles.colRetainage, { fontWeight: 'bold' }]}>
            {formatMoney(totals.retainage)}
          </Text>
        </View>
      </View>

      <Text style={styles.footer}>
        Generated by constructor · facsimile of AIA G703 — for development & demo only
      </Text>
    </Page>
  );
}

function formatMoney(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
