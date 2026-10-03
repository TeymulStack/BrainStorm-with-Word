/**
 * Main Application Bootstrap for Word Dominion.
 * Connects GameEngine, AIEngine, SoundEngine, UI Views, and Modals.
 */

import './style/main.css';
import { dictionary } from './logic/Dictionary.js';
import { GameEngine, GAME_MODES, PHASES } from './logic/GameEngine.js';
import { AIEngine } from './logic/AIEngine.js';
import { settings } from './logic/SettingsEngine.js';
import { statsEngine } from './logic/StatsEngine.js';
import { soundEngine } from './audio/SoundEngine.js';

import { HomeScreen } from './ui/HomeScreen.js';
import { GameScreen } from './ui/GameScreen.js';
import { ModalsManager } from './ui/Modals.js';

class App {
  constructor() {
    this.appEl = document.getElementById('app');
    this.canvasEl = document.getElementById('particle-canvas');
    this.ctx = this.canvasEl ? this.canvasEl.getContext('2d') : null;
    this.toastContainer = document.getElementById('toast-container');

    this.particles = [];
    this.animating = false;

    this.modals = new ModalsManager(this.appEl, {
      onRematch: () => this.startNewGame(this.currentMode),
      onReturnHome: () => this.showHome(),
      onSettingsChanged: () => this.applyThemeSettings()
    });

    this.currentMode = GAME_MODES.VS_AI;
    this.engine = null;
    this.aiEngine = new AIEngine(settings.get('aiDifficulty'));

    this.initCanvas();
    this.applyThemeSettings();
    dictionary.load().then(() => {
      console.log('Dictionary ready for O(1) validations.');
    });
    this.showHome();
  }

  initCanvas() {
    if (!this.canvasEl) return;
    const resize = () => {
      this.canvasEl.width = window.innerWidth;
      this.canvasEl.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();
  }

  applyThemeSettings() {
    document.body.classList.toggle('high-contrast', Boolean(settings.get('highContrast')));
    document.body.classList.toggle('colorblind-safe', Boolean(settings.get('colorblindMode')));
    document.body.classList.toggle('large-text', Boolean(settings.get('largeText')));
    this.aiEngine.setDifficulty(settings.get('aiDifficulty'));
  }

  showToast(message, type = 'success') {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    this.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  spawnScoreParticles(text, targetX, targetY) {
    if (!this.ctx) return;
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight / 2;

    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x: startX,
        y: startY,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        targetX,
        targetY,
        life: 1.0,
        color: '#FFD700',
        text: i === 0 ? text : null
      });
    }

