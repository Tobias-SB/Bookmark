import * as fc from 'fast-check';

import { isAppError } from '@/shared/types/errors';

import { GENESIS_HLC, hlcReceive, hlcTick, isHlc, MAX_REMOTE_DRIFT_MS } from '../hlc';

const DEVICE = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const WALL = 1_761_700_000_000;

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
}

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

  it('rejects a malformed previous clock and a device id that is not a UUID', () => {
    expect(isAppError(thrown(() => hlcTick('not-a-clock', WALL, DEVICE)))).toBe(true);
    for (const bad of ['bad:id', '', 'x\ny', GENESIS_HLC.slice(22), `${DEVICE}\n`]) {
      expect(thrown(() => hlcTick(null, 1, bad))).toMatchObject({ code: 'validation' });
    }
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
    expect(isAppError(thrown(() => hlcReceive(null, '123:4:x', WALL, DEVICE)))).toBe(true);
    expect(isAppError(thrown(() => hlcReceive(null, '999999999999999:99998:evil', WALL, DEVICE)))).toBe(true);
  });

  it('rejects a remote clock at the wall ceiling, which would leave this device unable to tick', () => {
    for (const counter of ['00000', '99998', '99999']) {
      const remote = `999999999999999:${counter}:${OTHER}`;
      expect(thrown(() => hlcReceive(null, remote, 10 ** 15 - 1, DEVICE))).toMatchObject({ code: 'validation' });
    }
  });

  it('accepts a remote just inside the drift bound and rejects one just outside', () => {
    const at = (wall: number) => `${String(wall).padStart(15, '0')}:00000:${OTHER}`;
    expect(hlcReceive(null, at(WALL + MAX_REMOTE_DRIFT_MS), WALL, DEVICE)).toBe(`00${WALL + MAX_REMOTE_DRIFT_MS}:00001:${DEVICE}`);
    expect(thrown(() => hlcReceive(null, at(WALL + MAX_REMOTE_DRIFT_MS + 1), WALL, DEVICE))).toMatchObject({ code: 'validation' });
  });
});

describe('isHlc', () => {
  it('accepts the §9.2 grammar with a UUID device id', () => {
    expect(isHlc(GENESIS_HLC)).toBe(true);
    expect(isHlc(`00${WALL}:00001:${DEVICE.toUpperCase()}`)).toBe(true);
  });

  it('rejects anything else', () => {
    for (const bad of ['000000000000000:00000:!', '00000000000000:00000:' + DEVICE, '000000000000000:0000:' + DEVICE, `000000000000000:00000:${DEVICE}\n`, '']) {
      expect(isHlc(bad)).toBe(false);
    }
  });
});

describe('HLC ordering', () => {
  it('GENESIS_HLC sorts below every clock this module can produce', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 45 }), fc.uuid(), (wall, device) => {
        fc.pre(device !== GENESIS_HLC.slice(22));
        const clock = hlcTick(null, wall, device);
        expect(isHlc(clock)).toBe(true);
        expect(GENESIS_HLC < clock).toBe(true);
      }),
    );
  });

  type Step = { kind: 'tick'; wall: number } | { kind: 'receive'; wall: number; remoteOffset: number; remoteCounter: number };
  const wall = fc.integer({ min: 0, max: 2 ** 45 });
  const step: fc.Arbitrary<Step> = fc.oneof(
    fc.record({ kind: fc.constant('tick' as const), wall }),
    fc.record({ kind: fc.constant('receive' as const), wall, remoteOffset: fc.integer({ min: -(2 ** 40), max: MAX_REMOTE_DRIFT_MS }), remoteCounter: fc.integer({ min: 0, max: 99_999 }) }),
  );

  it('string order equals time order: every new clock is greater than the last and every remote seen', () => {
    fc.assert(
      fc.property(fc.array(step, { maxLength: 60 }), (steps) => {
        let last: string | null = null;
        for (const s of steps) {
          const remote = `${String(s.kind === 'receive' ? Math.max(0, s.wall + s.remoteOffset) : 0).padStart(15, '0')}:${String(s.kind === 'receive' ? s.remoteCounter : 0).padStart(5, '0')}:${OTHER}`;
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
