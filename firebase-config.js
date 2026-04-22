// ============================================================
// LOCAL STORAGE CONFIGURATION — PseudoPy
// Offline persistence to replace Firebase
// ============================================================

console.log('[Database] Initialized with LocalStorage (Offline Mode)');

// ── Collection References (Keys) ──
const usersRef = "pseudopy_users";
const exercisesRef = "pseudopy_exercises";
const activityRef = "pseudopy_activity";
const passwordRequestsRef = "pseudopy_passwordRequests";

// Helper to get collection from LocalStorage
function getCollection(ref) {
    const data = localStorage.getItem(ref);
    return data ? JSON.parse(data) : {};
}

// Helper to save collection to LocalStorage
function saveCollection(ref, dataObj) {
    localStorage.setItem(ref, JSON.stringify(dataObj));
}

// ══════════════════════════════════════════════════════════════
//  LOCAL STORAGE HELPER FUNCTIONS (API matches old Firestore API)
// ══════════════════════════════════════════════════════════════

/**
 * Get all documents from a collection
 */
async function fbGetAll(ref) {
    const col = getCollection(ref);
    return Object.keys(col).map(id => ({ _docId: id, ...col[id] }));
}

/**
 * Add a new document (auto-generated ID)
 */
async function fbAdd(ref, data) {
    const col = getCollection(ref);
    const docId = 'doc_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    col[docId] = data;
    saveCollection(ref, col);
    return docId;
}

/**
 * Set a document with a specific ID
 */
async function fbSet(ref, docId, data) {
    const col = getCollection(ref);
    col[docId] = data;
    saveCollection(ref, col);
}

/**
 * Update specific fields on an existing document
 */
async function fbUpdate(ref, docId, data) {
    const col = getCollection(ref);
    if (col[docId]) {
        col[docId] = { ...col[docId], ...data };
        saveCollection(ref, col);
    }
}

/**
 * Delete a document by its ID
 */
async function fbDelete(ref, docId) {
    const col = getCollection(ref);
    if (col[docId]) {
        delete col[docId];
        saveCollection(ref, col);
    }
}

// ══════════════════════════════════════════════════════════════
//  SEED DATABASE (runs once if collections are empty)
// ══════════════════════════════════════════════════════════════

const SEED_USERS = [
    { id: 'u1', fullName: 'Mark Bautista', username: 'mbautista', email: 'bautista@university.edu.ph', password: 'admin123', role: 'admin', status: 'active' },
    { id: 'u2', fullName: 'Marc Reantaso', username: 'mreantaso', email: 'reantaso@university.edu.ph', password: 'pass123', role: 'instructor', status: 'active' },
    { id: 'u3', fullName: 'Eduard Mirandilla', username: 'emirandilla', email: 'mirandilla@student.edu.ph', password: 'pass123', role: 'student', status: 'active' },
    { id: 'u4', fullName: 'Mikaella Daet', username: 'mdaet', email: 'daet@student.edu.ph', password: 'pass123', role: 'student', status: 'active' },
];

