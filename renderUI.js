// renderUI.js
// All DOM, canvas drawing, input, modals, audio, and wiring. Talks to logic via hooks.
import { state, setUIHooks, newGame, dealRow, doMove, undo, redo, computeHint, fmtTime, initFromURL, startTick } from './logic.js';
import { verifyInventory } from './validation.js';

const $ = (id)=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

// ---- Audio (same behavior as original) ----
const AudioKit = (()=>{ 
  const ctx = new (window.AudioContext||window.webkitAudioContext)(); 
  let muted = localStorage.getItem('audioMuted') === 'true' || false;
  const playFanfare = () => {
    if (muted) return;
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'sine'; osc2.type = 'sine';
    osc1.frequency.setValueAtTime(440, now);
    osc2.frequency.setValueAtTime(554.365, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
    gain.gain.linearRampToValueAtTime(0, now + 1.2);
    osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
    osc1.start(now); osc2.start(now); osc1.stop(now + 1.2); osc2.stop(now + 1.2);
  };
  const playShuffle = () => {
    if (muted) return;
    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.5;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    const bandpass = ctx.createBiquadFilter(); bandpass.type='bandpass'; bandpass.frequency.value=800; bandpass.Q.value=1.0;
    const lowpass = ctx.createBiquadFilter(); lowpass.type='lowpass'; lowpass.frequency.value=2000;
    const gainNode = ctx.createGain(); gainNode.gain.setValueAtTime(0.5, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    const noise = ctx.createBufferSource(); noise.buffer = noiseBuffer;
    noise.connect(bandpass); bandpass.connect(lowpass); lowpass.connect(gainNode); gainNode.connect(ctx.destination);
    for (let i = 0; i < 3; i++) { const t = now + (i * 0.12); noise.start(t); noise.stop(t + 0.5); }
  };
  function generateSound(freq=880, len=0.06, type='triangle', gain=0.05, click=false) { 
    if (muted) return null;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.value = freq; o.connect(g);
    if (click) { g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + len); }
    else { g.gain.value = gain; g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + len); }
    g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + len); return o;
  };
  function blip(freq=880, len=0.06, type='triangle', g=0.05) { generateSound(freq, len, type, g); }
  function click() { generateSound(1000, 0.04, 'sine', 0.2, true); }
  function thud() { generateSound(100, 0.3, 'sine', 0.8); }
  function chord() { [523, 659, 784, 988].forEach((f, i) => setTimeout(() => generateSound(f, 0.16, 'sine', 0.06), i * 70)); }
  function setMuted(v) {
    muted = v; localStorage.setItem('audioMuted', v);
    const muteBtn = document.getElementById('muteBtn'); if (muteBtn) muteBtn.textContent = v ? '🔇' : '🔊';
  }
  return { blip, click, thud, chord, setMuted, isMuted: () => muted, resume() { if (ctx.state === 'suspended') { ctx.resume(); } }, fanfare: playFanfare, shuffle: playShuffle };
})();

