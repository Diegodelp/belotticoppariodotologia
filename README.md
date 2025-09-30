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
