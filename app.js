/* ============================================================
   PSEUDOPY — APP.JS
   Automated Code Generation System
   Powered by Firebase Firestore
   ============================================================ */

console.log('[App] app.js script is parsing and executing top-level');

// ── State ──
let currentUser = null;
let currentPage = '';
let editingExerciseId = null;
let editingUserId = null;

// ── Cached data (loaded from Firestore) ──
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

        // Pre-load data from Firestore into cache
        cachedUsers = await fbGetAll(usersRef);
        cachedExercises = await fbGetAll(exercisesRef);
        cachedActivity = await fbGetAll(activityRef);

        console.log(`[App] Loaded ${cachedUsers.length} users, ${cachedExercises.length} exercises, ${cachedActivity.length} activity records from Firestore.`);
    } catch (err) {
        console.error('[App] Init error:', err);
        showToast('Database connection failed. Check Firebase config.', 'error');
    }

    updateClock();
    setInterval(updateClock, 60000);

    // Update line count on editor input
    const editor = document.getElementById('pseudocode-editor');
    if (editor) {
        editor.addEventListener('input', () => {
            const lines = editor.value.split('\n').length;
            document.getElementById('line-count').textContent = lines + ' lines';
        });
    }
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
    cachedUsers = await fbGetAll(usersRef);
    return cachedUsers;
}

async function refreshExercises() {
    cachedExercises = await fbGetAll(exercisesRef);
    return cachedExercises;
}

async function refreshActivity() {
    cachedActivity = await fbGetAll(activityRef);
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
        // Refresh users from Firestore
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
        'change-password': 'Change Password'
    };
    document.getElementById('topbar-title').textContent = titles[pageId] || 'Dashboard';

    // Load page-specific data (async)
    if (pageId === 'analytics') loadAnalytics();
    if (pageId === 'manage-exercises') loadExercises();
    if (pageId === 'manage-users') loadUsers();
    if (pageId === 'exercises-student') loadStudentExercises();
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

    const python = pseudocodeToPython(input);
    document.getElementById('python-output').value = python;

    const output = document.getElementById('console-output');
    output.className = 'output-content';
    output.textContent = '✅ Translation complete! Click "Run Code" to execute.';

    showToast('Pseudocode translated to Python successfully!', 'success');
}

function translateFromPage() {
    const input = document.getElementById('translate-input').value;
    if (!input.trim()) {
        showToast('Please write some pseudocode first.', 'error');
        return;
    }
    const python = pseudocodeToPython(input);
    document.getElementById('translate-output').value = python;
    showToast('Translation complete!', 'success');
}

function instructorTranslate() {
    const input = document.getElementById('instructor-pseudo-input').value;
    if (!input.trim()) {
        showToast('Please write some pseudocode first.', 'error');
        return;
    }
    const python = pseudocodeToPython(input);
    document.getElementById('instructor-python-output').value = python;
    showToast('Python code generated!', 'success');
}

/**
 * Core Translation Engine
 * Converts structured pseudocode into valid Python.
 */
