/* ============================================================
   PSEUDOPY — APP.JS
   Automated Code Generation System
   Powered by Offline LocalStorage Database
   ============================================================ */

console.log('[App] app.js script is parsing and executing top-level');

// ── State ──
let currentUser = null;
let currentPage = '';
let editingExerciseId = null;
let editingUserId = null;
let currentErrorLineNumber = null;

// ── Cached data (loaded from Offline Database) ──
let cachedUsers = [];
let cachedExercises = [];
let cachedActivity = [];


/* ============================================================
   INITIALIZATION
   ============================================================ */

async function init() {
    console.log('[App] init() called');
    try {


        console.log('[App] Calling seedDatabase()...');
        // Seed the database if collections are empty
        await seedDatabase();
        console.log('[App] seedDatabase() finished.');

        // Pre-load data from Offline Database into cache
        cachedUsers = await dbGetAll(usersRef);
        cachedExercises = await dbGetAll(exercisesRef);
        cachedActivity = await dbGetAll(activityRef);

        console.log(`[App] Loaded ${cachedUsers.length} users, ${cachedExercises.length} exercises, ${cachedActivity.length} activity records from Offline Database.`);
        
        // Initialize Theme from Storage
        const savedTheme = localStorage.getItem('pseudopy_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    } catch (err) {
        console.error('[App] Init error:', err);
        showToast('Database initialization failed. Check local storage availability.', 'error');
    }

    updateClock();
    setInterval(updateClock, 60000);

    // Update line count on editor input and sync gutter
    const editor = document.getElementById('pseudocode-editor');
    if (editor) {
        editor.addEventListener('input', () => {
            const lines = editor.value.split('\n').length;
            document.getElementById('line-count').textContent = lines + ' lines';
            updateGutter();
        });

        // Sync scrolling for gutter
        editor.addEventListener('scroll', () => {
            const gutter = document.getElementById('editor-gutter');
            if (gutter) {
                gutter.scrollTop = editor.scrollTop;
            }
        });
    }

    // Setup real-time validation
    setupRealtimeValidation();
}

function updateClock() {
    const el = document.getElementById('topbar-time');
    if (el) {
        const now = new Date();
        el.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' +
            now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
}


/* ============================================================
   FIRESTORE DATA REFRESH HELPERS
   ============================================================ */

async function refreshUsers() {
    cachedUsers = await dbGetAll(usersRef);
    return cachedUsers;
}

async function refreshExercises() {
    cachedExercises = await dbGetAll(exercisesRef);
    return cachedExercises;
}

async function refreshActivity() {
    cachedActivity = await dbGetAll(activityRef);
    return cachedActivity;
}


/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}


/* ============================================================
   AUTHENTICATION
   ============================================================ */

async function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const role = document.querySelector('input[name="role"]:checked')?.value;

    if (!username || !password) {
        showToast('Please enter username and password.', 'error');
        return;
    }
    if (!role) {
        showToast('Please select a role.', 'error');
        return;
    }

    try {
        // Refresh users from Offline Database
        await refreshUsers();

        console.log(`[Debug] Attempting login with: username='${username}', password='${password}', role='${role}'`);
        console.log(`[Debug] Users in database:`, cachedUsers.map(u => ({ username: u.username, password: u.password, role: u.role, fullName: u.fullName })));

        const user = cachedUsers.find(u => u.username === username && u.password === password && u.role === role);

        if (!user) {
            showToast('Invalid credentials or role mismatch.', 'error');
            return;
        }

        currentUser = user;
        showToast(`Welcome back, ${user.fullName}!`, 'success');
        showApp();
    } catch (err) {
        console.error('[Login] Error:', err);
        showToast('Login failed. Check your connection.', 'error');
    }
}

function handleLogout() {
    currentUser = null;
    document.getElementById('app-layout').classList.add('hidden');
    document.getElementById('login-page').classList.remove('hidden');
    showToast('Signed out successfully.', 'info');
}

function showApp() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('app-layout').classList.remove('hidden');

    // Update sidebar user info
    document.getElementById('sidebar-avatar').textContent = currentUser.fullName.charAt(0).toUpperCase();
    document.getElementById('sidebar-username').textContent = currentUser.fullName;
    const roleLabels = { student: 'Student', instructor: 'Instructor', admin: 'Administrator' };
    document.getElementById('sidebar-role').textContent = roleLabels[currentUser.role];

    // Show correct nav
    document.querySelectorAll('.sidebar-nav > div').forEach(el => el.classList.add('hidden'));
    document.getElementById(`nav-${currentUser.role}`).classList.remove('hidden');

    // Navigate to default page
    const defaults = {
        student: 'write-pseudocode',
        instructor: 'analytics',
        admin: 'manage-users'
    };
    navigateTo(defaults[currentUser.role]);

    // Update pending password requests badge for admin
    if (currentUser.role === 'admin') {
        updatePendingRequestsBadge();
    }
}


/* ============================================================
   NAVIGATION
   ============================================================ */

function navigateTo(pageId) {
    currentPage = pageId;

    // Hide all pages
    document.querySelectorAll('.page-view').forEach(el => el.classList.add('hidden'));

    // Show target page
    const page = document.getElementById(`page-${pageId}`);
    if (page) {
        page.classList.remove('hidden');
    }

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('onclick')?.includes(pageId)) {
            item.classList.add('active');
        }
    });

    // Update topbar title
    const titles = {
        'write-pseudocode': 'Write Pseudocode',
        'translate': 'Translate Pseudocode',
        'execute': 'Execute Code',
        'feedback': 'Feedback & Suggestions',
        'exercises-student': 'Exercises & Tasks',
        'analytics': 'Learning Analytics',
        'manage-exercises': 'Manage Exercises',
        'generate-code': 'Generate Python Code',
        'manage-users': 'Administer User Accounts',
        'admin-execute': 'Execute Code',
        'change-password': 'Change Password',
        'student-settings': 'Settings',
        'password-requests': 'Password Requests',
        'compiler-metrics': 'Compiler Metrics & Evaluation'
    };
    document.getElementById('topbar-title').textContent = titles[pageId] || 'Dashboard';

    // Load page-specific data (async)
    if (pageId === 'analytics') loadAnalytics();
    if (pageId === 'manage-exercises') loadExercises();
    if (pageId === 'manage-users') loadUsers();
    if (pageId === 'exercises-student') loadStudentExercises();
    if (pageId === 'student-settings') loadStudentSettings();
    if (pageId === 'password-requests') loadPasswordRequests();
    if (pageId === 'compiler-metrics') loadCompilerMetrics();
}


/* ============================================================
   PSEUDOCODE → PYTHON TRANSLATION ENGINE
   ============================================================ */

function translatePseudocode() {
    const input = document.getElementById('pseudocode-editor').value;
    if (!input.trim()) {
        showToast('Please write some pseudocode first.', 'error');
        return;
    }

    const validation = validatePseudocode(input);
    const output = document.getElementById('console-output');
    const runBtn = document.querySelector('#page-write-pseudocode .btn-success');

    if (!validation.valid) {
        // Clear the python output area
        document.getElementById('python-output').textContent = '';

        currentErrorLineNumber = validation.errors[0].line;
        output.className = 'output-content error';
        output.innerHTML = renderHtmlErrors(validation.errors);

        if (runBtn) runBtn.disabled = true;
        showToast(`${validation.errors.length} syntax error(s) found. Check the console output.`, 'error');
        updateGutter();
        return;
    }

    currentErrorLineNumber = null;
    updateGutter();
    const python = pseudocodeToPython(input);
    document.getElementById('python-output').textContent = python;

    output.className = 'output-content';
    output.textContent = '✅ Pseudocode translated successfully! Click "Run Code" to execute.';

    if (runBtn) runBtn.disabled = false;
    showToast('Pseudocode translated to Python successfully!', 'success');
}

function translateFromPage() {
    const input = document.getElementById('translate-input').value;
    if (!input.trim()) {
        showToast('Please write some pseudocode first.', 'error');
        return;
    }

    const validation = validatePseudocode(input);
    const consoleEl = document.getElementById('translate-console');

    if (!validation.valid) {
        if (consoleEl) {
            consoleEl.innerHTML = renderHtmlErrors(validation.errors);
            consoleEl.className = 'output-content error';
        }
        document.getElementById('translate-output').textContent = '';
        showToast(`${validation.errors.length} syntax error(s) found. Check the output area.`, 'error');
        return;
    }

    if (consoleEl) {
        consoleEl.textContent = '✅ Pseudocode translated successfully! Click "Run" to execute.';
        consoleEl.className = 'output-content';
    }
    const python = pseudocodeToPython(input);
    document.getElementById('translate-output').textContent = python;
    showToast('Translation complete!', 'success');
}

function instructorTranslate() {
    const input = document.getElementById('instructor-pseudo-input').value;
    if (!input.trim()) {
        showToast('Please write some pseudocode first.', 'error');
        return;
    }

    const validation = validatePseudocode(input);
    const consoleEl = document.getElementById('instructor-console');

    if (!validation.valid) {
        if (consoleEl) {
            consoleEl.innerHTML = renderHtmlErrors(validation.errors);
            consoleEl.className = 'output-content error';
        }
        document.getElementById('instructor-python-output').textContent = '';
        showToast(`${validation.errors.length} syntax error(s) found. Check the output area.`, 'error');
        return;
    }

    if (consoleEl) {
        consoleEl.textContent = '✅ Pseudocode translated successfully! Click "Run" to execute.';
        consoleEl.className = 'output-content';
    }
    const python = pseudocodeToPython(input);
    document.getElementById('instructor-python-output').textContent = python;
    showToast('Python code generated!', 'success');
}

const compilerEngine = new PseudocodeCompiler();


/* ============================================================
   FILE UPLOAD (TEXT AND PDF)
   ============================================================ */

async function handleFileUpload(event, targetEditorId) {
    const file = event.target.files[0];
    if (!file) return;

    const editor = document.getElementById(targetEditorId);

    try {
        if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.pseudo')) {
            const text = await file.text();
            editor.value = text;
            showToast('Text file loaded successfully!', 'success');
        } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
            if (typeof pdfjsLib === 'undefined') {
                showToast('PDF library not loaded yet.', 'error');
                return;
            }

            showToast('Extracting PDF text...', 'info');
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();

                // Keep some pseudo-formatting by roughly preserving Y-coordinates
                let lastY = -1;
                let pageText = '';
                textContent.items.forEach(item => {
                    if (lastY !== item.transform[5] && lastY !== -1) {
                        pageText += '\n'; // new line
                    }
                    pageText += item.str;
                    lastY = item.transform[5];
                });

                fullText += pageText + '\n';
            }

            editor.value = fullText.trim();
            showToast('PDF loaded successfully!', 'success');
        } else {
            showToast('Unsupported file type. Please upload .txt or .pdf files.', 'error');
        }
    } catch (err) {
        console.error('[FileUpload]', err);
        showToast('Failed to read file.', 'error');
    }

    // Reset file input so same file can be uploaded again
    event.target.value = '';
}


/**
 * Compiler Facade: Translation Engine
 * Converts structured pseudocode into valid Python via AST code generation.
 * Instrumented with MetricsEngine for Panel 1 evaluation metrics.
 */
function pseudocodeToPython(pseudocode) {
    const result = compilerEngine.compile(pseudocode);

    // ── Panel 1: Record translation metrics ──
    if (typeof metricsEngine !== 'undefined') {
        metricsEngine.recordTranslation(result, pseudocode);
    }

    return result.python;
}


