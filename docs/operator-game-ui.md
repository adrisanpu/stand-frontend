# Operator game UI (design guidelines)

Conventions for `GameScreen` layouts, spacing to the viewport, code validation, and validate actions. **Reference game: t1mer.**

## Catalog: detalle al elegir un juego (`GameGate`)

Tras pulsar un juego en el catálogo, el bloque informativo usa **dos columnas desde `md`**: columna 1 con el **logo grande centrado** (`max-h-44`–`max-h-60` según breakpoint); columna 2 en **columna flex** con la **descripción** arriba (`descriptionLong` o `description`) y **tags** abajo (separador `border-t`, `flex-wrap`). En móvil todo se apila en un orden: logo → texto → tags. Sin `assets.logo`, mostrar iniciales del nombre en un contenedor cuadrado como en la rejilla del catálogo.

## Screen edge → content (AppShell)

Do not reimplement outer page padding inside `GameScreen`; the shell already insets content.

| Mode | Where | Classes / behavior |
|------|--------|-------------------|
| Portrait | Main column | `px-4 sm:px-6` on the scroll column; vertical insets via `paddingTop` / `paddingBottom` in `dvh` (see `AppShell.tsx`). |
| Portrait | Header join (above card) | `GamePortraitHeaderJoin` in `AppShell.tsx` — logo left, QR + “Escanea para jugar” + game code right; instructions modal via `getJoinInstructions()`. |
| Portrait | Game card wrapper | `p-4 sm:p-5` on the `.card` that wraps `GameScreen` (game UI only; no logo/QR inside). |
| Landscape | Full-bleed stage | `py-[10dvh] pl-[3dvw] pr-[1.5dvw]` on the landscape container (tighter right gutter). |

Settings control is `fixed top-4 left-4` (not part of game panels).

## Landscape game grid (three columns)

Use the shared token so column weights and gutters match t1mer:

- Import `GAME_LANDSCAPE_THREE_COL_GRID` from [`src/core/ui/gameScreenLayout.ts`](../src/core/ui/gameScreenLayout.ts).
- Equivalent classes: `grid grid-cols-[25%_40%_25%] gap-4 items-stretch h-full min-h-0`.

Left: `GameLandscapeLeftColumn` — info panel (`GameLandscapeInfoColumn`: logo, QR, optional avatar, manual/legal footer) + `playersElement` below. Pass instructions as `children` for the modal. Center: main game. Right: `sidebarElement` only (Ranking `flex-1` if `showRanking`, RaffleData, GameStateAvatar fallback) — **no Players**.

`AppShell` passes `playersElement` and `sidebarElement` separately. Infocards (two-col): `playersElement` stays on the right sidebar above `sidebarElement`.

## Landscape center panel (main column)

- Import `GAME_LANDSCAPE_CENTER_CARD` from the same module.
- Equivalent: `card flex flex-col p-6 sm:p-8 overflow-hidden min-h-0 min-w-0 space-y-6`.
- Append game-specific utilities when needed (e.g. `items-center`, `justify-center`).
- **l3tras** uses vertical `gap-6` between sections: combine as  
  `` `${GAME_LANDSCAPE_CENTER_CARD} flex-1 gap-6 space-y-0` ``.

Do not use the older `minmax(0,0.85fr)_minmax(0,1.5fr)_minmax(180px,260px)` + `gap-3 sm:gap-4 lg:gap-6` pattern for new work.

## Landscape two columns (e.g. infocards)

- `GAME_LANDSCAPE_TWO_COL_GRID`: `grid-cols-[minmax(0,1fr)_minmax(180px,260px)] gap-4` (same gutter as three-col).
- Main area: prefer `p-6 sm:p-8` on the outer `card` for parity with the center column of other games.
- Right sidebar: `playersElement` on top, then `sidebarElement` (ranking, raffle, avatar) — no left info column.

## Portrait: header join + game card

Portrait join UI lives in **AppShell**, not inside each `GameScreen`:

