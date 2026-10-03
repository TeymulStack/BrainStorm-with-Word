/**
 * Game Screen View Component for Word Dominion.
 * Renders header, 8x8 interactive board grid, path highlights, custom keyboard, and action bar.
 */

import { PHASES } from '../logic/GameEngine.js';
import { soundEngine } from '../audio/SoundEngine.js';

export class GameScreen {
  constructor(engine, callbacks) {
    this.engine = engine;
    this.callbacks = callbacks;
    // Callbacks: { onOpenUsedWords, onFinishGame, onOpenSettings, showToast, spawnScoreParticles }
  }

  render(container) {
    container.innerHTML = `
      <div class="game-screen">
        <!-- Header Player Cards & Turn Badge -->
        <div class="game-header">
          <div class="player-card glass-card p1 ${this.engine.activePlayerIndex === 0 ? 'active' : ''}" id="p1-card">
            <div class="player-avatar">${this.engine.players[0].avatar}</div>
            <div class="player-meta">
              <span class="player-name">${this.engine.players[0].name}</span>
              <span class="player-score" id="p1-score">${this.engine.players[0].score}</span>
            </div>
          </div>

          <div class="turn-badge">
            <span class="turn-label">TURN</span>
            <span class="turn-number" id="turn-number">${this.engine.turn}</span>
          </div>

          <div class="player-card glass-card p2 ${this.engine.activePlayerIndex === 1 ? 'active' : ''}" id="p2-card">
            <div class="player-avatar">${this.engine.players[1].avatar}</div>
            <div class="player-meta">
              <span class="player-name">${this.engine.players[1].name}</span>
              <span class="player-score" id="p2-score">${this.engine.players[1].score}</span>
            </div>
          </div>

          <button class="icon-btn" id="game-settings-btn" style="width: 38px; height: 38px; font-size: 16px;">⚙️</button>
        </div>

        <!-- Floating Word Banner & AI Thinking Indicator -->
        <div class="word-banner-container" id="word-banner-container">
          ${this.renderWordBanner()}
        </div>

        <!-- 8x8 Board Container -->
        <div class="board-container">
          <div class="board-grid" id="board-grid">
            ${this.renderBoardCells()}
          </div>
        </div>

        <!-- Custom Keyboard Drawer (Conditional) -->
        <div id="keyboard-drawer-mount">
          ${this.renderKeyboardDrawer()}
        </div>

        <!-- Action Control Bar -->
        <div class="action-bar">
          <button class="action-btn" id="btn-pass">
            <span class="action-icon">⏭️</span>
            <span>PASS</span>
          </button>
          <button class="action-btn" id="btn-undo" ${!this.engine.undoSnapshot ? 'disabled' : ''}>
            <span class="action-icon">↩️</span>
            <span>UNDO</span>
          </button>
          <button class="action-btn" id="btn-used-words">
            <span class="action-icon">📖</span>
            <span>WORDS</span>
          </button>
          <button class="action-btn" id="btn-finish">
            <span class="action-icon">🏁</span>
            <span>FINISH</span>
          </button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderWordBanner() {
    // Show definition banner if a word was recently scored
    if (this.engine.lastScoredWord) {
      const { word, definition, score, playerName } = this.engine.lastScoredWord;
      return `
        <div class="scored-definition-banner">
          <div class="banner-word">${word}</div>
          <div class="banner-definition">"${definition}"</div>
          <div class="banner-score">+${score} PTS (${playerName})</div>
        </div>
      `;
    }

    if (this.engine.activePlayer.isAI && this.engine.phase !== PHASES.GAME_OVER) {
      return `
        <div class="ai-thinking-card">
          <span>🤖 AI is thinking...</span>
        </div>
      `;
    }

    if (this.engine.currentDeclaredWord) {
      const word = this.engine.currentDeclaredWord;
      const score = word.length * 10;
      return `
        <div class="word-preview-card">
          <span class="preview-word">${word}</span>
          <span class="preview-score">+${score} PTS</span>
          <button class="btn-primary confirm-btn" id="btn-confirm-word" style="padding: 6px 14px; font-size: 12px; margin-left: 8px;">CONFIRM</button>
        </div>
      `;
    }

    if (this.engine.phase === PHASES.TILE_PLACED) {
      return `
        <div style="font-size: 13px; font-weight: 700; color: var(--text-muted); text-align: center;">
          Tap <strong>START cell</strong> to declare a word, or press <strong>PASS</strong>
        </div>
      `;
    }

    if (this.engine.phase === PHASES.WORD_DECLARING) {
      return `
        <div style="font-size: 13px; font-weight: 700; color: var(--text-muted); text-align: center;">
          Tap <strong>END cell</strong> (Left→Right or Top→Bottom)
        </div>
      `;
    }

    return `
      <div style="font-size: 13px; font-weight: 700; color: var(--text-muted); text-align: center;">
        Tap any empty square to place a letter
      </div>
    `;
  }

  renderBoardCells() {
    let html = '';
    const pathCells = new Set(this.engine.currentDeclaredPath.map(c => `${c.row},${c.col}`));

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = this.engine.board[r][c];
        const isFilled = Boolean(cell.letter);
        const isPath = pathCells.has(`${r},${c}`);
        const isNewlyPlaced = this.engine.lastPlacedCell &&
          this.engine.lastPlacedCell.row === r &&
          this.engine.lastPlacedCell.col === c;

        let classes = 'board-cell';
        if (isFilled) classes += ' filled';
        if (cell.owner === 1) classes += ' owner-1';
        if (cell.owner === 2) classes += ' owner-2';
        if (cell.isScored) classes += ' scored';
        if (isNewlyPlaced) classes += ' newly-placed';
        if (isPath) classes += ' selected-path';

        html += `
          <div class="${classes}" data-row="${r}" data-col="${c}">
            ${cell.letter || ''}
          </div>
        `;
      }
    }
    return html;
  }

  renderKeyboardDrawer() {
    if (this.engine.phase !== PHASES.KEYBOARD_OPEN) return '';

    const rows = [
      ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      ['H', 'I', 'J', 'K', 'L', 'M', 'N'],
      ['O', 'P', 'Q', 'R', 'S', 'T', 'U'],
      ['V', 'W', 'X', 'Y', 'Z']
    ];

    let rowsHtml = '';
    rows.forEach(row => {
      rowsHtml += '<div class="keyboard-row">';
      row.forEach(char => {
        rowsHtml += `<div class="key-tile" data-letter="${char}">${char}</div>`;
      });
      rowsHtml += '</div>';
    });

    return `
      <div class="keyboard-drawer">
        <div class="keyboard-header">
          <span class="keyboard-title">SELECT A LETTER TO PLACE</span>
          <span class="keyboard-close-btn" id="kb-close">✖</span>
        </div>
        ${rowsHtml}
      </div>
    `;
  }

  bindEvents() {
    // Cell clicks
    const boardEl = document.getElementById('board-grid');
    if (boardEl) {
      boardEl.addEventListener('click', (e) => {
        const cellEl = e.target.closest('.board-cell');
        if (!cellEl) return;

        const row = parseInt(cellEl.dataset.row, 10);
        const col = parseInt(cellEl.dataset.col, 10);

        if (this.engine.phase === PHASES.WAITING_PLACEMENT) {
          if (this.engine.selectGridCell(row, col)) {
            soundEngine.playButtonClick();
            this.updateUI();
          }
        } else if (this.engine.phase === PHASES.TILE_PLACED) {
          if (this.engine.setWordStart(row, col)) {
            soundEngine.playButtonClick();
            this.updateUI();
          }
        } else if (this.engine.phase === PHASES.WORD_DECLARING) {
          if (this.engine.setWordEnd(row, col)) {
            soundEngine.playButtonClick();
            this.updateUI();
          } else {
            // Invalid selection path (e.g. diagonal/reverse/no placed tile)
            soundEngine.playError();
            this.callbacks.showToast('Invalid path! Word must be Left→Right or Top→Bottom and contain placed letter', 'error');
            this.engine.cancelWordSelection();
            this.updateUI();
          }
        }
      });
    }

    // Keyboard letter clicks
    const kbDrawer = document.getElementById('keyboard-drawer-mount');
    if (kbDrawer) {
      kbDrawer.addEventListener('click', (e) => {
        const keyEl = e.target.closest('.key-tile');
        if (keyEl) {
          const letter = keyEl.dataset.letter;
          if (this.engine.placeLetter(letter)) {
            soundEngine.playTilePlacement();
            this.updateUI();
          }
        } else if (e.target.id === 'kb-close') {
          soundEngine.playButtonClick();
          this.engine.cancelKeyboard();
          this.updateUI();
        }
      });
    }

    // Action bar buttons
    document.getElementById('btn-pass').addEventListener('click', () => {
      soundEngine.playButtonClick();
      this.engine.passTurn();
      this.callbacks.onTurnChange();
      this.updateUI();
    });

    document.getElementById('btn-undo').addEventListener('click', () => {
      soundEngine.playButtonClick();
      if (this.engine.undo()) {
        this.callbacks.showToast('Move undone', 'success');
        this.updateUI();
      }
    });

    document.getElementById('btn-used-words').addEventListener('click', () => {
      soundEngine.playButtonClick();
      this.callbacks.onOpenUsedWords();
    });

    document.getElementById('btn-finish').addEventListener('click', () => {
      soundEngine.playButtonClick();
      this.callbacks.onFinishGame();
    });

    document.getElementById('game-settings-btn').addEventListener('click', () => {
      soundEngine.playButtonClick();
      this.callbacks.onOpenSettings();
    });

    // Confirm word button listener
    const confirmBtn = document.getElementById('btn-confirm-word');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const res = this.engine.confirmDeclaredWord();

        if (!res.success) {
          soundEngine.playError();
          if (res.reason === 'ALREADY_USED') {
            this.callbacks.showToast(`"${res.word}" is Already Used!`, 'error');
          } else if (res.reason === 'INVALID_WORD') {
            this.callbacks.showToast(`"${res.word}" is not a valid word!`, 'error');
          }
          this.engine.cancelWordSelection();
          this.updateUI();
          return;
        }

        soundEngine.playWordConfirmed();

        // Spawn particle score animation flying toward exact scoring player's score card
        const targetCardId = res.scoringPlayerIndex === 0 ? 'p1-card' : 'p2-card';
        const scoringCard = document.getElementById(targetCardId);
        if (scoringCard && this.callbacks.spawnScoreParticles) {
          const rect = scoringCard.getBoundingClientRect();
          this.callbacks.spawnScoreParticles(`+${res.score}`, rect.left + rect.width / 2, rect.top + rect.height / 2);
        }

        // Auto-clear definition banner after 4.5 seconds
        setTimeout(() => {
          if (this.engine) {
            this.engine.lastScoredWord = null;
            this.updateUI();
          }
        }, 4500);

        if (res.pendingChallenge) {
          this.callbacks.onChallengeTriggered(res);
        } else {
          this.callbacks.onTurnChange();
        }

        this.updateUI();
      });
    }
  }

  updateUI() {
    const container = document.querySelector('.game-screen');
    if (container) {
      this.render(container.parentElement);
    }
  }
}