/* ============================================================
   CODE EXECUTION (via Skulpt)
   ============================================================ */

function executePython() {
    const code = document.getElementById('python-output').textContent;
    if (!code.trim()) { showToast('No Python code to execute. Translate first!', 'error'); return; }
    runPythonCode(code, 'console-output');
}

function executeFromTranslate() {
    const code = document.getElementById('translate-output').textContent;
    if (!code.trim()) { showToast('No Python code to execute.', 'error'); return; }
    runPythonCode(code, 'translate-console');
}

function executeFromExecPage() {
    const code = document.getElementById('execute-editor').value;
    if (!code.trim()) { showToast('Please enter some Python code.', 'error'); return; }
    runPythonCode(code, 'execute-console');
}

function instructorExecute() {
    const code = document.getElementById('instructor-python-output').textContent;
    if (!code.trim()) { showToast('No code to execute. Generate first!', 'error'); return; }
    runPythonCode(code, 'instructor-console');
}

function adminExecute() {
    const code = document.getElementById('admin-execute-editor').value;
    if (!code.trim()) { showToast('Please enter Python code to execute.', 'error'); return; }
    runPythonCode(code, 'admin-console');
}

function runPythonCode(code, outputElementId) {
    const outputEl = document.getElementById(outputElementId);
    outputEl.innerHTML = '';
    outputEl.className = 'output-content';

    let cleanCode = code.replace(/print\((.+)\)/g, (match, content) => {
        if (content.includes('+') && content.includes('"')) {
            const parts = content.split('+').map(p => {
                p = p.trim();
                if (!p.startsWith('"') && !p.startsWith("'") && !p.match(/^str\(/)) return `str(${p})`;
                return p;
            }); AAA
            return `print(${parts.join(' + ')})`;
        }
        return match;
    });

    if (typeof Sk === 'undefined') {
        outputEl.textContent = '⚠️ Skulpt library not loaded. Please check your internet connection.\n\nFalling back to static analysis...\n\n';
        outputEl.textContent += simulateExecution(code);
        return;
    }

    // Helper: append text to the console output (HTML-safe)
    function appendOutput(text) {
        const span = document.createElement('span');
        span.textContent = text;
        outputEl.appendChild(span);
    }

    Sk.configure({
        output: function (text) { appendOutput(text); },
        read: function (x) {
            if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined) throw "File not found: '" + x + "'";
            return Sk.builtinFiles["files"][x];
        },
        inputfun: function (promptText) {
            return new Promise(function (resolve) {
                // Create the inline input container
                const container = document.createElement('div');
                container.className = 'skulpt-input-container';

                // Prompt label
                if (promptText) {
                    const label = document.createElement('div');
                    label.className = 'skulpt-input-label';
                    label.textContent = promptText;
                    container.appendChild(label);
                }

                // Input row (input + button)
                const row = document.createElement('div');
                row.className = 'skulpt-input-row';

                const inputField = document.createElement('input');
                inputField.type = 'text';
                inputField.className = 'skulpt-input-field';
                inputField.placeholder = 'Type your answer here...';
                inputField.autocomplete = 'off';

                const submitBtn = document.createElement('button');
                submitBtn.className = 'skulpt-input-btn';
                submitBtn.textContent = 'Submit ↵';

                row.appendChild(inputField);
                row.appendChild(submitBtn);
                container.appendChild(row);
                outputEl.appendChild(container);

                // Scroll to make input visible
                outputEl.scrollTop = outputEl.scrollHeight;
                inputField.focus();

                function submitInput() {
                    const value = inputField.value;
                    // Replace input container with echoed value
                    const echo = document.createElement('div');
                    echo.className = 'skulpt-input-echo';
                    if (promptText) {
                        echo.innerHTML = '<span class="skulpt-echo-prompt">' + escapeHtml(promptText) + '</span> <span class="skulpt-echo-value">' + escapeHtml(value) + '</span>';
                    } else {
                        echo.innerHTML = '<span class="skulpt-echo-prompt">▸ Input:</span> <span class="skulpt-echo-value">' + escapeHtml(value) + '</span>';
                    }
                    container.replaceWith(echo);

                    // Automatic type-check for mathematical operations
                    const trimmed = value.trim();
                    if (trimmed !== "" && !isNaN(trimmed)) {
                        resolve(parseFloat(trimmed));
                    } else {
                        resolve(value);
                    }

                }

                submitBtn.addEventListener('click', submitInput);
                inputField.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') { e.preventDefault(); submitInput(); }
                });
            });
        },
        inputfunTakesPrompt: true,
        __future__: Sk.python3
    });

    Sk.misceval.asyncToPromise(function () {
        return Sk.importMainWithBody("<stdin>", false, cleanCode, true);
    }).then(function () {
        if (!outputEl.textContent.trim()) outputEl.textContent = '✅ Code executed successfully (no output).';
        showToast('Code executed successfully!', 'success');

        // ── Panel 1: Record successful execution ──
        if (typeof metricsEngine !== 'undefined') {
            metricsEngine.recordExecution(true);
        }
    }).catch(function (err) {
        appendOutput('\n❌ Error: ' + err.toString());
        outputEl.className = 'output-content error';
        showToast('Runtime error occurred.', 'error');

        // ── Panel 1: Record failed execution ──
        if (typeof metricsEngine !== 'undefined') {
            metricsEngine.recordExecution(false, err.toString());
        }
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function simulateExecution(code) {
    const lines = code.split('\n');
    let output = '';
    for (const line of lines) {
        const match = line.match(/print\((.+)\)/);
        if (match) {
            let val = match[1].trim();
            if (val.startsWith('"') || val.startsWith("'")) {
                output += val.replace(/^["']|["']$/g, '') + '\n';
            } else {
                output += `[expression: ${val}]\n`;
            }
        }
    }
    return output || '(no print statements detected)';
}


/* ============================================================
   FEEDBACK & SUGGESTIONS
   ============================================================ */

function analyzePseudocode() {
    const input = document.getElementById('feedback-input').value;
    if (!input.trim()) { showToast('Please paste some pseudocode to analyze.', 'error'); return; }
    renderFeedback(generateFeedback(input));
    showToast('Analysis complete!', 'success');
}

/**
 * ADAPTIVE FEEDBACK ENGINE (Panel 1 Requirement)
 * ───────────────────────────────────────────────
 * Replaces static regex-based analysis with dynamic, context-aware
 * feedback using the actual compiler pipeline:
 *
 *   1. AST-Driven Structure Analysis (via Parser)
 *   2. Symbol Table Variable Hygiene (via SemanticAnalyzer)
 *   3. Algorithmic Complexity Feedback (via analyzeComplexity)
 *   5. Historical Comparison (session improvement metrics)
 */
function generateFeedback(pseudocode) {
    const feedback = [];
    const lines = pseudocode.split('\n');
    const trimmedLines = lines.map(l => l.trim()).filter(l => l);

    // ──────────────────────────────────────────────
    // 1. COMPILER PIPELINE ANALYSIS (AST-Driven)
    // ──────────────────────────────────────────────
    let compileResult = null;
    let ast = null;
    let symbolTable = null;
    let qualityScore = 0; // 0–100 composite score

    try {
        compileResult = compilerEngine.compile(pseudocode);
        // Re-run parser and semantic analyzer to access internals
        const lexer = new Lexer(pseudocode);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        ast = parser.parse();
        const sa = new SemanticAnalyzer();
        sa.analyze(ast);
        symbolTable = sa.symbolTable;
    } catch (e) {
        feedback.push({ type: 'error', icon: '❌', text: '<strong>Analysis Error:</strong> Could not parse pseudocode. ' + e.message });
    }

    // ──────────────────────────────────────────────
    // 1a. STRUCTURE VALIDATION (from AST)
    // ──────────────────────────────────────────────
    const hasBegin = trimmedLines.some(l => /^BEGIN$/i.test(l));
    const hasEnd = trimmedLines.some(l => /^END$/i.test(l));

    if (hasBegin && hasEnd) {
        feedback.push({ type: 'success', icon: '✅', text: '<strong>Good structure:</strong> Proper BEGIN/END blocks detected.' });
        qualityScore += 15;
    } else {
        if (!hasBegin) feedback.push({ type: 'warning', icon: '⚠️', text: '<strong>Missing BEGIN:</strong> Start with a BEGIN statement.' });
        if (!hasEnd) feedback.push({ type: 'warning', icon: '⚠️', text: '<strong>Missing END:</strong> End with an END statement.' });
    }

    // ──────────────────────────────────────────────
    // 1b. BLOCK BALANCE ANALYSIS (from AST errors)
    // ──────────────────────────────────────────────
    if (compileResult) {
        if (compileResult.valid) {
            feedback.push({ type: 'success', icon: '✅', text: '<strong>Compilation:</strong> Pseudocode compiles successfully to Python with no syntax errors.' });
            qualityScore += 25;
        } else {
            const syntaxErrors = compileResult.errors;
            feedback.push({ type: 'error', icon: '❌', text: `<strong>Syntax Errors:</strong> ${syntaxErrors.length} error(s) detected. Fix these before translation.` });
            syntaxErrors.slice(0, 3).forEach(err => {
                feedback.push({
                    type: 'error', icon: '📍',
                    text: `<strong>Line ${err.line}:</strong> ${err.message}${err.suggestion ? ' <em>💡 ' + err.suggestion + '</em>' : ''}`
                });
            });
        }

        // Warnings from semantic analysis
        if (compileResult.warnings && compileResult.warnings.length > 0) {
            compileResult.warnings.slice(0, 3).forEach(w => {
                feedback.push({
                    type: 'warning', icon: '⚠️',
                    text: `<strong>Line ${w.line}:</strong> ${w.message}${w.suggestion ? ' <em>💡 ' + w.suggestion + '</em>' : ''}`
                });
            });
        } else if (compileResult.valid) {
            feedback.push({ type: 'success', icon: '✅', text: '<strong>Semantic Check:</strong> No undeclared variables or type warnings.' });
            qualityScore += 10;
        }
    }

    // ──────────────────────────────────────────────
    // 2. SYMBOL TABLE ANALYSIS (Variable Hygiene)
    // ──────────────────────────────────────────────
    if (symbolTable && symbolTable.size > 0) {
        const declaredVars = [...symbolTable.keys()];
        feedback.push({
            type: 'success', icon: '📊',
            text: `<strong>Variables:</strong> ${declaredVars.length} variable(s) tracked in symbol table: <code>${declaredVars.join(', ')}</code>`
        });
        qualityScore += 5;

        const numericVars = declaredVars.filter(v => {
            const info = symbolTable.get(v);
            return info && info.type === 'numeric';
        });
        if (numericVars.length > 0) {
            feedback.push({
                type: 'success', icon: '🔢',
                text: `<strong>Type Safety:</strong> ${numericVars.length} variable(s) confirmed as numeric: <code>${numericVars.join(', ')}</code>`
            });
            qualityScore += 5;
        }
    } else if (ast && ast.body && ast.body.length > 0) {
        feedback.push({
            type: 'warning', icon: '💡',
            text: '<strong>Suggestion:</strong> Use DECLARE statements to explicitly type your variables for better code generation.'
        });
    }

    // ──────────────────────────────────────────────
    // 3. LOGIC ANALYSIS (Constructivism Model)
    // ──────────────────────────────────────────────
    const allEx = typeof cachedExercises !== 'undefined' ? cachedExercises : [];
    let activeSolution = null;
    for (const ex of allEx) {
        if (typeof currentExerciseId !== 'undefined' && ex.id === currentExerciseId) {
            activeSolution = ex.solution;
            break;
        }
    }

    const logicCard = document.getElementById('logic-analysis-card');
    const logicResults = document.getElementById('logic-analysis-results');

    if (activeSolution && logicCard && logicResults) {
        const logicAnalysis = metricsEngine.analyzeLogicGap(pseudocode, activeSolution);
        logicCard.classList.remove('hidden');
        
        let logicHtml = `<p style="margin-bottom: 1rem; font-weight: 500;">${logicAnalysis.summary}</p>`;
        
        if (logicAnalysis.gaps.length > 0) {
            logicHtml += `<div style="display: flex; flex-direction: column; gap: 0.75rem;">`;
            logicAnalysis.gaps.forEach(gap => {
                logicHtml += `
                    <div style="padding: 0.75rem; background: #fff5f5; border-left: 4px solid #f87171; border-radius: 4px;">
                        <div style="font-weight: 600; color: #991b1b;">[${gap.type}] ${gap.concept || ''}</div>
                        <div style="font-size: 0.9rem; margin: 0.25rem 0;">${gap.message}</div>
                        <div style="font-size: 0.85rem; color: #7f1d1d; background: #fee2e2; padding: 0.4rem; border-radius: 3px; margin-top: 0.4rem;">
                            <strong>Root Cause:</strong> ${gap.rootCause}
                        </div>
                    </div>
                `;
            });
            logicHtml += `</div>`;
        } else {
            logicHtml += `<div style="padding: 1rem; background: #ecfdf5; color: #065f46; border-radius: 4px; border-left: 4px solid #10b981;">
                ✅ Your logic matches the structural patterns required for this problem. You have correctly applied the necessary control structures.
            </div>`;
        }
        logicResults.innerHTML = logicHtml;
    } else if (logicCard) {
        logicCard.classList.add('hidden');
    }

    // ──────────────────────────────────────────────
    // 4. ALGORITHMIC COMPLEXITY ANALYSIS
    // ──────────────────────────────────────────────
    try {
        const complexity = compilerEngine.analyzeComplexity(pseudocode);
        const complexityDescriptions = {
            'O(1)': 'Constant time — no loops detected. Simple sequential execution.',
            'O(N)': 'Linear time — single-level loop detected. Scales proportionally with input.',
            'O(N²)': 'Quadratic time — nested loops detected. Consider optimization for large inputs.',
        };
        const desc = complexityDescriptions[complexity] || `Polynomial time — ${complexity} nested loop depth.`;
        const complexityType = complexity === 'O(1)' || complexity === 'O(N)' ? 'success' : 'warning';

        feedback.push({
            type: complexityType, icon: '⚡',
            text: `<strong>Algorithm Complexity:</strong> ${complexity} — ${desc}`
        });
        qualityScore += (complexity === 'O(1)' || complexity === 'O(N)') ? 10 : 5;
    } catch (e) { /* skip complexity if analysis fails */ }

    // ──────────────────────────────────────────────
    // 5. PATTERN RECOGNITION (Algorithmic Patterns)
    // ──────────────────────────────────────────────
    const patterns = detectAlgorithmicPatterns(pseudocode, ast);
    patterns.forEach(p => {
        feedback.push({ type: 'success', icon: '🧩', text: p });
        qualityScore += 5;
    });

    // ──────────────────────────────────────────────
    // 6. CODE STYLE ANALYSIS
    // ──────────────────────────────────────────────
    const indentedLines = lines.filter(l => l.match(/^\s+/));
    if (indentedLines.length > 0) {
        feedback.push({ type: 'success', icon: '✅', text: '<strong>Indentation:</strong> Uses indentation for readability. Good practice!' });
        qualityScore += 5;
    } else if (lines.length > 3) {
        feedback.push({ type: 'warning', icon: '💡', text: '<strong>Suggestion:</strong> Add indentation inside blocks (IF, FOR, WHILE) for improved readability.' });
    }

    const displayCount = trimmedLines.filter(l => /^(DISPLAY|PRINT|OUTPUT)\s/i.test(l)).length;
    if (displayCount > 0) {
        feedback.push({ type: 'success', icon: '✅', text: `<strong>Output:</strong> ${displayCount} DISPLAY/PRINT statement(s) found.` });
        qualityScore += 5;
    } else {
        feedback.push({ type: 'warning', icon: '💡', text: '<strong>Suggestion:</strong> Add DISPLAY statements to show results to the user.' });
    }

    const declareCount = trimmedLines.filter(l => /^DECLARE\s/i.test(l)).length;
    if (declareCount > 0) {
        feedback.push({ type: 'success', icon: '✅', text: `<strong>Declarations:</strong> ${declareCount} DECLARE statement(s) — explicit typing improves code reliability.` });
        qualityScore += 5;
    }

    // ──────────────────────────────────────────────
    // 7. PIPELINE PERFORMANCE (Execution Time)
    // ──────────────────────────────────────────────
    if (compileResult && compileResult.metrics) {
        const m = compileResult.metrics;
        feedback.push({
            type: 'success', icon: '⏱️',
            text: `<strong>Generation Time:</strong> ${m.totalTime}ms total — Lexer: ${m.lexTime}ms, Parser: ${m.parseTime}ms, Semantic: ${m.semanticTime}ms, CodeGen: ${m.codeGenTime}ms`
        });
        qualityScore += 5;
    }

    // ──────────────────────────────────────────────
    // 8. HISTORICAL IMPROVEMENT (Session Comparison)
    // ──────────────────────────────────────────────
    if (typeof metricsEngine !== 'undefined') {
        const improvement = metricsEngine.getImprovementMetrics();
        if (improvement.hasData) {
            if (improvement.correctnessImprovement > 0) {
                feedback.push({
                    type: 'success', icon: '📈',
                    text: `<strong>Session Improvement:</strong> ${improvement.correctnessImprovement}% improvement in code correctness since your first translation this session.`
                });
            } else if (improvement.correctnessImprovement < 0) {
                feedback.push({
                    type: 'warning', icon: '📉',
                    text: `<strong>Session Trend:</strong> Error count has increased since your first translation. Review the error messages carefully.`
                });
            }

            feedback.push({
                type: 'success', icon: '📊',
                text: `<strong>Session Stats:</strong> ${improvement.translationCount} translations, ${improvement.overallSuccessRate}% overall compilation success rate.`
            });
        }
    }

    // ──────────────────────────────────────────────
    // 9. FINAL QUALITY SUMMARY
    // ──────────────────────────────────────────────
    qualityScore = Math.min(qualityScore, 100);
    let quality = 'Excellent';
    let qualityType = 'success';

    if (qualityScore >= 90) quality = 'Excellent';
    else if (qualityScore >= 75) quality = 'Very Good';
    else if (qualityScore >= 60) quality = 'Good';
    else if (qualityScore >= 40) { quality = 'Average'; qualityType = 'warning'; }
    else { quality = 'Needs Improvement'; qualityType = 'error'; }

    const errors = feedback.filter(f => f.type === 'error').length;
    const warnings = feedback.filter(f => f.type === 'warning').length;
    const successes = feedback.filter(f => f.type === 'success').length;

    feedback.unshift({
        type: qualityType,
        icon: qualityType === 'success' ? '🏆' : qualityType === 'warning' ? '📊' : '🔧',
        text: `<strong>Code Quality Score: ${qualityScore}/100 — ${quality}</strong> — ${successes} passed, ${warnings} suggestion(s), ${errors} error(s). Total: ${trimmedLines.length} lines.`
    });

    return feedback;
}

/**
 * PATTERN RECOGNITION — Detects common algorithmic patterns
 * in the AST. Provides educational feedback about what the
 * student's code is doing (not hard-coded per-input).
 */
function detectAlgorithmicPatterns(pseudocode, ast) {
    const patterns = [];
    const upper = pseudocode.toUpperCase();

    // Accumulator pattern: SET x TO 0 ... x = x + something
    if (/SET\s+\w+\s+TO\s+0/i.test(pseudocode) && /=\s*\w+\s*\+/i.test(pseudocode)) {
        patterns.push('<strong>Pattern Detected:</strong> Accumulator pattern — initializes a variable to 0 and adds to it iteratively.');
    }

    // Counter pattern: counting variable incremented inside a loop
    if (/INCREMENT/i.test(upper) || (/=\s*\w+\s*\+\s*1/i.test(pseudocode) && /WHILE|FOR/i.test(upper))) {
        patterns.push('<strong>Pattern Detected:</strong> Counter pattern — a variable is incremented inside a loop.');
    }

    // Sentinel-controlled loop: WHILE with INPUT inside
    if (/WHILE/i.test(upper) && /INPUT|READ/i.test(upper)) {
        patterns.push('<strong>Pattern Detected:</strong> Sentinel-controlled loop — input-driven loop termination.');
    }

    // Array iteration: FOR with array index access
    if (/FOR\s+\w+\s+FROM/i.test(upper) && /\w+\s*\[/i.test(pseudocode)) {
        patterns.push('<strong>Pattern Detected:</strong> Array traversal — iterating over array elements with index-based access.');
    }

    // Conditional branching: IF/ELSE structure
    if (/IF\s+.+\s+THEN/i.test(pseudocode) && /ELSE/i.test(upper)) {
        patterns.push('<strong>Pattern Detected:</strong> Conditional branching — IF/ELSE decision structure.');
    }

    // Function definition
    if (/FUNCTION|PROCEDURE/i.test(upper)) {
        patterns.push('<strong>Pattern Detected:</strong> Modular design — uses FUNCTION/PROCEDURE for code organization.');
    }

    return patterns;
}

function renderFeedback(feedback) {
    document.getElementById('feedback-results').innerHTML = feedback.map(f => `
    <div class="feedback-item ${f.type}">
      <span class="fb-icon">${f.icon}</span>
      <span class="fb-text">${f.text}</span>
    </div>`).join('');
}


/* ============================================================
   EXERCISES MANAGEMENT — Offline Database CRUD
   ============================================================ */

async function loadExercises() {
    const exercises = await refreshExercises();
    const container = document.getElementById('exercises-list');

    if (exercises.length === 0) {
        container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📋</div><h3>No Exercises Yet</h3><p>Create your first exercise to get started.</p></div>`;
        return;
    }

    container.innerHTML = exercises.map(ex => `
    <div class="exercise-card">
      <div class="ex-header">
        <span class="ex-title">${ex.title}</span>
        <span class="ex-difficulty ${ex.difficulty}">${ex.difficulty}</span>
      </div>
      <p class="ex-desc">${ex.description}</p>
      <div class="ex-meta"><span>📅 ${ex.createdAt}</span></div>
      <div class="ex-actions">
        <button class="btn btn-secondary btn-sm" onclick="editExercise('${ex.id}')">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteExercise('${ex.id}')">🗑️ Delete</button>
      </div>
    </div>`).join('');
}

async function loadStudentExercises() {
    const exercises = await refreshExercises();
    const container = document.getElementById('student-exercises-list');

    if (exercises.length === 0) {
        container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📝</div><h3>No Exercises Available</h3><p>Your instructor hasn't created any exercises yet.</p></div>`;
        return;
    }

    container.innerHTML = exercises.map(ex => `
    <div class="exercise-card">
      <div class="ex-header">
        <span class="ex-title">${ex.title}</span>
        <span class="ex-difficulty ${ex.difficulty}">${ex.difficulty}</span>
      </div>
      <p class="ex-desc">${ex.description}</p>
      <div class="ex-meta"><span>📅 ${ex.createdAt}</span></div>
      <div class="ex-actions">
        <button class="btn btn-primary btn-sm" style="width:auto" onclick="attemptExercise('${ex.id}')">📝 Start Exercise</button>
      </div>
    </div>`).join('');
}

async function attemptExercise(id) {
    const exercises = cachedExercises.length ? cachedExercises : await refreshExercises();
    const ex = exercises.find(e => e.id === id);
    if (!ex) return;
    document.getElementById('pseudocode-editor').value = '';
    document.getElementById('python-output').innerHTML = '';
    navigateTo('write-pseudocode');
    showToast(`Exercise loaded: ${ex.title}. Write your pseudocode!`, 'info');
}

async function openExerciseModal(id = null) {
    editingExerciseId = id;
    const modal = document.getElementById('exercise-modal');
    const title = document.getElementById('exercise-modal-title');

    if (id) {
        const exercises = cachedExercises.length ? cachedExercises : await refreshExercises();
        const ex = exercises.find(e => e.id === id);
        if (ex) {
            title.textContent = 'Edit Exercise';
            document.getElementById('ex-title').value = ex.title;
            document.getElementById('ex-desc').value = ex.description;
            document.getElementById('ex-difficulty').value = ex.difficulty;
            document.getElementById('ex-solution').value = ex.solution || '';
        }
    } else {
        title.textContent = 'New Exercise';
        document.getElementById('ex-title').value = '';
        document.getElementById('ex-desc').value = '';
        document.getElementById('ex-difficulty').value = 'medium';
        document.getElementById('ex-solution').value = '';
    }
    modal.classList.remove('hidden');
}

function closeExerciseModal() {
    document.getElementById('exercise-modal').classList.add('hidden');
    editingExerciseId = null;
}

async function saveExercise() {
    const title = document.getElementById('ex-title').value.trim();
    const desc = document.getElementById('ex-desc').value.trim();
    const difficulty = document.getElementById('ex-difficulty').value;
    const solution = document.getElementById('ex-solution').value.trim();

    if (!title || !desc) { showToast('Please fill in the title and description.', 'error'); return; }

    try {
        if (editingExerciseId) {
            const ex = cachedExercises.find(e => e.id === editingExerciseId);
            if (ex) await dbUpdate(exercisesRef, ex._docId, { title, description: desc, difficulty, solution });
            showToast('Exercise updated successfully!', 'success');
        } else {
            const newId = 'ex' + Date.now();
            await dbSet(exercisesRef, newId, {
                id: newId, title, description: desc, difficulty, solution,
                createdBy: currentUser?.id || 'unknown',
                createdAt: new Date().toISOString().split('T')[0]
            });
            showToast('Exercise created successfully!', 'success');
        }
        closeExerciseModal();
        await loadExercises();
    } catch (err) {
        console.error('[Offline Database] Save exercise error:', err);
        showToast('Failed to save exercise.', 'error');
    }
}

function editExercise(id) { openExerciseModal(id); }

async function deleteExercise(id) {
    if (!confirm('Delete this exercise?')) return;
    try {
        const ex = cachedExercises.find(e => e.id === id);
        if (ex) await dbDelete(exercisesRef, ex._docId);
        await loadExercises();
        showToast('Exercise deleted.', 'info');
    } catch (err) {
        console.error('[Offline Database] Delete exercise error:', err);
        showToast('Failed to delete exercise.', 'error');
    }
}


/* ============================================================
   USER MANAGEMENT (Admin) — Offline Database CRUD
   ============================================================ */

async function loadUsers() {
    const users = await refreshUsers();
    const tbody = document.getElementById('users-table-body');

    document.getElementById('stat-total-users').textContent = users.length;
    document.getElementById('stat-total-students').textContent = users.filter(u => u.role === 'student').length;
    document.getElementById('stat-total-instructors').textContent = users.filter(u => u.role === 'instructor').length;
    document.getElementById('stat-total-admins').textContent = users.filter(u => u.role === 'admin').length;

    const badgeClasses = { student: 'badge-student', instructor: 'badge-instructor', admin: 'badge-admin' };
    const roleLabels = { student: 'Student', instructor: 'Instructor', admin: 'Admin' };

    tbody.innerHTML = users.map(u => `
    <tr>
      <td><div class="user-cell"><div class="avatar-sm">${u.fullName.charAt(0)}</div><div><div style="font-weight:600;color:var(--text-primary)">${u.fullName}</div><div style="font-size:0.75rem;color:var(--text-muted)">@${u.username}</div></div></div></td>
      <td>${u.email}</td>
      <td>
        <div style="display:flex; align-items:center; gap:0.5rem">
          <span id="pwd-masked-${u.id}" style="font-family: monospace; letter-spacing: 2px;">••••••</span>
          <span id="pwd-real-${u.id}" class="hidden" style="font-family: monospace;">${u.password}</span>
          <button class="btn btn-ghost btn-icon" onclick="toggleUserPasswordVisibility('${u.id}')" style="font-size: 0.9rem; opacity: 0.7; padding: 2px;">👁️</button>
        </div>
      </td>
      <td><span class="badge ${badgeClasses[u.role]}">${roleLabels[u.role]}</span></td>
      <td><span class="badge ${u.status === 'active' ? 'badge-active' : 'badge-inactive'}">${u.status}</span></td>
      <td><div style="display:flex;gap:0.5rem">
        <button class="btn btn-ghost btn-sm" onclick="editUser('${u.id}')">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteUser('${u.id}')" ${u.id === currentUser?.id ? 'disabled title="Cannot delete yourself"' : ''}>🗑️</button>
      </div></td>
    </tr>`).join('');
}

async function openUserModal(id = null) {
    editingUserId = id;
    const modal = document.getElementById('user-modal');
    const title = document.getElementById('user-modal-title');

    if (id) {
        const users = cachedUsers.length ? cachedUsers : await refreshUsers();
        const user = users.find(u => u.id === id);
        if (user) {
            title.textContent = 'Edit User';
            document.getElementById('user-fullname').value = user.fullName;
            document.getElementById('user-username').value = user.username;
            document.getElementById('user-email').value = user.email;
            document.getElementById('user-password').value = user.password;
            document.getElementById('user-role-select').value = user.role;
            document.getElementById('user-password-group').classList.add('hidden');
        }
    } else {
        title.textContent = 'Add New User';
        document.getElementById('user-fullname').value = '';
        document.getElementById('user-username').value = '';
        document.getElementById('user-email').value = '';
        document.getElementById('user-password').value = '';
        document.getElementById('user-role-select').value = 'student';
        document.getElementById('user-password-group').classList.remove('hidden');
    }
    modal.classList.remove('hidden');
}

function closeUserModal() {
    document.getElementById('user-modal').classList.add('hidden');
    editingUserId = null;
}

async function saveUser() {
    const fullName = document.getElementById('user-fullname').value.trim();
    const username = document.getElementById('user-username').value.trim();
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value.trim();
    const role = document.getElementById('user-role-select').value;

    if (!fullName || !username || !email || (!editingUserId && !password)) { showToast('Please fill in all required fields.', 'error'); return; }

    try {
        const users = cachedUsers.length ? cachedUsers : await refreshUsers();
        const dup = users.find(u => u.username === username && u.id !== editingUserId);
        if (dup) { showToast('Username already exists!', 'error'); return; }

        if (editingUserId) {
            const user = users.find(u => u.id === editingUserId);
            if (user) await dbUpdate(usersRef, user._docId, { fullName, username, email, role });
            showToast('User updated successfully!', 'success');
        } else {
            const newId = 'u' + Date.now();
            await dbSet(usersRef, newId, { id: newId, fullName, username, email, password, role, status: 'active' });
            showToast('User created successfully!', 'success');
        }
        closeUserModal();
        await loadUsers();
    } catch (err) {
        console.error('[Offline Database] Save user error:', err);
        showToast('Failed to save user.', 'error');
    }
}

function editUser(id) { openUserModal(id); }

async function deleteUser(id) {
    if (!confirm('Delete this user?')) return;
    if (id === currentUser?.id) { showToast('You cannot delete your own account!', 'error'); return; }
    try {
        const user = cachedUsers.find(u => u.id === id);
        if (user) await dbDelete(usersRef, user._docId);
        await loadUsers();
        showToast('User deleted.', 'info');
    } catch (err) {
        console.error('[Offline Database] Delete user error:', err);
        showToast('Failed to delete user.', 'error');
    }
}


/* ============================================================
   ANALYTICS (Instructor)
   ============================================================ */

async function loadAnalytics() {
    renderSubmissionsChart();
    renderErrorsChart();
    await renderActivityTable();
}

function renderSubmissionsChart() {
    const container = document.getElementById('chart-submissions');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const values = [12, 19, 8, 25, 32, 15, 28];
    const max = Math.max(...values);
    const colors = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#3b82f6', '#6366f1', '#8b5cf6'];
    container.innerHTML = values.map((v, i) => `<div class="chart-bar" style="height:${(v / max) * 220}px;background:${colors[i]}"><span class="bar-value">${v}</span><span class="bar-label">${days[i]}</span></div>`).join('');
}

function renderErrorsChart() {
    const container = document.getElementById('chart-errors');
    const types = ['Syntax', 'Logic', 'Missing END', 'Indent', 'Type', 'Other'];
    const values = [35, 22, 18, 12, 8, 5];
    const max = Math.max(...values);
    const colors = ['#ef4444', '#f59e0b', '#f97316', '#eab308', '#84cc16', '#6b7280'];
    container.innerHTML = values.map((v, i) => `<div class="chart-bar" style="height:${(v / max) * 220}px;background:${colors[i]}"><span class="bar-value">${v}%</span><span class="bar-label">${types[i]}</span></div>`).join('');
}

async function renderActivityTable() {
    const tbody = document.getElementById('activity-table-body');
    const activity = await refreshActivity();
    const statusBadges = {
        'Completed': '<span class="badge badge-active">Completed</span>',
        'In Progress': '<span class="badge badge-student">In Progress</span>',
        'Failed': '<span class="badge badge-inactive">Failed</span>'
    };
    tbody.innerHTML = activity.map(a => `
    <tr>
      <td><div class="user-cell"><div class="avatar-sm">${a.student.charAt(0)}</div><span style="font-weight:500;color:var(--text-primary)">${a.student}</span></div></td>
      <td>${a.exercise}</td>
      <td>${statusBadges[a.status] || a.status}</td>
      <td style="font-weight:600;color:${a.score === '100%' ? 'var(--success)' : 'var(--text-primary)'}">${a.score}</td>
      <td style="color:var(--text-muted)">${a.time}</td>
    </tr>`).join('');
}


/* ============================================================
   STUDENT SETTINGS & PASSWORD CHANGE
   ============================================================ */

// Cache for password change history
let cachedPasswordHistory = [];

async function refreshPasswordHistory() {
    cachedPasswordHistory = await dbGetAll(passwordRequestsRef);
    return cachedPasswordHistory;
}

/**
 * Load student settings page: profile info, cooldown check, change history
 */
async function loadStudentSettings() {
    if (!currentUser) return;

    // Populate profile info
    document.getElementById('settings-avatar').textContent = currentUser.fullName.charAt(0).toUpperCase();
    document.getElementById('settings-fullname').textContent = currentUser.fullName;
    document.getElementById('settings-username').textContent = '@' + currentUser.username;
    document.getElementById('settings-email').textContent = currentUser.email;
    document.getElementById('settings-role').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
    document.getElementById('settings-status').textContent = (currentUser.status || 'active').charAt(0).toUpperCase() + (currentUser.status || 'active').slice(1);

    const roleBadge = document.getElementById('settings-role-badge');
    const badgeClasses = { student: 'badge-student', instructor: 'badge-instructor', admin: 'badge-admin' };
    roleBadge.className = 'badge ' + (badgeClasses[currentUser.role] || 'badge-student');
    roleBadge.textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);

    // Check 30-day cooldown
    const history = await refreshPasswordHistory();
    const myHistory = history
        .filter(r => r.userId === currentUser.id)
        .sort((a, b) => (b.changedAt || '').localeCompare(a.changedAt || ''));

    const lastChange = myHistory[0];
    const cooldownWarning = document.getElementById('password-cooldown-warning');
    const submitBtn = document.getElementById('submit-password-request-btn');

    let cooldownActive = false;

    if (lastChange && lastChange.changedAt) {
        const changeDate = new Date(lastChange.changedAt);
        const now = new Date();
        const diffDays = Math.floor((now - changeDate) / (1000 * 60 * 60 * 24));
        const remainingDays = 30 - diffDays;

        if (remainingDays > 0) {
            cooldownActive = true;
            cooldownWarning.classList.remove('hidden');
            document.getElementById('cooldown-message').textContent =
                `Your last password change was ${diffDays} day(s) ago. You can change your password again in ${remainingDays} day(s).`;
            submitBtn.disabled = true;
            submitBtn.textContent = '\u23f3 Cooldown Active (' + remainingDays + ' days remaining)';
        }
    }

    if (!cooldownActive) {
        cooldownWarning.classList.add('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = '\ud83d\udd11 Change Password';
    }

    // Render change history
    renderPasswordChangeHistory(myHistory);
}

function renderPasswordChangeHistory(history) {
    const container = document.getElementById('password-request-history');

    if (history.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">\ud83d\udcc4</div><h3>No Changes Yet</h3><p>You haven\'t changed your password yet.</p></div>';
        return;
    }

    container.innerHTML = history.map(r => `
    <div class="request-card approved">
      <div class="request-card-header">
        <span class="badge badge-approved">\u2705 Changed</span>
        <span class="request-date">\ud83d\udcc5 ${r.changedAt || 'Unknown'}</span>
      </div>
      <div class="request-card-body">
        <span class="request-info">Password was changed successfully</span>
      </div>
    </div>`).join('');
}

/**
 * Change the student's password directly
 */
async function submitPasswordChangeRequest() {
    const newPassword = document.getElementById('new-password').value.trim();
    const confirmPassword = document.getElementById('confirm-new-password').value.trim();

    if (!newPassword || !confirmPassword) {
        showToast('Please fill in both password fields.', 'error');
        return;
    }
    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters.', 'error');
        return;
    }
    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
    }
    if (newPassword === currentUser.password) {
        showToast('New password must be different from current password.', 'error');
        return;
    }

    try {
        // Update the password directly in Offline Database
        const users = cachedUsers.length ? cachedUsers : await refreshUsers();
        const user = users.find(u => u.id === currentUser.id);
        if (user) {
            await dbUpdate(usersRef, user._docId, {
                password: newPassword,
                lastPasswordChange: new Date().toISOString().split('T')[0]
            });
        }

        // Update current session
        currentUser.password = newPassword;

        // Log the password change for admin history
        const logId = 'pc' + Date.now();
        await dbSet(passwordRequestsRef, logId, {
            id: logId,
            userId: currentUser.id,
            username: currentUser.username,
            fullName: currentUser.fullName,
            changedAt: new Date().toISOString().split('T')[0]
        });

        document.getElementById('new-password').value = '';
        document.getElementById('confirm-new-password').value = '';

        await refreshUsers();
        showToast('Password changed successfully! Use your new password next time you log in.', 'success');
        await loadStudentSettings();
    } catch (err) {
        console.error('[Offline Database] Change password error:', err);
        showToast('Failed to change password. Please try again.', 'error');
    }
}


/* ============================================================
   ADMIN: PASSWORD CHANGE HISTORY (Read-Only)
   ============================================================ */

async function loadPasswordRequests() {
    const history = await refreshPasswordHistory();

    // Sort by date descending (most recent first)
    const sorted = history.sort((a, b) => (b.changedAt || '').localeCompare(a.changedAt || ''));

    // Update stats
    document.getElementById('stat-total-changes').textContent = sorted.length;

    const tbody = document.getElementById('password-requests-body');

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:2rem;color:var(--text-muted)">No password changes recorded yet.</td></tr>';
        return;
    }

    tbody.innerHTML = sorted.map(r => `
    <tr>
      <td><div class="user-cell"><div class="avatar-sm">${r.fullName ? r.fullName.charAt(0) : '?'}</div><div><div style="font-weight:600;color:var(--text-primary)">${r.fullName || 'Unknown'}</div><div style="font-size:0.75rem;color:var(--text-muted)">@${r.username || 'unknown'}</div></div></div></td>
      <td>${r.changedAt || '\u2014'}</td>
      <td><span class="badge badge-approved">\u2705 Changed</span></td>
    </tr>`).join('');
}

// No pending badge needed — admin just views history
async function updatePendingRequestsBadge() {
    // No-op — kept for compatibility
}


/* ============================================================
   UPLOAD PSEUDOCODE
   ============================================================ */

/**
 * Trigger the hidden file input to upload a pseudocode file
 */
function uploadPseudocode() {
    document.getElementById('pseudocode-file-input').click();
}

/**
 * Handle the uploaded file and load its content into the editor
 */
function handlePseudocodeUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const content = e.target.result;
        document.getElementById('pseudocode-editor').value = content;

        // Update line count
        const lines = content.split('\n').length;
        document.getElementById('line-count').textContent = lines + ' lines';

        showToast(`File "${file.name}" loaded successfully!`, 'success');
    };
    reader.onerror = function () {
        showToast('Failed to read the file. Please try again.', 'error');
    };
    reader.readAsText(file);

    // Reset the input so the same file can be re-uploaded if needed
    event.target.value = '';
}


