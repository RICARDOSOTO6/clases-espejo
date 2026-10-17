# Clases Conjuntas — instrucciones del proyecto

## Cuándo se aplican estas reglas

**Solo cuando se va a tocar código o la base de datos.** Si la petición es una
pregunta, una explicación, una revisión de documentos, una captura o una consulta
sobre el estado de algo, **responde al grano** y no apliques el ritual de abajo
(compilaciones, pruebas en el puerto 3001, formato de cierre con el estado del
repositorio, etc.). Ese ritual existe para no romper el software, no para cada
conversación.

**Antes de modificar código o datos, lee
[`docs/guias/trabajo-en-el-codigo.md`](docs/guias/trabajo-en-el-codigo.md)**: ahí
están las reglas completas (verificación, commits, migraciones, trampas del entorno
y decisiones cerradas del proyecto).

## Lo que hay que saber siempre

- **Backend** NestJS 11 + Prisma + PostgreSQL; **frontend** Angular 21 zoneless que
  se sirve **compilado** desde `backend/public`. Una sola URL: `:3000`.
- **Roles**: docente, agente, presidencia de la CACE y secretaría. El rol es
  **relacional** (fila en `AGENTE`, `DOCENTE` o `MIEMBRO_CACE`), nunca una columna.
- **La regla de oro, también fuera del código**: no afirmes que algo funciona si no
  lo has comprobado. Y si no se pudo comprobar, dilo.
- El índice de la documentación está en [`docs/README.md`](docs/README.md).
