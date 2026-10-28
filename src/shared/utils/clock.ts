// Every "now" comes from an injected Clock so tests control time (spec §6).
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
