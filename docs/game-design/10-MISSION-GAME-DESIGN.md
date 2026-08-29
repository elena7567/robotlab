# RobotLab 10-mission game design

## Document status

- Stage: 8.0 — 10-Mission Game Design.
- Scope: approved product direction and design specification only.
- Runtime status: Missions 6–10 are not implemented.
- Locked baseline: Missions 1–5 and their current runtime behavior remain unchanged.

## Game premise

RobotLab is a narrative educational repair adventure for children approximately 4–6 years old. The child does not merely answer a sequence of exercises: every solved challenge causes a visible physical change in the laboratory and advances a second robot from separate parts to a fully launched character.

The child’s verbs form the complete fantasy:

```text
BUILD → ACTIVATE → PROGRAM → TEST → LAUNCH
```

The existing complete robot remains the persistent helper and guide. The second robot is the repair subject. It is assembled in Act I, brought to life in Act II, and launched in Act III.

RobotLab is differentiated from a collection of disconnected worksheets by:

1. visible robot construction;
2. systems activation with physical consequences;
3. an introductory programming mechanic;
4. a progressively reactive laboratory;
5. a persistent helper character;
6. an integrated final mission rather than another worksheet;
7. optional adaptive hints;
8. unlimited gentle retries and no punitive failure loop.

## Experience principles

- Keep instructions and helper dialogue short, concrete, and child-facing.
- Communicate through animation, sound, symbols, and demonstration before relying on text.
- Give every major mission a visible robot or laboratory consequence.
- Preserve progress after mistakes; never use lives, score penalties, countdown pressure, or shame language.
- Use large targets and a shared semantic action boundary for mouse and touch.
- Make each mechanic reusable and driven by validated content data.
- Do not require all ten missions in one sitting.

## Approved three-act structure

### Act I — СОБЕРИ РОБОТА

Missions 1–5 are complete and locked. The child installs the body, head, legs, arms, and antenna. At the end of Mission 5 the second robot is assembled, but it is not yet powered or fully operational.

### Act II — ОЖИВИ РОБОТА

Missions 6–9 activate the robot’s energy, internal connections, movement program, and system diagnostics. The robot changes from a complete but inactive construction into a responsive character capable of executing commands.

### Act III — ЗАПУСТИ РОБОТА

Mission 10 is a short integrated mini-adventure. It recalls several skills without repeating full earlier missions, culminates in a deliberate launch action, and opens the main laboratory door.

## Mission overview

| # | Act | Mission | Learning goals | Core mechanic | Robot reward | Narrative consequence |
|---|---|---|---|---|---|---|
| 1 | I | Найди лишний предмет | Classification | Select the item outside a category | Body installed | A repair subject begins to take shape |
| 2 | I | Продолжи ряд | Patterns and sequences | Complete a visual sequence | Head installed | The robot gains a recognizable identity |
| 3 | I | Сравни по размеру | Size comparison | Compare or order by size | Legs installed | The robot can stand when activated later |
| 4 | I | Найди тень | Visual matching | Match an object to its silhouette | Arms installed | The robot can interact with its environment later |
| 5 | I | Найди пары | Memory and attention | Reveal and match pairs | Antenna installed | Assembly reaches 5/5; robot leaves the station |
| 6 | II | Заряди робота | Quantity comparison, empty/half/full, ordering | Select or order batteries by energy | Power module activates | ЭНЕРГИЯ ПОДАНА |
| 7 | II | Подключи провода | Color matching, visual tracking, coordination | Connect matching colored ports | Internal circuits connect | Systems can exchange signals |
| 8 | II | Запрограммируй робота | Sequencing, spatial reasoning, computational thinking | Build and run an arrow-command sequence | Movement control activates | Robot takes controlled steps |
| 9 | II | Проверь системы | Attention, reaction, recognition, working memory | Complete a short diagnostic set | All subsystems verified | Robot is cleared for launch |
| 10 | III | Первый запуск | Integrated recall, planning, cause and effect | Complete a short launch sequence | Robot fully launches | Main door opens; both robots celebrate |