    if (!this.animating) {
      this.animating = true;
      requestAnimationFrame(this.renderParticles.bind(this));
    }
  }

  renderParticles() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);

    this.particles.forEach((p, idx) => {
      p.x += (p.targetX - p.x) * 0.08 + p.vx;
      p.y += (p.targetY - p.y) * 0.08 + p.vy;
      p.vx *= 0.9;
      p.vy *= 0.9;
      p.life -= 0.02;

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.life);

      if (p.text) {
        this.ctx.font = 'bold 24px Outfit, sans-serif';
        this.ctx.fillStyle = '#FFD700';
        this.ctx.fillText(p.text, p.x, p.y);
      } else {
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    });

    this.particles = this.particles.filter(p => p.life > 0);

    if (this.particles.length > 0) {
      requestAnimationFrame(this.renderParticles.bind(this));
    } else {
      this.animating = false;
    }
  }

  showHome() {
    const screenMount = document.getElementById('screen-mount');
    const home = new HomeScreen(
      (mode) => this.startNewGame(mode),
      () => this.modals.showSettingsModal(),
      () => this.modals.showStatsModal(),
      () => this.modals.showHowToPlayModal()
    );
    home.render(screenMount);
  }

  startNewGame(mode) {
    this.currentMode = mode;
    this.engine = new GameEngine(mode, settings.get('aiDifficulty'));

    const screenMount = document.getElementById('screen-mount');
    this.gameScreen = new GameScreen(this.engine, {
      onTurnChange: () => this.handleTurnChange(),
      onChallengeTriggered: (res) => this.handleChallengeTriggered(res),
      onOpenUsedWords: () => this.modals.showUsedWordsModal(this.engine.usedWords),
      onFinishGame: () => this.finishGame(),
      onOpenSettings: () => this.modals.showSettingsModal(),
      showToast: (msg, type) => this.showToast(msg, type),
      spawnScoreParticles: (text, tx, ty) => this.spawnScoreParticles(text, tx, ty)
    });

    this.gameScreen.render(screenMount);
    this.checkAITurn();
  }

  handleTurnChange() {
    if (this.engine.phase === PHASES.GAME_OVER) {
      this.finishGame();
      return;
    }
    this.checkAITurn();
  }

  handleChallengeTriggered(res) {
    const declaringPlayerIndex = this.engine.pendingChallenge.declaringPlayerIndex;
    const opponentIndex = 1 - declaringPlayerIndex;
    const opponent = this.engine.players[opponentIndex];

    if (opponent.isAI) {
      // AI decides challenge
      const shouldChallenge = this.aiEngine.decideChallenge(res.word);
      const challengeRes = this.engine.resolveChallenge(shouldChallenge);

      if (challengeRes) {
        if (challengeRes.status === 'CHALLENGE_FAILED') {
          this.showToast(`AI Challenge Failed! -10 penalty to AI`, 'success');
        } else if (challengeRes.status === 'CHALLENGE_SUCCESS') {
          this.showToast(`AI Successfully Challenged! Word rejected`, 'error');
        }
      }
      this.gameScreen.updateUI();
      this.handleTurnChange();
    } else {
      // Human opponent challenge modal
      this.modals.showChallengeModal(
        { declaringPlayer: this.engine.players[declaringPlayerIndex].name, word: res.word, score: res.score },
        (didChallenge) => {
          const challengeRes = this.engine.resolveChallenge(didChallenge);
          if (challengeRes) {
            if (challengeRes.status === 'CHALLENGE_FAILED') {
              this.showToast(`Challenge Failed! -10 point penalty`, 'error');
            } else if (challengeRes.status === 'CHALLENGE_SUCCESS') {
              this.showToast(`Challenge Successful! Word rejected`, 'success');
            }
          }
          this.gameScreen.updateUI();
          this.handleTurnChange();
        }
      );
    }
  }

  async checkAITurn() {
    if (!this.engine || this.engine.phase === PHASES.GAME_OVER) return;

    if (this.engine.activePlayer.isAI) {
      this.gameScreen.updateUI();

      const thinkingTime = this.aiEngine.getThinkingTime();
      await new Promise(r => setTimeout(r, thinkingTime));

      const aiMove = await this.aiEngine.computeTurn(this.engine);

      if (aiMove.pass) {
        this.engine.passTurn();
        this.gameScreen.updateUI();
        this.handleTurnChange();
        return;
      }

      // Perform AI placement
      this.engine.selectGridCell(aiMove.cell.row, aiMove.cell.col);
      this.engine.placeLetter(aiMove.letter);
      soundEngine.playTilePlacement();
      this.gameScreen.updateUI();

      if (aiMove.bestWord) {
        await new Promise(r => setTimeout(r, 600));

        this.engine.setWordStart(aiMove.bestWord.startCell.row, aiMove.bestWord.startCell.col);
        this.engine.setWordEnd(aiMove.bestWord.endCell.row, aiMove.bestWord.endCell.col);
        this.gameScreen.updateUI();

        await new Promise(r => setTimeout(r, 400));

        const res = this.engine.confirmDeclaredWord();
        if (res.success) {
          soundEngine.playWordConfirmed();

          // Spawn particle score animation flying toward AI score card
          const targetCardId = res.scoringPlayerIndex === 0 ? 'p1-card' : 'p2-card';
          const cardEl = document.getElementById(targetCardId);
          if (cardEl) {
            const rect = cardEl.getBoundingClientRect();
            this.spawnScoreParticles(`+${res.score}`, rect.left + rect.width / 2, rect.top + rect.height / 2);
          }

          // Auto-clear definition banner after 4.5s
          setTimeout(() => {
            if (this.engine) {
              this.engine.lastScoredWord = null;
              if (this.gameScreen) this.gameScreen.updateUI();
            }
          }, 4500);

          if (res.pendingChallenge) {
            this.handleChallengeTriggered(res);
          } else {
            this.handleTurnChange();
          }
        } else {
          this.engine.passTurn();
          this.handleTurnChange();
        }
      } else {
        // AI passes after placement
        this.engine.passTurn();
        this.handleTurnChange();
      }
      this.gameScreen.updateUI();
    }
  }

  finishGame() {
    this.engine.manuallyFinishGame();

    const summary = this.engine.getGameOverSummary();

    // Record career statistics
    statsEngine.recordGameFinished({
      isWin: summary.winner && summary.winner.id === 1,
      isDraw: summary.isDraw,
      isLoss: summary.winner && summary.winner.id === 2,
      score: this.engine.players[0].score,
      words: this.engine.usedWords.map(w => w.word),
      letterCounts: this.engine.letterCountMap
    });

    this.modals.showGameOverModal(summary);
  }
}

// Bootstrap App on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
