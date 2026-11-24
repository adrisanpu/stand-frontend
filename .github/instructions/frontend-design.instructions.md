---
description: Visual design direction and quality bar for Stand frontend UI
applyTo: "src/**/*.{tsx,css}"
---

# Frontend design

Use the [Frontend Design skill](https://agenticskills.io/skills/frontend-design) as a process guide for substantial user-visible UI changes, not as a runtime dependency. Small functional fixes should preserve the existing visual patterns.

Stand serves three distinct contexts: operators preparing and running live games, participants joining on phones, and audiences viewing event screens. Identify the user and primary action for the surface being changed; make the event's game and participant experience the focal point rather than adding generic dashboard decoration.

Use the design tokens in `src/styles/glow.css` for the operator and account surfaces:

- Harbor ink `#152F3A` for navigation and strong text.
- Field canvas `#F0F3EF` and Chalk `#FFFFFF` for work surfaces.
- Signal coral `#B84833` for primary actions.
- Scoreboard green `#236B59` for success and active states.
- Spotlight amber `#88620F` for caution.

Keep the existing system sans stack for interface text and the bundled Segment7 face for game timers/scores. Use sentence case, concise user-facing labels, and clear action names. Avoid decorative all-caps labels, generic gradient backdrops, identical card grids, and motion that does not communicate a user-triggered change.

Before a substantial visual implementation, outline a compact palette, type roles, layout concept, and principles for the specific surface. Check that the choices fit the live-event context instead of falling back to a generic template. Preserve the existing route, data, and interaction behavior while implementing the revised design.

Keep operator/account styling scoped to its surface. `ThemeProvider`, per-game appearance settings, and client-selected event colors must continue to control participant and display experiences; do not replace those palettes with the fixed operator colors.

Preserve responsive layouts, visible keyboard focus, readable contrast, reduced-motion support, game-screen orientation/scaling, and touch-friendly controls. Prefer existing components and dependencies; add neither dependencies nor broad abstractions solely for visual styling.
