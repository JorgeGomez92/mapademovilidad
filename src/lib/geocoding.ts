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

  // Si no hay partes, usar el display_name
  if (parts.length === 0) {
    // Tomar solo las primeras 2 partes del display_name
    return data.display_name.split(",").slice(0, 2).join(",").trim();
  }

  return parts.join(", ");
}
