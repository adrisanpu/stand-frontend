# Operator game UI (design guidelines)

Conventions for the operator canvas, participant gameplay and event configuration.
All gameplay runs on participant phones at `/play/:gameId`; the stand displays
only the configurable Home, not an interactive game engine.

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
The participant spin endpoint assigns the result server-side; the animation
reveals that result without awarding again. Verify legibility and GPU performance on the event device,
especially for many segments or long prize names.

## Catalog: detalle al elegir un juego (`GameGate`)

Tras pulsar un juego en el catálogo, el bloque informativo usa **dos columnas desde `md`**: columna 1 con el **logo grande centrado** (`max-h-44`–`max-h-60` según breakpoint); columna 2 en **columna flex** con la **descripción** arriba (`descriptionLong` o `description`) y **tags** abajo (separador `border-t`, `flex-wrap`). En móvil todo se apila en un orden: logo → texto → tags. Sin `assets.logo`, mostrar iniciales del nombre en un contenedor cuadrado como en la rejilla del catálogo.

## Configurar juego

### Initial setup after creating an event

Both the + action and the coverflow guide open the existing configuration modal.
For a new event it first shows the game explanation, name and Create action.
After creation, the same modal opens Home and requires explicit confirmation of
all six panels: **Home, Game, Registration form, Questionnaire, Prizes, Raffle**.
Defaults may be confirmed without edits; changes must be saved first. Editing a
confirmed panel clears its confirmation until it is reviewed again. Progress and
its revision are stored on the server; the creation URL becomes `?setup=<gameId>`
so reloads reopen the same event rather than creating another. Closing is blocked
until all panels are confirmed and **Finish setup** succeeds. Opening an unfinished
event's Home also resumes this review. A plan-locked raffle panel can be reviewed
without upgrading or launching a raffle.

Existing events without a setup marker are exempt. This is an operator review,
not a new publication state or a change to public participant access.

### Event registration and survey

**Juegos > Configurar partida > Formulario de registro / Cuestionario** provides
two separate settings tabs and their corresponding live previews. Registration
fields belong to the registration tab; questions and timing belong to the
questionnaire tab. **Home**, the first tab, contains only the Home canvas editor, without
a separate preview; the old event appearance controls and separate appearance save
button have been removed. Existing saved logo/banner/theme overrides remain
in use; empty overrides inherit the account appearance.
**Game** contains mechanics and an isolated playable preview. It uses loaded,
unsaved mechanic drafts and local simulated opponents where appropriate, without
registration, participant sessions, real scores, prize allocation or multiplayer
rooms. All available games are supported; CUPIDO remains unavailable. SEMAFORO
can read the saved questionnaire but never submits responses. EMPAREJA2 uses
labeled sample characters. Switching away from Game stops its simulation.
Every Game panel uses two columns on desktop: settings, inputs and saving on
the left, the playable preview on the right. On mobile these stack in that order.

Home uses the same `HomeCanvas` renderer as the live display, with
sample counters, raffle and (when supported) ranking. Draft canvas content and media
update locally; no polling, game actions, iframe or additional dependencies are
used. The editor itself shows the design; there is no duplicate Home or mobile
preview in Home. It never mounts participant sessions, 3D engines or timers.
The QR is generated locally. Preview CSS variables are scoped to its
canvas and never change the operator theme. Registration and Questionnaire
keep their own previews. Registration and questionnaire retain a single draft
across tab changes; saving either applies pending edits from both sections.
Registration has a fixed layout: edit its title, description and requested
optional fields (address, company, sex, birth date). Email, full name and phone
appear as checked, locked fields in the settings; legal consent cannot be
disabled either. Sex is an optional male/female selector stored as `sex`
(`male` / `female`), never relabeled or migrated from historical job titles.
Historical job titles remain available in administrative responses and exports.
Its preview renders the actual Play
`JoinForm`, with a local email-to-details transition and no verification messages,
participant creation, uploads or session writes. Appearance is inherited rather
than independently edited in this panel. Questionnaire retains its existing controls.
Both tabs offer the same shared registration/questionnaire logo: choose from the
account's image library, upload an image up to 5 MB or select **No logo**.
Selection updates both previews immediately; save either tab to persist the
event's `logoKey`. Uploading adds a library image but never changes the account's
selected logo. This customization retains the Event plan restriction. Changing
the shared logo invalidates both panels during initial setup.
Neither the preview nor the public registration form displays a step counter or
progress bar; the email/details/verification flow itself is unchanged.
Registration and Questionnaire keep their QR and participant link at the bottom
of the right-hand preview column, with extra separation from the form.
On the EMPAREJA2 Play screen, the assigned character name and participant name
and avatar sit above and outside the character image panel, without overlays.
Canvas background uploads do not change the account logo. Empty overrides retain the
existing event/account appearance. STACK retains its additional club consent and
Kivly identity checks; the new optional fields do not change Kivly customer data.

