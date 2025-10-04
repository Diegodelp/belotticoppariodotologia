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

Para habilitar los insights de marketing con Gemini podés reutilizar el mismo cliente OAuth que ya configuraste para Google Calendar. Asegurate de agregar la URL de callback `https://<tu-dominio>/api/google/gemini/callback` a la lista de redirects autorizados de ese cliente y, si ya tenés definidas `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, no es necesario crear credenciales nuevas.

Si preferís sobreescribirlas explícitamente, definí las siguientes variables de entorno (tanto en Vercel como en tu `.env.local`):

- `GOOGLE_GEMINI_CLIENT_ID` (opcional, cae en `GOOGLE_CLIENT_ID` si no existe)
- `GOOGLE_GEMINI_CLIENT_SECRET` (opcional, cae en `GOOGLE_CLIENT_SECRET` si no existe)
- `GOOGLE_GEMINI_OAUTH_REDIRECT_URI` (opcional, cae en `GOOGLE_OAUTH_REDIRECT_URI` o se calcula a partir de `NEXT_PUBLIC_APP_URL`)
- `GOOGLE_GEMINI_MODEL` (opcional, por defecto usamos `models/gemini-1.5-flash-latest`)

Recordá habilitar la Generative Language API (también listada como Google AI API) en tu proyecto de Google Cloud para que el flujo de OAuth y las llamadas al modelo funcionen correctamente.
