/**
 * CROWD PULSE — MAIN SERVER
 * Blocks 1, 7, 8 — System Core, API Response, Safety & WebSocket
 * Real-time fan emotion analysis for IPL 2026
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

// ─── ENGINE IMPORTS ───────────────────────────────────────────────────────────
const ingestion = require('./src/ingestion');
const { enrichWithEmotion, classifyBatch } = require('./src/emotionEngine');
const overMapper = require('./src/overMapper');
const { aggregate, resetAggregation } = require('./src/aggregation');
const intelligence = require('./src/intelligence');
const demoController = require('./src/demoController');
const liveScoreFetcher = require('./src/liveScoreFetcher');

// ─── SERVER SETUP ──────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const UPDATE_INTERVAL_MS = 2500; // 2.5 seconds

// ─── SYSTEM STATE ─────────────────────────────────────────────────────────────
let enrichedMessageStore = []; // All processed + emotion-enriched messages
let activeAlertCount = 0;      // UI Safety: max 2 alerts at once
let lastPayload = null;        // Cache for GET endpoint

// ─── INGESTION PIPELINE ───────────────────────────────────────────────────────
/**
 * Run the full ingestion → emotion → over pipeline for a batch of raw messages
 */
function runIngestionPipeline(rawMessages) {
  const newEnriched = [];

  for (const rawMsg of rawMessages) {
    // Block 2: Process and filter
    const processed = ingestion.processMessage(rawMsg.text, rawMsg.user_id);
    if (!processed) continue;

    // Block 3: Classify emotion
    const enriched = enrichWithEmotion(processed);

    // Block 4: Register in over mapper
    overMapper.registerMessage();

    // Add to store (rolling, keep last 200)
    enrichedMessageStore.push(enriched);
    if (enrichedMessageStore.length > 200) enrichedMessageStore.shift();

    newEnriched.push(enriched);
  }

  return newEnriched;
}

// ─── BLOCK 7: API RESPONSE BUILDER ────────────────────────────────────────────
/**
 * Build the full API response payload
 */
function buildPayload(phase, matchState) {
  const allMessages = ingestion.getBuffer();
  const enriched = enrichedMessageStore;

  // Block 5: Aggregation
  const aggregation = aggregate(enriched);

  // Block 4: Over state
  const overState = overMapper.getOverState();

  // Block 6: Intelligence features
  const prediction = intelligence.predictNextBall(enriched);
  const mainCharacter = intelligence.detectMainCharacter(enriched);
  const spikeResult = intelligence.detectSpike(enriched.length);
  const trending = intelligence.detectTrending(enriched, aggregation, overState.currentOver);
  const youVsCrowd = intelligence.compareYouVsCrowd(aggregation);

  // Block 8: UI Safety — cap active alerts at 2
  activeAlertCount = 0;
  const alerts = [];
  if (spikeResult.spike) { alerts.push({ type: 'spike', message: '💥 Viral Spike Detected!' }); }
  if (trending.trending) { alerts.push({ type: 'trending', message: `📈 ${trending.label}` }); }
  if (alerts.length > 2) alerts.splice(2); // max 2 alerts

  // Last 5 processed messages
  const last5 = enriched.slice(-5).map(m => ({
    text: m.text,
    emotion: m.emotion,
    intensity: m.intensity,
    confidence: m.confidence,
    timestamp: m.timestamp,
    user_id: m.user_id,
  }));

  // Build emotion_summary flat counts (prompt-specified shape)
  const emotionSummary = {};
  if (aggregation.ready) {
    for (const [emo, data] of Object.entries(aggregation.emotions)) {
      emotionSummary[emo] = data.count;
    }
  } else {
    emotionSummary.Tension = 0;
    emotionSummary.Euphoria = 0;
    emotionSummary.Frustration = 0;
    emotionSummary.Disbelief = 0;
  }

  const payload = {
    meta: {
      timestamp: Date.now(),
      updateIntervalMs: UPDATE_INTERVAL_MS,
      version: '1.0.0',
    },
    phase: phase || null,
    over: {
      current: overState.currentOver,
      progress: overState.overProgress,
      messagesInOver: overState.messagesInCurrentOver,
      messagesUntilNext: overState.messagesUntilNextOver,
      total: overState.totalProcessed,
    },
    // Flat counts — matches prompt's exact output spec
    emotion_summary: emotionSummary,
    // Rich aggregation — for frontend UI (percentages, intensity)
    aggregation: aggregation.ready
      ? {
          ready: true,
          emotions: aggregation.emotions,
          dominantEmotion: aggregation.dominantEmotion,
          dominantPercentage: aggregation.dominantPercentage,
          totalMessages: aggregation.totalMessages,
        }
      : { ready: false, reason: aggregation.reason },
    prediction: {
      active: prediction.active,
      label: prediction.label || null,
      emotion: prediction.emotion || null,
      confidence: prediction.confidence || null,
      percentage: prediction.percentage || null,
      locked: prediction.locked || false,
    },
    main_character: {
      active: mainCharacter.active,
      player: mainCharacter.player || null,
      mention_share: mainCharacter.share
        ? parseFloat((mainCharacter.share / 100).toFixed(2))
        : 0,
      share: mainCharacter.share || 0,
      mentions: mainCharacter.mentions || 0,
    },
    spike: spikeResult.spike || false,
    spike_detail: {
      detected: spikeResult.spike || false,
      multiplier: spikeResult.multiplier || 0,
      cooldown: spikeResult.cooldown || false,
    },
    trending: {
      active: trending.trending || false,
      confidence: trending.confidence || 0,
      confidencePct: trending.confidencePct || 0,
      reason: trending.reason || null,
      label: trending.label || null,
      dominantEmotion: trending.dominantEmotion || null,
    },
    you_vs_crowd: {
      active: youVsCrowd.active || false,
      user_choice: youVsCrowd.userStance || null,
      crowd_state: youVsCrowd.crowdEmotion || null,
      crowd_percentage: youVsCrowd.crowdPercentage || 0,
      aligned: youVsCrowd.aligned || false,
      label: youVsCrowd.label || null,
      message: youVsCrowd.message || null,
      locked: youVsCrowd.locked || false,
    },
    alerts,
    messages: last5,
    match_state: matchState,
  };

  lastPayload = payload;
  return payload;
}

