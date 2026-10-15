---
description: Game module registration, shared shell, theme, and layout conventions
applyTo: "src/games/**"
---

# Game architecture

- A game is a module under `src/games/<id>/`, usually with `config.ts`, `GameScreen.tsx`, and an optional `GameConfig.tsx`.
- Define games using `GameDefinition` from `src/core/types.ts`. The optional operator config component property is `GameConfigComponent`.
- Register each definition in the `games` array in `src/games/index.ts`. Canonical game IDs and backend game types are uppercase; use `normalizeGameType()` from `src/core/gameTypeMap.ts` for aliases and external values.
- `src/core/shell/AppShell.tsx` owns game selection, orientation, and shell widgets. Do not add standalone game routes or duplicate shell-owned players, ranking, raffle, QR, or orientation behavior.
- Reuse shared layout tokens from `src/core/ui/gameScreenLayout.ts` and existing landscape/portrait examples. Use the matching three-column or two-column layout; do not force one layout on every game.
- In landscape, use shared left-column components where appropriate and render the provided `sidebarElement` rather than recreating shell widgets. In portrait, keep the game screen within the shell's available space and preserve the shared join/header behavior.
- Theme colors are supplied by `ThemeProvider` as CSS custom properties such as `var(--color-primary)` and `var(--color-accent)`. Prefer these over hardcoded game-specific colors.
- Use `GameScreenProps` and `GameConfigProps` from `src/core/types.ts`. Keep game-specific state and configuration in the module while routing API Gateway calls through the shared `api` singleton.
- Consult `docs/new-game-playbook.md` for the registration checklist and `docs/operator-game-ui.md` for layout and validation details.
