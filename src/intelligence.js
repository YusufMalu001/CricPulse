/**
 * BLOCK 6 — INTELLIGENCE FEATURES
 * Crowd Pulse | Prediction, Detection, and Interactive Features
 */

const { EMOTIONS } = require('./emotionEngine');

// ─── PLAYER ALIAS MAP ────────────────────────────────────────────────────────
const PLAYER_ALIASES = {
  samson: ['samson', 'sanju', 'sanju samson', 'captain'],
  jaiswal: ['jaiswal', 'yashasvi'],
  hetmyer: ['hetmyer', 'hetty'],
  pooran: ['pooran', 'nicholas', 'nicky p'],
  rahul: ['kl rahul', 'kl', 'lokesh', 'rahul'],
  stoinis: ['stoinis', 'marcus'],
  bishnoi: ['bishnoi', 'ravi'],
  boult: ['boult', 'trent'],
  parag: ['parag', 'riyan'],
};
let activeDynamicPlayers = null;

function setActiveLivePlayers(playerNames) {
  activeDynamicPlayers = {};
  playerNames.forEach(name => {
    // Basic alias generation from the fetched name
    const parts = name.split(' ');
    activeDynamicPlayers[name] = [name, ...parts];
  });
}
// ─── INTERNAL STATE ───────────────────────────────────────────────────────────
let predictionCache = null;
let predictionLockCycles = 0;
const PREDICTION_LOCK_CYCLES = 2;

let spikeCooldownCycles = 0;
const SPIKE_COOLDOWN = 2;
let prevWindowCount = 0;
const SPIKE_MULTIPLIER = 1.8;
const SPIKE_MIN_BASELINE = 20;

let trendingAlertPerOver = {};
let prevUserCount = 0;
let prevVelocity = 0;

// ─── 1. NEXT BALL EMOTION PREDICTION ─────────────────────────────────────────
/**
 * Predict crowd emotion for next ball
 * Only fires if dominant emotion > 60% and locks for 2 cycles
 */
function predictNextBall(enrichedMessages) {
  const window = enrichedMessages.slice(-10);

  if (window.length < 5) {
    predictionLockCycles = Math.max(0, predictionLockCycles - 1);
    return { active: false, reason: 'Insufficient data' };
  }

  // Use locked prediction if still valid
  if (predictionLockCycles > 0 && predictionCache) {
    predictionLockCycles--;
    return { ...predictionCache, locked: true };
  }

  // Count emotions
  const counts = {};
  for (const e of Object.values(EMOTIONS)) counts[e] = 0;
  for (const msg of window) {
    if (counts[msg.emotion] !== undefined) counts[msg.emotion]++;
  }

  const total = window.length;
  let dominant = null;
  let maxCount = 0;
  for (const [e, c] of Object.entries(counts)) {
    if (c > maxCount) { maxCount = c; dominant = e; }
  }

  const dominantPct = (maxCount / total) * 100;

  if (dominantPct < 60) {
    predictionCache = null;
    return { active: false, reason: 'No dominant signal (< 60%)' };
  }

  // Average intensity for dominant emotion
  const intensities = window.filter(m => m.emotion === dominant).map(m => m.intensity);
  const avgIntensity = intensities.reduce((a, b) => a + b, 0) / intensities.length;
  const confidence = parseFloat((0.5 + (dominantPct - 60) / 100).toFixed(2));

  predictionCache = {
    active: true,
    emotion: dominant,
    percentage: parseFloat(dominantPct.toFixed(1)),
    confidence: Math.min(confidence, 0.97),
    avgIntensity: parseFloat(avgIntensity.toFixed(2)),
    label: `High ${dominant}, Confidence: ${Math.min(confidence, 0.97).toFixed(2)}`,
    locked: false,
  };
  predictionLockCycles = PREDICTION_LOCK_CYCLES;

  return predictionCache;
}

// ─── 2. MAIN CHARACTER DETECTION ─────────────────────────────────────────────
/**
 * Identify the most mentioned player in recent messages
 */
function detectMainCharacter(enrichedMessages) {
  const window = enrichedMessages.slice(-20);
  if (window.length < 5) return { active: false, player: null, share: 0 };

  const playerMentions = {};
  const aliasesToUse = activeDynamicPlayers || PLAYER_ALIASES;
  for (const [canonical, aliases] of Object.entries(aliasesToUse)) {
    playerMentions[canonical] = 0;
  }

  let totalMentions = 0;

  for (const msg of window) {
    const text = msg.text || '';
    for (const [canonical, aliases] of Object.entries(aliasesToUse)) {
      for (const alias of aliases) {
        if (text.includes(alias)) {
          playerMentions[canonical]++;
          totalMentions++;
          break; // count each player once per message
        }
      }
    }
  }

  if (totalMentions === 0) return { active: false, player: 'No dominant player', share: 0 };

  let topPlayer = null;
  let maxMentions = 0;
  for (const [player, count] of Object.entries(playerMentions)) {
    if (count > maxMentions) { maxMentions = count; topPlayer = player; }
  }

  const share = parseFloat(((maxMentions / window.length) * 100).toFixed(1));

  if (share < 30) return { active: false, player: 'No dominant player', share };

  return {
    active: true,
    player: topPlayer.charAt(0).toUpperCase() + topPlayer.slice(1),
    share,
    mentions: maxMentions,
  };
}

// ─── 3. VIRAL SPIKE DETECTION ─────────────────────────────────────────────────
/**
 * Detect if message volume has spiked vs previous window
 */
