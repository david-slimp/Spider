# PRD – Spider Solitaire (Web)

**Doc owner:** David Slimp (rock808) <coder@David-Slimp.com>

**Status:** Draft → Review → Approved → Build → QA → Launch

**Version:** v 0.0.1 (Aug 20, 2025)

---

## 1) Vision & Goals

**Vision:** A modern, buttery‑smooth, web‑based Spider Solitaire with a beautiful peacock stained glass art theme, optimized for Chrome desktop browsers, and engineered for long‑term maintainability.

**Primary goals**

- Delight: 60 FPS animations, tactile drag, satisfying sounds, tasteful confetti on win, beautiful peacock stained glass theme.
- Mastery: Multiple difficulties (1/2/4‑suit), undo/redo, smart hints, timer & scoring.
- Reliability: Deterministic shuffles (shareable seeds), robust undo/redo, replay same seed, strict rules.
- Inclusivity: Full keyboard controls, screen reader labels, high‑contrast colors for better visibility, and large‑card modes.

**Non‑goals (v1)**

- Online multiplayer
- Cosmetic marketplace or cloud accounts
- Daily challenges calendar (can be v1.1+)
- Mobile responsiveness (desktop-optimized only)
- Game statistics tracking beyond current session

**Success metrics**

- Time‑to‑First‑Move < 2 seconds on mid‑range mobile
- Avg session length ≥ 7 minutes
- Win animation CSAT ≥ 4.5/5 in user tests
- No crash/soft‑lock defects in 50k sessions
- Lighthouse performance score > 90
- Accessibility score > 95 (WCAG 2.1 AA)
- First Contentful Paint < 1.5s
- Time to Interactive < 3s

### Browser & Environment Support

- **Primary Browser:** Chrome (latest stable version)
- **Offline Support:** Full offline play after initial load via PWA capabilities
- **Display:** Desktop only (minimum resolution 1280x720)
- **Input:** Mouse, keyboard,  supported
- **Storage:** 
  - Game state and settings saved to localStorage
  - Future support for high score tracking with the following data:
    - Game seed
    - Date/time completed
    - Game outcome (win/loss)
    - Number of moves
    - Time played
    - Difficulty level
- **RNG:** Deterministic random number generator using seed value
- **Seed Management:** Players can view and set custom game seeds

---

## 2) Player Experience

**Tone & style:** Elegant peacock stained glass art theme with vibrant colors. High-contrast color scheme for better visibility. Light and dark theme options with stained glass effects.

**Visual design**

- **Background:** Peacock-themed stained glass window design with subtle animation, featuring intricate peacock feather patterns in rich blues and greens.
- **Cards:** 
  - SVG-based stained glass style card faces with peacock feather motifs
  - Large, high-contrast indices and suit symbols for readability
  - Slight 3D lift effect on hover/drag
  - Subtle stained glass refraction effect when cards are moved
- **Piles:** 
  - Stained glass panel design with peacock feather borders
  - Foundations feature animated peacock eye feather patterns that illuminate when a K→A suit is completed
  - Subtle glow effects on valid drop targets
- **Win Animation:** 
  - Peacock feather fanfare with animated spreading feathers
  - Stained glass shatter effect with particle system
  - Celebratory chord progression with visual feedback
  - Time/score panel reveal with peacock motif

**Audio**

- **Sound Effects:**
  - Card pick up: Subtle rustle sound
  - Card drop: Satisfying thump with pitch variation based on drop height
  - Deal: Distinct tick for each card dealt
  - Complete sequence: Ascending chime for each card in sequence (K→A)
  - Win: Celebratory chord progression (C major 7th arpeggio)
  - Invalid move: Short, soft "nope" sound
  - Button hover/click: Subtle blip sounds

- **Audio Implementation:**
  - Web Audio API for precise timing and low-latency playback
  - Single AudioContext initialized on first user interaction
  - Sound pooling for frequently played effects to prevent clipping
  - Volume normalization across all sound effects
  - Mute toggle with persistence in localStorage
  - Respects browser autoplay policies
  - Graceful degradation if Web Audio API isn't available

