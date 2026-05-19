import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Endpoint público — devuelve puntos AGREGADOS para el heatmap del paso final.
// No expone coordenadas crudas: cada punto se snapea a una grid de ~330 metros
// y se cuenta cuántos viajes caen en esa celda. Eso evita filtrar destinos
// individuales (domicilios, escuelas específicas, etc.) mientras conserva el
// patrón espacial necesario para la visualización.

const GRID = 0.003; // ~330 m a la latitud de Puebla
const MAX_POINTS = 500;

function snap(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

type TipoHeatmap = "destinations" | "origins" | "both";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipoRaw = (searchParams.get("type") || "destinations").toLowerCase();
    const tipo: TipoHeatmap =
      tipoRaw === "origins"
        ? "origins"
        : tipoRaw === "both"
          ? "both"
          : "destinations";

    const viajes = await prisma.viaje.findMany({
      select: {
        origenLat: true,
        origenLng: true,
        destinoLat: true,
        destinoLng: true,
      },
    });

    const cells = new Map<string, number>();
    const acumular = (lat: number, lng: number) => {
      const sLat = snap(lat, GRID);
      const sLng = snap(lng, GRID);
      const key = `${sLat.toFixed(4)},${sLng.toFixed(4)}`;
      cells.set(key, (cells.get(key) || 0) + 1);
    };

    for (const v of viajes) {
      if (tipo === "origins" || tipo === "both") {
        acumular(v.origenLat, v.origenLng);
      }
      if (tipo === "destinations" || tipo === "both") {
        acumular(v.destinoLat, v.destinoLng);
      }
    }

    // Top MAX_POINTS por intensidad. En la práctica con cap de 500 celdas
    // cubrimos toda Puebla con resolución >330m sobrada.
    const points = Array.from(cells.entries())
      .map(([key, count]) => {
        const [latStr, lngStr] = key.split(",");
        return [
          parseFloat(latStr),
          parseFloat(lngStr),
          count,
        ] as [number, number, number];
      })
      .sort((a, b) => b[2] - a[2])
      .slice(0, MAX_POINTS);

    return NextResponse.json(
      { points, total: viajes.length, type: tipo },
      {
        // Cache permisivo: los heatmaps no cambian rápido. 1 min en CDN/cliente.
        headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
      }
    );
  } catch (error) {
    console.error("Error en heatmap:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
