// src/features/readables/ui/addEditSchema.ts
// §10 — Zod schema for the add/edit form.
// Defines input (form field string) types and output (validated, transformed) types.
//
// Key transforms:
//   - progressCurrent / progressTotal: '' → null, non-negative integer string → number
//   - Optional string fields (author, sourceUrl, summary): empty/whitespace → null
//   - tags: comma-separated string → string[]
//   - dateAdded: validated as YYYY-MM-DD, not in the future
//   - isComplete: boolean | null — no transform; controlled by Switch in screen
//
// Cross-field rules (superRefine):
//   - isComplete=true requires progressTotal to be non-null (AO3: Complete = known total)

import { z } from 'zod';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Today's date as YYYY-MM-DD in local time. Exported for form default values. */
export function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Reusable field schemas ────────────────────────────────────────────────────

/** Empty or whitespace string → null. Non-empty → trimmed string. */
const optionalStringField = z
  .string()
  .transform((val): string | null => val.trim() || null);

/**
 * Number-pad input: '' (or whitespace) → null. Non-negative integer string → number.
 * Use keyboardType="number-pad" in the TextInput (§10).
 */
const progressNumberField = z
  .string()
  .refine(
    (val) => {
      const t = val.trim();
      return t === '' || /^\d+$/.test(t);
    },
    { message: 'Must be a whole number of 0 or more' },
  )
  .transform((val): number | null => {
    const t = val.trim();
    return t === '' ? null : parseInt(t, 10);
  });

/**
 * YYYY-MM-DD format, not in the future (compared in local time).
 * todayLocalDate() is evaluated at validation time, not schema creation time.
 */
const dateAddedField = z
  .string()
  .min(1, 'Date is required')
  .refine((val) => /^\d{4}-\d{2}-\d{2}$/.test(val), {
    message: 'Date must be in YYYY-MM-DD format',
  })
  .refine((val) => !isNaN(new Date(val).getTime()), {
    message: 'Invalid date',
  })
  .refine((val) => val <= todayLocalDate(), {
    message: 'Date cannot be in the future',
  });

/** Comma-separated string → trimmed, non-empty string[]. */
const tagsField = z
  .string()
  .transform((val): string[] =>
    val.trim() === ''
      ? []
      : val
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
  );

// ── Schema ────────────────────────────────────────────────────────────────────

export const addEditSchema = z.object({
  /** Set at creation. Immutable after save. Shown on add screen, hidden on edit. */
  kind: z.enum(['book', 'fanfic']),
  title: z.string().min(1, 'Title is required'),
  /** Empty string in form → null in output. */
  author: optionalStringField,
  status: z.enum(['want_to_read', 'reading', 'completed', 'dnf']),
  /** String in form (§10) → number | null in output. */
  progressCurrent: progressNumberField,
  /** String in form (§10) → number | null in output. */
  progressTotal: progressNumberField,
  /** Empty string → null in output. */
  sourceUrl: optionalStringField,
  /** Empty string → null in output. */
  summary: optionalStringField,
  /** Comma-separated string → string[] in output. */
  tags: tagsField,
  /**
   * AO3 only: false = WIP, true = Complete. null for books (enforced in screen).
   * Controlled by a Switch — no string transform needed.
   */
  isComplete: z.boolean().nullable(),
  /** YYYY-MM-DD local date. Converted to full ISO in the submit handler. */
  dateAdded: dateAddedField,
}).superRefine((data, ctx) => {
  // Cross-field rule: isComplete=true requires a known progressTotal.
  // AO3 only shows "Complete" when total chapters are known (X/X format).
  // superRefine receives post-transform values: progressTotal is number | null here.
  if (data.isComplete === true && data.progressTotal === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['progressTotal'],
      message: 'Total chapters is required when marking a work as complete',
    });
  }
});

// ── Form types ────────────────────────────────────────────────────────────────

/**
 * Input type — what React Hook Form Controller values contain.
 * All TextInput fields are strings; isComplete is boolean | null.
 */
export type AddEditFormValues = z.input<typeof addEditSchema>;

/**
 * Output type — what handleSubmit receives after Zod parses and transforms.
 * Progress fields are number | null. Optional strings are string | null. Tags is string[].
 */
export type AddEditFormOutput = z.output<typeof addEditSchema>;
