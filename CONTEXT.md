# Retention

A personal spaced-repetition system that treats arbitrary conventions and derivable reasoning as different problems. This glossary is the language of the domain, not the stack.

## Language

**Record**:
An ordered payload the store appends and reads back. The store does not interpret it.
_Avoid_: Event (at the store seam), blob (too vague for callers)

**Event**:
A typed, past-tense fact about something that happened. Exists above the store, after a record is decoded.
_Avoid_: Record, log line, command

**Store**:
The append-only log of records. It does not know about cards, intervals, or meaning.
_Avoid_: Database, event store (implies it understands events)
