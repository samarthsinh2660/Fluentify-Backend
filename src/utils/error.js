class RequestError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = 'RequestError';
    this.code = code;
    this.statusCode = statusCode;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RequestError);
    }
  }
}

/*
HTTP Status Codes Reference:
200 OK - Response to a successful GET, PUT, PATCH or DELETE
201 Created - Response to a POST that results in a creation
204 No Content - Response to a successful request that won't be returning a body
304 Not Modified - Used when HTTP caching headers are in play
400 Bad Request - The request is malformed, such as if the body does not parse
401 Unauthorized - When no or invalid authentication details are provided
403 Forbidden - When authentication succeeded but authenticated user doesn't have access to the resource
404 Not Found - When a non-existent resource is requested
405 Method Not Allowed - When an HTTP method is being requested that isn't allowed for the authenticated user
410 Gone - Indicates that the resource at this end point is no longer available
415 Unsupported Media Type - If incorrect content type was provided as part of the request
422 Unprocessable Entity - Used for validation errors
429 Too Many Requests - When a request is rejected due to rate limiting
500 Internal Server Error - This is either a system or application error
503 Service Unavailable - The server is unable to handle the request for a service due to temporary maintenance
*/

/*
Error Code Convention:
- 1xxxx: Common/General errors
- 2xxxx: Authentication & Authorization errors  
- 3xxxx: Course management errors
- 4xxxx: Lesson management errors
- 5xxxx: Progress tracking errors
- 6xxxx: User preferences errors
- 7xxxx: Unit management errors
- 8xxxx: Retell AI / Voice call errors
- 9xxxx: AI Chatbot errors
- 10xxxx: Contest errors
*/

