import { z } from 'zod';

/**
 * LTI 1.3 claim URIs (stable, from 1EdTech spec).
 * Constants let TypeScript keep the full URL strings out of the call sites.
 */
export const LTI_CLAIMS = {
  VERSION: 'https://purl.imsglobal.org/spec/lti/claim/version',
  MESSAGE_TYPE: 'https://purl.imsglobal.org/spec/lti/claim/message_type',
  DEPLOYMENT_ID: 'https://purl.imsglobal.org/spec/lti/claim/deployment_id',
  RESOURCE_LINK: 'https://purl.imsglobal.org/spec/lti/claim/resource_link',
  TARGET_LINK_URI: 'https://purl.imsglobal.org/spec/lti/claim/target_link_uri',
  CONTEXT: 'https://purl.imsglobal.org/spec/lti/claim/context',
  ROLES: 'https://purl.imsglobal.org/spec/lti/claim/roles',
  AGS_ENDPOINT: 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint',
  DL_SETTINGS: 'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings',
} as const;

/**
 * Zod schema for the subset of LTI 1.3 id_token claims OmniSpice requires.
 * Uses passthrough so unknown claims (e.g. Canvas custom extensions) survive
 * parse for downstream inspection.
 */
export const LtiLaunchClaimsSchema = z
  .object({
    iss: z.string().url(),
    aud: z.union([z.string(), z.array(z.string())]),
    sub: z.string(),
    nonce: z.string(),
    exp: z.number(),
    iat: z.number(),
    email: z.string().email().optional(),
    name: z.string().optional(),
    [LTI_CLAIMS.VERSION]: z.literal('1.3.0'),
    [LTI_CLAIMS.MESSAGE_TYPE]: z.enum([
      'LtiResourceLinkRequest',
      'LtiDeepLinkingRequest',
    ]),
    [LTI_CLAIMS.DEPLOYMENT_ID]: z.string(),
    [LTI_CLAIMS.TARGET_LINK_URI]: z.string().url().optional(),
    [LTI_CLAIMS.RESOURCE_LINK]: z
      .object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
      })
      .optional(),
    [LTI_CLAIMS.CONTEXT]: z
      .object({
        id: z.string(),
        label: z.string().optional(),
        title: z.string().optional(),
      })
      .optional(),
    [LTI_CLAIMS.ROLES]: z.array(z.string()).optional(),
    [LTI_CLAIMS.AGS_ENDPOINT]: z
      .object({
        scope: z.array(z.string()),
        lineitems: z.string().url().optional(),
        lineitem: z.string().url().optional(),
      })
      .optional(),
    [LTI_CLAIMS.DL_SETTINGS]: z
      .object({
        deep_link_return_url: z.string().url(),
        accept_types: z.array(z.string()),
        accept_presentation_document_targets: z.array(z.string()),
        data: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

export type LtiLaunchPayload = z.infer<typeof LtiLaunchClaimsSchema>;

/**
 * Zod schema for the POST /api/lti/platforms admin-registration body.
 * Every URL is URL-validated — malformed inputs must be rejected with 400.
 */
export const LtiPlatformRegistrationSchema = z.object({
  iss: z.string().url(),
  client_id: z.string().min(1),
  deployment_id: z.string().optional(),
  name: z.string().min(1),
  auth_login_url: z.string().url(),
  auth_token_url: z.string().url(),
  jwks_uri: z.string().url(),
});

export type LtiPlatformRegistration = z.infer<typeof LtiPlatformRegistrationSchema>;
