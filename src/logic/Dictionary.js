/**
 * Single Source of Truth Dictionary Service for Word Dominion.
 * Loads public/dictionary.txt (172,825 ENABLE1 English words) and public/definitions.json into memory.
 * ALL game modules (Human Player, AI, Challenge Mode, Preview, Used Words) call this exact service.
 */

const IRREGULAR_PLURALS = new Set([
  'MEN', 'WOMEN', 'CHILDREN', 'GEESE', 'MICE', 'TEETH', 'FEET', 'PEOPLE', 'OXEN',
  'LEAVES', 'WOLVES', 'KNIVES', 'LIVES', 'HALVES', 'SHELVES', 'THIEVES', 'CALVES',
  'LOAVES', 'ELVES', 'SCARVES', 'SPECIES', 'SERIES'
]);

class DictionaryService {
  constructor() {
    this.wordSet = new Set();
    this.commonWordsSet = new Set();
    this.definitionsMap = new Map();
    this.isLoaded = false;
    this.loadPromise = null;
    this.debug = true;
  }

  /**
   * Load the full ENABLE1 dictionary dataset and definition mappings
   */
  async load() {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        // 1. Load full 172,825 ENABLE1 dictionary wordlist
        const resDict = await fetch('/dictionary.txt');
        if (resDict.ok) {
          const text = await resDict.text();
          const lines = text.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            const w = this.normalizeWord(lines[i]);
            if (w && /^[A-Z]+$/.test(w)) {
              this.wordSet.add(w);
            }
          }
        }

        // 2. Load definition mappings
        const resDefs = await fetch('/definitions.json');
        if (resDefs.ok) {
          const rawDefs = await resDefs.json();
          for (const [key, def] of Object.entries(rawDefs)) {
            if (key && def) {
              this.definitionsMap.set(this.normalizeWord(key), typeof def === 'string' ? def.trim() : (def.definition || '').trim());
            }
          }
        }

        // 3. Load 20,000 common everyday English words
        const resCommon = await fetch('/common_words.txt');
        if (resCommon.ok) {
          const textCommon = await resCommon.text();
          const linesCommon = textCommon.split(/\r?\n/);
          for (let i = 0; i < linesCommon.length; i++) {
            const w = this.normalizeWord(linesCommon[i]);
            if (w && /^[A-Z]+$/.test(w)) {
              this.commonWordsSet.add(w);
            }
          }
        }

        this.isLoaded = true;
        console.log(`[DictionaryService] Successfully loaded ${this.wordSet.size} English dictionary words and ${this.definitionsMap.size} definitions.`);
      } catch (err) {
        console.error('[DictionaryService] Error loading datasets:', err);
      }
    })();

    return this.loadPromise;
  }

  /**
   * Strict string normalization:
   * - Trims whitespace
   * - Strips invisible, zero-width, null, and control characters
   * - Performs Unicode NFC normalization
   * - Converts to UPPERCASE
   */
  normalizeWord(str) {
    if (typeof str !== 'string') return '';
    return str
      .trim()
      .replace(/[\u0000-\u001F\u007F-\u009F\u200B\uFEFF]/g, '')
      .normalize('NFC')
      .toUpperCase();
  }

  /**
   * Check if a word exists in the dictionary dataset
   */
  exists(word) {
    const w = this.normalizeWord(word);
    return this.wordSet.has(w);
  }

  /**
   * Universal Single Source of Truth Validation Function used identically by Player and AI.
   * A word is valid ONLY IF ALL of the following are true:
   * 1. It exists in the ENABLE1 dictionary dataset (wordSet.has(w)).
   * 2. It satisfies the game's plural rules (no simple -S/-ES/-IES plurals; irregular plurals allowed).
   * 3. Rejects non-alphabet characters, spaces, numbers, and symbols.
   */
  isValidWord(input) {
    const w = this.normalizeWord(input);

    // 1. Letters only
    if (!w || !/^[A-Z]+$/.test(w)) {
      if (this.debug) {
        console.log(`[VALIDATION AUDIT] Extracted: "${input}" | Normalized: "${w}" | Result: INVALID (Non-alphabet/empty)`);
      }
      return false;
    }

    // 2. Must exist in ENABLE1 dictionary dataset
    if (!this.wordSet.has(w)) {
      if (this.debug) {
        console.log(`[VALIDATION AUDIT] Extracted: "${input}" | Normalized: "${w}" | Dictionary: NOT FOUND | Result: INVALID`);
      }
      return false;
    }

    // 3. Irregular plurals remain VALID
    if (IRREGULAR_PLURALS.has(w)) {
      if (this.debug) {
        console.log(`[VALIDATION AUDIT] Extracted: "${input}" | Normalized: "${w}" | Dictionary: FOUND | Plural Check: IRREGULAR PLURAL | Result: VALID`);
      }
      return true;
    }

    // 4. SIMPLE PLURAL RULE: Disable automatic plural forms created ONLY by adding -S, -ES, or -IES
    if (w.endsWith('S') && w.length > 2) {
      if (w.endsWith('IES') && w.length > 3) {
        const stemY = w.slice(0, -3) + 'Y';
        if (this.wordSet.has(stemY)) {
          if (this.debug) {
            console.log(`[VALIDATION AUDIT] Extracted: "${input}" | Normalized: "${w}" | Plural Check: REJECTED (-IES plural of ${stemY}) | Result: INVALID`);
          }
          return false;
        }
      }

      if (w.endsWith('ES') && w.length > 3) {
        const stemEs = w.slice(0, -2);
        if (this.wordSet.has(stemEs)) {
          if (this.debug) {
            console.log(`[VALIDATION AUDIT] Extracted: "${input}" | Normalized: "${w}" | Plural Check: REJECTED (-ES plural of ${stemEs}) | Result: INVALID`);
          }
          return false;
        }
      }

      const stemS = w.slice(0, -1);
      if (this.wordSet.has(stemS)) {
        if (this.debug) {
          console.log(`[VALIDATION AUDIT] Extracted: "${input}" | Normalized: "${w}" | Plural Check: REJECTED (-S plural of ${stemS}) | Result: INVALID`);
        }
        return false;
      }
    }

    if (this.debug) {
      console.log(`[VALIDATION AUDIT] Extracted: "${input}" | Normalized: "${w}" | Dictionary: FOUND | Plural Check: PASSED | Result: VALID`);
    }

    return true;
  }

  /**
   * Get a concise 1-sentence dictionary definition for a word
   */
  getDefinition(word) {
    const w = this.normalizeWord(word);
    const rawDef = this.definitionsMap.get(w);
    
    if (rawDef && typeof rawDef === 'string' && rawDef.length > 3) {
      let first = rawDef.split('.')[0].trim();
      if (first && !first.endsWith('.')) first += '.';
      return first;
    }
    
    return 'A standard English dictionary word.';
  }

  /**
   * Check if a word is a common everyday English word
   */
  isCommonWord(word) {
    const w = this.normalizeWord(word);
    return this.commonWordsSet.has(w);
  }

  /**
   * Find valid words that match a candidate letter sequence
   */
  getValidSubstrings(sequence) {
    const valid = [];
    const seq = this.normalizeWord(sequence);
    const len = seq.length;

    for (let start = 0; start < len; start++) {
      for (let end = start + 1; end <= len; end++) {
        const sub = seq.slice(start, end);
        if (this.isValidWord(sub)) {
          valid.push({
            word: sub,
            startIndex: start,
            endIndex: end - 1,
            length: sub.length
          });
        }
      }
    }
    return valid;
  }

  get size() {
    return this.wordSet.size;
  }
}

export const dictionary = new DictionaryService();
