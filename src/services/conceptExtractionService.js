import { GoogleGenerativeAI } from '@google/generative-ai';
import knowledgeGraphRepository from '../repositories/knowledgeGraphRepository.js';

class ConceptExtractionService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not set. Concept extraction will be disabled.');
      this.model = null;
      return;
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  /**
   * Entry point. Called fire-and-forget from courseController after a course is saved.
   * Iterates every lesson in the course, extracts concept nodes, infers edges, saves both.
   */
  async extractConceptsForCourse(courseId, courseData) {
    if (!this.model) {
      console.warn('Concept extraction skipped: Gemini not configured.');
      return;
    }

    try {
      console.log(`🧠 Starting concept extraction for course ${courseId}...`);

      const units    = courseData.course?.units    || [];
      const language = courseData.course?.language || 'Unknown';

      const allNodes           = [];  // accumulated across all lessons
      const priorConceptKeys   = [];  // passed to each prompt so Gemini avoids repeating

      for (const unit of units) {
        const lessons = unit.lessons || [];

        for (const lesson of lessons) {
          // Resolve the course_lessons.id from unit/lesson numbers
          const lessonDbId = await knowledgeGraphRepository.findLessonDbIdByCourseAndLesson(
            courseId, unit.id, lesson.id
          );

          if (!lessonDbId) {
            console.warn(`  ⚠️  Lesson DB id not found — unit ${unit.id}, lesson ${lesson.id}. Skipping.`);
            continue;
          }

          const concepts = await this.extractConceptsForLesson(
            lesson, unit, priorConceptKeys, language
          );

          for (const concept of concepts) {
            allNodes.push({ ...concept, lessonDbId });
            priorConceptKeys.push(concept.concept_key);
          }
        }
      }

      if (allNodes.length === 0) {
        console.warn(`  ⚠️  No concept nodes extracted for course ${courseId}.`);
        return;
      }

      // Persist nodes — returns only the rows actually inserted (skips duplicates)
      const savedNodes = await knowledgeGraphRepository.saveConceptNodes(courseId, allNodes);

      // Build and persist edges from the saved node ordering
      const edges = this.inferEdges(savedNodes);
      if (edges.length > 0) {
        await knowledgeGraphRepository.saveConceptEdges(courseId, edges);
      }

      console.log(`✅ Concept graph ready — ${savedNodes.length} nodes, ${edges.length} edges for course ${courseId}`);
    } catch (error) {
      console.error(`❌ Concept extraction error for course ${courseId}:`, error.message);
      throw error;
    }
  }

  /**
   * Extract 1–3 concept nodes from a single lesson using Gemini.
   * Falls back to one concept derived from the lesson title if Gemini fails.
   */
  async extractConceptsForLesson(lesson, unit, priorConceptKeys, language) {
    const prompt = this.buildExtractionPrompt(lesson, unit, priorConceptKeys, language);

    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.3,
        },
      });

      const response = await result.response;
      const parsed   = this.parseConceptJSON(response.text());

      const concepts = (parsed.concepts || [])
        .map(c => ({
          concept_key:            this.sanitizeKey(c.key || c.concept_key || ''),
          concept_label:          c.label || c.concept_label || lesson.title,
          concept_type:           this.validateConceptType(c.type || lesson.type),
          difficulty:             Math.min(1, Math.max(0, parseFloat(c.difficulty) || 0.5)),
          estimated_mastery_time: parseInt(c.estimated_mastery_time) || lesson.estimatedDuration || 15,
        }))
        .filter(c => c.concept_key.length > 0);

      return concepts.length > 0 ? concepts : this.fallbackConcept(lesson);
    } catch (error) {
      console.error(`  ⚠️  Concept extraction failed for "${lesson.title}": ${error.message}`);
      return this.fallbackConcept(lesson);
    }
  }

  /**
   * Build the Gemini prompt for concept extraction from a single lesson.
   */
  buildExtractionPrompt(lesson, unit, priorConceptKeys, language) {
    const vocabularyPreview = Array.isArray(lesson.vocabulary)
      ? lesson.vocabulary.slice(0, 3).map(v => v.word || v).join(', ')
      : '';

    const grammarPreview = Array.isArray(lesson.grammarPoints)
      ? lesson.grammarPoints.slice(0, 2).map(g => g.topic || g).join(', ')
      : '';

    const recentPriorKeys = priorConceptKeys.slice(-12).join(', ') || 'none yet';

    return `You are analyzing a ${language} language lesson to identify distinct learnable concepts.

Lesson: "${lesson.title}"
Lesson category hint: ${lesson.type}
Unit difficulty: ${unit.difficulty}
Key vocabulary: ${vocabularyPreview || 'not listed'}
Grammar topics: ${grammarPreview   || 'not listed'}
Description: ${lesson.description  || 'not provided'}

Already extracted concepts (do NOT repeat these keys): ${recentPriorKeys}

Extract 1 to 3 distinct, specific learnable concepts from this lesson.
Concepts should be granular — "Present Tense Conjugation" not just "Grammar".
IMPORTANT: Assign the most accurate type based on WHAT the concept IS, not the lesson category hint:
  - vocabulary  → individual words, phrases, expressions, word lists
  - grammar     → grammatical rules, conjugations, sentence structure, tenses, articles
  - conversation → dialogues, real-world speaking patterns, social interactions, pronunciation
  - review      → mixed practice, consolidation of multiple prior concepts

A single lesson often contains BOTH vocabulary AND grammar concepts — extract each separately.

Respond with ONLY valid JSON. No markdown. No explanation outside JSON:
{
  "concepts": [
    {
      "key": "snake_case_unique_key",
      "label": "Human Readable Label",
      "type": "vocabulary",
      "difficulty": 0.4,
      "estimated_mastery_time": 15
    }
  ]
}

Rules:
- key: snake_case, descriptive, unique (e.g. "present_tense_ser", "basic_greetings")
- difficulty: 0.0 (easy) to 1.0 (hard), calibrated to unit difficulty "${unit.difficulty}"
- estimated_mastery_time: minutes to reach 80% mastery (range 10–40)
- type: MUST accurately reflect what the concept is — vocabulary | grammar | conversation | review
- Do NOT repeat any key from the already extracted list above`;
  }

  /**
   * Build a rich prerequisite edge graph from the saved concept nodes.
   *
   * Rules (in order of priority):
   *   1. Within-lesson: vocab → grammar → conversation (pedagogic dependency)
   *   2. Cross-lesson sequential: each node links to the next node of the SAME type
   *      (vocabulary chain, grammar chain, etc.) so type clusters stay connected
   *   3. Cross-type bridge every N lessons: a grammar node bridges to the next
   *      conversation node — models how grammar enables speaking
   *   4. Review hub: every review node connects back to the 3 most recent
   *      non-review nodes (review consolidates prior learning)
   *   5. Difficulty escalation: low-difficulty node → nearest higher-difficulty
   *      node of same type (skip-level shortcut for fast learners)
   *
   * This produces a web not a chain, so the force layout spreads nodes in 3D.
   */
  inferEdges(savedNodes) {
    const edges  = [];
    const edgeSet = new Set(); // "fromId→toId" for O(1) dedup

    const add = (fromId, toId, weight) => {
      if (fromId === toId) return;
      const key = `${fromId}→${toId}`;
      if (edgeSet.has(key)) return;
      edgeSet.add(key);
      edges.push({ from_concept_id: fromId, to_concept_id: toId, edge_weight: weight });
    };

    // Group nodes by lesson and by type
    const byLesson = new Map();
    const byType   = { vocabulary: [], grammar: [], conversation: [], review: [] };

    for (const node of savedNodes) {
      const group = byLesson.get(node.lesson_db_id) || [];
      group.push(node);
      byLesson.set(node.lesson_db_id, group);
      if (byType[node.concept_type]) byType[node.concept_type].push(node);
    }

    // ── Rule 1: within-lesson type chain vocab→grammar→conversation ──────────
    for (const [, lessonNodes] of byLesson) {
      const vocab  = lessonNodes.filter(n => n.concept_type === 'vocabulary');
      const gram   = lessonNodes.filter(n => n.concept_type === 'grammar');
      const conv   = lessonNodes.filter(n => n.concept_type === 'conversation');
      const rev    = lessonNodes.filter(n => n.concept_type === 'review');

      for (const v of vocab) {
        for (const g of gram)  add(v.id, g.id, 0.9);
        for (const c of conv)  add(v.id, c.id, 0.7);
      }
      for (const g of gram) {
        for (const c of conv)  add(g.id, c.id, 0.9);
        for (const r of rev)   add(g.id, r.id, 0.6);
      }
      for (const v of vocab) {
        for (const r of rev)   add(v.id, r.id, 0.6);
      }
    }

    // ── Rule 2: same-type sequential chain (keeps type clusters connected) ────
    for (const [type, nodes] of Object.entries(byType)) {
      for (let i = 0; i < nodes.length - 1; i++) {
        add(nodes[i].id, nodes[i + 1].id, type === 'review' ? 0.5 : 0.8);
      }
    }

    // ── Rule 3: cross-type bridge every 3 nodes ───────────────────────────────
    // grammar[i] → conversation[i]  and  vocabulary[i] → grammar[i]
    const bridgeStep = 3;
    const gramNodes  = byType.grammar;
    const convNodes  = byType.conversation;
    const vocNodes   = byType.vocabulary;

    for (let i = 0; i < gramNodes.length; i += bridgeStep) {
      const nearestConv = convNodes[Math.floor(i * convNodes.length / Math.max(gramNodes.length, 1))];
      if (nearestConv) add(gramNodes[i].id, nearestConv.id, 0.65);
    }
    for (let i = 0; i < vocNodes.length; i += bridgeStep) {
      const nearestGram = gramNodes[Math.floor(i * gramNodes.length / Math.max(vocNodes.length, 1))];
      if (nearestGram) add(vocNodes[i].id, nearestGram.id, 0.65);
    }

    // ── Rule 4: review hub — each review node links back to 3 prior nodes ─────
    const nonReview = savedNodes.filter(n => n.concept_type !== 'review');
    for (const rev of byType.review) {
      // find the 3 non-review nodes closest in insertion order before this review node
      const idx      = savedNodes.indexOf(rev);
      const prior    = nonReview.filter(n => savedNodes.indexOf(n) < idx).slice(-3);
      for (const p of prior) add(p.id, rev.id, 0.55);
    }

    // ── Rule 5: difficulty escalation within same type ────────────────────────
    for (const nodes of Object.values(byType)) {
      const sorted = [...nodes].sort((a, b) => a.difficulty - b.difficulty);
      for (let i = 0; i < sorted.length - 1; i++) {
        // only add if difficulty difference is meaningful (>0.15)
        if (sorted[i + 1].difficulty - sorted[i].difficulty > 0.15) {
          add(sorted[i].id, sorted[i + 1].id, 0.4);
        }
      }
    }

    return edges;
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  /**
   * Fallback: if Gemini fails for a lesson, create one concept from the lesson itself.
   */
  fallbackConcept(lesson) {
    return [{
      concept_key:            this.sanitizeKey(lesson.title),
      concept_label:          lesson.title,
      concept_type:           this.validateConceptType(lesson.type),
      difficulty:             0.5,
      estimated_mastery_time: lesson.estimatedDuration || 15,
    }];
  }

  /**
   * Convert any string to a valid snake_case concept key.
   */
  sanitizeKey(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .substring(0, 100);
  }

  /**
   * Ensure concept type is one of the four allowed values.
   */
  validateConceptType(type) {
    const allowed = ['vocabulary', 'grammar', 'conversation', 'review'];
    return allowed.includes(type) ? type : 'vocabulary';
  }

  /**
   * Parse Gemini JSON response robustly.
   * Same strategy as geminiService.parseJSON() — handles markdown fences,
   * trailing commas, and other common Gemini output issues.
   * Returns { concepts: [] } as a safe fallback instead of throwing.
   */
  parseConceptJSON(text) {
    try {
      let clean = text.trim();
      clean = clean.replace(/```json\n?/g, '').replace(/```/g, '').trim();

      const match = clean.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON object found in response');

      try {
        return JSON.parse(match[0]);
      } catch {
        const fixed = match[0]
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/"\s*\n\s*"/g, '" "');
        return JSON.parse(fixed);
      }
    } catch (error) {
      console.error('  ⚠️  Concept JSON parse error:', error.message);
      return { concepts: [] };
    }
  }
}

export default new ConceptExtractionService();
