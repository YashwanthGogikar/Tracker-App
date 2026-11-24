import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../App';
import { TrackerProvider } from '../state/TrackerContext';
import { IndexedDbRepository } from '../storage/indexedDbRepository';
import { loadBundledProgram } from '../storage/staticProgramRepository';
import { freshDbName } from './setup';

const program = loadBundledProgram();

function mount(dbName: string) {
  const repo = new IndexedDbRepository(dbName);
  const utils = render(
    <TrackerProvider program={program} repo={repo}>
      <App />
    </TrackerProvider>,
  );
  return { ...utils, repo };
}

describe('workout screen', () => {
  it('selects a week, opens a workout, counts completions and persists them', async () => {
    const user = userEvent.setup();
    const db = freshDbName();
    const { unmount, repo } = mount(db);

    await user.selectOptions(await screen.findByLabelText('Week'), '2');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Week 2');

    await user.click(screen.getByRole('button', { name: /Legs \(Hypertrophy Focus\)/ }));
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(5);
    expect(screen.getByText(/Exercises completed:/)).toHaveTextContent('Exercises completed: 0 / 5');

    await user.click(boxes[0]);
    await user.click(boxes[1]);
    expect(screen.getByText(/Exercises completed:/)).toHaveTextContent('2 / 5');
    expect(screen.getByText('40%')).toBeTruthy();
    expect(screen.queryByText('Workout Completed!')).toBeNull();

    for (const b of boxes.slice(2)) await user.click(b);
    expect(await screen.findByText('Workout Completed!')).toBeTruthy();

    await user.click(boxes[4]); // uncheck
    expect(screen.queryByText('Workout Completed!')).toBeNull();
    expect(screen.getByText(/Exercises completed:/)).toHaveTextContent('4 / 5');

    unmount();
    await repo.close();

    // Fresh app instance on the same database = page refresh.
    mount(db);
    await user.click(await screen.findByRole('button', { name: /Legs \(Hypertrophy Focus\)/ }));
    const again = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(again.map((b) => b.checked)).toEqual([true, true, true, true, false]);
  });

  it('asks before resetting a completed workout', async () => {
    const user = userEvent.setup();
    mount(freshDbName());
    await user.click(await screen.findByRole('button', { name: /Legs \(Hypertrophy Focus\)/ }));
    for (const b of screen.getAllByRole('checkbox')) await user.click(b);
    expect(await screen.findByText('Workout Completed!')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Reset workout' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Reset this completed workout?');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Workout Completed!')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Reset workout' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset workout' }));
    expect(await screen.findByText(/Exercises completed:/)).toHaveTextContent('0 / 5');
    expect((screen.getAllByRole('checkbox') as HTMLInputElement[]).every((b) => !b.checked)).toBe(true);
  });
});

describe('load and rep logging', () => {
  it('saves typed load and reps and shows them after a refresh', async () => {
    const user = userEvent.setup();
    const db = freshDbName();
    const { unmount, repo } = mount(db);
    await user.click(await screen.findByRole('button', { name: /Pull \(Hypertrophy Focus\)/ }));
    await user.click(screen.getAllByRole('button', { name: 'Details and logging' })[0]);
    await user.type(screen.getByLabelText('Set 1 load'), '80');
    await user.type(screen.getByLabelText('Set 1 reps'), '9'); // blurs load first
    await user.tab(); // blur reps
    expect(screen.getByLabelText('Set 1 reps')).toHaveValue('9');
    // Let pending writes finish before "refreshing".
    await new Promise((r) => setTimeout(r, 50));
    unmount();
    await repo.close();

    mount(db);
    await user.click(await screen.findByRole('button', { name: /Pull \(Hypertrophy Focus\)/ }));
    await user.click(screen.getAllByRole('button', { name: 'Details and logging' })[0]);
    expect(screen.getByLabelText('Set 1 load')).toHaveValue('80');
    expect(screen.getByLabelText('Set 1 reps')).toHaveValue('9');
  });
});
