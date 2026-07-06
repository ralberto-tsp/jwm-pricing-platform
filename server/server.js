require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const { pool, pingDatabase } = require("./db");
const {
    hashPassword,
    verifyPassword,
    getCookie,
    setSessionCookie,
    clearSessionCookie,
    createSession,
    loadUserFromRequest,
    authRequired,
    roleRequired,
    publicUser
} = require("./auth");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const rootDir = path.resolve(__dirname, "..");

app.use(cors({
    origin: function(origin, callback){
        if(!origin || isAllowedOrigin(origin)){
            callback(null, true);
            return;
        }
        callback(new Error("Origen no permitido por CORS."));
    },
    credentials: true
}));
app.use(express.json({ limit: "25mb" }));
app.use(function(req, res, next){
    if(req.path === "/" || req.path.endsWith(".html") || req.path.startsWith("/js/")){
        res.setHeader("Cache-Control", "no-store");
    }
    next();
});
app.use(express.static(rootDir));

const requireAuth = authRequired(pool);
const requireAdmin = roleRequired(["admin"]);
const requireCommercial = roleRequired(["admin", "comercial"]);
const requireReadAccess = roleRequired(["admin", "comercial", "consulta"]);

app.get("/api/health", async function(req, res){
    try{
        await pingDatabase();
        res.json({ ok: true, database: "connected", dbHost: databaseHostInfo() });
    }catch(error){
        res.status(503).json({ ok: false, database: "disconnected", dbHost: databaseHostInfo(), message: error.message });
    }
});

app.post("/api/auth/login", async function(req, res){
    try{
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");
        if(!email || !password){
            res.status(400).json({ message: "Ingresa correo y contrasena." });
            return;
        }

        const [rows] = await pool.execute(
            "SELECT id, nombre, email, password_hash, rol, activo FROM usuarios WHERE email = :email LIMIT 1",
            { email }
        );
        const user = rows[0];
        if(!user || !user.activo || !(await verifyPassword(password, user.password_hash))){
            res.status(401).json({ message: "Correo o contrasena incorrectos." });
            return;
        }

        const token = await createSession(pool, user.id);
        await pool.execute("UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = :id", { id: user.id });
        setSessionCookie(res, token);
        res.json({ ok: true, user: publicUser(user) });
    }catch(error){
        sendError(res, error);
    }
});

app.post("/api/auth/logout", requireAuth, async function(req, res){
    try{
        const token = getCookie(req, "jwm_session");
        if(token){
            await pool.execute("DELETE FROM user_sessions WHERE token = :token", { token });
        }
        clearSessionCookie(res);
        res.json({ ok: true });
    }catch(error){
        sendError(res, error);
    }
});

app.get("/api/auth/me", async function(req, res){
    try{
        const user = await loadUserFromRequest(pool, req);
        if(!user){
            res.status(401).json({ message: "Sesion no iniciada." });
            return;
        }
        res.json({ user: publicUser(user) });
    }catch(error){
        sendError(res, error);
    }
});

app.get("/api/usuarios", requireAuth, requireAdmin, async function(req, res){
    try{
        const [rows] = await pool.execute(
            "SELECT id, nombre, email, rol, activo, ultimo_acceso AS ultimoAcceso, created_at AS creado FROM usuarios ORDER BY nombre ASC"
        );
        res.json(rows);
    }catch(error){
        sendError(res, error);
    }
});

app.post("/api/usuarios", requireAuth, requireAdmin, async function(req, res){
    try{
        const nombre = String(req.body.nombre || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const rol = ["admin", "comercial", "consulta"].includes(req.body.rol) ? req.body.rol : "consulta";
        const password = String(req.body.password || "");
        if(!nombre || !email){
            res.status(400).json({ message: "Nombre y correo son obligatorios." });
            return;
        }
        if(!req.body.id && password.length < 8){
            res.status(400).json({ message: "La contrasena debe tener al menos 8 caracteres." });
            return;
        }

        if(req.body.id){
            const params = {
                id: Number(req.body.id),
                nombre,
                email,
                rol,
                activo: req.body.activo ? 1 : 0
            };
            let sql = "UPDATE usuarios SET nombre = :nombre, email = :email, rol = :rol, activo = :activo";
            if(password){
                sql += ", password_hash = :passwordHash";
                params.passwordHash = await hashPassword(password);
            }
            sql += " WHERE id = :id";
            await pool.execute(sql, params);
        }else{
            await pool.execute(
                "INSERT INTO usuarios (nombre, email, password_hash, rol, activo) VALUES (:nombre, :email, :passwordHash, :rol, 1)",
                { nombre, email, passwordHash: await hashPassword(password), rol }
            );
        }

        res.json({ ok: true });
    }catch(error){
        sendError(res, error);
    }
});

app.get("/api/drivers/:name", requireAuth, async function(req, res){
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

app.put("/api/drivers/:name", requireAuth, requireAdmin, async function(req, res){
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

app.get("/api/cotizaciones", requireAuth, requireReadAccess, async function(req, res){
    try{
        const [rows] = await pool.execute(
            "SELECT numero, fecha, cliente, origen, destino, tipo_servicio AS tipoServicio, configuracion, tarifa, costo_integral AS costoIntegral, data FROM cotizaciones ORDER BY updated_at DESC"
        );
        res.json(rows.map(mapCotizacionRow));
    }catch(error){
        sendError(res, error);
    }
});

app.get("/api/cotizaciones/:numero", requireAuth, requireReadAccess, async function(req, res){
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

app.post("/api/cotizaciones", requireAuth, requireCommercial, async function(req, res){
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

app.use("/api", function(error, req, res, next){
    console.error(error);
    res.status(500).json({ message: error.message || "Error interno del servidor." });
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

function databaseHostInfo(){
    return {
        host: process.env.DB_HOST || "127.0.0.1",
        port: process.env.DB_PORT || "3306",
        ssl: String(process.env.DB_SSL || "").toLowerCase() === "true"
    };
}

function isAllowedOrigin(origin){
    try{
        const url = new URL(origin);
        if(["localhost", "127.0.0.1"].includes(url.hostname)){
            return true;
        }
        const extraOrigins = String(process.env.ALLOWED_ORIGINS || "")
            .split(",")
            .map(function(item){ return item.trim(); })
            .filter(Boolean);
        return extraOrigins.includes(origin);
    }catch(error){
        return false;
    }
}
