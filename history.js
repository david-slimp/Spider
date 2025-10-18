/*
	history.js
  History engine for Spider Solitaire (single-key v3)

  - Storage key: 'spider.games.v3'  (all games, including active/in-progress)
  - Statuses: InProgress | Won (no "Lost")
  - Create record on FIRST actual player move (not on New Game)
  - Save a full snapshot after EVERY move (so tab close/crash can resume)
  - Timer is elapsed seconds only; we accumulate while the tab is open
  - Resume by clicking "InProgress" in the History table
  - Replay restarts the same seed+difficulty from the beginning (a new record is created on the first move of that replay)

  Required from your game code:
    - Call GameHistory.onFirstMove({ seed, difficulty, snapshot, moves, score })
      exactly once on the first user move of a fresh deal.
    - Call GameHistory.onMove({ snapshot, moves, score }) on every successful move.
    - Call GameHistory.onWin({ snapshot, moves, score }) when the player wins.
    - Implement:
        window.Game.loadSnapshot(snapshot, {seed, difficulty})
        window.Game.replaySeedDiff(seed, difficulty)
      (alerts will warn you if these are missing)

  UI:
    - Call GameHistory.renderPanel('statsPanel') to fill a container with the History table.
    - If 'statsPanel' isn't found, we'll try to create it inside #statsModal .modal-content.
*/

