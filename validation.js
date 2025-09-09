/**
 * @file validation.js - Card game validation and verification utilities
 * @description Provides comprehensive validation for the Spider Solitaire game state,
 * including card inventory checks, suit/rank distribution verification, and game rule
 * enforcement. Used for debugging and ensuring game integrity.
 * 
 * @module validation
 * @requires ./logic.js
 */

import { state, getVerificationNotes } from './logic.js';

/**
 * Verifies the game state against expected invariants and rules.
 * 
 * Performs the following validations:
 * - Total card count matches expected value (104 with Aces, 96 without)
 * - No duplicate card IDs exist
 * - Suit distribution matches game difficulty (1, 2, or 4 suits)
 * - Rank distribution is correct (8 of each rank, with Aces excluded if configured)
 * - dealsRemaining is consistent with stock count
 * - Foundation card counts match completed sets
 * - Tableau columns have face-up top cards
 * 
 * @returns {Object} Validation results containing:
 * @returns {boolean} ok - True if all validations passed
 * @returns {Array<string>} duplicates - List of duplicate card IDs found
 * @returns {Array<string>} missing - List of missing card IDs (empty in current implementation)
 * @returns {Object} counts - Counts of cards in different game areas
 * @returns {number} expectedTotal - Expected total number of cards in the game
 * @returns {boolean} includeAces - Whether Aces are included in the game
 * @returns {Array<string>} notes - Detailed validation messages and results
 * 
 * @example
 * const { ok, notes } = verifyInventory();
 * if (!ok) console.warn('Validation failed:', notes.join('\n'));
 */
export function verifyInventory() {
  // Initialize tracking objects
  /** @type {{total: number, tableau: number, stock: number, foundations: number}} */
  const counts = { total: 0, tableau: 0, stock: 0, foundations: 0 };
  /** @type {Set<string>} Tracks seen card IDs to detect duplicates */
  const seen = new Set();
  /** @type {string[]} List of duplicate card IDs found */
  const duplicates = [];
  /** @type {Object.<string, number>} Count of cards per suit */
  const suitCounts = {};
  /** @type {Object.<number, number>} Count of cards per rank */
  const rankCounts = {};

  /**
   * Tracks a card's presence in the game state
   * @param {Object} card - The card object to track
   * @param {'T'|'S'|'F'} where - Location code: 'T' for Tableau, 'S' for Stock, 'F' for Foundations
   * @private
   */
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

  // Calculate expected game constants based on rules
  /** @const {boolean} includeAces - Whether Aces are included in the game */
  const includeAces = !!state.includeAces;
  /** @const {number} expectedTotal - Total cards expected (104 with Aces, 96 without) */
  const expectedTotal = includeAces ? 104 : 96;
  /** @const {number} runLen - Length of a complete run (13 with Aces, 12 without) */
  const runLen = includeAces ? 13 : 12;

  // Normalize difficulty label for internal use
  /** @const {'1-suit'|'2-suit'|'4-suit'} diff - Normalized difficulty level */
  const diff = typeof state.difficulty === 'string' && state.difficulty.endsWith('suit') 
    ? state.difficulty 
    : state.difficulty === '1' ? '1-suit'
    : state.difficulty === '2' ? '2-suit'
    : '4-suit'; // Default to 4-suit for any other value

  /**
   * Calculate expected cards per suit based on game difficulty
   * @returns {Object} Expected counts per suit configuration
   * @property {number} [anyOneSuit] - For 1-suit games
   * @property {number} [twoSuits] - For 2-suit games (per suit)
   * @property {number} [fourSuits] - For 4-suit games (per suit)
   * @private
   */
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

  // Initialize validation results
  /** @type {string[]} notes - Informational messages about validation */
  const notes = [...getVerificationNotes()];
  /** @type {string[]} issues - Validation problems found */
  const issues = [];

  // 1) Check total card count
  if (counts.total !== expectedTotal) {
    issues.push(`Total card count ${counts.total} ≠ expected ${expectedTotal}`);
  } else {
    notes.push(`✓ Total cards: ${counts.total}`);
  }

  // 2) Check for duplicate card IDs
  if (duplicates.length > 0) {
    const list = duplicates.slice(0, 10).join(', ') + (duplicates.length > 10 ? '…' : '');
    issues.push(`Duplicate card IDs detected: ${list}`);
  } else {
    notes.push('✓ No duplicate card IDs found');
  }

  // 3) Verify suit distribution matches difficulty level
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

  // 4) Verify rank distribution (should be 8 of each rank)
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

  // 5) Verify dealsRemaining is consistent with stock count
  const expectedDeals = Math.ceil(counts.stock / 10); // 50→5, 40→4, 9→1, 0→0
  if (state.dealsRemaining !== expectedDeals) {
    issues.push(`dealsRemaining ${state.dealsRemaining} ≠ expected ${expectedDeals} for stock ${counts.stock}`);
  } else {
    notes.push(`✓ dealsRemaining consistent with stock (${counts.stock} → ${expectedDeals})`);
  }

  // 6) Verify foundation card counts match completed sets
  const expectedFoundationCards = state.foundations * runLen;
  if (counts.foundations !== expectedFoundationCards) {
    issues.push(`Foundations card count ${counts.foundations} ≠ foundations(${state.foundations}) × runLen(${runLen}) = ${expectedFoundationCards}`);
  } else {
    notes.push(`✓ Foundations size OK (${state.foundations} × ${runLen} = ${counts.foundations})`);
  }

  // 7) Verify all tableau columns have face-up top cards
  for (let i = 0; i < state.tableau.length; i++) {
    const col = state.tableau[i];
    if (col.length > 0 && !col[col.length - 1].faceUp) {
      issues.push(`Tableau column ${i+1}: top card is face-down`);
    }
  }
  if (!issues.some(s => s.startsWith('Tableau column'))) {
    notes.push('✓ Tableau tops are face-up');
  }

  // Maintained for backward compatibility with old API
  /** @const {string[]} missing - Always empty, maintained for API compatibility */
  const missing = [];

  /** @const {boolean} ok - True if no validation issues were found */
  const ok = issues.length === 0;

  // Format the results
  notes.unshift(ok ? 'All invariants satisfied.' : 'Invariants failed: see issues below.');
  if (issues.length) {
    notes.push('— Issues —');
    issues.forEach(issue => notes.push(`• ${issue}`));
  }

  return {
    ok,
    duplicates,
    missing,
    counts,
    expectedTotal,
    includeAces,
    notes,
    // Add a summary property for quick checking
    summary: ok ? 'Validation passed' : `Found ${issues.length} issues`
  };
}
