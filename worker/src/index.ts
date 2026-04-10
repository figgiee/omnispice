import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { clerkMiddleware } from '@hono/clerk-auth';
import { circuitsRouter } from './routes/circuits';
import { shareRouter } from './routes/share';

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
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// Clerk middleware on protected routes only
app.use('/api/circuits/*', clerkMiddleware());

// Route registration
app.route('/api/circuits', circuitsRouter);
app.route('/api/share', shareRouter);

// Health check (no auth)
app.get('/health', (c) => c.json({ ok: true }));

export default app;
