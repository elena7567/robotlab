# RobotLab — «Почини робота»

RobotLab is a planned browser-based educational 2D mini-game for children approximately 4–6 years old. The player repairs a friendly robot by completing five short developmental tasks in a clear 4–7 minute session.

The game is intended as a polished portfolio project demonstrating modular game logic, animation, audio, progression, responsive interaction, and production-quality presentation. Gameplay will work without accounts, payments, a backend, or a network connection after the page has loaded.

## Current status

Stage 0 — Foundation. Documentation, architecture, directory structure, and project metadata are present. No gameplay or production artwork has been implemented. See [ROBOTLAB-PROJECT-STATUS.md](./ROBOTLAB-PROJECT-STATUS.md).

## Target audience

- Children approximately 4–6 years old.
- Mouse, touch, and simple direct-selection interaction.
- Short, low-pressure sessions with gentle retry feedback.

## Technology stack

- Phaser 3 for 2D rendering, scene orchestration, animation, input, and audio.
- TypeScript for typed modules and content definitions.
- Vite for local development and static production builds.
- HTML5 and CSS for the browser shell and accessibility-sensitive UI where appropriate.
- Web Audio / Phaser Audio for local sound playback.
- `localStorage` only for optional settings or a local best result.
- No React, backend, database, or authentication.

## Commands

Dependencies are deliberately not installed during Stage 0.

```sh
npm install
npm run dev
npm run typecheck
npm run build
npm run preview
```

Production output will be written to `dist/` by Vite.

## Directory map

```text
RobotLab/
├── src/
│   ├── main.ts              # Stage 1 browser entry point
│   ├── game/
│   │   ├── config/          # Phaser/runtime configuration
│   │   ├── scenes/          # Thin lifecycle and presentation scenes
│   │   ├── mechanics/       # Reusable educational mechanic modules
│   │   ├── systems/         # Progression, state, audio, input, persistence
│   │   ├── data/            # Data-driven questions and asset manifests
│   │   └── utils/           # Shared helpers
│   └── ui/                  # Responsive DOM UI where appropriate
├── public/assets/
│   ├── characters/robot/
│   ├── backgrounds/
│   ├── objects/
│   ├── ui/
│   ├── effects/
│   ├── audio/{music,sfx,voice}/
│   └── fonts/
├── docs/
│   ├── references/          # Immutable approved visual references
│   └── decisions/           # Architecture/design decision records
└── qa/screenshots/          # Visual verification evidence
```

Empty leaf directories contain `.gitkeep` files so the planned structure remains visible before approved assets and implementation files arrive.
