# New Game Playbook (Frontend + Backend Handoff)

Use this playbook when adding a new game to Stand. It is optimized for:

- Maximum reuse of existing modules and UI patterns
- Minimal, lean implementation (no new abstractions unless required)
- Consistent style, layout, naming, and platform behavior

This document complements:

- `stand-frontend/CLAUDE.md`
- `stand-frontend/docs/operator-game-ui.md`
- `stand-backend/README.md`
- `stand-backend/CLAUDE.md`

## 1) Canonical naming contract (must follow)

- Frontend game `id` is lowercase (`mygame1`)
- Backend game `type` is uppercase (`MYGAME1`)
- Keep both values aligned semantically and map correctly in frontend

Never mix these conventions. Most cross-repo bugs come from mismatched `id/type`.

## 2) Decide first: clone vs build

Before writing code, pick the closest existing game and copy its structure:

- Similar validation flow: start from `empareja2` or `cupido`
- Similar timer/interaction flow: start from `t1mer`
- Similar content cards/list flow: start from `infocards`

If you cannot name an existing game to copy from, stop and review current game folders first.

## 3) Frontend mandatory checklist

## 3.1 Create game module

Create `src/games/<id>/` with:

- `index.ts` exporting `GameDefinition`
- `GameScreen.tsx` for runtime gameplay UI
- `GameConfig.tsx` for operator configuration

Use existing games as source templates instead of creating brand-new patterns.

## 3.2 Register game definition

- Add the new definition to `src/games/index.ts`
- Ensure `id`, `type`, colors, and components are exported correctly
- Confirm routing continues to flow through `AppShell` (no standalone route)

## 3.3 Add type-to-id normalization

- Update `src/core/gameTypeMap.ts` so backend `GAME_TYPE` resolves to your frontend `id`
- Validate restore flow from `localStorage` in `AppShell`

## 3.4 Follow shared UI/layout tokens

- Reuse layout constants from `src/core/ui/gameScreenLayout.ts`
- Reuse validation copy from `src/core/ui/gameValidationCopy.ts`
- Keep orientation handling in `AppShell` (do not create custom rotation logic)
- Keep game colors via CSS variables (`--game-primary`, `--game-accent`)

For detailed spacing/grid rules, follow `docs/operator-game-ui.md`.

### 3.4.1 Mandatory GameScreen layout skeleton (do not improvise)

Every new `GameScreen` must reuse the same structural layout as existing games:

- Landscape must be **3 columns**:
  - Left: `GameLandscapeInfoColumn` with logo + instructions + QR/context.
  - Center: main game panel using `GAME_LANDSCAPE_CENTER_CARD`.
  - Right: `sidebarElement` passed by `AppShell` (players, raffle, avatar, ranking when applicable).
- Landscape grid must use `GAME_LANDSCAPE_THREE_COL_GRID` from `src/core/ui/gameScreenLayout.ts`.
- Portrait must include the QR + instructions block using `GAME_PORTRAIT_QR_INSTRUCTIONS_GRID`.
- Do not create custom grids when shared tokens/components already exist.
- Do not render shell widgets manually inside game center content; keep them in `sidebarElement`.

## 3.5 Keep integration lean

- Use the shared `api` singleton from `src/api/api.ts`
- Do not use direct `fetch`/`axios`
- Keep auth handling unchanged (`idToken` from `sessionStorage`)
- Reuse feature gates through `getFeaturesByPlan(plan)` if the game has gated features

## 4) Backend handoff checklist (to implement in stand-backend)

When frontend work starts, define backend scope explicitly:

- Confirm canonical backend `GAME_TYPE` (uppercase)
- Store type-specific config under `type.<GAME_TYPE>` (not new top-level columns)
- Reuse `get_game_type_blob` and `set_game_type_blob`
- Reuse standard handler/util patterns (`_get_claims`, `_read_json_body`, `_resp`, `_json_sanitize`)
- Add or reuse routes in `template.yaml` with existing IAM role patterns

Reference backend section: `stand-backend/README.md` ("Adding a new backend game").

## 5) Minimal templates

These are intentionally small. Copy from an existing game and only adjust what is required.

### 5.1 `src/games/<id>/index.ts`

```ts
import type { GameDefinition } from '../../core/types';
import { GameScreen } from './GameScreen';
import { GameConfig } from './GameConfig';

export const mygame1: GameDefinition = {
  id: 'mygame1',
  name: 'MyGame1',
  type: 'MYGAME1',
  colors: {
    primary: '#6366F1',
    accent: '#A78BFA',
  },
  GameScreen,
  GameConfig,
};
```

### 5.2 `src/games/<id>/GameScreen.tsx`

```tsx
import type { GameScreenProps } from '../../core/types';

export function GameScreen({ gameId, gameName }: GameScreenProps) {
  return (
    <section className="card p-6">
      <h2 className="text-xl font-semibold">{gameName}</h2>
      <p className="text-sm opacity-80">Game ID: {gameId}</p>
    </section>
  );
}
```

### 5.3 `src/games/<id>/GameConfig.tsx`

```tsx
import type { GameConfigProps } from '../../core/types';

export function GameConfig({ config, onChange }: GameConfigProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">Game settings</h3>
      <button
        type="button"
        className="rounded-xl border border-white/10 px-4 py-2"
        onClick={() => onChange({ ...config })}
      >
        Save
      </button>
    </section>
  );
}
```

## 6) QA checklist (minimum)

- Naming and mapping:
  - `id` lowercase, `type` uppercase, `gameTypeMap` updated
- Visual consistency:
  - Portrait and landscape both render correctly
  - Shared spacing/grid tokens are used
  - Validation copy/buttons follow shared conventions
- Data/API:
  - Uses shared `api` singleton and expected backend endpoints
  - Handles loading/error states without breaking shell layout
- Plan/feature behavior:
  - Feature-gated actions follow plan limits

## 7) Common mistakes to avoid

- Creating custom layout grids when shared tokens already exist
- Hardcoding colors in components instead of CSS vars
- Adding new backend top-level attributes instead of `type.<GAME_TYPE>`
- Using direct HTTP client code outside `api.ts`
- Creating generic abstractions before the second real use-case

## 8) Definition of done (lean)

A new game is considered complete when:

- It follows existing module shape and naming conventions
- It reuses shell/layout/validation patterns
- It integrates through existing API and storage conventions
- It has only necessary code for current scope (no speculative architecture)
