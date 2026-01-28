import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Validar coordenadas (Puebla aproximadamente)
const isValidCoord = (lat: number, lng: number): boolean => {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= 18.5 && lat <= 19.5 && // Rango de latitud para Puebla
    lng >= -98.5 && lng <= -97.5   // Rango de longitud para Puebla
  );
};

// Sanitizar string (prevenir inyección)
const sanitizeString = (str: string | undefined | null, maxLength: number): string | null => {
  if (!str) return null;
  return String(str).slice(0, maxLength).trim();
};

// Motivos de viaje permitidos
const MOTIVOS_VALIDOS = [
  "trabajo", "escuela", "casa", "compras",
  "salud", "tramites", "recreacion", "otro"
];

// Medios de transporte permitidos
const TRANSPORTES_VALIDOS = [
  "ruta", "linea", "taxi", "uber",
  "bicicleta", "caminando", "auto_propio", "otro"
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      origen,
      origenDireccion,
      destino,
      destinoDireccion,
      transbordos,
      gastoDiario,
      motivoViaje,
      medioTransporte,
      comentarios,
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

    // Validar medio de transporte (si se proporciona)
    if (medioTransporte && !TRANSPORTES_VALIDOS.includes(medioTransporte)) {
      return NextResponse.json(
        { error: "Medio de transporte inválido" },
        { status: 400 }
      );
    }

    // Validar transbordos (si existen)
    let transbordosValidados = null;
    if (transbordos && Array.isArray(transbordos)) {
      if (transbordos.length > 10) {
        return NextResponse.json(
          { error: "Demasiados transbordos" },
          { status: 400 }
        );
      }

      for (const t of transbordos) {
        if (!isValidCoord(t.lat, t.lng)) {
          return NextResponse.json(
            { error: "Coordenadas de transbordo inválidas" },
            { status: 400 }
          );
        }
      }
      transbordosValidados = transbordos;
    }

    // Crear el registro en la base de datos
    const viaje = await prisma.viaje.create({
      data: {
        origenLat: origen.lat,
        origenLng: origen.lng,
        origenDireccion: origenDireccion || null,
        destinoLat: destino.lat,
        destinoLng: destino.lng,
        destinoDireccion: destinoDireccion || null,
        transbordos: transbordosValidados,
        gastoDiario: gastoNum,
        motivoViaje,
        medioTransporte: medioTransporte || null,
        comentarios: sanitizeString(comentarios, 500),
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
