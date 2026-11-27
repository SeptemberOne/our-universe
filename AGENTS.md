# Our Universe — Agent Instructions

## Product
Build **Our Universe**, a private, shared two-person iPhone experience for a couple.
Tagline: **“Two hearts. One universe.”**
The experience should feel magical, intimate and celestial: stars, planets, galaxies, soft nebulae and subtle motion.

## Working roles
- **Antigravity** is the implementation agent: inspect the repository, implement the next agreed task, run checks and report changed files and results.
- **ChatGPT** is the technical lead and reviewer: help make architecture decisions, inspect code, review diffs, debug issues and maintain product/technical consistency.
- **GitHub** is the shared source of truth. Commit coherent changes with descriptive messages.
- Do not assume that a task is complete until the relevant checks have actually been run.

## Product requirements
- iPhone-first application.
- English and Simplified Chinese (简体中文).
- Shared online experience for exactly two invited people.
- Personal photographs and letters must remain private to those two accounts.
- Initial photo collection is expected to contain approximately 50–100 images.
- Main game: photo-memory matching (flip cards to find matching pairs).
- Additional experiences: photo jigsaw puzzles, Guess the Memory, Find the Differences, relationship quiz, Love Letters / “Open When…” messages, Star Collection rewards and a decorative Dream Garden.
- Keep the experience warm, playful, romantic and easy to use. Avoid clutter and unnecessary complexity.

## Technical direction
Use the following baseline unless a documented technical reason requires a change:
- React Native + Expo + TypeScript.
- Expo Router for navigation.
- Supabase for authentication, Postgres data, private photo storage and synchronisation.
- i18next (or a compatible React Native localisation setup) for English and Simplified Chinese.
- React Native Reanimated for purposeful, restrained animations.
- Expo EAS Build for iOS builds from the Windows development environment.

Prefer stable, current Expo-compatible package versions. Do not add dependencies without a clear need.

## Security and privacy rules
- Never commit API secrets, service-role keys, signing credentials, passwords, access tokens or private personal data.
- Commit only example environment files such as `.env.example`; keep real environment files ignored.
- Supabase service-role credentials must never be included in the mobile app.
- Treat all couple photos, letters, profiles and relationship data as private.
- Use Supabase Row Level Security (RLS) and private Storage buckets. Design access so only the two explicitly linked members of the same couple can read or modify their shared content.
- Do not rely on obscurity or client-side checks for access control.
- Do not put real photographs in the Git repository. Use clearly labelled sample placeholders during development.
- Document security-sensitive assumptions before implementation.

## Engineering rules
- TypeScript strict mode; avoid `any` unless there is a clear, documented reason.
- Keep components small and reusable; separate UI, domain logic, data access and localisation.
- Keep user-facing strings out of components where practical; provide English and Simplified Chinese translations together.
- Support loading, empty, error and offline/poor-network states.
- Make touch targets comfortable and respect iOS safe areas, dynamic text and accessibility labels.
- Keep animations performant and provide reduced-motion-friendly behaviour where practical.
- Do not build the entire app in one giant step. Work in small, reviewable phases.
- Before changing architecture or adding major scope, explain the reason and propose the smallest sensible option.
- Run available lint, typecheck and tests after meaningful changes. Report commands and actual outcomes; never claim checks passed if they were not run.

## Git workflow
- Work on the default branch only for small initial setup tasks. For substantial features, create a focused feature branch and open a pull request.
- Never force-push, rewrite history or delete user work without explicit approval.
- Inspect existing files before editing. Preserve existing user changes.
- Use descriptive commit messages and keep commits focused.

## First implementation milestone
Create a minimal, runnable Expo application foundation:
1. Inspect the repository and confirm the existing state.
2. Scaffold Expo + React Native + TypeScript with Expo Router.
3. Add a simple Our Universe home screen using the celestial visual direction.
4. Add English and Simplified Chinese localisation scaffolding.
5. Add an architecture README section and an `.env.example` only if configuration is actually needed.
6. Ensure the app starts with the documented command and run type/lint checks that are available.
Do not connect Supabase or request credentials yet. First deliver a working local shell; add backend integration in a later phase.

## Antigravity task discipline
At the start of each task, summarise the intended change in 2–4 bullets. Then inspect relevant files and implement only that task. At the end, report:
- What changed
- Files created/modified
- Commands run and their results
- Any blocker or decision needed
- The next smallest recommended task
