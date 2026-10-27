const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'football_data.json');
const SPEED_FILE = path.join(__dirname, 'data', '10_seances_vitesse_footballeur.txt');
const DRILLS_FILE = path.join(__dirname, 'data', '50_meilleurs_exercices_football_solo.txt');
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

// Ensure data folder and file exist
function loadDatabase() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const initialData = {
        trainings: [],
        tests: [],
        exerciseHistory: {
          lastTrainingDates: {},
          recentExercises: []
        },
        settings: { geminiApiKey: '', model: 'gemini-3.8-flash' }
      };
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
      return initialData;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.exerciseHistory) {
      parsed.exerciseHistory = {
        lastTrainingDates: {},
        recentExercises: []
      };
    }
    return parsed;
  } catch (err) {
    console.error('Error reading database file:', err);
    return { trainings: [], tests: [], exerciseHistory: { lastTrainingDates: {}, recentExercises: [] }, settings: {} };
  }
}

// Helper to update exercise and training history
function updateExerciseHistory(db, training) {
  if (!db.exerciseHistory) {
    db.exerciseHistory = {
      lastTrainingDates: {},
      recentExercises: []
    };
  }

  // 1. Update last training date for this category/type
  if (training.category && training.date) {
    const existingDate = db.exerciseHistory.lastTrainingDates[training.category];
    if (!existingDate || training.date > existingDate) {
      db.exerciseHistory.lastTrainingDates[training.category] = training.date;
    }
  }

  // 2. Track exercises with date
  if (Array.isArray(training.exercises) && training.exercises.length > 0) {
    const recent = db.exerciseHistory.recentExercises || [];
    training.exercises.forEach(ex => {
      const exName = (typeof ex === 'string' ? ex : (ex.name || '')).trim();
      if (!exName) return;

      // Filter out older instance if already present to update to latest date
      const filtered = recent.filter(r => r.name.toLowerCase() !== exName.toLowerCase());
      filtered.unshift({
        name: exName,
        date: training.date,
        category: training.category || 'Général',
        sets: ex.sets || ''
      });
      db.exerciseHistory.recentExercises = filtered.slice(0, 50); // Keep last 50
    });
  }
}

function saveDatabase(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving database file:', err);
    return false;
  }
}

// Parse request body helper
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

// Send JSON response helper
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// Load exercise manuals from text files
let speedManualCache = '';
let drillsManualCache = '';

function getExerciseManuals() {
  try {
    if (!speedManualCache && fs.existsSync(SPEED_FILE)) {
      speedManualCache = fs.readFileSync(SPEED_FILE, 'utf-8');
    }
  } catch (e) {
    console.warn('Could not read speed file:', e.message);
  }

  try {
    if (!drillsManualCache && fs.existsSync(DRILLS_FILE)) {
      drillsManualCache = fs.readFileSync(DRILLS_FILE, 'utf-8');
    }
  } catch (e) {
    console.warn('Could not read drills file:', e.message);
  }

  return { speedManual: speedManualCache, drillsManual: drillsManualCache };
}

// Build Football Coach Context for Gemini
function buildCoachPrompt(userMessage, conversationHistory, db) {
  const { speedManual, drillsManual } = getExerciseManuals();

  const systemPrompt = `Tu es un coach de football. Tu réponds UNIQUEMENT à partir des deux programmes ci-dessous. Tes réponses sont en texte simple, concis, en français. Tu ne génères pas de JSON, pas de blocs de code, pas de formats techniques. Réutilise au maximum les formulations et exercices tels qu'ils sont écrits dans les fichiers.

--- SÉANCES DE VITESSE ---
${speedManual || 'Non disponible.'}

--- EXERCICES SOLO ---
${drillsManual || 'Non disponible.'}`;

  return { systemPrompt };
}

function extractProposalsFromText(candidateText) {
  const proposals = [];
  // 1. Chercher les blocs avec balises code (proposal, json ou simple code block)
  const codeBlockRegex = /```(?:proposal|json)?\s*([\s\S]*?)\s*```/gi;
  let match;
  while ((match = codeBlockRegex.exec(candidateText)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.action === 'create_training' || parsed.action === 'update_training') {
        proposals.push(parsed);
      } else if (parsed.training && (parsed.training.title || parsed.training.category)) {
        proposals.push({ action: parsed.action || 'create_training', training: parsed.training });
      } else if (parsed.title && (parsed.category || parsed.exercises)) {
        proposals.push({ action: 'create_training', training: parsed });
      }
    } catch (_) {}
  }

  // 2. Si aucun bloc de code n'a été trouvé, chercher des objets JSON bruts contenant "action": "create_training" ou "title"
  if (proposals.length === 0) {
    const rawJsonRegex = /\{[\s\r\n]*"(?:action|training|title)"[\s\S]*?\}/g;
    while ((match = rawJsonRegex.exec(candidateText)) !== null) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.action || parsed.training || (parsed.title && parsed.category)) {
          proposals.push(parsed.training ? parsed : { action: 'create_training', training: parsed });
        }
      } catch (_) {}
    }
  }

  return proposals;
}

