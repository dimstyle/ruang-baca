import { useEffect, useId, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'loose',
  themeVariables: {
    background: '#542177',
    primaryColor: '#8E1EA2',
    primaryTextColor: '#ffffff',
    primaryBorderColor: '#D552A3',
    secondaryColor: '#542177',
    secondaryTextColor: '#ffffff',
    secondaryBorderColor: '#D552A3',
    tertiaryColor: '#542177',
    tertiaryTextColor: '#ffffff',
    tertiaryBorderColor: '#8E1EA2',
    lineColor: '#D552A3',
    textColor: '#ffffff',
    mainBkg: '#8E1EA2',
    nodeBorder: '#D552A3',
    clusterBkg: '#542177',
    clusterBorder: '#D552A3',
    titleColor: '#ffffff',
    edgeLabelBackground: '#542177',
    actorBkg: '#8E1EA2',
    actorBorder: '#D552A3',
    actorTextColor: '#ffffff',
    actorLineColor: '#D552A3',
    signalColor: '#D552A3',
    signalTextColor: '#ffffff',
    labelBoxBkgColor: '#542177',
    labelBoxBorderColor: '#D552A3',
    labelTextColor: '#ffffff',
    loopTextColor: '#ffffff',
    activationBorderColor: '#D552A3',
    activationBkgColor: '#8E1EA2',
    sequenceNumberColor: '#ffffff',
    attributeBackgroundColorOdd: '#542177',
    attributeBackgroundColorEven: '#8E1EA2',
  },
});

type Props = { chart: string };

export default function Mermaid({ chart }: Props) {
  const id = 'mmd-' + useId().replace(/:/g, '');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Ensure any circle use-case node gets the .usecase class for uniform sizing
    const normalizedChart = chart.replace(
      /\(\("([^"]+)"\)\)(?!:::)/g,
      '(("$1")):::usecase',
    );
    mermaid
      .render(id, normalizedChart)
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

  if (error) {
    return (
      <pre className="rounded-lg border border-[#D552A3] bg-[#542177] p-4 text-sm text-white">
        {error}
      </pre>
    );
  }
  return (
    <div
      className="flex w-full justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
