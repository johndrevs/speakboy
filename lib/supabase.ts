function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

export function getOptionalEnv(name: string) {
  return process.env[name]?.trim() || null;
}

export function hasSupabaseConfig() {
  return Boolean(getOptionalEnv("SUPABASE_URL") && getOptionalEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

export function getSupabaseConfig() {
  return {
    url: requireEnv("SUPABASE_URL"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  };
}

export async function supabaseRequest(path: string, init: RequestInit = {}) {
  const { url, serviceRoleKey } = getSupabaseConfig();

  return fetch(`${url}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {})
    }
  });
}
