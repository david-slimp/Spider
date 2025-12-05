/**
 * @file audio.js - Audio management system using Howler.js
 * @description Provides a comprehensive audio system for the Spider Solitaire game.
 * Implements audio playback, volume control, and mute functionality with fade effects.
 * Exports an AudioKit object with methods that match the original Web Audio API interface
 * for backward compatibility.
 * 
 * @module AudioKit
 * @requires howler
 */

/* global Howler, Howl */

/**
 * @constant {boolean} isHowlerAvailable - True if Howler.js is loaded
 * @private
 */
if (typeof Howl === 'undefined' || typeof Howler === 'undefined') {
  // eslint-disable-next-line no-console
  console.warn('[Audio] Howler.js not found. Include it before audio.js.');
}

/**
 * @constant {number} BASE_VOLUME - Default volume level (30%) - FIXME: should soon add a volume slider
 * @private
 */
const BASE_VOLUME = 0.3;

/**
 * @constant {number} FADE_MS - Duration of fade-out effect in milliseconds
 * @private
 */
const FADE_MS = 250;

/**
 * @constant {Object} scriptPath - Path to the current script
 * @private
 */
const scriptPath = document.currentScript ? document.currentScript.src : '';

/**
 * @constant {string} basePath - Base directory path for audio files
 * @private
 */
const basePath = scriptPath ? scriptPath.substring(0, scriptPath.lastIndexOf('/') + 1) : '';

/**
 * @constant {Object.<string, string>} SOUND_PATHS - Mapping of sound names to their file paths
 * @private
 */
const SOUND_PATHS = {
  click: basePath + 'audio/click_pickup.ogg',
  thud: basePath + 'audio/thud_place_card.ogg',
  deal: basePath + 'audio/deal_tableau.ogg',
  foundation: basePath + 'audio/foundation_powerup_gong_2s.ogg',
  shuffle: basePath + 'audio/shuffle_1s.ogg',
  win: basePath + 'audio/win_trumpet_clarion_2s.ogg',
  bad: basePath + 'audio/bad.ogg',
  undo: basePath + 'audio/undo.ogg'
};

/**
 * Creates a new Howl instance with default settings
 * @param {string} src - Source URL of the audio file
 * @returns {Howl|null} Configured Howl instance or null if Howl is not available
 * @private
 */
function mkHowl(src) {
  if (typeof Howl === 'undefined') return null;
  return new Howl({
    src: [src],
    volume: BASE_VOLUME,
    html5: false // use WebAudio when possible
  });
}

/**
 * @constant {Object.<string, Howl>} bank - Cache of preloaded Howl instances
 * @private
 */
const bank = {
  click: mkHowl(SOUND_PATHS.click),
  thud: mkHowl(SOUND_PATHS.thud),
  deal: mkHowl(SOUND_PATHS.deal),
  foundation: mkHowl(SOUND_PATHS.foundation),
  shuffle: mkHowl(SOUND_PATHS.shuffle),
  win: mkHowl(SOUND_PATHS.win),
  bad: mkHowl(SOUND_PATHS.bad),
  undo: mkHowl(SOUND_PATHS.undo)
};

/**
 * Schedules a fade-out effect for a playing sound
 * @param {Howl} sound - The Howl instance to apply fade to
 * @param {number} id - The sound instance ID from Howl.play()
 * @private
 */
function scheduleFade(sound, id) {
  if (!sound || typeof sound.duration !== 'function') return;
  // duration() returns seconds once loaded; if not ready yet, try shortly after
  const plan = () => {
    const dur = sound.duration(id);
    if (!dur || !isFinite(dur) || dur === 0) {
      // try again soon
      setTimeout(plan, 30);
      return;
    }
    const waitMs = Math.max(0, dur * 1000 - FADE_MS);
    setTimeout(() => {
      if (sound.playing(id)) {
        sound.fade(BASE_VOLUME, 0, FADE_MS, id);
      }
    }, waitMs);
  };
  plan();
}

/**
 * Safely plays a sound with error handling
 * @param {Howl} sound - The Howl instance to play
 * @returns {?number} Sound instance ID or null if playback failed
 * @private
 */
function safePlay(sound) {
  if (!sound || typeof sound.play !== 'function') return null;
  const id = sound.play();
  // Ensure per-id volume back to base in case previous fade set it low
  try { sound.volume(BASE_VOLUME, id); } catch {}
  scheduleFade(sound, id);
  return id;
}

/**
 * @type {boolean} muted - Current mute state
 * @private
 */
let muted = (typeof localStorage !== 'undefined' && localStorage.getItem('audioMuted') === 'true') || false;

// Initialize mute state
if (typeof Howler !== 'undefined') Howler.mute(muted);

/**
 * AudioKit - Main audio controller object
 * @namespace AudioKit
 * @property {Function} blip - Play invalid move sound (aliased to bad)
 * @property {Function} bad - Play bad move sound
 * @property {Function} click - Play click sound
 * @property {Function} thud - Play card placement sound
 * @property {Function} chord - Play foundation completion sound (aliased to foundation)
 * @property {Function} fanfare - Play win fanfare
 * @property {Function} shuffle - Play card shuffle sound
 * @property {Function} deal - Play card deal sound
 * @property {Function} undo - Play undo action sound
 * @property {Function} setMuted - Set mute state
 * @property {Function} isMuted - Check if audio is muted
 * @property {Function} resume - For Web Audio API compatibility (no-op)
 */
export const AudioKit = {
  // Keep the API used across the app
  blip: () => safePlay(bank.bad),  // Use bad sound for invalid moves
  bad: () => safePlay(bank.bad),   // Explicit bad sound method
  click: () => safePlay(bank.click),
  thud: () => safePlay(bank.thud),
  chord: () => safePlay(bank.foundation),
  fanfare: () => safePlay(bank.win),
  shuffle: () => safePlay(bank.shuffle),
  // Called when dealing: map to shuffle or deal as needed
  deal: () => safePlay(bank.deal),
  // Undo action sound
  undo: () => safePlay(bank.undo),

  /**
   * Sets the mute state for all sounds
   * @param {boolean} v - True to mute, false to unmute
   * @memberof AudioKit
   */
  setMuted(v) {
    muted = !!v;
    if (typeof Howler !== 'undefined') Howler.mute(muted);
    try {
      localStorage.setItem('audioMuted', String(muted));
    } catch {}
    const btn = document.getElementById('muteBtn');
    if (btn) btn.textContent = muted ? '🔇' : '🔊';
  },
  
  /**
   * Checks if audio is currently muted
   * @returns {boolean} True if audio is muted
   * @memberof AudioKit
   */
  isMuted() { return !!muted; },
  
  /**
   * For Web Audio API compatibility (no-op in this implementation)
   * @memberof AudioKit
   */
  resume() { /* not needed with Howler; keep for compat */ }
};

/**
 * Expose AudioKit globally for debugging purposes
 * @global
 */
if (typeof window !== 'undefined') {
  window.AudioKit = AudioKit;
}
