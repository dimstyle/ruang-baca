import { useEffect, useId, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
});

type Props = { chart: string };

export default function Mermaid({ chart }: Props) {
  const id = 'mmd-' + useId().replace(/:/g, '');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    mermaid
      .render(id, chart)
      .then(({ svg }) => {
        if (!cancelled) {
          setSvg(svg);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to render diagram');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, chart]);

  if (error) return <pre>{error}</pre>;
  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}
