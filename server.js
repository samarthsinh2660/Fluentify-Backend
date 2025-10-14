require("dotenv").config();
const express = require("express");
const cors = require("cors");

const db = require("./config/db"); 
const authRoutes = require("./routes/auth");
const preferencesRoutes = require('./routes/preferences');
const courseRoutes = require('./routes/courses');
const progressRoutes = require('./routes/progress');
const { errorHandler, notFoundHandler } = require('./middlewares/errorMiddleware');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Root check
app.get("/", (req, res) => {
  res.json({ status: "Backend is running 🚀" });
});

// DB check route
app.get("/db-check", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");
    res.json({
      status: "✅ Connected to Supabase Postgres!",
      time: result.rows[0].now,
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

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
