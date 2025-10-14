import "dotenv/config";
import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase.co') ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('❌ Database error:', err.message);
});

export const connectToDatabase = async (retries = 5, delay = 2000) => {
  while (retries > 0) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log(`✅ PostgreSQL connected successfully in ${process.env.NODE_ENV || 'development'}`);
      return;
    } catch (error) {
      retries--;
      console.warn(`⚠️ PostgreSQL connection failed. Retries left: ${retries}`);
      if (retries > 0) {
        console.log(`🔁 Retrying in ${delay / 1000} seconds...`);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }
  
  console.error("❌ Could not connect to PostgreSQL after multiple attempts. Exiting...");
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
