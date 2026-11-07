import { json } from "@/server/api";
import { signOut } from "@/server/auth";

export async function POST() {
  await signOut();
  return json({ ok: true });
}
