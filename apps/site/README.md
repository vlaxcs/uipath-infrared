# Netpotu product page

The page that presents Netpotu, plus `#/tokens`, where the design tokens are tuned. Spec: `docs/spec.md` section 19. From 1024 px up the vertical scroll moves the page sideways (`src/components/HorizontalTrack.tsx`); below that, or with reduced motion, it is a plain vertical page.

The pitch deck template is a second page at `/pitch/` (`pitch/index.html`, `src/pitch/`), spec section 21. Its text lives in `src/pitch/copy.ts`; every `todo(...)` there shows on the page as a dashed placeholder.

```
npm install
npm run dev
```

- `src/tokens.css` is the only source of colours, fonts, text sizes and radii, named by role. Text uses the `type-*` classes. Tune them on `#/tokens`, press "Copy tokens.css", paste over the file.
- `src/tokens.ts` lists the text and background pairs; `npm test` fails when one drops below WCAG AA.
- `src/content.ts` holds every string in RO and EN.

Checks: `npm run lint`, `npm run typecheck`, `npm test`.
