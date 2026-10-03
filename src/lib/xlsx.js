// Minimal .xlsx writer with no dependency: each sheet is { name, rows } where rows[0] is the header.
// Numbers stay numbers, everything else is text. Header row is bold and frozen; columns are sized to fit.
const enc = new TextEncoder();
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const col = i => { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS = 'http://schemas.openxmlformats.org';

function sheetXml(rows) {
  const width = rows[0].length;
  const cells = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
    const at = `r="${col(ci)}${ri + 1}"${ri === 0 ? ' s="1"' : ''}`;
    if (v == null || v === '') return '';
    return typeof v === 'number' && isFinite(v) ? `<c ${at}><v>${v}</v></c>` : `<c ${at} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const cols = Array.from({ length: width }, (_, ci) => {
    const w = Math.min(60, Math.max(8, ...rows.slice(0, 300).map(r => String(r[ci] == null ? '' : r[ci]).length * 1.15 + 2)));
    return `<col min="${ci + 1}" max="${ci + 1}" width="${w.toFixed(1)}" customWidth="1"/>`;
  }).join('');
  return `${XML}<worksheet xmlns="${NS}/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${cells}</sheetData></worksheet>`;
}

/* ---------- zip (stored, no compression) ---------- */
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zip(files) {
  const parts = [], central = []; let offset = 0;
  const head = (sig, fields) => { const b = new DataView(new ArrayBuffer(fields.reduce((n, [s]) => n + s, 4))); b.setUint32(0, sig, true); let o = 4; fields.forEach(([s, v]) => { s === 2 ? b.setUint16(o, v, true) : b.setUint32(o, v, true); o += s; }); return new Uint8Array(b.buffer); };
  files.forEach(([name, text]) => {
    const n = enc.encode(name), d = enc.encode(text), crc = crc32(d);
    const common = [[2, 20], [2, 0x0800], [2, 0], [2, 0], [2, 0x21], [4, crc], [4, d.length], [4, d.length], [2, n.length], [2, 0]];
    parts.push(head(0x04034b50, common), n, d);
    central.push(head(0x02014b50, [[2, 20], ...common, [2, 0], [2, 0], [2, 0], [4, 0], [4, offset]]), n);
    offset += 30 + n.length + d.length;
  });
  const size = central.reduce((s, b) => s + b.length, 0);
  return new Blob([...parts, ...central, head(0x06054b50, [[2, 0], [2, 0], [2, files.length], [2, files.length], [4, size], [4, offset], [2, 0]])], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function xlsx(sheets) {
  const names = sheets.map(s => s.name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31));
  return zip([
    ['[Content_Types].xml', `${XML}<Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `${XML}<Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `${XML}<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${XML}<Relationships xmlns="${NS}/package/2006/relationships">${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${names.length + 1}" Type="${NS}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', `${XML}<styleSheet xmlns="${NS}/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6F2EA"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows)]),
  ]);
}

/** saves a Blob or text through the browser's normal download */
export function download(filename, data, type = 'text/csv;charset=utf-8') {
  const blob = data instanceof Blob ? data : new Blob([data], { type }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
