# Dev environment validation checklist

Run after implementing [stand-backend/docs/DEV_ENVIRONMENT.md](../../stand-backend/docs/DEV_ENVIRONMENT.md).

## Backend

- [ ] Secrets `stand/dev/stripe` (and optional `stand/dev/instagram`) exist
- [ ] Cognito dev App Client created; `REPLACE_WITH_DEV_CLIENT_ID` updated in `samconfig.toml`
- [ ] `sam build` && `sam deploy --config-env dev` succeeds
- [ ] Stack outputs include `GameApiUrl` ending with `/prod` (dev API id, not prod API id)
- [ ] DynamoDB tables `stand-dev-*` exist; prod tables unchanged

## Frontend local

- [ ] `.env.development` has dev `VITE_API_BASE_URL` and dev `VITE_COGNITO_CLIENT_ID`
- [ ] `npm run dev` → login works; Network requests go to dev API host `...amazonaws.com/prod`
- [ ] Create a test game; data appears only in dev tables

## Frontend hosted (dev.playstand.app)

- [ ] Amplify app built with dev `VITE_*` (redirect URIs use `https://dev.playstand.app/...`)
- [ ] Custom domain resolves; login completes

## Prod safety

- [ ] `sam deploy --config-env prod` — changeset has **no** `Replacement` on tables/APIs (empty or metadata-only)

## Optional

- [ ] Stripe test checkout from dev UI
- [ ] `python scripts/populate_empareja2_catalog.py --table stand-dev-catalog-table`
