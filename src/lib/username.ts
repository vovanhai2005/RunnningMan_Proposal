/** "linh" → "linh@<domain>"; giữ nguyên nếu đã là email. Dùng chung cho server và script. */
export function usernameToEmail(username: string, domain: string): string {
  const u = username.trim().toLowerCase();
  return u.includes("@") ? u : `${u}@${domain}`;
}

export const DEFAULT_LOGIN_EMAIL_DOMAIN = "players.race";
