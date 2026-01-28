# Mapa de Movilidad Urbana - Puebla

Aplicación web para recolectar datos de movilidad urbana en la zona del Periférico Ecológico de Puebla.

## Características

- Mapa interactivo con Leaflet y OpenStreetMap
- Flujo guiado de 3 pasos:
  1. Selección de punto de partida
  2. Selección de destino (con opción de agregar transbordos)
  3. Formulario de gasto diario y motivo de viaje
- Backend con API REST y base de datos PostgreSQL
- Diseño responsivo (móvil y escritorio)

## Requisitos

- Node.js 18+
- PostgreSQL (local o servicio cloud)

## Instalación Local

### 1. Clonar e instalar dependencias

```bash
cd mapa-movilidad-puebla
npm install
```

### 2. Configurar la base de datos

Crea un archivo `.env` en la raíz del proyecto:

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/movilidad_puebla"
```

**Opciones gratuitas para PostgreSQL:**
- [Neon](https://neon.tech) - Recomendado, muy fácil
- [Supabase](https://supabase.com)
- [Railway](https://railway.app)

### 3. Inicializar la base de datos

```bash
npm run db:generate
npm run db:push
```

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

Abre http://localhost:3000

---

## Despliegue en Producción

### Opción 1: Vercel (Recomendado)

Vercel es la plataforma oficial de Next.js y es muy simple:

1. **Crear cuenta** en [vercel.com](https://vercel.com)

2. **Subir código a GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/TU_USUARIO/mapa-movilidad-puebla.git
   git push -u origin main
   ```

3. **Importar proyecto en Vercel**
   - Click en "New Project"
   - Conecta tu repositorio de GitHub
   - Vercel detectará automáticamente que es Next.js

4. **Configurar variables de entorno**
   - En Settings > Environment Variables
   - Agrega: `DATABASE_URL` con tu conexión a PostgreSQL

5. **Conectar tu dominio**
   - En Settings > Domains
   - Agrega tu dominio personalizado
   - Configura los DNS como indica Vercel

### Opción 2: Railway

Railway puede hospedar tanto la app como la base de datos:

1. Crear cuenta en [railway.app](https://railway.app)
2. New Project > Deploy from GitHub
3. Agregar PostgreSQL desde "Add Service"
4. Copiar DATABASE_URL a las variables de entorno
5. El dominio se asigna automáticamente (puedes agregar uno personalizado)

### Opción 3: Azure App Service

Si prefieres Azure como antes:

1. **Crear recursos**
   ```bash
   # Instalar Azure CLI
   az login

   # Crear grupo de recursos
   az group create --name rg-movilidad-puebla --location "Central US"

   # Crear App Service Plan
   az appservice plan create --name plan-movilidad \
     --resource-group rg-movilidad-puebla \
     --sku B1 --is-linux

   # Crear Web App
   az webapp create --name mapa-movilidad-puebla \
     --resource-group rg-movilidad-puebla \
     --plan plan-movilidad \
     --runtime "NODE:18-lts"
   ```

2. **Configurar base de datos**
   - Usar Azure Database for PostgreSQL o un servicio externo como Neon

3. **Configurar variables**
   ```bash
   az webapp config appsettings set \
     --resource-group rg-movilidad-puebla \
     --name mapa-movilidad-puebla \
     --settings DATABASE_URL="tu-connection-string"
   ```

4. **Desplegar**
   ```bash
   # Build
   npm run build

   # Comprimir
   zip -r deploy.zip .next package.json node_modules prisma

   # Subir
   az webapp deployment source config-zip \
     --resource-group rg-movilidad-puebla \
     --name mapa-movilidad-puebla \
     --src deploy.zip
   ```

5. **Agregar dominio**
   - Azure Portal > App Service > Custom domains
   - Agregar dominio y configurar DNS

---

## Configuración de DNS (para cualquier plataforma)

Para conectar tu dominio personalizado:

1. **En tu proveedor de dominio** (GoDaddy, Namecheap, etc.):

   | Tipo | Nombre | Valor |
   |------|--------|-------|
   | A | @ | IP del servidor |
   | CNAME | www | tu-app.vercel.app |

2. **Esperar propagación** (puede tomar hasta 48 horas)

---

## Estructura del Proyecto

```
├── prisma/
│   └── schema.prisma       # Modelo de base de datos
├── src/
│   ├── app/
│   │   ├── api/viajes/     # API REST
│   │   ├── globals.css     # Estilos
│   │   ├── layout.tsx      # Layout principal
│   │   └── page.tsx        # Página principal
│   ├── components/
│   │   └── MapaMovilidad.tsx  # Componente del mapa
│   └── lib/
│       └── prisma.ts       # Cliente de base de datos
├── .env.example            # Ejemplo de variables
└── package.json
```

## Comandos Útiles

```bash
npm run dev          # Desarrollo
npm run build        # Compilar para producción
npm run start        # Ejecutar build de producción
npm run db:studio    # Ver datos en Prisma Studio
```