**UX pillars**

- Snappy drag (pointer events), magnetic snapping, generous hit‑targets.
- Clear rule feedback: illegal move shakes stack 8px and plays a soft "nope".
- Hints are helpful, not bossy: show up to 3 options in ranked order.

---

## 3) Game Rules (Authoritative)

**Deck:** Two standard 52‑card decks (104 total). Difficulty sets suit variety:

- 1‑suit: all Spades (x8 copies of A–K).
- 2‑suit: Spades + Hearts (balanced distribution across 104 cards).
- 4‑suit: full four suits.

**Initial deal (tableau):** 10 columns (left→right). First 4 columns receive 6 cards each; remaining 6 columns receive 5 cards each. Only the top card of each column is face‑up. All others are face‑down. Remaining 50 cards go to Stock (face‑down).

**Tableau building:** Place any card/sequence onto a card exactly one rank higher (descending order), **regardless of suit**. Example: 7♦ can be placed on 8♣.

**Moving sequences:** You may drag a **maximal same‑suit, descending sequence** as a unit (e.g., 9♠‑8♠‑7♠). If a column’s top is a mixed‑suit run, only the **largest same‑suit suffix** that maintains perfect sequence may move. (Engine must compute movable tail.)

**Empty columns:** Any single card or legal sequence may be moved to an empty column.

**Flips:** When a face‑down card becomes exposed (top of a column), it flips face‑up automatically.

**Complete suit removal:** A K→A sequence **in a single suit** auto‑moves to Foundations, removing it from play (eight total sequences to win).

**Dealing from Stock:** 5 deals remain (50 cards ÷ 10 columns). **Rule:** You may deal a new row only when **no column is empty**. Dealing places 1 face‑up card on each column.

**Win condition:** All 8 same‑suit K→A sequences are completed and removed.

**Standard scoring (configurable):**

- Start 500 points.
- Each move: −1.
- Completing a same‑suit K→A: +100.
- Time bonus: + (max 100 scaled by speed). (Optional setting.)

**Timer:** Counts up; pause when tab hidden.

---

## 4) Feature Set (v1)

- 1/2/4‑suit modes with on‑boarding explainer.
- **Deterministic Gameplay:**
  - Each game uses a seed value that determines the entire game state
  - Current seed is always visible in the game UI
  - Players can set a custom seed before starting a new game
  - Game URL includes seed and difficulty parameters (e.g., `?seed=peacock123&difficulty=4-suit`)
- Unlimited undo/redo (including across deals & suit‑completions).
- Smart hint system (ranked; see §10).
- **Auto‑complete when only trivial moves remain (optional).**
- **Automatic Foundation Completion:** When a complete K→A sequence in a single suit is detected in the tableau, it will automatically move to the foundation. This will be tested to ensure reliable detection and movement of complete sequences.
- Quick‑restart (same seed), New game (new seed), and "Replay last game".
- Persisted settings: theme, sounds, difficulty, left‑hand layout, large cards.
- Local stats: wins, best time/score by difficulty, streaks.

---

## 5) Accessibility & Inclusivity

- **Keyboard‑only play**
  - Focus cycle piles with ←/→; within a pile use ↑/↓ to select the movable tail.
  - Enter = pick up / drop; Space = hint; D = deal; U/R = undo/redo.

- **Screen reader** (ARIA):
  - Piles: `role=listbox`, cards as `role=option` with labels e.g., "9 of Spades, face‑up, position 3 of 7".
  - Live region announces flips, illegal moves, suit completions, and deal availability.

- **Color & size**
  - High‑contrast theme (WCAG AA+). Large‑card mode +20% dimensions.

- **Motion**
  - Respects `prefers-reduced-motion` (reduces durations, disables parallax/confetti).

---

## 6) Technical Architecture

**Technical Stack**

