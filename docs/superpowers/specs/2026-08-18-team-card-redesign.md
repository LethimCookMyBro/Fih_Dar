# Team Card Redesign — Design Spec (2026-08-18)

Status: approved by the autonomous master-pass brief (user offline; design target fully specified in
the master pass, Phase 2). This doc records the decisions that brief mandates.

## Problem

The `/about` team cards are built from a vendored React Bits holo-tilt demo
(`src/components/reactbits/profile-card.tsx`). Measured evidence (idle, no interaction, 1440×900,
3s window):

- **2378 `requestAnimationFrame` callbacks in 3s of idle** (~793/s) — the tilt engine's
  `if (stillFar || document.hasFocus())` never stops while the tab has focus, so all 4 cards run
  perpetual RAF loops writing ~7 CSS custom properties per frame.
- **4 × `pc-holo-bg` infinite 18s CSS animations** (`mixBlendMode: color-dodge`) — always
  animating, compositing-heavy.
- `filter: blur(50px)` behind-glow layer, luminosity blend layers, 3D tilt + glare — the
  "trading card / holographic foil" aesthetic.

The user reports the cards look visually strange and the site feels laggy. Both are grounded.

## Design target (from the master-pass brief)

Serious, professional, modern, geospatial-intelligence, environmental-surveillance feel with a
subtle radar influence. Clean typography, generous spacing, restrained Keppel accents, restrained
Eggplant accents. Subtle pointer spotlight, gentle border response, slight hover lift. Premium but
not flashy.

Explicitly avoided: Pokémon/trading-card look, rainbow holographic foil, huge glare, giant blur
blobs, permanent color-dodge, unnecessary 3D depth, heavy cursor-follow math, gyroscope on mobile,
touch-action traps, perpetual JS animation while idle.

## Performance requirements

- **IDLE:** zero perpetual rAF loops; zero infinite CSS animations.
- **POINTER:** position tracking only while the pointer is actually moving over a card; coalesced
  to at most one CSS-variable write per frame.
- **POINTER LEAVE:** overlay fades via CSS transition; no JS continues.
- **MOBILE:** normal scrolling; no gyroscope; no touch interception.
- **ACCESSIBILITY:** `prefers-reduced-motion` respected (no spotlight, no lift, no transitions);
  keyboard/focus unaffected (cards are static info, nothing to tab to); text uses theme tokens so
  contrast stays AA.

## Approach

Replace the vendored demo component with a native, CSS-first FihDar team card at the same module
path (`src/components/reactbits/profile-card.tsx`, now a FihDar-native card) so the existing import
in `about-team.tsx` and the e2e hooks keep working.

- **Card surface:** `bg-card` + `border-border`, `rounded-2xl`, small theme shadow, top accent bar
  (`bg-gradient-to-r from-primary to-brand` — restrained Keppel→Eggplant).
- **Radar motif:** the existing deterministic SVG initials avatar (already drawn with radar-ring
  circles in `about-team.tsx`) stays, in a ringed circular frame. No animated sweep.
- **Pointer spotlight:** a `radial-gradient` overlay positioned by `--spot-x/--spot-y` custom
  properties. JS writes the vars in the `pointermove` handler only, rAF-coalesced (at most one
  write/frame); overlay visibility toggled by pure CSS `group-hover:opacity-100` with a 300ms
  fade. `motion-reduce:` zeroes it.
- **Hover:** pure CSS `hover:-translate-y-1` lift + border tint + shadow; `transition` scoped to
  200ms `--ease-standard`; `motion-reduce:transition-none`.
- **Typography:** name `text-lg font-semibold`, role `text-sm text-muted-foreground` — theme
  tokens, AA contrast in both themes.
- **Props:** shrink the interface to what the page needs (`avatarUrl`, `name`, `title`,
  `className`). Dead demo props (`iconUrl`, `behindGlow*`, `innerGradient`, `cardHeight`,
  `enableTilt`, `enableMobileTilt`, `showUserInfo`, contact/handle/status) are removed; the single
  caller (`about-team.tsx`) is updated to match.
- **No new dependencies**; no rAF engine, no infinite keyframes, no blur(50px), no color-dodge.

## Testing

- Update `e2e/about.spec.ts`'s touch-action regression to target the new card root via a
  `data-profile-card` marker (the old `ancestor::div[contains(@style,"perspective")]` locator
  disappears with the 3D tilt); keep and strengthen the assertion (card root `touchAction !==
  'none'`, and the marker must exist — no vacuous passes).
- Keep the "scroll past team section reaches CTA" test.
- Add e2e assertions that no infinite animations run on the team cards (guard against regression
  of the perpetual-RAF / infinite-animation bug): check `getAnimations()` on the section for
  `playState: 'running'` with `animationName` matching the old holo keyframes, and that the card
  wrapper has no `requestAnimationFrame` continuation when idle (pragmatic: assert zero running
  infinite-duration animations; the RAF loop is covered by the animation check plus the new
  component having no rAF loop by construction).
- Manual/visual check at 1440×900, 768×1024, 390×844 (light + dark, reduced motion).
- `npm run typecheck`, `npm run lint`; build if architecture-sensitive (it is not — pure
  component swap).

## Out of scope

- Other About sections (`CapabilityTiltedCards`, `ProductCardSwap`, hero lanyard) and other
  reactbits demos (`dither`, `lanyard`) — Phase 7 whole-page audit territory.
- Team roster content (names/roles) — unchanged.