// ---- Canvas + layout ----
const canvas = $('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, cardW = 96, cardH = 134, margin = 0, topArea = 140, overlapUp = 26, overlapDown = 32;
const RED = new Set(['♥','♦']);

// --- HiDPI-aware canvas sizing helpers (keep drawing coords in CSS px) ---
function dpr() { return window.devicePixelRatio || 1; }
function setCanvasSize(cssW, cssH) {
  const scale = dpr();
  if (canvas.style.width  !== `${cssW}px`) canvas.style.width  = `${cssW}px`;
  if (canvas.style.height !== `${cssH}px`) canvas.style.height = `${cssH}px`;
  const pxW = Math.floor(cssW * scale);
  const pxH = Math.floor(cssH * scale);
  if (canvas.width !== pxW || canvas.height !== pxH) {
    canvas.width = pxW;
    canvas.height = pxH;
    ctx.setTransform(scale, 0, 0, scale, 0, 0); // keep math in CSS px
  }
  W = cssW; H = cssH;
}
function ensureCanvasHeight(cssH) {
  if (cssH !== H) setCanvasSize(W, cssH);
}

// ---- Layout ----
function resize() { 
  // Base size in CSS px; we’ll grow taller during draw() when needed
  W = window.innerWidth;
  H = window.innerHeight;
  setCanvasSize(W, H);
  
  // Calculate card dimensions based on viewport width
  const availableWidth = W - 186 - 20; // Account for sidebar and padding
  cardW = Math.min(125, Math.floor(availableWidth / 10) - 8); // 10 cards with 8px gap
  cardH = Math.floor(cardW * 1.4);
  
  // Update layout metrics
  margin = 0;
  overlapUp = Math.max(20, Math.floor(cardH * 0.24));
  overlapDown = Math.max(24, Math.floor(cardH * 0.30));
  topArea = 90; // space for column numbers
  
  // Position columns with equal spacing
  const totalGap = W - 186 - (10 * cardW) - 20; // Total gap space available
  const gapSize = Math.max(8, Math.floor(totalGap / 9)); // At least 8px between cards
  window.colX = c => 10 + c * (cardW + gapSize);
  
  draw();
}
window.addEventListener('resize', resize);

// ---- Drawing ----
function drawRounded(x,y,w,h,r) { 
  ctx.beginPath(); 
  ctx.moveTo(x+r, y); 
  ctx.arcTo(x+w, y, x+w, y+h, r); 
  ctx.arcTo(x+w, y+h, x, y+h, r); 
  ctx.arcTo(x, y+h, x, y, r); 
  ctx.arcTo(x, y, x+w, y, r); 
  ctx.closePath(); 
}

function drawCard(x,y,card){ 
  const r=15; ctx.save(); ctx.font = `bold ${Math.floor(cardW/5.5)}px Arial`;
  drawRounded(x,y,cardW,cardH,r);
  if(card.faceUp) {
    ctx.fillStyle='#ffffff'; ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.1)'; ctx.lineWidth=1; ctx.stroke();
    const grad=ctx.createLinearGradient(x,y,x,y+cardH);
    grad.addColorStop(0,'rgba(0,0,0,.03)'); grad.addColorStop(1,'rgba(0,0,0,.01)');
    ctx.fillStyle=grad; drawRounded(x,y,cardW,cardH,r); ctx.fill();
    const rankStr = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'][card.rank-1];
    const isRed = RED.has(card.suit);
    const textColor = isRed ? '#cc0000' : '#000000';
    ctx.font = `bold ${Math.floor(cardW*0.36)}px system-ui`; ctx.textBaseline = 'top'; ctx.fillStyle = textColor; ctx.fillText(rankStr, x+10, y+8);
    ctx.font = `bold ${Math.floor(cardW*0.42)}px system-ui`; ctx.textBaseline = 'top'; ctx.fillText(card.suit, x+cardW-Math.floor(cardW*0.42)-10, y+8);
  } else {
    ctx.fillStyle='#1a3a5f'; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=1; ctx.stroke();
    ctx.save(); ctx.globalAlpha = 0.1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    const patternSize = 12;
    for (let py = y + patternSize; py < y + cardH; py += patternSize * 2) {
      ctx.beginPath();
      for (let px = x + (py % (patternSize * 2) === 0 ? 0 : patternSize); px < x + cardW; px += patternSize * 2) { ctx.moveTo(px, py); ctx.lineTo(px + patternSize, py + patternSize); }
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore(); 
}

let confetti=[];
function burst(){ for(let i=0;i<180;i++){ confetti.push({ x: W/2, y: topArea+cardH/2, vx:(Math.random()*4-2), vy:(Math.random()*-5-2), rot:0, spin:(Math.random()*.2-.1), life: 80+(Math.random()*40|0), color:`hsl(${(Math.random()*360|0)},80%,60%)`}); } draw(); }

export function draw() {
  if (!ctx) return;

  const y0 = topArea;
  
  // Calculate total height needed for all columns
  let maxHeight = 0;
  for (const col of state.tableau) {
    if (col.length === 0) continue;
    let colHeight = cardH; // First card is full height
    for (let i = 1; i < col.length; i++) {
      colHeight += col[i].faceUp ? overlapDown : overlapUp;
    }
    maxHeight = Math.max(maxHeight, colHeight);
  }
  
  // Ensure canvas is tall enough for this frame (CSS px). Only grow.
  const neededHeight = Math.max(y0 + maxHeight + 100, window.innerHeight);
  if (neededHeight > H) {
    ensureCanvasHeight(neededHeight);
  }

  // Clear the entire pixel buffer each frame, regardless of current transform
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  
  // Draw columns
  for (let c = 0; c < 10; c++) {
    const x = colX(c);
    const col = state.tableau[c];
    
    // Draw the cards in the column
    let yy = y0;
    for (let i = 0; i < col.length; i++) { 
      drawCard(x, yy, col[i]);
      yy += col[i].faceUp ? overlapDown : overlapUp;
    }
    
    // Draw empty column indicator if needed
    if (col.length === 0) {
      drawRounded(x, y0, cardW, cardH, 12);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();
      
      // Draw dashed yellow border
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)';
      ctx.lineWidth = 3;
      drawRounded(x - 4, y0 - 4, cardW + 8, cardH + 8, 14);
      ctx.stroke();
      ctx.restore();
    }
    
    // Draw hint highlight
    if (state.hint && state.hint.to === c) {
      ctx.save();
      ctx.strokeStyle = 'rgba(20, 184, 166, 0.9)';
      ctx.lineWidth = 3;
      drawRounded(x - 4, y0 - 4, cardW + 8, cardH + 8, 14);
      ctx.stroke();
      ctx.restore();
    }
  }
  
  // Draw column numbers
  ctx.save();
  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let c = 0; c < 10; c++) {
    const x = colX(c) + cardW / 2;
    const y = 60;
    ctx.fillText(c + 1, x, y);
  }
  ctx.restore();
  
  // Draw dragged cards
  if (drag.active) {
    let yy = drag.y - drag.grabOffsetY;
    for (const card of drag.stack) {
      drawCard(drag.x - drag.grabOffsetX, yy, card);
      yy += overlapDown;
    }
  }
  
  // Draw confetti if needed
  if (confetti.length > 0) {
    for (const p of confetti) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life--;
      
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / 80);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      p.rot += p.spin;
      ctx.rotate(p.rot);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    // Remove dead confetti
    confetti = confetti.filter(p => p.life > 0);

    // Request next frame if there's more confetti
    if (confetti.length > 0) requestAnimationFrame(draw);
  }
}