## Mission design details

### Mission 1 — Найди лишний предмет (locked)

- Learning goal: classification.
- Mechanic: select the one object that does not belong.
- Reward: body installed.
- Visual/audio opportunity: a small monitor wakes and shows the first stable signal; a soft installation sound confirms progress.
- Difficulty: categories must be familiar and visually unambiguous.
- Responsive note: preserve the existing approved layout and large targets.

### Mission 2 — Продолжи ряд (locked)

- Learning goal: pattern recognition and sequencing.
- Mechanic: select the missing continuation of a short visual sequence.
- Reward: head installed.
- Visual/audio opportunity: the blueprint display updates with a completed head schematic.
- Difficulty: increase structural complexity, not clutter or speed.
- Responsive note: preserve the existing approved sequence layout.

### Mission 3 — Сравни по размеру (locked)

- Learning goal: relative size and ordering.
- Mechanic: choose the requested size or compare a small set.
- Reward: both legs installed.
- Visual/audio opportunity: additional repair-platform lights illuminate from the floor upward.
- Difficulty: retain recognizable shapes and clearly separated scale differences.
- Responsive note: preserve the existing approved bottom alignment and target sizing.

### Mission 4 — Найди тень (locked)

- Learning goal: visual matching.
- Mechanic: match an object to the correct silhouette.
- Reward: both arms installed.
- Visual/audio opportunity: a workshop arm performs one brief background movement.
- Difficulty: silhouettes must differ in primary form, not tiny details.
- Responsive note: preserve the existing approved target-and-options composition.

### Mission 5 — Найди пары (locked)

- Learning goal: memory and attention.
- Mechanic: reveal and match pairs.
- Reward: antenna installed; assembly reaches 5/5.
- Visual/audio opportunity: the assembly station activates, then releases the robot into the laboratory.
- Difficulty: small pair counts, stable card positions, and no time pressure.
- Responsive note: preserve the existing approved card grid and release presentation.

#### Future Mission 5 transition

The runtime transition is unchanged in Stage 8.0. When the second half is implemented, Mission 5 must no longer claim final repair or route directly to the final victory meaning.

Approved future transition:

```text
Mission 5 complete
→ assembly reaches 5/5
→ repaired robot is released from the station
→ transitional success state
→ Mission 6
```

- Title: `РОБОТ СОБРАН!`
- Subtext: `ТЕПЕРЬ ПОРА ЕГО ОЖИВИТЬ!`
- Primary action: `ПРОДОЛЖИТЬ`
- Do not use `РОБОТ ПОЧИНЕН!` here. Reserve final repair/launch language for Mission 10.

### Mission 6 — Заряди робота

- Learning goals: compare quantities; recognize empty, half, and full; order by amount; use visual reasoning.
- Core mechanic: battery/energy selection.
- Internal challenge A: choose the fullest battery.
- Internal challenge B: choose the emptiest battery.
- Internal challenge C: arrange three or four batteries from empty to full.
- Reward: battery or power module activates; the eyes or chest screen gains a stable energy glow.
- Narrative consequence: `ЭНЕРГИЯ ПОДАНА`.
- Visual/audio opportunities: energy conduits illuminate from the selected battery toward the robot; use a rising charge sound followed by a calm power-on chime.
- Difficulty: begin with large level differences; later use closer but still unmistakable fill amounts. Hints may animate the liquid/segment level or demonstrate the first ordering position.
- Responsive notes: use a single selection row on wide screens and a compact two-row choice grid in portrait. Ordering must use large draggable batteries with visible slots and tap-to-place as an equivalent accessible action.

### Mission 7 — Подключи провода

