import { systemClock } from '../clock';

it('systemClock returns the current time', () => {
  const before = Date.now();
  const now = systemClock.now().getTime();
  expect(now).toBeGreaterThanOrEqual(before);
  expect(now).toBeLessThanOrEqual(Date.now());
});
