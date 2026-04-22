/**
 * BLOCK 9 — DEMO CONTROLLER
 * Crowd Pulse | Simulated Match Scenarios & Message Simulator
 */

const { v4: uuidv4 } = require('uuid');

// ─── SCENARIO MESSAGE POOLS ───────────────────────────────────────────────────
const SCENARIOS = {
  calm: [
    { text: 'good match so far, enjoying it with family', weight: 2 },
    { text: 'nice to see both teams playing well today', weight: 2 },
    { text: 'great atmosphere at the stadium today yaar', weight: 2 },
    { text: 'this is going to be an interesting match for sure', weight: 2 },
    { text: 'both teams look in form and ready to play', weight: 1 },
    { text: 'weather is good today good cricket coming up', weight: 1 },
    { text: 'lets see how the pitch plays today evening', weight: 1 },
    { text: 'i think this match will be close and exciting', weight: 1 },
    { text: 'the crowd energy is amazing at the stadium here', weight: 1 },
    { text: 'happy to be watching this match with friends today', weight: 1 },
  ],
  tension: [
    { text: 'omg so tense right now cannot breathe at all', weight: 3 },
    { text: 'pressure building up this is nail biting stuff yaar', weight: 3 },
    { text: 'wicket fell again this is getting very dangerous now', weight: 3 },
    { text: 'nooo not another wicket we are in serious trouble', weight: 3 },
    { text: 'too much pressure on the last few batters remaining', weight: 2 },
    { text: 'holding my breath every single ball is like a thriller', weight: 2 },
    { text: 'edge of seat cricket this is incredibly tense match', weight: 2 },
    { text: 'critical stage of the match need runs badly now', weight: 2 },
    { text: 'this is so stressful last over is always intense', weight: 2 },
    { text: 'nervous as anything please dont lose another wicket', weight: 2 },
    { text: 'final over pressure is immense team needs to hold on', weight: 2 },
    { text: 'ohh that was close to the wicket very tense situation', weight: 1 },
  ],
  euphoria: [
    { text: 'that six was absolutely massive incredible shot wow', weight: 3 },
    { text: 'century!! what an amazing hundred truly a legend moment', weight: 3 },
    { text: 'brilliant boundary four runs love this team so much', weight: 3 },
    { text: 'yesss what a magnificent shot that was phenomenal today', weight: 3 },
    { text: 'great shot fantastic batting lets go team we believe', weight: 2 },
    { text: 'woohoo hat-trick alert incredible this is amazing cricket', weight: 2 },
    { text: 'what a delivery clean bowled that was absolutely perfect', weight: 2 },
    { text: 'kohli smashing them around the ground what a performance', weight: 2 },
    { text: 'rohit hitman sharma doing it again magnificent six there', weight: 2 },
    { text: 'this is the best innings i have ever watched so incredible', weight: 2 },
    { text: 'fire fire fire team is on absolute fire tonight 🔥🔥🔥', weight: 2 },
    { text: 'virat king kohli century again he is just the best ever', weight: 2 },
  ],
  frustration: [
    { text: 'terrible shot that was completely unnecessary and wasteful', weight: 3 },
    { text: 'what a pathetic display of batting today absolutely awful', weight: 3 },
    { text: 'ugh dropped another catch this fielding is just embarrassing', weight: 3 },
    { text: 'why always the same mistakes seriously this is frustrating', weight: 3 },
    { text: 'not again this happens every single match so disappointing', weight: 2 },
    { text: 'that was a terrible decision by the captain very poor today', weight: 2 },
    { text: 'rubbish batting giving away wickets for absolutely nothing', weight: 2 },
    { text: 'so angry right now what is the team even doing out there', weight: 2 },
    { text: 'completely useless performance today very upset and sad', weight: 2 },
    { text: 'why are they playing so slow terrible batting approach today', weight: 2 },
  ],
  disbelief: [
    { text: 'wait what just happened i cannot believe that at all', weight: 3 },
    { text: 'unbelievable absolutely incredible i am completely speechless', weight: 3 },
    { text: 'omg i cannot believe what i just saw that was insane crazy', weight: 3 },
    { text: 'jaw dropped how is this even possible mind completely blown', weight: 3 },
    { text: 'no way that happened seriously this is unreal and shocking', weight: 2 },
    { text: 'is this real life or am i dreaming what just happened here', weight: 2 },
    { text: 'shocked to the core never seen anything like this cricket', weight: 2 },
    { text: 'surreal moment in cricket history what an unbelievable event', weight: 2 },
  ],
  player_heavy: [
    { text: 'samson is absolutely on fire today captain leading from the front', weight: 3 },
    { text: 'sanju playing brilliantly today what a knock', weight: 3 },
    { text: 'jaiswal smashing it everywhere what a talent', weight: 3 },
    { text: 'kl rahul is holding the innings together well', weight: 2 },
    { text: 'pooran with a massive six! incredible power', weight: 3 },
    { text: 'stoinis doing it again what a match winner', weight: 2 },
    { text: 'boult striking early in the powerplay beautiful swing', weight: 2 },
    { text: 'samson century coming up he is unstoppable', weight: 2 },
  ],
  spike: [
    { text: 'wicket huge wicket this changes everything completely wow', weight: 3 },
    { text: 'massive wicket team is in serious trouble now very bad', weight: 3 },
    { text: 'out gone big wicket falls crowd goes completely silent here', weight: 3 },
    { text: 'six six six that massive six changed the whole game totally', weight: 3 },
    { text: 'hat trick hat trick this is incredible history being made', weight: 3 },
    { text: 'wow what a moment cricket history being created right now', weight: 3 },
    { text: 'unbelievable this match has completely turned around now', weight: 2 },
    { text: 'everyone is going absolutely crazy the whole crowd insane', weight: 2 },
    { text: 'crowd erupting everyone standing on their feet right now', weight: 2 },
    { text: 'never seen anything like this incredible cricket moment today', weight: 2 },
    { text: 'this is madness pure cricket madness happening right here', weight: 2 },
    { text: 'jaw dropping moment for all fans watching this incredible', weight: 2 },
    { text: 'history is being made right now this is incredible cricket', weight: 2 },
    { text: 'stadium has gone completely wild everyone is on their feet', weight: 2 },
    { text: 'you wont believe what just happened incredible cricket twist', weight: 2 },
  ],
};

