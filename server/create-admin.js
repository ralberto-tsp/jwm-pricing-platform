require("dotenv").config();

const { pool } = require("./db");
const { hashPassword } = require("./auth");

const nombre = process.env.ADMIN_NAME || "Administrador JWM";
const email = (process.env.ADMIN_EMAIL || "ralberto@transportesjwm.pe").toLowerCase();
const password = process.env.ADMIN_PASSWORD || "JWM-Admin-2026!";

async function createAdmin(){
    const passwordHash = await hashPassword(password);
    await pool.execute(
        `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
         VALUES (:nombre, :email, :passwordHash, 'admin', 1)
         ON DUPLICATE KEY UPDATE
            nombre = VALUES(nombre),
            password_hash = VALUES(password_hash),
            rol = 'admin',
            activo = 1`,
        { nombre, email, passwordHash }
    );
    console.log(`Administrador listo: ${email}`);
}

createAdmin()
    .then(async () => {
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
