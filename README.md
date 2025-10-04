# belotticoppariodotologia

## Actualizar la rama del PR

Si necesitás traer los últimos cambios de la rama base (por ejemplo, `main`) a la rama de tu Pull Request, seguí estos pasos desde tu entorno local:

1. Asegurate de haber guardado todos tus cambios:
   ```bash
   git status
   ```
   Si aparece algo pendiente, confirmalo o guardalo antes de continuar.

2. Traé las últimas referencias del repositorio remoto:
   ```bash
   git fetch origin
   ```

3. Cambiá a la rama del Pull Request (reemplazá `<mi-rama>` por el nombre real):
   ```bash
   git checkout <mi-rama>
   ```

4. Actualizá la rama con la base más reciente. Podés hacerlo con rebase para mantener un historial limpio:
   ```bash
   git rebase origin/main
   ```
   Si preferís un merge clásico:
   ```bash
   git merge origin/main
   ```

5. Resolvé cualquier conflicto que aparezca y completá el rebase/merge.

6. Finalmente, publicá los cambios actualizados en el remoto:
   ```bash
   git push --force-with-lease
   ```
   (o `git push` si usaste merge y no reescribiste el historial).

Con esto, la rama de tu PR quedará sincronizada con los últimos cambios de la rama principal sin necesidad de abrir una nueva Pull Request.

## Configuración de Google Gemini

La integración de marketing usa una API key de [Google AI Studio](https://aistudio.google.com/app/apikey) por profesional. Para habilitarla:

1. Ingresá a Google AI Studio con la cuenta de Google que quieras usar y generá una API key con acceso a la **Generative Language API**.
2. Copiá la clave y, dentro de Dentalist, abrí **Configuración → Google & IA**.
3. Pegá la API key (y opcionalmente asignale una etiqueta) para guardarla. La clave se cifra con tu `ENCRYPTION_MASTER_KEY` antes de persistirse en Supabase.
4. Desde ese momento los insights y campañas de marketing usarán el modelo configurado para generar recomendaciones.

Variables de entorno relacionadas:

- `GOOGLE_GEMINI_MODEL` (opcional, por defecto `models/gemini-2.5-flash-lite`).
- `GOOGLE_GEMINI_API_BASE` (opcional si necesitás apuntar a otro endpoint compatible).

No se requieren `client_id`/`client_secret` adicionales; cada profesional administra su propia API key desde la interfaz.
