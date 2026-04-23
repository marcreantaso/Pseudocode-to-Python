/* ============================================================
   PSEUDOPY — NATURAL LANGUAGE MAPPER (mapper.js)
   ────────────────────────────────────────────────────────────
   Converts unstructured natural language into structured 
   pseudocode using rule-based pattern matching. 
   Runs before lexical analysis.
   ============================================================ */

class NaturalLanguageMapper {
    constructor() {
        // Define mapping rules (regex pattern -> replacement string)
        this.rules = [
            // Assignment / Set
            { pattern: /^(?:set|make|assign|let)\s+(?:variable\s+)?([a-zA-Z_]\w*)\s+(?:to|equal to|be|=|as)\s+(.+)$/i, replacement: "SET $1 TO $2" },
            
            // Loop: For
            { pattern: /^(?:loop|iterate|for)\s+(?:from)\s+(.+)\s+to\s+(.+)$/i, replacement: "FOR i FROM $1 TO $2 DO" },
            { pattern: /^(?:loop|iterate|for)\s+([a-zA-Z_]\w*)\s+(?:from)\s+(.+)\s+to\s+(.+)$/i, replacement: "FOR $1 FROM $2 TO $3 DO" },
            
            // Loop: For Each
            { pattern: /^(?:loop|iterate|for)\s+(?:each|every)\s+([a-zA-Z_]\w*)\s+(?:in|inside)\s+(.+)$/i, replacement: "FOR EACH $1 IN $2 DO" },
            
            // Loop: While
            { pattern: /^(?:loop|iterate|while)\s+(?:as long as|while)\s+(.+)$/i, replacement: "WHILE $1 DO" },
            
            // Output / Print
            { pattern: /^(?:print|display|output|show)\s+(.+)$/i, replacement: "DISPLAY $1" },
            
            // Input / Read
            { pattern: /^(?:read|input|get|ask for)\s+(?:variable\s+)?([a-zA-Z_]\w*)$/i, replacement: "INPUT $1" },
            { pattern: /^(?:ask|prompt)\s+(?:user\s+)?for\s+([a-zA-Z_]\w*)$/i, replacement: "INPUT $1" },
            
            // Conditional: If
            { pattern: /^(?:if|check if|when)\s+(.+)$/i, replacement: "IF $1 THEN" },
            { pattern: /^(?:otherwise|else)$/i, replacement: "ELSE" },
            { pattern: /^(?:otherwise if|else if)\s+(.+)$/i, replacement: "ELSE IF $1 THEN" },
            
            // Blocks
            { pattern: /^(?:start|begin)$/i, replacement: "BEGIN" },
            { pattern: /^(?:stop|finish|end)$/i, replacement: "END" },
            { pattern: /^(?:end\s+if|close\s+if)$/i, replacement: "END IF" },
            { pattern: /^(?:end\s+loop|end\s+for|close\s+loop)$/i, replacement: "END FOR" },
            { pattern: /^(?:end\s+while|close\s+while)$/i, replacement: "END WHILE" },

            // Declaration
            { pattern: /^(?:declare|create)\s+(?:variable\s+)?([a-zA-Z_]\w*)\s+as\s+a?\s*([a-zA-Z_]+)$/i, replacement: "DECLARE $1 AS $2" }
        ];
    }

    /**
     * Map natural language text to structured pseudocode
     * @param {string} text - The input natural language code
     * @returns {string} The structured pseudocode
     */
    map(text) {
        if (!text) return text;
        const lines = text.split('\n');
        const mappedLines = lines.map(line => this.mapLine(line));
        return mappedLines.join('\n');
    }

    /**
     * Maps a single line using the defined rules
     */
    mapLine(line) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return line; // preserve whitespace and comments

        let result = trimmed;
        for (const rule of this.rules) {
            if (rule.pattern.test(result)) {
                result = result.replace(rule.pattern, rule.replacement);
                break; // Stop after first match to avoid compounding replacements
            }
        }
        
        // Restore leading whitespace for indentation
        const leadingWhitespace = line.match(/^\s*/)[0];
        return leadingWhitespace + result;
    }
}

// Global instance
const nlpMapper = new NaturalLanguageMapper();
console.log('[Mapper] NaturalLanguageMapper initialized.');
