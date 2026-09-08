Locked for this version.

- **The command-line program is the only client.** No environment variables, no “open this file to see the card.” Tree, queue, card text, and grades all go through the program.
- **The person sees titles and glossary words**, never folder names or card ids. Those stay on disk for the computer.
- **Pure vs impure is a user-facing label.** Pure = no create/append/move/delete. Impure asks permission; default no. If the program cannot ask yes/no, impure commands refuse. No `--yes`.
- **Consent is in the program, not in Session.** Session.grade does not prompt.
- **TypeScript does not emit a binary.** The compiler emits JavaScript. The artifact is Bun compile → one standalone program.
- Threshold, the spaced-repetition library's internal scales, and the name Brightness stay placeholders until evidence. Parked features stay parked.
- **The program is named `retention`.** That is the binary, the package, and the word you type.
- **Experience, not wiring:** list trees by title; each command chooses a tree; grade asks before it writes. Those are how the program must feel, not leftover internals.
- **Feel must stay useful.** Banner, color, completions, and select are in scope for the client. They must not appear on piped output and must not bury the queue.
- **Rust for the client is allowed, not chosen.** Engine stays TypeScript. Revisit if a TypeScript client cannot do completions + TTY select + color + one binary without pain.
