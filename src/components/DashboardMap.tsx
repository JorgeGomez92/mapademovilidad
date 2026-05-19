"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
// Tipos de heatLayer provistos por @types/leaflet.heat.

interface Viaje {
  id: string;
  origenLat: number;
  origenLng: number;
  destinoLat: number;
  destinoLng: number;
  gastoDiario: number;
  motivoViaje: string;
}

interface DashboardMapProps {
  viajes: Viaje[];
  heatmapType: "origins" | "destinations" | "both";
}

export default function DashboardMap({ viajes, heatmapType }: DashboardMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const connectionLayerRef = useRef<L.LayerGroup | null>(null);
  const activeViajeIdRef = useRef<string | null>(null);

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current).setView(
      [19.0414, -98.2063], // Centro de Puebla
      13
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapRef.current);

    markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
    connectionLayerRef.current = L.layerGroup().addTo(mapRef.current);

    // Click en el mapa (fuera de cualquier marker) oculta la trayectoria activa.
    mapRef.current.on("click", () => {
      if (connectionLayerRef.current && activeViajeIdRef.current !== null) {
        connectionLayerRef.current.clearLayers();
        activeViajeIdRef.current = null;
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Actualizar heatmap cuando cambian los datos o el tipo
  useEffect(() => {
    if (!mapRef.current) return;

    // Limpiar capas anteriores
    if (heatLayerRef.current) {
      mapRef.current.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (markersLayerRef.current) {
      markersLayerRef.current.clearLayers();
    }

    // Limpiar conexión activa al cambiar filtros/datos
    if (connectionLayerRef.current) {
      connectionLayerRef.current.clearLayers();
    }
    activeViajeIdRef.current = null;

    if (viajes.length === 0) return;

    // Toggle: click en un marker muestra la línea origen↔destino de su viaje;
    // click de nuevo en el mismo viaje la oculta; click en otro la reemplaza.
    const toggleConexion = (viaje: Viaje) => {
      if (!connectionLayerRef.current) return;
      connectionLayerRef.current.clearLayers();

      if (activeViajeIdRef.current === viaje.id) {
        activeViajeIdRef.current = null;
        return;
      }
      activeViajeIdRef.current = viaje.id;

      L.circleMarker([viaje.origenLat, viaje.origenLng], {
        radius: 10,
        fillColor: "#4CAF50",
        color: "#1b5e20",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.25,
        interactive: false,
      }).addTo(connectionLayerRef.current);

      L.circleMarker([viaje.destinoLat, viaje.destinoLng], {
        radius: 10,
        fillColor: "#f44336",
        color: "#b71c1c",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.25,
        interactive: false,
      }).addTo(connectionLayerRef.current);

      L.polyline(
        [
          [viaje.origenLat, viaje.origenLng],
          [viaje.destinoLat, viaje.destinoLng],
        ],
        {
          color: "#2d8f4e",
          weight: 3,
          opacity: 0.85,
          dashArray: "6, 6",
          interactive: false,
        }
      ).addTo(connectionLayerRef.current);
    };

    const heatPoints: Array<[number, number, number]> = [];

    // Preparar puntos para el heatmap
    viajes.forEach((viaje) => {
      if (heatmapType === "origins" || heatmapType === "both") {
        heatPoints.push([viaje.origenLat, viaje.origenLng, 1]);
      }
      if (heatmapType === "destinations" || heatmapType === "both") {
        heatPoints.push([viaje.destinoLat, viaje.destinoLng, 1]);
      }
    });

    // Crear heatmap con gradiente personalizado
    const gradient: Record<number, string> =
      heatmapType === "origins"
        ? { 0.4: "#a5d6a7", 0.6: "#66bb6a", 0.8: "#43a047", 1: "#1b5e20" }
        : heatmapType === "destinations"
        ? { 0.4: "#ef9a9a", 0.6: "#ef5350", 0.8: "#e53935", 1: "#b71c1c" }
        : { 0.4: "#ffcc80", 0.6: "#ffa726", 0.8: "#fb8c00", 1: "#e65100" };

    heatLayerRef.current = L.heatLayer(heatPoints, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      minOpacity: 0.4,
      gradient,
    }).addTo(mapRef.current);

    // Agregar marcadores individuales para referencia
    if (markersLayerRef.current) {
      viajes.forEach((viaje) => {
        if (heatmapType === "origins" || heatmapType === "both") {
          L.circleMarker([viaje.origenLat, viaje.origenLng], {
            radius: 4,
            fillColor: "#4CAF50",
            color: "#fff",
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.6,
          })
            .bindTooltip(
              `Origen<br>Gasto: $${viaje.gastoDiario}<br><small>Click para ver trayectoria</small>`,
              { direction: "top" }
            )
            .on("click", (e) => {
              L.DomEvent.stopPropagation(e);
              toggleConexion(viaje);
            })
            .addTo(markersLayerRef.current!);
        }
        if (heatmapType === "destinations" || heatmapType === "both") {
          L.circleMarker([viaje.destinoLat, viaje.destinoLng], {
            radius: 4,
            fillColor: "#f44336",
            color: "#fff",
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.6,
          })
            .bindTooltip(
              `Destino<br>Gasto: $${viaje.gastoDiario}<br><small>Click para ver trayectoria</small>`,
              { direction: "top" }
            )
            .on("click", (e) => {
              L.DomEvent.stopPropagation(e);
              toggleConexion(viaje);
            })
            .addTo(markersLayerRef.current!);
        }
      });
    }

    // Ajustar vista para mostrar todos los puntos
    if (heatPoints.length > 0) {
      const bounds = L.latLngBounds(heatPoints.map((p) => [p[0], p[1]]));
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [viajes, heatmapType]);

  return (
    <div
      ref={mapContainerRef}
      style={{ width: "100%", height: "100%", minHeight: "400px" }}
    />
  );
}