const ERRORS = {
  // Common Errors (1xxxx)
  DATABASE_ERROR: new RequestError("Database operation failed", 10001, 500),
  INVALID_REQUEST_BODY: new RequestError("Invalid request body", 10002, 400),
  INVALID_QUERY_PARAMETER: new RequestError("Invalid query parameters", 10003, 400),
  UNHANDLED_ERROR: new RequestError("An unexpected error occurred", 10004, 500),
  INTERNAL_SERVER_ERROR: new RequestError("Internal server error", 10005, 500),
  RESOURCE_NOT_FOUND: new RequestError("Resource not found", 10006, 404),
  INVALID_PARAMS: new RequestError("Invalid parameters", 10007, 400),
  VALIDATION_ERROR: new RequestError("Validation failed", 10008, 422),
  DUPLICATE_RESOURCE: new RequestError("Resource already exists", 10009, 409),
  RESOURCE_IN_USE: new RequestError("Resource is in use and cannot be deleted", 10010, 400),
  MISSING_REQUIRED_FIELDS: new RequestError("Missing required fields", 10011, 400),
  INVALID_JSON: new RequestError("Invalid JSON in request body", 10012, 400),
  
  // Authentication & Authorization Errors (2xxxx)
  NO_TOKEN_PROVIDED: new RequestError("No authentication token provided", 20001, 401),
  INVALID_AUTH_TOKEN: new RequestError("Invalid authentication token", 20002, 401),
  TOKEN_EXPIRED: new RequestError("Authentication token has expired", 20003, 401),
  UNAUTHORIZED: new RequestError("Unauthorized access", 20004, 401),
  FORBIDDEN: new RequestError("Access forbidden", 20005, 403),
  INVALID_CREDENTIALS: new RequestError("Invalid email or password", 20006, 401),
  EMAIL_ALREADY_EXISTS: new RequestError("Email already exists", 20007, 409),
  USER_NOT_FOUND: new RequestError("User not found", 20008, 404),
  ADMIN_ONLY_ROUTE: new RequestError("Admin access required", 20009, 403),
  LEARNER_ONLY_ROUTE: new RequestError("Learner access required", 20010, 403),
  SIGNUP_FAILED: new RequestError("Signup failed", 20011, 400),
  LOGIN_FAILED: new RequestError("Login failed", 20012, 400),
  
  // Course Management Errors (3xxxx) 
  COURSE_NOT_FOUND: new RequestError("Course not found", 30001, 404),
  COURSE_CREATION_FAILED: new RequestError("Failed to create course", 30002, 500),
  COURSE_UPDATE_FAILED: new RequestError("Failed to update course", 30003, 500),
  COURSE_DELETION_FAILED: new RequestError("Failed to delete course", 30004, 500),
  DUPLICATE_ACTIVE_COURSE: new RequestError("You already have an active course for this language", 30005, 409),
  INVALID_LANGUAGE: new RequestError("Invalid language specified", 30006, 400),
  INVALID_DURATION: new RequestError("Invalid expected duration", 30007, 400),
  LANGUAGE_REQUIRED: new RequestError("Language is required", 30008, 400),
  DURATION_REQUIRED: new RequestError("Expected duration is required", 30009, 400),
  COURSE_GENERATION_FAILED: new RequestError("Failed to generate course content", 30010, 500),
  INVALID_COURSE_DATA: new RequestError("Invalid course data", 30011, 500),
  COURSE_FETCH_FAILED: new RequestError("Failed to fetch courses", 30012, 500),
  
  // Lesson Management Errors (4xxxx)
  LESSON_NOT_FOUND: new RequestError("Lesson not found", 40001, 404),
  LESSON_ALREADY_COMPLETED: new RequestError("Lesson already completed", 40002, 400),
  LESSON_COMPLETION_FAILED: new RequestError("Failed to complete lesson", 40003, 500),
  LESSON_LOCKED: new RequestError("Lesson is locked. Complete previous lessons first", 40004, 403),
  INVALID_LESSON_SCORE: new RequestError("Invalid lesson score", 40005, 400),
  LESSON_FETCH_FAILED: new RequestError("Failed to fetch lesson details", 40006, 500),
  
  // Progress Tracking Errors (5xxxx)
  PROGRESS_NOT_FOUND: new RequestError("Progress not found", 50001, 404),
  PROGRESS_UPDATE_FAILED: new RequestError("Failed to update progress", 50002, 500),
  PROGRESS_FETCH_FAILED: new RequestError("Failed to fetch progress", 50003, 500),
  UNIT_NOT_FOUND: new RequestError("Unit not found", 50004, 404),
  UNIT_LOCKED: new RequestError("Unit is locked. Complete previous units first", 50005, 403),
  INVALID_XP_VALUE: new RequestError("Invalid XP value", 50006, 400),
  STATS_UPDATE_FAILED: new RequestError("Failed to update user statistics", 50007, 500),
  PROGRESS_INITIALIZATION_FAILED: new RequestError("Failed to initialize course progress", 50008, 500),
  
  // User Preferences Errors (6xxxx)
  PREFERENCES_NOT_FOUND: new RequestError("Preferences not found", 60001, 404),
  PREFERENCES_SAVE_FAILED: new RequestError("Failed to save preferences", 60002, 500),
  PREFERENCES_FETCH_FAILED: new RequestError("Failed to fetch preferences", 60003, 500),
  DUPLICATE_PREFERENCES: new RequestError("Preferences already exist", 60004, 409),
  INVALID_PREFERENCE_VALUE: new RequestError("Invalid preference value", 60005, 400),
  
  // Retell AI / Voice Call Errors (8xxxx)
  RETELL_API_NOT_CONFIGURED: new RequestError("Retell AI service is not configured. Please contact support.", 80001, 500),
  RETELL_AGENT_ID_REQUIRED: new RequestError("Retell Agent ID is required", 80002, 400),
  RETELL_CALL_CREATION_FAILED: new RequestError("Failed to create Retell AI call session", 80003, 500),
  RETELL_API_ERROR: new RequestError("Retell AI service error", 80004, 502),
  RETELL_INVALID_AGENT: new RequestError("Invalid or inactive Retell AI agent", 80005, 400),
  RETELL_RATE_LIMIT: new RequestError("Retell AI rate limit exceeded. Please try again later.", 80006, 429),
  RETELL_AUTHENTICATION_FAILED: new RequestError("Retell AI authentication failed", 80007, 401),

  // AI Chatbot Errors (9xxxx)
  CHAT_SESSION_NOT_FOUND: new RequestError("Chat session not found", 90001, 404),
  CHAT_SESSION_CREATION_FAILED: new RequestError("Failed to create chat session", 90002, 500),
  CHAT_MESSAGE_REQUIRED: new RequestError("Message content is required", 90003, 400),
  CHAT_MESSAGE_SEND_FAILED: new RequestError("Failed to send message", 90004, 500),
  CHAT_AI_RESPONSE_FAILED: new RequestError("Failed to generate AI response", 90005, 500),
  CHAT_HISTORY_FETCH_FAILED: new RequestError("Failed to fetch chat history", 90006, 500),
  CHAT_SESSION_DELETE_FAILED: new RequestError("Failed to delete chat session", 90007, 500),
  CHAT_SESSION_INACTIVE: new RequestError("Chat session is no longer active", 90008, 400),
  CHAT_UNAUTHORIZED_ACCESS: new RequestError("You don't have access to this chat session", 90009, 403),
  GEMINI_API_NOT_CONFIGURED: new RequestError("Gemini AI service is not configured. Please contact support.", 90010, 500),
  CHAT_MESSAGE_TOO_LONG: new RequestError("Message is too long. Maximum 2000 characters allowed.", 90011, 400),

  // Contest Errors (10xxxx)
  CONTEST_NOT_FOUND: new RequestError("Contest not found", 100001, 404),
  CONTEST_CREATION_FAILED: new RequestError("Failed to create contest", 100002, 500),
  CONTEST_UPDATE_FAILED: new RequestError("Failed to update contest", 100003, 500),
  CONTEST_DELETE_FAILED: new RequestError("Failed to delete contest", 100004, 500),
  CONTEST_ALREADY_SUBMITTED: new RequestError("You have already submitted this contest", 100005, 409),
  CONTEST_NOT_PUBLISHED: new RequestError("Contest is not published yet", 100006, 400),
  CONTEST_ENDED: new RequestError("Contest has ended", 100007, 400),
  CONTEST_NOT_STARTED: new RequestError("Contest has not started yet", 100008, 400),
  INVALID_CONTEST_TYPE: new RequestError("Invalid contest type. Must be mcq, one-liner, or mix", 100009, 400),
  INVALID_DIFFICULTY: new RequestError("Invalid difficulty level", 100010, 400),
  CONTEST_GENERATION_FAILED: new RequestError("Failed to generate contest using AI", 100011, 500),
  INVALID_ANSWERS_FORMAT: new RequestError("Invalid answers format", 100012, 400),
  CONTEST_SUBMISSION_FAILED: new RequestError("Failed to submit contest", 100013, 500),
  LEADERBOARD_FETCH_FAILED: new RequestError("Failed to fetch leaderboard", 100014, 500),
  MAX_ATTEMPTS_REACHED: new RequestError("Maximum attempts for this contest reached", 100015, 400),
  INVALID_QUESTION_FORMAT: new RequestError("Invalid question format", 100016, 400)
};

export {
  RequestError,
  ERRORS
};