const SEED_EXERCISES = [
    {
        id: 'ex1',
        title: 'Sum of Even Numbers',
        description: 'Write pseudocode that takes a list of numbers and computes the sum of all even numbers in the list. Display the result.',
        difficulty: 'easy',
        solution: 'BEGIN\n  SET numbers TO [2, 5, 8, 11, 14, 3, 6]\n  SET sum TO 0\n  FOR EACH num IN numbers DO\n    IF num MOD 2 = 0 THEN\n      SET sum TO sum + num\n    END IF\n  END FOR\n  DISPLAY "Sum of even numbers: " + sum\nEND',
        createdBy: 'u2',
        createdAt: '2026-02-15'
    },
    {
        id: 'ex2',
        title: 'Factorial Calculator',
        description: 'Write pseudocode to calculate the factorial of a given number N using a loop. Display each step of the computation.',
        difficulty: 'medium',
        solution: 'BEGIN\n  SET n TO 5\n  SET factorial TO 1\n  SET i TO 1\n  WHILE i <= n DO\n    SET factorial TO factorial * i\n    DISPLAY i + "! = " + factorial\n    SET i TO i + 1\n  END WHILE\n  DISPLAY "Final: " + n + "! = " + factorial\nEND',
        createdBy: 'u2',
        createdAt: '2026-02-16'
    },
    {
        id: 'ex3',
        title: 'FizzBuzz Classic',
        description: 'Write pseudocode for the classic FizzBuzz problem: for numbers 1 to 20, print "Fizz" for multiples of 3, "Buzz" for multiples of 5, "FizzBuzz" for both, or the number itself.',
        difficulty: 'medium',
        solution: 'BEGIN\n  FOR i FROM 1 TO 20 DO\n    IF i MOD 15 = 0 THEN\n      DISPLAY "FizzBuzz"\n    ELSE IF i MOD 3 = 0 THEN\n      DISPLAY "Fizz"\n    ELSE IF i MOD 5 = 0 THEN\n      DISPLAY "Buzz"\n    ELSE\n      DISPLAY i\n    END IF\n  END FOR\nEND',
        createdBy: 'u2',
        createdAt: '2026-02-17'
    },
    {
        id: 'ex4',
        title: 'Fibonacci Sequence',
        description: 'Write pseudocode to generate the first N numbers of the Fibonacci sequence and display them.',
        difficulty: 'hard',
        solution: 'BEGIN\n  SET n TO 10\n  SET a TO 0\n  SET b TO 1\n  DISPLAY a\n  DISPLAY b\n  SET i TO 2\n  WHILE i < n DO\n    SET temp TO a + b\n    DISPLAY temp\n    SET a TO b\n    SET b TO temp\n    SET i TO i + 1\n  END WHILE\nEND',
        createdBy: 'u2',
        createdAt: '2026-02-18'
    },
];

const SEED_ACTIVITY = [
    { student: 'Eduard Mirandilla', exercise: 'Sum of Even Numbers', status: 'Completed', score: '95%', time: '5 min ago' },
    { student: 'Mikaella Daet', exercise: 'Factorial Calculator', status: 'In Progress', score: '—', time: '12 min ago' },
    { student: 'Eduard Mirandilla', exercise: 'FizzBuzz Classic', status: 'Completed', score: '88%', time: '25 min ago' },
    { student: 'Mikaella Daet', exercise: 'Sum of Even Numbers', status: 'Completed', score: '78%', time: '1 hr ago' },
    { student: 'Eduard Mirandilla', exercise: 'Fibonacci Sequence', status: 'Completed', score: '100%', time: '2 hrs ago' },
    { student: 'Mikaella Daet', exercise: 'FizzBuzz Classic', status: 'Completed', score: '92%', time: '3 hrs ago' },
];

async function seedDatabase() {
    try {
        const existingUsers = getCollection(usersRef);
        if (Object.keys(existingUsers).length === 0) {
            console.log('[Database] Seeding users...');
            for (const user of SEED_USERS) await fbSet(usersRef, user.id, user);
            console.log('[Database] Users seeded ✅');
        }

        const existingExercises = getCollection(exercisesRef);
        if (Object.keys(existingExercises).length === 0) {
            console.log('[Database] Seeding exercises...');
            for (const ex of SEED_EXERCISES) await fbSet(exercisesRef, ex.id, ex);
            console.log('[Database] Exercises seeded ✅');
        }

        const existingActivity = getCollection(activityRef);
        if (Object.keys(existingActivity).length === 0) {
            console.log('[Database] Seeding activity...');
            for (const act of SEED_ACTIVITY) await fbAdd(activityRef, act);
            console.log('[Database] Activity seeded ✅');
        }

        console.log('[Database] Ready ✅');
    } catch (err) {
        console.error('[Database] Seed error:', err);
    }
}
