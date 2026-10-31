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

### Home raffle visibility

**Settings > Sorteo > Mostrar sorteo en el home** has an ON/OFF toggle button,
styled like the light/dark switch,
that saves immediately per game and refreshes the home after a successful save.
It defaults to enabled, including existing games without `showRaffleOnHome`.
Disabling it removes the raffle card and its space in both orientations; it
does not disable running the raffle from settings or change prize eligibility.
The existing plan gate still applies.

### Participant phone and photo

Entering an email first checks for a returning participant in the same game.
Complete registrations go straight to the email-code screen; missing required
data or unproven/outdated consent is requested without revealing stored profile
values. Verification restores the existing player and progress, not a new entry.

The participant form offers European country calling codes, with Spain (+34)
selected initially. Options show flags and calling codes, with the prize-settings
dropdown style and accessible country names. The avatar picker sits alongside
the full-name input. Both consent rows use the same 13px text and 20px checkboxes.
The API receives a single international number; leaving an
optional phone empty does not send its prefix. Pasted international numbers
do not receive a second prefix. The optional profile photo is selected through
a keyboard-accessible circular avatar with a generic silhouette and local
preview. JPG, PNG and WebP files up to 5 MB remain supported.

### Kivly: connection and registration

Home settings > **Integraciones** is a compact list with one collapsible Kivly
entry. Disconnected accounts show credentials and Connect; connected accounts
show the business name, Disconnect, the fixed `https://getkivly.com/auth/login`
link and the shared official club website field. There is no technical location
field, credential editor or legal-settings editor. Initialize new club settings
from the business name and STAND legal links; preserve existing legal data.
Connecting and disconnecting are immediate actions;
credentials are cleared on submission/cancellation and never stored in browser
storage. The first release enables club registration only for STACK. Disconnect
requires confirmation and affects all the organizer's STACK games.
STACK settings show only a read-only logo with Connected/Not connected, never
a demo mode, and an explicit retry on errors.
An unavailable indicator must not block saving unrelated game rules.

When public metadata includes `loyalty`, `/play` asks for separate club consent
and sends its version with the email-code request. Access opens only after the
backend confirms verified registration. Changed terms require fresh consent;
uncertain registration displays an error without granting access. STACK prize
settings now own mixed STAND/Kivly rules; there is no separate completion-reward
selector. With wallet selected, after a confirmed result show a compact official club wallet action
below the game result and before individual prize cards. Kivly assignments happen
server-side without returning to the result page. The feature does not generate
passes, redeem Kivly rewards or mark them used; uncertain assignments are not
automatically replayed. Installed-wallet propagation has not been live-verified.

### STACK: textual prize rules

`Settings > Premios` starts with **Catálogo de premios**: name search,
**+ CREAR** opening an inline creation form above the gallery, and a horizontal
scroll-snap gallery with four cards on desktop, two on smaller screens and
one on mobile. Arrow controls and native touch scrolling reveal more prizes.
Cards put the image first, followed by name, source logo, consumed inventory
as **Entregados**, editable total **Stock**, and **Disponibles = Stock - Entregados**.
Hover, image click and keyboard focus reveal upload/remove actions, without
exposing native file-input text. Uploaded PNGs (up to 5 MB) are game-local for
both STAND and Kivly; they do not edit the external Kivly catalog.
Both creation forms share a compact four-column desktop row for source, name,
initial stock (1-1,000, default 100), and PNG upload with inline preview.
Kivly-only fields and advanced options use the same compact controls and grid.
Prize artwork has a transparent background; source badges use the footer logos.
Rules follow the gallery; the exclusive **Wallet / Email** Kivly delivery
selector comes after the rules. Dropdown controls have transparent backgrounds,
with white text in dark mode and black text in light mode; native option lists
use a matching theme background to keep choices readable.
Wallet is the default for older programs. Email selection is unavailable until
the backend environment enables it. A channel change affects only new attempts.
Email mode automatically sends confirmed Kivly rewards to the verified address
with the Kivly customer's phone QR; no wallet action or reveal lock is shown.
STAND prize QRs retain their usual behavior. The prize panel also shows email
states and lets the organizer retry definitive failures without awarding again,
including after closure; uncertain sends require investigation instead.

STACK registration always requires name, verified email and phone in both
channels. Its shared game configuration has no optional-phone toggle. Other
games keep their existing optional-phone configuration. The QR uses the phone
in Kivly, not a conflicting value entered in STAND; a missing Kivly phone shows
an actionable error and never silently falls back.
Each rule uses "Cuando [condition], entregar [OR groups of AND prizes]".
Offer completed game, top X at own finish, final top X at closure, and raffle
winner (subject to the existing raffle plan). The combined selector
groups game-local STAND prizes and the connected business's existing Kivly
catalog without filtering. When connected, owners can create Kivly rewards here
with the required name, description, type, value and points threshold; optional
image upload is part of the creation form; terms, validity dates and redemption
limits are under advanced options. Creation adds the reward to the local game
inventory and refreshes the external catalog; the owner selects it in a rule
separately. Image and inventory drafts require saving. An uncertain create requires a catalog refresh before another
attempt. A STAND prize needs a name and may have a PNG. New Kivly selections use
local IDs independent of the external reward ID. Edits stay drafts until the
save succeeds.

