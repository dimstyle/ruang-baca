#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT_DIR = resolve(import.meta.dirname, '..');
const SRC_DIR = join(
  ROOT_DIR,
  'docs',
  'uml',
  'src',
  'diagrams',
  'list-diagrams',
);
const OUT_DIR = join(ROOT_DIR, 'docs', 'diagrams');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapDiagram({ id, name, width = 1600, height = 1200, cells }) {
  return [
    `  <diagram id="${esc(id)}" name="${esc(name)}">`,
    `    <mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${width}" pageHeight="${height}" math="0" shadow="0">`,
    `      <root>`,
    `        <mxCell id="0" />`,
    `        <mxCell id="1" parent="0" />`,
    ...cells.map((c) => `        ${c}`),
    `      </root>`,
    `    </mxGraphModel>`,
    `  </diagram>`,
  ].join('\n');
}

function wrapMxFile(diagramBlocks) {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<mxfile host="app.diagrams.net" agent="ruang-baca-drawio-generator" version="24.7.17">`,
    ...diagramBlocks,
    `</mxfile>`,
    ``,
  ].join('\n');
}

// ============================================================================
// 1. ERD Builders (erd.mmd — Crow's Foot & Chen Notation)
// ============================================================================
function parseErd(source) {
  const tables = new Map();
  const relations = [];

  let currentTable = null;
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line === 'erDiagram') continue;

    const relMatch = line.match(
      /^([a-zA-Z0-9_]+)\s+(\|\|--o\||\|\|--o\{)\s+([a-zA-Z0-9_]+)\s*:\s*"([^"]+)"$/,
    );
    if (relMatch) {
      relations.push({
        from: relMatch[1],
        card: relMatch[2],
        to: relMatch[3],
        label: relMatch[4],
      });
      continue;
    }

    const tableStart = line.match(/^([a-zA-Z0-9_]+)\s*\{$/);
    if (tableStart) {
      currentTable = tableStart[1];
      if (!tables.has(currentTable)) tables.set(currentTable, []);
      continue;
    }

    if (line === '}') {
      currentTable = null;
      continue;
    }

    if (currentTable) {
      const parts = line.split(/\s+/);
      const type = parts[0] ?? 'string';
      const colName = parts[1] ?? '';
      const key = parts[2] ?? '';
      tables.get(currentTable).push({ type, colName, key });
    }
  }

  return { tables, relations };
}

function buildErdDiagram(source) {
  const { tables, relations } = parseErd(source);

  const cells = [];
  // Topological order so directly related tables sit adjacent with minimal crossings
  const preferredOrder = [
    'refresh_token',
    'accounts',
    'categories',
    'books',
    'admins',
    'users',
    'temp_peminjaman',
    'peminjaman',
    'laporan',
    'temp_pengembalian',
    'pengembalian',
    'daftar_denda',
  ];
  const tableNames = [
    ...preferredOrder.filter((t) => tables.has(t)),
    ...[...tables.keys()].filter((t) => !preferredOrder.includes(t)),
  ];

  const colsPerRow = 4;
  const colWidth = 310;
  const colGap = 130;
  const rowGap = 110;

  let currentY = 60;
  let rowMaxHeight = 0;

  tableNames.forEach((tName, idx) => {
    const colIdx = idx % colsPerRow;
    if (colIdx === 0 && idx > 0) {
      currentY += rowMaxHeight + rowGap;
      rowMaxHeight = 0;
    }
    const x = 60 + colIdx * (colWidth + colGap);
    const fields = tables.get(tName) ?? [];
    const headerH = 34;
    const rowH = 26;
    const tableH = headerH + fields.length * rowH + 10;
    if (tableH > rowMaxHeight) rowMaxHeight = tableH;

    const tableId = `tbl_${tName}`;
    const rowsHtml = fields
      .map((f) => {
        const badge = f.key ? `[${f.key}] ` : '';
        return `${badge}${f.colName} : ${f.type}`;
      })
      .join('<br align="left"/>');

    const labelHtml = `<b>${esc(tName)}</b><hr size="1"/><p align="left" style="margin:4px 0 0 6px;line-height:1.45;">${rowsHtml}</p>`;
    cells.push(
      `<mxCell id="${esc(tableId)}" value="${esc(labelHtml)}" style="verticalAlign=top;align=center;overflow=fill;fontSize=12;fontFamily=Helvetica;html=1;rounded=1;fillColor=#dae8fc;strokeColor=#6c8ebf;shadow=1;" vertex="1" parent="1"><mxGeometry x="${x}" y="${currentY}" width="${colWidth}" height="${tableH}" as="geometry" /></mxCell>`,
    );
  });

  relations.forEach((rel, idx) => {
    const endArrow = rel.card === '||--o{' ? 'ERzeroToMany' : 'ERzeroToOne';
    const edgeId = `rel_${idx + 1}`;
    cells.push(
      `<mxCell id="${esc(edgeId)}" value="${esc(rel.label)}" style="edgeStyle=entityRelationEdgeStyle;fontSize=11;html=1;endArrow=${endArrow};startArrow=ERmandOne;rounded=1;strokeColor=#333333;labelBackgroundColor=#ffffff;" edge="1" parent="1" source="tbl_${esc(rel.from)}" target="tbl_${esc(rel.to)}"><mxGeometry relative="1" as="geometry" /></mxCell>`,
    );
  });

  const totalW = 60 * 2 + colsPerRow * colWidth + (colsPerRow - 1) * colGap;
  return wrapDiagram({
    id: 'erd',
    name: 'erd',
    width: totalW,
    height: currentY + rowMaxHeight + 120,
    cells,
  });
}

function buildErdChenDiagram(source) {
  const { tables, relations } = parseErd(source);
  const cells = [];

  // Title header
  cells.push(
    `<mxCell id="chen_title" value="&lt;b&gt;Entity Relationship Diagram (ERD) — Ruang Baca (Notasi Chen)&lt;/b&gt;" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontSize=22;fontFamily=Helvetica;fontColor=#1F1F1F;" vertex="1" parent="1"><mxGeometry x="1250" y="30" width="1500" height="44" as="geometry" /></mxCell>`,
  );

  // Planar coordinates (center x, center y) & curated attribute offsets for each entity
  const entityLayout = {
    refresh_token: {
      cx: 520,
      cy: 450,
      w: 164,
      h: 54,
      attrs: [
        [-50, -175],
        [-195, -125],
        [-265, -35],
        [-245, 65],
        [-130, 145],
      ],
    },
    accounts: {
      cx: 1460,
      cy: 450,
      w: 156,
      h: 54,
      attrs: [
        [-365, -135],
        [-235, -210],
        [-80, -255],
        [80, -255],
        [235, -210],
        [365, -135],
      ],
    },
    categories: {
      cx: 3420,
      cy: 450,
      w: 156,
      h: 54,
      attrs: [
        [-185, -145],
        [0, -195],
        [195, -145],
      ],
    },
    admins: {
      cx: 640,
      cy: 1150,
      w: 156,
      h: 54,
      attrs: [
        [-150, -190],
        [-275, -130],
        [-330, -60],
        [-335, 10],
        [-315, 80],
        [-260, 145],
        [-150, 200],
      ],
    },
    users: {
      cx: 1860,
      cy: 1150,
      w: 156,
      h: 54,
      attrs: [
        [85, -185],
        [235, -135],
        [-245, -135],
        [-295, -65],
        [-300, 5],
        [-280, 75],
        [-215, 145],
      ],
    },
    temp_peminjaman: {
      cx: 2640,
      cy: 1150,
      w: 176,
      h: 54,
      attrs: [
        [-215, -145],
        [-80, -215],
        [80, -215],
        [230, -145],
      ],
    },
    books: {
      cx: 3420,
      cy: 1150,
      w: 156,
      h: 54,
      attrs: [
        [155, -205],
        [275, -145],
        [325, -80],
        [340, -15],
        [340, 50],
        [320, 115],
        [265, 180],
        [150, 235],
      ],
    },
    laporan: {
      cx: 640,
      cy: 1990,
      w: 156,
      h: 54,
      attrs: [
        [-265, -150],
        [-340, -80],
        [-365, -5],
        [-350, 75],
        [-295, 155],
        [-155, 240],
        [110, 275],
        [310, 195],
        [365, 105],
        [350, 15],
      ],
    },
    peminjaman: {
      cx: 1860,
      cy: 1950,
      w: 164,
      h: 54,
      attrs: [
        [-280, -75],
        [-315, 5],
        [-280, 85],
        [280, -75],
        [330, 5],
        [315, 85],
      ],
    },
    temp_pengembalian: {
      cx: 1400,
      cy: 2690,
      w: 184,
      h: 54,
      attrs: [
        [-255, -10],
        [-195, 125],
        [35, 170],
      ],
    },
    pengembalian: {
      cx: 2320,
      cy: 2690,
      w: 164,
      h: 54,
      attrs: [
        [-225, 120],
        [-85, 190],
        [120, 190],
        [255, 120],
      ],
    },
    daftar_denda: {
      cx: 3320,
      cy: 2690,
      w: 164,
      h: 54,
      attrs: [
        [65, -165],
        [265, -75],
        [265, 65],
        [65, 165],
      ],
    },
  };

  // Curated relationship diamond centers (keyed by `${from}__${to}__${label}`)
  const relationLayout = {
    accounts__refresh_token__has: { cx: 990, cy: 450 },
    accounts__admins__owns: { cx: 1040, cy: 790 },
    accounts__users__owns: { cx: 1660, cy: 790 },
    categories__books__contains: { cx: 3420, cy: 790 },
    users__temp_peminjaman__requests: { cx: 2250, cy: 1150 },
    books__temp_peminjaman__requested_in: { cx: 3030, cy: 1150 },
    admins__laporan__creates: { cx: 640, cy: 1560 },
    admins__peminjaman__manages: { cx: 1240, cy: 1530 },
    users__peminjaman__places: { cx: 1860, cy: 1530 },
    books__peminjaman__referenced_in: { cx: 2700, cy: 1550 },
    peminjaman__temp_pengembalian__pending_return: { cx: 1600, cy: 2320 },
    peminjaman__pengembalian__has: { cx: 2120, cy: 2320 },
    pengembalian__daftar_denda__has: { cx: 2820, cy: 2690 },
  };

  const entityPositions = new Map();
  let fallbackIdx = 0;

  // Render Entities & their Attributes (Ovals)
  for (const [tName, fields] of tables.entries()) {
    let layout = entityLayout[tName];
    if (!layout) {
      const fx = 600 + (fallbackIdx % 3) * 900;
      const fy = 3150 + Math.floor(fallbackIdx / 3) * 520;
      fallbackIdx += 1;
      layout = { cx: fx, cy: fy, w: 164, h: 54, attrs: [] };
    }
    entityPositions.set(tName, layout);

    const entId = `chen_ent_${tName}`;
    const ex = Math.round(layout.cx - layout.w / 2);
    const ey = Math.round(layout.cy - layout.h / 2);

    // Strong Entity: Rectangle
    cells.push(
      `<mxCell id="${esc(entId)}" value="${esc(tName)}" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;strokeWidth=2;fontStyle=1;fontSize=13;fontFamily=Helvetica;shadow=1;" vertex="1" parent="1"><mxGeometry x="${ex}" y="${ey}" width="${layout.w}" height="${layout.h}" as="geometry" /></mxCell>`,
    );

    // Attributes: Ovals connected to Entity
    fields.forEach((f, idx) => {
      let dx = 0;
      let dy = 0;
      if (idx < layout.attrs.length) {
        [dx, dy] = layout.attrs[idx];
      } else {
        const angle = (idx / Math.max(1, fields.length)) * Math.PI * 2;
        dx = Math.round(Math.cos(angle) * 260);
        dy = Math.round(Math.sin(angle) * 180);
      }

      const isPk = f.key === 'PK';
      const isFk = f.key === 'FK';
      const isUk = f.key === 'UK';

      const displayText = isFk
        ? `${f.colName} (FK)`
        : isUk
          ? `${f.colName} (UK)`
          : f.colName;

      const aw = Math.max(106, Math.min(226, Math.round(displayText.length * 7.2 + 34)));
      const ah = 38;
      const ax = Math.round(layout.cx + dx - aw / 2);
      const ay = Math.round(layout.cy + dy - ah / 2);

      let valueHtml = esc(f.colName);
      let attrStyle =
        'ellipse;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#6c8ebf;strokeWidth=1.2;fontSize=11;fontFamily=Helvetica;';

      if (isPk) {
        valueHtml = `&lt;u&gt;&lt;b&gt;${esc(f.colName)}&lt;/b&gt;&lt;/u&gt;`;
        attrStyle =
          'ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;strokeWidth=1.8;fontSize=11;fontFamily=Helvetica;';
      } else if (isFk) {
        valueHtml = `&lt;i&gt;${esc(f.colName)}&lt;/i&gt; (FK)`;
        attrStyle =
          'ellipse;whiteSpace=wrap;html=1;dashed=1;dashPattern=6 4;fillColor=#f5f5f5;strokeColor=#666666;strokeWidth=1.4;fontSize=11;fontFamily=Helvetica;fontColor=#333333;';
      } else if (isUk) {
        valueHtml = `&lt;span style=&quot;border-bottom:1px dashed #6a3d9a;&quot;&gt;${esc(f.colName)}&lt;/span&gt; (UK)`;
        attrStyle =
          'ellipse;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;strokeWidth=1.5;fontSize=11;fontFamily=Helvetica;';
      }

      const attrId = `chen_attr_${tName}_${f.colName}`;
      const attrEdgeId = `chen_ae_${tName}_${f.colName}`;

      cells.push(
        `<mxCell id="${esc(attrId)}" value="${valueHtml}" style="${attrStyle}" vertex="1" parent="1"><mxGeometry x="${ax}" y="${ay}" width="${aw}" height="${ah}" as="geometry" /></mxCell>`,
      );
      cells.push(
        `<mxCell id="${esc(attrEdgeId)}" value="" style="endArrow=none;startArrow=none;html=1;strokeColor=#7a8b99;strokeWidth=1.1;" edge="1" parent="1" source="${esc(entId)}" target="${esc(attrId)}"><mxGeometry relative="1" as="geometry" /></mxCell>`,
      );
    });
  }

  // Render Relationships (Diamonds) & Cardinality Edges (1 / N)
  relations.forEach((rel, idx) => {
    const fromPos = entityPositions.get(rel.from);
    const toPos = entityPositions.get(rel.to);
    if (!fromPos || !toPos) return;

    const relKey = `${rel.from}__${rel.to}__${rel.label}`;
    const customPos = relationLayout[relKey];
    const rcx = customPos ? customPos.cx : Math.round((fromPos.cx + toPos.cx) / 2);
    const rcy = customPos ? customPos.cy : Math.round((fromPos.cy + toPos.cy) / 2);

    const rw = Math.max(134, Math.min(170, Math.round(rel.label.length * 8.5 + 48)));
    const rh = 74;
    const rx = Math.round(rcx - rw / 2);
    const ry = Math.round(rcy - rh / 2);

    const relId = `chen_rel_${idx + 1}`;
    const toCard = rel.card === '||--o{' ? 'N' : '1';

    cells.push(
      `<mxCell id="${esc(relId)}" value="${esc(rel.label)}" style="rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=1.8;fontStyle=1;fontSize=11;fontFamily=Helvetica;shadow=1;" vertex="1" parent="1"><mxGeometry x="${rx}" y="${ry}" width="${rw}" height="${rh}" as="geometry" /></mxCell>`,
    );

    // Edge: Parent Entity (1) -- Diamond
    cells.push(
      `<mxCell id="${esc(relId)}_e1" value="1" style="endArrow=none;startArrow=none;html=1;strokeColor=#333333;strokeWidth=1.8;fontStyle=1;fontSize=13;fontFamily=Helvetica;fontColor=#1a1a1a;labelBackgroundColor=#ffffff;" edge="1" parent="1" source="chen_ent_${esc(rel.from)}" target="${esc(relId)}"><mxGeometry relative="1" as="geometry" /></mxCell>`,
    );

    // Edge: Diamond -- Child Entity (1 or N)
    cells.push(
      `<mxCell id="${esc(relId)}_e2" value="${esc(toCard)}" style="endArrow=none;startArrow=none;html=1;strokeColor=#333333;strokeWidth=1.8;fontStyle=1;fontSize=13;fontFamily=Helvetica;fontColor=#1a1a1a;labelBackgroundColor=#ffffff;" edge="1" parent="1" source="${esc(relId)}" target="chen_ent_${esc(rel.to)}"><mxGeometry relative="1" as="geometry" /></mxCell>`,
    );
  });

  // Legend Box (Notasi Chen) placed cleanly in empty bottom-left zone
  const lx = 150;
  const ly = 2470;
  const lw = 760;
  const lh = 410;

  cells.push(
    `<mxCell id="chen_legend_box" value="Legenda Notasi Chen" style="swimlane;whiteSpace=wrap;html=1;startSize=32;fillColor=#f8f9fa;strokeColor=#adb5bd;strokeWidth=1.5;fontStyle=1;fontSize=13;fontFamily=Helvetica;rounded=1;" vertex="1" parent="1"><mxGeometry x="${lx}" y="${ly}" width="${lw}" height="${lh}" as="geometry" /></mxCell>`,
  );

  const legendItems = [
    {
      id: 'leg_ent',
      shape: 'rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;strokeWidth=2;fontStyle=1;fontSize=11;fontFamily=Helvetica;',
      val: 'Entitas',
      x: 30,
      y: 52,
      w: 118,
      h: 38,
      desc: 'Entitas Kuat (Tabel Basis Data)',
    },
    {
      id: 'leg_rel',
      shape: 'rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=1.6;fontStyle=1;fontSize=10;fontFamily=Helvetica;',
      val: 'Relasi',
      x: 34,
      y: 108,
      w: 110,
      h: 54,
      desc: 'Relasi Antar-Entitas (Hubungan)',
    },
    {
      id: 'leg_pk',
      shape: 'ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;strokeWidth=1.8;fontSize=11;fontFamily=Helvetica;',
      val: '&lt;u&gt;&lt;b&gt;id&lt;/b&gt;&lt;/u&gt;',
      x: 30,
      y: 180,
      w: 118,
      h: 36,
      desc: 'Atribut Primary Key (PK — Garis Bawah)',
    },
    {
      id: 'leg_fk',
      shape: 'ellipse;whiteSpace=wrap;html=1;dashed=1;dashPattern=6 4;fillColor=#f5f5f5;strokeColor=#666666;strokeWidth=1.4;fontSize=10;fontFamily=Helvetica;',
      val: '&lt;i&gt;ref_id&lt;/i&gt; (FK)',
      x: 30,
      y: 234,
      w: 118,
      h: 36,
      desc: 'Atribut Foreign Key (FK — Garis Putus-putus)',
    },
    {
      id: 'leg_uk',
      shape: 'ellipse;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;strokeWidth=1.5;fontSize=10;fontFamily=Helvetica;',
      val: '&lt;span style=&quot;border-bottom:1px dashed #6a3d9a;&quot;&gt;email&lt;/span&gt; (UK)',
      x: 30,
      y: 288,
      w: 118,
      h: 36,
      desc: 'Atribut Unique Key (UK — Nilai Unik)',
    },
    {
      id: 'leg_attr',
      shape: 'ellipse;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#6c8ebf;strokeWidth=1.2;fontSize=11;fontFamily=Helvetica;',
      val: 'atribut',
      x: 30,
      y: 342,
      w: 118,
      h: 36,
      desc: 'Atribut Biasa (Deskriptif)',
    },
  ];

  legendItems.forEach((item) => {
    cells.push(
      `<mxCell id="${item.id}" value="${item.val}" style="${item.shape}" vertex="1" parent="chen_legend_box"><mxGeometry x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" as="geometry" /></mxCell>`,
    );
    cells.push(
      `<mxCell id="${item.id}_txt" value="${esc(item.desc)}" style="text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;fontSize=12;fontFamily=Helvetica;fontColor=#212529;" vertex="1" parent="chen_legend_box"><mxGeometry x="166" y="${item.y}" width="298" height="${item.h}" as="geometry" /></mxCell>`,
    );
  });

  // Cardinality notes inside legend right panel
  cells.push(
    `<mxCell id="leg_card_note" value="&lt;b&gt;Kardinalitas (Mapping)&lt;/b&gt;&lt;br/&gt;&lt;br/&gt;&lt;b&gt;1 — 1&lt;/b&gt; : One-to-One (1 : 0..1)&lt;br/&gt;&lt;i&gt;Contoh: accounts — users, accounts — admins&lt;/i&gt;&lt;br/&gt;&lt;br/&gt;&lt;b&gt;1 — N&lt;/b&gt; : One-to-Many (1 : 0..N)&lt;br/&gt;&lt;i&gt;Contoh: categories — books, users — peminjaman&lt;/i&gt;&lt;br/&gt;&lt;br/&gt;&lt;b&gt;Total Entitas:&lt;/b&gt; ${tables.size} Entitas&lt;br/&gt;&lt;b&gt;Total Relasi:&lt;/b&gt; ${relations.length} Relasi" style="rounded=1;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=10;spacingTop=8;fillColor=#ffffff;strokeColor=#dee2e6;fontSize=11;fontFamily=Helvetica;fontColor=#212529;" vertex="1" parent="chen_legend_box"><mxGeometry x="490" y="54" width="250" height="320" as="geometry" /></mxCell>`,
  );

  return wrapDiagram({
    id: 'erd-chen',
    name: 'erd-chen',
    width: 3960,
    height: 3020,
    cells,
  });
}

