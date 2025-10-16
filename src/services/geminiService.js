import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use gemini-pro which is the stable model for v1beta API
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  /**
   * Generate a structured language learning course similar to Duolingo
   * @param {string} language - The target language to learn
   * @param {string} expectedDuration - Expected learning duration (e.g., '3 months', '6 months')
   * @returns {Promise<Object>} - Structured course data
   */
  async generateCourse(language, expectedDuration) {
    try {
      console.log(`Generating course for: ${language}, Duration: ${expectedDuration}`);
      
      // Step 1: Generate course outline (units structure)
      console.log('Step 1: Generating course outline...');
      const outline = await this.generateCourseOutline(language, expectedDuration);
      
      // Step 2: Generate each unit separately
      console.log(`Step 2: Generating ${outline.units.length} units...`);
      const units = [];
      
      for (let i = 0; i < outline.units.length; i++) {
        const unitOutline = outline.units[i];
        console.log(`  Generating Unit ${i + 1}: ${unitOutline.title}...`);
        const unit = await this.generateUnit(language, unitOutline, i + 1);
        units.push(unit);
      }
      
      // Step 3: Combine everything
      const structuredCourse = {
        course: {
          title: `${language} Learning Journey`,
          language: language,
          duration: expectedDuration,
          totalLessons: units.reduce((sum, unit) => sum + unit.lessons.length, 0),
          generatedAt: new Date().toISOString(),
          version: '1.0',
          units: units
        },
        metadata: {
          language,
          totalUnits: units.length,
          totalLessons: units.reduce((sum, unit) => sum + unit.lessons.length, 0),
          estimatedTotalTime: units.reduce((sum, unit) => {
            const unitTime = parseInt(unit.estimatedTime) || 150;
            return sum + unitTime;
          }, 0)
        }
      };
      
      console.log('Course generation complete!');
      console.log(`Total: ${structuredCourse.metadata.totalUnits} units, ${structuredCourse.metadata.totalLessons} lessons`);
      
      return structuredCourse;
    } catch (error) {
      console.error('Error generating course:', error);
      throw new Error(`Failed to generate course content: ${error.message}`);
    }
  }

  /**
   * Generate course outline with unit structure
   */
  async generateCourseOutline(language, expectedDuration) {
    const prompt = `Generate a comprehensive, in-depth course outline for learning ${language} over ${expectedDuration}.

This should be a professional, Duolingo-quality curriculum with clear learning objectives and progression.
Do NOT include any explanations, markdown, or text outside of JSON.
Respond with ONLY valid JSON in this exact format:
{
  "units": [
    {
      "id": 1,
      "title": "Unit Title",
      "description": "Detailed description of what students will learn",
      "difficulty": "Beginner",
      "estimatedTime": "3-4 hours",
      "lessonCount": 6,
      "topics": ["topic1", "topic2", "topic3", "topic4"]
    }
  ]
}

Requirements:
- Create 6 units with progressive difficulty: Beginner (Units 1-2), Elementary (Units 3-4), Intermediate (Units 5-6)
- Each unit should have 6 lessons
- Topics should be practical and relevant to real-world communication
- Cover: vocabulary, grammar, conversation, pronunciation, and cultural context
- Build upon previous units logically`;

    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
    });
    
    const response = await result.response;
    const text = response.text();
    
    return this.parseJSON(text);
  }

  /**
   * Generate a single unit with all its lessons
   */
  async generateUnit(language, unitOutline, unitNumber) {
    const prompt = `Generate detailed lessons for Unit ${unitNumber} of a ${language} course.

Unit Info:
- Title: ${unitOutline.title}
- Description: ${unitOutline.description}
- Difficulty: ${unitOutline.difficulty}
- Topics: ${unitOutline.topics.join(', ')}
- Number of lessons: ${unitOutline.lessonCount}

Respond with ONLY valid JSON in this exact format:
{
  "id": ${unitNumber},
  "title": "${unitOutline.title}",
  "description": "${unitOutline.description}",
  "difficulty": "${unitOutline.difficulty}",
  "estimatedTime": "${unitOutline.estimatedTime}",
  "lessons": [
    {
      "id": 1,
      "title": "Lesson Title",
      "type": "vocabulary|grammar|conversation|review",
      "description": "What the lesson covers",
      "keyPhrases": ["phrase 1", "phrase 2"],
      "vocabulary": [
        {
          "word": "foreign word",
          "translation": "english translation",
          "pronunciation": "phonetic pronunciation",
          "example": "example sentence"
        }
      ],
      "grammarPoints": [
        {
          "topic": "grammar topic",
          "explanation": "brief explanation",
          "examples": ["example 1", "example 2"]
        }
      ],
      "exercises": [
        {
          "type": "multiple_choice|translation|matching|listening",
          "question": "exercise question",
          "options": ["option 1", "option 2", "option 3", "option 4"],
          "correctAnswer": 0
        }
      ],
      "estimatedDuration": 15,
      "xpReward": 50
    }
  ]
}

IMPORTANT: 
- Create exactly ${unitOutline.lessonCount} lessons
- Each vocabulary lesson MUST have 5-8 vocabulary items with detailed examples
- Each grammar lesson MUST have 2-4 comprehensive grammar points with multiple examples
- Include 3-5 varied exercises per lesson (mix of multiple_choice, translation, matching, listening)
- Exercises should test understanding, not just memorization
- Include practical, real-world examples in all content
- Last lesson MUST be type "review" covering all unit topics
- Ensure all JSON arrays and objects are properly closed
- Make content engaging and progressively challenging`;

    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7,
      },
    });
    
    const response = await result.response;
    const text = response.text();
    
    return this.parseJSON(text);
  }

  /**
   * Parse JSON from AI response with error handling
   */
  parseJSON(text) {
    try {
      console.log('Response length:', text.length, 'characters');
      
      // Clean the response text
      let cleanText = text.trim();
      
      // Remove markdown code blocks if present
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      
      // Try to extract JSON from the response
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

      let data;
      try {
        data = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('JSON parse error:', parseError.message);
        
        // Try to fix common JSON issues
        let fixedJson = jsonMatch[0]
          .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
          .replace(/"\s*\n\s*"/g, '" "') // Fix line breaks in strings
          .replace(/([^\\])\n/g, '$1 '); // Remove unescaped newlines
        
        // If still fails, try to truncate at last valid closing brace
        try {
          data = JSON.parse(fixedJson);
        } catch (secondError) {
          console.error('Second parse attempt failed, trying to auto-close JSON');
          
          // Find the position of the error and try to close JSON properly
          const errorPos = parseInt(secondError.message.match(/position (\d+)/)?.[1] || '0');
          if (errorPos > 0) {
            let truncated = fixedJson.substring(0, errorPos);
            // Count open braces/brackets and close them
            const openBraces = (truncated.match(/\{/g) || []).length;
            const closeBraces = (truncated.match(/\}/g) || []).length;
            const openBrackets = (truncated.match(/\[/g) || []).length;
            const closeBrackets = (truncated.match(/\]/g) || []).length;
            
            // Add missing closing characters
            for (let i = 0; i < (openBrackets - closeBrackets); i++) truncated += ']';
            for (let i = 0; i < (openBraces - closeBraces); i++) truncated += '}';
            
            console.log('Attempting to parse auto-closed JSON');
            data = JSON.parse(truncated);
          } else {
            throw secondError;
          }
        }
      }
      
      return data;
    } catch (error) {
      console.error('Error parsing JSON:', error);
      console.error('Raw response:', text.substring(0, 500));
      throw new Error(`Failed to parse JSON: ${error.message}`);
    }
  }

  /**
   * Generate additional exercises for a specific lesson (kept for backward compatibility)
   */
  async generateExercises(lessonTitle, lessonType, language) {
    try {
      const prompt = `Generate 5 additional exercises for a ${lessonType} lesson titled "${lessonTitle}" in ${language}. 

The exercises should be a mix of:
- Multiple choice questions
- Translation exercises
- Matching exercises
- Fill-in-the-blank exercises

Provide the response in this JSON format:
{
  "exercises": [
    {
      "type": "multiple_choice|translation|matching|fill_blank",
      "question": "Exercise question",
      "options": ["option 1", "option 2", "option 3", "option 4"],
      "correctAnswer": 0,
      "explanation": "Brief explanation of the answer"
    }
  ]
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return this.parseJSON(text);
    } catch (error) {
      console.error('Error generating exercises:', error);
      throw new Error('Failed to generate exercises');
    }
  }

  createCoursePrompt(language, expectedDuration) {
    return `Generate a language learning course for ${language} designed for ${expectedDuration} of learning.

CRITICAL: Respond with ONLY valid JSON. Keep it concise. Each lesson should have 2-3 vocabulary items and 1-2 exercises maximum.

1. Course Structure:
   - Create 3 units total
   - Each unit contains 3-4 lessons
   - Progressive difficulty from beginner to intermediate

2. JSON Format:
{
  "course": {
    "title": "${language} Learning Journey",
    "language": "${language}",
    "duration": "${expectedDuration}",
    "totalLessons": 35,
    "units": [
      {
        "id": 1,
        "title": "Unit Title",
        "description": "Brief description of what will be learned",
        "difficulty": "Beginner",
        "estimatedTime": "2-3 hours",
        "lessons": [
          {
            "id": 1,
            "title": "Lesson Title",
            "type": "vocabulary|grammar|conversation|review",
            "description": "What the lesson covers",
            "keyPhrases": ["phrase 1", "phrase 2", "phrase 3"],
            "vocabulary": [
              {
                "word": "foreign word",
                "translation": "english translation",
                "pronunciation": "phonetic pronunciation",
                "example": "example sentence"
              }
            ],
            "grammarPoints": [
              {
                "topic": "grammar topic",
                "explanation": "brief explanation",
                "examples": ["example 1", "example 2"]
              }
            ],
            "exercises": [
              {
                "type": "multiple_choice|translation|matching|listening",
                "question": "exercise question",
                "options": ["option 1", "option 2", "option 3", "option 4"],
                "correctAnswer": 0
              }
            ],
            "estimatedDuration": 15,
            "xpReward": 50
          }
        ]
      }
    ]
  }
}

3. Content Guidelines:
   - Start with basic greetings and introductions
   - Include essential vocabulary for daily life
   - Cover fundamental grammar concepts
   - Progress to more complex sentence structures
   - Include cultural notes where relevant
   - Each lesson should build upon previous knowledge
   - Include review lessons at the end of each unit

4. Difficulty Progression:
   - Unit 1: Absolute basics (greetings, numbers, simple phrases)
   - Unit 2: Building sentences (basic grammar, more vocabulary)
   - Unit 3: Everyday conversations (present tense, common situations)
   - Unit 4: More complex structures (past/future tense, more vocabulary)
   - Unit 5: Intermediate skills (conversations, cultural context)

Please ensure the response is valid JSON and covers all aspects mentioned above.`;
  }

}

export default new GeminiService();
