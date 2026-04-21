// Sesión firmada con HMAC-SHA256 (Web Crypto). Este módulo es edge-safe:
// no importa next/headers ni node:crypto para que pueda usarse desde middleware.

export const SESSION_COOKIE = "dashboard_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 horas

export interface StoredUser {
  username: string;
  passwordHash: string;
}

export function getUsers(): StoredUser[] {
  const raw = process.env.DASHBOARD_USERS || "";
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const i = entry.indexOf(":");
      if (i <= 0) return null;
      return {
        username: entry.substring(0, i).trim(),
        passwordHash: entry.substring(i + 1).trim(),
      };
    })
    .filter((u): u is StoredUser => u !== null && u.passwordHash.length > 0);
}

function toArrayBuffer(s: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(s);
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

function getSecret(): ArrayBuffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET missing or too short (>=32 chars required)"
    );
  }
  return toArrayBuffer(secret);
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4;
  const padded =
    str.replace(/-/g, "+").replace(/_/g, "/") +
    (pad === 2 ? "==" : pad === 3 ? "=" : "");
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sign(payloadB64: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    getSecret(),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    toArrayBuffer(payloadB64)
  );
  return b64urlEncode(new Uint8Array(sig));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function createSession(username: string): Promise<string> {
  const payload = {
    u: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const payloadBytes = new Uint8Array(
    toArrayBuffer(JSON.stringify(payload))
  );
  const payloadB64 = b64urlEncode(payloadBytes);
  const sig = await sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function validateSession(
  token: string | undefined | null
): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;

  try {
    const expected = await sign(payloadB64);
    if (!constantTimeEqual(sig, expected)) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(payloadB64))
    );
    if (typeof payload.u !== "string") return null;
    if (typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!getUsers().some((u) => u.username === payload.u)) return null;

    return payload.u;
  } catch {
    return null;
  }
}