// ============================================================================
// 2. Use Case Builder (use-case.mmd)
// ============================================================================
function buildUseCaseDiagram(source) {
  const actors = [];
  const useCases = [];
  const links = [];
  const extendsLinks = [];

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (
      !line ||
      line.startsWith('flowchart') ||
      line.startsWith('subgraph') ||
      line === 'end' ||
      line.startsWith('class ')
    ) {
      continue;
    }

    const actorMatch = line.match(/^([a-zA-Z0-9_]+)\(\["([^"]+)"\]\)$/);
    if (actorMatch) {
      actors.push({ id: actorMatch[1], label: actorMatch[2] });
      continue;
    }

    const ucMatch = line.match(/^([a-zA-Z0-9_]+)\(\("([^"]+)"\)\)$/);
    if (ucMatch) {
      useCases.push({ id: ucMatch[1], label: ucMatch[2] });
      continue;
    }

    const extMatch = line.match(
      /^([a-zA-Z0-9_]+)\s*-\.\s*"([^"]+)"\s*\.->\s*([a-zA-Z0-9_]+)$/,
    );
    if (extMatch) {
      extendsLinks.push({
        from: extMatch[1],
        label: extMatch[2],
        to: extMatch[3],
      });
      continue;
    }

    const assocMatch = line.match(/^([a-zA-Z0-9_]+)\s*-->\s*([a-zA-Z0-9_]+)$/);
    if (assocMatch) {
      links.push({ from: assocMatch[1], to: assocMatch[2] });
    }
  }

  const extendedSet = new Set(extendsLinks.map((e) => e.from));
  const rawPrimaryUcs = useCases.filter((u) => !extendedSet.has(u.id));
  const extUcs = useCases.filter((u) => extendedSet.has(u.id));

  // Group primary use cases so actor lines don't cross unnecessarily:
  // First actor's use cases (shared/user) at top, second actor's exclusive use cases below
  const firstActorId = actors[0]?.id;
  const firstActorTargets = new Set(
    links.filter((l) => l.from === firstActorId).map((l) => l.to),
  );
  const primaryUcs = [
    ...rawPrimaryUcs.filter((u) => firstActorTargets.has(u.id)),
    ...rawPrimaryUcs.filter((u) => !firstActorTargets.has(u.id)),
  ];

  const cells = [];
  const ucW = 200;
  const ucH = 46;
  const rowStep = 66;
  const sysX = 330;
  const sysY = 40;
  const sysW = 680;
  const sysH = Math.max(820, primaryUcs.length * rowStep + 90);

  cells.push(
    `<mxCell id="sys_box" value="Ruang Baca" style="swimlane;whiteSpace=wrap;html=1;startSize=36;fillColor=#f5f5f5;strokeColor=#666666;fontColor=#333333;fontStyle=1;fontSize=14;rounded=1;" vertex="1" parent="1"><mxGeometry x="${sysX}" y="${sysY}" width="${sysW}" height="${sysH}" as="geometry" /></mxCell>`,
  );

  // Single vertical column for primary use cases -> zero association lines crossing ellipses!
  const ucCoords = new Map();
  const primaryX = sysX + 60;
  primaryUcs.forEach((u, idx) => {
    const y = sysY + 56 + idx * rowStep;
    ucCoords.set(u.id, { x: primaryX, y });
    cells.push(
      `<mxCell id="uc_${esc(u.id)}" value="${esc(u.label)}" style="ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=12;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="${primaryX}" y="${y}" width="${ucW}" height="${ucH}" as="geometry" /></mxCell>`,
    );
  });

  // Column 2 for <<extend>> use cases, horizontally aligned with their base use case -> zero crossing arrows!
  const extX = sysX + 430;
  const usedExtYs = new Set();
  extUcs.forEach((u, idx) => {
    const targetRel = extendsLinks.find((e) => e.from === u.id);
    const basePos = targetRel ? ucCoords.get(targetRel.to) : null;
    let y = basePos ? basePos.y : sysY + 90 + idx * rowStep;
    while (usedExtYs.has(y)) {
      y += rowStep;
    }
    usedExtYs.add(y);
    ucCoords.set(u.id, { x: extX, y });
    cells.push(
      `<mxCell id="uc_${esc(u.id)}" value="${esc(u.label)}" style="ellipse;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=12;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="${extX}" y="${y}" width="${ucW}" height="${ucH}" as="geometry" /></mxCell>`,
    );
  });

  // Position actors vertically centered on their connected use cases
  actors.forEach((a, idx) => {
    const ax = 100;
    const connectedYs = links
      .filter((l) => l.from === a.id && ucCoords.has(l.to))
      .map((l) => ucCoords.get(l.to).y);
    let ay = idx === 0 ? 220 : Math.round(sysY + sysH * 0.6);
    if (connectedYs.length > 0) {
      const minY = Math.min(...connectedYs);
      const maxY = Math.max(...connectedYs);
      ay =
        idx === 0
          ? Math.round((minY + maxY) / 2 - 20)
          : Math.round(minY + (maxY - minY) * 0.62);
    }
    cells.push(
      `<mxCell id="act_${esc(a.id)}" value="${esc(a.label)}" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="${ax}" y="${ay}" width="45" height="90" as="geometry" /></mxCell>`,
    );
  });

  links.forEach((l, idx) => {
    cells.push(
      `<mxCell id="uc_assoc_${idx + 1}" value="" style="endArrow=none;html=1;rounded=1;strokeColor=#444444;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;" edge="1" parent="1" source="act_${esc(l.from)}" target="uc_${esc(l.to)}"><mxGeometry relative="1" as="geometry" /></mxCell>`,
    );
  });

  extendsLinks.forEach((e, idx) => {
    cells.push(
      `<mxCell id="uc_ext_${idx + 1}" value="${esc(e.label)}" style="endArrow=open;endSize=12;dashed=1;html=1;rounded=1;strokeColor=#b85450;fontStyle=2;labelBackgroundColor=#ffffff;exitX=0;exitY=0.5;exitDx=0;exitDy=0;entryX=1;entryY=0.5;entryDx=0;entryDy=0;" edge="1" parent="1" source="uc_${esc(e.from)}" target="uc_${esc(e.to)}"><mxGeometry relative="1" as="geometry" /></mxCell>`,
    );
  });

  return wrapDiagram({
    id: 'use-case',
    name: 'use-case',
    width: sysX + sysW + 100,
    height: sysY + sysH + 80,
    cells,
  });
}

