# Stand — Frontend

Web app for **Stand**: a modular game platform for events, fairs, and social gatherings. Users log in, create or join game instances, and run interactive games (pair matching, timers, quizzes, raffles, etc.) that talk to the **Stand backend** (API + Lambdas).

This repo is the **frontend only**. Backend lives in a separate repo: [stand-backend](https://github.com/adrisanpu/stand-backend).

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

**Settings > Premios** supports an optional, independent PNG image for each validation, ranking and raffle prize (maximum 5 MB per image). The image control sits between the prize name and its numeric parameters, with preview, replacement and removal. File selection only edits the draft; **Guardar** uploads and publishes the catalog to the game backend, and failures keep the draft open with an error. Existing locally configured prize names and limits are published when saved; a server catalog takes precedence over that legacy cache.

Prize images accompany their names on `/home` and participant results without replacing redemption QRs. The `/play` registration form advertises configured validation and ranking prizes before the fields, including both when present, but never advertises raffle prizes there. A raffle already won still appears with its image and QR in the participant's results. Prizes without images keep their text-only presentation, custom names are not translated, and images use `object-contain` rather than cropping.

The prize catalog is stored per game using durable image keys, not base64 data or saved presigned URLs. Signed read URLs are regenerated by authenticated/public metadata reads; the participant page refreshes its prize metadata while mounted without restarting gameplay or clearing registration fields. Deploy the compatible backend routes and storage permissions before publishing this frontend. Local implementation does not deploy either project.

Operator `/home` has an **ES / EN** selector immediately to the left of the settings close button. It changes the home, catalog, game controls and settings interface without resetting gameplay, saving settings or losing form drafts. Spanish is the initial language; the choice lasts while the home remains mounted, including when closing and reopening settings. Event/player names, custom prizes, editable game content and unknown server messages are not translated. The operator's language is independent of each participant's `/play` selection.

All games use mobile gameplay and Web participant access (`playMode: mobile`, `joinChannel: web`). Game configuration presents these fixed settings instead of offering master-screen or Instagram access choices. Game rules still save together through **Guardar y aplicar cambios**; participant limits are unchanged. Email and phone are the configurable participant contact fields. Existing game records with older access settings are read as mobile/Web without requiring a data migration.

Participant access is always the Web registration form. Instagram is not collected as participant contact data and does not provide game access. Participant registration uses a required display username and the configured email/phone fields; optional profile photos remain available.

EMPAREJA2 `/play` shows the selected client logo (or the game logo if none is selected) centered above and outside the assigned-character image panel. **Te toca** overlays the image at the upper left and the character name at the lower right, both on contrasting backgrounds. The mission panel includes a small partner image when available. The own validation code stays hidden until **Validar pareja** is pressed. Mobile play shows the non-editable own code and an input for the partner's code on the same screen. Client branding requires the public game's optional `clientLogoUrl`; partner images require the optional `partnerCharacterImageUrl` assignment field. Deploy the compatible backend first.

Once the pair is validated, EMPAREJA2 `/play` stays on the final prize screen without internal back links or a **Validar otra pareja** button, including when restoring an already validated session. Prize QRs, delivery updates and the language selector remain available. Browser Back navigation is not blocked.

Events with missing or legacy `playMode`/`joinChannel` values resolve to mobile/Web. The home uses a selected client logo if present, otherwise the game's own logo, in both orientations; the Stand footer is unchanged. Publish the compatible backend before this frontend.

Saving **Configurar aspecto** persists primary/accent colors and dark/light mode through the authenticated user-media API before applying local settings. EMPAREJA2, T1MER and STACK public metadata include this owner appearance alongside the selected client logo, so `/play` uses the owner's palette, not a participant browser's unrelated settings. All participant buttons and action links (registration, validation, back, retry, results and game controls) use primary/accent theme variables, including translucent backgrounds and borders. Error and success indicators retain their semantic colors. Previously browser-only palettes must be saved again once to publish them to participants. Saving/restoring reports API errors without claiming success or reloading.

Participant `/play` panels have an **ES / EN** selector overlaid inside the upper-right corner (Spanish initially), with an accessible label but no visible language label. It translates interface text, instructions, local validation messages and accessibility labels immediately, without resetting forms, gameplay, or the participant session. Character/player names, event names and unrecognized server error messages remain unchanged. The registration privacy link opens the existing policy in the selected language. Selection lasts while the participant page remains mounted; other operator screens are unaffected.

The participant registration form shows the selected client logo centered at the top, falling back to the game's logo when none is configured, instead of displaying the event name.

Web registration requires email verification whenever `participantFields.email.required` resolves to true (including legacy defaults). **Enviar código / Send code** sends the enabled registration fields, consent and participant language (`es`/`en`) to `POST /v1/public/email/request`. The pending step retains the details and consent in memory, shows the masked email, and accepts a six-digit code including leading zeros, paste and one-time-code autofill. Codes expire after 10 minutes with at most 5 attempts; the server remains authoritative. Resend uses the captured registration details and current consent, waits for the server's `resendAvailableAt` (normally 60 seconds), and respects rate-limit retry delays. **Cambiar datos / Change details** discards the local challenge before editing.

Registration always requires **Nombre de usuario / Username**, alongside any configured email and phone fields. Names are trimmed, limited to 100 Unicode characters without control characters, and captured server-side with the email challenge when email is requested; resend preserves them and final verification cannot replace them. New players use the name for participant display and rankings. Usernames need not be unique, and verified recovery never renames an existing player. Existing session recovery still works for legacy participants without names, preserving their existing display fallback. Profile photos remain optional.

Final email registration sends only `{ gameId, challengeId, code }` to `/v1/public/join`; no player session is saved or gameplay opened before that succeeds. Challenges and raw verification codes are never stored in browser storage. Expired, exhausted, replaced or used challenges require a new code or editing details; Verification and delivery errors are translated into Spanish/English. No-email forms still submit enabled fields and consent directly. Deploy the compatible email-request and verified-join backend before publishing this frontend; local tests do not certify actual email delivery.

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
