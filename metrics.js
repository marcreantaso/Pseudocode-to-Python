/* ============================================================
   PSEUDOPY — METRICS ENGINE (metrics.js)
   ────────────────────────────────────────────────────────────
   Formal Evaluation & Testing Module for Panel 1 Metrics:

     1. Accuracy            — exact-match against dataset.json
     2. Precision / Recall  — line-level overlap analysis
     3. Compilation Success  — % of inputs producing valid Python
     4. Runtime Error Rate   — errors / total_executions × 100
     5. Execution Time       — per-stage performance.now() timing
     6. % Improvement        — session-over-session comparison
     7. Error Reduction      — cumulative error trend tracking

   Constraint: Fully offline. Uses localStorage for persistence.
   ============================================================ */

class MetricsEngine {
    constructor() {
        // ── Session State ──
        this.sessionId = 'session_' + Date.now();
        this.translations = [];      // per-translation records
        this.executions = [];        // per-execution records
        this.benchmarkResults = null; // latest benchmark run

        // ── Load persisted history from localStorage ──
        this.history = this._loadHistory();
    }

    // ══════════════════════════════════════════════════════════════
    // PERSISTENCE — localStorage Read/Write
    // ══════════════════════════════════════════════════════════════

    _loadHistory() {
        try {
            const raw = localStorage.getItem('pseudopy_metrics_history');
            return raw ? JSON.parse(raw) : { sessions: [], benchmarks: [] };
        } catch (e) {
            console.warn('[Metrics] Failed to load history:', e);
            return { sessions: [], benchmarks: [] };
        }
    }

    _saveHistory() {
        try {
            localStorage.setItem('pseudopy_metrics_history', JSON.stringify(this.history));
        } catch (e) {
            console.warn('[Metrics] Failed to save history:', e);
        }
    }

    // ══════════════════════════════════════════════════════════════
    // TRANSLATION RECORDING
    // Called after every compile() invocation
    // ══════════════════════════════════════════════════════════════

    /**
     * Record a translation attempt with its metrics.
     * @param {object} compileResult — { valid, python, errors, warnings, metrics }
     * @param {string} inputCode — original pseudocode
     */
    recordTranslation(compileResult, inputCode) {
        const record = {
            timestamp: Date.now(),
            sessionId: this.sessionId,
            inputLength: inputCode.length,
            inputLines: inputCode.split('\n').length,
            valid: compileResult.valid,
            errorCount: compileResult.errors.length,
            warningCount: compileResult.warnings.length,
            outputLength: compileResult.python ? compileResult.python.length : 0,
            outputLines: compileResult.python ? compileResult.python.split('\n').length : 0,
            timing: compileResult.metrics || null,
            errors: compileResult.errors.map(e => ({
                line: e.line,
                message: e.message
            }))
        };

        this.translations.push(record);
        this._saveHistory();
        return record;
    }

    // ══════════════════════════════════════════════════════════════
    // EXECUTION RECORDING
    // Called after every Skulpt execution
    // ══════════════════════════════════════════════════════════════

    /**
     * Record a code execution outcome.
     * @param {boolean} success — true if Skulpt ran without errors
     * @param {string|null} errorMessage — runtime error message if any
     */
    recordExecution(success, errorMessage = null) {
        const record = {
            timestamp: Date.now(),
            sessionId: this.sessionId,
            success: success,
            error: errorMessage
        };

        this.executions.push(record);
        this._saveHistory();
        return record;
    }

    // ══════════════════════════════════════════════════════════════
    // SESSION METRICS — Aggregated Current Session Stats
    // ══════════════════════════════════════════════════════════════

