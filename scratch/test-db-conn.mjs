import "dotenv/config";
import mysql from "mysql2/promise";

async function test() {
  const host = "caboose.proxy.rlwy.net";
  const user = "root";
  const password = "xDrjPUqarmAoIJjyoYJlTSMGgRyZJdpL";
  const database = "railway";
  const port = 39708;

  try {
    const db = await mysql.createConnection({ host, user, password, database, port });
    console.log("SUCCESS: Connected to Railway!");
    await db.end();
  } catch (err) {
    console.error("FAILED: Could not connect to Railway.", err.message);
    
    // Try shinkansen as mentioned in walkthrough
    const host2 = "shinkansen.proxy.rlwy.net";
    try {
        const db = await mysql.createConnection({ host: host2, user, password, database, port });
        console.log("SUCCESS: Connected to Railway (shinkansen)!");
        await db.end();
    } catch (err2) {
        console.error("FAILED: Could not connect to Railway (shinkansen).", err2.message);
    }
  }
}

test();
