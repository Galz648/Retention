Inbox — raw captured notes awaiting curation. Impure as a component (it
appends to the event log). Session CLI owns consent.

Does: append `inbox.captured` (trimmed text + time); list pending entries in
log order.
Does not: create cards, import engine Tags, compute Brightness, walk trees,
prompt, or bind a tree. Curation (promote / discard) is parked.

## Events

`inbox.captured` is a fact: this text was captured at this time. No due date,
interval, brightness, or card id.

Empty or whitespace-only text is not an event.

## Isolation

Inbox talks to Store and Codec. It never imports mastery, graph, scheduler,
Session, corpus I/O, or cli. Engine never imports inbox. Mastery folds only
`card.reviewed`; inbox events do not change Brightness.

Clock: `capture` lists Clock in `R`. Live does not construct or provide Clock.
