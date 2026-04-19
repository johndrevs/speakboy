import { z } from "zod";

function optionalEnvString() {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue === "" ? undefined : trimmedValue;
  }, z.string().min(1).optional());
}

const envSchema = z.object({
  OPENAI_API_KEY: optionalEnvString(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  TWILIO_ACCOUNT_SID: optionalEnvString(),
  TWILIO_AUTH_TOKEN: optionalEnvString(),
  SUPABASE_URL: optionalEnvString(),
  SUPABASE_SERVICE_ROLE_KEY: optionalEnvString(),
  TWILIO_SKIP_SIGNATURE_VALIDATION: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true")
});

export const env = envSchema.parse({
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  TWILIO_SKIP_SIGNATURE_VALIDATION:
    process.env.TWILIO_SKIP_SIGNATURE_VALIDATION
});