// ─── MAIN LOOP ─────────────────────────────────────────────────────────────────
let loopInterval = null;

function startLoop() {
  // Start polling RapidAPI every 15 seconds
  liveScoreFetcher.fetchLiveScore();
  setInterval(() => {
    liveScoreFetcher.fetchLiveScore();
  }, 15000);

  loopInterval = setInterval(() => {
    // Get next batch from demo controller (Block 9)
    const { messages: rawMessages, phase, matchState: demoMatchState } = demoController.getNextBatch();
    
    // Prefer RapidAPI state if available, else fallback to demo mock state
    const apiState = liveScoreFetcher.getLiveState();
    const currentMatchState = (apiState && apiState.rrScore !== 128) ? apiState : demoMatchState;

    // Update intelligence engine with active players dynamically
    if (apiState && apiState.activePlayers && apiState.activePlayers.length > 0) {
      intelligence.setActiveLivePlayers(apiState.activePlayers);
    }

    // Run pipeline
    runIngestionPipeline(rawMessages);

    // Build response
    const payload = buildPayload(phase, currentMatchState);

    // Broadcast to all WebSocket clients
    const json = JSON.stringify(payload);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(json);
      }
    });
  }, UPDATE_INTERVAL_MS);
}

// ─── REST API ROUTES ──────────────────────────────────────────────────────────

// GET: Latest pulse snapshot
app.get('/api/pulse', (req, res) => {
  if (!lastPayload) {
    return res.json({ ready: false, message: 'System initializing...' });
  }
  res.json(lastPayload);
});

// GET: System health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    messagesProcessed: enrichedMessageStore.length,
    wsClients: wss.clients.size,
    currentOver: overMapper.getCurrentOver(),
    timestamp: Date.now(),
  });
});

// POST: You vs Crowd — set user stance
app.post('/api/stance', (req, res) => {
  const { stance } = req.body;
  if (!stance) return res.status(400).json({ error: 'stance is required (Confident/Nervous)' });
  const result = intelligence.setUserStance(stance);
  res.json(result);
});

// POST: Demo control — inject scenario
app.post('/api/demo/inject', (req, res) => {
  const { scenario, count = 10 } = req.body;
  const messages = demoController.injectScenario(scenario, count);
  if (!messages.length) {
    return res.status(400).json({ error: `Unknown scenario: ${scenario}` });
  }
  const processed = runIngestionPipeline(messages);
  res.json({
    success: true,
    scenario,
    injected: messages.length,
    processed: processed.length,
  });
});

// POST: Demo control — skip to phase
app.post('/api/demo/phase', (req, res) => {
  const { phase } = req.body;
  if (!phase) return res.status(400).json({ error: 'phase name required' });
  demoController.skipToPhase(phase);
  res.json({ success: true, phase });
});

// POST: Demo control — replay previous over
app.post('/api/demo/replay', (req, res) => {
  demoController.replayPreviousOver();
  res.json({ success: true, message: 'Replaying previous over' });
});

// POST: Demo control — full reset
app.post('/api/demo/reset', (req, res) => {
  demoController.resetDemo();
  ingestion.clearBuffer();
  overMapper.resetOverTracker();
  intelligence.resetIntelligence();
  resetAggregation();
  enrichedMessageStore = [];
  lastPayload = null;
  res.json({ success: true, message: 'System reset complete' });
});

// GET: Available scenarios list
app.get('/api/demo/scenarios', (req, res) => {
  res.json({
    scenarios: Object.keys(demoController.SCENARIOS),
    phases: demoController.DEMO_PHASES.map(p => ({
      name: p.name,
      label: p.label,
      duration: p.duration,
      messagesPerCycle: p.messagesPerCycle,
    })),
  });
});

// ─── WEBSOCKET HANDLING ────────────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  console.log(`[WS] Client connected. Total: ${wss.clients.size}`);

  // Send latest payload immediately on connect
  if (lastPayload) {
    ws.send(JSON.stringify(lastPayload));
  }

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      // Handle client-side stance updates via WebSocket
      if (msg.type === 'stance') {
        intelligence.setUserStance(msg.stance);
      }
    } catch (e) { /* ignore malformed messages */ }
  });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected. Total: ${wss.clients.size}`);
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err.message);
  });
});

// ─── START ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║       🏏  CROWD PULSE — IPL 2026         ║');
  console.log('  ║   Real-Time Fan Emotion Intelligence     ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║  HTTP  → http://localhost:${PORT}          ║`);
  console.log(`  ║  WS    → ws://localhost:${PORT}            ║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  startLoop();
});

module.exports = { app, server };