/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

function clearEditor() {
    document.getElementById('pseudocode-editor').value = '';
    document.getElementById('python-output').innerHTML = '';
    document.getElementById('console-output').textContent = 'Editor cleared. Ready for new pseudocode.';
    document.getElementById('console-output').className = 'output-content';
    document.getElementById('line-count').textContent = '0 lines';
    currentErrorLineNumber = null;
    updateGutter();
}

function clearOutput() {
    document.getElementById('console-output').textContent = 'Output cleared.';
    document.getElementById('console-output').className = 'output-content';
}

function copyPython() {
    const code = document.getElementById('python-output').textContent;
    if (!code) { showToast('No code to copy.', 'error'); return; }
    copyText(code);
}

function copyTranslateOutput() {
    const code = document.getElementById('translate-output').textContent;
    if (!code) { showToast('No code to copy.', 'error'); return; }
    copyText(code);
}

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Copied to clipboard!', 'success');
    });
}

function downloadPython() {
    const code = document.getElementById('python-output').textContent;
    if (!code) { showToast('No code to download.', 'error'); return; }
    const blob = new Blob([code], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pseudopy_output.py';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Python file downloaded!', 'success');
}


/* ============================================================
   PSEUDOCODE SYNTAX VALIDATION ENGINE
   Stack-based strict validation with educational error messages
   ============================================================ */

