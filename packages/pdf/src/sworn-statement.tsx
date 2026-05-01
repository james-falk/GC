// Sworn Statement — typically called the "Contractor's Sworn Statement" or
// "Contractor's Affidavit." Required by many states/owners alongside each
// pay app to certify that subcontractors have been paid for prior periods.
// Generated alongside an owner-direction pay app and shares its lifecycle.
//
// Phase A scope: credible facsimile with the standard line-item layout
// (sub name, trade, contract amount, paid prior, paid this period, balance
// owed) plus the notarization block. Real format varies by state — Illinois
// uses the well-known "Owner's/Contractor's Sworn Statement" form;
// other jurisdictions use functionally equivalent variants.

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export type SwornStatementLine = {
  subName: string;
  trade: string;
  contractAmount: number;
  paidPriorPeriods: number;
  paidThisPeriod: number;
  balanceOwed: number;
};

export type SwornStatementData = {
  projectName: string;
  projectNumber: string;
  contractorName: string;
  ownerName: string;
  periodTo: string;
  contractorPrincipalName: string; // person making the affidavit
  totalContractAmount: number;
  totalPaidPriorPeriods: number;
  totalPaidThisPeriod: number;
  totalBalanceOwed: number;
  lines: SwornStatementLine[];
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#0f172a',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 8,
    color: '#475569',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 7,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    border: '1pt solid #0f172a',
  },
  metaCell: {
    flex: 1,
    padding: 6,
    borderRight: '1pt solid #0f172a',
  },
  metaCellLast: {
    flex: 1,
    padding: 6,
  },
  affidavitBlock: {
    marginTop: 14,
    marginBottom: 12,
    fontSize: 9,
    lineHeight: 1.5,
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
    padding: 5,
    borderRight: '1pt solid #0f172a',
    fontSize: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#475569',
  },
  thLast: {
    padding: 5,
    fontSize: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#475569',
  },
  tr: {
    flexDirection: 'row',
    borderBottom: '1pt solid #cbd5e1',
  },
  trLast: {
    flexDirection: 'row',
  },
  td: {
    padding: 5,
    borderRight: '1pt solid #cbd5e1',
    fontSize: 8,
  },
  tdLast: {
    padding: 5,
    fontSize: 8,
  },
  totalsRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderTop: '1pt solid #0f172a',
  },
  // column widths (sum to 100)
  colSub: { flex: 18 },
  colTrade: { flex: 14 },
  colContract: { flex: 13, textAlign: 'right' },
  colPaidPrior: { flex: 13, textAlign: 'right' },
  colPaidThis: { flex: 13, textAlign: 'right' },
  colBalance: { flex: 13, textAlign: 'right' },
  signatureRow: {
    flexDirection: 'row',
    marginTop: 28,
    gap: 24,
  },
  signatureBlock: {
    flex: 1,
  },
  signatureLine: {
    borderBottom: '1pt solid #0f172a',
    height: 28,
  },
  signatureCaption: {
    fontSize: 7,
    color: '#475569',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notaryBlock: {
    marginTop: 24,
    border: '1pt solid #0f172a',
    padding: 10,
    fontSize: 8,
    lineHeight: 1.5,
  },
  notaryHeading: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

export function SwornStatement({ data }: { data: SwornStatementData }) {
  return (
    <Document title={`Sworn Statement — ${data.projectName}`}>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>CONTRACTOR'S SWORN STATEMENT</Text>
        <Text style={styles.subtitle}>
          Affidavit of payment to subcontractors · Period ending {data.periodTo}
        </Text>

        {/* Project + party metadata */}
        <View style={styles.metaRow}>
          <View style={styles.metaCell}>
            <Text style={styles.formLabel}>Project</Text>
            <Text>{data.projectName}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.formLabel}>Project No.</Text>
            <Text>{data.projectNumber}</Text>
          </View>
          <View style={styles.metaCellLast}>
            <Text style={styles.formLabel}>Period To</Text>
            <Text>{data.periodTo}</Text>
          </View>
        </View>
        <View style={[styles.metaRow, { borderTop: 0 }]}>
          <View style={styles.metaCell}>
            <Text style={styles.formLabel}>Owner</Text>
            <Text>{data.ownerName}</Text>
          </View>
          <View style={styles.metaCellLast}>
            <Text style={styles.formLabel}>Contractor</Text>
            <Text>{data.contractorName}</Text>
          </View>
        </View>

        {/* Affidavit text */}
        <View style={styles.affidavitBlock}>
          <Text>
            The undersigned, <Text style={{ fontWeight: 'bold' }}>{data.contractorPrincipalName}</Text>,
            being duly sworn, deposes and says that they are authorized to act on
            behalf of <Text style={{ fontWeight: 'bold' }}>{data.contractorName}</Text>,
            the contractor on the above-referenced Project, and that the
            following is, to the best of their knowledge, a true and complete
            accounting of all subcontractors and material suppliers who have
            furnished or are expected to furnish labor and/or materials for the
            Project, the amounts of their respective contracts, amounts paid in
            prior periods, amounts being paid in the current period, and the
            balance remaining due.
          </Text>
        </View>

        {/* Subs table */}
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.colSub]}>Subcontractor</Text>
            <Text style={[styles.th, styles.colTrade]}>Trade</Text>
            <Text style={[styles.th, styles.colContract]}>Contract $</Text>
            <Text style={[styles.th, styles.colPaidPrior]}>Paid prior</Text>
            <Text style={[styles.th, styles.colPaidThis]}>Paid this period</Text>
            <Text style={[styles.thLast, styles.colBalance]}>Balance owed</Text>
          </View>
          {data.lines.map((line, idx) => {
            const isLast = idx === data.lines.length - 1;
            return (
              <View
                key={`${line.subName}-${idx}`}
                style={isLast ? styles.trLast : styles.tr}
              >
                <Text style={[styles.td, styles.colSub]}>{line.subName}</Text>
                <Text style={[styles.td, styles.colTrade]}>{line.trade}</Text>
                <Text style={[styles.td, styles.colContract]}>
                  {formatMoney(line.contractAmount)}
                </Text>
                <Text style={[styles.td, styles.colPaidPrior]}>
                  {formatMoney(line.paidPriorPeriods)}
                </Text>
                <Text style={[styles.td, styles.colPaidThis]}>
                  {formatMoney(line.paidThisPeriod)}
                </Text>
                <Text style={[styles.tdLast, styles.colBalance]}>
                  {formatMoney(line.balanceOwed)}
                </Text>
              </View>
            );
          })}
          <View style={styles.totalsRow}>
            <Text style={[styles.td, styles.colSub, { fontWeight: 'bold' }]}>Totals</Text>
            <Text style={[styles.td, styles.colTrade]}></Text>
            <Text style={[styles.td, styles.colContract, { fontWeight: 'bold' }]}>
              {formatMoney(data.totalContractAmount)}
            </Text>
            <Text style={[styles.td, styles.colPaidPrior, { fontWeight: 'bold' }]}>
              {formatMoney(data.totalPaidPriorPeriods)}
            </Text>
            <Text style={[styles.td, styles.colPaidThis, { fontWeight: 'bold' }]}>
              {formatMoney(data.totalPaidThisPeriod)}
            </Text>
            <Text style={[styles.tdLast, styles.colBalance, { fontWeight: 'bold' }]}>
              {formatMoney(data.totalBalanceOwed)}
            </Text>
          </View>
        </View>

        {/* Signature */}
        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureCaption}>
              {data.contractorPrincipalName} — for {data.contractorName}
            </Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureCaption}>Date</Text>
          </View>
        </View>

        {/* Notary */}
        <View style={styles.notaryBlock}>
          <Text style={styles.notaryHeading}>Notarization</Text>
          <Text>
            Subscribed and sworn to before me this _____ day of ________________,
            ________ , by {data.contractorPrincipalName}, who is personally known
            to me or who has produced satisfactory evidence of identification.
          </Text>
          <View style={[styles.signatureRow, { marginTop: 18 }]}>
            <View style={styles.signatureBlock}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureCaption}>Notary Public — signature</Text>
            </View>
            <View style={styles.signatureBlock}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureCaption}>Commission expires</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          Generated by constructor · facsimile sworn statement — for development & demo only
        </Text>
      </Page>
    </Document>
  );
}

function formatMoney(value: number): string {
  return (
    '$' +
    value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
