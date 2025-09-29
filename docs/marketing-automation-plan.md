# Plan de integración: IA para WhatsApp e Instagram en Dentalist

## 1. Preparación del entorno
1. **Auditar la base de código actual**
   - Identificar componentes del sidebar y routing en `dentalist-app/components/layout/Sidebar.tsx` y las páginas donde se montará la nueva sección (posiblemente bajo `/marketing`).
   - Revisar servicios existentes en `dentalist-app/services` y módulos API en `app/api` para reutilizar patrones de autenticación y Supabase.
   - Listar puntos donde hoy se asume una única cuenta global (tokens, prompts, endpoints) para sustituirlos por configuraciones dependientes de `professional_id`.
2. **Definir variables de entorno**
   - `WHATSAPP_API_BASE_URL`, `INSTAGRAM_API_BASE_URL` (comunes a todas las cuentas).
   - `META_APP_ID`, `META_APP_SECRET` y `META_WEBHOOK_VERIFY_TOKEN` para ejecutar el intercambio OAuth por profesional.
   - `OPENAI_API_KEY` (o proveedor LLM gratuito/propio que se elija) para generar respuestas y creatividades.
   - `WEBHOOK_PUBLIC_URL` (URL pública donde WhatsApp e Instagram enviarán los mensajes entrantes; usar Vercel serverless o Supabase Edge Functions).
   - **Sin tokens globales**: los `access_token` y `business_account_id` de cada profesional se almacenarán en Supabase en tablas multi-tenant, nunca como variables de entorno.
3. **Configurar cuentas externas**
   - Registrar un **WhatsApp Business Account** y una **Instagram Business Account** en Meta for Developers. La app de Dentalist gestionará el OAuth para que **cada profesional vincule su propio número/página** y genere tokens largos almacenados con su `professional_id`.
   - Documentar para el profesional final los pasos necesarios (verificación de negocio, alta del número, creación de plantillas, publicación de la app en modo Live) y proporcionar un asistente dentro de Dentalist para guiar el enlace.
   - Seleccionar un proveedor LLM gratuito (p.ej. OpenRouter, Hugging Face Inference, Ollama self-host). Guardar la clave por profesional cuando sea necesario (por ejemplo, permitir que suban su propia clave OpenAI si la tienen).

## 2. Diseño de Supabase
1. **Tablas nuevas**
   - `marketing_channel_credentials` (id, professional_id, channel [`whatsapp|instagram`], external_business_id, phone_number_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, ai_provider, ai_api_key_encrypted, ai_persona JSON, status, created_at, updated_at).
   - `marketing_channels` (id, professional_id, type [`whatsapp|instagram`], status, settings JSON, created_at, updated_at) — referencia a `marketing_channel_credentials` para soportar múltiples números/páginas por profesional.
   - `marketing_campaigns` (id, professional_id, channel_type, channel_id, name, objective, audience JSON, status, scheduled_at, created_at, updated_at).
   - `marketing_campaign_assets` (id, campaign_id, asset_type [`caption|image|video|document`], storage_path, content, metadata JSON).
   - `marketing_conversations` (id, professional_id, channel_id, contact_phone, contact_name, context JSON, created_at, updated_at).
   - `marketing_messages` (id, conversation_id, direction [`inbound|outbound|system`], body, payload JSON, sent_at, status, ai_metadata JSON).
   - `marketing_audit_logs` (id, professional_id, entity_type, entity_id, action, actor_id, payload JSON, created_at) para rastrear actividades por profesional.
2. **Policies RLS**
   - Limitar acceso a `professional_id = auth.uid()` para todas las tablas de marketing.
   - Permitir al rol de servicio insertar/actualizar con `auth.role() = 'service_role'`.
   - Añadir políticas específicas para `marketing_channel_credentials` que permitan a cada profesional leer solo metadatos (nunca tokens en claro) y usar vistas/funciones para desencriptar bajo el rol backend.
3. **Storage**
   - Crear bucket `marketing-assets` con reglas RLS que permitan leer solo al dueño.
   - Añadir prefijos por profesional (`/{professional_id}/...`) y expirar URLs firmadas a los 15 minutos.

## 3. Arquitectura de backend
1. **Webhooks y API**
   - Crear endpoint `/api/webhooks/whatsapp` (Edge Runtime) que verifique firmas de Meta, resuelva el `professional_id` consultando `marketing_channel_credentials` por `phone_number_id`, procese mensajes entrantes, almacene en Supabase y dispare la IA del profesional correspondiente.
   - Endpoint `/api/marketing/whatsapp/send` para enviar respuestas manuales/automáticas usando la Cloud API con el token del profesional logueado.
   - Endpoint `/api/marketing/instagram/publish` que llame al endpoint de publicación de Instagram (requiere etapa de creación de contenedor y publicación) reutilizando los tokens del profesional.
   - Endpoint `/api/marketing/campaigns` (CRUD) para manejar campañas y assets multi-tenant.
   - Endpoint `/api/marketing/channels/oauth/start` y `/api/marketing/channels/oauth/callback` para iniciar/completar el enlace OAuth de Meta por profesional.