The survey has at most five single-choice questions and three options each,
without scoring. Select one placement: disabled, after registration, after the
game, to receive a prize, or to enter a raffle. After-game placement is unavailable
for INFOCARDS and IMPOSTOR, which lack a final participant event for this flow.
After-registration placement blocks gameplay until submission; prize and raffle
placement do not. Submission is durable and requested only once per participant.
Raffle entry is automatic after completing the raffle survey.

Questions and placement become read-only after the first submitted response
(including existing historical answers). Presentation remains editable while
the event is active. Create a different event to use a different questionnaire;
there is no questionnaire versioning or participant-answer reset.
AI generation fills a local draft; it does not save or replace existing answers.
Legacy registration/quiz settings open the same editor.

**Administracion > Respuestas** provides event selection, registered/completed
counts, answer distributions, participant search/status filtering and CSV export.
Results are not combined across different questionnaires. Completion rates use
registered participants, not visitors or an inferred abandonment funnel.
Archived events remain available for consultation. Configuration and exports
respect their existing plan/lifecycle restrictions; the panel does not add AI
insights.

For completed or exempt events, closing keeps confirmed saves, refreshes the event
list, and asks before discarding drafts. Creation and writes block closing until complete.
Creation does not navigate to the home screen or launch a raffle.

Prizes loads existing shared prizes and, for STACK with a connected account,
the existing Kivly rewards. All are available in the rule selector without first
adding them to the event. Saving associates only the selected prizes, preserving
existing associations and awards. At the top of the Prizes panel, a QR and link
open this event's prize validator at `/redeem/:gameId` in a new tab.
Blank sub-stocks have no numeric reservation
and cannot award prizes until a quantity is set. STACK saves associations before rules using the refreshed
revision. Every game uses the same STACK-style conditions table: add a rule,
select its condition, and expand its prize and sub-stock details. Ranking rules
expose their top parameter in the same row. Only conditions supported by the game
and plan appear; native games retain validation, ranking and manual raffle slots,
with at most one rule per condition, one prize per rule and quantity fixed at one.
STACK keeps its additional score conditions, prize groups and quantities; the
common interface does not extend native award behavior or migrate prize data.
Empty new rules must be assigned a prize or removed before saving. Existing
legacy prizes remain visible even when absent from the shared catalog, and
conditions hidden by the plan are preserved on save. Inactive events show the
same table read-only. No prize is created or awarded by loading.
Administration > Prizes reloads inventory when its browser tab becomes visible
or regains focus, reflecting saved event reservations without a manual refresh.
Removing the last condition reference to a STACK prize releases its unassigned
reservation on save. The catalog entry retains only consumed units; existing
awards and durable movements remain unchanged for both STAND and Kivly.

### Home raffle visibility

**Settings > Sorteo > Mostrar sorteo en el home** has an ON/OFF toggle button,
styled like the light/dark switch,
that saves immediately per game and refreshes the home after a successful save.
It defaults to enabled, including existing games without `showRaffleOnHome`.
Disabling it hides the raffle widget in both orientations without moving the
other canvas elements; its saved position remains available when enabled again. It
does not disable running the raffle from settings or change prize eligibility.
The existing plan gate still applies.

### Editable Home canvas

