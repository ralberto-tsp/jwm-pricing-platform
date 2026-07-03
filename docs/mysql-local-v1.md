# JWM Pricing Platform - MySQL Local V1

## 1. Instalar MySQL local

Opciones recomendadas:

- XAMPP: iniciar el servicio `MySQL`.
- MySQL Installer: instalar `MySQL Server` y `MySQL Workbench`.
- WAMP/MAMP: iniciar el servicio `MySQL`.

Para la configuracion inicial el proyecto usa:

- Host: `127.0.0.1`
- Puerto: `3306`
- Usuario: `root`
- Password: vacio
- Base de datos: `jwm_pricing`

Si tu MySQL tiene password, cambia `DB_PASSWORD` en `.env`.

## 2. Crear base de datos

Ejecuta el archivo:

```sql
sql/schema.sql
```

Puedes ejecutarlo desde MySQL Workbench, phpMyAdmin o consola MySQL.

## 3. Levantar el sistema local con backend

Desde la carpeta del proyecto:

```powershell
.\iniciar-local.ps1
```

Abrir:

```text
http://localhost:3000/
```

## 4. Verificar conexion

Abrir:

```text
http://localhost:3000/api/health
```

Si responde `database: connected`, MySQL esta conectado.

## 5. Que guarda en MySQL en esta primera conexion

- Drivers completos por modulo.
- Cotizaciones guardadas.
- Historial de cotizaciones.

El sistema mantiene respaldo en el navegador si MySQL no esta disponible.