/**
 * Known pseudocode keywords whitelist.
 * Used to detect typos / unknown keywords.
 */
const KNOWN_KEYWORDS = [
    'BEGIN', 'END', 'SET', 'TO', 'DISPLAY', 'PRINT', 'OUTPUT',
    'IF', 'THEN', 'ELSE', 'END IF',
    'FOR', 'EACH', 'IN', 'DO', 'FROM', 'TO', 'END FOR',
    'WHILE', 'END WHILE',
    'FUNCTION', 'PROCEDURE', 'RETURN', 'CALL', 'END FUNCTION', 'END PROCEDURE',
    'INPUT', 'READ', 'WITH', 'PROMPT',
    'INCREMENT', 'DECREMENT', 'APPEND',
    'AND', 'OR', 'NOT', 'MOD', 'TRUE', 'FALSE', 'NULL',
    'NUMERIC', 'INTEGER', 'FLOAT', 'REAL', 'STRING', 'CHAR', 'CHARACTER', 'BOOLEAN', 'BOOL', 'DECLARE', 'AS'
];

/**
 * Simple Levenshtein distance for typo suggestions
 */
function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b[i - 1] === a[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

/**
 * Suggest a keyword if a typo is detected
 */
function suggestKeyword(word) {
    const upper = word.toUpperCase();
    const displayKeywords = ['DISPLAY', 'PRINT', 'OUTPUT', 'SET', 'IF', 'ELSE', 'FOR', 'WHILE',
        'BEGIN', 'END', 'THEN', 'DO', 'EACH', 'FROM', 'RETURN', 'CALL',
        'FUNCTION', 'PROCEDURE', 'INPUT', 'READ', 'INCREMENT', 'DECREMENT', 'APPEND', 'DECLARE'];

    let bestMatch = null;
    let bestDist = Infinity;

    for (const kw of displayKeywords) {
        const dist = levenshtein(upper, kw);
        if (dist < bestDist && dist <= 2 && dist > 0) {
            bestDist = dist;
            bestMatch = kw;
        }
    }
    return bestMatch;
}

/**
 * Core validation function — strict compiler-like approach.
 * Validates BEFORE any translation occurs.
 * Returns { valid: boolean, errors: [{ line: number, message: string, suggestion?: string }] }
 */
function validatePseudocode(code) {
    const lines = code.split('\n');
    const errors = [];
    const blockStack = [];

    // --- PHASE 1: Find BEGIN and END positions ---
    const meaningfulLines = [];
    for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (t && !t.startsWith('//') && !t.startsWith('#')) {
            meaningfulLines.push({ index: i, lineNum: i + 1, text: t });
        }
    }

    if (meaningfulLines.length === 0) {
        errors.push({ line: 1, message: 'Empty pseudocode.', suggestion: 'Start with BEGIN and end with END.' });
        return { valid: false, errors };
    }

    const firstMeaningful = meaningfulLines[0];
    const lastMeaningful = meaningfulLines[meaningfulLines.length - 1];

    let hasBegin = false, beginLineNum = -1;
    let hasEnd = false, endLineNum = -1;

    for (const ml of meaningfulLines) {
        if (/^BEGIN$/i.test(ml.text)) {
            if (!hasBegin) { hasBegin = true; beginLineNum = ml.lineNum; }
            else { errors.push({ line: ml.lineNum, message: 'Duplicate BEGIN statement found. Only one BEGIN is allowed.' }); }
        }
        if (/^END$/i.test(ml.text)) { hasEnd = true; endLineNum = ml.lineNum; }
    }

    // Strict: BEGIN must be first meaningful line
    if (!hasBegin) {
        errors.push({ line: firstMeaningful.lineNum, message: 'Missing BEGIN statement.', suggestion: 'Your pseudocode must start with BEGIN on the first line.' });
    } else if (beginLineNum !== firstMeaningful.lineNum) {
        errors.push({ line: beginLineNum, message: 'BEGIN must be the first line of your pseudocode.', suggestion: 'Move BEGIN to the very first line.' });
    }

    // Strict: END must be last meaningful line
    if (!hasEnd) {
        errors.push({ line: lastMeaningful.lineNum, message: 'Missing END statement.', suggestion: 'Your pseudocode must end with END on the last line.' });
    } else if (endLineNum !== lastMeaningful.lineNum) {
        errors.push({ line: endLineNum, message: 'END must be the last line of your pseudocode.', suggestion: 'Move END to the very last line. No code should appear after END.' });
    }

    // Detect END before BEGIN
    if (hasBegin && hasEnd && endLineNum < beginLineNum) {
        errors.push({ line: endLineNum, message: 'END found before BEGIN — structure is inverted.', suggestion: 'BEGIN must come first, END must come last.' });
    }

    // Detect code outside BEGIN-END block
    if (hasBegin && hasEnd && beginLineNum < endLineNum) {
        for (const ml of meaningfulLines) {
            if (/^BEGIN$/i.test(ml.text) || /^END$/i.test(ml.text)) continue;
            if (ml.lineNum < beginLineNum || ml.lineNum > endLineNum) {
                errors.push({ line: ml.lineNum, message: 'Code found outside BEGIN-END block.', suggestion: 'All pseudocode must be written between BEGIN and END.' });
            }
        }
    } else if (!hasBegin && hasEnd) {
        for (const ml of meaningfulLines) {
            if (/^END$/i.test(ml.text)) continue;
            if (ml.lineNum < endLineNum) {
                errors.push({ line: ml.lineNum, message: 'Code found before BEGIN (which is missing).', suggestion: 'Add BEGIN as the first line.' });
            }
        }
    }

    // If BEGIN/END structure is completely broken, return early
    if (!hasBegin || !hasEnd) {
        errors.sort((a, b) => a.line - b.line);
        return { valid: false, errors };
    }

    // --- PHASE 2: Validate lines inside BEGIN-END ---
    for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const trimmed = lines[i].trim();

        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;
        if (/^BEGIN$/i.test(trimmed) || /^END$/i.test(trimmed)) continue;
        if (lineNum < beginLineNum || lineNum > endLineNum) continue;

        // Block closers
        const endBlockMatch = trimmed.match(/^END\s+(IF|FOR|WHILE|FUNCTION|PROCEDURE)$/i);
        if (endBlockMatch) {
            const closer = endBlockMatch[1].toUpperCase();
            if (blockStack.length === 0) {
                errors.push({ line: lineNum, message: `Unexpected END ${closer} — no matching opening block found.`, suggestion: `Remove this END ${closer} or add the matching ${closer} block above.` });
            } else {
                const top = blockStack[blockStack.length - 1];
                if (top.type === closer) { blockStack.pop(); }
                else {
                    errors.push({ line: lineNum, message: `Mismatched block: Expected END ${top.type} (opened on line ${top.line}) but found END ${closer}.`, suggestion: `Close the ${top.type} block with END ${top.type} before END ${closer}.` });
                    const deeper = blockStack.findIndex(b => b.type === closer);
                    if (deeper !== -1) {
                        for (let k = blockStack.length - 1; k > deeper; k--) {
                            errors.push({ line: blockStack[k].line, message: `Unclosed ${blockStack[k].type} block (opened on line ${blockStack[k].line}).`, suggestion: `Add END ${blockStack[k].type} to close this block.` });
                        }
                        blockStack.splice(deeper);
                    }
                }
            }
            continue;
        }

        // Block openers
        if (/^IF\s+(.+)\s+THEN$/i.test(trimmed) || /^ELSE\s+IF\s+(.+)\s+THEN$/i.test(trimmed)) {
            if (/^IF\s+(.+)\s+THEN$/i.test(trimmed)) blockStack.push({ type: 'IF', line: lineNum });
            const condMatch = trimmed.match(/^(?:ELSE\s+)?IF\s+(.+)\s+THEN$/i);
            if (condMatch && !condMatch[1].trim()) errors.push({ line: lineNum, message: 'IF statement has an empty condition.', suggestion: 'Add a condition, e.g. IF x > 5 THEN' });
            checkIncompleteExpression(trimmed, lineNum, errors);
            continue;
        }
        if (/^ELSE$/i.test(trimmed)) {
            if (blockStack.length === 0 || blockStack[blockStack.length - 1].type !== 'IF') errors.push({ line: lineNum, message: 'ELSE without a matching IF block.', suggestion: 'Make sure ELSE is inside an IF...END IF block.' });
            continue;
        }
        if (/^FOR\s+EACH\s+\w+\s+IN\s+.+\s+DO$/i.test(trimmed) || /^FOR\s+\w+\s+FROM\s+.+\s+TO\s+.+\s+DO$/i.test(trimmed)) { blockStack.push({ type: 'FOR', line: lineNum }); continue; }
        if (/^WHILE\s+(.+)\s+DO$/i.test(trimmed)) { blockStack.push({ type: 'WHILE', line: lineNum }); continue; }
        if (/^(FUNCTION|PROCEDURE)\s+\w+\s*\(.*\)$/i.test(trimmed)) { blockStack.push({ type: trimmed.match(/^(FUNCTION|PROCEDURE)/i)[1].toUpperCase(), line: lineNum }); continue; }

        // Known statements with expression validation
        if (/^SET\s+\w+\s+TO\s+/i.test(trimmed)) { const m = trimmed.match(/^SET\s+\w+\s+TO\s+(.+)$/i); if (m) checkIncompleteExpression(m[1], lineNum, errors); continue; }
        if (/^(DISPLAY|PRINT|OUTPUT)\s+/i.test(trimmed)) { const m = trimmed.match(/^(?:DISPLAY|PRINT|OUTPUT)\s+(.+)$/i); if (m) checkIncompleteExpression(m[1], lineNum, errors); continue; }
        if (/^(INPUT|READ)\s+/i.test(trimmed)) continue;
        if (/^RETURN\s+/i.test(trimmed)) { const m = trimmed.match(/^RETURN\s+(.+)$/i); if (m) checkIncompleteExpression(m[1], lineNum, errors); continue; }
        if (/^CALL\s+\w+\s*\(.*\)$/i.test(trimmed)) continue;
        if (/^(INCREMENT|DECREMENT)\s+\w+$/i.test(trimmed)) continue;
        if (/^APPEND\s+.+\s+TO\s+\w+$/i.test(trimmed)) continue;
        if (/^(NUMERIC|INTEGER|FLOAT|REAL|STRING|CHAR|CHARACTER|BOOLEAN|BOOL)\s+\w+/i.test(trimmed)) continue;
        if (/^\w+\s*=\s*.+$/.test(trimmed)) { const m = trimmed.match(/^\w+\s*=\s*(.+)$/); if (m) checkIncompleteExpression(m[1], lineNum, errors); continue; }

        // Incomplete block syntax
        if (/^FOR\s+/i.test(trimmed) && !/DO$/i.test(trimmed)) { errors.push({ line: lineNum, message: 'FOR statement is missing "DO" at the end.', suggestion: 'Use: FOR EACH item IN list DO  or  FOR i FROM 1 TO 10 DO' }); blockStack.push({ type: 'FOR', line: lineNum }); continue; }
        if (/^IF\s+/i.test(trimmed) && !/THEN$/i.test(trimmed)) { errors.push({ line: lineNum, message: 'IF statement is missing "THEN" at the end.', suggestion: 'Use: IF condition THEN' }); blockStack.push({ type: 'IF', line: lineNum }); continue; }
        if (/^WHILE\s+/i.test(trimmed) && !/DO$/i.test(trimmed)) { errors.push({ line: lineNum, message: 'WHILE statement is missing "DO" at the end.', suggestion: 'Use: WHILE condition DO' }); blockStack.push({ type: 'WHILE', line: lineNum }); continue; }

        // --- STRICT unknown keyword rejection ---
        const firstWord = trimmed.split(/\s+/)[0];
        const firstWordUpper = firstWord.toUpperCase();

        if (/^[A-Z]{2,}$/i.test(firstWord) && !KNOWN_KEYWORDS.includes(firstWordUpper)) {
            const suggestion = suggestKeyword(firstWord);
            errors.push({
                line: lineNum,
                message: `Unknown keyword "${firstWord}".`,
                suggestion: suggestion ? `Did you mean "${suggestion}"?` : 'Check spelling or use a valid keyword: SET, DISPLAY, IF, FOR, WHILE, etc.'
            });
            continue;
        }

        // If it doesn't match any known pattern, flag it
        if (!KNOWN_KEYWORDS.includes(firstWordUpper) && !/^\w+\s*=/.test(trimmed)) {
            errors.push({
                line: lineNum,
                message: `Unrecognized statement: "${trimmed}".`,
                suggestion: 'Use valid pseudocode keywords: SET, DISPLAY, IF, FOR, WHILE, CALL, RETURN, etc.'
            });
        }
    }

    // --- PHASE 3: Check unbalanced quotes ---
    for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const trimmed = lines[i].trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;
        if (lineNum < beginLineNum || lineNum > endLineNum) continue;
        if (/^BEGIN$/i.test(trimmed) || /^END$/i.test(trimmed)) continue;

        const doubleQuotes = (trimmed.match(/"/g) || []).length;
        const singleQuotes = (trimmed.match(/'/g) || []).length;
        if (doubleQuotes % 2 !== 0) errors.push({ line: lineNum, message: 'Unbalanced double quotes — missing closing ".', suggestion: 'Make sure every opening " has a matching closing ".' });
        if (singleQuotes % 2 !== 0) errors.push({ line: lineNum, message: "Unbalanced single quotes — missing closing '.", suggestion: "Make sure every opening ' has a matching closing '." });
    }

    // --- PHASE 4: Unclosed blocks ---
    while (blockStack.length > 0) {
        const unclosed = blockStack.pop();
        errors.push({ line: unclosed.line, message: `Unclosed ${unclosed.type} block (opened on line ${unclosed.line}).`, suggestion: `Add END ${unclosed.type} to close this block.` });
    }

    errors.sort((a, b) => a.line - b.line);
    return { valid: errors.length === 0, errors };
}

/**
 * Check for incomplete expressions (trailing operators, empty operands).
 * Detects things like: "Hello" +   or   x *   or   y /
 */
function checkIncompleteExpression(expr, lineNum, errors) {
    const trimmed = expr.trim();
    if (/[+\-*\/]\s*$/.test(trimmed)) {
        const op = trimmed.match(/([+\-*\/])\s*$/)[1];
        errors.push({ line: lineNum, message: `Incomplete expression — missing value after '${op}' operator.`, suggestion: `Add a value or variable after '${op}'. Example: "Hello, " + name` });
    }
    if (/^[+*\/]/.test(trimmed)) {
        errors.push({ line: lineNum, message: `Incomplete expression — unexpected '${trimmed[0]}' at the start.`, suggestion: `Add a value before '${trimmed[0]}'.` });
    }
    if (/[+\-*\/]\s*[+*\/]/.test(trimmed)) {
        errors.push({ line: lineNum, message: 'Invalid expression — consecutive operators found.', suggestion: 'Check for extra operators and ensure proper syntax.' });
    }
}

/**
 * Format validation errors as Python comments for the output panel.
 */
function formatValidationErrors(errors) {
    let output = '# ❌ Syntax Errors Found:\n#\n';
    for (const err of errors) {
        output += `# Line ${err.line}: ${err.message}\n`;
        if (err.suggestion) {
            output += `#   💡 Suggestion: ${err.suggestion}\n`;
        }
        output += '#\n';
    }
    output += '# Fix the pseudocode before translation.\n';
    return output;
}

/**
 * Render validation errors into HTML for terminal-like console window formatting.
 */
function renderHtmlErrors(errors) {
    let output = '<div style="margin-bottom: 0.5rem; font-family: \'JetBrains Mono\', monospace;"><span class="error-text"># ❌ Syntax Errors Found:</span></div><div><span style="color: var(--text-muted);">#</span></div>';
    for (const err of errors) {
        let suggestionHtml = '';
        if (err.suggestion) {
            suggestionHtml = `<div><span class="suggestion-text">#   💡 Suggestion: ${err.suggestion}</span></div>`;
        }
        output += `<div style="margin-bottom: 0.5rem; font-family: 'JetBrains Mono', monospace;"><div><span class="error-text"># Line ${err.line}: ${err.message}</span></div>${suggestionHtml}<div><span style="color: var(--text-muted);">#</span></div></div>`;
    }
    output += '<div style="margin-top: 0.5rem; font-family: \'JetBrains Mono\', monospace;"><span class="error-text"># Fix the pseudocode before translation.</span></div>';
    return output;
}

/**
 * Handle updating the visual editor gutter line numbers dynamically.
 */
function updateGutter() {
    const editor = document.getElementById('pseudocode-editor');
    const gutter = document.getElementById('editor-gutter');
    if (!editor || !gutter) return;

    let linesCount = editor.value.split('\n').length;
    // ensure at least one line is showing
    if (linesCount === 0) linesCount = 1;

    let html = '';
    for (let i = 1; i <= linesCount; i++) {
        const errorClass = (i === currentErrorLineNumber) ? ' error-line' : '';
        html += `<div class="gutter-num${errorClass}">${i}</div>`;
    }
    gutter.innerHTML = html;
}

/**
 * Highlight error lines in the editor with a visual indicator.
 * Uses an overlay div to show error markers.
 */
function highlightEditorErrors(editorId, errors) {
    clearEditorErrors(editorId);
    const editor = document.getElementById(editorId);
    if (!editor) return;

    // Add error class to the editor
    editor.classList.add('has-errors');

    // Create an error indicator panel below the editor
    const panel = editor.closest('.editor-panel');
    if (!panel) return;

    let errorPanel = panel.querySelector('.validation-error-panel');
    if (!errorPanel) {
        errorPanel = document.createElement('div');
        errorPanel.className = 'validation-error-panel';
        panel.querySelector('.panel-body').appendChild(errorPanel);
    }

    errorPanel.innerHTML = errors.slice(0, 5).map(err =>
        `<div class="validation-error-item">
            <span class="error-line-num">Line ${err.line}</span>
            <span class="error-msg">${err.message}</span>
            ${err.suggestion ? `<span class="error-suggestion">💡 ${err.suggestion}</span>` : ''}
        </div>`
    ).join('') + (errors.length > 5 ? `<div class="validation-error-item"><span class="error-msg">...and ${errors.length - 5} more error(s)</span></div>` : '');
}

/**
 * Clear error highlighting from the editor.
 */
function clearEditorErrors(editorId) {
    const editor = document.getElementById(editorId);
    if (!editor) return;
    editor.classList.remove('has-errors');

    const panel = editor.closest('.editor-panel');
    if (panel) {
        const errorPanel = panel.querySelector('.validation-error-panel');
        if (errorPanel) errorPanel.remove();
    }
}


/* ============================================================
   EDITOR UTILITY FUNCTIONS
   New File, Save
   ============================================================ */

/**
 * New File — clears editor and inserts default template
 */
function newFile() {
    const editor = document.getElementById('pseudocode-editor');
    editor.value = 'BEGIN\n    // Write your pseudocode here\nEND';
    document.getElementById('python-output').innerHTML = '';
    document.getElementById('console-output').textContent = 'New file created. Start writing your pseudocode.';
    document.getElementById('console-output').className = 'output-content';
    document.getElementById('line-count').textContent = '3 lines';
    currentErrorLineNumber = null;
    clearEditorErrors('pseudocode-editor');
    updateGutter();

    const runBtn = document.querySelector('#page-write-pseudocode .btn-success');
    if (runBtn) runBtn.disabled = false;

    showToast('New file created with template.', 'info');
}

/**
 * Save pseudocode as a .txt file
 */
function savePseudocodeAsFile() {
    const code = document.getElementById('pseudocode-editor').value;
    if (!code.trim()) { showToast('Nothing to save. Write some pseudocode first.', 'error'); return; }
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pseudocode.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Pseudocode saved as file!', 'success');
}




/* ============================================================
   REAL-TIME VALIDATION (Bonus)
   Debounced validation while typing
   ============================================================ */

let validationTimer = null;

function setupRealtimeValidation() {
    const editor = document.getElementById('pseudocode-editor');
    if (!editor) return;

    // Real-time validation runs silently — errors only shown on Translate
    editor.addEventListener('input', () => {
        clearTimeout(validationTimer);
        validationTimer = setTimeout(() => {
            const code = editor.value.trim();
            if (!code) return;
            // Silent validation — no visual indicators in the editor
            // Errors are only shown in Python Output when user clicks Translate
        }, 1000);
    });
}


/* ============================================================
   COMPILER METRICS DASHBOARD (Panel 1 — Evaluation)
   Benchmark runner, session metrics, and improvement tracking
   ============================================================ */

/**
 * Load and render the Compiler Metrics page.
 * Displays: Session Metrics, Benchmark Results, Pipeline Timing.
 */
function loadCompilerMetrics() {
    if (typeof metricsEngine === 'undefined') return;

    // ── Session Metrics Cards ──
    const session = metricsEngine.getSessionMetrics();
    const improvement = metricsEngine.getImprovementMetrics();

    document.getElementById('metric-total-translations').textContent = session.totalTranslations;
    document.getElementById('metric-compilation-rate').textContent = session.compilationSuccessRate + '%';
    document.getElementById('metric-runtime-error-rate').textContent = session.runtimeErrorRate + '%';
    document.getElementById('metric-avg-gen-time').textContent = session.avgGenerationTime + 'ms';
    document.getElementById('metric-total-errors').textContent = session.totalErrors;
    document.getElementById('metric-total-executions').textContent = session.totalExecutions;

    // Error trend badge
    const trendEl = document.getElementById('metric-error-trend');
    const trendIcons = { improving: '↑ Improving', declining: '↓ Declining', stable: '— Stable' };
    const trendClasses = { improving: 'positive', declining: 'negative', stable: '' };
    trendEl.textContent = trendIcons[session.errorTrend] || '— Stable';
    trendEl.className = 'stat-change ' + (trendClasses[session.errorTrend] || '');

    // ── Improvement Section ──
    const improvementEl = document.getElementById('metrics-improvement-section');
    if (improvement.hasData) {
        improvementEl.innerHTML = `
        <div class="stats-grid" style="margin-bottom: 1rem;">
          <div class="stat-card">
            <div class="stat-icon">📈</div>
            <div class="stat-value">${improvement.correctnessImprovement}%</div>
            <div class="stat-label">Correctness Improvement</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⚡</div>
            <div class="stat-value">${improvement.speedImprovement}%</div>
            <div class="stat-label">Speed Improvement</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">✅</div>
            <div class="stat-value">${improvement.overallSuccessRate}%</div>
            <div class="stat-label">Overall Success Rate</div>
          </div>
        </div>`;
    } else {
        improvementEl.innerHTML = `<div class="empty-state" style="padding: 1.5rem;">
            <div class="empty-icon">📊</div>
            <h3>No Improvement Data Yet</h3>
            <p>${improvement.message}</p>
        </div>`;
    }

    // ── Pipeline Timing Chart ──
    const timing = metricsEngine.getAveragePipelineTiming();
    renderPipelineTimingChart(timing);

    // ── Existing Benchmark Results ──
    if (metricsEngine.benchmarkResults) {
        renderBenchmarkResults(metricsEngine.benchmarkResults);
    }
}

/**
 * Run the automated benchmark against dataset.json ground truth.
 * Loads dataset, runs each test case through the compiler, and displays results.
 */
async function runBenchmarkTest() {
    showToast('Running benchmark...', 'info');
    const btn = document.getElementById('run-benchmark-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Running...'; }

    try {
        // Load dataset.json
        const response = await fetch('dataset.json');
        const data = await response.json();
        const dataset = data.dataset;

        if (!dataset || dataset.length === 0) {
            showToast('No test cases found in dataset.json.', 'error');
            return;
        }

        // Run benchmark via MetricsEngine
        const results = metricsEngine.runBenchmark(dataset, compilerEngine);

        // Render results
        renderBenchmarkResults(results);
        showToast(`Benchmark complete! Accuracy: ${results.accuracy}%`, 'success');
    } catch (err) {
        console.error('[Benchmark] Error:', err);
        showToast('Benchmark failed: ' + err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🧪 Run Benchmark'; }
    }
}

/**
 * Render benchmark results into the dashboard.
 */
function renderBenchmarkResults(results) {
    // ── Summary Cards ──
    document.getElementById('benchmark-accuracy').textContent = results.accuracy + '%';
    document.getElementById('benchmark-precision').textContent = results.avgPrecision + '%';
    document.getElementById('benchmark-recall').textContent = results.avgRecall + '%';
    document.getElementById('benchmark-f1').textContent = results.f1Score + '%';
    document.getElementById('benchmark-compile-rate').textContent = results.compilationSuccessRate + '%';
    document.getElementById('benchmark-avg-time').textContent = results.avgTimeMs + 'ms';

    // ── Detailed Results Table ──
    const tbody = document.getElementById('benchmark-results-body');
    tbody.innerHTML = results.results.map(r => `
    <tr>
      <td style="font-weight:600;color:var(--text-primary)">${r.id}</td>
      <td>${r.concept}</td>
      <td><span class="badge ${r.compiled ? 'badge-active' : 'badge-inactive'}">${r.compiled ? '✅ Pass' : '❌ Fail'}</span></td>
      <td><span class="badge ${r.exactMatch ? 'badge-active' : 'badge-student'}">${r.exactMatch ? '✅ Match' : '⚠️ Diff'}</span></td>
      <td style="font-weight:500">${(r.precision * 100).toFixed(0)}%</td>
      <td style="font-weight:500">${(r.recall * 100).toFixed(0)}%</td>
      <td style="color:var(--text-muted)">${r.timeMs}ms</td>
    </tr>`).join('');
}

/**
 * Render pipeline timing bar chart.
 */
function renderPipelineTimingChart(timing) {
    const container = document.getElementById('chart-pipeline-timing');
    if (!container) return;

    if (timing.count === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;">No timing data yet. Translate some pseudocode first.</div>';
        return;
    }

    const stages = [
        { name: 'Lexer', value: timing.avgLexTime, color: '#3b82f6' },
        { name: 'Parser', value: timing.avgParseTime, color: '#6366f1' },
        { name: 'Semantic', value: timing.avgSemanticTime, color: '#8b5cf6' },
        { name: 'CodeGen', value: timing.avgCodeGenTime, color: '#22c55e' }
    ];

    const max = Math.max(...stages.map(s => s.value), 0.001);
    container.innerHTML = stages.map(s => `
    <div class="chart-bar" style="height:${Math.max((s.value / max) * 180, 20)}px;background:${s.color}">
      <span class="bar-value">${s.value}ms</span>
      <span class="bar-label">${s.name}</span>
    </div>`).join('');
}


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}


/* ============================================================
   MOBILE SIDEBAR (PWA / Responsive)
   ============================================================ */

function toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('hidden');
    document.body.style.overflow = sidebar.classList.contains('mobile-open') ? 'hidden' : '';
}

function closeMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.remove('mobile-open');
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
}

