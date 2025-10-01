# Paso 2: Configurar el servicio de correo para Supabase Auth

Este paso activa el envío de correos reales (confirmaciones, OTP de doble factor, restablecimientos de contraseña) usando un proveedor SMTP compatible. Las instrucciones cubren Gmail (Google Workspace o cuentas personales con App Password) y una alternativa gratuita basada en Resend.

## 1. Crear credenciales SMTP

### Opción A: Gmail / Google Workspace
1. Habilitá la verificación en dos pasos para la cuenta que enviará los correos.
2. Generá una **App Password** desde [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords). Guardá la clave de 16 dígitos.
3. Definí el remitente (por ejemplo, `notificaciones@tudominio.com`). Si usás Workspace, verificá el dominio y configurá DKIM/SPF desde el Admin Console.

**Valores SMTP**
- Host: `smtp.gmail.com`
- Puerto: `587`
- Usuario: dirección de correo completa
- Contraseña: App Password generada
- TLS requerido

### Opción B: Resend (plan gratuito)
1. Creá una cuenta en [https://resend.com](https://resend.com) y verificá tu email.
2. Obtené la **API Key** y verificá el dominio o remitente "Sender Identity" gratuito.
3. Usá el endpoint SMTP que proveen (`smtp.resend.com`, puerto `465` o `587`).

## 2. Cargar las variables en Supabase
1. En el dashboard de Supabase, abrí **Project Settings → Auth → SMTP Settings**.
2. Completá los campos con los valores del proveedor elegido:
   - `SMTP sender name`
   - `SMTP sender email`
   - `SMTP host`
   - `SMTP port`
   - `SMTP user`
   - `SMTP password`
3. Guardá los cambios y enviá un **test email** desde el mismo panel para confirmar que la conexión es válida.

## 3. Plantillas y expiración del 2FA
- En **Auth → Templates**, personalizá los emails "OTP" y "Magic Link" si necesitás branding.
- El esquema ya marca el 2FA como opcional por paciente (`patients.two_factor_enabled`) y genera códigos con una vigencia por defecto de **5 minutos** (`two_factor_codes.expires_at`).

## 4. Variables para Vercel (se configurarán al final)
Cuando despleguemos, necesitarás crear en Vercel las mismas variables para la app Next.js. Te avisaré cuáles (`SMTP_HOST`, `SMTP_PORT`, etc.) durante la etapa de integración.

## 5. Próximos pasos
1. Ejecutá las migraciones actualizadas (`supabase db push`) para incorporar la expiración automática de 5 minutos.
2. Verificá que el correo de prueba llega correctamente.
3. Compartí las credenciales SMTP de manera segura para continuar con la integración en el código.

> Nota: Gmail aplica límites diarios y antispam estrictos. Para volúmenes mayores o correos transaccionales en producción, considera subir a Google Workspace o usar un proveedor dedicado (Resend, Mailgun, SendGrid).
