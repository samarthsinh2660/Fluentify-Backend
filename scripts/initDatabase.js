require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function initializeDatabase() {
  console.log('🚀 Starting database initialization for PostgreSQL/Supabase...\n');

  try {
    // Read and execute progress tables SQL
    console.log('📋 Creating progress tracking tables...');
    const progressSql = fs.readFileSync(
      path.join(__dirname, '../sql/create_progress_tables.sql'),
      'utf8'
    );

    // Execute the entire SQL file (PostgreSQL can handle multiple statements)
    await db.query(progressSql);

    console.log('✅ Progress tracking tables created successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name IN (
        'unit_progress', 
        'lesson_progress', 
        'exercise_attempts', 
        'user_stats'
      )
      ORDER BY table_name
    `);

    console.log('\n📊 Created/Updated tables:');
    result.rows.forEach(table => {
      console.log(`  ✓ ${table.table_name}`);
    });

    console.log('\n✨ Database initialization complete!');
    console.log('\n📝 Next steps:');
    console.log('  1. Start the server: npm start');
    console.log('  2. Generate a course: POST /api/courses/generate');
    console.log('  3. Track progress: POST /api/progress/courses/:courseId/units/:unitId/lessons/:lessonId/complete\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

initializeDatabase();
