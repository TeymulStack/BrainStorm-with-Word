/**
 * Career Statistics Engine for Word Dominion.
 * Tracks game stats in LocalStorage.
 */

const STATS_KEY = 'word_dominion_career_stats';

const DEFAULT_STATS = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  highestScore: 0,
  longestWord: '',
  totalWordsCreated: 0,
  totalScoreEarned: 0,
  totalLettersPlaced: 0,
  totalWordLengthSum: 0,
  letterFrequencies: {},
};

class StatsEngine {
  constructor() {
    this.stats = this.loadStats();
  }

  loadStats() {
    try {
      const stored = localStorage.getItem(STATS_KEY);
      if (stored) {
        return { ...DEFAULT_STATS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load career stats', e);
    }
    return { ...DEFAULT_STATS };
  }

  saveStats() {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(this.stats));
    } catch (e) {
      console.warn('Failed to save career stats', e);
    }
  }

  recordGameFinished({ isWin, isDraw, isLoss, score, words, letterCounts }) {
    this.stats.gamesPlayed += 1;
    if (isWin) this.stats.wins += 1;
    else if (isLoss) this.stats.losses += 1;
    else if (isDraw) this.stats.draws += 1;

    if (score > this.stats.highestScore) {
      this.stats.highestScore = score;
    }

    this.stats.totalScoreEarned += score;

    if (words && Array.isArray(words)) {
      words.forEach(w => {
        const cleanW = w.toUpperCase();
        this.stats.totalWordsCreated += 1;
        this.stats.totalWordLengthSum += cleanW.length;
        if (!this.stats.longestWord || cleanW.length > this.stats.longestWord.length) {
          this.stats.longestWord = cleanW;
        }
      });
    }

    if (letterCounts && typeof letterCounts === 'object') {
      for (const [letter, count] of Object.entries(letterCounts)) {
        const u = letter.toUpperCase();
        this.stats.letterFrequencies[u] = (this.stats.letterFrequencies[u] || 0) + count;
        this.stats.totalLettersPlaced += count;
      }
    }

    this.saveStats();
  }

  getWinRate() {
    if (this.stats.gamesPlayed === 0) return 0;
    return Math.round((this.stats.wins / this.stats.gamesPlayed) * 100);
  }

  getAverageScore() {
    if (this.stats.gamesPlayed === 0) return 0;
    return Math.round(this.stats.totalScoreEarned / this.stats.gamesPlayed);
  }

  getAverageWordLength() {
    if (this.stats.totalWordsCreated === 0) return 0;
    return (this.stats.totalWordLengthSum / this.stats.totalWordsCreated).toFixed(1);
  }

  getFavoriteLetter() {
    let maxLetter = '-';
    let maxCount = 0;
    for (const [l, count] of Object.entries(this.stats.letterFrequencies)) {
      if (count > maxCount) {
        maxCount = count;
        maxLetter = l;
      }
    }
    return maxLetter;
  }

  resetStats() {
    this.stats = { ...DEFAULT_STATS, letterFrequencies: {} };
    this.saveStats();
  }
}

export const statsEngine = new StatsEngine();