The QR scales to its panel's available width and height while preserving its
square proportions. Its black backing is always square and fitted to the shorter
available panel dimension, with no border or padding. Extra panel space stays
transparent, including when a component background was previously configured.
Position and panel size use dragging, corner resizing or
arrow keys only; the editor has no coordinate or dimension textboxes.
Only the selected component shows its resize handle. A single compact toolbar
above the canvas groups the **Add component** dropdown with contextual
background (default, transparent or custom color), accent, normal text color,
text size and bold controls. Its controls wrap on narrower screens. It edits
the canvas background by default;
clicking empty canvas space or **Select background** returns to those settings.
Canvas and component controls are never displayed as separate simultaneous
panels. An **Image / video background** dropdown next to the canvas colors
provides the existing library, upload and removal controls. It is available
only with the canvas background selected, not for individual components.
**Bold** toggles the text weight for the current selection on every plan.
Components inherit the canvas setting unless overridden; the reset arrow
restores inheritance. Existing text weights stay unchanged until configured.
Text sizes scale with both panel dimensions in the editor and live Home;
the font family stays unchanged. Selecting **Canvas background** sets background,
accent and normal text colors plus a proportional base size independently per
orientation. Base size 48 preserves the existing scale; integer sizes 16-160
scale title/body roles together. General colors inherit the event/account theme
until overridden. Size can be cleared and typed freely; it is validated and
applied on blur or Enter, restoring the previous size with a message if invalid.
Accent applies to primary/accent decorations, and normal text
applies to main/secondary copy; status/error colors and QR contrast stay intact.

Selected non-QR components can override accent, normal text color and base size.
**Inherit** removes an override; explicit saved text sizes/colors remain in use.
The selection panel controls each component's background separately, including
transparent backgrounds. A canvas background color sits behind any background
image/video and does not replace component backgrounds.

Players and text are centered vertically and horizontally by default in both
the editor and live Home. Text keeps its individual left/center/right setting;
explicit existing alignments are preserved. Long text remains scrollable.

**Games > Event settings > Appearance > Home canvas** offers independent
landscape (16:9) and portrait (9:16) compositions. The display selects the
composition matching its screen orientation, respecting explicit orientation
overrides. It fits the complete design without stretching or cropping.

New events start with both canvases empty. Existing events without canvas data
receive an editable initial composition. Saving an intentionally empty canvas
does not restore the initial widgets.

Add QR, event logo/name, player count, supported leaderboard, enabled raffle,
or plain text. Each built-in widget can appear once; text can repeat, up to 40
elements per composition. Drag elements to move them, or use the selected
element's corner handle to resize. Focus either control and use arrow keys for
keyboard editing. Position and size fields are grid units. Invalid moves,
out-of-bounds sizes and collisions leave the last valid placement unchanged.
There is no automatic pushing, layering, individual rotation or rich-text HTML.

Layout, text, alignment and general/individual font size are available on every
plan, as are individual component backgrounds. Canvas background colors,
accent/normal text color customization and background images/videos require
advanced customization (Event). Background
images support PNG/JPEG/WebP/SVG up to 5 MB; MP4/WebM video supports up to 100 MB.
Backgrounds belong to each composition and never replace the registration
banner or account logo. Video loops with sound; the editor/preview stays muted.
Browsers can require a gesture for audio: **Enable sound** appears outside the
design when needed. Audio preference lasts for the browser session. Playback
or codec failures are reported explicitly.

**Save canvas** persists both compositions with an independent revision.
Registration/questionnaire drafts are saved separately in their respective tabs.
Moving a Home component does not invalidate an in-progress participant survey.
Switching orientation or configuration tabs preserves the canvas draft.
Reload/discard is explicit after a conflict or uncertain save. Stored canvas
data contains media keys, not expiring signed URLs.

The version-1 contract adds optional `backgroundColor`, `accentColor`, `color`
and `fontSize` fields directly to each composition and component, plus an optional
boolean `bold` (`true` for bold, `false` for regular; omitted inherits). Composition
background colors and both text colors must be six-digit HEX; only component
backgrounds also accept `transparent`. Omitting style fields inherits defaults
without changing legacy stored data or its revision. Saving confirms all style
fields as well as media and items. Deploy the compatible backend before the
frontend that sends these fields; older strict validators reject them.

### Participant phone and photo

