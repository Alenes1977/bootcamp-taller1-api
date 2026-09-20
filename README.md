# Bootcamp · API de resultados

Servicio para recibir respuestas de formularios [Tally](https://tally.so), corregirlas y servir
un JSON por aula a la [app de conducción](https://github.com/Alenes1977/talleres-Bootcamp).
Atiende a **dos talleres**: el 1, que empareja las dos pruebas de cada estudiante, y el 3, que
puntúa los veredictos de cada equipo contra el solucionario.

El nombre del repositorio, el del dominio y el del archivo SQLite vienen del Taller 1, que fue el
primero. No se han cambiado para no romper lo que ya está desplegado y consumido.

## Qué hace

```
Alumno → Tally ─┬─ POST /webhook/tally → SQLite ─┬─ GET /aulas/2/resultados          → Taller 1
                │         ↑                      │
                │   firma HMAC                   └─ GET /aulas/2/taller3/resultados  → Taller 3
                │                                     (veredictos + puntuación)
```

- **Webhook**: uno solo para todos los formularios. El `formId` del envío dice a qué taller
  pertenece; cada envío se guarda de forma idempotente (`submissionId`) con su columna `workshop`.
- **Procesador del Taller 1**: portado de `procesar-resultados.gs` / `items.gs`. Empareja por
  correo, corrige los seis ítems y cuenta incidencias.
- **Procesador del Taller 3**: agrupa por aula y equipo, traduce las cuatro opciones a su letra y
  puntúa contra el solucionario (`src/taller3/solucionario.ts`). La clave vive aquí y no en el
  navegador, que es lo que permite proyectar la matriz sin revelar quién acertó.
- **API de lectura**: devuelve el contrato `schemaVersion: 1` que consumen las vistas de cierre.
- **Sync manual**: `POST /admin/sync` recorre todos los formularios de los dos talleres si algún
  webhook falló.

## Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/health` | Estado del servicio y cuántos formularios tiene configurado cada taller |
| POST | `/webhook/tally` | Webhook de Tally (público, verificado por firma) |
| GET | `/aulas/:roomId/resultados` | Taller 1 · JSON procesado. Aulas `2, 4, 5, 6, 8, 9, 101, 102, 108, 109` |
| GET | `/aulas/:roomId/taller3/resultados` | Taller 3 · veredictos por equipo y clasificación |
| GET | `/aulas` | Aulas con envíos registrados, separadas por taller |
| POST | `/admin/sync` | Sincroniza desde Tally API (`Authorization: Bearer ADMIN_API_KEY`) |
| DELETE | `/admin/submissions/:submissionId` | Borra un envío suelto (admin) |
| GET | `/admin/taller3/diagnostico` | Qué entendió el servicio de los últimos envíos del Taller 3 (admin) |
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
TALLY_FORM_T3_VEREDICTOS=yPO7qx
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
4. Campos ocultos en la URL del QR: `?codigo=2-T1-S2` (o `Código` si usas ese nombre)

El formulario de veredictos del Taller 3 se conecta al **mismo webhook**, con el mismo secreto.
Su campo oculto es `codigo=2-T3-EQ`.

Etiquetas de preguntas que deben coincidir con Google Forms / `items-comprobacion.md`:

- `Código` (o hidden `codigo`)
- `Sexo`
- `De las 6 preguntas que vas a responder a continuación, ¿cuántas crees que vas a acertar?`
- Títulos literales de los 6 ítems
- `¿Cómo de seguro/a estás con tu respuesta anterior? (1/6)` … `(6/6)` (acepta también `Seguridad en la pregunta 1` … `6`)
- `¿Cuál de estos se parece más a lo que hiciste de verdad?`

## Taller 3 · contrato de lectura

`GET /aulas/2/taller3/resultados` devuelve:

```json
{
  "schemaVersion": 1,
  "workshop": "taller3",
  "roomId": "2",
  "generatedAt": "2026-10-16T11:07:00.000Z",
  "equipos": [{ "equipo": 1, "veredictos": ["c", "a", null, "..."], "enviadoAt": "..." }],
  "puntuacion": [{ "equipo": 1, "puntos": 12, "detectados": 6, "acusacionesFalsas": 1,
                   "avalesFalsos": 0, "sinVerificar": 2, "respondidos": 20 }],
  "entregados": 7,
  "responses": 8,
  "quality": { "sinEquipo": 0, "duplicados": 1, "incompletos": 0 }
}
```

`equipos` va en orden de mesa y `puntuacion` en orden de clasificación, ya con el desempate
aplicado: a igualdad de puntos, primero quien haya acusado en falso menos veces.

Tres decisiones del procesador que conviene conocer:

- **Un equipo que envía dos veces conserva el último envío** y suma uno a `duplicados`.
  Descartarlo abriría un hueco en la matriz proyectada, y el debate no arranca sin la tabla
  completa. El tutor ve el recuento y puede preguntar al equipo cuál vale.
- **Una entrega incompleta entra igual**, con `null` en los fragmentos que falten, y suma uno a
  `incompletos`. La matriz pinta el hueco.
- **La letra del veredicto se deduce del nombre** que lleva la opción: «falso o engañoso»,
  «sospechoso», «verdadero o respaldado», «no verificado». Tally no manda letras, manda el texto
  de la opción elegida, y en el formulario las cuatro van sin prefijo: la a, la b, la c y la d son
  el orden en que están puestas. La comparación ignora acentos, mayúsculas y espacios de más, y
  acepta también un prefijo `a · …` por si algún día se escribe.

  No se usa la posición de la opción, aunque el orden sea el significado, por dos razones: la vía
  de recuperación por API de Tally devuelve el texto sin la lista de opciones, así que la posición
  no siempre está; y si alguien reordenase las opciones creyendo que es cosmético, todos los
  veredictos se invertirían en silencio. Con el nombre, reordenar es inofensivo y reescribir se
  ve: el fragmento queda en blanco en la matriz.

  Para comprobarlo con una respuesta de prueba está `GET /admin/taller3/diagnostico`, que enseña
  qué entendió el servicio de cada envío y lista en `sinMapear` los textos que no supo traducir.

## Integración con la app de conducción

Hoy la app importa un `.json` manualmente. Para usar este servicio, añade en el panel del tutor un botón que haga:

```javascript
const res = await fetch('https://taller1.alejandronestor.eu/aulas/A07/resultados')
const json = await res.json()
// pasar a parseResults(JSON.stringify(json), 'A07')
```

El JSON es compatible con `src/results/importResults.ts` del repo `talleres-Bootcamp`.

## Los envíos de prueba no se borran solos

**Borrar una respuesta en Tally no borra lo que el webhook ya entregó.** El envío está en esta
base de datos desde el momento en que Tally lo mandó, y lo que se haga después en Tally no llega
aquí. Sin nada que lo impida, cada prueba de los días previos aparece el día del taller como un
participante más del Taller 1 o como un equipo más del Taller 3, con su puntuación, mezclada con
las de verdad.

Lo que lo impide es **`RESULTADOS_DESDE`**: una fecha ISO a partir de la cual cuentan los envíos.
Se pone la hora de la primera mañana del bootcamp, en UTC, y lo anterior deja de contar en las dos
rutas de lectura. No borra nada: los envíos de prueba siguen en la base para diagnosticar, y
quitar la variable los devuelve.

```env
RESULTADOS_DESDE=2026-10-15T06:00:00Z
```

Se comprueba sin credenciales:

```bash
curl -s https://taller1.alejandronestor.eu/health
# {"status":"healthy", …, "resultadosDesde":"2026-10-15T06:00:00.000Z"}
```

Si ahí sale `null` la mañana del taller, las pruebas están contando. Es lo primero que hay que
mirar al empezar el día.

Para un envío suelto que llegó mal —y no para limpiar las pruebas, que es trabajo de la fecha de
corte— está el bisturí:

```bash
curl -X DELETE -H "Authorization: Bearer $ADMIN_API_KEY"   https://taller1.alejandronestor.eu/admin/submissions/EL_SUBMISSION_ID
```

El `submissionId` sale de `GET /admin/submissions`.

## Cuando un envío no aparece

Por orden, y sin credenciales las dos primeras:

1. `GET /health` devuelve `formularios: { taller1: 4, taller3: 1 }`. Si el taller que falla marca
   **0**, su variable de entorno no llegó al despliegue y el webhook está contestando 202 sin
   guardar nada. Es la causa más frecuente.
2. En Tally, el formulario → **Integrations → Webhooks**, registro de entregas. Lo que diga ahí:
   - **202** con `reason: formId no configurado` — el cuerpo de la respuesta trae el `formId` que
     mandó Tally. Compáralo con el de la variable de entorno; si no coinciden, ese es el fallo.
   - **401** — el secreto de firma de ese formulario no es el que tiene el servicio.
   - **sin entregas** — el webhook no está activo en ese formulario, o el envío es anterior a
     conectarlo.
3. `GET /admin/submissions` enseña los últimos envíos guardados, con su taller. Si el envío está
   ahí pero con el taller equivocado, el `formId` está asignado al formulario que no es.
4. `GET /admin/taller3/diagnostico` enseña, envío a envío, qué entendió el procesador del Taller 3:
   el código, el equipo, los veinte veredictos y, en `sinMapear`, lo que no supo traducir.

## Seguridad

- Verifica firma `Tally-Signature` cuando `TALLY_WEBHOOK_SECRET` está configurado.
- Los endpoints `/admin/*` requieren `ADMIN_API_KEY`.
- El JSON exportado **no incluye correos** ni texto libre.
- SQLite persiste respuestas crudas en el VPS: protege el volumen `/data`.

## Licencia

Uso interno Bootcamp EurekAI.
