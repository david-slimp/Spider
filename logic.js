/* logic.js
 * Game state, rules, persistence, RNG, moves, verification, scoring, and hint computation.
 * This file intentionally avoids touching the DOM; it talks to the UI via small hooks.
 */

import { trackGameStart, updateActiveGame, recordGameResult } from './stats.js';

// ---- Utilities ----
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const now = ()=>performance.now();

// ---- PRNG ----
function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t ^ t>>>15, t|1); t^=t+Math.imul(t ^ t>>>7, t|61); return ((t ^ t>>>14)>>>0)/4294967296; } }
function hashSeed(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function shuffle(arr, rnd){ for(let i=arr.length-1;i>0;i--){ const j=(rnd()*(i+1))|0; [arr[i],arr[j]]=[arr[j],arr[i]]; } }
const randSeed = ()=>{ const a=new Uint32Array(2); crypto.getRandomValues(a); return (a[0].toString(36)+a[1].toString(36)).slice(0,10); };

// ---- UI hook bridge ----
export const hooks = {
  updateUI: () => {},
  draw: () => {},
  flashMsg: (_m) => {},
  showWin: () => {},
  showVerificationModal: (_data) => {},
  audio: {
    blip: ()=>{}, click: ()=>{}, thud: ()=>{}, chord: ()=>{},
    setMuted: ()=>{}, isMuted: ()=>false, resume: ()=>{},
    fanfare: ()=>{}, shuffle: ()=>{}
  }
};
export function setUIHooks(h) { Object.assign(hooks, h); }

// ---- Engine State ----
export const state = {
  difficulty:'1-suit', seed:'', rng:null, includeAces: false,
  tableau:[[],[],[],[],[],[],[],[],[],[]], stock:[], dealsRemaining:5, foundations:0,
  moves:0, score:500, startTime:0, elapsedMs:0, running:true,
  history:[], redo:[], message:'', hint:null, won:false, foundationsCards:[]
};

// Verification notes (consumed by verification modal)
let verificationNotes = [];
function resetVerificationNotes() { verificationNotes = []; }
function addVerificationNote(note) { verificationNotes.push(note); }

// ---- Deck & Dealing ----
export function createDeck(difficulty, includeAces = false) {
  resetVerificationNotes();
  let suits;
  if (difficulty === '1-suit') suits = Array(8).fill('♠');
  else if (difficulty === '2-suit') suits = [...Array(4).fill('♠'), ...Array(4).fill('♥')];
  else suits = ['♠', '♥', '♦', '♣', '♠', '♥', '♦', '♣'];

  const deck = [];
  let id = 0;
  for (const s of suits) {
    for (let r = 1; r <= 13; r++) {
      deck.push({id: id++, suit: s, rank: r, faceUp: false});
    }
  }
  const suitCounts = {};
  deck.forEach(card => { suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1; });
  addVerificationNote(`Created deck with ${Object.keys(suitCounts).length} unique suits`);
  Object.entries(suitCounts).forEach(([suit, count]) => {
    addVerificationNote(`- ${suit}: ${count} cards (${count/13} complete K-A sets)`);
  });

  if (!includeAces) {
    const initial = deck.length;
    for (let i = deck.length - 1; i >= 0; i--) {
      if (deck[i].rank === 1) deck.splice(i, 1);
    }
    addVerificationNote(`Removed ${initial - deck.length} Aces from deck`);
  }
  addVerificationNote(`Final deck size: ${deck.length} cards`);
  return deck;
}

export function initialDeal(deck) {
  const cols = Array.from({length: 10}, () => []);
  shuffle(deck, state.rng);
  const stock = deck.slice(0, 50);
  const remaining = deck.slice(50);
  addVerificationNote(`Dealing ${stock.length} cards to stock (deal deck)`);
  addVerificationNote(`Dealing ${remaining.length} cards to tableau`);

  let idx = 0;
  for (let pass = 0; pass < 6 && idx < remaining.length; pass++) {
    for (let c = 0; c < 10 && idx < remaining.length; c++) {
      if (pass === 5 && c >= 4) continue; // Only 4 on last pass
      const card = remaining[idx++];
      cols[c].push(card);
    }
  }
  for (let c = 0; c < 10; c++) {
    if (cols[c].length) cols[c][cols[c].length - 1].faceUp = true;
  }
  cols.forEach((col, i) => addVerificationNote(`Column ${i + 1}: ${col.length} cards`));
  return { tableau: cols, stock };
}

// ---- Rules helpers ----
const top = (col)=>col[col.length-1];
function canDrop(tailHead, destTop){ if(!destTop) return true; return tailHead.rank+1===destTop.rank; }
export { canDrop, top };

export function tryComplete(col, includeAces = false) {
  const minRank = includeAces ? 1 : 2;
  const expectedLength = 14 - minRank;
  if (col.length < expectedLength) return null;
  for (let i = col.length - 1; i >= 0; i--) {
    if (!col[i].faceUp) continue;
    const startCard = col[i];
    const suit = startCard.suit;
    let sequence = [startCard];
    let sequenceIndices = [i];
    for (let j = i - 1; j >= 0; j--) {
      const currentCard = col[j];
      const prevCard = sequence[sequence.length - 1];
      if (!currentCard.faceUp) { sequenceIndices.push(j); continue; }
      const isAsc = (currentCard.suit === suit && currentCard.rank === prevCard.rank + 1);
      const isDesc = (currentCard.suit === suit && currentCard.rank === prevCard.rank - 1);
      if (isAsc || isDesc) {
        sequence.push(currentCard);
        sequenceIndices.push(j);
        if ((includeAces && sequence.length === 13) || (!includeAces && sequence.length === 12)) {
          if (!includeAces && sequence.length === 12) {
            const ranks = sequence.map(c=>c.rank).sort((a,b)=>a-b);
            const isK2 = (ranks[0]===2 && ranks[11]===13);
            if (!isK2) break;
          }
          sequenceIndices.sort((a,b)=>b-a);
          const removed = [];
          for (const idx of sequenceIndices) removed.push(col.splice(idx,1)[0]);
          return removed;
        }
      } else break;
    }
  }
  return null;
}

function removeFromFoundations(cards){
  const set = new Set(cards.map(c=>c.id));
  state.foundationsCards = state.foundationsCards.filter(c=>!set.has(c.id));
}

export function completeTopRun(colIndex, includeAces = false){
  const col = state.tableau[colIndex];
  const rem = tryComplete(col, includeAces);
  if(!rem) return false;
  let turned = null;
  if(col.length && !top(col).faceUp){
    top(col).faceUp = true;
    turned = top(col);
  }
  state.foundationsCards.push(...rem);
  state.foundations++;
  state.history.push({t:'complete', col:colIndex, cards:rem, turned});
  state.score += 100;
  hooks.audio.fanfare();
  return true;
}

// ---- Game actions ----
export function newGame({difficulty=state.difficulty, seed=randSeed(), includeAces=state.includeAces}={}){
  const suitCount = difficulty === '1-suit' ? 1 : difficulty === '2-suit' ? 2 : 4;
  trackGameStart({ suitCount, seed, difficulty });

  state.difficulty=difficulty; 
  state.seed=seed; 
  state.includeAces = includeAces;
  state.rng=mulberry32(hashSeed(difficulty+':'+seed));
  const deck=createDeck(difficulty, includeAces); 
  shuffle(deck, state.rng);
  const deal=initialDeal(deck);
  state.tableau=deal.tableau; state.stock=deal.stock; state.dealsRemaining=5; state.foundations=0;
  state.moves=0; state.score=500; state.history=[]; state.redo=[]; state.message=''; state.hint=null; state.won=false;
  state.startTime=now(); state.elapsedMs=0; state.running=true; hooks.updateUI(); hooks.draw();
  lastTick = now();
  tick();
  saveGame();
}

export function dealRow(){ 
  if(state.dealsRemaining<=0 && state.stock.length > 0){ hooks.flashMsg('No deals left'); return false; }
  for(let c=0;c<10;c++){ if(state.tableau[c].length===0){ hooks.flashMsg('Fill empty columns before dealing'); return false; } }
  const dealt=[];
  const cardsToDeal = Math.min(state.stock.length, 10);
  const isFinalDeal = state.dealsRemaining === 1 && state.stock.length > 0 && state.stock.length < 10;
  if (isFinalDeal) {
    for(let c=0; c<state.stock.length; c++) {
      const card = state.stock.shift();
      card.faceUp = true;
      state.tableau[c].push(card);
      dealt.push(card);
    }
    state.dealsRemaining = 0;
  } else {
    for(let c=0; c<cardsToDeal; c++){
      const card = state.stock.shift();
      if(card) {
        card.faceUp = true;
        state.tableau[c].push(card);
        dealt.push(card);
      }
    }
    if (cardsToDeal === 10) state.dealsRemaining--;
  }
  state.history.push({t:'deal', dealt});
  state.redo=[];
  state.moves++;
  state.score=Math.max(0,state.score-1);

  updateActiveGame({ moves: state.moves, score: state.score, lastMove: new Date().toISOString() });
  for(let c=0;c<10;c++) completeTopRun(c, state.includeAces);
  hooks.updateUI();
  hooks.draw();
  saveGame();
  hooks.audio.shuffle();
  return true;
}

export function doMove(from, startIndex, to){ 
  if(from===to) return false; 
  const src=state.tableau[from], dst=state.tableau[to]; 
  const n=src.length; 
  if(startIndex<0||startIndex>=n) return false; 
  for(let i=n-1;i>startIndex;i--){ 
    const a=src[i], b=src[i-1]; 
    if(!(a.faceUp && b.faceUp && a.rank+1===b.rank && a.suit===b.suit)){ 
      hooks.audio.blip(200,0.05,'square',0.04); 
      hooks.flashMsg('Select a same-suit descending tail'); 
      return false; 
    } 
  }
  const moved=src.slice(startIndex); 
  if(!canDrop(moved[0], top(dst))){ 
    hooks.audio.blip(200,0.05,'square',0.04);
    hooks.flashMsg('Illegal move'); 
    return false; 
  }
  dst.push(...moved); 
  src.length=startIndex; 
  let turned=null; 
  if(src.length && !top(src).faceUp){ 
    top(src).faceUp=true; 
    turned=top(src); 
  }
  state.history.push({t:'move', from, to, moved:structuredClone(moved), turned}); 
  state.redo=[]; 
  state.moves++; 
  state.score=Math.max(0,state.score-1); 
  updateActiveGame({ moves: state.moves, score: state.score, lastMove: new Date().toISOString() });
  completeTopRun(to);
  completeTopRun(from);
  checkWin(); 
  hooks.updateUI(); 
  hooks.draw(); 
  saveGame(); 
  return true; 
}

export function undo(){ 
  const h=state.history.pop(); 
  if(!h) return;
  if(h.t==='complete'){
    const col=state.tableau[h.col];
    col.push(...h.cards);
    if(h.turned){
      const idx=col.findIndex(c=>c.id===h.turned.id);
      if(idx>=0) col[idx].faceUp=false;
    }
    removeFromFoundations(h.cards);
    state.foundations--;
    state.score -= 100;
    state.redo.push(h);
  }
  else if(h.t==='move'){
    const colFrom=state.tableau[h.from], colTo=state.tableau[h.to];
    const k=h.moved.length;
    colTo.splice(colTo.length-k,k);
    colFrom.push(...h.moved);
    if(h.turned){
      const idx=colFrom.findIndex(c=>c.id===h.turned.id);
      if(idx>=0) colFrom[idx].faceUp=false;
    }
    state.redo.push(h);
  }
  else if(h.t==='deal'){
    for(let i=9;i>=0;i--){
      const card=state.tableau[i].pop();
      card.faceUp=false;
      state.stock.unshift(card);
    }
    state.dealsRemaining++;
    state.redo.push(h);
  }
  state.moves++;
  updateActiveGame({ moves: state.moves, score: state.score, foundations: state.foundations, lastMove: new Date().toISOString() });
  hooks.draw();
  hooks.updateUI();
  saveGame();
}

export function redo(){ 
  const h=state.redo.pop(); 
  if(!h) return;
  if(h.t==='complete'){
    const col=state.tableau[h.col];
    col.splice(col.length-13,13);
    if(h.turned){
      const idx=col.findIndex(c=>c.id===h.turned.id);
      if(idx>=0) col[idx].faceUp=true;
    }
    state.foundationsCards.push(...h.cards);
    state.foundations++;
    state.score += 100;
    state.history.push(h);
  }
  else if(h.t==='move'){
    const colFrom=state.tableau[h.from], colTo=state.tableau[h.to];
    colFrom.splice(colFrom.length-h.moved.length, h.moved.length);
    colTo.push(...h.moved);
    if(h.turned){
      const idx=colFrom.findIndex(c=>c.id===h.turned.id);
      if(idx>=0) colFrom[idx].faceUp=true;
    }
    state.history.push(h);
  }
  else if(h.t==='deal'){
    for(let c=0;c<10;c++){
      const card=state.stock.shift();
      card.faceUp=true;
      state.tableau[c].push(card);
    }
    state.dealsRemaining--;
    state.history.push(h);
  }
  state.moves++;
  updateActiveGame({ moves: state.moves, score: state.score, foundations: state.foundations, lastMove: new Date().toISOString() });
  hooks.draw();
  hooks.updateUI();
  saveGame();
}

export function checkWin(){ 
  if(state.foundations===8){ 
    state.won=true; 
    state.running=false; 
    hooks.audio.chord(); 
    recordGameResult('win');
    hooks.showWin(); 
  } 
}

// ---- Persistence ----
const STORAGE_KEY='spider.v2.lastGame';
export function saveGame(){
  try{
    const payload={
      d:state.difficulty, s:state.seed, deals:state.dealsRemaining, f:state.foundations, m:state.moves, sc:state.score, t:state.elapsedMs,
      tab:state.tableau.map(col=>col.map(c=>({id:c.id,s:c.suit,r:c.rank,u:c.faceUp}))),
      stock:state.stock.map(c=>({id:c.id,s:c.suit,r:c.rank,u:c.faceUp})),
      fd:state.foundationsCards.map(c=>({id:c.id,s:c.suit,r:c.rank,u:c.faceUp}))
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }catch{}
}
export function loadGame(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY); if(!raw) return false; const p=JSON.parse(raw);
    state.difficulty=p.d; state.seed=p.s; state.rng=mulberry32(hashSeed(state.difficulty+':'+state.seed));
    state.dealsRemaining=p.deals; state.foundations=p.f; state.moves=p.m; state.score=p.sc; state.elapsedMs=p.t; state.running=true; state.won=false; state.history=[]; state.redo=[];
    state.tableau=p.tab.map(col=>col.map(o=>({id:o.id,suit:o.s,rank:o.r,faceUp:o.u})));
    state.stock=p.stock.map(o=>({id:o.id,suit:o.s,rank:o.r,faceUp:o.u}));
    state.foundationsCards=(p.fd||[]).map(o=>({id:o.id,suit:o.s,rank:o.r,faceUp:o.u}));
    hooks.updateUI(); hooks.draw(); return true;
  }catch{ return false; }
}

