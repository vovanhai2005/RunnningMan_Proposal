import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env, isDemo, usernameToEmail } from "./config";
import { DEMO_ACCOUNTS } from "./store";

const DEMO_COOKIE = "rm_demo_user";
/** Phiên đăng nhập giữ nhiều ngày (mục 2.1) */
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/** Supabase client theo cookie của người dùng (khóa anon), dùng trong Route Handler. */
async function supabaseForRequest() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookieOptions: { maxAge: SESSION_MAX_AGE, sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) store.set(name, value, options);
      },
    },
  });
}

/** Trả về user id đang đăng nhập (tự làm mới token nếu cần), hoặc null. */
export async function getUserId(): Promise<string | null> {
  if (isDemo) {
    const name = (await cookies()).get(DEMO_COOKIE)?.value;
    return name && DEMO_ACCOUNTS[name] ? `demo:${name}` : null;
  }
  const supabase = await supabaseForRequest();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function signIn(username: string, password: string): Promise<boolean> {
  if (isDemo) {
    const name = username.trim().toLowerCase();
    if (DEMO_ACCOUNTS[name]?.password !== password) return false;
    (await cookies()).set(DEMO_COOKIE, name, {
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return true;
  }
  const supabase = await supabaseForRequest();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  return !error;
}

export async function signOut(): Promise<void> {
  if (isDemo) {
    (await cookies()).delete(DEMO_COOKIE);
    return;
  }
  const supabase = await supabaseForRequest();
  await supabase.auth.signOut();
}
