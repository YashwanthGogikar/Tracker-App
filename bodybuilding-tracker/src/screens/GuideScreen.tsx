import { useTracker } from '../state/TrackerContext';

/** Renders workbook text, turning "●" lines into list items and keeping every word. */
function WorkbookText({ text }: { text: string }) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const out: JSX.Element[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) out.push(<ul key={`u${out.length}`} className="notes-list">{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>);
    bullets = [];
  };
  for (const l of lines) {
    if (l.startsWith('●')) bullets.push(l.replace(/^●\s*/, ''));
    else {
      flush();
      out.push(<p key={`p${out.length}`}>{l}</p>);
    }
  }
  flush();
  return <>{out}</>;
}

export function GuideScreen() {
  const { program } = useTracker();
  const notes = program.programNotes ?? '';
  const [heading, ...rest] = notes.split('\n');
  const blocks = program.weeks.reduce<{ name: string; note: string | null; weeks: number[] }[]>((acc, w) => {
    const last = acc[acc.length - 1];
    if (last && last.name === w.block) last.weeks.push(w.weekNumber);
    else acc.push({ name: w.block ?? '', note: w.blockNote, weeks: [w.weekNumber] });
    return acc;
  }, []);

  return (
    <>
      <header className="top">
        <p className="program-name">{program.workbookTitle ?? program.programName}</p>
        <h1 className="title">Program guide</h1>
      </header>
      <main className="page guide">
        <section className="guide-card">
          <h2>{heading.trim()}</h2>
          <WorkbookText text={rest.join('\n')} />
        </section>

        <section className="guide-card">
          <h2>Training blocks</h2>
          {blocks.map((b) => (
            <div key={b.name} className="block-entry">
              <h3>{b.name}</h3>
              <p className="muted">Weeks {b.weeks[0]}–{b.weeks[b.weeks.length - 1]}</p>
              {b.note && <p>{b.note}</p>}
            </div>
          ))}
        </section>

        {program.warmUpProtocol.map((s) => (
          <section key={s.title} className="guide-card">
            <h2>{s.title}</h2>
            {s.description && <WorkbookText text={s.description} />}
            <dl className="warmup">
              {s.items.map((it) => (
                <div key={it.label}>
                  <dt>{it.label}</dt>
                  <dd><WorkbookText text={it.instruction} /></dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        {program.copyright && <p className="copyright">{program.copyright}</p>}
      </main>
    </>
  );
}
