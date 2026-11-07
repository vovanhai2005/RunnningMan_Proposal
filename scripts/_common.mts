import { createClient } from "@supabase/supabase-js";
import { DEFAULT_LOGIN_EMAIL_DOMAIN, usernameToEmail } from "../src/lib/username";

export function need(name: string, ...alts: string[]): string {
  for (const n of [name, ...alts]) {
    const v = process.env[n];
    if (v) return v;
  }
  console.error(`✗ Thiếu biến môi trường ${name}. Kiểm tra file .env.local (xem .env.example).`);
  process.exit(1);
}

export function admin() {
  const url = need("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const key = need("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function emailOf(username: string) {
  return usernameToEmail(username, process.env.LOGIN_EMAIL_DOMAIN || DEFAULT_LOGIN_EMAIL_DOMAIN);
}

/** --key value / --flag */
export function args() {
  const out: Record<string, string | true> = {};
  const rest: string[] = [];
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith("--")) {
      const k = a[i].slice(2);
      if (a[i + 1] && !a[i + 1].startsWith("--")) out[k] = a[++i];
      else out[k] = true;
    } else rest.push(a[i]);
  }
  return { opts: out, rest };
}

export async function findUserByEmail(db: ReturnType<typeof admin>, email: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}
