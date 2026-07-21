# stand-frontend

## WHY
React 18 + TypeScript operator dashboard. Operators create/manage games; players join via Instagram/QR.
Auth uses Cognito in-app (`USER_PASSWORD_AUTH` via IdP API). All API calls go through the central api.ts client.

## WHAT
**Commands:** `npm run dev` | `npm run build` | `npm run test`

**Auth flow:** Login UI → Cognito IdP → tokens in sessionStorage as `stand_tokens`
- Send **idToken** (NOT accessToken) as Bearer — backend validates `sub` from ID token
- `getIdToken()` from `src/auth/authStorage.ts` — api.ts uses this automatically
- `useAuth()` — session flags + `setAuth` / `logout`; plan/user via `useCurrentUser()`
- `cognitoClient.ts` — SignUp / ConfirmSignUp / InitiateAuth / ForgotPassword

**API client** (`src/api/api.ts`): `api.get(path)` | `api.post(path, body)` | `api.put(path, body)` | `api.delete(path)`

**Env:** `VITE_*` — see `.env.example`; dev setup in [stand-backend/docs/DEV_ENVIRONMENT.md](../stand-backend/docs/DEV_ENVIRONMENT.md)

**CI / workflow:** PR to `dev` → `npm run build` in Actions; Amplify deploys `dev` branch. Agent + human process: [stand-backend DEVELOPMENT_WORKFLOW.md](https://github.com/adrisanpu/stand-backend/blob/dev/docs/DEVELOPMENT_WORKFLOW.md).

**Game IDs (UPPERCASE):** T1MER, RULET4, L3TRAS, EMPAREJA2, CUPIDO, SEMAFORO, INFOCARDS, IMPOSTOR
Canonical game id strings: `normalizeGameType()` in `src/core/gameTypeMap.ts` (used by `src/core/shell/AppShell.tsx`)

**Game module structure** (`src/games/<id>/`):
- `index.ts` — exports GameDefinition (id, name, type, colors, components)
- `GameScreen.tsx` — main player-facing game component
- `GameConfig.tsx` — operator configuration panel

**Operator game UI** (margins, layout tokens, validation): [`docs/operator-game-ui.md`](docs/operator-game-ui.md)

## HOW
- **Agent rules:** workspace [software-rule.md](../software-rule.md) + [infrastructure-rule.md](../infrastructure-rule.md)
- Register new game: add GameDefinition to `src/games/index.ts`, wire routing in `src/core/shell/AppShell.tsx`
- Feature gates: `getFeaturesByPlan(plan)` from `src/auth/featureFlags.ts`
- Plans: `'free'` (1 game, 25 players) | `'event'` | `'enterprise'` (unlimited)
- Storage rule: auth tokens → sessionStorage; gameId/gameName/gameType → localStorage
- Never import api.ts without using the exported `api` singleton