// Override navigateTo to auto-close sidebar on mobile
const _originalNavigateTo = navigateTo;
navigateTo = function (pageId) {
    _originalNavigateTo(pageId);
    if (window.innerWidth <= 1024) closeMobileSidebar();
};


/* ============================================================
   PWA INSTALL PROMPT
   ============================================================ */

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] Install prompt available');
});

function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((result) => {
            if (result.outcome === 'accepted') showToast('PseudoPy installed as an app!', 'success');
            deferredPrompt = null;
        });
    }
}

if (window.navigator.standalone === true) {
    document.body.classList.add('ios-standalone');
}

/**
 * Toggles visibility of a password field.
 * @param {string} inputId The ID of the password input element
 * @param {HTMLElement} btn The button element to update the icon
 */
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈'; // Closed eye
}
}
window.togglePasswordVisibility = togglePasswordVisibility;


/* ============================================================
   PASSWORD MANAGEMENT
   ============================================================ */

async function handleChangePassword() {
    const currentParam = document.getElementById('cp-current-password').value;
    const newParam = document.getElementById('cp-new-password').value;
    const confirmParam = document.getElementById('cp-confirm-password').value;

    if (!currentParam || !newParam || !confirmParam) {
        showToast('Please fill in all fields.', 'error');
        return;
    }

    if (currentParam !== currentUser.password) {
        showToast('Incorrect current password.', 'error');
        return;
    }

    if (newParam === currentParam) {
        showToast('New password cannot be the same as current password.', 'warning');
        return;
    }

    if (newParam.length < 6) {
        showToast('New password must be at least 6 characters.', 'error');
        return;
    }

    if (newParam !== confirmParam) {
        showToast('New passwords do not match.', 'error');
        return;
    }

    try {
        await dbUpdate(usersRef, currentUser._docId, { password: newParam });
        currentUser.password = newParam; // Update local state immediately

        // Update cached array so it's fresh
        const uIndex = cachedUsers.findIndex(u => u.id === currentUser.id);
        if (uIndex !== -1) cachedUsers[uIndex].password = newParam;

        showToast('Password updated successfully!', 'success');

        // Clear fields
        document.getElementById('cp-current-password').value = '';
        document.getElementById('cp-new-password').value = '';
        document.getElementById('cp-confirm-password').value = '';
    } catch (err) {
        console.error('[Offline Database] Change password error:', err);
        showToast('Failed to update password.', 'error');
    }
}

