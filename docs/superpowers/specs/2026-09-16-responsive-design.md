# Responsive design for phone and tablet

**Date:** 16 September 2026
**Status:** approved, in progress
**Scope:** `frontend/` — every dashboard surface, phone and tablet

## The problem

The app is built at one width. Measured, not guessed:

- 30 responsive utilities across 13 files, in an app with 15 routes and 59 components.
- 47 hardcoded pixel widths across 22 files.
- `app/layout.tsx` exports `metadata` but **no `viewport`**, so a phone renders the
  page at ~980px and scales it down. This alone accounts for most of "it looks
  very poor" — it is not merely cramped, it is zoomed out.
- `app/(dashboard)/layout.tsx` is `flex h-screen` with `<AppSidebar>` always
  rendered at 260px — 65% of a 400px screen before any content exists. There is
  no drawer.
- `h-screen` rather than `h-dvh` fights the mobile address bar. The auth layout
  already uses `h-dvh` correctly.

## Decisions

### Navigation: hamburger drawer

Chosen over a bottom tab bar. The existing sidebar's contents map 1:1 to a
drawer with no information-architecture redesign, and a tab bar would
permanently cost ~56px directly above the composer — the worst place to lose
vertical space on a chat screen.

### CSS decides layout; JS only handles behaviour

A `useMediaQuery` hook picking one layout in JS is rejected: the server cannot
know the viewport, producing either a hydration mismatch or a visible flash of
the desktop layout on every load. Instead both trees render and CSS hides one.
JavaScript covers only genuinely stateful behaviour — closing the drawer on
navigation, locking body scroll.

### Breakpoints: stock Tailwind, nothing custom

`@theme` overrides no breakpoints, and the code already treats `lg` (1024px) as
the desktop line — `WorkspaceContextPanel` is `hidden lg:flex`. Keep that; add
`md` (768px) as the drawer line.

| Width | Navigation | Workspace columns |
|---|---|---|
| `< 768px` phone | Drawer | 1 — content only |
| `768–1023px` tablet | Drawer | 2 — workspace nav + content |
| `≥ 1024px` desktop | Sidebar, unchanged | 3, unchanged |

**Nothing at or above `lg` changes.** The desktop layout staying pixel-identical
is the primary regression guard.

## Two shared primitives

Rather than scattering mobile behaviour across 59 components, everything routes
through two new pieces:

1. **`<SidebarContent>`** — extracted from `app-sidebar.tsx`, rendered twice:
   inside today's `<nav>` for desktop and inside the drawer for mobile. One
   implementation, two containers; a nav item added later appears in both.
2. **`components/ui/sheet.tsx`** — Radix Dialog, centred modal at `≥md` and
   bottom sheet below. `confirm-dialog`, `connect-repo-dialog`,
   `upload-confirm-dialog` and `logout-dialog` migrate onto it.

`@radix-ui/react-dialog` and `framer-motion` are already dependencies, so both
arrive without adding anything to `package.json`.

## Phases

Each phase is independently shippable. After phase 1 the app is usable on a
phone; later phases improve it without blocking a demo.

### Phase 1 — Foundation and shell

1. `viewport` export in `app/layout.tsx`: `width=device-width`, `initialScale=1`,
   `viewportFit=cover` (the last enables safe-area insets for notches and the
   iOS home indicator).
2. `h-screen` → `h-dvh` in the dashboard layout.
3. Touch targets in `globals.css` under `@media (pointer: coarse)` — keyed to
   the pointer, not the viewport, so a tablet with a trackpad keeps the tight
   desktop sizing while a phone gets 44px controls. Covers `.icon-btn`,
   `.rail-item`, `.auth-input`, `.dialog-input`, `.cmdk-item`, `.menu-item`.
4. `.page-header` padding responsive — `18px 32px` is a fifth of a phone screen.
5. `mobileNavOpen` in `ui-store.ts`, deliberately **not** persisted, matching the
   store's existing rule: "never an open dialog". Closes on route change.
6. Extract `<SidebarContent>`; `<AppSidebar>` becomes `hidden md:flex`; add
   `<MobileTopBar>` and `<MobileNavDrawer>` at `md:hidden`.

**Expect the app to look worse after step 1 and better only after step 6.** The
viewport tag makes the real 400px width apply, so every hardcoded width starts
to bite. That is the fix working.

### Phase 2 — Chat

- Thread `px-6` → `px-4 sm:px-6`; the `max-w-[768px]` column is already correct.
- ~~The composer's two dropdowns become bottom sheets below `md`.~~
  **Corrected during implementation:** they do not clip. The composer's inner
  width at a 390px screen is ~318px, so the 260px and 220px menus both fit.
  No work needed.
