import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

// Nombres legibles para motivos de viaje
const MOTIVOS_NOMBRES: Record<string, string> = {
  trabajo: "Trabajo",
  escuela: "Escuela",
  casa: "Casa",
  compras: "Compras",
  salud: "Salud",
  tramites: "Trámites",
  recreacion: "Recreación",
  otro: "Otro",
};

export async function GET(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "geojson";
    const type = searchParams.get("type") || "all"; // all, origins, destinations

    const viajes = await prisma.viaje.findMany({
      orderBy: { createdAt: "desc" },
    });

    if (format === "csv") {
      return exportCSV(viajes);
    } else {
      return exportGeoJSON(viajes, type);
    }
  } catch (error) {
    console.error("Error en exportación:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

interface Viaje {
  id: string;
  createdAt: Date;
  origenLat: number;
  origenLng: number;
  origenDireccion?: unknown;
  destinoLat: number;
  destinoLng: number;
  destinoDireccion?: unknown;
  gastoDiario: number;
  motivoViaje: string;
  tiempoIda?: number | null;
  tiempoRegreso?: number | null;
}

// Extraer displayName del objeto Direccion guardado por Nominatim
function getDireccion(dir: unknown): string {
  if (!dir || typeof dir !== "object") return "";
  const d = dir as { displayName?: string };
  return d.displayName || "";
}

function exportGeoJSON(viajes: Viaje[], type: string) {
  const features: object[] = [];

  viajes.forEach((viaje, index) => {
    const baseProps = {
      id: viaje.id,
      viaje_num: index + 1,
      gasto_diario: viaje.gastoDiario,
      motivo: MOTIVOS_NOMBRES[viaje.motivoViaje] || viaje.motivoViaje,
      tiempo_ida_min: viaje.tiempoIda ?? "",
      tiempo_regreso_min: viaje.tiempoRegreso ?? "",
      fecha: viaje.createdAt.toISOString(),
    };

    if (type === "all" || type === "origins") {
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [viaje.origenLng, viaje.origenLat],
        },
        properties: {
          ...baseProps,
          tipo: "origen",
          direccion: getDireccion(viaje.origenDireccion),
        },
      });
    }

    if (type === "all" || type === "destinations") {
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [viaje.destinoLng, viaje.destinoLat],
        },
        properties: {
          ...baseProps,
          tipo: "destino",
          direccion: getDireccion(viaje.destinoDireccion),
        },
      });
    }
  });

  const geojson = {
    type: "FeatureCollection",
    features,
  };

  return new NextResponse(JSON.stringify(geojson, null, 2), {
    headers: {
      "Content-Type": "application/geo+json",
      "Content-Disposition": `attachment; filename="viajes_movilidad_${type}.geojson"`,
    },
  });
}

// CSV: una fila por viaje con origen y destino en la misma fila
function exportCSV(viajes: Viaje[]) {
  const rows: string[] = [];

  // Header descriptivo: una fila por viaje
  rows.push(
    "id,origen_lat,origen_lng,origen_direccion,destino_lat,destino_lng,destino_direccion,gasto_diario,motivo,tiempo_ida_min,tiempo_regreso_min,fecha"
  );

  viajes.forEach((viaje) => {
    const esc = (val: string | number | null | undefined) => {
      if (val === null || val === undefined) return "";
      return typeof val === "string" ? `"${val.replace(/"/g, '""')}"` : val;
    };

    rows.push(
      [
        esc(viaje.id),
        viaje.origenLat,
        viaje.origenLng,
        esc(getDireccion(viaje.origenDireccion)),
        viaje.destinoLat,
        viaje.destinoLng,
        esc(getDireccion(viaje.destinoDireccion)),
        viaje.gastoDiario,
        esc(MOTIVOS_NOMBRES[viaje.motivoViaje] || viaje.motivoViaje),
        viaje.tiempoIda ?? "",
        viaje.tiempoRegreso ?? "",
        esc(viaje.createdAt.toISOString()),
      ].join(",")
    );
  });

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="viajes_movilidad.csv"`,
    },
  });
}
