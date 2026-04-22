/**
 * BLOCK 5 — AGGREGATION ENGINE
 * Crowd Pulse | Emotion Aggregator with Smoothing
 */

const { EMOTIONS } = require('./emotionEngine');

const MIN_MESSAGES = 5;    // Minimum to compute
const WINDOW_SIZE = 15;    // Primary window (last N messages)
const SMOOTHING_ALPHA = 0.4; // Exponential moving average factor

// Previous window snapshot for smoothing
let prevWindow = null;

/**
 * Build an empty emotion summary template
 */
function emptyEmotionSummary() {
  return Object.fromEntries(
    Object.values(EMOTIONS).map(e => [e, { count: 0, totalIntensity: 0, avgIntensity: 0 }])
  );
}

/**
 * Compute raw aggregation from a message array
 */
function computeRaw(messages) {
  const summary = emptyEmotionSummary();
  for (const msg of messages) {
    const e = msg.emotion;
    if (!summary[e]) continue;
    summary[e].count++;
    summary[e].totalIntensity += msg.intensity || 0;
  }
  for (const e of Object.values(EMOTIONS)) {
    const s = summary[e];
    s.avgIntensity = s.count > 0
      ? parseFloat((s.totalIntensity / s.count).toFixed(3))
      : 0;
  }
  return summary;
}

/**
 * Apply exponential moving average smoothing between two windows
 * Prevents sudden spikes / drops
 */
function smoothSummary(current, previous) {
  if (!previous) return current;

  const smoothed = {};
  for (const e of Object.values(EMOTIONS)) {
    const curr = current[e];
    const prev = previous[e];
    smoothed[e] = {
      count: Math.round(
        SMOOTHING_ALPHA * curr.count + (1 - SMOOTHING_ALPHA) * prev.count
      ),
      avgIntensity: parseFloat(
        (SMOOTHING_ALPHA * curr.avgIntensity + (1 - SMOOTHING_ALPHA) * prev.avgIntensity).toFixed(3)
      ),
    };
  }
  return smoothed;
}

/**
 * Main aggregation function
 * @param {Array} enrichedMessages - Messages with emotion + intensity fields
 * @returns aggregation result or null if insufficient data
 */
function aggregate(enrichedMessages) {
  const window = enrichedMessages.slice(-WINDOW_SIZE);

  if (window.length < MIN_MESSAGES) {
    return {
      ready: false,
      reason: `Need at least ${MIN_MESSAGES} messages (have ${window.length})`,
      emotions: emptyEmotionSummary(),
      dominantEmotion: null,
      totalMessages: window.length,
    };
  }

  const rawSummary = computeRaw(window);
  const smoothed = smoothSummary(rawSummary, prevWindow);
  prevWindow = rawSummary; // Store for next cycle

  // Find dominant emotion
  let dominantEmotion = null;
  let maxCount = 0;
  for (const [emotion, data] of Object.entries(smoothed)) {
    if (data.count > maxCount) {
      maxCount = data.count;
      dominantEmotion = emotion;
    }
  }

  // Total count for percentages
  const totalCount = Object.values(smoothed).reduce((sum, d) => sum + d.count, 0);

  // Percentage distribution
  const distribution = {};
  for (const [emotion, data] of Object.entries(smoothed)) {
    distribution[emotion] = {
      ...data,
      percentage: totalCount > 0
        ? parseFloat(((data.count / totalCount) * 100).toFixed(1))
        : 0,
    };
  }

  return {
    ready: true,
    emotions: distribution,
    dominantEmotion,
    dominantPercentage: distribution[dominantEmotion]?.percentage || 0,
    totalMessages: window.length,
    windowSize: WINDOW_SIZE,
  };
}

/**
 * Reset smoothing state (demo control)
 */
function resetAggregation() {
  prevWindow = null;
}

module.exports = {
  aggregate,
  resetAggregation,
  emptyEmotionSummary,
};
