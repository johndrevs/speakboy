# SpeakBoy Deployment Setup

Use separate resources for SpeakBoy. Do not reuse `persona-mvp` resources.

## Project names

- GitHub repository: `speakboy`
- Vercel project: `speakboy`
- Supabase project: `speakboy`

## Separation rules

- Use a new Supabase project, not the `persona-mvp` database.
- Use a new GitHub repository, not the `persona-mvp` repository.
- Use a new Vercel project connected only to the `speakboy` repository.
- Copy only the required environment variable values. Do not share deployment settings, database URLs, or service-role keys across apps.

## Supabase

1. Create a new Supabase project named `speakboy`.
2. Open the SQL editor.
3. Run [supabase/schema.sql](/Users/johndrevs/SpeakBoy/supabase/schema.sql).
4. Copy these values into SpeakBoy env configuration:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## GitHub

1. Create a new empty repository named `speakboy`.
2. Initialize the local repo if needed.
3. Add the new GitHub remote for SpeakBoy only.
4. Push the SpeakBoy codebase to that repo.

## Vercel

1. Create a new Vercel project named `speakboy`.
2. Import the `speakboy` GitHub repository.
3. Add environment variables:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_SKIP_SIGNATURE_VALIDATION=false`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy.
5. Use the Vercel URL for Twilio's incoming message webhook:
   - `https://your-speakboy-domain.vercel.app/api/sms/webhook`

## Post-deploy check

- Confirm pet personas save and reload after refresh.
- Confirm thread history persists.
- Confirm the Twilio webhook responds on the Vercel domain.
