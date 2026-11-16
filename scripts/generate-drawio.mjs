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
// 1. ERD Builder (erd.mmd)
// ============================================================================
function buildErdDiagram(source) {
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

  const cells = [];
  const tableNames = [...tables.keys()];
  const colsPerRow = 4;
  const colWidth = 310;
  const colGap = 90;
  const rowGap = 70;

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
    const headerH = 32;
    const rowH = 26;
    const tableH = headerH + fields.length * rowH + 8;
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

  return wrapDiagram({
    id: 'erd',
    name: 'erd',
    width: 1800,
    height: currentY + rowMaxHeight + 120,
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

  const cells = [];
  const sysX = 320;
  const sysY = 40;
  const sysW = 820;
  const rows = Math.ceil(useCases.length / 2);
  const sysH = Math.max(820, rows * 68 + 80);

  cells.push(
    `<mxCell id="sys_box" value="Ruang Baca" style="swimlane;whiteSpace=wrap;html=1;startSize=32;fillColor=#f5f5f5;strokeColor=#666666;fontColor=#333333;fontStyle=1;fontSize=14;rounded=1;" vertex="1" parent="1"><mxGeometry x="${sysX}" y="${sysY}" width="${sysW}" height="${sysH}" as="geometry" /></mxCell>`,
  );

  actors.forEach((a, idx) => {
    const ax = 90;
    const ay = idx === 0 ? 220 : 580;
    cells.push(
      `<mxCell id="act_${esc(a.id)}" value="${esc(a.label)}" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="${ax}" y="${ay}" width="45" height="90" as="geometry" /></mxCell>`,
    );
  });

  const extendedSet = new Set(extendsLinks.map((e) => e.from));
  const primaryUcs = useCases.filter((u) => !extendedSet.has(u.id));
  const extUcs = useCases.filter((u) => extendedSet.has(u.id));

  const ucCoords = new Map();
  primaryUcs.forEach((u, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = sysX + 50 + col * 240;
    const y = sysY + 55 + row * 68;
    ucCoords.set(u.id, { x, y });
    cells.push(
      `<mxCell id="uc_${esc(u.id)}" value="${esc(u.label)}" style="ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=12;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="180" height="48" as="geometry" /></mxCell>`,
    );
  });

  extUcs.forEach((u, idx) => {
    const targetRel = extendsLinks.find((e) => e.from === u.id);
    const basePos = targetRel ? ucCoords.get(targetRel.to) : null;
    const x = sysX + 570;
    const y = basePos ? basePos.y : sysY + 90 + idx * 140;
    ucCoords.set(u.id, { x, y });
    cells.push(
      `<mxCell id="uc_${esc(u.id)}" value="${esc(u.label)}" style="ellipse;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=12;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="180" height="48" as="geometry" /></mxCell>`,
    );
  });

  links.forEach((l, idx) => {
    cells.push(
      `<mxCell id="uc_assoc_${idx + 1}" value="" style="endArrow=none;html=1;rounded=1;strokeColor=#444444;" edge="1" parent="1" source="act_${esc(l.from)}" target="uc_${esc(l.to)}"><mxGeometry relative="1" as="geometry" /></mxCell>`,
    );
  });

  extendsLinks.forEach((e, idx) => {
    cells.push(
      `<mxCell id="uc_ext_${idx + 1}" value="${esc(e.label)}" style="endArrow=open;endSize=12;dashed=1;html=1;rounded=1;strokeColor=#b85450;fontStyle=2;labelBackgroundColor=#ffffff;" edge="1" parent="1" source="uc_${esc(e.from)}" target="uc_${esc(e.to)}"><mxGeometry relative="1" as="geometry" /></mxCell>`,
    );
  });

  return wrapDiagram({
    id: 'use-case',
    name: 'use-case',
    width: 1300,
    height: sysH + 100,
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

  const cells = [];
  const startX = 100;
  const colSpacing = 250;
  const boxW = 160;
  const boxH = 44;
  const topY = 50;

  let curY = topY + boxH + 45;
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
      frameCommands.push({
        kind: 'note',
        x,
        y: curY,
        w,
        h: 34,
        text: ev.text,
      });
      curY += 50;
    } else if (ev.type === 'alt' || ev.type === 'opt') {
      blockStack.push({
        kind: ev.type,
        cond: ev.cond,
        startY: curY - 10,
        depth: blockStack.length,
        elses: [],
      });
      curY += 28;
    } else if (ev.type === 'else') {
      const top = blockStack[blockStack.length - 1];
      if (top) {
        top.elses.push({ y: curY, cond: ev.cond });
      }
      curY += 26;
    } else if (ev.type === 'end') {
      const top = blockStack.pop();
      if (top) {
        frameCommands.push({
          kind: 'frame',
          frameType: top.kind,
          cond: top.cond,
          startY: top.startY,
          endY: curY + 6,
          depth: top.depth,
          elses: top.elses,
        });
      }
      curY += 16;
    } else if (ev.type === 'msg') {
      const fromIdx = participantIndex.get(ev.from) ?? 0;
      const toIdx = participantIndex.get(ev.to) ?? 0;
      const fromX = startX + fromIdx * colSpacing + boxW / 2;
      const toX = startX + toIdx * colSpacing + boxW / 2;
      frameCommands.push({
        kind: 'msg',
        step: stepNo++,
        fromIdx,
        toIdx,
        fromX,
        toX,
        y: curY,
        arrow: ev.arrow,
        text: ev.text,
      });
      curY += fromIdx === toIdx ? 52 : 42;
    }
  }

  const totalH = curY + 60;
  const totalW = Math.max(1200, startX * 2 + participants.length * colSpacing);

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
      const inset = f.depth * 14;
      const fx = startX - 30 + inset;
      const fw =
        (participants.length - 1) * colSpacing + boxW + 60 - inset * 2;
      const fh = Math.max(40, f.endY - f.startY);
      const fid = `seq_frame_${idx + 1}`;
      const title = `${f.frameType.toUpperCase()} [${f.cond}]`;
      cells.push(
        `<mxCell id="${fid}" value="${esc(title)}" style="shape=umlFrame;whiteSpace=wrap;html=1;width=140;height=22;boundedLbl=1;verticalAlign=top;align=left;spacingLeft=5;fillColor=#fff2cc;strokeColor=#d6b656;fillOpacity=25;fontSize=11;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="${fx}" y="${f.startY}" width="${fw}" height="${fh}" as="geometry" /></mxCell>`,
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
        const label = `${cmd.step}. ${cmd.text}`;
        const dashed = cmd.arrow === '-->>' ? 'dashed=1;' : '';
        const color = cmd.arrow === '-->>' ? '#555555' : '#1F1F1F';
        const mid = `seq_msg_${cmd.step}`;
        if (cmd.fromIdx === cmd.toIdx) {
          cells.push(
            `<mxCell id="${mid}" value="${esc(label)}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;${dashed}endArrow=block;endFill=1;strokeColor=${color};fontSize=11;labelBackgroundColor=#ffffff;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${cmd.fromX}" y="${cmd.y}" as="sourcePoint" /><mxPoint x="${cmd.toX}" y="${cmd.y + 24}" as="targetPoint" /><Array as="points"><mxPoint x="${cmd.fromX + 55}" y="${cmd.y}" /><mxPoint x="${cmd.fromX + 55}" y="${cmd.y + 24}" /></Array></mxGeometry></mxCell>`,
          );
        } else {
          cells.push(
            `<mxCell id="${mid}" value="${esc(label)}" style="html=1;verticalAlign=bottom;endArrow=block;endFill=1;${dashed}strokeColor=${color};fontSize=11;labelBackgroundColor=#ffffff;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${cmd.fromX}" y="${cmd.y}" as="sourcePoint" /><mxPoint x="${cmd.toX}" y="${cmd.y}" as="targetPoint" /></mxGeometry></mxCell>`,
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
  for (const id of nodes.keys()) adj.set(id, []);
  for (const e of edges) {
    adj.get(e.from)?.push(e.to);
  }

  const ranks = new Map();
  const startId = nodes.has('start') ? 'start' : [...nodes.keys()][0];
  if (startId) {
    ranks.set(startId, 0);
    const queue = [startId];
    while (queue.length > 0) {
      const u = queue.shift();
      const r = ranks.get(u) ?? 0;
      for (const v of adj.get(u) ?? []) {
        if (!ranks.has(v)) {
          ranks.set(v, r + 1);
          queue.push(v);
        }
      }
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
  if (nodes.has('finish')) {
    ranks.set('finish', maxRank + 1);
  }

  return ranks;
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

  const sortedRanks = [...byRank.keys()].sort((a, b) => a - b);
  const cells = [];
  const centerX = 520;
  const rowGap = 115;

  sortedRanks.forEach((rankKey, rowIdx) => {
    const ids = byRank.get(rankKey);
    const y = 50 + rowIdx * rowGap;
    ids.forEach((id, idx) => {
      const n = nodes.get(id);
      const offset = (idx - (ids.length - 1) / 2) * 320;
      const w =
        n.shape === 'decision'
          ? 240
          : n.shape === 'terminator'
            ? 160
            : n.shape === 'io'
              ? 260
              : 240;
      const h = n.shape === 'decision' ? 76 : n.shape === 'terminator' ? 46 : 56;
      const x = Math.round(centerX + offset - w / 2);

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
        `<mxCell id="fc_${esc(id)}" value="${esc(n.label)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry" /></mxCell>`,
      );
    });
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
    width: 1100,
    height: Math.max(850, sortedRanks.length * rowGap + 120),
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

  const laneW = 360;
  const startX = 60;
  const topY = 50;
  const rowGap = 105;
  const laneH = Math.max(760, sortedRanks.length * rowGap + 110);

  const laneColors = [
    { fill: '#dae8fc', stroke: '#6c8ebf' },
    { fill: '#fff2cc', stroke: '#d6b656' },
    { fill: '#d5e8d4', stroke: '#82b366' },
  ];

  const cells = [];
  const laneIndex = new Map();

  orderedLanes.forEach((lane, idx) => {
    laneIndex.set(lane.id, idx);
    const lx = startX + idx * laneW;
    const color = laneColors[idx % laneColors.length];
    cells.push(
      `<mxCell id="lane_${esc(lane.id)}" value="${esc(lane.title)}" style="swimlane;whiteSpace=wrap;html=1;startSize=36;fillColor=${color.fill};strokeColor=${color.stroke};fontStyle=1;fontSize=13;" vertex="1" parent="1"><mxGeometry x="${lx}" y="${topY}" width="${laneW}" height="${laneH}" as="geometry" /></mxCell>`,
    );
  });

  // Group nodes that share the same (lane, row)
  const slotCounts = new Map();
  for (const [id, n] of nodes.entries()) {
    const laneId = n.lane && laneIndex.has(n.lane) ? n.lane : orderedLanes[0].id;
    const row = rankToRow.get(ranks.get(id) ?? 0) ?? 0;
    const key = `${laneId}:${row}`;
    slotCounts.set(key, (slotCounts.get(key) ?? 0) + 1);
  }

  const slotSeen = new Map();
  for (const [id, n] of nodes.entries()) {
    const laneId = n.lane && laneIndex.has(n.lane) ? n.lane : orderedLanes[0].id;
    const row = rankToRow.get(ranks.get(id) ?? 0) ?? 0;
    const key = `${laneId}:${row}`;
    const idxInSlot = slotSeen.get(key) ?? 0;
    slotSeen.set(key, idxInSlot + 1);

    const w =
      n.shape === 'decision'
        ? 230
        : n.shape === 'terminator'
          ? 150
          : n.shape === 'io'
            ? 250
            : 230;
    const h = n.shape === 'decision' ? 72 : n.shape === 'terminator' ? 44 : 54;
    const x = Math.round((laneW - w) / 2 + idxInSlot * 24);
    const y = 60 + row * rowGap + idxInSlot * 28;

    let style =
      'rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#6c8ebf;fontSize=11;';
    if (n.shape === 'terminator') {
      style =
        'rounded=1;whiteSpace=wrap;html=1;arcSize=50;fillColor=#d5e8d4;strokeColor=#82b366;fontStyle=1;fontSize=12;';
    } else if (n.shape === 'decision') {
      style =
        'rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontStyle=1;fontSize=11;';
    } else if (n.shape === 'io') {
      style =
        'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;fillColor=#ffffff;strokeColor=#6c8ebf;fontSize=11;';
    }

    cells.push(
      `<mxCell id="act_n_${esc(id)}" value="${esc(n.label)}" style="${style}" vertex="1" parent="lane_${esc(laneId)}"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry" /></mxCell>`,
    );
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
    width: startX * 2 + orderedLanes.length * laneW,
    height: laneH + 100,
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
