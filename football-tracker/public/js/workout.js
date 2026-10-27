/**
 * Football Tracker - Module Mode Entraînement
 * Gère l'interface dédiée à la réalisation d'une séance en cours.
 */

window.workoutModule = (() => {
  // ─── État de la session ────────────────────────────────────────────────────
  let session = null;
  /*
    session = {
      trainingId: string,
      training: { ...full training object },
      currentIndex: number,           // index de l'exercice courant
      exerciseStates: [               // état de chaque exercice
        { status: 'pending'|'done'|'skipped' }
      ],
      startedAt: timestamp (ms),
      completedAt: null|timestamp
    }
  */

  // ─── Chronomètre ──────────────────────────────────────────────────────────
  const timer = {
    mode: 'idle',         // 'idle' | 'exercise' | 'rest'
    running: false,
    startTs: null,        // Date.now() when last started
    elapsed: 0,           // accumulated ms before last pause
    totalMs: 0,           // total duration for countdown (0 = stopwatch)
    interval: null,
    onTick: null,
    onEnd: null,

    start(totalSeconds, onTick, onEnd) {
      this.stop();
      this.totalMs = (totalSeconds || 0) * 1000;
      this.elapsed = 0;
      this.startTs = Date.now();
      this.running = true;
      this.onTick = onTick;
      this.onEnd = onEnd;
      this._tick();
      this.interval = setInterval(() => this._tick(), 250);
    },

    resume() {
      if (this.running) return;
      this.startTs = Date.now();
      this.running = true;
      this._tick();
      this.interval = setInterval(() => this._tick(), 250);
    },

    pause() {
      if (!this.running) return;
      this.elapsed += Date.now() - this.startTs;
      this.running = false;
      clearInterval(this.interval);
      this.interval = null;
      if (this.onTick) this.onTick(this._currentMs(), false);
    },

    stop() {
      this.running = false;
      clearInterval(this.interval);
      this.interval = null;
      this.elapsed = 0;
      this.startTs = null;
      this.totalMs = 0;
      this.onTick = null;
      this.onEnd = null;
    },

    reset() {
      const wasRunning = this.running;
      this.pause();
      this.elapsed = 0;
      this.startTs = null;
      if (wasRunning) this.resume();
      if (this.onTick) this.onTick(0, false);
    },

    _currentMs() {
      const acc = this.elapsed + (this.running ? Date.now() - this.startTs : 0);
      if (this.totalMs > 0) {
        return Math.max(0, this.totalMs - acc);
      }
      return acc;
    },

    _tick() {
      const ms = this._currentMs();
      if (this.onTick) this.onTick(ms, this.running);
      if (this.totalMs > 0 && ms <= 0) {
        this.stop();
        if (this.onEnd) this.onEnd();
      }
    }
  };

  // ─── Sauvegarde locale de progression ──────────────────────────────────────
  const STORAGE_KEY = 'workout_session_progress';

  function saveProgress() {
    if (!session) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        trainingId: session.trainingId,
        currentIndex: session.currentIndex,
        exerciseStates: session.exerciseStates,
        startedAt: session.startedAt
      }));
    } catch (e) {}
  }

  function loadProgress(trainingId) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (saved.trainingId !== trainingId) return null;
      return saved;
    } catch (e) { return null; }
  }

  function clearProgress() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  // ─── Utilitaires ──────────────────────────────────────────────────────────
  function formatTime(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function parseDurationSeconds(str) {
    // Try to parse things like "30s", "2min", "1:30", "60"
    if (!str) return null;
    const s = str.toLowerCase().trim();
    const minSec = s.match(/(\d+)\s*min(?:ute)?s?\s*(?:x\s*)?(\d+)?\s*s?(?:ec)?/);
    if (minSec) {
      return parseInt(minSec[1]) * 60 + (parseInt(minSec[2]) || 0);
    }
    const minOnly = s.match(/(\d+)\s*min/);
    if (minOnly) return parseInt(minOnly[1]) * 60;
    const secOnly = s.match(/(\d+)\s*s(?:ec)?/);
    if (secOnly) return parseInt(secOnly[1]);
    const colonFmt = s.match(/^(\d+):(\d+)$/);
    if (colonFmt) return parseInt(colonFmt[1]) * 60 + parseInt(colonFmt[2]);
    const num = parseInt(s);
    if (!isNaN(num) && num < 3600) return num; // bare number < 1h assumed seconds
    return null;
  }

  function parseRestSeconds(setsStr) {
    // Look for "(r=30s)", "(rec: 1min)", "récup 45s" etc.
    if (!setsStr) return null;
    const match = setsStr.match(/r[eéc.=:\s]+(\d+)\s*(min|s)/i);
    if (match) {
      const n = parseInt(match[1]);
      return match[2].startsWith('m') ? n * 60 : n;
    }
    return null;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getCatClass(category) {
    if (!category) return 'technique';
    return category.replace(/\s+/g, '').toLowerCase();
  }

  // ─── Entrée dans le mode entraînement ─────────────────────────────────────
  function startWorkout(trainingId) {
    const training = state.trainings.find(t => t.id === trainingId);
    if (!training) return;

    const exercises = Array.isArray(training.exercises) && training.exercises.length > 0
      ? training.exercises
      : [];

    // Check for saved progress
    const saved = loadProgress(trainingId);
    if (saved && exercises.length > 0) {
      const doneCount = (saved.exerciseStates || []).filter(s => s.status !== 'pending').length;
      if (doneCount > 0) {
        if (confirm(`Tu avais déjà commencé cette séance (${doneCount} exercice${doneCount > 1 ? 's' : ''} traité${doneCount > 1 ? 's' : ''}). Reprendre là où tu t'étais arrêté ?`)) {
          session = {
            trainingId,
            training: JSON.parse(JSON.stringify(training)),
            currentIndex: saved.currentIndex || 0,
            exerciseStates: saved.exerciseStates || exercises.map(() => ({ status: 'pending' })),
            startedAt: saved.startedAt || Date.now(),
            completedAt: null
          };
          openWorkoutOverlay();
          return;
        }
      }
    }

    // New session
    session = {
      trainingId,
      training: JSON.parse(JSON.stringify(training)),
      currentIndex: 0,
      exerciseStates: exercises.map(() => ({ status: 'pending' })),
      startedAt: Date.now(),
      completedAt: null
    };
    saveProgress();
    openWorkoutOverlay();
  }

  // ─── Ouvrir l'overlay ─────────────────────────────────────────────────────
  function openWorkoutOverlay() {
    const overlay = document.getElementById('workout-overlay');
    if (!overlay) return;
    timer.stop();
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    renderWorkout();
  }

  function closeWorkoutOverlay() {
    const overlay = document.getElementById('workout-overlay');
    if (!overlay) return;
    timer.stop();
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    session = null;
  }

  // ─── Rendu principal de l'interface ───────────────────────────────────────
  function renderWorkout() {
    if (!session) return;
    const { training, currentIndex, exerciseStates } = session;
    const exercises = training.exercises || [];
    const total = exercises.length;

    // Header info
    document.getElementById('wo-session-title').textContent = training.title || 'Séance';
    document.getElementById('wo-session-meta').textContent =
      `${training.duration || '?'} min • ${training.category || ''}`;

    const catClass = getCatClass(training.category);
    const headerEl = document.getElementById('wo-header');
    headerEl.className = `wo-header wo-header-${catClass}`;

    // Progress
    const doneCount = exerciseStates.filter(s => s.status !== 'pending').length;
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    document.getElementById('wo-progress-bar-fill').style.width = `${pct}%`;
    document.getElementById('wo-progress-text').textContent =
      total > 0
        ? `${doneCount} / ${total} exercice${total > 1 ? 's' : ''} traité${doneCount > 1 ? 's' : ''}`
        : 'Aucun exercice';

    // Check completion
    if (total > 0 && doneCount >= total) {
      renderSummary();
      return;
    }

    // Exercise counter
    document.getElementById('wo-ex-counter').textContent =
      total > 0 ? `Exercice ${currentIndex + 1} / ${total}` : '';

    // Current exercise
    if (total === 0) {
      renderNoExercises();
      return;
    }

    const ex = exercises[currentIndex];
    const exState = exerciseStates[currentIndex];

    document.getElementById('wo-ex-name').textContent = ex.name || 'Exercice';
    document.getElementById('wo-ex-sets').textContent = ex.sets || '';
    document.getElementById('wo-ex-notes').textContent = ex.notes || training.notes || '';

    // Status badge
    const statusBadge = document.getElementById('wo-ex-status-badge');
    statusBadge.className = 'wo-ex-status-badge';
    if (exState.status === 'done') {
      statusBadge.textContent = '✓ Terminé';
      statusBadge.classList.add('done');
    } else if (exState.status === 'skipped') {
      statusBadge.textContent = '→ Passé';
      statusBadge.classList.add('skipped');
    } else {
      statusBadge.textContent = '';
    }

    // Timer section: detect if exercise has a duration
    const durSec = parseDurationSeconds(ex.sets);
    const restSec = parseRestSeconds(ex.sets);

    renderTimerSection(durSec, restSec);

    // Nav buttons
    document.getElementById('wo-btn-prev').disabled = currentIndex === 0;
    const isDone = exState.status !== 'pending';
    document.getElementById('wo-btn-done').disabled = isDone;
    document.getElementById('wo-btn-done').style.opacity = isDone ? '0.5' : '1';

    // Show summary panel
    document.getElementById('wo-summary-screen').style.display = 'none';
    document.getElementById('wo-exercise-screen').style.display = 'flex';

    // Mini list of all exercises
    renderExerciseMiniList();
  }

  function renderNoExercises() {
    document.getElementById('wo-ex-name').textContent = 'Aucun exercice';
    document.getElementById('wo-ex-sets').textContent = '';
    document.getElementById('wo-ex-notes').textContent = training.notes || 'Séance sans exercice détaillé.';
    document.getElementById('wo-ex-counter').textContent = '';
    document.getElementById('wo-timer-section').innerHTML = '';
    document.getElementById('wo-btn-done').disabled = false;
  }

  function renderTimerSection(durSec, restSec) {
    const section = document.getElementById('wo-timer-section');

    // Stop any running timer first
    timer.stop();
    updateTimerDisplay(0, false, 'idle');

    let html = '<div class="wo-timer-actions">';

    if (durSec) {
      html += `<button class="btn btn-secondary wo-timer-btn" id="wo-btn-start-exercise-timer" title="Lancer le chronomètre de l'exercice">
        ▶ Démarrer (${formatTime(durSec * 1000)})
      </button>`;
    } else {
      html += `<button class="btn btn-secondary wo-timer-btn" id="wo-btn-start-stopwatch" title="Chronomètre libre">
        ⏱ Chronométrer
      </button>`;
    }

    if (restSec) {
      html += `<button class="btn btn-secondary wo-timer-btn" id="wo-btn-start-rest" title="Démarrer la récupération">
        💤 Récupération (${formatTime(restSec * 1000)})
      </button>`;
    }

    html += `</div>`;
    section.innerHTML = html;

    // Bind timer buttons
    const btnEx = document.getElementById('wo-btn-start-exercise-timer');
    if (btnEx) {
      btnEx.addEventListener('click', () => {
        timer.mode = 'exercise';
        timer.start(durSec, (ms, running) => {
          updateTimerDisplay(ms, running, 'exercise');
        }, () => {
          onTimerEnd('exercise');
        });
        section.querySelector('.wo-timer-actions').style.display = 'none';
      });
    }

    const btnStopwatch = document.getElementById('wo-btn-start-stopwatch');
    if (btnStopwatch) {
      btnStopwatch.addEventListener('click', () => {
        timer.mode = 'exercise';
        timer.start(0, (ms, running) => {
          updateTimerDisplay(ms, running, 'exercise');
        }, null);
        section.querySelector('.wo-timer-actions').style.display = 'none';
      });
    }

    const btnRest = document.getElementById('wo-btn-start-rest');
    if (btnRest) {
      btnRest.addEventListener('click', () => {
        timer.mode = 'rest';
        timer.start(restSec, (ms, running) => {
          updateTimerDisplay(ms, running, 'rest');
        }, () => {
          onTimerEnd('rest');
        });
        section.querySelector('.wo-timer-actions').style.display = 'none';
      });
    }
  }

  function updateTimerDisplay(ms, running, mode) {
    const display = document.getElementById('wo-timer-display');
    if (!display) return;

    const timeStr = formatTime(ms);
    const modeLabel = mode === 'rest' ? 'Récupération' : mode === 'exercise' ? 'Exercice' : '';
    const modeClass = mode === 'rest' ? 'rest' : mode === 'exercise' ? 'exercise' : '';

    display.innerHTML = `
      <div class="wo-timer-value ${modeClass}">${timeStr}</div>
      ${modeLabel ? `<div class="wo-timer-mode-label">${modeLabel}</div>` : ''}
      <div class="wo-timer-controls">
        ${mode !== 'idle' ? `
          <button class="btn btn-secondary btn-sm" id="wo-btn-timer-toggle">
            ${running ? '⏸ Pause' : '▶ Reprendre'}
          </button>
          <button class="btn btn-secondary btn-sm" id="wo-btn-timer-reset">⟳ Réinit.</button>
          <button class="btn btn-secondary btn-sm" id="wo-btn-timer-stop">✕ Arrêter</button>
        ` : ''}
      </div>
    `;

    const btnToggle = document.getElementById('wo-btn-timer-toggle');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        if (timer.running) timer.pause();
        else timer.resume();
      });
    }

    const btnReset = document.getElementById('wo-btn-timer-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => timer.reset());
    }

    const btnStop = document.getElementById('wo-btn-timer-stop');
    if (btnStop) {
      btnStop.addEventListener('click', () => {
        timer.stop();
        const section = document.getElementById('wo-timer-section');
        const { training, currentIndex } = session;
        const exercises = training.exercises || [];
        const ex = exercises[currentIndex];
        const durSec = parseDurationSeconds(ex?.sets);
        const restSec = parseRestSeconds(ex?.sets);
        renderTimerSection(durSec, restSec);
        updateTimerDisplay(0, false, 'idle');
      });
    }
  }

  function onTimerEnd(mode) {
    // Visual feedback
    const display = document.getElementById('wo-timer-display');
    if (display) {
      const val = display.querySelector('.wo-timer-value');
      if (val) {
        val.classList.add('wo-timer-finished');
        setTimeout(() => val?.classList.remove('wo-timer-finished'), 3000);
      }
    }

    // Sound: short beep via Web Audio API (no external dependency)
    playBeep();

    // Update label
    const modeLabel = mode === 'rest' ? '✓ Récupération terminée !' : '✓ Temps écoulé !';
    const display2 = document.getElementById('wo-timer-display');
    if (display2) {
      const modeEl = display2.querySelector('.wo-timer-mode-label');
      if (modeEl) modeEl.textContent = modeLabel;
    }
  }

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {}
  }

  function renderExerciseMiniList() {
    const list = document.getElementById('wo-mini-list');
    if (!list || !session) return;
    const { training, currentIndex, exerciseStates } = session;
    const exercises = training.exercises || [];

    list.innerHTML = '';
    exercises.forEach((ex, i) => {
      const item = document.createElement('div');
      const st = exerciseStates[i].status;
      item.className = `wo-mini-item ${i === currentIndex ? 'current' : ''} ${st === 'done' ? 'done' : st === 'skipped' ? 'skipped' : ''}`;
      item.innerHTML = `
        <span class="wo-mini-num">${i + 1}</span>
        <span class="wo-mini-name">${escapeHtml(ex.name)}</span>
        <span class="wo-mini-icon">${st === 'done' ? '✓' : st === 'skipped' ? '→' : ''}</span>
      `;
      item.addEventListener('click', () => {
        session.currentIndex = i;
        timer.stop();
        saveProgress();
        renderWorkout();
      });
      list.appendChild(item);
    });
  }

  // ─── Écran récapitulatif ───────────────────────────────────────────────────
  function renderSummary() {
    const { training, exerciseStates, startedAt } = session;
    const exercises = training.exercises || [];
    const doneCount = exerciseStates.filter(s => s.status === 'done').length;
    const skippedCount = exerciseStates.filter(s => s.status === 'skipped').length;
    const elapsedMin = Math.round((Date.now() - startedAt) / 60000);

    document.getElementById('wo-exercise-screen').style.display = 'none';
    document.getElementById('wo-summary-screen').style.display = 'flex';

    document.getElementById('wo-summary-title').textContent = training.title;
    document.getElementById('wo-summary-duration-planned').textContent = `${training.duration || '?'} min prévues`;
    document.getElementById('wo-summary-duration-actual').textContent = `≈ ${elapsedMin} min réalisées`;
    document.getElementById('wo-summary-done').textContent = doneCount;
    document.getElementById('wo-summary-skipped').textContent = skippedCount;
    document.getElementById('wo-summary-total').textContent = exercises.length;

    // Already validated?
    const alreadyDone = training.status === 'terminé';
    const btnValidate = document.getElementById('wo-btn-validate');
    if (alreadyDone) {
      btnValidate.disabled = true;
      btnValidate.textContent = '✓ Déjà validée';
      btnValidate.style.opacity = '0.5';
    } else {
      btnValidate.disabled = false;
      btnValidate.textContent = '✓ Valider la séance';
      btnValidate.style.opacity = '1';
    }
  }

  // ─── Validation finale ─────────────────────────────────────────────────────
  async function validateSession() {
    if (!session) return;
    const { training, trainingId, exerciseStates } = session;

    // Prevent double validation
    if (training.status === 'terminé') {
      showToast('Cette séance est déjà validée.', 'error');
      return;
    }

    const btn = document.getElementById('wo-btn-validate');
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';

    try {
      const today = new Date().toISOString().slice(0, 10);
      const updatedExercises = (training.exercises || []).map((ex, i) => ({
        ...ex,
        completed: exerciseStates[i]?.status === 'done'
      }));

      const updatedData = {
        ...training,
        status: 'terminé',
        completedAt: today,
        exercises: updatedExercises,
        bilan: training.bilan || ''
      };

      const updated = await api.updateTraining(trainingId, updatedData);

      // Sync state
      const idx = state.trainings.findIndex(t => t.id === trainingId);
      if (idx !== -1) state.trainings[idx] = updated;

      // Clear saved progress
      clearProgress();

      showToast('🎉 Séance validée et enregistrée !', 'success');

      // Refresh calendar
      if (window.calendarModule) window.calendarModule.render();

      // Close overlay after short delay
      setTimeout(() => {
        closeWorkoutOverlay();
      }, 1200);

    } catch (err) {
      btn.disabled = false;
      btn.textContent = '✓ Valider la séance';
      showToast('Erreur lors de la validation : ' + err.message, 'error');
    }
  }

  // ─── Navigation entre exercices ───────────────────────────────────────────
  function goToPrev() {
    if (!session || session.currentIndex <= 0) return;
    timer.stop();
    session.currentIndex--;
    saveProgress();
    renderWorkout();
  }

  function goToNext() {
    if (!session) return;
    const total = (session.training.exercises || []).length;
    timer.stop();
    if (session.currentIndex < total - 1) {
      session.currentIndex++;
      saveProgress();
      renderWorkout();
    } else {
      // Already at last — show summary
      renderSummary();
    }
  }

  function markDone() {
    if (!session) return;
    const { exerciseStates, currentIndex, training } = session;
    const total = (training.exercises || []).length;

    exerciseStates[currentIndex].status = 'done';
    saveProgress();

    timer.stop();

    // Auto-advance to next pending, or summary if all done
    const nextPending = exerciseStates.findIndex((s, i) => i > currentIndex && s.status === 'pending');
    const allDone = exerciseStates.every(s => s.status !== 'pending');

    if (allDone) {
      renderSummary();
    } else if (nextPending !== -1) {
      session.currentIndex = nextPending;
      renderWorkout();
    } else {
      renderWorkout(); // re-render current (shows done badge)
    }
  }

  function markSkipped() {
    if (!session) return;
    const { exerciseStates, currentIndex, training } = session;
    const total = (training.exercises || []).length;

    exerciseStates[currentIndex].status = 'skipped';
    saveProgress();
    timer.stop();

    const nextPending = exerciseStates.findIndex((s, i) => i > currentIndex && s.status === 'pending');
    const allDone = exerciseStates.every(s => s.status !== 'pending');

    if (allDone) {
      renderSummary();
    } else if (nextPending !== -1) {
      session.currentIndex = nextPending;
      renderWorkout();
    } else {
      renderWorkout();
    }
  }

  // ─── Initialisation des handlers de l'overlay ─────────────────────────────
  function initOverlayHandlers() {
    const overlay = document.getElementById('workout-overlay');
    if (!overlay) return;

    // Close button
    document.getElementById('wo-btn-close')?.addEventListener('click', () => {
      if (session) {
        saveProgress();
        if (!confirm('Quitter la séance ? Ta progression sera sauvegardée.')) return;
      }
      timer.stop();
      closeWorkoutOverlay();
    });

    // Nav
    document.getElementById('wo-btn-prev')?.addEventListener('click', goToPrev);
    document.getElementById('wo-btn-next')?.addEventListener('click', goToNext);
    document.getElementById('wo-btn-done')?.addEventListener('click', markDone);
    document.getElementById('wo-btn-skip')?.addEventListener('click', markSkipped);

    // Summary actions
    document.getElementById('wo-btn-validate')?.addEventListener('click', validateSession);
    document.getElementById('wo-btn-close-summary')?.addEventListener('click', () => {
      if (!confirm('Fermer sans valider ? La séance ne sera pas marquée comme terminée.')) return;
      timer.stop();
      saveProgress();
      closeWorkoutOverlay();
    });
  }

  // ─── API publique ──────────────────────────────────────────────────────────
  initOverlayHandlers();

  return {
    startWorkout
  };
})();
