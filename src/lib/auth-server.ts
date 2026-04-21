// Helpers para server components / route handlers (runtime Node).
// No importar desde middleware (usa next/headers).
import { cookies } from "next/headers";
import { SESSION_COOKIE, validateSession } from "./auth";

export async function getSessionUser(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return validateSession(token);
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getSessionUser()) !== null;
}