// ============================================================================
// 3. Sequence Diagram Builder (sequence-*.mmd)
// ============================================================================
function buildSequenceDiagram(name, source) {
  const participants = [];
  const participantIndex = new Map();
  const events = [];

  const ensureParticipant = (id, label = id, kind = 'participant') => {
    if (!participantIndex.has(id)) {
      participantIndex.set(id, participants.length);
      participants.push({ id, label, kind });
    }
  };

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line === 'sequenceDiagram' || line === 'autonumber') continue;

    const pMatch = line.match(
      /^(actor|participant)\s+([a-zA-Z0-9_]+)(?:\s+as\s+(.+))?$/,
    );
    if (pMatch) {
      ensureParticipant(
        pMatch[2],
        (pMatch[3] ?? pMatch[2]).trim(),
        pMatch[1],
      );
      continue;
    }

    const noteMatch = line.match(
      /^Note\s+over\s+([a-zA-Z0-9_]+)(?:,([a-zA-Z0-9_]+))?\s*:\s*(.+)$/i,
    );
    if (noteMatch) {
      ensureParticipant(noteMatch[1]);
      if (noteMatch[2]) ensureParticipant(noteMatch[2]);
      events.push({
        type: 'note',
        from: noteMatch[1],
        to: noteMatch[2] ?? noteMatch[1],
        text: noteMatch[3],
      });
      continue;
    }

    const blockMatch = line.match(/^(alt|else|opt)\b(.*)$/);
    if (blockMatch) {
      events.push({
        type: blockMatch[1],
        cond: blockMatch[2].trim(),
      });
      continue;
    }

    if (line === 'end') {
      events.push({ type: 'end' });
      continue;
    }

    const msgMatch = line.match(
      /^([a-zA-Z0-9_]+)\s*(-->>|->>)\s*([a-zA-Z0-9_]+)\s*:\s*(.+)$/,
    );
    if (msgMatch) {
      ensureParticipant(msgMatch[1]);
      ensureParticipant(msgMatch[3]);
      events.push({
        type: 'msg',
        from: msgMatch[1],
        arrow: msgMatch[2],
        to: msgMatch[3],
        text: msgMatch[4],
      });
    }
  }

  const wrapMsgLabel = (text, maxChars) => {
    const words = text.split(/\s+/);
    const lines = [];
    let current = '';
    for (const word of words) {
      if (!current) {
        current = word;
      } else if (current.length + 1 + word.length <= maxChars) {
        current += ' ' + word;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const cells = [];
  const startX = 100;
  const colSpacing = 340;
  const boxW = 180;
  const boxH = 46;
  const topY = 50;

  let curY = topY + boxH + 56;
  let stepNo = 1;
  const blockStack = [];
  const frameCommands = [];

  for (const ev of events) {
    if (ev.type === 'note') {
      const i1 = participantIndex.get(ev.from) ?? 0;
      const i2 = participantIndex.get(ev.to) ?? i1;
      const minI = Math.min(i1, i2);
      const maxI = Math.max(i1, i2);
      const x = startX + minI * colSpacing;
      const w = (maxI - minI) * colSpacing + boxW;
      const noteLines = Math.max(1, Math.ceil(ev.text.length / Math.max(24, Math.floor(w / 8))));
      const noteH = Math.max(36, noteLines * 18 + 16);
      frameCommands.push({
        kind: 'note',
        x,
        y: curY,
        w,
        h: noteH,
        text: ev.text,
      });
      curY += noteH + 26;
    } else if (ev.type === 'alt' || ev.type === 'opt') {
      blockStack.push({
        kind: ev.type,
        cond: ev.cond,
        startY: curY - 12,
        depth: blockStack.length,
        elses: [],
      });
      curY += 38;
    } else if (ev.type === 'else') {
      const top = blockStack[blockStack.length - 1];
      if (top) {
        top.elses.push({ y: curY, cond: ev.cond });
      }
      curY += 36;
    } else if (ev.type === 'end') {
      const top = blockStack.pop();
      if (top) {
        frameCommands.push({
          kind: 'frame',
          frameType: top.kind,
          cond: top.cond,
          startY: top.startY,
          endY: curY + 12,
          depth: top.depth,
          elses: top.elses,
        });
      }
      curY += 26;
    } else if (ev.type === 'msg') {
      const fromIdx = participantIndex.get(ev.from) ?? 0;
      const toIdx = participantIndex.get(ev.to) ?? 0;
      const fromX = startX + fromIdx * colSpacing + boxW / 2;
      const toX = startX + toIdx * colSpacing + boxW / 2;
      const span = Math.max(colSpacing, Math.abs(toX - fromX));
      const maxChars = Math.max(36, Math.floor((span - 36) / 6.5));
      const step = stepNo++;
      const wrappedLines = wrapMsgLabel(`${step}. ${ev.text}`, maxChars);
      const lineCount = wrappedLines.length;
      if (lineCount > 1) {
        curY += (lineCount - 1) * 14;
      }
      frameCommands.push({
        kind: 'msg',
        step,
        fromIdx,
        toIdx,
        fromX,
        toX,
        y: curY,
        arrow: ev.arrow,
        wrappedLines,
      });
      curY += fromIdx === toIdx ? 58 + (lineCount - 1) * 10 : 48;
    }
  }

  const totalH = curY + 70;
  const totalW = Math.max(
    1300,
    startX * 2 + Math.max(0, participants.length - 1) * colSpacing + boxW + 60,
  );

  // Render participant headers + vertical lifelines
  participants.forEach((p, idx) => {
    const x = startX + idx * colSpacing;
    const centerX = x + boxW / 2;
    const headerId = `seq_p_${idx}`;
    const lineId = `seq_lf_${idx}`;
    const fill = p.kind === 'actor' ? '#d5e8d4' : '#dae8fc';
    const stroke = p.kind === 'actor' ? '#82b366' : '#6c8ebf';
    cells.push(
      `<mxCell id="${headerId}" value="${esc(p.label)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="${x}" y="${topY}" width="${boxW}" height="${boxH}" as="geometry" /></mxCell>`,
    );
    cells.push(
      `<mxCell id="${lineId}" value="" style="endArrow=none;dashed=1;html=1;dashPattern=1 3;strokeWidth=1.5;strokeColor=#888888;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${centerX}" y="${topY + boxH}" as="sourcePoint" /><mxPoint x="${centerX}" y="${totalH - 30}" as="targetPoint" /></mxGeometry></mxCell>`,
    );
  });

  // Render frames first so messages sit above frames visually
  frameCommands
    .filter((c) => c.kind === 'frame')
    .forEach((f, idx) => {
      const inset = f.depth * 16;
      const fx = startX - 36 + inset;
      const fw =
        (participants.length - 1) * colSpacing + boxW + 72 - inset * 2;
      const fh = Math.max(48, f.endY - f.startY);
      const fid = `seq_frame_${idx + 1}`;
      const title = `${f.frameType.toUpperCase()} [${f.cond}]`;
      const tabW = Math.min(fw - 20, Math.max(160, Math.round(title.length * 7.2 + 24)));
      cells.push(
        `<mxCell id="${fid}" value="${esc(title)}" style="shape=umlFrame;whiteSpace=wrap;html=1;width=${tabW};height=24;boundedLbl=1;verticalAlign=top;align=left;spacingLeft=6;fillColor=#fff2cc;strokeColor=#d6b656;fillOpacity=25;fontSize=11;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="${fx}" y="${f.startY}" width="${fw}" height="${fh}" as="geometry" /></mxCell>`,
      );
      f.elses.forEach((el, eIdx) => {
        const eid = `seq_else_${idx + 1}_${eIdx + 1}`;
        cells.push(
          `<mxCell id="${eid}" value="${esc(`[else ${el.cond}]`)}" style="endArrow=none;dashed=1;html=1;strokeColor=#d6b656;labelBackgroundColor=#fff2cc;fontSize=10;fontStyle=2;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${fx}" y="${el.y}" as="sourcePoint" /><mxPoint x="${fx + fw}" y="${el.y}" as="targetPoint" /></mxGeometry></mxCell>`,
        );
      });
    });

  // Render notes and messages
  frameCommands
    .filter((c) => c.kind !== 'frame')
    .forEach((cmd, idx) => {
      if (cmd.kind === 'note') {
        cells.push(
          `<mxCell id="seq_note_${idx + 1}" value="${esc(cmd.text)}" style="shape=note;whiteSpace=wrap;html=1;size=14;verticalAlign=middle;align=center;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=11;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="${cmd.x}" y="${cmd.y}" width="${cmd.w}" height="${cmd.h}" as="geometry" /></mxCell>`,
        );
      } else if (cmd.kind === 'msg') {
        const labelHtml = cmd.wrappedLines.map((l) => esc(l)).join('&lt;br/&gt;');
        const dashed = cmd.arrow === '-->>' ? 'dashed=1;' : '';
        const color = cmd.arrow === '-->>' ? '#555555' : '#1F1F1F';
        const mid = `seq_msg_${cmd.step}`;
        if (cmd.fromIdx === cmd.toIdx) {
          cells.push(
            `<mxCell id="${mid}" value="${labelHtml}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;${dashed}endArrow=block;endFill=1;strokeColor=${color};fontSize=11;labelBackgroundColor=#ffffff;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${cmd.fromX}" y="${cmd.y}" as="sourcePoint" /><mxPoint x="${cmd.toX}" y="${cmd.y + 28}" as="targetPoint" /><Array as="points"><mxPoint x="${cmd.fromX + 64}" y="${cmd.y}" /><mxPoint x="${cmd.fromX + 64}" y="${cmd.y + 28}" /></Array></mxGeometry></mxCell>`,
          );
        } else {
          cells.push(
            `<mxCell id="${mid}" value="${labelHtml}" style="html=1;verticalAlign=bottom;endArrow=block;endFill=1;${dashed}strokeColor=${color};fontSize=11;labelBackgroundColor=#ffffff;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${cmd.fromX}" y="${cmd.y}" as="sourcePoint" /><mxPoint x="${cmd.toX}" y="${cmd.y}" as="targetPoint" /></mxGeometry></mxCell>`,
          );
        }
      }
    });

  return wrapDiagram({
    id: name,
    name,
    width: totalW,
    height: totalH,
    cells,
  });
}

// ============================================================================
// 4. Flowchart & Activity Swimlane Parser Helper
// ============================================================================
function parseFlowGraph(source) {
  const nodes = new Map();
  const edges = [];
  const lanes = [];
  let currentLane = null;

  const registerNode = (rawToken, lane) => {
    const token = rawToken.trim();
    const mActStart = token.match(
      /^([a-zA-Z0-9_]+)@\{\s*shape:\s*(?:sm-circ|start)(?:,\s*label:\s*"([^"]*)")?\s*\}$/,
    );
    if (mActStart) {
      const id = mActStart[1];
      nodes.set(id, {
        id,
        label: mActStart[2] ?? '',
        shape: 'act_start',
        lane: nodes.get(id)?.lane ?? lane,
      });
      return id;
    }
    const mActEnd = token.match(
      /^([a-zA-Z0-9_]+)@\{\s*shape:\s*(?:fr-circ|stop)(?:,\s*label:\s*"([^"]*)")?\s*\}$/,
    );
    if (mActEnd) {
      const id = mActEnd[1];
      nodes.set(id, {
        id,
        label: mActEnd[2] ?? '',
        shape: 'act_end',
        lane: nodes.get(id)?.lane ?? lane,
      });
      return id;
    }
    const mStad = token.match(/^([a-zA-Z0-9_]+)\(\["([^"]+)"\]\)$/);
    if (mStad) {
      const id = mStad[1];
      nodes.set(id, {
        id,
        label: mStad[2],
        shape: 'terminator',
        lane: nodes.get(id)?.lane ?? lane,
      });
      return id;
    }
    const mRhom = token.match(/^([a-zA-Z0-9_]+)\{"([^"]+)"\}$/);
    if (mRhom) {
      const id = mRhom[1];
      nodes.set(id, {
        id,
        label: mRhom[2],
        shape: 'decision',
        lane: nodes.get(id)?.lane ?? lane,
      });
      return id;
    }
    const mPara = token.match(/^([a-zA-Z0-9_]+)\[\/"([^"]+)"\/\]$/);
    if (mPara) {
      const id = mPara[1];
      nodes.set(id, {
        id,
        label: mPara[2],
        shape: 'io',
        lane: nodes.get(id)?.lane ?? lane,
      });
      return id;
    }
    const mRect = token.match(/^([a-zA-Z0-9_]+)\["([^"]+)"\]$/);
    if (mRect) {
      const id = mRect[1];
      nodes.set(id, {
        id,
        label: mRect[2],
        shape: 'process',
        lane: nodes.get(id)?.lane ?? lane,
      });
      return id;
    }
    const mBare = token.match(/^([a-zA-Z0-9_]+)$/);
    if (mBare) {
      const id = mBare[1];
      if (!nodes.has(id)) {
        nodes.set(id, { id, label: id, shape: 'process', lane });
      } else if (lane && !nodes.get(id).lane) {
        nodes.get(id).lane = lane;
      }
      return id;
    }
    return null;
  };

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('flowchart')) continue;

    const subMatch = line.match(/^subgraph\s+([a-zA-Z0-9_]+)\["([^"]+)"\]$/);
    if (subMatch) {
      currentLane = subMatch[1];
      lanes.push({ id: subMatch[1], title: subMatch[2] });
      continue;
    }
    if (line === 'end') {
      currentLane = null;
      continue;
    }

    const edgeMatch = line.match(
      /^(.+?)\s*(-->|-\.->)(?:\|"([^"]+)"\|)?\s*(.+)$/,
    );
    if (edgeMatch) {
      const fromId = registerNode(edgeMatch[1], currentLane);
      const arrow = edgeMatch[2];
      const label = edgeMatch[3] ?? '';
      const toId = registerNode(edgeMatch[4], currentLane);
      if (fromId && toId) {
        edges.push({ from: fromId, to: toId, arrow, label });
      }
      continue;
    }

    registerNode(line, currentLane);
  }

  return { nodes, edges, lanes };
}

