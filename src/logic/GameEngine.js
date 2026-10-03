/**
 * Core Game Engine for Word Dominion.
 * Manages 8x8 board state, turn flow, word declarations, scoring, challenge mechanics, and single-move undo.
 */

import { dictionary } from './Dictionary.js';
import { settings } from './SettingsEngine.js';

export const GAME_MODES = {
  VS_AI: 'vs_ai',
  LOCAL_P2: 'local_p2'
};

export const PHASES = {
  WAITING_PLACEMENT: 'WAITING_PLACEMENT',
  KEYBOARD_OPEN: 'KEYBOARD_OPEN',
  TILE_PLACED: 'TILE_PLACED',
  WORD_DECLARING: 'WORD_DECLARING',
  CHALLENGE_PENDING: 'CHALLENGE_PENDING',
  GAME_OVER: 'GAME_OVER'
};

export class GameEngine {
  constructor(mode = GAME_MODES.VS_AI, aiDifficulty = 'medium') {
    this.mode = mode;
    this.aiDifficulty = aiDifficulty;
    this.resetGame();
  }

  resetGame() {
    this.board = Array(8).fill(null).map((_, r) =>
      Array(8).fill(null).map((_, c) => ({
        row: r,
        col: c,
        letter: null,
        owner: null,
        placementTurn: null,
        isScored: false,
      }))
    );

    this.players = [
      { id: 1, name: 'Player 1', color: '#00F0FF', score: 0, avatar: '👤', isAI: false },
      {
        id: 2,
        name: this.mode === GAME_MODES.VS_AI ? `Computer (${this.aiDifficulty.toUpperCase()})` : 'Player 2',
        color: '#FF6B00',
        score: 0,
        avatar: this.mode === GAME_MODES.VS_AI ? '🤖' : '👥',
        isAI: this.mode === GAME_MODES.VS_AI
      }
    ];

    this.activePlayerIndex = 0;
    this.turn = 1;
    this.phase = PHASES.WAITING_PLACEMENT;

    this.selectedEmptyCell = null; // { row, col }
    this.lastPlacedCell = null; // { row, col, letter }

    // Word Declaration State
    this.wordStartCell = null;
    this.wordEndCell = null;
    this.currentDeclaredPath = []; // Array of cells
    this.currentDeclaredWord = '';

    // History & Used Words
    this.usedWords = []; // Array of { word, playerId, score, turn }
    this.usedWordSet = new Set();
    this.letterCountMap = {}; // { 'A': count }

    // Challenge Phase Info
    this.pendingChallenge = null; // { word, path, score, declaringPlayerIndex }

    // Undo Snapshot
    this.undoSnapshot = null;

    // Turn Stats
    this.turnHistory = [];
  }

  get activePlayer() {
    return this.players[this.activePlayerIndex];
  }

  get opponentPlayer() {
    return this.players[1 - this.activePlayerIndex];
  }