// ---- Drag/Input ----
const drag={active:false, fromCol:-1, startIndex:-1, stack:[], x:0,y:0, grabOffsetX:0, grabOffsetY:0};
function colAt(px){ for(let c=0;c<10;c++){ const x=colX(c); if(px>=x && px<=x+cardW) return c; } return -1; }
function rowAtInCol(py, col) { 
  const y0 = topArea;
  const colArr = state.tableau[col]; 
  let yy = y0; 
  for (let i = 0; i < colArr.length; i++) { 
    const yTop = yy, yBot = yy + (colArr[i].faceUp ? overlapDown : overlapUp); 
    if (py >= yTop && py <= yBot) return i; 
    yy = yBot; 
  } 
  if (colArr.length) return colArr.length - 1; 
  return -1; 
}

function onPointerDown(e){ 
  if(state.won) return; 
  AudioKit.resume(); 
  const rect=canvas.getBoundingClientRect(); 
  const px=e.clientX-rect.left, py=e.clientY-rect.top; 
  const col=colAt(px); 
  if(col<0) return; 
  const row=rowAtInCol(py,col); 
  if(row<0) return; 
  const column=state.tableau[col]; 
  const card=column[row]; 
  if(!card.faceUp){ bounce(); return; }
  AudioKit.click();
  for(let i=column.length-1;i>row;i--){ const a=column[i], b=column[i-1]; if(!(a.faceUp && b.faceUp && a.rank+1===b.rank && a.suit===b.suit)){ bounce(); flashMsg('Drag a same-suit descending tail'); return; } }
  drag.active = true; 
  drag.fromCol = col; 
  drag.startIndex = row; 
  drag.stack = structuredClone(column.slice(row)); 
  drag.x = px; 
  drag.y = py; 
  drag.grabOffsetX = clamp(px - colX(col), 0, cardW); 
  drag.grabOffsetY = clamp(py - (topArea + row * overlapDown), 0, cardH); 
  window.addEventListener('pointermove', onPointerMove); 
  window.addEventListener('pointerup', onPointerUp);
}
function onPointerMove(e){ const r=canvas.getBoundingClientRect(); drag.x=e.clientX-r.left; drag.y=e.clientY-r.top; draw(); }
function onPointerUp(e){ 
  window.removeEventListener('pointermove', onPointerMove); 
  window.removeEventListener('pointerup', onPointerUp); 
  if(!drag.active) return; 
  const r=canvas.getBoundingClientRect(); 
  const px=e.clientX-r.left;
  const to=colAt(px); 
  if(to>=0){ doMove(drag.fromCol, drag.startIndex, to); AudioKit.thud(); } 
  drag.active=false; draw(); 
}
canvas.addEventListener('pointerdown', onPointerDown);

