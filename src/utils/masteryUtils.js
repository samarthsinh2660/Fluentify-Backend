/**
 * Concept mastery score computation.
 *
 * Each concept type has a different split between lesson score and exercise accuracy
 * because the nature of the skill determines which signal is more reliable:
 *
 *   vocabulary:   score 40% + exercises 60%  — recognition is key, drills matter
 *   grammar:      score 30% + exercises 70%  — hardest to fake; accuracy-heavy
 *   conversation: score 60% + exercises 40%  — fluency over drilling
 *   review:       score 50% + exercises 50%  — balanced recap
 */

const TYPE_WEIGHTS = {
  vocabulary:   { score: 0.4, exercise: 0.6 },
  grammar:      { score: 0.3, exercise: 0.7 },
  conversation: { score: 0.6, exercise: 0.4 },
  review:       { score: 0.5, exercise: 0.5 },
};

const DEFAULT_WEIGHTS = { score: 0.5, exercise: 0.5 };

/**
 * Compute a 0–1 mastery score for a concept after a lesson completion.
 *
 * @param {number} lessonScore   - Raw lesson score 0–100 (from req.body.score)
 * @param {Array}  exercises     - Array of { isCorrect: boolean } exercise attempts
 * @param {string} conceptType   - One of: vocabulary | grammar | conversation | review
 * @returns {number}             - Mastery score in [0, 1]
 */
const computeConceptMastery = (lessonScore, exercises, conceptType) => {
  const weights = TYPE_WEIGHTS[conceptType] ?? DEFAULT_WEIGHTS;

  const normalisedScore = Math.min(Math.max(lessonScore, 0), 100) / 100;

  const exerciseAccuracy =
    exercises.length === 0
      ? normalisedScore  // no exercises → fall back to lesson score
      : exercises.filter(e => e.isCorrect).length / exercises.length;

  return weights.score * normalisedScore + weights.exercise * exerciseAccuracy;
};

export { computeConceptMastery, TYPE_WEIGHTS };
