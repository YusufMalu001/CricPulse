/**
 * BLOCK 4 — OVER MAPPING
 * Crowd Pulse | Cricket Over Tracker
 * Rule: 10 messages = 1 over
 */

const MESSAGES_PER_OVER = 10;
const MAX_OVERS = 20; // T20 format

let currentOver = 1;
let messagesInCurrentOver = 0;
let totalProcessed = 0;
let overHistory = []; // { over, startIndex, endIndex }

/**
 * Register a new message and potentially advance the over counter
 * Returns current over number (stable during burst)
 */
function registerMessage() {
  totalProcessed++;
  messagesInCurrentOver++;

  // Advance over ONLY when threshold is exactly reached
  if (messagesInCurrentOver >= MESSAGES_PER_OVER) {
    if (currentOver < MAX_OVERS) {
      overHistory.push({
        over: currentOver,
        messageCount: messagesInCurrentOver,
        completedAt: Date.now(),
      });
      currentOver++;
    }
    messagesInCurrentOver = 0;
  }

  return currentOver;
}

/**
 * Get the current state
 */
function getOverState() {
  return {
    currentOver,
    messagesInCurrentOver,
    messagesUntilNextOver: MESSAGES_PER_OVER - messagesInCurrentOver,
    totalProcessed,
    overProgress: parseFloat((messagesInCurrentOver / MESSAGES_PER_OVER).toFixed(2)),
    overHistory: overHistory.slice(-5), // last 5 completed overs
  };
}

/**
 * Get only the current over number (lightweight)
 */
function getCurrentOver() {
  return currentOver;
}

/**
 * Reset the over tracker (used for demo replay)
 */
function resetOverTracker() {
  currentOver = 1;
  messagesInCurrentOver = 0;
  totalProcessed = 0;
  overHistory = [];
}

/**
 * Manually set the over (demo injection)
 */
function setOver(over) {
  if (over >= 1 && over <= MAX_OVERS) {
    currentOver = over;
    messagesInCurrentOver = 0;
  }
}

module.exports = {
  registerMessage,
  getOverState,
  getCurrentOver,
  resetOverTracker,
  setOver,
  MESSAGES_PER_OVER,
};