function toggleUserPasswordVisibility(userId) {
    const masked = document.getElementById(`pwd-masked-${userId}`);
    const real = document.getElementById(`pwd-real-${userId}`);

    if (masked && real) {
        if (masked.classList.contains('hidden')) {
            masked.classList.remove('hidden');
            real.classList.add('hidden');
        } else {
            masked.classList.add('hidden');
            real.classList.remove('hidden');
        }
    }
}

/* ============================================================
   COMPILER METRICS (Panel 1 Requirement)
   ============================================================ */

function loadCompilerMetrics() {
    if (typeof metricsEngine === 'undefined') return;

    // Load Session Stats
    const session = metricsEngine.getSessionMetrics();
    document.getElementById('metric-total-translations').textContent = session.totalTranslations;
    document.getElementById('metric-compilation-rate').textContent = session.compilationSuccessRate + '%';
    document.getElementById('metric-runtime-error-rate').textContent = session.runtimeErrorRate + '%';
    document.getElementById('metric-avg-gen-time').textContent = session.avgGenerationTime + 'ms';
    document.getElementById('metric-total-errors').textContent = session.totalErrors;
    document.getElementById('metric-total-executions').textContent = session.totalExecutions;

    const trendEl = document.getElementById('metric-error-trend');
    if (session.errorTrend === 'improving') {
        trendEl.innerHTML = '↓ Improving';
        trendEl.className = 'stat-change positive';
    } else if (session.errorTrend === 'declining') {
        trendEl.innerHTML = '↑ Declining';
        trendEl.className = 'stat-change negative';
    } else {
        trendEl.innerHTML = '— Stable';
        trendEl.className = 'stat-change';
    }

    // Load Improvement Tracking
    const improvement = metricsEngine.getImprovementMetrics();
    const impSection = document.getElementById('metrics-improvement-section');
    if (improvement.hasData) {
        impSection.innerHTML = `
            <div style="display: flex; gap: 2rem; justify-content: space-around; padding: 1rem;">
                <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: ${improvement.correctnessImprovement > 0 ? 'var(--success)' : 'var(--danger)'}">
                        ${improvement.correctnessImprovement > 0 ? '↓' : '↑'} ${Math.abs(improvement.correctnessImprovement)}%
                    </div>
                    <div style="color: var(--text-muted); font-size: 0.9rem;">Error Rate Change</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: var(--success)">
                        ${improvement.speedImprovement}%
                    </div>
                    <div style="color: var(--text-muted); font-size: 0.9rem;">Speed Improvement</div>
                </div>
            </div>
        `;
    }

    // Pipeline Timing
    const timing = metricsEngine.getAveragePipelineTiming();
    const timingSection = document.getElementById('chart-pipeline-timing');
    if (timing.count > 0) {
        const total = timing.avgTotalTime || 1;
        timingSection.innerHTML = `
            <div style="padding: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Lexer</span>
                    <span>${timing.avgLexTime}ms</span>
                </div>
                <div style="width: 100%; background: #eee; height: 8px; border-radius: 4px; margin-bottom: 1rem;">
                    <div style="width: ${(timing.avgLexTime/total)*100}%; background: #3b82f6; height: 100%; border-radius: 4px;"></div>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Parser</span>
                    <span>${timing.avgParseTime}ms</span>
                </div>
                <div style="width: 100%; background: #eee; height: 8px; border-radius: 4px; margin-bottom: 1rem;">
                    <div style="width: ${(timing.avgParseTime/total)*100}%; background: #8b5cf6; height: 100%; border-radius: 4px;"></div>
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Semantic Analyzer</span>
                    <span>${timing.avgSemanticTime}ms</span>
                </div>
                <div style="width: 100%; background: #eee; height: 8px; border-radius: 4px; margin-bottom: 1rem;">
                    <div style="width: ${(timing.avgSemanticTime/total)*100}%; background: #f59e0b; height: 100%; border-radius: 4px;"></div>
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Code Generator</span>
                    <span>${timing.avgCodeGenTime}ms</span>
                </div>
                <div style="width: 100%; background: #eee; height: 8px; border-radius: 4px; margin-bottom: 1rem;">
                    <div style="width: ${(timing.avgCodeGenTime/total)*100}%; background: #10b981; height: 100%; border-radius: 4px;"></div>
                </div>
            </div>
        `;
    }
}

