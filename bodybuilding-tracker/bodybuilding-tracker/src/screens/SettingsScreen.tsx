import { useEffect, useRef, useState } from 'react';
import { BackupError, backupFileName, createBackup, parseBackup, restoreBackup, type BackupPreview } from '../storage/backup';
import { useTracker } from '../state/TrackerContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';

type Persist = 'unknown' | 'persisted' | 'not-persisted' | 'unsupported';

export function SettingsScreen() {
  const { program, repo, reload, state } = useTracker();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [persist, setPersist] = useState<Persist>('unknown');

  useEffect(() => {
    if (!navigator.storage?.persisted) return setPersist('unsupported');
    navigator.storage.persisted().then((p) => setPersist(p ? 'persisted' : 'not-persisted'), () => setPersist('unsupported'));
  }, []);

  const exportBackup = async () => {
    const backup = await createBackup(repo, program);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage({ kind: 'ok', text: `Exported ${a.download}. Check your Downloads folder.` });
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPreview(parseBackup(await file.text(), program));
      setMessage(null);
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof BackupError ? e.message : 'The file could not be read.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirmRestore = async () => {
    if (!preview) return;
    const p = preview;
    setPreview(null);
    try {
      await restoreBackup(repo, p.backup);
      await reload();
      setMessage({ kind: 'ok', text: `Restored ${p.completedExercises} checked exercises and ${p.loggedExercises} logged exercises.` });
    } catch (e) {
      setMessage({ kind: 'error', text: `Restore failed and nothing was changed: ${e instanceof Error ? e.message : String(e)}` });
    }
  };

  const requestPersist = async () => {
    const ok = await navigator.storage.persist();
    setPersist(ok ? 'persisted' : 'not-persisted');
  };

  return (
    <>
      <header className="top">
        <p className="program-name">{program.programName}</p>
        <h1 className="title">Settings</h1>
      </header>
      <main className="page">
        <section className="guide-card">
          <h2>Backup and restore</h2>
          <p>Your progress is saved only on this device. Backups are not made automatically, so export a file regularly and keep a copy somewhere else.</p>
          <p className="muted">Currently saved: {state.completed.size} checked {state.completed.size === 1 ? 'exercise' : 'exercises'}, {state.setLogs.size} {state.setLogs.size === 1 ? 'exercise' : 'exercises'} with logged loads.</p>
          <div className="stack">
            <button className="btn btn-primary btn-block" onClick={() => void exportBackup()}>Export progress</button>
            <button className="btn btn-block" onClick={() => fileRef.current?.click()}>Import backup file</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden data-testid="backup-file" onChange={(e) => void chooseFile(e.target.files?.[0])} />
          </div>
          {message && <p className={message.kind === 'ok' ? 'msg msg-ok' : 'msg msg-error'} role="status">{message.text}</p>}
        </section>

        <section className="guide-card">
          <h2>Storage on this device</h2>
          {persist === 'persisted' && <p>The browser has agreed to keep this app's data unless you clear it yourself.</p>}
          {persist === 'not-persisted' && (
            <>
              <p>The browser may clear this app's data if the phone runs low on space. Installing the app and asking for persistent storage makes that less likely.</p>
              <button className="btn btn-block" onClick={() => void requestPersist()}>Ask to keep data</button>
            </>
          )}
          {persist === 'unsupported' && <p>This browser does not report whether data is kept. Export backups regularly.</p>}
        </section>

        <section className="guide-card">
          <h2>Program data</h2>
          <p className="muted">
            Imported from {program.source.workbook}, sheet "{program.source.sheet}": {program.weeks.length} weeks,{' '}
            {program.weeks.reduce((a, w) => a + w.workouts.length, 0)} workouts.
          </p>
        </section>
      </main>

      {preview && (
        <ConfirmDialog title="Replace current progress?" confirmLabel="Replace progress" danger onCancel={() => setPreview(null)} onConfirm={() => void confirmRestore()}>
          <p>Everything saved on this device will be replaced with this backup from {new Date(preview.exportedAt).toLocaleString()}:</p>
          <ul>
            <li>{preview.completedExercises} checked exercises</li>
            <li>{preview.completedWorkouts} completed workouts</li>
            <li>{preview.loggedExercises} exercises with logged loads</li>
          </ul>
          {preview.programMismatch && <p className="msg msg-error">This backup was made for a different program.</p>}
          {preview.unknownExerciseIds.length > 0 && (
            <p className="msg msg-error">{preview.unknownExerciseIds.length} records refer to exercises not in this program. They will be stored but not shown.</p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
