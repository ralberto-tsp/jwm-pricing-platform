require("dotenv").config();

const { pool } = require("./db");

const statements = [
    `CREATE TABLE IF NOT EXISTS drivers (
        name VARCHAR(80) PRIMARY KEY,
        label VARCHAR(160) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS driver_records (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        driver_name VARCHAR(80) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_driver_records_driver
            FOREIGN KEY (driver_name)
            REFERENCES drivers(name)
            ON DELETE CASCADE,
        INDEX idx_driver_records_name_order (driver_name, sort_order)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS cotizaciones (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        numero VARCHAR(40) NOT NULL UNIQUE,
        fecha DATE NULL,
        cliente VARCHAR(180) NULL,
        origen VARCHAR(160) NULL,
        destino VARCHAR(160) NULL,
        tipo_servicio VARCHAR(120) NULL,
        configuracion VARCHAR(160) NULL,
        tarifa DECIMAL(14,2) NULL,
        costo_integral VARCHAR(80) NULL,
        data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_cotizaciones_fecha (fecha),
        INDEX idx_cotizaciones_cliente (cliente),
        INDEX idx_cotizaciones_ruta (origen, destino)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS cotizacion_costos (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        cotizacion_numero VARCHAR(40) NOT NULL,
        grupo VARCHAR(120) NOT NULL,
        concepto VARCHAR(160) NOT NULL,
        subconcepto VARCHAR(220) NULL,
        costo DECIMAL(14,2) NOT NULL DEFAULT 0,
        porcentaje DECIMAL(8,4) NOT NULL DEFAULT 0,
        excluido TINYINT(1) NOT NULL DEFAULT 0,
        data JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_cotizacion_costos_cotizacion
            FOREIGN KEY (cotizacion_numero)
            REFERENCES cotizaciones(numero)
            ON DELETE CASCADE,
        INDEX idx_cotizacion_costos_numero (cotizacion_numero)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS usuarios (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(120) NOT NULL,
        email VARCHAR(180) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        rol VARCHAR(40) NOT NULL DEFAULT 'usuario',
        activo TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`
];

async function initDatabase(){
    for(const statement of statements){
        await pool.query(statement);
    }

    const [tables] = await pool.query("SHOW TABLES");
    return tables.map((row) => Object.values(row)[0]);
}

initDatabase()
    .then(async (tables) => {
        console.log(`Tablas listas: ${tables.join(", ")}`);
        await pool.end();
    })
    .catch(async (error) => {
        console.error(error.message);
        try{
            await pool.end();
        }catch(_error){
            // Nothing else to close.
        }
        process.exit(1);
    });
