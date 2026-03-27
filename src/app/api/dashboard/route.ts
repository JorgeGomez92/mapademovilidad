import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

const MEDIOS_NOMBRES: Record<string, string> = {
  linea1: "Línea 1 RUTA",
  linea2: "Línea 2 RUTA",
  linea3: "Línea 3 RUTA",
  linea4: "Línea 4 RUTA",
  alimentadora: "Alimentadora",
  van: "Van / Combi",
  camion: "Camión",
  microbus: "Microbús",
  colectivo: "Colectivo",
  otro: "Otro",
};

export async function GET(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const motivoViaje = searchParams.get("motivoViaje");
    const gastoMin = searchParams.get("gastoMin");
    const gastoMax = searchParams.get("gastoMax");
    const medioTransporte = searchParams.get("medioTransporte");
    const satisfaccionMin = searchParams.get("satisfaccionMin");

    // Construir filtros
    const where: {
      motivoViaje?: string;
      gastoDiario?: { gte?: number; lte?: number };
      satisfaccion?: { gte?: number };
    } = {};

    if (motivoViaje && motivoViaje !== "todos") {
      where.motivoViaje = motivoViaje;
    }

    if (gastoMin || gastoMax) {
      where.gastoDiario = {};
      if (gastoMin) where.gastoDiario.gte = parseFloat(gastoMin);
      if (gastoMax) where.gastoDiario.lte = parseFloat(gastoMax);
    }

    if (satisfaccionMin) {
      where.satisfaccion = { gte: parseInt(satisfaccionMin) };
    }

    let viajes = await prisma.viaje.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Filtro por medio de transporte (campo Json, se filtra en memoria)
    if (medioTransporte && medioTransporte !== "todos") {
      viajes = viajes.filter((v) => {
        const medios = v.mediosTransporte as string[];
        return Array.isArray(medios) && medios.includes(medioTransporte);
      });
    }

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
    const rangosGasto: Record<string, number> = {
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

    // Distribución por medio de transporte
    const distribucionMedios: Record<string, number> = {};
    viajes.forEach((v) => {
      const medios = v.mediosTransporte as string[];
      if (Array.isArray(medios)) {
        medios.forEach((m) => {
          distribucionMedios[m] = (distribucionMedios[m] || 0) + 1;
        });
      }
    });

    // Distribución de transbordos
    const transbordosIda: Record<string, number> = { "0": 0, "1": 0, "2": 0, "3": 0 };
    const transbordosRegreso: Record<string, number> = { "0": 0, "1": 0, "2": 0, "3": 0 };
    viajes.forEach((v) => {
      transbordosIda[String(v.transbordosIda)] = (transbordosIda[String(v.transbordosIda)] || 0) + 1;
      transbordosRegreso[String(v.transbordosRegreso)] = (transbordosRegreso[String(v.transbordosRegreso)] || 0) + 1;
    });

    // Porcentaje que transbordan (al menos 1 transbordo en ida)
    const conTransbordo = viajes.filter((v) => v.transbordosIda > 0).length;
    const porcentajeTransbordo = totalViajes > 0 ? (conTransbordo / totalViajes) * 100 : 0;

    // Distribución de satisfacción
    const distribucionSatisfaccion: Record<string, number> = {
      "1": 0, "2": 0, "3": 0, "4": 0, "5": 0,
    };
    viajes.forEach((v) => {
      distribucionSatisfaccion[String(v.satisfaccion)] = (distribucionSatisfaccion[String(v.satisfaccion)] || 0) + 1;
    });

    const satisfaccionPromedio =
      totalViajes > 0
        ? viajes.reduce((sum, v) => sum + v.satisfaccion, 0) / totalViajes
        : 0;

    // Distribución por rango de tiempo de ida
    const rangosTiempo: Record<string, number> = {
      "0-15": 0,
      "16-30": 0,
      "31-59": 0,
      "60-90": 0,
      "91+": 0,
    };
    viajes.forEach((v) => {
      const t = v.tiempoIda;
      if (t === null) return;
      if (t <= 15) rangosTiempo["0-15"]++;
      else if (t <= 30) rangosTiempo["16-30"]++;
      else if (t <= 59) rangosTiempo["31-59"]++;
      else if (t <= 90) rangosTiempo["60-90"]++;
      else rangosTiempo["91+"]++;
    });

    // Tiempo promedio
    const viajesConTiempo = viajes.filter((v) => v.tiempoIda !== null);
    const tiempoPromedioIda =
      viajesConTiempo.length > 0
        ? viajesConTiempo.reduce((sum, v) => sum + (v.tiempoIda || 0), 0) / viajesConTiempo.length
        : 0;

    return NextResponse.json({
      viajes,
      stats: {
        totalViajes,
        gastoPromedio: Math.round(gastoPromedio * 100) / 100,
        distribucionMotivos,
        rangosGasto,
        distribucionMedios,
        mediosNombres: MEDIOS_NOMBRES,
        transbordosIda,
        transbordosRegreso,
        porcentajeTransbordo: Math.round(porcentajeTransbordo * 10) / 10,
        distribucionSatisfaccion,
        satisfaccionPromedio: Math.round(satisfaccionPromedio * 10) / 10,
        rangosTiempo,
        tiempoPromedioIda: Math.round(tiempoPromedioIda),
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
