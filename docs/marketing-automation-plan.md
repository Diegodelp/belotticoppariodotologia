# Plan de integración: IA para WhatsApp e Instagram en Dentalist

## 1. Preparación del entorno
1. **Auditar la base de código actual**
   - Identificar componentes del sidebar y routing en `dentalist-app/components/layout/Sidebar.tsx` y las páginas donde se montará la nueva sección (posiblemente bajo `/marketing`).
   - Revisar servicios existentes en `dentalist-app/services` y módulos API en `app/api` para reutilizar patrones de autenticación y Supabase.
2. **Definir variables de entorno**
   - `WHATSAPP_API_BASE_URL`, `WHATSAPP_API_TOKEN` (Meta Cloud API o proveedor equivalente).
   - `INSTAGRAM_API_BASE_URL`, `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`.
   - `OPENAI_API_KEY` (o proveedor LLM gratuito/propio que se elija) para generar respuestas y creatividades.
   - `WEBHOOK_PUBLIC_URL` (URL pública donde WhatsApp enviará los mensajes entrantes; usar Vercel serverless o Supabase Edge Functions).
3. **Configurar cuentas externas**
   - Registrar un **WhatsApp Business Account** con Meta y crear una app en Meta for Developers para habilitar la Cloud API. Registrar números de teléfono, generar tokens y configurar webhooks.
   - Convertir la cuenta de Instagram a **Business** y vincularla con la página de Facebook. Crear una app en Meta para obtener permisos `instagram_basic`, `pages_show_list`, `instagram_content_publish`.
   - Seleccionar un proveedor LLM gratuito (p.ej. OpenAI gratis no existe, alternativas: `openrouter`, `huggingface`, `ollama` self-host). Definir límites de coste y latencia.

## 2. Diseño de Supabase
1. **Tablas nuevas**
   - `marketing_channels` (id, professional_id, type [`whatsapp|instagram`], status, credentials JSON, created_at, updated_at).
   - `marketing_campaigns` (id, professional_id, channel_type, name, objective, status, scheduled_at, created_at, updated_at).
   - `marketing_campaign_assets` (id, campaign_id, asset_type [`caption|image|video`], storage_path, content, metadata JSON).
   - `marketing_conversations` (id, professional_id, contact_phone, contact_name, context JSON, created_at, updated_at).
   - `marketing_messages` (id, conversation_id, direction [`inbound|outbound`], body, payload JSON, sent_at, status).
2. **Policies RLS**
   - Limitar acceso a `professional_id = auth.uid()` para todas las tablas de marketing.
   - Permitir al rol de servicio insertar/actualizar con `auth.role() = 'service_role'`.
3. **Storage**
   - Crear bucket `marketing-assets` con reglas RLS que permitan leer solo al dueño.

## 3. Arquitectura de backend
1. **Webhooks y API**
   - Crear endpoint `/api/webhooks/whatsapp` (Edge Runtime) que verifique firmas de Meta, procese mensajes entrantes, almacene en Supabase y dispare la IA.
   - Endpoint `/api/marketing/whatsapp/send` para enviar respuestas manuales/automáticas usando la Cloud API.
   - Endpoint `/api/marketing/instagram/publish` que llame al endpoint de publicación de Instagram (requiere etapa de creación de contenedor y publicación).
   - Endpoint `/api/marketing/campaigns` (CRUD) para manejar campañas y assets.
2. **Servicios**
   - `services/whatsapp.service.ts`: wrappers para enviar mensajes, marcar como leídos, recuperar plantillas.
   - `services/instagram.service.ts`: crear assets, programar publicaciones.
   - `services/ai.service.ts`: centralizar llamadas al LLM (respuestas y generación de copys/hashtags).
3. **Tareas en background**
   - Programar cron job (Supabase Edge Functions + Scheduler o Vercel Cron) para revisar campañas con `scheduled_at` en el futuro y publicarlas automáticamente.

## 4. Lógica de IA
1. **Motor de respuesta WhatsApp**
   - Crear prompt base con tono profesional y personalizado según datos del paciente (obtener de Supabase).
   - Detectar intenciones (consulta general, agendar turno, presupuesto) con clasificación via IA o reglas.
   - Para agendar turnos: llamar a servicio existente de `appointments` para crear cita y devolver confirmación; almacenar respuesta en `marketing_messages`.
2. **Generador de campañas Instagram**
   - Flujo: profesional define objetivo (promoción, recordatorio), tipo de tratamiento, call-to-action.
   - `ai.service` genera caption y hashtags. Opcional: integración con un generador de imágenes (p.ej. DALL·E, Stable Diffusion) y guardar en Storage.
   - Permitir revisión manual antes de publicar; registrar aprobaciones en `marketing_campaigns`.

## 5. Interfaz en Next.js
1. **Sidebar**
   - Añadir entrada "Marketing" con subrutas `whatsapp` e `instagram`.
2. **Páginas**
   - `/marketing` dashboard general con métricas (mensajes respondidos, campañas activas).
   - `/marketing/whatsapp` con pestañas: conversaciones, automatización, configuración.
   - `/marketing/instagram` con listado de campañas, formulario de nueva campaña, programación.
3. **Componentes clave**
   - `WhatsAppConversationList`, `WhatsAppChatPanel`, `AutomationSettingsForm`.
   - `InstagramCampaignTable`, `CampaignForm`, `AssetPreview`.
   - `AISettingsCard` para definir estilo, tono, horarios.

## 6. Integración con agenda y pacientes
1. **Agenda automática**
   - Al detectar intención de agendar, obtener disponibilidad de `appointments` y proponer opciones (reutilizar `services/appointment.service.ts`).
   - Confirmar horario y registrar en Supabase + Google Calendar (si ya está integrado).
2. **Sincronización de contactos**
   - Permitir que la IA busque pacientes existentes por número. Si no existen, crear lead en `marketing_conversations` y permitir conversión a paciente real.

## 7. Seguridad y cumplimiento
1. **Token storage**
   - Encriptar tokens de Meta/Instagram con `crypto` antes de guardarlos en Supabase.
2. **Logs**
   - Registrar eventos en `marketing_messages` y en Supabase Logs (Edge Functions) para auditoría.
3. **Opt-in**
   - Gestionar consentimiento: almacenar flag `whatsapp_opt_in` en pacientes y no enviar mensajes sin autorización.

## 8. Roadmap sugerido
1. Crear migraciones Supabase y policies.
2. Construir servicios Node para WhatsApp/Instagram + AI.
3. Implementar webhook de WhatsApp y panel de conversaciones.
4. Integrar generador de campañas y publicación manual.
5. Añadir programación automática y cron jobs.
6. QA (pruebas unitarias y end-to-end) y despliegue.

## 9. Requisitos de pruebas
- Simular eventos entrantes de WhatsApp con `curl` o Postman.
- Usar entornos de prueba de Meta (números de test).
- Verificar límites de rate y manejo de errores.

## 10. Checklist de despliegue
- Variables de entorno configuradas en Vercel.
- Webhook verificado en Meta (challenge-response).
- Buckets y policies de Supabase aplicadas.
- IA probada con prompts reales y fallback en caso de fallo del proveedor.
- Cron job activo para campañas programadas.

