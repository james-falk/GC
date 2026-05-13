'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { parseCsv } from '@/lib/csv';

// SoV add-line. subcontractId is optional — NULL means a GC-internal cost
// line (bonding, permits, OH&P) with no subcontractor attached. When a
// value is provided we re-verify it belongs to the same project + tenant
// to prevent cross-project linking via a tampered form.

const AddSovLineInput = z.object({
  projectId: z.string().uuid(),
  lineNumber: z.string().trim().min(1).max(32),
  description: z.string().trim().min(1).max(500),
  contractAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'must be a positive amount with up to 2 decimal places'),
  subcontractId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  parentLineId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export async function addSovLine(formData: FormData) {
  const tenant = await getCurrentTenant();
  const parsed = AddSovLineInput.parse({
    projectId: formData.get('projectId'),
    lineNumber: formData.get('lineNumber'),
    description: formData.get('description'),
    contractAmount: formData.get('contractAmount'),
    subcontractId: formData.get('subcontractId'),
    parentLineId: formData.get('parentLineId'),
  });

  // Confirm the project belongs to this tenant AND isn't archived before
  // inserting against it.
  const [project] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, parsed.projectId),
        eq(schema.projects.tenantId, tenant.id),
        isNull(schema.projects.deletedAt),
      ),
    )
    .limit(1);

  if (!project) {
    throw new Error('Project not found in current tenant or has been archived');
  }

  // If a subcontract was picked, verify it belongs to this project + tenant.
  if (parsed.subcontractId) {
    const [sub] = await db
      .select({ id: schema.subcontracts.id })
      .from(schema.subcontracts)
      .where(
        and(
          eq(schema.subcontracts.id, parsed.subcontractId),
          eq(schema.subcontracts.projectId, parsed.projectId),
          eq(schema.subcontracts.tenantId, tenant.id),
        ),
      )
      .limit(1);
    if (!sub) {
      throw new Error('Subcontract not found on this project');
    }
  }

  // If a parent line was picked, verify it belongs to this same project +
  // tenant AND is itself a top-level line (parent_line_id IS NULL). Only
  // a single level of nesting is supported — that matches Spartan's "3a/3b"
  // pattern and avoids the renderer needing to think about deeper trees.
  if (parsed.parentLineId) {
    const [parent] = await db
      .select({ parentLineId: schema.sovLines.parentLineId })
      .from(schema.sovLines)
      .where(
        and(
          eq(schema.sovLines.id, parsed.parentLineId),
          eq(schema.sovLines.projectId, parsed.projectId),
          eq(schema.sovLines.tenantId, tenant.id),
        ),
      )
      .limit(1);
    if (!parent) {
      throw new Error('Parent SoV line not found on this project');
    }
    if (parent.parentLineId !== null) {
      throw new Error(
        'Cannot nest under a child line — parent must be a top-level SoV line',
      );
    }
  }

  await db.insert(schema.sovLines).values({
    tenantId: tenant.id,
    projectId: parsed.projectId,
    lineNumber: parsed.lineNumber,
    description: parsed.description,
    contractAmount: parsed.contractAmount,
    // current_amount tracks the running value after CO adjustments — initialized
    // to the original contract amount and updated atomically on CO approval.
    currentAmount: parsed.contractAmount,
    subcontractId: parsed.subcontractId ?? null,
    parentLineId: parsed.parentLineId ?? null,
  });

  revalidatePath(`/projects/${parsed.projectId}`);
}

// SoV bulk import via CSV. Schema:
//   line_number,description,parent_line_number,contract_number,contract_amount
// Required columns: line_number, description, contract_amount.
// Optional: parent_line_number (refs another line in the SAME csv) and
// contract_number (refs an existing subcontract on this project by its
// contract_number — case-sensitive match).
//
// Two-pass insert: parents first (so we have their UUIDs), then children
// resolving parent_line_id via the line_number → id map. All wrapped in
// one transaction, so any validation failure rolls everything back.

const ImportSovCsvInput = z.object({
  projectId: z.string().uuid(),
  csv: z.string().min(1, 'csv is required'),
});

