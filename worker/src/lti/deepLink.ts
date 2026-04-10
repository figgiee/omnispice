/**
 * LTI 1.3 Deep Linking 2.0 response builder.
 *
 * The tool (OmniSpice) receives a LtiDeepLinkingRequest message from the LMS
 * when an instructor clicks "Add External Tool" in Canvas/Moodle. We present
 * a picker UI, the instructor chooses one or more OmniSpice assignments, and
 * the selections are packaged as a signed JWT containing the
 * `content_items` claim and POSTed back to the platform's
 * `deep_link_return_url`.
 *
 * Key invariants (LTI-DL 2.0 §4.2, verified against the moodle-id-token
 * fixture and the lti-deeplinking-1p3 spec):
 *
 *  - iss  = tool client_id (the LMS-assigned aud in the request = tool's iss in the response)
 *  - aud  = platform iss (inversion)
 *  - deployment_id claim is echoed verbatim from the original launch
 *  - If `deep_linking_settings.data` was present in the request, echo it
 *    back under the `lti-dl/claim/data` claim (it's an opaque round-trip value)
 *  - JWT signed with the tool's private RS256 key, kid in protected header
 *
 * The live route handler in `worker/src/routes/lti.ts` wires the real
 * private key via `getToolPrivateKey(env)`; unit tests pass an already-
 * imported CryptoKey directly so the test suite doesn't need a Workers env.
 */

import { SignJWT, type KeyLike } from 'jose';
import { LTI_CLAIMS } from './claims';

export interface DeepLinkContentItem {
  type: 'ltiResourceLink';
  title: string;
  url: string;
  /** Custom parameters echoed into the subsequent launch (e.g. assignment id) */
  custom?: Record<string, string>;
  /** AGS line item spec — triggers Canvas/Moodle to materialize a gradebook column */
  lineItem?: {
    label: string;
    scoreMaximum: number;
    resourceId?: string;
    tag?: string;
  };
  /** Optional ContentItem display hints */
  text?: string;
  icon?: { url: string; width?: number; height?: number };
  thumbnail?: { url: string; width?: number; height?: number };
}

export interface BuildDeepLinkingResponseOptions {
  /** Tool private key (already imported via jose.importPKCS8) */
  privateKey: KeyLike;
  /** Key id — must match the `kid` advertised in the tool's public JWKS */
  kid: string;
  /**
   * Tool's client_id (as assigned by the LMS during platform registration).
   * In LTI DL response rules this becomes the JWT `iss`.
   */
  clientId: string;
}

/**
 * Build a signed LtiDeepLinkingResponse id_token ready to be POSTed to the
 * platform's `deep_link_return_url`.
 *
 * Accepts the *original* LtiDeepLinkingRequest claims (unknown shape) and
 * picks out the fields it needs — deployment_id, data (if present), iss.
 */
export async function buildDeepLinkingResponse(
  originalClaims: Record<string, unknown>,
  contentItems: DeepLinkContentItem[],
  options: BuildDeepLinkingResponseOptions,
): Promise<string> {
  const { privateKey, kid, clientId } = options;

  const deploymentId =
    (originalClaims[LTI_CLAIMS.DEPLOYMENT_ID] as string | undefined) ?? '';
  const platformIss = (originalClaims.iss as string | undefined) ?? '';

  const dlSettings = originalClaims[LTI_CLAIMS.DL_SETTINGS] as
    | { data?: string }
    | undefined;

  const now = Math.floor(Date.now() / 1000);

  const payload: Record<string, unknown> = {
    [LTI_CLAIMS.MESSAGE_TYPE]: 'LtiDeepLinkingResponse',
    [LTI_CLAIMS.VERSION]: '1.3.0',
    [LTI_CLAIMS.DEPLOYMENT_ID]: deploymentId,
    'https://purl.imsglobal.org/spec/lti-dl/claim/content_items': contentItems,
  };

  if (dlSettings?.data !== undefined) {
    payload['https://purl.imsglobal.org/spec/lti-dl/claim/data'] =
      dlSettings.data;
  }

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' })
    .setIssuer(clientId) // tool is the iss of the DL response
    .setAudience([platformIss]) // platform is the aud (inversion) — must be array per LTI spec
    .setIssuedAt(now)
    .setExpirationTime(now + 600) // 10 minutes, well inside the 5-min nonce TTL
    .setJti(crypto.randomUUID())
    .sign(privateKey);
}

/**
 * Convenience builder for the OmniSpice "assignment -> ContentItem" mapping.
 * Used by the deep-link route to turn a selected assignment id + title
 * into a fully-populated ContentItem ready for inclusion in the response.
 */
export function assignmentToContentItem(args: {
  assignmentId: string;
  title: string;
  launchUrl: string;
  scoreMaximum?: number;
  lineItemUrl?: string;
}): DeepLinkContentItem {
  const item: DeepLinkContentItem = {
    type: 'ltiResourceLink',
    title: args.title,
    url: args.launchUrl,
    custom: { omnispice_assignment_id: args.assignmentId },
    lineItem: {
      label: args.title,
      scoreMaximum: args.scoreMaximum ?? 100,
      resourceId: args.assignmentId,
    },
  };
  return item;
}
