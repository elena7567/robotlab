# Asset plan

## Status model and ownership

Allowed statuses:

- `MISSING` — required but not supplied.
- `REFERENCE` — a visual reference exists; not approved for shipping.
- `APPROVED` — user-approved production input, not yet verified in runtime.
- `IMPLEMENTED` — approved asset is integrated and verified in runtime.

Initial inventory: **37 assets; all 37 are `MISSING`**. Production visuals are external approved inputs. No substitute production art may be created or silently installed. Report `MISSING_ASSET: <ID>` whenever dependent implementation reaches an unavailable item.

Dimensions below are approximate export targets at 1× logical density; final source/export sizing will be confirmed against Stage 1's logical canvas and device pixel ratio policy. Preserve layered/vector masters outside the runtime tree where applicable.

## Robot — modular approach

This project prefers a modular-part robot over five duplicated full illustrations. Five modules can activate in a user-approved order while a base preserves pose registration. `robot-complete` is a final approved composition/validation asset, not a replacement for modular runtime parts.

| ID | Purpose | Format | Transparent | Approx. dimensions | Animation requirement | Status |
|---|---|---|---|---:|---|---|
| robot-base | Inactive/broken registered base and attachment guide | PNG/WebP or atlas | Yes | 900×1100 | Supports broken/idle registration | MISSING |
| robot-module-head | Repairable head/face module | PNG/WebP or atlas | Yes | 500×400 | Independent reveal; face frames compatible | MISSING |
| robot-module-core | Repairable torso/energy-core module | PNG/WebP or atlas | Yes | 520×520 | Activation pulse-compatible | MISSING |
| robot-module-arm-left | Repairable left arm module | PNG/WebP or atlas | Yes | 320×620 | Registered shoulder pivot | MISSING |
| robot-module-arm-right | Repairable right arm module | PNG/WebP or atlas | Yes | 320×620 | Registered shoulder pivot | MISSING |
| robot-module-legs | Repairable lower-body module | PNG/WebP or atlas | Yes | 600×520 | Registered hip/ground anchors | MISSING |
| robot-complete | Approved final composition for victory/validation | PNG/WebP or atlas | Yes | 900×1100 | Compatible with happy/victory motion | MISSING |

## Robot animations

| ID | Purpose | Format | Transparent | Approx. dimensions | Animation requirement | Status |
|---|---|---|---|---:|---|---|
| robot-anim-idle | Calm living pose after activation | Sprite atlas or rig spec | Yes | ≤2048 atlas pages | Seamless 2–4 s loop | MISSING |
| robot-anim-broken | Inactive but friendly intro state | Sprite atlas or rig spec | Yes | ≤2048 atlas pages | Subtle loop; never distressed | MISSING |
| robot-anim-repair-reaction | Reaction after each restored module | Sprite atlas or rig spec | Yes | ≤2048 atlas pages | Short modular-compatible one-shot | MISSING |
| robot-anim-happy | Positive task/session feedback | Sprite atlas or rig spec | Yes | ≤2048 atlas pages | Short loop or one-shot | MISSING |
| robot-anim-victory | Final activation celebration | Sprite atlas or rig spec | Yes | ≤2048 atlas pages | 2–4 s one-shot plus settle | MISSING |

## Backgrounds

| ID | Purpose | Format | Transparent | Approx. dimensions | Animation requirement | Status |
|---|---|---|---|---:|---|---|
| bg-start-laboratory | Start/intro laboratory composition | WebP/PNG | No | 2560×1440 with portrait-safe crop | Optional subtle separated layers | MISSING |
| bg-main-laboratory | Main task and repair environment | WebP/PNG | No | 2560×1440 with portrait-safe crop | Optional subtle separated layers | MISSING |

## Task object sets

Each set is one coordinated deliverable containing enough approved items for reviewed question data; individual runtime files receive child manifest IDs during integration.

