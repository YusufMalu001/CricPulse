/**
 * BLOCK 3 — EMOTION ENGINE
 * Crowd Pulse | Emotion Classification Layer
 */

// Emotion definitions
const EMOTIONS = {
  EUPHORIA: 'Euphoria',
  TENSION: 'Tension',
  FRUSTRATION: 'Frustration',
  DISBELIEF: 'Disbelief',
};

// Keyword maps with weights
const EMOTION_KEYWORDS = {
  [EMOTIONS.EUPHORIA]: {
    keywords: [
      'six', 'sixer', 'four', 'boundary', 'great shot', 'amazing', 'brilliant',
      'century', 'fifty', 'hundred', 'masterpiece', 'wow', 'incredible',
      'legend', 'superstar', 'cheer', 'yes', 'yesss', 'yessss', 'woohoo',
      'lets go', 'best', 'fantastic', 'stunning', 'perfect', 'magnificent',
      'champion', 'win', 'winning', 'dominating', 'fire', 'beast',
      '🎉', '🔥', '💪', '🏏', '🙌', '😍', '🥳', '🎊', '💯',
    ],
    weight: 1.0,
  },
  [EMOTIONS.TENSION]: {
    keywords: [
      'wicket', 'out', 'nooo', 'no no', 'pressure', 'tight', 'tense',
      'nervous', 'stress', 'critical', 'last ball', 'final over', 'clutch',
      'edge', 'edge of seat', 'nail biting', 'thriller', 'danger', 'risky',
      'close match', 'neck and neck', 'need runs', 'last wicket', 'holding breath',
      'too close', 'intense', 'scary', 'ohh', 'ohhh', 'ahhh',
      '😰', '😨', '🤞', '🙏', '😬',
    ],
    weight: 1.0,
  },
  [EMOTIONS.FRUSTRATION]: {
    keywords: [
      'terrible', 'awful', 'horrible', 'pathetic', 'useless', 'rubbish',
      'disgrace', 'embarrassing', 'waste', 'missed', 'dropped', 'no no no',
      'come on', 'seriously', 'ugh', 'argh', 'why', 'stupid shot',
      'what was that', 'not again', 'every time', 'always happens',
      'disappointed', 'sad', 'angry', 'furious', 'disrespect',
      'selfish batting', 'poor fielding', 'slow',
      '😤', '😡', '🤦', '😞', '😠', '💔',
    ],
    weight: 1.0,
  },
  [EMOTIONS.DISBELIEF]: {
    keywords: [
      'what', 'unbelievable', 'cannot believe', 'no way', 'seriously',
      'is this real', 'shocked', 'jaw drop', 'speechless', 'omg',
      'oh my god', 'oh my', 'wait what', 'how', 'unexpected',
      'never seen', 'rare', 'impossible', 'crazy', 'insane', 'wild',
      'surreal', 'what just happened', 'mind blown', 'huh', 'bizarre',
      '😲', '🤯', '😳', '🫢', '😮',
    ],
    weight: 1.0,
  },
};

// Sarcasm indicators — flip euphoria to frustration
const SARCASM_MARKERS = [
  'yeah right', 'sure', 'great job', 'well done team', 'nice one',
  'brilliant as always', 'oh wow another', 'classic', 'lol yeah',
];

/**
 * Score a message against all emotion keyword maps
 */
function scoreMessage(text) {
  const scores = {};
  for (const [emotion, config] of Object.entries(EMOTION_KEYWORDS)) {
    let score = 0;
    for (const kw of config.keywords) {
      if (text.includes(kw)) {
        // Longer keyword = higher confidence signal
        score += (kw.length > 5 ? 2 : 1) * config.weight;
      }
    }
    scores[emotion] = score;
  }
  return scores;
}

/**
 * Detect sarcasm in message — returns true if sarcastic
 */
function detectSarcasm(text) {
  return SARCASM_MARKERS.some(marker => text.includes(marker));
}

/**
 * Classify emotion for a single message
 * Returns: { emotion, intensity, confidence }
 */
function classifyEmotion(message) {
  const text = message.text || '';
  const scores = scoreMessage(text);
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  // If no keyword matched → Disbelief (unclear)
  if (totalScore === 0) {
    return {
      emotion: EMOTIONS.DISBELIEF,
      intensity: parseFloat((Math.random() * 0.25 + 0.4).toFixed(2)),
      confidence: parseFloat((Math.random() * 0.2 + 0.3).toFixed(2)),
    };
  }

  // Find dominant emotion
  let dominant = EMOTIONS.DISBELIEF;
  let maxScore = 0;
  for (const [emotion, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      dominant = emotion;
    }
  }

  // Sarcasm detection: if euphoria is dominant but sarcasm markers present → Frustration
  if (dominant === EMOTIONS.EUPHORIA && detectSarcasm(text)) {
    dominant = EMOTIONS.FRUSTRATION;
    maxScore = Math.max(maxScore * 0.6, 1);
  }

  const confidence = parseFloat(Math.min(maxScore / (totalScore + 1), 0.97).toFixed(2));

  // Intensity: normalized score with floor 0.4 and ceiling 0.95
  const rawIntensity = 0.4 + (maxScore / (maxScore + 3)) * 0.55;
  const intensity = parseFloat(Math.min(Math.max(rawIntensity, 0.4), 0.95).toFixed(2));

  return { emotion: dominant, intensity, confidence };
}

/**
 * Attach emotion classification to a processed message
 */
function enrichWithEmotion(message) {
  const result = classifyEmotion(message);
  return { ...message, ...result };
}

/**
 * Batch classify an array of messages
 */
function classifyBatch(messages) {
  return messages.map(enrichWithEmotion);
}

module.exports = {
  EMOTIONS,
  classifyEmotion,
  enrichWithEmotion,
  classifyBatch,
};
