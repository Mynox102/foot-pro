/**
 * Football Tracker - Application Core
 * Supporte le mode Serveur Node.js (avec persistance JSON) ET le mode Navigateur autonome (localStorage)
 */

const state = {
  trainings: [],
  tests: [],
  exerciseHistory: {
    lastTrainingDates: {},
    recentExercises: []
  },
  settings: {
    hasGeminiKey: false,
    geminiApiKey: '',
    model: 'gemini-3.8-flash'
  },
  activePage: 'calendar'
};

let isServerAvailable = true;

// Default initial data if starting standalone without server
const DEFAULT_SEED_DATA = {
  trainings: [
    {
      id: "tr-101",
      date: "2026-10-05",
      time: "18:30",
      duration: 75,
      title: "Prise d'information & Premier contrôle",
      category: "Technique",
      status: "terminé",
      intensity: 7,
      exercises: [
        { id: "ex-1", name: "Jonglerie variée (pied droit, gauche, alterné)", sets: "10 min", completed: true },
        { id: "ex-2", name: "Contrôle orienté sous pression avec passeur", sets: "4 séries x 12 répétitions", completed: true },
        { id: "ex-3", name: "Jeu réduit 3v3 conservation rapide (2 touches max)", sets: "3 x 5 min (r=2min)", completed: true }
      ],
      notes: "Bonne fluidité sur les prises d'appui. Attention à orienter le buste avant la réception.",
      bilan: "Séance propre techniquement. Meilleure utilisation du pied gauche sur les contrôles intérieurs."
    },
    {
      id: "tr-102",
      date: "2026-10-07",
      time: "19:00",
      duration: 60,
      title: "Vitesse de démarrage & Vivacité",
      category: "Vitesse",
      status: "terminé",
      intensity: 8,
      exercises: [
        { id: "ex-4", name: "Échelle de rythme + départ sprint 10m", sets: "6 passages", completed: true },
        { id: "ex-5", name: "Sprint navette 5m-10m-15m avec changement de direction", sets: "5 séries (r=90s)", completed: true }
      ],
      notes: "Accent mis sur la poussée des premiers appuis et l'abaissement du centre de gravité.",
      bilan: "Bonne réactivité, sensation de légèreté."
    },
    {
      id: "tr-103",
      date: "2026-10-10",
      time: "10:30",
      duration: 80,
      title: "Intermittent aérobie 15-15 & Volume de jeu",
      category: "Endurance",
      status: "terminé",
      intensity: 8,
      exercises: [
        { id: "ex-7", name: "Échauffement cardio progressif + mobilité hanches", sets: "15 min", completed: true },
        { id: "ex-8", name: "Bloc: 15s course à 110% VMA / 15s trot", sets: "2 blocs de 8 minutes", completed: true }
      ],
      notes: "Rythme bien tenu sur le deuxième bloc.",
      bilan: "Bonne capacité à récupérer pendant les 15s de trot."
    },
    {
      id: "tr-104",
      date: "2026-10-12",
      time: "18:00",
      duration: 50,
      title: "Gainage dynamique & Ischio-jambiers",
      category: "Poids du corps",
      status: "terminé",
      intensity: 6,
      exercises: [
        { id: "ex-10", name: "Gainage planche latérale avec levée de jambe", sets: "4 x 40s par côté", completed: true },
        { id: "ex-11", name: "Nordic Hamstring Curl assisté", sets: "4 x 6 répétitions", completed: true }
      ],
      notes: "Prévention des blessures musculaires (ischios). Exécution lente et contrôlée.",
      bilan: "Bon travail postural."
    },
    {
      id: "tr-105",
      date: "2026-10-14",
      time: "19:00",
      duration: 70,
      title: "Dribble court & Finition face au but",
      category: "Technique",
      status: "terminé",
      intensity: 7,
      exercises: [
        { id: "ex-13", name: "Slalom piquets rapprochés (semelle, intérieur)", sets: "6 passages", completed: true },
        { id: "ex-14", name: "Frappes enroulées entrée des 16m", sets: "4 séries x 5 frappes", completed: true }
      ],
      notes: "Insister sur la précision plutôt que la puissance.",
      bilan: "8 tirs cadrés sur 10 sur la dernière série."
    },
    {
      id: "tr-106",
      date: "2026-10-16",
      time: "18:30",
      duration: 60,
      title: "Accélérations courtes & Freinages",
      category: "Vitesse",
      status: "terminé",
      intensity: 8,
      exercises: [
        { id: "ex-15", name: "Sprints 20m avec décélération bloquée sur 3m", sets: "6 reps", completed: true }
      ],
      notes: "Bonne explosivité.",
      bilan: "Sensations de vitesse optimales."
    },
    {
      id: "tr-107",
      date: "2026-10-18",
      time: "11:00",
      duration: 75,
      title: "Capacité aérobie spécifique ballon",
      category: "Endurance",
      status: "non réalisé",
      intensity: 0,
      exercises: [],
      notes: "Séance annulée cause météo orageuse.",
      bilan: "À reporter sur la semaine suivante."
    },
    {
      id: "tr-108",
      date: "2026-10-20",
      time: "18:30",
      duration: 80,
      title: "Passe courte & Jeu à une touche",
      category: "Technique",
      status: "terminé",
      intensity: 7,
      exercises: [
        { id: "ex-17", name: "Rondo 4v1 une touche imposée", sets: "3 x 6 min", completed: true }
      ],
      notes: "Vitesse de circulation du ballon fluide.",
      bilan: "Moins de déchets techniques. Prises de décision plus rapides."
    },
    {
      id: "tr-109",
      date: "2026-10-22",
      time: "19:00",
      duration: 60,
      title: "Sprints répétés (RSA)",
      category: "Vitesse",
      status: "terminé",
      intensity: 9,
      exercises: [
        { id: "ex-19", name: "Sprints 6 x 30m départ toutes les 30s", sets: "2 séries", completed: true }
      ],
      notes: "Exigeant sur le plan lactique.",
      bilan: "Chronomètres très réguliers."
    },
    {
      id: "tr-110",
      date: "2026-10-24",
      time: "10:00",
      duration: 60,
      title: "Haut du corps & Stabilité du tronc",
      category: "Poids du corps",
      status: "terminé",
      intensity: 6,
      exercises: [
        { id: "ex-20", name: "Pompes prises variées", sets: "5 x 15", completed: true },
        { id: "ex-21", name: "Tractions & tirages", sets: "4 x 8", completed: true }
      ],
      notes: "Focus sur la posture.",
      bilan: "Solide sur les duels."
    },
    {
      id: "tr-111",
      date: "2026-10-26",
      time: "18:30",
      duration: 75,
      title: "Contrôles aériens & Jeu de tête",
      category: "Technique",
      status: "terminé",
      intensity: 7,
      exercises: [
        { id: "ex-23", name: "Amorti de poitrine et contrôle poitrine-pied", sets: "20 répétitions", completed: true }
      ],
      notes: "Timing du saut bien calé.",
      bilan: "Excellente séance."
    },
    {
      id: "tr-112",
      date: "2026-10-28",
      time: "19:00",
      duration: 60,
      title: "Travail de vivacité & Appuis courts",
      category: "Vitesse",
      status: "prévu",
      intensity: 0,
      exercises: [
        { id: "ex-25", name: "Slalom coupelle court + sprint 15m", sets: "6 passages", completed: false }
      ],
      notes: "Prévoir crampons moulés.",
      bilan: ""
    },
    {
      id: "tr-113",
      date: "2026-10-30",
      time: "18:30",
      duration: 75,
      title: "Fartlek football & Courses en changement de rythme",
      category: "Endurance",
      status: "prévu",
      intensity: 0,
      exercises: [
        { id: "ex-27", name: "Course continue 40 min avec accélérations", sets: "1 bloc", completed: false }
      ],
      notes: "Simuler l'effort réel d'un match.",
      bilan: ""
    },
    {
      id: "tr-114",
      date: "2026-11-01",
      time: "10:30",
      duration: 50,
      title: "Circuit proprioception & Cheville",
      category: "Poids du corps",
      status: "prévu",
      intensity: 0,
      exercises: [
        { id: "ex-28", name: "Équilibre unipodal", sets: "4 x 1 min par jambe", completed: false }
      ],
      notes: "Séance axée sur la solidité des chevilles.",
      bilan: ""
    }
  ],
  tests: [
    {
      id: "test-1",
      name: "Sprint 30m départ arrêté",
      type: "temps",
      unit: "s",
      protocol: "Départ arrêté, pied avant sur la ligne. Chronométrage précis au franchissement des 30 mètres.",
      measures: [
        { id: "m-101", date: "2026-09-15", value: 4.45, notes: "Test initial de rentrée." },
        { id: "m-102", date: "2026-09-29", value: 4.38, notes: "Terrain sec." },
        { id: "m-103", date: "2026-10-13", value: 4.29, notes: "Bonne explosivité." },
        { id: "m-104", date: "2026-10-26", value: 4.22, notes: "Record personnel battu !" }
      ]
    },
    {
      id: "test-2",
      name: "Test VMA (Vameval / Demi-Cooper)",
      type: "nombre",
      unit: "km/h",
      protocol: "Évaluation de la vitesse maximale aérobie par paliers progressifs.",
      measures: [
        { id: "m-201", date: "2026-09-10", value: 14.5, notes: "Reprise." },
        { id: "m-202", date: "2026-10-01", value: 15.0, notes: "Palier 15 validé." },
        { id: "m-203", date: "2026-10-20", value: 15.5, notes: "Nouveau record personnel." }
      ]
    },
    {
      id: "test-3",
      name: "Précision frappes aux 16m",
      type: "reussites",
      unit: "tirs cadrés",
      protocol: "10 frappes à l'entrée de la surface (16m50). Comptabiliser les tirs cadrés.",
      measures: [
        { id: "m-301", date: "2026-09-18", value: 5, attempts: 10, notes: "Trop de ballons au-dessus." },
        { id: "m-302", date: "2026-10-05", value: 7, attempts: 10, notes: "Meilleur verrouillage de cheville." },
        { id: "m-303", date: "2026-10-22", value: 8, attempts: 10, notes: "8 sur 10 ! Très bonne régularité." }
      ]
    },
    {
      id: "test-4",
      name: "Série de jongles pied gauche",
      type: "nombre",
      unit: "jongles",
      protocol: "Maximum de jongles consécutifs exclusivement du pied gauche sans chute.",
      measures: [
        { id: "m-401", date: "2026-09-12", value: 24, notes: "Trajectoire irrégulière." },
        { id: "m-402", date: "2026-09-28", value: 42, notes: "Nette amélioration." },
        { id: "m-403", date: "2026-10-15", value: 65, notes: "Rythme mieux contrôlé." },
        { id: "m-404", date: "2026-10-25", value: 82, notes: "Objectif 100 en vue !" }
      ]
    }
  ],
  settings: {
    geminiApiKey: '',
    model: 'gemini-3.8-flash'
  }
};

