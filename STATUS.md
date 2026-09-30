# ESTADO DEL PROYECTO

## Cierre de Consulta de viajes y rentabilidad — 30/09/2026

Implementado y publicado el módulo de consulta histórica dentro de Pricing. El commit `ee9e4e9` fue desplegado en Render con estado **Live**.

Última versión funcional publicada: commit `5365f22`.

### Funcionalidad cerrada

- Filtros por origen, destino, OT, fecha, tipo de unidad, modalidad y tipo de carga.
- `MATERIAL_TRANSPOR` conserva su descripción original.
- Modalidad `JWM` se presenta como Propio y `TERC` como Tercero.
- Resultados resumidos por OT con botón Ver y detalle en pestañas Viaje, Costos y rentabilidad y Detalle económico.
- Gastos separados: combustible, peaje, viático, sueldo operativo, neumáticos, comisiones, Otros depurados y terceros.
- Utilidad bruta, margen bruto, OPEX, utilidad operativa y margen operativo.
- Rendimiento y factor OPEX visibles por componente.
- OT, fecha, cliente, ruta, flete y utilidades alineados en la tabla de resultados.
- Resultados finales: OT, fecha, cliente, origen, destino, departamento, tipo de unidad, flete, UT bruta %, UT operativa % y Ver.
- Los importes en soles de UT bruta y UT operativa se mantienen únicamente en el detalle.
- `CBJA` se normaliza a `CBAJA`.
- Destino utiliza `LUGAR_DE_DESCARGA`; departamento se muestra como columna independiente y el filtro busca en lugar, departamento y ciudad/distrito.

### Datos y activación

- Fuente: `STAGING_COSTOS.csv` y `FACT_PROGRAMACION.csv` del ETL JWM.
- Lote activo: `00b4af2d76029b5c9c3bb9f017c408bb2e67641577395bba48bad70397c1d11e`.
- Corte ETL: `2026-09-30 10:00:18`.
- Publicado: 6.497 OT y 6.851 componentes de costo en Aiven MySQL.
- Se crearon las tablas `consulta_viajes_lotes`, `consulta_viajes_activo`, `consulta_viajes_ot` y `consulta_viajes_ejecuciones`.
- `DB_HOST` de Render debe mantenerse como `mysql-bcff750-transportesjwm-p26.i.aivencloud.com`, con credenciales protegidas.

### Validación final

- 8/8 pruebas del modelo financiero aprobadas.
- Importación en modo diagnóstico aprobada.
- Migración e importación en Aiven aprobadas.
- Listado, filtro por OT y detalle contra MySQL aprobados.
- Acceso anónimo bloqueado con 401.
- Roles administrador, comercial y consulta autorizados; rol no autorizado recibe 403.
- Prueba visual de resultados, modal, pestañas, costos y detalle económico aprobada.
- Despliegue Render `ee9e4e9` confirmado como Live.

### Pendientes operativos

- Definir frecuencia y responsable de actualización del lote ETL.
- Definir retención de lotes históricos.
- Validar la operación con usuarios comerciales en producción.
- Crear manual de usuario en una tarea posterior.

No ejecutar migraciones ni importaciones adicionales sin validar primero el corte ETL y el destino Aiven.

## Cierre documental del portafolio — 29/09/2026

La documentación existente fue revisada como parte del portafolio y se confirmó que mantiene instalación, configuración, arquitectura, despliegue, operación, seguridad, modelo de datos y plan de estabilización. No se modificó código, configuración, dependencias ni datos, y no se repitieron las pruebas operativas registradas en este estado.

## Proyecto

PROYECTO_JWM_PRICING

## Objetivo

Plataforma web de pricing y cotizaciones JWM con frontend estático, API Node.js/Express, persistencia MySQL en Aiven y despliegue en Render.

## Tecnologías

HTML, CSS, JavaScript, Node.js 20+, Express 5, MySQL, pnpm, Render y Aiven.

## Arquitectura confirmada

