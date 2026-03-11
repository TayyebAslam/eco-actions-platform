import knex from "knex";
import dotenv from "dotenv";
import { validateEnv } from "./envValidation";

dotenv.config();

// Security: Validate environment variables before connecting to database
const env = validateEnv();

const db = knex({
  client: "pg",
  connection: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  },
  pool: {
    min: 2,
    max: 10,
  },
});

export default db;