// ─── DEMO PHASES ──────────────────────────────────────────────────────────────
// Each phase defines which scenarios to blend and how many messages per cycle
const DEMO_PHASES = [
  {
    name: 'calm',
    label: '😌 Calm Phase — Steady start',
    duration: 6,   // cycles
    scenarios: [{ name: 'calm', weight: 0.8 }, { name: 'tension', weight: 0.2 }],
    messagesPerCycle: 3,
  },
  {
    name: 'rising_tension',
    label: '😰 Rising Tension — Pressure building',
    duration: 5,
    scenarios: [{ name: 'tension', weight: 0.7 }, { name: 'frustration', weight: 0.3 }],
    messagesPerCycle: 5,
  },
  {
    name: 'prediction_trigger',
    label: '🔮 Prediction Zone — High Tension signal',
    duration: 4,
    scenarios: [{ name: 'tension', weight: 0.9 }, { name: 'disbelief', weight: 0.1 }],
    messagesPerCycle: 6,
  },
  {
    name: 'spike',
    label: '💥 Viral Spike — Burst of messages',
    duration: 2,
    scenarios: [{ name: 'spike', weight: 1.0 }],
    messagesPerCycle: 18, // intentional spike burst
  },
  {
    name: 'euphoria',
    label: '🎉 Euphoria Wave — Crowd goes wild',
    duration: 4,
    scenarios: [{ name: 'euphoria', weight: 0.75 }, { name: 'player_heavy', weight: 0.25 }],
    messagesPerCycle: 7,
  },
  {
    name: 'trending',
    label: '📈 Trending Alert — Intensity peak',
    duration: 4,
    scenarios: [
      { name: 'euphoria', weight: 0.5 },
      { name: 'disbelief', weight: 0.3 },
      { name: 'player_heavy', weight: 0.2 },
    ],
    messagesPerCycle: 8,
  },
  {
    name: 'calm',
    label: '😌 Cool Down — Match stabilizing',
    duration: 4,
    scenarios: [{ name: 'calm', weight: 0.6 }, { name: 'frustration', weight: 0.4 }],
    messagesPerCycle: 3,
  },
];