  get filledCellCount() {
    let count = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c].letter) count++;
      }
    }
    return count;
  }

  get isBoardFull() {
    return this.filledCellCount === 64;
  }

  /**
   * Save current state to undo snapshot
   */
  takeUndoSnapshot() {
    this.undoSnapshot = {
      board: JSON.parse(JSON.stringify(this.board)),
      players: JSON.parse(JSON.stringify(this.players)),
      activePlayerIndex: this.activePlayerIndex,
      turn: this.turn,
      phase: this.phase,
      usedWords: JSON.parse(JSON.stringify(this.usedWords)),
      usedWordSet: new Set(this.usedWordSet),
      letterCountMap: { ...this.letterCountMap }
    };
  }

  /**
   * Perform single-move Undo
   */
  undo() {
    if (!this.undoSnapshot) return false;

    this.board = JSON.parse(JSON.stringify(this.undoSnapshot.board));
    this.players = JSON.parse(JSON.stringify(this.undoSnapshot.players));
    this.activePlayerIndex = this.undoSnapshot.activePlayerIndex;
    this.turn = this.undoSnapshot.turn;
    this.phase = PHASES.WAITING_PLACEMENT;
    this.usedWords = JSON.parse(JSON.stringify(this.undoSnapshot.usedWords));
    this.usedWordSet = new Set(this.undoSnapshot.usedWordSet);
    this.letterCountMap = { ...this.undoSnapshot.letterCountMap };

    this.selectedEmptyCell = null;
    this.lastPlacedCell = null;
    this.wordStartCell = null;
    this.wordEndCell = null;
    this.currentDeclaredPath = [];
    this.currentDeclaredWord = '';
    this.pendingChallenge = null;
    this.undoSnapshot = null;

    return true;
  }

  /**
   * Player taps an empty grid cell
   */
  selectGridCell(row, col) {
    if (this.phase !== PHASES.WAITING_PLACEMENT) return false;
    if (this.board[row][col].letter) return false;

    this.selectedEmptyCell = { row, col };
    this.phase = PHASES.KEYBOARD_OPEN;
    return true;
  }

  cancelKeyboard() {
    if (this.phase === PHASES.KEYBOARD_OPEN) {
      this.selectedEmptyCell = null;
      this.phase = PHASES.WAITING_PLACEMENT;
    }
  }

  /**
   * Place a letter from keyboard onto selected empty cell
   */
  placeLetter(letter) {
    if (this.phase !== PHASES.KEYBOARD_OPEN || !this.selectedEmptyCell) return false;

    this.takeUndoSnapshot();

    const { row, col } = this.selectedEmptyCell;
    const char = letter.toUpperCase();

    this.board[row][col] = {
      row,
      col,
      letter: char,
      owner: this.activePlayer.id,
      placementTurn: this.turn,
      isScored: false,
    };

    this.lastPlacedCell = { row, col, letter: char };
    this.letterCountMap[char] = (this.letterCountMap[char] || 0) + 1;
    this.selectedEmptyCell = null;
    this.phase = PHASES.TILE_PLACED;

    return true;
  }

  /**
   * Word Declaration Selection Steps
   */
  setWordStart(row, col) {
    if (this.phase !== PHASES.TILE_PLACED && this.phase !== PHASES.WORD_DECLARING) return false;
    if (!this.board[row][col].letter) return false;

    this.wordStartCell = { row, col };
    this.wordEndCell = null;
    this.currentDeclaredPath = [this.board[row][col]];
    this.currentDeclaredWord = this.board[row][col].letter;
    this.phase = PHASES.WORD_DECLARING;
    return true;
  }

  setWordEnd(row, col) {
    if (this.phase !== PHASES.WORD_DECLARING || !this.wordStartCell) return false;
    if (!this.board[row][col].letter) return false;

    const start = this.wordStartCell;
    const end = { row, col };

    // Validate path orientation: Left -> Right OR Top -> Bottom
    let path = [];
    if (start.row === end.row && start.col <= end.col) {
      // Horizontal Left to Right
      for (let c = start.col; c <= end.col; c++) {
        const cell = this.board[start.row][c];
        if (!cell.letter) return false; // Gap in path!
        path.push(cell);
      }
    } else if (start.col === end.col && start.row <= end.row) {
      // Vertical Top to Bottom
      for (let r = start.row; r <= end.row; r++) {
        const cell = this.board[r][start.col];
        if (!cell.letter) return false; // Gap in path!
        path.push(cell);
      }
    } else {
      // Invalid direction (reverse, diagonal, etc.)
      return false;
    }

    // Path MUST contain the newly placed letter!
    const containsPlacedTile = path.some(
      c => c.row === this.lastPlacedCell.row && c.col === this.lastPlacedCell.col
    );

    if (!containsPlacedTile) return false;

    this.wordEndCell = end;
    this.currentDeclaredPath = path;
    const rawWord = path.map(c => c.letter).join('');
    this.currentDeclaredWord = dictionary.normalizeWord(rawWord);

    console.log(`[VALIDATION AUDIT] Selected: (${start.row},${start.col}) -> (${end.row},${end.col}) | Extracted: "${rawWord}" | Normalized: "${this.currentDeclaredWord}"`);
    return true;
  }

  cancelWordSelection() {
    this.wordStartCell = null;
    this.wordEndCell = null;
    this.currentDeclaredPath = [];
    this.currentDeclaredWord = '';
    if (this.phase === PHASES.WORD_DECLARING) {
      this.phase = PHASES.TILE_PLACED;
    }
  }

  /**
   * Confirm the declared word
   * Returns result object: { success: boolean, reason?: string, word?: string, score?: number }
   */
  confirmDeclaredWord() {
    if (this.phase !== PHASES.WORD_DECLARING || !this.currentDeclaredWord) {
      return { success: false, reason: 'No word selected' };
    }

    const word = dictionary.normalizeWord(this.currentDeclaredWord);

    // 1. Check if word has already been scored in this match
    if (this.usedWordSet.has(word)) {
      return { success: false, reason: 'ALREADY_USED', word };
    }

    // 2. Validate against dictionary (Single source of truth)
    if (!dictionary.isValidWord(word)) {
      return { success: false, reason: 'INVALID_WORD', word };
    }

    const score = word.length * 10;
    const path = [...this.currentDeclaredPath];
    const declaringPlayerIndex = this.activePlayerIndex;
    const definition = dictionary.getDefinition(word);

    // Handle Challenge Mode if enabled in settings
    const challengeEnabled = settings.get('challengeMode');

    if (challengeEnabled) {
      this.pendingChallenge = {
        word,
        path,
        score,
        definition,
        declaringPlayerIndex
      };
      this.phase = PHASES.CHALLENGE_PENDING;
      return { success: true, pendingChallenge: true, word, score, definition, scoringPlayerIndex: declaringPlayerIndex };
    } else {
      // Award points immediately
      this.awardWordPoints(word, path, score, declaringPlayerIndex);
      this.finishTurn();
      return { success: true, pendingChallenge: false, word, score, definition, scoringPlayerIndex: declaringPlayerIndex };
    }
  }

  /**
   * Resolve a Challenge attempt by opponent
   * @param {boolean} didChallenge - True if opponent decided to challenge
   */
  resolveChallenge(didChallenge) {
    if (this.phase !== PHASES.CHALLENGE_PENDING || !this.pendingChallenge) return null;

    const { word, path, score, definition, declaringPlayerIndex } = this.pendingChallenge;
    const opponentIndex = 1 - declaringPlayerIndex;

    let result = {};

    if (!didChallenge) {
      // Opponent Accepted
      this.awardWordPoints(word, path, score, declaringPlayerIndex);
      result = { status: 'ACCEPTED', word, score, definition, declaringPlayer: this.players[declaringPlayerIndex].name, scoringPlayerIndex: declaringPlayerIndex };
    } else {
      // Opponent Challenged! Verify word in dictionary
      const isValid = dictionary.isValidWord(word);

      if (isValid) {
        // Challenge Failed: Word is real! Award points to declaring player + subtract 10 penalty from challenger
        this.awardWordPoints(word, path, score, declaringPlayerIndex);
        this.players[opponentIndex].score = Math.max(0, this.players[opponentIndex].score - 10);
        result = {
          status: 'CHALLENGE_FAILED',
          word,
          score,
          definition,
          declaringPlayer: this.players[declaringPlayerIndex].name,
          challengerPlayer: this.players[opponentIndex].name,
          penalty: 10,
          scoringPlayerIndex: declaringPlayerIndex
        };
      } else {
        // Challenge Successful: Word is fake! No points, word rejected, turn passed
        result = {
          status: 'CHALLENGE_SUCCESS',
          word,
          score: 0,
          declaringPlayer: this.players[declaringPlayerIndex].name,
          challengerPlayer: this.players[opponentIndex].name,
          scoringPlayerIndex: null
        };
      }
    }

    this.pendingChallenge = null;
    this.finishTurn();
    return result;
  }

  awardWordPoints(word, path, score, playerIndex) {
    const definition = dictionary.getDefinition(word);
    this.players[playerIndex].score += score;
    this.usedWords.push({
      word,
      definition,
      playerId: this.players[playerIndex].id,
      playerName: this.players[playerIndex].name,
      score,
      turn: this.turn
    });
    this.usedWordSet.add(word);

    // Mark board cells as scored
    path.forEach(c => {
      this.board[c.row][c.col].isScored = true;
    });

    this.lastScoredWord = {
      word,
      definition,
      score,
      playerIndex,
      playerName: this.players[playerIndex].name
    };
  }

  /**
   * Pass turn (if no valid word or player chooses to pass)
   */
  passTurn() {
    if (this.phase !== PHASES.TILE_PLACED && this.phase !== PHASES.WORD_DECLARING && this.phase !== PHASES.WAITING_PLACEMENT) {
      return false;
    }
    this.finishTurn();
    return true;
  }

  /**
   * Finalize current turn and switch active player
   */
  finishTurn() {
    // Clear selection state
    this.selectedEmptyCell = null;
    this.lastPlacedCell = null;
    this.wordStartCell = null;
    this.wordEndCell = null;
    this.currentDeclaredPath = [];
    this.currentDeclaredWord = '';
    this.pendingChallenge = null;
    this.undoSnapshot = null; // Single-move undo is only available during active turn!

    // Check automatic game end (all 64 cells filled)
    if (this.isBoardFull) {
      this.phase = PHASES.GAME_OVER;
      return;
    }

    // Switch active player & increment turn
    this.activePlayerIndex = 1 - this.activePlayerIndex;
    this.turn += 1;
    this.phase = PHASES.WAITING_PLACEMENT;
  }

  /**
   * Manually finish the game
   */
  manuallyFinishGame() {
    this.phase = PHASES.GAME_OVER;
  }

  /**
   * Summary breakdown for Game Over screen
   */
  getGameOverSummary() {
    const p1 = this.players[0];
    const p2 = this.players[1];

    let winner = null;
    if (p1.score > p2.score) winner = p1;
    else if (p2.score > p1.score) winner = p2;

    let longestWord = '';
    let highestScoringWord = { word: '', score: 0 };

    this.usedWords.forEach(w => {
      if (w.word.length > longestWord.length) longestWord = w.word;
      if (w.score > highestScoringWord.score) highestScoringWord = w;
    });

    const totalWords = this.usedWords.length;
    const accuracy = totalWords > 0 ? 100 : 0; // standard precision

    return {
      winner,
      isDraw: p1.score === p2.score,
      p1Score: p1.score,
      p2Score: p2.score,
      totalTurns: this.turn,
      totalWordsFound: totalWords,
      longestWord: longestWord || 'N/A',
      highestScoringWord: highestScoringWord.word ? `${highestScoringWord.word} (+${highestScoringWord.score})` : 'N/A',
      accuracy: `${accuracy}%`
    };
  }
}
