import "dotenv/config";
import { Pool } from "pg";

// Supabase PostgreSQL connection configuration
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000, // Increased to 30 seconds for Supabase reliability
});

pool.on("error", (err) => {
  console.error("❌ Database error:", err.message);
});

export const connectToDatabase = async (retries = 5, delay = 2000) => {
  while (retries > 0) {
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      console.log(
        `✅ PostgreSQL connected successfully in ${
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
