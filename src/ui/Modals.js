/**
 * Modals Component for Word Dominion.
 * Renders Challenge, Searchable Used Words, Victory Game Over, Settings, Career Stats, and How to Play modals.
 */

import { settings } from '../logic/SettingsEngine.js';
import { statsEngine } from '../logic/StatsEngine.js';
import { soundEngine } from '../audio/SoundEngine.js';

export class ModalsManager {
  constructor(container, callbacks) {
    this.container = container;
    this.callbacks = callbacks;
    // Callbacks: { onRematch, onReturnHome, onSettingsChanged }
  }

  showChallengeModal(challengeInfo, onResolve) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card challenge-box">
        <div style="font-size: 14px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">
          CHALLENGE OPPORTUNITY
        </div>

        <div style="font-size: 16px; font-weight: 700;">
          <strong>${challengeInfo.declaringPlayer}</strong> declared:
        </div>

        <div class="challenge-word-badge">${challengeInfo.word}</div>
        <div style="font-size: 14px; font-weight: 700; color: var(--accent-gold);">+${challengeInfo.score} PTS</div>

        <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">
          Do you believe this word exists in the English dictionary?
        </div>

        <div class="challenge-actions">
          <button class="btn-primary btn-accept" id="btn-challenge-accept">✔ ACCEPT</button>
          <button class="btn-primary btn-challenge" id="btn-challenge-reject">⚠ CHALLENGE</button>
        </div>
      </div>
    `;

    this.container.appendChild(overlay);

    document.getElementById('btn-challenge-accept').addEventListener('click', () => {
      soundEngine.playButtonClick();
      overlay.remove();
      onResolve(false); // Accepted
    });

    document.getElementById('btn-challenge-reject').addEventListener('click', () => {
      soundEngine.playChallengeAlert();
      overlay.remove();
      onResolve(true); // Challenged!
    });
  }

  showUsedWordsModal(usedWords) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h2 class="modal-title">📖 Used Words (${usedWords.length})</h2>
          <span class="modal-close-icon" id="modal-close">✖</span>
        </div>

        <input type="text" class="used-words-search" id="used-words-search" placeholder="Search declared words..." />

        <div class="used-words-list" id="used-words-list">
          ${this.renderUsedWordsItems(usedWords, '')}
        </div>
      </div>
    `;

    this.container.appendChild(overlay);

    const searchInput = document.getElementById('used-words-search');
    const listContainer = document.getElementById('used-words-list');

    searchInput.addEventListener('input', (e) => {
      listContainer.innerHTML = this.renderUsedWordsItems(usedWords, e.target.value);
    });