function updateClientExerciseHistory(training) {
  if (!state.exerciseHistory) {
    state.exerciseHistory = { lastTrainingDates: {}, recentExercises: [] };
  }
  if (training.category && training.date) {
    const existing = state.exerciseHistory.lastTrainingDates[training.category];
    if (!existing || training.date > existing) {
      state.exerciseHistory.lastTrainingDates[training.category] = training.date;
    }
  }
  if (Array.isArray(training.exercises) && training.exercises.length > 0) {
    const recent = state.exerciseHistory.recentExercises || [];
    training.exercises.forEach(ex => {
      const exName = (typeof ex === 'string' ? ex : (ex.name || '')).trim();
      if (!exName) return;
      const filtered = recent.filter(r => r.name.toLowerCase() !== exName.toLowerCase());
      filtered.unshift({
        name: exName,
        date: training.date,
        category: training.category || 'Général',
        sets: ex.sets || ''
      });
      state.exerciseHistory.recentExercises = filtered.slice(0, 50);
    });
  }
}

function saveLocalStorageCache() {
  try {
    localStorage.setItem('football_tracker_data', JSON.stringify({
      trainings: state.trainings,
      tests: state.tests,
      exerciseHistory: state.exerciseHistory,
      settings: state.settings
    }));
  } catch (e) {}
}

