/**
 * CROWD PULSE FRONTEND APP
 * Connects to WebSocket for real-time updates and maps data to the UI.
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const WS_URL = `ws://${window.location.host}`;
const API_URL = `http://${window.location.host}/api`;

let pollInterval;
const graphHistory = [];
const MAX_GRAPH_POINTS = 20;

// ─── UI ELEMENTS ─────────────────────────────────────────────────────────────
const els = {
  connStatusBtn: document.getElementById('connection-status-btn'),
  phaseBannerText: document.getElementById('phase-banner-text'),
  
  scoreboard: {
    rrScore: document.getElementById('rr-score'),
    rrOvers: document.getElementById('rr-overs'),
    lsgScore: document.getElementById('lsg-score'),
    lsgOvers: document.getElementById('lsg-overs'),
  },

  // Emotions
  bars: {
    Tension: document.getElementById('bar-tension'),
    Excitement: document.getElementById('bar-excitement'),
    Frustration: document.getElementById('bar-frustration'),
    Disbelief: document.getElementById('bar-disbelief'),
  },
  pcts: {
    Tension: document.getElementById('pct-tension'),
    Excitement: document.getElementById('pct-excitement'),
    Frustration: document.getElementById('pct-frustration'),
    Disbelief: document.getElementById('pct-disbelief'),
  },

  // Graph Timeline
  graph: {
    tension: document.getElementById('path-tension'),
    excitement: document.getElementById('path-excitement'),
    frustration: document.getElementById('path-frustration'),
    disbelief: document.getElementById('path-disbelief'),
    activeGroup: document.getElementById('active-over-group'),
    activeText: document.getElementById('active-over-text'),
  },

  // Prediction
  predCard: document.getElementById('prediction-card'),
  predIcon: document.getElementById('prediction-icon'),
  predTitle: document.getElementById('prediction-title'),
  predLabel: document.getElementById('prediction-label'),
  predConf: document.getElementById('prediction-confidence'),

  // Trending
  trendCard: document.getElementById('trending-card'),
  trendIcon: document.getElementById('trending-icon'),
  trendLabel: document.getElementById('trending-label'),
  trendConf: document.getElementById('trending-confidence'),
  trendReason: document.getElementById('trending-reason'),

  // Main Character
  playerName: document.getElementById('player-name'),
  playerShare: document.getElementById('player-share'),

  // Spike
  spikeCard: document.getElementById('spike-card'),
  spikeCircle: document.getElementById('spike-circle'),
  spikeMult: document.getElementById('spike-multiplier'),
  spikeStatus: document.getElementById('spike-status'),

  // You vs Crowd
  yvcStatus: document.getElementById('yvc-status'),
  yvcBar: document.getElementById('yvc-bar'),
  yvcCrowdEmo: document.getElementById('yvc-crowd-emotion'),
  yvcCrowdPct: document.getElementById('yvc-crowd-pct'),
  yvcResult: document.getElementById('yvc-result'),

  // Feed
  feed: document.getElementById('message-feed'),
  totalMessages: document.getElementById('total-messages'),
};

// ─── WEBSOCKET SETUP ─────────────────────────────────────────────────────────
async function fetchPayload() {
  try {
    const res = await fetch(API_URL + '/pulse');
    if (!res.ok) throw new Error('Network response was not ok');
    const payload = await res.json();
    
    if (els.connStatusBtn.textContent !== 'SYSTEM ONLINE') {
      els.connStatusBtn.textContent = 'SYSTEM ONLINE';
      els.connStatusBtn.classList.remove('bg-slate-700', 'text-slate-300', 'bg-red-900', 'text-red-200');
      els.connStatusBtn.classList.add('bg-primary-container', 'text-on-primary-container');
    }
    
    updateUI(payload);
  } catch (e) {
    console.error('Failed to fetch data', e);
    els.connStatusBtn.textContent = 'OFFLINE - RECONNECTING';
    els.connStatusBtn.classList.remove('bg-primary-container', 'text-on-primary-container');
    els.connStatusBtn.classList.add('bg-red-900', 'text-red-200');
  }
}

function connect() {
  els.connStatusBtn.textContent = 'Connecting...';
  els.connStatusBtn.classList.add('bg-slate-700', 'text-slate-300');
  els.connStatusBtn.classList.remove('bg-primary-container', 'text-on-primary-container', 'bg-red-900', 'text-red-200');

  fetchPayload();
  pollInterval = setInterval(fetchPayload, 2500);
}

// ─── GRAPH DRAWING LOGIC ─────────────────────────────────────────────────────
function updateGraph() {
  if (graphHistory.length === 0) return;
  const width = 400;
  const stepX = width / (MAX_GRAPH_POINTS - 1);
  
  const paths = { Tension: [], Excitement: [], Frustration: [], Disbelief: [] };
  
  // Smoothing config
  const minHeight = 20;
  const maxHeight = 180;
  const amplitude = maxHeight - minHeight;

  graphHistory.forEach((pt, i) => {
    const x = i * stepX;
    for (const key in paths) {
      // Interpolate percentage to inverted Y coordinate
      const y = maxHeight - (pt[key] / 100) * amplitude;
      
      // Use smooth bezier curves instead of sharp lines if possible, but L is fine for now
      paths[key].push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
  });

  els.graph.tension.setAttribute('d', paths.Tension.join(' '));
  els.graph.excitement.setAttribute('d', paths.Excitement.join(' '));
  els.graph.frustration.setAttribute('d', paths.Frustration.join(' '));
  els.graph.disbelief.setAttribute('d', paths.Disbelief.join(' '));

  // Move the active over line
  const activeX = (graphHistory.length - 1) * stepX;
  els.graph.activeGroup.setAttribute('transform', `translate(${activeX}, 0)`);
  els.graph.activeText.textContent = graphHistory.length;
}

// ─── UI UPDATERS ─────────────────────────────────────────────────────────────
function updateUI(data) {
  // 1. Meta / Phase
  if (data.phase) {
    els.phaseBannerText.textContent = data.phase.label;
  }
  
  if (data.over) {
    els.totalMessages.textContent = data.over.total;
  }

  // Live Scoreboard Update
  if (data.match_state) {
    els.scoreboard.rrScore.textContent = `${data.match_state.rrScore}/${data.match_state.rrWickets}`;
    els.scoreboard.rrOvers.textContent = `${data.match_state.rrOvers} OVERS`;
    
    els.scoreboard.lsgScore.textContent = `${data.match_state.lsgScore}/${data.match_state.lsgWickets}`;
    const overs = Math.floor(data.match_state.lsgBalls / 6);
    const balls = data.match_state.lsgBalls % 6;
    els.scoreboard.lsgOvers.textContent = `${overs}.${balls} OVERS`;
  }

  // 2. Aggregation (Emotions) & Graph
  if (data.aggregation && data.aggregation.ready) {
    const emos = data.aggregation.emotions;
    
    graphHistory.push({
      Tension: emos.Tension.percentage,
      Excitement: emos.Euphoria.percentage,
      Frustration: emos.Frustration.percentage,
      Disbelief: emos.Disbelief.percentage,
    });
    if (graphHistory.length > MAX_GRAPH_POINTS) graphHistory.shift();
    
    updateGraph();

    for (let [name, stats] of Object.entries(emos)) {
      if (name === 'Euphoria') name = 'Excitement'; // Translate
      if (els.bars[name] && els.pcts[name]) {
        els.bars[name].style.width = `${stats.percentage}%`;
        els.pcts[name].textContent = `${stats.percentage}%`;
      }
    }
  }

  // 3. Prediction
  if (data.prediction && data.prediction.active) {
    els.predCard.classList.add('border-primary', 'bg-primary/5');
    els.predCard.classList.remove('border-slate-700');
    els.predTitle.classList.add('text-primary');
    els.predTitle.classList.remove('text-slate-400');
    els.predIcon.classList.add('text-primary');
    els.predLabel.classList.add('text-white');
    els.predLabel.classList.remove('text-slate-400');
    
    const predEmotion = data.prediction.emotion === 'Euphoria' ? 'Excitement' : data.prediction.emotion;
    els.predLabel.textContent = `${predEmotion} expected`;
    els.predConf.textContent = `${Math.round(data.prediction.confidence * 100)}%`;
    els.predConf.classList.add('text-primary');
  } else {
    els.predCard.classList.remove('border-primary', 'bg-primary/5');
    els.predCard.classList.add('border-slate-700');
    els.predTitle.classList.remove('text-primary');
    els.predTitle.classList.add('text-slate-400');
    els.predIcon.classList.remove('text-primary');
    els.predLabel.classList.remove('text-white');
    els.predLabel.classList.add('text-slate-400');
    
    els.predLabel.textContent = 'Analyzing...';
    els.predConf.textContent = '0%';
    els.predConf.classList.remove('text-primary');
  }

  // 4. Trending
  if (data.trending && data.trending.active) {
    els.trendCard.classList.add('border-orange-500', 'bg-orange-500/5');
    els.trendCard.classList.remove('border-white/5');
    els.trendIcon.classList.add('text-orange-500');
    els.trendLabel.classList.add('text-white');
    els.trendLabel.textContent = data.trending.label || 'Trending Alert';
    els.trendConf.textContent = `${data.trending.confidencePct}% CONFIDENCE`;
    els.trendConf.classList.add('text-orange-400');
    els.trendReason.textContent = data.trending.reason;
    els.trendReason.classList.add('text-orange-200');
  } else {
    els.trendCard.classList.remove('border-orange-500', 'bg-orange-500/5');
    els.trendCard.classList.add('border-white/5');
    els.trendIcon.classList.remove('text-orange-500');
    els.trendLabel.classList.remove('text-white');
    els.trendLabel.textContent = 'Monitoring patterns';
    els.trendConf.textContent = '0% CONFIDENCE';
    els.trendConf.classList.remove('text-orange-400');
    els.trendReason.textContent = 'Waiting for velocity, intensity, and unique user signals.';
    els.trendReason.classList.remove('text-orange-200');
  }

  // 5. Main Character
  if (data.main_character) {
    els.playerName.textContent = data.main_character.player || 'Detecting...';
    els.playerShare.textContent = `${data.main_character.share || 0}% MENTIONS`;
  }

  // 6. Spike
  if (data.spike_detail) {
    els.spikeMult.textContent = data.spike_detail.multiplier.toFixed(1);
    
    let offset = 364;
    if (data.spike_detail.multiplier > 1) {
       offset = Math.max(100, 364 - ((data.spike_detail.multiplier - 1) * 200));
    }
    els.spikeCircle.style.strokeDashoffset = offset;

    if (data.spike_detail.detected) {
      els.spikeCard.classList.add('border-red-500', 'bg-red-500/10');
      els.spikeStatus.textContent = 'VIRAL SPIKE DETECTED!';
      els.spikeStatus.classList.add('text-red-500');
      els.spikeCircle.style.stroke = '#ef4444';
    } else if (data.spike_detail.cooldown) {
      els.spikeCard.classList.remove('border-red-500', 'bg-red-500/10');
      els.spikeStatus.textContent = 'COOLDOWN...';
      els.spikeStatus.classList.remove('text-red-500');
      els.spikeStatus.classList.add('text-yellow-500');
      els.spikeCircle.style.stroke = '#eab308';
    } else {
      els.spikeCard.classList.remove('border-red-500', 'bg-red-500/10');
      els.spikeStatus.textContent = 'NORMAL VOLUME';
      els.spikeStatus.classList.remove('text-red-500', 'text-yellow-500');
      els.spikeCircle.style.stroke = 'rgba(255,255,255,0.2)';
    }
  }

  // 7. You vs Crowd
  if (data.you_vs_crowd) {
    if (!data.you_vs_crowd.user_choice) {
      els.yvcStatus.textContent = 'Awaiting selection';
      els.yvcBar.style.width = '0%';
      els.yvcCrowdEmo.textContent = '-';
      els.yvcCrowdPct.textContent = '0%';
    } else if (data.you_vs_crowd.active) {
      els.yvcStatus.textContent = data.you_vs_crowd.aligned ? 'SYNCED' : 'AGAINST TIDE';
      els.yvcStatus.className = `text-[10px] font-bold ${data.you_vs_crowd.aligned ? 'text-green-400' : 'text-red-400'}`;
      els.yvcBar.style.width = `${data.you_vs_crowd.crowd_percentage}%`;
      els.yvcBar.className = `transition-all duration-500 h-full ${data.you_vs_crowd.aligned ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]'}`;
      
      let crowdEmoLabel = data.you_vs_crowd.crowd_state.toUpperCase();
      if (crowdEmoLabel === 'EUPHORIA') crowdEmoLabel = 'EXCITEMENT';
      
      els.yvcCrowdEmo.textContent = crowdEmoLabel;
      els.yvcCrowdPct.textContent = `${data.you_vs_crowd.crowd_percentage}% CROWD`;
    } else {
      els.yvcStatus.textContent = 'NO MAJORITY';
      els.yvcStatus.className = 'text-[10px] font-bold text-slate-400';
    }
  }

  // 8. Feed
  if (data.messages && data.messages.length > 0) {
    let feedHtml = '';
    [...data.messages].reverse().forEach(msg => {
      let emColor = 'text-slate-400';
      let emotionDisplay = msg.emotion;
      
      if (msg.emotion === 'Euphoria') {
        emColor = 'text-green-400';
        emotionDisplay = 'Excitement';
      }
      if (msg.emotion === 'Tension') emColor = 'text-red-400';
      if (msg.emotion === 'Frustration') emColor = 'text-yellow-500';
      if (msg.emotion === 'Disbelief') emColor = 'text-blue-400';

      feedHtml += `
        <div class="flex gap-3 animate-fade-in">
          <div class="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">
            👤
          </div>
          <div class="flex-1">
            <div class="text-[10px] font-bold ${emColor} mb-1 flex justify-between">
              <span>${msg.user_id}</span>
              <span class="opacity-70">${emotionDisplay} (${msg.intensity})</span>
            </div>
            <div class="text-xs text-white bg-surface-container-high p-2 rounded-r-lg rounded-bl-lg">
              ${msg.text}
            </div>
          </div>
        </div>
      `;
    });
    els.feed.innerHTML = feedHtml;
  }
}

// ─── ACTIONS ─────────────────────────────────────────────────────────────────

function setStance(stance) {
  // Update UI buttons
  document.querySelectorAll('.yvc-btn').forEach(btn => {
    btn.classList.remove('border-[#1a88ff]', 'neon-glow-secondary');
    btn.classList.add('hover:border-primary');
    btn.querySelector('span:last-child').classList.replace('text-[#1a88ff]', 'text-slate-400');
  });

  const selectedBtn = stance === 'Confident' ? document.getElementById('btn-confident') : document.getElementById('btn-nervous');
  selectedBtn.classList.remove('hover:border-primary');
  selectedBtn.classList.add('border-[#1a88ff]', 'neon-glow-secondary');
  selectedBtn.querySelector('span:last-child').classList.replace('text-slate-400', 'text-[#1a88ff]');

  // Send to server
  fetch(`${API_URL}/stance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stance })
  }).catch(console.error);
}

function injectScenario(scenario) {
  fetch(`${API_URL}/demo/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario, count: 12 })
  }).catch(console.error);
}

function resetSystem() {
  fetch(`${API_URL}/demo/reset`, { method: 'POST' }).catch(console.error);
  graphHistory.length = 0; // Clear frontend graph on reset
}

// Start
connect();