2. **Servicios**
   - `services/whatsapp.service.ts`: wrappers para enviar mensajes, marcar como leídos, recuperar plantillas. Deben aceptar `professionalId` y resolver tokens dinámicamente desde Supabase.
   - `services/instagram.service.ts`: crear assets, programar publicaciones. Igual que arriba, multi-tenant.
   - `services/ai.service.ts`: centralizar llamadas al LLM (respuestas y generación de copys/hashtags) usando la configuración de IA del profesional (modelo, tono, horario, límite de tokens).
   - `services/marketing-credentials.service.ts`: gestionar altas/bajas de tokens, refresco automático y cifrado en reposo.
3. **Tareas en background**
   - Programar cron job (Supabase Edge Functions + Scheduler o Vercel Cron) para revisar campañas con `scheduled_at` en el futuro y publicarlas automáticamente. El job debe iterar por profesional y usar sus credenciales activas.

## 4. Lógica de IA
1. **Motor de respuesta WhatsApp**
   - Crear prompt base con tono profesional y personalizado según datos del paciente (obtener de Supabase) y preferencias de la clínica guardadas en `marketing_channel_credentials.ai_persona`.
   - Detectar intenciones (consulta general, agendar turno, presupuesto) con clasificación via IA o reglas.
   - Para agendar turnos: llamar a servicio existente de `appointments` para crear cita y devolver confirmación; almacenar respuesta en `marketing_messages`. Usar el calendario del profesional (Google u otro) que esté vinculado.
2. **Generador de campañas Instagram**
   - Flujo: profesional define objetivo (promoción, recordatorio), tipo de tratamiento, call-to-action.
   - `ai.service` genera caption y hashtags usando la voz configurada para el profesional. Opcional: integración con un generador de imágenes (p.ej. DALL·E, Stable Diffusion) y guardar en Storage.
   - Permitir revisión manual antes de publicar; registrar aprobaciones en `marketing_campaigns`. Las publicaciones deben salir desde la página vinculada por el profesional, nunca desde una cuenta global.

## 5. Interfaz en Next.js
1. **Sidebar**
   - Añadir entrada "Marketing" con subrutas `whatsapp` e `instagram` visibles solo si el profesional tiene la función habilitada.
2. **Páginas**
   - `/marketing` dashboard general con métricas (mensajes respondidos, campañas activas) filtradas por profesional.
   - `/marketing/whatsapp` con pestañas: conversaciones, automatización, configuración. La pestaña de configuración debe guiar el enlace de cuenta (OAuth), permitir refrescar tokens y definir la voz de la IA.
   - `/marketing/instagram` con listado de campañas, formulario de nueva campaña, programación y estado de conexión del profesional.
   - Modal global “Conectar canales” accesible desde cualquier página de marketing.
3. **Componentes clave**
   - `WhatsAppConversationList`, `WhatsAppChatPanel`, `AutomationSettingsForm` con selector de número cuando un profesional tenga múltiples líneas.
   - `InstagramCampaignTable`, `CampaignForm`, `AssetPreview` mostrando la página/CTA vinculada.
   - `AISettingsCard` para definir estilo, tono, horarios y proveedor LLM por profesional.
   - `ChannelConnectionStatus` para mostrar expiración del token y permitir desconectar la cuenta.

## 6. Integración con agenda y pacientes
1. **Agenda automática**
   - Al detectar intención de agendar, obtener disponibilidad de `appointments` y proponer opciones (reutilizar `services/appointment.service.ts`).
   - Confirmar horario y registrar en Supabase + Google Calendar (si ya está integrado).
2. **Sincronización de contactos**
   - Permitir que la IA busque pacientes existentes por número. Si no existen, crear lead en `marketing_conversations` y permitir conversión a paciente real. La conversión debe heredar el `professional_id` activo.

## 7. Seguridad y cumplimiento
1. **Token storage**
   - Encriptar tokens de Meta/Instagram con `crypto` antes de guardarlos en Supabase.
2. **Logs**
   - Registrar eventos en `marketing_messages`, `marketing_audit_logs` y en Supabase Logs (Edge Functions) para auditoría.
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
   - Webhook verificado en Meta (challenge-response) y probado por profesional (simular múltiples números/páginas).
   - Buckets y policies de Supabase aplicadas.
   - IA probada con prompts reales y fallback en caso de fallo del proveedor.
   - Cron job activo para campañas programadas por profesional.
   - Tokens OAuth almacenados cifrados y pruebas de refresco automático por profesional.

