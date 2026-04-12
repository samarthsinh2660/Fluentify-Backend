import "dotenv/config";
import { Pool } from "pg";

// ─── Detect environment ─────────────────────────────────────────────────────
// DB_MODE=docker  → local Docker PostgreSQL (no SSL)
// DB_MODE=supabase (or unset) → Supabase cloud PostgreSQL (SSL required)
const mode = (process.env.DB_MODE || "supabase").toLowerCase();

const poolConfig =
  mode === "docker"
    ? {
        // Docker / local PostgreSQL
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432"),
        database: process.env.DB_NAME || "fluentify",
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "postgres",
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
    : {
        // Supabase cloud PostgreSQL
        connectionString: process.env.DATABASE_URL,
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 30000,
      };

export const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  console.error("❌ Database error:", err.message);
});

export const connectToDatabase = async (retries = 5, delay = 2000) => {
  console.log(`🔧 DB mode: ${mode}`);
  while (retries > 0) {
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      console.log(
        `✅ PostgreSQL connected successfully [${mode}] in ${
          process.env.NODE_ENV || "development"
        }`
      );
      return;
    } catch (error) {
      console.error(`❌ Database connection error:`, error.message);
      console.error(`❌ Error code:`, error.code);
      console.error(`❌ Error details:`, error);
      retries--;
      console.warn(`⚠️ PostgreSQL connection failed. Retries left: ${retries}`);
      if (retries > 0) {
        console.log(`🔁 Retrying in ${delay / 1000} seconds...`);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  console.error(
    "❌ Could not connect to PostgreSQL after multiple attempts. Exiting..."
  );
  process.exit(1);
};

export const gracefulShutdown = async () => {
  console.log("🔄 Shutting down database connections...");
  try {
    await pool.end();
    console.log("✅ Database connections closed successfully");
  } catch (error) {
    console.error("❌ Error during database shutdown:", error);
  }
};

export default { query: (text, params) => pool.query(text, params) };
