# JWM Pricing Platform

Plataforma web para preparar cotizaciones de transporte, calcular costos y tarifas, administrar drivers operativos y consultar el historial comercial de JWM.

## Estado del proyecto

El sistema se encuentra desplegado como una aplicación monolítica en Render y utiliza MySQL en Aiven. La consulta histórica de viajes y rentabilidad está implementada y publicada en producción con el commit `5365f22`.

Antes de realizar cambios, leer obligatoriamente:

1. [`AGENTS.md`](AGENTS.md): reglas permanentes de trabajo.
2. [`STATUS.md`](STATUS.md): fuente de verdad operativa y estado actual.
3. [`docs/plan-estabilizacion.md`](docs/plan-estabilizacion.md): orden recomendado de correcciones.

No reconstruir el estado exclusivamente desde conversaciones anteriores. `STATUS.md` prevalece como memoria operativa.

## Aplicación desplegada

- Aplicación: <https://jwm-pricing-platform.onrender.com/>
- Salud de API y MySQL: <https://jwm-pricing-platform.onrender.com/api/health>

El servicio usa actualmente el plan gratuito de Render. Después de un periodo sin tráfico puede suspenderse y la primera apertura puede tardar cerca de un minuto mientras Render activa la instancia.

## Consulta de viajes y rentabilidad

El módulo permite consultar viajes históricos durante la cotización usando filtros por origen, destino, OT, fecha, tipo de unidad, modalidad y tipo de carga. El filtro Destino busca por lugar de descarga, departamento o ciudad/distrito. Los resultados se resumen por OT y muestran flete, tipo de unidad, UT bruta % y UT operativa %. El botón **Ver** abre el detalle en tres pestañas: Viaje, Costos y rentabilidad y Detalle económico.

El detalle conserva la descripción original de `MATERIAL_TRANSPOR`, muestra los gastos separados y presenta los importes completos de utilidad, rendimiento, costos estándar, factor OPEX y resultados por componente. `JWM` se presenta como Propio y `TERC` como Tercero; `CBJA` se normaliza a `CBAJA` y otros valores se conservan.

La fuente del lote activo son `STAGING_COSTOS.csv` y `FACT_PROGRAMACION.csv`. La publicación contiene 6.497 OT y 6.851 componentes, almacenados en Aiven MySQL. La guía técnica está en [`docs/consulta-viajes.md`](docs/consulta-viajes.md).

Para actualizar el histórico, validar primero el corte ETL y ejecutar el importador en modo diagnóstico. No guardar credenciales ni archivos de staging dentro del repositorio.

## Tecnologías

- HTML, CSS y JavaScript sin framework.
- Node.js 20 o superior.
- Express 5.
- MySQL mediante `mysql2`.
- `pnpm` como gestor de paquetes.
- Render para el servicio web.
- Aiven para MySQL remoto.
- SheetJS para importar y exportar drivers.

## Arquitectura resumida

Express sirve tanto el frontend estático como la API. Las vistas HTML se cargan dinámicamente en el navegador. La autenticación y persistencia remota pasan por la API, mientras que los cálculos de costos y tarifas se ejecutan en el frontend usando drivers almacenados en `localStorage`.

```text
Navegador
  ├─ vistas y formularios
  ├─ cálculo de pricing
  └─ localStorage
        │
        ▼
Node.js / Express en Render
  ├─ autenticación y roles
  ├─ API de usuarios
  ├─ API de drivers
  └─ API de cotizaciones
        │
        ▼
MySQL en Aiven
```

Consultar [`docs/arquitectura-tecnica.md`](docs/arquitectura-tecnica.md) para el detalle de módulos y dependencias.

## Estructura principal

```text
PROYECTO_JWM_PRICING/
├─ index.html              Entrada del frontend
├─ views/                  Pantallas HTML cargadas dinámicamente
├─ css/                    Estilos por módulo
├─ js/                     Lógica de interfaz, pricing y cliente API
├─ server/                 Servidor, autenticación y utilidades MySQL
├─ sql/                    Esquema SQL de referencia
├─ docs/                   Documentación técnica y operativa
├─ assets/                 Recursos visuales
├─ package.json            Scripts y dependencias
├─ render.yaml             Configuración de Render
├─ .env.example            Variables locales básicas
├─ AGENTS.md               Reglas de trabajo para agentes
└─ STATUS.md               Estado operativo vigente
```

## Requisitos locales

- Node.js 20 o superior.
- `pnpm` disponible.
- MySQL accesible localmente o mediante un servicio remoto.
- Una base de datos dedicada para el proyecto.

Comprobar versiones:

```powershell
node --version
pnpm --version
```

## Instalación local

### 1. Instalar dependencias

```powershell
pnpm install --frozen-lockfile
```

No actualizar dependencias durante la instalación inicial.

### 2. Crear el archivo de entorno

```powershell
Copy-Item .env.example .env
```

Configurar como mínimo:

```dotenv
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=jwm_pricing
DB_CONNECTION_LIMIT=10
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true
COOKIE_SECURE=false
```

Variables adicionales reconocidas por el código:

| Variable | Uso |
|---|---|
| `DB_SSL_CA` | Certificado CA incluido como texto; acepta saltos escapados. |
| `DB_SSL_CA_FILE` | Ruta a un certificado CA local. |
| `ALLOWED_ORIGINS` | Orígenes CORS adicionales separados por comas. |
| `ADMIN_NAME` | Nombre utilizado por `pnpm admin:create`. |
| `ADMIN_EMAIL` | Correo utilizado por `pnpm admin:create`. |
| `ADMIN_PASSWORD` | Contraseña utilizada por `pnpm admin:create`. |

Nunca guardar secretos reales en el repositorio. Para producción, `DB_SSL` y `COOKIE_SECURE` deben permanecer en `true`.

### 3. Inicializar la base de datos

Con MySQL disponible y las variables correctas:

```powershell
pnpm db:init
```

Este comando crea las tablas definidas en `server/init-db.js`. No ejecutarlo contra una base de datos desconocida sin confirmar previamente el destino.

### 4. Crear el administrador

Definir obligatoriamente valores propios en `.env`:

```dotenv
ADMIN_NAME=Administrador JWM
ADMIN_EMAIL=correo_autorizado@dominio.com
ADMIN_PASSWORD=contraseña_segura_y_unica
```

Después ejecutar:

```powershell
pnpm admin:create
```

El script actual contiene valores predeterminados inseguros. No debe ejecutarse en producción sin proporcionar las tres variables anteriores. Su eliminación forma parte del plan de estabilización.

### 5. Iniciar el sistema

```powershell
pnpm dev
```

También existe:

```powershell
.\iniciar-local.ps1
```

Abrir:

- Aplicación: <http://localhost:3000/>
- Salud: <http://localhost:3000/api/health>

La respuesta de salud esperada debe indicar `ok: true` y `database: connected`.

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `pnpm dev` | Inicia `server/server.js`. |
| `pnpm start` | Comando de inicio usado por Render. |
| `pnpm db:init` | Crea o completa las tablas principales. |
| `pnpm admin:create` | Crea o restablece el administrador configurado. |

No existen todavía scripts de pruebas, lint o build.

## Roles

| Rol | Acceso principal |
|---|---|
| `admin` | Cotización, resultado, resumen, historial, drivers y usuarios. |
| `comercial` | Cotización, resultado, resumen e historial. |
| `consulta` | Resumen e historial. |

Los permisos visibles del frontend no sustituyen las validaciones de rol del backend. Consultar [`docs/roles-permisos.md`](docs/roles-permisos.md).

## Flujo funcional

1. El usuario inicia sesión.
2. El sistema muestra las pantallas permitidas por su rol.
3. Los drivers proporcionan parámetros de flota, rutas, personal y costos.
4. Comercial registra la carga, ruta, configuración y condiciones financieras.
5. El navegador calcula costos, tarifa objetivo, utilidad y rentabilidad.
6. La cotización se conserva localmente y se intenta sincronizar con MySQL.
7. Historial permite reabrir, modificar y presentar la cotización.
8. El resumen puede imprimirse o guardarse como PDF desde el navegador.

Consultar:

- [`docs/flujo-funcional.md`](docs/flujo-funcional.md)
- [`docs/reglas-pricing.md`](docs/reglas-pricing.md)
- [`docs/modelo-datos.md`](docs/modelo-datos.md)

## API

La API utiliza la base relativa `/api`. Los grupos principales son:

- `/api/health`
- `/api/auth/*`
- `/api/usuarios`
- `/api/drivers/:name`
- `/api/cotizaciones`

Consultar [`docs/api-reference.md`](docs/api-reference.md) antes de modificar contratos o permisos.

## Despliegue

`render.yaml` declara un Web Service Node.js con:

```text
Build: pnpm install --frozen-lockfile
Start: pnpm start
```

Las credenciales y certificados de Aiven se configuran como variables protegidas en Render. No copiar secretos dentro de `render.yaml`, documentación o código.

Guías disponibles:

- [`docs/deploy-render-aiven.md`](docs/deploy-render-aiven.md)
- [`docs/operacion-render-aiven.md`](docs/operacion-render-aiven.md)
- [`docs/mysql-local-v1.md`](docs/mysql-local-v1.md)