Entering an email first checks for a returning participant in the same game.
Complete registrations go straight to the email-code screen; missing required
data or unproven/outdated consent is requested without revealing stored profile
values. Verification restores the existing player and progress, not a new entry.

The participant form offers European country calling codes, with Spain (+34)
selected initially. Options show flags and calling codes, with the prize-settings
dropdown style and accessible country names. The avatar picker sits alongside
the full-name input. Both consent rows use the same 13px text and 20px checkboxes.
Phone is mandatory for every game. The API receives a single international number;
pasted international numbers
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
Cards put the image first, followed by name, source logo, read-only event
reservation and **reservation availability**. Sub-stock is an **exclusive event
reservation**. Blank saves `null` (no numeric reservation), zero reserves no units;
neither can award prizes. General stock is the sum of configured sub-stocks.
Availability comes from backend `globalInventory`, scoped to this event, so
another event cannot consume its units. Missing quantities and exhausted
reservations have explicit explanations.
Hover, image click and keyboard focus reveal Kivly upload/remove actions, without
exposing native file-input text. Uploaded PNGs (up to 5 MB) remain game-local for
Kivly and do not edit the external catalog. STAND names/images are read-only,
selected from the general catalog in **Administration > Prizes**.
Both creation forms share a compact row for source, shared-prize selection or
Kivly name, reserved sub-stock (blank by default), and image preview.
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

Registration always requires name, verified email and phone in every game and
both STACK channels. There is no optional-phone toggle. The QR uses the phone
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
assignment catalog and refreshes the external catalog; the owner selects it in a rule
separately. Image and event-cap drafts require saving. An uncertain create requires a catalog refresh before another
attempt. A STAND selection references a shared prize. New Kivly selections use
local IDs independent of the external reward ID. Edits stay drafts until the
save succeeds.

### Event-reserved prize inventory

**Administration > Prizes** shows one combined catalog/inventory table, ordered
as **Selection, Photo, Name, Origin, Stock, Distribution, Events**.
The first column selects a single prize using radio controls. Edit, remove,
and history actions sit above the table, aligned right, and target
only that selection; they are disabled until a prize is selected. Selection
cannot change during catalog editing or deletion.
There is no second catalog list or repeated inventory title. Compact actions
open a single detail row immediately below the selected prize: STAND name/image
editing, event reservation breakdown or movement history. Creation remains above the
table. Kivly retains its external catalog identity and inventory actions.
Event associations use a read-only disclosure with name, active/inactive state
and cap, including inactive events; it does not edit assignments.

For assigned prizes, Stock is the sum of every configured event reservation,
including inactive events and prizes whose rules are currently unused.
Availability is each reservation minus that event's recorded assignments;
redemption moves units from Assigned to Redeemed without restoring availability.
The general total includes redeemed units and does not decrease on redemption.
Reservations are derived on every read, not initialized from a guessed manual
balance, and repeated refreshes cannot accumulate stock. A missing numeric
sub-stock displays an actionable notice instead of an invented quantity.
Kivly totals describe STAND-managed reservations, not confirmed external physical
stock; external redemptions remain unknown.
Unused, uninitialized STAND prizes can be deleted without creating a game.
Unused, uninitialized Kivly prizes have a separate Delete from STAND and Kivly
action with an irreversible-deletion confirmation. Event associations (including
inactive events), initialized balances and assignment/movement history block
Kivly deletion. Uncertain deletions require a manual inventory refresh before
retrying; they are never automatically repeated.
The historical/current breakdown lives inside movement details, not a table
column. Movements load by cursor and state clearly that event/kind/state filters
affect only loaded rows. Refreshing inventory or completing an import reloads
open movements so their rows match the updated summary.

Set quantities in each event's Conditions. Existing finite sub-stocks are used
automatically; no manual initialization is required. Durable movement history
provides consumed quantities, including imported history and deleted award rows,
without counting the same units twice. Event reservations are the only live stock
source: there is no activation step, manual initialization, replenishment or
adjustment. Old manual movements remain visible as audit history; retired manual
balances cannot authorize new awards. Unassociated prizes have zero reserved stock.

