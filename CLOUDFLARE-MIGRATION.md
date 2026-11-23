# Twit AI Cloudflare Pages migration

This package preserves the static website, PWA files, admin page, and the existing `/api/*` request paths.

## Runtime architecture
- Cloudflare Pages serves the existing HTML, JS, PWA manifest, service worker, and icons.
- Pages Functions under `functions/api/` implement `/api/me`, `/api/generate`, `/api/stats`, `/api/admin`, `/api/subscribe`, and `/api/config`.
- Firebase Authentication remains the identity provider.
- The Functions validate Firebase ID tokens through Firebase Identity Toolkit `accounts:lookup`.
- Firestore data remains in the existing `twit-ai` project. The Functions use the Firestore REST API with a service-account OAuth token.
- OpenAI is called through the Responses API using `fetch`.

## Important safety
Do not change production domains until the preview passes all tests. Do not delete the old Vercel or Netlify deployments during testing.

## Cloudflare Pages build settings
- Framework preset: None
- Build command: leave blank
- Build output directory: `public`
- Root directory: `/`
- Production branch: `cloudflare-migration` (after uploading this package to that branch), or a dedicated migration branch.

## Required Pages secrets / variables
Set these in Pages > Settings > Variables and Secrets for Preview first:
- `OPENAI_API_KEY` (secret)
- `OPENAI_MODEL` (text, use the exact model currently working in production)
- `FIREBASE_PROJECT_ID` = `twit-ai`
- `FIREBASE_WEB_API_KEY` (copy the public `apiKey` already in your Firebase web config)
- `FIREBASE_CLIENT_EMAIL` (secret/config)
- `FIREBASE_PRIVATE_KEY` (secret; paste the full PEM private key, preserving line breaks or `\n` escapes)
- `ADMIN_EMAIL` (admin email)

The service account needs Firestore access with a role that permits reading and writing the current collections. Never commit real credentials.

## Firebase setup
1. Keep the existing Firestore database and collections. No data export or import is needed.
2. Keep the current Firestore rules denying direct browser access to server-owned collections.
3. In Firebase Authentication > Settings > Authorized domains, add `twitai.app`, `www.twitai.app`, and `backup.twitai.app` if not already listed.
4. Keep the existing `auth.twitai.app` DNS/custom-auth setup intact when moving DNS providers.
5. If Google sign-in uses a custom auth domain, preserve its DNS records and Firebase Hosting/Auth configuration. Do not replace those records with Pages records.

## Route compatibility
- `GET /api/me`
- `POST /api/generate`
- `GET /api/stats`
- `GET /api/admin` and `GET /api/admin?action=analytics&uid=...`
- `POST /api/admin` with `{ action, requestId }`
- `POST /api/subscribe`
- `GET /api/config`

## Known migration caveats requiring preview validation
- Firestore REST query and transaction behavior must be tested against the live Firebase project before switching production traffic.
- The original admin overview can read up to 1,000 users. Increase pagination if your project exceeds this.
- The original `api/prompt.js` only exported a prompt constant. The current website does not call `/api/prompt`; generation uses its embedded prompt.
- `generationLogs` are defined in the data model but the current `generate.js` implementation updates only `users` and `usageDaily`. This migration preserves the live implementation rather than adding new log writes.
- Set a suitable Worker CPU limit plan based on actual request measurements. OpenAI/Firestore network wait is not CPU time, but parsing and cryptographic work still count.

## Test checklist
1. `GET /api/config` returns plans and payment details.
2. Without a bearer token, `GET /api/me` returns 401.
3. With a valid Firebase ID token, `GET /api/me` returns the existing user profile.
4. `GET /api/stats` returns 30 days of aggregates.
5. Generate one test reply with a test account and verify `freeTweetsUsed`, `totalTweetsSubmitted`, `totalRepliesGenerated`, and `usageDaily`.
6. Force an invalid OpenAI key in Preview and verify the reserved free use is rolled back.
7. Submit a test subscription request and verify it appears in the admin screen.
8. Test admin reject and approve on a test payment request only.
9. Test the published browser extension against the Preview deployment only after setting its API host for a temporary test build.
10. Check service worker updates and mobile Google sign-in.

## Deploy
Connect the GitHub migration branch to Cloudflare Pages. Set the build output directory to `public`. Keep `main` unchanged until all tests pass.