- [`GamePortraitHeaderJoin`](../src/core/widgets/GamePortraitHeaderJoin.tsx) — row: logo (`max-h-20`–`max-h-24`) | QR (~128px) + “Escanea para jugar” + [`GameIdHint`](../src/core/widgets/GameJoinHints.tsx).
- Layout token: `GAME_PORTRAIT_HEADER_JOIN` in [`gameScreenLayout.ts`](../src/core/ui/gameScreenLayout.ts).
- Instructions: [`getJoinInstructions(gameId)`](../src/core/ui/gameJoinInstructions.tsx) passed as `footerChildren` (same modal/footer as landscape via `GamePanelFooter`).
- **Avatar:** disabled in portrait for now (landscape only).
- Inside `.card`, `GameScreen` renders **only** game interaction/animations — mirror landscape center column (`GAME_LANDSCAPE_CENTER_CARD` utilities where applicable). Do **not** import `GamePortraitJoinPanel` in new work (`GamePortraitJoinPanel` is deprecated).

## Join panel footer, instructions modal, and legal notice

Shared widgets:

| Widget | Path | Role |
|--------|------|------|
| `GamePanelFooter` | `src/core/widgets/GamePanelFooter.tsx` | Manual icon + one-line data notice + opens modal |
| `GameInstructionsModal` | `src/core/widgets/GameInstructionsModal.tsx` | Scrollable instructions + expanded legal text |
| `gameLegalCopy` | `src/core/ui/gameLegalCopy.ts` | `PRIVACY_POLICY_URL`, `GAME_DATA_NOTICE_PANEL`, `GAME_DATA_NOTICE_MODAL` |

Privacy policy (Spanish UI): `/pages/privacy-es.html`. English: `/pages/privacy.html`.

## Internal spacers

- Pair code inputs: prefer `grid grid-cols-2 gap-4` (not `gap-5`).
- Keep inner `space-y-*` / list spacing consistent with the reference game unless the layout truly needs more air.

---

## Code validation (copy & controls)

Colors always come from each game’s theme.

### Shared copy

Import from [`src/core/ui/gameValidationCopy.ts`](../src/core/ui/gameValidationCopy.ts):

| Export | Use |
|--------|-----|
| `CODE_INPUT_PLACEHOLDER` | Every validation code `<input>`. Literal: `introduce código`. |
| `VALIDATE_LABEL` | All validate submit buttons. Literal: `Validar`. |

### Input styling

Typical: `rounded-xl`, `bg-[rgba(255,255,255,0.05)]`, `border border-white/10`, centered mono for PIN-style codes, `focus:border-white/20` (or game-tinted focus). Use `min-w-0` in flex rows. If labels are not visible, set `aria-label` on the input.

### Validate button — full width (below inputs)

`type="button"`, `w-full`, `rounded-xl`, `p-4`/`p-5`, `font-semibold`, `transition-colors`, `disabled:opacity-50 disabled:cursor-not-allowed`, inner `flex items-center justify-center gap-3`, check-circle SVG, game-tinted background/border. Loading: spinner + `Validando…`.

### Validate button — inline (beside input)

`h-14`, `rounded-xl`, `font-semibold`, `shrink-0`, `inline-flex items-center justify-center gap-2`, `px-8` (typical), same disabled pattern, `VALIDATE_LABEL` / spinner + `Validando…`.

### Pair games with fixed avatar slots (empareja2)

Two fixed-size cells above the code inputs; on success, same cells show `characterImageUrl` and optional `@handle`.

### Files that often change

- `src/games/<gameId>/GameScreen.tsx`
- `src/core/ui/gameScreenLayout.ts`, `gameValidationCopy.ts`, `gameLegalCopy.ts`
- `src/core/widgets/GameLandscapeLeftColumn.tsx`, `GameLandscapeInfoColumn.tsx`, `GamePortraitHeaderJoin.tsx`, `GameJoinHints.tsx`, `GamePanelFooter.tsx`
- `src/core/ui/gameJoinInstructions.tsx`
- `src/core/shell/AppShell.tsx` (only if global insets change)