// ---- Scroll-independent timer ----
let lastTick=now();
function tick(){ if(state.running){ state.elapsedMs+=(now()-lastTick);} lastTick=now(); hooks.updateUI(); requestAnimationFrame(tick); }
export function startTick(){ lastTick = now(); requestAnimationFrame(tick); }

// ---- Hints (pure logic) ----
export function computeHint(){
  const hints = [];
  for(let from=0; from<10; from++) {
    const col = state.tableau[from];
    if(!col.length || !top(col).faceUp) continue;
    for(let start=0; start<col.length; start++) {
      if(!col[start].faceUp) continue;
      let ok = true;
      for(let i=col.length-1; i>start; i--) {
        const a = col[i], b = col[i-1];
        if(!(a.faceUp && b.faceUp && a.rank+1 === b.rank && a.suit === b.suit)) { ok=false; break; }
      }
      if(!ok) continue;
      const head = col[start];
      for(let to=0; to<10; to++) {
        if(to === from) continue;
        const destTop = top(state.tableau[to]);
        if(canDrop(head, destTop)) {
          let score = 0;
          const reasons = [];
          if(start > 0 && !col[start-1].faceUp) { score += 3; reasons.push('Reveals a hidden card'); }
          if(destTop && destTop.suit === head.suit && destTop.rank === head.rank+1) { score += 2; reasons.push('Builds same-suit sequence'); }
          if(col.length === start+1 && state.tableau[to].length === 0) { score += 2; reasons.push('Creates an empty column'); }
          hints.push({ from, start, to, score, cardCount: col.length - start, reasons: reasons.length ? reasons : ['Basic move'], headRank: head.rank, headSuit: head.suit });
        }
      }
    }
  }
  return hints.sort((a, b) => b.score - a.score || a.cardCount - b.cardCount);
}

