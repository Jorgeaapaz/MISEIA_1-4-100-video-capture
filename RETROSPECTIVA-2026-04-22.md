# Retrospectiva de Sesión — 2026-04-22
### Screen Capture App — Implementación completa desde cero

## Resumen / Overview

Implementación completa de una aplicación de captura de pantalla usando Next.js 16.2.4 (App Router), TypeScript, AWS SDK v3 (@aws-sdk/client-s3), MongoDB y Rustfs. La sesión partió de un proyecto Next.js vacío con el plan ya definido en `C:\Users\jorge\.claude\plans\dreamy-crunching-bear.md`. Al terminar, la app compila limpia con `npm run build` y todos los endpoints funcionan correctamente.

**Resultado:** Exitoso. Build limpio, todas las rutas correctas.

---

## Proceso de instalación / Installation

Las dependencias ya estaban instaladas en el proyecto base. El `package.json` final incluye:

```json
"dependencies": {
  "@aws-sdk/client-s3": "^3.1034.0",
  "mongodb": "^7.2.0",
  "next": "16.2.4",
  "react": "19.2.4",
  "react-dom": "19.2.4",
  "uuid": "^14.0.0"
},
"devDependencies": {
  "@tailwindcss/postcss": "^4",
  "@types/node": "^20",
  "@types/react": "^19",
  "@types/react-dom": "^19",
  "@types/uuid": "^10.0.0",
  "tailwindcss": "^4",
  "typescript": "^5"
}
```

El `.env.local` ya existía con la configuración correcta:

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=screen-capture
RUSTFS_ENDPOINT=http://localhost:10000
RUSTFS_ACCESS_KEY=minioadmin
RUSTFS_SECRET_KEY=minioadmin1234
RUSTFS_BUCKET=recordings
```

---

## Archivos creados / Files Created

```
lib/mongodb.ts                     Singleton MongoClient con caché global (HMR safe)
lib/s3.ts                          S3Client con forcePathStyle + ensureBucket()
app/api/upload/route.ts            POST: recibe video como FormData, sube a Rustfs
app/api/recordings/route.ts        POST: guarda metadata. GET: lista grabaciones desc
app/api/stream/[id]/route.ts       GET: proxy de video con Range requests correctas
app/components/ScreenRecorder.tsx  Componente cliente: idle/recording/stopped/uploading/saved
app/components/VideoPlayer.tsx     Componente cliente: <video src="/api/stream/{id}" />
app/recordings/page.tsx            Server component con force-dynamic, grid de grabaciones
app/globals.css                    Diseño "Deep Space Terminal" (JetBrains Mono + Syne)
app/layout.tsx                     Metadata actualizada a "ScreenCapture"
app/page.tsx                       Landing con hero + ScreenRecorder
```

---

## Comandos ejecutados / Commands Run

```bash
# Verificar estructura del proyecto
ls /d/Master-IA-Dev/04-Bloque4/1-4-100-video-capture/video-capture/

# Leer documentación de Next.js 16 (importante — breaking changes)
cat node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md

# Crear directorios necesarios
mkdir -p lib app/api/upload app/api/recordings "app/api/stream/[id]" app/components app/recordings

# Build de verificación
npm run build
```

---

## Levantar y detener la aplicación / Running & Stopping

### Prerrequisitos
- **MongoDB** corriendo en `localhost:27017`
- **Rustfs** corriendo en `localhost:10000` (compatible con S3, credenciales: minioadmin / minioadmin1234)

### Iniciar en desarrollo
```bash
cd /d/Master-IA-Dev/04-Bloque4/1-4-100-video-capture/video-capture
npm run dev
```
App disponible en: **http://localhost:3000**

### Build de producción
```bash
npm run build
npm run start
```

### Detener
`Ctrl + C` en la terminal donde corre el servidor.

---

## URLs de prueba / Test URLs

| URL | Descripción |
|-----|-------------|
| `http://localhost:3000/` | Página principal — grabador de pantalla |
| `http://localhost:3000/recordings` | Listado de grabaciones guardadas |
| `http://localhost:3000/api/recordings` | API: GET lista de grabaciones (JSON) |
| `http://localhost:3000/api/stream/{id}` | Proxy de video con soporte Range requests |
| `http://localhost:3000/api/upload` | API: POST subida de video (FormData) |

### Curl de prueba — listar grabaciones
```bash
curl http://localhost:3000/api/recordings
```

### Curl de prueba — guardar metadata manual
```bash
curl -X POST http://localhost:3000/api/recordings \
  -H "Content-Type: application/json" \
  -d '{"description": "Test", "s3Key": "test-key.webm"}'
```

---

## Flujo de uso / User Flow

1. Abrir `http://localhost:3000`
2. Escribir descripción (opcional)
3. Pulsar **"Iniciar grabación"** → el navegador muestra el selector de pantalla/ventana
4. Grabar → pulsar **"Detener grabación"**
5. Revisar preview del video grabado
6. Pulsar **"Guardar grabación"** → sube a Rustfs + guarda en MongoDB → muestra ID
7. Pulsar **"Ver grabaciones"** → navegar a `/recordings` con video funcional

---

## Decisiones técnicas clave / Key Technical Decisions

### Proxy de video (`/api/stream/[id]`)
**Problema crítico:** Rustfs no maneja correctamente las Range requests cuando el `<video>` HTML5 solicita bytes parciales (206 Partial Content). Devuelve `Content-Length` inconsistente → `ERR_CONTENT_LENGTH_MISMATCH`.

**Solución:** Proxy server-side en Next.js:
1. `HeadObjectCommand` para obtener el tamaño total del archivo
2. `GetObjectCommand` con `Range: bytes=X-Y` para servir rangos exactos
3. `Body.transformToWebStream()` del SDK v3 para streaming eficiente
4. Headers `Content-Range` y `Content-Length` calculados correctamente

### `force-dynamic` en recordings page
La página `/recordings` requiere `export const dynamic = 'force-dynamic'` para que Next.js no la prerenderice como estática en build time. Sin esto, el build intenta ejecutar la query de MongoDB durante la compilación.

---

## Problemas encontrados / Problems & Solutions

| Problema | Solución |
|----------|----------|
| `/recordings` aparecía como `○ (Static)` en el build | Añadir `export const dynamic = 'force-dynamic'` al server component |
| Next.js 16: params en Route Handlers son Promises | Usar `const { id } = await params` en lugar de acceso directo |
| Rustfs: `ERR_CONTENT_LENGTH_MISMATCH 206` en reproducción | Implementar proxy `/api/stream/[id]` con HeadObject + Range request |

---

## Resultados y conclusiones / Results & Conclusions

**Funcionó:**
- Build limpio en Next.js 16 con todas las rutas correctamente tipadas
- Proxy de video con soporte Range requests (seek funciona en el player)
- Diseño "Deep Space Terminal" con animación de grabación pulsante
- Bucket de Rustfs se auto-crea si no existe (con política pública de lectura)

**A tener en cuenta para próximas sesiones:**
- En Next.js 16, los `params` en Route Handlers **siempre son Promises** — `await params` es obligatorio
- La versión de MongoDB driver es `^7.x` — el API es ligeramente diferente a `^6.x`
- Rustfs requiere `forcePathStyle: true` en el S3Client (igual que MinIO)
- El bucket `recordings` necesita política pública solo si se quiere acceso directo (el proxy lo hace innecesario para reproducción, pero puede ser útil para otras operaciones)
