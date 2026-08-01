# Call Portal (IVR) — Setup Guide (Test Mode)

This adds a browser-based "softphone" widget to the portal so agents can receive
real inbound phone calls, plus a basic IVR menu that routes calls to whichever
agent is currently "available".

## What was added
- `server.ts`: `/api/ivr/token`, `/api/ivr/voice`, `/api/ivr/route`,
  `/api/ivr/status-callback`, `/api/ivr/calls`, `/api/ivr/config`,
  `/api/ivr/transfer`, `/api/ivr/summary`, `/api/ivr/customer-history`
- `src/hooks/useCallCenter.ts`: owns the Twilio Device + live call state at
  the top of the app (in `App.tsx`), so an active or ringing call survives
  switching tabs — it doesn't get destroyed just because you navigated away.
- `src/components/CallCenterSection.tsx`: the full **"CSR Call Center"**
  page (sidebar item, next to Agent Reports) — Connect/Disconnect, Ready
  toggle, Transfer, Mute, Hangup, an Answer/Decline banner while ringing, a
  **Customer History** panel, and a **Summary** panel.
- `src/components/CallFloatingPopup.tsx`: a small dark, right-side floating
  popup that appears **only while a call is ringing or connected**, on
  every page **except** the CSR Call Center page itself (which already has
  the full controls). Shows the caller number, status, and just the
  essentials — Answer/Decline while ringing, Mute/Hangup once connected —
  plus a button to jump straight to the full page. It reads from the same
  shared state as the full page, so accepting a call from the popup (or
  from the full page) keeps everything in sync.
- `src/types.ts`: `CallLogEntry` (+ summary fields), `IvrMenuOption` types
- `.env.example`: new `TWILIO_*` variables
- `package.json`: added `twilio` (server SDK) and `@twilio/voice-sdk` (browser SDK)

Incoming calls are no longer auto-answered — you'll see Answer/Decline
either on the popup or on the full page, whichever you're looking at.

### How "Ready" and "Connect/Disconnect" differ
- **Connect / Disconnect** — registers/unregisters the browser as a Twilio
  softphone (the thing that can actually ring).
- **Ready** — the agent's general availability, using the same status system
  the rest of the portal already has (the one behind Ready/Break elsewhere).
  Only "available" agents get calls routed to them by the IVR.

### Transfer
Picks any other **available** agent from the live roster and hands the call
straight to their browser via Twilio's REST API (no hold music mid-transfer —
it's a direct redirect, not a warm/announced transfer).

### Customer History
Looked up by matching the caller's phone number to a CRM contact, then
listing that contact's support tickets (category / title, date, and the CSR
from the ticket's last reply). If no contact matches the number, it just says
so — nothing crashes.

### Summary
Saved straight onto that call's record in MongoDB (`ivr_calls` collection) —
category + remark. The badge flips to "Complete Summary" once both are filled in.

## One-time Twilio setup (free trial account is fine for testing)
1. Create a Twilio account: https://www.twilio.com/try-twilio
2. Buy/claim a Voice-capable phone number (Console → Phone Numbers)
3. Console → Account → API keys & tokens → create a **Standard API key** →
   note the SID and Secret
4. Console → Voice → TwiML Apps → create one, set **Request URL** (Voice
   Configuration) to `https://<your-deployed-url>/api/ivr/voice`
5. Copy these into your `.env`:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_API_KEY_SID`
   - `TWILIO_API_KEY_SECRET`
   - `TWILIO_TWIML_APP_SID`
   - `TWILIO_CALLER_ID` (the number you bought, e.g. `+18005551234`)
6. On the phone number itself (Console → Phone Numbers → your number →
   Voice Configuration → "A call comes in"), set the webhook to the same
   `/api/ivr/voice` URL.
7. `npm install` (pulls in `twilio` + `@twilio/voice-sdk`), then `npm run dev`.

## Trial-account limits (until you upgrade/pay)
- You can only call the number from, or receive bridged calls to, phone
  numbers you've **verified** in the Twilio Console (Console → Phone
  Numbers → Verified Caller IDs).
- Every call plays a short "You have a trial account" message first — this
  disappears automatically once the account is upgraded, no code change needed.

## How it behaves
1. A real call comes into your Twilio number.
2. Caller hears the IVR menu (edit `IVR_MENU` in `server.ts` to change it).
3. Based on the digit pressed, the server picks an agent whose live status is
   `available` (the same status your existing Ready/Break system already
   tracks) and rings that agent's browser via the `CallWidget`.
4. If nobody is available, the caller is asked to leave a voicemail.
5. Every call is logged to a new Firestore collection `ivr_calls`, viewable via
   `GET /api/ivr/calls`.

## Known simplification
"Hold" in the widget is implemented as mute + a UI state change (no hold
music), since real hold-with-music requires routing the call through a Twilio
Conference. That's a reasonable next step if you want it later — happy to add
it.

## Storage: IVR call logs live in MongoDB Atlas (not Firestore)
Only the `ivr_calls` data was moved to MongoDB — everything else (auth,
tickets, CRM, roster, activity logs, audit logs) is still Firestore, unchanged.

- `MONGODB_URI` and `MONGODB_DB_NAME` are already filled in in `.env.local`
  from the Atlas credentials you provided.
- `npm install` will pull in the `mongodb` driver.
- On server start it connects to Atlas and ensures a unique index on
  `callSid` in the `ivr_calls` collection.
- If Atlas is unreachable for any reason, call logging falls back to an
  in-memory list automatically (server still works, logs just aren't
  persisted across restarts) — check the server console for
  `[MongoDB] Connection failed` warnings if that happens.
- `GET /api/ivr/calls` and the admin CSV export
  (`/api/admin/export-csv?collection=ivr_calls`) both read from MongoDB now.
- You can browse the data visually with **MongoDB Compass**: open it, paste
  in your `MONGODB_URI`, connect, and look for the `customer_support_portal`
  database → `ivr_calls` collection.

### Security note
`.env.local` now contains both your Firebase Admin private key and your
MongoDB Atlas password. It's already excluded from git via `.gitignore`
(`.env*` is ignored) — just make sure you don't paste its contents anywhere
public, and if either credential is ever exposed, rotate it from the
respective console (Firebase → Service Accounts, Atlas → Database Access).
