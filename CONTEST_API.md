# Contest API Documentation

## Overview
Complete contest system with AI generation, manual creation, submissions, and leaderboards.

---

## Admin Endpoints

### 1. Generate Contest with AI
**POST** `/api/contests/generate`

**Auth:** Admin only

**Body:**
```json
{
  "language": "Spanish",
  "difficultyLevel": "Intermediate", // Beginner, Intermediate, Advanced
  "contestType": "mcq", // mcq, one-liner, mix
  "questionCount": 10,
  "topic": "Common Verbs", // Optional
  "title": "Spanish Verb Challenge", // Optional, AI generates if not provided
  "description": "Test your knowledge", // Optional
  "startDate": "2024-10-20T00:00:00Z",
  "endDate": "2024-10-27T23:59:59Z",
  "rewardPoints": 100,
  "maxAttempts": 1,
  "timeLimit": 30, // minutes, null for no limit
  "isPublished": false
}
```

### 2. Create Contest Manually
**POST** `/api/contests`

**Auth:** Admin only

**Body:**
```json
{
  "title": "French Grammar Quiz",
  "description": "Test your French grammar skills",
  "language": "French",
  "difficultyLevel": "Beginner",
  "contestType": "mcq",
  "questions": [
    {
      "type": "mcq",
      "question": "What is the correct article?",
      "options": ["A) le", "B) la", "C) les", "D) l'"],
      "correctAnswer": "B",
      "explanation": "La is feminine singular"
    }
  ],
  "startDate": "2024-10-20T00:00:00Z",
  "endDate": "2024-10-27T23:59:59Z",
  "rewardPoints": 100,
  "maxAttempts": 1,
  "timeLimit": 30,
  "isPublished": true
}
```

### 3. Get Admin Contests
**GET** `/api/contests/admin?language=Spanish&is_published=true`

**Auth:** Admin only

### 4. Update Contest
**PATCH** `/api/contests/:contestId`

**Auth:** Admin only

**Body:** Any contest field to update

### 5. Delete Contest
**DELETE** `/api/contests/:contestId`

**Auth:** Admin only

### 6. Get Contest Statistics
**GET** `/api/contests/:contestId/stats`

**Auth:** Admin only

**Response:**
```json
{
  "stats": {
    "totalParticipants": 45,
    "averageScore": 7.5,
    "highestScore": 10,
    "lowestScore": 3,
    "averagePercentage": 75.0
  }
}
```

---

## Learner Endpoints

### 1. Get Published Contests
**GET** `/api/contests?language=Spanish`

**Auth:** Learner

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "title": "Spanish Verb Challenge",
      "language": "Spanish",
      "difficultyLevel": "Intermediate",
      "contestType": "mcq",
      "totalQuestions": 10,
      "rewardPoints": 100,
      "timeLimit": 30,
      "totalParticipants": 45,
      "status": "active" // active, upcoming, ended
    }
  ]
}
```

### 2. Get Contest Details
**GET** `/api/contests/:contestId`

**Auth:** Learner

**Note:** Questions returned without correct answers

### 3. Submit Contest
**POST** `/api/contests/:contestId/submit`

**Auth:** Learner

**Body:**
```json
{
  "answers": ["A", "B", "C", "D", "A", "B", "C", "D", "A", "B"],
  "timeTaken": 1200 // seconds
}
```

**Response:**
```json
{
  "submission": {
    "score": 8,
    "totalCorrect": 8,
    "totalQuestions": 10,
    "percentage": 80.0,
    "results": [
      {
        "questionIndex": 0,
        "userAnswer": "A",
        "correctAnswer": "A",
        "isCorrect": true
      }
    ]
  }
}
```

### 4. Get Leaderboard
**GET** `/api/contests/:contestId/leaderboard?limit=100`

**Auth:** Any authenticated user

**Response:**
```json
{
  "data": [
    {
      "rank": 1,
      "learnerName": "John Doe",
      "score": 10,
      "percentage": 100.0,
      "timeTaken": 900,
      "submittedAt": "2024-10-18T10:30:00Z"
    }
  ]
}
```

### 5. Get My Submission
**GET** `/api/contests/:contestId/my-submission`

**Auth:** Learner

---

## Question Formats

### MCQ Question
```json
{
  "type": "mcq",
  "question": "What is 'hello' in Spanish?",
  "options": ["A) hola", "B) adiós", "C) gracias", "D) por favor"],
  "correctAnswer": "A",
  "explanation": "Hola means hello"
}
```

### One-Liner Question
```json
{
  "type": "one-liner",
  "question": "Translate 'cat' to French",
  "correctAnswer": "chat",
  "acceptableAnswers": ["chat", "le chat"],
  "explanation": "Chat is cat in French"
}
```

---

## Contest Types

- **mcq**: All multiple choice questions
- **one-liner**: All short answer questions
- **mix**: Combination of both (60% MCQ, 40% one-liner)

## Difficulty Levels

- **Beginner**: Basic vocabulary and simple grammar
- **Intermediate**: Broader vocabulary, multiple tenses
- **Advanced**: Sophisticated vocabulary, complex grammar

---

## Error Codes (10xxxx)

- `100001` - Contest not found
- `100005` - Already submitted
- `100006` - Contest not published
- `100007` - Contest ended
- `100008` - Contest not started
- `100009` - Invalid contest type
- `100011` - AI generation failed

---

## Example Workflow

### Admin: Create AI Contest
```javascript
// 1. Generate contest
POST /api/contests/generate
{
  "language": "Spanish",
  "difficultyLevel": "Intermediate",
  "contestType": "mix",
  "questionCount": 15,
  "topic": "Daily Conversations",
  "startDate": "2024-10-20T00:00:00Z",
  "endDate": "2024-10-27T23:59:59Z"
}

// 2. Review and publish
PATCH /api/contests/1
{ "isPublished": true }
```

### Learner: Take Contest
```javascript
// 1. Browse contests
GET /api/contests?language=Spanish

// 2. Get contest details
GET /api/contests/1

// 3. Submit answers
POST /api/contests/1/submit
{
  "answers": [...],
  "timeTaken": 1200
}

// 4. Check leaderboard
GET /api/contests/1/leaderboard

// 5. View my rank
GET /api/contests/1/my-submission
```

---

## Database Tables

- **contests**: Contest metadata and questions
- **contest_submissions**: User answers and scores  
- **contest_leaderboard**: Rankings (auto-updated via trigger)

**Auto-ranking**: Leaderboard updates automatically on submission, sorted by score (desc) then time (asc).

---

## Files Created/Modified

**New Files:**
1. `src/repositories/contestRepository.js` - Database operations
2. `src/services/contestService.js` - AI generation & scoring
3. `src/controllers/contestController.js` - Request handlers
4. `src/routes/contests.js` - API routes

**Modified Files:**
1. `src/database/02-tables.sql` - Updated schema
2. `src/middlewares/authMiddleware.js` - Added adminMiddleware function
3. `src/utils/error.js` - Added contest errors
4. `src/server.js` - Registered routes

**Status:** ✅ Complete & Ready