- The real overflow is the **toolbar row**: attach (44px) + agent selector
  (~95px) + thinking toggle (~85px) + voice (44px) + send (44px) ≈ 328px
  against ~318px available — and Phase 1's 44px touch targets made it worse.
  Fixed by hiding the agent and thinking *labels* below `sm`, keeping their
  icon and colour dot, plus `min-w-0` on the left cluster and `shrink-0` on
  send so the send button can never be pushed off-screen.
- **iOS zoom:** the composer textarea is `text-[14px]`, and Safari auto-zooms any
  focused input under 16px. Fix with 16px under `(pointer: coarse)`. Never
  `maximum-scale=1` — that breaks pinch-zoom for people who need it.
- Composer needs `env(safe-area-inset-bottom)` padding so the on-screen keyboard
  and home indicator do not cover it.

### Phase 3 — Workspace

- `WorkspaceContextPanel` already does the right thing; leave it.
- `WorkspaceSidebar` (`w-[264px]`) becomes `hidden md:flex`; its contents move
  into a second drawer using the same sheet mechanism.
- The context panel gets a phone route back via a "Context" button opening it as
  a bottom sheet. It is not decorative — inside a conversation it becomes
  `ConversationContextControl`, the knowledge-context control. Hiding it on
  mobile would remove a feature.

**Corrected during implementation** — four things this spec got wrong:

1. ~~A slim `md:hidden` bar on the workspace shell.~~ Not needed. *Both* views
   already have their own headers (`dashboard-view.tsx:164`,
   `conversation-view.tsx:482`), so the drawer and Context triggers go into
   those, costing zero extra vertical space instead of ~112px of stacked chrome.
2. ~~The workspace drawer carries the five tabs.~~ It does not. `dashboard-view`
   already renders its own tab row, so putting them in the drawer too would be
   pure duplication on the one screen with least room. The drawer carries only
   what is genuinely sidebar-only: switcher, search, conversations.
3. **`components/ui/sheet.tsx` moved from Phase 4 to Phase 3** — the context
   panel needs a bottom sheet now. `MobileNavDrawer` was migrated onto it too,
   so there is one drawer implementation rather than two. Phase 4 keeps only the
   dialog migrations.
4. **Phase 1's touch-target rule had a hole.** `.icon-btn` was covered, but
   `<Button>` uses `cva` classes — `sm` is `h-7 px-3` and `icon-sm` is `h-7 w-7`,
   both 28px, and the `(pointer: coarse)` block never reached them. Fixed
   centrally by adding a `touch-target` marker to `buttonVariants`' base string.

Two live bugs found and fixed while working here, both pre-existing:

- `workspace-sidebar.tsx:80` computed active state with `pathname.includes("tab=")`,
  which can never be true in App Router — `pathname` excludes the query string.
- `bookmark-button.tsx`'s `compact` variant is `opacity-0 group-hover:opacity-100`.
  A touchscreen has no hover, so that control was invisible on a phone.

And one defect introduced then caught before it shipped: `useSearchParams()` in
`workspace-mobile.tsx` sat outside any Suspense boundary. Every other caller in
this app is wrapped by its *page* — but this drawer is mounted from a *layout*,
which has none. That fails at build time and type-check cannot see it. The query
read now lives in its own `CloseOnNavigate` component behind
`<Suspense fallback={null}>`, matching `w/[workspaceId]/page.tsx` and
`search/page.tsx`.

### Phase 4 — Overlays and sweep

- Command palette: `.cmdk-content` is already `width: min(560px, calc(100vw - 32px))`,
  so only `top: 16%` and `max-height: 340px` need tuning for short screens.
- Document viewer: already `fixed inset-0 … p-4` with a `w-full` panel; needs
  `p-0` on phones and a wrapping header toolbar.
