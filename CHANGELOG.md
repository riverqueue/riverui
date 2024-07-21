# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
