import knowledgeGraphRepository from '../repositories/knowledgeGraphRepository.js';
import courseRepository from '../repositories/courseRepository.js';
import remedialGenerationService from './remedialGenerationService.js';

// ─── Min-Heap ─────────────────────────────────────────────────────────────────
// Keyed priority queue used by A*. Items are { id, priority }.
// Lower priority = extracted first.

class MinHeap {
  constructor() {
    this._heap = [];
  }

  get size() {
    return this._heap.length;
  }

  isEmpty() {
    return this._heap.length === 0;
  }

  push(id, priority) {
    this._heap.push({ id, priority });
    this._bubbleUp(this._heap.length - 1);
  }

  extractMin() {
    const min = this._heap[0];
    const last = this._heap.pop();
    if (this._heap.length > 0) {
      this._heap[0] = last;
      this._sinkDown(0);
    }
    return min;
  }

  // Update priority if new value is lower (decrease-key)
  decreasePriority(id, newPriority) {
    const idx = this._heap.findIndex(item => item.id === id);
    if (idx === -1 || this._heap[idx].priority <= newPriority) return;
    this._heap[idx].priority = newPriority;
    this._bubbleUp(idx);
  }

  has(id) {
    return this._heap.some(item => item.id === id);
  }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this._heap[parent].priority <= this._heap[idx].priority) break;
      [this._heap[parent], this._heap[idx]] = [this._heap[idx], this._heap[parent]];
      idx = parent;
    }
  }

  _sinkDown(idx) {
    const n = this._heap.length;
    while (true) {
      const left  = 2 * idx + 1;
      const right = 2 * idx + 2;
      let smallest = idx;
      if (left  < n && this._heap[left].priority  < this._heap[smallest].priority) smallest = left;
      if (right < n && this._heap[right].priority < this._heap[smallest].priority) smallest = right;
      if (smallest === idx) break;
      [this._heap[smallest], this._heap[idx]] = [this._heap[idx], this._heap[smallest]];
      idx = smallest;
    }
  }
}

// ─── A* Service ───────────────────────────────────────────────────────────────

class AStarService {
  /**
   * Public entry point.
   * Builds the concept graph, computes learner state, runs A*, saves the result.
   *
   * @param {number} learnerId
   * @param {number} courseId
   * @param {{ topN?: number }} options
   * @returns {Promise<Object>} full recommendation result object
   */
  async computeRecommendations(learnerId, courseId, options = {}) {
    const topN = options.topN ?? 3;

    const graph        = await this.buildGraph(courseId, learnerId);
    const learnerState = this.computeLearnerState(graph);

    if (graph.nodes.size === 0) {
      return this.emptyResult(courseId);
    }

    const { path, gScores } = this.runAStar(graph, learnerState);
    const result            = this.buildResult(path, graph, learnerState, gScores, courseId, topN);

    // Persist run — fire-and-forget, never block the response
    knowledgeGraphRepository
      .saveRecommendation(learnerId, courseId, result)
      .catch(err => console.error('Failed to save recommendation history:', err.message));

    // Case 2: Remedial generation — fire-and-forget for each weak node in the top path
    // Only triggered when the linked lesson is already completed (checked inside the service)
    if (graph.nodes.size > 0) {
      const topRecommended = result.recommendations.slice(0, 3);
      for (const rec of topRecommended) {
        const node = graph.nodes.get(rec.conceptId);
        if (node && node.masteryScore < 0.5) {
          remedialGenerationService
            .checkAndGenerate(learnerId, courseId, node)
            .catch(err => console.error('Remedial check failed silently:', err.message));
        }
      }
    }

    return result;
  }

  // ─── Graph Construction ──────────────────────────────────────────────────