    /**
     * Get aggregated metrics for the current session.
     * @returns {object} session stats
     */
    getSessionMetrics() {
        const totalTranslations = this.translations.length;
        const successfulTranslations = this.translations.filter(t => t.valid).length;
        const failedTranslations = totalTranslations - successfulTranslations;
        const compilationSuccessRate = totalTranslations > 0
            ? ((successfulTranslations / totalTranslations) * 100).toFixed(1)
            : '0.0';

        const totalExecutions = this.executions.length;
        const successfulExecutions = this.executions.filter(e => e.success).length;
        const failedExecutions = totalExecutions - successfulExecutions;
        const runtimeErrorRate = totalExecutions > 0
            ? ((failedExecutions / totalExecutions) * 100).toFixed(1)
            : '0.0';

        // Average generation time
        const timedTranslations = this.translations.filter(t => t.timing && t.timing.totalTime);
        const avgGenerationTime = timedTranslations.length > 0
            ? (timedTranslations.reduce((sum, t) => sum + t.timing.totalTime, 0) / timedTranslations.length).toFixed(2)
            : '0.00';

        // Total errors across all translations
        const totalErrors = this.translations.reduce((sum, t) => sum + t.errorCount, 0);
        const totalWarnings = this.translations.reduce((sum, t) => sum + t.warningCount, 0);

        // Error trend: compare first half vs second half of translations
        let errorTrend = 'stable';
        if (totalTranslations >= 4) {
            const mid = Math.floor(totalTranslations / 2);
            const firstHalfErrors = this.translations.slice(0, mid).reduce((s, t) => s + t.errorCount, 0);
            const secondHalfErrors = this.translations.slice(mid).reduce((s, t) => s + t.errorCount, 0);
            if (secondHalfErrors < firstHalfErrors) errorTrend = 'improving';
            else if (secondHalfErrors > firstHalfErrors) errorTrend = 'declining';
        }

        return {
            sessionId: this.sessionId,
            totalTranslations,
            successfulTranslations,
            failedTranslations,
            compilationSuccessRate: parseFloat(compilationSuccessRate),
            totalExecutions,
            successfulExecutions,
            failedExecutions,
            runtimeErrorRate: parseFloat(runtimeErrorRate),
            avgGenerationTime: parseFloat(avgGenerationTime),
            totalErrors,
            totalWarnings,
            errorTrend
        };
    }

    // ══════════════════════════════════════════════════════════════
    // IMPROVEMENT TRACKING
    // Compares first translation vs latest to show progress
    // ══════════════════════════════════════════════════════════════

    /**
     * Calculate improvement metrics over the session.
     * @returns {object} improvement data
     */
    getImprovementMetrics() {
        if (this.translations.length < 2) {
            return {
                hasData: false,
                message: 'Need at least 2 translations to calculate improvement.'
            };
        }

        const first = this.translations[0];
        const latest = this.translations[this.translations.length - 1];

        // Correctness improvement: fewer errors = better
        const firstErrors = first.errorCount;
        const latestErrors = latest.errorCount;
        let correctnessImprovement = 0;
        if (firstErrors > 0) {
            correctnessImprovement = ((firstErrors - latestErrors) / firstErrors * 100).toFixed(1);
        } else if (latestErrors === 0) {
            correctnessImprovement = 100;
        }

        // Generation speed improvement
        let speedImprovement = 0;
        if (first.timing && latest.timing && first.timing.totalTime > 0) {
            speedImprovement = ((first.timing.totalTime - latest.timing.totalTime) / first.timing.totalTime * 100).toFixed(1);
        }

        // Error rate reduction across the session
        const successfulTranslations = this.translations.filter(t => t.valid).length;
        const totalTranslations = this.translations.length;
        const overallSuccessRate = ((successfulTranslations / totalTranslations) * 100).toFixed(1);

        return {
            hasData: true,
            firstErrors,
            latestErrors,
            correctnessImprovement: parseFloat(correctnessImprovement),
            speedImprovement: parseFloat(speedImprovement),
            overallSuccessRate: parseFloat(overallSuccessRate),
            translationCount: totalTranslations
        };
    }

    // ══════════════════════════════════════════════════════════════
    // BENCHMARK RUNNER
    // Runs automated tests against dataset.json ground truth
    // ══════════════════════════════════════════════════════════════

