# Retention

A personal spaced-repetition system that treats arbitrary conventions and derivable reasoning as different problems. This glossary is the language of the domain, not the stack.

The person using the program sees **titles**, prompts, and the words below. They do not see folder names, card ids, or file formats.

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

**Tree**:
A named body of cards you study as one subject. Two kinds: knowledge tree and term deck. Each tree has one **track**.
_Avoid_: deck (alone), corpus, slug, folder name

**Track**:
Why this tree exists for you: **university** (course work) or **curiosity** (personal research — a subject, concept, or tool). Orthogonal to kind. The person picks a track, then a tree.
_Avoid_: tag, label, folder, mixed queue

**Knowledge tree**:
A map of concepts and the dependencies between them. You rebuild explanations (derivation), and name facts when they sit on those concepts.
_Avoid_: course dump, seed tree (importer leftover)

**Term deck**:
A list of names and conventions to recall. Little or no dependency map. Biology ecology terms, German frequency, and so on.
_Avoid_: Term Drill State, slug titles (`biology-ii-ecology`)

**Title**:
The tree's human name. This is how a person refers to a tree.
_Avoid_: tree id, folder name, slug

**Node**:
A concept in a tree. Cards hang off it.
_Avoid_: topic, card

**Card**:
A prompt you review. Either recall or derivation in this version.
_Avoid_: item, note, flashcard

**Recall**:
A card whose answer you either produced or you didn't. Facts, conventions, names.
_Avoid_: fact card, cloze

**Derivation**:
A card that asks you to rebuild reasoning from scratch.
_Avoid_: essay card

**Must-hit**:
A claim a correct derivation has to assert.
_Avoid_: rubric item, keyword

**Queue**:
The cards that are due and unblocked right now, recall first.
_Avoid_: due list, session (session is the runner)

**Brightness**:
Placeholder name for how well a card is known right now, from 0 to 1.
_Avoid_: stability, due date, interval (those stay inside mastery)