  /**
   * Load concept nodes + edges + mastery scores from the DB and build
   * in-memory adjacency structures for A*.
   *
   * @returns {{ nodes: Map, adjList: Map, predecessors: Map, minEdgeWeight: number }}
   */
  async buildGraph(courseId, learnerId) {
    const [rawNodes, rawEdges, masteryRows] = await Promise.all([
      knowledgeGraphRepository.findConceptNodesByCourse(courseId),
      knowledgeGraphRepository.findConceptEdgesByCourse(courseId),
      knowledgeGraphRepository.findConceptMasteryForLearner(learnerId, courseId),
    ]);

    // Build mastery lookup: conceptId → score
    const masteryMap = new Map();
    for (const row of masteryRows) {
      masteryMap.set(row.id, {
        mastery_score: parseFloat(row.mastery_score) || 0,
        attempts:      parseInt(row.attempts)        || 0,
        correct_count: parseInt(row.correct_count)   || 0,
      });
    }

    // Resolve lesson DB ids → logical unit/lesson numbers in parallel
    const lessonDbIds = [...new Set(rawNodes.map(n => n.lesson_db_id).filter(Boolean))];
    const lessonNumberMap = new Map();
    await Promise.all(lessonDbIds.map(async (dbId) => {
      const nums = await courseRepository.findLessonNumbers(dbId);
      if (nums) lessonNumberMap.set(dbId, nums);
    }));

    // Nodes map: id → enriched node object
    const nodes = new Map();
    for (const n of rawNodes) {
      const mastery = masteryMap.get(n.id) || { mastery_score: 0, attempts: 0, correct_count: 0 };
      const lessonNums = lessonNumberMap.get(n.lesson_db_id);
      nodes.set(n.id, {
        id:                    n.id,
        lessonDbId:            n.lesson_db_id,
        unitNumber:            lessonNums?.unit_number   ?? null,
        lessonNumber:          lessonNums?.lesson_number ?? null,
        conceptKey:            n.concept_key,
        conceptLabel:          n.concept_label,
        conceptType:           n.concept_type,
        difficulty:            parseFloat(n.difficulty)             || 0.5,
        estimatedMasteryTime:  parseInt(n.estimated_mastery_time)   || 15,
        masteryScore:          mastery.mastery_score,
        attempts:              mastery.attempts,
        correctCount:          mastery.correct_count,
      });
    }

    // Adjacency list: nodeId → [{ toId, weight }]
    const adjList     = new Map();
    // Predecessor list: nodeId → [{ fromId, weight }]  (for h(n) descendant counting)
    const predecessors = new Map();

    for (const n of nodes.keys()) {
      adjList.set(n, []);
      predecessors.set(n, []);
    }

    let minEdgeWeight = Infinity;

    for (const e of rawEdges) {
      const weight = parseFloat(e.edge_weight) || 1.0;

      if (adjList.has(e.from_concept_id) && nodes.has(e.to_concept_id)) {
        adjList.get(e.from_concept_id).push({ toId: e.to_concept_id, weight });
        predecessors.get(e.to_concept_id).push({ fromId: e.from_concept_id, weight });
      }

      // Track minimum possible edge weight (used in admissible heuristic)
      const baseWeight = nodes.get(e.to_concept_id)?.difficulty *
                         nodes.get(e.to_concept_id)?.estimatedMasteryTime || 0;
      if (baseWeight > 0 && baseWeight < minEdgeWeight) {
        minEdgeWeight = baseWeight;
      }
    }

    if (minEdgeWeight === Infinity) minEdgeWeight = 1;

    return { nodes, adjList, predecessors, minEdgeWeight };
  }

  // ─── Learner State ───────────────────────────────────────────────────────

  /**
   * Derive aggregated mastery stats from the enriched node map.
   *
   * @returns {{ overall, byType, weakNodes, masteredNodes }}
   */
  computeLearnerState(graph) {
    const { nodes } = graph;

    const byType = { vocabulary: [], grammar: [], conversation: [], review: [] };
    const weakNodes     = [];
    const masteredNodes = [];

    for (const node of nodes.values()) {
      const bucket = byType[node.conceptType];
      if (bucket) bucket.push(node.masteryScore);

      if (node.masteryScore < 0.5)  weakNodes.push(node);
      if (node.masteryScore >= 0.8) masteredNodes.push(node);
    }

    // Sort weakest first
    weakNodes.sort((a, b) => a.masteryScore - b.masteryScore);

    const avg = arr => arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;

    const masteryProfile = {
      overall:      avg([...nodes.values()].map(n => n.masteryScore)),
      vocabulary:   avg(byType.vocabulary),
      grammar:      avg(byType.grammar),
      conversation: avg(byType.conversation),
      review:       avg(byType.review),
      weakTypes:    Object.entries(byType)
                      .filter(([, arr]) => avg(arr) < 0.5 && arr.length > 0)
                      .map(([type]) => type),
      strongTypes:  Object.entries(byType)
                      .filter(([, arr]) => avg(arr) >= 0.8 && arr.length > 0)
                      .map(([type]) => type),
    };

    return { masteryProfile, weakNodes, masteredNodes };
  }

  // ─── A* Core ─────────────────────────────────────────────────────────────

