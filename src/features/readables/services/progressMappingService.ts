// src/features/readables/services/progressMappingService.ts
import type { ReadableItem, BookReadable, FanficReadable } from '../types';

/**
 * The different “axes” a user might use to think about progress.
 *
 * - 'percent'  → generic 0–100% (works for everything)
 * - 'pages'    → books with a known page count
 * - 'chapters' → fanfics with AO3-style chapter metadata
 * - 'time'     → audio books / listening time (API placeholder for now)
 */
export type ProgressModeId = 'percent' | 'pages' | 'chapters' | 'time';

/**
 * Base info every tracker exposes.
 */
interface BaseProgressTracker {
  /** Kind of tracker (“dimension” of progress). */
  readonly kind: ProgressModeId;
  /** Human-friendly label for the UI (e.g. “Pages”, “Chapters”, “Time”). */
  readonly label: string;
  /**
   * Whether this tracker is meaningfully usable for this item.
   * e.g. we don’t expose a Pages tracker if there is no pageCount at all.
   */
  readonly enabled: boolean;
}

/**
 * Percent tracker: the canonical 0–100% value.
 */
export interface PercentProgressTracker extends BaseProgressTracker {
  readonly kind: 'percent';
  /** 0–100 (we’ll clamp, but this is the intended value). */
  readonly percent: number;
}

/**
 * Unit-based tracker (pages or chapters).
 *
 * Example:
 * - Pages:    current = 120, total = 350
 * - Chapters: current = 5,   total = 12
 */
export interface UnitProgressTracker extends BaseProgressTracker {
  readonly kind: 'pages' | 'chapters';
  /** Current unit value (page/chap) or null if unset. */
  readonly current: number | null;
  /** Total units, if known. */
  readonly total: number | null;
}

/**
 * Time-based tracker (for audio books etc.).
 *
 * NOTE: We don’t currently persist time-based fields in the DB.
 * This shape is here so the UI + future DB changes already have a place to plug into.
 */
export interface TimeProgressTracker extends BaseProgressTracker {
  readonly kind: 'time';
  /**
   * Current position in seconds.
   * (UI can convert to hh:mm:ss.)
   */
  readonly currentSeconds: number | null;
  /** Total length in seconds, if known. */
  readonly totalSeconds: number | null;
}

export type ProgressTracker = PercentProgressTracker | UnitProgressTracker | TimeProgressTracker;

/**
 * Bundle returned to the UI:
 * - a canonical “percent” tracker (always present)
 * - an array of other trackers the UI can render (pages/chapters/time)
 */
export interface ReadableProgressSnapshot {
  /** The canonical percent view. Always present. */
  readonly percent: PercentProgressTracker;
  /** Other available trackers for this item. */
  readonly trackers: ProgressTracker[];
}

/**
 * Clamp a numeric percent value into [0, 100] and round.
 */
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Helper to safely derive a percent from "current / total" when total > 0.
 */
function percentFromRatio(current: number | null, total: number | null): number | null {
  if (
    current == null ||
    total == null ||
    !Number.isFinite(current) ||
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return null;
  }

  const p = (current / total) * 100;
  if (!Number.isFinite(p)) return null;
  return clampPercent(p);
}

/**
 * Build the progress snapshot (percent + trackers) from a ReadableItem.
 *
 * This does **not** touch the DB. It is a pure “view model” that
 * lets the UI render and choose between different ways of thinking
 * about progress.
 */
export function buildProgressSnapshot(item: ReadableItem): ReadableProgressSnapshot {
  const basePercent = clampPercent(item.progressPercent ?? 0);

  // ---- Percent tracker (always present) ----
  const percentTracker: PercentProgressTracker = {
    kind: 'percent',
    label: 'Percent',
    enabled: true,
    percent: basePercent,
  };

  const trackers: ProgressTracker[] = [];

  // ---- Book: pages tracker ----
  if (item.type === 'book') {
    const book = item as BookReadable;
    const totalPages = book.pageCount ?? null;
    const currentPage = book.currentPage ?? null;

    const hasAnyPageInfo =
      (totalPages != null && totalPages > 0) || (currentPage != null && currentPage > 0);

    const pagesTracker: UnitProgressTracker = {
      kind: 'pages',
      label: 'Pages',
      enabled: hasAnyPageInfo,
      current: currentPage,
      total: totalPages,
    };

    trackers.push(pagesTracker);
  }

  // ---- Fanfic: chapters tracker ----
  if (item.type === 'fanfic') {
    const fanfic = item as FanficReadable;

    const totalChapters =
      fanfic.totalChapters ?? fanfic.availableChapters ?? fanfic.chapterCount ?? null;

    const currentChapter = fanfic.currentChapter ?? null;

    const hasAnyChapterInfo =
      (totalChapters != null && totalChapters > 0) ||
      (currentChapter != null && currentChapter > 0);

    const chaptersTracker: UnitProgressTracker = {
      kind: 'chapters',
      label: 'Chapters',
      enabled: hasAnyChapterInfo,
      current: currentChapter,
      total: totalChapters,
    };

    trackers.push(chaptersTracker);
  }

  // ---- Time-based tracker (placeholder) ----
  //
  // We don’t have time fields in ReadableItem yet. Once the DB / domain
  // grows fields like `currentTimeSeconds` / `totalTimeSeconds`, we can
  // read them here and flip `enabled` accordingly.
  const timeTracker: TimeProgressTracker = {
    kind: 'time',
    label: 'Time',
    enabled: false,
    currentSeconds: null,
    totalSeconds: null,
  };

  trackers.push(timeTracker);

  return {
    percent: percentTracker,
    trackers,
  };
}

