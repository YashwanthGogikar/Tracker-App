import { useCallback, useEffect, useState } from 'react';
import { GuideScreen } from './screens/GuideScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { WorkoutsScreen } from './screens/WorkoutsScreen';
import { useTracker } from './state/TrackerContext';

type Tab = 'workouts' | 'progress' | 'guide' | 'settings';

const icons: Record<Tab, JSX.Element> = {
  workouts: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 10v4M5 7v10M8 9v6M8 12h8M16 9v6M19 7v10M22 10v4" /></svg>
  ),
  progress: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V13M10 20V8M16 20V11M22 20H2M20 20V4" /></svg>
  ),
  guide: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z" /></svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
  ),
};
const labels: Record<Tab, string> = { workouts: 'Workouts', progress: 'Progress', guide: 'Program Guide', settings: 'Settings' };

export default function App() {
  const { selectWeek } = useTracker();
  const [tab, setTab] = useState<Tab>('workouts');
  const [openWorkoutId, setOpenWorkoutId] = useState<string | null>(null);

  // Android back button closes an open workout instead of leaving the app.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => setOpenWorkoutId((e.state as { workoutId?: string } | null)?.workoutId ?? null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openWorkout = useCallback((id: string) => {
    history.pushState({ workoutId: id }, '');
    setOpenWorkoutId(id);
    window.scrollTo(0, 0);
  }, []);
  const closeWorkout = useCallback(() => {
    if ((history.state as { workoutId?: string } | null)?.workoutId) history.back();
    else setOpenWorkoutId(null);
  }, []);

  const go = (t: Tab) => {
    if (t === 'workouts' && tab === 'workouts' && openWorkoutId) closeWorkout();
    setTab(t);
    window.scrollTo(0, 0);
  };

  return (
    <div className="app">
      {tab === 'workouts' && <WorkoutsScreen openWorkoutId={openWorkoutId} onOpenWorkout={openWorkout} onBack={closeWorkout} />}
      {tab === 'progress' && (
        <ProgressScreen
          onOpenWeek={(w) => {
            void selectWeek(w);
            if (openWorkoutId) closeWorkout();
            setTab('workouts');
            window.scrollTo(0, 0);
          }}
        />
      )}
      {tab === 'guide' && <GuideScreen />}
      {tab === 'settings' && <SettingsScreen />}

      <nav className="tabbar" aria-label="Main">
        {(Object.keys(labels) as Tab[]).map((t) => (
          <button key={t} className={t === tab ? 'tab active' : 'tab'} aria-current={t === tab ? 'page' : undefined} onClick={() => go(t)}>
            {icons[t]}
            <span>{labels[t]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