Each alternative group contains one or more prizes and quantities. Each
rule keeps its condition and remove action in a compact header; alternative
groups share a two-column desktop grid (one column on mobile), with inline
prize names, quantities and remove buttons. AND/OR labels retain their meaning.
A single group awards its available prizes. Multiple groups are selected with equal
probability among groups with some eligible stock. An exhausted group cannot
win; partial stock delivers only available units from the selected group.
There is no weighting control or flat All/Random grouping selector.
Rule changes create new identities; already earned prizes stay earned. Two
matching rules can award two units of the same item. "Partida completada"
replaces validation terminology for STACK. Public promotions summarize every
configured prize through the restored promotional sticker, independent of
OR/AND grouping, without a separate textual rule-summary panel.

Results display a compact card with image, name and local QR per uncollected
STAND unit. Omit the reason and STAND/Kivly badge from earned cards.
Collected cards retain a clear collected state. Kivly cards have no STAND QR:
show queued, confirming, confirmed or team-verification-required status.
Poll results every 30 seconds and expose read errors with retry. The official
Kivly wallet page offers Apple/Google; configure only the business origin,
without `/add-to-wallet` or customer identifiers, in Integraciones and shared
across the organizer's STACK games. Read older per-game values only until a
shared value is configured. Explain unavailable access
when a club card is expected instead of silently hiding it.

The single **Cerrar juego** menu entry owns definitive closure, not Premios.
Closure is separate from pause: confirm that starts are blocked and
active attempts may finish; the server automatically finalizes afterward.
Excluding displayed pending attempts requires a second confirmation explaining
that no score/prizes will be saved and late results will be rejected. Disable
rule editing after closure begins. Do not show delivery/allocation diagnostic
panels in Premios; retain the durable delivery data and participant statuses.

Keep the piece appearance selector and a static preview of the selected block
visible. Reuse gameplay geometry/materials without starting a game or continuous
animation. Speed and Perfect tolerance live in collapsed **Ajustes avanzados**.

Action buttons inside settings panels (save/apply, generate Quiz/cards, export,
share, download and image selection) use the active palette's primary color,
including hover and border states. Keep destructive actions red. Preserve the
original category icon colors and neutral navigation styling in the main settings
menu; do not recolor those icons to match the palette. Use `bg-primary/20`,
`border-primary/30` and `hover:bg-primary/30`, not hard-coded action colors.
The Tailwind primary token must support opacity via `--color-primary-rgb`.
Settings dialogs layer the themed surface over a solid background, without
transparency into the game. Persistent save footers sit outside the scrolling
content region with an opaque background; fields must not pass behind buttons.

### Prize images

For non-STACK games and legacy STACK flows, `Settings > Premios` stores independent `validation`, `ranking` and `raffle`
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
For legacy STACK attempts without the new program, fetch ranking-prize eligibility from the player
endpoint. For a server-issued claim, overlay the prize image and its name below
the position, with the locally generated redemption QR alongside the prize.
Keep the redemption instruction below the scene, without a separate prize card
or repeated prize name. Eligibility requires a configured prize, a rank within
Top X and within its quantity limit (if set). Refresh claims every 30 seconds;
replace the QR with a collected notice after delivery. The validator rechecks
the current ranking and records delivery once, even for concurrent scans.
For STACK, one promotional sticker slides between configured prize images and
names. `/play` includes all configured prizes; on `/home`, Players has no STACK
prize sticker. Ranking combines completion and top-at-finish/final prizes in the
same carousel above its card, and Raffle includes raffle prizes. Keep
ranking condition/top labels clear, deduplicate prizes within each scope, and
do not imply the carousel chooses the earned prize. Provide pause/next and
disable automatic rotation with reduced motion. A single prize stays static.
Carousel names omit the generic prize prefix; ranking keeps its Top labels.
Pause/next controls are visually hidden until keyboard focus, without arrow glyphs.
After a confirmed STACK result, highlight the wallet action with a leading wallet
icon and a short pulse (disabled with reduced motion). Where a valid wallet link
exists, show all earned cards semitransparent with a lock, withholding STAND QRs
until that action is clicked. This is a local presentation reveal, not confirmation
of wallet installation or a change to server-side prize allocation. Without a
valid wallet link, keep prizes accessible normally.
For other games, the shared participant `/play` panel shows validation and ranking prizes as
compact stickers overlapping its top-left border, instead of a promotion block
inside each view. Keep them visible during registration, play, validation and results.
The language selector is a sibling outside the card's backdrop-filter stacking
context, at `z-50`, anchored inside the panel's top-right corner via a shared
relative wrapper. `/play` uses a safe-area-aware viewport with vertical overflow
only when needed. Size the logo, STACK scene and roulette against available
height; shrink spacing on short screens. Follow VisualViewport keyboard resizes
and keep focused fields in view. Inputs, textareas and selects have a minimum
computed 16px font to prevent automatic iOS focus zoom; never disable pinch zoom.
Keep registration consent concise, with a separate privacy-policy link.
Registration in every game has three steps: email, other fields and consent,
then verification, without a visible step counter or introductory registration
headline. The first step only validates locally. Request the code
after step two, never before consent. Keep accepted consent and field values
in state; back/edit restores the draft. After sending, show code entry instead
of fields; failed sends keep step two and its errors visible. Use labels above
rounded bordered fields, short hints and a wide rounded primary action, while
retaining STAND branding and theme.
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
master-screen and Instagram game-access options are not available. The config
panel no longer shows the fixed "Modo de juego" / "Acceso del participante"
labels; the values are still normalized and saved silently.
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
and **Datos del participante** with required full name/email and one checkbox
to show an optional phone. Save phone visibility with the shared footer, not in
individual game configs. Email is always verified, including legacy disabled-email
settings. Legacy required-phone settings make phone visible but not mandatory;
an explicit `phone.enabled` takes precedence. Hidden/blank phones are omitted.
Individual game configs must not duplicate these settings. Web registration
asks for full name first, then email, and also offers an optional
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