function computeTopologicalRanks(nodes, edges) {
  const adj = new Map();
  const indegAll = new Map();
  for (const id of nodes.keys()) {
    adj.set(id, []);
    indegAll.set(id, 0);
  }
  for (const e of edges) {
    if (adj.has(e.from) && nodes.has(e.to)) {
      adj.get(e.from).push(e.to);
      indegAll.set(e.to, (indegAll.get(e.to) ?? 0) + 1);
    }
  }

  // 1. Identify DFS back-edges (retry loops) so DAG longest-path ranking stays acyclic
  const startOrder = [];
  if (nodes.has('start')) startOrder.push('start');
  for (const [id, deg] of indegAll.entries()) {
    if (deg === 0 && !startOrder.includes(id)) startOrder.push(id);
  }
  for (const id of nodes.keys()) {
    if (!startOrder.includes(id)) startOrder.push(id);
  }

  const visitState = new Map(); // 0=unvisited, 1=visiting, 2=done
  const backEdges = new Set();
  const dfs = (u) => {
    visitState.set(u, 1);
    for (const v of adj.get(u) ?? []) {
      const st = visitState.get(v) ?? 0;
      if (st === 1) {
        backEdges.add(`${u}->${v}`);
      } else if (st === 0) {
        dfs(v);
      }
    }
    visitState.set(u, 2);
  };
  for (const s of startOrder) {
    if ((visitState.get(s) ?? 0) === 0) dfs(s);
  }

  // 2. Longest-path ranking on the DAG (strictly downward forward edges)
  const dagAdj = new Map([...nodes.keys()].map((id) => [id, []]));
  const indeg = new Map([...nodes.keys()].map((id) => [id, 0]));
  for (const e of edges) {
    if (backEdges.has(`${e.from}->${e.to}`)) continue;
    if (!dagAdj.has(e.from) || !indeg.has(e.to)) continue;
    dagAdj.get(e.from).push(e.to);
    indeg.set(e.to, indeg.get(e.to) + 1);
  }

  const ranks = new Map();
  const queue = [];
  for (const [id, deg] of indeg.entries()) {
    if (deg === 0) {
      ranks.set(id, 0);
      queue.push(id);
    }
  }

  while (queue.length > 0) {
    const u = queue.shift();
    const ru = ranks.get(u) ?? 0;
    for (const v of dagAdj.get(u) ?? []) {
      const prev = ranks.get(v) ?? 0;
      if (ru + 1 > prev) ranks.set(v, ru + 1);
      indeg.set(v, indeg.get(v) - 1);
      if (indeg.get(v) === 0) queue.push(v);
    }
  }

  let maxRank = 0;
  for (const r of ranks.values()) {
    if (r > maxRank) maxRank = r;
  }
  for (const id of nodes.keys()) {
    if (!ranks.has(id)) {
      maxRank += 1;
      ranks.set(id, maxRank);
    }
  }

  // Align terminal end nodes (finish / finishEmpty / act_end) on the bottom row
  const endIds = [...nodes.entries()]
    .filter(
      ([id, n]) =>
        n.shape === 'act_end' ||
        id === 'finish' ||
        id === 'finishEmpty',
    )
    .map(([id]) => id);
  if (endIds.length > 0) {
    const nonEndMax = Math.max(
      0,
      ...[...ranks.entries()]
        .filter(([id]) => !endIds.includes(id))
        .map(([, r]) => r),
    );
    for (const eid of endIds) {
      ranks.set(eid, nonEndMax + 1);
    }
  }

  return ranks;
}

