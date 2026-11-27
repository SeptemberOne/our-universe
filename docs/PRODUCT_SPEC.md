# Our Universe — Product Specification

## 1. Overview
**Name:** Our Universe  
**Tagline:** Two hearts. One universe.  
**Platform:** iPhone first  
**Languages:** English and Simplified Chinese  
**Audience:** One invited couple (two linked accounts)  
**Visual identity:** Magical celestial world with stars, planets, galaxies, nebulae and gentle ambient motion.

Our Universe is a shared private space where two people can play small games using their photographs, revisit memories, exchange affectionate messages and collect rewards together.

## 2. Product principles
1. Intimate, personal and private by default.
2. Delightful and polished without becoming complicated.
3. Photo memories are the central experience.
4. Both languages should feel native, not machine-translated UI fragments.
5. Build a useful, working core before adding optional features.

## 3. Core navigation (initial proposal)
Use a small number of clear destinations:
- **Home / Universe:** welcoming overview, shared activity and entry points.
- **Play:** available photo games and quizzes.
- **Memories:** shared photo collection and memory prompts.
- **Love Notes:** letters and “Open When…” messages.
- **Dream Garden:** shared decorative space and collected stars.

Navigation can be refined after the first runnable prototype. Avoid implementing every destination as a fully featured screen in the first milestone.

## 4. Features

### 4.1 Photo Memory Match — primary game
- Use the couple's shared photo collection to create matching pairs.
- Cards begin face down; players tap to reveal them.
- Match pairs, track moves and elapsed time, and show a completion moment.
- Offer a few board sizes/difficulty levels once the basic game is stable.
- Avoid exposing original photos outside the authenticated shared experience.
- Empty state should explain how to add the first photos.

### 4.2 Photo Jigsaw
- Select a photograph and divide it into pieces.
- Start with a simple grid-based puzzle; add drag interactions only after the basic version is reliable.
- Provide completion feedback and an option to replay.

### 4.3 Guess the Memory
- Show a photo or a cropped/blurred clue and ask a question about the shared memory.
- Support couple-created prompts and answers.
- Do not invent personal facts; prompts and answers must come from content the couple provides.

### 4.4 Find the Differences
- Present two versions of a photo with a small number of intentional differences.
- This feature may require prepared image pairs; do not imply arbitrary uploaded photos can automatically produce a good puzzle without an image-processing workflow.

### 4.5 Relationship Quiz
- A light, affectionate quiz with questions created or approved by the couple.
- Keep it playful; avoid judgemental scoring or sensitive assumptions.

### 4.6 Love Letters / “Open When…”
- Store private messages and letters for the other person.
- Example prompts: “Open when you miss me”, “Open when you need a smile”.
- Support bilingual content and optional scheduled/unlock conditions only if they can be implemented reliably and transparently.

### 4.7 Star Collection
- Award stars for completing games or shared activities.
- Explain how rewards are earned; avoid manipulative streaks or pressure.

### 4.8 Dream Garden
- A shared decorative space that can be gradually personalised using earned stars.
- Begin with a small set of decorations and a simple placement/customisation interaction.

## 5. Photo library
- Expected initial library: approximately 50–100 photos.
- Photos are private user content, not source-code assets.
- Use private cloud storage and authenticated access.
- Provide upload progress, retry/error states and clear empty states.
- Consider thumbnails and image resizing for performance and bandwidth.
- The couple should be able to add and remove their own photos subject to the shared access model.

## 6. Accounts and shared access
- Exactly two invited members per shared couple space for the initial release.
- One person creates the space and invites the other using a secure invitation flow.
- Both accounts see the same shared photos, games, letters and garden state.
- Enforce membership and access in the backend, not only in the app.
- The invitation design and authentication provider should be finalised during backend planning.

## 7. Localisation
- English (en) and Simplified Chinese (zh-CN).
- All visible app text, empty states, errors, accessibility labels and game instructions should be localisable.
- Store language-neutral identifiers in data where possible.
- Couple-authored letters and prompts may be written in either language; do not automatically overwrite original text with machine translation.
- Provide a simple language preference, with sensible device-language defaulting.

## 8. Visual and interaction direction
- Deep midnight blue / indigo foundation with restrained luminous accents.
- Celestial objects and nebula gradients should support the content rather than obscure it.
- Gentle star twinkle, parallax or floating effects may be used sparingly.
- Prioritise legibility, contrast, smooth transitions and comfortable touch targets.
- Use a consistent design system for spacing, typography, surfaces, buttons and game cards.
- Avoid visual overload, excessive glow and animations that interfere with gameplay.

## 9. Non-functional requirements
- iPhone-first responsive layouts and iOS safe-area support.
- Good performance on supported recent iPhones.
- Graceful loading, error, empty and weak-network states.
- Accessibility labels and adequate contrast.
- Private-by-default data handling.
- Maintainable TypeScript code with automated checks.

## 10. Out of scope for the first prototype
- Public profiles, social feeds or discovery.
- More than two members in a shared space.
- Payments, subscriptions or advertising.
- AI-generated interpretations of private relationship content.
- Complex real-time multiplayer gameplay.
- Automatic generation of Find the Differences content from arbitrary photographs.

## 11. Success criteria for the first prototype
A user can launch the app, see a polished Our Universe home screen, switch between English and Simplified Chinese, and navigate to a working photo-memory game populated by clearly labelled local sample data. The prototype must not require real personal photos, production credentials or a configured backend.
