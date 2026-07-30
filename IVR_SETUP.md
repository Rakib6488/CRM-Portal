# Call Portal (IVR) — Setup Guide (Test Mode)

This adds a browser-based "softphone" widget to the portal so agents can receive
real inbound phone calls, plus a basic IVR menu that routes calls to whichever
agent is currently "available".

## What was added
- `server.ts`: `/api/ivr/token`, `/api/ivr/voice`, `/api/ivr/route`,
  `/api/ivr/status-callback`, `/api/ivr/calls`, `/api/ivr/config`
- `src/components/CallWidget.tsx`: floating bottom-right widget — Ready/Offline
  toggle, incoming-call popup (Receive/Decline), and in-call controls (Hold,
  Mute, End). Rendered globally from `src/App.tsx` whenever an agent is logged in.
- `src/types.ts`: `CallLogEntry`, `IvrMenuOption` types
- `.env.example`: new `TWILIO_*` variables
- `package.json`: added `twilio` (server SDK) and `@twilio/voice-sdk` (browser SDK)

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
