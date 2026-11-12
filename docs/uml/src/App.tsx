import { useEffect, useRef, useState } from 'react';
import Mermaid from './components/Mermaid';
import { CATEGORIES, type Category, diagrams } from './diagrams';

function App() {
  const [active, setActive] = useState(
    diagrams.find((d) => d.category === 'Use Case')?.name ??
      diagrams[0]?.name ??
      '',
  );
  const [openCategory, setOpenCategory] = useState<Category | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const current = diagrams.find((d) => d.name === active);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenCategory(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-[#542177] text-white flex flex-col">
      {/* 30% Secondary Header / Navbar (#8E1EA2) with 10% Accent (#D552A3) */}
      <header className="bg-[#8E1EA2] border-b-2 border-[#D552A3] px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-block h-3 w-3 rounded-full bg-[#D552A3]" />
            <h1 className="text-lg font-bold tracking-wide">
              Ruang Baca — UML Diagrams
            </h1>
          </div>

          <nav ref={navRef} className="flex flex-wrap items-center gap-3">
            {CATEGORIES.map((category) => {
              const items = diagrams.filter((d) => d.category === category);
              const isCategoryActive = current?.category === category;
              const isOpen = openCategory === category;

              return (
                <div key={category} className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenCategory(isOpen ? null : category)
                    }
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer border ${
                      isCategoryActive || isOpen
                        ? 'bg-[#D552A3] border-white/40 text-white shadow-md'
                        : 'bg-[#542177] border-[#D552A3]/60 text-white hover:bg-[#D552A3]/80'
                    }`}
                  >
                    <span>{category}</span>
                    <span className="rounded-full bg-[#542177]/70 px-2 py-0.5 text-xs">
                      {items.length}
                    </span>
                    <svg
                      className={`h-4 w-4 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="absolute left-0 z-50 mt-2 min-w-56 rounded-lg border border-[#D552A3] bg-[#8E1EA2] py-1 shadow-xl">
                      {items.length > 0 ? (
                        items.map((item) => {
                          const isSelected = item.name === active;
                          return (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() => {
                                setActive(item.name);
                                setOpenCategory(null);
                              }}
                              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-[#D552A3] font-semibold text-white'
                                  : 'text-white hover:bg-[#542177]'
                              }`}
                            >
                              <span>{item.name}</span>
                              {isSelected && (
                                <span className="h-2 w-2 rounded-full bg-white" />
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-4 py-2.5 text-xs text-white/75 italic">
                          Belum ada diagram {category}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </header>

      {/* 60% Dominant Main Workspace (#542177) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        <div className="rounded-xl border border-[#D552A3] bg-[#8E1EA2] p-4 shadow-xl">
          {current ? (
            <>
              <div className="mb-4 flex items-center justify-between border-b border-[#D552A3]/50 pb-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-[#D552A3] px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                    {current.category}
                  </span>
                  <h2 className="text-base font-semibold">{current.name}</h2>
                </div>
              </div>
              <div className="rounded-lg bg-[#542177] p-6">
                <Mermaid chart={current.source} />
              </div>
            </>
          ) : (
            <p className="p-6 text-center text-white/80">
              No diagrams found in src/diagrams/.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
