# Lifecycle

How work lands. Product invariants stay in [INVARIANTS.md](./INVARIANTS.md). This file is the git and agent process.

## Top-level branch

**`main`.** Every finished task merges here. Results live on `main`, not on a leftover task branch. `v0/observability` and other feature branches are not the land-on branch.

## One worktree per disjoint task

Independent / disjoint work (non-overlapping write-sets) gets its own branch **and** its own git worktree. Two agents do not share a working tree.

Overlapping files = not disjoint = one worktree, one agent (or sequential). Shared seams such as `src/cli/handle.ts`, `src/cli/main.ts`, `src/session/runtime.ts` are not parallel-safe.

## Parallel agents

Parallel only when write-sets are disjoint. Same-turn tool calls for independent reads are fine on one agent. Two writers need two worktrees.

## Done

When the issue (or `/goal` slice) is done:

1. `bun run typecheck` and `bun test` pass on that worktree (same pair husky will run).
2. Merge into `main`.
3. Close the issue.
4. Remove the worktree (`git worktree remove`, then `git worktree prune` if needed).

Do not leave the result only on the task branch. Do not leave the worktree after merge.

## Hooks

Husky pre-commit on commits that land toward `main`: `bun run typecheck` then `bun test`. No CI. No compile / PTY on the hook. Details: [INVARIANTS.md](./INVARIANTS.md) Lifecycle.

## This file vs GAPS

[GAPS.md](./GAPS.md) still describes one past Session TUI `/goal` that forbade extra worktrees. That paste was for that goal. Standing process is this file.
