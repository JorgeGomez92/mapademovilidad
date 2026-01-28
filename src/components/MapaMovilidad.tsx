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

// Coordenadas del Periférico Ecológico de Puebla (centro aproximado)
const PUEBLA_CENTER: [number, number] = [19.0414, -98.2063];
const PUEBLA_ZOOM = 13;

// Tipos
interface Punto {
  lat: number;
  lng: number;
  direccion?: Direccion | null;
  cargandoDireccion?: boolean;
}

interface FormData {
  gastoDiario: string;
  motivoViaje: string;
  medioTransporte: string;
  comentarios: string;
}

type Paso = 1 | 2 | 3 | 4;

// Crear iconos personalizados
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
const createTransferIcon = (num: number) => createIcon("#FF9800", `T${num}`);

// Función para obtener ruta de OSRM
async function fetchRoute(points: Punto[]): Promise<[number, number][] | null> {
  if (points.length < 2) return null;

  // Formato: lng,lat;lng,lat;...
  const coordinates = points.map((p) => `${p.lng},${p.lat}`).join(";");

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates) {
      return null;
    }

    // OSRM devuelve [lng, lat], necesitamos [lat, lng] para Leaflet
    return data.routes[0].geometry.coordinates.map(
      (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
    );
  } catch {
    return null;
  }
}

// Componente para manejar clics en el mapa
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

