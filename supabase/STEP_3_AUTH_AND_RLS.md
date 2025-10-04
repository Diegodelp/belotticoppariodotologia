# Paso 3: Autenticación, seguridad y preparación de Supabase

Este paso asume que ya ejecutaste las migraciones del Paso 1 (esquema relacional) y que configuraste el servicio de correo/SMTP del Paso 2. A continuación te detallo qué hacer para que Supabase quede listo para reemplazar al backend en memoria.

## 3.1. Aplicar migraciones y verificar el esquema
1. Abre una terminal donde tengas la CLI de Supabase y ejecuta `supabase login` si todavía no lo hiciste.
2. Sitúate en la carpeta `supabase/` del proyecto y corre `supabase db push`. Esto aplicará las migraciones `0001_create_core_schema.sql` y `0002_configure_two_factor_defaults.sql` sobre tu proyecto en la nube.
3. En el dashboard de Supabase (sección **Table Editor**) comprobá que existan las tablas y enums creados en el Paso 1 (professionals, patients, patient_plans, treatments, payments, clinical_histories, cephalometric_records, media_assets, appointments, invoices, two_factor_codes, etc.).
4. Si necesitas ejecutar las migraciones manualmente por SQL, podés copiar el contenido de cada archivo y pegarlo en el editor SQL de Supabase.

## 3.2. Activar y reforzar Row Level Security (RLS)
Supabase activa RLS por defecto en las tablas nuevas. Ahora definí las políticas:

1. Para cada tabla que deba ser accesible por el profesional autenticado (`professionals`, `patients`, `plans`, `appointments`, etc.), crea una política "SELECT" que compare `auth.uid()` con la columna `professional_id` o `user_id` correspondiente. Ejemplo básico:
   ```sql
   create policy "Profesional puede ver sus pacientes" on public.patients
     for select using (professional_id = auth.uid());
   ```
2. Agregá políticas `INSERT`, `UPDATE` y `DELETE` según corresponda. Por ejemplo, permitir que el profesional cree pacientes:
   ```sql
   create policy "Profesional crea pacientes" on public.patients
     for insert with check (professional_id = auth.uid());
   ```
3. Para tablas compartidas (ej. `media_assets`, `clinical_histories`) replicá la lógica asegurando que el `professional_id` asociado coincida con `auth.uid()` o que el paciente pertenezca al profesional.
4. Las tablas que solo usa el backend con la service role key (por ejemplo `two_factor_codes`) pueden mantener RLS estricta; las llamadas desde el backend usarán el Service Role y no necesitan políticas más amplias.
5. Documentá cualquier excepción (como acceso del paciente a su portal) para añadir políticas específicas más adelante.

> ✅ **Chequeo**: desde el SQL Editor corré `alter table public.patients force row level security;` para garantizar que nadie pueda saltarse RLS.

## 3.3. Configurar Storage y políticas de acceso
Ya tenés un bucket con subcarpetas por UID (radiografías, fotos, HC). Para integrarlo con Supabase Auth:

1. En **Storage → Policies**, crea una política que permita leer los archivos del profesional autenticado y sus pacientes. Ejemplo para el bucket `clinical-media`:
   ```sql
   create policy "Profesional ve sus archivos" on storage.objects
     for select using (
       bucket_id = 'clinical-media'
       and (auth.uid() = owner)
     );
   ```
   Ajusta el `owner` según cómo subas los archivos (puede ser `metadata->>'professional_id'`).
2. Define una política `INSERT`/`UPDATE` que verifique que el `professional_id` en los metadatos coincide con `auth.uid()`.
3. Si los pacientes deben subir material, crea políticas adicionales que comparen su `patient_id` con el de la sesión.
4. Anota qué metadatos vas a enviar al subir archivos para poder filtrar por vigencia (ej. `metadata->>'valid_until'`).

## 3.4. Preparar claves y variables de entorno
1. Desde Supabase → **Project Settings → API**, copia los valores:
   * `Project URL`
   * `anon public key`
   * `service_role key`
2. En tu proyecto Next.js (Vercel u otra plataforma) crea las variables de entorno:
   * `NEXT_PUBLIC_SUPABASE_URL`
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   * `SUPABASE_SERVICE_ROLE_KEY`
   * `SUPABASE_JWT_SECRET` (lo encuentras en **Authentication → Settings → JWT secret**)
3. Guarda también las variables SMTP del Paso 2 (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME`).
4. Si vas a usar Google OAuth, añade `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (configurados en **Authentication → Providers → Google**).

> ℹ️ **Importante**: No compartas el Service Role ni el JWT Secret en el frontend ni en repositorios públicos.

## 3.5. Checklist antes de pasar al Paso 4
- [ ] Migraciones aplicadas en Supabase y verificación de tablas.
- [ ] Políticas RLS mínimas creadas para profesionales y pacientes.
- [ ] Políticas de Storage alineadas con tus buckets y metadatos.
- [ ] Variables de entorno configuradas tanto localmente como en Vercel.
- [ ] Proveedor Google habilitado si vas a ofrecer login con Google.

Cuando termines esta preparación, avísame y seguimos con el **Paso 4**, donde conectaremos la app de Next.js a Supabase (repositorio, hooks, endpoints) reemplazando el store en memoria.

# Pasos siguientes (vista general)
- **Paso 4** – Integrar Supabase en Next.js: configurar clientes (`@supabase/supabase-js`), reescribir los endpoints de `/app/api/**` y el hook de autenticación para usar Supabase Auth + OTP.
- **Paso 5** – Migrar datos desde Firestore: exportar colecciones, transformarlas al esquema nuevo e importarlas con scripts `supabase-js` o CSV.
- **Paso 6** – Integración con Gmail/Calendar: configurar OAuth individual por profesional, almacenar tokens y crear eventos reales al registrar turnos.
- **Paso 7** – QA y despliegue: pruebas unitarias/e2e, revisión de políticas, monitoreo y plan de rollback.

Te avisaré en cada paso si necesitás preparar información o credenciales adicionales.
