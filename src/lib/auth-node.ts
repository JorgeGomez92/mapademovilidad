// Password hashing con scrypt (Node crypto). Importar solo desde API routes (runtime Node).
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { getUsers } from "./auth";

const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;

// Separador `.` (no `$`) para que no se interprete como interpolación de variable
// en archivos .env (dotenv/dotenv-expand).
export function hashPassword(password: string): string {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt.${salt.toString("hex")}.${derived.toString("hex")}`;
}

function parseHash(stored: string): { salt: Buffer; hash: Buffer } | null {
  const parts = stored.split(".");
  if (parts.length !== 3 || parts[0] !== "scrypt") return null;
  try {
    return {
      salt: Buffer.from(parts[1], "hex"),
      hash: Buffer.from(parts[2], "hex"),
    };
  } catch {
    return null;
  }
}

export function verifyPassword(password: string, stored: string): boolean {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  try {
    const derived = scryptSync(password, parsed.salt, parsed.hash.length);
    if (derived.length !== parsed.hash.length) return false;
    return timingSafeEqual(derived, parsed.hash);
  } catch {
    return false;
  }
}

// Hash dummy para que la comparación tome tiempo similar cuando el usuario no existe.
const DUMMY_HASH = `scrypt.${"00".repeat(SCRYPT_SALT_BYTES)}.${"00".repeat(
  SCRYPT_KEYLEN
)}`;

export function validateCredentials(
  username: string,
  password: string
): boolean {
  const user = getUsers().find((u) => u.username === username);
  if (!user) {
    // Consumir tiempo CPU similar para no filtrar existencia del usuario vía timing.
    verifyPassword(password, DUMMY_HASH);
    return false;
  }
  return verifyPassword(password, user.passwordHash);
}
