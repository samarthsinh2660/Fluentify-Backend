import "dotenv/config";
import express from "express";
import cors from "cors";

import db, { connectToDatabase, gracefulShutdown } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import preferencesRoutes from './routes/preferences.js';
import courseRoutes from './routes/courses.js';
import progressRoutes from './routes/progress.js';
import retellRoutes from './routes/retellRoutes.js';
import chatRoutes from './routes/chat.js';
import contestRoutes from './routes/contests.js';
import userManagementRoutes from './routes/userManagement.js';
import { errorHandler, notFoundHandler } from './middlewares/errorMiddleware.js';

const app = express();
const port = process.env.PORT || 5000;

// Configure server timeouts for long-running SSE connections
app.set('timeout', 900000); // 15 minutes timeout

// Configure CORS
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      // Return false instead of throwing error for proper CORS handling
      return callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Root check
app.get("/", (req, res) => {
  res.json({ status: "Backend is running 🚀" });
});

// Health check endpoint (for Docker)
app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.status(200).json({ 
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({ 
      status: "unhealthy",
      database: "disconnected",
      error: err.message 
    });
  }
});

// DB check route (detailed)
app.get("/db-check", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW(), version() as db_version");
    res.json({
      status: "✅ Connected to PostgreSQL!",
      time: result.rows[0].now,
      version: result.rows[0].db_version,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (err) {
    res.status(500).json({ status: "❌ DB connection failed", error: err.message });
  }
});

// Auth routes
app.use("/api/auth", authRoutes);
// Preferences routes
app.use('/api/preferences', preferencesRoutes);
// Course routes
app.use('/api/courses', courseRoutes);
// Progress routes
app.use('/api/progress', progressRoutes);
// Retell AI routes
app.use('/api/retell', retellRoutes);
// Chat routes
app.use('/api/chat', chatRoutes);
// Contest routes
app.use('/api/contests', contestRoutes);
// User management routes (admin only)
app.use('/api/admin/users', userManagementRoutes);

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// Start server with database connection
const startServer = async () => {
  await connectToDatabase();
  
  app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await gracefulShutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await gracefulShutdown();
  process.exit(0);
});

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
