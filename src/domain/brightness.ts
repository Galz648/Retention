import { Schema } from "effect"

/**
 * PLACEHOLDER NAME — rename later. Candidates: retention, strength, readiness.
 * The [0, 1] number mastery emits. Scheduler and graph read it; they do not
 * compute it.
 */
export const Brightness = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(1),
  Schema.brand("Brightness"),
)
export type Brightness = typeof Brightness.Type
