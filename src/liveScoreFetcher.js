const RAPID_API_KEY = '35aafd6fc1msh2d057fa22b5a49dp1fa672jsn9bb33ec9a2c2';
const RAPID_API_HOST = process.env.RAPID_API_HOST || 'cricbuzz-cricket.p.rapidapi.com'; 
const API_URL = `https://${RAPID_API_HOST}/matches/v1/live`;

let cachedMatchState = {
  rrScore: 128,
  rrWickets: 4,
  rrOvers: '20.0',
  lsgScore: 87,
  lsgWickets: 3,
  lsgBalls: 73,
  target: 129,
  activePlayers: ['samson', 'jaiswal', 'boult', 'rahul', 'stoinis', 'bishnoi'] // default active
};

async function fetchLiveScore() {
  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': RAPID_API_KEY,
        'x-rapidapi-host': RAPID_API_HOST
      }
    });
    
    if (!response.ok) {
      console.warn(`[LiveScore] RapidAPI fetch failed: ${response.status} ${response.statusText} - You might need to verify your subscribed API endpoint/host.`);
      return cachedMatchState;
    }

    const data = await response.json();
    
    // NOTE: RapidAPI has many cricket providers. 
    // This mapping attempts to parse typical structures (e.g., Cricbuzz or Cricket Live Data).
    // Please adjust the parsing paths to match the exact API you subscribed to!
    const matches = data.typeMatches || data.matches || data.data || [];
    let liveMatch = matches.find(m => m.state === 'In Progress' || m.status === 'LIVE' || m.matchState === 'In Progress');
    
    // If no live match found in structure, fallback to first item
    if (!liveMatch && matches.length > 0) liveMatch = matches[0];

    if (liveMatch) {
      // Extract scores (Highly dependent on specific API JSON shape)
      const scoreData = liveMatch.miniscore || liveMatch.score || {};
      
      // Attempt to map dynamic values
      cachedMatchState = {
        rrScore: scoreData.batTeam?.runs || cachedMatchState.rrScore,
        rrWickets: scoreData.batTeam?.wickets || cachedMatchState.rrWickets,
        rrOvers: scoreData.batTeam?.overs || cachedMatchState.rrOvers,
        lsgScore: scoreData.bowlTeam?.runs || cachedMatchState.lsgScore,
        lsgWickets: scoreData.bowlTeam?.wickets || cachedMatchState.lsgWickets,
        lsgBalls: scoreData.batTeam?.overs ? Math.floor(scoreData.batTeam.overs * 6) : cachedMatchState.lsgBalls,
        target: scoreData.target || cachedMatchState.target,
        
        // Extract current performing players to update Main Character dynamically!
        activePlayers: []
      };

      // Extract strikers and bowlers
      if (scoreData.striker) cachedMatchState.activePlayers.push(scoreData.striker.batName.toLowerCase());
      if (scoreData.nonStriker) cachedMatchState.activePlayers.push(scoreData.nonStriker.batName.toLowerCase());
      if (scoreData.bowler) cachedMatchState.activePlayers.push(scoreData.bowler.bowlName.toLowerCase());
    }

    return cachedMatchState;
  } catch (error) {
    console.error('[LiveScore] Error fetching live score from RapidAPI:', error.message);
    return cachedMatchState;
  }
}

function getLiveState() {
  return cachedMatchState;
}

module.exports = {
  fetchLiveScore,
  getLiveState
};
