# Blueberry v1.1.0 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the smallest macOS Blueberry MVP that reacts to seven supported Codex lifecycle events through the existing privacy-safe Hook path and existing animations.

**Architecture:** Preserve the implemented short-lived Python adapter, loopback Electron event server, semantic event router, and renderer state dispatcher. Rename the active product identity as one tested migration, then rebuild and install the unchanged seven-event Hook configuration into the real Codex user layer without overwriting unrelated handlers.

**Tech Stack:** Electron 35, Node.js built-in test runner, Python 3.10 `unittest`, Codex command Hooks, loopback HTTP, electron-builder, macOS arm64

---

## File Structure and Responsibilities

- `tests/js/product-naming.test.js`: regression audit for Blueberry package, runtime interface, and active product copy.
- `package.json`, `package-lock.json`: npm identity, macOS bundle identity, product name, and build scripts.
- `hooks/codex_hook.py`: privacy allowlist and `BLUEBERRY_PORT` development override.
- `hooks/codex-hooks.example.json`: seven-event user Hook example.
- `src/main/event-server.js`: loopback server and Blueberry diagnostics.
- `main.js`, `preload.js`, `src/renderer/*`: active source comments and renderer identity wording.
- `README.md`, `需求文档.md`, `docs/iterations/*`: current user and product documentation.
- `docs/superpowers/specs/*`, `docs/superpowers/plans/*`: current v1.1.0 design and execution records.
- `../notes/blueberry-*.md`: consolidated external product, iteration, and interview notes.
- `~/.codex/hooks.json`: real user Hook registration; unrelated definitions must be preserved.

Historical artifact names in `docs/iterations/evidence/v1.1.0-acceptance.md`, Git history, the GitHub slug, and existing repository/worktree paths remain truthful legacy exceptions.

### Task 1: Add the Blueberry Naming Regression Test

**Files:**
- Create: `tests/js/product-naming.test.js`

- [ ] **Step 1: Write the failing metadata and runtime naming tests**

```javascript
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('package identity is Blueberry', () => {
  const packageJson = JSON.parse(read('package.json'));
  const lockJson = JSON.parse(read('package-lock.json'));

  assert.equal(packageJson.name, 'blueberry-pet');
  assert.equal(packageJson.build.appId, 'com.blueberry.pet');
  assert.equal(packageJson.build.productName, 'Blueberry');
  assert.equal(lockJson.name, 'blueberry-pet');
  assert.equal(lockJson.packages[''].name, 'blueberry-pet');
});

test('active runtime interfaces use the Blueberry identity', () => {
  const runtimeFiles = [
    'hooks/codex_hook.py',
    'hooks/codex-hooks.example.json',
    'main.js',
    'preload.js',
    'src/main/event-server.js',
    'src/renderer/index.html',
    'src/renderer/renderer.js',
    'src/renderer/style.css',
    'tests/python/test_codex_hook_integration.py',
  ];

  for (const relativePath of runtimeFiles) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /WorkBuddy|WORKBUDDY|\[workbuddy\]/);
  }

  assert.match(read('hooks/codex_hook.py'), /BLUEBERRY_PORT/);
  assert.match(read('hooks/codex-hooks.example.json'), /Blueberry ambient Codex activity integration/);
  assert.match(read('src/main/event-server.js'), /\[blueberry\]/);
});

test('current user-facing documents call the product Blueberry', () => {
  const currentDocuments = [
    'README.md',
    '需求文档.md',
    'docs/iterations/README.md',
    'docs/iterations/v1.1.0-codex-hooks.md',
    'docs/iterations/v1.2.0-roadmap.md',
  ];

  for (const relativePath of currentDocuments) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /WorkBuddy/);
    assert.match(source, /Blueberry/);
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
/Users/molan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  --test tests/js/product-naming.test.js
```

Expected: FAIL because `package.json` still contains `workbuddy-pet`, `com.workbuddy.pet`, and `WorkBuddy Pet`.

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/js/product-naming.test.js
git commit -m "test: define Blueberry naming contract"
```

### Task 2: Rename Package and Runtime Interfaces

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Modify: `hooks/codex_hook.py`
- Modify: `hooks/codex-hooks.example.json`
- Modify: `tests/python/test_codex_hook_integration.py`
- Modify: `src/main/event-server.js`
- Modify: `main.js`
- Modify: `preload.js`
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/renderer.js`
- Modify: `src/renderer/style.css`

- [ ] **Step 1: Apply the minimal identity replacements**

Use these exact target values:

```text
package name:       blueberry-pet
application ID:     com.blueberry.pet
product name:       Blueberry
port override:      BLUEBERRY_PORT
diagnostic prefix:  [blueberry]
event wording:      Blueberry event
```

Keep `/absolute/path/to/workbuddy-pet` in the example Hook command because it documents the unchanged repository slug. Add `.blueberry/` to `.gitignore` and retain `.workbuddy/` as a legacy compatibility ignore.

- [ ] **Step 2: Run the focused naming and Python suites**

