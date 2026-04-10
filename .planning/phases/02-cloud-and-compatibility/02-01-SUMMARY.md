---
phase: 02-cloud-and-compatibility
plan: "01"
subsystem: auth
tags: [clerk, tanstack-query, auth, toolbar]
dependency_graph:
  requires: []
  provides: [auth-provider, user-menu, use-current-user-hook]
  affects: [src/main.tsx, src/ui/Toolbar.tsx]
tech_stack:
  added: ["@clerk/react@6.2.1", "@tanstack/react-query@5.97.0", "html-to-image@1.11.13"]
  patterns: ["ClerkProvider wraps app root", "Show component for auth-gated rendering (Clerk v6)", "modal-mode sign-in to keep canvas uninterrupted"]
key_files:
  created:
    - src/auth/AuthProvider.tsx
    - src/auth/AuthModal.tsx
    - src/auth/useCurrentUser.ts
    - src/components/toolbar/UserMenu.tsx
    - .env.local.example
  modified:
    - src/main.tsx
    - src/ui/Toolbar.tsx
    - package.json
    - .gitignore
decisions:
  - "Use Clerk v6 Show component instead of removed SignedIn/SignedOut components"
  - "Pin html-to-image to 1.11.13 via pnpm overrides to prevent accidental upgrades"
  - "modal-mode SignInButton keeps user on canvas — no page navigation on auth"
metrics:
  duration: "~12 minutes"
  completed: "2026-04-09"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 4
---

# Phase 2 Plan 01: Clerk Auth Integration Summary

Clerk v6 auth layer installed with ClerkProvider + QueryClientProvider wrapping the React root; UserMenu in toolbar shows a "Sign In" button (modal, no navigation) when signed out and Clerk's UserButton avatar when signed in.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install deps and wire AuthProvider | 5025ad6 | src/auth/AuthProvider.tsx, src/main.tsx, package.json |
| 2 | Auth UI components and UserMenu | 4ceda65 | src/auth/AuthModal.tsx, src/auth/useCurrentUser.ts, src/components/toolbar/UserMenu.tsx, src/ui/Toolbar.tsx |

## Verification Results

- `pnpm exec tsc --noEmit`: PASSED (zero errors)
- `pnpm build`: PASSED (dist/ produced successfully)
- All artifact files present and contain expected exports
- UserMenu wired into Toolbar right group with placeholder comment for future plans

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Clerk v6 removed SignedIn/SignedOut components**
- **Found during:** Task 2, TypeScript check
- **Issue:** Plan specified `import { SignedIn, SignedOut }` from `@clerk/react` but Clerk v6.x removed these named exports entirely. TypeScript reported: `'"@clerk/react"' has no exported member named 'SignedIn'`.
- **Fix:** Replaced `<SignedIn>` / `<SignedOut>` with `<Show when="signed-in">` / `<Show when="signed-out">` — the Clerk v6 replacement API. Added a code comment in AuthModal.tsx documenting the v6 change.
- **Files modified:** src/auth/AuthModal.tsx
- **Commit:** 4ceda65 (included in task commit, no separate fix commit needed)

## Known Stubs

None. Auth components render real Clerk UI. Without a `VITE_CLERK_PUBLISHABLE_KEY` in `.env.local` the ClerkProvider renders a warning in the console but does not crash the app or block the editor — consistent with the plan's opt-in auth requirement.

## Self-Check: PASSED

Files verified present:
- FOUND: src/auth/AuthProvider.tsx
- FOUND: src/auth/AuthModal.tsx
- FOUND: src/auth/useCurrentUser.ts
- FOUND: src/components/toolbar/UserMenu.tsx
- FOUND: .env.local.example

Commits verified:
- FOUND: 5025ad6 (Task 1)
- FOUND: 4ceda65 (Task 2)
