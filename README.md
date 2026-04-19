# SpeakBoy

SpeakBoy is an MVP starter for an app where a pet can "speak" inside an SMS thread. A user defines the pet's voice, connects a Twilio phone number, and inbound texts receive AI-generated replies in that persona.

## What is included

- A landing page and setup form for creating and editing pet personas
- `POST /api/pets` to create a persona in a simple JSON file store for local development
- `PUT /api/pets/[id]` to edit an existing persona
- `POST /api/sms/webhook` to receive Twilio webhooks and return TwiML replies
- OpenAI response generation with a safe fallback when no API key is configured
- Twilio webhook signature validation with an explicit local-development bypass
- Supabase persistence support using the same env-based server pattern as Persona MVP

## Architecture

1. A pet profile stores the name, species, writing style, backstory, and assigned Twilio number.
2. Twilio forwards inbound SMS payloads to `/api/sms/webhook`.
3. The webhook finds the matching pet by the receiving number.
4. Recent thread history is passed to OpenAI to produce a short SMS reply in the pet's voice.
5. The server returns TwiML so Twilio can send the reply back into the thread.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example environment file:

   ```bash
   cp .env.example .env.local
   ```

3. Add your OpenAI key and Twilio credentials.
4. If you want Vercel-ready persistence, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, then apply [supabase/schema.sql](/Users/johndrevs/SpeakBoy/supabase/schema.sql) to your Supabase project.
5. Keep `TWILIO_SKIP_SIGNATURE_VALIDATION=false` for real Twilio traffic. Only set it to `true` if you are testing the webhook locally without a valid Twilio signature.
6. Start the app:

   ```bash
   npm run dev
   ```

7. Expose the app to Twilio with a tunnel such as ngrok, then set your Twilio number's incoming message webhook to:

   ```text
   https://your-domain.example/api/sms/webhook
   ```

## Twilio validation notes

- The SMS webhook now rejects requests that do not include a valid `X-Twilio-Signature`.
- Validation uses your `TWILIO_AUTH_TOKEN` and the exact webhook URL Twilio called.
- If you are using a tunnel or proxy, keep the webhook URL in Twilio exactly aligned with the public URL reaching this app.
- For local manual testing with `curl` or Postman, set `TWILIO_SKIP_SIGNATURE_VALIDATION=true` temporarily.

## Important limitations in this starter

- If Supabase is not configured, data falls back to `data/store.json`, which is acceptable for local development only.
- There is no authentication or billing layer yet.
- There is no moderation or abuse protection beyond the prompt rules.

## Recommended next steps

- Make Supabase the required persistence layer once you move past local prototyping.
- Add owner authentication and role-based access around persona management.
- Store message history and summaries per contact thread.
- Add onboarding for buying or attaching a Twilio number.
- Add guardrails for impersonation, sensitive topics, and opt-out handling.
