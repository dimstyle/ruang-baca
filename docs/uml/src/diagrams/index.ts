// Auto-loads every *.mmd file in this folder.
// Add a new diagram by creating a new .mmd file here.
const files = import.meta.glob<string>('./*.mmd', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export type Diagram = { name: string; source: string };

export const diagrams: Diagram[] = Object.entries(files)
  .map(([path, source]) => ({
    name: path.replace('./', '').replace('.mmd', ''),
    source,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
