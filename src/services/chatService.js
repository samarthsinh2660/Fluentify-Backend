import { GoogleGenerativeAI } from '@google/generative-ai';
import courseRepository from '../repositories/courseRepository.js';
import progressRepository from '../repositories/progressRepository.js';

class ChatService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY is not set. Chat functionality will be limited.');
      this.genAI = null;
      this.model = null;
    } else {
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }
  }

  /**
   * Generate AI response based on user message and context
   */
  async generateResponse(userMessage, conversationHistory = [], learnerContext = null) {
    if (!this.model) {
      throw new Error('Gemini AI is not configured');
    }

    try {
      // Build context-aware prompt
      const systemPrompt = this.buildSystemPrompt(learnerContext);
      const conversationContext = this.buildConversationContext(conversationHistory);
      
      // Combine prompts
      const fullPrompt = `${systemPrompt}

${conversationContext}

User: ${userMessage}

AI Assistant:`;

      // Generate response
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.8,
        },
      });

      const response = await result.response;
      const aiResponse = response.text();

      return aiResponse.trim();
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw new Error(`Failed to generate AI response: ${error.message}`);
    }
  }

  /**
   * Build system prompt based on learner context
   */
  buildSystemPrompt(learnerContext) {
    let prompt = `You are Fluentify AI, a friendly and knowledgeable language learning assistant. Your role is to help learners with their language learning journey.

Core Guidelines:
- Be encouraging, patient, and supportive
- Provide clear, concise explanations
- Use examples to illustrate concepts
- Adapt your responses to the learner's level
- Focus on practical, real-world language use
- Correct mistakes gently and constructively
- Encourage practice and active learning`;

    if (learnerContext) {
      if (learnerContext.language) {
        prompt += `\n- The learner is studying: ${learnerContext.language}`;
      }
      if (learnerContext.currentLesson) {
        prompt += `\n- Current lesson focus: ${learnerContext.currentLesson}`;
      }
      if (learnerContext.progress) {
        prompt += `\n- Learner progress: ${learnerContext.progress}`;
      }
      if (learnerContext.recentTopics && learnerContext.recentTopics.length > 0) {
        prompt += `\n- Recent topics covered: ${learnerContext.recentTopics.join(', ')}`;
      }
    }

    prompt += `

You can help with:
- Vocabulary and pronunciation
- Grammar explanations and rules
- Practice conversations and dialogues
- Cultural insights and etiquette
- Study tips and motivation
- Answering questions about lessons
- Providing additional examples and exercises
- **Real-world scenario conversations** (restaurant, airport, shopping, hotel, etc.)
- Translating phrases and sentences
- Teaching common expressions and idioms

**Scenario-Based Learning:**
When a learner presents a scenario (e.g., "I'm in a restaurant in Paris, how do I order food?"), provide:
1. Key phrases they need in that situation
2. Pronunciation tips
3. Cultural context and etiquette
4. Example conversation/dialogue
5. Common responses they might hear

Examples of scenarios you can help with:
- At a restaurant (ordering, asking for the bill, dietary restrictions)
- At a hotel (checking in/out, asking for amenities)
- Shopping (asking prices, sizes, trying items)
- Transportation (buying tickets, asking directions)
- Meeting new people (greetings, small talk)
- Emergency situations (asking for help, finding pharmacy)
- Work/Business contexts (meetings, emails, phone calls)
- Any other real-world situations

Keep responses concise and focused. If the learner asks about something unrelated to language learning, politely redirect them to language-related topics.`;

    return prompt;
  }

  /**
   * Build conversation context from history
   */
  buildConversationContext(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return 'This is the start of a new conversation.';
    }

    let context = 'Previous conversation:\n';
    conversationHistory.forEach((msg) => {
      const role = msg.sender === 'learner' ? 'User' : 'AI Assistant';
      context += `${role}: ${msg.message}\n`;
    });

    return context;
  }

  /**
   * Get learner context for AI assistance
   */
  async getLearnerContext(learnerId, language = null) {
    try {
      const context = {
        language: language,
        currentLesson: null,
        progress: null,
        recentTopics: []
      };

      // Get active courses for the learner
      const courses = await courseRepository.findLearnerCoursesWithStats(learnerId);
      
      if (courses && courses.length > 0) {
        const activeCourse = language 
          ? courses.find(c => c.language.toLowerCase() === language.toLowerCase() && c.is_active)
          : courses.find(c => c.is_active);

        if (activeCourse) {
          context.language = activeCourse.language;
          context.progress = `${activeCourse.progress_percentage || 0}% complete`;

          // Get recent lesson progress
          const recentLessons = await progressRepository.getRecentLessons(learnerId, activeCourse.id, 5);
          
          if (recentLessons && recentLessons.length > 0) {
            context.currentLesson = recentLessons[0].title;
            context.recentTopics = recentLessons
              .map(lesson => lesson.title)
              .filter((title, index, self) => self.indexOf(title) === index)
              .slice(0, 3);
          }
        }
      }

      return context;
    } catch (error) {
      console.error('Error getting learner context:', error);
      return null;
    }
  }

  /**
   * Generate a suggested session title based on the first message
   */
  async generateSessionTitle(firstMessage) {
    if (!this.model) {
      return this.extractTopicFromMessage(firstMessage);
    }

    try {
      const prompt = `Based on this user message, generate a short, descriptive title (3-6 words max) for the chat session.
User message: "${firstMessage}"

Respond with ONLY the title, nothing else. Make it concise and relevant.`;

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 50,
          temperature: 0.7,
        },
      });

      const response = await result.response;
      let title = response.text().trim();
      
      // Clean up the title
      title = title.replace(/["']/g, '');
      title = title.length > 50 ? title.substring(0, 50) + '...' : title;
      
      return title || this.extractTopicFromMessage(firstMessage);
    } catch (error) {
      console.error('Error generating session title:', error);
      return this.extractTopicFromMessage(firstMessage);
    }
  }

  /**
   * Extract topic from message as fallback
   */
  extractTopicFromMessage(message) {
    const words = message.trim().split(' ').slice(0, 6).join(' ');
    return words.length > 50 ? words.substring(0, 50) + '...' : words || 'New Chat';
  }

  /**
   * Validate message content
   */
  validateMessage(message) {
    if (!message || typeof message !== 'string') {
      return { valid: false, error: 'Message must be a non-empty string' };
    }

    const trimmedMessage = message.trim();
    
    if (trimmedMessage.length === 0) {
      return { valid: false, error: 'Message cannot be empty' };
    }

    if (trimmedMessage.length > 2000) {
      return { valid: false, error: 'Message is too long. Maximum 2000 characters allowed.' };
    }

    return { valid: true, message: trimmedMessage };
  }
}

export default new ChatService();
