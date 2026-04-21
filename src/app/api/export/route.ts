import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth-server";

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

const MEDIOS_NOMBRES: Record<string, string> = {
  linea1: "Línea 1 RUTA",
  linea2: "Línea 2 RUTA",
  linea3: "Línea 3 RUTA",
  linea4: "Línea 4 RUTA",
  alimentadora: "Alimentadora",
  van: "Van / Combi",
  camion: "Camión",
  microbus: "Microbús",
  automovil: "Automóvil",
  bicicleta: "Bicicleta",
  apie: "A pie",
  // Valores históricos.
  colectivo: "Colectivo",
  otro: "Otro",
};

const SATISFACCION_LABELS: Record<number, string> = {
  1: "Nada satisfecho",
  2: "Poco satisfecho",
  3: "Medianamente satisfecho",
  4: "Muy satisfecho",
  5: "Completamente satisfecho",
};

export async function GET(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "geojson";
    const type = searchParams.get("type") || "all";

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
  origenDireccion: unknown;
  destinoLat: number;
  destinoLng: number;
  destinoDireccion: unknown;
  gastoDiario: number;
  motivoViaje: string;
  tiempoIda: number | null;
  tiempoRegreso: number | null;
  mediosTransporte: unknown;
  transbordosIda: number;
  transbordosRegreso: number;
  satisfaccion: number;
}

function getDireccion(dir: unknown): string {
  if (!dir || typeof dir !== "object") return "";
  const d = dir as { displayName?: string };
  return d.displayName || "";
}

function getMediosLabel(medios: unknown): string {
  if (!Array.isArray(medios)) return "";
  return medios.map((m: string) => MEDIOS_NOMBRES[m] || m).join(", ");
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
      medios_transporte: getMediosLabel(viaje.mediosTransporte),
      transbordos_ida: viaje.transbordosIda,
      transbordos_regreso: viaje.transbordosRegreso,
      satisfaccion: viaje.satisfaccion,
      satisfaccion_texto: SATISFACCION_LABELS[viaje.satisfaccion] || "",
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

function exportCSV(viajes: Viaje[]) {
  const rows: string[] = [];

  rows.push(
    "id,origen_lat,origen_lng,origen_direccion,destino_lat,destino_lng,destino_direccion,gasto_diario,motivo,tiempo_ida_min,tiempo_regreso_min,medios_transporte,transbordos_ida,transbordos_regreso,satisfaccion,satisfaccion_texto,fecha"
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
        esc(getMediosLabel(viaje.mediosTransporte)),
        viaje.transbordosIda,
        viaje.transbordosRegreso,
        viaje.satisfaccion,
        esc(SATISFACCION_LABELS[viaje.satisfaccion] || ""),
        esc(viaje.createdAt.toISOString()),
      ].join(",")
    );
  });

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="viajes_movilidad.csv"`,
    },
  });
}
