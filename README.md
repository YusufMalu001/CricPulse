# 🏏 Crowd Pulse — Backend API Reference
**Real-Time Fan Emotion Intelligence Engine for IPL 2026**

---

## Quick Start

```bash
npm install
node server.js
```

Server runs on: **`http://localhost:3000`**  
WebSocket on: **`ws://localhost:3000`**  
Updates every: **2.5 seconds**

---

## Architecture

```
src/
├── ingestion.js       Block 2 — Dedup, filter, normalize messages
├── emotionEngine.js   Block 3 — Classify: Euphoria/Tension/Frustration/Disbelief
├── overMapper.js      Block 4 — 10 msgs = 1 over, stable counter
├── aggregation.js     Block 5 — EMA-smoothed emotion counts & intensities
├── intelligence.js    Block 6 — Prediction, spike, trending, you-vs-crowd
└── demoController.js  Block 9 — Scenario phases & injection
server.js              Blocks 1,7,8 — HTTP + WebSocket + safety limits
```

---

## WebSocket (Recommended for Frontend)

Connect to `ws://localhost:3000` — you'll receive a full payload every 2.5s automatically.

### Payload Shape

```json
{
  "meta": {
    "timestamp": 1776870368175,
    "updateIntervalMs": 2500,
    "version": "1.0.0"
  },
  "phase": {
    "name": "rising_tension",
    "label": "😰 Rising Tension — Pressure building",
    "index": 1,
    "cyclesRemaining": 3
  },
  "over": {
    "current": 4,
    "progress": 0.6,
    "messagesInOver": 6,
    "messagesUntilNext": 4,
    "total": 36
  },
  "aggregation": {
    "ready": true,
    "emotions": {
      "Euphoria":     { "count": 2, "avgIntensity": 0.71, "percentage": 13.3 },
      "Tension":      { "count": 8, "avgIntensity": 0.84, "percentage": 53.3 },
      "Frustration":  { "count": 3, "avgIntensity": 0.69, "percentage": 20.0 },
      "Disbelief":    { "count": 2, "avgIntensity": 0.55, "percentage": 13.3 }
    },
    "dominantEmotion": "Tension",
    "dominantPercentage": 53.3,
    "totalMessages": 15
  },
  "prediction": {
    "active": true,
    "label": "High Tension, Confidence: 0.82",
    "emotion": "Tension",
    "confidence": 0.82,
    "percentage": 70.0,
    "locked": false
  },
  "mainCharacter": {
    "active": true,
    "player": "Kohli",
    "share": 46.7,
    "mentions": 7
  },
  "spike": {
    "detected": true,
    "multiplier": 2.1,
    "cooldown": false
  },
  "trending": {
    "active": true,
    "confidence": 1.0,
    "confidencePct": 100,
    "reason": "message velocity rising · high emotion intensity (0.79) · unique fans increasing",
    "label": "Likely to trend in 30 seconds",
    "dominantEmotion": "Tension"
  },
  "youVsCrowd": {
    "active": true,
    "label": "You: Confident | Crowd: 78% Tension",
    "userStance": "Confident",
    "crowdEmotion": "Tension",
    "crowdPercentage": 78.0,
    "aligned": false,
    "message": "You're against the crowd tide!",
    "locked": true
  },
  "alerts": [
    { "type": "spike",    "message": "💥 Viral Spike Detected!" },
    { "type": "trending", "message": "📈 Likely to trend in 30 seconds" }
  ],
  "lastMessages": [
    {
      "text": "nooo not another wicket we are in serious trouble",
      "emotion": "Tension",
      "intensity": 0.87,
      "confidence": 0.76,
      "timestamp": 1776870365000,
      "user_id": "fan_3421"
    }
  ]
}
```

---

## REST API Endpoints

### GET `/api/pulse`
Latest snapshot of the full payload (same shape as WebSocket above).

### GET `/api/health`
```json
{ "status": "ok", "uptime": 51.3, "messagesProcessed": 56, "wsClients": 1, "currentOver": 4 }
```

### GET `/api/demo/scenarios`
Lists all injectable scenarios and phase names.

### POST `/api/stance`
Set the user's stance for You vs Crowd.
```json
{ "stance": "Confident" }   // or "Nervous"
```
Response:
```json
{ "success": true, "stance": "Confident", "lockedUntil": 1776870370000 }
```

### POST `/api/demo/inject`
Instantly inject a named scenario into the pipeline.
```json
{ "scenario": "tension", "count": 10 }
```
Available scenarios: `calm`, `tension`, `euphoria`, `frustration`, `disbelief`, `kohli_heavy`, `spike`

### POST `/api/demo/phase`
Skip demo loop to a named phase.
```json
{ "phase": "prediction_trigger" }
```
Available phases: `calm`, `rising_tension`, `prediction_trigger`, `spike`, `euphoria`, `trending`

### POST `/api/demo/replay`
Rewind to the previous demo phase.

### POST `/api/demo/reset`
Full system reset — clears all state, buffers, and counters.

---

## Emotion Color Map (Block 8)

| Emotion     | Color   | Hex       |
|-------------|---------|-----------|
| Tension     | Red     | `#EF4444` |
| Euphoria    | Green   | `#22C55E` |
| Frustration | Yellow  | `#EAB308` |
| Disbelief   | Blue    | `#3B82F6` |

---

## Demo Phases (Auto-Cycling)

| Phase              | Label                          | Msgs/Cycle | Duration |
|--------------------|--------------------------------|-----------|---------|
| calm               | 😌 Calm Phase — Steady start   | 3         | 6 cycles |
| rising_tension     | 😰 Rising Tension              | 5         | 5 cycles |
| prediction_trigger | 🔮 Prediction Zone             | 6         | 4 cycles |
| spike              | 💥 Viral Spike                 | 18        | 2 cycles |
| euphoria           | 🎉 Euphoria Wave               | 7         | 4 cycles |
| trending           | 📈 Trending Alert              | 8         | 4 cycles |
| calm               | 😌 Cool Down                   | 3         | 4 cycles |

> Guaranteed during a full demo loop: **≥1 prediction**, **≥1 spike**, **≥1 trending alert**
