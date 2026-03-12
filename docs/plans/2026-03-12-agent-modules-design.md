# World Slice Agent Modules Merge Design (2026-03-12)

## Scope & Goals
Merge the nuwa and pangu agent modules into `master` by merging their branches while preserving history. Resolve conflicts file-by-file with user confirmation.

Branches/worktrees:
- nuwa: `feature/nuwa-agent` (from .worktrees/nuwa-agent)
- pangu: `pangu` (from .worktrees/pangu)

## Approach Options Considered
1) **Merge branches (recommended)**: preserves history and full module context; conflicts resolved interactively.
2) **Cherry-pick commits**: requires identifying specific commits; more manual.
3) **Copy working tree files**: fastest but loses history and increases risk.

## Chosen Approach
Merge `feature/nuwa-agent` into `master`, then merge `pangu` into `master`. Handle conflicts one file at a time with user confirmation.

## Merge Flow
1) Ensure `master` is up to date.
2) Merge `feature/nuwa-agent` into `master`.
3) If conflicts arise, show per-file diffs and confirm resolution choices.
4) Complete merge commit once all conflicts are resolved.
5) Merge `pangu` into `master` and repeat conflict resolution.

## Conflict Resolution
- Resolve interactively per file (nuwa vs pangu vs manual merge).
- Final decisions confirmed by user before committing.

## Verification
- Ensure working tree is clean (`git status`).
- Run existing startup/build/test commands **only if requested** by the user.

## Completion Criteria
- Both branches merged into `master` with all conflicts resolved.
- `git status` clean.
