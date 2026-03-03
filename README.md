# Stand — Frontend

Web app for **Stand**: a modular game platform for events, fairs, and social gatherings. Users log in, create or join game instances, and run interactive games (pair matching, timers, quizzes, raffles, etc.) that talk to the **Stand backend** (API + Lambdas).

This repo is the **frontend only**. Backend lives in a separate repo: [stand-backend](https://github.com/adrisanpu/stand-backend).

---

## Quick start

```bash
npm install
# Create a .env file with the variables listed in "Environment variables" below
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

Create `.env` in the project root:

```env
# Cognito
VITE_COGNITO_DOMAIN=your-domain.auth.region.amazoncognito.com
VITE_COGNITO_CLIENT_ID=your-client-id
VITE_COGNITO_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_COGNITO_LOGOUT_URI=http://localhost:5173/logout

# Backend API (Stand backend)
VITE_API_BASE_URL=https://your-api-gateway-url.amazonaws.com/prod
```

---

## Project structure

```
stand-frontend/
├── public/           # Static assets (logos, pages like privacy.html, legal.html)
├── src/
│   ├── auth/         # Cognito OAuth, PKCE, protected routes, user hook
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
| **empareja2** | Pair matching: QR → Instagram DM code → find partner → validate together |
| **t1mer**    | Stop a hidden timer at 10s; score by accuracy |
| **l3tras**   | Word formation game |
| **rulet4**   | Configurable roulette with ranking |
| **cupido**   | Quiz-based matching; traffic light + couple validation (backend stats/validate) |
| **semaforo** | Groups by social interest (e.g. red/yellow/green); backend stats |

Backend APIs used by games (e.g. validate, score, stats) are implemented in [stand-backend](https://github.com/adrisanpu/stand-backend).

---

## Authentication

- **Flow:** Login → `/auth/start` (PKCE) → Cognito → `/auth/callback` → tokens in `sessionStorage` → bootstrap via `POST /users` → redirect to `/app`.
- **Plans:** FREE, EVENT_24H, ENTERPRISE (feature gating in the app).
- **API:** Requests use `Authorization: Bearer <id_token>`; see `src/api/api.ts`.

---

## Adding a new game

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

---

## Author & license

Developed by **Adria Sanchez Puig**. MIT License © 2025 — free to use and modify with attribution.
