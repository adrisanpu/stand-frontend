# Operator game UI (design guidelines)

Conventions for `GameScreen` layouts, spacing to the viewport, code validation, and validate actions. **Reference game: t1mer.**

## RULET4: 3D prize wheel

Both orientations use the same Three.js vertical prize wheel, with a shallow
viewing angle, a metal rim, raised hub and animated pointer. Configured panel
colors, labels, counts and segment order remain unchanged. A normal spin takes
three seconds, decelerating into the selected segment. With reduced motion,
the wheel stays still until the final orientation is revealed.

WebGL 2 is required; there is no 2D fallback. Loading, context loss and rendering
errors disable new spins and display a visible status or retry action. Context
loss and page visibility changes suspend an active animation without choosing
another prize. Retrying the scene preserves the selected prize in the current
screen; it does not persist an unfinished spin across a page reload.
The result is announced and sent through the existing score endpoint only after
the final frame renders, once per spin. Returning to code entry cancels pending
animation callbacks. Verify legibility and GPU performance on the event device,
especially for many segments or long prize names.

## Catalog: detalle al elegir un juego (`GameGate`)

Tras pulsar un juego en el catálogo, el bloque informativo usa **dos columnas desde `md`**: columna 1 con el **logo grande centrado** (`max-h-44`–`max-h-60` según breakpoint); columna 2 en **columna flex** con la **descripción** arriba (`descriptionLong` o `description`) y **tags** abajo (separador `border-t`, `flex-wrap`). En móvil todo se apila en un orden: logo → texto → tags. Sin `assets.logo`, mostrar iniciales del nombre en un contenedor cuadrado como en la rejilla del catálogo.

## Configurar juego

### Kivly: registro en STACK

Inicio > Configuracion > Integraciones centraliza la conexion y los datos del
club del organizador, compartidos por sus juegos. Conectar/cambiar credenciales
y desconectar son acciones inmediatas. Las credenciales se borran del formulario
al enviarlas o cancelar; no se guardan en el navegador. Desconectar pide
confirmacion y desactiva el requisito compartido.

Una conexion con nombre y URLs legales validos habilita el registro del club y
fuerza email obligatorio, sin una lista de ubicaciones aprobadas. Los enlaces
de ejemplo conservan el modo demo sin altas reales. El menu del juego muestra
el logo y estado Kivly; un error de carga bloquea el guardado y muestra una
accion para comprobar el estado, nunca valores por defecto aparentemente validos.

En `/play`, el consentimiento del club es explicito y separado del de Stand.
La version aceptada viaja con la solicitud del codigo de email; solo el backend
registra/vincula al cliente tras verificarlo. Las sesiones antiguas sin membresia
vuelven al formulario. Los resultados inciertos se notifican sin repetir un alta.
Todos los formularios `/play` piden nombre completo primero y email obligatorio.
El nombre se usa tambien en rankings. Configurar juego permite mostrar telefono,
siempre opcional: solo se envia a Kivly al crear una ficha nueva; no se actualizan
clientes existentes.

STACK conectado ofrece un selector de premio existente, guardado con los cambios
del juego. Todos los participantes que terminan reciben el mismo, sin umbral de
puntos. Tras confirmar el resultado, una tarjeta compacta con la paleta activa
muestra el premio y solo los botones Apple/Google Wallet que devuelva Kivly.
No se pide plataforma al registrarse ni se crean enlaces artificiales. Si no hay
tarjeta, se indica; un fallo de premio no oculta ni invalida el resultado.
La accion de comprobar consulta el estado sin repetir asignaciones inciertas.
No hay creacion de premios ni envio de tarjetas por email.

La guia de contrato, recuperacion y escenarios condensados esta en
`stand-backend\docs\KIVLY_INTEGRATION.md` (repositorio hermano).
Las pruebas simuladas de API y ajustes cubren el contrato sin aprobacion manual;
no sustituyen la prueba real del formulario y la membresia en el panel de Kivly.

Action buttons inside settings panels (save/apply, generate Quiz/cards, export,
share, download and image selection) use the active palette's primary color,
including hover and border states. Keep destructive actions red. Preserve the
original category icon colors and neutral navigation styling in the main settings
menu; do not recolor those icons to match the palette. Use `bg-primary/20`,
`border-primary/30` and `hover:bg-primary/30`, not hard-coded action colors.
The Tailwind primary token must support opacity via `--color-primary-rgb`.

### Prize images

`Settings > Premios` stores independent `validation`, `ranking` and `raffle`
entries in the game's `prizeCatalog`. Each entry has a name, nullable limit,
optional ranking `topX` and optional image. In the editor, order controls as
name -> image -> numeric parameters (including Top X where applicable).
Allow PNG up to 5 MB, display a preview and provide replace/remove actions.
Keep image controls in a single 44px-high row: contained thumbnail, choose/replace
control and accessible remove button. Use a short size hint below, with validation
errors and progress still visible when applicable.
File choices remain drafts until the server confirms **Guardar**; failed
uploads or saves must not publish local success or discard the draft.

