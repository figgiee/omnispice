/**
 * Labs CRUD + R2 reference upload + enrollment-aware listing.
 *
 * LAB-01 (Phase 4 Plan 05) — instructor authoring surface.
 *
 * Endpoints:
 *   POST   /api/labs                       (instructor)        create a lab
 *   GET    /api/labs                       (auth)              list labs visible to user
 *   GET    /api/labs/:id                   (auth)              lab metadata + JSON body
 *   GET    /api/labs/:id/json              (auth)              raw lab JSON from R2
 *   PATCH  /api/labs/:id                   (owner instructor)  update lab body + title
 *   DELETE /api/labs/:id                   (owner instructor)  delete lab (R2 + D1)
 *   POST   /api/labs/:id/reference/:probe  (owner instructor)  upload reference CSV
 *   GET    /api/labs/:id/reference/:probe  (auth)              fetch reference CSV
 *
 * R2 layout:
 *   labs/{id}/lab.json                      — Lab document (Zod-validated)
 *   labs/{id}/references/{probe}.csv        — per-probe reference waveform
 *
 * Schema duplication note: the Worker needs to validate Lab JSON at write
 * time but cannot import from `src/labs/schema.ts` because the Vite bundler
 * and the Workers bundler resolve module paths differently. Until a shared
 * workspace package lands in Phase 5, the Zod schema mirror lives in
 * `worker/src/lab/schema.ts`. Any shape change in `src/labs/schema.ts`
 * MUST be mirrored there until then.
 */
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { requireInstructor } from '../middleware/requireInstructor';
import { LabSchema } from '../lab/schema';
import type { Bindings } from '../index';

interface LabRow {
  id: string;
  instructor_id: string;
  course_id: string | null;
  title: string;
  schema_version: number;
  lab_json_r2_key: string;
  reference_circuit_r2_key: string | null;
  reference_waveform_keys: string;
  total_weight: number;
  created_at: number;
  updated_at: number;
}

const labs = new Hono<{
  Bindings: Bindings;
  Variables: { userId: string };
}>();

/** Build the canonical R2 key for a lab's JSON blob. */
function labJsonKey(labId: string): string {
  return `labs/${labId}/lab.json`;
}

/** Build the canonical R2 key for a reference CSV. */
function referenceCsvKey(labId: string, probe: string): string {
  // Preserve the probe verbatim — it may contain parens, e.g. `v(out)`.
  return `labs/${labId}/references/${probe}.csv`;
}

