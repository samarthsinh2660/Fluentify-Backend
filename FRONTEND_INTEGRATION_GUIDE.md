# Frontend Integration Guide

## 🔐 Authentication Headers

**All requests require:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

---

## 🤖 CHATBOT ROUTES (Learner Only)

### Base URL: `/api/chat`

### 1. Create Chat Session
**POST** `/api/chat/sessions`

**Headers:** Authorization required

**Request Body:**
```json
{
  "language": "Spanish",     // Optional
  "title": "Grammar Help"    // Optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": 1,
      "sessionToken": "chat_xxx",
      "language": "Spanish",
      "title": "New Chat",
      "startedAt": "timestamp",
      "isActive": true
    }
  }
}
```

---

### 2. Get All Sessions
**GET** `/api/chat/sessions?active_only=true`

**Headers:** Authorization required

**Query Params:**
- `active_only` (optional): "true" or "false"

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sessionToken": "chat_xxx",
      "language": "Spanish",
      "title": "Grammar Questions",
      "startedAt": "timestamp",
      "endedAt": null,
      "isActive": true,
      "messageCount": 12,
      "lastMessageAt": "timestamp"
    }
  ],
  "meta": { "count": 5 }
}
```

---

### 3. Send Message & Get AI Response
**POST** `/api/chat/sessions/:sessionId/messages`

**Headers:** Authorization required

**Request Body:**
```json
{
  "message": "How do I conjugate ser in Spanish?"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userMessage": {
      "id": 1,
      "sender": "learner",
      "message": "How do I conjugate ser?",
      "createdAt": "timestamp"
    },
    "aiMessage": {
      "id": 2,
      "sender": "ai",
      "message": "Great question! Ser is conjugated as...",
      "createdAt": "timestamp"
    }
  }
}
```

**Note:** Message max length is 2000 characters

**🎭 Scenario-Based Conversations:**
The chatbot supports real-world scenario practice! Users can ask questions like:
- "I'm in a restaurant in Paris, how do I order food in French?"
- "I'm at a hotel in Madrid, how do I ask for extra towels in Spanish?"
- "How do I ask for directions to the train station in Japanese?"
- "I'm shopping in Germany, how do I ask for the price in German?"

The AI will provide:
- Key phrases for that situation
- Pronunciation tips
- Cultural context
- Example dialogues
- Common responses

---

### 4. Get Chat History
**GET** `/api/chat/sessions/:sessionId/messages?limit=100&offset=0`

**Headers:** Authorization required

**Query Params:**
- `limit` (optional, default: 100)
- `offset` (optional, default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sender": "learner",
      "message": "Hello",
      "createdAt": "timestamp"
    },
    {
      "id": 2,
      "sender": "ai",
      "message": "Hi! How can I help?",
      "createdAt": "timestamp"
    }
  ],
  "meta": {
    "count": 2,
    "totalCount": 20,
    "limit": 100,
    "offset": 0
  }
}
```

---

### 5. Update Session Title
**PATCH** `/api/chat/sessions/:sessionId`

**Headers:** Authorization required

**Request Body:**
```json
{
  "title": "Spanish Grammar Help"
}
```

---

### 6. Delete Session
**DELETE** `/api/chat/sessions/:sessionId`

**Headers:** Authorization required

**Response:**
```json
{
  "success": true,
  "message": "Chat session deleted successfully"
}
```

---

### 7. Delete All Sessions
**DELETE** `/api/chat/sessions`

**Headers:** Authorization required

---

### 8. End Session
**POST** `/api/chat/sessions/:sessionId/end`

**Headers:** Authorization required

**Note:** Ended sessions can't receive new messages but history remains viewable

---

## 🏆 CONTEST ROUTES

### Base URL: `/api/contests`

---

## 👨‍🎓 LEARNER CONTEST ROUTES

### 1. Browse Published Contests
**GET** `/api/contests?language=Spanish`

**Headers:** Authorization required (Learner role)