function getBranchSortWeight(nodeId, edges) {
  for (const e of edges) {
    if (e.to !== nodeId || !e.label) continue;
    const low = e.label.toLowerCase();
    if (low.includes('0 (tidak)') || low.includes('tidak')) return 0;
    if (low.includes('1 (ya)') || low.includes('ya')) return 2;
  }
  return 1;
}

// ============================================================================
// 5. Flowchart Builder (flowchart-*.mmd)
// ============================================================================
function buildFlowchartDiagram(name, source) {
  const { nodes, edges } = parseFlowGraph(source);
  const ranks = computeTopologicalRanks(nodes, edges);

  const byRank = new Map();
  for (const [id, r] of ranks.entries()) {
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r).push(id);
  }

  const getNodeSize = (n) => {
    const len = (n.label ?? '').length;
    if (n.shape === 'decision') {
      return { w: len > 46 ? 260 : 240, h: len > 46 ? 84 : 76 };
    }
    if (n.shape === 'terminator') {
      return { w: 164, h: 46 };
    }
    if (n.shape === 'io') {
      return { w: len > 52 ? 290 : 264, h: len > 52 ? 68 : 56 };
    }
    return { w: len > 56 ? 276 : 248, h: len > 56 ? 66 : 56 };
  };

  const sortedRanks = [...byRank.keys()].sort((a, b) => a - b);
  const colGap = 72;
  const rowVertGap = 58;
  const sideMargin = 80;

  let maxRowWidth = 900;
  for (const rk of sortedRanks) {
    const ids = byRank.get(rk);
    const totalW =
      ids.reduce((acc, id) => acc + getNodeSize(nodes.get(id)).w, 0) +
      Math.max(0, ids.length - 1) * colGap;
    if (totalW > maxRowWidth) maxRowWidth = totalW;
  }

  const pageWidth = Math.max(1120, maxRowWidth + sideMargin * 2);
  const centerX = Math.round(pageWidth / 2);

  const cells = [];
  let curY = 54;

  sortedRanks.forEach((rankKey) => {
    const ids = [...byRank.get(rankKey)].sort(
      (a, b) => getBranchSortWeight(a, edges) - getBranchSortWeight(b, edges),
    );
    const sizes = ids.map((id) => getNodeSize(nodes.get(id)));
    const rowH = Math.max(...sizes.map((s) => s.h), 46);
    const totalW =
      sizes.reduce((acc, s) => acc + s.w, 0) +
      Math.max(0, ids.length - 1) * colGap;
    let curX = Math.round(centerX - totalW / 2);

    ids.forEach((id, idx) => {
      const n = nodes.get(id);
      const { w, h } = sizes[idx];
      const y = curY + Math.round((rowH - h) / 2);

      let style =
        'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=12;';
      if (n.shape === 'terminator') {
        style =
          'rounded=1;whiteSpace=wrap;html=1;arcSize=50;fillColor=#d5e8d4;strokeColor=#82b366;fontStyle=1;fontSize=12;';
      } else if (n.shape === 'decision') {
        style =
          'rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontStyle=1;fontSize=11;';
      } else if (n.shape === 'io') {
        style =
          'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=12;';
      }

      cells.push(
        `<mxCell id="fc_${esc(id)}" value="${esc(n.label)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${curX}" y="${y}" width="${w}" height="${h}" as="geometry" /></mxCell>`,
      );
      curX += w + colGap;
    });

    curY += rowH + rowVertGap;
  });

  edges.forEach((e, idx) => {
    const dashed = e.arrow === '-.->' ? 'dashed=1;' : '';
    cells.push(
      `<mxCell id="fc_edge_${idx + 1}" value="${esc(e.label)}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;${dashed}endArrow=block;endFill=1;strokeColor=#333333;fontSize=11;labelBackgroundColor=#ffffff;" edge="1" parent="1" source="fc_${esc(e.from)}" target="fc_${esc(e.to)}"><mxGeometry relative="1" as="geometry" /></mxCell>`,
    );
  });

  return wrapDiagram({
    id: name,
    name,
    width: pageWidth,
    height: Math.max(850, curY + 60),
    cells,
  });
}

