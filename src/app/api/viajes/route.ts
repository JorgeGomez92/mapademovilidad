import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Validar coordenadas (Puebla aproximadamente)
const isValidCoord = (lat: number, lng: number): boolean => {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= 18.5 && lat <= 19.5 &&
    lng >= -98.5 && lng <= -97.5
  );
};

// Motivos de viaje permitidos
const MOTIVOS_VALIDOS = [
  "trabajo", "escuela", "casa", "compras",
  "salud", "tramites", "recreacion", "otro"
];

export async function POST(request: NextRequest) {
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
    } = body;

    // Validación de campos requeridos
    if (!origen || !destino || gastoDiario === undefined || !motivoViaje) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    // Validar coordenadas de origen
    if (!isValidCoord(origen.lat, origen.lng)) {
      return NextResponse.json(
        { error: "Coordenadas de origen inválidas" },
        { status: 400 }
      );
    }

    // Validar coordenadas de destino
    if (!isValidCoord(destino.lat, destino.lng)) {
      return NextResponse.json(
        { error: "Coordenadas de destino inválidas" },
        { status: 400 }
      );
    }

    // Validar gasto diario (número positivo razonable)
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

    // Validar tiempos (minutos, opcional pero razonable)
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

    // Crear el registro en la base de datos
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