Run:

```bash
/Users/molan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  --test tests/js/product-naming.test.js
python3 -m unittest discover -s tests/python -p "test_*.py" -v
```

Expected: the naming file reports 3 passing tests and Python reports 10 passing test methods.

- [ ] **Step 3: Commit the runtime rename**

```bash
git add package.json package-lock.json .gitignore hooks tests/python \
  main.js preload.js src
git commit -m "refactor: rename runtime identity to Blueberry"
```

### Task 3: Rename Current Documentation Without Rewriting History

**Files:**
- Modify: `README.md`
- Modify: `需求文档.md`
- Modify: `docs/iterations/README.md`
- Modify: `docs/iterations/v1.1.0-codex-hooks.md`
- Move: `docs/superpowers/specs/2026-07-31-workbuddy-v1.1.0-codex-hooks-design.md` → `docs/superpowers/specs/2026-07-31-blueberry-v1.1.0-codex-hooks-design.md`
- Move: `docs/superpowers/plans/2026-07-31-workbuddy-v1.1.0-codex-hooks.md` → `docs/superpowers/plans/2026-07-31-blueberry-v1.1.0-codex-hooks.md`
- Modify: links pointing to the moved documents
- Preserve: `docs/iterations/evidence/v1.1.0-acceptance.md`
- Preserve: `docs/superpowers/specs/2026-07-31-blueberry-product-rename-design.md`

- [ ] **Step 1: Replace the active product identity and move current design records**

Use `Blueberry` for the product and `Blueberry event` for the canonical protocol. Keep literal GitHub URLs, clone directory commands, existing local paths, and historical artifact evidence unchanged.

Update the iteration index to:

```markdown
# Blueberry Iterations

| v1.1.0 | Complete the minimum safe Codex-to-Blueberry reaction loop | Final acceptance in progress |
| v1.2.0 | Differentiate tool activity, compaction, failures, and permission reminders | Planned |
| v1.3.0 | Visualize multi-agent work with small Blueberry helpers | Planned |
| v1.4.0+ | Add macOS awareness and wellbeing companion behavior | Planned |
```

- [ ] **Step 2: Verify current documentation and immutable exceptions**

Run:

```bash
/Users/molan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  --test tests/js/product-naming.test.js
rg -n "WorkBuddy|WORKBUDDY|\\[workbuddy\\]" \
  README.md 需求文档.md docs/iterations/README.md \
  docs/iterations/v1.1.0-codex-hooks.md hooks main.js preload.js src tests
```

Expected: 3 naming tests pass and `rg` prints no matches. Legacy names may remain only in the rename comparison spec, historical acceptance evidence, Git history, repository URLs/paths, and the pre-rename implementation record where retaining a statement is necessary for historical truth.

- [ ] **Step 3: Commit the documentation rename**

```bash
git add README.md 需求文档.md docs
git commit -m "docs: present the product as Blueberry"
```

### Task 4: Consolidate the External Blueberry Notes

**Files:**
- Move: `../notes/workbuddy-interview-notes.md` → `../notes/blueberry-interview-notes.md`
- Move: `../notes/workbuddy-iteration-record.md` → `../notes/blueberry-iteration-record.md`
- Move: `../notes/workbuddy-scheme-2-advantages.md` → `../notes/blueberry-scheme-2-advantages.md`

- [ ] **Step 1: Rename the three note files and current product wording**

Replace product-name uses of `WorkBuddy` with `Blueberry`. Preserve literal repository URLs and historical filesystem paths where changing them would make instructions false.

Add the v1.2.0 product insight to `blueberry-interview-notes.md`:

```markdown
### 从 Hook 事件到用户可理解的产品状态

我将“事件是否发生”“用户是否仍需介入”和“桌宠如何表达”拆成三层。`PermissionRequest` 能证明 Codex 发起过授权请求，却没有独立的 `PermissionResolved` 事件；因此重复提醒不是简单重复动画，而是需要超时、状态清除、提醒上限和误判降级策略。这体现了我没有把技术事件直接等同于用户状态。
```

- [ ] **Step 2: Verify the consolidated location**

Run:

```bash
find /Users/molan/Documents/Codex/2026-07-30/zhe-ge/outputs/workbuddy/notes \
  -maxdepth 1 -type f -print | sort
rg -n "WorkBuddy" \
  /Users/molan/Documents/Codex/2026-07-30/zhe-ge/outputs/workbuddy/notes
```

Expected: the three filenames begin with `blueberry-`; remaining `WorkBuddy` matches are limited to explicit before/after history or immutable path explanations.

The notes are intentionally outside the Git repository, so do not include them in a repository commit.

### Task 5: Run Regression, Privacy, and arm64 Packaging Verification

**Files:**
- Modify: `docs/iterations/evidence/v1.1.0-acceptance.md`

- [ ] **Step 1: Run all automated tests**

Run:

```bash
/Users/molan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  --test tests/js/*.test.js
python3 -m unittest discover -s tests/python -p "test_*.py" -v
```

