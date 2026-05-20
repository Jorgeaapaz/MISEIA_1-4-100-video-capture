<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Screen Capture App - Next.js

## Arquitectura

- **Stack:** Next.js (App Router), TypeScript, `@aws-sdk/client-s3`, driver nativo `mongodb`
- **Frontend:** componente cliente `'use client'` para acceso a APIs del navegador. La subida a S3 desde del cliente
- **Backend:** API Routes `/api/recordings` (persistencia en MongoDB)
- **Almacenamiento de video:** Rustfs corriendo en `http://localhost:10000/`, compatible con S3
- **Base de datos:** MongoDB en `localhost:27017`, base de datos `screen-capture`

## Funcionalidad

### Captura de pantalla
- Usar `navigator.mediaDevices.getDisplayMedia()` para capturar pantalla o ventana (el usuario elige en el diálogo del navegador)
- Botones: **Iniciar grabación** / **Detener grabación**
- Preview en vivo durante la grabación con `<video srcObject={stream} autoPlay />`
- Al detener, generar un `Blob` en formato `webm` con `MediaRecorder`

### Subida a Rustfs/S3
- `la subida a rustfs hacerlo desde el cliente recibe el video como `multipart/form-data`
- Configurar `S3Client` con `endpoint`, `forcePathStyle: true` y credenciales desde `.env.local`
- Nombre de archivo único: `${Date.now()}-${uuid}.webm`
- Subir al bucket configurado; devolver `s3Key` y `s3Url`
- El bucket de rustfs se llama recordings y se creara en caso de que no exista.
- Poder dar permisos para visualizar el video.

### Descripción y persistencia
- Campo de texto para asociar una descripción a la grabación (antes o después de grabar)
- `POST /api/recordings` guarda en MongoDB el documento:
  ```json
  { "description": "...", "s3Key": "...", "s3Url": "...", "createdAt": "..." }
  ```
- Devolver el `_id` insertado como confirmación

### Flujo UX
1. Usuario escribe descripción (opcional)
2. Pulsa **Iniciar** → elige pantalla/ventana en el diálogo del navegador
3. Graba → pulsa **Detener**
4. Se muestra preview del video grabado
5. Pulsa **Guardar** → sube a S3 y guarda metadata en MongoDB
6. Mensaje de confirmación con el ID del registro
7. El usuario debe poder ver las rabaciones

## Diseño

- Usar la skill `frontend-design` para crear una landing profesional y mejorar todas las páginas
- Interfaz limpia, dark mode, con estados visuales claros: idle / grabando / procesando / guardado

## Notas de Implementación
- Evita el error `ERR_CONTENT_LENGTH_MISMATCH 206`, implmentando la solucion del siguiente ejemplo:

`ERR_CONTENT_LENGTH_MISMATCH 206` al reproducir videos con presigned URLs directas a Rustfs. **Problema critico**: Rustfs no maneja correctamente las Range requests del `<video>` HTML5 cuando se usan presigned URLs directas. El browser solicita rangos de bytes (206 Partial Content) pero Rustfs devuelve un `Content-Length` inconsistente, rompiendo la reproduccion. **Solucion**: Se reemplazo el enfoque de presigned GET URLs por un **proxy server-side** en `/api/stream/[id]`. Ahora Next.js lee el video desde Rustfs via AWS SDK (`GetObjectCommand` con `Range` header) y reenvia el stream al browser con headers `Content-Range` y `Content-Length` correctos. El VideoPlayer usa `/api/stream/{id}` como `src` directamente y la cookie `token` autentica automaticamente. 

## Environment

Crear `.env.local` con:

```
 MONGODB_URI=mongodb://localhost:27017
 MONGODB_DB=screen-capture
 RUSTFS_ENDPOINT=http://localhost:10000
 RUSTFS_ACCESS_KEY=minioadmin
 RUSTFS_SECRET_KEY=minioadmin1234
 RUSTFS_BUCKET=recordings 
 ```