# Paso 5 · Cifrado de datos clínicos

## 1. Variables de entorno necesarias
Define en Vercel y en las funciones Edge los siguientes valores:

- `ENCRYPTION_MASTER_KEY`: clave simétrica de 32 bytes codificada en base64.
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`: ya utilizados por las funciones existentes.

> Generá la clave maestra con `openssl rand -base64 32` y guardá el mismo valor en Vercel (Next.js) y en Supabase (`supabase secrets set`).

## 2. Migraciones
Ejecutá las migraciones para crear la tabla `professional_keys` y las políticas de RLS:

```bash
supabase db push
```

La tabla almacena la clave cifrada de cada profesional y actualiza automáticamente `updated_at` en cada rotación.

## 3. Despliegue de funciones Edge
Se incluyen tres funciones en `supabase/functions`:

- `encrypt-clinical-data`: cifra un payload usando la clave del profesional.
- `decrypt-clinical-data`: devuelve el payload en claro validando la versión de la clave.
- `rotate-professional-key`: genera una nueva clave maestra para el profesional.

### 3.1 Despliegue con la CLI

```bash
supabase functions deploy encrypt-clinical-data --no-verify-jwt
supabase functions deploy decrypt-clinical-data --no-verify-jwt
supabase functions deploy rotate-professional-key --no-verify-jwt
```

Cada función espera las variables `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `ENCRYPTION_MASTER_KEY` en el entorno del runtime.

### 3.2 Crearlas desde el dashboard (copiar & pegar)

1. Ingresá a **Supabase → Edge Functions → New Function** y escribí el nombre exacto (`encrypt-clinical-data`, `decrypt-clinical-data` o `rotate-professional-key`).
2. Elegí `Deno` como runtime y pegá el contenido del archivo correspondiente ubicado en este repositorio:
   - [`supabase/functions/encrypt-clinical-data/index.ts`](functions/encrypt-clinical-data/index.ts)
   - [`supabase/functions/decrypt-clinical-data/index.ts`](functions/decrypt-clinical-data/index.ts)
   - [`supabase/functions/rotate-professional-key/index.ts`](functions/rotate-professional-key/index.ts)
3. El dashboard **no permite crear carpetas** al pegar código, por lo que hay tres opciones para agregar las utilidades de cifrado:
   - **Opción ZIP (recomendada):** generá el paquete con `cd supabase/functions/<nombre>` y luego `zip -r ../<nombre>.zip index.ts _shared`. El ZIP debe contener `index.ts` y la carpeta `_shared` en la raíz. En el editor de Supabase abrí el menú `…` del árbol de archivos y elegí **Import .zip** (en algunas versiones aparece como botón **Upload**). Seleccioná el ZIP y el dashboard conservará la estructura de carpetas.
   - **Opción “archivo auxiliar” (sin carpetas):** creá un archivo nuevo en el editor de Supabase, por ejemplo `encryption-helper.ts`, pegá allí el contenido de [`supabase/functions/_shared/encryption.ts`](functions/_shared/encryption.ts) y, en `index.ts`, importalo con `import { decryptPayload, encryptPayload } from './encryption-helper.ts';`. Como ambos archivos viven en la raíz de la función, evitás crear directorios y mantenés el código compartido en un único lugar.
   - **Opción “copiar y pegar todo”:** si preferís no crear archivos adicionales, copiá el helper completo y pegalo al final de cada `index.ts` antes de desplegar. Las funciones quedarán más largas, pero es la alternativa más rápida cuando trabajás 100 % desde el dashboard.
   - Si tu proyecto está en el plan gratuito y la UI abre directamente un editor sin navegador de archivos, usá **Open in editor → Files → Import .zip** o alguna de las opciones anteriores. Si ninguna alternativa está disponible, desplegá la función con la CLI (`supabase functions deploy …`).
4. En la pestaña **Environment Variables** cargá `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `ENCRYPTION_MASTER_KEY` (los mismos valores que usa Next.js).
5. Guardá y presioná **Deploy** para publicar la función. Repetí el proceso para las tres funciones.

> Las funciones validan el encabezado `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` y sólo deben invocarse desde el backend seguro.

## 4. Automatización de rotación
Configura un cron en Supabase (o Vercel) que llame a `rotate-professional-key` por profesional cada 30 días. Ejemplo con Supabase Scheduler:

```bash
supabase functions schedule rotate-professional-key \
  --body '{"professionalId":"<uuid>"}' \
  --cron '0 3 1 * *'
```

En la respuesta recibirás la nueva versión para auditar el cambio. Recordá re-cifrar los datos sensibles con la nueva versión antes de expirar la clave anterior.

## 5. Uso desde Next.js
- El panel de configuración consulta `/api/professionals/encryption/key` para crear la clave maestra si no existe y mostrar la versión actual.
- Al rotar la clave desde la UI se invoca el mismo endpoint (`POST`) que actualiza la tabla y devuelve la nueva metadata.
- Para cifrar/descifrar datos sensibles utilizá `encryptSensitivePayload` y `decryptSensitivePayload` en `lib/db/supabase-repository.ts` o invocá las funciones Edge según tu flujo.

## 6. Runbook de emergencia
1. Pausá los jobs automáticos de rotación.
2. Restaurá la variable `ENCRYPTION_MASTER_KEY` desde el backup seguro.
3. Verificá que `ensureProfessionalEncryptionKey` devuelve la versión esperada.
4. Reprocesá los datos pendientes antes de reactivar los jobs.
