// Auto-loads every *.mmd file in ./list-diagrams.
// Add a new diagram by creating a new .mmd file there.
const files = import.meta.glob<string>('./list-diagrams/*.mmd', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export type Diagram = { name: string; source: string };

export const diagrams: Diagram[] = Object.entries(files)
  .map(([path, source]) => ({
    name: path.split('/').pop()!.replace('.mmd', ''),
    source,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
