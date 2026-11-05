# Stand — Frontend

Web app for **Stand**: a modular game platform for events, fairs, and social gatherings. Users log in, create or join game instances, and run interactive games (pair matching, timers, quizzes, raffles, etc.) that talk to the **Stand backend** (API + Lambdas).

This repo is the **frontend only**. Backend lives in a separate repo: [stand-backend](https://github.com/adrisanpu/stand-backend).

---

## Administration and event home

The Clients panel lists one person per owner and normalized verified email,
grouping their event participations. It requests 25 clients at a time, with
previous/next arrows and an exact `1-25 of total` range above the list.
The debounced filter searches names, emails and phones across the owner's
entire client directory, ignoring case and name accents. Filtering resets to
the first page; stale requests cannot replace newer search results.
Participation and prize history is requested only when opening a person and
expands directly below their row. Clicking the row again closes it; opening
another person closes the previous detail.
Expanded rows omit repeated contact details, show a small game logo for each
participation and a prize thumbnail when available, and use the shared red
cross close button.
Existing participants require the backend's explicit historical index rebuild;
loading the panel does not scan all game participants.

Normal sign-in and the authenticated root now open `/admin/games`.
The protected administration has **Juegos / Games** and **Integraciones /
Integrations**, with desktop navigation and a compact mobile menu.

Games lists the authenticated owner's events from `GET /v1/game`. Each card
shows the game logo, event name, creation date and player count.
The search above the list matches names, game type, creation date (ISO or
displayed date) and player count, without additional API calls. Missing legacy
metadata is displayed as unavailable, not a fictional date or zero.
**Crear partida / Create event** opens the existing catalog and creation flow
in a scrollable modal above the list, retaining the current search. It supports
Escape, focus containment and return focus; the old `/admin/games/catalog`
URL opens this overlay rather than a separate catalog screen.
**Entrar en la partida / Open event** opens
`/home?gameId=...`, outside the administration layout. The selected ID is
verified through the owner API before mounting the home; a failed lookup never
opens an old cached event. Returning to administration does not terminate or
restart the event. Direct legacy `/home` links still work.

Actions are displayed as icons with localized accessible labels and hover titles.
Cards provide **Entrar**, **Configurar partida**, **Activar/Desactivar** and **Archivar**. Deactivation
requires confirmation and preserves players/results; it is not a reset.
All games use the common active/closing/inactive lifecycle. Deactivation
blocks new participation and allocates pending prizes: STACK waits for started
attempts; other games use confirmed results. Raffles remain manual. Cards
refresh while closing and disable activation/deletion until calculations finish.
Reactivation retains scores, consumed attempts, rewards and consumed stock.
**Archivar** archives an inactive event instead of deleting its data; history,
queued deliveries and prize claims remain available. Native prize claims use
individual award QRs in the existing supported public participant flows.
The accessible archive icon next to **Crear partida** switches the same
searchable list to archived events (`?archived=1`). Archived cards offer
**Desarchivar** (returns inactive, without resetting or activating) and
**Borrar definitivamente**. Permanent deletion requires typing the event name,
warns about irreversible local data loss, and is blocked server-side while
prizes, deliveries, emails or reconciliation remain pending. External Kivly
customers and rewards are untouched. An interrupted deletion cannot be restored:
reload and repeat the confirmed deletion to finish cleanup. The backend retains
only the deleted join-code tombstone to prevent old links from being reused.
Unconfirmed writes require reloading before retry. Deploy the matching shared
layer, lifecycle/prize worker and game/public/score/validate/raffle backend
changes together before publishing this frontend. This is not a frontend-only
toggle change; old backend activity responses are rejected.
The catalog overlay omits the branding header while retaining game icons.
Save actions share one button style across account, appearance, integrations,
prize catalogs and game configuration. Reward-condition actions use icon-only
buttons with localized accessible names and hover titles, including save,
reload, add rule/group and remove controls.
Buttons retain their contextual variants rather than a global background or
border override. Navigation and game-catalog selectors are transparent; save
actions share their own style. Destructive/red actions use a red border and
background in both themes.
Cross-only close/remove buttons use the same shared red icon control, including
dialogs, settings, quiz/raffle overlays and INFOCARDS media controls.

Integrations reuses the existing account-wide Kivly connection UI as a page.
Connection/disconnection, club website and the existing STACK integration
keep their current behavior; this does not add Kivly capabilities.

The bottom-left account block shows the operator's name and profile photo
(initial when unavailable). Hovering over this identity reveals icon-only
account-settings and sign-out actions, also available on keyboard focus and
always visible on touch devices. **Configurar cuenta / Account settings** opens
`/admin/account` to save a name and upload or remove a JPG, PNG or WebP photo
up to 5 MB. Email is read-only. Profile changes persist on the account and
update the sidebar after saving; they do not change game logos or participant
photos. Deploy the matching `PUT /v1/user/me` and `profile-photo` upload support
before publishing this frontend.
The account form sits directly below the page title and subtitle, without an
outer card. It also shows the same plan, validity countdown, creation/update
dates and Event 24h activation action as the Home account information view;
both surfaces share the same component and checkout flow.

Delivery **1B** adds an event-settings overlay, opened by the settings icon
on each non-archived card. **Configuración** reuses each mechanic's existing
editor and goals; **Condiciones de recompensa** edits only supported conditions.
STACK reuses its existing completion, ranking, score and manual-raffle rules,
OR groups and AND allocations, selecting only prizes already in this event's
catalog. T1MER can change the top positions for an existing ranking reward;
other mechanics display their existing fixed conditions without a universal
victory-rule engine. T1MER's registration-only component is not mounted here.

The selected event is loaded from the owner API, never from the browser's
selected event. Only active events are editable; inactive/closing events
are read-only, including INFOCARDS generation, media and custom interactions.
Mechanics and conditions have independent saves, errors and draft guards.
Closing warns before discarding drafts and is blocked during writes.
INFOCARDS card layouts now persist with cards in the existing server blob.
Server settings take precedence; the new editor does not import historical
browser-only RULET4 settings automatically.

The operational home's former configuration entry is now **Registro y acceso**:
it retains registration, participant links and the existing integration, but
does not mount or save mechanics, prize catalogs or raffles. Prize catalogs and
manual raffles are managed through the event administration panels described
in delivery 1C. The catalog no longer edits conditions; catalog saves preserve
server-side rules.
Publish the matching game/shared-layer and INFOCARDS/quiz backend changes before
this frontend. These local changes do not perform a deployment.

Delivery **1C** adds prize assignment and raffle administration and a unified
participant delivery flow. On an available STAND award, the verified email
address receives the award and Apple/Google Wallet links when those providers
are configured. A failed email does not block the prize QR or Wallet pass;
the email status is visible and can be retried. Kivly awards retain their Kivly
Wallet link. Configure SES and optional provider credentials in the backend
before expecting email or provider passes; no credentials belong in this
frontend. Deploy the backend 1C stack before publishing this frontend.

The **Configurar partida** overlay uses horizontal sections for **Configuración**,
**Condiciones** and **Premios y sorteo**. The last section contains manual raffle
operations and links to the dedicated **Administración > Premios** panel. That
panel owns the organizer-wide prize catalog; names and images are shared across
the organizer's events. Physical inventory is managed inline in that same panel;
only optional event caps and conditions remain event-specific. Inactive events
remain read-only in their event settings, but general inventory remains editable.

Delivery **1D** adds **Clientes** to the authenticated administration. It
groups only existing participants with a verified email, within the operator,
and shows their all-game participation and persisted prize history. Kivly
assignment, email status and STAND collection are distinct; the UI does not
infer external Kivly redemption. Points, levels and campaigns are not included.
Deploy the matching backend and complete its explicit historical-index
migration before publishing this frontend. Publishing remains a separate,
authorized step. Public `/play/:gameId` and `/redeem/:gameId` routes and
explicit billing return URLs are unchanged.

Deploy the backend's complete owner-game listing, including `playerCount`,
before publishing this
frontend when an owner's games can span multiple DynamoDB pages. Local checks
do not deploy either repository or verify live Kivly behavior.

---

## Quick start

```bash
npm install
# Dev: copy .env.example → .env.development and fill dev API + Cognito client (see below)
npm run dev
```

- **Build:** `npm run build`
- **Preview:** `npm run preview`
- **Lint:** `npm run lint`

---

## Kivly identity review

In the authenticated event settings, open **Jugadores → Revisar identidades Kivly** to load pending identity reviews. Compare the participant and club profile with the participant before selecting **Revisar identidad → Confirmar identidad y vincular**. Loading or opening a review never changes an identity. Registration validation cannot be bypassed.

The client uses authenticated `GET /v1/game/kivly/registrations?gameId=...` (`{requests:[{requestId,username,email,phone,customer:{name,email,phone},state:"review_required"}]}`) and `POST` to the same URL with only `{requestId}`; approval requires `{ok:true}`. The backend owns identity resolution and authorization. Pending registrations preserve the verified code and respect the server's `retryAfter` delay before allowing verification retries.

STACK reentry never creates another attempt for an assignment already marked started, finished, or excluded. It can recover a locally stored final submission only for the same player and attempt ID; without recoverable evidence it displays that the attempt cannot be restarted.

Reward emails remain `blocked` (not queued) until the Kivly reward assignment is confirmed. `accepted` means SES accepted the email, not confirmed inbox delivery. Operators may retry only `failed` emails, never blocked or uncertain (`reconciliation_required`) sends.

## Tech stack

| Layer        | Tech |
|-------------|------|
| UI          | React 18, TypeScript |
| Build       | Vite |
| Styles      | Tailwind CSS |
| Routing     | React Router v6 |
| Auth        | AWS Cognito (OAuth2 + PKCE) |
| Backend     | Stand backend (API Gateway + Lambda); see [stand-backend](https://github.com/adrisanpu/stand-backend) |

---

## Environment variables

Vite loads env files by mode:

| File | When used |
|------|-----------|
| [`.env.development`](.env.development) | `npm run dev` (dev API + Cognito client) |
| `.env` | Optional overrides (gitignored) |
| [`.env.example`](.env.example) | Template for prod and dev values |

Required variables: `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_API_BASE_URL`.

### Environments (prod vs dev)

| | **Prod** | **Dev** |
|---|----------|---------|
| API host | prod API Gateway id | dev API Gateway id (different `execute-api` URL) |
| URL path | `/prod` | `/prod` (same stage name; isolation is by API id + `stand-dev-*` data) |
| Backend stack | `stand-backend-prod` | `stand-backend-dev` |
| Cognito | Same User Pool; **prod** App Client | Same pool; **dev** App Client |
| Local UI | `.env` or prod build vars | `.env.development` |
| Hosted UI | playstand.app (Amplify env vars) | dev.playstand.app (separate Amplify app) |

Full setup (AWS, Cognito, Amplify, deploy): **[stand-backend/docs/DEV_ENVIRONMENT.md](../stand-backend/docs/DEV_ENVIRONMENT.md)**.

- **Local:** copy [`.env.example`](.env.example) → `.env.development` or `.env.development.local` (gitignored).
- **Hosted:** [`amplify.yml`](amplify.yml) + `VITE_*` in the Amplify console (see backend guide §5).

---

## Project structure

```
stand-frontend/
├── public/           # Static assets (logos, pages like privacy.html, legal.html)
├── src/
│   ├── auth/         # Cognito IdP (in-app login), tokens, protected routes, user hook
│   ├── api/          # API client (base URL, auth headers)
│   ├── core/         # App shell, game gate, settings, ranking, quiz, raffle, theme, types
│   ├── games/        # One folder per game (config + GameScreen)
│   ├── pages/        # Login, BillingSuccess, BillingCancel
│   ├── styles/       # Global styles (e.g. glow.css)
│   ├── App.tsx       # Routes and auth provider
│   └── main.tsx
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## Games (in this frontend)

Each game is a **module**: `src/games/<game-id>/` with `config.ts` (game definition + theme + assets) and `GameScreen.tsx` (UI and logic). They are registered in `src/games/index.ts`.

| Game       | Description |
|-----------|-------------|
| **empareja2** | Pair matching: Web registration → find partner → validate together on mobile |
| **t1mer**    | Stop a hidden timer at 10s; score by accuracy |
| **l3tras**   | Word formation game |
| **rulet4**   | Configurable roulette with ranking |
| **cupido**   | Quiz-based matching; traffic light + couple validation (backend stats/validate) |
| **semaforo** | Groups by social interest (e.g. red/yellow/green); backend stats |
| **STACK** | Mobile 3D block stacking (blocks, pizza or pistachio baklava skin): one server-started attempt, validated results and event ranking |

Backend APIs used by games (e.g. validate, score, stats) are implemented in [stand-backend](https://github.com/adrisanpu/stand-backend).

Appearance logo uploads use `src/api/userMedia.ts`: request a signed URL from `POST /v1/user/media?action=upload-url`, upload the raw file to that URL with `PUT` and its `Content-Type` (not multipart form data), then register and select the logo only after the upload succeeds.

### Game mode and participant access

The `/home` Players panel displays **Jugadores** on the left and the player count on the right of the same vertically centered row, with larger text in both standard and compact layouts. Plan limits, limit warnings and prize details remain visible.

STACK `/home` uses the shared event layout: stacked panels in narrow, portrait or short viewports, and logo/players/raffle, central QR and ranking columns when at least 1024px wide and 600px high in landscape. Explicit `portrait`/`forcePortrait` URL options and saved orientation preferences take precedence. Content can scroll vertically instead of being clipped; headings and the QR adapt to the available space. Other games keep their existing orientation defaults.

STACK `/play` keeps the shared participant shell, safe areas, keyboard-aware viewport and vertical scrolling. Its player header can wrap, the canvas scales with the viewport, and ranking prize overlays remain scrollable from the top even on short screens. Resizing does not restart an attempt or recreate the scene.

**Settings > Premios** assigns entries from the shared prize catalog to validation, ranking and raffle slots. Names and images are edited only in **Administración > Premios**; slot limits and ranking positions stay specific to each event. The shared catalog supports optional PNG images (maximum 5 MB); file selection remains a draft until the catalog is saved. Legacy prize entries are migrated to shared definitions on first catalog access.

Prize images accompany their names on `/home` and participant results without replacing redemption QRs. The `/play` registration form advertises configured validation and ranking prizes before the fields, including both when present, but never advertises raffle prizes there. A raffle already won still appears with its image and QR in the participant's results. Prizes without images keep their text-only presentation, custom names are not translated, and images use `object-contain` rather than cropping.

The shared prize catalog is stored on the authenticated organizer account using durable image keys, not base64 data or saved presigned URLs. Game assignments retain optional event-specific caps and conditions, not independent physical inventory after general inventory activation; edits to shared names/images propagate to existing assignments. Signed read URLs are regenerated by authenticated/public metadata reads; the participant page refreshes its prize metadata while mounted without restarting gameplay or clearing registration fields. Deploy the compatible backend routes and storage permissions before publishing this frontend. Local implementation does not deploy either project.

### General prize inventory

**Administration > Prizes** combines the catalog and inventory in one flat
list: each STAND row has name/image editing, removal, balance management and
movements alongside its counters. Kivly rows keep their external identity and
inventory actions without exposing STAND catalog editing. No duplicate catalog
list or separate inventory heading is rendered. `GET /v1/prizes/inventory` reports STAND/Kivly
origin, initialized physical availability (including a genuine zero), total
assigned (`assigned + historicalAssigned`), explicit `canjeados`, historical
breakdown, and active event names with their optional caps. Uninitialized stock
is not shown as zero. Unknown Kivly redemptions (`canjeados: null`) remain unknown.

Initialize sets **current physical available stock**, never the sum of previous
event stocks. Replenish adds a positive integer; adjust applies a signed integer
delta without allowing a negative balance. Every operation requires a reason.
Writes send `requestId` and `expectedRevision`; uncertain retries keep the exact
payload and request ID until the draft changes. Conflicts require reloading
balances, not blindly resending a new operation.

Legacy mode retains previous per-event stock until explicit activation. Opening
the panel automatically imports every pending game in the response `imports`
map, including archives and games with no current catalog, in either inventory
mode. All pages are consumed sequentially without page-by-page clicks; already
complete imports are skipped. A failed game does not prevent other games from
importing. Errors and unmatched history remain visible, with retry controls and
no automatic retry loop. Import cursors are opaque strings retained for retries
while mounted. Reopening safely restarts pending imports using backend
idempotency, without double-counting or debiting available stock.
Activation remains explicit and is disabled until all imports finish, unresolved records are zero and
all assigned prizes are initialized. Confirmation explains that every event will
share the same units and new uninitialized prizes cannot be awarded.

Movement details use cursor pagination. Event/kind/unit-state filters apply only
to **loaded rows**, not the entire server history; loading more keeps earlier rows.
STACK displays read-only `globalInventory` availability separately from the
optional per-event cap (`stockTotal: null` means unlimited). Native settings read
general inventory alongside the shared catalog. No event settings edit global
stock; Kivly reward creation/editing and STAND shared selection are preserved.
Zero caps, exhausted shared stock and uninitialized stock have explicit operator
explanations; STACK allocation history also displays backend `inventoryReasons`.
Native participant claims display compact `prizeUnavailable` reasons without
inventing an award or blocking gameplay, and refresh them with existing polling.
STACK prize results similarly display aggregated `stackPrizes.inventoryReasons`
for omitted awards, including uninitialized stock, exhausted stock and event caps.
Legacy EMPAREJA2 and STACK sessions also show STAND `nativePrizes` after inventory
cutover without requiring lifecycle metadata; original award QR tokens are preserved.
The frontend requires the matching inventory backend contract; these changes
do not deploy either project.

Operator `/home` has an **ES / EN** selector immediately to the left of the settings close button. It changes the home, catalog, game controls and settings interface without resetting gameplay, saving settings or losing form drafts. Spanish is the initial language; the choice lasts while the home remains mounted, including when closing and reopening settings. Event/player names, custom prizes, editable game content and unknown server messages are not translated. The operator's language is independent of each participant's `/play` selection.

All games use mobile gameplay and Web participant access (`playMode: mobile`, `joinChannel: web`). Home **Registro y acceso** presents these fixed settings instead of offering master-screen or Instagram access choices. **Guardar y aplicar cambios** saves registration/access only; mechanics save independently from administration. Participant limits are unchanged. Full name and verified email are required; registration settings can show an optional phone field. Existing game records with older access settings are read as mobile/Web without requiring a data migration.

Participant access is always the Web registration form. Instagram is not collected as participant contact data and does not provide game access. Optional profile photos remain available.

EMPAREJA2 `/play` shows the selected client logo (or the game logo if none is selected) centered above and outside the assigned-character image panel. **Te toca** overlays the image at the upper left and the character name at the lower right, both on contrasting backgrounds. The mission panel includes a small partner image when available. The own validation code stays hidden until **Validar pareja** is pressed. Mobile play shows the non-editable own code and an input for the partner's code on the same screen. Client branding requires the public game's optional `clientLogoUrl`; partner images require the optional `partnerCharacterImageUrl` assignment field. Deploy the compatible backend first.

Once the pair is validated, EMPAREJA2 `/play` stays on the final prize screen without internal back links or a **Validar otra pareja** button, including when restoring an already validated session. Prize QRs, delivery updates and the language selector remain available. Browser Back navigation is not blocked.

Events with missing or legacy `playMode`/`joinChannel` values resolve to mobile/Web. The home uses a selected client logo if present, otherwise the game's own logo, in both orientations; the Stand footer is unchanged. Publish the compatible backend before this frontend.

Saving **Configurar aspecto** persists primary/accent colors and dark/light mode through the authenticated user-media API before applying local settings. EMPAREJA2, T1MER and STACK public metadata include this owner appearance alongside the selected client logo, so `/play` uses the owner's palette, not a participant browser's unrelated settings. All participant buttons and action links (registration, validation, back, retry, results and game controls) use primary/accent theme variables, including translucent backgrounds and borders. Error and success indicators retain their semantic colors. Previously browser-only palettes must be saved again once to publish them to participants. Saving/restoring reports API errors without claiming success or reloading.

Participant `/play` panels have an **ES / EN** selector overlaid inside the upper-right corner (Spanish initially), with an accessible label but no visible language label. It translates interface text, instructions, local validation messages and accessibility labels immediately, without resetting forms, gameplay, or the participant session. Character/player names, event names and unrecognized server error messages remain unchanged. The registration privacy link opens the existing policy in the selected language. Selection lasts while the participant page remains mounted; other operator screens are unaffected.

RULET4 configuration is loaded from and saved to `type.RULET4` through the game API.
Legacy browser-only settings are offered for migration on explicit save only when
no server configuration exists. Spins use server-selected, persisted results on
both the operator screen and `/play`; the wheel animates the returned snapshot
and index. A lost response can be retried without generating a second result.
Reloading a participant session restores its result.

The participant registration form shows the selected client logo centered at the top, falling back to the game's logo when none is configured, instead of displaying the event name.

Web registration always requires email verification, including legacy games with email disabled. **Enviar código / Send code** sends registration fields, consent and participant language (`es`/`en`) to `POST /v1/public/email/request`. The pending step retains the details and consent in memory, shows the masked email, and accepts a six-digit code including leading zeros, paste and one-time-code autofill. Codes expire after 10 minutes with at most 5 attempts; the server remains authoritative. Resend uses the captured registration details and current consent, waits for the server's `resendAvailableAt` (normally 60 seconds), and respects rate-limit retry delays. **Cambiar datos / Change details** discards the local challenge before editing.

Registration asks for **Nombre completo / Full name** first, then mandatory email. Phone is optional and shown only when `phone.enabled` is true; legacy required-phone settings show it without making it mandatory. Blank phones are omitted. Names are trimmed, limited to 100 Unicode characters without control characters, and captured server-side with the email challenge; final verification cannot replace them. The name appears in public rankings. Names need not be unique, and verified recovery never renames an existing player.

Final email registration sends only `{ gameId, challengeId, code }` to `/v1/public/join`; no player session is saved or gameplay opened before that succeeds. Challenges and raw verification codes are never stored in browser storage. Expired, exhausted, replaced or used challenges require a new code or editing details; verification and delivery errors are translated into Spanish/English. Deploy the compatible backend before publishing this frontend; local tests do not certify actual email delivery.

### Kivly: connection and player registration

The home STACK prize configurator retains its searchable assignment catalog,
optional event caps and Kivly reward flows. Physical inventory is shared after
general inventory activation. STAND prizes are selected from
the shared catalog; their names and images are managed in **Administración >
Premios**. Rule editing has moved to the event settings overlay in administration.
Each rule contains alternative **OR groups**, with
**AND prizes** inside each group. Choose uniformly among groups with some
available stock, then deliver the available units of the chosen group.
Fully exhausted groups are excluded; quantities and shared stock remain
independent. Changes stay drafts until the sticky save action succeeds.

Home settings > **Integraciones** is a compact list with a collapsible Kivly entry.
Disconnected accounts show credentials and Connect; connected accounts show the
local business, Disconnect, [Kivly login](https://getkivly.com/auth/login), and a
shared club website field. New connections initialize club name and STAND legal
links automatically; existing club details are preserved. The club website is
shared across all the organizer's STACK games, separate from the login URL.
Credentials are cleared and never stored in the browser. Disconnect requires
confirmation. STACK shows only Connected/Not connected, not a demo mode;
loading, errors and retries remain explicit. Other games do not require Kivly.

When the backend publishes `loyalty` metadata, `/play` requires separate, explicit club consent. Its `consentVersion` is bound to the email challenge. The backend registers or reuses the customer only after email verification; unresolved registration blocks access without claiming success. Changed terms discard the challenge and require consent again. Legacy sessions rejected for missing club membership/consent return to registration.

All games register in three steps: email, other data and consent, then email
verification. The first step is local; code delivery starts only after the
second step. Controls retain STAND branding and theme. Existing verification,
expiry, resend and recovery protections remain in place.

STACK keeps its piece selector and static 3D block preview visible, with speed
and tolerance controls inside collapsed **Ajustes avanzados**. **Cerrar juego**
unifies definitive closure and final prizes, allowing active attempts to finish;
excluding pending attempts requires another confirmation. Promotional stickers
slide through prize images/names: all prizes in `/play`, completion prizes in
Players, ranking prizes in Ranking, raffle prizes in Raffle. They have pause/
next controls and respect reduced motion. After a confirmed result, a compact
official club-wallet action appears below the scene and before earned prizes.
Earned cards show image/name and their individual STAND QR or delivery status,
not the promotional carousel. Kivly assignment remains server-side; uncertain
writes are not replayed. No passes or Kivly rewards are created or redeemed.
Phone is shared only when supplied for a new customer. Live registration,
reward and wallet effects still require separately authorized tests.

After valid, active game metadata is loaded, an explicitly rejected saved participant session (`InvalidPlayerToken` or `PlayerNotFound`, HTTP 401/403/404) is cleared only for that game and returns to Web registration, requiring a new email code when configured. Network failures, throttling, server errors, unknown rejections and invalid game metadata retain the saved session and existing error/retry behavior.

All `/play` steps share the same outer panel and branding header: registration, assignment, validation, results and recovery/error states. The selected client logo (or game fallback once metadata is available) and overlaid ES/EN selector remain in the same position when moving between panels; inner views do not add duplicate logos or nested outer cards.

No logo is rendered until metadata for the current game has resolved. The client logo is selected first; only a confirmed absence uses the game's logo, avoiding a default-logo flash during loading or navigation between games.

### STACK integration status (Phase 5: local validation complete, physical devices pending)

Create a STACK event in the existing operator catalog, configure it through the game settings, and open its participant link (`/play/:gameId`). Registration, branding, operator layouts and API clients reuse the existing platform. After the scene loads, EMPEZAR consumes the player's single attempt on the server. Tap the canvas or use COLOCAR to stop the active block. Movement alternates X/Z, overhangs fall away, dimensions shrink, and no overlap ends the match. Each valid placement scores one block; Perfect snaps within the configured tolerance without adding a bonus point. The base scores zero.

All games use the existing `/home` game view as their single event screen. There is no separate public display screen; legacy `/display/:gameId` links redirect to `/home`, using the existing operator login and selected-event flow. Participants keep their separate `/play/:gameId` links. STACK uses the supplied `public/images/stack-logo.png` logo in the catalog, event layout and the horizontally centered mobile identity header.

Deploy the matching Phase 3 backend before playing. Public getGame advertises `stackStartSnapshot: true` and `stackFinishSupported: true`; if either is absent, the start button stays disabled rather than consuming an attempt against an older backend. The existing public score endpoint accepts `{ action: "start", attemptId, gameId, playerToken }`, returns `startedAt` and its authoritative `configSnapshot`, and consumes the attempt atomically. Only a confirmed response starts gameplay with those rules. A network retry retains the same identifier; conflicting/rejected starts are shown explicitly. Refreshing retrieves server state rather than granting or resuming a match. There is no practice/restart button after consumption.

Game Over reuses the shared result presentation extracted from T1MER and sends `{ action: "finish", attemptId, gameId, playerToken, placements }` to the same endpoint. Each placement contains its axis, signed pre-snap offset and Perfect flag, including the final miss. The browser does not submit a claimed score: the server recomputes it using the attempt's original configuration, checks replay and timing coherence, and finalizes the result atomically. This is basic validation, not proof that a client-provided replay came from genuine human play.

The result remains visibly pending until the server confirms a saved score and rank. Network failures expose a retry button that resends identical evidence, never starts another attempt, and cannot overwrite a different finalized result. Only final evidence is retained in per-game sessionStorage while awaiting confirmation; this is not a gameplay checkpoint. After a refresh in the same tab, server state is fetched first: a finished score is displayed directly, or matching pending evidence can be resubmitted without resuming gameplay. If the tab/session data is lost before confirmation, an abandoned attempt is not restored. Storage failures are shown explicitly. The existing `/home` ranking polls saved results, ordered by blocks descending with deterministic tie-breaking.

STACK loads its Three.js renderer lazily and requires a real WebGL 2 context. It uses frame-time-based movement and a vertically following orthographic camera, with low-cost reusable materials/geometries and resource cleanup. Placement is blocked while another placement is in progress. Manual pause, focus/visibility and context-loss handling preserve the same attempt without advancing hidden time. Mobile device validation and the later LG Swing/webOS 24 implementation remain pending. Automated renderer mocks are not evidence of physical iOS/Android GPU compatibility. No audio is added.

The Phase 4 visual finish keeps the same gameplay, collision bounds, Perfect tolerance and score contract. The mobile HUD uses the existing theme, centered logo/profile header, a warm stage background and brief score/Perfect feedback. Perfect still scores exactly one block and never grants extra surface. Decorative HUD animations respect `prefers-reduced-motion`; they do not affect gameplay timing or input. No additional dependencies, external asset requests or backend deployment are required for the visual update.

Piece assets are generated locally in `src/games/stack/stackVisuals.ts`. The operator picks the skin in the game settings (`settings.stack.skin`, default `blocks`): logo-coloured blocks per layer, pizza (rounded dough, toasted crust, deterministic DataTexture with cheese, tomato, pepperoni and herbs) or pistachio baklava (glazed phyllo top with a crushed-pistachio mound and a layered side texture with a green filling band). The skin is visual only. Retained pieces and falling offcuts preserve the original surface coordinates rather than stretching or regenerating the toppings after each cut. Shared assets and reusable per-piece buffers are disposed with the scene. A short Perfect halo respects pause and reduced-motion preferences; warm lighting and smooth camera tracking follow the actual support position.

Phase 4 checks include automated asset/resource tests and real headless Chrome WebGL 2 rendering through SwiftShader at emulated 390x844 and 320x844 viewports, with no horizontal overflow or browser runtime errors. These local checks used a deterministic animation clock and substituted API responses, not a real participant attempt. They do not establish physical mobile GPU performance, Safari compatibility or webOS support.

#### Final compatibility checks (2026-10-16)

| Surface | Executed check | Status / limitation |
| --- | --- | --- |
| Chrome 155 / Edge 155, Windows | Real headless WebGL 2 through SwiftShader, actual React UI and engine in StrictMode | Passed; both are Chromium, not Safari or a mobile GPU |
| Portrait / landscape / 16:9 | 320x844, 390x844, 844x390, 1920x1080; DPR 3 capped at 1.5 | No horizontal overflow; base/active bounds also covered by tests; 16:9 rendering does not certify TV support |
| Input | Native browser touch and Enter on the focused COLOCAR button; pause/resume; secondary-pointer rejection tests | Passed; no LG remote/Magic Remote hardware verification |
| Context / lifecycle | Real `WEBGL_lose_context` loss and restoration, no duplicate start; no-ResizeObserver fallback; teardown | Passed; owned buffers/shared skin textures and animation callbacks released; Three's internal placeholder textures remain context-owned until collection |
| Long match | 300 Perfect placements, stable GPU buffer/texture allocation after warm-up, 91 draw calls in final observed frame | Passed resource-bounds check; accelerated animation clock/software rendering is **not** an FPS measurement |
| Error / accessibility | No-WebGL incompatibility before start, failed final submission and retry, reduced-motion styling | Passed with substituted API responses; real dev API persistence/idempotency/ranking verified separately in Phase 3 |
| Safari iOS / Chrome Android | Physical touch, backgrounding, rotation, safe areas, memory and sustained FPS | **Pending physical devices** |
| LG Swing, webOS 24 | Browser/WebGL capabilities, touchscreen, OK/Enter, focus/navigation and distance readability | **Deferred** from the agreed initial mobile scope; no webOS certification |

The final checks do not require a backend redeploy: Phase 3 is already deployed to dev and exposes both STACK capability flags. Frontend production assets build successfully, but production publication is a separate authorized step; no production deployment has been performed.

Before event/production sign-off, use a fresh **test event** on physical iOS and Android devices: complete a match and confirm the `/home` ranking and post-refresh score; verify one-attempt enforcement, touch accuracy, pause/background/resume, rotation and safe-area buttons; retry after a connection loss at Game Over. Measure sustained frame times and memory on the lowest-spec target device, including a long match and repeated route entry/exit. Never reset real participants' attempts for these checks. Record device/OS/browser versions and observed performance; a stable 60 FPS target cannot be asserted from desktop software-rendering checks.

---

## Authentication

- **Flow:** In-app login UI (`/login`) → Cognito `USER_PASSWORD_AUTH` → tokens in `sessionStorage` (`stand_tokens`) → bootstrap `POST /v1/user` → `/home`.
- **Plans:** FREE, EVENT_24H, ENTERPRISE (feature gating in the app).
- **API:** Requests use `Authorization: Bearer <id_token>`; see `src/api/api.ts`.

---

## Adding a new game

Start here for the full end-to-end checklist:

- [`docs/new-game-playbook.md`](docs/new-game-playbook.md)

1. **Add folder** `src/games/your-game/` with:
   - `config.ts` — `GameDefinition` (id, name, colors, assets, `GameScreen`, optional `showRanking`, optional `GameConfigComponent`).
   - `GameScreen.tsx` — React component with props `gameId`, `gameName` (see `GameScreenProps` in `src/core/types.ts`).
2. **Register** in `src/games/index.ts`: import config and add it to the `games` array.
3. **Assets** (logos, etc.) go under `public/` or paths referenced in `assets` in config.

---

## Repo and branches

- **Remote:** [stand-frontend](https://github.com/adrisanpu/stand-frontend) (frontend repo).
- **Branches:** `main`, `dev` (tracked with `origin`).
- **Backend:** Separate repo [stand-backend](https://github.com/adrisanpu/stand-backend); deploy and config there.

### Branch flow and merge

| Target | Merge method | Deploy |
|--------|--------------|--------|
| PR → `dev` | **Squash merge** (only method enabled) | Amplify app for `dev.playstand.app` (branch `dev`) |
| `main` | **Squash merge** (same repo setting) | Amplify prod (`playstand.app`) |

CI: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs `npm run build` on PRs to `dev` and `main`. Full workflow (agents, cross-repo): [stand-backend/docs/DEVELOPMENT_WORKFLOW.md](https://github.com/adrisanpu/stand-backend/blob/dev/docs/DEVELOPMENT_WORKFLOW.md).

---

## Author & license

Developed by **Adria Sanchez Puig**. MIT License © 2025 — free to use and modify with attribution.
