"use client";

import { useState, useCallback, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { reverseGeocode, Direccion } from "@/lib/geocoding";

const PUEBLA_CENTER: [number, number] = [19.0414, -98.2063];
const PUEBLA_ZOOM = 13;

interface Punto {
  lat: number;
  lng: number;
  direccion?: Direccion | null;
  cargandoDireccion?: boolean;
}

interface FormData {
  gastoDiario: string;
  motivoViaje: string;
  tiempoIda: string;
  tiempoRegreso: string;
  mediosTransporte: string[];
  transbordosIda: string;
  transbordosRegreso: string;
  satisfaccion: string;
}

const TOTAL_PASOS = 8;
type Paso = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

const MEDIOS_TRANSPORTE = [
  { value: "linea1", label: "Línea 1 RUTA" },
  { value: "linea2", label: "Línea 2 RUTA" },
  { value: "linea3", label: "Línea 3 RUTA" },
  { value: "linea4", label: "Línea 4 RUTA" },
  { value: "alimentadora", label: "Alimentadora RUTA" },
  { value: "van", label: "Van / Combi" },
  { value: "camion", label: "Camión" },
  { value: "microbus", label: "Microbús" },
];

const SATISFACCION_OPCIONES = [
  { value: 1, label: "Nada satisfecho" },
  { value: 2, label: "Poco satisfecho" },
  { value: 3, label: "Medianamente satisfecho" },
  { value: 4, label: "Muy satisfecho" },
  { value: 5, label: "Completamente satisfecho" },
];

const createIcon = (color: string, label: string) => {
  return L.divIcon({
    className: "custom-div-icon",
    html: `
      <div style="
        background: ${color};
        width: 36px;
        height: 36px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 3px 10px rgba(0,0,0,0.4);
        border: 3px solid white;
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-weight: bold;
          font-size: 13px;
        ">${label}</span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};

const iconOrigen = createIcon("#4CAF50", "A");
const iconDestino = createIcon("#f44336", "B");

function MapClickHandler({
  onMapClick,
  isEnabled,
}: {
  onMapClick: (lat: number, lng: number) => void;
  isEnabled: boolean;
}) {
  useMapEvents({
    click: (e) => {
      if (isEnabled) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

function FitBounds({ points }: { points: Punto[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [points, map]);

  return null;
}

export default function MapaMovilidad() {
  const [paso, setPaso] = useState<Paso>(1);
  const [origen, setOrigen] = useState<Punto | null>(null);
  const [destino, setDestino] = useState<Punto | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    gastoDiario: "",
    motivoViaje: "",
    tiempoIda: "",
    tiempoRegreso: "",
    mediosTransporte: [],
    transbordosIda: "",
    transbordosRegreso: "",
    satisfaccion: "",
  });

  const obtenerDireccion = useCallback(
    async (punto: Punto, tipo: "origen" | "destino") => {
      const direccion = await reverseGeocode(punto.lat, punto.lng);
      if (tipo === "origen") {
        setOrigen((prev) =>
          prev ? { ...prev, direccion, cargandoDireccion: false } : null
        );
      } else {
        setDestino((prev) =>
          prev ? { ...prev, direccion, cargandoDireccion: false } : null
        );
      }
    },
    []
  );

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      const nuevoPunto: Punto = { lat, lng, cargandoDireccion: true };
      if (paso === 1 && !origen) {
        setOrigen(nuevoPunto);
        obtenerDireccion(nuevoPunto, "origen");
      } else if (paso === 2 && !destino) {
        setDestino(nuevoPunto);
        obtenerDireccion(nuevoPunto, "destino");
      }
    },
    [paso, origen, destino, obtenerDireccion]
  );

  const siguientePaso = () => {
    if (paso === 1 && origen) setPaso(2);
    else if (paso === 2 && destino) setPaso(3);
    else if (paso === 3 && formData.mediosTransporte.length > 0) setPaso(4);
    else if (paso === 4 && formData.transbordosIda !== "" && formData.transbordosRegreso !== "") setPaso(5);
    else if (paso === 5 && formData.gastoDiario) setPaso(6);
    else if (paso === 6 && formData.motivoViaje) setPaso(7);
    else if (paso === 7 && formData.tiempoIda && formData.tiempoRegreso) setPaso(8);
  };

  const removerOrigen = () => setOrigen(null);
  const removerDestino = () => setDestino(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleMedioTransporte = (value: string) => {
    setFormData((prev) => {
      const medios = prev.mediosTransporte.includes(value)
        ? prev.mediosTransporte.filter((m) => m !== value)
        : [...prev.mediosTransporte, value];
      return { ...prev, mediosTransporte: medios };
    });
  };

  const handleSubmit = async () => {
    if (
      !origen ||
      !destino ||
      !formData.gastoDiario ||
      !formData.motivoViaje ||
      !formData.satisfaccion ||
      formData.mediosTransporte.length === 0
    ) {
      return;
    }

    setEnviando(true);

    try {
      const response = await fetch("/api/viajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origen: { lat: origen.lat, lng: origen.lng },
          origenDireccion: origen.direccion || null,
          destino: { lat: destino.lat, lng: destino.lng },
          destinoDireccion: destino.direccion || null,
          gastoDiario: parseFloat(formData.gastoDiario),
          motivoViaje: formData.motivoViaje,
          tiempoIda: formData.tiempoIda ? parseInt(formData.tiempoIda) : null,
          tiempoRegreso: formData.tiempoRegreso ? parseInt(formData.tiempoRegreso) : null,
          mediosTransporte: formData.mediosTransporte,
          transbordosIda: parseInt(formData.transbordosIda),
          transbordosRegreso: parseInt(formData.transbordosRegreso),
          satisfaccion: parseInt(formData.satisfaccion),
        }),
      });

      if (response.ok) {
        setEnviado(true);
        setPaso(9);
      } else {
        alert("Error al enviar los datos. Por favor intenta de nuevo.");
      }
    } catch {
      alert("Error de conexión. Por favor intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const reiniciar = () => {
    setOrigen(null);
    setDestino(null);
    setFormData({
      gastoDiario: "",
      motivoViaje: "",
      tiempoIda: "",
      tiempoRegreso: "",
      mediosTransporte: [],
      transbordosIda: "",
      transbordosRegreso: "",
      satisfaccion: "",
    });
    setEnviado(false);
    setPaso(1);
  };

  const mapClickEnabled =
    (paso === 1 && !origen) || (paso === 2 && !destino);

  const getToastMessage = () => {
    if (paso === 1 && !origen) return "Toca para marcar inicio";
    if (paso === 2 && !destino) return "Toca para marcar destino";
    return null;
  };

  const toastMessage = getToastMessage();

  const allPoints: Punto[] = [];
  if (origen) allPoints.push(origen);
  if (destino) allPoints.push(destino);

  return (
    <div className="container">
      <header className="header">
        <h1>Mapa de Movilidad Urbana</h1>
        <p className="header-subtitle">Periférico Ecológico de Puebla</p>
        <p className="header-objetivo">
          Tu participación nos ayudará a producir los datos necesarios para
          poder diseñar estrategias de transporte público que de verdad puedan
          atender las necesidades de todos.
        </p>
      </header>

      <div className="main-content">
        <div className="map-container">
          {toastMessage && (
            <div className="map-instruction-toast">{toastMessage}</div>
          )}

          <MapContainer
            center={PUEBLA_CENTER}
            zoom={PUEBLA_ZOOM}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler
              onMapClick={handleMapClick}
              isEnabled={mapClickEnabled}
            />
            <FitBounds points={allPoints} />

            {origen && destino && (
              <Polyline
                positions={[
                  [origen.lat, origen.lng],
                  [destino.lat, destino.lng],
                ]}
                color="#2d8f4e"
                weight={3}
                opacity={0.7}
                dashArray="8, 8"
              />
            )}

            {origen && (
              <Marker position={[origen.lat, origen.lng]} icon={iconOrigen}>
                <Popup>
                  <strong>Punto de partida</strong>
                </Popup>
              </Marker>
            )}

            {destino && (
              <Marker position={[destino.lat, destino.lng]} icon={iconDestino}>
                <Popup>
                  <strong>Punto de destino</strong>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        <aside className="sidebar">
          {/* Indicador de pasos */}
          <div className="step-indicator">
            {Array.from({ length: TOTAL_PASOS }, (_, i) => i + 1).map((s) => (
              <div
                key={s}
                className={`step-dot ${paso === s ? "active" : ""} ${
                  paso > s ? "completed" : ""
                }`}
              />
            ))}
          </div>

          <div className="step-content">
            {/* PASO 1: Seleccionar origen */}
            {paso === 1 && (
              <>
                <h2 className="step-title">Paso 1: Punto de partida</h2>
                <p className="step-description">
                  Toca en el mapa donde inicias tu viaje diario.
                </p>

                {!origen ? (
                  <div className="instruction-box">
                    <p>Toca en el mapa para marcar tu punto de partida</p>
                  </div>
                ) : (
                  <>
                    <div className="point-info">
                      <div className="point-marker origin">A</div>
                      <div className="point-details">
                        <span className="point-label">Origen</span>
                        <span className="point-coords">
                          {origen.cargandoDireccion
                            ? "Obteniendo dirección..."
                            : origen.direccion?.displayName ||
                              "Ubicación marcada"}
                        </span>
                      </div>
                      <button
                        className="btn-remove"
                        onClick={removerOrigen}
                        title="Quitar punto"
                      >
                        ×
                      </button>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={siguientePaso}
                    >
                      Continuar
                    </button>
                  </>
                )}
              </>
            )}

            {/* PASO 2: Seleccionar destino */}
            {paso === 2 && (
              <>
                <h2 className="step-title">Paso 2: Tu destino</h2>
                <p className="step-description">
                  Toca en el mapa donde termina tu viaje.
                </p>

                <div className="point-info">
                  <div className="point-marker origin">A</div>
                  <div className="point-details">
                    <span className="point-label">Origen</span>
                    <span className="point-coords">
                      {origen?.direccion?.displayName || "Ubicación marcada"}
                    </span>
                  </div>
                </div>

                {destino ? (
                  <div className="point-info">
                    <div className="point-marker destination">B</div>
                    <div className="point-details">
                      <span className="point-label">Destino</span>
                      <span className="point-coords">
                        {destino.cargandoDireccion
                          ? "Obteniendo dirección..."
                          : destino.direccion?.displayName ||
                            "Ubicación marcada"}
                      </span>
                    </div>
                    <button
                      className="btn-remove"
                      onClick={removerDestino}
                      title="Quitar punto"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="instruction-box">
                    <p>Toca en el mapa para marcar tu destino</p>
                  </div>
                )}

                {destino && (
                  <button className="btn btn-primary" onClick={siguientePaso}>
                    Continuar
                  </button>
                )}
              </>
            )}

            {/* PASO 3: Medio de transporte */}
            {paso === 3 && (
              <>
                <h2 className="step-title">Paso 3: Medio de transporte</h2>
                <p className="step-description">
                  ¿Qué transporte utilizas? Puedes seleccionar varios.
                </p>

                <div className="checkbox-grid">
                  {MEDIOS_TRANSPORTE.map((medio) => (
                    <label
                      key={medio.value}
                      className={`checkbox-card ${
                        formData.mediosTransporte.includes(medio.value)
                          ? "selected"
                          : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.mediosTransporte.includes(
                          medio.value
                        )}
                        onChange={() => toggleMedioTransporte(medio.value)}
                      />
                      <span>{medio.label}</span>
                    </label>
                  ))}
                </div>

                <button
                  className="btn btn-primary"
                  onClick={siguientePaso}
                  disabled={formData.mediosTransporte.length === 0}
                >
                  Continuar
                </button>
              </>
            )}

            {/* PASO 4: Transbordos */}
            {paso === 4 && (
              <>
                <h2 className="step-title">Paso 4: Transbordos</h2>
                <p className="step-description">
                  ¿Cuántas veces transbordas (cambias de unidad) en tu viaje?
                </p>

                <div className="form-group">
                  <label>Transbordos en viaje de ida</label>
                  <div className="option-buttons">
                    {[0, 1, 2, 3].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`option-btn ${
                          formData.transbordosIda === String(n) ? "selected" : ""
                        }`}
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            transbordosIda: String(n),
                          }))
                        }
                      >
                        {n === 0 ? "Ninguno" : n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Transbordos en viaje de regreso</label>
                  <div className="option-buttons">
                    {[0, 1, 2, 3].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`option-btn ${
                          formData.transbordosRegreso === String(n)
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            transbordosRegreso: String(n),
                          }))
                        }
                      >
                        {n === 0 ? "Ninguno" : n}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={siguientePaso}
                  disabled={
                    formData.transbordosIda === "" ||
                    formData.transbordosRegreso === ""
                  }
                >
                  Continuar
                </button>
              </>
            )}

            {/* PASO 5: Gasto diario */}
            {paso === 5 && (
              <>
                <h2 className="step-title">Paso 5: Gasto en transporte</h2>
                <p className="step-description">
                  ¿Cuánto gastas al día en transporte?
                </p>

                <div className="form-group">
                  <label htmlFor="gastoDiario">Gasto diario en transporte</label>
                  <div className="input-with-prefix">
                    <span>$</span>
                    <input
                      type="number"
                      id="gastoDiario"
                      name="gastoDiario"
                      value={formData.gastoDiario}
                      onChange={handleInputChange}
                      placeholder="Ej: 50"
                      min="0"
                      step="1"
                      inputMode="numeric"
                    />
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={siguientePaso}
                  disabled={!formData.gastoDiario}
                >
                  Continuar
                </button>
              </>
            )}

            {/* PASO 6: Motivo del viaje */}
            {paso === 6 && (
              <>
                <h2 className="step-title">Paso 6: Motivo del viaje</h2>
                <p className="step-description">
                  ¿Cuál es el motivo principal de este viaje?
                </p>

                <div className="form-group">
                  <label htmlFor="motivoViaje">Motivo del viaje</label>
                  <select
                    id="motivoViaje"
                    name="motivoViaje"
                    value={formData.motivoViaje}
                    onChange={handleInputChange}
                  >
                    <option value="">Selecciona una opción</option>
                    <option value="trabajo">Trabajo</option>
                    <option value="escuela">Escuela / Universidad</option>
                    <option value="casa">Regreso a casa</option>
                    <option value="compras">Compras</option>
                    <option value="salud">Cita médica / Salud</option>
                    <option value="tramites">Trámites</option>
                    <option value="recreacion">Recreación / Ocio</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={siguientePaso}
                  disabled={!formData.motivoViaje}
                >
                  Continuar
                </button>
              </>
            )}

            {/* PASO 7: Tiempos de ida y regreso */}
            {paso === 7 && (
              <>
                <h2 className="step-title">Paso 7: Tiempo de traslado</h2>
                <p className="step-description">
                  ¿Cuánto tiempo te toma este viaje? (en minutos)
                </p>

                <div className="form-group">
                  <label htmlFor="tiempoIda">Tiempo de ida (minutos)</label>
                  <input
                    type="number"
                    id="tiempoIda"
                    name="tiempoIda"
                    value={formData.tiempoIda}
                    onChange={handleInputChange}
                    placeholder="Ej: 45"
                    min="0"
                    step="1"
                    inputMode="numeric"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="tiempoRegreso">
                    Tiempo de regreso (minutos)
                  </label>
                  <input
                    type="number"
                    id="tiempoRegreso"
                    name="tiempoRegreso"
                    value={formData.tiempoRegreso}
                    onChange={handleInputChange}
                    placeholder="Ej: 50"
                    min="0"
                    step="1"
                    inputMode="numeric"
                  />
                </div>

                <button
                  className="btn btn-primary"
                  onClick={siguientePaso}
                  disabled={!formData.tiempoIda || !formData.tiempoRegreso}
                >
                  Continuar
                </button>
              </>
            )}

            {/* PASO 8: Satisfacción (Likert) */}
            {paso === 8 && (
              <>
                <h2 className="step-title">Paso 8: Satisfacción</h2>
                <p className="step-description">
                  ¿Qué tan satisfecho estás con el servicio de transporte
                  público en general?
                </p>

                <div className="likert-scale">
                  {SATISFACCION_OPCIONES.map((opcion) => (
                    <label
                      key={opcion.value}
                      className={`likert-option ${
                        formData.satisfaccion === String(opcion.value)
                          ? "selected"
                          : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="satisfaccion"
                        value={opcion.value}
                        checked={
                          formData.satisfaccion === String(opcion.value)
                        }
                        onChange={handleInputChange}
                      />
                      <span className="likert-number">{opcion.value}</span>
                      <span className="likert-label">{opcion.label}</span>
                    </label>
                  ))}
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={enviando || !formData.satisfaccion}
                >
                  {enviando ? "Enviando..." : "Enviar encuesta"}
                </button>
              </>
            )}

            {/* PASO 9: Confirmación */}
            {paso === 9 && enviado && (
              <div className="success-message">
                <div className="success-icon">✓</div>
                <h2>¡Gracias por participar!</h2>
                <p>
                  Tu información ayudará a diseñar mejores estrategias de
                  transporte público para el Periférico Ecológico.
                </p>
                <button className="btn btn-primary" onClick={reiniciar}>
                  Registrar otro viaje
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {enviando && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Enviando datos...</p>
        </div>
      )}
    </div>
  );
}