- **Core:** Vanilla JavaScript (ES6+) with TypeScript for type safety
- **Rendering:** HTML5 Canvas for all game visuals with SVG assets for cards and UI elements
- **Audio:** Web Audio API for high-performance, low-latency sound effects
- **State Management:** Custom state management system optimized for game state and undo/redo functionality
- **RNG Implementation:**
  - Deterministic PRNG (mulberry32 with seed hashing)
  - Game state completely determined by the seed value
  - Same seed + same moves = identical game state
  - Support for sharing seeds via URL parameters

**Rendering Approach:**

- Single Canvas element for all rendering
- SVG-based card designs with peacock feather motifs and stained glass effects
- Optimized drawing operations for 60 FPS performance
- Custom rendering pipeline for card animations and transitions
- Support for high-DPI displays with proper scaling
- GPU-accelerated transforms and compositing
- SVG sprite sheets for efficient rendering of card faces and UI elements
- Dynamic generation of stained glass refraction effects
- Peacock feather animations for special events and wins

**Audio Implementation:**

- Web Audio API for high-quality sound effects
- Sound categories:
  - Card movements (pick up, drop, slide)
  - Game actions (deal, complete sequence, win)
  - UI feedback (button clicks, invalid moves)
- Audio features:
  - Spatial audio for card movements
  - Volume controls with persistence
  - Mute toggle
  - Efficient resource management (audio context starts on first interaction)

**Performance targets**

- 60 FPS on mid‑range mobile (e.g., 4‑year‑old Android).
- ≤ 80ms worst‑case for _computeMovableTail_ on a fully stacked column.
- First load ≤ 200KB gzipped app code; defer analytics.

**Directory Layout**

```
/spider
  /src
    /core          # Core game logic (game state, rules, RNG)
    /render        # Canvas rendering system
    /audio         # Audio management and effects
    /ui            # Canvas-based UI components
    /assets        # Sound effects, sprites, and other resources
    /utils         # Utility functions and helpers
  index.html       # Main HTML entry point
  game.js          # Bundled game file
  styles.css       # Minimal CSS for layout and theming
  service-worker.js # For PWA capabilities
```

**Development Environment**

- **Code Quality:**
  - ESLint with TypeScript and strict rules
  - Prettier for consistent code formatting
  - Pre-commit hooks for automated linting and formatting
  - EditorConfig for consistent editor settings

- **Development Server:**
  - Vite dev server on port 8000
  - Hot module replacement (HMR) for development
  - Source maps for debugging

- **Build & Testing:**
  - Vite for production builds
  - Vitest for unit tests
  - Playwright for E2E testing
  - Lighthouse CI for performance metrics

- **Scripts:**
  - `npm run dev`: Start dev server on port 8000
  - `npm run build`: Production build
  - `npm run test`: Run unit tests
  - `npm run test:e2e`: Run E2E tests
  - `npm run lint`: Run ESLint
  - `npm run format`: Format code with Prettier

- **Deployment:**
  - Static file hosting (Netlify/Vercel/GitHub Pages)
  - Service worker for offline capabilities
  - Versioned asset caching
  - CI/CD pipeline with automated tests and deployment
  - Error tracking (e.g., Sentry)
  - Performance monitoring

---

## 11) Open Questions & Risks

- Performance impact of complex SVG animations on lower-end devices
- Browser compatibility for Web Audio API features
- Handling of very large game states in localStorage
- Testing strategy for deterministic RNG across different environments

## 12) Future Enhancements (v1.1+)

### High Score System (v1.2+)
- **Data Collection:**
  - Track all game sessions with seed, outcome, moves, and time
  - Store high scores using localStorage for simplicity and broad compatibility
  - Support for filtering and sorting by different metrics

### Other Planned Features
- Mobile responsiveness
- Daily challenges
- Game statistics and history
- Cloud sync across devices
- Additional themes and card designs
- Sound effect customization

---

## 7) Data Model (Engine – UI agnostic)