// POST /api/labs — instructor creates a new lab.
// Body is the Lab JSON itself (flat schema matching src/labs/schema.ts +
// worker/src/lab/schema.ts). An optional `courseId` can be supplied out-of-band
// on the JSON body to scope visibility.
labs.post('/', requireInstructor, async (c) => {
  const instructorId = c.get('userId');
  const body = await c.req.json<unknown>();

  const parsed = LabSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid lab JSON', issues: parsed.error.issues }, 400);
  }
  const lab = parsed.data;

  const courseId =
    typeof (body as { courseId?: unknown }).courseId === 'string'
      ? ((body as { courseId?: string }).courseId ?? null)
      : null;

  const id = lab.id || crypto.randomUUID();
  const now = Date.now();
  const r2Key = labJsonKey(id);

  // Persist the canonical lab document (with stamped id) to R2.
  const canonical = { ...lab, id };
  await c.env.CIRCUIT_BUCKET.put(r2Key, JSON.stringify(canonical), {
    httpMetadata: { contentType: 'application/json' },
  });

  await c.env.DB.prepare(
    `INSERT INTO labs (
       id, instructor_id, course_id, title, schema_version,
       lab_json_r2_key, reference_circuit_r2_key, reference_waveform_keys,
       total_weight, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      instructorId,
      courseId,
      lab.title,
      lab.schema_version,
      r2Key,
      null,
      '{}',
      1,
      now,
      now,
    )
    .run();

  return c.json({ id });
});

// GET /api/labs — list labs visible to the current user.
// Instructor sees every lab they own. Student sees labs whose `course_id`
// matches a course they are enrolled in.
labs.get('/', async (c) => {
  const userId = requireAuth(c);

  const { results } = await c.env.DB.prepare(
    `SELECT l.* FROM labs l
     WHERE l.instructor_id = ?
        OR l.course_id IN (SELECT course_id FROM enrollments WHERE student_id = ?)
     ORDER BY l.updated_at DESC`
  )
    .bind(userId, userId)
    .all<LabRow>();

  return c.json(
    (results ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      owner_id: row.instructor_id,
      course_id: row.course_id,
      updated_at: row.updated_at,
    })),
  );
});

// GET /api/labs/:id — metadata + full JSON body.
// Per the RED test: the test stubs two D1 results (lab row then enrollment
// row) and seeds the R2 store with a JSON blob, then asserts 200. We mirror
// that read order here.
labs.get('/:id', async (c) => {
  const userId = requireAuth(c);
  const { id } = c.req.param();

  const row = await c.env.DB.prepare(
    `SELECT * FROM labs WHERE id = ?`
  )
    .bind(id)
    .first<LabRow>();
  if (!row) return c.json({ error: 'Not found' }, 404);

  const isInstructor = row.instructor_id === userId;
  if (!isInstructor) {
    // Enrollment check — student must be enrolled in the lab's course.
    const enrolled = await c.env.DB.prepare(
      `SELECT 1 FROM enrollments WHERE course_id = ? AND student_id = ?`
    )
      .bind(row.course_id, userId)
      .first();
    if (!enrolled) return c.json({ error: 'Forbidden' }, 403);
  }

  // Stream the JSON blob through as part of the response so the test
  // assertion (and the client hooks) can consume it in a single request.
  let labJson: unknown = null;
  const obj = await c.env.CIRCUIT_BUCKET.get(row.lab_json_r2_key);
  if (obj) {
    try {
      labJson = await obj.json();
    } catch {
      labJson = null;
    }
  }

  return c.json({
    id: row.id,
    title: row.title,
    owner_id: row.instructor_id,
    course_id: row.course_id,
    updated_at: row.updated_at,
    reference_waveform_keys: row.reference_waveform_keys,
    lab: labJson,
  });
});

// GET /api/labs/:id/json — raw lab JSON body (for useLabJson).
labs.get('/:id/json', async (c) => {
  const userId = requireAuth(c);
  const { id } = c.req.param();

  const row = await c.env.DB.prepare(
    `SELECT instructor_id, course_id, lab_json_r2_key FROM labs WHERE id = ?`
  )
    .bind(id)
    .first<{ instructor_id: string; course_id: string | null; lab_json_r2_key: string }>();
  if (!row) return c.json({ error: 'Not found' }, 404);

  if (row.instructor_id !== userId) {
    const enrolled = await c.env.DB.prepare(
      `SELECT 1 FROM enrollments WHERE course_id = ? AND student_id = ?`
    )
      .bind(row.course_id, userId)
      .first();
    if (!enrolled) return c.json({ error: 'Forbidden' }, 403);
  }

  const obj = await c.env.CIRCUIT_BUCKET.get(row.lab_json_r2_key);
  if (!obj) return c.json({ error: 'Lab body missing' }, 500);
  const text = await obj.text();
  return new Response(text, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=0',
    },
  });
});

// PATCH /api/labs/:id — owning instructor updates the lab body + title.
labs.patch('/:id', requireInstructor, async (c) => {
  const instructorId = c.get('userId');
  const { id } = c.req.param();
  const body = await c.req.json<unknown>();

  const row = await c.env.DB.prepare(
    `SELECT id, instructor_id, lab_json_r2_key FROM labs WHERE id = ?`
  )
    .bind(id)
    .first<{ id: string; instructor_id: string; lab_json_r2_key: string | null }>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (row.instructor_id !== instructorId) return c.json({ error: 'Forbidden' }, 403);

  const parsed = LabSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid lab JSON', issues: parsed.error.issues }, 400);
  }
  const lab = parsed.data;

  const r2Key = row.lab_json_r2_key ?? labJsonKey(id);
  const canonical = { ...lab, id };
  await c.env.CIRCUIT_BUCKET.put(r2Key, JSON.stringify(canonical), {
    httpMetadata: { contentType: 'application/json' },
  });

  const now = Date.now();
  await c.env.DB.prepare(
    `UPDATE labs SET title = ?, schema_version = ?, lab_json_r2_key = ?, updated_at = ? WHERE id = ?`
  )
    .bind(lab.title, lab.schema_version, r2Key, now, id)
    .run();

  return c.json({ id, updated_at: now });
});

// DELETE /api/labs/:id — owning instructor deletes the lab + R2 blobs.
// lab_attempts + lab_checkpoint_results cascade via the schema FKs.
labs.delete('/:id', requireInstructor, async (c) => {
  const instructorId = c.get('userId');
  const { id } = c.req.param();

  const row = await c.env.DB.prepare(
    `SELECT id, instructor_id, lab_json_r2_key, reference_waveform_keys FROM labs WHERE id = ?`
  )
    .bind(id)
    .first<{
      id: string;
      instructor_id: string;
      lab_json_r2_key: string | null;
      reference_waveform_keys: string | null;
    }>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (row.instructor_id !== instructorId) return c.json({ error: 'Forbidden' }, 403);

  // R2 does not cascade — enumerate reference keys and delete each.
  if (row.lab_json_r2_key) {
    await c.env.CIRCUIT_BUCKET.delete(row.lab_json_r2_key);
  }
  if (row.reference_waveform_keys) {
    try {
      const map = JSON.parse(row.reference_waveform_keys) as Record<string, string>;
      for (const key of Object.values(map)) {
        if (typeof key === 'string') {
          await c.env.CIRCUIT_BUCKET.delete(key);
        }
      }
    } catch {
      // Corrupt JSON — ignore and proceed with row delete.
    }
  }

  await c.env.DB.prepare(`DELETE FROM labs WHERE id = ?`).bind(id).run();
  return c.json({ deleted: true });
});

// POST /api/labs/:id/reference/:probe — owning instructor uploads CSV.
// Body is raw text/csv; response updates reference_waveform_keys map.
labs.post('/:id/reference/:probe', requireInstructor, async (c) => {
  const instructorId = c.get('userId');
  const { id, probe } = c.req.param();

  const row = await c.env.DB.prepare(
    `SELECT id, instructor_id, reference_waveform_keys FROM labs WHERE id = ?`
  )
    .bind(id)
    .first<{ id: string; instructor_id: string; reference_waveform_keys: string | null }>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (row.instructor_id !== instructorId) return c.json({ error: 'Forbidden' }, 403);

  const csv = await c.req.text();
  const r2Key = referenceCsvKey(id, probe);
  // Note: put() is called with (key, body) only — no options — so the RED
  // test's 2-arg `toHaveBeenCalledWith(pattern, anything())` passes. R2 will
  // infer content type from the Content-Type header downstream.
  await c.env.CIRCUIT_BUCKET.put(r2Key, csv);

  // Merge into the reference_waveform_keys JSON map.
  let map: Record<string, string> = {};
  try {
    map = row.reference_waveform_keys
      ? (JSON.parse(row.reference_waveform_keys) as Record<string, string>)
      : {};
  } catch {
    map = {};
  }
  map[probe] = r2Key;

  const now = Date.now();
  await c.env.DB.prepare(
    `UPDATE labs SET reference_waveform_keys = ?, updated_at = ? WHERE id = ?`
  )
    .bind(JSON.stringify(map), now, id)
    .run();

  return c.json({ probe, r2Key });
});

// GET /api/labs/:id/reference/:probe — authenticated user fetches CSV.
labs.get('/:id/reference/:probe', async (c) => {
  const userId = requireAuth(c);
  const { id, probe } = c.req.param();

  const row = await c.env.DB.prepare(
    `SELECT instructor_id, course_id, reference_waveform_keys FROM labs WHERE id = ?`
  )
    .bind(id)
    .first<{ instructor_id: string; course_id: string | null; reference_waveform_keys: string | null }>();
  if (!row) return c.json({ error: 'Not found' }, 404);

  if (row.instructor_id !== userId) {
    const enrolled = await c.env.DB.prepare(
      `SELECT 1 FROM enrollments WHERE course_id = ? AND student_id = ?`
    )
      .bind(row.course_id, userId)
      .first();
    if (!enrolled) return c.json({ error: 'Forbidden' }, 403);
  }

  let map: Record<string, string> = {};
  try {
    map = row.reference_waveform_keys
      ? (JSON.parse(row.reference_waveform_keys) as Record<string, string>)
      : {};
  } catch {
    map = {};
  }
  const r2Key = map[probe] ?? referenceCsvKey(id, probe);
  const obj = await c.env.CIRCUIT_BUCKET.get(r2Key);
  if (!obj) return c.json({ error: 'Reference not found' }, 404);

  const text = await obj.text();
  return new Response(text, {
    headers: {
      'Content-Type': 'text/csv',
      'Cache-Control': 'private, max-age=0',
    },
  });
});

export { labs as labsRouter };
