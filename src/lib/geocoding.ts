// Reverse geocoding usando Nominatim (OpenStreetMap)
// Documentación: https://nominatim.org/release-docs/develop/api/Reverse/

export interface Direccion {
  calle?: string;
  numero?: string;
  colonia?: string;
  codigoPostal?: string;
  ciudad?: string;
  displayName: string; // Dirección completa formateada
}

interface NominatimResponse {
  display_name: string;
  address: {
    road?: string;
    house_number?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    postcode?: string;
    state?: string;
    country?: string;
  };
}

interface NominatimSearchItem extends NominatimResponse {
  lat: string;
  lon: string;
  place_id?: number;
}

export interface SearchResult {
  lat: number;
  lng: number;
  direccion: Direccion;
}

const PUEBLA_BBOX = "-98.5,19.5,-97.5,18.5";

const isWithinPuebla = (lat: number, lng: number): boolean =>
  lat >= 18.5 && lat <= 19.5 && lng >= -98.5 && lng <= -97.5;

export async function searchAddresses(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  try {
    const url =
      "https://nominatim.openstreetmap.org/search?" +
      `format=json&addressdetails=1&accept-language=es&limit=6&countrycodes=mx` +
      `&viewbox=${PUEBLA_BBOX}&bounded=1&q=${encodeURIComponent(q)}`;

    const response = await fetch(url, {
      headers: { "User-Agent": "MapaMovilidadPuebla/1.0" },
    });

    if (!response.ok) return [];

    const data: NominatimSearchItem[] = await response.json();

    return data
      .map((item) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        const displayName = formatDisplayName(item);
        return {
          lat,
          lng,
          direccion: {
            calle: item.address?.road,
            numero: item.address?.house_number,
            colonia: item.address?.neighbourhood || item.address?.suburb,
            codigoPostal: item.address?.postcode,
            ciudad:
              item.address?.city ||
              item.address?.town ||
              item.address?.village ||
              "Puebla",
            displayName,
          },
        };
      })
      .filter((r) => isWithinPuebla(r.lat, r.lng));
  } catch {
    return [];
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<Direccion | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=es`,
      {
        headers: {
          "User-Agent": "MapaMovilidadPuebla/1.0",
        },
      }
    );

    if (!response.ok) return null;

    const data: NominatimResponse = await response.json();

    if (!data.address) return null;

    const address = data.address;

    return {
      calle: address.road,
      numero: address.house_number,
      colonia: address.neighbourhood || address.suburb,
      codigoPostal: address.postcode,
      ciudad: address.city || address.town || address.village || "Puebla",
      displayName: formatDisplayName(data),
    };
  } catch {
    return null;
  }
}

function formatDisplayName(data: NominatimResponse): string {
  const { address } = data;
  const parts: string[] = [];

  // Calle y número
  if (address.road) {
    parts.push(address.house_number ? `${address.road} ${address.house_number}` : address.road);
  }

  // Colonia
  if (address.neighbourhood || address.suburb) {
    parts.push(address.neighbourhood || address.suburb || "");
  }

  // Código postal
  if (address.postcode) {
    parts.push(`C.P. ${address.postcode}`);
  }

  // Ciudad
  const ciudad = address.city || address.town || address.village;
  if (ciudad) {
    parts.push(ciudad);
  }

  // Si no hay partes específicas, usar el display_name completo de Nominatim
  // (quitando solo país y estado para no ser redundante)
  if (parts.length === 0) {
    return data.display_name.split(",").slice(0, 4).join(",").trim();
  }

  return parts.join(", ");
}
