import "dotenv/config";
import mysql from "mysql2/promise";

async function test() {
  const host = "shinkansen.proxy.rlwy.net";
  const user = "root";
  const password = "xDrjPUqarmAoIJjyoYJlTSMGgRyZJdpL";
  const database = "railway";
  const port = 53040;

  console.log(`Connecting to ${host}:${port} as ${user}...`);

  try {
    const db = await mysql.createConnection({ 
        host, 
        user, 
        password, 
        database, 
        port,
        connectTimeout: 20000 
    });
    console.log("SUCCESS: Connected to Railway!");
    await db.end();
  } catch (err) {
    console.error("FAILED: Could not connect to Railway.", err.message);
    
    // Try 'lms' database just in case
    try {
        const db = await mysql.createConnection({ 
            host, 
            user, 
            password, 
            database: "lms", 
            port,
            connectTimeout: 20000 
        });
        console.log("SUCCESS: Connected to Railway (database: lms)!");
        await db.end();
    } catch (err2) {
        console.error("FAILED: Could not connect to Railway (lms).", err2.message);
    }
  }
}

test();
