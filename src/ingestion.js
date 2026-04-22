/**
 * BLOCK 2 — DATA INGESTION LAYER
 * Crowd Pulse | Message Ingestion & Normalization
 */

const { v4: uuidv4 } = require('uuid');

// Rolling buffer of last 50 processed messages
const messageBuffer = [];
const MAX_BUFFER = 50;

// Deduplication store: message hash → timestamp
const recentHashes = new Map();
const DEDUP_WINDOW_MS = 30 * 1000; // 30 seconds

/**
 * Simple hash for deduplication (djb2-like)
 */
function hashMessage(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Count emoji characters in a string
 */
function countEmojis(text) {
  const emojiRegex = /\p{Emoji}/gu;
  return (text.match(emojiRegex) || []).length;
}

/**
 * Check if message is spam (same word repeated > 5 times)
 */
function isSpam(text) {
  const words = text.toLowerCase().trim().split(/\s+/);
  const freq = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
    if (freq[w] > 5) return true;
  }
  return false;
}

/**
 * Normalize the message text
 */
function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .substring(0, 200)
    .replace(/\s+/g, ' ');
}

/**
 * Purge expired dedup entries
 */
function purgeDedup() {
  const now = Date.now();
  for (const [hash, ts] of recentHashes.entries()) {
    if (now - ts > DEDUP_WINDOW_MS) {
      recentHashes.delete(hash);
    }
  }
}

/**
 * Process a single raw fan message
 * Returns processed message object or null if filtered
 */
function processMessage(rawText, userId = null) {
  purgeDedup();

  if (!rawText || typeof rawText !== 'string') return null;

  const cleaned = normalize(rawText);
  const words = cleaned.trim().split(/\s+/).filter(Boolean);
  const emojiCount = countEmojis(rawText);

  // Filter: less than 3 words AND not emoji-heavy (< 2 emojis)
  if (words.length < 3 && emojiCount < 2) return null;

  // Filter: spam
  if (isSpam(cleaned)) return null;

  // Deduplication
  const hash = hashMessage(cleaned);
  if (recentHashes.has(hash)) return null;
  recentHashes.set(hash, Date.now());

  const message = {
    id: uuidv4(),
    text: cleaned,
    rawText: rawText.trim(),
    timestamp: Date.now(),
    user_id: userId || `fan_${Math.floor(Math.random() * 9000) + 1000}`,
    wordCount: words.length,
    emojiCount,
    cleaned: true,
  };

  // Add to rolling buffer
  messageBuffer.push(message);
  if (messageBuffer.length > MAX_BUFFER) {
    messageBuffer.shift();
  }

  return message;
}

/**
 * Get current buffer snapshot
 */
function getBuffer() {
  return [...messageBuffer];
}

/**
 * Get last N messages from buffer
 */
function getLastN(n) {
  return messageBuffer.slice(-n);
}

/**
 * Clear buffer (used in demo resets)
 */
function clearBuffer() {
  messageBuffer.length = 0;
  recentHashes.clear();
}

/**
 * Inject a batch of messages (demo control)
 * Returns count of successfully processed messages
 */
function injectBatch(messages) {
  let count = 0;
  for (const msg of messages) {
    const userId = msg.user_id || null;
    const result = processMessage(msg.text, userId);
    if (result) count++;
  }
  return count;
}

module.exports = {
  processMessage,
  getBuffer,
  getLastN,
  clearBuffer,
  injectBatch,
};