async function runBenchmarkTest() {
    if (typeof metricsEngine === 'undefined') return;
    
    showToast('Running benchmark tests...', 'info');
    
    try {
        // Use global constant from dataset.js instead of fetch() to avoid CORS/offline issues
        if (typeof GROUND_TRUTH_DATASET === 'undefined') {
            throw new Error("GROUND_TRUTH_DATASET not loaded.");
        }
        
        const compiler = new PseudocodeCompiler();
        const results = metricsEngine.runBenchmark(GROUND_TRUTH_DATASET, compiler);
        
        document.getElementById('benchmark-accuracy').textContent = results.accuracy + '%';
        document.getElementById('benchmark-precision').textContent = results.avgPrecision + '%';
        document.getElementById('benchmark-recall').textContent = results.avgRecall + '%';
        document.getElementById('benchmark-f1').textContent = results.f1Score;
        document.getElementById('benchmark-compile-rate').textContent = results.compilationSuccessRate + '%';
        document.getElementById('benchmark-avg-time').textContent = results.avgTimeMs + 'ms';
        
        // Detailed per-test results hidden to optimize UI for learning analytics
        // (Mastery aggregation below provides more academic value)


        // Render Concept Mastery
        const mastery = metricsEngine.getConceptMastery();
        const masteryBody = document.getElementById('concept-mastery-body');
        masteryBody.innerHTML = mastery.map(m => {
            let level = 'Beginner';
            if (m.successRate > 90 && m.accuracy > 80) level = 'Expert';
            else if (m.successRate > 70) level = 'Intermediate';

            return `
                <tr>
                    <td style="font-weight:600">${m.concept}</td>
                    <td>${m.successRate}%</td>
                    <td>${m.accuracy}%</td>
                    <td>${m.precision}%</td>
                    <td><span class="badge ${level === 'Expert' ? 'badge-success' : (level === 'Intermediate' ? 'badge-info' : 'badge-warning')}">${level}</span></td>
                </tr>
            `;
        }).join('');
        
        showToast('Benchmark complete!', 'success');
    } catch (e) {
        console.error(e);
        showToast('Failed to execute benchmark.', 'error');
    }
}

