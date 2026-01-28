"use client";

import dynamic from "next/dynamic";

// Cargar el mapa dinámicamente para evitar errores de SSR
const MapaMovilidad = dynamic(() => import("@/components/MapaMovilidad"), {
  ssr: false,
  loading: () => (
    <div className="loading-overlay">
      <div className="spinner"></div>
      <p>Cargando mapa...</p>
    </div>
  ),
});

export default function Home() {
  return <MapaMovilidad />;
}
