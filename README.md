# Our Universe

**Two hearts. One universe.**

Our Universe is a private, shared iPhone experience for two people: photo games, shared memories, love letters and a celestial Dream Garden.

## Product direction
- iPhone-first
- English and Simplified Chinese
- Private two-person shared space
- Photo Memory Match as the first core game
- Celestial visual identity: stars, planets, galaxies and nebulae

## Documentation
- [Agent instructions](AGENTS.md)
- [Product specification](docs/PRODUCT_SPEC.md)
- [Development plan](docs/DEVELOPMENT_PLAN.md)

## Planned technology
- React Native + Expo + TypeScript
- Expo Router
- Supabase for authentication, database and private photo storage
- i18next-compatible localisation
- Expo EAS Build for iOS builds

The technology stack is the current project baseline and may be refined as implementation begins.

## Architecture

The Phase 0 foundation is a local-only Expo + React Native + TypeScript application using Expo Router:

- `src/app/` — Expo Router routes (`_layout.tsx` root providers & splash handling, `index.tsx` celestial Home screen).
- `src/components/` — Small reusable UI primitives (`CelestialBackdrop`, `CelestialCard`, `LanguageToggle`, `OrbitBadge`).
- `src/i18n/` — `i18next` / `react-i18next` configuration, English (`en`) and Simplified Chinese (`zh-CN`) translations, device-locale detection, and local language preference persistence.
- `src/theme/` — Celestial design tokens (midnight/indigo surfaces, nebula accents, typography, spacing, and iOS touch-target minimums).
- `assets/images/` — Placeholder app icon, splash screen, and favicon assets (no personal photographs).

Backend integration (Supabase Auth, Postgres, private Storage, and RLS) is intentionally deferred until Phase 2, so no environment variables or `.env.example` file are required yet.

## Local development

Prerequisites: Node.js (LTS / 20+) and npm.

```bash
npm install
npm run start
```

Platform shortcuts:
- `npm run ios` — Launch iOS simulator (requires macOS; on Windows, use Expo Go on iPhone or `npm run web` for a quick local preview).
- `npm run web` — Launch local web preview.
- `npm run typecheck` — Run strict TypeScript checks (`tsc --noEmit`).
- `npm run lint` — Run Expo ESLint checks.

## Development status
Phase 0 (minimal runnable Expo foundation with celestial Home screen and English / Simplified Chinese switching) is implemented. See [the development plan](docs/DEVELOPMENT_PLAN.md) for upcoming phases.

## Privacy
Do not commit real personal photographs, private letters, credentials or secrets to this repository. Use private backend storage for personal content. Keep production credentials out of source control.