- Learning goals: color matching, visual tracking, hand-eye coordination, and simple connection logic.
- Core mechanic: drag or trace a wire between ports of the same color (red, blue, green, yellow).
- Challenge progression: start with aligned pairs; later cross port positions while keeping paths readable and limiting simultaneous wires.
- Reward: internal robot systems become connected.
- Narrative consequence: the powered robot can now route energy and signals between subsystems.
- Visual/audio opportunities: a pulse travels along each completed wire; connected sockets glow and produce distinct soft clicks. Completing the circuit sends a synchronized pulse through the robot.
- Difficulty: never rely on color alone—each color also needs a stable shape/symbol. Incorrect endpoints release gently without consuming progress. A hint can pulse the matching symbol pair.
- Responsive notes: on 320×568 and 390×844, place source ports in a vertical rail on one side and destinations on the other, with the routing field between them. Keep ports at least 44×44 CSS pixels, enlarge drag capture beyond the visible socket, and avoid instructions or buttons overlapping the wire field. On tablet/landscape, use two horizontal or vertical banks with more breathing room. A tap-source/tap-destination fallback must perform the same semantic action as dragging.

### Mission 8 — Запрограммируй робота

- Learning goals: sequencing, spatial reasoning, basic computational thinking, and cause and effect.
- Core mechanic: build a short sequence from icon-only or minimally labeled arrow commands (`LEFT`, `RIGHT`, `UP`, `DOWN`), then press `ЗАПУСТИТЬ` to execute it.
- Example: the robot reaches a charging station with `RIGHT, RIGHT, UP`.
- Reward: movement system becomes operational.
- Narrative consequence: the robot takes its first controlled steps and can follow the child’s program.
- Visual/audio opportunities: command slots illuminate one at a time while the robot moves; use a short step tone and a clear run-complete motif. Preserve the executed sequence so cause and effect remains visible.
- Difficulty: begin with one or two commands and a straight path; progress to three commands and one turn. Avoid hidden obstacles, timing demands, or ambiguous grid positions. On failure, return the robot to start, retain or clearly restore the sequence, and offer a path highlight rather than punishment.
- Responsive notes: on portrait screens, stack the grid above a horizontally scroll-free command tray; keep the run button fixed below the sequence without covering the grid. Prefer a 3×3 or similarly small board, four large arrow controls, and 3–4 visible command slots. On landscape, place grid and program panel side by side. All command input, removal, reorder, and run actions must work equally with mouse and touch.

### Mission 9 — Проверь системы

- Learning goals: attention, reaction, visual/auditory recognition, and short working-memory sequences.
- Core mechanic: a robot diagnostic consisting of a small authored subset of tests, not an endless reaction game.
- Candidate challenges: press when a green signal appears; identify a sound/signal; repeat a short light sequence; select which subsystem is active.
- Systems: energy, vision, sound, movement.
- Reward: all robot systems receive a verified status.
- Narrative consequence: the robot is operational and cleared for first launch.
- Visual/audio opportunities: diagnostic panels activate one by one; the helper names each restored system in a short phrase; final status lights turn green together.
- Difficulty: use generous response windows, recognizable sounds with visual equivalents, and sequences of two before three. Do not require audio-only success.
- Responsive notes: show one diagnostic at a time with a stable central response target; keep status indicators secondary and compact in portrait.

### Mission 10 — Первый запуск

- Learning goals: integrate classification, quantity, memory, sequencing, and cause/effect in a meaningful goal-directed sequence.
- Core mechanic: a short mini-adventure, not another worksheet or a full replay of previous mechanics.
- Recommended flow:
  1. choose the correct tool;
  2. select the correct energy source;
  3. remember two launch symbols;
  4. program a short route;
  5. press the launch control.
- Reward: the robot fully starts and leaves the repair context as an active character.
- Narrative consequence: the main laboratory door opens; the helper and repaired robot celebrate; the ten-mission adventure reaches its true completion.
- Visual/audio opportunities: each step activates a different laboratory layer; launch uses the strongest non-frightening light, motion, music resolution, and two-character celebration in the game.
- Difficulty: use compact callbacks to learned rules, no surprise rule changes, no reset of already completed launch steps, and a direct contextual hint after repeated difficulty.
- Responsive notes: present the adventure as consecutive focused panels/scenes rather than one crowded dashboard. Maintain the laboratory and robot as the visual anchor at every target viewport.

