/**
 * Home Screen View Component for Word Dominion.
 */

import { soundEngine } from '../audio/SoundEngine.js';

export class HomeScreen {
  constructor(onStartGame, onOpenSettings, onOpenStats, onOpenHowToPlay) {
    this.onStartGame = onStartGame;
    this.onOpenSettings = onOpenSettings;
    this.onOpenStats = onOpenStats;
    this.onOpenHowToPlay = onOpenHowToPlay;
  }

  render(container) {
    container.innerHTML = `
      <div class="home-screen">
        <div class="home-hero">
          <div class="hero-logo-box">W</div>
          <h1 class="title-main">WORD DOMINION</h1>
          <p class="title-tagline">Competitive 8×8 Word Strategy</p>
        </div>

        <div class="home-menu-group">
          <div class="mode-card glass-card" id="btn-vs-ai">
            <div class="mode-icon-box">🤖</div>
            <div class="mode-info">
              <div class="mode-title">Play vs Computer</div>
              <div class="mode-subtitle">Test your strategy against 4 AI difficulties</div>
            </div>
          </div>

          <div class="mode-card glass-card" id="btn-local-p2">
            <div class="mode-icon-box">👥</div>
            <div class="mode-info">
              <div class="mode-title">Local Multiplayer</div>
              <div class="mode-subtitle">Pass & Play with a friend on one device</div>
            </div>
          </div>
        </div>

        <div class="home-bottom-nav">
          <button class="icon-btn" id="btn-how-to-play" title="How to Play">❓</button>
          <button class="icon-btn" id="btn-career-stats" title="Career Stats">🏆</button>
          <button class="icon-btn" id="btn-settings" title="Settings">⚙️</button>
        </div>
      </div>
    `;

    // Event Bindings
    document.getElementById('btn-vs-ai').addEventListener('click', () => {
      soundEngine.playButtonClick();
      this.onStartGame('vs_ai');
    });

    document.getElementById('btn-local-p2').addEventListener('click', () => {
      soundEngine.playButtonClick();
      this.onStartGame('local_p2');
    });

    document.getElementById('btn-how-to-play').addEventListener('click', () => {
      soundEngine.playButtonClick();
      this.onOpenHowToPlay();
    });

    document.getElementById('btn-career-stats').addEventListener('click', () => {
      soundEngine.playButtonClick();
      this.onOpenStats();
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
      soundEngine.playButtonClick();
      this.onOpenSettings();
    });
  }
}