(function () {
  'use strict';

  // =========================
  // Storage (single v3 array)
  // =========================
  const STORAGE_KEY = 'spider.games.v3';
  const STATUS = { InProgress: 'InProgress', Won: 'Won' };

  function readGames() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (_) { return []; }
  }
  function writeGames(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }
  function upsertGame(rec) {
    const games = readGames();
    const i = games.findIndex(g => g.id === rec.id);
    if (i === -1) games.unshift(rec); else games[i] = rec;
    writeGames(games);
  }
  function findById(id) {
    return readGames().find(g => g.id === id) || null;
  }
  function updateById(id, mutator) {
    const games = readGames();
    const i = games.findIndex(g => g.id === id);
    if (i === -1) return null;
    const updated = mutator({ ...games[i] });
    games[i] = updated;
    writeGames(games);
    return updated;
  }

  // =========================
  // Time accumulation helpers
  // =========================
  let activeId = null;
  let accStartMs = null;

  function nowSec() { return (Date.now() / 1000) | 0; }
  function fmtSec(total) {
    total = total | 0; if (total < 0) total = 0;
    const m = (total / 60) | 0, s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  function canonDiff(d) {
    // Accept "1-suit"/"2-suit"/"4-suit" or "1"/"2"/"4"; normalize to "1"/"2"/"4"
    const t = String(d ?? '4').trim();
    if (t[0] === '1') return '1';
    if (t[0] === '2') return '2';
    return '4';
  }

  function startAccum(id) {
    activeId = id;
    accStartMs = Date.now();
  }
  function flushAccum() {
    if (!activeId || accStartMs == null) return;
    const delta = Math.floor((Date.now() - accStartMs) / 1000);
    if (delta > 0) {
      updateById(activeId, rec => {
        rec.elapsedSeconds = (rec.elapsedSeconds | 0) + delta;
        rec.lastSavedAt = nowSec();
        return rec;
      });
    }
    accStartMs = Date.now();
  }
  function stopAccum() {
    flushAccum();
    activeId = null;
    accStartMs = null;
  }
  window.addEventListener('visibilitychange', () => { if (document.hidden) flushAccum(); });
  window.addEventListener('beforeunload', flushAccum);

  // --- Dedup helpers: keep the newest (by lastSavedAt) for each (seed,difficulty) ---
function seedDiffKey(g) {
  const inc = g.includeAces ? 'A1' : 'A0'; // if you store it
  return `${String(g.seed)}|${canonDiff(g.difficulty)}|${inc}`; // canonDiff already exists
}

function dedupeSeedDiff(preferId = null) {
  const list = readGames();
  const bestByKey = new Map();

  for (const g of list) {
    const k = seedDiffKey(g);
    const cur = bestByKey.get(k);
    if (!cur) { bestByKey.set(k, g); continue; }

    // Choose winner:
    // 1) If preferId matches one, keep that
    // 2) Else keep the one with larger lastSavedAt
    let winner = cur;
    if (preferId && (g.id === preferId)) winner = g;
    else if (preferId && (cur.id === preferId)) winner = cur;
    else winner = ((g.lastSavedAt|0) > (cur.lastSavedAt|0)) ? g : cur;

    bestByKey.set(k, winner);
  }

  // Rebuild array sorted by newest first
  const newArr = Array.from(bestByKey.values())
    .sort((a, b) => (b.lastSavedAt|0) - (a.lastSavedAt|0));

  writeGames(newArr);
  return newArr;
}

  // =========================
  // Public API
  // =========================
  const GameHistory = {
    STORAGE_KEY,
    STATUS,

    // Create record on first REAL player move of a fresh deal
    onFirstMove({ seed, difficulty, snapshot, moves = 0, score = 0 }) {
      const rec = {
        id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random()),
        seed: String(seed),
        difficulty: canonDiff(difficulty), // "1" | "2" | "4"
        status: STATUS.InProgress,
        moves: moves | 0,
        score: score | 0,
        elapsedSeconds: 0,
        lastSavedAt: nowSec(),
        snapshot, // full game state snapshot
        version: 3
      };
      upsertGame(rec);
      dedupeSeedDiff(rec.id);  // keep only the newest run for this seed+difficulty
      startAccum(rec.id);
    },

    // Save snapshot after EVERY successful move
    onMove({ snapshot, moves, score }) {
      if (!activeId) return; // ignore if first move not logged yet
      flushAccum();
      updateById(activeId, rec => {
        rec.moves = moves | 0;
        rec.score = score | 0;
        rec.snapshot = snapshot;
        rec.lastSavedAt = nowSec();
        return rec;
      });
    },

    // Mark the active game as Won
    onWin({ snapshot, moves, score }) {
      if (!activeId) return;
      flushAccum();
      updateById(activeId, rec => {
        rec.status = STATUS.Won;
        rec.moves = moves | 0;
        rec.score = score | 0;
        rec.snapshot = snapshot;   // final state (optional but fine)
        rec.lastSavedAt = nowSec();
        return rec;
      });
      stopAccum();
      // After marking Won, make sure duplicates are cleared too
      dedupeSeedDiff(activeId);
    },

    // Load a saved game
    resume(id) {
      const rec = findById(id);
      if (!rec) { alert('Saved game not found.'); return; }
      if (!rec.snapshot) { alert('No snapshot available to resume.'); return; }
      if (!window.Game || typeof window.Game.loadSnapshot !== 'function') {
        alert('Game loader not found (Game.loadSnapshot).'); return;
      }
    
      // Mark as already-started so next move logs as onMove (not onFirstMove)
      window.__firstMoveLogged__ = true;
    
      // Start accumulating time right away
      startAccum(rec.id);
    
      // Load the saved state and inject previously elapsed seconds so HUD shows it now
      window.Game.loadSnapshot(rec.snapshot, {
        seed: rec.seed,
        difficulty: rec.difficulty,
        elapsedSeconds: rec.elapsedSeconds | 0
      });
    },

    // Restart same seed+difficulty from scratch
    replay(id) {
      const rec = findById(id);
      if (!rec) { alert('Game not found for replay.'); return; }
      if (!window.Game || typeof window.Game.replaySeedDiff !== 'function') {
        alert('Game.replaySeedDiff(seed, diff) not implemented.'); return;
      }
      stopAccum();
      window.Game.replaySeedDiff(rec.seed, rec.difficulty);
      // The replay creates its *new* record on the next first move.
    },

    // Clear all game history
    clearAll() {
      if (confirm('Are you sure you want to clear all game history? This cannot be undone.')) {
        localStorage.removeItem(STORAGE_KEY);
        this.renderPanel();
      }
    },

    // Render the History/Stats table
    renderPanel(containerId = 'statsPanel') {
      // Find (or create) a panel element to host the table
      let el = document.getElementById(containerId);
      if (!el) {
        // try to create it inside the existing stats modal to avoid layout changes
        const modal = document.getElementById('statsModal');
        const modalContent = modal && modal.querySelector('.modal-content');
        if (modalContent) {
          el = document.createElement('div');
          el.id = containerId;
          const btnRow = modalContent.querySelector('.modal-buttons');
          if (btnRow) modalContent.insertBefore(el, btnRow); else modalContent.appendChild(el);
        } else {
          // last resort: create at end of body
          el = document.createElement('div');
          el.id = containerId;
          document.body.appendChild(el);
        }
      } else {
        el.innerHTML = '';
      }

      const games = readGames();
      const wins = games.filter(g => g.status === STATUS.Won);
      const bestTime = wins.length ? wins.reduce((a, b) => a.elapsedSeconds < b.elapsedSeconds ? a : b) : null;
      const bestMoves = wins.length ? wins.reduce((a, b) => a.moves < b.moves ? a : b) : null;
      const bestScore = wins.length ? wins.reduce((a, b) => a.score > b.score ? a : b) : null;

      const summary =
`<div class="stats-summary">
  <div>Total games: <strong>${games.length}</strong></div>
  <div>Wins: <strong>${wins.length}</strong> (${games.length > 0 ? (wins.length / games.length * 100).toFixed(1) : '0.0'}%)</div>
  <div>Best Time: <strong>${bestTime ? fmtSec(bestTime.elapsedSeconds) : '-'}</strong></div>
  <div>Best Moves: <strong>${bestMoves ? bestMoves.moves : '-'}</strong></div>
  <div>Best Score: <strong>${bestScore ? bestScore.score : '-'}</strong></div>
</div>`;

      const rows = games.map(g => {
        const diff = g.difficulty === '1' ? '1-suit' : (g.difficulty === '2' ? '2-suit' : '4-suit');
        const when = g.lastSavedAt ? new Date(g.lastSavedAt * 1000).toLocaleString() : '-';
        const statusCell = g.status === STATUS.InProgress
          ? `<button class="linklike" data-resume="${g.id}">InProgress</button>`
          : `<span>Won</span>`;
        return `<tr>
          <td>${g.seed}</td>
          <td>${diff}</td>
          <td>${statusCell}</td>
          <td>${g.moves | 0}</td>
          <td>${fmtSec(g.elapsedSeconds | 0)}</td>
          <td>${g.score ?? '-'}</td>
          <td>${when}</td>
          <td><button data-replay="${g.id}" class="btn">Replay</button></td>
        </tr>`;
      }).join('');

      el.innerHTML = `
        <h2>History & Stats</h2>
        ${summary}
        <div class="table-wrap">
          <table class="stats-table">
            <thead>
              <tr>
                <th>Seed</th><th>Difficulty</th><th>Status</th>
                <th>Moves</th><th>Time</th><th>Score</th><th>Last Saved</th><th>Action</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="8">No games yet.</td></tr>'}</tbody>
          </table>
        </div>
      `;

      // Wire actions
      el.querySelectorAll('button[data-resume]').forEach(b => {
        b.addEventListener('click', () => GameHistory.resume(b.getAttribute('data-resume')));
      });
      el.querySelectorAll('button[data-replay]').forEach(b => {
        b.addEventListener('click', () => GameHistory.replay(b.getAttribute('data-replay')));
      });
    }
  };

  // Expose API
  window.GameHistory = GameHistory;

  // Minimal table styling (does NOT touch gameplay visuals)
  const style = document.createElement('style');
  style.textContent = `
    .stats-summary { display:flex; gap:1rem; flex-wrap:wrap; margin:.5rem 0 1rem; }
    .stats-table { width:100%; border-collapse:collapse; }
    .stats-table th, .stats-table td { border-bottom:1px solid #333; padding:.4rem .5rem; text-align:left; }
    .stats-table thead th { border-bottom:2px solid #555; }
    .table-wrap { overflow:auto; max-height:50vh; }
    .btn { padding:.3rem .6rem; }
    .clear-btn { 
      background-color: #ff4444;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      margin-right: 10px;
    }
    .clear-btn:hover {
      background-color: #cc0000;
    }
    .modal-buttons {
      display: flex;
      justify-content: flex-end;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #eee;
    }
    .linklike { background:none; border:none; padding:0; color:#6cf; cursor:pointer; text-decoration:underline; }
  `;
  document.head.appendChild(style);

  // Clean up any pre-existing duplicates from older builds
  try { dedupeSeedDiff(); } catch (_) {}

})();

