# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added a queue detail page with the ability to view queue stats. For River Pro customers, this page offers the ability to dynamically override concurrency limits and to view individual clients for each queue, along with how many jobs each is working. [PR #326](https://github.com/riverqueue/riverui/pull/326).

## [v0.8.1] - 2025-02-27

### Changed

- Updated JS dependencies.

### Fixed

- Fix negative wait times in job timeline. [PR #288](https://github.com/riverqueue/riverui/pull/288).
- Fix occasionally incorrect job durations for errored jobs. [PR #288](https://github.com/riverqueue/riverui/pull/288).
- Improve display of job attempt errors. [PR #291](https://github.com/riverqueue/riverui/pull/291).

## [v0.8.0] - 2025-02-10

### Added

- Allow `PG*` env vars as an alternative to `DATABASE_URL`. [PR #256](https://github.com/riverqueue/riverui/pull/256).

### Fixed

- Queue list columns no longer resize when pausing/resuming a queue. [PR #286](https://github.com/riverqueue/riverui/pull/286).

## [0.7.0] - 2024-12-16

### Added

- Add support for basic auth to the riverui executable. Thanks [Taras Turchenko](https://github.com/TArch64)! [PR #241](https://github.com/riverqueue/riverui/pull/241).

### Changed

- Updated internal dependency of `riverqueue/river` to compensate for a change to `baseservice.Archetype` and a utility function. [PR #253](https://github.com/riverqueue/riverui/pull/253).

## [0.6.0] - 2024-11-26

### Added

- Add `RIVER_LOG_LEVEL` env for env-based configuration of River UI's log level. Thank you [Taras Turchenko](https://github.com/TArch64)! 🙏🏻 [PR #183](https://github.com/riverqueue/riverui/pull/183).

### Changed

- Allow `RIVER_HOST` variable to specify specific host variable to bind to. [PR #157](https://github.com/riverqueue/riverui/pull/157).

## [0.5.3] - 2024-09-05

### Fixed

- Remove `.gitignore` from Go module bundle because it messes with vendoring in some situations. Thanks [Pedro Henrique](https://github.com/crossworth)! 🙏🏻 [PR #149](https://github.com/riverqueue/riverui/pull/149).

## [0.5.2] - 2024-09-02

### Fixed

- Fix `ListenAndServe()` inverted error check. Thanks [Martin Tournoij](https://github.com/arp242)! 🙏🏻 [PR #137](https://github.com/riverqueue.com/riverui/pull/137).
- Fix refresh and theme selector dropdown positioning. [PR #146](https://github.com/riverqueue/riverui/pull/146).

## [0.5.1] - 2024-09-01

### Fixed

- Downgrade `@headlessui/react` version to v2.1.1 to fix issues with listbox menus (refresh settings and theme selector). [PR #139](https://github.com/riverqueue/riverui/pull/139).

## [0.5.0] - 2024-08-28

### Changed

- The module name was changed from `github.com/riverqueue/riverui` to `riverqueue.com/riverui`. This change was made to facilitate bundling of module releases that include vendored frontend assets, which will enable the embedded `Handler` type to be usable by anybody who `go get` installs the module without requiring a complex build setup.
- Rename `HandlerOpts` to `ServerOpts` for consistency. The `Handler` type was renamed to `Server` in [PR #108](https://github.com/riverqueue/riverui/pull/108) but the opts type was not renamed until now. [PR #133](https://github.com/riverqueue/riverui/pull/133).
- Implement `http.Handler` on `Server` type via a `ServeHTTP` method so that it can be used directly without needing to call `.Handler()` on it. [PR #133](https://github.com/riverqueue/riverui/pull/133).
- Directly specify `DB` interface type and rename it. Avoids relying on embedding a type from an internal package. [PR #133](https://github.com/riverqueue/riverui/pull/133).

### Removed

- Removed the vendored Inter font to reduce bundle size with no noticeable impact on the UI.

## [0.4.0] - 2024-08-26

### Added

- Job counts are cached for very large job tables to make request timeouts less likely. [PR #108](https://github.com/riverqueue/riverui/pull/108).
- River UI has been restructured to properly support a dynamic path prefix on built static assets. The `-prefix` CLI option or the `PATH_PREFIX` Docker container env can both be used to set a URL prefix on both the API routes and the frontend HTML routes. [PR #115](https://github.com/riverqueue/riverui/pull/115).

## [0.3.1] - 2024-08-02

### Fixed

- Job detail: handle snoozed jobs without erroring. [PR #104](https://github.com/riverqueue/riverui/pull/104).

## [0.3.0] - 2024-07-24

### Added

- Added support for workflows. [PR #99](https://github.com/riverqueue/riverui/pull/99).
- The UI now serves a `/robots.txt` that instructs crawlers to not crawl any part an installation. (You should still use an authentication layer though.) [PR #97](https://github.com/riverqueue/riverui/pull/97).

## [0.2.0] - 2024-07-02

### Added

- Add health check endpoints. [PR #61](https://github.com/riverqueue/riverui/pull/61).
  - `GET /api/health-checks/complete` (Returns okay if the Go process is running and the database is healthy.)
  - `GET /api/health-checks/minimal` (Returns okay as long as Go process is running.)
- Interpret some types of Postgres errors to be user facing to produce better error messages in the UI. [PR #76](https://github.com/riverqueue/riverui/pull/76).

## [0.1.1] - 2024-06-23

### Fixed

- Fix prebuilt binaries to correctly set required envs before JS build step. [PR #61](https://github.com/riverqueue/riverui/pull/61).

## [0.1.0] - 2024-06-22

### Added

- Make job list items selectable so they can be cancelled, retried, or deleted as a batch. [PR #57](https://github.com/riverqueue/riverui/pull/57).

### Fixed

- Fix job list pagination flashing using TanStack Query's `placeholderData` feature. [PR #56](https://github.com/riverqueue/riverui/pull/56).

## [0.0.1] - 2024-06-20

### Added

- This is the initial release of River UI.