// Request Handler
async function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // --- API ROUTES ---

  // 1. GET /api/data (Full state)
  if (method === 'GET' && pathname === 'api/data' || pathname === '/api/data') {
    const db = loadDatabase();
    const hasKey = Boolean(process.env.GEMINI_API_KEY || (db.settings && db.settings.geminiApiKey));
    const sanitizedDb = {
      ...db,
      settings: {
        ...db.settings,
        hasGeminiKey: hasKey,
        geminiApiKey: db.settings?.geminiApiKey ? '••••••••' + db.settings.geminiApiKey.slice(-4) : ''
      }
    };
    return sendJSON(res, 200, sanitizedDb);
  }

  // 2. POST /api/trainings (Create training)
  if (method === 'POST' && pathname === '/api/trainings') {
    try {
      const data = await parseBody(req);
      if (!data.title || !data.date || !data.category) {
        return sendJSON(res, 400, { error: 'Titre, date et catégorie requis' });
      }
      const db = loadDatabase();
      const newTraining = {
        id: 'tr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        date: data.date,
        time: data.time || '18:00',
        duration: Number(data.duration) || 60,
        title: data.title.trim(),
        category: data.category,
        status: data.status || 'prévu',
        intensity: Number(data.intensity) || 0,
        exercises: Array.isArray(data.exercises) ? data.exercises : [],
        notes: data.notes || '',
        bilan: data.bilan || ''
      };
      db.trainings.push(newTraining);
      updateExerciseHistory(db, newTraining);
      saveDatabase(db);
      return sendJSON(res, 201, newTraining);
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // 3. PUT /api/trainings/:id (Update training)
  if (method === 'PUT' && pathname.startsWith('/api/trainings/')) {
    const id = pathname.replace('/api/trainings/', '');
    try {
      const data = await parseBody(req);
      const db = loadDatabase();
      const index = db.trainings.findIndex(t => t.id === id);
      if (index === -1) {
        return sendJSON(res, 404, { error: 'Entraînement introuvable' });
      }
      db.trainings[index] = {
        ...db.trainings[index],
        ...data,
        id: id // preserve ID
      };
      updateExerciseHistory(db, db.trainings[index]);
      saveDatabase(db);
      return sendJSON(res, 200, db.trainings[index]);
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // 4. DELETE /api/trainings/:id (Delete training)
  if (method === 'DELETE' && pathname.startsWith('/api/trainings/')) {
    const id = pathname.replace('/api/trainings/', '');
    const db = loadDatabase();
    const initialLen = db.trainings.length;
    db.trainings = db.trainings.filter(t => t.id !== id);
    if (db.trainings.length === initialLen) {
      return sendJSON(res, 404, { error: 'Entraînement introuvable' });
    }
    saveDatabase(db);
    return sendJSON(res, 200, { success: true, id });
  }

  // 5. POST /api/tests (Create new test)
  if (method === 'POST' && pathname === '/api/tests') {
    try {
      const data = await parseBody(req);
      if (!data.name || !data.type || !data.unit) {
        return sendJSON(res, 400, { error: 'Nom, type et unité requis' });
      }
      if (!['temps', 'nombre', 'reussites'].includes(data.type)) {
        return sendJSON(res, 400, { error: 'Type invalide (doit être temps, nombre ou reussites)' });
      }
      const db = loadDatabase();
      const newTest = {
        id: 'test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        name: data.name.trim(),
        type: data.type,
        unit: data.unit.trim(),
        protocol: data.protocol || '',
        measures: []
      };
      db.tests.push(newTest);
      saveDatabase(db);
      return sendJSON(res, 201, newTest);
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // 6. PUT /api/tests/:id (Update test)
  if (method === 'PUT' && pathname.startsWith('/api/tests/')) {
    const id = pathname.replace('/api/tests/', '');
    try {
      const data = await parseBody(req);
      const db = loadDatabase();
      const test = db.tests.find(t => t.id === id);
      if (!test) {
        return sendJSON(res, 404, { error: 'Test introuvable' });
      }
      if (data.name) test.name = data.name.trim();
      if (data.unit) test.unit = data.unit.trim();
      if (data.protocol !== undefined) test.protocol = data.protocol;
      saveDatabase(db);
      return sendJSON(res, 200, test);
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // 7. DELETE /api/tests/:id (Delete test)
  if (method === 'DELETE' && pathname.startsWith('/api/tests/')) {
    const id = pathname.replace('/api/tests/', '');
    const db = loadDatabase();
    const initialLen = db.tests.length;
    db.tests = db.tests.filter(t => t.id !== id);
    if (db.tests.length === initialLen) {
      return sendJSON(res, 404, { error: 'Test introuvable' });
    }
    saveDatabase(db);
    return sendJSON(res, 200, { success: true, id });
  }

  // 8. POST /api/tests/:id/measures (Add measure to test)
  const measureMatch = pathname.match(/^\/api\/tests\/([^/]+)\/measures$/);
  if (method === 'POST' && measureMatch) {
    const testId = measureMatch[1];
    try {
      const data = await parseBody(req);
      const db = loadDatabase();
      const test = db.tests.find(t => t.id === testId);
      if (!test) {
        return sendJSON(res, 404, { error: 'Test introuvable' });
      }
      if (data.value === undefined || data.value === null || !data.date) {
        return sendJSON(res, 400, { error: 'Date et valeur requises' });
      }
      const newMeasure = {
        id: 'm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        date: data.date,
        value: Number(data.value),
        attempts: test.type === 'reussites' ? (Number(data.attempts) || 10) : undefined,
        notes: data.notes || ''
      };
      test.measures = test.measures || [];
      test.measures.push(newMeasure);
      test.measures.sort((a, b) => a.date.localeCompare(b.date));
      saveDatabase(db);
      return sendJSON(res, 201, { test, newMeasure });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // 9. DELETE /api/tests/:id/measures/:measureId
  const delMeasureMatch = pathname.match(/^\/api\/tests\/([^/]+)\/measures\/([^/]+)$/);
  if (method === 'DELETE' && delMeasureMatch) {
    const [, testId, measureId] = delMeasureMatch;
    const db = loadDatabase();
    const test = db.tests.find(t => t.id === testId);
    if (!test) {
      return sendJSON(res, 404, { error: 'Test introuvable' });
    }
    test.measures = (test.measures || []).filter(m => m.id !== measureId);
    saveDatabase(db);
    return sendJSON(res, 200, { success: true, test });
  }

  // 10. POST /api/settings (Update settings e.g. API key)
  if (method === 'POST' && pathname === '/api/settings') {
    try {
      const data = await parseBody(req);
      const db = loadDatabase();
      db.settings = db.settings || {};
      if (data.geminiApiKey !== undefined) {
        db.settings.geminiApiKey = data.geminiApiKey.trim();
      }
      if (data.model) {
        db.settings.model = data.model;
      }
      saveDatabase(db);
      return sendJSON(res, 200, {
        success: true,
        hasGeminiKey: Boolean(process.env.GEMINI_API_KEY || db.settings.geminiApiKey)
      });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // 11. POST /api/ai/chat (Coach AI conversational endpoint)
  if (method === 'POST' && pathname === '/api/ai/chat') {
    try {
      const data = await parseBody(req);
      const userMessage = data.message;
      const history = data.history || [];

      if (!userMessage) {
        return sendJSON(res, 400, { error: 'Message manquant' });
      }

      const db = loadDatabase();
      const apiKey = data.apiKey || db.settings?.geminiApiKey || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return sendJSON(res, 400, {
          configured: false,
          error: 'API_KEY_REQUIRED',
          message: 'Aucune clé API Gemini n\'est configurée. Pour discuter avec le Coach IA en temps réel, veuillez renseigner votre clé API Gemini dans les réglages du Coach.'
        });
      }

      const { systemPrompt } = buildCoachPrompt(userMessage, history, db);

      // Build Gemini contents array
      const contents = [];

      // History
      for (const msg of history.slice(-8)) {
        contents.push({
          role: msg.role === 'coach' || msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.text }]
        });
      }

      // Latest message
      contents.push({
        role: 'user',
        parts: [{ text: userMessage }]
      });

      const model = db.settings?.model || 'gemini-3.8-flash';
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const geminiPayload = {
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1500
        }
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload)
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = `Erreur API Gemini (${response.status})`;
        try {
          const errJson = JSON.parse(errText);
          if (errJson.error && errJson.error.message) {
            errMsg = `Erreur Gemini : ${errJson.error.message}`;
          }
        } catch (_) {}
        return sendJSON(res, response.status, {
          configured: true,
          error: 'GEMINI_API_ERROR',
          message: errMsg
        });
      }

      const geminiResult = await response.json();
      const candidateText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || 'Désolé, aucune réponse générée.';

      return sendJSON(res, 200, {
        configured: true,
        reply: candidateText
      });
    } catch (err) {
      console.error('AI chat error:', err);
      return sendJSON(res, 500, {
        configured: true,
        error: 'SERVER_ERROR',
        message: 'Erreur lors de la communication avec le serveur IA : ' + err.message
      });
    }
  }

  // 12. Backup Export & Import
  if (method === 'GET' && pathname === '/api/export') {
    const db = loadDatabase();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="football_tracker_backup.json"'
    });
    return res.end(JSON.stringify(db, null, 2));
  }

  if (method === 'POST' && pathname === '/api/import') {
    try {
      const data = await parseBody(req);
      if (!Array.isArray(data.trainings) || !Array.isArray(data.tests)) {
        return sendJSON(res, 400, { error: 'Format de sauvegarde invalide' });
      }
      saveDatabase(data);
      return sendJSON(res, 200, { success: true, countTrainings: data.trainings.length, countTests: data.tests.length });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // --- STATIC FILE SERVING ---
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  
  // Security check to avoid directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Accès interdit');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Fichier non trouvé');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
}

const server = http.createServer(handleRequest);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n⚽ Application Football Tracker démarrée sur http://localhost:${PORT}`);
  console.log(`Données enregistrées dans: ${DATA_FILE}\n`);
});