```ts
// Enums
export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13; // A=1, J=11, Q=12, K=13
export type Difficulty = "1-suit" | "2-suit" | "4-suit";

export interface GameResult {
  seed: string;
  timestamp: number; // Date.getTime()
  outcome: 'win' | 'loss' | 'incomplete';
  moves: number;
  timePlayed: number; // in milliseconds
  difficulty: Difficulty;
  // Future fields for v1.2+
  // score?: number;
  // playerName?: string;
  // version: string; // game version for future compatibility
}

export interface GameStats {
  // Current session stats
  currentGame: {
    startTime: number;
    moveCount: number;
    seed: string;
    difficulty: Difficulty;
  };
  
  // Future high scores (v1.2+)
  // highScores: GameResult[];
}

export interface Card {
  id: number; // 0..103 unique
  suit: Suit; // distribution depends on difficulty
  rank: Rank; // 1..13
  faceUp: boolean;
}

export type Column = Card[]; // top is last element
export type Tableau = [
  Column,
  Column,
  Column,
  Column,
  Column,
  Column,
  Column,
  Column,
  Column,
  Column,
];

export interface Foundations {
  completed: number; // 0..8 (each is K→A same-suit)
}

export interface Stock {
  cards: Card[]; // face-down; length 0..50
  dealsRemaining: number; // 0..5
}

export interface GameState {
  tableau: Tableau;
  stock: Stock;
  foundations: Foundations;
  difficulty: Difficulty;
  seed: string; // The current game seed (can be custom or auto-generated)
  isCustomSeed: boolean; // Whether the current seed was user-specified
  moves: number;
  timeMs: number;
  history: HistoryEntry[]; // for undo/redo
  redoStack: HistoryEntry[];
  status: "playing" | "won" | "stuck";
}

export type HistoryEntry =
  | {
      t: "move";
      from: number;
      to: number;
      moved: Card[];
      turned?: Card /* flipped card if any */;
    }
  | { t: "deal"; dealt: Card[] }
  | { t: "complete"; suit: Suit; cards: Card[] };
```

---

## 8) Core Algorithms (Authoritative Specs)

**8.1 Deterministic Shuffle**

- Use a fast PRNG (xoshiro128\*\* or mulberry32). Seed input: `${difficulty}:${seed}` → 32‑bit.
- Shuffle via Fisher‑Yates.
- For 1/2‑suit modes, expand a base suit list appropriately (see §3) before shuffle.

**8.2 Initial Deal**

- Deal left→right, one card per pass, until columns reach required counts (6 for first 4, 5 for others). Mark only last dealt card in each column as `faceUp=true`.
- Remaining 50 cards push to `stock.cards` with `dealsRemaining=5`.

**8.3 Movable Tail Computation**

- Given a column `C`, find largest suffix `T = [c_i..c_n]` such that for all `k` in `[i..n-1]`: `rank(c_k) = rank(c_{k+1}) + 1` **and** `suit(c_k) == suit(c_{k+1})` **and** all cards are `faceUp`.
- Return `T` (possibly length 1). Mixed‑suit breaks the chain.

**8.4 Legality Check for Drop**

- Dropping `T` on empty column → **legal**.
- Else let `d` be top card of destination. Legal iff `rank(head(T)) + 1 == rank(d)` (suit agnostic).

**8.5 Execute Move**

- Pop `T` from source, push to destination preserving order.
- If the source’s new top is face‑down, flip it (record in history).
- Increment `moves`.
- After move, attempt `CompleteSuit` (8.6).

**8.6 CompleteSuit**

- In the destination column, scan top→down for a maximal **same‑suit** K→A chain at the top. If found, remove 13 cards to Foundations and push history `{t:'complete'}`.
- Increment `foundations.completed`.
- If `foundations.completed === 8` → status = 'won'.

**8.7 Deal Row**

- Guard: All columns length > 0; `dealsRemaining > 0`.
- Pop 10 from stock; mark `faceUp=true`; push one onto each column left→right.
- Push history `{t:'deal'}`.

**8.8 Undo/Redo**

- Undo pops last `HistoryEntry` and reverses it:
  - `move`: move cards back; unflip `turned` if any.
  - `deal`: pop one from each column (reverse order), push back to stock (face‑up→face‑down).
  - `complete`: re‑insert the 13 cards to the top of their column (recorded in entry), decrement foundations.