function detectSpike(currentWindowCount) {
  if (spikeCooldownCycles > 0) {
    spikeCooldownCycles--;
    prevWindowCount = currentWindowCount;
    return { spike: false, cooldown: true };
  }

  // Snapshot BEFORE overwriting so multiplier is accurate
  const snapshot = prevWindowCount;
  let spike = false;

  if (
    snapshot >= SPIKE_MIN_BASELINE &&
    currentWindowCount > snapshot * SPIKE_MULTIPLIER
  ) {
    spike = true;
    spikeCooldownCycles = SPIKE_COOLDOWN;
  }

  prevWindowCount = currentWindowCount;

  return {
    spike,
    currentCount: currentWindowCount,
    previousCount: snapshot,
    multiplier: snapshot > 0
      ? parseFloat((currentWindowCount / snapshot).toFixed(2))
      : 0,
    cooldown: false,
  };
}

// ─── 4. TRENDING IN 30 SECONDS ────────────────────────────────────────────────
/**
 * Determine if the crowd is trending toward a major reaction
 */
function detectTrending(enrichedMessages, aggregation, currentOver) {
  // Max 1 alert per over
  if (trendingAlertPerOver[currentOver]) {
    return { trending: false, reason: 'Alert already fired this over' };
  }

  const window = enrichedMessages.slice(-15);
  const prevWindow2 = enrichedMessages.slice(-30, -15);

  if (window.length < 8) return { trending: false, reason: 'Insufficient data' };

  // Signal 1: Message velocity increasing
  const velocitySignal = window.length > prevWindow2.length;

  // Signal 2: Emotion intensity high (avg intensity > 0.65)
  const avgIntensity = window.reduce((sum, m) => sum + (m.intensity || 0), 0) / window.length;
  const intensitySignal = avgIntensity > 0.65;

  // Signal 3: Unique users increasing
  const uniqueNow = new Set(window.map(m => m.user_id)).size;
  const uniquePrev = new Set(prevWindow2.map(m => m.user_id)).size;
  const uniqueSignal = uniqueNow > prevUserCount;
  prevUserCount = uniqueNow;

  // Count active signals
  const signals = [velocitySignal, intensitySignal, uniqueSignal];
  const activeSignals = signals.filter(Boolean).length;
  const confidence = parseFloat((activeSignals / signals.length).toFixed(2));

  if (confidence < 0.8) {
    return {
      trending: false,
      confidence,
      reason: `Only ${activeSignals}/3 signals active`,
    };
  }

  // Build reason string
  const reasons = [];
  if (velocitySignal) reasons.push('message velocity rising');
  if (intensitySignal) reasons.push(`high emotion intensity (${avgIntensity.toFixed(2)})`);
  if (uniqueSignal) reasons.push('unique fans increasing');

  trendingAlertPerOver[currentOver] = true;

  const dominant = aggregation?.dominantEmotion || 'Unknown';

  return {
    trending: true,
    confidence,
    reason: reasons.join(' · '),
    label: 'Likely to trend in 30 seconds',
    dominantEmotion: dominant,
    confidencePct: Math.round(confidence * 100),
  };
}

// ─── 5. YOU VS CROWD ─────────────────────────────────────────────────────────
const USER_LOCK_MS = 5000;
let userSelection = null;
let userSelectionTime = null;

/**
 * Set user's emotional stance (Confident or Nervous)
 */
function setUserStance(stance) {
  const validStances = ['Confident', 'Nervous'];
  if (!validStances.includes(stance)) return { error: 'Invalid stance' };
  userSelection = stance;
  userSelectionTime = Date.now();
  return { success: true, stance, lockedUntil: userSelectionTime + USER_LOCK_MS };
}

/**
 * Compare user stance vs crowd emotion
 */
function compareYouVsCrowd(aggregation) {
  if (!userSelection) return { active: false, reason: 'No user selection' };

  // Check if selection is locked (within 5 seconds)
  const isLocked = userSelectionTime && (Date.now() - userSelectionTime < USER_LOCK_MS);

  if (!aggregation?.ready) return { active: false, reason: 'Aggregation not ready' };

  const emotions = aggregation.emotions || {};

  // Map user stances to crowd emotions
  const stanceEmotionMap = {
    Confident: [EMOTIONS.EUPHORIA],
    Nervous: [EMOTIONS.TENSION, EMOTIONS.FRUSTRATION],
  };

  // Find the crowd majority emotion %
  const crowdEmotion = aggregation.dominantEmotion;
  const crowdPct = aggregation.dominantPercentage || 0;

  if (crowdPct < 60) {
    return {
      active: false,
      reason: 'No crowd majority (< 60%)',
      userStance: userSelection,
      locked: isLocked,
    };
  }

  // Determine if user aligns with crowd
  const alignedEmotions = stanceEmotionMap[userSelection] || [];
  const aligned = alignedEmotions.includes(crowdEmotion);

  return {
    active: true,
    userStance: userSelection,
    crowdEmotion,
    crowdPercentage: crowdPct,
    aligned,
    label: `You: ${userSelection} | Crowd: ${crowdPct}% ${crowdEmotion}`,
    locked: isLocked,
    message: aligned
      ? `You're in sync with the crowd!`
      : `You're against the crowd tide!`,
  };
}

// ─── RESET (DEMO CONTROL) ─────────────────────────────────────────────────────
function resetIntelligence() {
  predictionCache = null;
  predictionLockCycles = 0;
  spikeCooldownCycles = 0;
  prevWindowCount = 0;
  trendingAlertPerOver = {};
  prevUserCount = 0;
  prevVelocity = 0;
  userSelection = null;
  userSelectionTime = null;
}

module.exports = {
  predictNextBall,
  detectMainCharacter,
  detectSpike,
  detectTrending,
  setUserStance,
  compareYouVsCrowd,
  resetIntelligence,
  setActiveLivePlayers,
};
