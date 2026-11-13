# Dashboard rules

## Design tokens, never literals

The look has to be swappable in one place: font, palette, radius, theme. So:
- `src/styles/tokens.css` is the only file that holds a colour, font family, type size, radius or ring value;
- `src/index.css` maps those variables into Tailwind's `@theme` and nothing else;
- components use the token-backed utilities only: `bg-surface`, `text-fg-muted`, `text-label`, `rounded-card`, `font-mono`, `border-status-failed`;
- no hex, `rgb()`, `hsl()`, `oklch()` or `color-mix()` outside `tokens.css`;
- no `px` values, no arbitrary utilities (`text-[13px]`, `bg-[#fff]`, `w-[312px]`), no `style={...}`;
- no Tailwind default palette or scale for anything the tokens cover: `bg-blue-500`, `text-sm`, `rounded-lg`, `font-[Inter]` all bypass the theme;
- need a value that has no token? Add a semantic token to `tokens.css` (light and dark) and map it in `index.css`. Name it for its role (`--color-status-awaiting`), never for its value (`--color-amber`);
- a status or tone maps to classes in one lookup (see `StatusBadge`'s `TONE_CLASSES`), not in ternaries scattered across components.

Spacing and layout utilities (`p-6`, `gap-3`, `max-w-6xl`) come from Tailwind's spacing scale and are allowed.

`src/tokens.guard.test.ts` enforces the literal rules. Don't weaken it, don't add exclusions to get a change through. A new kind of literal slipping past it is a bug in the guard: extend the guard first.

## Separation of concerns

Each layer has one job and only knows the layer below it.

- **Data source**: one module per feature turns the outside world into typed domain objects. Today that is `runs/sampleRun.ts` reading `contracts/`; later it is the orchestrator API client. Nothing else imports `contracts/`, calls `fetch`, or knows a URL.
- **Types**: `<feature>/types.ts` holds the domain shapes. No React, no formatting.
- **Pure logic**: formatting, status mapping, sorting and derivations live in plain `.ts` files (`format.ts`, `status.ts`) with no React import, and each gets a unit test.
- **Presentational components**: render props, emit callbacks. No data loading, no app state, no business rules beyond picking what to show.
- **Containers**: `App` and the `<Feature>Section` components own state and wire data source to components. State lives as high as it is shared and no higher.
- **Shell**: `shell/` and `navigation/` know about sections, never about runs, graphs or candidates.

Dependency direction:
- features never import from each other. `runs/` does not reach into `graph/` and back;
- `shell/` never imports a feature;
- a component two features need moves to `src/ui/`, which imports nothing feature-specific;
- styling stays in tokens and utilities, never in logic files.

One file, one reason to change. If a change to the API shape, a copy tweak and a colour swap would all touch the same file, split it.
