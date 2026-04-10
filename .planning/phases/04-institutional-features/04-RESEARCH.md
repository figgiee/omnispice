# Phase 4: Institutional Features - Research

**Researched:** 2026-04-10
**Domain:** LTI 1.3 (Core + Deep Linking + AGS) on Cloudflare Workers, declarative lab engine, client-side PDF/LaTeX reports
**Confidence:** HIGH overall; MEDIUM on LTI Moodle quirks and html2canvas+KaTeX interaction (needs validation in build)

## Summary

Phase 4 is bounded and unusually well-decided by CONTEXT.md. Research confirmed every locked decision is achievable with the existing Cloudflare-only stack — no vendor swap, no new infrastructure primitives — provided the LTI 1.3 implementation is **hand-rolled** on top of `jose` and Web Crypto. The popular `ltijs` library is Express-bound, depends on MongoDB via Mongoose, `got`, `body-parser`, `cookie-parser`, `helmet`, and `jsonwebtoken` — none of which run on Workers. Its use is impossible and a hand-rolled path is cheaper than porting. `jose` (panva) explicitly targets Cloudflare Workers, supports `createRemoteJWKSet` with built-in caching, and pairs directly with Web Crypto for tool-side signing of Deep Linking responses and AGS bearer tokens.

The three non-LTI pillars are all executable with libraries already pinned in `package.json` or trivially additive: **jsPDF 3.0.2 + html2canvas** for the PDF, **JSZip 3.10.1** for the LaTeX `.zip` bundle, **Zod 4.3.6** for lab-JSON validation and predicate DSL parsing (chosen over Valibot despite bundle size because the lab editor is not a size-sensitive surface and Zod's ecosystem and error messages are better for authoring UX; Valibot is still a reasonable alternative if a planner flags bundle growth as an issue). Clerk session minting is a solved problem: `@clerk/backend` 3.2.8 is already installed and running in `worker/src/routes/me.ts`, and `signInTokens.createSignInToken` is the correct API for the LTI-launch → Clerk-session exchange.

The critical unknowns are all operational, not architectural: (a) Canvas and Moodle are actively shipping away from third-party cookies, and the OIDC login initialization step needs the 1EdTech LTI Client Side postMessages fallback for reliable iframe launch across browsers; (b) the KaTeX→html2canvas rasterization path has known quirks and should be de-risked with a spike in the first plan, not assumed. Everything else is straightforward execution work.

**Primary recommendation:** Build Phase 4 as **six plans** — Wave 0 scaffold, LTI platform registration + OIDC login init, LTI launch + Clerk session mint + AGS score service, guided lab data model + predicate evaluator + runtime UX, lab editor UX + reference waveform pipeline, PDF/LaTeX report export. The AGS retry queue lives inside plan 3 as a Cron-triggered Worker. Do **not** attempt Blackboard/D2L testing in Phase 4 — architecture stays LMS-agnostic but certification is deferred per the locked decision.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**LTI 1.3 core architecture**
- Self-host LTI 1.3 Core + Deep Linking + AGS inside the existing Cloudflare Worker (Hono). No managed LTI SaaS.
- First-class LMS targets: Canvas + Moodle. Canvas-first; Moodle-second.
- Blackboard Learn Ultra and D2L Brightspace: compatible, not certified. Architecture must not hard-code Canvas/Moodle quirks, but Phase 4 does not budget for Blackboard/D2L sandbox work.
- LTI endpoints live in the existing `worker/` Hono app. New routes under `/lti/*`. No separate Worker.
- Storage: D1 stores LTI platform registrations, deployment IDs, iss/client_id/deployment_id tuples, JWKS cache, nonce store (TTL), line item → assignment mapping. R2 stores any binary artifacts if needed.

**LTI auth bridge to Clerk**
- LTI launch mints a Clerk session via Worker exchange. Flow: LMS → `POST /lti/launch` → Worker verifies id_token (JWKS fetch per-iss, nonce check, issuer/audience/deployment validation) → Worker calls Clerk Backend API to look up or create a user keyed by `sub@iss` → Worker mints a short-lived sign-in token → SPA boots pre-authenticated.
- One Clerk identity per (iss, sub) tuple. Same student launching from two different LMSes gets two Clerk accounts unless they manually link.

**LMS grade passback (AGS)**
- LTI AGS is used for grade posting. A Phase 4 `LineItem` is created per assignment at deep-link time; submissions post a `Score` on grade. Scope claims: `.../lti-ags/scope/lineitem`, `.../lti-ags/scope/score`.
- Grade sync triggered by existing `PATCH /submissions/:id/grade` calling `ltiAgsService.postScore()` iff submission originated from an LTI launch. Non-LTI submissions unchanged.
- Grade sync failures recorded in D1 (`lti_score_log`) and retried in a Cron Worker — dropping a grade silently is unacceptable.

**Guided lab data model**
- Structured JSON lab format, authored in an in-app editor. A lab is versioned JSON stored in R2 with D1 metadata. Schema is owned by the OmniSpice codebase, not a third-party spec.
- Declarative checkpoint predicates with tolerance and pass/partial/fail semantics. No JS sandbox, no arbitrary expressions. Initial predicate kinds: `node_voltage`, `branch_current`, `waveform_match` (rmse|max_abs), `circuit_contains`, `ac_gain_at`.
- Partial credit: weighted checkpoints, total = weighted sum of passed + 0.5 × partial.
- Evaluation is pure TypeScript over the simulation result object. No eval, no `new Function`, no dynamic code.
- Reference waveforms generated by simulating instructor-authored reference circuit at lab-save time, stored in R2 as CSV. No live reference sim at checkpoint-time.

**Guided lab runtime UX**
- Side panel with current step, instructions (marked+DOMPurify — same as Phase 3), and checkpoint status chips (✓ / ⚠ / ✗).
- Running a simulation auto-evaluates all checkpoints in the current step. Students can re-run freely.
- Lab editor and lab runner are separate React routes under `/labs/*`.

**Lab report export**
- PDF-first via jsPDF + html2canvas. A dedicated React `ReportLayout` composes schematic PNG (from existing Phase 2 export utility), waveform images, KaTeX-rendered measurements, and instructor/student annotations.
- LaTeX export ships as its own Phase 4 plan after the PDF flow proves out. Generate `.tex` source client-side, bundle with a `figures/` folder, download as `.zip`. No server-side Tectonic in Phase 4.
- Paper sizes: US Letter and A4. Default derived from browser locale.

**Non-goals for Phase 4**
- No cross-LMS "universal installer" UI beyond a docs page with platform-required URLs/keys.
- No analytics dashboards for lab completion rates.
- No authoring UI for AGS line-item editing inside the LMS (just create line items at deep-link time).

### Claude's Discretion
- Exact Hono route structure under `/lti/*`.
- Specific LTI TypeScript library choice (or hand-rolled JOSE-based verification) — researcher evaluates. **Research conclusion: hand-rolled on `jose` — see LTI library evaluation below.**
- D1 schema column names / nonce TTL durations within reasonable bounds.
- Lab editor UI component breakdown.
- Number of built-in predicate kinds beyond the seed list.
- Whether to use Cloudflare Queues or a Cron Worker for AGS retry. **Research conclusion: Cron Worker polling `lti_score_log` is simpler than Queues for this volume — see AGS retry section.**
- Paper size and font choices in the PDF report.

### Deferred Ideas (OUT OF SCOPE)
- Blackboard Learn Ultra and D2L Brightspace full certification
- LTI Names and Role Provisioning Services (NRPS)
- Server-side LaTeX → PDF compilation (Tectonic/pdflatex in a Cloudflare Container)
- Lab analytics dashboards
- Auto-generated lab report narrative from Circuit Insights
- Multi-language lab authoring
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LMS-01 | OmniSpice supports LTI 1.3 Deep Linking for embedding assignments in Canvas, Blackboard, Moodle | LTI 1.3 Core + Deep Linking hand-rolled on `jose` on Workers; D1 tables for platform registration, deployment IDs, nonce store; signed Deep Linking response returning `content_items` including `lineItem` property to create the AGS line item at deep-link time |
| LMS-02 | Completed assignments pass grades back to LMS gradebook via LTI AGS | AGS Score service (`POST {lineItem_url}/scores` with `application/vnd.ims.lis.v1.score+json`); bearer token obtained via client_credentials grant signed with tool's private key; triggered from existing Phase 3 `PATCH /api/submissions/:id/grade`; retry queue in D1 `lti_score_log` + Cron Worker |
| LMS-03 | Students launch OmniSpice assignments directly from LMS without separate login | OIDC login init → auth request → Worker verifies id_token → `clerkClient.users.getUserList({externalId})` or create → `clerkClient.signInTokens.createSignInToken({userId, expiresInSeconds: 60})` → HTML bootstrap redirects SPA to `/sign-in/ticket?__clerk_ticket=…` pre-authenticated |
| LAB-01 | Instructor can author a guided lab with step-by-step instructions and circuit checkpoints | Structured JSON lab schema validated with Zod; react-hook-form + @dnd-kit for step drag-reorder editor; checkpoint inspector panel per predicate kind; "try as student" preview toggle |
| LAB-02 | Student progresses through a guided lab with automatic checkpoint verification | Pure-TS predicate evaluator consuming existing `VectorData[]` from `src/simulation/protocol.ts` — no new IPC, no new sim path; side panel with ✓/⚠/✗ chips; auto-runs after each simulation |
| LAB-03 | Guided lab compares student waveforms against reference waveforms with tolerance | Reference CSV generated at lab-save time via existing ngspice Web Worker, uploaded to R2 at `labs/{lab_id}/references/{probe}.csv`; `waveform_match` predicate with `rmse` and `max_abs` metrics; linear interpolation to align student vs reference time grids |
| RPT-01 | User can export a lab report PDF with schematic, waveforms, annotations, measurements | jsPDF 3.0.2 `doc.html()` with `autoPaging: 'text'` or `'slice'` feeding a dedicated React `<ReportLayout>` DOM; schematic PNG reuses existing `exportSchematicAsPng` / `html-to-image` path; waveform PNG via uPlot canvas `toDataURL`; KaTeX rendered to PNG **in a pre-step**, not left as DOM (see html2canvas+KaTeX pitfall) |
| RPT-02 | Lab report export supports LaTeX format | Client-side `.tex` source generation from structured `ReportData`; figures packaged as PNG in `figures/`; bundled with `main.tex` into `.zip` via JSZip 3.10.1; download via anchor element + `URL.createObjectURL`; no server-side pdflatex in Phase 4 |
</phase_requirements>

## Standard Stack

### Core (already installed, reuse verbatim)
| Library | Installed Version | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| `@clerk/react` | 6.2.1 | Client auth UI, `useUser`, `useAuth().getToken` | Phase 3 proved the pattern; `signIn.create({strategy:'ticket', ticket})` consumes the LTI-minted ticket |
| `@clerk/backend` | 3.2.8 (in `worker/`) | Server-side Clerk API from Workers | `createClerkClient` already working in `worker/src/routes/me.ts`; `clerkClient.signInTokens.createSignInToken` mints the LTI ticket |
| `@hono/clerk-auth` | 3.1.1 | Hono middleware for Clerk JWT | Already wired into `/api/*` routes; LTI routes under `/lti/*` will **not** use it — LTI endpoints are publicly callable by the LMS and must NOT require a Clerk session on entry |
| `hono` | 4.12.12 | HTTP framework | Already the Worker's spine; add one route group `routes/lti.ts` and a service module `lti/` |
| `marked` | 15.0.12 | Markdown renderer for lab instructions | Same path as Phase 3 assignment instructions |
| `dompurify` | 3.3.3 | HTML sanitizer | Pair with marked, same as Phase 3 |
| `@dnd-kit/core` | 6.3.1 | Drag-reorder for lab-editor step list | Already in stack — no new drag library |
| `zustand` | 5.0.12 | Client state slices | Add `labStore` + `ltiStore` slices following Phase 3 `classroomStore` pattern in `src/store/` |
| `@tanstack/react-query` | 5.97.0 | Server state | New query keys: `['labs']`, `['lab', id]`, `['labAttempt', labId, userId]`, `['ltiPlatforms']` (admin-only) |

### New dependencies (add via pnpm)
| Library | Recommended Version | Purpose | Why Standard | Install Target |
|---------|---------------------|---------|--------------|----------------|
| `jose` | 6.2.2 | JWT verification, JWKS caching, RS256/ES256 signing | Only JOSE library that explicitly supports Cloudflare Workers via Web Crypto. Zero dependencies, tree-shakeable ESM, supports `createRemoteJWKSet` with built-in cache. Used across the LTI industry for hand-rolled tool providers. | `worker/` |
| `zod` | 4.3.6 | Runtime validation for lab JSON + predicate DSL + LTI request body parsing | Lab JSON is authored by humans — Zod's error messages drive the editor's inline validation UX. Worker-side LTI body parsing benefits from the same schemas to reject malformed deep-link responses early. Zod v4 is ~2x faster than v3 and adds Zod Mini (6.88 kB esbuild) for tree-shaken client builds. | both `worker/` and root |
| `jspdf` | 3.0.2 | PDF generation (html + autoPaging) | Already pre-approved in stack. jsPDF 3.0.2 ships `html()` with `autoPaging: 'text' \| 'slice'` for multi-page HTML-to-PDF and is the current LTS. **v4 exists but has breaking changes and a recent path-traversal security fix — pin to 3.0.2 to match stack pin; revisit v4 in Phase 5 polish.** | root |
| `html2canvas` | 1.4.1 | Rasterizes DOM to canvas for jsPDF `html()` | jsPDF's peer dep. Required for `doc.html()` path. | root |
| `katex` | 0.16.45 | Math rendering for measurement formulas | Pre-approved in stack. **Render KaTeX to PNG in a pre-pass**, not left as inline DOM — html2canvas struggles with KaTeX's CSS fonts (see pitfall). | root |
| `jszip` | 3.10.1 | Client-side `.zip` packaging for LaTeX export | Browser-compatible, promise-based, industry standard for client-side ZIP. File-system Access API is not cross-browser enough (Firefox + Safari gaps) — stick with JSZip + anchor download. | root |

### Versions verified 2026-04-10 via `npm view <pkg> version`

### Alternatives Considered
| Instead of | Could Use | Why Not |
|------------|-----------|---------|
| Hand-rolled on `jose` | `ltijs` | Express-only, depends on Mongoose (MongoDB), `got`, `body-parser`, `cookie-parser`, `helmet`, `jsonwebtoken`. None runs on Workers. Porting cost > hand-rolling cost for the Core+DL+AGS subset OmniSpice needs. |
| Hand-rolled on `jose` | `@1edtech/lti-tool` (speculative) | Not a published npm package as of 2026-04-10; search returned 404 on `@xenova/lti`. 1EdTech ships reference implementations in Java/PHP/Python, none in TS for Workers. |
| Zod v4 | Valibot | Bundle size ~10× smaller (1.37 kB vs 6.88 kB for similar schema) but slower at runtime and smaller ecosystem. Lab JSON validation is an authoring-time activity where developer ergonomics matter more than shipped bytes. Flag for reconsideration only if phase-5 bundle audit shows the editor chunk bloats. |
| Zod v4 | TypeBox + Ajv | 22× faster than Zod but requires a separate validator package and is harder to generate human-readable error messages from (matters for lab-editor UX). TypeBox is the right call for a hot API path, not for an authoring tool. |
| jsPDF + html2canvas | `@react-pdf/renderer` | React component-based, cleaner React API, but reimplements a layout engine and doesn't handle KaTeX or React Flow canvases at all — you'd be re-drawing the schematic from primitives. With jsPDF + html2canvas we reuse the existing DOM and the existing schematic PNG export. |
| JSZip | File System Access API | Not supported in Firefox/Safari — we want one code path, not two. JSZip covers all Chromebooks (the target device). |
| Cron Worker for AGS retry | Cloudflare Queues | Queues adds a second binding, a consumer handler, and per-message billing. For Phase 4's grade-post volume (< 100/min even at pilot scale) a Cron Worker polling `lti_score_log WHERE status='pending' AND next_attempt_at <= now()` is simpler and integrates directly with the existing D1. Revisit if AGS volume materially grows. |

**Installation:**
```bash
# Worker side (LTI backend)
cd worker
pnpm add jose zod

# Client side (lab + report)
cd ..
pnpm add zod jspdf html2canvas katex jszip
pnpm add -D @types/jszip
```

**Version verification:** All versions above confirmed via `npm view <pkg> version` on 2026-04-10.

## Architecture Patterns

### Recommended Project Structure

Phase 4 adds to existing Phase 3 layout — no restructure. Note that Phase 3's client code lives in `src/store/` + `src/cloud/` + `src/pages/` (there is **no** `src/classroom/` directory). Phase 4 follows the same convention.

```
worker/
├── src/
│   ├── index.ts                    # mount /lti/* route group (NOT under /api/*, no clerk middleware)
│   ├── routes/
│   │   ├── lti.ts                  # NEW — OIDC login init, launch, deep link response, JWKS endpoint
│   │   ├── ltiAdmin.ts             # NEW — /api/lti/platforms CRUD (instructor-only)
│   │   ├── labs.ts                 # NEW — /api/labs CRUD + reference upload + attempt
│   │   └── (existing) assignments.ts, submissions.ts, classroom.ts, circuits.ts
│   ├── lti/                        # NEW — LTI service module, no Hono coupling
│   │   ├── verify.ts               # jose-based id_token verification + JWKS cache
│   │   ├── deepLink.ts             # builds the signed DeepLinkingResponse JWT
│   │   ├── ags.ts                  # postScore, ensureLineItem, client_credentials token cache
│   │   ├── keys.ts                 # tool private key load (from wrangler secret) + public JWK derive
│   │   ├── nonce.ts                # D1-backed nonce store with TTL
│   │   └── claims.ts               # typed claim constants + Zod schemas for id_token payload
│   ├── clerk/
│   │   └── mintTicket.ts           # NEW — wraps clerkClient.signInTokens.createSignInToken
│   └── (existing) middleware/, db/, types/, util/
├── migrations/
│   ├── 0001_create_circuits.sql    # existing
│   ├── 0002_classroom.sql          # existing
│   └── 0003_lti_and_labs.sql       # NEW — all Phase 4 tables in one migration
└── wrangler.toml                    # add CRON trigger, LTI_PRIVATE_KEY secret, LTI_PUBLIC_KID var

src/
├── labs/                           # NEW — self-contained lab module (mirrors src/ltspice/ convention)
│   ├── schema.ts                   # Zod schemas for Lab, Step, Checkpoint, Predicate
│   ├── evaluator.ts                # pure-TS predicate evaluator (consumes VectorData[])
│   ├── referenceRunner.ts          # browser-side reference-sim-and-upload pipeline
│   ├── editor/
│   │   ├── LabEditor.tsx
│   │   ├── StepList.tsx            # @dnd-kit drag-reorder
│   │   ├── CheckpointInspector.tsx
│   │   └── PredicateEditors/       # one per predicate kind
│   ├── runner/
│   │   ├── LabRunner.tsx           # student side panel
│   │   ├── StepPanel.tsx           # marked + DOMPurify for instructions
│   │   └── CheckpointStatus.tsx
│   └── __tests__/
│       ├── evaluator.test.ts       # one test per predicate kind
│       ├── schema.test.ts
│       └── waveformMatch.test.ts
├── report/                         # NEW — lab report composition + export
│   ├── ReportLayout.tsx            # DOM consumed by both screen preview and jsPDF
│   ├── exportPdf.ts                # jsPDF.html() driver
│   ├── exportLatex.ts              # .tex generator + JSZip bundler
│   ├── sections/                   # SchematicSection, WaveformSection, MeasurementsSection, AnnotationsSection
│   └── __tests__/
├── lti/                            # NEW — client-side LTI bootstrap only
│   └── launchBootstrap.ts          # reads ?__clerk_ticket= from LTI landing, calls signIn.create({strategy:'ticket'})
├── store/
│   ├── labStore.ts                 # NEW — activeLab, activeStep, attemptState
│   ├── ltiStore.ts                 # NEW — whether current session originated from LTI (affects submit UI)
│   └── (existing) classroomStore.ts, circuitStore.ts, simulationStore.ts, uiStore.ts
├── cloud/
│   ├── labApi.ts                   # NEW — REST calls to /api/labs
│   ├── labHooks.ts                 # NEW — TanStack Query hooks (pattern from classroomHooks.ts)
│   ├── ltiAdminApi.ts              # NEW — platform registration CRUD for admin UI
│   └── (existing) classroomApi.ts, classroomHooks.ts, hooks.ts, api.ts, serialization.ts, types.ts
├── pages/
│   ├── LabEditorPage.tsx           # NEW — /labs/:id/edit
│   ├── LabRunnerPage.tsx           # NEW — /labs/:id/run
│   ├── LabLibraryPage.tsx          # NEW — /labs
│   ├── LtiAdminPage.tsx            # NEW — /admin/lti (platform registration)
│   ├── ReportPreviewPage.tsx       # NEW — /reports/:submissionId (preview + export button)
│   └── (existing) AssignmentPage, CoursePage, Dashboard, JoinCoursePage, SubmissionViewer
└── App.tsx                         # extend pathname router with new routes
```

### Pattern 1: LTI Route Group Is Not Under /api/*

**What:** LTI endpoints live under `/lti/*`, NOT `/api/*`. The existing Clerk middleware (`app.use('/api/.../*', clerkMiddleware())`) MUST NOT apply to LTI routes.
**Why:** The LMS is the caller at `/lti/oidc/login` and `/lti/launch`. It has no Clerk session — it has an id_token from the LMS's own key. Forcing Clerk middleware here would 401 every launch.
**Source:** `worker/src/index.ts` — current middleware mounting shows the scoping pattern.

```typescript
// worker/src/index.ts — ADD (do not replace existing lines)
import { ltiRouter } from './routes/lti';
import { ltiAdminRouter } from './routes/ltiAdmin';
import { labsRouter } from './routes/labs';

// LTI endpoints are publicly callable by the LMS — NO clerkMiddleware
app.route('/lti', ltiRouter);

// LTI admin (platform registration) requires instructor role
app.use('/api/lti/*', clerkMiddleware());
app.route('/api/lti', ltiAdminRouter);

// Labs require Clerk session
app.use('/api/labs/*', clerkMiddleware());
app.route('/api/labs', labsRouter);
```

### Pattern 2: id_token Verification with jose + JWKS Cache

**What:** Every LTI launch arrives as a form POST with an `id_token` JWT signed by the LMS's private key. The tool verifies the signature using the LMS's JWKS endpoint, validates required claims, and checks the nonce.
**When to use:** `/lti/launch` handler, before any business logic touches the payload.

```typescript
// worker/src/lti/verify.ts (NEW)
// Source: https://github.com/panva/jose — createRemoteJWKSet + jwtVerify
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { z } from 'zod';
import type { Bindings } from '../index';

// Cache JWKS per-iss in-memory across requests (Workers isolate reuse)
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(jwksUri: string) {
  let jwks = jwksCache.get(jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri), {
      cacheMaxAge: 10 * 60 * 1000, // 10 min, per 1EdTech guidance
      cooldownDuration: 30 * 1000,
    });
    jwksCache.set(jwksUri, jwks);
  }
  return jwks;
}

// Claim subset we require — use Zod to shape the verified payload
export const LtiLaunchClaims = z.object({
  iss: z.string().url(),
  aud: z.union([z.string(), z.array(z.string())]),
  sub: z.string(),
  nonce: z.string(),
  exp: z.number(),
  iat: z.number(),
  'https://purl.imsglobal.org/spec/lti/claim/deployment_id': z.string(),
  'https://purl.imsglobal.org/spec/lti/claim/message_type': z.enum([
    'LtiResourceLinkRequest',
    'LtiDeepLinkingRequest',
  ]),
  'https://purl.imsglobal.org/spec/lti/claim/version': z.literal('1.3.0'),
  'https://purl.imsglobal.org/spec/lti/claim/resource_link': z.object({ id: z.string() }).optional(),
  'https://purl.imsglobal.org/spec/lti/claim/context': z.object({
    id: z.string(),
    label: z.string().optional(),
    title: z.string().optional(),
  }).optional(),
  'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint': z.object({
    scope: z.array(z.string()),
    lineitems: z.string().url().optional(),
    lineitem: z.string().url().optional(),
  }).optional(),
  'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings': z.object({
    deep_link_return_url: z.string().url(),
    accept_types: z.array(z.string()),
    accept_presentation_document_targets: z.array(z.string()),
    data: z.string().optional(),
  }).optional(),
}).passthrough();

export type LtiLaunchPayload = z.infer<typeof LtiLaunchClaims>;

export async function verifyLaunch(
  idToken: string,
  db: D1Database,
): Promise<LtiLaunchPayload> {
  // 1. Peek at iss without verifying to pick the right platform row
  const [, rawPayload] = idToken.split('.');
  const peek = JSON.parse(atob(rawPayload.replace(/-/g, '+').replace(/_/g, '/')));
  const platform = await db.prepare(
    'SELECT * FROM lti_platforms WHERE iss = ? AND client_id = ?'
  ).bind(peek.iss, Array.isArray(peek.aud) ? peek.aud[0] : peek.aud).first<{
    iss: string; client_id: string; jwks_uri: string; auth_token_url: string;
  }>();
  if (!platform) throw new Error('Unknown LTI platform (iss, client_id)');

  // 2. Verify signature via JWKS cache + claims
  const jwks = getJwks(platform.jwks_uri);
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: platform.iss,
    audience: platform.client_id,
  });

  // 3. Typed claim validation
  const claims = LtiLaunchClaims.parse(payload);

  // 4. Nonce single-use check
  const nonceRow = await db.prepare(
    'SELECT nonce FROM lti_nonces WHERE nonce = ?'
  ).bind(claims.nonce).first();
  if (nonceRow) throw new Error('nonce replay');
  await db.prepare(
    'INSERT INTO lti_nonces (nonce, iss, expires_at) VALUES (?, ?, ?)'
  ).bind(claims.nonce, claims.iss, Date.now() + 10 * 60 * 1000).run();

  return claims;
}
```

### Pattern 3: Clerk Ticket Mint from Verified LTI Launch

**What:** After verifying the id_token, map `(iss, sub)` to a Clerk user (create on first launch) and mint a short-lived sign-in ticket. The Worker returns an HTML bootstrap page that redirects the SPA to Clerk's ticket redemption URL.
**When to use:** `/lti/launch` handler, after verify.

```typescript
// worker/src/clerk/mintTicket.ts (NEW)
// Source: https://clerk.com/docs/reference/backend/sign-in-tokens/create-sign-in-token
import { createClerkClient } from '@clerk/backend';

export async function mintLtiTicket(
  secretKey: string,
  iss: string,
  sub: string,
  email: string | undefined,
  name: string | undefined,
): Promise<{ ticket: string; userId: string }> {
  const clerk = createClerkClient({ secretKey });

  // Look up by externalId = `${iss}|${sub}` (one Clerk identity per iss+sub tuple per CONTEXT.md)
  const externalId = `lti|${iss}|${sub}`;
  const existing = await clerk.users.getUserList({ externalId: [externalId], limit: 1 });

  let user = existing.data[0];
  if (!user) {
    user = await clerk.users.createUser({
      externalId,
      firstName: name?.split(' ')[0],
      lastName: name?.split(' ').slice(1).join(' ') || undefined,
      emailAddress: email ? [email] : undefined,
      publicMetadata: { role: 'student', ltiIss: iss },
      skipPasswordRequirement: true,
    });
  }

  const ticket = await clerk.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 60, // one-shot, short
  });

  return { ticket: ticket.token, userId: user.id };
}
```

The Worker then returns an HTML response that `window.location.replace()`s the SPA at a route like `/lti/bootstrap?ticket={token}&assignment={assignmentId}`, where `src/lti/launchBootstrap.ts` calls `signIn.create({ strategy: 'ticket', ticket })` via `@clerk/react` before rendering the assignment page. No flash of unauthenticated state because the SPA never mounts its authed UI until ticket redemption completes.

### Pattern 4: Predicate Evaluator over Existing VectorData

**What:** Checkpoint predicates are pure functions over `VectorData[]` (the existing simulation output type from `src/simulation/protocol.ts`). No new IPC. No eval.
**Source:** `src/simulation/protocol.ts` — `VectorData { name, data: Float64Array, unit, isComplex }`

```typescript
// src/labs/schema.ts (NEW)
import { z } from 'zod';

const ToleranceSchema = z.union([
  z.object({ tol_pct: z.number().positive() }),
  z.object({ tol_abs: z.number().positive() }),
]);

export const PredicateSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('node_voltage'),
    node: z.string(),
    at_time: z.number().nonnegative(),
    expect: z.number(),
    tolerance: ToleranceSchema,
  }),
  z.object({
    kind: z.literal('branch_current'),
    element: z.string(),  // e.g. "R1"
    at_time: z.number().nonnegative(),
    expect: z.number(),
    tolerance: ToleranceSchema,
  }),
  z.object({
    kind: z.literal('waveform_match'),
    probe: z.string(),
    reference_key: z.string(),   // R2 key of reference CSV
    metric: z.enum(['rmse', 'max_abs']),
    tolerance: z.number().positive(),
  }),
  z.object({
    kind: z.literal('circuit_contains'),
    element_kind: z.enum(['resistor', 'capacitor', 'inductor', 'opamp', 'diode', 'bjt', 'mosfet', 'vsrc', 'isrc']),
    count_min: z.number().int().nonnegative(),
    count_max: z.number().int().positive().optional(),
  }),
  z.object({
    kind: z.literal('ac_gain_at'),
    probe: z.string(),
    frequency: z.number().positive(),
    expect_db: z.number(),
    tol_db: z.number().positive(),
  }),
]);

export const CheckpointSchema = z.object({
  id: z.string(),
  label: z.string(),
  predicate: PredicateSchema,
  weight: z.number().positive().default(1),
  partial_threshold_pct: z.number().min(0).max(100).optional(),  // enables ⚠ partial
});

export const StepSchema = z.object({
  id: z.string(),
  title: z.string(),
  instructions_md: z.string(),
  checkpoints: z.array(CheckpointSchema),
});

export const LabSchema = z.object({
  schema_version: z.literal(1),
  id: z.string(),
  title: z.string(),
  description_md: z.string().optional(),
  reference_circuit_r2_key: z.string(),
  reference_waveform_keys: z.record(z.string()), // probe → r2 key
  steps: z.array(StepSchema),
  total_weight: z.number().positive().default(1),
});

export type Lab = z.infer<typeof LabSchema>;
export type Predicate = z.infer<typeof PredicateSchema>;
```

```typescript
// src/labs/evaluator.ts (NEW)
import type { VectorData } from '@/simulation/protocol';
import type { CircuitState } from '@/circuit/types';
import type { Predicate } from './schema';

export type CheckpointResult = 'pass' | 'partial' | 'fail';

export interface EvalContext {
  vectors: VectorData[];
  circuit: CircuitState;
  referenceCsvs: Map<string, Float64Array[]>; // preloaded before evaluation
}

export function evaluatePredicate(p: Predicate, ctx: EvalContext): CheckpointResult {
  switch (p.kind) {
    case 'node_voltage': {
      const v = ctx.vectors.find(v => v.name === `v(${p.node.toLowerCase()})`);
      if (!v) return 'fail';
      const t = ctx.vectors.find(v => v.name === 'time');
      const value = interpAt(t?.data, v.data, p.at_time);
      return withinTolerance(value, p.expect, p.tolerance) ? 'pass' : 'fail';
    }
    case 'branch_current': {
      const i = ctx.vectors.find(v => v.name === `i(${p.element.toLowerCase()})`);
      if (!i) return 'fail';
      const t = ctx.vectors.find(v => v.name === 'time');
      const value = interpAt(t?.data, i.data, p.at_time);
      return withinTolerance(value, p.expect, p.tolerance) ? 'pass' : 'fail';
    }
    case 'waveform_match': {
      const student = ctx.vectors.find(v => v.name === p.probe);
      const ref = ctx.referenceCsvs.get(p.reference_key);
      if (!student || !ref) return 'fail';
      const metric = p.metric === 'rmse'
        ? rmse(student.data, ref[1], ref[0], ctx.vectors.find(v => v.name === 'time')?.data)
        : maxAbs(student.data, ref[1], ref[0], ctx.vectors.find(v => v.name === 'time')?.data);
      return metric <= p.tolerance ? 'pass' : 'fail';
    }
    case 'circuit_contains': {
      const count = Array.from(ctx.circuit.components.values())
        .filter(c => c.kind === p.element_kind).length;
      if (count < p.count_min) return 'fail';
      if (p.count_max !== undefined && count > p.count_max) return 'fail';
      return 'pass';
    }
    case 'ac_gain_at': {
      // lookup AC vector, interpolate magnitude at frequency, compare in dB
      // (implementation omitted for brevity in research doc)
      return 'fail';
    }
  }
}

// Helpers: interpAt, withinTolerance, rmse, maxAbs — all pure numeric, unit-tested.
```

### Pattern 5: Reference Waveform Generation at Lab-Save Time

**What:** Simulator runs in the browser only (ngspice WASM Web Worker). Reference waveforms are generated by driving the existing worker from the lab editor at save time, then uploading the resulting CSV to R2.
**Rationale:** ngspice WASM is browser-only — no server-side sim. (a) is the only option.

```
Instructor clicks "Save Lab"
  └─> LabEditor: loadReferenceCircuit() → setCircuit() → runSim()
      └─> simulationStore emits VectorData[]
          └─> referenceRunner.uploadCsvs(vectors, labId, getToken)
              └─> POST /api/labs/:id/references  (multipart: probe → CSV)
                  └─> Worker writes R2 at labs/{labId}/references/{probe}.csv
                      └─> D1 update: reference_waveform_keys JSON column
```

**Edge case: instructor closes tab mid-sim.** Detect via the existing simulation controller's ABORTED state; surface a "reference generation failed — retry" toast; do NOT write the lab metadata until all references upload successfully (transactional: R2 PUT fan-out, then D1 metadata write last).

### Anti-Patterns to Avoid

- **Do NOT put LTI routes under `/api/*`** — inherited Clerk middleware will 401 every LMS launch.
- **Do NOT use `eval` or `new Function`** for checkpoint predicates. Locked by CONTEXT.md. The predicate DSL is a discriminated union; evaluator is a `switch`.
- **Do NOT leave KaTeX DOM in the `ReportLayout` for html2canvas** — rasterize formulas to PNG first, embed as `<img>`. html2canvas has documented issues with KaTeX's CSS-fonts-based glyph rendering.
- **Do NOT inherit jsPDF defaults for fonts** — `jsPDF.html()` rasterizes via html2canvas, so fonts are burned into the PNG. The pitfall is forgetting to `document.fonts.ready` before calling `doc.html()`, which produces reports with fallback fonts intermittently.
- **Do NOT store LTI private keys in D1 or R2** — use `wrangler secret put LTI_PRIVATE_KEY` and read from `c.env.LTI_PRIVATE_KEY`. JWK serialization of the private key via `jose.exportJWK` at cold start, cached in-module.
- **Do NOT issue Clerk tickets that live longer than 60s** — they are one-shot bearer credentials. A 60s expiry is the industry standard for auth tickets.
- **Do NOT assume third-party cookies work in LMS iframes** — see COOP/COEP section.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT signing/verification | Custom RS256 signer with Web Crypto | `jose` (panva) | `jose` handles algorithm negotiation, clock skew, JWKS caching, and edge cases (kid mismatch, ES256 vs RS256) that take weeks to get right. Zero deps, Workers-native. |
| Schema validation of lab JSON | Hand-written type guards | `zod` | Lab JSON is authored by humans. Zod produces per-field error paths you can render inline in the editor. |
| Multi-page PDF from HTML | Custom canvas composition | `jspdf` + `html2canvas` with `autoPaging: 'text'` | `autoPaging` handles page-break logic, margin, orientation. Re-implementing would cost weeks. |
| Client-side ZIP | Custom `Uint8Array` + DEFLATE | `jszip` | Battle-tested, handles folders, streaming, file metadata. |
| Markdown rendering for lab instructions | Regex parser | `marked` + `dompurify` (reuse Phase 3) | Already in stack, already sanitized, already proven. |
| LTI platform registry UI | Direct SQL against D1 from React | New `/api/lti/platforms` route behind `requireInstructor` | Consistency with Phase 3 pattern. Platform config is instructor-only. |
| Waveform comparison metrics | Yours | **Build yours — but in a dedicated `src/labs/metrics.ts` module with property tests** | RMSE and max-abs are 10 lines each; no library worth adding. But they MUST be pure functions over Float64Array, unit-tested, with tests that account for unequal time grids (student and reference will not share timesteps) via linear interpolation. |

**Key insight:** Three things dominate Phase 4's risk budget — LTI protocol compliance, KaTeX-in-PDF rendering quality, and LMS-iframe session establishment. Each has a well-trodden third-party solution. Everything else is CRUD.

## Common Pitfalls

### Pitfall 1: LMS Iframes Block Third-Party Cookies (Canvas, Chrome, Safari)

**What goes wrong:** LMS embeds OmniSpice in an iframe. The LTI OIDC login flow requires a cookie round-trip to bind the login request to the same browser that completes it. Chrome ≥ 91 and Safari block third-party cookies by default in iframes. Clerk's session cookie is also third-party from the LMS's perspective.
**Why it happens:** OIDC was designed assuming first-party context. Iframes are third-party by definition.
**How to avoid:**
- For the LTI OIDC step, use **LTI Client Side postMessages** (1EdTech specification `lti-cs-oidc` / `lti-ps-message-cs`) as the state storage mechanism instead of cookies. The platform posts to the iframe, the iframe stores state in its own `sessionStorage`, and a `window.name` or postMessage relay carries the nonce across the OIDC redirect. Canvas, Moodle, Brightspace all support this in 2025+.
- For the Clerk session cookie, rely on the **sign-in ticket** flow (not cookies) — `signIn.create({strategy:'ticket', ticket})` exchanges the ticket for a session in the iframe's own storage. This sidesteps the third-party-cookie problem because Clerk's session ends up in the OmniSpice origin's own storage, not cross-site.
- Set `Cookie: SameSite=None; Secure` on any cookies we do set, and document that the production deployment MUST be HTTPS.
- **Do NOT enable COOP/COEP headers** — confirmed COOP/COEP is already unset project-wide (Phase 1 constraint); verify again in the first plan's Wave 0 by grepping `vite.config.ts` and `worker/src/index.ts` for any `Cross-Origin-*` header setters.
**Warning signs:** "nonce mismatch" errors in Canvas, "cookie blocked" console warnings, intermittent 401 on the first launch but success on the second.

### Pitfall 2: KaTeX Inside html2canvas Renders as Fallback Glyphs

**What goes wrong:** `ReportLayout.tsx` renders measurement formulas with KaTeX (which emits a DOM tree styled with KaTeX fonts). When jsPDF calls html2canvas to rasterize, KaTeX fonts aren't loaded yet, or html2canvas doesn't correctly compute the bounding box of KaTeX's vertical-align spans. Result: math renders as unstyled text in the PDF.
**Why it happens:** html2canvas treats the DOM as paint instructions but can miss `@font-face` loading, and KaTeX uses many stacked absolutely-positioned spans for superscripts/subscripts that html2canvas mis-composes.
**How to avoid:**
- Await `document.fonts.ready` before calling `doc.html()`.
- **Preferred: pre-rasterize KaTeX to PNG.** For each formula, create an offscreen `<div>`, render KaTeX into it, call `html-to-image`'s `toPng` on just that div, and embed the resulting PNG in `ReportLayout.tsx` as `<img src={dataUrl}>`. html2canvas now sees a plain `<img>` — no font loading, no positioning math.
- Unit-test by snapshot — render `ReportLayout` with three formulas, export PDF, confirm output via Playwright visual regression.
**Warning signs:** PDFs with readable body text but formulas that look like "V = I ∗ R" in fallback sans-serif instead of KaTeX's math typography.

### Pitfall 3: LTI Nonce Replay in a Serverless Environment

**What goes wrong:** LTI requires every nonce to be single-use across the LMS session. In a Workers environment with many isolates, an in-memory `Set` doesn't coordinate across isolates. A replayed launch succeeds intermittently.
**How to avoid:** Store nonces in D1 as the only authority. `lti_nonces` table with `(nonce TEXT PRIMARY KEY, iss TEXT, expires_at INTEGER)`. Verify step: `INSERT ... ON CONFLICT FAIL` followed by the D1 error bubbling up as "replay detected". A Cron Worker purges expired rows every 5 minutes.
**Warning signs:** Nonces stored anywhere other than D1 (in-memory Map, KV without read-after-write guarantees).

### Pitfall 4: AGS Score POST Without the Right Content-Type

**What goes wrong:** Canvas and Moodle return 415 Unsupported Media Type if the `Content-Type` header is `application/json` instead of `application/vnd.ims.lis.v1.score+json`. This is the #1 AGS implementation bug.
**How to avoid:** Centralize the POST in `worker/src/lti/ags.ts`, hardcode the correct MIME. Write a unit test that asserts the constructed Request's content-type.
**Warning signs:** 415 responses in the Cron Worker's retry log; grades that "should have synced" but didn't.

### Pitfall 5: `signInTokens.createSignInToken` Requires a User (Not an Email)

**What goes wrong:** The Clerk API requires `userId`. On first LTI launch, the Clerk user doesn't exist yet. Calling `createSignInToken` with a guessed or empty userId returns 404. Developers then work around this by calling `signIn.create({ identifier: email })` which fails inside an iframe without a password.
**How to avoid:** The mint flow is always: (1) `clerkClient.users.getUserList({ externalId: ['lti|iss|sub'] })` — (2) if empty, `clerkClient.users.createUser({ externalId, skipPasswordRequirement: true })` — (3) THEN `signInTokens.createSignInToken({ userId: user.id, expiresInSeconds: 60 })`. Use `externalId`, not `emailAddress`, as the key because not all LTI launches include email (Moodle can omit it under privacy settings).
**Warning signs:** 404 from Clerk on first-launch, users multiplying in the Clerk dashboard because each launch creates a new user.

### Pitfall 6: jsPDF html() Without autoPaging Produces a Single Giant Page

**What goes wrong:** `doc.html(element)` without `autoPaging` fits everything on page 1 and clips. Reports look cropped.
**How to avoid:** Always pass `html()` options with `autoPaging: 'text'` (preserves line breaks) or `'slice'` (straight cut). `text` is usually what you want for a lab report.
**Warning signs:** Single-page PDFs; content cut off at ~11 inches.

### Pitfall 7: React Flow Schematic Export Inside ReportLayout

**What goes wrong:** `ReportLayout` tries to render a live React Flow canvas inside the print DOM. React Flow's viewport transform is relative to its container, and html2canvas doesn't apply the transform correctly.
**How to avoid:** Reuse the existing `src/export/exportPng.ts` path (`html-to-image` pinned at 1.11.13). Generate the schematic PNG first, then embed as `<img>` in `ReportLayout`. This is the same pattern Phase 2 already proved.

### Pitfall 8: Platform Bearer Token for AGS Is Not the id_token

**What goes wrong:** Developers try to use the LTI launch id_token as a bearer for AGS. Canvas/Moodle reject with 401.
**How to avoid:** AGS requires a client_credentials OAuth2 grant where the tool signs a JWT with its own private key, POSTs it to the platform's `auth_token_url` with `grant_type=client_credentials`, `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer`, `client_assertion={signed_jwt}`, `scope={requested_scopes}`. The platform returns a short-lived bearer. Cache the bearer per (platform, scope) until it expires.
**Warning signs:** 401 on every `postScore` call.

## Code Examples

### Example 1: Hono /lti/launch handler

```typescript
// worker/src/routes/lti.ts (NEW — excerpt)
import { Hono } from 'hono';
import { verifyLaunch } from '../lti/verify';
import { mintLtiTicket } from '../clerk/mintTicket';
import type { Bindings } from '../index';

const lti = new Hono<{ Bindings: Bindings }>();

// OIDC login init (GET or POST)
lti.all('/oidc/login', async (c) => {
  // ... build state, store in D1, redirect to platform auth_login_url with login_hint, nonce
});

// Launch (POST)
lti.post('/launch', async (c) => {
  const body = await c.req.parseBody();
  const idToken = String(body.id_token ?? '');
  if (!idToken) return c.text('missing id_token', 400);

  const claims = await verifyLaunch(idToken, c.env.DB);

  const messageType = claims['https://purl.imsglobal.org/spec/lti/claim/message_type'];
  const email = (claims as { email?: string }).email;
  const name = (claims as { name?: string }).name;

  const { ticket, userId } = await mintLtiTicket(
    c.env.CLERK_SECRET_KEY, claims.iss, claims.sub, email, name
  );

  // Persist launch audit row
  const launchId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO lti_launches (id, iss, sub, clerk_user_id, message_type, raw_claims, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(launchId, claims.iss, claims.sub, userId, messageType, JSON.stringify(claims), Date.now()).run();

  // Branch: deep linking vs resource link
  const target = messageType === 'LtiDeepLinkingRequest'
    ? `/lti/bootstrap?ticket=${ticket}&mode=deeplink&launch=${launchId}`
    : `/lti/bootstrap?ticket=${ticket}&mode=resource&launch=${launchId}`;

  // Return HTML that immediately replaces location — inside an LMS iframe this loads the SPA
  return c.html(`<!doctype html><meta charset="utf-8"><script>
    window.location.replace(${JSON.stringify(target)});
  </script>`);
});

export { lti as ltiRouter };
```

### Example 2: AGS postScore

```typescript
// worker/src/lti/ags.ts (NEW — excerpt)
// Source: https://www.imsglobal.org/spec/lti-ags/v2p0
import { SignJWT, importPKCS8 } from 'jose';

interface AgsScorePayload {
  userId: string;
  scoreGiven: number;
  scoreMaximum: number;
  comment?: string;
  activityProgress: 'Initialized' | 'Started' | 'InProgress' | 'Submitted' | 'Completed';
  gradingProgress: 'NotReady' | 'Failed' | 'Pending' | 'PendingManual' | 'FullyGraded';
  timestamp: string;
}

export async function postScore(
  db: D1Database,
  platformIss: string,
  clientId: string,
  lineItemUrl: string,
  payload: AgsScorePayload,
  privateKeyPem: string,
  kid: string,
): Promise<void> {
  const token = await getPlatformToken(db, platformIss, clientId, privateKeyPem, kid, [
    'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  ]);

  const res = await fetch(`${lineItemUrl}/scores`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.ims.lis.v1.score+json',  // Pitfall 4 — do not use application/json
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`AGS score POST failed: ${res.status} ${await res.text()}`);
  }
}

async function getPlatformToken(
  db: D1Database,
  iss: string,
  clientId: string,
  privateKeyPem: string,
  kid: string,
  scopes: string[],
): Promise<string> {
  // Check D1 cache for non-expired token
  const cached = await db.prepare(
    'SELECT token, expires_at FROM lti_platform_tokens WHERE iss=? AND client_id=? AND scope=?'
  ).bind(iss, clientId, scopes.join(' ')).first<{ token: string; expires_at: number }>();
  if (cached && cached.expires_at > Date.now() + 10_000) return cached.token;

  // Mint client_assertion JWT
  const platform = await db.prepare('SELECT auth_token_url FROM lti_platforms WHERE iss=? AND client_id=?')
    .bind(iss, clientId).first<{ auth_token_url: string }>();
  if (!platform) throw new Error('Unknown platform');

  const pk = await importPKCS8(privateKeyPem, 'RS256');
  const assertion = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid })
    .setIssuer(clientId)
    .setSubject(clientId)
    .setAudience(platform.auth_token_url)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setJti(crypto.randomUUID())
    .sign(pk);

  const form = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion,
    scope: scopes.join(' '),
  });

  const tokRes = await fetch(platform.auth_token_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!tokRes.ok) throw new Error(`token endpoint ${tokRes.status}`);
  const { access_token, expires_in } = await tokRes.json<{ access_token: string; expires_in: number }>();

  await db.prepare(`
    INSERT INTO lti_platform_tokens (iss, client_id, scope, token, expires_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(iss, client_id, scope) DO UPDATE SET token=excluded.token, expires_at=excluded.expires_at
  `).bind(iss, clientId, scopes.join(' '), access_token, Date.now() + expires_in * 1000).run();

  return access_token;
}
```

### Example 3: PDF export with font-ready gate

```typescript
// src/report/exportPdf.ts (NEW)
import jsPDF from 'jspdf';

export async function exportReportAsPdf(
  element: HTMLElement,
  filename: string,
  paperSize: 'letter' | 'a4' = 'letter',
): Promise<void> {
  // Pitfall 2: ensure fonts (including any remaining text — KaTeX should already be PNG)
  await document.fonts.ready;

  const doc = new jsPDF({
    unit: 'px',
    format: paperSize,
    hotfixes: ['px_scaling'],
    orientation: 'portrait',
  });

  await doc.html(element, {
    autoPaging: 'text',   // Pitfall 6
    margin: [40, 40, 40, 40],
    width: paperSize === 'letter' ? 612 : 595,
    windowWidth: element.scrollWidth,
    html2canvas: {
      scale: 2,            // 2× DPI for print clarity
      backgroundColor: '#ffffff',
      useCORS: true,
    },
  });

  doc.save(filename);
}
```

### Example 4: LaTeX export with JSZip

```typescript
// src/report/exportLatex.ts (NEW)
import JSZip from 'jszip';
import type { ReportData } from './types';

export async function exportReportAsLatexZip(data: ReportData): Promise<void> {
  const zip = new JSZip();

  // 1. Main .tex source
  zip.file('report.tex', renderLatex(data));

  // 2. figures/ with all rasterized assets as PNGs
  const figures = zip.folder('figures')!;
  figures.file('schematic.png', dataUrlToUint8(data.schematicPngDataUrl));
  for (const [idx, wave] of data.waveforms.entries()) {
    figures.file(`waveform-${idx + 1}.png`, dataUrlToUint8(wave.pngDataUrl));
  }

  // 3. README explaining how to compile
  zip.file('README.md', '# Lab report\n\nCompile with `pdflatex report.tex`.\n');

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.title.replace(/\W+/g, '-')}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

function renderLatex(data: ReportData): string {
  // Template-literal .tex generation — no templating engine needed
  return `\\documentclass{article}
\\usepackage{graphicx}
\\usepackage{amsmath}
\\title{${escapeLatex(data.title)}}
\\author{${escapeLatex(data.author)}}
\\begin{document}
\\maketitle
\\section{Schematic}
\\includegraphics[width=\\linewidth]{figures/schematic.png}
${data.waveforms.map((w, i) => `
\\section{${escapeLatex(w.label)}}
\\includegraphics[width=\\linewidth]{figures/waveform-${i + 1}.png}
`).join('')}
\\end{document}`;
}
```

## State of the Art

| Old Approach | Current Approach (2026) | When Changed | Impact |
|--------------|-------------------------|--------------|--------|
| Third-party cookies for LTI OIDC state | LTI Client Side postMessages + `sessionStorage` | 1EdTech draft 2024, support shipping through 2025 | Tool MUST implement postMessage state storage as primary path; cookies as fallback for older LMSes only |
| `ltijs` as the default TS LTI library | Hand-rolled `jose` on serverless runtimes | 2023+ as Workers/Edge runtimes matured | Express-based libraries are no longer portable; serverless requires direct JOSE |
| `@react-pdf/renderer` for programmatic PDFs | `jsPDF.html()` + DOM as source of truth | jsPDF 2.x → 3.x added robust `autoPaging` | DOM-based reports enable WYSIWYG preview without maintaining two layout engines |
| Zod v3 | Zod v4 (early 2025) | 2× faster, smaller, Zod Mini for tree-shaking | Straight upgrade; stick with v4 for Phase 4 |
| Clerk `publicMetadata.role` in JWT | Unchanged — this is still the current v6 pattern | Phase 3 verified | Continue the Phase 3 pattern; no migration |

**Deprecated/outdated:**
- **`jsonwebtoken` npm package** — Node-only, uses `crypto` module, does not run on Workers. Use `jose`.
- **`ltijs` for Workers** — Express + Mongoose bound, cannot run on Workers without a full rewrite.
- **`@clerk/clerk-sdk-node`** — replaced by `@clerk/backend` (already installed). Do not add the sdk-node package.

## Open Questions

1. **LTI Dynamic Registration (DR)**
   - What we know: 1EdTech DR spec is published; Moodle and Canvas both support it; ltijs implements it.
   - What's unclear: Whether Phase 4's installer UX should expose DR, or stick with manual platform registration via `/admin/lti`.
   - Recommendation: Ship manual registration in Phase 4. DR is a polish item that saves minutes per install, not a requirement. Revisit post-revenue.

2. **Which predicate kinds beyond the seed 5?**
   - What we know: CONTEXT.md permits researcher/planner to propose more.
   - What's unclear: Whether pilot professors actually need `rise_time`, `settling_time`, `overshoot_pct`, `power_dissipation_at`.
   - Recommendation: Ship the 5 seed predicates in Phase 4. Design the schema so adding new kinds is a 1-file change (new branch of the discriminated union). Flag the wishlist in STATE.md.

3. **Paper size defaults**
   - What we know: US Letter dominates US universities; A4 dominates everywhere else.
   - What's unclear: Whether browser locale is a reliable signal.
   - Recommendation: Default to `navigator.language.startsWith('en-US') ? 'letter' : 'a4'`, expose a selector in the export modal.

4. **Reference waveform format: CSV vs binary**
   - What we know: CSV is the locked decision.
   - What's unclear: Performance at many-probe labs — parse cost for 10+ probes.
   - Recommendation: Ship CSV. Add a binary `.bin` (Float64Array LE) path in Phase 5 only if profiling shows CSV parse dominates the eval step.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite/Vitest dev | ✓ (assumed — Phase 1-3 running) | 20.19+ / 22.12+ | — |
| pnpm | Package install | ✓ | 10.x | — |
| wrangler | Cloudflare Workers dev + deploy | ✓ (used in Phase 2/3) | 4.81+ | — |
| Cloudflare D1 (dev) | Worker dev with migrations | ✓ | GA | — |
| Cloudflare R2 (dev) | Worker dev with blob storage | ✓ | GA | — |
| Cloudflare Cron Trigger binding | AGS retry queue | ✓ (needs wrangler.toml addition) | GA | — |
| Clerk test tenant | LTI-to-Clerk ticket mint | ✓ (existing Phase 2 tenant) | v6 | — |
| Canvas test tenant | LMS-01 / LMS-02 / LMS-03 integration test | **Unknown — must be provisioned** | — | Manual: Instructure free sandbox at https://canvas.instructure.com/login/canvas; first-plan task to register |
| Moodle Docker image | LMS-01 / LMS-02 Moodle validation | **Not installed — easy to add** | 4.x | `docker run -p 8080:8080 bitnami/moodle:latest` |
| Docker | Running local Moodle | **Unknown — likely available on dev machine, must verify** | — | If absent: defer Moodle testing to a Moodle.net test instance |
| pdflatex | Manual RPT-02 compilation gate | **Optional — documented as manual** | — | Document as "one-time instructor manual check", do not automate |

**Missing dependencies with no fallback:**
- None that block execution. Canvas and Moodle test access is required for LMS-01/02/03 validation — first plan in Phase 4 must include "provision Canvas sandbox" as a concrete task, not a handwave.

**Missing dependencies with fallback:**
- Moodle local instance — fallback is Moodle.net's public test site or deferring Moodle validation to a follow-up plan after Canvas ships.
- pdflatex — Phase 4 explicitly defers compilation to "manual gate, documented not automated".

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (client) + Vitest 2.0 (worker) + Playwright 1.59 (E2E) — all existing |
| Config file | `vitest.config.ts` (root, jsdom) / `worker/vitest.config.ts` (node) / `playwright.config.ts` |
| Quick run command | `pnpm test` (client) / `cd worker && pnpm test` (worker) / `pnpm test:e2e` (E2E) |
| Full suite command | `pnpm test && cd worker && pnpm test && cd .. && pnpm test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| LMS-01 | Deep Linking response JWT signed and returned with `content_items` including `lineItem` | worker unit | `cd worker && pnpm test src/__tests__/lti/deepLink.test.ts` | ❌ Wave 0 |
| LMS-01 | OIDC login init redirects with correct state, nonce, and login_hint | worker unit | `cd worker && pnpm test src/__tests__/lti/oidc.test.ts` | ❌ Wave 0 |
| LMS-01 | id_token verification rejects expired, wrong-audience, wrong-issuer, replayed nonce | worker unit + contract | `cd worker && pnpm test src/__tests__/lti/verify.test.ts` | ❌ Wave 0 |
| LMS-01 | Full OIDC→launch→deeplink happy path with a mock platform | E2E | `pnpm test:e2e tests/e2e/phase-04/lti-deeplink.spec.ts` | ❌ Wave 0 |
| LMS-02 | `ltiAgsService.postScore` constructs correct Content-Type and Authorization headers | worker unit | `cd worker && pnpm test src/__tests__/lti/ags.test.ts` | ❌ Wave 0 |
| LMS-02 | Grade sync triggered by `PATCH /api/submissions/:id/grade` when submission has `lti_launch_id` | worker integration | `cd worker && pnpm test src/__tests__/routes/submissions.lti.test.ts` | ❌ Wave 0 |
| LMS-02 | Failed AGS post written to `lti_score_log` with status='pending' and retried by Cron Worker | worker unit + scheduled trigger test | `cd worker && pnpm test src/__tests__/lti/scoreRetry.test.ts` | ❌ Wave 0 |
| LMS-03 | Clerk ticket mint: existing user lookup by externalId returns same user_id on second launch | worker integration | `cd worker && pnpm test src/__tests__/clerk/mintTicket.test.ts` | ❌ Wave 0 |
| LMS-03 | Client-side `launchBootstrap` redeems ticket via `signIn.create({strategy:'ticket'})` | client unit | `pnpm test src/lti/__tests__/launchBootstrap.test.ts` | ❌ Wave 0 |
| LMS-03 | E2E: mock-LMS launch → SPA renders assignment page without sign-in modal | E2E | `pnpm test:e2e tests/e2e/phase-04/lti-launch-no-login.spec.ts` | ❌ Wave 0 |
| LAB-01 | Lab JSON Zod schema accepts valid lab, rejects missing step id, rejects unknown predicate kind | client unit | `pnpm test src/labs/__tests__/schema.test.ts` | ❌ Wave 0 |
| LAB-01 | LabEditor drag-reorder persists step order | client integration | `pnpm test src/labs/__tests__/editor/StepList.test.tsx` | ❌ Wave 0 |
| LAB-01 | `POST /api/labs` writes JSON to R2 and metadata row to D1 | worker integration | `cd worker && pnpm test src/__tests__/routes/labs.test.ts` | ❌ Wave 0 |
| LAB-02 | `evaluatePredicate` passes/fails correctly for each predicate kind against a synthetic `VectorData[]` | client unit | `pnpm test src/labs/__tests__/evaluator.test.ts` | ❌ Wave 0 |
| LAB-02 | `evaluatePredicate(circuit_contains)` counts components from `CircuitState` correctly | client unit | same test file above | ❌ Wave 0 |
| LAB-02 | Full simulation-to-checkpoint integration: run a canned netlist via ngspice worker, assert chips show ✓/⚠/✗ | client integration | `pnpm test src/labs/__tests__/runner/LabRunner.test.tsx` | ❌ Wave 0 |
| LAB-03 | `rmse` and `maxAbs` metrics compute correctly over mismatched-time-grid Float64Arrays | client unit | `pnpm test src/labs/__tests__/waveformMatch.test.ts` | ❌ Wave 0 |
| LAB-03 | `waveform_match` predicate loads reference CSV from R2 and compares | client integration | `pnpm test src/labs/__tests__/evaluator.test.ts` | ❌ Wave 0 |
| RPT-01 | `exportReportAsPdf` produces a non-empty PDF with 2+ pages for a sample report with 10+ measurements | client integration | `pnpm test src/report/__tests__/exportPdf.test.ts` | ❌ Wave 0 |
| RPT-01 | PDF layout visual-regression screenshot matches baseline | E2E visual | `pnpm test:e2e tests/e2e/phase-04/report-pdf-visual.spec.ts` | ❌ Wave 0 |
| RPT-02 | `exportReportAsLatexZip` produces a `.zip` with `report.tex`, `figures/schematic.png`, `figures/waveform-*.png` | client unit | `pnpm test src/report/__tests__/exportLatex.test.ts` | ❌ Wave 0 |
| RPT-02 | Generated `.tex` escapes LaTeX-special chars in titles/authors (no broken `\` or `$`) | client unit | same file | ❌ Wave 0 |
| RPT-02 | Manual gate: `pdflatex report.tex` compiles cleanly — **documented, not automated in Phase 4** | manual | `(document only — no CI step)` | N/A |

### Sampling Rate
- **Per task commit:** `pnpm test <changed-area>` (scoped Vitest run) — under 30 seconds per run
- **Per wave merge:** full `pnpm test` on client + `cd worker && pnpm test` on worker (~2 min combined)
- **Phase gate:** full suite green including `pnpm test:e2e` before `/gsd:verify-work` — including the Canvas sandbox contract test and the PDF visual regression

### Wave 0 Gaps

All Phase 4 test files are net-new — Wave 0 of plan 04-01 must scaffold the following before any feature code:

- [ ] `worker/src/__tests__/lti/verify.test.ts` — mock id_token fixtures for Canvas and Moodle, JWKS server mock
- [ ] `worker/src/__tests__/lti/oidc.test.ts` — login init state/nonce generation
- [ ] `worker/src/__tests__/lti/deepLink.test.ts` — signed DeepLinkingResponse JWT validation
- [ ] `worker/src/__tests__/lti/ags.test.ts` — postScore header + body shape assertions
- [ ] `worker/src/__tests__/lti/scoreRetry.test.ts` — Cron scheduled() handler retry semantics
- [ ] `worker/src/__tests__/clerk/mintTicket.test.ts` — Clerk API mocked, externalId-first-then-create flow
- [ ] `worker/src/__tests__/routes/labs.test.ts` — labs CRUD + R2 reference upload
- [ ] `worker/src/__tests__/routes/submissions.lti.test.ts` — grade PATCH triggers AGS score iff LTI-originated
- [ ] `worker/src/__tests__/lti/fixtures/` — Canvas and Moodle id_token fixtures, JWKS fixtures, mock platform keys
- [ ] `src/labs/__tests__/schema.test.ts` — Zod validation positive + negative cases
- [ ] `src/labs/__tests__/evaluator.test.ts` — one suite per predicate kind, with synthetic VectorData
- [ ] `src/labs/__tests__/waveformMatch.test.ts` — RMSE/maxAbs with mismatched time grids, interpolation correctness
- [ ] `src/labs/__tests__/editor/StepList.test.tsx` — drag-reorder persistence
- [ ] `src/labs/__tests__/runner/LabRunner.test.tsx` — full sim→eval→chip-update path
- [ ] `src/lti/__tests__/launchBootstrap.test.ts` — ticket redemption
- [ ] `src/report/__tests__/exportPdf.test.ts` — jsPDF output non-empty, page count
- [ ] `src/report/__tests__/exportLatex.test.ts` — zip structure, .tex escaping
- [ ] `tests/e2e/phase-04/lti-deeplink.spec.ts` — mock LMS platform
- [ ] `tests/e2e/phase-04/lti-launch-no-login.spec.ts` — LMS-03 happy path
- [ ] `tests/e2e/phase-04/report-pdf-visual.spec.ts` — Playwright visual regression baseline
- [ ] `tests/e2e/phase-04/lab-runner.spec.ts` — full lab completion flow
- [ ] `tests/e2e/fixtures/mock-lms/` — tiny Hono app serving as mock OIDC platform for tests

Framework install: **none needed** — vitest, playwright, @testing-library/react all already installed.

## Project Constraints (from CLAUDE.md)

- **Package manager:** pnpm (user global preference + project constraint) — never `npm install`
- **Platform:** Browser-only (Chrome, Firefox, Safari, Edge + Chromebooks). No Node.js-only libraries in client code. Workers code must also avoid Node-only APIs unless `nodejs_compat` flag covers it (already set in `wrangler.toml`).
- **Engine:** ngspice via WASM — reference waveform generation path MUST use the existing Web Worker, not a server-side compile
- **Stack pins:** React 19.2.x, Vite 8.x, TypeScript 6.0+ (strict mode), Biome for lint/format, @xyflow/react 12.10.x, zustand 5.0.x, @tanstack/react-query 5.97.x, uPlot 1.6.32, marked 15.0.12, dompurify 3.3.3
- **License:** Proprietary — all Phase 4 dependencies must be MIT/BSD/Apache-2.0 compatible. Verified: `jose` (MIT), `zod` (MIT), `jspdf` (MIT), `html2canvas` (MIT), `katex` (MIT), `jszip` (MIT)
- **Attribution (user global preference):** no "Co-Authored-By: Claude" in commits, no AI attribution anywhere
- **GSD workflow:** all file edits must go through GSD commands — `/gsd:execute-phase` is the entry point for Phase 4 work
- **COOP/COEP:** MUST remain unset — LMS iframe embedding is a hard constraint
- **No SharedArrayBuffer:** ngspice stays single-threaded; Phase 4 adds no WASM threading

## Sources

### Primary (HIGH confidence)
- [panva/jose GitHub](https://github.com/panva/jose) — explicit Cloudflare Workers support, `createRemoteJWKSet`, `jwtVerify`, `SignJWT`, `importPKCS8`, Web Crypto-native
- [@clerk/backend createSignInToken docs](https://clerk.com/docs/reference/backend/sign-in-tokens/create-sign-in-token) — verified API shape, `userId` required, `expiresInSeconds` configurable
- [1EdTech LTI 1.3 Core Spec](https://www.imsglobal.org/spec/lti/v1p3) — message flows, required claims, signatures
- [1EdTech LTI Deep Linking 2.0 Spec](https://www.imsglobal.org/spec/lti-dl/v2p0) — `content_items` structure, `lineItem` property
- [1EdTech LTI AGS 2.0 Spec](https://www.imsglobal.org/spec/lti-ags/v2p0) — line items, score posting, scopes
- [Canvas LTI 1.3 Deep Linking docs](https://canvas.instructure.com/doc/api/file.content_item.html) — Canvas-specific `accept_multiple`, `lineItem` auto-assignment behavior
- [Canvas Line Items REST API](https://www.canvas.instructure.com/doc/api/line_items.html) — AGS endpoint shape
- [1EdTech LTI Client Side postMessages spec](https://www.imsglobal.org/spec/lti-cs-oidc/v0p1) — third-party cookie workaround for iframes
- [IMS SameSite Cookie Issues for LTI](https://www.imsglobal.org/samesite-cookie-issues-lti-tool-providers) — documented cookie problem and community guidance
- [jsPDF npm](https://www.npmjs.com/package/jspdf) — v3.0.2 verified via `npm view`, `html()` + `autoPaging` API surface
- [Cloudflare Workers Cron Triggers docs](https://developers.cloudflare.com/workers/configuration/cron-triggers/) — scheduled handler pattern for AGS retry
- [Zod v4 announcement / Pockit 2026 comparison](https://pockit.tools/blog/zod-valibot-arktype-comparison-2026/) — Zod v4 perf characteristics vs Valibot vs TypeBox
- [Existing code: `worker/src/routes/me.ts`](file:///c:/Users/sandv/Desktop/omnispice/worker/src/routes/me.ts) — proves `createClerkClient({secretKey})` works on Workers today
- [Existing code: `src/simulation/protocol.ts`](file:///c:/Users/sandv/Desktop/omnispice/src/simulation/protocol.ts) — `VectorData` shape the evaluator consumes
- [Existing code: `src/export/exportPng.ts`](file:///c:/Users/sandv/Desktop/omnispice/src/export/exportPng.ts) — schematic-export path the report reuses

### Secondary (MEDIUM confidence)
- [Christopher Bennell - Canvas LMS LTI 1.3 JWT breakdown](https://cbennell.com/posts/whats-in-a-canvas-lms-lti-1-3-jwt/) — practical field-level commentary on Canvas id_token claims
- [ikovac/lti-tool-example](https://github.com/ikovac/lti-tool-example) — reference Node implementation showing the full launch handler shape
- [MoodleDocs LTI 1.3 support](https://docs.moodle.org/dev/LTI_1.3_support) — Moodle platform registration fields
- [Blackboard LTI 1.3 Tool Implementation Guide](https://blackboard.github.io/lti/tutorials/implementation-guide) — cross-LMS architectural sanity check (not used for Blackboard certification in Phase 4, but informs "don't hard-code Canvas")
- [Kinde: Verifying JWTs in Cloudflare Workers with jose](https://www.kinde.com/blog/engineering/verifying-jwts-in-cloudflare-workers/) — practical Workers+jose integration pattern
- [pdfnoodle jsPDF 2026 guide](https://pdfnoodle.com/blog/generating-pdfs-from-html-with-jspdf) — 2026-current `autoPaging` usage

### Tertiary (LOW confidence — verify in plans)
- Valibot vs Zod bundle benchmarks — the 10× figure is for a specific login-form schema; lab editor schemas may skew different. Flag for recheck if bundle size becomes a concern.
- Exact Moodle behavior around `email` claim privacy — relying on `externalId` keyed on `(iss, sub)` sidesteps the unknown.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries version-verified via `npm view` on 2026-04-10; `jose` + `@clerk/backend` + `jsPDF` + `zod` + `jszip` are all widely deployed and documented
- Architecture (LTI routes, Hono layout, predicate evaluator): HIGH — mirrors proven Phase 3 patterns, LTI flow matches spec
- LTI edge cases (cookies, Moodle quirks, Blackboard deltas): MEDIUM — known unknowns, first plan must include a Canvas sandbox spike day
- PDF rendering with KaTeX: MEDIUM — the pre-rasterize-to-PNG workaround is well-known but needs a day-1 spike to confirm output quality
- Reference waveform generation: HIGH — reuses existing ngspice Web Worker infrastructure
- Validation architecture: HIGH — all tests scoped to existing Vitest + Playwright; no new test frameworks

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (LTI specs are stable; Clerk v6 API surface stable; review before Phase 5)

## RESEARCH COMPLETE
