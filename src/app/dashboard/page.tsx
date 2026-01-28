"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

// Cargar el mapa dinámicamente sin SSR
const DashboardMap = dynamic(() => import("@/components/DashboardMap"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <div className="spinner"></div>
      <p>Cargando mapa...</p>
    </div>
  ),
});

interface Viaje {
  id: string;
  origenLat: number;
  origenLng: number;
  destinoLat: number;
  destinoLng: number;
  gastoDiario: number;
  motivoViaje: string;
  createdAt: string;
  transbordos?: Array<{ lat: number; lng: number }>;
}

interface Stats {
  totalViajes: number;
  gastoPromedio: number;
  distribucionMotivos: Record<string, number>;
  rangosGasto: Record<string, number>;
}

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

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [heatmapType, setHeatmapType] = useState<"origins" | "destinations" | "both">("both");
  const [filtroMotivo, setFiltroMotivo] = useState("todos");
  const [filtroGastoMin, setFiltroGastoMin] = useState("");
  const [filtroGastoMax, setFiltroGastoMax] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filtroMotivo !== "todos") params.set("motivoViaje", filtroMotivo);
      if (filtroGastoMin) params.set("gastoMin", filtroGastoMin);
      if (filtroGastoMax) params.set("gastoMax", filtroGastoMax);

      const res = await fetch(`/api/dashboard?${params}`);

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = await res.json();
      setViajes(data.viajes);
      setStats(data.stats);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [filtroMotivo, filtroGastoMin, filtroGastoMax, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  };

  const handleExport = (format: "geojson" | "csv", type: string = "all") => {
    window.open(`/api/export?format=${format}&type=${type}`, "_blank");
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner"></div>
        <p>Cargando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Dashboard de Movilidad</h1>
          <p>Visualización de datos recolectados</p>
        </div>
        <button onClick={handleLogout} className="btn-logout">
          Cerrar sesión
        </button>
      </header>

      <div className="dashboard-content">
        <aside className="dashboard-sidebar">
          <section className="filter-section">
            <h3>Filtros</h3>

            <div className="form-group">
              <label>Motivo de viaje</label>
              <select
                value={filtroMotivo}
                onChange={(e) => setFiltroMotivo(e.target.value)}
              >
                <option value="todos">Todos los motivos</option>
                {Object.entries(MOTIVOS_NOMBRES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Gasto diario ($)</label>
              <div className="range-inputs">
                <input
                  type="number"
                  placeholder="Mín"
                  value={filtroGastoMin}
                  onChange={(e) => setFiltroGastoMin(e.target.value)}
                />
                <span>-</span>
                <input
                  type="number"
                  placeholder="Máx"
                  value={filtroGastoMax}
                  onChange={(e) => setFiltroGastoMax(e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="stats-section">
            <h3>Estadísticas</h3>

            <div className="stat-card primary">
              <span className="stat-value">{stats?.totalViajes || 0}</span>
              <span className="stat-label">Viajes registrados</span>
            </div>

            <div className="stat-card">
              <span className="stat-value">${stats?.gastoPromedio?.toFixed(2) || "0.00"}</span>
              <span className="stat-label">Gasto promedio diario</span>
            </div>

            {stats?.distribucionMotivos && Object.keys(stats.distribucionMotivos).length > 0 && (
              <div className="distribution-section">
                <h4>Por motivo</h4>
                <div className="distribution-bars">
                  {Object.entries(stats.distribucionMotivos).map(([motivo, count]) => {
                    const percent = stats.totalViajes > 0
                      ? (count / stats.totalViajes) * 100
                      : 0;
                    return (
                      <div key={motivo} className="bar-item">
                        <div className="bar-label">
                          <span>{MOTIVOS_NOMBRES[motivo] || motivo}</span>
                          <span>{count}</span>
                        </div>
                        <div className="bar-bg">
                          <div
                            className="bar-fill"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {stats?.rangosGasto && (
              <div className="distribution-section">
                <h4>Por rango de gasto</h4>
                <div className="distribution-bars">
                  {Object.entries(stats.rangosGasto).map(([rango, count]) => {
                    const percent = stats.totalViajes > 0
                      ? (count / stats.totalViajes) * 100
                      : 0;
                    return (
                      <div key={rango} className="bar-item">
                        <div className="bar-label">
                          <span>${rango}</span>
                          <span>{count}</span>
                        </div>
                        <div className="bar-bg">
                          <div
                            className="bar-fill expense"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="export-section">
            <h3>Exportar datos</h3>
            <p className="export-hint">Para usar en QGIS u otro GIS</p>

            <div className="export-buttons">
              <button
                onClick={() => handleExport("geojson", "all")}
                className="btn btn-outline"
              >
                GeoJSON (Todo)
              </button>
              <button
                onClick={() => handleExport("csv", "all")}
                className="btn btn-outline"
              >
                CSV (Todo)
              </button>
            </div>
            <div className="export-buttons">
              <button
                onClick={() => handleExport("geojson", "origins")}
                className="btn btn-secondary btn-sm"
              >
                Solo orígenes
              </button>
              <button
                onClick={() => handleExport("geojson", "destinations")}
                className="btn btn-secondary btn-sm"
              >
                Solo destinos
              </button>
            </div>
          </section>
        </aside>

        <main className="dashboard-main">
          <div className="map-controls">
            <span>Mostrar:</span>
            <button
              className={`toggle-btn ${heatmapType === "origins" ? "active" : ""}`}
              onClick={() => setHeatmapType("origins")}
            >
              Orígenes
            </button>
            <button
              className={`toggle-btn ${heatmapType === "destinations" ? "active" : ""}`}
              onClick={() => setHeatmapType("destinations")}
            >
              Destinos
            </button>
            <button
              className={`toggle-btn ${heatmapType === "both" ? "active" : ""}`}
              onClick={() => setHeatmapType("both")}
            >
              Ambos
            </button>
          </div>

          <div className="map-wrapper">
            <DashboardMap viajes={viajes} heatmapType={heatmapType} />
          </div>

          <div className="map-legend">
            {(heatmapType === "origins" || heatmapType === "both") && (
              <div className="legend-item">
                <span className="legend-dot origin"></span>
                <span>Orígenes ({viajes.length})</span>
              </div>
            )}
            {(heatmapType === "destinations" || heatmapType === "both") && (
              <div className="legend-item">
                <span className="legend-dot destination"></span>
                <span>Destinos ({viajes.length})</span>
              </div>
            )}
          </div>
        </main>
      </div>

      <style jsx>{`
        .dashboard-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f5f5f5;
        }

        .dashboard-header {
          background: linear-gradient(135deg, #1a5f2a 0%, #2d8f4e 100%);
          color: white;
          padding: 1rem 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-content h1 {
          font-size: 1.25rem;
          margin: 0;
        }

        .header-content p {
          font-size: 0.8rem;
          opacity: 0.9;
          margin: 0;
        }

        .btn-logout {
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
        }

        .btn-logout:hover {
          background: rgba(255,255,255,0.3);
        }

        .dashboard-content {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .dashboard-sidebar {
          width: 320px;
          background: white;
          padding: 1rem;
          overflow-y: auto;
          border-right: 1px solid #e0e0e0;
        }

        .dashboard-sidebar section {
          margin-bottom: 1.5rem;
        }

        .dashboard-sidebar h3 {
          font-size: 0.9rem;
          color: #333;
          margin-bottom: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .dashboard-sidebar h4 {
          font-size: 0.85rem;
          color: #666;
          margin: 1rem 0 0.5rem;
        }

        .range-inputs {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .range-inputs input {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 0.9rem;
        }

        .stat-card {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 0.75rem;
        }

        .stat-card.primary {
          background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
        }

        .stat-value {
          display: block;
          font-size: 1.75rem;
          font-weight: bold;
          color: #1a5f2a;
        }

        .stat-label {
          font-size: 0.8rem;
          color: #666;
        }

        .distribution-bars {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .bar-item {
          font-size: 0.8rem;
        }

        .bar-label {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
          color: #555;
        }

        .bar-bg {
          height: 8px;
          background: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          background: #2d8f4e;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .bar-fill.expense {
          background: #ff9800;
        }

        .export-section {
          border-top: 1px solid #eee;
          padding-top: 1rem;
        }

        .export-hint {
          font-size: 0.8rem;
          color: #888;
          margin-bottom: 0.75rem;
        }

        .export-buttons {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .export-buttons .btn {
          flex: 1;
          padding: 0.5rem;
          font-size: 0.85rem;
        }

        .btn-sm {
          padding: 0.4rem !important;
          font-size: 0.75rem !important;
        }

        .dashboard-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .map-controls {
          position: absolute;
          top: 1rem;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          background: white;
          padding: 0.5rem;
          border-radius: 25px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.15);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
        }

        .map-controls span {
          color: #666;
          padding: 0 0.5rem;
        }

        .toggle-btn {
          padding: 0.5rem 1rem;
          border: none;
          background: #f0f0f0;
          border-radius: 20px;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.2s;
        }

        .toggle-btn:hover {
          background: #e0e0e0;
        }

        .toggle-btn.active {
          background: #2d8f4e;
          color: white;
        }

        .map-wrapper {
          flex: 1;
          min-height: 400px;
        }

        .map-legend {
          position: absolute;
          bottom: 1rem;
          left: 1rem;
          background: white;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.15);
          display: flex;
          gap: 1.5rem;
          z-index: 1000;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
        }

        .legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .legend-dot.origin {
          background: #4CAF50;
        }

        .legend-dot.destination {
          background: #f44336;
        }

        .map-loading {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #f5f5f5;
        }

        @media (max-width: 768px) {
          .dashboard-content {
            flex-direction: column;
          }

          .dashboard-sidebar {
            width: 100%;
            max-height: 40vh;
            border-right: none;
            border-bottom: 1px solid #e0e0e0;
          }

          .map-controls {
            top: 0.5rem;
            font-size: 0.75rem;
            padding: 0.4rem;
          }

          .toggle-btn {
            padding: 0.4rem 0.75rem;
            font-size: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}
