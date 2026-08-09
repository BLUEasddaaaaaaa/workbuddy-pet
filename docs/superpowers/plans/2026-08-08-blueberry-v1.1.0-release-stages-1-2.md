# Blueberry v1.1.0 Release Stages 1–2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan with independent review. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze one reproducible v1.1.0 release-candidate commit and produce a clean Apple Silicon macOS build without installing or publishing it.

**Architecture:** Stage 1 treats Git commit identity and fresh tests as the source-of-truth gate. Stage 2 moves any existing `dist` to a recoverable external backup, builds from the frozen commit, and records toolchain and artifact metadata without changing source after the freeze.

**Tech Stack:** Git, Node.js, Electron 35.7.5, electron-builder 26.15.3, macOS arm64, SHA-256 evidence.

---

## Stage 1: Freeze the release candidate

- [ ] Confirm branch, clean tracked status, exact HEAD, package version `1.1.0`, product name `Blueberry`, app ID `com.blueberry.pet`, and arm64 build script.
- [ ] Confirm `.superpowers/` is the only untracked path and exclude it from every operation.
- [ ] Run the complete JavaScript and Python suites from the frozen HEAD.
- [ ] Run JavaScript and Python syntax checks and `git diff --check`.
- [ ] Record the candidate SHA, environment versions, commands, counts, and open release gates in an evidence file outside the repository so recording evidence cannot change the frozen SHA.
- [ ] Do not add features, edit source, amend commits, merge, tag, install, or publish after the freeze.

## Stage 2: Produce a clean macOS arm64 build

- [ ] Resolve the existing `dist` path and size. Move it to a unique recoverable backup under `/Users/molan/Documents/Codex/2026-07-30/zhe-ge/outputs/workbuddy/build-backups/`; do not delete it.
- [ ] Confirm the worktree `dist` path no longer exists and tracked Git status still matches Stage 1.
- [ ] Run the repository `build:mac` script from the frozen worktree without changing package metadata.
- [ ] Capture the exact command, exit code, build duration, Node/npm/Electron/electron-builder versions, host architecture, and signing/notarization messages.
- [ ] Confirm expected `.app` and DMG paths exist, record sizes and SHA-256 hashes, and inspect application version, bundle identifier, executable architecture, and code-signing status.
- [ ] Confirm no source or tracked file changed and `.superpowers/` remains untouched.
- [ ] Record Stage 2 evidence outside the repository. Do not install, mount, launch the packaged app, modify real Codex configuration, push, tag, merge, or publish.

## Mandatory stop conditions

- Stop if the test suite fails, tracked files are dirty, candidate identity changes, build consumes an unexpected source path, or old artifacts cannot be isolated safely.
- Stop if the build command modifies source, requests credentials, requires installation, or produces an artifact whose version, product name, bundle ID, or architecture contradicts the frozen metadata.
- An unsigned or unnotarized artifact may be recorded as a local test candidate, but must not be described as publicly distributable.
