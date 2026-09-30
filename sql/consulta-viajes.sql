CREATE TABLE IF NOT EXISTS consulta_viajes_lotes (
    id CHAR(64) PRIMARY KEY,
    metadata JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS consulta_viajes_activo (
    id TINYINT PRIMARY KEY,
    lote_id CHAR(64) NOT NULL,
    FOREIGN KEY (lote_id) REFERENCES consulta_viajes_lotes(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS consulta_viajes_ot (
    lote_id CHAR(64) NOT NULL,
    ot VARCHAR(120) NOT NULL,
    fecha DATE NULL,
    resumen JSON NOT NULL,
    detalle JSON NOT NULL,
    PRIMARY KEY (lote_id, ot),
    INDEX idx_consulta_fecha (lote_id, fecha),
    FOREIGN KEY (lote_id) REFERENCES consulta_viajes_lotes(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS consulta_viajes_ejecuciones (
    lote_id CHAR(64) NOT NULL,
    ot VARCHAR(120) NOT NULL,
    ordinal INT NOT NULL,
    fecha DATE NULL,
    origen VARCHAR(500) NOT NULL,
    destino VARCHAR(500) NOT NULL,
    unidad VARCHAR(200) NOT NULL,
    modalidad VARCHAR(120) NOT NULL,
    carga TEXT NOT NULL,
    departamento VARCHAR(200) NOT NULL,
    lugar_descarga VARCHAR(500) NOT NULL,
    PRIMARY KEY (lote_id, ot, ordinal),
    INDEX idx_consulta_ot_fecha (lote_id, ot, fecha),
    FOREIGN KEY (lote_id, ot) REFERENCES consulta_viajes_ot(lote_id, ot)
) ENGINE=InnoDB;
