# Our Universe — Development Plan

The project should progress in small, testable milestones. Do not start a later phase until the previous one has a working result and its checks are reported.

## Phase 0 — Repository and app foundation
- Scaffold Expo + React Native + TypeScript.
- Configure Expo Router.
- Establish a simple celestial theme and reusable UI primitives.
- Add English and Simplified Chinese localisation scaffolding.
- Build a polished but lightweight home screen.
- Add setup instructions and run the app locally.
**Acceptance:** app launches; home screen renders; language can be switched; TypeScript checks pass.

## Phase 1 — First playable game
- Build the photo-memory matching game using local placeholder/sample images.
- Add move count, elapsed time, pair matching, reset and completion state.
- Add difficulty/board size only after the core game works.
- Localise all game text.
**Acceptance:** game is fully playable without network access or a backend.

## Phase 2 — Supabase foundation and private couple space
- Confirm authentication and invitation approach.
- Design database schema and access rules.
- Configure Supabase Auth, Postgres and private Storage.
- Implement and test Row Level Security policies before connecting real personal data.
- Add secure two-person linking and shared state.
**Acceptance:** two invited accounts can access the same shared space; unrelated accounts cannot access its data or files.

## Phase 3 — Private photo library
- Add upload, thumbnail handling, listing and deletion.
- Add progress, retry and failure states.
- Connect the memory game to the shared photo library.
**Acceptance:** both linked users can view the same private photos; unauthorised users cannot.

## Phase 4 — Memories and letters
- Add Guess the Memory.
- Add Love Letters / “Open When…” with private access and bilingual content.
- Add couple-managed prompts and answers.
**Acceptance:** content syncs for both linked users and remains private.

## Phase 5 — Additional games
- Add Photo Jigsaw.
- Add Find the Differences using prepared puzzle pairs.
- Add Relationship Quiz.
**Acceptance:** each game has clear instructions, completion feedback and localisation.

## Phase 6 — Rewards and Dream Garden
- Add Star Collection rules.
- Add shared reward balance/history.
- Add a simple customisable Dream Garden.
**Acceptance:** rewards are earned consistently and garden state syncs between both users.

## Phase 7 — Test, polish and iOS distribution
- Test on physical iPhones and varied network conditions.
- Review accessibility, privacy, error states and performance.
- Configure EAS Build and TestFlight distribution.
- Prepare app icon, splash screen, privacy information and release checklist.
**Acceptance:** a repeatable iOS build and a tested private two-person experience.

## Development workflow
For every phase:
1. Agree the smallest next task.
2. Inspect current code before editing.
3. Implement only the agreed scope.
4. Run typecheck, lint and relevant tests.
5. Review the diff and security implications.
6. Commit with a clear message.
7. Record what is complete and what remains.

## Current status
- [x] GitHub repository created and accessible.
- [x] Product direction and initial requirements documented.
- [x] Phase 0: runnable Expo foundation.
- [x] Phase 1: first playable game (Photo Memory Match).
- [x] Phase 2: Supabase foundation and private couple space (schema, RLS, Auth & couple linking UI).