- Redo re‑applies and pushes back to history.

**8.9 Stuck Detection** (optional helper)

- Evaluate if **no legal move** exists and `dealsRemaining === 0`.

---

## 9) UI Layer Contract (Engine <-> UI)

**Engine exports (pure & deterministic):**

- `newGame(difficulty, seed): GameState`
- `legalMoves(state): Move[]` (for hinting/debug)
- `move(state, fromCol, toCol, length): GameState` (immutable return)
- `deal(state): GameState`
- `undo(state): GameState`
- `redo(state): GameState`
- `serialize(state): string` / `deserialize(string): GameState` (for localStorage)

**UI responsibilities:**

- Drag gesture → infer `(fromCol, length, toCol)`; call `move`; animate transition.
- Show illegal move feedback if engine rejects.
- Reflect flips, suit completions, and win banner.

---

## 10) Hint Heuristic (Ranked)

Compute up to 3 moves and rank by:

1. **Reveal Priority:** Moves that immediately flip a face‑down card (+3).
2. **Suit Integrity:** Moves that extend or preserve long same‑suit tails (+2 per same‑suit link).
3. **Empty Column Value:** Moves that create an empty column (+2), or that use an empty column to relocate a king‑anchored run (+1).
4. **Deal Readiness:** Moves that fill an empty column (enabling a deal) (+1).
5. **Noise Penalty:** Moves that break long same‑suit sequences (−2).

Ties broken by shortest path to completion estimate (cheap look‑ahead depth 2).

---

## 11) UI Components (React)

```
<App>
  <TopBar/>            // New, Undo/Redo, Hint, Settings, Timer, Score
  <Table>
    <Stock/>           // Stock/Deal button with counter
    <Columns/>         // 10 Columns (virtualized lists)
    <Foundations/>     // 8 pips + glow on each completion
  </Table>
  <Toasts/>            // Live regions & inline notifications
  <WinModal/>          // Stats & replay/share
</App>
```

**Drag & drop**: Pointer Events (`onPointerDown/Move/Up`), capture pointer, compute z‑stack, transform following the pointer; snap on drop.

**Responsive layout**

- Desktop: 10 columns spread edge‑to‑edge; controls in top bar.
- Tablet: same; larger card gutter.
- Phone portrait: stacked controls; columns scroll vertically (rare) or fit via compact spacing.

---

## 12) Theming & Art

- **Light theme:** frosted glass cards, neutral felt table, soft shadows.
- **Dark theme:** deep charcoal table, luminous card edges.
- **Accent color** derives from difficulty: 1‑suit (indigo), 2‑suit (violet), 4‑suit (teal).
- **Animations:**
  - Deal: 120ms fan‑out with stagger.
  - Drag: scale 1.03 + lift shadow.
  - Illegal: 90ms shake.
  - Suit complete: 220ms vertical lift + trail + glow.
  - Win: 1.2s confetti.

---

## 13) Persistence

- `localStorage`
  - `spider.v1.settings` – theme, volume, difficulty, a11y prefs.
  - `spider.v1.lastGame` – serialized GameState + seed.
  - `spider.v1.stats` – per‑difficulty aggregates.

- **Auto‑save** on every action; throttle to 250ms.

---

## 14) Analytics (optional, v1.1)

- Event: `game_start`, `first_move`, `deal`, `undo`, `redo`, `hint`, `win`, `stuck`.
- Properties: difficulty, session length, moves, time, seed (hashed).

---

## 15) QA Plan & Test Cases

**Unit tests (engine)**

- Deterministic shuffle with known seed yields expected deal per difficulty.
- Cannot deal with empty column; can deal otherwise; correct decrement of `dealsRemaining`.
- Move legality: empty column, mixed‑suit stacks, same‑suit tails, rank adjacency.
- Flip logic when exposing face‑down.
- Suit completion detection (K→A same suit only); removal and history entry.
- Undo/redo for move/deal/complete.

