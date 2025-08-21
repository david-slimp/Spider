/**
 * Game Statistics Module for Spider Solitaire
 * Tracks scores, moves, time, and game states
 */

// Storage keys
const GAME_STATS_KEY = 'spider_solitaire_stats_v1';
const ACTIVE_GAME_KEY = 'spider_active_game_v1';

/**
 * Generate a unique key for a game based on suit count and seed
 */
function getGameKey(suitCount, seed) {
  return `${suitCount}-${seed}`;
}

/**
 * Parse a game key back into its components
 */
function parseGameKey(gameKey) {
  const [suitCount, ...rest] = gameKey.split('-');
  return {
    suitCount: parseInt(suitCount, 10),
    seed: rest.join('-') // In case seed contains hyphens
  };
}

/**
 * Initialize or get game statistics
 */
function getGameStats() {
  const stats = localStorage.getItem(GAME_STATS_KEY);
  return stats ? JSON.parse(stats) : { 
    version: "1.0", 
    games: {},
    stats: initStats(),
    inProgressGames: {}
  };
}

/**
 * Initialize default statistics
 */
function initStats() {
  return {
    totalGames: 0,
    wins: 0,
    bestTime: null,
    bestMoves: null,
    bestScore: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastPlayed: null,
    byDifficulty: {
      '1-suit': { games: 0, wins: 0, bestTime: null, bestMoves: null, bestScore: 0 },
      '2-suit': { games: 0, wins: 0, bestTime: null, bestMoves: null, bestScore: 0 },
      '4-suit': { games: 0, wins: 0, bestTime: null, bestMoves: null, bestScore: 0 }
    }
  };
}

/**
 * Start tracking a new game
 */
function trackGameStart({ suitCount, seed, difficulty }) {
  const gameKey = getGameKey(suitCount, seed);
  const startTime = new Date().toISOString();
  
  const gameData = {
    gameKey,
    suitCount,
    seed,
    difficulty,
    startTime,
    lastUpdated: startTime,
    moves: 0,
    score: 0,
    state: 'in_progress',
    lastSaved: null
  };
  
  // Save as active game
  localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(gameData));
  
  // Update statistics
  const stats = getGameStats();
  stats.stats.totalGames++;
  stats.stats.byDifficulty[difficulty].games++;
  stats.stats.lastPlayed = startTime;
  saveGameStats(stats);
  
  return gameData;
}

/**
 * Update the active game state
 */
function updateActiveGame(updates) {
  const game = getActiveGame();
  if (!game) return null;
  
  const updatedGame = {
    ...game,
    ...updates,
    lastUpdated: new Date().toISOString()
  };
  
  localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(updatedGame));
  autoSaveGame(updatedGame);
  return updatedGame;
}

/**
 * Get the currently active game
 */
function getActiveGame() {
  const game = localStorage.getItem(ACTIVE_GAME_KEY);
  return game ? JSON.parse(game) : null;
}

/**
 * Auto-save game progress
 */
function autoSaveGame(game) {
  // Only save every 30 seconds max
  if (game.lastSaved && (Date.now() - new Date(game.lastSaved).getTime() < 30000)) {
    return;
  }
  
  const stats = getGameStats();
  const saveKey = `progress_${game.gameKey}_${Date.now()}`;
  
  stats.inProgressGames = stats.inProgressGames || {};
  stats.inProgressGames[saveKey] = {
    ...game,
    lastSaved: new Date().toISOString()
  };
  
  // Clean up old saves (keep last 3 per game)
  const gameSaves = Object.entries(stats.inProgressGames)
    .filter(([key]) => key.startsWith(`progress_${game.gameKey}_`))
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(3);
    
  gameSaves.forEach(([key]) => delete stats.inProgressGames[key]);
  
  saveGameStats(stats);
  
  // Update last saved time in active game
  if (game.state === 'in_progress') {
    const activeGame = getActiveGame();
    if (activeGame && activeGame.gameKey === game.gameKey) {
      activeGame.lastSaved = new Date().toISOString();
      localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(activeGame));
    }
  }
}

/**
 * Record a game result (win/loss/abandoned)
 */