- Library is already responsive (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4
  2xl:grid-cols-5`); only gutters and one `min-w-[200px]` search field.
- `repos`, `search`, `settings`, `knowledge`: fixed-width panels (`w-[340px]`,
  `w-[320px]`, `w-[304px]`, `w-[290px]`) become `w-full md:w-[Npx]`; list rows
  get a card layout below `md`.

**Corrected during implementation:**

1. ~~The `knowledge` surface needs a sweep.~~ **It is dead code.**
   `knowledge/page.tsx` is a redirect stub (`router.replace("/w")`), and
   `DocumentsPanel`, `GeneratePanel` and `KnowledgeChat` are each declared in
   their own file and imported nowhere. So `w-[290px]` and `w-[340px]` — two of
   the four fixed-width panels this spec named — render on no live route and
   need nothing. Two gutter edits were made to `knowledge-chat.tsx` before this
   was discovered; they are harmless and left in place, but they are not work.
2. ~~The dialogs must become bottom sheets.~~ Downgraded to optional polish.
   `confirm-dialog` is `w-full max-w-[400px] … px-4`, so at 390px it already
   renders as a 358px card. It is not broken — it simply is not a bottom sheet.
   `components/ui/sheet.tsx` exists and they can migrate onto it whenever that
   is wanted; nothing is blocked on it.
3. **The command palette was genuinely broken on a short screen**, which this
   spec under-stated as "tuning". `top: 16%` plus a 340px list plus input,
   scope row and footer is ~500px of chrome against a 390px landscape viewport.
   Now bounded by `min(340px, 45dvh)` with the panel moving to `top: 8px` below
   620px of height.
4. **The document viewer carried the same `vh` bug as the dashboard layout** —
   `height: min(88vh, 100%)`, unnoticed when Phase 1 fixed `h-screen`. Now
   `88dvh`. Its header also packed ~342px of fixed controls at 390px; the zoom
   cluster and the Download label now fold away below `sm`.
5. **`repos/[repoId]` had an unresponsive `grid-cols-3`** of vertical stat
   cards — ~78px of content each at 390px. Now `grid-cols-2 sm:grid-cols-3`.

What Library actually needed: one gutter. Its header, stat row, tab list and
search field already sit in `flex-wrap` containers that fold correctly.

### What the closing sweeps caught

Three repo-wide greps — `h-screen|\d+vh`, bare `px-8`, and ungated
`w-[NNNpx]` — found four real bugs that per-file work had missed. They are
worth re-running after any future layout change.

- **`AppShellSkeleton` was `h-screen` with an ungated `w-[260px]` sidebar.**
  This is the first paint on every hard load, so a phone showed a 260px column
  the loaded app no longer has, at a height taller than the visible viewport.
  Phase 1 fixed `h-screen` in the dashboard layout and missed its skeleton twin
  one file away; its sibling columns at `skeleton.tsx:308` and `:323` were
  already gated, which is what made the gap visible.
- **`workspace-search.tsx` had `pt-[12vh]` and `max-h-[52vh]`** — the same
  overlay-geometry problem as the command palette, in a sibling component never
  examined. Fixed at the same time as the palette would have been, had the
  sweep run earlier.
- **`document-viewer.tsx:462` was `px-8 py-8 sm:px-12`** — an `sm:` was present
  but the *base* was wrong, so a phone got 32px gutters. Glanced at once and
  wrongly cleared.

The same sweeps also *cleared* work this spec had assumed was needed:
`prompt-navigator`'s 304px panel sits inside a `hidden lg:block` root and never
reaches a phone; the auth layout's 900px orbs are clipped by an
`overflow-hidden` parent; and the composer, account and workspace dropdowns
measure under 390px.

### Verification actually performed

- `pnpm type-check` after every pass — clean throughout.
- `pnpm exec eslint` scoped to touched files after every pass — clean.
- **The served CSS bundle was fetched and grepped**, because type-check never
  looks at CSS and an invalid Tailwind arbitrary variant fails silently. This
  proved `touch-target`, the `(pointer: coarse)` block, `drawer-in`, `sheet-up`,
  `composer-input`, `safe-area-inset-bottom`, `min(340px, 45dvh)` and the
  `620px` short-screen query all reached the browser.
- **`pnpm build` was never run.** The dev server held :3000 for the whole
  session, and building over it corrupts the shared `.next`. So the Next 15
  prerender behaviour of the `Suspense`-wrapped `useSearchParams()` in
  `workspace-mobile.tsx` is structurally correct but **not proven by execution**.
  Run a build in a window where `pnpm dev` is stopped before deploying.
- No visual verification was performed by the author. Static checks prove it
  compiles and that the CSS exists; they say nothing about whether it looks
  right at 390px.

## Verification

`package.json` declares vitest and playwright, but there is no config and no test
files, so those scripts verify nothing and are not cited here.

- `pnpm type-check` and `pnpm lint` (the latter needs `.next` added to eslint
  `ignores`, which it currently lacks — it reports thousands of errors from
  generated build output).
- Width matrix: 390px, 414px, 768px, 1024px, 1440px.
- Three hard rules:
  1. No horizontal scroll on `<body>` at any width.
  2. 44px minimum touch targets on coarse pointers.
  3. The `≥1024px` layout is pixel-identical to before.
