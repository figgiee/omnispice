import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { clerkMiddleware } from '@hono/clerk-auth';
import { circuitsRouter } from './routes/circuits';
import { shareRouter } from './routes/share';
import { classroomRouter } from './routes/classroom';
import { meRouter } from './routes/me';
import { assignmentsRouter } from './routes/assignments';
import { submissionsRouter } from './routes/submissions';
import { ltiRouter } from './routes/lti';
import { ltiAdminRouter } from './routes/ltiAdmin';

export type Bindings = {
  DB: D1Database;
  CIRCUIT_BUCKET: R2Bucket;
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;
  // Phase 4 — LTI 1.3 tool keys
  LTI_PRIVATE_KEY: string;   // PKCS8 PEM, via `wrangler secret put`
  LTI_PUBLIC_KID: string;    // stable kid advertised in /lti/.well-known/jwks.json
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS: allow dev server and production app
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'https://omnispice.app'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// LTI 1.3 endpoints — MUST be mounted BEFORE any Clerk middleware.
// LMSes call /lti/* without a Clerk session; Clerk sessions are minted
// *after* id_token verification during the launch flow (04-02).
app.route('/lti', ltiRouter);

// Clerk middleware on protected routes only
app.use('/api/circuits/*', clerkMiddleware());
app.use('/api/courses/*', clerkMiddleware());
app.use('/api/me/*', clerkMiddleware());
app.use('/api/assignments/*', clerkMiddleware());
app.use('/api/submissions/*', clerkMiddleware());
app.use('/api/lti/*', clerkMiddleware());

// Route registration
app.route('/api/circuits', circuitsRouter);
app.route('/api/share', shareRouter);
app.route('/api/courses', classroomRouter);
app.route('/api/me', meRouter);
app.route('/api/assignments', assignmentsRouter);
app.route('/api/submissions', submissionsRouter);
app.route('/api/lti', ltiAdminRouter);

// Health check (no auth)
app.get('/health', (c) => c.json({ ok: true }));

export default app;
