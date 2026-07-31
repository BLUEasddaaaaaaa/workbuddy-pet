# Blueberry Product Rename Design

- **Date:** 2026-07-31
- **Target:** macOS v1.1.0
- **Status:** Awaiting product-owner review
- **Decision:** Apply rename scheme A before installing the real Codex Hooks

## 1. Objective

Rename the product identity from **WorkBuddy Pet** to **Blueberry** across the active application, protocol, documentation, tests, packaging, and interview material.

This change is an identity migration, not a change to the v1.1.0 Hook architecture. The existing privacy boundary, event flow, state mapping, and failure behavior remain intact.

## 2. Rename Matrix

| Area | Current | Target |
|---|---|---|
| Product display name | WorkBuddy Pet | Blueberry |
| npm package name | `workbuddy-pet` | `blueberry-pet` |
| macOS application ID | `com.workbuddy.pet` | `com.blueberry.pet` |
| Packaged application | `WorkBuddy Pet.app` | `Blueberry.app` |
| DMG artifact | `WorkBuddy Pet-1.1.0-arm64.dmg` | `Blueberry-1.1.0-arm64.dmg` |
| Internal event wording | WorkBuddy event | Blueberry event |
| Runtime log prefix | `[workbuddy]` | `[blueberry]` |
| Hook test port override | `WORKBUDDY_PORT` | `BLUEBERRY_PORT` |
| Active documentation titles and links | WorkBuddy | Blueberry |
| Interview-note filename and content | WorkBuddy | Blueberry |
| New ignored app-data directory | `.workbuddy/` | `.blueberry/` |

The rename covers source comments, user-visible copy, current tests, active v1.1.0 iteration documents, Hook examples, and package metadata.

## 3. Deliberate Exceptions

The following identifiers do not change in this migration:

- GitHub repository URL: `BLUEasddaaaaaaa/workbuddy-pet`
- Existing local repository and worktree directory paths
- Historical Git commits and commit messages
- Existing `.workbuddy/` ignore rule, retained alongside `.blueberry/` so legacy generated data cannot be committed accidentally
- Literal legacy names inside historical evidence when changing them would falsify what an earlier build actually produced

Repository slugs and historical evidence are identifiers of existing infrastructure or facts, not the current product name. A later repository migration can rename them separately after the v1.1.0 release is stable.

## 4. Behavior Sources

Blueberry behavior is not limited to Codex Hooks. Each behavior must have an explicit source.

| Behavior | Source | v1.1.0 status |
|---|---|---|
| Session starts or resumes | Codex `SessionStart` | Implemented |
| User submits a prompt | Codex `UserPromptSubmit` | Implemented |
| Tool begins | Codex `PreToolUse` | Implemented |
| Tool finishes | Codex `PostToolUse` | Implemented |
| Codex asks for approval | Codex `PermissionRequest` | Implemented |
| Turn finishes | Codex `Stop` | Implemented |
| Session ends | Codex `SessionEnd` | Implemented, subject to Codex session-end timing |
| Codex compacts context | Codex `PreCompact` / `PostCompact` | Available for a later iteration |
| Subagent starts or stops | Codex `SubagentStart` / `SubagentStop` | Available for a later iteration |
| Breathing, blinking, random idle motion | Blueberry's local animation scheduler | Existing or future pet logic |
| Sleeping because the user is inactive | macOS/user-activity observation | Future behavior; not a Codex Hook |
| Wearing headphones while music plays | macOS Now Playing or music-app integration | Future behavior; not a Codex Hook |
| Water and break reminders | Blueberry timer and user preferences | Future behavior; not a Codex Hook |
| Personality dialogue | Optional dialogue/LLM module | Future behavior; not a Codex Hook |

Therefore, Codex Hooks can drive every behavior that represents a supported Codex lifecycle event, but they cannot directly report arbitrary computer activity. Blueberry must combine Hook-driven reactions with its own local behavior engine and, where needed, separate macOS adapters.

## 5. v1.1.0 Event Mapping

The initial release continues to reuse existing animations:

| Canonical Blueberry event | Pet state | Meaning |
|---|---|---|
| `session.started` | `idle` | Codex session is ready |
| `turn.prompt_submitted` | `thinking` | Codex received the user's request |
| `tool.started` | `working` | Codex started a supported tool |
| `tool.finished` | `working` | Tool activity continues |
| `permission.requested` | `attention` | User action is required |
| `turn.finished` | `happy` | Codex completed the turn |
| `session.ended` | `sleeping` | Codex session ended |

This mapping proves the complete Hook-to-animation path first. New event-specific art and richer transition rules belong in later iterations.

## 6. Data Flow and Privacy

The data flow remains:

`Codex lifecycle event → short-lived Python adapter → allowlisted Blueberry event → loopback HTTP server → state mapper → Electron renderer → animation`

The Python adapter necessarily receives the raw Hook payload from Codex, but it must construct a new allowlisted object. Blueberry must not send, persist, or log prompts, commands, source code, file paths, transcripts, tool input/output, final answers, environment variables, or credentials.

Only event identity and the minimum identifiers required for ordering and deduplication may enter the Blueberry protocol. If Blueberry is closed, unavailable, or rejects an event, Codex continues normally.

## 7. Test Strategy

Implementation begins with a failing naming-audit test. The test will verify:

- package name, product name, and app ID use Blueberry;
- `BLUEBERRY_PORT` replaces the active `WORKBUDDY_PORT` interface;
- runtime logs and active protocol terminology use Blueberry;
- current README, Hook examples, source comments, tests, iteration documents, and interview notes use Blueberry;
- immutable repository paths and truthful historical evidence are the only allowlisted legacy-name exceptions.

After the rename:

1. Run the naming audit.
2. Run all existing Node and Python tests to prove behavior did not change.
3. Run the Hook latency and privacy checks.
4. Build the arm64 macOS application and DMG.
5. Confirm the artifact names, application bundle identity, and packaged launch.
6. Install the Hook definition into the real Codex configuration without overwriting unrelated handlers.
7. Start a fresh Codex task and manually verify each supported lifecycle reaction.

## 8. Acceptance Boundary

The rename is complete when all active product surfaces identify the pet as Blueberry and all automated checks pass.

The broader v1.1.0 release is complete only after the renamed build is installed and the real Codex-to-Blueberry path is observed in a fresh Codex task. Passing fixture tests alone does not prove real Hook installation or trust.

## 9. Risks and Rollback

- Changing the application ID gives macOS a new application identity and may create a new Electron user-data directory. v1.1.0 does not rely on valuable persisted user settings, so this is acceptable.
- Renaming the port environment variable can break private scripts that use the old name. Because it is a test/development override rather than a public user setting, this migration intentionally uses the new name without a runtime alias.
- Documentation may confuse the unchanged repository slug with the product name. README wording must explicitly explain that the repository is still named `workbuddy-pet` while the application is Blueberry.
- If packaging or Hook acceptance fails, revert the rename commit as one unit; the existing v1.1.0 Hook implementation remains available on the feature branch.
