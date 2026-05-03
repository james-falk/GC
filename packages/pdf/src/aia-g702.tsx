// AIA G702 — Application and Certificate for Payment.
// The cover sheet that accompanies a G703 continuation sheet on every
// GC -> Owner pay app. This is a credible facsimile of the official
// AIA G702-1992/2017 form layout, not a pixel-perfect reproduction —
// the official form is copyrighted and licensed by AIA. Real distribution
// to architects/owners would use the official form via licensed software.
//
// Phase C scope: G702 cover sheet only. G703 continuation sheet (the
// line-by-line breakdown) lands as a follow-up — it's a complex
// multi-page table that deserves its own pass.

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export type AiaG702Data = {
  // Project + parties
  projectName: string;
  projectNumber: string;
  ownerName: string;
  contractorName: string;
  architectName: string;

  // Pay app metadata
  applicationNumber: string;
  periodTo: string; // ISO date e.g. "2026-03-31"
  invoiceDate: string;
  contractDate?: string;

  // Financials (all dollars, plain numbers)
  originalContractSum: number;
  netChangeByCO: number;
  contractSumToDate: number;
  totalCompletedAndStored: number;
  retentionAmount: number;
  totalEarnedLessRetention: number;
  lessPreviousCertificates: number;
  currentPaymentDue: number;
  balanceToFinish: number;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#0f172a',
  },
  formLabel: {
    fontSize: 7,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
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
  headerRow: {
    flexDirection: 'row',
    borderTop: '1pt solid #0f172a',
    borderLeft: '1pt solid #0f172a',
    borderRight: '1pt solid #0f172a',
  },
  headerCell: {
    flex: 1,
    padding: 6,
    borderRight: '1pt solid #0f172a',
  },
  headerCellLast: {
    flex: 1,
    padding: 6,
  },
  partyRow: {
    flexDirection: 'row',
    borderLeft: '1pt solid #0f172a',
    borderRight: '1pt solid #0f172a',
    borderBottom: '1pt solid #0f172a',
  },
  partyCol: {
    flex: 1,
    padding: 6,
    borderRight: '1pt solid #0f172a',
  },
  partyColLast: {
    flex: 1,
    padding: 6,
  },
  partyValue: {
    fontSize: 10,
    marginTop: 2,
  },
  applicationBlock: {
    marginTop: 14,
  },
  applicationIntro: {
    fontSize: 9,
    lineHeight: 1.4,
    marginBottom: 10,
  },
  financialTable: {
    borderTop: '1pt solid #0f172a',
    borderLeft: '1pt solid #0f172a',
    borderRight: '1pt solid #0f172a',
  },
  finRow: {
    flexDirection: 'row',
    borderBottom: '1pt solid #0f172a',
  },
  finRowAccent: {
    flexDirection: 'row',
    borderBottom: '1pt solid #0f172a',
    backgroundColor: '#f1f5f9',
  },
  finLabel: {
    flex: 5,
    padding: 6,
    borderRight: '1pt solid #0f172a',
  },
  finValue: {
    flex: 2,
    padding: 6,
    textAlign: 'right',
  },
  finLabelBold: {
    flex: 5,
    padding: 6,
    borderRight: '1pt solid #0f172a',
    fontWeight: 'bold',
  },
  finValueBold: {
    flex: 2,
    padding: 6,
    textAlign: 'right',
    fontWeight: 'bold',
  },
  certBlock: {
    marginTop: 18,
    fontSize: 8,
    lineHeight: 1.5,
  },
  certHeading: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  signatureRow: {
    flexDirection: 'row',
    marginTop: 24,
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

// Standalone Document — useful when you only want the cover sheet.
export function AiaG702({ data }: { data: AiaG702Data }) {
  return (
    <Document title={`AIA G702 — Pay App #${data.applicationNumber}`}>
      <AiaG702Page data={data} />
    </Document>
  );
}

// Just the Page contents — composable inside a multi-page Document
// alongside G703 continuation pages.
export function AiaG702Page({ data }: { data: AiaG702Data }) {
  return (
    <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>APPLICATION AND CERTIFICATE FOR PAYMENT</Text>
        <Text style={styles.subtitle}>
          AIA Document G702 — facsimile · Period ending {data.periodTo}
        </Text>

        {/* Header — application metadata */}
        <View style={styles.headerRow}>
          <View style={styles.headerCell}>
            <Text style={styles.formLabel}>Application No.</Text>
            <Text>{data.applicationNumber}</Text>
          </View>
          <View style={styles.headerCell}>
            <Text style={styles.formLabel}>Period To</Text>
            <Text>{data.periodTo}</Text>
          </View>
          <View style={styles.headerCell}>
            <Text style={styles.formLabel}>Invoice Date</Text>
            <Text>{data.invoiceDate}</Text>
          </View>
          <View style={styles.headerCellLast}>
            <Text style={styles.formLabel}>Contract Date</Text>
            <Text>{data.contractDate ?? '—'}</Text>
          </View>
        </View>

        {/* Parties */}
        <View style={styles.partyRow}>
          <View style={styles.partyCol}>
            <Text style={styles.formLabel}>To Owner</Text>
            <Text style={styles.partyValue}>{data.ownerName}</Text>
          </View>
          <View style={styles.partyCol}>
            <Text style={styles.formLabel}>From Contractor</Text>
            <Text style={styles.partyValue}>{data.contractorName}</Text>
          </View>
          <View style={styles.partyColLast}>
            <Text style={styles.formLabel}>Via Architect</Text>
            <Text style={styles.partyValue}>{data.architectName}</Text>
          </View>
        </View>

        <View style={styles.partyRow}>
          <View style={styles.partyCol}>
            <Text style={styles.formLabel}>Project</Text>
            <Text style={styles.partyValue}>{data.projectName}</Text>
          </View>
          <View style={styles.partyColLast}>
            <Text style={styles.formLabel}>Project No.</Text>
            <Text style={styles.partyValue}>{data.projectNumber}</Text>
          </View>
        </View>

        {/* Application narrative */}
        <View style={styles.applicationBlock}>
          <Text style={styles.applicationIntro}>
            Application is made for payment, as shown below, in connection with
            the Contract. The continuation sheet (G703) is attached.
          </Text>

          {/* Financial summary table */}
          <View style={styles.financialTable}>
            <View style={styles.finRow}>
              <Text style={styles.finLabel}>1. Original Contract Sum</Text>
              <Text style={styles.finValue}>{formatMoney(data.originalContractSum)}</Text>
            </View>
            <View style={styles.finRow}>
              <Text style={styles.finLabel}>2. Net Change by Change Orders</Text>
              <Text style={styles.finValue}>{formatMoney(data.netChangeByCO)}</Text>
            </View>
            <View style={styles.finRowAccent}>
              <Text style={styles.finLabelBold}>3. Contract Sum to Date (1 + 2)</Text>
              <Text style={styles.finValueBold}>{formatMoney(data.contractSumToDate)}</Text>
            </View>
            <View style={styles.finRow}>
              <Text style={styles.finLabel}>4. Total Completed and Stored to Date</Text>
              <Text style={styles.finValue}>{formatMoney(data.totalCompletedAndStored)}</Text>
            </View>
            <View style={styles.finRow}>
              <Text style={styles.finLabel}>5. Retainage</Text>
              <Text style={styles.finValue}>{formatMoney(data.retentionAmount)}</Text>
            </View>
            <View style={styles.finRow}>
              <Text style={styles.finLabel}>6. Total Earned Less Retainage (4 - 5)</Text>
              <Text style={styles.finValue}>{formatMoney(data.totalEarnedLessRetention)}</Text>
            </View>
            <View style={styles.finRow}>
              <Text style={styles.finLabel}>7. Less Previous Certificates for Payment</Text>
              <Text style={styles.finValue}>{formatMoney(data.lessPreviousCertificates)}</Text>
            </View>
            <View style={styles.finRowAccent}>
              <Text style={styles.finLabelBold}>8. Current Payment Due (6 - 7)</Text>
              <Text style={styles.finValueBold}>{formatMoney(data.currentPaymentDue)}</Text>
            </View>
            <View style={styles.finRow}>
              <Text style={styles.finLabel}>9. Balance to Finish, Including Retainage (3 - 6)</Text>
              <Text style={styles.finValue}>{formatMoney(data.balanceToFinish)}</Text>
            </View>
          </View>
        </View>

        {/* Certification */}
        <View style={styles.certBlock}>
          <Text style={styles.certHeading}>Contractor's Certification</Text>
          <Text>
            The undersigned Contractor certifies that to the best of the Contractor's
            knowledge, information and belief the Work covered by this Application
            for Payment has been completed in accordance with the Contract Documents,
            that all amounts have been paid by the Contractor for Work for which
            previous Certificates for Payment were issued and payments received
            from the Owner, and that current payment shown herein is now due.
          </Text>
        </View>

        {/* Signatures */}
        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureCaption}>Contractor — signature & date</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureCaption}>Architect — certificate for payment</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Generated by constructor · facsimile of AIA G702 — for development & demo only
        </Text>
      </Page>
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
