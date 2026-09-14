# Bootcamp Taller 1 · API de resultados

Servicio para recibir respuestas de formularios [Tally](https://tally.so), procesarlas con la lógica del Taller 1 (corrección, emparejamiento, incidencias) y servir JSON por aula a la [app de conducción](https://github.com/Alenes1977/talleres-Bootcamp).

## Qué hace

```
Alumno → Tally → POST /webhook/tally → SQLite → GET /aulas/A07/resultados → App conducción
                         ↑                              ↑
                   firma HMAC                      mismo JSON que importResults.ts
```

- **Webhook**: cada envío de Tally se guarda de forma idempotente (`submissionId`).
- **Procesador**: portado de `procesar-resultados.gs` / `items.gs`.
- **API de lectura**: devuelve el contrato `schemaVersion: 1` que consume `ResultsPanel`.
- **Sync manual**: `POST /admin/sync` consulta Tally API si algún webhook falló.

## Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/health` | Estado del servicio |
| POST | `/webhook/tally` | Webhook de Tally (público, verificado por firma) |
| GET | `/aulas/:roomId/resultados` | JSON procesado (`A01`–`A12`) |
| GET | `/aulas` | Aulas con envíos registrados |
| POST | `/admin/sync` | Sincroniza desde Tally API (`Authorization: Bearer ADMIN_API_KEY`) |
| GET | `/admin/submissions` | Últimos envíos (admin) |

## Variables de entorno

Copia `.env.example` → `.env`:

```env
PORT=3000
DATABASE_PATH=/data/taller1.db
TALLY_WEBHOOK_SECRET=...
TALLY_API_KEY=...
TALLY_FORM_A_SIN=...
TALLY_FORM_A_CON=...
TALLY_FORM_B_SIN=...
TALLY_FORM_B_CON=...
ADMIN_API_KEY=...
CORS_ORIGIN=https://tu-dominio-app
```

Los IDs de formulario están en la URL de Tally: `https://tally.so/r/QKbjo1` → `QKbjo1`.

## Desarrollo local

```bash
npm install
cp .env.example .env
npm run dev
curl http://localhost:3000/health
```

```bash
npm test
npm run build
```

## Despliegue en Coolify (Hostinger VPS)

1. **GitHub**: conecta este repositorio en Coolify.
2. **Tipo**: Application → Dockerfile (puerto **3000**).
3. **Volumen persistente**: monta `/data` (SQLite en `DATABASE_PATH=/data/taller1.db`).
4. **Dominio**: p. ej. `taller1.alejandronestor.eu` con HTTPS.
5. **Variables**: las de `.env.example` en el panel de Coolify.
6. **Health check**: `GET /health`.

### Configurar Tally

En cada uno de los cuatro formularios, publicados:

1. **Integrations → Webhooks → Connect**
2. URL: `https://taller1.alejandronestor.eu/webhook/tally`
3. Activa **signing secret** y cópialo a `TALLY_WEBHOOK_SECRET`
4. Campos ocultos en la URL del QR: `?codigo=A07-T1-S2` (o `Código` si usas ese nombre)

Etiquetas de preguntas que deben coincidir con Google Forms / `items-comprobacion.md`:

- `Código` (o hidden `codigo`)
- `Sexo`
- `De las 6 preguntas que vas a responder a continuación, ¿cuántas crees que vas a acertar?`
- Títulos literales de los 6 ítems
- `Seguridad en la pregunta 1` … `6`
- `¿Cuál de estos se parece más a lo que hiciste de verdad?`

## Integración con la app de conducción

Hoy la app importa un `.json` manualmente. Para usar este servicio, añade en el panel del tutor un botón que haga:

```javascript
const res = await fetch('https://taller1.alejandronestor.eu/aulas/A07/resultados')
const json = await res.json()
// pasar a parseResults(JSON.stringify(json), 'A07')
```

El JSON es compatible con `src/results/importResults.ts` del repo `talleres-Bootcamp`.

## Seguridad

- Verifica firma `Tally-Signature` cuando `TALLY_WEBHOOK_SECRET` está configurado.
- Los endpoints `/admin/*` requieren `ADMIN_API_KEY`.
- El JSON exportado **no incluye correos** ni texto libre.
- SQLite persiste respuestas crudas en el VPS: protege el volumen `/data`.

## Licencia

Uso interno Bootcamp EurekAI.
