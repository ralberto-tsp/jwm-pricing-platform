const fs = require("fs");
const mysql = require("mysql2/promise");

function buildSslConfig(){
    if(String(process.env.DB_SSL || "").toLowerCase() !== "true"){
        return undefined;
    }

    const ssl = {
        rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "true").toLowerCase() !== "false"
    };

    if(process.env.DB_SSL_CA){
        ssl.ca = process.env.DB_SSL_CA.replace(/\\n/g, "\n");
    }

    if(process.env.DB_SSL_CA_FILE && fs.existsSync(process.env.DB_SSL_CA_FILE)){
        ssl.ca = fs.readFileSync(process.env.DB_SSL_CA_FILE, "utf8");
    }

    return ssl;
}

const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "jwm_pricing",
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    namedPlaceholders: true,
    ssl: buildSslConfig()
});

async function pingDatabase(){
    const connection = await pool.getConnection();
    try{
        await connection.ping();
        return true;
    }finally{
        connection.release();
    }
}

module.exports = {
    pool,
    pingDatabase
};
