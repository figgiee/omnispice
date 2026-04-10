# 04-CANVAS-SETUP — Canvas LTI Sandbox Provisioning (Manual Dev-Env Step)

**Owner plan:** 04-02 (LTI launch + deep linking)
**Automated:** NO — this is a manual dev-env task that must be completed
once per developer, before executing plan 04-02. Documented here per
`04-VALIDATION.md` "manual-only" table.
**Prereq status:** unblocked as of 04-01 (JWKS stub serves at
`/lti/.well-known/jwks.json`).

## What you are doing

You are registering OmniSpice as an LTI 1.3 tool inside a free Canvas
Instructure sandbox. This gives you a live platform to test the OIDC
login → launch → deep-linking → AGS flow against during 04-02..04-03.

You only need to do this ONCE per developer machine. The resulting
Client ID goes into `/api/lti/platforms` in plan 04-02.

## Prerequisites

- [ ] A deployed Cloudflare preview Worker URL with the Phase 4 JWKS
      route live. Run `pnpm --filter worker dev` locally and use
      `wrangler tail` + a tunnel (e.g., `cloudflared`) if you need a
      public URL. OR deploy a preview with `wrangler deploy`.
- [ ] Your Worker URL serves `/lti/.well-known/jwks.json` with a real
      (non-empty) key set. Plan 04-01's Wave 0 stub returns
      `{"keys":[]}` — you must either:
      1. Wait until plan 04-02 lands the real JWKS derivation, OR
      2. Manually paste the tool's public JWK into the stub temporarily.
- [ ] Your `LTI_PRIVATE_KEY` is set for the preview worker via
      `wrangler secret put LTI_PRIVATE_KEY`.

## Step-by-step click-through

1. Create a free Instructure sandbox at
   <https://canvas.instructure.com/register>. Use your university
   address if you have one — some placements only unlock for `.edu`
   accounts.

2. Sign in. At the top-left, click **Account → Admin** (you may need
   to click your profile picture first). Select the root account
   (usually named "Site Admin" or your sandbox name).

3. Go to **Developer Keys** (left sidebar).

4. Click **+ Developer Key → + LTI Key**.

5. In the **Key Settings** form:

   - **Key Name:** `OmniSpice Dev`
   - **Owner Email:** your email
   - **Redirect URIs** (one per line):
     ```
     https://{preview-worker}.workers.dev/lti/launch
     ```
   - **Method:** `Public JWK URL`
   - **Public JWK URL:**
     ```
     https://{preview-worker}.workers.dev/lti/.well-known/jwks.json
     ```

6. **LTI Advantage Services** — enable ALL of:
   - `Can create and view assignment data in the gradebook associated with the tool.`
   - `Can view submission data for assignments associated with the tool.`
   - `Can create and update line items for a tool.`
   - `Can create and update result records associated with a line item.`
   - `Can view Progress records associated with the context the tool is installed in.`

7. **Additional Settings**:

   - **Title:** `OmniSpice`
   - **Description:** `Modern web SPICE simulator for circuits courses.`
   - **Target Link URI:**
     ```
     https://{preview-worker}.workers.dev/lti/launch
     ```
   - **OpenID Connect Initiation URL:**
     ```
     https://{preview-worker}.workers.dev/lti/oidc/login
     ```
   - **JWK Method:** Public JWK URL (already set above)
   - **Privacy Level:** `Public` (needed so the tool receives student
     email/name claims — important for externalId mapping in plan
     04-02)

8. **Placements** — add at least:

   - **Assignment Selection** (for deep-linking: lets instructors pick
     an OmniSpice circuit when creating an assignment)
   - **Link Selection** (for in-module embeds, optional)
   - **Editor Button** (optional — lets instructors insert OmniSpice
     links into rich content)

9. Click **Save**.

10. Back on the Developer Keys page, find your new key in the list
    and **toggle its state from OFF to ON** (the default is OFF, and
    the key is NOT usable until enabled).

11. Copy the **Client ID** shown in the Details column. This is the
    `client_id` value you will POST to `/api/lti/platforms` when plan
    04-02 lands the admin route, along with:

    ```json
    {
      "iss": "https://canvas.instructure.com",
      "client_id": "<paste client id here>",
      "name": "Canvas Dev Sandbox",
      "auth_login_url": "https://canvas.instructure.com/api/lti/authorize_redirect",
      "auth_token_url": "https://canvas.instructure.com/login/oauth2/token",
      "jwks_uri": "https://canvas.instructure.com/api/lti/security/jwks"
    }
    ```

12. Install the tool in a test course:

    - Create (or pick) a test course in your sandbox.
    - Course → **Settings → Apps → View App Configurations → + App**.
    - **Configuration Type:** `By Client ID`.
    - Paste the Client ID from step 11.
    - Click **Submit → Install**.

13. Verify the placement works:

    - In your test course, go to **Assignments → + Assignment**.
    - Give it a name and under **Submission Type** pick **External Tool**.
    - Click **Find → OmniSpice** — Canvas launches the tool in an iframe.
    - Your OmniSpice deep-linking UI (built in plan 04-02) will appear.

## Troubleshooting

- **Key is ON but launch fails immediately** — most often the Public
  JWK URL returns `{"keys":[]}` (the Wave 0 stub from 04-01). Wait for
  04-02 or manually paste a real JWK during dev.
- **"Invalid issuer" error in the worker logs** — `/api/lti/platforms`
  was not populated with the Canvas issuer `https://canvas.instructure.com`.
  Run the POST in step 11 again.
- **Sign-in loop inside the Canvas iframe** — third-party cookie
  blocking. Plan 04-02 uses the Clerk ticket-bootstrap pattern
  specifically to sidestep this. If the loop persists, test in a
  Chrome window with third-party cookies enabled for
  `*.clerk.accounts.dev` as a sanity check.

## Manual — by design

Canvas does not expose a public API for creating Developer Keys in a
sandbox account (only the account-admin UI does). This means
automated provisioning is not viable for the OmniSpice dev loop. The
manual cost is ~10 minutes, once per developer. Documented here so
04-02 can assume the developer has already completed these steps
before running the plan.