Expected: all Node assertions and all Python test methods pass, including 3 product naming tests.

- [ ] **Step 2: Recheck privacy and neutral failure**

Run:

```bash
python3 -m unittest \
  tests.python.test_codex_hook.NormalizeEventTests.test_canonical_event_excludes_private_hook_fields \
  tests.python.test_codex_hook_integration.HookCliIntegrationTests.test_closed_pet_never_blocks_or_surfaces_an_error \
  -v
```

Expected: 2 tests pass; the closed-pet test completes 20 attempts below the 500 ms ceiling.

- [ ] **Step 3: Build the standard Apple Silicon artifact**

Run:

```bash
export BLUEBERRY_NODE_BIN=/Users/molan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin
export PATH="$BLUEBERRY_NODE_BIN:$PATH"
./node_modules/.bin/electron-builder --mac --arm64
```

Expected:

```text
dist/mac-arm64/Blueberry.app
dist/Blueberry-1.1.0-arm64.dmg
dist/Blueberry-1.1.0-arm64.dmg.blockmap
```

- [ ] **Step 4: Verify bundle version, architecture, DMG format, and checksum**

Run:

```bash
defaults read "$PWD/dist/mac-arm64/Blueberry.app/Contents/Info" CFBundleIdentifier
defaults read "$PWD/dist/mac-arm64/Blueberry.app/Contents/Info" CFBundleShortVersionString
file "$PWD/dist/mac-arm64/Blueberry.app/Contents/MacOS/Blueberry"
hdiutil imageinfo "$PWD/dist/Blueberry-1.1.0-arm64.dmg" | rg "Format|Partition"
shasum -a 256 "$PWD/dist/Blueberry-1.1.0-arm64.dmg"
```

Expected: bundle ID `com.blueberry.pet`, version `1.1.0`, Mach-O arm64 executable, compressed read-only DMG, and a recorded SHA-256.

- [ ] **Step 5: Update evidence with renamed-build facts and commit**

Record exact test counts, artifact size, architecture, checksum, and any external packaging interruption. Keep the earlier WorkBuddy artifact section as historical evidence and add a new Blueberry verification section rather than rewriting the old facts.

```bash
git add docs/iterations/evidence/v1.1.0-acceptance.md
git commit -m "docs: record Blueberry package verification"
```

### Task 6: Install and Accept the Real Codex Hook

**Files:**
- Read/merge: `~/.codex/hooks.json`
- Reference: `hooks/codex-hooks.example.json`
- Modify: `docs/iterations/evidence/v1.1.0-acceptance.md`
- Modify: `../notes/blueberry-interview-notes.md`

- [ ] **Step 1: Resolve the stable Hook script path**

Do not install a command pointing into `.worktrees`. First integrate the feature branch into the stable repository working tree or otherwise copy the released Hook adapter into a stable Blueberry-owned application/support location. Confirm the selected absolute script exists before editing Codex configuration.

- [ ] **Step 2: Inspect and merge the user Hook configuration**

Read `~/.codex/hooks.json` first. If absent, create it from the seven-event example using the stable absolute script path. If present, preserve every unrelated event group and handler, adding only the Blueberry handler to each supported event.

Validate with:

```bash
python3 -m json.tool /Users/molan/.codex/hooks.json >/dev/null
```

Expected: exit `0`; no unrelated handler is removed.

- [ ] **Step 3: Review and trust the current definition**

Restart or refresh Codex, open `/hooks`, inspect the source and exact commands, and trust the Blueberry definitions. A changed Hook hash must be reviewed again.

- [ ] **Step 4: Start Blueberry and run a fresh Codex acceptance task**

Verify observable reactions for:

```text
SessionStart       → idle
UserPromptSubmit   → thinking
PreToolUse         → working
PostToolUse        → working
PermissionRequest  → attention, when an action genuinely needs approval
Stop               → happy
SessionEnd         → sleeping, subject to documented session-end timing
```

Also close Blueberry and run a Codex turn to verify that Codex remains unaffected.

- [ ] **Step 5: Close the release evidence**

Record which real events were observed, which event depended on approval/session timing, the trusted Hook source, and the stable script path. Mark v1.1.0 complete only when real Codex events—not fixture HTTP posts—have reached the packaged Blueberry application.

```bash
git add docs/iterations/evidence/v1.1.0-acceptance.md
git commit -m "docs: accept Blueberry v1.1.0 MVP"
```

Add the same distinction between simulated verification and real-user acceptance to `../notes/blueberry-interview-notes.md`.

## Final Definition of Done

- Product identity is Blueberry across current application surfaces.
- Seven Codex events map to existing animations.
- Private Hook payload fields remain excluded.
- Blueberry failure never blocks Codex.
- Automated suites pass.
- The arm64 application and standard DMG build successfully.
- The real Hook definition is installed from a stable path and trusted.
- A fresh Codex task produces visible Blueberry reactions.
- Exact evidence and known timing limitations are recorded.
