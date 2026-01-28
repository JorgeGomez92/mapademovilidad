import { cookies } from "next/headers";

// Usuarios autorizados (en producción, usar variables de entorno y hashing)
const USERS = [
  {
    username: "arm.gomez@outlook.com",
    password: "Alfabetagama9",
  },
  {
    username: "oscarsanchez",
    password: "mapademovilidad123",
  },
];

const SESSION_COOKIE = "dashboard_session";

export function validateCredentials(username: string, password: string): boolean {
  return USERS.some(
    (user) => user.username === username && user.password === password
  );
}

export function createSession(username: string): string {
  // Simple token: base64 de usuario + timestamp
  const token = Buffer.from(
    JSON.stringify({ username, timestamp: Date.now() })
  ).toString("base64");
  return token;
}

export function validateSession(token: string): boolean {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    // Session válida por 24 horas
    const isValid = Date.now() - decoded.timestamp < 24 * 60 * 60 * 1000;
    const userExists = USERS.some((u) => u.username === decoded.username);
    return isValid && userExists;
  } catch {
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session) return false;
  return validateSession(session.value);
}

export { SESSION_COOKIE };
