const crypto = require("crypto");

const SESSION_COOKIE = "jwm_session";
const SESSION_DAYS = 7;
const ROLES = {
    admin: ["cotizacion", "resultado", "resumen", "historial", "drivers", "usuarios"],
    comercial: ["cotizacion", "resultado", "resumen", "historial"],
    consulta: ["resumen", "historial"]
};

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")){
    return new Promise((resolve, reject) => {
        crypto.scrypt(String(password || ""), salt, 64, function(error, derivedKey){
            if(error){
                reject(error);
                return;
            }
            resolve("scrypt:" + salt + ":" + derivedKey.toString("hex"));
        });
    });
}

async function verifyPassword(password, storedHash){
    const parts = String(storedHash || "").split(":");
    if(parts.length !== 3 || parts[0] !== "scrypt"){
        return false;
    }

    const expected = await hashPassword(password, parts[1]);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(storedHash));
}

function getCookie(req, name){
    const raw = req.headers.cookie || "";
    const cookies = raw.split(";").map((item) => item.trim());
    const match = cookies.find((item) => item.startsWith(name + "="));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function setSessionCookie(res, token){
    const secure = String(process.env.COOKIE_SECURE || "").toLowerCase() === "true";
    const parts = [
        SESSION_COOKIE + "=" + encodeURIComponent(token),
        "HttpOnly",
        "SameSite=Lax",
        "Path=/",
        "Max-Age=" + SESSION_DAYS * 24 * 60 * 60
    ];

    if(secure){
        parts.push("Secure");
    }

    res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res){
    res.setHeader("Set-Cookie", SESSION_COOKIE + "=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

async function createSession(pool, userId){
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await pool.execute(
        "INSERT INTO user_sessions (token, user_id, expires_at) VALUES (:token, :userId, :expiresAt)",
        { token, userId, expiresAt }
    );
    return token;
}

async function loadUserFromRequest(pool, req){
    const token = getCookie(req, SESSION_COOKIE);
    if(!token){
        return null;
    }

    const [rows] = await pool.execute(
        `SELECT u.id, u.nombre, u.email, u.rol, u.activo
         FROM user_sessions s
         INNER JOIN usuarios u ON u.id = s.user_id
         WHERE s.token = :token AND s.expires_at > CURRENT_TIMESTAMP AND u.activo = 1
         LIMIT 1`,
        { token }
    );

    return rows[0] || null;
}

function authRequired(pool){
    return async function(req, res, next){
        try{
            const user = await loadUserFromRequest(pool, req);
            if(!user){
                res.status(401).json({ message: "Sesion no iniciada." });
                return;
            }
            req.user = user;
            next();
        }catch(error){
            next(error);
        }
    };
}

function roleRequired(roles){
    return function(req, res, next){
        if(!req.user || !roles.includes(req.user.rol)){
            res.status(403).json({ message: "No tienes permiso para esta accion." });
            return;
        }
        next();
    };
}

function publicUser(user){
    if(!user){
        return null;
    }
    return {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        pantallas: ROLES[user.rol] || []
    };
}

function canAccessView(user, view){
    return Boolean(user && (ROLES[user.rol] || []).includes(view));
}

module.exports = {
    SESSION_COOKIE,
    ROLES,
    hashPassword,
    verifyPassword,
    getCookie,
    setSessionCookie,
    clearSessionCookie,
    createSession,
    loadUserFromRequest,
    authRequired,
    roleRequired,
    publicUser,
    canAccessView
};