function bounce(){ canvas.animate([{transform:'translateX(0)'},{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:120}); AudioKit.blip(200,0.05,'square',0.04); }

// ---- UI glue ----
function updateUI(){
  $('time').textContent=fmtTime(state.elapsedMs);
  $('moves').textContent=state.moves;
  $('score').textContent=state.score;
  $('sets-counter').textContent=state.foundations;
  $('deals').textContent=state.dealsRemaining;
  $('seedLabel').textContent=state.seed;

  const hasEmpty = state.tableau.some(c=>c.length===0);
  const isFinalDeal = state.dealsRemaining === 1 && state.stock.length > 0 && state.stock.length < 10;
  const enoughStock = state.stock.length >= 10 || isFinalDeal;
  const dealDisabled = hasEmpty || state.dealsRemaining<=0 || (!enoughStock && !isFinalDeal);
  $('dealBtn').disabled = dealDisabled;
  let title = 'Deal next row';
  if (state.dealsRemaining <= 0) title = 'No deals left';
  else if (hasEmpty) title = 'Fill empty columns before dealing';
  else if (isFinalDeal) title = 'Deal final cards';
  else if (state.stock.length < 10) title = 'Not enough cards in stock';
  $('dealBtn').title = title;
  const reasonEl = $('dealReason');
  if(dealDisabled && !isFinalDeal) {
    reasonEl.style.display='inline-block';
    reasonEl.textContent = state.dealsRemaining<=0 ? 'No deals left' : (hasEmpty ? 'Deal blocked: empty column(s)' : 'Deal blocked: not enough cards');
  } else { reasonEl.style.display='none'; }
  $('undoBtn').disabled=state.history.length===0;
  $('redoBtn').disabled=state.redo.length===0;
  const diffSel = $('difficulty'); if(diffSel) diffSel.value = state.difficulty;
  document.title = state.won? '✅ Spider – Win!' : 'Spider Solitaire – Peacock';
}
function flashMsg(m){ state.message=m; const el=$('msg'); el.textContent=m; el.style.opacity=1; el.animate([{opacity:1},{opacity:0}],{duration:1600, fill:'forwards'}); }

function showWin() { 
  $('winTime').textContent = fmtTime(state.elapsedMs); 
  $('winMoves').textContent = state.moves; 
  $('winScore').textContent = state.score;
  $('winDifficulty').textContent = state.difficulty;
  $('winSeed').textContent = state.seed;
  $('winModal').style.display = 'grid'; 
  burst(); 
}
$('playAgain').onclick=()=>{ $('winModal').style.display='none'; newGame({ difficulty: state.difficulty, includeAces: state.includeAces }); };
$('shareSeed').onclick=async()=>{ const url=new URL(location.href); url.searchParams.set('seed', state.seed); url.searchParams.set('difficulty', state.difficulty); try{ await navigator.clipboard.writeText(url.toString()); flashMsg('Link copied'); }catch{ flashMsg(url.toString()); } };

function showVerificationModal({ ok, duplicates, missing, counts, expectedTotal, includeAces, notes }) {
  const modal = document.createElement('div');
  modal.style.position = 'fixed'; modal.style.top = '50%'; modal.style.left = '50%';
  modal.style.transform = 'translate(-50%, -50%)'; modal.style.backgroundColor = 'rgba(27, 37, 56, 0.95)';
  modal.style.padding = '20px'; modal.style.borderRadius = '12px'; modal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
  modal.style.zIndex = '1000'; modal.style.maxWidth = '80vw'; modal.style.maxHeight = '80vh';
  modal.style.overflowY = 'auto'; modal.style.color = '#e6eef7'; modal.style.fontFamily = 'system-ui, sans-serif';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×'; closeBtn.style.position = 'absolute'; closeBtn.style.top = '10px'; closeBtn.style.right = '10px';
  closeBtn.style.background = 'none'; closeBtn.style.border = 'none'; closeBtn.style.color = '#e6eef7'; closeBtn.style.fontSize = '24px'; closeBtn.style.cursor = 'pointer';
  closeBtn.onclick = () => document.body.removeChild(modal);
  const title = document.createElement('h2'); title.textContent = 'Deck Verification'; title.style.marginTop = '0'; title.style.color = ok ? '#22c55e' : '#f59e0b'; title.textContent += ok ? ' ✓' : ' ❌';
  const status = document.createElement('div'); status.style.marginBottom = '20px';
  status.innerHTML = `<div>Game Mode: ${state.difficulty} ${includeAces ? '(Aces included)' : '(Aces excluded)'}</div>
    <div>Expected Total: ${expectedTotal} cards</div>
    <div>Found: ${counts.total} cards</div>
    <div>Duplicates: ${duplicates.length}</div>
    <div>Missing: ${missing.length}</div>
    <div>Tableau: ${counts.tableau} cards</div>
    <div>Stock: ${counts.stock} cards</div>
    <div>Foundations: ${counts.foundations} cards</div>`;
  const notesTitle = document.createElement('h3'); notesTitle.textContent = 'Verification Notes'; notesTitle.style.marginBottom = '10px';
  const notesList = document.createElement('div'); notesList.style.backgroundColor = 'rgba(0,0,0,0.2)'; notesList.style.padding = '10px'; notesList.style.borderRadius = '6px'; notesList.style.maxHeight = '300px'; notesList.style.overflowY = 'auto'; notesList.style.fontFamily = 'monospace'; notesList.style.whiteSpace = 'pre';
  notesList.textContent = (notes && notes.length > 0) ? notes.join('\n') : 'No verification notes available';
  modal.appendChild(closeBtn); modal.appendChild(title); modal.appendChild(status); modal.appendChild(notesTitle); modal.appendChild(notesList);
  modal.onclick = (e) => { if (e.target === modal) { document.body.removeChild(modal); } };
  document.body.appendChild(modal);
  setTimeout(() => { if (document.body.contains(modal)) document.body.removeChild(modal); }, 10000);
}

// ---- Hints UI ----
function showHint(){
  const hints = computeHint();
  const hintModal = $('hintModal');
  const hintList = $('hintList');
  hintList.innerHTML = '';
  if(hints.length === 0) {
    hintList.innerHTML = '<div class="hint-item">No moves available</div>';
    hintModal.style.display = 'flex'; return;
  }
  hints.forEach((hint, index) => {
    const fromCol = hint.from + 1; const toCol = hint.to + 1;
    const cardCount = hint.cardCount > 1 ? ` (${hint.cardCount} cards)` : '';
    const rankNames = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    const rankName = rankNames[hint.headRank - 1];
    const el = document.createElement('div');
    el.className = `hint-item ${index === 0 ? 'best' : ''}`;
    el.innerHTML = `<div><b>${index + 1}.</b> Move from column ${fromCol} to ${toCol}${cardCount}</div>
      <div class="hint-details">Moves ${hint.headSuit}${rankName}${hint.cardCount > 1 ? ' + ' + (hint.cardCount - 1) + ' more' : ''}<br>${hint.reasons.join(' • ')}</div>`;
    el.onclick = () => { doMove(hint.from, hint.start, hint.to); hintModal.style.display = 'none'; };
    hintList.appendChild(el);
  });
  state.hint = hints[0]; draw(); hintModal.style.display = 'flex';
}
$('closeHint').onclick = () => { $('hintModal').style.display = 'none'; state.hint = null; draw(); };
$('hintModal').onclick = (e) => { if (e.target === $('hintModal')) { $('hintModal').style.display = 'none'; state.hint = null; draw(); } };

// ---- Stats UI ----
function initStats() {
  const showStatsBtn = $('showStats'); const closeBtn = $('closeStats'); const statsModal = $('statsModal');
  if (showStatsBtn) showStatsBtn.onclick = showStatsV2;
  if (closeBtn && statsModal) {
    closeBtn.onclick = () => { statsModal.style.display = 'none'; document.body.style.overflow = 'auto'; };
    statsModal.onclick = (e) => { if (e.target === statsModal) { statsModal.style.display = 'none'; document.body.style.overflow = 'auto'; } };
  }
}

// NEW: History-backed Stats entry point (keeps your modal & layout intact)
function showStatsV2() {
  const statsModal = document.getElementById('statsModal');
  if (!statsModal) return;

  // Ensure we have a container inside the modal to host the History table
  let panel = document.getElementById('statsPanel');
  if (!panel) {
    const modalContent = statsModal.querySelector('.modal-content') || statsModal;
    panel = document.createElement('div');
    panel.id = 'statsPanel';
    const btnRow = modalContent.querySelector('.modal-buttons');
    if (btnRow) modalContent.insertBefore(panel, btnRow);
    else modalContent.appendChild(panel);
  } else {
    panel.innerHTML = ''; // clear any previous render
  }

  // Render the new History view
  if (window.GameHistory && typeof window.GameHistory.renderPanel === 'function') {
    window.GameHistory.renderPanel('statsPanel');
  } else {
    panel.innerHTML = '<p style="color:#f88">History system not loaded. Make sure <code>history.js</code> is included.</p>';
  }

  statsModal.style.display = 'block';
}

// ---- Controls wiring ----
$('newBtn').onclick=()=> newGame({ difficulty: state.difficulty, includeAces: $('includeAces').checked });
$('replayBtn').onclick=()=> newGame({ difficulty: state.difficulty, seed: state.seed, includeAces: state.includeAces });
$('dealBtn').onclick=()=> dealRow();
$('undoBtn').onclick=()=> undo();
$('redoBtn').onclick=()=> redo();
$('hintBtn').onclick=()=> showHint();
$('difficulty').onchange=(e)=> newGame({ difficulty: e.target.value, includeAces: $('includeAces').checked });
$('includeAces').onchange=(e)=> newGame({ difficulty: state.difficulty, includeAces: e.target.checked });
$('setSeedBtn').onclick=()=>{ const v=$('seedInput').value.trim(); if(v){ const u=new URL(location.href); u.searchParams.set('seed', v); u.searchParams.set('difficulty', state.difficulty); history.replaceState({},'',u); newGame({ difficulty: state.difficulty, seed: v, includeAces: $('includeAces').checked }); } };
$('muteBtn').textContent = AudioKit.isMuted() ? '🔇' : '🔊';
$('muteBtn').onclick = () => { const v = !AudioKit.isMuted(); AudioKit.setMuted(v); if (!v) AudioKit.click(); };
$('verifyBtn').onclick=()=> { const data = verifyInventory(); showVerificationModal(data); };
window.addEventListener('keydown', (e)=>{
  if(e.repeat) return;

  // Don't process game commands if typing in the seed input
  const seedInput = document.activeElement.id === 'seedInput';
  if (seedInput) return;

  const key = e.key.toLowerCase();
  if(key === 'n') $('newBtn').click();
  else if(key === 'd') $('dealBtn').click();
  else if(key === 'u') $('undoBtn').click();
  else if(key === 'r') $('redoBtn').click();
  else if(key === 'h') $('hintBtn').click();
  else if(key === 'v') $('verifyBtn').click();
});

// ---- Hook up logic->UI bridge ----
setUIHooks({ updateUI, draw, flashMsg, showWin, showVerificationModal, audio: AudioKit });

// ---- Boot ----
window.addEventListener('load', async () => {
  try {
    // const incompleteGame = await recoverIncompleteGames();
    // if (incompleteGame) recordGameResult('abandoned');
  } catch {}
});
resize();
const init = initFromURL();
if (window.__hudClockInterval) { clearInterval(window.__hudClockInterval); delete window.__hudClockInterval; }
initStats();
startTick();
requestAnimationFrame(draw);

