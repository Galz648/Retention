Mastery — pure. Tracks how well you know each card, and how that fades.

Does: track how well each card is known and how that fades, reading the event log, card type, and current time.
Does not: pick cards, check prerequisites.

Mastery emits a single number per card, 0–1, meaning how well it's known now. It uses FSRS's stability/difficulty maths as a library internally but discards FSRS's next-due-date and converts stability to that number itself. The scheduler reads only that number plus a threshold — it never sees intervals or review dates. Card type affects the decay curve inside mastery only (recall fast, derivation slow, practice between); it is not re-read downstream.