Use `PrizePresentation` / `PrizeImage` for prize artwork with `object-contain`.
Home widgets and existing prize announcements display the corresponding slot,
not a shared image for all prizes. Participant registration advertises validation
and ranking prizes above the fields, never raffle; results still display any
awarded raffle prize and its existing redemption QR. Keep image-free legacy
events usable. Store durable keys and refresh signed URLs through metadata reads;
never persist a presigned URL as the authoritative reference.

Players, ranking and raffle panels use `PrizeSticker` in every orientation and play mode;
their titles and the player count share `HOME_TITLE_TEXT` (`text-xl sm:text-2xl`),
regardless of compact mode. All other widget text, including prize names and
counters, rank numbers, usernames, scores, timers, loading/empty messages,
warnings and the raffle winners portal, uses `HOME_BODY_TEXT` (`text-sm leading-4`).
These shared tokens live in `src/core/ui/homeTypography.ts`; preserve existing
colors and font weights. Keep the mobile home's "NO ESCANEAR, POR FAVOR."
headline unchanged as the largest text. Settings and participant `/play` retain
their own typography.
In STACK `/play`, keep the block counter on the left and the player's avatar and
username on the right of the same row. After the server confirms the result,
show the actual rank as a large `Posición: #N` overlay inside the scene, without
a separate game-over summary below it. Preserve pending-save status, errors and
save retries; never display an unconfirmed rank.
Once STACK has a saved score, fetch ranking-prize eligibility from the player
endpoint. For a server-issued claim, overlay the prize image and its name below
the position, with the locally generated redemption QR alongside the prize.
Keep the redemption instruction below the scene, without a separate prize card
or repeated prize name. Eligibility requires a configured prize, a rank within
Top X and within its quantity limit (if set). Refresh claims every 30 seconds;
replace the QR with a collected notice after delivery. The validator rechecks
the current ranking and records delivery once, even for concurrent scans.
The shared participant `/play` panel shows validation and ranking prizes as
compact stickers overlapping its top-left border, instead of a promotion block
inside each view. Keep them visible during registration, play, validation and results.
The language selector is a sibling outside the card's backdrop-filter stacking
context, at `z-50`, anchored inside the panel's top-right corner via a shared
relative wrapper. Use `pt-14` for logo clearance and a `h-32` logo.
Keep registration consent concise, with a separate privacy-policy link.
After a verification code is successfully sent, hide the registration prompt,
participant fields and consent notice while showing code entry. Keep the
accepted consent and field values in state; "Cambiar datos" restores them.
If sending fails, keep the registration fields and consent visible.
Reserve space to the right of
the stickers so they do not cover the selector on narrow screens.
Stack multiple configured prizes above the same corner, hide
zero-limit/empty prizes and omit counters (registration has no live prize count).
Use participant language and the active palette; preserve prize redemption QR
cards in results. Ranking stickers retain
`PREMIO TOP X` (`TOP PRIZE X` in English) when Top X is configured, and count
ranking entries against the prize limit; ranking row highlights and scrolling
remain unchanged. Ranking rows always show a profile avatar: use the participant
photo when available and the avatar's initials fallback when absent or unavailable.
Place the sticker at
the top right, overlapping the card border, with a large `object-contain` image
inside a circle using the active theme's primary color. To its right, show
`PREMIO: <name>` (`PRIZE` in English), then the current/limit counter underneath.
Outline the sticker with the active theme's primary color.
The sticker background must be opaque: layer the theme surface over the solid
theme background so translucent surface colors do not reveal the panel behind it.
Players counts validations; raffle counts winners, not delivered prizes.
Without an image, keep text only; without a limit, hide the counter. Hide the
sticker if both name and image are absent. Wrap long names within two lines and
expose the full name in a title tooltip. Place the player count before the
Players label, left-aligned; let the label wrap below the count on narrow panels.
Reserve
space above the card within the widget so ancestor clipping does not hide the
sticker. The card's top border crosses the sticker's vertical midpoint: use
a 4rem height with -2rem bottom margin in compact mode, or 5rem with -2.5rem
otherwise. Keep the card's normal padding without extra top padding for the sticker.

Place the operator **ES / EN** selector immediately before the close X in the
settings header. Use `useOperatorLanguage()` from
`src/core/shell/operatorLanguage.tsx` for operator UI text:
`t('Texto en español', 'English text')`. The provider belongs to `AppShell`, not
individual dialogs or games, so closing settings and switching languages preserve
gameplay and unsaved drafts. Do not key components or refetch settings on language
changes. Keep user-entered names, prizes and game content unchanged; participant
`/play` uses its separate language context.

All games use **∞ móviles** for gameplay and **Web** for participant access;
master-screen and Instagram game-access options are not available.
Use two columns for short rule parameters (STACK speeds/tolerance, L3TRAS word/time,
INFOCARDS generation counts); a lone short field such as IMPOSTOR's player limit
occupies one column. Long text, word editors and descriptions retain their full
editing width; EMPAREJA2's difficulty slider stays wide and RULET4's existing
label/count pair stays in two columns. Keep drafts and the single final
**Guardar y aplicar cambios** action in the shared panel.

