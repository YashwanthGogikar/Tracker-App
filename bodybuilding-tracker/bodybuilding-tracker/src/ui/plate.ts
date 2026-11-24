/** Workout colours borrow the competition weight-plate code: red, blue, yellow, green, white. */
const PLATES = ['var(--plate-red)', 'var(--plate-blue)', 'var(--plate-yellow)', 'var(--plate-green)', 'var(--plate-white)'];
export function plateColor(order: number): string {
  return PLATES[(order - 1) % PLATES.length];
}
