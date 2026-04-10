import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TokenIssuedRecord {
  assertion: string;
  scope: string;
  grantType: string;
}

interface ScoreReceivedRecord {
  lineItemUrl: string;
  contentType: string;
  authorization: string;
  body: unknown;
}

export interface MockPlatform {
  jwks: { keys: Array<Record<string, unknown>> };
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
  tokenIssued: TokenIssuedRecord[];
  scoresReceived: ScoreReceivedRecord[];
  lineItemsPosted: unknown[];
}

/**
 * In-memory LTI platform mock.
 * - Serves JWKS from `worker/tests/fixtures/lti/jwks.json`
 * - Simulates the OIDC token endpoint (client_credentials grant) for AGS tests
 * - Records score POSTs so tests can assert Content-Type + Authorization + body
 * - Accepts lineitem PUT/GET to round-trip `ensureLineItem()`
 *
 * Intentionally NOT a real HTTP server — tests wire this into modules either
 * by monkey-patching `globalThis.fetch` or by passing it as a dependency.
 */
export function createMockPlatform(): MockPlatform {
  const jwks = JSON.parse(
    readFileSync(resolve(__dirname, '../fixtures/lti/jwks.json'), 'utf8'),
  ) as { keys: Array<Record<string, unknown>> };

  const tokenIssued: TokenIssuedRecord[] = [];
  const scoresReceived: ScoreReceivedRecord[] = [];
  const lineItemsPosted: unknown[] = [];

  async function fetchImpl(input: Request | string, init: RequestInit = {}): Promise<Response> {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (init.method ?? (typeof input === 'string' ? 'GET' : input.method)).toUpperCase();

    // JWKS endpoint
    if (url.pathname.endsWith('/.well-known/jwks.json') || url.pathname.endsWith('/jwks.json')) {
      return new Response(JSON.stringify(jwks), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // OAuth2 token endpoint (client_credentials grant)
    if (url.pathname.endsWith('/login/oauth2/token') || url.pathname.endsWith('/token')) {
      const bodyStr = typeof init.body === 'string' ? init.body : '';
      const params = new URLSearchParams(bodyStr);
      tokenIssued.push({
        assertion: params.get('client_assertion') ?? '',
        scope: params.get('scope') ?? '',
        grantType: params.get('grant_type') ?? '',
      });
      return new Response(
        JSON.stringify({
          access_token: 'mock-bearer-token-' + tokenIssued.length,
          token_type: 'Bearer',
          expires_in: 3600,
          scope: params.get('scope') ?? '',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // AGS score passback endpoint (MUST require application/vnd.ims.lis.v1.score+json)
    if (url.pathname.endsWith('/scores')) {
      const headers = normaliseHeaders(init.headers);
      const rawBody = typeof init.body === 'string' ? init.body : '';
      scoresReceived.push({
        lineItemUrl: url.href.replace(/\/scores$/, ''),
        contentType: headers.get('content-type') ?? '',
        authorization: headers.get('authorization') ?? '',
        body: rawBody ? JSON.parse(rawBody) : null,
      });
      if (headers.get('content-type') !== 'application/vnd.ims.lis.v1.score+json') {
        return new Response(JSON.stringify({ error: 'invalid_content_type' }), {
          status: 415,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // A 204 response must not carry a body — pass `null` per Fetch spec,
      // otherwise undici (Node 20+) throws "Invalid response status code 204".
      return new Response(null, { status: 204 });
    }

    // Line items: GET list / POST create / GET single
    if (url.pathname.includes('/line_items')) {
      if (method === 'POST') {
        const rawBody = typeof init.body === 'string' ? init.body : '';
        const parsed = rawBody ? JSON.parse(rawBody) : {};
        lineItemsPosted.push(parsed);
        return new Response(
          JSON.stringify({ ...parsed, id: url.href + '/mock-lineitem-id' }),
          { status: 201, headers: { 'Content-Type': 'application/application/vnd.ims.lis.v2.lineitem+json' } },
        );
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/vnd.ims.lis.v2.lineitemcontainer+json' },
      });
    }

    return new Response('not found: ' + url.href, { status: 404 });
  }

  return {
    jwks,
    fetch: fetchImpl,
    tokenIssued,
    scoresReceived,
    lineItemsPosted,
  };
}

function normaliseHeaders(headers: HeadersInit | undefined): Headers {
  if (!headers) return new Headers();
  if (headers instanceof Headers) return headers;
  return new Headers(headers as Record<string, string>);
}