const REQUIRED_HEADERS = ['line_number', 'description', 'contract_amount'] as const;
const OPTIONAL_HEADERS = ['parent_line_number', 'contract_number'] as const;
const KNOWN_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];

const AMOUNT_REGEX = /^-?\d+(\.\d{1,2})?$/;

export async function importSovCsv(formData: FormData): Promise<void> {
  const tenant = await getCurrentTenant();
  const parsed = ImportSovCsvInput.parse({
    projectId: formData.get('projectId'),
    csv: formData.get('csv'),
  });

  // Project belongs to tenant + active.
  const [project] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, parsed.projectId),
        eq(schema.projects.tenantId, tenant.id),
        isNull(schema.projects.deletedAt),
      ),
    )
    .limit(1);
  if (!project) {
    throw new Error('Project not found in current tenant or has been archived');
  }

  let parsedCsv;
  try {
    parsedCsv = parseCsv(parsed.csv);
  } catch (err) {
    const m = err instanceof Error ? err.message : 'parse failed';
    throw new Error(`Could not parse CSV: ${m}`);
  }

  if (parsedCsv.rows.length === 0) {
    throw new Error('CSV has no data rows');
  }

  const missing = REQUIRED_HEADERS.filter((h) => !parsedCsv.headers.includes(h));
  if (missing.length > 0) {
    throw new Error(
      `CSV is missing required column(s): ${missing.join(', ')}. ` +
        `Expected: ${KNOWN_HEADERS.join(', ')}`,
    );
  }
  const unknown = parsedCsv.headers.filter((h) => !KNOWN_HEADERS.includes(h as never));
  if (unknown.length > 0) {
    throw new Error(`CSV has unknown column(s): ${unknown.join(', ')}`);
  }

  // Validate every row, collect errors before bailing so the user sees
  // all problems at once rather than fixing them one-by-one.
  const errors: string[] = [];
  const seenLineNumbers = new Set<string>();
  type StagedRow = {
    rowIndex: number; // 1-based, matches the CSV row number user sees
    lineNumber: string;
    description: string;
    contractAmount: string;
    parentLineNumber: string | null;
    contractNumber: string | null;
  };
  const staged: StagedRow[] = [];

  for (let i = 0; i < parsedCsv.rows.length; i++) {
    const r = parsedCsv.rows[i]!;
    const csvRow = i + 2; // +1 for 0-index, +1 for header row
    const lineNumber = (r.line_number ?? '').trim();
    const description = (r.description ?? '').trim();
    const amount = (r.contract_amount ?? '').trim();
    const parentLineNumber = (r.parent_line_number ?? '').trim();
    const contractNumber = (r.contract_number ?? '').trim();

    if (!lineNumber) errors.push(`Row ${csvRow}: line_number is required`);
    if (lineNumber.length > 32)
      errors.push(`Row ${csvRow}: line_number exceeds 32 chars`);
    if (!description) errors.push(`Row ${csvRow}: description is required`);
    if (description.length > 500)
      errors.push(`Row ${csvRow}: description exceeds 500 chars`);
    if (!amount) errors.push(`Row ${csvRow}: contract_amount is required`);
    else if (!AMOUNT_REGEX.test(amount))
      errors.push(
        `Row ${csvRow}: contract_amount '${amount}' must be numeric with up to 2 decimal places`,
      );

    if (lineNumber && seenLineNumbers.has(lineNumber)) {
      errors.push(`Row ${csvRow}: duplicate line_number '${lineNumber}' in CSV`);
    }
    seenLineNumbers.add(lineNumber);

    staged.push({
      rowIndex: csvRow,
      lineNumber,
      description,
      contractAmount: amount,
      parentLineNumber: parentLineNumber || null,
      contractNumber: contractNumber || null,
    });
  }

  // Cross-row validation: parents must exist in this CSV and not themselves
  // be children. Mirrors the one-level-deep nesting rule from addSovLine.
  const lineNumbersInCsv = new Set(staged.map((s) => s.lineNumber));
  const childrenOfInCsv = new Set(
    staged.filter((s) => s.parentLineNumber).map((s) => s.parentLineNumber!),
  );
  for (const s of staged) {
    if (s.parentLineNumber) {
      if (!lineNumbersInCsv.has(s.parentLineNumber)) {
        errors.push(
          `Row ${s.rowIndex}: parent_line_number '${s.parentLineNumber}' not found elsewhere in this CSV`,
        );
      }
      // If this row is itself referenced as a parent, it can't have a parent.
      if (childrenOfInCsv.has(s.lineNumber)) {
        errors.push(
          `Row ${s.rowIndex}: '${s.lineNumber}' is referenced as a parent by another row but also has a parent_line_number — only one level of nesting is supported`,
        );
      }
    }
  }

  // Resolve subcontract references (contract_number → subcontract.id) in
  // one query.
  const distinctContractNumbers = Array.from(
    new Set(staged.filter((s) => s.contractNumber).map((s) => s.contractNumber!)),
  );
  const subsByContractNumber = new Map<string, string>();
  if (distinctContractNumbers.length > 0) {
    const subs = await db
      .select({
        id: schema.subcontracts.id,
        contractNumber: schema.subcontracts.contractNumber,
      })
      .from(schema.subcontracts)
      .where(
        and(
          eq(schema.subcontracts.projectId, parsed.projectId),
          eq(schema.subcontracts.tenantId, tenant.id),
        ),
      );
    for (const s of subs) {
      subsByContractNumber.set(s.contractNumber, s.id);
    }
    for (const s of staged) {
      if (s.contractNumber && !subsByContractNumber.has(s.contractNumber)) {
        errors.push(
          `Row ${s.rowIndex}: contract_number '${s.contractNumber}' not found on this project — add the subcontract first or remove the reference`,
        );
      }
    }
  }

  if (errors.length > 0) {
    // Report up to the first 20 errors — long enough to be useful, short
    // enough to fit in a flash banner without overwhelming the user.
    const display = errors.slice(0, 20).join('\n  • ');
    const more = errors.length > 20 ? `\n  …and ${errors.length - 20} more` : '';
    throw new Error(`CSV has ${errors.length} validation error(s):\n  • ${display}${more}`);
  }

  // All-clear. Two-pass insert in one transaction.
  await db.transaction(async (tx) => {
    const idByLineNumber = new Map<string, string>();

    // Pass 1: top-level rows (no parent_line_number).
    const topLevel = staged.filter((s) => !s.parentLineNumber);
    if (topLevel.length > 0) {
      const inserted = await tx
        .insert(schema.sovLines)
        .values(
          topLevel.map((s) => ({
            tenantId: tenant.id,
            projectId: parsed.projectId,
            lineNumber: s.lineNumber,
            description: s.description,
            contractAmount: s.contractAmount,
            currentAmount: s.contractAmount,
            subcontractId: s.contractNumber
              ? subsByContractNumber.get(s.contractNumber)!
              : null,
            parentLineId: null,
          })),
        )
        .returning({ id: schema.sovLines.id, lineNumber: schema.sovLines.lineNumber });
      for (const row of inserted) {
        idByLineNumber.set(row.lineNumber, row.id);
      }
    }

    // Pass 2: children, looking up parent id via the map populated above.
    const children = staged.filter((s) => s.parentLineNumber);
    if (children.length > 0) {
      await tx.insert(schema.sovLines).values(
        children.map((s) => {
          const parentId = idByLineNumber.get(s.parentLineNumber!);
          if (!parentId) {
            // Should be unreachable — we validated above. Defensive throw
            // to roll the tx back rather than insert with a NULL parent.
            throw new Error(
              `Internal: parent line_number '${s.parentLineNumber}' resolved to no id`,
            );
          }
          return {
            tenantId: tenant.id,
            projectId: parsed.projectId,
            lineNumber: s.lineNumber,
            description: s.description,
            contractAmount: s.contractAmount,
            currentAmount: s.contractAmount,
            subcontractId: s.contractNumber
              ? subsByContractNumber.get(s.contractNumber)!
              : null,
            parentLineId: parentId,
          };
        }),
      );
    }
  });

  revalidatePath(`/projects/${parsed.projectId}`);
}