function loadLocalStorageCache() {
  try {
    const raw = localStorage.getItem('football_tracker_data');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_SEED_DATA));
}

// --- API CLIENT ---
const api = {
  async getData() {
    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        isServerAvailable = true;
        const data = await res.json();
        saveLocalStorageCache();
        return data;
      }
    } catch (_) {}

    // Fallback LocalStorage
    isServerAvailable = false;
    return loadLocalStorageCache();
  },

  async createTraining(training) {
    updateClientExerciseHistory(training);
    if (isServerAvailable) {
      try {
        const res = await fetch('/api/trainings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(training)
        });
        if (res.ok) {
          const created = await res.json();
          saveLocalStorageCache();
          return created;
        }
      } catch (_) {}
    }
    // Local fallback
    const newTr = {
      ...training,
      id: 'tr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      duration: Number(training.duration) || 60,
      exercises: Array.isArray(training.exercises) ? training.exercises : []
    };
    saveLocalStorageCache();
    return newTr;
  },

  async updateTraining(id, training) {
    updateClientExerciseHistory(training);
    if (isServerAvailable) {
      try {
        const res = await fetch(`/api/trainings/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(training)
        });
        if (res.ok) {
          const updated = await res.json();
          saveLocalStorageCache();
          return updated;
        }
      } catch (_) {}
    }
    saveLocalStorageCache();
    return { ...training, id };
  },

  async deleteTraining(id) {
    if (isServerAvailable) {
      try {
        await fetch(`/api/trainings/${id}`, { method: 'DELETE' });
      } catch (_) {}
    }
    saveLocalStorageCache();
    return { success: true, id };
  },

  async createTest(testData) {
    if (isServerAvailable) {
      try {
        const res = await fetch('/api/tests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData)
        });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    const newTest = {
      ...testData,
      id: 'test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      measures: []
    };
    saveLocalStorageCache();
    return newTest;
  },

  async updateTest(id, testData) {
    if (isServerAvailable) {
      try {
        const res = await fetch(`/api/tests/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData)
        });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    saveLocalStorageCache();
    return { ...testData, id };
  },

  async deleteTest(id) {
    if (isServerAvailable) {
      try {
        await fetch(`/api/tests/${id}`, { method: 'DELETE' });
      } catch (_) {}
    }
    saveLocalStorageCache();
    return { success: true, id };
  },

  async addMeasure(testId, measureData) {
    if (isServerAvailable) {
      try {
        const res = await fetch(`/api/tests/${testId}/measures`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(measureData)
        });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    const test = state.tests.find(t => t.id === testId);
    const newMeasure = {
      id: 'm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      ...measureData
    };
    if (test) {
      test.measures = test.measures || [];
      test.measures.push(newMeasure);
      test.measures.sort((a, b) => a.date.localeCompare(b.date));
    }
    saveLocalStorageCache();
    return { test, newMeasure };
  },

  async deleteMeasure(testId, measureId) {
    if (isServerAvailable) {
      try {
        await fetch(`/api/tests/${testId}/measures/${measureId}`, { method: 'DELETE' });
      } catch (_) {}
    }
    const test = state.tests.find(t => t.id === testId);
    if (test) {
      test.measures = (test.measures || []).filter(m => m.id !== measureId);
    }
    saveLocalStorageCache();
    return { success: true };
  },

  async saveSettings(settings) {
    if (isServerAvailable) {
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    state.settings = { ...state.settings, ...settings };
    saveLocalStorageCache();
    return { success: true };
  },

  async sendChatMessage(message, history, apiKey) {
    // 1. Try server endpoint first
    if (isServerAvailable) {
      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, history, apiKey })
        });
        if (res.ok) return await res.json();
      } catch (_) {}
    }

    // 2. Client-side direct call to Gemini API if server not running
    const effectiveKey = apiKey || state.settings?.geminiApiKey;
    if (!effectiveKey) {
      return {
        configured: false,
        error: 'API_KEY_REQUIRED',
        message: 'Aucune clé API Gemini configurée.'
      };
    }

    try {
      const model = state.settings?.model || 'gemini-3.8-flash';
      const promptData = buildClientCoachPrompt(message);
      
      const contents = [];
      for (const m of history.slice(-6)) {
        contents.push({
          role: m.role === 'coach' ? 'model' : 'user',
          parts: [{ text: m.text }]
        });
      }
      contents.push({ role: 'user', parts: [{ text: message }] });

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey}`;
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: promptData }] },
          contents: contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 1500 }
        })
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        return {
          configured: true,
          error: 'GEMINI_ERROR',
          message: errJson.error?.message || `Erreur Gemini (${resp.status})`
        };
      }

      const resJson = await resp.json();
      const reply = resJson.candidates?.[0]?.content?.parts?.[0]?.text || 'Aucune réponse reçue.';
      
      return { configured: true, reply };
    } catch (e) {
      return { configured: true, error: 'FETCH_ERROR', message: e.message };
    }
  }
};

function buildClientCoachPrompt(userMessage) {
  return `Tu es un coach de football. Tu réponds UNIQUEMENT à partir des programmes de séances de vitesse et d'exercices solo fournis. Tes réponses sont en texte simple, concis, en français. Tu ne génères pas de JSON, pas de blocs de code, pas de formats techniques.`;
}

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '⚠️'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// --- NAVIGATION & ROUTING ---
function navigateTo(pageId) {
  state.activePage = pageId;

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageId);
  });

  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.toggle('active', view.id === `view-${pageId}`);
  });

  const topbarHeading = document.getElementById('topbar-heading');
  const topbarSubheading = document.getElementById('topbar-subheading');

  if (pageId === 'calendar') {
    topbarHeading.textContent = 'Calendrier hebdomadaire';
    topbarSubheading.textContent = 'Planifiez, détaillez et analysez vos séances d\'entraînement';
    if (window.calendarModule) window.calendarModule.render();
  } else if (pageId === 'stats') {
    topbarHeading.textContent = 'Statistiques & Progression';
    topbarSubheading.textContent = 'Analyse de la charge, du volume et des catégories d\'entraînement';
    if (window.statsModule) window.statsModule.render();
  } else if (pageId === 'tests') {
    topbarHeading.textContent = 'Tests Physiques & Évaluations';
    topbarSubheading.textContent = 'Suivi des records personnels et progression chronologique';
    if (window.testsModule) window.testsModule.render();
  } else if (pageId === 'coach') {
    topbarHeading.textContent = 'Coach IA Football';
    topbarSubheading.textContent = 'Conseils tactiques, exercices personnalisés et planification connectée';
    if (window.coachModule) window.coachModule.onEnterPage();
  }
}

