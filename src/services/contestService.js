import { GoogleGenerativeAI } from '@google/generative-ai';

class ContestService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY is not set. Contest generation will be limited.');
      this.genAI = null;
      this.model = null;
    } else {
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }
  }

  /**
   * Generate contest using AI
   */
  async generateContest(params) {
    if (!this.model) {
      throw new Error('Gemini AI is not configured');
    }

    const {
      language,
      difficultyLevel,
      contestType,
      questionCount,
      topic
    } = params;

    try {
      console.log(`Generating ${contestType} contest for ${language} (${difficultyLevel} level)...`);

      const prompt = this.buildContestPrompt(language, difficultyLevel, contestType, questionCount, topic);
      
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.8,
        },
      });

      const response = await result.response;
      const text = response.text();
      
      const contestData = this.parseJSON(text);
      
      // Validate and format the generated contest
      this.validateContestStructure(contestData, contestType);
      
      console.log(`Contest generated successfully with ${contestData.questions.length} questions`);
      
      return contestData;
    } catch (error) {
      console.error('Error generating contest:', error);
      throw new Error(`Failed to generate contest: ${error.message}`);
    }
  }

  /**
   * Build comprehensive prompt for contest generation
   */
  buildContestPrompt(language, difficultyLevel, contestType, questionCount, topic) {
    const typeInstructions = this.getTypeInstructions(contestType);
    const difficultyInstructions = this.getDifficultyInstructions(difficultyLevel);
    
    return `You are an expert language assessment creator. Generate a high-quality language learning contest for ${language}.

**Contest Specifications:**
- Language: ${language}
- Difficulty Level: ${difficultyLevel}
- Contest Type: ${contestType}
- Number of Questions: ${questionCount}
${topic ? `- Specific Topic: ${topic}` : '- Topic: General language proficiency'}

**Difficulty Guidelines:**
${difficultyInstructions}

**Question Type Requirements:**
${typeInstructions}

**Critical Requirements:**
1. All questions MUST test real language skills (vocabulary, grammar, comprehension, usage)
2. Questions should be engaging, practical, and culturally relevant
3. Difficulty should be appropriate for ${difficultyLevel} level learners
4. Include a variety of question formats within the type constraints
5. Provide clear, unambiguous correct answers
6. Make distractors (wrong options) plausible but clearly incorrect
7. Use authentic language contexts and realistic scenarios

**Output Format (VALID JSON ONLY):**
\`\`\`json
{
  "title": "Engaging contest title",
  "description": "Brief description of what the contest tests",
  "questions": [
    ${this.getQuestionTemplate(contestType)}
  ]
}
\`\`\`

**Quality Standards:**
- NO translation-only questions
- NO overly simple or trivial questions
- NO culturally insensitive content
- AVOID repetitive patterns
- ENSURE variety in question formats
- MAKE questions interesting and educational
- TEST practical language application

Generate ONLY valid JSON. Do NOT include any markdown, explanations, or text outside the JSON structure.`;
  }

  /**
   * Get type-specific instructions
   */
  getTypeInstructions(contestType) {
    switch (contestType) {
      case 'mcq':
        return `**MCQ (Multiple Choice) Questions:**
- Each question has 4 options (A, B, C, D)
- Only one correct answer per question
- Options should be plausible and test understanding
- Vary the position of correct answers
- Include vocabulary, grammar, comprehension, and usage questions
- Mix question formats: fill-in-blank, complete sentence, choose meaning, identify error, etc.`;

      case 'one-liner':
        return `**One-Liner Questions:**
- Questions require a short text answer (1-3 words typically)
- Test vocabulary translation, grammar forms, or short completions
- Answers should be specific and unambiguous
- Include word translation, conjugation, article usage, preposition choices
- Provide clear expected answer format
- Accept reasonable variations in answers`;

      case 'mix':
        return `**Mixed Question Types:**
- Include 60% MCQ and 40% one-liner questions
- MCQ: 4 options, one correct answer
- One-liner: Short text answers
- Ensure variety across both types
- Balance difficulty across question types`;

      default:
        return 'Generate appropriate question format';
    }
  }

  /**
   * Get difficulty-specific instructions
   */
  getDifficultyInstructions(level) {
    switch (level.toLowerCase()) {
      case 'beginner':
        return `- Focus on basic vocabulary (common words, everyday objects)
- Simple present tense and basic grammar
- Common phrases and greetings
- Basic sentence structures
- Familiar, everyday topics (family, food, numbers, colors)
- Clear, straightforward questions`;

      case 'intermediate':
        return `- Broader vocabulary range (abstract concepts, less common words)
- Multiple tenses and more complex grammar
- Idiomatic expressions and collocations
- Compound and complex sentences
- Varied topics (travel, work, opinions, experiences)
- Questions requiring inference and context understanding`;

      case 'advanced':
        return `- Sophisticated vocabulary (nuanced meanings, formal/informal registers)
- Advanced grammar (subjunctive, conditional, complex structures)
- Cultural references and idiomatic mastery
- Subtle distinctions in meaning and usage
- Academic, professional, and cultural topics
- Questions requiring deep comprehension and analysis`;

      default:
        return 'Appropriate difficulty for general learners';
    }
  }

  /**
   * Get question template based on type
   */
  getQuestionTemplate(contestType) {
    const mcqTemplate = `{
      "type": "mcq",
      "question": "Question text here",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "correctAnswer": "A",
      "explanation": "Brief explanation of why this is correct"
    }`;

    const oneLinerTemplate = `{
      "type": "one-liner",
      "question": "Question text here",
      "correctAnswer": "expected answer",
      "acceptableAnswers": ["answer1", "answer2"],
      "explanation": "Brief explanation"
    }`;

    switch (contestType) {
      case 'mcq':
        return mcqTemplate;
      case 'one-liner':
        return oneLinerTemplate;
      case 'mix':
        return `${mcqTemplate},
    ${oneLinerTemplate}`;
      default:
        return mcqTemplate;
    }
  }

  /**
   * Parse JSON response from AI
   */
  parseJSON(text) {
    try {
      // Clean the response text
      let cleanText = text.trim();
      
      // Remove markdown code blocks
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      
      // Extract JSON
      let jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        const startIdx = cleanText.indexOf('{');
        const endIdx = cleanText.lastIndexOf('}');
        
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          jsonMatch = [cleanText.substring(startIdx, endIdx + 1)];
        }
      }
      
      if (!jsonMatch) {
        throw new Error('No valid JSON found in AI response');
      }

      const data = JSON.parse(jsonMatch[0]);
      return data;
    } catch (error) {
      console.error('Error parsing JSON:', error);
      console.error('Raw response:', text.substring(0, 500));
      throw new Error(`Failed to parse JSON: ${error.message}`);
    }
  }

  /**
   * Validate contest structure
   */
  validateContestStructure(contestData, contestType) {
    if (!contestData.title || !contestData.questions || !Array.isArray(contestData.questions)) {
      throw new Error('Invalid contest structure: missing title or questions');
    }

    if (contestData.questions.length === 0) {
      throw new Error('Contest must have at least one question');
    }

    // Validate each question
    contestData.questions.forEach((q, index) => {
      if (!q.type || !q.question) {
        throw new Error(`Question ${index + 1} is missing required fields`);
      }

      if (q.type === 'mcq') {
        if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
          throw new Error(`Question ${index + 1} must have at least 2 options`);
        }
        if (!q.correctAnswer) {
          throw new Error(`Question ${index + 1} is missing correct answer`);
        }
      } else if (q.type === 'one-liner') {
        if (!q.correctAnswer) {
          throw new Error(`Question ${index + 1} is missing correct answer`);
        }
      }
    });

    // Validate contest type matches questions
    if (contestType === 'mcq') {
      const allMCQ = contestData.questions.every(q => q.type === 'mcq');
      if (!allMCQ) {
        throw new Error('All questions must be MCQ type');
      }
    } else if (contestType === 'one-liner') {
      const allOneLiner = contestData.questions.every(q => q.type === 'one-liner');
      if (!allOneLiner) {
        throw new Error('All questions must be one-liner type');
      }
    }
    // Mix type allows both, so no specific validation needed
  }

  /**
   * Calculate contest score
   */
  calculateScore(questions, userAnswers) {
    let totalCorrect = 0;
    const results = [];

    questions.forEach((question, index) => {
      const userAnswer = userAnswers[index];
      let isCorrect = false;

      if (question.type === 'mcq') {
        // MCQ: exact match with correct answer
        isCorrect = userAnswer === question.correctAnswer;
      } else if (question.type === 'one-liner') {
        // One-liner: case-insensitive match with acceptable answers
        const normalizedAnswer = userAnswer?.toString().toLowerCase().trim();
        const correctAnswers = [
          question.correctAnswer.toLowerCase().trim(),
          ...(question.acceptableAnswers || []).map(a => a.toLowerCase().trim())
        ];
        isCorrect = correctAnswers.includes(normalizedAnswer);
      }

      if (isCorrect) {
        totalCorrect++;
      }

      results.push({
        questionIndex: index,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect
      });
    });

    const totalQuestions = questions.length;
    const score = totalCorrect;
    const percentage = ((totalCorrect / totalQuestions) * 100).toFixed(2);

    return {
      totalCorrect,
      totalQuestions,
      score,
      percentage: parseFloat(percentage),
      results
    };
  }

  /**
   * Validate user answers format
   */
  validateAnswers(questions, answers) {
    if (!Array.isArray(answers)) {
      return { valid: false, error: 'Answers must be an array' };
    }

    if (answers.length !== questions.length) {
      return { valid: false, error: 'Answer count must match question count' };
    }

    return { valid: true };
  }
}

export default new ContestService();
