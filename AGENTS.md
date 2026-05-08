# River UI Agent Guidelines

## Commands
- Dev: `npm run dev` (pro: `npm run dev:pro`)
- Lint/format: `npm run lint`, `npm run fmt`
- Tests: `npm run test`, `npm run test:once`, `npm exec -- vitest --run path/to/file.test.tsx`
- Build: `npm run build`, `make build`
- Go lint/test: `make lint`, `make test`

## Rules
- No `any`; use `unknown` or specific types.
- Avoid `as unknown as X` casts; prefer fixing the underlying type
  (narrow props, export a type, add missing fields). If a cast is
  truly necessary (e.g. testing malformed data, third-party type
  workarounds), add a comment explaining why.
- Prefer precise types over broad ones (`unknown[]`, `Record<string, unknown>`)
  followed by casts at each access site. Type the data correctly at the source.
- Tests live beside components (`.test.tsx`).
- Prefix unused variables with `_`.

## Validate
- UI/router/search-state: targeted tests + `npm run lint`.
- Larger changes: `npm run test:once` + `npm run build`.
- Go changes: `make lint`.
- User-facing changes (features, bug fixes, behavior changes): add an
  `Unreleased` changelog entry in `CHANGELOG.md` under the correct section.
- Changelog entries for user-facing changes should include a PR reference
  link using project convention: `[PR #XXX](https://github.com/riverqueue/riverui/pull/XXX)`.

## Commits
- Title <= 50 chars (max 72); wrap body ~72.
- Explain problem, fix, why it works, and tests.
- Use auto-close keywords; don’t mention "ran lint/tests".
