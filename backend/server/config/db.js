import mysql from "mysql2/promise";
import "dotenv/config";

let pool;

export function getPool() {
  if (!pool) {
    const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
    if (url) {
      pool = mysql.createPool({ uri: url, connectTimeout: 15000 });
    } else {
      const host = process.env.MYSQL_HOST || "localhost";
      const port = process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306;
      const user = process.env.MYSQL_USER || "root";
      const password = process.env.MYSQL_PASSWORD || "";
      const database = process.env.MYSQL_DATABASE || "lms";
      const useSsl =
        process.env.MYSQL_SSL === "1" ||
        process.env.MYSQL_SSL === "true" ||
        /rds\.amazonaws\.com/i.test(host);
      const sslConfig =
        useSsl && process.env.MYSQL_SSL_REJECT_UNAUTHORIZED === "0"
          ? { rejectUnauthorized: false }
          : useSsl
            ? {}
            : undefined;
      pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        connectTimeout: 15000,
        ...(sslConfig !== undefined ? { ssl: sslConfig } : {}),
      });
    }
  }
  return pool;
}

export default getPool;