// Componente para ajustar vista del mapa a los puntos
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
  // Estado del flujo
  const [paso, setPaso] = useState<Paso>(1);
  const [origen, setOrigen] = useState<Punto | null>(null);
  const [destino, setDestino] = useState<Punto | null>(null);
  const [transbordos, setTransbordos] = useState<Punto[]>([]);
  const [tieneTransbordos, setTieneTransbordos] = useState(false);
  const [agregandoTransbordo, setAgregandoTransbordo] = useState(false);

  // Estado de la ruta
  const [rutaCoords, setRutaCoords] = useState<[number, number][] | null>(null);
  const [cargandoRuta, setCargandoRuta] = useState(false);

  // Estado del formulario
  const [formData, setFormData] = useState<FormData>({
    gastoDiario: "",
    motivoViaje: "",
    medioTransporte: "",
    comentarios: "",
  });

  // Estado de envío
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  // Calcular ruta cuando cambian los puntos
  useEffect(() => {
    const calcularRuta = async () => {
      const puntos: Punto[] = [];
      if (origen) puntos.push(origen);
      puntos.push(...transbordos);
      if (destino) puntos.push(destino);

      if (puntos.length >= 2) {
        setCargandoRuta(true);
        const ruta = await fetchRoute(puntos);
        setRutaCoords(ruta);
        setCargandoRuta(false);
      } else {
        setRutaCoords(null);
      }
    };

    calcularRuta();
  }, [origen, destino, transbordos]);

  // Función para obtener dirección de un punto
  const obtenerDireccion = useCallback(async (punto: Punto, tipo: "origen" | "destino" | "transbordo", index?: number) => {
    const direccion = await reverseGeocode(punto.lat, punto.lng);

    if (tipo === "origen") {
      setOrigen(prev => prev ? { ...prev, direccion, cargandoDireccion: false } : null);
    } else if (tipo === "destino") {
      setDestino(prev => prev ? { ...prev, direccion, cargandoDireccion: false } : null);
    } else if (tipo === "transbordo" && index !== undefined) {
      setTransbordos(prev => prev.map((t, i) =>
        i === index ? { ...t, direccion, cargandoDireccion: false } : t
      ));
    }
  }, []);

  // Manejar clic en el mapa
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      const nuevoPunto: Punto = { lat, lng, cargandoDireccion: true };

      if (paso === 1 && !origen) {
        setOrigen(nuevoPunto);
        obtenerDireccion(nuevoPunto, "origen");
      } else if (paso === 2 && !destino && !agregandoTransbordo) {
        setDestino(nuevoPunto);
        obtenerDireccion(nuevoPunto, "destino");
      } else if (agregandoTransbordo) {
        const nuevoIndex = transbordos.length;
        setTransbordos((prev) => [...prev, nuevoPunto]);
        setAgregandoTransbordo(false);
        obtenerDireccion(nuevoPunto, "transbordo", nuevoIndex);
      }
    },
    [paso, origen, destino, agregandoTransbordo, transbordos.length, obtenerDireccion]
  );

  // Avanzar al siguiente paso
  const siguientePaso = () => {
    if (paso === 1 && origen) {
      setPaso(2);
    } else if (paso === 2 && destino) {
      setPaso(3);
    }
  };

  // Remover punto
  const removerOrigen = () => {
    setOrigen(null);
    setRutaCoords(null);
  };

  const removerDestino = () => {
    setDestino(null);
    setRutaCoords(null);
  };

  const removerTransbordo = (index: number) => {
    setTransbordos((prev) => prev.filter((_, i) => i !== index));
  };

  // Manejar cambios del formulario
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Enviar datos
  const handleSubmit = async () => {
    if (!origen || !destino || !formData.gastoDiario || !formData.motivoViaje) {
      return;
    }

    setEnviando(true);

    try {
      const response = await fetch("/api/viajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origen: {
            lat: origen.lat,
            lng: origen.lng,
          },
          origenDireccion: origen.direccion || null,
          destino: {
            lat: destino.lat,
            lng: destino.lng,
          },
          destinoDireccion: destino.direccion || null,
          transbordos: transbordos.length > 0
            ? transbordos.map(t => ({
                lat: t.lat,
                lng: t.lng,
                direccion: t.direccion || null,
              }))
            : null,
          gastoDiario: parseFloat(formData.gastoDiario),
          motivoViaje: formData.motivoViaje,
          medioTransporte: formData.medioTransporte || null,
          comentarios: formData.comentarios || null,
        }),
      });

      if (response.ok) {
        setEnviado(true);
        setPaso(4);
      } else {
        alert("Error al enviar los datos. Por favor intenta de nuevo.");
      }
    } catch {
      alert("Error de conexión. Por favor intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  // Reiniciar todo
  const reiniciar = () => {
    setOrigen(null);
    setDestino(null);
    setTransbordos([]);
    setTieneTransbordos(false);
    setAgregandoTransbordo(false);
    setRutaCoords(null);
    setFormData({
      gastoDiario: "",
      motivoViaje: "",
      medioTransporte: "",
      comentarios: "",
    });
    setEnviado(false);
    setPaso(1);
  };

  // Determinar si el clic en el mapa está habilitado
  const mapClickEnabled =
    (paso === 1 && !origen) ||
    (paso === 2 && !destino && !agregandoTransbordo) ||
    agregandoTransbordo;

  // Mensaje para el toast flotante
  const getToastMessage = () => {
    if (paso === 1 && !origen) return "Toca para marcar inicio";
    if (paso === 2 && agregandoTransbordo) return "Toca para marcar transbordo";
    if (paso === 2 && !destino) return "Toca para marcar destino";
    return null;
  };

  const toastMessage = getToastMessage();

  // Puntos para ajustar la vista
  const allPoints: Punto[] = [];
  if (origen) allPoints.push(origen);
  allPoints.push(...transbordos);
  if (destino) allPoints.push(destino);

  return (
    <div className="container">
      <header className="header">
        <h1>Mapa de Movilidad Urbana</h1>
        <p>Periférico Ecológico de Puebla</p>
      </header>

      <div className="main-content">
        {/* Mapa */}
        <div className="map-container">
          {/* Toast de instrucción flotante */}
          {toastMessage && (
            <div className="map-instruction-toast">{toastMessage}</div>
          )}

          {/* Indicador de carga de ruta */}
          {cargandoRuta && (
            <div className="route-loading">
              <div className="mini-spinner"></div>
              <span>Calculando ruta...</span>
            </div>
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

            {/* Ruta por calles */}
            {rutaCoords && (
              <Polyline
                positions={rutaCoords}
                color="#2d8f4e"
                weight={5}
                opacity={0.8}
              />
            )}

            {/* Línea de respaldo si no hay ruta (punteada) */}
            {!rutaCoords && allPoints.length >= 2 && (
              <Polyline
                positions={allPoints.map((p) => [p.lat, p.lng])}
                color="#999"
                weight={3}
                opacity={0.5}
                dashArray="8, 12"
              />
            )}

            {/* Marcador de origen */}
            {origen && (
              <Marker position={[origen.lat, origen.lng]} icon={iconOrigen}>
                <Popup>
                  <strong>Punto de partida</strong>
                </Popup>
              </Marker>
            )}

            {/* Marcadores de transbordo */}
            {transbordos.map((t, i) => (
              <Marker
                key={i}
                position={[t.lat, t.lng]}
                icon={createTransferIcon(i + 1)}
              >
                <Popup>
                  <strong>Transbordo {i + 1}</strong>
                </Popup>
              </Marker>
            ))}

            {/* Marcador de destino */}
            {destino && (
              <Marker position={[destino.lat, destino.lng]} icon={iconDestino}>
                <Popup>
                  <strong>Punto de destino</strong>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        {/* Sidebar / Panel inferior en móvil */}
        <aside className="sidebar">
          {/* Indicador de pasos */}
          <div className="step-indicator">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`step-dot ${paso === s ? "active" : ""} ${
                  paso > s ? "completed" : ""
                }`}
              />
            ))}
          </div>

          {/* Contenido según el paso */}
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
                            : origen.direccion?.displayName || "Ubicación marcada"}
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

                    <button className="btn btn-primary" onClick={siguientePaso}>
                      Continuar
                    </button>
                  </>
                )}
              </>
            )}

            {/* PASO 2: Transbordos y destino */}
            {paso === 2 && (
              <>
                <h2 className="step-title">Paso 2: Tu ruta</h2>
                <p className="step-description">
                  {!destino
                    ? "Marca tu destino. Si haces transbordos, activa la opción."
                    : "Revisa tu ruta y continúa."}
                </p>

                {/* Punto de origen (ya seleccionado) */}
                <div className="point-info">
                  <div className="point-marker origin">A</div>
                  <div className="point-details">
                    <span className="point-label">Origen</span>
                    <span className="point-coords">
                      {origen?.direccion?.displayName || "Ubicación marcada"}
                    </span>
                  </div>
                </div>

                {/* Checkbox de transbordos */}
                {!destino && (
                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      id="transbordos"
                      checked={tieneTransbordos}
                      onChange={(e) => setTieneTransbordos(e.target.checked)}
                    />
                    <label htmlFor="transbordos">
                      Hago transbordos en mi ruta
                    </label>
                  </div>
                )}

                {/* Lista de transbordos */}
                {transbordos.map((t, i) => (
                  <div key={i} className="point-info">
                    <div className="point-marker transfer">T{i + 1}</div>
                    <div className="point-details">
                      <span className="point-label">Transbordo {i + 1}</span>
                      <span className="point-coords">
                        {t.cargandoDireccion
                          ? "Obteniendo dirección..."
                          : t.direccion?.displayName || "Ubicación marcada"}
                      </span>
                    </div>
                    <button
                      className="btn-remove"
                      onClick={() => removerTransbordo(i)}
                      title="Quitar transbordo"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* Botón agregar transbordo */}
                {tieneTransbordos && !destino && !agregandoTransbordo && (
                  <button
                    className="btn btn-outline"
                    onClick={() => setAgregandoTransbordo(true)}
                    style={{ marginBottom: "1rem" }}
                  >
                    + Agregar transbordo
                  </button>
                )}

                {/* Mensaje cuando está agregando transbordo */}
                {agregandoTransbordo && (
                  <div className="instruction-box">
                    <p>Toca en el mapa para marcar el transbordo</p>
                  </div>
                )}

                {/* Punto de destino */}
                {destino ? (
                  <div className="point-info">
                    <div className="point-marker destination">B</div>
                    <div className="point-details">
                      <span className="point-label">Destino</span>
                      <span className="point-coords">
                        {destino.cargandoDireccion
                          ? "Obteniendo dirección..."
                          : destino.direccion?.displayName || "Ubicación marcada"}
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
                  !agregandoTransbordo && (
                    <div className="instruction-box">
                      <p>Toca en el mapa para marcar tu destino</p>
                    </div>
                  )
                )}

                {destino && (
                  <button className="btn btn-primary" onClick={siguientePaso}>
                    Continuar
                  </button>
                )}
              </>
            )}

            {/* PASO 3: Formulario */}
            {paso === 3 && (
              <>
                <h2 className="step-title">Paso 3: Tu viaje</h2>
                <p className="step-description">
                  Cuéntanos sobre tu gasto y motivo de viaje.
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

                <div className="form-group">
                  <label htmlFor="medioTransporte">
                    Transporte principal (opcional)
                  </label>
                  <select
                    id="medioTransporte"
                    name="medioTransporte"
                    value={formData.medioTransporte}
                    onChange={handleInputChange}
                  >
                    <option value="">Selecciona una opción</option>
                    <option value="ruta">Ruta / Microbús</option>
                    <option value="linea">Línea del Periférico</option>
                    <option value="taxi">Taxi</option>
                    <option value="uber">Uber / DiDi / Cabify</option>
                    <option value="bicicleta">Bicicleta</option>
                    <option value="caminando">Caminando</option>
                    <option value="auto_propio">Auto propio</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="comentarios">Comentarios (opcional)</label>
                  <textarea
                    id="comentarios"
                    name="comentarios"
                    value={formData.comentarios}
                    onChange={handleInputChange}
                    rows={2}
                    placeholder="Algo más que quieras compartir..."
                  />
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={
                    enviando || !formData.gastoDiario || !formData.motivoViaje
                  }
                >
                  {enviando ? "Enviando..." : "Enviar"}
                </button>
              </>
            )}

            {/* PASO 4: Confirmación */}
            {paso === 4 && enviado && (
              <div className="success-message">
                <div className="success-icon">✓</div>
                <h2>¡Gracias!</h2>
                <p>
                  Tu información ayudará a mejorar el transporte en el
                  Periférico Ecológico.
                </p>
                <button className="btn btn-primary" onClick={reiniciar}>
                  Registrar otro viaje
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Overlay de carga */}
      {enviando && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Enviando datos...</p>
        </div>
      )}
    </div>
  );
}