## Semantic progression and milestones

Do not replace the assembly display with a generic 0/10 meter. Progress has three meanings:

| Phase | Missions | Primary progress language | Completion meaning |
|---|---|---|---|
| СБОРКА | 1–5 | Assembly 0/5 → 5/5 and installed parts | The physical robot is assembled |
| СИСТЕМЫ | 6–9 | Energy, connections, program, diagnostics status | The assembled robot is operational |
| ЗАПУСК | 10 | A focused launch checklist/sequence | The robot is fully launched |

The repaired robot’s visible states are: assembled → powered → connected → command-capable → systems verified → launched.

## Laboratory reactivity plan

Environmental reactions should be short rewards that preserve focus and remain subordinate to the current task.

| Mission | Future laboratory reaction |
|---|---|
| 1 | Small monitor activates |
| 2 | Blueprint display updates |
| 3 | Repair platform lighting increases |
| 4 | Workshop arm moves briefly |
| 5 | Assembly station activates and releases the robot |
| 6 | Energy conduits glow |
| 7 | Wire and system lights pulse |
| 8 | Robot takes its first controlled steps |
| 9 | Diagnostic panels fully activate |
| 10 | Main laboratory door opens |

Reactivity is presentation state derived from canonical mission/system progress. It must not become a second source of progression truth.

## Helper robot role

The helper persists across all acts and:

- introduces the immediate goal;
- reacts to correct and incorrect attempts;
- offers concise hints;
- explains which part or system changed;
- celebrates act milestones and final launch.

Dialogue should generally be one short sentence. Prefer phrases such as `НАЙДЁМ САМУЮ ПОЛНУЮ!`, `СОЕДИНИ ОДИНАКОВЫЕ ЗНАКИ`, and `ПРОГРАММА ГОТОВА!` over multi-step paragraphs.

## Lightweight adaptive difficulty

Adaptation is optional, local, and invisible. Never label a challenge `EASY`, `MEDIUM`, or `HARD` to the child.

Signals may include wrong attempts, hint usage, time to solve, and first-try success. A small policy may select among authored variants:

- strong recent performance → choose the next valid variant with one additional relation, command, or closer quantity difference;
- repeated difficulty → choose a simpler valid variant, reduce item count, or surface a stronger visual hint;
- neutral/insufficient evidence → continue the standard authored sequence.

The system must be deterministic enough to test, bounded to approved child-safe content, and optional to disable. It is not an AI system and must never alter major mission completion or remove access to content.

## Session and checkpoint design

Recommended default checkpoints:

- Session A: Missions 1–3.
- Session B: Missions 4–6.
- Session C: Missions 7–9.
- Final: Mission 10.

Continuous play remains available. At a checkpoint, celebrate the immediate milestone, save canonical progression, and offer both `ПРОДОЛЖИТЬ` and a safe exit. Returning players resume at the next incomplete mission with a very short visual recap. Mission 6 is intentionally the end of Session B so that a returning player begins with the more interaction-heavy connection/programming pair while fresh.

## Future start-screen copy direction

The runtime copy remains unchanged in Stage 8.0. When ten-mission progression is implemented, use:

- Title: `ПОЧИНИ РОБОТА`
- Subtitle: `СОБЕРИ, ОЖИВИ И ЗАПУСТИ РОБОТА!`

Remove any promise of exactly five tasks from the future start screen.

## Future collection system — not current scope

After a complete playthrough, a future version may make another robot skin/model available for repair. The possible replay loop is `complete missions → repair another robot design`.

Do not implement coins, loot boxes, random rewards, a store, premium unlocks, or collection progression during Missions 6–10 work.

## Responsive acceptance targets

All new mechanics must remain usable at:

- 320×568;
- 390×844;
- 768×1024;
- 1280×720;
- 1438×914.

Use the existing centralized fluid sizing, camera/framing, and four composition modes. Do not add device-specific checks. Each implementation stage must verify layout, touch interaction, complete flow, visual states, and browser console behavior at the relevant targets.