**Property‑based tests**

- Fuzz random sequences of legal actions; invariants:
  - Card count always 104.
  - No duplicate `id`s; cards in exactly one place.
  - Face‑down cards never above face‑up in same column.

**E2E (Playwright)**

- Can start, make first legal move via mouse & keyboard.
- Hints available and actionable.
- Deal button disabled when empty column present; enabled otherwise.
- Win flow shows modal; replay uses same seed.
- Persisted settings survive reload.

**Performance tests**

- Drag 200ms latency budget (p95) under throttled CPU 4×.

---

## 16) Security & Privacy

- No PII; no network required for core play.
- Only localStorage; optional analytics is off by default and privacy‑reviewed.

---

## 17) Delivery Plan

**Milestones**

1. **Engine MVP (pure TS)** – shuffle, deal, moves, legal checks, undo/redo, complete.
2. **UI MVP** – render tableau, drag/drop, deal, basic animations.
3. **Polish pass** – sounds, themes, a11y, hints, stats.
4. **QA & hardening** – tests, perf, cross‑browser.
5. **Launch** – marketing page, versioned build.

**Tooling**

- Prettier, ESLint (airbnb/tsx), Husky + lint‑staged.
- GitHub Actions: typecheck, unit, e2e, bundle‑size.

---

## 18) Example Code Sketches (Illustrative)

```ts
// engine/shuffle.ts
export function prng(seed: number) {
  let s = seed >>> 0;
  return () => (
    (s = (s ^ (s << 13)) >>> 0),
    (s = (s ^ (s >>> 17)) >>> 0),
    (s = (s ^ (s << 5)) >>> 0),
    (s >>> 0) / 2 ** 32
  );
}

export function shuffle<T>(arr: T[], rnd = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
```

```ts
// engine/movableTail.ts
export function movableTail(col: Card[]): number {
  if (!col.length || !col[col.length - 1].faceUp) return 0;
  let len = 1;
  for (let i = col.length - 1; i > 0; i--) {
    const a = col[i],
      b = col[i - 1];
    if (!b.faceUp || a.rank + 1 !== b.rank || a.suit !== b.suit) break;
    len++;
  }
  return len; // how many cards from top are movable as a unit
}
```

```ts
// engine/canDrop.ts
export function canDrop(tailHead: Card, destTop?: Card): boolean {
  if (!destTop) return true; // empty column
  return tailHead.rank + 1 === destTop.rank;
}
```

---

## 19) Modern Look – Design Tokens

- Radius: 16px (cards), 12px (buttons)
- Shadows: `0 10px 30px rgba(0,0,0,.15)`
- Motion: 120–220ms ease (standard), 90ms ease (error)
- Typography: Inter (UI), Fraunces (numbers optional)
- Colors (example):
  - `--bg: linear-gradient(180deg,#0e1b2b,#14243a)`
  - `--card: #0f172a80` (glass w/ backdrop‑filter)
  - `--accent: #7c3aed` (diff. dependent)

---

## 20) Open Questions (track in issues)

- 2‑suit distribution: strict 50/50 or slight randomness with bounds?
- Auto‑complete threshold: when legal moves ≡ deterministic to win?
- Time bonus formula: linear vs. S‑curve.

---

## 21) Appendix – Keyboard Map

- `N` = new game, `S` = switch difficulty, `H` = hint
- `U`/`R` = undo/redo; `D` = deal; `M` = mute
- Arrows/Enter for selection & move

---

## 22) Appendix – Rules Differences Cheat‑Sheet

- **Spider vs. Klondike**: any card/sequence to empty column (not just Kings); build regardless of suit; complete only same‑suit K→A.

---

## 23) Launch Checklist

- [ ] All unit & E2E tests green on CI
- [ ] Perf budget verified on mobile
- [ ] A11y audit (Axe) passes critical checks
- [ ] Favicon & social preview
- [ ] Version tag `v1.0.0`
- [ ] Release notes and how‑to

---

**End of PRD**
