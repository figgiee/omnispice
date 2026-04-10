import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { clerkMiddleware } from '@hono/clerk-auth';
import { circuitsRouter } from './routes/circuits';
import { shareRouter } from './routes/share';
import { classroomRouter } from './routes/classroom';
import { meRouter } from './routes/me';
import { assignmentsRouter } from './routes/assignments';
import { submissionsRouter } from './routes/submissions';

export type Bindings = {
  DB: D1Database;
  CIRCUIT_BUCKET: R2Bucket;
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;
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

// Clerk middleware on protected routes only
app.use('/api/circuits/*', clerkMiddleware());
app.use('/api/courses/*', clerkMiddleware());
app.use('/api/me/*', clerkMiddleware());
app.use('/api/assignments/*', clerkMiddleware());
app.use('/api/submissions/*', clerkMiddleware());

// Route registration
app.route('/api/circuits', circuitsRouter);
app.route('/api/share', shareRouter);
app.route('/api/courses', classroomRouter);
app.route('/api/me', meRouter);
app.route('/api/assignments', assignmentsRouter);
app.route('/api/submissions', submissionsRouter);

// Health check (no auth)
app.get('/health', (c) => c.json({ ok: true }));

export default app;
