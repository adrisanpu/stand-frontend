# stand-frontend

## WHY
React 18 + TypeScript operator dashboard. Operators create/manage games; players join via Instagram/QR.
Auth uses Cognito PKCE OAuth2. All API calls go through the central api.ts client.

## WHAT
**Commands:** `npm run dev` | `npm run build` | `npm run test`

**Auth flow:** Cognito PKCE → tokens in sessionStorage as `stand_tokens`
- Send **idToken** (NOT accessToken) as Bearer — backend validates `sub` from ID token
- `getIdToken()` from `src/auth/authStorage.ts` — api.ts uses this automatically
- `useAuth()` hook from `src/auth/AuthContext.tsx` — provides user, plan, loading

**API client** (`src/api/api.ts`): `api.get(path)` | `api.post(path, body)` | `api.put(path, body)` | `api.delete(path)`

**Env vars:** `VITE_COGNITO_DOMAIN` | `VITE_COGNITO_CLIENT_ID` | `VITE_COGNITO_REDIRECT_URI` | `VITE_API_BASE_URL`

**Game IDs (lowercase):** empareja2, t1mer, rulet4, l3tras, semaforo, infocards, cupido
Canonical game id strings: `mapGameTypeToId()` in `src/core/gameTypeMap.ts` (used by `src/core/shell/AppShell.tsx`)

**Game module structure** (`src/games/<id>/`):
- `index.ts` — exports GameDefinition (id, name, type, colors, components)
- `GameScreen.tsx` — main player-facing game component
- `GameConfig.tsx` — operator configuration panel

**Operator game UI** (margins, layout tokens, validation): [`docs/operator-game-ui.md`](docs/operator-game-ui.md)

## HOW
- Register new game: add GameDefinition to `src/games/index.ts`, wire routing in `src/core/shell/AppShell.tsx`
- Feature gates: `getFeaturesByPlan(plan)` from `src/auth/featureFlags.ts`
- Plans: `'free'` (1 game, 25 players) | `'event'` | `'enterprise'` (unlimited)
- Storage rule: auth tokens → sessionStorage; gameId/gameName/gameType → localStorage
- Never import api.ts without using the exported `api` singleton
