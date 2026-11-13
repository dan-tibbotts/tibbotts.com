// Local demonstration adapter. This module is NOT a security boundary.
import { all, get, meta, setMeta } from "./store.mjs";
export async function currentUser({ allowExpired = true } = {}) {
  const session = await meta("session", null);
  if (!session || (!allowExpired && session.expiresAt < Date.now()))
    return null;
  const user = await get("users", session.userId);
  return user?.active ? user : null;
}
export async function requireUser() {
  const user = await currentUser({ allowExpired: false });
  if (!user)
    throw new Error(
      "Your demo session has expired. Sign in again to sync your saved work.",
    );
  return user;
}
export async function switchPersona(userId) {
  const user = await get("users", userId);
  if (!user?.active) throw new Error("This demo account is unavailable.");
  await setMeta("session", { userId, expiresAt: Date.now() + 7 * 86400000 });
  return user;
}
export async function requestCode(email) {
  email = email.trim().toLowerCase();
  const prior = await meta(`code:${email}`, null);
  if (prior && Date.now() - prior.issuedAt < 30000)
    throw new Error(
      "Please wait 30 seconds before requesting another demo code.",
    );
  const user = (await all("users")).find((u) => u.active && u.email === email);
  if (!user) return null;
  const code = String(
    crypto.getRandomValues(new Uint32Array(1))[0] % 1000000,
  ).padStart(6, "0");
  await setMeta(`code:${email}`, {
    code,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 600000,
    attempts: 0,
    userId: user.id,
  });
  return code;
}
export async function verifyCode(email, code) {
  const key = `code:${email.trim().toLowerCase()}`,
    value = await meta(key, null);
  if (!value || value.expiresAt < Date.now() || value.attempts >= 5)
    throw new Error("The code is invalid or expired. Request a new demo code.");
  value.attempts++;
  if (value.code !== code) {
    await setMeta(key, value);
    throw new Error("The code is invalid or expired.");
  }
  await setMeta(key, null);
  return switchPersona(value.userId);
}
export const logout = () => setMeta("session", null);
