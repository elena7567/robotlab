# Deployment plan

Deployment is explicitly out of scope for Stage 0. This document prepares the future static release; no site or hosting configuration has been created.

## Common build contract

- Install: `npm ci` once a lockfile exists (Stage 1 initially uses `npm install`).
- Build: `npm run build`.
- Output folder: `dist/`.
- Preview locally: `npm run preview`.
- Runtime: static HTML, JavaScript, CSS, and local assets only.
- No API, server rendering, database, authentication, redirects, or SPA fallback is required while the game uses a single document and scene-based internal navigation.

Before release, verify a clean install/build, base URL load and refresh, MIME types, asset caching, full game flow, and the absence of runtime requests to external content services.

## Netlify

- Build command: `npm run build`.
- Publish directory: `dist`.
- Use the site root as Vite's default base path (`/`) unless a non-root deployment is chosen.
- No rewrite rule is needed for a single-document game with no client-side URL routes. If routes are added later, document and test an SPA fallback explicitly.
- Pin the supported Node version in deployment configuration during the release stage.
- Use deploy previews for QA, but do not treat preview compilation as a full PASS.

## GitHub Pages

- Build command: `npm run build`.
- Publish the contents of `dist/` through an approved Pages workflow.
- For a project site such as `https://owner.github.io/RobotLab/`, set Vite `base` to `/RobotLab/` (matching the actual repository name and casing) before build.
- For a user/organization root site, use `/`.
- Prefer imported or base-aware asset URLs; do not hard-code root-absolute `/assets/...` paths that break under a repository subpath.
- No `404.html` fallback is required unless URL routing is introduced later.

## Asset and offline-after-load considerations

- All runtime assets ship inside the static build/public asset tree.
- Use stable manifest IDs while letting Vite hash bundled code/assets where applicable.
- Confirm public assets and audio paths respect the configured base URL.
- Appropriate long-lived caching may be used for hashed files; HTML should update promptly.
- “No network dependency during gameplay after load” means a completed initial load has all resources required for the finite session. A service worker/offline relaunch is not required unless separately approved.

## Mobile browser release testing

- Test current mobile Safari and Chrome at 390×844 and minimum 320 px width.
- Test tablet portrait 768×1024 and practical landscape orientations.
- Verify safe-area insets, browser chrome, orientation changes, touch target sizing, gesture prevention, visibility changes, audio unlock/mute, and memory/frame pacing.
- Run at least one complete five-task session plus replay on each representative mobile class.
- Capture release screenshots and record browser/device versions in QA evidence.

## Release gate

Deploy only after explicit user approval, Stage 9 PASS, all required production assets are approved and implemented, the production build passes locally, and the selected host/base-path configuration has been documented in project status.
