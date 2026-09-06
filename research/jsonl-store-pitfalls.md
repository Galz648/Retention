# JSONL append-only store pitfalls

Research for [issue 9](https://github.com/Galz648/Retention/issues/9). No implementation.

**Question:** what error cases and I/O facts must the store interface account for if the real adapter is an append-only JSONL file on a single-user Mac, written from Node?

**Constraint from SPEC, not from the OS:** the store is append-only, holds opaque events, and is the only I/O. It knows nothing about cards, intervals, or meaning. ([SPEC.md](../SPEC.md) Part I §1; Part II “The event vocabulary”; Part III.)

---

## Verdict (read this first)

`fs.appendFile` with its default `'a'` flag (`O_APPEND`) is enough to keep *complete* records from overwriting each other. File locking is not required for v1 on a single-user Mac. It does **not** make a crash mid-append impossible, and it does **not** make a write durable across power loss.

JSON parse does **not** live in the store. The adapter owns bytes and JSONL framing (UTF-8, newlines, missing-vs-empty, a torn last line). It returns opaque strings. `JSON.parse` sits in a codec above the store and below the scheduler. Event-type interpretation sits above that, at the event vocabulary.

The interface must name these outcomes: I/O failure (permission, no space, not a file, generic I/O), missing file as empty history, empty file as empty history, and an incomplete last record after a torn append. A complete line that is not JSON is a codec error, not a store error.

---

## 1. What “append” actually does

### Node

`fs.appendFile` / `fsPromises.appendFile` “asynchronously append data to a file, creating the file if it does not yet exist.” Default encoding is `'utf8'`. Default flag is `'a'`. Optional `flush` (default `false`) flushes the fd before close. Success fulfills with `undefined`. ([Node.js fs, `fs.appendFile` / `fsPromises.appendFile`](https://nodejs.org/api/fs.html))

Flag `'a'`: “Open file for appending. The file is created if it does not exist.” ([Node.js fs, File system flags](https://nodejs.org/api/fs.html#file-system-flags))

`fs.constants.O_APPEND`: “Flag indicating that data will be appended to the end of the file.” ([Node.js fs, File Access Constants](https://nodejs.org/api/fs.html#file-access-constants))

`flush: true` uses `fs.fsync` / `filehandle.sync()`, which Node documents as the POSIX `fsync(2)` request that data be flushed to the storage device. Implementation is OS- and device-specific. ([Node.js fs, `fs.fsync`](https://nodejs.org/api/fs.html))

Promise and callback `fs` APIs “are not synchronized or threadsafe. Care must be taken when performing multiple concurrent modifications on the same file or data corruption may occur.” ([Node.js fs, Promises API](https://nodejs.org/api/fs.html#promises-api)) That warning is about unsynchronized *application* writes (read-modify-write, overlapping `writeFile`). It is not a claim that `O_APPEND` is broken. The adapter still must append each record as one complete payload (value + `'\n'`), not as several writes that together make a line.

Do not `access()` / `exists()` then `open()`. Node documents that as a race: another process can change the path between the two calls. Open or append directly and handle the error. ([Node.js fs, `fs.access`](https://nodejs.org/api/fs.html#fsaccesspath-mode-callback))

### POSIX / Darwin

Darwin `open(2)`: “Opening a file with `O_APPEND` set causes each write on the file to be appended to the end.” ([`open(2)`](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/open.2.html), macOS 26.5)

POSIX `write()`: “If the `O_APPEND` flag of the file status flags is set, the file offset shall be set to the end of the file prior to each write and no intervening file modification operation shall occur between changing the file offset and the write operation.” ([POSIX.1-2024 `write()`](https://pubs.opengroup.org/onlinepubs/9799919799/functions/write.html))

That is the concurrent-writer guarantee: seek-to-EOF and the write are one modification. Two processes each `write()` a complete line under `O_APPEND` do not overwrite each other.

It is **not** a crash-atomicity guarantee, and it is **not** `{PIPE_BUF}` atomicity. `{PIPE_BUF}` applies to pipes and FIFOs only. POSIX is explicit that a write of `{PIPE_BUF}` bytes or less “shall not be interleaved” on a pipe/FIFO; it does not say that about regular files. ([POSIX.1-2024 `write()`, Rationale](https://pubs.opengroup.org/onlinepubs/9799919799/functions/write.html))

`write()` may transfer fewer bytes than requested when there is no room, or after a signal has already written some data (`EINTR` after a partial transfer). The return value is the number of bytes actually written, “never … greater than `nbyte`.” ([POSIX.1-2024 `write()`](https://pubs.opengroup.org/onlinepubs/9799919799/functions/write.html)) Darwin `write(2)` lists `ENOSPC`, `EDQUOT`, `EFBIG`, `EIO`, `EINTR` among the failures. ([`write(2)`](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/write.2.html), macOS 26.5)

**Adapter rule:** one append = one `appendFile` of the opaque payload plus `'\n'`. Never assemble a record across multiple writes.

---

## 2. Partial last line after a crash mid-append

Three different crashes, three different guarantees.

### Process crash after `write()` / `appendFile` has returned

POSIX: after a successful `write()` to a regular file, a later successful `read()` of those byte positions “shall return the data specified by the write” until those positions are written again. ([POSIX.1-2024 `write()`](https://pubs.opengroup.org/onlinepubs/9799919799/functions/write.html))

So another process (or the next CLI invocation) sees the full append. The kernel already accepted the bytes. `flush: false` does not change that visibility.

### Process crash or signal *during* `write()`

POSIX: if a signal interrupts `write()` after some data was written, `write()` returns the number of bytes written; if it interrupts before any data, it returns `-1` / `EINTR`. ([POSIX.1-2024 `write()`](https://pubs.opengroup.org/onlinepubs/9799919799/functions/write.html))

A kill during the syscall can therefore leave a short write: a last line that is not a complete record and may lack `'\n'`.

### OS crash or power loss

Darwin `fsync(2)` moves in-core buffers to the “permanent storage device,” then immediately warns that the drive may not have written the platters, may reorder, and that after power loss or an OS crash “the application may find that only some or none of their data was written.” “This is not a theoretical edge case.” Databases that need ordering should use `F_FULLFSYNC`. ([`fsync(2)`](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/fsync.2.html), macOS 26.5)

Darwin `fcntl(2)` `F_FULLFSYNC`: same as `fsync(2)`, then asks the drive to flush buffered data to permanent storage. Implemented on APFS (among others). “The operation may take quite a while.” Some drives have been known to ignore the flush request. ([`fcntl(2)`](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/fcntl.2.html), macOS 26.5)

Node’s `flush: true` is `fsync`, not `F_FULLFSYNC`. There is no first-party Node switch for `F_FULLFSYNC`.

APFS copy-on-write plus checkpoints protect *filesystem* consistency: an interrupted checkpoint is ignored on mount and the volume rolls back to the last valid state. ([Apple File System Reference](https://developer.apple.com/support/downloads/Apple-File-System-Reference.pdf); [APFS FAQ](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/APFS_Guide/FAQ/FAQ.html)) That is “the volume is not corrupt,” not “this particular append is all-or-nothing and durable.” Combined with `fsync(2)`’s own warning, the last append may be missing, or a prefix of it may be present.

**What the store must do:** treat a torn last record as a first-class, named outcome. Do not pretend `O_APPEND` or `flush: true` made it impossible.

**How to tell a torn write from a legal JSON Lines ending:** JSON Lines *recommends* a terminator after the last value but does not require one. A file that ends with a valid JSON value and no `'\n'` is still legal. A blank line is not a valid value. ([JSON Lines](https://jsonlines.org/))

So “no trailing newline” is not by itself a crash. Distinguish:

| File ending | Meaning |
|---|---|
| `…<valid JSON>\n` | Normal. |
| `…<valid JSON>` with no final `'\n'` | Legal JSON Lines last value. |
| `…<bytes that are not a JSON value>` with no final `'\n'` | Torn append (or corruption). |
| Mid-file `<not JSON>\n` | Corrupt record, not a crash tail. |
| Mid-file blank line | Illegal JSON Lines (a blank line is not a value). |

The store sees bytes and newlines. The codec decides “is this a JSON value?” The store should still *name* `IncompleteRecord` so a torn tail is not reported as a schema bug.

---

## 3. Concurrent reader + writer

Two shells, or CLI vs a test, on one file.

**Visibility after a completed write.** POSIX (above): once `write()` has returned, a later `read()` of those bytes sees them.

**A read already in flight.** POSIX does not give the reader a snapshot. `read()` of a growing regular file can return data that was not there when the fd was opened. Node `fsPromises.readFile` “asynchronously reads the entire contents of a file,” default flag `'r'` (“An exception occurs if the file does not exist”). ([Node.js fs, `fsPromises.readFile`](https://nodejs.org/api/fs.html#fspromisesreadfilepath-options); [File system flags](https://nodejs.org/api/fs.html#file-system-flags)) A whole-file read that starts after a writer’s `appendFile` has fulfilled will see that record. A read that overlaps an in-progress write can see a torn last line — the same shape as a crash tail.

**Streaming.** `readline.createInterface` plus `createReadStream` emits lines as `'\n'` arrives. `crlfDelay: Infinity` treats `'\r\n'` as one break. There is no max-line option. ([Node.js readline](https://nodejs.org/api/readline.html)) A stream that is still open while a writer is mid-`write()` can emit nothing for that record until `'\n'` lands, then emit a complete line — or, if the reader hits EOF first, treat the unterminated bytes as the last line.

**SPEC context.** No daemon, no background writer. The realistic overlap is two interactive processes, not a long-lived server. ([SPEC.md](../SPEC.md) Part II “The loop closes by pull, not push”; Part VI)

**Interface implication:** do not invent a “concurrent modification” error. Document that read is not a snapshot, and reuse `IncompleteRecord` if the last bytes are an unterminated non-value. A read that simply misses a line appended after it started is a stale snapshot, not a failure.

---

## 4. Is `O_APPEND` / `fs.appendFile` enough? Do we lock?

**Enough for concurrent complete appends: yes.** POSIX `O_APPEND` (section 1) is the mechanism. `fs.appendFile`’s default `'a'` is that mechanism. Two complete one-write records do not interleave their *offsets*.

**Enough for crash tails or power-loss durability: no.** Section 2.

**File locking: not required for v1, and not a substitute.**

Darwin `flock(2)` is **advisory**: cooperating processes can stay consistent; processes that ignore the lock can still write. Shared vs exclusive, `LOCK_NB` → `EWOULDBLOCK`. Locks are on the file, not the fd; a child that unlocks drops the parent’s lock. ([`flock(2)`](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/flock.2.html), macOS 26.5)

Darwin `open(2)` also has `O_SHLOCK` / `O_EXLOCK` (flock semantics at open time). Node’s `'a'` flag does not set them. ([`open(2)`](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/open.2.html); [Node.js file system flags](https://nodejs.org/api/fs.html#file-system-flags))

Darwin `fcntl(2)` `F_SETLK` / `F_SETLKW` are advisory record locks. Darwin’s own man page calls the “close any fd, drop every lock” POSIX/System V rule “completely stupid” and documents it anyway. ([`fcntl(2)`](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/fcntl.2.html))

Node `fs` documents no `flock` / `fcntl` lock wrapper. `navigator.locks` is in-process only (experimental), not a file lock. ([Node.js globals, `navigator.locks`](https://nodejs.org/api/globals.html))

Locking cannot repair a torn last line. It can only serialize cooperating readers and writers. On a single-user Mac, with append-only records written in one `O_APPEND` write each, that serialization is not load-bearing. Skip it for v1. If a later adapter needs a frozen snapshot while someone else writes, that is when `flock` / `F_SETLK` become interesting — and they remain advisory.

**`O_EXCL` is not a log lock.** `open(O_CREAT|O_EXCL)` fails if the path exists. That is a create-once lockfile, not append exclusion. Node maps it to the `'x'` variants (`'ax'`, …). ([POSIX `open()` example](https://pubs.opengroup.org/onlinepubs/9699919799/functions/open.html); [Node.js file system flags](https://nodejs.org/api/fs.html#file-system-flags))

---

## 5. Empty file vs missing file

| Path state | Node / POSIX fact | Store meaning |
|---|---|---|
| File does not exist | `readFile` / `open(..., 'r')` → `ENOENT`. “No entity (file or directory) could be found by the given path.” ([Node.js errors, Common system errors](https://nodejs.org/api/errors.html#common-system-errors); [flag `'r'`](https://nodejs.org/api/fs.html#file-system-flags)) Darwin `open(2)`: `ENOENT` if `O_CREAT` is not set and the file does not exist, or a required path component is missing. | **Not an error.** First run. Read returns an empty sequence. |
| File exists, length 0 | `readFile` returns `''` (with `encoding: 'utf8'`) or an empty `Buffer` (default `encoding` is `null`). ([Node.js `fsPromises.readFile`](https://nodejs.org/api/fs.html#fspromisesreadfilepath-options)) | Empty sequence. Same as missing, for replay. |
| Parent directory missing | `ENOENT` on append or read (a path component does not exist). | **Error.** The store cannot create a file in a directory that is not there. |
| Path is a directory | Darwin `open(2)` `EISDIR` if opened for writing. Node: `readFile` of a directory is rejected on macOS. Common error `EISDIR`. ([`open(2)`](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/open.2.html); [Node.js `fsPromises.readFile`](https://nodejs.org/api/fs.html#fspromisesreadfilepath-options); [Node.js errors](https://nodejs.org/api/errors.html#common-system-errors)) | **Error.** |

`appendFile` creates the file if it does not exist, so the first successful append materializes the path. The parent directory must already exist.

Missing and empty are the same *history*. They are different *syscalls*. The store interface should collapse them on read so nothing above the store branches on I/O.

---

## 6. Encoding, newline at EOF, max line size

### Encoding

JSON Lines requirement 1: UTF-8. A BOM (`U+FEFF`) “must NOT be included.” Other encodings are “very unlikely to be valid when decoded as UTF-8.” ([JSON Lines](https://jsonlines.org/))

JSON itself is Unicode text; json.org is the value grammar JSON Lines points at. ([json.org](https://www.json.org/json-en.html); [JSON Lines](https://jsonlines.org/))

Node `appendFile` / `readFile` default string encoding is `'utf8'`. ([Node.js fs](https://nodejs.org/api/fs.html))

Node’s `'utf8'` *decode* does not fail on bad bytes. “When decoding a `Buffer` into a string that does not exclusively contain valid UTF-8 data, the Unicode replacement character `U+FFFD` � will be used to represent those errors.” ([Node.js Buffer, character encodings](https://nodejs.org/api/buffer.html#buffers-and-character-encodings))

If the adapter uses that default, a torn multi-byte sequence becomes `�`, then `JSON.parse` throws `SyntaxError`, and the layer above thinks the event vocabulary is wrong. Decode strictly (for example `TextDecoder` with `fatal: true`) so invalid UTF-8 stays an I/O/framing error.

A leading BOM is a JSON Lines violation. Treat it as framing/encoding, not as part of the first event.

### Newline

JSON Lines requirement 3: the line terminator is `'\n'`. `'\r\n'` is also supported “because surrounding white space is implicitly ignored when parsing JSON values.” A terminator after the last value is “strongly recommended but not required.” If a terminator follows the last value, it “must be the last byte in the file.” ([JSON Lines](https://jsonlines.org/))

json.org: whitespace (including `U+000A` and `U+000D`) may appear between tokens. ([json.org](https://www.json.org/json-en.html)) That is why a trailing `\r` before `\n` does not break `JSON.parse` of the value.

**Adapter write rule:** always append `payload + '\n'` (`'\n'` only, not `'\r\n'`). That matches the recommendation and makes concatenation safe.

**Adapter read rule:** split on `'\n'`; tolerate an optional `\r` before it; treat a final empty segment as the recommended trailing newline, not as a blank record.

JSON Lines: `null` is a valid value; a blank line is not. ([JSON Lines](https://jsonlines.org/))

### Max line size

JSON Lines specifies none. Node `readline` specifies none. ([JSON Lines](https://jsonlines.org/); [Node.js readline](https://nodejs.org/api/readline.html))

The bound is memory / the whole-file `readFile`. Retention events are small. Do not put a max-line number on the store interface. A huge unterminated tail is still `IncompleteRecord` (or invalid UTF-8), not a new limit error.

---

## 7. What read returns, and where parse lives

SPEC: the store “holds opaque events in order.” It “knows nothing about cards, intervals, decks, or meaning.” The expensive interface is “the event vocabulary — between the store and everything above it.” The scheduler is a pure fold over that vocabulary. The core “pulls events from the store, folds them through the scheduler.” If I/O accumulates in the core, it belongs in the store; if logic accumulates there, it belongs in the scheduler. ([SPEC.md](../SPEC.md) Part I §§1–3; Part II)

JSON Lines requirement 2: each line is a valid JSON value; any JSON value is permitted. ([JSON Lines](https://jsonlines.org/))

`JSON.parse` is defined by ECMA-262. Invalid JSON is a `SyntaxError`. ([ECMA-262, `JSON.parse`](https://tc39.es/ecma262/#sec-json.parse))

Three different jobs:

| Job | Layer | Input → output |
|---|---|---|
| Bytes, newlines, UTF-8, missing file, torn tail | Store adapter (the only I/O) | File → ordered opaque strings, plus framing errors |
| JSON text → a JSON value | Codec, above the store | String → unknown JSON value, or `SyntaxError` |
| JSON value → a typed event | Event vocabulary, above the codec | Value → `CardCreated` / …, or a schema error |

If `JSON.parse` lives *in* the store:

- The store is no longer opaque; it has taken a dependency on JSON (and, soon, on “what a line is allowed to be”).
- `SyntaxError` and `ENOENT` come out of the same surface, and purity above the store cannot tell I/O from schema.
- Swapping the on-disk format (still append-only) forces a store change *and* confuses the error taxonomy.

If the store returns typed events, the event vocabulary has leaked into the only I/O component, which is the SPEC failure mode.

**Recommendation:** `read` returns opaque strings (complete lines, in order). `append` takes an opaque string and writes `string + '\n'`. The store does not call `JSON.parse`. The codec does, one line at a time. The scheduler never sees a string and never sees a syscall.

`null`, `42`, and `"hi"` are legal JSON Lines values. The codec may accept them as JSON and the vocabulary may reject them as events. That rejection is not I/O.

---

## Recommended error modes

Named outcomes the store surface should be honest about. Codes below are the POSIX / Node facts that map to each name, not the public API spelling.

### `append(payload: string) → void`

| Outcome | When | Source |
|---|---|---|
| Success | Bytes accepted by the kernel (and by `fsync` if `flush` is on). Not a power-loss guarantee. | Node `appendFile` fulfills `undefined`; POSIX `write()` return |
| `PermissionDenied` | Cannot create or write. | Node `EACCES`, `EPERM`; Darwin `open(2)` / `write(2)` |
| `NotFound` | A path component *other than the file itself* is missing (usually the parent directory). Missing *file* is not this: `appendFile` creates it. | Darwin `open(2)` `ENOENT`; Node `ENOENT` |
| `NoSpace` | Volume or quota exhausted. May be a short write then a hard failure. | Darwin `write(2)` `ENOSPC`, `EDQUOT`, `EFBIG` |
| `IsDirectory` | Path names a directory. | Darwin `EISDIR`; Node `EISDIR` |
| `IoError` | Physical I/O and anything else not named. | Darwin / POSIX `EIO`; Node `error.code` / `error.syscall` |

`append` does not report `IncompleteRecord`. If the process dies during the write, the *next* `read` does.

Durability is not a separate error. Default `flush: false` is acceptable for a personal CLI: a process crash after success still leaves the record visible. OS crash / power loss can drop or tear the last append unless someone later calls `F_FULLFSYNC`. Do not silently promise that.

### `read() → { lines: string[], unterminated: string \| null }`

`lines` are the complete, `'\n'`-terminated records, in file order, without the terminator. `unterminated` is any leftover bytes after the last `'\n'` (or the whole file if there is no `'\n'`).

| Outcome | When |
|---|---|
| Success, `lines = []`, `unterminated = null` | Missing file (`ENOENT` on the leaf) **or** empty file. Same history. |
| Success, `lines = [...]`, `unterminated = null` | File ends on `'\n'` (recommended). |
| Success, `lines = [...]`, `unterminated = "<valid JSON>"` | Legal JSON Lines last value without a trailing newline. Codec accepts. |
| Success, `lines = [...]`, `unterminated = "<not a JSON value>"` | Torn tail or trash. Codec maps this to `IncompleteRecord`. Store still succeeded at I/O. |
| `PermissionDenied` | `EACCES` / `EPERM` |
| `IsDirectory` | `EISDIR` (macOS `readFile` of a directory) |
| `InvalidUtf8` | Strict decode failed (do not use default `U+FFFD` replacement). Also a leading BOM. |
| `IoError` | `EIO` and other syscall failures |

A stale concurrent read (missed a line that landed after the read started) is success, not an error.

Do not fail the whole read because the tail is torn. Earlier lines are history. Returning them plus `unterminated` is the honest surface; swallowing the tail or aborting replay is a policy above the store.

### Above the store (not store errors)

| Outcome | Layer | When |
|---|---|---|
| `IncompleteRecord` | Codec | `unterminated` is present and is not a JSON value. |
| `SyntaxError` | Codec (`JSON.parse`) | A *complete* line is not JSON (blank line, junk, truncated-but-terminated). |
| Schema / unknown type | Event vocabulary | JSON value is not an event the fold understands. |

---

## Summary for the implementer (when that ticket is opened)

1. `appendFile` with `'a'`, one write per record, payload plus `'\n'`. No lock.
2. `read`: missing file → empty; do not `access()` first; UTF-8 strict; split on `'\n'`.
3. Return strings. Parse JSON in the codec. Type events above that.
4. Name I/O errors and a torn tail. Do not name JSON or card types on the store.
5. `flush: true` is optional and still not `F_FULLFSYNC`. Leave durability as a documented non-guarantee for v1.

---

## Sources

- [SPEC.md](../SPEC.md) — opacity, append-only surface, store as the only I/O (project constraint, not an OS fact).
- [JSON Lines](https://jsonlines.org/) — UTF-8, no BOM, one JSON value per line, `'\n'` / `'\r\n'`, last terminator recommended not required, blank line illegal, `null` legal.
- [json.org](https://www.json.org/json-en.html) — JSON value grammar and whitespace (referenced by JSON Lines).
- [ECMA-262 `JSON.parse`](https://tc39.es/ecma262/#sec-json.parse) — invalid JSON → `SyntaxError`.
- [Node.js fs](https://nodejs.org/api/fs.html) — `appendFile`, `readFile`, flags `'a'` / `'r'`, `O_APPEND`, `flush` → `fsync`, threadpool warning, no `access`-then-open, directory `readFile` on macOS.
- [Node.js errors, Common system errors](https://nodejs.org/api/errors.html#common-system-errors) — `EACCES`, `ENOENT`, `EISDIR`, `EPERM`, `EMFILE`.
- [Node.js Buffer encodings](https://nodejs.org/api/buffer.html#buffers-and-character-encodings) — `'utf8'` decode replaces invalid bytes with `U+FFFD`.
- [Node.js readline](https://nodejs.org/api/readline.html) — `crlfDelay`, no max line length.
- [Node.js `navigator.locks`](https://nodejs.org/api/globals.html) — in-process only.
- [POSIX.1-2024 `write()`](https://pubs.opengroup.org/onlinepubs/9799919799/functions/write.html) — `O_APPEND` seek+write atomicity, short writes, `EINTR`, post-write `read()` visibility, `{PIPE_BUF}` for pipes/FIFOs only.
- [POSIX.1-2017 `open()`](https://pubs.opengroup.org/onlinepubs/9699919799/functions/open.html) — `O_CREAT` / `O_EXCL` as a create-once lockfile pattern.
- Darwin man pages, macOS 26.5: `open(2)` (`O_APPEND`, `O_SHLOCK` / `O_EXLOCK`, `ENOENT`, `EISDIR`), `write(2)` (`ENOSPC`, `EDQUOT`, `EIO`, `EINTR`), `fsync(2)` (not power-safe), `fcntl(2)` (`F_FULLFSYNC`, advisory `F_SETLK`), `flock(2)` (advisory).
- [Apple File System Reference](https://developer.apple.com/support/downloads/Apple-File-System-Reference.pdf) — checkpoints; invalid checkpoint rolled back.
- [APFS FAQ](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/APFS_Guide/FAQ/FAQ.html) — copy-on-write crash protection of filesystem updates.
