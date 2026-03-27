"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

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
  tiempoIda: number | null;
  tiempoRegreso: number | null;
  mediosTransporte: string[];
  transbordosIda: number;
  transbordosRegreso: number;
  satisfaccion: number;
  createdAt: string;
}

interface Stats {
  totalViajes: number;
  gastoPromedio: number;
  distribucionMotivos: Record<string, number>;
  rangosGasto: Record<string, number>;
  distribucionMedios: Record<string, number>;
  mediosNombres: Record<string, string>;
  transbordosIda: Record<string, number>;
  transbordosRegreso: Record<string, number>;
  porcentajeTransbordo: number;
  distribucionSatisfaccion: Record<string, number>;
  satisfaccionPromedio: number;
  rangosTiempo: Record<string, number>;
  tiempoPromedioIda: number;
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

const SATISFACCION_LABELS: Record<string, string> = {
  "1": "Nada satisfecho",
  "2": "Poco satisfecho",
  "3": "Medianamente",
  "4": "Muy satisfecho",
  "5": "Completamente",
};

const TRANSBORDOS_LABELS: Record<string, string> = {
  "0": "Ninguno",
  "1": "1 vez",
  "2": "2 veces",
  "3": "3 veces",
};

function DistributionChart({
  title,
  data,
  total,
  labelMap,
  colorClass,
}: {
  title: string;
  data: Record<string, number>;
  total: number;
  labelMap?: Record<string, string>;
  colorClass?: string;
}) {
  return (
    <div className="chart-card">
      <h4>{title}</h4>
      <div className="distribution-bars">
        {Object.entries(data)
          .sort((a, b) => b[1] - a[1])
          .map(([key, count]) => {
            const percent = total > 0 ? (count / total) * 100 : 0;
            const label = labelMap ? labelMap[key] || key : key;
            return (
              <div key={key} className="bar-item">
                <div className="bar-label">
                  <span>{label}</span>
                  <span>
                    {count} ({percent.toFixed(0)}%)
                  </span>
                </div>
                <div className="bar-bg">
                  <div
                    className={`bar-fill ${colorClass || ""}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function SatisfactionChart({
  data,
  total,
}: {
  data: Record<string, number>;
  total: number;
}) {
  return (
    <div className="chart-card">
      <h4>Satisfacción del servicio</h4>
      <div className="distribution-bars">
        {Object.entries(data).map(([nivel, count]) => {
          const percent = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={nivel} className="bar-item">
              <div className="bar-label">
                <span>
                  {nivel} - {SATISFACCION_LABELS[nivel]}
                </span>
                <span>
                  {count} ({percent.toFixed(0)}%)
                </span>
              </div>
              <div className="bar-bg">
                <div
                  className={`bar-fill sat-${nivel}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [heatmapType, setHeatmapType] = useState<
    "origins" | "destinations" | "both"
  >("both");
  const [filtroMotivo, setFiltroMotivo] = useState("todos");
  const [filtroMedio, setFiltroMedio] = useState("todos");

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filtroMotivo !== "todos") params.set("motivoViaje", filtroMotivo);
      if (filtroMedio !== "todos") params.set("medioTransporte", filtroMedio);

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
  }, [filtroMotivo, filtroMedio, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  };

  const handleExport = (format: "geojson" | "csv") => {
    window.open(`/api/export?format=${format}&type=all`, "_blank");
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner"></div>
        <p>Cargando dashboard...</p>
      </div>
    );
  }

  const hasData = stats && stats.totalViajes > 0;

  return (
    <div className="db">
      {/* Header */}
      <header className="db-header">
        <div className="db-header-left">
          <h1>Dashboard de Movilidad</h1>
        </div>
        <div className="db-header-right">
          {/* Filtros siempre visibles */}
          <div className="db-filter">
            <select
              value={filtroMotivo}
              onChange={(e) => setFiltroMotivo(e.target.value)}
            >
              <option value="todos">Todo motivo</option>
              {Object.entries(MOTIVOS_NOMBRES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="db-filter">
            <select
              value={filtroMedio}
              onChange={(e) => setFiltroMedio(e.target.value)}
            >
              <option value="todos">Todo transporte</option>
              {stats?.mediosNombres &&
                Object.entries(stats.mediosNombres).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
            </select>
          </div>
          <button
            className="db-btn"
            onClick={() => handleExport("csv")}
          >
            Descargar CSV
          </button>
          <button
            className="db-btn"
            onClick={() => handleExport("geojson")}
          >
            Descargar GeoJSON
          </button>
          <button className="db-btn-logout" onClick={handleLogout}>
            Salir
          </button>
        </div>
      </header>

      <div className="db-body">
        {/* Mapa + Stats laterales */}
        <div className="db-map-row">
          <div className="db-map-section">
            <div className="db-map-toolbar">
              <div className="db-map-toggles">
                <span>Mostrar:</span>
                {(["origins", "destinations", "both"] as const).map((t) => (
                  <button
                    key={t}
                    className={`toggle-btn ${heatmapType === t ? "active" : ""}`}
                    onClick={() => setHeatmapType(t)}
                  >
                    {t === "origins"
                      ? "Orígenes"
                      : t === "destinations"
                      ? "Destinos"
                      : "Ambos"}
                  </button>
                ))}
              </div>
            </div>
            <div className="db-map-wrapper">
              <DashboardMap viajes={viajes} heatmapType={heatmapType} />
              <div className="db-map-legend">
                {(heatmapType === "origins" || heatmapType === "both") && (
                  <div className="legend-item">
                    <span className="legend-dot origin" />
                    <span>Orígenes</span>
                  </div>
                )}
                {(heatmapType === "destinations" || heatmapType === "both") && (
                  <div className="legend-item">
                    <span className="legend-dot destination" />
                    <span>Destinos</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats sidebar junto al mapa */}
          <div className="db-stats-panel">
            <div className="db-stat">
              <span className="db-stat-value">{stats?.totalViajes || 0}</span>
              <span className="db-stat-label">Encuestas</span>
            </div>
            <div className="db-stat">
              <span className="db-stat-value">${stats?.gastoPromedio?.toFixed(0) || "0"}</span>
              <span className="db-stat-label">Gasto promedio</span>
            </div>
            <div className="db-stat">
              <span className="db-stat-value">{stats?.tiempoPromedioIda || 0}<small>min</small></span>
              <span className="db-stat-label">Tiempo prom. ida</span>
            </div>
            <div className="db-stat">
              <span className="db-stat-value">{stats?.porcentajeTransbordo || 0}<small>%</small></span>
              <span className="db-stat-label">Transbordan</span>
            </div>
            <div className="db-stat">
              <span className="db-stat-value">{stats?.satisfaccionPromedio || 0}<small>/5</small></span>
              <span className="db-stat-label">Satisfacción</span>
            </div>
          </div>
        </div>

        {/* Charts grid */}
        {hasData && (
          <div className="db-charts-grid">
            <DistributionChart
              title="Motivo del viaje"
              data={stats.distribucionMotivos}
              total={stats.totalViajes}
              labelMap={MOTIVOS_NOMBRES}
            />
            <DistributionChart
              title="Medio de transporte"
              data={stats.distribucionMedios}
              total={stats.totalViajes}
              labelMap={stats.mediosNombres}
              colorClass="transport"
            />
            <DistributionChart
              title="Tiempo de viaje (ida)"
              data={stats.rangosTiempo}
              total={stats.totalViajes}
              labelMap={{
                "0-15": "0-15 min",
                "16-30": "16-30 min",
                "31-59": "31-59 min",
                "60-90": "60-90 min",
                "91+": "91+ min",
              }}
              colorClass="time"
            />
            <DistributionChart
              title="Gasto diario"
              data={stats.rangosGasto}
              total={stats.totalViajes}
              labelMap={{
                "0-20": "$0-20",
                "21-50": "$21-50",
                "51-100": "$51-100",
                "101-200": "$101-200",
                "201+": "$201+",
              }}
              colorClass="expense"
            />
            <DistributionChart
              title="Transbordos (ida)"
              data={stats.transbordosIda}
              total={stats.totalViajes}
              labelMap={TRANSBORDOS_LABELS}
              colorClass="transport"
            />
            <SatisfactionChart
              data={stats.distribucionSatisfaccion}
              total={stats.totalViajes}
            />
          </div>
        )}
      </div>

      <style jsx>{`
        .db {
          min-height: 100vh;
          background: #f0f2f5;
          display: flex;
          flex-direction: column;
        }

        /* Header */
        .db-header {
          background: white;
          border-bottom: 1px solid #e0e0e0;
          padding: 0.6rem 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 1100;
          gap: 1rem;
        }

        .db-header-left h1 {
          font-size: 1rem;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0;
          white-space: nowrap;
        }

        .db-header-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .db-filter select {
          padding: 0.35rem 0.5rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 0.8rem;
          background: white;
          color: #333;
        }

        .db-btn {
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 0.35rem 0.65rem;
          cursor: pointer;
          font-size: 0.8rem;
          color: #333;
          white-space: nowrap;
        }

        .db-btn:hover {
          background: #e8e8e8;
        }

        .db-btn-logout {
          background: none;
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 0.35rem 0.65rem;
          cursor: pointer;
          font-size: 0.8rem;
          color: #999;
        }

        .db-btn-logout:hover {
          color: #f44336;
          border-color: #f44336;
        }

        /* Body */
        .db-body {
          flex: 1;
          padding: 1rem 1.25rem;
          overflow-y: auto;
        }

        /* Map + Stats row */
        .db-map-row {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .db-map-section {
          flex: 1;
          background: white;
          border-radius: 12px;
          border: 1px solid #e8e8e8;
          overflow: hidden;
          min-width: 0;
        }

        .db-map-toolbar {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid #f0f0f0;
        }

        .db-map-toggles {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.8rem;
          color: #888;
        }

        .toggle-btn {
          padding: 0.3rem 0.65rem;
          border: 1px solid #e0e0e0;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.78rem;
          transition: all 0.15s;
        }

        .toggle-btn:hover {
          background: #f5f5f5;
        }

        .toggle-btn.active {
          background: #1a5f2a;
          color: white;
          border-color: #1a5f2a;
        }

        .db-map-wrapper {
          position: relative;
          height: 420px;
        }

        .db-map-legend {
          position: absolute;
          bottom: 0.75rem;
          left: 0.75rem;
          background: white;
          padding: 0.4rem 0.65rem;
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
          display: flex;
          gap: 0.75rem;
          z-index: 1000;
          font-size: 0.75rem;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .legend-dot.origin { background: #4CAF50; }
        .legend-dot.destination { background: #f44336; }

        /* Stats panel */
        .db-stats-panel {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 160px;
          flex-shrink: 0;
        }

        .db-stat {
          background: white;
          border: 1px solid #e8e8e8;
          border-radius: 10px;
          padding: 0.65rem 0.75rem;
          text-align: center;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .db-stat-value {
          font-size: 1.3rem;
          font-weight: 700;
          color: #1a5f2a;
          line-height: 1.1;
        }

        .db-stat-value small {
          font-size: 0.75rem;
          font-weight: 500;
          opacity: 0.7;
        }

        .db-stat-label {
          font-size: 0.65rem;
          color: #888;
          margin-top: 0.15rem;
        }

        /* Charts grid */
        .db-charts-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
        }

        /* Map loading */
        .map-loading {
          height: 420px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #fafafa;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .db-charts-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .db-header {
            flex-direction: column;
            align-items: flex-start;
            padding: 0.6rem 0.75rem;
            gap: 0.5rem;
          }

          .db-header-right {
            width: 100%;
            gap: 0.4rem;
          }

          .db-filter {
            flex: 1;
          }

          .db-filter select {
            width: 100%;
          }

          .db-btn {
            flex: 1;
          }

          .db-body {
            padding: 0.75rem;
          }

          .db-map-row {
            flex-direction: column;
          }

          .db-stats-panel {
            width: 100%;
            flex-direction: row;
            flex-wrap: wrap;
          }

          .db-stat {
            flex: 1;
            min-width: calc(50% - 0.25rem);
            padding: 0.5rem;
          }

          .db-stat-value {
            font-size: 1.1rem;
          }

          .db-map-wrapper {
            height: 300px;
          }

          .db-charts-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <style>{`
        .chart-card {
          background: white;
          border-radius: 12px;
          border: 1px solid #e8e8e8;
          padding: 1rem;
        }

        .chart-card h4 {
          font-size: 0.8rem;
          font-weight: 600;
          color: #333;
          margin: 0 0 0.75rem 0;
        }

        .distribution-bars {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .bar-item {
          font-size: 0.75rem;
        }

        .bar-label {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
          color: #555;
        }

        .bar-bg {
          height: 8px;
          background: #f0f0f0;
          border-radius: 4px;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          background: #2d8f4e;
          border-radius: 4px;
          transition: width 0.4s ease;
        }

        .bar-fill.transport { background: #2196F3; }
        .bar-fill.time { background: #9C27B0; }
        .bar-fill.expense { background: #ff9800; }

        .bar-fill.sat-1 { background: #ef5350; }
        .bar-fill.sat-2 { background: #ff9800; }
        .bar-fill.sat-3 { background: #ffc107; }
        .bar-fill.sat-4 { background: #8bc34a; }
        .bar-fill.sat-5 { background: #4caf50; }
      `}</style>
    </div>
  );
}
