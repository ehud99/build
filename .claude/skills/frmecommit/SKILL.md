---
name: frmecommit
description: Commit + bump de versión + push en un solo paso. Usar cuando el usuario pida "commit", "sube los cambios", "guarda y pushea" o invoque /frmecommit.
---

# frmecommit — commit, versión y push

Haz exactamente estos pasos, en orden, sin pedir confirmación salvo en los casos marcados **PREGUNTA**.

## 1. Estado

- `git status --porcelain` y `git diff --stat` (incluye staged: `git diff --cached --stat`).
- Si no hay cambios, dilo y termina.
- Rama actual: `git rev-parse --abbrev-ref HEAD`. Se pushea a **esa** rama; no cambies de rama.

## 2. Stage

- `git add -A`, salvo archivos que **nunca** se suben aunque no estén en `.gitignore`: `.env`, `.env.*`
  (excepto `.env.example`), llaves/certificados (`*.pem`, `*.pfx`, `*.key`), volcados de base de datos,
  `node_modules/`, `target/`, `venv/`, logs. Si aparece alguno sin ignorar → **PREGUNTA** antes de seguir
  y propón añadirlo a `.gitignore`.
- Lee el diff completo (`git diff --cached`) para entender qué cambió: lo necesitas para la versión y el mensaje.

## 3. Versión del proyecto

Solo si el proyecto (o el sub-proyecto tocado, en monorepos) tiene `package.json` con campo `version`:

| Cambios en el diff | Bump |
|---|---|
| Solo docs, comentarios, tests, CI o configuración de tooling | **ninguno** |
| Correcciones, refactors, estilos, dependencias | **patch** |
| Funcionalidad nueva visible para el usuario (`feat`) | **minor** |
| Cambio incompatible | **nunca automático** → **PREGUNTA** si quiere major |

- Comando: `npm version <patch|minor> --no-git-tag-version` en la carpeta del `package.json` (actualiza
  también `package-lock.json`); luego `git add` de esos archivos.
- En un monorepo con varios `package.json` modificados, sube solo los de las apps cuyo código cambió.
- `pom.xml`, `pyproject.toml` y otros: **no tocar** (los repos de equipo versionan en su proceso de release),
  salvo que el usuario lo pida explícitamente.

## 4. Commit

Mensaje en **Conventional Commits**, en el idioma de los últimos commits del repo (`git log -10 --format=%s`;
en los repos del usuario es español):

```
<tipo>(<ámbito>): <qué cambia, en imperativo, ≤ 72 caracteres>

<opcional: 1-3 líneas con el porqué o detalles no obvios>
```

- Tipos: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `style`, `build`, `ci`.
- Ámbito = módulo o app tocada (`difuntos`, `forge-front`, `auth`…); omítelo si el cambio es transversal.
- El asunto describe el **efecto**, no la lista de archivos. Si el commit incluyó bump de versión, no lo
  menciones en el asunto (es consecuencia, no el cambio).
- **Prohibido**: `Co-Authored-By`, trailers `Claude-Session` o similares, emojis, `git commit --amend`,
  `--no-verify`. Un commit nuevo siempre; si un hook de pre-commit falla, corrige la causa o repórtala, no lo
  saltes.
- Comando: `git commit -m "<asunto>" -m "<cuerpo>"` (segundo `-m` solo si hay cuerpo).

## 5. Push

- `git push origin HEAD`. Si la rama no tiene upstream: `git push -u origin HEAD`.
- Si el push es rechazado por estar detrás del remoto: `git pull --rebase origin <rama>` y vuelve a pushear.
  Si el rebase da conflictos, **detente** y repórtalos; no fuerces (`--force` está prohibido).

## 6. Reporte

Una línea por dato: rama, hash corto, asunto del commit, versión anterior → nueva (o "sin bump" y por qué),
resultado del push.