// ============================================================================
// 6. Activity Swimlane Builder (activity-*.mmd)
// ============================================================================
function buildActivityDiagram(name, source) {
  const { nodes, edges, lanes } = parseFlowGraph(source);
  const ranks = computeTopologicalRanks(nodes, edges);

  const orderedLanes =
    lanes.length > 0
      ? lanes
      : [
          { id: 'User', title: 'User' },
          { id: 'Admin', title: 'Admin' },
          { id: 'Sistem', title: 'Sistem' },
        ];

  const sortedRanks = [...new Set(ranks.values())].sort((a, b) => a - b);
  const rankToRow = new Map(sortedRanks.map((r, i) => [r, i]));

  const laneIndex = new Map();
  orderedLanes.forEach((lane, idx) => laneIndex.set(lane.id, idx));

  const getActivityNodeMetrics = (id, n) => {
    const isStart =
      n.shape === 'act_start' || (n.shape === 'terminator' && id === 'start');
    const isEnd =
      n.shape === 'act_end' || (n.shape === 'terminator' && id !== 'start');
    const len = (n.label ?? '').length;

    const w =
      isStart || isEnd
        ? 30
        : n.shape === 'decision'
          ? len > 46
            ? 250
            : 230
          : n.shape === 'terminator'
            ? 156
            : n.shape === 'io'
              ? len > 52
                ? 276
                : 256
              : len > 56
                ? 258
                : 232;
    const h =
      isStart || isEnd
        ? 30
        : n.shape === 'decision'
          ? len > 46
            ? 80
            : 72
          : n.shape === 'terminator'
            ? 44
            : n.shape === 'io'
              ? len > 52
                ? 66
                : 54
              : len > 56
                ? 64
                : 54;
    return { isStart, isEnd, w, h };
  };

  // Group nodes by (laneId, row) and compute dynamic row heights & lane widths
  const slotNodes = new Map();
  const rowMaxH = new Map();

  for (const [id, n] of nodes.entries()) {
    const laneId = n.lane && laneIndex.has(n.lane) ? n.lane : orderedLanes[0].id;
    const row = rankToRow.get(ranks.get(id) ?? 0) ?? 0;
    const metrics = getActivityNodeMetrics(id, n);
    const key = `${laneId}:${row}`;
    if (!slotNodes.has(key)) slotNodes.set(key, []);
    slotNodes.get(key).push({ id, n, ...metrics });
    rowMaxH.set(row, Math.max(rowMaxH.get(row) ?? 42, metrics.h));
  }

  const colGap = 48;
  const sidePad = 36;
  const rowVertGap = 58;
  const startX = 60;
  const topY = 50;

  // Dynamic width per swimlane so side-by-side branching nodes never overlap or overflow
  const laneWidths = new Map();
  for (const lane of orderedLanes) {
    let requiredW = 340;
    for (let row = 0; row < sortedRanks.length; row += 1) {
      const items = slotNodes.get(`${lane.id}:${row}`) ?? [];
      if (items.length === 0) continue;
      const sumW =
        items.reduce((acc, it) => acc + it.w, 0) +
        (items.length - 1) * colGap +
        sidePad * 2;
      if (sumW > requiredW) requiredW = sumW;
    }
    laneWidths.set(lane.id, requiredW);
  }

  // Cumulative vertical positions per row
  const rowY = new Map();
  let curRowY = 64;
  for (let row = 0; row < sortedRanks.length; row += 1) {
    rowY.set(row, curRowY);
    curRowY += (rowMaxH.get(row) ?? 54) + rowVertGap;
  }
  const laneH = Math.max(760, curRowY + 24);

  const laneColors = [
    { fill: '#dae8fc', stroke: '#6c8ebf' },
    { fill: '#fff2cc', stroke: '#d6b656' },
    { fill: '#d5e8d4', stroke: '#82b366' },
  ];

  const cells = [];
  let curLaneX = startX;
  orderedLanes.forEach((lane, idx) => {
    const lw = laneWidths.get(lane.id) ?? 340;
    const color = laneColors[idx % laneColors.length];
    cells.push(
      `<mxCell id="lane_${esc(lane.id)}" value="${esc(lane.title)}" style="swimlane;whiteSpace=wrap;html=1;startSize=36;fillColor=${color.fill};strokeColor=${color.stroke};fontStyle=1;fontSize=13;" vertex="1" parent="1"><mxGeometry x="${curLaneX}" y="${topY}" width="${lw}" height="${laneH}" as="geometry" /></mxCell>`,
    );
    curLaneX += lw;
  });

  // Render nodes inside their swimlane cells, centered side-by-side per (lane, row)
  for (const lane of orderedLanes) {
    const lw = laneWidths.get(lane.id) ?? 340;
    for (let row = 0; row < sortedRanks.length; row += 1) {
      const items = slotNodes.get(`${lane.id}:${row}`) ?? [];
      if (items.length === 0) continue;

      items.sort(
        (a, b) =>
          getBranchSortWeight(a.id, edges) - getBranchSortWeight(b.id, edges),
      );

      const totalItemsW =
        items.reduce((acc, it) => acc + it.w, 0) +
        (items.length - 1) * colGap;
      let curX = Math.round((lw - totalItemsW) / 2);
      const rH = rowMaxH.get(row) ?? 54;
      const baseY = rowY.get(row) ?? 64;

      for (const item of items) {
        const { id, n, isStart, isEnd, w, h } = item;
        const y = baseY + Math.round((rH - h) / 2);

        let style =
          'rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#6c8ebf;fontSize=11;';
        if (isStart) {
          style =
            'ellipse;html=1;shape=startState;fillColor=#000000;strokeColor=#000000;';
        } else if (isEnd) {
          style =
            'ellipse;html=1;shape=endState;fillColor=#000000;strokeColor=#000000;';
        } else if (n.shape === 'terminator') {
          style =
            'rounded=1;whiteSpace=wrap;html=1;arcSize=50;fillColor=#d5e8d4;strokeColor=#82b366;fontStyle=1;fontSize=12;';
        } else if (n.shape === 'decision') {
          style =
            'rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontStyle=1;fontSize=11;';
        } else if (n.shape === 'io') {
          style =
            'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;fillColor=#ffffff;strokeColor=#6c8ebf;fontSize=11;';
        }

        const cellValue = isStart || isEnd ? '' : esc(n.label);
        cells.push(
          `<mxCell id="act_n_${esc(id)}" value="${cellValue}" style="${style}" vertex="1" parent="lane_${esc(lane.id)}"><mxGeometry x="${curX}" y="${y}" width="${w}" height="${h}" as="geometry" /></mxCell>`,
        );
        curX += w + colGap;
      }
    }
  }

  edges.forEach((e, idx) => {
    const dashed = e.arrow === '-.->' ? 'dashed=1;' : '';
    cells.push(
      `<mxCell id="act_e_${idx + 1}" value="${esc(e.label)}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;${dashed}endArrow=block;endFill=1;strokeColor=#333333;fontSize=11;labelBackgroundColor=#ffffff;" edge="1" parent="1" source="act_n_${esc(e.from)}" target="act_n_${esc(e.to)}"><mxGeometry relative="1" as="geometry" /></mxCell>`,
    );
  });

  return wrapDiagram({
    id: name,
    name,
    width: curLaneX + startX,
    height: topY + laneH + 60,
    cells,
  });
}

