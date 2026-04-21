import { NextRequest, NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth";
import { validateCredentials } from "@/lib/auth-node";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const MAX_USERNAME_LEN = 128;
const MAX_PASSWORD_LEN = 256;

// 5 intentos por IP cada 15 minutos.
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta de nuevo más tarde." },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      }
    );
  }

  try {
    const body = await request.json();
    const { username, password } = body;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      username.length === 0 ||
      password.length === 0 ||
      username.length > MAX_USERNAME_LEN ||
      password.length > MAX_PASSWORD_LEN
    ) {
      return NextResponse.json(
        { error: "Usuario y contraseña requeridos" },
        { status: 400 }
      );
    }

    if (!validateCredentials(username, password)) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const token = await createSession(username);

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