function updateSidebarAIStatus() {
  const dot = document.getElementById('sidebar-ai-dot');
  const label = document.getElementById('sidebar-ai-label');
  if (!dot || !label) return;

  const isConfigured = Boolean(state.settings.hasGeminiKey || state.settings.geminiApiKey);
  if (isConfigured) {
    dot.className = 'status-dot active';
    label.textContent = 'Coach IA (Connecté)';
  } else {
    dot.className = 'status-dot';
    label.textContent = 'Coach IA (À configurer)';
  }
}

// --- BACKUP & RESTORE MODAL ---
function initBackupHandlers() {
  const btnOpenBackup = document.getElementById('btn-open-backup');
  const modalBackup = document.getElementById('modal-backup');
  const btnCloseBackup = document.getElementById('btn-close-backup-modal');
  const btnCloseBackupFooter = document.getElementById('btn-close-backup-footer');
  const btnExport = document.getElementById('btn-export-backup');
  const btnTriggerImport = document.getElementById('btn-trigger-import');
  const inputImportFile = document.getElementById('input-import-file');

  if (btnOpenBackup) {
    btnOpenBackup.addEventListener('click', () => modalBackup.classList.add('open'));
  }
  const closeBackupModal = () => modalBackup.classList.remove('open');
  if (btnCloseBackup) btnCloseBackup.addEventListener('click', closeBackupModal);
  if (btnCloseBackupFooter) btnCloseBackupFooter.addEventListener('click', closeBackupModal);

  // Export JSON file
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const jsonStr = JSON.stringify({
        trainings: state.trainings,
        tests: state.tests,
        exerciseHistory: state.exerciseHistory,
        settings: state.settings
      }, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `football_tracker_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Sauvegarde JSON téléchargée', 'success');
    });
  }

  // Import JSON file
  if (btnTriggerImport && inputImportFile) {
    btnTriggerImport.addEventListener('click', () => inputImportFile.click());
    inputImportFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data.trainings) || !Array.isArray(data.tests)) {
          throw new Error('Format de fichier invalide');
        }
        state.trainings = data.trainings;
        state.tests = data.tests;
        state.exerciseHistory = data.exerciseHistory || { lastTrainingDates: {}, recentExercises: [] };
        state.settings = data.settings || state.settings;
        saveLocalStorageCache();

        if (isServerAvailable) {
          fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          }).catch(() => {});
        }

        navigateTo(state.activePage);
        closeBackupModal();
        showToast('Données restaurées avec succès !', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        inputImportFile.value = '';
      }
    });
  }
}

// Global initial data loader
async function loadInitialData() {
  try {
    const data = await api.getData();
    state.trainings = data.trainings || [];
    state.tests = data.tests || [];
    state.exerciseHistory = data.exerciseHistory || { lastTrainingDates: {}, recentExercises: [] };
    state.settings = data.settings || {};
    updateSidebarAIStatus();
    navigateTo(state.activePage);
  } catch (err) {
    console.warn('Initial load warning:', err);
    navigateTo(state.activePage);
  }
}

// App bootstrapping
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      if (page) navigateTo(page);
    });
  });

  initBackupHandlers();
  loadInitialData();
});
