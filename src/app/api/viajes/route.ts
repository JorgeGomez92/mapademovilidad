import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth-server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { MEDIOS_VALIDOS } from "@/lib/taxonomies";

// Límite anti-spam para envíos de encuesta: 10 por IP cada 10 minutos.
const SUBMIT_LIMIT = 10;
const SUBMIT_WINDOW_MS = 10 * 60 * 1000;

const isValidCoord = (lat: number, lng: number): boolean => {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= 18.5 &&
    lat <= 19.5 &&
    lng >= -98.5 &&
    lng <= -97.5
  );
};

const MOTIVOS_VALIDOS = [
  "trabajo", "escuela", "casa", "compras",
  "salud", "tramites", "recreacion", "otro",
];

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`viajes:${ip}`, SUBMIT_LIMIT, SUBMIT_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Has enviado demasiadas encuestas. Intenta más tarde." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = await request.json();

    const {
      origen,
      origenDireccion,
      destino,
      destinoDireccion,
      gastoDiario,
      motivoViaje,
      tiempoIda,
      tiempoRegreso,
      mediosTransporte,
      transbordosIda,
      transbordosRegreso,
      satisfaccion,
    } = body;

    // Validación de campos requeridos
    if (
      !origen ||
      !destino ||
      gastoDiario === undefined ||
      !motivoViaje ||
      !mediosTransporte ||
      transbordosIda === undefined ||
      transbordosRegreso === undefined ||
      !satisfaccion
    ) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    // Validar coordenadas
    if (!isValidCoord(origen.lat, origen.lng)) {
      return NextResponse.json(
        { error: "Coordenadas de origen inválidas" },
        { status: 400 }
      );
    }

    if (!isValidCoord(destino.lat, destino.lng)) {
      return NextResponse.json(
        { error: "Coordenadas de destino inválidas" },
        { status: 400 }
      );
    }

    // Validar gasto diario
    const gastoNum = parseFloat(gastoDiario);
    if (isNaN(gastoNum) || gastoNum < 0 || gastoNum > 10000) {
      return NextResponse.json(
        { error: "Gasto diario inválido" },
        { status: 400 }
      );
    }

    // Validar motivo de viaje
    if (!MOTIVOS_VALIDOS.includes(motivoViaje)) {
      return NextResponse.json(
        { error: "Motivo de viaje inválido" },
        { status: 400 }
      );
    }

    // Validar medios de transporte
    if (
      !Array.isArray(mediosTransporte) ||
      mediosTransporte.length === 0 ||
      !mediosTransporte.every((m: string) => MEDIOS_VALIDOS.includes(m))
    ) {
      return NextResponse.json(
        { error: "Medios de transporte inválidos" },
        { status: 400 }
      );
    }

    // Validar transbordos (0-3)
    const transbordosIdaNum = parseInt(transbordosIda);
    const transbordosRegresoNum = parseInt(transbordosRegreso);
    if (
      isNaN(transbordosIdaNum) || transbordosIdaNum < 0 || transbordosIdaNum > 3 ||
      isNaN(transbordosRegresoNum) || transbordosRegresoNum < 0 || transbordosRegresoNum > 3
    ) {
      return NextResponse.json(
        { error: "Número de transbordos inválido" },
        { status: 400 }
      );
    }

    // Validar satisfacción (1-5)
    const satisfaccionNum = parseInt(satisfaccion);
    if (isNaN(satisfaccionNum) || satisfaccionNum < 1 || satisfaccionNum > 5) {
      return NextResponse.json(
        { error: "Nivel de satisfacción inválido" },
        { status: 400 }
      );
    }

    // Validar tiempos opcionales
    const tiempoIdaNum = tiempoIda ? parseInt(tiempoIda) : null;
    const tiempoRegresoNum = tiempoRegreso ? parseInt(tiempoRegreso) : null;

    if (tiempoIdaNum !== null && (isNaN(tiempoIdaNum) || tiempoIdaNum < 0 || tiempoIdaNum > 600)) {
      return NextResponse.json(
        { error: "Tiempo de ida inválido" },
        { status: 400 }
      );
    }

    if (tiempoRegresoNum !== null && (isNaN(tiempoRegresoNum) || tiempoRegresoNum < 0 || tiempoRegresoNum > 600)) {
      return NextResponse.json(
        { error: "Tiempo de regreso inválido" },
        { status: 400 }
      );
    }

    const viaje = await prisma.viaje.create({
      data: {
        origenLat: origen.lat,
        origenLng: origen.lng,
        origenDireccion: origenDireccion || undefined,
        destinoLat: destino.lat,
        destinoLng: destino.lng,
        destinoDireccion: destinoDireccion || undefined,
        gastoDiario: gastoNum,
        motivoViaje,
        tiempoIda: tiempoIdaNum,
        tiempoRegreso: tiempoRegresoNum,
        mediosTransporte,
        transbordosIda: transbordosIdaNum,
        transbordosRegreso: transbordosRegresoNum,
        satisfaccion: satisfaccionNum,
      },
    });

    return NextResponse.json(
      { message: "Viaje registrado exitosamente", id: viaje.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al guardar viaje:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const viajes = await prisma.viaje.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(viajes);
  } catch (error) {
    console.error("Error al obtener viajes:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