function pseudocodeToPython(pseudocode) {
    const lines = pseudocode.split('\n');
    const pythonLines = [];
    let indentLevel = 0;
    const numericVars = new Set(); // Track variables declared as NUMERIC/INTEGER/FLOAT

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        if (!line) { pythonLines.push(''); continue; }
        if (/^BEGIN$/i.test(line)) continue;
        if (/^END$/i.test(line)) continue;

        if (line.startsWith('//') || line.startsWith('#')) {
            pythonLines.push(indent(indentLevel) + '# ' + line.replace(/^\/\/\s*|^#\s*/, ''));
            continue;
        }

        if (/^END\s+(IF|FOR|WHILE|FUNCTION|PROCEDURE)/i.test(line)) {
            indentLevel = Math.max(0, indentLevel - 1);
            continue;
        }

        if (/^ELSE\s+IF\s+(.+)\s+THEN$/i.test(line)) {
            indentLevel = Math.max(0, indentLevel - 1);
            const match = line.match(/^ELSE\s+IF\s+(.+)\s+THEN$/i);
            pythonLines.push(indent(indentLevel) + `elif ${translateCondition(match[1])}:`);
            indentLevel++;
            continue;
        }

        if (/^ELSE$/i.test(line)) {
            indentLevel = Math.max(0, indentLevel - 1);
            pythonLines.push(indent(indentLevel) + 'else:');
            indentLevel++;
            continue;
        }

        if (/^IF\s+(.+)\s+THEN$/i.test(line)) {
            const match = line.match(/^IF\s+(.+)\s+THEN$/i);
            pythonLines.push(indent(indentLevel) + `if ${translateCondition(match[1])}:`);
            indentLevel++;
            continue;
        }

        if (/^FOR\s+EACH\s+(\w+)\s+IN\s+(.+)\s+DO$/i.test(line)) {
            const match = line.match(/^FOR\s+EACH\s+(\w+)\s+IN\s+(.+)\s+DO$/i);
            pythonLines.push(indent(indentLevel) + `for ${match[1]} in ${translateExpr(match[2])}:`);
            indentLevel++;
            continue;
        }

        if (/^FOR\s+(\w+)\s+FROM\s+(.+)\s+TO\s+(.+)\s+DO$/i.test(line)) {
            const match = line.match(/^FOR\s+(\w+)\s+FROM\s+(.+)\s+TO\s+(.+)\s+DO$/i);
            pythonLines.push(indent(indentLevel) + `for ${match[1]} in range(${translateExpr(match[2])}, ${translateExpr(match[3])} + 1):`);
            indentLevel++;
            continue;
        }

        if (/^WHILE\s+(.+)\s+DO$/i.test(line)) {
            const match = line.match(/^WHILE\s+(.+)\s+DO$/i);
            pythonLines.push(indent(indentLevel) + `while ${translateCondition(match[1])}:`);
            indentLevel++;
            continue;
        }

        if (/^(FUNCTION|PROCEDURE)\s+(\w+)\s*\((.*)?\)$/i.test(line)) {
            const match = line.match(/^(FUNCTION|PROCEDURE)\s+(\w+)\s*\((.*)?\)$/i);
            pythonLines.push(indent(indentLevel) + `def ${match[2]}(${match[3] ? match[3].trim() : ''}):`);
            indentLevel++;
            continue;
        }

        if (/^RETURN\s+(.+)$/i.test(line)) {
            const match = line.match(/^RETURN\s+(.+)$/i);
            pythonLines.push(indent(indentLevel) + `return ${translateExpr(match[1])}`);
            continue;
        }

        if (/^CALL\s+(\w+)\s*\((.*)?\)$/i.test(line)) {
            const match = line.match(/^CALL\s+(\w+)\s*\((.*)?\)$/i);
            pythonLines.push(indent(indentLevel) + `${match[1]}(${match[2] ? translateExpr(match[2]) : ''})`);
            continue;
        }

        if (/^SET\s+(\w+)\s+TO\s+(.+)$/i.test(line)) {
            const match = line.match(/^SET\s+(\w+)\s+TO\s+(.+)$/i);
            pythonLines.push(indent(indentLevel) + `${match[1]} = ${translateExpr(match[2])}`);
            continue;
        }

        if (/^(DISPLAY|PRINT|OUTPUT)\s+(.+)$/i.test(line)) {
            const match = line.match(/^(DISPLAY|PRINT|OUTPUT)\s+(.+)$/i);
            pythonLines.push(indent(indentLevel) + `print(${translateExpr(match[2])})`);
            continue;
        }

        // INPUT WITH PROMPT must come before plain INPUT (more specific first)
        if (/^(INPUT|READ)\s+(\w+)\s+WITH\s+PROMPT\s+"(.+)"$/i.test(line)) {
            const match = line.match(/^(INPUT|READ)\s+(\w+)\s+WITH\s+PROMPT\s+"(.+)"$/i);
            const inputExpr = `input("${match[3]}")`;
            pythonLines.push(indent(indentLevel) + `${match[2]} = ${numericVars.has(match[2]) ? 'int(' + inputExpr + ')' : inputExpr}`);
            continue;
        }

        if (/^(INPUT|READ)\s+(\w+)$/i.test(line)) {
            const match = line.match(/^(INPUT|READ)\s+(\w+)$/i);
            const inputExpr = 'input()';
            pythonLines.push(indent(indentLevel) + `${match[2]} = ${numericVars.has(match[2]) ? 'int(' + inputExpr + ')' : inputExpr}`);
            continue;
        }

        if (/^INCREMENT\s+(\w+)$/i.test(line)) {
            const match = line.match(/^INCREMENT\s+(\w+)$/i);
            pythonLines.push(indent(indentLevel) + `${match[1]} += 1`);
            continue;
        }
        if (/^DECREMENT\s+(\w+)$/i.test(line)) {
            const match = line.match(/^DECREMENT\s+(\w+)$/i);
            pythonLines.push(indent(indentLevel) + `${match[1]} -= 1`);
            continue;
        }

        if (/^APPEND\s+(.+)\s+TO\s+(\w+)$/i.test(line)) {
            const match = line.match(/^APPEND\s+(.+)\s+TO\s+(\w+)$/i);
            pythonLines.push(indent(indentLevel) + `${match[2]}.append(${translateExpr(match[1])})`);
            continue;
        }

        // Handle variable type declarations: NUMERIC, STRING, BOOLEAN, etc.
        if (/^(NUMERIC|INTEGER|FLOAT|REAL|STRING|CHAR|CHARACTER|BOOLEAN|BOOL)\s+(\w+)/i.test(line)) {
            const match = line.match(/^(NUMERIC|INTEGER|FLOAT|REAL|STRING|CHAR|CHARACTER|BOOLEAN|BOOL)\s+(\w+)/i);
            const upperType = match[1].toUpperCase();
            // Track numeric variables so INPUT can wrap with int()
            if (['NUMERIC', 'INTEGER', 'FLOAT', 'REAL'].includes(upperType)) {
                numericVars.add(match[2]);
            }
            const typeDefaults = {
                'NUMERIC': '0', 'INTEGER': '0', 'FLOAT': '0.0', 'REAL': '0.0',
                'STRING': '""', 'CHAR': '""', 'CHARACTER': '""',
                'BOOLEAN': 'False', 'BOOL': 'False'
            };
            const defaultVal = typeDefaults[upperType] || 'None';
            pythonLines.push(indent(indentLevel) + `# ${match[1]} ${match[2]}`);
            pythonLines.push(indent(indentLevel) + `${match[2]} = ${defaultVal}`);
            continue;
        }

        // Handle direct assignment: variable = expression
        if (/^(\w+)\s*=\s*(.+)$/i.test(line)) {
            const match = line.match(/^(\w+)\s*=\s*(.+)$/);
            pythonLines.push(indent(indentLevel) + `${match[1]} = ${translateExpr(match[2])}`);
            continue;
        }

        pythonLines.push(indent(indentLevel) + `# ${line}`);
    }

    return pythonLines.join('\n');
}

function indent(level) { return '    '.repeat(level); }

function translateCondition(cond) {
    return cond
        .replace(/\bAND\b/gi, 'and').replace(/\bOR\b/gi, 'or').replace(/\bNOT\b/gi, 'not')
        .replace(/\bMOD\b/gi, '%')
        .replace(/\b(\w+)\s*=\s*(?!=)/g, (m, v) => `${v} == `)
        .replace(/\s*<>\s*/g, ' != ')
        .replace(/\bTRUE\b/gi, 'True').replace(/\bFALSE\b/gi, 'False').replace(/\bNULL\b/gi, 'None')
        .trim();
}

function translateExpr(expr) {
    return expr
        .replace(/\bMOD\b/gi, '%')
        .replace(/\bTRUE\b/gi, 'True').replace(/\bFALSE\b/gi, 'False').replace(/\bNULL\b/gi, 'None')
        .replace(/\bAND\b/gi, 'and').replace(/\bOR\b/gi, 'or').replace(/\bNOT\b/gi, 'not')
        .trim();
}


/* ============================================================
   CODE EXECUTION (via Skulpt)
   ============================================================ */

function executePython() {
    const code = document.getElementById('python-output').value;
    if (!code.trim()) { showToast('No Python code to execute. Translate first!', 'error'); return; }
    runPythonCode(code, 'console-output');
}

function executeFromTranslate() {
    const code = document.getElementById('translate-output').value;
    if (!code.trim()) { showToast('No Python code to execute.', 'error'); return; }
    runPythonCode(code, 'translate-console');
}

function executeFromExecPage() {
    const code = document.getElementById('execute-editor').value;
    if (!code.trim()) { showToast('Please enter some Python code.', 'error'); return; }
    runPythonCode(code, 'execute-console');
}

function instructorExecute() {
    const code = document.getElementById('instructor-python-output').value;
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
            });
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
                    resolve(value);
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
    }).catch(function (err) {
        appendOutput('\n❌ Error: ' + err.toString());
        outputEl.className = 'output-content error';
        showToast('Runtime error occurred.', 'error');
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

function generateFeedback(pseudocode) {
    const feedback = [];
    const lines = pseudocode.split('\n');
    const trimmedLines = lines.map(l => l.trim()).filter(l => l);

    const hasBegin = trimmedLines.some(l => /^BEGIN$/i.test(l));
    const hasEnd = trimmedLines.some(l => /^END$/i.test(l));
    if (hasBegin && hasEnd) {
        feedback.push({ type: 'success', icon: '✅', text: '<strong>Good structure:</strong> Proper BEGIN/END blocks.' });
    } else {
        if (!hasBegin) feedback.push({ type: 'warning', icon: '⚠️', text: '<strong>Missing BEGIN:</strong> Start with a BEGIN statement.' });
        if (!hasEnd) feedback.push({ type: 'warning', icon: '⚠️', text: '<strong>Missing END:</strong> End with an END statement.' });
    }

    const ifCount = trimmedLines.filter(l => /^IF\s/i.test(l)).length;
    const endIfCount = trimmedLines.filter(l => /^END\s+IF$/i.test(l)).length;
    if (ifCount > endIfCount) feedback.push({ type: 'error', icon: '❌', text: `<strong>Syntax Error:</strong> ${ifCount} IF but only ${endIfCount} END IF.` });
    else if (ifCount > 0 && ifCount === endIfCount) feedback.push({ type: 'success', icon: '✅', text: `<strong>IF balanced:</strong> ${ifCount} pair(s) matched.` });

    const forCount = trimmedLines.filter(l => /^FOR\s/i.test(l)).length;
    const endForCount = trimmedLines.filter(l => /^END\s+FOR$/i.test(l)).length;
    if (forCount > endForCount) feedback.push({ type: 'error', icon: '❌', text: `<strong>Syntax Error:</strong> ${forCount} FOR but only ${endForCount} END FOR.` });
    else if (forCount > 0 && forCount === endForCount) feedback.push({ type: 'success', icon: '✅', text: `<strong>FOR balanced:</strong> ${forCount} pair(s) matched.` });

    const whileCount = trimmedLines.filter(l => /^WHILE\s/i.test(l)).length;
    const endWhileCount = trimmedLines.filter(l => /^END\s+WHILE$/i.test(l)).length;
    if (whileCount > endWhileCount) feedback.push({ type: 'error', icon: '❌', text: `<strong>Syntax Error:</strong> ${whileCount} WHILE but only ${endWhileCount} END WHILE.` });
    else if (whileCount > 0 && whileCount === endWhileCount) feedback.push({ type: 'success', icon: '✅', text: `<strong>WHILE balanced:</strong> ${whileCount} pair(s) matched.` });

    const displayCount = trimmedLines.filter(l => /^(DISPLAY|PRINT|OUTPUT)\s/i.test(l)).length;
    if (displayCount > 0) feedback.push({ type: 'success', icon: '✅', text: `<strong>Output:</strong> ${displayCount} DISPLAY/PRINT statement(s).` });
    else feedback.push({ type: 'warning', icon: '💡', text: '<strong>Suggestion:</strong> Add DISPLAY statements to show results.' });

    const setCount = trimmedLines.filter(l => /^SET\s/i.test(l)).length;
    if (setCount > 0) feedback.push({ type: 'success', icon: '✅', text: `<strong>Variables:</strong> ${setCount} SET assignment(s).` });

    const indentedLines = lines.filter(l => l.match(/^\s+/));
    if (indentedLines.length > 0) feedback.push({ type: 'success', icon: '✅', text: '<strong>Indentation:</strong> Uses indentation for readability.' });
    else if (lines.length > 3) feedback.push({ type: 'warning', icon: '💡', text: '<strong>Suggestion:</strong> Add indentation inside blocks.' });

    const errors = feedback.filter(f => f.type === 'error').length;
    const warnings = feedback.filter(f => f.type === 'warning').length;
    const successes = feedback.filter(f => f.type === 'success').length;
    let quality = 'Excellent', qualityType = 'success';
    if (errors > 0) { quality = 'Needs Fixing'; qualityType = 'error'; }
    else if (warnings > 2) { quality = 'Fair'; qualityType = 'warning'; }
    else if (warnings > 0) { quality = 'Good'; qualityType = 'success'; }

    feedback.unshift({
        type: qualityType,
        icon: qualityType === 'success' ? '🏆' : qualityType === 'warning' ? '📊' : '🔧',
        text: `<strong>Overall Quality: ${quality}</strong> — ${successes} passed, ${warnings} suggestion(s), ${errors} error(s). Total: ${trimmedLines.length} lines.`
    });

    return feedback;
}

function renderFeedback(feedback) {
    document.getElementById('feedback-results').innerHTML = feedback.map(f => `
    <div class="feedback-item ${f.type}">
      <span class="fb-icon">${f.icon}</span>
      <span class="fb-text">${f.text}</span>
    </div>`).join('');
}


/* ============================================================
   EXERCISES MANAGEMENT — Firestore CRUD
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
    document.getElementById('python-output').value = '';
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
            if (ex) await fbUpdate(exercisesRef, ex._docId, { title, description: desc, difficulty, solution });
            showToast('Exercise updated successfully!', 'success');
        } else {
            const newId = 'ex' + Date.now();
            await fbSet(exercisesRef, newId, {
                id: newId, title, description: desc, difficulty, solution,
                createdBy: currentUser?.id || 'unknown',
                createdAt: new Date().toISOString().split('T')[0]
            });
            showToast('Exercise created successfully!', 'success');
        }
        closeExerciseModal();
        await loadExercises();
    } catch (err) {
        console.error('[Firestore] Save exercise error:', err);
        showToast('Failed to save exercise.', 'error');
    }
}

function editExercise(id) { openExerciseModal(id); }

async function deleteExercise(id) {
    if (!confirm('Delete this exercise?')) return;
    try {
        const ex = cachedExercises.find(e => e.id === id);
        if (ex) await fbDelete(exercisesRef, ex._docId);
        await loadExercises();
        showToast('Exercise deleted.', 'info');
    } catch (err) {
        console.error('[Firestore] Delete exercise error:', err);
        showToast('Failed to delete exercise.', 'error');
    }
}


/* ============================================================
   USER MANAGEMENT (Admin) — Firestore CRUD
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
            if (user) await fbUpdate(usersRef, user._docId, { fullName, username, email, role });
            showToast('User updated successfully!', 'success');
        } else {
            const newId = 'u' + Date.now();
            await fbSet(usersRef, newId, { id: newId, fullName, username, email, password, role, status: 'active' });
            showToast('User created successfully!', 'success');
        }
        closeUserModal();
        await loadUsers();
    } catch (err) {
        console.error('[Firestore] Save user error:', err);
        showToast('Failed to save user.', 'error');
    }
}

function editUser(id) { openUserModal(id); }

async function deleteUser(id) {
    if (!confirm('Delete this user?')) return;
    if (id === currentUser?.id) { showToast('You cannot delete your own account!', 'error'); return; }
    try {
        const user = cachedUsers.find(u => u.id === id);
        if (user) await fbDelete(usersRef, user._docId);
        await loadUsers();
        showToast('User deleted.', 'info');
    } catch (err) {
        console.error('[Firestore] Delete user error:', err);
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
   UTILITY FUNCTIONS
   ============================================================ */

function clearEditor() {
    document.getElementById('pseudocode-editor').value = '';
    document.getElementById('python-output').value = '';
    document.getElementById('console-output').textContent = 'Editor cleared. Ready for new pseudocode.';
    document.getElementById('console-output').className = 'output-content';
    document.getElementById('line-count').textContent = '0 lines';
}

function clearOutput() {
    document.getElementById('console-output').textContent = 'Output cleared.';
    document.getElementById('console-output').className = 'output-content';
}

function copyPython() {
    const code = document.getElementById('python-output').value;
    if (!code) { showToast('No code to copy.', 'error'); return; }
    copyText(code);
}

function copyTranslateOutput() {
    const code = document.getElementById('translate-output').value;
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
    const code = document.getElementById('python-output').value;
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

// ── Init on Load ──
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
    } else {
        input.type = 'password';
        btn.textContent = '👁️'; // Open eye
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
        await fbUpdate(usersRef, currentUser._docId, { password: newParam });
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
        console.error('[Firestore] Change password error:', err);
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
