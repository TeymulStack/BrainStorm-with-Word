/**
 * AI Engine for Word Dominion.
 * Evaluates board placements, strategic word declarations, and challenge decisions across 4 difficulty levels.
 */

import { dictionary } from './Dictionary.js';
import { PHASES } from './GameEngine.js';

export class AIEngine {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
  }

  setDifficulty(diff) {
    this.difficulty = diff;
  }

  /**
   * Get approximate thinking time in ms (0.8 - 2.0s)
   */
  getThinkingTime() {
    switch (this.difficulty) {
      case 'easy':
        return 800 + Math.random() * 400; // 0.8s - 1.2s
      case 'medium':
        return 1000 + Math.random() * 500; // 1.0s - 1.5s
      case 'hard':
        return 1200 + Math.random() * 600; // 1.2s - 1.8s
      case 'expert':
        return 1400 + Math.random() * 600; // 1.4s - 2.0s
      default:
        return 1000;
    }
  }

  /**
   * Decide whether AI should challenge opponent's word
   * @param {string} word - Declared word
   * @returns {boolean} - True if AI challenges
   */
  decideChallenge(word) {
    const isValid = dictionary.isValidWord(word);

    switch (this.difficulty) {
      case 'easy':
        // 20% random challenge if invalid, 5% accidental challenge if valid
        return isValid ? Math.random() < 0.05 : Math.random() < 0.2;
      case 'medium':
        // 70% challenge if invalid, 2% mistake if valid
        return isValid ? Math.random() < 0.02 : Math.random() < 0.7;
      case 'hard':
        // 95% challenge if invalid, 0% if valid
        return isValid ? false : Math.random() < 0.95;
      case 'expert':
        // 100% accurate challenge if invalid, 0% if valid
        return !isValid;
      default:
        return !isValid;
    }
  }

  /**
   * Find all empty grid cells
   */
  getEmptyCells(board) {
    const empty = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (!board[r][c].letter) {
          empty.push({ row: r, col: c });
        }
      }
    }
    return empty;
  }

  /**
   * Evaluate best turn action for AI
   * @param {GameEngine} engine 
   * @returns {Promise<{ cell: {row, col}, letter: string, wordObj?: {startRow, startCol, endRow, endCol, word, score} }>}
   */
  async computeTurn(engine) {
    const board = engine.board;
    const emptyCells = this.getEmptyCells(board);

    if (emptyCells.length === 0) {
      return { pass: true };
    }

    const candidateLetters = ['E', 'A', 'R', 'I', 'O', 'T', 'N', 'S', 'L', 'C', 'U', 'D', 'P', 'M', 'H', 'G', 'B', 'F', 'Y', 'W', 'K', 'V', 'X', 'Z', 'J', 'Q'];
    const candidates = [];

    // Filter letter set based on difficulty to balance performance
    let testedLetters = candidateLetters;
    if (this.difficulty === 'easy') testedLetters = candidateLetters.slice(0, 6);
    else if (this.difficulty === 'medium') testedLetters = candidateLetters.slice(0, 12);
    else if (this.difficulty === 'hard') testedLetters = candidateLetters.slice(0, 18);

    // Sample cells for performance on easier difficulties
    let testedCells = emptyCells;
    if (this.difficulty === 'easy' && emptyCells.length > 10) {
      testedCells = [...emptyCells].sort(() => 0.5 - Math.random()).slice(0, 10);
    } else if (this.difficulty === 'medium' && emptyCells.length > 20) {
      testedCells = [...emptyCells].sort(() => 0.5 - Math.random()).slice(0, 20);
    }

    for (const cell of testedCells) {
      for (const letter of testedLetters) {
        // Simulate letter placement
        const simBoard = JSON.parse(JSON.stringify(board));
        simBoard[cell.row][cell.col] = {
          row: cell.row,
          col: cell.col,
          letter: letter,
          owner: engine.activePlayer.id,
          placementTurn: engine.turn,
          isScored: false
        };

        // Find all valid words formed containing this cell
        const possibleWords = this.findValidWordsForCell(simBoard, cell.row, cell.col, engine.usedWordSet);

        if (possibleWords.length > 0) {
          // Sort by highest score
          possibleWords.sort((a, b) => b.score - a.score);
          candidates.push({
            cell,
            letter,
            bestWord: possibleWords[0]
          });
        } else {
          // Even if no word is formed immediately, record candidate letter for placement
          candidates.push({
            cell,
            letter,
            bestWord: null
          });
        }
      }
    }

    if (candidates.length === 0) {
      // Pick random cell & common letter
      const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      const randomLetter = testedLetters[Math.floor(Math.random() * testedLetters.length)];
      return { cell: randomCell, letter: randomLetter, bestWord: null };
    }

    // Rank candidates: 1. Common English Word (Highest Priority), 2. Score
    candidates.sort((a, b) => {
      const isCommonA = a.bestWord && dictionary.isCommonWord(a.bestWord.word) ? 1 : 0;
      const isCommonB = b.bestWord && dictionary.isCommonWord(b.bestWord.word) ? 1 : 0;
      if (isCommonA !== isCommonB) {
        return isCommonB - isCommonA; // Prefer common words first
      }

      const scoreA = a.bestWord ? a.bestWord.score : 0;
      const scoreB = b.bestWord ? b.bestWord.score : 0;
      return scoreB - scoreA;
    });

    let chosenCandidate = candidates[0];

    if (this.difficulty === 'easy') {
      // Easy AI picks among top 50% randomly
      const topHalf = candidates.slice(0, Math.max(1, Math.floor(candidates.length * 0.5)));
      chosenCandidate = topHalf[Math.floor(Math.random() * topHalf.length)];
    } else if (this.difficulty === 'medium') {
      // Medium AI picks among top 30%
      const topSlice = candidates.slice(0, Math.max(1, Math.floor(candidates.length * 0.3)));
      chosenCandidate = topSlice[Math.floor(Math.random() * topSlice.length)];
    } else if (this.difficulty === 'hard') {
      // Hard AI picks among top 3
      const topSlice = candidates.slice(0, Math.min(3, candidates.length));
      chosenCandidate = topSlice[Math.floor(Math.random() * topSlice.length)];
    }
    // Expert AI picks absolute #1 best candidate!

    return chosenCandidate;
  }

  /**
   * Find valid words on grid containing target cell (Left->Right or Top->Bottom)
   */
  findValidWordsForCell(board, r, c, usedWordSet) {
    const validWords = [];

    // 1. Horizontal row search containing (r, c)
    let leftC = c;
    while (leftC > 0 && board[r][leftC - 1].letter) leftC--;
    let rightC = c;
    while (rightC < 7 && board[r][rightC + 1].letter) rightC++;

    for (let startCol = leftC; startCol <= c; startCol++) {
      for (let endCol = c; endCol <= rightC; endCol++) {
        let str = '';
        for (let col = startCol; col <= endCol; col++) {
          str += board[r][col].letter;
        }

        if (dictionary.isValidWord(str) && !usedWordSet.has(str)) {
          validWords.push({
            word: str,
            score: str.length * 10,
            startCell: { row: r, col: startCol },
            endCell: { row: r, col: endCol }
          });
        }
      }
    }

    // 2. Vertical column search containing (r, c)
    let topR = r;
    while (topR > 0 && board[topR - 1][c].letter) topR--;
    let botR = r;
    while (botR < 7 && board[botR + 1][c].letter) botR++;

    for (let startRow = topR; startRow <= r; startRow++) {
      for (let endRow = r; endRow <= botR; endRow++) {
        let str = '';
        for (let row = startRow; row <= endRow; row++) {
          str += board[row][c].letter;
        }

        if (dictionary.isValidWord(str) && !usedWordSet.has(str)) {
          validWords.push({
            word: str,
            score: str.length * 10,
            startCell: { row: startRow, col: c },
            endCell: { row: endRow, col: c }
          });
        }
      }
    }

    return validWords;
  }
}