// ---- Verification (returns data; UI decides how to display) ----
export function verifyInventory() {
  const loc = new Array(104).fill(null);
  const duplicates = [];
  const rankCounts = {};
  const suitCounts = {};
  const counts = { total: 0, tableau: 0, stock: 0, foundations: 0 };
  const place = (card, where) => { 
    if (loc[card.id] !== null) duplicates.push(card.id); 
    loc[card.id] = where; 
    counts.total++; 
    rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1; 
    suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1; 
  };
  for (const col of state.tableau) { for (const c of col) { place(c, 'T'); counts.tableau++; } }
  for (const c of state.stock) { place(c, 'S'); counts.stock++; }
  for (const c of state.foundationsCards) { place(c, 'F'); counts.foundations++; }
  const missing = []; for (let i = 0; i < loc.length; i++) { if (loc[i] === null) missing.push(i); }
  const expectedTotal = state.includeAces ? 104 : 96;
  const ok = duplicates.length === 0 && missing.length === 0 && counts.total === expectedTotal && counts.tableau + counts.stock + counts.foundations === expectedTotal;
  return { ok, duplicates, missing, counts, expectedTotal, includeAces: state.includeAces, notes: verificationNotes };
}

// ---- Formatting helpers & boot helpers ----
export function fmtTime(ms){ const s=Math.floor(ms/1000); const m=(s/60)|0; const ss=(s%60).toString().padStart(2,'0'); return `${m}:${ss}`; }
export function initFromURL(){ const url=new URL(location.href); const seed=url.searchParams.get('seed')||randSeed(); const diff=url.searchParams.get('difficulty')||'1-suit'; return {seed,difficulty:diff}; }
