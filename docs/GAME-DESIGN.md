# Game design

## Purpose

«Почини робота» is a short educational game that lets a young child help a friendly broken robot through five developmentally appropriate visual tasks. The experience should feel like helping and discovering, not being examined.

## Audience and experience

- Target age: approximately 4–6 years.
- Target session: approximately 4–7 minutes.
- Primary verbs: look, compare, remember, select, arrange, and help repair.
- Interaction: large direct targets using mouse or touch.
- Reading dependency: minimal. Meaning should come from composition, animation, symbols, and optional short voice guidance.

The tone is patient, warm, legible, and encouraging. There is no account, score pressure, punishment, or competitive loop.

## Complete game loop

1. Start screen with one clear play action and sound control.
2. Short introduction: the friendly robot needs five repairs.
3. Task 1 is presented and completed; repair stage advances to 1/5.
4. Task 2 is presented and completed; repair stage advances to 2/5.
5. Task 3 is presented and completed; repair stage advances to 3/5.
6. Task 4 is presented and completed; repair stage advances to 4/5.
7. Task 5 is presented and completed; repair stage advances to 5/5.
8. The fully repaired robot activates and celebrates.
9. Results screen gives positive completion feedback and one clear replay action.
10. Replay starts a new finite five-task session.

There is no infinite question loop. Every run has a visible beginning, progress arc, and ending.

## Planned mechanics

1. **Find the odd one out:** select the one object that differs categorically from three related objects.
2. **Continue the sequence:** select or place the item that completes a short visual pattern.
3. **Compare by size:** select the largest/smallest object or arrange a small set from smallest to largest.
4. **Find the matching shadow:** match a readable object silhouette to its source object.
5. **Memory task:** briefly view a small set, then identify a missing item or remembered position.

Each mechanic will be a reusable module. Difficulty and content come from validated question data rather than scene-specific branching.

## Progression

The repair meter has six states: 0/5 through 5/5. Each completed task visibly restores one modular robot component. A short transition focuses attention on the repair, then returns to the next task. Progress remains visible but never competes with the task.

The exact repaired module order will be confirmed after approved robot assets exist. Logic must not depend on a particular visual anatomy.

## Feedback

- Correct: immediate readable highlight, soft positive sound, brief celebratory motion, and then repair progress.
- Incorrect: gentle neutral cue, no lost progress, no harsh sound, no shame language, and another attempt on the same task.
- Inactivity: optional calm visual hint after an age-appropriate delay; never a countdown.
- Instructions: demonstrate where practical; use minimal text and optional voice.

## Win state and replay

At 5/5, the robot activates, performs a joyful non-frightening celebration, and leads into a simple results screen. The completion message celebrates helping and persistence rather than speed or intelligence. Replay resets transient session state and begins a new finite sequence.

## Difficulty philosophy

- Favor clear concepts over trick questions.
- Introduce one cognitive demand at a time.
- Use small item counts and visually distinct answer targets.
- Avoid timers, pressure, harsh failure sounds, punishment, complex menus, excessive text, or unnecessary instructions.
- Avoid ambiguous categories, culturally obscure objects, and silhouettes distinguishable only by tiny details.
- Allow unlimited gentle retries.
- Difficulty should rise slightly through clearer multi-step relationships, not speed or visual clutter.
- Content requires adult review for developmental suitability before release.
