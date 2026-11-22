import "server-only";

// Petit générateur .xlsx (relevés de revenus, demande 2026-11-22) : feuilles de lignes, sans dépendance.
// Zip « stocké » (sans compression) : fichiers de quelques Ko, Excel/Numbers/LibreOffice l'ouvrent normalement.

export type Cellule = string | number | null | { v: string | number; gras?: boolean };
export type Feuille = { nom: string; largeurs?: number[]; lignes: Cellule[][] };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const col = (i: number) => (i >= 26 ? String.fromCharCode(64 + Math.floor(i / 26)) : "") + String.fromCharCode(65 + (i % 26));

// styles : 0 normal, 1 gras, 2 nombre « 1 234 », 3 nombre gras
function cellule(c: Cellule, ref: string) {
  if (c === null || c === "") return "";
  const { v, gras } = typeof c === "object" ? c : { v: c, gras: false };
  if (typeof v === "number") return `<c r="${ref}" s="${gras ? 3 : 2}"><v>${Math.round(v)}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${gras ? ' s="1"' : ""}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

function feuilleXml(f: Feuille) {
  const cols = f.largeurs?.length
    ? `<cols>${f.largeurs.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const lignes = f.lignes
    .map((l, r) => `<row r="${r + 1}">${l.map((c, i) => cellule(c, `${col(i)}${r + 1}`)).join("")}</row>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${lignes}</sheetData></worksheet>`;
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(b: Buffer) {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(fichiers: [string, string][]) {
  const locaux: Buffer[] = [];
  const centraux: Buffer[] = [];
  let offset = 0;
  for (const [nom, contenu] of fichiers) {
    const n = Buffer.from(nom, "utf8");
    const d = Buffer.from(contenu, "utf8");
    const crc = crc32(d);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(d.length, 18); h.writeUInt32LE(d.length, 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(d.length, 20); c.writeUInt32LE(d.length, 24); c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    locaux.push(h, n, d);
    centraux.push(c, n);
    offset += 30 + n.length + d.length;
  }
  const taille = centraux.reduce((s, b) => s + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(fichiers.length, 8); fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(taille, 12); fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...locaux, ...centraux, fin]);
}

/** Classeur .xlsx (Buffer) à partir de feuilles de lignes. */
export function classeur(feuilles: Feuille[]): Buffer {
  const ns = "http://schemas.openxmlformats.org";
  return zip([
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${feuilles.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets>${feuilles.map((f, i) => `<sheet name="${esc(f.nom.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships">${feuilles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${feuilles.length + 1}" Type="${ns}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${ns}/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="3" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
    ...feuilles.map((f, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, feuilleXml(f)]),
  ]);
}