let phaseIndex = 0;
let phaseCycleCount = 0;
let messageCounter = 0;
let looping = true;

let matchState = {
  rrScore: 128,
  rrWickets: 4,
  rrOvers: '20.0',
  lsgScore: 87,
  lsgWickets: 3,
  lsgBalls: 73, // 12.1 overs
  target: 129,
};

/**
 * Weighted random selection from an array with weight property
 */
function weightedRandom(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let r = Math.random() * totalWeight;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

/**
 * Select a random message from a scenario pool
 */
function pickFromScenario(scenarioName) {
  const pool = SCENARIOS[scenarioName];
  if (!pool || pool.length === 0) return null;
  const item = weightedRandom(pool);
  return item.text;
}

/**
 * Generate a batch of messages for the current demo phase
 * Returns: array of { text, user_id }
 */
function getNextBatch() {
  const phase = DEMO_PHASES[phaseIndex];

  // Generate messages for this cycle
  const messages = [];
  const count = phase.messagesPerCycle;

  for (let i = 0; i < count; i++) {
    // Pick a scenario from this phase's blend
    const scenarioConfig = weightedRandom(
      phase.scenarios.map(s => ({ ...s, weight: s.weight }))
    );
    const text = pickFromScenario(scenarioConfig.name);
    if (text) {
      messages.push({
        text,
        user_id: `fan_${uuidv4().slice(0, 6)}`,
      });
    }
  }

  // Advance phase cycle
  phaseCycleCount++;
  if (phaseCycleCount >= phase.duration) {
    phaseCycleCount = 0;
    phaseIndex = (phaseIndex + 1) % DEMO_PHASES.length;
  }

  messageCounter += messages.length;

  // Simulate live match score progress
  if (Math.random() > 0.3 && matchState.lsgBalls < 120 && matchState.lsgScore < matchState.target) {
    matchState.lsgBalls++;
    let runs = Math.floor(Math.random() * 5);
    if (runs === 4 && Math.random() > 0.5) runs = 6;
    if (runs === 3) runs = 1;
    matchState.lsgScore += runs;
    if (Math.random() > 0.94 && matchState.lsgWickets < 10) {
      matchState.lsgWickets++;
    }
  }

  return {
    messages,
    matchState: { ...matchState },
    phase: {
      name: phase.name,
      label: phase.label,
      index: phaseIndex,
      cyclesRemaining: phase.duration - phaseCycleCount,
    },
  };
}

/**
 * Get current demo phase info
 */
function getCurrentPhase() {
  return DEMO_PHASES[phaseIndex];
}

/**
 * Inject a specific scenario immediately (demo control panel)
 */
function injectScenario(scenarioName, count = 10) {
  const pool = SCENARIOS[scenarioName];
  if (!pool) return [];
  const messages = [];
  for (let i = 0; i < count; i++) {
    const text = pickFromScenario(scenarioName);
    if (text) {
      messages.push({ text, user_id: `demo_${uuidv4().slice(0, 6)}` });
    }
  }
  return messages;
}

/**
 * Replay previous over (fallback)
 */
function replayPreviousOver() {
  // Roll back to previous phase
  phaseIndex = Math.max(0, phaseIndex - 1);
  phaseCycleCount = 0;
}

/**
 * Reset demo to beginning
 */
function resetDemo() {
  phaseIndex = 0;
  phaseCycleCount = 0;
  messageCounter = 0;
  matchState = {
    rrScore: 128,
    rrWickets: 4,
    rrOvers: '20.0',
    lsgScore: 87,
    lsgWickets: 3,
    lsgBalls: 73,
    target: 129,
  };
}

/**
 * Skip to a specific phase (for demo control)
 */
function skipToPhase(phaseName) {
  const idx = DEMO_PHASES.findIndex(p => p.name === phaseName);
  if (idx !== -1) {
    phaseIndex = idx;
    phaseCycleCount = 0;
  }
}

module.exports = {
  getNextBatch,
  getCurrentPhase,
  injectScenario,
  replayPreviousOver,
  resetDemo,
  skipToPhase,
  DEMO_PHASES,
  SCENARIOS,
};