**Query Params:**
- `language` (optional): Filter by language

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Spanish Verb Challenge",
      "description": "Test your knowledge",
      "language": "Spanish",
      "difficultyLevel": "Intermediate",
      "contestType": "mcq",
      "totalQuestions": 10,
      "maxAttempts": 1,
      "timeLimit": 30,
      "rewardPoints": 100,
      "startDate": "timestamp",
      "endDate": "timestamp",
      "totalParticipants": 45,
      "status": "active",
      "hasSubmitted": false
    }
  ],
  "meta": { "count": 5 }
}
```

**Status values:** "active", "upcoming", "ended"

**Note:** `hasSubmitted` indicates if the current user has already submitted this contest

---

### 2. Get Contest Details
**GET** `/api/contests/:contestId`

**Headers:** Authorization required (Learner role)

**Response:**
```json
{
  "success": true,
  "data": {
    "contest": {
      "id": 1,
      "title": "Spanish Verb Challenge",
      "description": "Test your knowledge",
      "language": "Spanish",
      "difficultyLevel": "Intermediate",
      "contestType": "mcq",
      "questions": [
        {
          "type": "mcq",
          "question": "What is 'hello' in Spanish?",
          "options": ["A) hola", "B) adiós", "C) gracias", "D) por favor"]
        }
      ],
      "totalQuestions": 10,
      "maxAttempts": 1,
      "timeLimit": 30,
      "rewardPoints": 100,
      "startDate": "timestamp",
      "endDate": "timestamp",
      "status": "active",
      "hasSubmitted": false,
      "submission": null
    }
  }
}
```

**If user has already submitted:**
```json
{
  "success": true,
  "data": {
    "contest": {
      "id": 1,
      "title": "Spanish Verb Challenge",
      "status": "active",
      "hasSubmitted": true,
      "submission": {
        "score": 8,
        "totalCorrect": 8,
        "totalQuestions": 10,
        "percentage": 80.0,
        "timeTaken": 1200,
        "submittedAt": "timestamp",
        "rank": 12
      },
      ...
    }
  }
}
```

**Notes:**
- Questions do NOT include correct answers for learners
- `status`: "active", "upcoming", or "ended"
- `hasSubmitted`: Boolean indicating if user has submitted
- `submission`: User's submission data (null if not submitted)
- Frontend should prevent re-submission if `hasSubmitted` is true

---

### 3. Submit Contest Answers
**POST** `/api/contests/:contestId/submit`

**Headers:** Authorization required (Learner role)

**Request Body:**
```json
{
  "answers": ["A", "B", "C", "D", "A", "B", "C", "D", "A", "B"],
  "timeTaken": 1200
}
```

**Format:**
- `answers`: Array of answers matching question order
  - For MCQ: "A", "B", "C", or "D"
  - For one-liner: text answer (e.g., "chat", "hola")
- `timeTaken`: Time in seconds

**Response:**
```json
{
  "success": true,
  "data": {
    "submission": {
      "id": 1,
      "score": 8,
      "totalCorrect": 8,
      "totalQuestions": 10,
      "percentage": 80.0,
      "timeTaken": 1200,
      "submittedAt": "timestamp",
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
}
```

**Rules:**
- Can only submit once per contest
- Contest must be published
- Contest must be active (between start and end dates)

**After Submission:**
- User can view the leaderboard: `GET /api/contests/:contestId/leaderboard`
- User can check their rank: `GET /api/contests/:contestId/my-submission`

---

### 4. Get Contest Leaderboard
**GET** `/api/contests/:contestId/leaderboard?limit=100`

**Headers:** Authorization required

**Query Params:**
- `limit` (optional, default: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "learnerName": "John Doe",
      "score": 10,
      "percentage": 100.0,
      "timeTaken": 900,
      "submittedAt": "timestamp"
    }
  ],
  "meta": { "count": 45 }
}
```

**Note:** Sorted by score (desc), then time taken (asc)

---

### 5. Get My Submission
**GET** `/api/contests/:contestId/my-submission`

**Headers:** Authorization required (Learner role)

**Response:**
```json
{
  "success": true,
  "data": {
    "submission": {
      "id": 1,
      "score": 8,
      "totalCorrect": 8,
      "totalQuestions": 10,
      "percentage": 80.0,
      "timeTaken": 1200,
      "submittedAt": "timestamp",
      "rank": 12
    }
  }
}
```

**Note:** Returns null if no submission exists

---

## 👨‍💼 ADMIN CONTEST ROUTES

### 1. Generate Contest with AI
**POST** `/api/contests/generate`

**Headers:** Authorization required (Admin role)

**Request Body:**
```json
{
  "language": "Spanish",
  "difficultyLevel": "Intermediate",
  "contestType": "mcq",
  "questionCount": 10,
  "topic": "Common Verbs",
  "title": "Spanish Verb Challenge",
  "description": "Test your knowledge",
  "startDate": "2024-10-20T00:00:00Z",
  "endDate": "2024-10-27T23:59:59Z",
  "rewardPoints": 100,
  "maxAttempts": 1,
  "timeLimit": 30,
  "isPublished": false
}
```

**Required Fields:**
- `language` (string)
- `difficultyLevel` (string): "Beginner", "Intermediate", or "Advanced"
- `contestType` (string): "mcq", "one-liner", or "mix"

**Optional Fields:**
- `questionCount` (number, default: 10)
- `topic` (string): Specific topic for questions
- `title` (string): AI generates if not provided
- `description` (string): AI generates if not provided
- `startDate` (ISO 8601 timestamp)
- `endDate` (ISO 8601 timestamp)
- `rewardPoints` (number, default: 100)
- `maxAttempts` (number, default: 1)
- `timeLimit` (number in minutes, null for no limit)
- `isPublished` (boolean, default: false)

**Response:**
```json
{
  "success": true,
  "data": {
    "contest": {
      "id": 1,
      "title": "AI Generated Title",
      "description": "AI Generated Description",
      "language": "Spanish",
      "difficultyLevel": "Intermediate",
      "contestType": "mcq",
      "questions": [
        {
          "type": "mcq",
          "question": "What is 'hello' in Spanish?",
          "options": ["A) hola", "B) adiós", "C) gracias", "D) por favor"],
          "correctAnswer": "A",
          "explanation": "Hola means hello"
        }
      ],
      "totalQuestions": 10,
      "isAiGenerated": true,
      "isPublished": false
    }
  }
}
```

---

### 2. Create Contest Manually
**POST** `/api/contests`

**Headers:** Authorization required (Admin role)

**Request Body:**
```json
{
  "title": "French Grammar Quiz",
  "description": "Test your French grammar",
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
    },
    {
      "type": "one-liner",
      "question": "Translate 'cat' to French",
      "correctAnswer": "chat",
      "acceptableAnswers": ["chat", "le chat"],
      "explanation": "Chat is cat in French"
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

**Question Formats:**

**MCQ Question:**
```json
{
  "type": "mcq",
  "question": "Question text",
  "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
  "correctAnswer": "A",
  "explanation": "Why this is correct"
}
```

**One-Liner Question:**
```json
{
  "type": "one-liner",
  "question": "Question text",
  "correctAnswer": "expected answer",
  "acceptableAnswers": ["answer1", "answer2"],
  "explanation": "Explanation text"
}
```

---

### 3. Get Admin's Contests
**GET** `/api/contests/admin?language=Spanish&is_published=true`

**Headers:** Authorization required (Admin role)

**Query Params:**
- `language` (optional)
- `difficulty_level` (optional)
- `contest_type` (optional)
- `is_published` (optional): "true" or "false"

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Spanish Quiz",
      "description": "Test your knowledge",
      "language": "Spanish",
      "difficultyLevel": "Intermediate",
      "contestType": "mcq",
      "totalQuestions": 10,
      "maxAttempts": 1,
      "timeLimit": 30,
      "rewardPoints": 100,
      "startDate": "timestamp",
      "endDate": "timestamp",
      "isPublished": true,
      "isAiGenerated": false,
      "totalParticipants": 45,
      "createdAt": "timestamp"
    }
  ],
  "meta": { "count": 10 }
}
```

---

### 4. Update Contest
**PATCH** `/api/contests/:contestId`

**Headers:** Authorization required (Admin role)

**Request Body:** (All fields optional)
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "language": "Spanish",
  "difficultyLevel": "Advanced",
  "contestType": "mix",
  "questions": [...],
  "totalQuestions": 15,
  "maxAttempts": 2,
  "timeLimit": 45,
  "rewardPoints": 150,
  "startDate": "2024-10-20T00:00:00Z",
  "endDate": "2024-10-27T23:59:59Z",
  "isPublished": true
}
```

**Note:** Send only the fields you want to update

---

### 5. Delete Contest
**DELETE** `/api/contests/:contestId`

**Headers:** Authorization required (Admin role)

**Response:**
```json
{
  "success": true,
  "message": "Contest deleted successfully"
}
```

**Note:** Deletes contest and all submissions (cascade delete)

---

### 6. Get Contest Statistics
**GET** `/api/contests/:contestId/stats`

**Headers:** Authorization required (Admin role)

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalParticipants": 45,
      "averageScore": 7.5,
      "highestScore": 10,
      "lowestScore": 3,
      "averagePercentage": 75.0
    }
  }
}
```

---

## ⚠️ Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": {
    "code": 100001,
    "message": "Contest not found"
  },
  "timestamp": "2024-10-18T11:00:00Z"
}
```

### Common Error Codes

**Chatbot Errors (9xxxx):**
- `90001` - Chat session not found
- `90003` - Message content is required
- `90008` - Chat session is no longer active
- `90009` - Unauthorized access to chat session
- `90011` - Message too long (max 2000 chars)

**Contest Errors (10xxxx):**
- `100001` - Contest not found
- `100005` - Already submitted this contest
- `100006` - Contest not published yet
- `100007` - Contest has ended
- `100008` - Contest not started yet
- `100009` - Invalid contest type
- `100011` - AI generation failed
- `100012` - Invalid answers format

**Auth Errors (2xxxx):**
- `20001` - No authentication token provided
- `20002` - Invalid authentication token
- `20009` - Admin access required
- `20010` - Learner access required

---

## 📋 Quick Reference

### Chatbot Flow
1. Create session → `POST /api/chat/sessions`
2. Send message → `POST /api/chat/sessions/:id/messages`
3. Get history → `GET /api/chat/sessions/:id/messages`
4. View all sessions → `GET /api/chat/sessions`

### Learner Contest Flow
1. Browse contests → `GET /api/contests?language=Spanish`
2. Get details → `GET /api/contests/:id`
3. Submit answers → `POST /api/contests/:id/submit`
4. Check leaderboard → `GET /api/contests/:id/leaderboard`
5. View my rank → `GET /api/contests/:id/my-submission`

### Admin Contest Flow
1. Generate with AI → `POST /api/contests/generate`
   OR Create manually → `POST /api/contests`
2. Review/Edit → `PATCH /api/contests/:id`
3. Publish → `PATCH /api/contests/:id` with `{"isPublished": true}`
4. View stats → `GET /api/contests/:id/stats`
5. Delete → `DELETE /api/contests/:id`

---

## 🔑 Important Notes

1. **All requests need JWT token** in Authorization header
2. **Admin routes** will return 403 if accessed by learner
3. **Learner routes** will return 403 if accessed by admin
4. **Contest submissions** are one-time only (can't resubmit)
5. **Chat messages** have 2000 character limit
6. **Leaderboard** auto-updates when someone submits
7. **Contest status** determined by start/end dates
8. **Time limits** are in minutes for contests, seconds for submissions

---

**API Base URL:** `http://localhost:5000` (or your deployment URL)

**All timestamps** are in ISO 8601 format (UTC)