## Validación mínima de un cambio

Seguir siempre el ciclo definido en `AGENTS.md`:

```text
DIAGNÓSTICO → CORRECCIÓN → PRUEBA → CIERRE
```

Para cambios ordinarios:

1. Confirmar la tarea y la capa afectada.
2. Revisar únicamente archivos relacionados.
3. Aplicar el cambio mínimo aprobado.
4. Ejecutar primero una prueba específica, no toda la aplicación.
5. Verificar permisos si se modifica una ruta protegida.
6. Verificar persistencia local y remota si se modifica una cotización o driver.
7. Comparar Resultado, Resumen e impresión si cambia una fórmula.
8. Actualizar `STATUS.md` solo durante un cierre autorizado.

### Cambios de pricing

Antes de aceptar una modificación de fórmula se deben definir casos patrón con:

- Datos exactos de carga y ruta.
- Drivers y versión utilizados.
- Costo esperado por concepto.
- Costo total esperado.
- Margen, tarifa y rentabilidad esperados.
- Exclusiones aplicadas.

El proyecto aún no cuenta con una suite automatizada que garantice estos resultados. No cambiar fórmulas sin una prueba mínima autorizada y valores esperados aprobados.

## Riesgos conocidos

Los principales riesgos vigentes son:

- Credenciales administrativas predeterminadas en código.
- Publicación de archivos internos desde el directorio raíz.
- Drivers no sincronizados automáticamente para todos los usuarios.
- Confirmación local de guardado antes de terminar la escritura remota.
- Posible reemplazo del historial local por el remoto.
- Numeración de cotizaciones generada por navegador.
- Diferencias entre Resultado y Resumen cuando existen exclusiones.
- Solicitudes sin timeout y arranque en frío de Render.

Leer antes de implementar correcciones:

- [`docs/seguridad-riesgos.md`](docs/seguridad-riesgos.md)
- [`docs/plan-estabilizacion.md`](docs/plan-estabilizacion.md)

## Resolución rápida de problemas

### Render muestra “El servicio se está activando”

Es un arranque en frío del plan gratuito. Esperar a que termine. Un plan siempre activo elimina esta suspensión.

### `/api/health` devuelve 503

Revisar disponibilidad de Aiven, host, puerto, nombre de base, usuario, contraseña y configuración SSL.

### El login no termina

Comprobar primero `/api/health` y los logs de Render. El cliente no tiene timeout explícito, por lo que una conexión lenta puede aparentar un bloqueo.

### Los costos aparecen en cero

Confirmar que los drivers requeridos estén cargados en el navegador actual. La sincronización automática de drivers todavía es una limitación conocida.

### Una cotización no aparece en el historial

Comprobar si la escritura remota falló. Actualmente la interfaz puede confirmar el guardado local antes de que MySQL termine.

## Documentación técnica

Orden recomendado de lectura:

1. [`STATUS.md`](STATUS.md)
2. [`docs/arquitectura-tecnica.md`](docs/arquitectura-tecnica.md)
3. [`docs/flujo-funcional.md`](docs/flujo-funcional.md)
4. [`docs/modelo-datos.md`](docs/modelo-datos.md)
5. [`docs/api-reference.md`](docs/api-reference.md)
6. [`docs/reglas-pricing.md`](docs/reglas-pricing.md)
7. [`docs/roles-permisos.md`](docs/roles-permisos.md)
8. [`docs/operacion-render-aiven.md`](docs/operacion-render-aiven.md)
9. [`docs/seguridad-riesgos.md`](docs/seguridad-riesgos.md)
10. [`docs/plan-estabilizacion.md`](docs/plan-estabilizacion.md)

## Trabajo pendiente prioritario

1. Rotar credenciales y dejar de publicar archivos internos.
2. Añadir timeouts y health check seguro.
3. Centralizar la numeración de cotizaciones.
4. Confirmar guardados remotos antes de informar éxito.
5. Sincronizar drivers antes de calcular.
6. Persistir desglose, exclusiones y versión de reglas.
7. Crear pruebas patrón y pruebas de roles y concurrencia.

El manual de usuario no forma parte de esta guía técnica. Se creará como trabajo separado cuando el diseño y los flujos estén estabilizados.

## Incorporación de cambios a Git

La documentación solo estará disponible para otros desarrolladores después de agregarla y confirmarla en Git. Antes de hacerlo, revisar el estado del repositorio:

```powershell
git status --short
```

No agregar `.env`, credenciales, certificados, archivos de carga, exportaciones ni temporales.
