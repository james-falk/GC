import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

// Generic magic-link email — used for all magic-link recipients
// (sub on pay-app submission, architect/owner on CO approval).

type Props = {
  recipientLabel: string; // e.g. "Springfield Public Schools"
  documentLabel: string; // e.g. "AIA pay app", "Change Order CO-001"
  projectName: string;
  contractorName: string;
  approvalUrl: string;
  expiresInHours: number;
};

export function MagicLinkEmail({
  recipientLabel,
  documentLabel,
  projectName,
  contractorName,
  approvalUrl,
  expiresInHours,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{`${contractorName} sent you a ${documentLabel} for review`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading as="h1" style={h1}>
            constructor
          </Heading>
          <Text style={paragraph}>Hi {recipientLabel},</Text>
          <Text style={paragraph}>
            <strong>{contractorName}</strong> has sent you a{' '}
            <strong>{documentLabel}</strong> for review on project{' '}
            <strong>{projectName}</strong>.
          </Text>
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button style={button} href={approvalUrl}>
              Review and approve
            </Button>
          </Section>
          <Text style={paragraph}>
            This link is single-use and expires in {expiresInHours} hours. If
            you weren&rsquo;t expecting this email, you can ignore it.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>Sent by {contractorName} via constructor.</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: '#f8fafc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container = {
  margin: '40px auto',
  padding: '24px',
  maxWidth: '560px',
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
};

const h1 = {
  fontSize: '20px',
  fontWeight: '600',
  margin: '0 0 16px 0',
  color: '#0f172a',
};

const paragraph = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#1e293b',
  margin: '0 0 12px 0',
};

const button = {
  backgroundColor: '#1d4ed8',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  display: 'inline-block',
  padding: '12px 24px',
};

const hr = {
  borderColor: '#e2e8f0',
  margin: '24px 0',
};

const footer = {
  fontSize: '11px',
  color: '#94a3b8',
  textAlign: 'center' as const,
  margin: 0,
};
