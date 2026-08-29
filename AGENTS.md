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

- Verify changes in proportion to their risk; a successful compilation alone is not sufficient for a stage PASS.
- For UI/game changes, test relevant desktop, tablet, mobile, touch, flow, console, and visual states.
- Update `ROBOTLAB-PROJECT-STATUS.md` after every completed stage or material change.
- Report the exact files created, modified, moved, and deleted.
- Record verification commands and results. Do not claim tests that were not run.
