# Fluentify Backend

AI-powered language learning platform backend built with Node.js, Express, and PostgreSQL.

## 🚀 Quick Start with Docker

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Backend
   ```

2. **Start the application**
   ```bash
   docker-compose up --build
   ```

3. **Access the application**
   - Backend API: http://localhost:5000
   - Health Check: http://localhost:5000/health
   - PostgreSQL: localhost:5432

That's it! The database will be automatically initialized with all tables.

## 📝 Environment Variables

All configuration is in the `.env` file:

```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/fluentify
PORT=5000
NODE_ENV=development
JWT_SECRET=<your-secret>
GEMINI_API_KEY=<your-api-key>
```

## 🛠️ Development

### Hot Reload
Code changes in the `src/` directory are automatically detected and the server restarts.

### View Logs
```bash
docker-compose logs -f
```

### Stop Services
```bash
docker-compose down
```

### Reset Database
```bash
docker-compose down -v
docker-compose up --build
```

## 📊 Database

**PostgreSQL 16** is used with the following tables:
- `learners` - User accounts
- `admins` - Administrator accounts
- `learner_preferences` - User language preferences
- `courses` - Generated language courses (with JSONB data)
- `unit_progress` - Progress tracking for units
- `lesson_progress` - Progress tracking for lessons
- `exercise_attempts` - Exercise completion tracking
- `user_stats` - User XP and statistics

Tables are automatically created on first startup from `src/database/01-tables.sql`.

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/signup/learner` - Learner signup
- `POST /api/auth/signup/admin` - Admin signup
- `POST /api/auth/login/learner` - Learner login
- `POST /api/auth/login/admin` - Admin login
- `GET /api/auth/profile` - Get user profile

### Preferences
- `POST /api/preferences/learner` - Save preferences
- `GET /api/preferences/learner` - Get preferences
- `PUT /api/preferences/learner` - Update preferences
- `DELETE /api/preferences/learner` - Delete preferences

### Courses
- `POST /api/courses/generate` - Generate new course
- `GET /api/courses` - Get learner's courses
- `GET /api/courses/:courseId` - Get course details
- `GET /api/courses/:courseId/lessons/:lessonId` - Get lesson details
- `POST /api/courses/:courseId/lessons/:lessonId/complete` - Complete lesson

### Progress
- `GET /api/progress/courses` - Get all courses
- `GET /api/progress/courses/:courseId` - Get course progress
- `POST /api/progress/courses/:courseId/units/:unitId/lessons/:lessonId/complete` - Mark lesson complete

## 🧪 Testing

### Test Gemini AI Integration
```bash
docker exec -it fluentify-backend npm run test-gemini
```

### Access Backend Shell
```bash
docker exec -it fluentify-backend sh
```

### Access Database Shell
```bash
docker exec -it fluentify-postgres psql -U postgres -d fluentify

# Once inside PostgreSQL shell:
\l              # List all databases
\dt             # List all tables
\d table_name   # Describe a table
SELECT * FROM learners;  # Query data
\q              # Exit
```

## 🏗️ Project Structure

```
Backend/
├── src/
│   ├── config/           # Database configuration
│   ├── controllers/      # Request handlers
│   ├── database/         # SQL schema files
│   ├── middlewares/      # Express middlewares
│   ├── repositories/     # Data access layer
│   ├── routes/           # API routes
│   ├── services/         # Business logic (Gemini AI)
│   ├── utils/            # Utilities (JWT, errors, responses)
│   └── server.js         # Main application file
├── docker-compose.yml    # Docker orchestration
├── Dockerfile           # Docker image definition
├── .env                 # Environment variables
└── package.json         # Dependencies
```

## 🔧 Tech Stack

- **Runtime**: Node.js 22
- **Framework**: Express.js
- **Database**: PostgreSQL 16
- **AI**: Google Gemini API
- **Authentication**: JWT
- **Container**: Docker & Docker Compose

## 📚 Features

- 🤖 AI-powered course generation using Google Gemini
- 🔐 JWT-based authentication
- 📊 Progress tracking with XP and streaks
- 🎯 Unit and lesson management
- 📈 User statistics and achievements
- 🔄 Hot-reload development environment

## 🐛 Troubleshooting

### Services won't start?
```bash
docker-compose logs
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Port already in use?
Change ports in `docker-compose.yml`:
```yaml
ports:
  - "3000:5000"  # Change left side to different port
```

### Database issues?
```bash
# Check database logs
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up --build
```

## 📄 License

MIT

## 🤝 Contributing

Pull requests are welcome!
