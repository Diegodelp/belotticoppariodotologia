# Paso 4 · Integración con Google Calendar por profesional

Cada profesional debe vincular su propia cuenta de Google para que los turnos creados en Dentalist se sincronicen con su agenda personal.

## 0. Aplicar la migración `0003`

Antes de iniciar el flujo de Google Calendar asegurate de tener aplicada la migración
`supabase/migrations/0003_create_google_calendar_credentials.sql`. Esa migración crea la
tabla `professional_google_credentials`, que es donde se guardan los tokens OAuth de cada
profesional. Si ves un error como `relation "public.professional_google_credentials" does not
exist`, ejecutá:

```bash
supabase db push
```

Verificá en el Table Editor que la tabla exista antes de continuar con la integración.

## 1. Crear credenciales OAuth en Google Cloud
1. Entrá a [Google Cloud Console](https://console.cloud.google.com/) y creá (o seleccioná) un proyecto.
2. Habilitá la API de Google Calendar y la API de People (opcional, para obtener datos del perfil).
3. En **APIs & Services → Credentials**, generá un **OAuth 2.0 Client ID** de tipo "Web application".
4. Configurá los siguientes URIs de redirección autorizados:
   - `https://<tu-dominio>/api/google/oauth/callback`
   - `http://localhost:3000/api/google/oauth/callback` (para desarrollo local)
5. Descargá el Client ID y Client Secret.

## 2. Variables de entorno necesarias
Agregá estas variables en Vercel y en `.env.local` antes de desplegar:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://<tu-dominio>/api/google/oauth/callback
GOOGLE_CALENDAR_TIMEZONE=America/Argentina/Buenos_Aires
```

Si preferís derivar el redirect automáticamente según el dominio, podés omitir `GOOGLE_OAUTH_REDIRECT_URI` y definir `NEXT_PUBLIC_APP_URL` (por ejemplo `https://app.dentalist.com.ar`).

## 3. Conectar la cuenta desde Dentalist
1. Iniciá sesión como profesional y abrí **Configuración → Google Calendar**.
2. Hacé clic en **Conectar con Google Calendar** y completá el flujo de consentimiento.
3. Al finalizar, la app guardará los tokens OAuth en Supabase (`professional_google_credentials`) y mostrará la cuenta vinculada.
4. Podés desconectar la cuenta en cualquier momento desde el mismo panel.

## 4. ¿Qué ocurre al agendar un turno?
- Cuando creás, editás o eliminás un turno, Dentalist usa los tokens del profesional para invocar la API de Google Calendar sobre su calendario `primary`.
- Si el token expira, se refresca automáticamente y se guarda nuevamente en Supabase.
- Los pacientes reciben la invitación como asistentes (si se registró su email en la ficha).

> ⚠️ Cada profesional debe completar este flujo individualmente. Sin la autorización, los turnos no se sincronizarán con Google Calendar.