  /**
   * Standard forward A* on the concept DAG.
   *
   * Start nodes = weakest unmastered concepts (mastery < 0.5).
   * If no weak concepts, start = first node in topological order.
   *
   * Goal = all nodes at mastery >= 0.8. A* terminates when the open set
   * is empty (no more nodes to improve) and returns the ordered expansion path.
   *
   * g(n) = accumulated edge weight (mastery-weighted cost)
   * h(n) = admissible heuristic (see computeHeuristic)
   * f(n) = g(n) + h(n)
   *
   * @returns {{ path: number[], gScores: Map }}
   */
  runAStar(graph, learnerState) {
    const { nodes, adjList, minEdgeWeight } = graph;
    const { weakNodes }                     = learnerState;

    const gScores  = new Map();   // nodeId → best known g cost
    const cameFrom = new Map();   // nodeId → predecessor nodeId
    const visited  = new Set();   // closed set
    const path     = [];          // expansion order for unmastered nodes
    const heap     = new MinHeap();

    // Initialise start nodes
    const startNodes = weakNodes.length > 0
      ? weakNodes.slice(0, 3)              // up to 3 weakest
      : this.topologicalStart(graph);      // fallback: topological order

    for (const startNode of startNodes) {
      gScores.set(startNode.id, 0);
      const h = this.computeHeuristic(startNode, graph, minEdgeWeight);
      heap.push(startNode.id, h);
    }

    while (!heap.isEmpty()) {
      const { id: currentId } = heap.extractMin();

      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const current = nodes.get(currentId);
      if (!current) continue;

      // Record this node in the path if it still needs work
      if (current.masteryScore < 0.8) {
        path.push(currentId);
      }

      // Expand neighbours
      for (const { toId, weight } of (adjList.get(currentId) || [])) {
        if (visited.has(toId)) continue;

        const neighbour       = nodes.get(toId);
        if (!neighbour) continue;

        const edgeCost        = this.computeEdgeWeight(current, neighbour);
        const tentativeG      = (gScores.get(currentId) || 0) + edgeCost;
        const knownG          = gScores.get(toId) ?? Infinity;

        if (tentativeG < knownG) {
          gScores.set(toId, tentativeG);
          cameFrom.set(toId, currentId);
          const f = tentativeG + this.computeHeuristic(neighbour, graph, minEdgeWeight);
          if (heap.has(toId)) {
            heap.decreasePriority(toId, f);
          } else {
            heap.push(toId, f);
          }
        }
      }
    }

    return { path, gScores, cameFrom };
  }

  // ─── Cost & Heuristic ────────────────────────────────────────────────────

  /**
   * Edge weight from node u to node v.
   *
   * weight(u→v) = v.difficulty × v.estimatedMasteryTime × prerequisitePenalty(u)
   *
   * prerequisitePenalty(u) = 1 / max(u.masteryScore, 0.05)
   *   → fully mastered prerequisite  = penalty of 1.0  (no extra cost)
   *   → completely unknown prerequisite = penalty of 20.0 (high cost to skip ahead)
   */
  computeEdgeWeight(fromNode, toNode) {
    const prerequisitePenalty = 1 / Math.max(fromNode.masteryScore, 0.05);
    return toNode.difficulty * toNode.estimatedMasteryTime * prerequisitePenalty;
  }

  /**
   * Admissible heuristic h(n).
   *
   * h(n) = unmasteredDescendants(n) × minEdgeWeight × (1 - avgDescendantMastery)
   *
   * Admissibility proof:
   *   Actual cost to reach mastery from n ≥ sum of at least (unmasteredCount) edge
   *   costs, each ≥ minEdgeWeight × (1 - mastery factor).
   *   Since we multiply by minEdgeWeight (the lowest possible cost per step),
   *   h(n) never overestimates the true remaining cost. ✓
   *
   * Consistency:
   *   For any edge (n→m): h(n) ≤ edgeWeight(n,m) + h(m)
   *   Each step reduces unmasteredDescendants by at least 1, so
   *   h decreases by at least minEdgeWeight per step. ✓
   */
  computeHeuristic(node, graph, minEdgeWeight) {
    const { nodes, adjList } = graph;

    // BFS to count unmastered descendants
    const visited  = new Set([node.id]);
    const queue    = [node.id];
    let   count    = 0;
    let   totalM   = 0;

    while (queue.length > 0) {
      const curr = queue.shift();
      for (const { toId } of (adjList.get(curr) || [])) {
        if (visited.has(toId)) continue;
        visited.add(toId);
        const desc = nodes.get(toId);
        if (desc && desc.masteryScore < 0.8) {
          count++;
          totalM += desc.masteryScore;
          queue.push(toId);
        }
      }
    }

    if (count === 0) return 0;

    const avgDescendantMastery = totalM / count;
    return count * minEdgeWeight * (1 - avgDescendantMastery);
  }

