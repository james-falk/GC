// Minimal RFC 4180-ish CSV parser. Handles quoted fields, escaped quotes
// ("" → "), CRLF or LF line endings, and a leading BOM. No dep required —
// the alternative (papaparse) is fine but pulling it in just for SoV
// import is overkill. Throws on malformed input rather than silently
// dropping data.

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};

export function parseCsv(input: string): ParsedCsv {
  // Strip a leading UTF-8 BOM (Excel adds one when saving CSV-as-UTF-8).
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  if (text.trim().length === 0) {
    return { headers: [], rows: [] };
  }

  const records: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      // Skip; \n on the next iteration handles the row break.
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      records.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  // Flush the final field if file didn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  if (inQuotes) {
    throw new Error('CSV is malformed — unclosed quoted field');
  }

  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = records[0]!.map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < records.length; r++) {
    const cells = records[r]!;
    // Skip blank lines (single empty field).
    if (cells.length === 1 && cells[0]!.trim() === '') continue;
    if (cells.length !== headers.length) {
      throw new Error(
        `Row ${r + 1}: expected ${headers.length} columns, got ${cells.length}`,
      );
    }
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]!] = cells[c]!.trim();
    }
    rows.push(obj);
  }

  return { headers, rows };
}
