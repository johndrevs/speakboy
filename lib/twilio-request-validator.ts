import twilio from "twilio";

import { env } from "@/lib/env";

export function validateTwilioRequest(
  request: Request,
  params: Record<string, string>
) {
  if (env.TWILIO_SKIP_SIGNATURE_VALIDATION) {
    return {
      isValid: true
    } as const;
  }

  if (!env.TWILIO_AUTH_TOKEN) {
    return {
      isValid: false,
      message: "Missing TWILIO_AUTH_TOKEN for webhook signature validation."
    } as const;
  }

  const signature = request.headers.get("x-twilio-signature");
  if (!signature) {
    return {
      isValid: false,
      message: "Missing X-Twilio-Signature header."
    } as const;
  }

  const url = getWebhookUrl(request);
  const isValid = twilio.validateRequest(
    env.TWILIO_AUTH_TOKEN,
    signature,
    url,
    params
  );

  return isValid
    ? ({ isValid: true } as const)
    : ({
        isValid: false,
        message: "Invalid Twilio webhook signature."
      } as const);
}

function getWebhookUrl(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (forwardedProto && forwardedHost) {
    const url = new URL(request.url);
    return `${forwardedProto}://${forwardedHost}${url.pathname}${url.search}`;
  }

  return request.url;
}
