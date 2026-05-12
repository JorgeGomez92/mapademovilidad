"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import { reverseGeocode, Direccion, SearchResult } from "@/lib/geocoding";
import { MEDIOS_TRANSPORTE } from "@/lib/taxonomies";
import AddressSearch from "./AddressSearch";

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

interface StatsFinales {
  gastoPromedio: number;
  tiempoPromedioIda: number;
  porcentajeTransbordo: number;
}

const SHARE_TEXT =
  "Participa en la encuesta de movilidad de Puebla. Cada respuesta ayuda a mejorar el transporte público.";
const SHARE_TITLE = "Encuesta de Movilidad — Puebla";

const TOTAL_PASOS = 8;
type Paso = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

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
  const [statsFinales, setStatsFinales] = useState<StatsFinales | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);

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
      if (paso === 1) {
        setOrigen(nuevoPunto);
        obtenerDireccion(nuevoPunto, "origen");
      } else if (paso === 2) {
        setDestino(nuevoPunto);
        obtenerDireccion(nuevoPunto, "destino");
      }
    },
    [paso, obtenerDireccion]
  );

  const isStepAnswered = useCallback(
    (s: number): boolean => {
      switch (s) {
        case 1:
          return origen !== null;
        case 2:
          return destino !== null;
        case 3:
          return formData.mediosTransporte.length > 0;
        case 4:
          return (
            formData.transbordosIda !== "" &&
            formData.transbordosRegreso !== ""
          );
        case 5:
          return formData.gastoDiario !== "";
        case 6:
          return formData.motivoViaje !== "";
        case 7:
          return formData.tiempoIda !== "" && formData.tiempoRegreso !== "";
        case 8:
          return formData.satisfaccion !== "";
        default:
          return false;
      }
    },
    [origen, destino, formData]
  );

  // Slider animado entre pasos: drag sigue al dedo; al cruzar umbral,
  // el paso actual sale por un lado y el nuevo entra por el opuesto.
  const SWIPE_THRESHOLD = 60;
  const ANIM_MS = 220;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swipeActive = useRef(false);
  const [dragX, setDragX] = useState(0);
  const [snapping, setSnapping] = useState(false);
  const [busy, setBusy] = useState(false);

  const getWrapWidth = () =>
    wrapRef.current?.offsetWidth ?? window.innerWidth ?? 400;

  const cambiarPaso = useCallback(
    (destinoPaso: number, dir: "next" | "prev") => {
      if (busy) return;
      if (destinoPaso < 1 || destinoPaso > TOTAL_PASOS) return;
      if (destinoPaso === paso) return;

      const W = getWrapWidth();
      const outX = dir === "next" ? -W : W;

      setBusy(true);
      setSnapping(true);
      setDragX(outX);

      window.setTimeout(() => {
        setSnapping(false);
        setPaso(destinoPaso as Paso);
        setDragX(-outX);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setSnapping(true);
            setDragX(0);
          });
        });

        window.setTimeout(() => setBusy(false), ANIM_MS + 40);
      }, ANIM_MS);
    },
    [paso, busy]
  );

  const irAPaso = useCallback(
    (nuevo: number) => {
      if (enviando || enviado) return;
      if (nuevo === paso) return;
      cambiarPaso(nuevo, nuevo > paso ? "next" : "prev");
    },
    [paso, enviando, enviado, cambiarPaso]
  );

  const pasoSiguiente = useCallback(() => {
    if (paso < TOTAL_PASOS) cambiarPaso(paso + 1, "next");
  }, [paso, cambiarPaso]);

  const pasoAnterior = useCallback(() => {
    if (paso > 1) cambiarPaso(paso - 1, "prev");
  }, [paso, cambiarPaso]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (paso === 9 || enviando || busy) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    swipeActive.current = false;
    setSnapping(false);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current || busy) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;

    if (!swipeActive.current) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        touchStart.current = null;
        return;
      }
      if (Math.abs(dx) > 10) swipeActive.current = true;
      else return;
    }

    // Resistencia al arrastrar más allá del primer/último paso
    let adj = dx;
    if ((paso === 1 && dx > 0) || (paso === TOTAL_PASOS && dx < 0)) {
      adj = dx * 0.3;
    }
    setDragX(adj);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    const wasSwipe = swipeActive.current;
    touchStart.current = null;
    swipeActive.current = false;

    if (!wasSwipe || !start) {
      if (dragX !== 0) {
        setSnapping(true);
        setDragX(0);
      }
      return;
    }

    const dx = e.changedTouches[0].clientX - start.x;

    if (dx < -SWIPE_THRESHOLD && paso < TOTAL_PASOS) {
      cambiarPaso(paso + 1, "next");
      return;
    }
    if (dx > SWIPE_THRESHOLD && paso > 1) {
      cambiarPaso(paso - 1, "prev");
      return;
    }

    setSnapping(true);
    setDragX(0);
  };

  const removerOrigen = () => setOrigen(null);
  const removerDestino = () => setDestino(null);

  const seleccionarBusqueda = (
    r: SearchResult,
    tipo: "origen" | "destino"
  ) => {
    const punto: Punto = {
      lat: r.lat,
      lng: r.lng,
      direccion: r.direccion,
      cargandoDireccion: false,
    };
    if (tipo === "origen") setOrigen(punto);
    else setDestino(punto);
  };

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
    for (let s = 1; s <= TOTAL_PASOS; s++) {
      if (!isStepAnswered(s)) {
        alert(`Te falta completar la pregunta ${s}. Te llevo a ella.`);
        setPaso(s as Paso);
        return;
      }
    }

    if (!origen || !destino) return;

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
        try {
          const data = await response.json();
          if (data?.stats) setStatsFinales(data.stats as StatsFinales);
        } catch {
          // Si por alguna razón no llegan los stats, el front muestra fallback.
        }
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
    setStatsFinales(null);
    setPaso(1);
  };

  // Detección de Web Share API (solo cliente, evita SSR mismatch).
  useEffect(() => {
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function"
    );
  }, []);

  // Dato curioso al azar — congelado mientras dure la pantalla final.
  const datoCurioso = useMemo(() => {
    if (paso !== 9 || !statsFinales) return null;
    const opciones: string[] = [];
    if (statsFinales.gastoPromedio > 0) {
      opciones.push(
        `Según los datos recabados en la encuesta, el gasto promedio en transporte es de $${Math.round(
          statsFinales.gastoPromedio
        )} al día.`
      );
    }
    if (statsFinales.tiempoPromedioIda > 0) {
      opciones.push(
        `Según los datos recabados en la encuesta, el tiempo promedio de ida es de ${Math.round(
          statsFinales.tiempoPromedioIda
        )} minutos.`
      );
    }
    opciones.push(
      `Según los datos recabados en la encuesta, alrededor del ${statsFinales.porcentajeTransbordo.toFixed(
        1
      )}% de las personas que usan transporte público necesita transbordar.`
    );
    return opciones[Math.floor(Math.random() * opciones.length)];
    // Re-elige solo si cambia el envío (statsFinales pasa de null → objeto).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsFinales, paso === 9]);

  const compartirUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin || window.location.href;
  }, []);

  const compartirNativo = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.share) return;
    try {
      await navigator.share({
        title: SHARE_TITLE,
        text: SHARE_TEXT,
        url: compartirUrl,
      });
    } catch {
      // El usuario canceló o el navegador bloqueó — no hace falta avisar.
    }
  }, [compartirUrl]);

  const abrirEnlace = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const compartirWhatsapp = useCallback(() => {
    abrirEnlace(
      `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${compartirUrl}`)}`
    );
  }, [abrirEnlace, compartirUrl]);

  const compartirMessenger = useCallback(() => {
    // Mobile: deep link a la app de Messenger (si está instalada).
    // Desktop: fallback al diálogo de compartir de Facebook (Messenger Web
    // requiere App ID para el dialog/send; el sharer es el sustituto viable).
    const url = encodeURIComponent(compartirUrl);
    const ua =
      typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    if (isMobile) {
      window.location.href = `fb-messenger://share/?link=${url}`;
    } else {
      abrirEnlace(`https://www.facebook.com/sharer/sharer.php?u=${url}`);
    }
  }, [abrirEnlace, compartirUrl]);

  const compartirEmail = useCallback(() => {
    window.location.href = `mailto:?subject=${encodeURIComponent(
      SHARE_TITLE
    )}&body=${encodeURIComponent(`${SHARE_TEXT}\n${compartirUrl}`)}`;
  }, [compartirUrl]);

  const copiarEnlace = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(compartirUrl);
      setShareToast("¡Enlace copiado!");
    } catch {
      setShareToast("No se pudo copiar. Selecciona y copia manualmente.");
    }
    window.setTimeout(() => setShareToast(null), 2200);
  }, [compartirUrl]);

  const mapClickEnabled = paso === 1 || paso === 2;

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
        <span>Mapa de Movilidad Urbana &mdash; Puebla</span>
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
          {/* Indicador de pasos — clickable, estado según respuesta */}
          <div className="step-indicator" role="tablist" aria-label="Pasos de la encuesta">
            {Array.from({ length: TOTAL_PASOS }, (_, i) => i + 1).map((s) => {
              const answered = isStepAnswered(s);
              const isActive = paso === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Paso ${s}${answered ? " — contestado" : " — pendiente"}`}
                  className={`step-dot ${isActive ? "active" : ""} ${
                    answered ? "completed" : ""
                  }`}
                  onClick={() => irAPaso(s)}
                  disabled={paso === 9 || enviando}
                />
              );
            })}
          </div>

          <div
            className="step-content"
            ref={wrapRef}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{
              transform: `translateX(${dragX}px)`,
              transition: snapping ? `transform ${ANIM_MS}ms ease` : "none",
            }}
          >
            {/* PASO 1: Seleccionar origen */}
            {paso === 1 && (
              <>
                <h2 className="step-title">Paso 1: Punto de partida</h2>
                <p className="step-description">
                  Toca en el mapa o busca la dirección aproximada donde inicias
                  tus viajes más frecuentes.
                </p>

                {!origen ? (
                  <div className="instruction-box">
                    <p>
                      Toca en el mapa o escribe una dirección aproximada abajo
                    </p>
                  </div>
                ) : (
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
                )}

                <AddressSearch
                  placeholder={
                    origen
                      ? "Corregir dirección..."
                      : "Buscar dirección aproximada..."
                  }
                  onSelect={(r) => seleccionarBusqueda(r, "origen")}
                />
              </>
            )}

            {/* PASO 2: Seleccionar destino */}
            {paso === 2 && (
              <>
                <h2 className="step-title">Paso 2: Tu destino</h2>
                <p className="step-description">
                  Toca en el mapa o busca la dirección aproximada donde
                  terminan tus viajes más frecuentes.
                </p>

                {origen && (
                  <div className="point-info">
                    <div className="point-marker origin">A</div>
                    <div className="point-details">
                      <span className="point-label">Origen</span>
                      <span className="point-coords">
                        {origen.direccion?.displayName || "Ubicación marcada"}
                      </span>
                    </div>
                  </div>
                )}

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
                    <p>
                      Toca en el mapa o escribe una dirección aproximada abajo
                    </p>
                  </div>
                )}

                <AddressSearch
                  placeholder={
                    destino
                      ? "Corregir dirección..."
                      : "Buscar dirección aproximada..."
                  }
                  onSelect={(r) => seleccionarBusqueda(r, "destino")}
                />
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
              </>
            )}

            {/* PASO 9: Confirmación + dato curioso + compartir */}
            {paso === 9 && enviado && (
              <div className="success-message">
                <h2>¡Gracias por participar en la encuesta!</h2>
                <p>
                  Con estos datos podemos hacer estudios de movilidad para mejorar el transporte público de esta ciudad.
                </p>

                {datoCurioso && (
                  <div className="fact-card" aria-live="polite">
                    <span className="fact-label">¿Sabías que…?</span>
                    <p className="fact-text">{datoCurioso}</p>
                  </div>
                )}

                {!canNativeShare && (
                  <div className="share-section">
                    <p className="share-label">Comparte la encuesta</p>
                    <div className="share-grid" role="group" aria-label="Canales de compartir">
                      <button type="button" className="share-btn" onClick={compartirWhatsapp} aria-label="Compartir por WhatsApp">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="#25D366" d="M20.5 3.5A11 11 0 0 0 3.6 17.1L2 22l5-1.6a11 11 0 0 0 13.5-16.9zM12 20a8 8 0 0 1-4-1.1l-.3-.2-3 1 1-2.9-.2-.3A8 8 0 1 1 12 20zm4.5-5.6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.2-2.8c-.2-.4.3-.4.7-1.2.1-.2 0-.3 0-.5l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.1s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.7.6 2.3.7 3.1.6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .2-1.1-.1-.1-.3-.2-.5-.3z" />
                        </svg>
                        <span>WhatsApp</span>
                      </button>
                      <button type="button" className="share-btn" onClick={compartirMessenger} aria-label="Compartir por Messenger">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="#0084FF" d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.15.27.36.27.6l.06 1.97c.02.62.66 1.03 1.23.78l2.2-.97c.18-.08.39-.1.58-.05 1.04.29 2.15.44 3.31.44 5.64 0 10-4.13 10-9.7C22 6.13 17.64 2 12 2zm6 7.46-2.93 4.65c-.46.74-1.46.92-2.16.39l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.62l2.93-4.65c.47-.74 1.47-.92 2.17-.39l2.34 1.75c.21.16.51.16.72 0l3.16-2.4c.42-.32.97.18.68.62z" />
                        </svg>
                        <span>Messenger</span>
                      </button>
                      <button type="button" className="share-btn" onClick={compartirEmail} aria-label="Compartir por correo">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="#5f6368" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
                        </svg>
                        <span>Correo</span>
                      </button>
                      <button type="button" className="share-btn" onClick={copiarEnlace} aria-label="Copiar enlace">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#2d8f4e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <span>Copiar</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="action-row">
                  {canNativeShare && (
                    <button
                      type="button"
                      className="share-btn-native"
                      onClick={compartirNativo}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                      Compartir
                    </button>
                  )}
                  <button className="btn btn-primary" onClick={reiniciar}>
                    Registrar otro viaje
                  </button>
                </div>
              </div>
            )}

            {/* Footer de navegación: libre entre pasos 1-8 */}
            {paso !== 9 && (
              <div className="step-nav">
                <button
                  type="button"
                  className="btn btn-outline btn-back"
                  onClick={pasoAnterior}
                  disabled={paso === 1 || enviando}
                  aria-label="Pregunta anterior"
                >
                  ← Atrás
                </button>
                {paso < TOTAL_PASOS ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={pasoSiguiente}
                  >
                    Siguiente →
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={enviando}
                  >
                    {enviando ? "Enviando..." : "Enviar encuesta"}
                  </button>
                )}
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

      {shareToast && (
        <div className="share-toast" role="status" aria-live="polite">
          {shareToast}
        </div>
      )}
    </div>
  );
}
