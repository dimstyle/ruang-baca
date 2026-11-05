import { useState } from 'react';
import Mermaid from './components/Mermaid';
import { diagrams } from './diagrams';
import './App.css';

function App() {
  const [active, setActive] = useState(diagrams[0]?.name ?? '');
  const current = diagrams.find((d) => d.name === active);

  return (
    <div className="app">
      <nav className="tabs">
        {diagrams.map((d) => (
          <button
            key={d.name}
            data-active={d.name === active}
            onClick={() => setActive(d.name)}
          >
            {d.name}
          </button>
        ))}
      </nav>
      {current ? (
        <Mermaid chart={current.source} />
      ) : (
        <p>No diagrams found in src/diagrams/.</p>
      )}
    </div>
  );
}

export default App;