    /**
     * Run full benchmark against the dataset ground truth.
     * @param {Array} dataset — array of { pseudocode, python_code } from dataset.json
     * @param {PseudocodeCompiler} compiler — compiler instance
     * @returns {object} benchmark results with accuracy, precision, recall
     */
    runBenchmark(dataset, compiler) {
        const results = [];
        let exactMatches = 0;
        let totalPrecision = 0;
        let totalRecall = 0;
        let compilationSuccesses = 0;
        let totalTimingMs = 0;

        for (const testCase of dataset) {
            const startTime = performance.now();
            const compileResult = compiler.compile(testCase.pseudocode);
            const endTime = performance.now();
            const elapsed = endTime - startTime;
            totalTimingMs += elapsed;

            const generated = compileResult.python || '';
            const expected = testCase.python_code || '';

            // ── Compilation Success ──
            const compiled = compileResult.valid;
            if (compiled) compilationSuccesses++;

            // ── Exact Match Accuracy ──
            const normalizedGenerated = this._normalizeCode(generated);
            const normalizedExpected = this._normalizeCode(expected);
            const exactMatch = normalizedGenerated === normalizedExpected;
            if (exactMatch) exactMatches++;

            // ── Line-Level Precision & Recall ──
            const { precision, recall } = this._calculatePrecisionRecall(generated, expected);
            totalPrecision += precision;
            totalRecall += recall;

            results.push({
                id: testCase.id,
                concept: testCase.concept,
                compiled,
                exactMatch,
                precision: parseFloat(precision.toFixed(3)),
                recall: parseFloat(recall.toFixed(3)),
                timeMs: parseFloat(elapsed.toFixed(2)),
                errorCount: compileResult.errors.length,
                warningCount: compileResult.warnings.length,
                generated: generated,
                expected: expected
            });
        }

        const n = dataset.length;
        const benchmarkData = {
            timestamp: Date.now(),
            dateString: new Date().toISOString().split('T')[0],
            totalTestCases: n,
            accuracy: parseFloat(((exactMatches / n) * 100).toFixed(1)),
            compilationSuccessRate: parseFloat(((compilationSuccesses / n) * 100).toFixed(1)),
            avgPrecision: parseFloat(((totalPrecision / n) * 100).toFixed(1)),
            avgRecall: parseFloat(((totalRecall / n) * 100).toFixed(1)),
            avgTimeMs: parseFloat((totalTimingMs / n).toFixed(2)),
            totalTimeMs: parseFloat(totalTimingMs.toFixed(2)),
            f1Score: 0,
            results
        };

        // ── F1 Score ──
        if (benchmarkData.avgPrecision + benchmarkData.avgRecall > 0) {
            benchmarkData.f1Score = parseFloat(
                ((2 * benchmarkData.avgPrecision * benchmarkData.avgRecall) /
                 (benchmarkData.avgPrecision + benchmarkData.avgRecall)).toFixed(1)
            );
        }

        this.benchmarkResults = benchmarkData;

        // ── Persist to history ──
        this.history.benchmarks.push({
            timestamp: benchmarkData.timestamp,
            accuracy: benchmarkData.accuracy,
            compilationSuccessRate: benchmarkData.compilationSuccessRate,
            avgPrecision: benchmarkData.avgPrecision,
            avgRecall: benchmarkData.avgRecall,
            f1Score: benchmarkData.f1Score,
            avgTimeMs: benchmarkData.avgTimeMs
        });
        this._saveHistory();

        return benchmarkData;
    }

    // ══════════════════════════════════════════════════════════════
    // PRECISION & RECALL — Line-Level Overlap Analysis
    // ══════════════════════════════════════════════════════════════

