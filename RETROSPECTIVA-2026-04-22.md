# Retrospectiva de Sesión — 2026-04-22
### Screen Capture App — Implementación completa desde cero

## Resumen / Overview

Implementación completa de una aplicación de captura de pantalla usando Next.js 16.2.4 (App Router), TypeScript, AWS SDK v3 (@aws-sdk/client-s3), MongoDB y Rustfs. La sesión partió de un proyecto Next.js vacío. Al terminar, la app compila limpia con `npm run build` y todos los endpoints funcionan correctamente.

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
| `http://localhost:10000` | RustFS (Running in Local PC Docker)|
| `http://localhost:10001` | RustFS Console (Running in Local PC Docker)|
| `http://localhost:27017` | MongoDB (Running in Local PC)|

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
| `failed to pipe response` / `ERR_EMPTY_RESPONSE` al abrir `/recordings` | Ver sección de debugging post-sesión más abajo |

---

## Debugging post-sesión — ECONNRESET en `/api/stream/[id]` (2026-05-31)

### Síntoma
Al abrir `http://localhost:3000/recordings` el servidor lanzaba inmediatamente:
```
⨯ Error: failed to pipe response  [cause]: Error: aborted  code: 'ECONNRESET'
```
Y el navegador reportaba `ERR_EMPTY_RESPONSE` en la consola. El video no cargaba.

### Diagnóstico — tres causas raíz

**Causa 1 — `transformToWebStream()` en el path sin Range header**

El proxy original usaba `GetObjectCommand` + `body.transformToWebStream()` para el stream completo (petición sin `Range` header). El navegador siempre hace una petición inicial sin `Range` como sonda. RustFS cerraba la conexión TCP a mitad del stream, Next.js intentaba hacer pipe de un stream ya roto y lanzaba `failed to pipe response` antes de enviar ningún header al navegador → `ERR_EMPTY_RESPONSE`.

**Causa 2 — Bug interno de RustFS con Range requests**

RustFS tiene un bug por fichero: los Range requests donde `start >= un boundary interno` devuelven HTTP 206 con `Content-Length` correcto pero cierran el body antes de enviar datos. Con `fetch()` (undici) esto se manifiesta como excepción `terminated` al leer `resp.arrayBuffer()`. El boundary **no es fijo** — varía por fichero (confirmado: 1.5 MB para un webm de 3.5 MB, 1 MB para otros ficheros).

Comportamiento confirmado con curl y presigned URLs:
```
bytes=0-524287        → 206, 524288 bytes  ✓
bytes=524288-1048575  → 206, 524288 bytes  ✓
bytes=1048576-1572863 → 206, 524288 bytes  ✓
bytes=1572864-2097151 → 206, Content-Length: 524288, body: 0 bytes  ✗  (boundary)
```

**Causa 3 — `keepAlive: true` en el S3Client**

RustFS cierra el socket TCP tras cada respuesta pero no envía `Connection: close`. El AWS SDK reutilizaba el socket cerrado para la siguiente petición → ECONNRESET en operaciones como `HeadObjectCommand`. Documentado en el proyecto hermano `upload-videos`.

### Proceso de diagnóstico

1. Se verificó que el error ocurría en la petición sin `Range` (sonda inicial del `<video>`), no solo en rangos altos.
2. Se descartó problema de lógica en el código con un script Node.js que replicó la lógica exacta del route y pasó todos los tests.
3. Se confirmó que el hot-reload de Next.js dev **no estaba aplicando los cambios** al route — los tests seguían mostrando el boundary exacto del bug de RustFS aunque el archivo en disco era correcto. **Solución:** reinicio del servidor.
4. Se consultó la implementación funcionando del proyecto `1-4-90-upload-videos` que había resuelto el mismo problema.

### Solución implementada

**`lib/s3.ts`** — S3Client con `keepAlive: false`:
```typescript
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { Agent as HttpAgent } from 'http'

export const s3 = new S3Client({
  // ...
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  requestHandler: new NodeHttpHandler({
    httpAgent: new HttpAgent({ keepAlive: false }),
    httpsAgent: new HttpsAgent({ keepAlive: false }),
  }),
})
```

**`app/api/stream/[id]/route.ts`** — Estrategia de caché con detección dinámica de boundary:
1. Se genera una presigned URL una vez por request.
2. Se intenta un range fetch normal (`fetch(presignedUrl, { headers: { Range } })`).
3. Si lanza `terminated` o devuelve body vacío → se descarga el fichero completo con la **misma** presigned URL (sin `Range` — siempre funciona) y se guarda en un `Map<string, Uint8Array>` a nivel de módulo.
4. Todos los chunks posteriores se sirven con `.subarray()` desde caché — cero peticiones extra a RustFS.
5. Siempre devuelve HTTP 206 (incluyendo la sonda inicial sin `Range`, tratada como `start=0`).
6. La respuesta usa `Uint8Array` directamente como `BodyInit` (no `Buffer.from()`) para evitar incompatibilidades con el pipe de Next.js.

### Tests de validación (tras reinicio del servidor)

| Test | Recording 1 (3.5 MB) | Recording 2 (403 KB) |
|------|----------------------|----------------------|
| plain GET | ✓ 200, 3,533,129 B | ✓ 200, 403,222 B |
| bytes=0-524287 | ✓ 206, 524,288 B | ✓ 206, 403,222 B |
| bytes=524288-1048575 | ✓ 206, 524,288 B | — |
| bytes=1048576-1572863 | ✓ 206, 524,288 B | — |
| bytes=1572864-2097151 *(era boundary)* | ✓ 206, 524,288 B | — |
| bytes=2097152-2621439 | ✓ 206, 524,288 B | — |
| bytes=3000000-end | ✓ 206, 524,288 B | — |
| seek bytes=1000000- | ✓ 206, 524,288 B | ✓ 206, 303,222 B |
| bytes=200000-403221 | — | ✓ 206, 203,222 B |

12/12 tests pasados.

---

## Resultados y conclusiones / Results & Conclusions

**Funcionó:**
- Build limpio en Next.js 16 con todas las rutas correctamente tipadas
- Proxy de video con soporte Range requests (seek funciona en el player)
- Diseño "Deep Space Terminal" con animación de grabación pulsante
- Bucket de Rustfs se auto-crea si no existe (con política pública de lectura)
- Streaming de video robusto contra el bug de boundary de RustFS

**A tener en cuenta para próximas sesiones:**
- En Next.js 16, los `params` en Route Handlers **siempre son Promises** — `await params` es obligatorio
- La versión de MongoDB driver es `^7.x` — el API es ligeramente diferente a `^6.x`
- Rustfs requiere `forcePathStyle: true` en el S3Client (igual que MinIO)
- **RustFS + AWS SDK:** usar siempre `keepAlive: false` en el `NodeHttpHandler` — RustFS cierra sockets sin avisar
- **RustFS + Range requests:** el boundary interno varía por fichero; usar detección dinámica con fallback a descarga completa y caché en memoria
- **Next.js dev hot-reload:** los cambios en API routes a veces no se aplican sin reiniciar el servidor (`Ctrl+C` + `npm run dev`)
- **`transformToWebStream()`:** evitar para respuestas donde RustFS puede cerrar el stream — mejor buffering completo en memoria para ficheros pequeños/medianos