function recordGameResult(outcome) {
  const game = getActiveGame();
  if (!game) return null;
  
  const endTime = new Date().toISOString();
  const timePlayed = Math.floor((new Date(endTime) - new Date(game.startTime)) / 1000);
  
  const result = {
    ...game,
    outcome,
    endTime,
    timePlayed,
    state: outcome === 'win' ? 'won' : 'lost',
    lastUpdated: endTime
  };
  
  // Save to game history
  const stats = getGameStats();
  stats.games[game.gameKey] = stats.games[game.gameKey] || {
    gameKey: game.gameKey,
    suitCount: game.suitCount,
    seed: game.seed,
    difficulty: game.difficulty,
    firstPlayed: game.startTime,
    lastPlayed: endTime,
    totalPlays: 0,
    wins: 0,
    bestTime: null,
    bestMoves: null,
    bestScore: 0,
    history: []
  };
  
  const gameRecord = stats.games[game.gameKey];
  gameRecord.lastPlayed = endTime;
  gameRecord.totalPlays++;
  
  // Record this play in history
  const playRecord = {
    timestamp: endTime,
    outcome,
    time: timePlayed,
    moves: game.moves,
    score: game.score
  };
  
  gameRecord.history.push(playRecord);
  
  // Update best records
  if (outcome === 'win') {
    gameRecord.wins++;
    
    if (!gameRecord.bestTime || timePlayed < gameRecord.bestTime) {
      gameRecord.bestTime = timePlayed;
    }
    
    if (!gameRecord.bestMoves || game.moves < gameRecord.bestMoves) {
      gameRecord.bestMoves = game.moves;
    }
    
    if (game.score > gameRecord.bestScore) {
      gameRecord.bestScore = game.score;
    }
    
    // Update global stats
    stats.stats.wins++;
    stats.stats.currentStreak++;
    
    if (stats.stats.currentStreak > stats.stats.bestStreak) {
      stats.stats.bestStreak = stats.stats.currentStreak;
    }
    
    // Update difficulty stats
    const diffStats = stats.stats.byDifficulty[game.difficulty];
    if (diffStats) {
      diffStats.wins++;
      if (!diffStats.bestTime || timePlayed < diffStats.bestTime) {
        diffStats.bestTime = timePlayed;
      }
      if (!diffStats.bestMoves || game.moves < diffStats.bestMoves) {
        diffStats.bestMoves = game.moves;
      }
      if (game.score > diffStats.bestScore) {
        diffStats.bestScore = game.score;
      }
    }
  } else {
    stats.stats.currentStreak = 0;
  }
  
  // Update global bests
  if (outcome === 'win') {
    if (!stats.stats.bestTime || timePlayed < stats.stats.bestTime) {
      stats.stats.bestTime = timePlayed;
    }
    if (!stats.stats.bestMoves || game.moves < stats.stats.bestMoves) {
      stats.stats.bestMoves = game.moves;
    }
    if (game.score > stats.stats.bestScore) {
      stats.stats.bestScore = game.score;
    }
  }
  
  // Save everything
  saveGameStats(stats);
  
  // Clear active game
  localStorage.removeItem(ACTIVE_GAME_KEY);
  
  return result;
}

/**
 * Helper to save statistics
 */
function saveGameStats(stats) {
  try {
    localStorage.setItem(GAME_STATS_KEY, JSON.stringify(stats));
    return true;
  } catch {
    // Silently fail in production
    return false;
  }
}

/**
 * Check for and clean up incomplete games on load
 */
function recoverIncompleteGames() {
  const stats = getGameStats();
  const incompleteGames = Object.entries(stats.inProgressGames || {})
    .map(([key, game]) => ({
      key,
      ...game,
      timeElapsed: Math.floor((new Date() - new Date(game.startTime)) / 1000)
    }))
    .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    
  // Clean up old progress saves
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  if (stats.inProgressGames) {
    Object.keys(stats.inProgressGames).forEach(key => {
      const saveTime = new Date(key.split('_').pop()).getTime();
      if (now - saveTime > oneDay) {
        delete stats.inProgressGames[key];
      }
    });
    saveGameStats(stats);
  }
  
  return incompleteGames[0] || null;
}

// Export functions
export {
  getGameKey,
  parseGameKey,
  getGameStats,
  initStats,
  trackGameStart,
  updateActiveGame,
  getActiveGame,
  autoSaveGame,
  recordGameResult,
  saveGameStats,
  recoverIncompleteGames
};

// Set up auto-save on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const game = getActiveGame();
    if (game && game.state === 'in_progress') {
      autoSaveGame(game);
    }
  });
}
