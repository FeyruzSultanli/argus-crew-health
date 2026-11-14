// Minimal RFC 4180 CSV parser for the OSDR files (quoted fields, "" escapes, CRLF/LF, UTF-8 BOM).
// Returns one record per data row keyed by the header names.

export function parseCsv(text: string): Array<Record<string, string>> {
  const rows = parseRows(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  const header = rows.shift();
  if (!header) return [];
  return rows
    .filter((r) => r.length > 1 || (r[0] ?? '') !== '')
    .map((r) => {
      const rec: Record<string, string> = {};
      header.forEach((h, i) => {
        rec[h.trim()] = (r[i] ?? '').trim();
      });
      return rec;
    });
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