Aplicación monolítica: Express sirve el frontend y la API. Las vistas se cargan dinámicamente; autenticación, roles y persistencia remota se gestionan mediante la API. Los cálculos de pricing se ejecutan en el navegador usando drivers almacenados en `localStorage`, con sincronización parcial hacia MySQL.

## Estado operativo confirmado

El despliegue público respondió HTTP 200. `/api/health` confirmó conexión SSL con MySQL en Aiven. La página pública cargó todas las vistas y scripts sin errores de consola antes del login. No se probaron operaciones autenticadas ni mutaciones de datos.

Render utiliza plan gratuito y puede suspender el servicio tras inactividad. El frontend y MySQL no tienen timeouts explícitos, por lo que un arranque en frío o una demora externa puede aparentar que el sistema se cuelga.

## Último trabajo realizado

Creación y validación de `README.md` como guía central de incorporación para desarrolladores. Incluye instalación local, variables reconocidas, comandos, arquitectura, estructura, roles, flujo funcional, despliegue, validación de cambios, riesgos, diagnóstico e índice documental. No se modificó código funcional, configuración ni dependencias.

## Documentación técnica creada

- `README.md`
- `docs/arquitectura-tecnica.md`
- `docs/flujo-funcional.md`
- `docs/modelo-datos.md`
- `docs/api-reference.md`
- `docs/reglas-pricing.md`
- `docs/roles-permisos.md`
- `docs/operacion-render-aiven.md`
- `docs/seguridad-riesgos.md`
- `docs/plan-estabilizacion.md`

El manual de usuario queda expresamente pospuesto hasta finalizar y validar el diseño del sistema; se realizará como tarea separada.

## Problema activo

Sistema susceptible a bloqueos aparentes e inconsistencias por arranque en frío, solicitudes sin timeout, dependencia de drivers locales y sincronización no confirmada entre `localStorage` y MySQL.

## Riesgos críticos identificados

- Credenciales administrativas predeterminadas presentes en código.
- Publicación del directorio raíz mediante archivos estáticos.
- Drivers no sincronizados automáticamente para usuarios no administradores.
- Guardado local confirmado antes de finalizar el guardado remoto.
- Historial remoto puede reemplazar información local no sincronizada.
- Numeración de cotizaciones generada por navegador con riesgo de colisión y sobrescritura.
- Exclusiones del Resultado no se conservan al recalcular el Resumen.

## Validación realizada

- Respuesta pública de frontend, recursos y `/api/health`.
- Confirmación de conexión activa con Aiven MySQL.
- Reconstrucción del flujo desde endpoint, autenticación, cálculo y persistencia.
- Verificación de los nueve documentos: existencia, contenido, estructura, codificación y referencias locales.
- Verificación de `README.md`: estructura, codificación, enlaces locales, comandos de `package.json` y variables reconocidas por el código.
- Confirmación de que no se creó el manual de usuario.

No se inició servidor local, no se ejecutaron scripts de base de datos, no se usaron credenciales y no se hicieron pruebas funcionales autenticadas.

## Estado de Git observado

`README.md`, `AGENTS.md`, `STATUS.md`, `Plantillas driver/` y los nueve documentos técnicos aparecen como archivos no rastreados. No se registraron cambios en código funcional durante este trabajo.

## Pendientes priorizados

1. Contener riesgos críticos: rotar credenciales y restringir archivos estáticos.
2. Añadir timeouts, health check seguro y manejo del arranque en frío.
3. Centralizar numeración y confirmar guardados remotos antes de informar éxito.
4. Sincronizar y validar drivers antes de calcular.
5. Persistir desglose, exclusiones y versión de reglas.
6. Crear pruebas patrón de pricing y pruebas de roles/concurrencia.
7. Crear el manual de usuario únicamente después de estabilizar el diseño.

## Próximo paso recomendado

Iniciar una tarea concreta de DIAGNÓSTICO para la Fase 0 del plan de estabilización: credenciales administrativas predeterminadas y exposición de archivos internos.
