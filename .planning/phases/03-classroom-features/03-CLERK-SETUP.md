# Phase 3 — Manual Clerk Dashboard Setup

Before Phase 3 Worker role enforcement works, you must add a custom claim to
the Clerk session token template. This is a dashboard-only setting (not code).

## Steps

1. Open https://dashboard.clerk.com → select the OmniSpice project
2. Navigate to **Sessions → Customize session token**
3. Add the following claim to the JSON template:

   ```json
   {
     "role": "{{user.public_metadata.role}}"
   }
   ```

4. Save. Existing sessions will pick up the new claim on their next token refresh
   (typically < 1 minute — or force-refresh with `getToken({ skipCache: true })`).

## Verification

After saving, open the OmniSpice editor while signed in, open DevTools →
Application → Cookies → find the `__session` cookie → decode the JWT at
https://jwt.io → confirm the payload contains a top-level `"role"` key.

## Fallback (if dashboard access blocked)

The Worker can read role via `clerk.users.getUser(userId)` per-request as a
fallback. This adds ~100ms per protected route and should only be used if the
dashboard step is unavailable. See 03-RESEARCH.md §"Environment Availability".