On opening the panel, automatically import all pending games from `imports`, including archives and
games without current prizes. Consume all pages sequentially,
without manual page advancement. Skip complete imports and continue with
other games after a failure. Show errors/unresolved history and a retry action;
do not retry indefinitely. Preserve opaque cursors for uncertain retries.
Hide successful history/import status entirely. Keep per-event status inside a disclosure only when there are pending imports or incidents rather than permanently
listing every event. Newly discovered games are imported after the current
batch without automatically retrying failed games or losing their errors.
Unlinked history requires reviewing the shared catalog selection in event
settings and retrying; ambiguous names are never automatically merged.
Missing numeric reservations block new awards explicitly. Public prize/QR reads
only resolve existing awards; legacy player flags are imported explicitly, never
used to mint awards during a read. Charts use server-side reservation summaries,
not a client-side reconstruction of paginated movement history.

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
and access details. Participant fields are configured only in the Registration
form tab, not in individual game configs. Name, phone and verified email are
mandatory, including legacy disabled-contact settings. Web registration asks for
email first, then missing identity/details and consent, followed by email verification.
Enabled optional fields are collected when supplied but do not force otherwise
complete returning participants back through details. Administrative responses
and CSV include profile values; public rankings and assignment responses do not.
Registration also offers an optional
profile photo for every participant, independent of the configured contact fields;
uploaded photos appear in rankings and participant `/play`. Instagram is neither
contact data nor an access channel.

## Display shell and participant gameplay

`AppShell` reserves separate header/footer space for operator controls and Stand
branding. The remaining viewport fits `HomeCanvas`; controls do not cover the
editable design. There are no per-game landscape columns or portrait wrappers.

Load appearance before choosing the logo. Priority is event override, selected
client logo, then the game's logo; the platform Stand logo is not a substitute.
QR links always target Web participant registration.

Game mechanics belong in `src/games/<gameId>/ParticipantPlay.tsx` or existing
shared participant views, connected through `ParticipantShell`. Participant
requests use `publicApi` with the participant token, not operator credentials.
Do not register stand `GameScreen` components or reintroduce layout injection.

Each component has a **Component background** selector: default, transparent
(no color), or a solid color. These controls are available on every plan and
saved separately for each orientation. Explicit backgrounds replace widget
card surfaces; the QR code itself retains its contrast for scanning.

## Legal notice

Registration and consent belong to the participant flow, not a fixed Home panel.
Shared legal copy remains in `src/core/ui/gameLegalCopy.ts`. Keep mandatory Stand
branding and operator controls outside the editable canvas.

Privacy policy (Spanish UI): `/pages/privacy-es.html`. English: `/pages/privacy.html`.

## Code validation (copy & controls)

Colors always come from each game’s theme.

### Shared copy

Use the participant language provider for validation labels and loading/error copy.
Follow the existing mobile experiences instead of adding stand validation controls.

### Input styling

Typical: `rounded-xl`, `bg-[rgba(255,255,255,0.05)]`, `border border-white/10`, centered mono for PIN-style codes, `focus:border-white/20` (or game-tinted focus). Use `min-w-0` in flex rows. If labels are not visible, set `aria-label` on the input.

### Validate button — full width (below inputs)

`type="button"`, `w-full`, `rounded-xl`, `p-4`/`p-5`, `font-semibold`, `transition-colors`, `disabled:opacity-50 disabled:cursor-not-allowed`, inner `flex items-center justify-center gap-3`, check-circle SVG, game-tinted background/border. Loading: spinner + `Validando…`.

### Validate button — inline (beside input)

`h-14`, `rounded-xl`, `font-semibold`, `shrink-0`, `inline-flex items-center justify-center gap-2`, `px-8` (typical), same disabled pattern, translated `Validar` / spinner + `Validando…`.

### Pair games with fixed avatar slots (empareja2)

Two fixed-size cells above the code inputs; on success, same cells show `characterImageUrl` and optional `@handle`.

### Files that often change

- `src/core/home/` for the model, editor and shared display renderer
- `src/games/<gameId>/ParticipantPlay.tsx` for mobile mechanics
- `src/core/participant/ParticipantShell.tsx` for participant navigation
- `src/core/shell/AppShell.tsx` for the display shell