  // ─── Result Builder ───────────────────────────────────────────────────────

  /**
   * Convert the raw A* path into a structured recommendation response.
   */
  buildResult(path, graph, learnerState, gScores, courseId, topN) {
    const { nodes, minEdgeWeight } = graph;
    const { masteryProfile }       = learnerState;

    // Take the first topN unmastered nodes from the path as recommendations
    const topPath = path
      .filter(id => {
        const n = nodes.get(id);
        return n && n.masteryScore < 0.8;
      })
      .slice(0, topN);

    const recommendations = topPath.map((id, idx) => {
      const node = nodes.get(id);
      const g    = gScores.get(id) || 0;
      const h    = this.computeHeuristic(node, graph, minEdgeWeight);

      return {
        rank:         idx + 1,
        conceptId:    node.id,
        conceptLabel: node.conceptLabel,
        conceptType:  node.conceptType,
        conceptKey:   node.conceptKey,
        lessonDbId:   node.lessonDbId,
        unitNumber:   node.unitNumber,
        lessonNumber: node.lessonNumber,
        masteryScore: node.masteryScore,
        urgency:      this.deriveUrgency(node.masteryScore),
        reason:       this.buildReason(node, graph),
        estimatedMasteryTime: node.estimatedMasteryTime,
        fScore: parseFloat((g + h).toFixed(4)),
        gScore: parseFloat(g.toFixed(4)),
        hScore: parseFloat(h.toFixed(4)),
        isRemedial:   false,
        isPreparing:  false,
      };
    });

    return {
      algorithmUsed:  'astar',
      courseId,
      computedAt:     new Date().toISOString(),
      masteryProfile,
      recommendations,
      fullPath:            path,
      totalPathLength:     path.length,
      totalEstimatedTime:  path.reduce((sum, id) => {
        return sum + (nodes.get(id)?.estimatedMasteryTime || 0);
      }, 0),
      graphStats: {
        totalConcepts:    nodes.size,
        masteredConcepts: [...nodes.values()].filter(n => n.masteryScore >= 0.8).length,
        weakConcepts:     [...nodes.values()].filter(n => n.masteryScore  < 0.5).length,
        untouchedConcepts:[...nodes.values()].filter(n => n.attempts === 0).length,
      },
    };
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  /**
   * Urgency based on mastery score thresholds.
   */
  deriveUrgency(masteryScore) {
    if (masteryScore < 0.3) return 'high';
    if (masteryScore < 0.6) return 'normal';
    return 'low';
  }

  /**
   * Human-readable reason for why this concept was recommended.
   */
  buildReason(node, graph) {
    const { adjList, nodes } = graph;
    const blockedCount = (adjList.get(node.id) || [])
      .filter(({ toId }) => nodes.get(toId)?.masteryScore < 0.8)
      .length;

    const pct = Math.round(node.masteryScore * 100);

    if (blockedCount > 0) {
      return `${node.conceptType} mastery at ${pct}% — blocks ${blockedCount} downstream concept${blockedCount > 1 ? 's' : ''}`;
    }
    return `${node.conceptType} mastery at ${pct}% — strengthen this to advance`;
  }

  /**
   * Topological start: returns the first nodes in topological order for learners
   * with no weaknesses (everything above 50% mastery).
   */
  topologicalStart(graph) {
    const { nodes, predecessors } = graph;
    const inDegree = new Map();

    for (const id of nodes.keys()) {
      inDegree.set(id, (predecessors.get(id) || []).length);
    }

    const roots = [...nodes.values()].filter(n => inDegree.get(n.id) === 0);
    return roots.length > 0 ? roots.slice(0, 3) : [[...nodes.values()][0]].filter(Boolean);
  }

  /**
   * Returned when the concept graph hasn't been built yet for this course.
   */
  emptyResult(courseId) {
    return {
      algorithmUsed:   'astar',
      courseId,
      computedAt:      new Date().toISOString(),
      masteryProfile:  { overall: 0, vocabulary: 0, grammar: 0, conversation: 0, review: 0, weakTypes: [], strongTypes: [] },
      recommendations: [],
      fullPath:        [],
      totalPathLength: 0,
      totalEstimatedTime: 0,
      graphStats:      { totalConcepts: 0, masteredConcepts: 0, weakConcepts: 0, untouchedConcepts: 0 },
    };
  }
}

export default new AStarService();
