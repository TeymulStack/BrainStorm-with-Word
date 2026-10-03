/**
 * Settings Engine for Word Dominion.
 * Manages user preferences with LocalStorage persistence.
 */

const DEFAULT_SETTINGS = {
  soundEnabled: true,
  musicEnabled: true,
  hapticsEnabled: true,
  challengeMode: true,
  undoConfirm: false,
  aiDifficulty: 'medium', // 'easy', 'medium', 'hard', 'expert'
  theme: 'dark', // 'dark', 'wood', 'neon'
  highContrast: false,
  colorblindMode: false,
  largeText: false,
};

const SETTINGS_KEY = 'word_dominion_settings';

class SettingsEngine {
  constructor() {
    this.settings = this.loadSettings();
  }

  loadSettings() {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load settings from LocalStorage', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save settings to LocalStorage', e);
    }
  }

  get(key) {
    return this.settings[key];
  }

  set(key, value) {
    this.settings[key] = value;
    this.saveSettings();
  }

  reset() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
  }
}

export const settings = new SettingsEngine();
