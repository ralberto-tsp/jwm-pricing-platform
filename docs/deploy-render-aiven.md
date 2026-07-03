# Publicacion gratuita V1 - Render + Aiven MySQL

## Objetivo

Publicar JWM Pricing Platform como web de prueba usando:

- GitHub para guardar el proyecto.
- Render para ejecutar Node/Express.
- Aiven para MySQL gratuito.

## 1. Crear MySQL en Aiven

1. Entra a Aiven.
2. Crea un servicio nuevo.
3. Selecciona `MySQL`.
4. Usa el plan gratuito disponible.
5. Cuando termine de crearse, abre la seccion de conexion.
6. Copia estos datos:
   - Host
   - Port
   - User
   - Password
   - Database
   - CA certificate

## 2. Crear tablas en Aiven

Ejecuta el contenido de:

```text
sql/schema.sql
```

Si Aiven ya trae una base por defecto, puedes usarla cambiando `DB_NAME` en Render o ejecutando el script contra esa base.

## 3. Subir proyecto a GitHub

Desde GitHub:

1. Crea un repositorio nuevo.
2. Nombre sugerido: `jwm-pricing-platform`.
3. No subas `.env`.

Este proyecto ya incluye `.gitignore` para evitar subir credenciales.

## 4. Crear Web Service en Render

1. Entra a Render.
2. Crea `New Web Service`.
3. Conecta tu repositorio de GitHub.
4. Usa:
   - Build Command: `pnpm install --frozen-lockfile`
   - Start Command: `pnpm start`
   - Plan: Free

## 5. Variables de entorno en Render

Configura:

```text
DB_HOST=host_de_aiven
DB_PORT=puerto_de_aiven
DB_USER=usuario_de_aiven
DB_PASSWORD=password_de_aiven
DB_NAME=base_de_datos_de_aiven
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
DB_SSL_CA=pegar_certificado_CA_de_aiven
```

Si hay problemas con el certificado durante la prueba, temporalmente se puede usar:

```text
DB_SSL_REJECT_UNAUTHORIZED=false
```

Para V1 final conviene dejarlo en `true`.

## 6. Verificar

Cuando Render publique, abre:

```text
https://tu-app.onrender.com/api/health
```

Debe responder:

```json
{
  "ok": true,
  "database": "connected"
}
```

Luego abre:

```text
https://tu-app.onrender.com/
```

## 7. Flujo de prueba

1. Cargar drivers desde Excel.
2. Guardar driver.
3. Crear cotizacion.
4. Guardar cotizacion.
5. Revisar historial.
6. Abrir resumen ejecutivo.
7. Generar PDF.

## Nota

Render Free puede dormir por inactividad. La primera carga puede tardar mas de lo normal.
