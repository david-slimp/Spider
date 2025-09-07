// validation.js
import { state, getVerificationNotes } from './logic.js';

// ---- Verification (returns data; UI decides how to display) ----
// Stronger invariants, Ace-exclusion aware, and no false negatives from "missing IDs".
export function verifyInventory() {
  // Gather all cards
  const counts = { total: 0, tableau: 0, stock: 0, foundations: 0 };
  const seen = new Set();
  const duplicates = [];
  const suitCounts = {};
  const rankCounts = {};

  const place = (card, where) => {
    if (!card) return;
    if (seen.has(card.id)) duplicates.push(card.id);
    else seen.add(card.id);

    counts.total++;
    if (where === 'T') counts.tableau++;
    else if (where === 'S') counts.stock++;
    else if (where === 'F') counts.foundations++;

    suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
  };

  for (const col of state.tableau) for (const c of col) place(c, 'T');
  for (const c of state.stock) place(c, 'S');
  for (const c of state.foundationsCards) place(c, 'F');

  // Expected totals
  const includeAces = !!state.includeAces;
  const expectedTotal = includeAces ? 104 : 96;
  const runLen = includeAces ? 13 : 12;

  // Normalize difficulty label
  const diff = state.difficulty === '1' ? '1-suit'
             : state.difficulty === '2' ? '2-suit'
             : state.difficulty;

  // Expected per-suit counts based on your deck construction
  const expectedPerSuit = (() => {
    if (diff === '1-suit') {
      const n = includeAces ? 8 * 13 : 8 * 12; // 104 or 96
      return { anyOneSuit: n };
    } else if (diff === '2-suit') {
      const perSuit = includeAces ? 4 * 13 : 4 * 12; // 52 or 48 each
      return { twoSuits: perSuit };
    } else {
      const perSuit = includeAces ? 2 * 13 : 2 * 12; // 26 or 24 each
      return { fourSuits: perSuit };
    }
  })();

  // Invariants to check and report
  const notes = [...getVerificationNotes()];
  const issues = [];

  // 0) Totals
  if (counts.total !== expectedTotal) {
    issues.push(`Total card count ${counts.total} ≠ expected ${expectedTotal}`);
  } else {
    notes.push(`✓ Total cards: ${counts.total}`);
  }

  // 1) Duplicates
  if (duplicates.length > 0) {
    const list = duplicates.slice(0, 10).join(', ') + (duplicates.length > 10 ? '…' : '');
    issues.push(`Duplicate card IDs detected: ${list}`);
  } else {
    notes.push('✓ No duplicate card IDs found');
  }

  // 2) Suit distribution
  const suitKeys = Object.keys(suitCounts);
  const suitSummary = suitKeys.map(s => `${s}:${suitCounts[s]}`).join(', ');
  if (diff === '1-suit') {
    if (suitKeys.length !== 1) {
      issues.push(`Expected 1 suit, found ${suitKeys.length} (${suitSummary})`);
    } else if ((suitCounts[suitKeys[0]] || 0) !== expectedPerSuit.anyOneSuit) {
      issues.push(`1-suit count ${suitCounts[suitKeys[0]] || 0} ≠ expected ${expectedPerSuit.anyOneSuit}`);
    } else notes.push(`✓ Suit distribution OK (1 suit: ${suitSummary})`);
  } else if (diff === '2-suit') {
    if (suitKeys.length !== 2) {
      issues.push(`Expected 2 suits, found ${suitKeys.length} (${suitSummary})`);
    } else if (!suitKeys.every(s => suitCounts[s] === expectedPerSuit.twoSuits)) {
      issues.push(`2-suit counts not equal to ${expectedPerSuit.twoSuits} each (${suitSummary})`);
    } else notes.push(`✓ Suit distribution OK (2 suits: ${suitSummary})`);
  } else {
    if (suitKeys.length !== 4) {
      issues.push(`Expected 4 suits, found ${suitKeys.length} (${suitSummary})`);
    } else if (!suitKeys.every(s => suitCounts[s] === expectedPerSuit.fourSuits)) {
      issues.push(`4-suit counts not equal to ${expectedPerSuit.fourSuits} each (${suitSummary})`);
    } else notes.push(`✓ Suit distribution OK (4 suits: ${suitSummary})`);
  }

  // 3) Rank distribution (cross-suit)
  // Each kept rank appears 8 times total. If Aces excluded, rank 1 must be 0.
  const expectedPerRank = 8;
  for (let r = 2; r <= 13; r++) {
    if ((rankCounts[r] || 0) !== expectedPerRank) {
      issues.push(`Rank ${r} count ${(rankCounts[r] || 0)} ≠ expected ${expectedPerRank}`);
    }
  }
  const aces = rankCounts[1] || 0;
  if (includeAces ? aces !== 8 : aces !== 0) {
    issues.push(`Ace (1) count ${aces} ${includeAces ? '≠ expected 8' : 'should be 0 when Aces are excluded'}`);
  } else {
    notes.push('✓ Rank distribution OK');
  }

  // 4) dealsRemaining logic
  const expectedDeals = Math.ceil(counts.stock / 10); // 50→5, 40→4, 9→1, 0→0
  if (state.dealsRemaining !== expectedDeals) {
    issues.push(`dealsRemaining ${state.dealsRemaining} ≠ expected ${expectedDeals} for stock ${counts.stock}`);
  } else {
    notes.push(`✓ dealsRemaining consistent with stock (${counts.stock} → ${expectedDeals})`);
  }

  // 5) Foundations consistency (multiple of run length)
  const expectedFoundationCards = state.foundations * runLen;
  if (counts.foundations !== expectedFoundationCards) {
    issues.push(`Foundations card count ${counts.foundations} ≠ foundations(${state.foundations}) × runLen(${runLen}) = ${expectedFoundationCards}`);
  } else {
    notes.push(`✓ Foundations size OK (${state.foundations} × ${runLen} = ${counts.foundations})`);
  }

  // 6) Tableau tops must be face-up (when non-empty)
  for (let i = 0; i < state.tableau.length; i++) {
    const col = state.tableau[i];
    if (col.length > 0 && !col[col.length - 1].faceUp) {
      issues.push(`Tableau column ${i+1}: top card is face-down`);
    }
  }
  if (!issues.some(s => s.startsWith('Tableau column'))) {
    notes.push('✓ Tableau tops are face-up');
  }

  // Old API had "missing" IDs; not meaningful with Ace removal, so keep empty.
  const missing = [];

  const ok = issues.length === 0;

  // Summary line first
  notes.unshift(ok ? 'All invariants satisfied.' : 'Invariants failed: see issues below.');
  if (issues.length) {
    notes.push('— Issues —');
    for (const s of issues) notes.push('• ' + s);
  }

  return { ok, duplicates, missing, counts, expectedTotal, includeAces, notes };
}
