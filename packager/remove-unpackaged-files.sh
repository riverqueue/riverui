#!/bin/sh
#
# Removes every file that must not end up in a River UI module zip from a
# River UI checkout, run from the checkout's root. It covers both the riverui
# and riverproui modules:
#
# * _test.go files
# * repository tooling: CI configuration, editor and agent metadata, lint,
#   formatting, and environment configuration, Docker files, development
#   scripts, and Git ignore files
# * agent instruction files, Makefile, docs, and the packager itself
# * frontend sources, dependencies, and build configuration (the built bundle
#   in dist and the static files in public stay, because Go embeds them)
# * sqlc configuration and query sources, which only generate code
#
# `.git` stays because the release workflow reads tags after packaging, and
# module zips never include it.
#
# The release workflow runs it before packaging each module, and
# `make check/modzip` runs it on a copy of the working tree. The packager's
# check rejects anything this script misses.

set -eu

find . -path './.git' -prune -o -path './node_modules' -prune -o \
	-type f -name '*_test.go' -exec rm -f {} +
find . -path './.git' -prune -o -path './node_modules' -prune -o \
	-path '*/internal/dbsqlc/*' \( -name '*.sql' -o -name 'sqlc.yaml' \) \
	-type f -exec rm -f {} +
rm -f \
	.dockerignore \
	.env.local \
	.envrc.sample \
	.gitignore \
	.golangci.yaml \
	.npmrc \
	.prettierignore \
	.prettierrc \
	.reflex.pro.server \
	.reflex.server \
	.stylelintignore \
	AGENTS.md \
	CLAUDE.md \
	Dockerfile \
	Dockerfile.pro \
	Makefile \
	docker-compose.dev.yaml \
	eslint.config.mjs \
	package-lock.json \
	package.json \
	tsconfig.json \
	tsconfig.node.json \
	tsr.config.json \
	vite.config.ts \
	vitest.config.ts
rm -rf \
	.agents \
	.claude \
	.codex \
	.cursor \
	.github \
	.storybook \
	.vscode \
	docs \
	node_modules \
	packager \
	scripts \
	src
