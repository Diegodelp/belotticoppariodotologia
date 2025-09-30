# Plan de cifrado para datos sensibles de pacientes y profesionales

## 1. Objetivos
- Proteger datos clínicos sensibles almacenados en Supabase (historia clínica, notas, datos de contacto privados, campos de salud) mediante cifrado de extremo a extremo administrado por el backend.
- Mantener la compatibilidad con el plan gratuito de Supabase, utilizando funciones Edge para el procesamiento criptográfico sin costos adicionales de Postgres Functions.
- Preservar el acceso temporal a imágenes y radiografías existentes (links firmados de 15 minutos) y extender la protección al resto de la información sensible.

## 2. Alcance de los datos a cifrar
- **Información del paciente**: antecedentes médicos, notas clínicas, historia odontológica, alergias, medicación, valores de ortodoncia, diagnósticos y presupuestos.
- **Información del profesional**: credenciales adicionales (número de matrícula, documentos de identidad almacenados), llaves API de integraciones (WhatsApp, Instagram), tokens OAuth cifrados.
- **Metadatos de archivos**: descripciones y observaciones asociadas a fotos y radiografías (no los binarios ya protegidos por URLs firmadas).

## 3. Diseño criptográfico
1. **Gestión de llaves**
   - Generar una clave maestra simétrica (AES-256-GCM) por profesional.
   - Almacenar la clave maestra cifrada con una clave del servidor (KMS propio gestionado por variable de entorno `ENCRYPTION_MASTER_KEY`).
   - Guardar la clave maestra cifrada en una tabla `professional_keys` con RLS restringida al profesional.
2. **Cifrado de datos**
   - Antes de persistir datos sensibles, el Edge Function desencripta la clave maestra del profesional, genera un IV aleatorio y aplica AES-256-GCM.
   - Se almacena `ciphertext`, `iv`, `auth_tag` y un `version` para futuras rotaciones.
   - Para lecturas, la función realiza el proceso inverso y devuelve los datos en claro solo al cliente autenticado.
3. **Rotación de llaves**
   - Añadir endpoint para rotar la clave maestra (genera nueva, re-cifra datos en background mediante job manual o script).

## 4. Estructura en Supabase
- **Tabla `professional_keys`**
  ```sql
  create table if not exists professional_keys (
    professional_id uuid primary key references professionals(id) on delete cascade,
    encrypted_key bytea not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
  ```
  - RLS: solo el profesional dueño puede `select`/`update`; service role con permisos totales.
- **Columnas cifradas**
  - Agregar columnas `*_encrypted` (tipo `jsonb` o `bytea`) a tablas `clinical_histories`, `budgets`, `patients` según corresponda.
  - Mantener campos no sensibles sin cifrar (nombre, email) para búsquedas.
- **Edge Function** `encrypt-clinical-data`
  - Entrada: `record_type`, `record_id`, `payload` sin cifrar.
  - Operaciones: recuperar clave maestra → cifrar payload → insertar/actualizar fila.
  - Salida: confirmación y datos mínimos (ids, timestamps).
- **Edge Function** `decrypt-clinical-data`
  - Entrada: `record_type`, `record_id`.
  - Operaciones: validar ownership → descifrar → devolver payload.
  - Cacheo en el cliente durante la sesión para reducir llamadas.

## 5. Flujo de implementación
1. **Infraestructura**
   - Crear variable `ENCRYPTION_MASTER_KEY` (32 bytes base64) en Vercel y Supabase Edge.
   - Desplegar funciones Edge en `/supabase/functions/encrypt-clinical-data` y `/supabase/functions/decrypt-clinical-data`.
2. **Migraciones**
   - Añadir tabla `professional_keys` y columnas cifradas.
   - Script de generación de claves maestras para profesionales existentes (runbook manual que llama Edge function).
3. **SDK y servicios**
   - Cliente Next.js invoca Edge function vía `fetch` firmado con JWT (usa `supabaseClient.functions.invoke`).
   - Actualizar servicios (`patient.service.ts`, `clinical-history.service.ts`, etc.) para usar Edge functions en vez de escribir directamente campos sensibles.
4. **UI/UX**
   - Transparente para el usuario final; mostrar indicadores cuando los datos están cifrados y si falla desencriptado.
   - Agregar controles para rotar llave y regenerar datos (solo rol profesional).
5. **Testing**
   - Unit tests de cifrado usando `crypto.subtle` (Edge) y `node:crypto` (local).
   - Pruebas e2e en staging: crear paciente, cargar historia, validar que en DB se guarda cifrado y que solo se ve desencriptado via UI.

## 6. Consideraciones del plan gratuito de Supabase
- Edge Functions incluidas sin costo en free tier (máx. 500k invocaciones/mes aprox.).
- Evitar triggers o funciones Postgres pesadas; mover lógica a Edge.
- Minimizar lecturas repetidas: cache en cliente y `swr`.
- Uso de Storage actual no cambia; solo se cifra metadatos.

## 7. Roadmap de adopción
1. Semana 1: migraciones + Edge functions básicas + generación de claves maestras.
2. Semana 2: integrar en flujos de pacientes/historia clínica y pruebas e2e.
3. Semana 3: rotación de llaves, documentación operativa, monitoreo de métricas.
4. Semana 4: automatizar la regeneración programada de la clave maestra por profesional (cron Edge function/Supabase scheduler) para evitar interacción manual y reducir riesgo de filtraciones.

## 8. Documentación y runbooks
- Guia de despliegue de Edge functions.
- Procedimiento de recuperación en caso de pérdida de `ENCRYPTION_MASTER_KEY` (requiere backup seguro).
- Checklist de rotación y auditoría semestral.

