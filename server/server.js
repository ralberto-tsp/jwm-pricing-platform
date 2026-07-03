require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const { pool, pingDatabase } = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const rootDir = path.resolve(__dirname, "..");

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.static(rootDir));

app.get("/api/health", async function(req, res){
    try{
        await pingDatabase();
        res.json({ ok: true, database: "connected" });
    }catch(error){
        res.status(503).json({ ok: false, database: "disconnected", message: error.message });
    }
});

app.get("/api/drivers/:name", async function(req, res){
    try{
        const [rows] = await pool.execute(
            "SELECT data FROM driver_records WHERE driver_name = :name ORDER BY sort_order ASC, id ASC",
            { name: req.params.name }
        );
        res.json(rows.map(function(row){ return parseJson(row.data); }));
    }catch(error){
        sendError(res, error);
    }
});

app.put("/api/drivers/:name", async function(req, res){
    const records = Array.isArray(req.body.records) ? req.body.records : [];
    const connection = await pool.getConnection();
    try{
        await connection.beginTransaction();
        await connection.execute(
            "INSERT INTO drivers (name, label) VALUES (:name, :label) ON DUPLICATE KEY UPDATE label = VALUES(label)",
            { name: req.params.name, label: req.body.label || req.params.name }
        );
        await connection.execute("DELETE FROM driver_records WHERE driver_name = :name", { name: req.params.name });
        for(let index = 0; index < records.length; index++){
            await connection.execute(
                "INSERT INTO driver_records (driver_name, sort_order, data) VALUES (:name, :sortOrder, CAST(:data AS JSON))",
                { name: req.params.name, sortOrder: index + 1, data: JSON.stringify(records[index]) }
            );
        }
        await connection.commit();
        res.json({ ok: true, count: records.length });
    }catch(error){
        await connection.rollback();
        sendError(res, error);
    }finally{
        connection.release();
    }
});

app.get("/api/cotizaciones", async function(req, res){
    try{
        const [rows] = await pool.execute(
            "SELECT numero, fecha, cliente, origen, destino, tipo_servicio AS tipoServicio, configuracion, tarifa, costo_integral AS costoIntegral, data FROM cotizaciones ORDER BY updated_at DESC"
        );
        res.json(rows.map(mapCotizacionRow));
    }catch(error){
        sendError(res, error);
    }
});

app.get("/api/cotizaciones/:numero", async function(req, res){
    try{
        const [rows] = await pool.execute(
            "SELECT numero, fecha, cliente, origen, destino, tipo_servicio AS tipoServicio, configuracion, tarifa, costo_integral AS costoIntegral, data FROM cotizaciones WHERE numero = :numero LIMIT 1",
            { numero: req.params.numero }
        );
        if(rows.length === 0){
            res.status(404).json({ message: "Cotizacion no encontrada." });
            return;
        }
        res.json(mapCotizacionRow(rows[0]));
    }catch(error){
        sendError(res, error);
    }
});

app.post("/api/cotizaciones", async function(req, res){
    try{
        const cotizacion = req.body || {};
        if(!cotizacion.numero){
            res.status(400).json({ message: "La cotizacion necesita numero." });
            return;
        }
        await pool.execute(
            `INSERT INTO cotizaciones
            (numero, fecha, cliente, origen, destino, tipo_servicio, configuracion, tarifa, costo_integral, data)
            VALUES (:numero, :fecha, :cliente, :origen, :destino, :tipoServicio, :configuracion, :tarifa, :costoIntegral, CAST(:data AS JSON))
            ON DUPLICATE KEY UPDATE
                fecha = VALUES(fecha),
                cliente = VALUES(cliente),
                origen = VALUES(origen),
                destino = VALUES(destino),
                tipo_servicio = VALUES(tipo_servicio),
                configuracion = VALUES(configuracion),
                tarifa = VALUES(tarifa),
                costo_integral = VALUES(costo_integral),
                data = VALUES(data),
                updated_at = CURRENT_TIMESTAMP`,
            {
                numero: cotizacion.numero,
                fecha: cotizacion.fecha || null,
                cliente: cotizacion.cliente || "",
                origen: cotizacion.origen || "",
                destino: cotizacion.destino || "",
                tipoServicio: cotizacion.tipoServicio || "",
                configuracion: cotizacion.configuracion || "",
                tarifa: normalizeMoney(cotizacion.tarifa),
                costoIntegral: cotizacion.costoIntegral || "",
                data: JSON.stringify(cotizacion)
            }
        );
        res.json({ ok: true, numero: cotizacion.numero });
    }catch(error){
        sendError(res, error);
    }
});

app.use(function(req, res){
    res.sendFile(path.join(rootDir, "index.html"));
});

app.listen(PORT, function(){
    console.log("JWM Pricing Platform listo en http://localhost:" + PORT);
});

function parseJson(value){
    if(value && typeof value === "object"){
        return value;
    }
    try{
        return JSON.parse(value || "{}");
    }catch(error){
        return {};
    }
}

function mapCotizacionRow(row){
    const data = parseJson(row.data);
    return Object.assign({}, data, {
        numero: row.numero || data.numero,
        fecha: row.fecha || data.fecha,
        cliente: row.cliente || data.cliente,
        origen: row.origen || data.origen,
        destino: row.destino || data.destino,
        tipoServicio: row.tipoServicio || data.tipoServicio,
        configuracion: row.configuracion || data.configuracion,
        tarifa: row.tarifa || data.tarifa,
        costoIntegral: row.costoIntegral || data.costoIntegral
    });
}

function normalizeMoney(value){
    const normalized = Number(String(value || "").replace("S/", "").replace(",", "").trim());
    return Number.isFinite(normalized) ? normalized : null;
}

function sendError(res, error){
    console.error(error);
    res.status(500).json({ message: error.message || "Error interno" });
}
