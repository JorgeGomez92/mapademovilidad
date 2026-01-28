import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

export async function GET(request: NextRequest) {
  // Verificar autenticación
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const motivoViaje = searchParams.get("motivoViaje");
    const gastoMin = searchParams.get("gastoMin");
    const gastoMax = searchParams.get("gastoMax");

    // Construir filtros
    const where: {
      motivoViaje?: string;
      gastoDiario?: { gte?: number; lte?: number };
    } = {};

    if (motivoViaje && motivoViaje !== "todos") {
      where.motivoViaje = motivoViaje;
    }

    if (gastoMin || gastoMax) {
      where.gastoDiario = {};
      if (gastoMin) where.gastoDiario.gte = parseFloat(gastoMin);
      if (gastoMax) where.gastoDiario.lte = parseFloat(gastoMax);
    }

    // Obtener viajes con filtros
    const viajes = await prisma.viaje.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Calcular estadísticas
    const totalViajes = viajes.length;
    const gastoPromedio =
      totalViajes > 0
        ? viajes.reduce((sum, v) => sum + v.gastoDiario, 0) / totalViajes
        : 0;

    // Distribución por motivo
    const distribucionMotivos = viajes.reduce((acc, v) => {
      acc[v.motivoViaje] = (acc[v.motivoViaje] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Distribución por rango de gasto
    const rangosGasto = {
      "0-20": 0,
      "21-50": 0,
      "51-100": 0,
      "101-200": 0,
      "201+": 0,
    };

    viajes.forEach((v) => {
      if (v.gastoDiario <= 20) rangosGasto["0-20"]++;
      else if (v.gastoDiario <= 50) rangosGasto["21-50"]++;
      else if (v.gastoDiario <= 100) rangosGasto["51-100"]++;
      else if (v.gastoDiario <= 200) rangosGasto["101-200"]++;
      else rangosGasto["201+"]++;
    });

    return NextResponse.json({
      viajes,
      stats: {
        totalViajes,
        gastoPromedio: Math.round(gastoPromedio * 100) / 100,
        distribucionMotivos,
        rangosGasto,
      },
    });
  } catch (error) {
    console.error("Error en dashboard:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
