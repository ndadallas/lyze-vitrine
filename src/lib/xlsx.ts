import "server-only";

// Petit générateur .xlsx (relevés de revenus, demande 2026-11-22, mise en page soignée 2026-11-25) : sans dépendance.
// Chaque feuille = un rapport : grand titre, bloc d'infos, tableau (en-tête chocolat, lignes alternées, total), note.
// Zip « stocké » (sans compression) : fichiers de quelques Ko, Excel/Numbers/LibreOffice l'ouvrent normalement.

export type TypeCol = "texte" | "montant" | "entier" | "pourcent" | "date";
export type Valeur = string | number | Date | null;
export type Rapport = {
  nom: string; // nom de l'onglet
  titre: string;
  sousTitre?: string;
  infos?: [string, string][];
  colonnes: { titre: string; type: TypeCol; largeur: number; fort?: boolean }[];
  lignes: Valeur[][];
  total?: Valeur[];
  vide?: string; // texte affiché si aucune ligne
  note?: string;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const col = (i: number) => (i >= 26 ? String.fromCharCode(64 + Math.floor(i / 26)) : "") + String.fromCharCode(65 + (i % 26));

// Charte Lyze : chocolat #9C6644, brun #4A3426, sable clair
const BRUN = "FF4A3426", CHOCO = "FF9C6644", GRIS = "FF7A6A5E", TEXTE = "FF2B1D15";
const FONTS = [
  `<font><sz val="11"/><color rgb="${TEXTE}"/><name val="Calibri"/></font>`, // 0 normal
  `<font><b/><sz val="11"/><color rgb="${TEXTE}"/><name val="Calibri"/></font>`, // 1 gras
  `<font><b/><sz val="20"/><color rgb="${BRUN}"/><name val="Georgia"/></font>`, // 2 titre
  `<font><i/><sz val="11"/><color rgb="${CHOCO}"/><name val="Calibri"/></font>`, // 3 sous-titre
  `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>`, // 4 en-tête
  `<font><b/><sz val="10"/><color rgb="${GRIS}"/><name val="Calibri"/></font>`, // 5 étiquette
  `<font><i/><sz val="9"/><color rgb="${GRIS}"/><name val="Calibri"/></font>`, // 6 note
];
const fill = (rgb: string) => `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
const FILLS = [`<fill><patternFill patternType="none"/></fill>`, `<fill><patternFill patternType="gray125"/></fill>`, fill(CHOCO), fill("FFFAF5EF"), fill("FFEFE3D6")];
const BORDERS = [
  `<border><left/><right/><top/><bottom/><diagonal/></border>`,
  `<border><left/><right/><top/><bottom style="thin"><color rgb="FFE6D9CC"/></bottom><diagonal/></border>`, // ligne de tableau
  `<border><left/><right/><top style="medium"><color rgb="${CHOCO}"/></top><bottom style="medium"><color rgb="${CHOCO}"/></bottom><diagonal/></border>`, // total
  `<border><left/><right/><top/><bottom style="medium"><color rgb="${CHOCO}"/></bottom><diagonal/></border>`, // sous le titre
];

/** Styles de cellule : clé lisible → index dans cellXfs. */
function styles(devise: "MAD" | "EUR") {
  const fmts = [
    `<numFmt numFmtId="164" formatCode="${esc(devise === "EUR" ? '#,##0.00" €";[Red]-#,##0.00" €"' : '#,##0" MAD";[Red]-#,##0" MAD"')}"/>`,
    `<numFmt numFmtId="165" formatCode="dd/mm/yyyy"/>`,
  ];
  const xfs: string[] = [];
  const index: Record<string, number> = {};
  const xf = (cle: string, font: number, fillId = 0, border = 0, num = 0, align = "") => {
    index[cle] = xfs.length;
    xfs.push(
      `<xf numFmtId="${num}" fontId="${font}" fillId="${fillId}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"${align}/></xf>`,
    );
  };
  xf("normal", 0);
  xf("titre", 2, 0, 3);
  xf("sousTitre", 3);
  xf("etiquette", 5);
  xf("valeur", 1, 0, 0, 0, ' horizontal="left"');
  xf("entete", 4, 2, 0, 0, ' horizontal="center" wrapText="1"');
  xf("note", 6, 0, 0, 0, ' wrapText="1"');
  xf("vide", 3, 0, 1);
  const NUM: Record<TypeCol, number> = { texte: 0, montant: 164, entier: 3, pourcent: 9, date: 165 };
  for (const type of Object.keys(NUM) as TypeCol[]) {
    const align = type === "texte" ? "" : type === "date" ? ' horizontal="center"' : ' horizontal="right"';
    xf(type, 0, 0, 1, NUM[type], align);
    xf(`${type}-z`, 0, 3, 1, NUM[type], align); // ligne alternée
    xf(`${type}-f`, 1, 0, 1, NUM[type], align); // colonne mise en avant (net)
    xf(`${type}-fz`, 1, 3, 1, NUM[type], align);
    xf(`${type}-t`, 1, 4, 2, NUM[type], align); // ligne de total
  }
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="${fmts.length}">${fmts.join("")}</numFmts><fonts count="${FONTS.length}">${FONTS.join("")}</fonts><fills count="${FILLS.length}">${FILLS.join("")}</fills><borders count="${BORDERS.length}">${BORDERS.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return { xml, index };
}

// Date Excel = jours depuis le 30/12/1899 (dates du site stockées à minuit UTC)
const serie = (d: Date) => d.getTime() / 86400000 + 25569;

function cellule(v: Valeur, ref: string, s: number) {
  if (v === null || v === "") return `<c r="${ref}" s="${s}"/>`;
  if (v instanceof Date) return `<c r="${ref}" s="${s}"><v>${serie(v)}</v></c>`;
  if (typeof v === "number") return `<c r="${ref}" s="${s}"><v>${Number.isFinite(v) ? v : 0}</v></c>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

/** Une feuille-rapport : renvoie le XML et la ligne d'en-tête du tableau (répétée à l'impression). */
function feuilleXml(f: Rapport, st: Record<string, number>) {
  const n = f.colonnes.length;
  const der = col(n - 1);
  const rows: string[] = [];
  const fusions: string[] = [];
  const ligne = (cells: (r: number) => string, ht?: number) => {
    const r = rows.length + 1;
    rows.push(`<row r="${r}"${ht ? ` ht="${ht}" customHeight="1"` : ""}>${cells(r)}</row>`);
    return r;
  };
  // texte sur toute la largeur du tableau (cellules fusionnées, style répété pour garder la bordure)
  const pleine = (texte: string, style: string, ht?: number) => {
    const r = ligne((r) => f.colonnes.map((_, i) => cellule(i === 0 ? texte : null, `${col(i)}${r}`, st[style])).join(""), ht);
    fusions.push(`A${r}:${der}${r}`);
  };

  pleine(f.titre, "titre", 36);
  if (f.sousTitre) pleine(f.sousTitre, "sousTitre", 20);
  ligne(() => "", 8);
  for (const [k, v] of f.infos ?? []) {
    const r = ligne((r) => cellule(k.toUpperCase(), `A${r}`, st.etiquette) + cellule(v, `B${r}`, st.valeur), 18);
    if (n > 2) fusions.push(`B${r}:${der}${r}`);
  }
  ligne(() => "", 12);

  const entete = ligne((r) => f.colonnes.map((c, i) => cellule(c.titre, `${col(i)}${r}`, st.entete)).join(""), 32);
  if (!f.lignes.length && f.vide) pleine(f.vide, "vide", 22);
  f.lignes.forEach((l, k) => {
    const z = k % 2 === 1;
    ligne((r) => f.colonnes.map((c, i) => cellule(l[i] ?? null, `${col(i)}${r}`, st[`${c.type}${c.fort ? (z ? "-fz" : "-f") : z ? "-z" : ""}`])).join(""), 20);
  });
  if (f.total) ligne((r) => f.colonnes.map((c, i) => cellule(f.total![i] ?? null, `${col(i)}${r}`, st[`${c.type}-t`])).join(""), 24);
  if (f.note) {
    ligne(() => "", 10);
    pleine(f.note, "note", 32);
  }

  const cols = `<cols>${f.colonnes.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largeur}" customWidth="1"/>`).join("")}</cols>`;
  const xml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` +
    // grille masquée, en-tête du tableau figé au défilement
    `<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${entete}" topLeftCell="A${entete + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows.join("")}</sheetData>` +
    `<mergeCells count="${fusions.length}">${fusions.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` +
    `<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.7" header="0.3" footer="0.3"/>` +
    `<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>` +
    `<headerFooter><oddFooter>&amp;L&amp;8Lyze Conciergerie&amp;R&amp;8Page &amp;P / &amp;N</oddFooter></headerFooter>` +
    `</worksheet>`;
  return { xml, entete };
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

/** Classeur .xlsx (Buffer) : une feuille-rapport par entrée ; montants au format de la devise. */
export function classeur(feuilles: Rapport[], devise: "MAD" | "EUR"): Buffer {
  const ns = "http://schemas.openxmlformats.org";
  const { xml: stylesXml, index } = styles(devise);
  const rendues = feuilles.map((f) => feuilleXml(f, index));
  const nomFeuille = (f: Rapport) => esc(f.nom.slice(0, 31));
  const titresImpression = feuilles
    .map((f, i) => `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${nomFeuille(f).replace(/'/g, "''")}'!$${rendues[i].entete}:$${rendues[i].entete}</definedName>`)
    .join("");
  return zip([
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${feuilles.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets>${feuilles.map((f, i) => `<sheet name="${nomFeuille(f)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><definedNames>${titresImpression}</definedNames></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships">${feuilles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${feuilles.length + 1}" Type="${ns}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", stylesXml],
    ...rendues.map((r, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, r.xml]),
  ]);
}
