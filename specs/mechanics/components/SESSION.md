Session — impure. Runs a review: composes the engine, reads the stores, records what happened.

Does: compose the engine, read the stores, write to the event log.
Does not: decide what's due, compute mastery, check prerequisites, or create nodes.

`queue` is read-only (missing log = empty history, no file created). `grade` appends exactly one `CardReviewed`.

Consent lives in the CLI, not here. Session.grade assumes the caller already got a yes. Session never prompts and never creates a Clock — the CLI supplies Clock and confirmation.
