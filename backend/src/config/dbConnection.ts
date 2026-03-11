import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

const PORT = parseInt(process.env.DB_PORT || "5432", 10);

export const dbConnection = async () => {
  const client = new Client({
    host: process.env.DB_HOST || "postgres",
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, // Fixed the variable name
    database: process.env.DB_NAME,
    port: PORT,
  });

  try {
    await client.connect();
    console.log("✅ PostgreSQL Connected Successfully");
  } catch (err) {
    console.error("❌ PostgreSQL Connection Error:", err);
  } finally {
    await client.end();
  }
};
