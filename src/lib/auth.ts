import { cookies } from "next/headers";

interface User {
  username: string;
  password: string;
}

function getUsers(): User[] {
  const raw = process.env.DASHBOARD_USERS || "";
  return raw
    .split(",")
    .filter(Boolean)
    .map((entry) => {
      const [username, password] = entry.split(":");
      return { username, password };
    });
}

const SESSION_COOKIE = "dashboard_session";

export function validateCredentials(username: string, password: string): boolean {
  const users = getUsers();
  return users.some(
    (user) => user.username === username && user.password === password
  );
}

export function createSession(username: string): string {
  const token = Buffer.from(
    JSON.stringify({ username, timestamp: Date.now() })
  ).toString("base64");
  return token;
}

export function validateSession(token: string): boolean {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    const isValid = Date.now() - decoded.timestamp < 24 * 60 * 60 * 1000;
    const users = getUsers();
    const userExists = users.some((u) => u.username === decoded.username);
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
