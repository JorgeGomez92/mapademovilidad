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
      return exportCSV(viajes, type);
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
  destinoLat: number;
  destinoLng: number;
  gastoDiario: number;
  motivoViaje: string;
  transbordos?: unknown;
}

function exportGeoJSON(viajes: Viaje[], type: string) {
  const features: object[] = [];

  viajes.forEach((viaje, index) => {
    if (type === "all" || type === "origins") {
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [viaje.origenLng, viaje.origenLat],
        },
        properties: {
          id: viaje.id,
          tipo: "origen",
          viaje_num: index + 1,
          gasto_diario: viaje.gastoDiario,
          motivo: MOTIVOS_NOMBRES[viaje.motivoViaje] || viaje.motivoViaje,
          fecha: viaje.createdAt.toISOString(),
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
          id: viaje.id,
          tipo: "destino",
          viaje_num: index + 1,
          gasto_diario: viaje.gastoDiario,
          motivo: MOTIVOS_NOMBRES[viaje.motivoViaje] || viaje.motivoViaje,
          fecha: viaje.createdAt.toISOString(),
        },
      });
    }

    // Incluir transbordos si existen
    if (type === "all" && viaje.transbordos && Array.isArray(viaje.transbordos)) {
      (viaje.transbordos as Array<{ lat: number; lng: number }>).forEach((t, tIndex) => {
        features.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [t.lng, t.lat],
          },
          properties: {
            id: viaje.id,
            tipo: "transbordo",
            transbordo_num: tIndex + 1,
            viaje_num: index + 1,
            gasto_diario: viaje.gastoDiario,
            motivo: MOTIVOS_NOMBRES[viaje.motivoViaje] || viaje.motivoViaje,
            fecha: viaje.createdAt.toISOString(),
          },
        });
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

function exportCSV(viajes: Viaje[], type: string) {
  const rows: string[] = [];

  // Header
  rows.push("id,tipo,latitud,longitud,gasto_diario,motivo,fecha");

  viajes.forEach((viaje, index) => {
    const escape = (val: string | number) =>
      typeof val === "string" ? `"${val.replace(/"/g, '""')}"` : val;

    if (type === "all" || type === "origins") {
      rows.push(
        [
          escape(viaje.id),
          "origen",
          viaje.origenLat,
          viaje.origenLng,
          viaje.gastoDiario,
          escape(MOTIVOS_NOMBRES[viaje.motivoViaje] || viaje.motivoViaje),
          escape(viaje.createdAt.toISOString()),
        ].join(",")
      );
    }

    if (type === "all" || type === "destinations") {
      rows.push(
        [
          escape(viaje.id),
          "destino",
          viaje.destinoLat,
          viaje.destinoLng,
          viaje.gastoDiario,
          escape(MOTIVOS_NOMBRES[viaje.motivoViaje] || viaje.motivoViaje),
          escape(viaje.createdAt.toISOString()),
        ].join(",")
      );
    }

    if (type === "all" && viaje.transbordos && Array.isArray(viaje.transbordos)) {
      (viaje.transbordos as Array<{ lat: number; lng: number }>).forEach((t) => {
        rows.push(
          [
            escape(viaje.id),
            "transbordo",
            t.lat,
            t.lng,
            viaje.gastoDiario,
            escape(MOTIVOS_NOMBRES[viaje.motivoViaje] || viaje.motivoViaje),
            escape(viaje.createdAt.toISOString()),
          ].join(",")
        );
      });
    }
  });

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="viajes_movilidad_${type}.csv"`,
    },
  });
}
