# Paso 4 · Integración con Google Calendar

Para que los turnos que agendes desde Dentalist se sincronicen automáticamente con el calendario del profesional, necesitás configurar un servicio de Google Cloud con acceso a Calendar.

1. **Crear un proyecto y una cuenta de servicio**
   - Ingresá a [Google Cloud Console](https://console.cloud.google.com/), creá (o seleccioná) un proyecto y habilitá la API de Google Calendar.
   - En la sección **IAM & Admin → Service Accounts**, generá una cuenta de servicio nueva con acceso a la API de Calendar. Descargá la clave JSON.

2. **Delegación y acceso al calendario**
   - Si usás un dominio de Google Workspace, habilitá la *domain-wide delegation* para la cuenta de servicio e indicá el alcance `https://www.googleapis.com/auth/calendar.events`.
   - Si trabajás con una cuenta de Gmail personal, compartí el calendario con la cuenta de servicio con permisos para "Hacer cambios y gestionar el uso compartido".

3. **Variables de entorno necesarias**
   Cargá estos valores en Vercel y en tu `.env.local`:

   ```bash
   GOOGLE_SERVICE_ACCOUNT_EMAIL=...       # campo client_email del JSON
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="..." # campo private_key (reemplazá saltos de línea por \n)
   GOOGLE_CALENDAR_DEFAULT_ID=...         # correo del calendario a sincronizar (por ejemplo, tu Gmail profesional)
   GOOGLE_CALENDAR_DELEGATED_ACCOUNT=...  # opcional: correo a impersonar si usás domain-wide delegation
   GOOGLE_CALENDAR_TIMEZONE=America/Argentina/Buenos_Aires
   ```

   > ⚠️ Si el profesional tiene más de un calendario, podés reemplazar `GOOGLE_CALENDAR_DEFAULT_ID` por el ID específico (lo encontrás en la configuración de Calendar).

4. **Prueba de funcionamiento**
   - Iniciá sesión en la app, agendá un turno desde la ficha del paciente o desde `/calendar` y verificá que aparezca en Google Calendar.
   - Al reprogramar o eliminar un turno, el evento se actualiza o elimina automáticamente.

Con estas variables creadas, los endpoints de Dentalist usan la cuenta de servicio para insertar, actualizar y eliminar eventos en el calendario configurado.
