---
description: React, TypeScript, API, authentication, and storage conventions
applyTo: "src/**/*.tsx"
---

# React and TypeScript

- Reuse existing components and hooks. Keep changes focused and accessible.
- Use the `api` singleton from `src/api/api.ts` for backend requests. It adds the ID token automatically; do not call `fetch` or add another HTTP client for API Gateway calls.
- Direct `fetch` is reserved for non-API-Gateway flows already used by the project, such as the Cognito OAuth token exchange and binary uploads to presigned URLs.
- Use `useAuth()` for authentication state and actions; use `useCurrentUser()` for the backend user, plan, loading state, and user-fetch errors.
- Store auth tokens only through `src/auth/authStorage.ts` in `sessionStorage`. Do not put tokens in `localStorage`.
- Persist game selection and operator preferences in `localStorage` only where the existing feature does so; handle malformed persisted JSON without crashing.
- Use `getFeaturesByPlan()` from `src/auth/featureFlags.ts` for plan-based feature limits.
- Keep input validation at user/API trust boundaries. Preserve visible error handling for failed requests and writes.
- Add or update a focused test for non-trivial logic and user-visible regression fixes.