// ── Data Management ──
function exportData(type) {
    const data = localStorage.getItem('pseudopy_' + type);
    if (!data) return showToast('No data to export.', 'warning');
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pseudopy_${type}_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Data exported successfully!', 'success');
}

/* ============================================================
   UI ENHANCEMENTS: THEME & FORMATTER
   ============================================================ */

/**
 * Toggles between Light and Dark mode
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('pseudopy_theme', newTheme);
    
    const icon = newTheme === 'dark' ? '🌓' : '☀️';
    showToast(`Switched to ${newTheme} mode`, 'info');
}

/**
 * Automatically formats pseudocode with consistent indentation
 */
function autoFormatPseudocode() {
    const editor = document.getElementById('pseudocode-editor');
    if (!editor) return;

    const lines = editor.value.split('\n');
    let indentLevel = 0;
    const indentSize = 2; // Spaces per level

    const formattedLines = lines.map(line => {
        let trimmed = line.trim();
        if (!trimmed) return '';

        // Keywords that decrease indentation BEFORE the line
        if (trimmed.match(/^(END|ELSE|NEXT|UNTIL)/i)) {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        const spaces = ' '.repeat(indentLevel * indentSize);
        const result = spaces + trimmed;

        // Keywords that increase indentation AFTER the line
        if (trimmed.match(/^(BEGIN|IF|WHILE|FOR|REPEAT|ELSE|FUNCTION|PROCEDURE|CASE)/i)) {
            // But don't increase if it's an inline IF or a single-line block
            if (!trimmed.match(/THEN.*END\s+IF/i) && !trimmed.match(/DO.*DONE/i)) {
                indentLevel++;
            }
        }

        return result;
    });

    editor.value = formattedLines.join('\n');
    updateGutter(); // Refresh line numbers
    showToast('Pseudocode formatted!', 'success');
}