// ============================================================================
// Main Orchestrator
// ============================================================================
function main() {
  const files = readdirSync(SRC_DIR)
    .filter((f) => f.endsWith('.mmd'))
    .sort((a, b) => a.localeCompare(b));

  const groups = {
    erd: [],
    'use-case': [],
    sequence: [],
    flowchart: [],
    activity: [],
  };

  for (const category of Object.keys(groups)) {
    mkdirSync(join(OUT_DIR, category), { recursive: true });
  }

  let totalIndividual = 0;

  for (const file of files) {
    const name = file.replace(/\.mmd$/, '');
    const source = readFileSync(join(SRC_DIR, file), 'utf8');

    let category = 'flowchart';
    let diagramBlock = '';

    if (name === 'erd') {
      category = 'erd';
      diagramBlock = buildErdDiagram(source);

      const chenBlock = buildErdChenDiagram(source);
      groups[category].push(diagramBlock);
      groups[category].push(chenBlock);

      writeFileSync(
        join(OUT_DIR, category, 'erd.drawio'),
        wrapMxFile([diagramBlock]),
        'utf8',
      );
      writeFileSync(
        join(OUT_DIR, category, 'erd-chen.drawio'),
        wrapMxFile([chenBlock]),
        'utf8',
      );
      writeFileSync(
        join(OUT_DIR, 'erd-chen.drawio'),
        wrapMxFile([chenBlock]),
        'utf8',
      );
      totalIndividual += 2;
      continue;
    } else if (name === 'use-case') {
      category = 'use-case';
      diagramBlock = buildUseCaseDiagram(source);
    } else if (name.startsWith('sequence-')) {
      category = 'sequence';
      diagramBlock = buildSequenceDiagram(name, source);
    } else if (name.startsWith('activity-')) {
      category = 'activity';
      diagramBlock = buildActivityDiagram(name, source);
    } else {
      category = 'flowchart';
      diagramBlock = buildFlowchartDiagram(name, source);
    }

    groups[category].push(diagramBlock);

    const singlePath = join(OUT_DIR, category, `${name}.drawio`);
    writeFileSync(singlePath, wrapMxFile([diagramBlock]), 'utf8');
    totalIndividual += 1;
  }

  for (const [category, blocks] of Object.entries(groups)) {
    if (blocks.length === 0) continue;
    const workbookPath = join(OUT_DIR, `${category}.drawio`);
    writeFileSync(workbookPath, wrapMxFile(blocks), 'utf8');
  }

  console.log(
    `Generated ${totalIndividual} individual .drawio files across 5 categories and 5 multi-tab category workbooks in docs/diagrams/.`,
  );
}

main();
