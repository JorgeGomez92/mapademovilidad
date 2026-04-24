// Fuente única de verdad para los medios de transporte.
// Importado por el form (MapaMovilidad), la validación (api/viajes) y los
// labels del dashboard (api/dashboard, api/export).

export const MEDIOS_TRANSPORTE = [
  { value: "linea1", label: "Línea 1 RUTA" },
  { value: "linea2", label: "Línea 2 RUTA" },
  { value: "linea3", label: "Línea 3 RUTA" },
  { value: "linea4", label: "Línea 4 RUTA" },
  { value: "alimentadora", label: "Alimentadora RUTA" },
  { value: "van", label: "Van / Combi" },
  { value: "camion", label: "Camión" },
  { value: "microbus", label: "Microbús" },
  { value: "automovil", label: "Automóvil" },
  { value: "bicicleta", label: "Bicicleta" },
  { value: "apie", label: "A pie" },
] as const;

// Valores aceptados por el backend. Incluye "historicos" para no invalidar
// registros ya guardados en la DB (el form actual no los produce).
export const MEDIOS_HISTORICOS = [
  { value: "colectivo", label: "Colectivo" },
  { value: "otro", label: "Otro" },
] as const;

export const MEDIOS_VALIDOS: readonly string[] = [
  ...MEDIOS_TRANSPORTE.map((m) => m.value),
  ...MEDIOS_HISTORICOS.map((m) => m.value),
];

export const MEDIOS_NOMBRES: Record<string, string> = Object.fromEntries(
  [...MEDIOS_TRANSPORTE, ...MEDIOS_HISTORICOS].map((m) => [m.value, m.label])
);