    /**
     * Calculate line-level precision and recall.
     *
     * Precision = |relevant ∩ generated| / |generated|
     *   "Of the lines we generated, how many are correct?"
     *
     * Recall = |relevant ∩ generated| / |relevant|
     *   "Of the expected lines, how many did we generate?"
     *
     * @param {string} generated — generated Python code
     * @param {string} expected — expected Python code from ground truth
     * @returns {{ precision: number, recall: number }}
     */
    _calculatePrecisionRecall(generated, expected) {
        const genLines = this._getCodeLines(generated);
        const expLines = this._getCodeLines(expected);

        if (genLines.length === 0 && expLines.length === 0) return { precision: 1, recall: 1 };
        if (genLines.length === 0) return { precision: 0, recall: 0 };
        if (expLines.length === 0) return { precision: 0, recall: 0 };

        // Count matches using normalized line comparison
        const expSet = new Set(expLines);
        const genSet = new Set(genLines);

        let relevantInGenerated = 0;
        for (const line of genLines) {
            if (expSet.has(line)) relevantInGenerated++;
        }

        let relevantInExpected = 0;
        for (const line of expLines) {
            if (genSet.has(line)) relevantInExpected++;
        }

        const precision = genLines.length > 0 ? relevantInGenerated / genLines.length : 0;
        const recall = expLines.length > 0 ? relevantInExpected / expLines.length : 0;

        return { precision, recall };
    }

    // ══════════════════════════════════════════════════════════════
    // NORMALIZATION UTILITIES
    // ══════════════════════════════════════════════════════════════

    /**
     * Normalize code for comparison: strip comments, normalize whitespace.
     */
    _normalizeCode(code) {
        return code
            .split('\n')
            .map(line => line.replace(/#.*$/, '').trim())  // strip comments
            .filter(line => line.length > 0)               // remove empties
            .join('\n')
            .replace(/\s+/g, ' ')                          // normalize whitespace
            .trim();
    }

    /**
     * Extract meaningful code lines (trimmed, no empties, no comments).
     */
    _getCodeLines(code) {
        return code
            .split('\n')
            .map(line => line.replace(/#.*$/, '').trim())
            .filter(line => line.length > 0);
    }

    // ══════════════════════════════════════════════════════════════
    // PIPELINE TIMING SUMMARY
    // Aggregates timing data across all recorded translations
    // ══════════════════════════════════════════════════════════════

    /**
     * Get average pipeline timing across all timed translations.
     * @returns {object} avg timing per stage
     */
    getAveragePipelineTiming() {
        const timed = this.translations.filter(t => t.timing);
        if (timed.length === 0) {
            return {
                count: 0,
                avgLexTime: 0,
                avgParseTime: 0,
                avgSemanticTime: 0,
                avgCodeGenTime: 0,
                avgTotalTime: 0
            };
        }

        const n = timed.length;
        return {
            count: n,
            avgLexTime: parseFloat((timed.reduce((s, t) => s + (t.timing.lexTime || 0), 0) / n).toFixed(3)),
            avgParseTime: parseFloat((timed.reduce((s, t) => s + (t.timing.parseTime || 0), 0) / n).toFixed(3)),
            avgSemanticTime: parseFloat((timed.reduce((s, t) => s + (t.timing.semanticTime || 0), 0) / n).toFixed(3)),
            avgCodeGenTime: parseFloat((timed.reduce((s, t) => s + (t.timing.codeGenTime || 0), 0) / n).toFixed(3)),
            avgTotalTime: parseFloat((timed.reduce((s, t) => s + (t.timing.totalTime || 0), 0) / n).toFixed(3))
        };
    }

    // ══════════════════════════════════════════════════════════════
    // HISTORICAL BENCHMARK TRENDS
    // ══════════════════════════════════════════════════════════════

    /**
     * Get all historical benchmark results for trend display.
     * @returns {Array} array of benchmark summaries
     */
    getBenchmarkHistory() {
        return this.history.benchmarks || [];
    }

    /**
     * Clear all historical data.
     */
    clearHistory() {
        this.history = { sessions: [], benchmarks: [] };
        this._saveHistory();
    }
}

// ── Global Instance ──
const metricsEngine = new MetricsEngine();
console.log('[Metrics] MetricsEngine initialized. Session:', metricsEngine.sessionId);
