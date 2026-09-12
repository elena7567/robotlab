# RobotLab project rules for Codex

## Scope and canonical location

- The canonical and only project path is `D:\Projects\Codex\RobotLab`.
- Do not create project copies or perform RobotLab work outside this directory.
- Inspect the current tree and status before changing files. Preserve unrelated user work.

## Filesystem safety

- Do not perform destructive operations without the user's explicit permission.
- Do not delete approved assets, source references, user files, or working implementation.
- Do not move or rename files without recording the move in `ROBOTLAB-PROJECT-STATUS.md` and explaining it in the completion report.
- Never overwrite visual reference files in `docs/references/`.
- Treat approved visual assets as immutable source inputs unless the user explicitly requests their modification.

## Product and asset integrity

- Do not change the documented game design silently. Record material changes in `docs/decisions/` and in the status document.
- Do not replace approved assets with placeholders.
- Do not generate, download, or substitute production artwork unless the user explicitly requests it.
- If a required production asset is unavailable, report `MISSING_ASSET` with its asset ID.
- Stop work that depends on a missing required production asset. Continue only on independent work, or where the user explicitly allows a neutral development placeholder.
- Never allow a temporary development visual to be mistaken for approved production art; mark it clearly in code, filenames, and status.

## Architecture and implementation

- Keep educational rules and serializable game state outside Phaser scene objects.
- Keep scenes thin: scenes coordinate presentation, input plumbing, and lifecycle.
- Implement each educational mechanic as a reusable module driven by question/content data.
- Use stable asset manifest IDs rather than scattering file paths through code.
- Support mouse and touch from the same action boundary.
- Keep the minimum supported width of 320 px usable.
- Responsive changes must use centralized fluid sizing, centralized camera/framing, or one of the four documented composition modes. Do not add exact-device checks or width/height combinations for individual phone or tablet models unless a documented browser bug requires one.
- Do not add a backend, account system, payment, or runtime network dependency.

## Verification and reporting

- Use `http://127.0.0.1:4198/` as the single canonical local game URL for development, manual review, screenshots, and browser QA.
- Start Vite with strict port binding. Never allow automatic fallback to another port; if 4198 is occupied, stop the stale RobotLab server or report the conflict before continuing.
- Verify changes in proportion to their risk; a successful compilation alone is not sufficient for a stage PASS.
- For UI/game changes, test relevant desktop, tablet, mobile, touch, flow, console, and visual states.
- Update `ROBOTLAB-PROJECT-STATUS.md` after every completed stage or material change.
- Report the exact files created, modified, moved, and deleted.
- Record verification commands and results. Do not claim tests that were not run.

## MANUAL REVIEW / PREVIEW CONTRACT

Any task ending in `READY_FOR_REVIEW`, `READY_FOR_MANUAL_REVIEW`,
`READY_FOR_PHYSICAL_SAMSUNG_REVIEW`, or another `READY_FOR_*_REVIEW` state must
not stop after build or automated QA. Unless the user explicitly says
`DO NOT START PREVIEW`, Codex must run `npm run review` before reporting
completion and make the current build accessible for manual review.

The mandatory review workflow is:

- create a production build and serve that build with Vite production preview;
- do not use the Vite development server or HMR for final manual review;
- listen on `0.0.0.0:4198` with strict port binding enabled;
- dynamically detect the current active physical LAN IPv4, preferring Wi-Fi or
  Ethernet with the active default route;
- never reuse a recorded IP address, and reject VPN, TAP, TUN, WSL, Docker,
  Hyper-V, loopback, disconnected, and virtual adapters;
- verify both `http://127.0.0.1:4198/` and the detected LAN URL;
- reuse an already-running verified RobotLab production preview, but never kill
  an unrelated process occupying port 4198;
- leave the verified server running after the task finishes;
- report the PC and Samsung URLs prominently, plus any existing and verified
  mission/stage direct-entry URLs relevant to the task; never invent QA query
  parameters.

The canonical launcher is `scripts/review-server.mjs`. If the build fails, either
HTTP check fails, or the server cannot be left running, the task must not be
reported as review-ready. If localhost works but LAN fails, inspect Windows
Firewall; never disable it globally, and document any minimal RobotLab-specific
rule that is created or changed.

Every review-ready final report must include:

```text
MANUAL REVIEW:
READY / NOT READY

SERVER:
RUNNING / NOT RUNNING

MODE:
PRODUCTION PREVIEW / OTHER

HMR:
ABSENT / PRESENT

LISTEN:
<host:port>

CURRENT LAN IPV4:
<ip>

PC URL:
http://127.0.0.1:4198/

SAMSUNG URL:
http://<ip>:4198/

DIRECT QA URL:
<url / NONE>

PC HTTP:
PASS / FAIL

LAN HTTP:
PASS / FAIL

SERVER LEFT RUNNING:
YES / NO
```

If `SERVER LEFT RUNNING` is not `YES`, the task cannot be reported as
`READY_FOR_MANUAL_REVIEW`.