| ID | Purpose | Format | Transparent | Approx. dimensions | Animation requirement | Status |
|---|---|---|---|---:|---|---|
| objects-odd-one-out-set | Category groups and clear odd choices | PNG/WebP or atlas | Yes | 256–512 px/item | Optional selection response | MISSING |
| objects-sequence-set | Repeating pattern symbols/items | PNG/WebP or atlas | Yes | 256–512 px/item | Optional gentle idle | MISSING |
| objects-size-set | Same-family objects in unambiguous sizes | PNG/WebP or atlas | Yes | 192–640 px/item | Optional placement settle | MISSING |
| objects-shadow-set | Source objects plus exact silhouette pairs | PNG/WebP or atlas | Yes | 384–640 px/item | Optional selection response | MISSING |
| objects-memory-set | Highly distinct symbols/items | PNG/WebP or atlas | Yes | 256–512 px/item | Hide/reveal compatible | MISSING |

## UI

| ID | Purpose | Format | Transparent | Approx. dimensions | Animation requirement | Status |
|---|---|---|---|---:|---|---|
| ui-play-button | Primary start action | SVG or PNG/WebP | Yes | 512×192 | Press/disabled states | MISSING |
| ui-sound-control | Sound on/off control | SVG or PNG/WebP | Yes | 128×128 per state | On/off and press states | MISSING |
| ui-progress-indicator | Readable 0/5–5/5 repair progress | SVG or PNG/WebP | Yes | 700×140 | Step fill/activation states | MISSING |
| ui-task-feedback | Correct and gentle retry feedback | SVG or PNG/WebP | Yes | 512×256 | Correct/incorrect-soft states | MISSING |
| ui-continue-control | Explicit advance when required | SVG or PNG/WebP | Yes | 512×192 | Press/disabled states | MISSING |
| ui-replay-control | Results-screen replay action | SVG or PNG/WebP | Yes | 512×192 | Press/disabled states | MISSING |

## Effects

| ID | Purpose | Format | Transparent | Approx. dimensions | Animation requirement | Status |
|---|---|---|---|---:|---|---|
| fx-star | Positive feedback accent | PNG/WebP or atlas | Yes | 128×128 | Spin/pop variants | MISSING |
| fx-spark | Small activation accent | PNG/WebP or atlas | Yes | 128×128 | Short one-shot frames | MISSING |
| fx-repair | Module restoration focal effect | PNG/WebP or atlas | Yes | 768×768 | 0.8–1.5 s one-shot | MISSING |
| fx-success-particles | Correct/victory particle source | PNG/WebP atlas | Yes | 64–128 px/particle | Runtime-emitter compatible | MISSING |

## Audio

| ID | Purpose | Format | Transparent | Approx. dimensions | Animation requirement | Status |
|---|---|---|---|---|---|---|
| audio-music-main | Calm laboratory/game music | OGG + MP3 fallback | N/A | 60–150 s loop | Seamless loop points | MISSING |
| audio-sfx-button | UI press confirmation | OGG + MP3 fallback | N/A | <0.5 s | None | MISSING |
| audio-sfx-correct | Warm correct-answer cue | OGG + MP3 fallback | N/A | 0.5–1.5 s | Sync with feedback | MISSING |
| audio-sfx-incorrect-soft | Gentle retry cue | OGG + MP3 fallback | N/A | <1 s | Never harsh/alarming | MISSING |
| audio-sfx-repair | Restored-module cue | OGG + MP3 fallback | N/A | 1–2 s | Sync with repair reveal | MISSING |
| audio-sfx-victory | Final completion flourish | OGG + MP3 fallback | N/A | 2–5 s | Sync with victory one-shot | MISSING |
| audio-voice-robot | Optional short approved robot lines | OGG + MP3 fallback | N/A | <5 s/line | Localized clip manifest if used | MISSING |

## Fonts

| ID | Purpose | Format | Transparent | Approx. dimensions | Animation requirement | Status |
|---|---|---|---|---|---|---|
| font-primary | Highly legible Cyrillic-capable UI typeface with web license | WOFF2 | N/A | Subset after approval | None | MISSING |

## Integration acceptance

An asset moves to `IMPLEMENTED` only after ID/path validation, license/ownership confirmation, transparency and crop review, correct scale/pivot verification, responsive checks, and runtime inspection for visual/audio artifacts. Asset optimization requires explicit approval and must preserve approved sources.
