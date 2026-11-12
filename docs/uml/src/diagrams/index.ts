// Auto-loads every *.mmd file in ./list-diagrams.
// Add a new diagram by creating a new .mmd file there.
const files = import.meta.glob<string>('./list-diagrams/*.mmd', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const CATEGORIES = [
  'Flow Chart',
  'Use Case',
  'Activity Diagram',
  'Sequence Diagram',
  'ERD',
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Diagram = {
  name: string;
  source: string;
  category: Category;
};

function getCategory(name: string, source: string): Category {
  const lower = name.toLowerCase();
  if (lower.startsWith('use-case') || lower.startsWith('usecase') || lower.startsWith('use_case')) {
    return 'Use Case';
  }
  if (lower.startsWith('activity')) {
    return 'Activity Diagram';
  }
  if (lower.startsWith('sequence')) {
    return 'Sequence Diagram';
  }
  if (lower.startsWith('erd') || lower.startsWith('er-')) {
    return 'ERD';
  }
  if (lower.startsWith('flow')) {
    return 'Flow Chart';
  }
  const head = source.trimStart();
  if (head.startsWith('sequenceDiagram')) return 'Sequence Diagram';
  if (head.startsWith('erDiagram')) return 'ERD';
  if (head.startsWith('stateDiagram')) return 'Activity Diagram';
  return 'Flow Chart';
}

export const diagrams: Diagram[] = Object.entries(files)
  .map(([path, source]) => {
    const name = path.split('/').pop()!.replace('.mmd', '');
    return {
      name,
      source,
      category: getCategory(name, source),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
