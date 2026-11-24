---
description: Game module registration, shared shell, theme, and layout conventions
applyTo: "src/games/**"
---

# Game architecture

- A game is a module under `src/games/<id>/`, with `config.ts`, `ParticipantPlay.tsx`, and an optional `GameConfig.tsx`.
- Define games using `GameDefinition` from `src/core/types.ts`. The optional operator config component property is `GameConfigComponent`; it must support `registerSave` (via `useGameConfigSaveRegistration`) so the shared "Configurar juego" footer button saves mode/access and rules together.
- Register each definition in the `games` array in `src/games/index.ts`. Canonical game IDs and backend game types are uppercase; use `normalizeGameType()` from `src/core/gameTypeMap.ts` for aliases and external values.
- `src/core/shell/AppShell.tsx` displays only the shared `HomeCanvas`, selecting the saved landscape or portrait composition. Do not mount game engines or add fixed columns on the stand.
- Connect gameplay in `src/core/participant/ParticipantShell.tsx` under `/play/:gameId`. Use participant-token actions in `src/api/publicApi.ts`, not operator-authenticated endpoints.
- Home layout belongs to `src/core/home/canvasModel.ts`, `HomeCanvas.tsx`, and `HomeCanvasEditor.tsx`. Keep layout revisions independent of forms and questionnaires. Reuse the renderer in previews; previews must not mount real gameplay.
- Theme colors are supplied by `ThemeProvider` as CSS custom properties such as `var(--color-primary)` and `var(--color-accent)`. Prefer these over hardcoded game-specific colors.
- Use `GameConfigProps` from `src/core/types.ts` for operator settings. Keep game-specific state in the module; operator requests use the shared `api` singleton, while participant requests use `publicApi`.
- Consult `docs/new-game-playbook.md` for the registration checklist and `docs/operator-game-ui.md` for layout and validation details.
