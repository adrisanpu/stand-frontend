# New Game Playbook (Frontend + Backend Handoff)

Use this playbook when adding a new game to Stand. It is optimized for:

- Maximum reuse of existing modules and UI patterns
- Minimal, lean implementation (no new abstractions unless required)
- Consistent style, layout, naming, and platform behavior

This document complements:

- [stand-backend/docs/DEVELOPMENT_WORKFLOW.md](https://github.com/adrisanpu/stand-backend/blob/dev/docs/DEVELOPMENT_WORKFLOW.md) — branches, CI/CD, agents
- `stand-frontend/CLAUDE.md`
- `stand-frontend/docs/operator-game-ui.md`
- `stand-backend/README.md`
- `stand-backend/CLAUDE.md`

## 1) Canonical naming contract (must follow)

- Frontend game `id` and `name` are UPPERCASE (`T1MER`); module folder stays lowercase (`src/games/t1mer/`)
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

- `config.ts` exporting `GameDefinition`
- `ParticipantPlay.tsx` for mobile gameplay UI
- `GameConfig.tsx` for operator configuration

Use existing games as source templates instead of creating brand-new patterns.

## 3.2 Register game definition

- Add the new definition to `src/games/index.ts`
- Ensure `id`, `type`, colors, and components are exported correctly
- Connect gameplay through `ParticipantShell` at `/play/:gameId`, not `AppShell`
- Add a safe, non-interactive sample to `GamePlayPreview.tsx`

## 3.3 Add type-to-id normalization

- Update `src/core/gameTypeMap.ts` so backend `GAME_TYPE` and legacy aliases resolve to your uppercase `id`
- Validate restore flow from `localStorage` in `AppShell`

## 3.4 Follow shared UI/layout tokens

- Reuse participant validation and localization patterns from existing mobile experiences
- Keep Home orientation handling in `AppShell` and the shared canvas
- Keep game colors via CSS variables (`--color-primary`, `--color-accent`)

For detailed spacing/grid rules, follow `docs/operator-game-ui.md`.

### 3.4.1 Home is a canvas, not a game screen

- `HomeCanvas` renders saved landscape/portrait compositions for every game.
- Do not register game engines, fixed columns, or injected sidebars on the stand.
- Keep QR, logo, players, ranking, raffle, and text inside editable, non-overlapping boxes.
- New games start with empty compositions; absent legacy configuration receives a shared initial composition.
- Canvas persistence and revision are independent of questionnaire/form revisions.

## 3.5 Keep integration lean

- Operator settings use the shared `api` singleton from `src/api/api.ts`
- Mobile gameplay uses `src/api/publicApi.ts` and participant tokens, not operator endpoints
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
import { GameConfig } from './GameConfig';

export const mygame1: GameDefinition = {
  id: 'MYGAME1',
  name: 'MYGAME1',
  colors: {
    primary: '#6366F1',
    accent: '#A78BFA',
    background: '#0B0A12',
    surface: 'rgba(255,255,255,0.04)',
    textMain: '#EAEAF2',
    textSub: '#9AA0A6',
  },
  GameConfigComponent: GameConfig,
};
```

### 5.2 `src/games/<id>/ParticipantPlay.tsx`

Copy the closest existing participant experience and connect it in `ParticipantShell`.
Obtain assignment/configuration through authenticated participant contracts. Keep
time, scoring, rewards, and private-answer evaluation authoritative on the server.
Handle reload/resume, retry, duplicate submission, and inactive events explicitly.
Do not expose another participant's private answers in the assignment.

### 5.3 `src/games/<id>/GameConfig.tsx`

The shared **Configurar juego** modal owns the only save button (**Guardar y aplicar cambios**). Config components
must register their save handler via `registerSave` (use `useGameConfigSaveRegistration`) and hide their own save
button when embedded. `validate` runs before anything is persisted; `save` must reject on failure and call
`onChange` only after persisting. `access` is the current (unsaved) mode/access draft.

```tsx
import type { GameConfigProps } from '../../core/types';
import { useGameConfigSaveRegistration } from '../../core/settings/gameConfigSave';

export function GameConfig({ gameId, settings, onChange, registerSave }: GameConfigProps) {
  const [value, setValue] = useState(settings?.value ?? '');
  const persist = async () => {
    await api.put('/v1/game', { gameId, settings: { mygame: { value } } });
    onChange({ value });
  };
  const embedded = useGameConfigSaveRegistration(registerSave, {
    validate: () => (value ? null : 'El valor es obligatorio'),
    save: persist,
  });
  return (
    <section className="space-y-4">
      <input value={value} onChange={(e) => setValue(e.target.value)} />
      {!embedded && <button type="button" onClick={() => void persist()}>Guardar configuración</button>}
    </section>
  );
}
```

## 6) QA checklist (minimum)

- Naming and mapping:
  - `id` and `name` UPPERCASE (same string), module folder lowercase, `gameTypeMap` updated
- Visual consistency:
  - Portrait and landscape both render correctly
  - Home uses the shared canvas renderer; mobile uses responsive participant UI
  - Validation copy/buttons follow shared conventions
- Data/API:
  - Uses shared `api` singleton and expected backend endpoints
  - Handles loading/error states without breaking shell layout
- Plan/feature behavior:
  - Feature-gated actions follow plan limits

## 7) Common mistakes to avoid

- Reintroducing stand-screen gameplay or a second Home layout system
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

## BASKET integration notes

BASKET is a mobile, single-attempt game with a server-issued 30-second start
snapshot. Keep its replay evidence and fixed physics in `src/games/basket/`;
the participant sends only timestamped, quantized launch vectors through the
shared `/v1/public/score` start/finish actions. The client must persist the
attempt ID and each accepted shot before continuing, resume only the same
attempt, and use the server snapshot and monotonic elapsed time rather than
pausing or issuing a replacement attempt after reload.

BASKET reuses the historical `/v1/game/stack/prizes` endpoint and the existing
`stackPrizeState`, `stackPrizeRules`, and `stackPrizes` response fields. Those
legacy names are shared for compatibility; BASKET scores and attempts remain
under its own canonical game type. Its reward editor permits Stand inventory
only, with `score`, `top_finish`, and `top_final` conditions. Do not expose
Kivly or editable physics/duration settings for BASKET.
