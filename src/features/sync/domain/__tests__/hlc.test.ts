import * as fc from 'fast-check';

import { isAppError } from '@/shared/types/errors';

import { GENESIS_HLC, hlcReceive, hlcTick } from '../hlc';

const DEVICE = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const WALL = 1_761_700_000_000;

describe('hlcTick', () => {
  it('starts from the wall clock when there is no previous clock', () => {
    expect(hlcTick(null, WALL, DEVICE)).toBe(`00${WALL}:00000:${DEVICE}`);
  });

  it('resets the counter when the wall clock moves forward', () => {
    expect(hlcTick(`00${WALL}:00007:${DEVICE}`, WALL + 5, DEVICE)).toBe(`00${WALL + 5}:00000:${DEVICE}`);
  });

  it('bumps the counter when the wall clock stands still', () => {
    expect(hlcTick(`00${WALL}:00007:${DEVICE}`, WALL, DEVICE)).toBe(`00${WALL}:00008:${DEVICE}`);
  });

  it('never goes backwards when the wall clock does', () => {
    expect(hlcTick(`00${WALL}:00007:${DEVICE}`, WALL - 60_000, DEVICE)).toBe(`00${WALL}:00008:${DEVICE}`);
  });

  it('borrows the next millisecond when the counter overflows', () => {
    expect(hlcTick(`00${WALL}:99999:${DEVICE}`, WALL, DEVICE)).toBe(`00${WALL + 1}:00000:${DEVICE}`);
  });

  it('treats a broken wall clock as zero', () => {
    expect(hlcTick(null, Number.NaN, DEVICE)).toBe(`000000000000000:00000:${DEVICE}`);
    expect(hlcTick(null, -5, DEVICE)).toBe(`000000000000000:00000:${DEVICE}`);
    expect(hlcTick(`00${WALL}:00001:${DEVICE}`, Number.NaN, DEVICE)).toBe(`00${WALL}:00002:${DEVICE}`);
  });

  it('rejects a malformed previous clock and device id', () => {
    const attempt = (fn: () => string) => {
      try {
        fn();
      } catch (error) {
        return error;
      }
      return undefined;
    };
    expect(isAppError(attempt(() => hlcTick('not-a-clock', WALL, DEVICE)))).toBe(true);
    expect(isAppError(attempt(() => hlcTick(null, WALL, 'bad:id')))).toBe(true);
    expect(isAppError(attempt(() => hlcTick(null, WALL, '')))).toBe(true);
  });
});

describe('hlcReceive', () => {
  it('jumps ahead of a remote clock that is ahead of local time', () => {
    const remote = `00${WALL + 10_000}:00003:${OTHER}`;
    expect(hlcReceive(`00${WALL}:00009:${DEVICE}`, remote, WALL, DEVICE)).toBe(`00${WALL + 10_000}:00004:${DEVICE}`);
  });

  it('keeps the local clock when it is ahead of the remote', () => {
    const remote = `00${WALL - 10}:00050:${OTHER}`;
    expect(hlcReceive(`00${WALL}:00002:${DEVICE}`, remote, WALL - 100, DEVICE)).toBe(`00${WALL}:00003:${DEVICE}`);
  });

  it('takes the larger counter when local and remote share the wall time', () => {
    const remote = `00${WALL}:00040:${OTHER}`;
    expect(hlcReceive(`00${WALL}:00002:${DEVICE}`, remote, WALL, DEVICE)).toBe(`00${WALL}:00041:${DEVICE}`);
  });

  it('uses the wall clock when it is ahead of both', () => {
    const remote = `00${WALL}:00040:${OTHER}`;
    expect(hlcReceive(`00${WALL}:00002:${DEVICE}`, remote, WALL + 1, DEVICE)).toBe(`00${WALL + 1}:00000:${DEVICE}`);
  });

  it('works before the first local write', () => {
    expect(hlcReceive(null, `00${WALL}:00004:${OTHER}`, WALL - 1, DEVICE)).toBe(`00${WALL}:00005:${DEVICE}`);
  });

  it('rejects a malformed remote clock', () => {
    expect(() => hlcReceive(null, '123:4:x', WALL, DEVICE)).toThrow();
  });
});

describe('HLC ordering', () => {
  it('GENESIS_HLC sorts below a real clock', () => {
    expect(GENESIS_HLC < hlcTick(null, 1, DEVICE)).toBe(true);
    expect(GENESIS_HLC < hlcTick(null, 0, DEVICE)).toBe(true);
  });

  type Step = { kind: 'tick'; wall: number } | { kind: 'receive'; wall: number; remoteWall: number; remoteCounter: number };
  const wall = fc.integer({ min: 0, max: 2 ** 45 });
  const step: fc.Arbitrary<Step> = fc.oneof(
    fc.record({ kind: fc.constant('tick' as const), wall }),
    fc.record({ kind: fc.constant('receive' as const), wall, remoteWall: wall, remoteCounter: fc.integer({ min: 0, max: 99_999 }) }),
  );

  it('string order equals time order: every new clock is greater than the last and every remote seen', () => {
    fc.assert(
      fc.property(fc.array(step, { maxLength: 60 }), (steps) => {
        let last: string | null = null;
        for (const s of steps) {
          const remote = `${String(s.kind === 'receive' ? s.remoteWall : 0).padStart(15, '0')}:${String(s.kind === 'receive' ? s.remoteCounter : 0).padStart(5, '0')}:${OTHER}`;
          const next: string = s.kind === 'tick' ? hlcTick(last, s.wall, DEVICE) : hlcReceive(last, remote, s.wall, DEVICE);
          expect(next).toMatch(/^\d{15}:\d{5}:/);
          if (last !== null) expect(next > last).toBe(true);
          if (s.kind === 'receive') expect(next > remote).toBe(true);
          expect(Number(next.slice(0, 15))).toBeGreaterThanOrEqual(Math.min(s.wall, 10 ** 15 - 1));
          last = next;
        }
      }),
    );
  });
});