The shared panel shows the participant
`/play/:gameId` link and prize validator link with its QR immediately below the
fixed mobile/Web access summary, before game-specific rules. Use three compact columns:
participant QR with its link below, validator QR with its link below (both 80px),
and **Datos del participante** with Email and Phone checkboxes.
Checked fields are required in `/play`; unchecked fields are hidden and omitted
from registration requests. Save these settings with the shared footer, not in
individual game configs. Existing events default to email enabled and phone
disabled when no explicit configuration exists. Individual game configs
must not duplicate these settings. Web registration always asks for a display
username and also offers an optional
profile photo for every participant, independent of the configured contact fields;
uploaded photos appear in rankings and participant `/play`. Instagram is neither
contact data nor an access channel.

## Screen edge → content (AppShell)

Do not reimplement outer page padding inside `GameScreen`; the shell already insets content.
The event home is the operator dashboard for all games; participant gameplay
and validation run on mobile at `/play`.

| Mode | Where | Classes / behavior |
|------|--------|-------------------|
| Portrait | Main column | `px-4 sm:px-6` on the scroll column; vertical insets via `paddingTop` / `paddingBottom` in `dvh` (see `AppShell.tsx`). |
| Portrait | Header join (above card) | `GamePortraitHeaderJoin` in `AppShell.tsx` — logo left, QR + “Escanea para jugar” + game code right; instructions modal via `getJoinInstructions()`. |
| Portrait | Game card wrapper | `p-4 sm:p-5` on the `.card` that wraps `GameScreen` (game UI only; no logo/QR inside). |
| Landscape | Full-bleed stage | `py-[10dvh] pl-[3dvw] pr-[1.5dvw]` on the landscape container (tighter right gutter). |

Settings control is `fixed top-4 left-4` (not part of game panels).

## Mobile-client event home

On `/home`, check the saved Appearance media before displaying game content.
Prefer the user-selected client logo; only use the game's default logo when no
client logo is selected. Do not briefly show the game logo while this initial
lookup is pending, or substitute the platform Stand logo for the game's logo.
Apply the same logo priority in portrait and landscape.

`AppShell` uses the shared `MobileGameHome` for all games instead of an
operator gameplay panel.
Landscape uses three columns: large logo with players and an expanded raffle
below on the left, a large QR in the center, and the ranking filling the right
column. The large QR panel displays **NO ESCANEAR, POR FAVOR.** in Spanish or
**DO NOT SCAN THIS.** in English, centered above the QR in oversized bold white
text with **NO** / **NOT** in red, following the selected interface language.
Reserve vertical space for this heading when sizing the QR so both fit.
Distribute remaining vertical space evenly above the heading, between the heading
and QR, and below the QR. Keep base padding and gap equal (1rem, or 1.5rem from
`sm`) so all three spaces remain equal as the panel height changes.
Games without a ranking use two columns; raffle plan restrictions and
prize settings remain unchanged. The logo card contains only the logo, without
the manual icon or legal footer. No mobile participation explanation, participant
link buttons or event-name/code text appears on this home. The QR always links to Web participant registration. The mobile landscape stage
uses `4dvw` horizontal margins and a `7dvh` top inset, and reserves at least
`max(7dvh, 4rem)` below the panels for the fixed Stand footer logo.

Portrait stacks the logo, QR, players, raffle and ranking in that order in a
scrollable page with `px-6 sm:px-8` horizontal margins and an `8dvh` top inset.
This presentation does not change the participant registration/consent screens.

## Landscape game grid (three columns)

Use the shared token so column weights and gutters match t1mer:

- Import `GAME_LANDSCAPE_THREE_COL_GRID` from [`src/core/ui/gameScreenLayout.ts`](../src/core/ui/gameScreenLayout.ts).
- Equivalent classes: `grid grid-cols-[25%_40%_25%] gap-4 items-stretch h-full min-h-0`.

Left: `GameLandscapeLeftColumn` — info panel (`GameLandscapeInfoColumn`: logo, QR, manual/legal footer) + `playersElement` below. Pass instructions as `children` for the modal. Center: main game. Right: `sidebarElement` only (Ranking `flex-1` if `showRanking`, RaffleData) — **no Players**.

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
- Right sidebar: `playersElement` on top, then `sidebarElement` (ranking, raffle) — no left info column.

## Portrait: header join + game card

Portrait join UI lives in **AppShell**, not inside each `GameScreen`:

- [`GamePortraitHeaderJoin`](../src/core/widgets/GamePortraitHeaderJoin.tsx) — row: logo (`max-h-20`–`max-h-24`) | QR (~128px) + “Escanea para jugar” + [`GameIdHint`](../src/core/widgets/GameJoinHints.tsx).
- Layout token: `GAME_PORTRAIT_HEADER_JOIN` in [`gameScreenLayout.ts`](../src/core/ui/gameScreenLayout.ts).
- Instructions: [`getJoinInstructions(gameId)`](../src/core/ui/gameJoinInstructions.tsx) passed as `footerChildren` (same modal/footer as landscape via `GamePanelFooter`).
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