    document.getElementById('modal-close').addEventListener('click', () => {
      soundEngine.playButtonClick();
      overlay.remove();
    });
  }

  renderUsedWordsItems(usedWords, query) {
    if (!usedWords || usedWords.length === 0) {
      return `<div style="text-align: center; color: var(--text-muted); padding: 20px;">No words scored yet.</div>`;
    }

    const filtered = usedWords.filter(w => w.word.toLowerCase().includes(query.toLowerCase()));
    if (filtered.length === 0) {
      return `<div style="text-align: center; color: var(--text-muted); padding: 20px;">No matching words found.</div>`;
    }

    return filtered.map(w => `
      <div class="used-word-item ${w.playerId === 2 ? 'p2' : ''}">
        <div style="flex: 1; padding-right: 12px;">
          <div class="used-word-text">${w.word}</div>
          <div class="used-word-def">"${w.definition || 'A valid English dictionary word.'}"</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Declared by ${w.playerName} (Turn ${w.turn})</div>
        </div>
        <div class="used-word-score">+${w.score}</div>
      </div>
    `).join('');
  }

  showGameOverModal(summary) {
    soundEngine.playVictory();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="game-over-hero">
          <div class="winner-crown">🏆</div>
          <h2 class="winner-title">${summary.isDraw ? "IT'S A DRAW!" : `${summary.winner.name} WINS!`}</h2>
          <p style="font-size: 14px; color: var(--text-muted);">Match Completed</p>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-label">Final Score</span>
            <span class="stat-value" style="color: var(--accent-gold);">${summary.p1Score} - ${summary.p2Score}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Total Turns</span>
            <span class="stat-value">${summary.totalTurns}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Words Scored</span>
            <span class="stat-value">${summary.totalWordsFound}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Accuracy</span>
            <span class="stat-value" style="color: var(--accent-green);">${summary.accuracy}</span>
          </div>
          <div class="stat-card" style="grid-column: span 2;">
            <span class="stat-label">Longest Word</span>
            <span class="stat-value" style="color: var(--p1-color);">${summary.longestWord}</span>
          </div>
          <div class="stat-card" style="grid-column: span 2;">
            <span class="stat-label">Highest Scoring Word</span>
            <span class="stat-value" style="color: var(--p2-color);">${summary.highestScoringWord}</span>
          </div>
        </div>

        <div style="display: flex; gap: 12px; margin-top: 8px;">
          <button class="btn-primary" id="btn-rematch" style="flex: 1;">🔄 REMATCH</button>
          <button class="btn-secondary" id="btn-home" style="flex: 1;">🏠 HOME</button>
        </div>
      </div>
    `;

    this.container.appendChild(overlay);

    document.getElementById('btn-rematch').addEventListener('click', () => {
      soundEngine.playButtonClick();
      overlay.remove();
      this.callbacks.onRematch();
    });

    document.getElementById('btn-home').addEventListener('click', () => {
      soundEngine.playButtonClick();
      overlay.remove();
      this.callbacks.onReturnHome();
    });
  }

  showSettingsModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h2 class="modal-title">⚙️ Settings</h2>
          <span class="modal-close-icon" id="modal-close">✖</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div class="setting-row">
            <span class="setting-label">Sound Effects</span>
            <div class="toggle-switch ${settings.get('soundEnabled') ? 'active' : ''}" id="toggle-sound">
              <div class="toggle-handle"></div>
            </div>
          </div>

          <div class="setting-row">
            <span class="setting-label">Haptic Feedback</span>
            <div class="toggle-switch ${settings.get('hapticsEnabled') ? 'active' : ''}" id="toggle-haptics">
              <div class="toggle-handle"></div>
            </div>
          </div>

          <div class="setting-row">
            <span class="setting-label">Challenge Mode</span>
            <div class="toggle-switch ${settings.get('challengeMode') ? 'active' : ''}" id="toggle-challenge">
              <div class="toggle-handle"></div>
            </div>
          </div>

          <div class="setting-row">
            <span class="setting-label">High Contrast Theme</span>
            <div class="toggle-switch ${settings.get('highContrast') ? 'active' : ''}" id="toggle-contrast">
              <div class="toggle-handle"></div>
            </div>
          </div>

          <div class="setting-row">
            <span class="setting-label">Colorblind Safe Palette</span>
            <div class="toggle-switch ${settings.get('colorblindMode') ? 'active' : ''}" id="toggle-colorblind">
              <div class="toggle-handle"></div>
            </div>
          </div>

          <div class="setting-row">
            <span class="setting-label">AI Difficulty</span>
            <select id="select-ai-diff" style="padding: 6px 12px; border-radius: 8px; background: rgba(255,255,255,0.1); color: white; border: 1px solid var(--bg-card-border);">
              <option value="easy" ${settings.get('aiDifficulty') === 'easy' ? 'selected' : ''}>Easy</option>
              <option value="medium" ${settings.get('aiDifficulty') === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="hard" ${settings.get('aiDifficulty') === 'hard' ? 'selected' : ''}>Hard</option>
              <option value="expert" ${settings.get('aiDifficulty') === 'expert' ? 'selected' : ''}>Expert</option>
            </select>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(overlay);

    const bindToggle = (id, key) => {
      const el = document.getElementById(id);
      el.addEventListener('click', () => {
        soundEngine.playButtonClick();
        const newVal = !settings.get(key);
        settings.set(key, newVal);
        el.classList.toggle('active', newVal);
        this.callbacks.onSettingsChanged();
      });
    };

    bindToggle('toggle-sound', 'soundEnabled');
    bindToggle('toggle-haptics', 'hapticsEnabled');
    bindToggle('toggle-challenge', 'challengeMode');
    bindToggle('toggle-contrast', 'highContrast');
    bindToggle('toggle-colorblind', 'colorblindMode');

    document.getElementById('select-ai-diff').addEventListener('change', (e) => {
      soundEngine.playButtonClick();
      settings.set('aiDifficulty', e.target.value);
      this.callbacks.onSettingsChanged();
    });

    document.getElementById('modal-close').addEventListener('click', () => {
      soundEngine.playButtonClick();
      overlay.remove();
    });
  }

  showStatsModal() {
    const stats = statsEngine.stats;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h2 class="modal-title">🏆 Career Statistics</h2>
          <span class="modal-close-icon" id="modal-close">✖</span>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-label">Games Played</span>
            <span class="stat-value">${stats.gamesPlayed}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Win Rate</span>
            <span class="stat-value" style="color: var(--accent-green);">${statsEngine.getWinRate()}%</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Wins</span>
            <span class="stat-value" style="color: var(--p1-color);">${stats.wins}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Losses / Draws</span>
            <span class="stat-value">${stats.losses} / ${stats.draws}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Highest Score</span>
            <span class="stat-value" style="color: var(--accent-gold);">${stats.highestScore}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Total Words</span>
            <span class="stat-value">${stats.totalWordsCreated}</span>
          </div>
          <div class="stat-card" style="grid-column: span 2;">
            <span class="stat-label">Longest Word Scored</span>
            <span class="stat-value" style="color: var(--p2-color);">${stats.longestWord || 'N/A'}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Avg Word Length</span>
            <span class="stat-value">${statsEngine.getAverageWordLength()}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Favorite Letter</span>
            <span class="stat-value" style="color: var(--p1-color);">${statsEngine.getFavoriteLetter()}</span>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(overlay);

    document.getElementById('modal-close').addEventListener('click', () => {
      soundEngine.playButtonClick();
      overlay.remove();
    });
  }

  showHowToPlayModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h2 class="modal-title">❓ How to Play</h2>
          <span class="modal-close-icon" id="modal-close">✖</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 14px; font-size: 14px; line-height: 1.5;">
          <div>
            <strong style="color: var(--p1-color);">1. Core Concept:</strong><br/>
            Two players share one 8×8 empty board. Players alternate turns placing exactly 1 letter anywhere on the board.
          </div>
          <div>
            <strong style="color: var(--p1-color);">2. Placing Letters:</strong><br/>
            Tap any empty cell to open the custom in-game A-Z keyboard and select a letter.
          </div>
          <div>
            <strong style="color: var(--p1-color);">3. Declaring Words:</strong><br/>
            Tap the START letter, then tap the END letter. The word path MUST be straight <strong>Left→Right</strong> or <strong>Top→Bottom</strong> and MUST contain your newly placed letter!
          </div>
          <div>
            <strong style="color: var(--p1-color);">4. Scoring & Rules:</strong><br/>
            Score = <strong>Word Length × 10</strong>. Words score ONLY ONCE per match! Duplicate declared words yield "Already Used".
          </div>
          <div>
            <strong style="color: var(--p1-color);">5. Challenge Feature:</strong><br/>
            When opponent confirms a word, you can Challenge if you think the word is invalid. Successful challenges reject the word!
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(overlay);

    document.getElementById('modal-close').addEventListener('click', () => {
      soundEngine.playButtonClick();
      overlay.remove();
    });
  }
}