/**
 * Input payload when a user edits progress in a particular mode.
 * The UI should send one of these back and we’ll turn it into an
 * updated `ReadableItem` shape the repository can persist.
 *
 * NOTE: This is intentionally separated from ProgressTracker.
 * - Tracker = “what we show”
 * - Update  = “what the user just did”
 */
export type ProgressUpdate =
  | {
      kind: 'percent';
      /** New percent value (we clamp). */
      percent: number;
    }
  | {
      kind: 'pages';
      /** New current page (1-based, UI already parsed it). */
      currentPage: number;
    }
  | {
      kind: 'chapters';
      /** New current chapter (1-based). */
      currentChapter: number;
    }
  | {
      kind: 'time';
      currentSeconds: number;
      totalSeconds: number | null;
    };

/**
 * Apply a progress update in a given mode and return a new ReadableItem
 * with updated fields.
 *
 * This is still pure and does **not** call the DB. Screens / hooks should:
 *
 *   1. Take the current `ReadableItem`
 *   2. Call `applyProgressUpdate` with the user’s input
 *   3. Send the resulting item into `readableRepository.update(...)`
 *
 * That keeps all the “how do we map units to percent?” logic here.
 */
export function applyProgressUpdate(item: ReadableItem, update: ProgressUpdate): ReadableItem {
  switch (update.kind) {
    case 'percent': {
      const percent = clampPercent(update.percent);

      // Derive units when possible, so UI stays roughly in sync:
      if (item.type === 'book') {
        const book = item as BookReadable;
        const total = book.pageCount ?? null;
        let currentPage = book.currentPage ?? null;

        if (total != null && total > 0) {
          const approxPage = Math.round((percent / 100) * total);
          currentPage = approxPage <= 0 ? 0 : approxPage;
        }

        return {
          ...book,
          progressPercent: percent,
          currentPage,
        };
      }

      if (item.type === 'fanfic') {
        const fanfic = item as FanficReadable;

        const total =
          fanfic.totalChapters ?? fanfic.availableChapters ?? fanfic.chapterCount ?? null;

        let currentChapter = fanfic.currentChapter ?? null;

        if (total != null && total > 0) {
          const approxChapter = Math.round((percent / 100) * total);
          currentChapter = approxChapter <= 0 ? 0 : approxChapter;
        }

        return {
          ...fanfic,
          progressPercent: percent,
          currentChapter,
        };
      }

      // For any future readable types, leave as-is.
      return item;
    }

    case 'pages': {
      if (item.type !== 'book') {
        // Ignore: pages only make sense for books.
        return item;
      }

      const book = item as BookReadable;
      const total = book.pageCount ?? null;

      const current = Number.isFinite(update.currentPage)
        ? Math.max(0, Math.round(update.currentPage))
        : 0;

      const clamped = total != null && total > 0 ? Math.min(current, total) : current;

      const percent = percentFromRatio(clamped, total);
      const finalPercent = percent != null ? percent : (book.progressPercent ?? 0);

      return {
        ...book,
        currentPage: clamped,
        progressPercent: finalPercent,
      };
    }

    case 'chapters': {
      if (item.type !== 'fanfic') {
        // Ignore: chapters only make sense for fanfic.
        return item;
      }

      const fanfic = item as FanficReadable;

      const total = fanfic.totalChapters ?? fanfic.availableChapters ?? fanfic.chapterCount ?? null;

      const current = Number.isFinite(update.currentChapter)
        ? Math.max(0, Math.round(update.currentChapter))
        : 0;

      const maxAllowed = total ?? current;
      const clamped = maxAllowed != null ? Math.min(current, maxAllowed) : current;

      const percent = percentFromRatio(clamped, total);
      const finalPercent = percent != null ? percent : (fanfic.progressPercent ?? 0);

      return {
        ...fanfic,
        currentChapter: clamped,
        progressPercent: finalPercent,
      };
    }

    case 'time': {
      const current = Number.isFinite(update.currentSeconds)
        ? Math.max(0, Math.round(update.currentSeconds))
        : 0;

      const total =
        update.totalSeconds != null && Number.isFinite(update.totalSeconds)
          ? Math.max(0, Math.round(update.totalSeconds))
          : null;

      const percent = percentFromRatio(current, total);
      const finalPercent = percent != null ? percent : (item.progressPercent ?? 0);

      // Once you add time fields to BookReadable / FanficReadable,
      // this is where you'd also set currentTimeSeconds / totalTimeSeconds.
      if (item.type === 'book') {
        const book = item as BookReadable;
        return {
          ...book,
          progressPercent: finalPercent,
        };
      }

      if (item.type === 'fanfic') {
        const fanfic = item as FanficReadable;
        return {
          ...fanfic,
          progressPercent: finalPercent,
        };
      }

      // For any future readable types, just leave as-is.
      return item;
    }

    default: {
      // TS exhaustiveness — this should never actually run.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _exhaustive: never = update;
      return item;
    }
  }
}
