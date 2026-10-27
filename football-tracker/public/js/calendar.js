/**
 * Football Tracker - Module Calendrier Hebdomadaire
 */

window.calendarModule = (() => {
  let currentMonday = getMonday(new Date());
  let currentEditingTraining = null;

  // Helper: Get Monday of the week for any date
  function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  // Format date to YYYY-MM-DD
  function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Month names in French
  const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  // Initialize UI event handlers
  function initHandlers() {
    const btnPrev = document.getElementById('btn-prev-week');
    const btnNext = document.getElementById('btn-next-week');
    const btnCurrent = document.getElementById('btn-current-week');
    const btnAddTop = document.getElementById('btn-add-training-top');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        currentMonday.setDate(currentMonday.getDate() - 7);
        render();
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        currentMonday.setDate(currentMonday.getDate() + 7);
        render();
      });
    }

    if (btnCurrent) {
      btnCurrent.addEventListener('click', () => {
        currentMonday = getMonday(new Date());
        render();
      });
    }

    if (btnAddTop) {
      btnAddTop.addEventListener('click', () => {
        openNewTrainingModal(formatDateKey(new Date()));
      });
    }

    initSlideOverPanel();
    initNewTrainingModal();
  }

  // Render weekly grid
  function render() {
    const weekGrid = document.getElementById('week-grid');
    const weekLabel = document.getElementById('current-week-label');
    if (!weekGrid) return;

    weekGrid.innerHTML = '';

    // Calculate dates of the week
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + i);
      weekDays.push(d);
    }

    const sunday = weekDays[6];
    const rangeStr = `${currentMonday.getDate()} ${MONTHS_FR[currentMonday.getMonth()]} - ${sunday.getDate()} ${MONTHS_FR[sunday.getMonth()]} ${sunday.getFullYear()}`;
    if (weekLabel) weekLabel.textContent = `Semaine du ${rangeStr}`;

    const todayKey = formatDateKey(new Date());

    // Generate columns for each day
    weekDays.forEach((dayDate, idx) => {
      const dateKey = formatDateKey(dayDate);
      const isToday = dateKey === todayKey;

      const col = document.createElement('div');
      col.className = `day-column ${isToday ? 'is-today' : ''}`;

      // Column Header
      const header = document.createElement('div');
      header.className = 'day-header';
      header.innerHTML = `
        <span class="day-name">${DAYS_FR[idx]}</span>
        <span class="day-number">${dayDate.getDate()}</span>
      `;
      col.appendChild(header);

      // Events container
      const eventsContainer = document.createElement('div');
      eventsContainer.className = 'day-events';

      // Find workouts for this day
      const dayTrainings = state.trainings.filter(t => t.date === dateKey);

      if (dayTrainings.length === 0) {
        const emptyBtn = document.createElement('div');
        emptyBtn.className = 'day-events-empty';
        emptyBtn.textContent = '+ Planifier';
        emptyBtn.title = `Ajouter une séance le ${dateKey}`;
        emptyBtn.addEventListener('click', () => openNewTrainingModal(dateKey));
        eventsContainer.appendChild(emptyBtn);
      } else {
        dayTrainings.forEach(training => {
          const card = createTrainingCard(training);
          eventsContainer.appendChild(card);
        });

        // Small add button at the bottom of the column if there are already trainings
        const quickAddBtn = document.createElement('button');
        quickAddBtn.className = 'btn btn-secondary btn-sm';
        quickAddBtn.style.cssText = 'width: 100%; font-size: 11px; padding: 4px; border-style: dashed; opacity: 0.6;';
        quickAddBtn.textContent = '+ Ajouter';
        quickAddBtn.addEventListener('click', () => openNewTrainingModal(dateKey));
        eventsContainer.appendChild(quickAddBtn);
      }

      col.appendChild(eventsContainer);
      weekGrid.appendChild(col);
    });
  }

  // Create training card element
  function createTrainingCard(training) {
    const card = document.createElement('div');
    const catClass = training.category ? training.category.replace(/\s+/g, '') : 'Technique';
    card.className = `training-card cat-border-${catClass}`;

    let statusBadgeClass = 'status-tag-prevu';
    let statusText = 'Prévu';
    if (training.status === 'terminé') {
      statusBadgeClass = 'status-tag-termine';
      statusText = 'Terminé';
    } else if (training.status === 'non réalisé') {
      statusBadgeClass = 'status-tag-nonrealise';
      statusText = 'Non réalisé';
    }

    const exCount = Array.isArray(training.exercises) ? training.exercises.length : 0;

    card.innerHTML = `
      <div class="training-card-header">
        <span class="badge-category cat-${catClass.toLowerCase()}">${training.category}</span>
        <span class="training-time">${training.time || ''}</span>
      </div>
      <div class="training-card-title">${escapeHtml(training.title)}</div>
      <div class="training-card-footer">
        <span class="badge-status ${statusBadgeClass}">${statusText}</span>
        <span>${training.duration} min ${exCount > 0 ? `• ${exCount} ex` : ''}</span>
      </div>
    `;

    card.addEventListener('click', () => openSlideOverPanel(training.id));
    return card;
  }

  // Slide-Over Panel Logic
  function initSlideOverPanel() {
    const panel = document.getElementById('panel-training');
    const backdrop = document.getElementById('panel-training-backdrop');
    const btnClose = document.getElementById('btn-close-training-panel');
    const btnCancel = document.getElementById('btn-cancel-training-panel');
    const btnSave = document.getElementById('btn-save-training-panel');
    const btnDelete = document.getElementById('btn-delete-training');

    const intensitySlider = document.getElementById('edit-intensity');
    const intensityLabel = document.getElementById('intensity-val-label');

    if (intensitySlider && intensityLabel) {
      intensitySlider.addEventListener('input', (e) => {
        intensityLabel.textContent = `${e.target.value}/10`;
      });
    }

    const closePanel = () => {
      panel.classList.remove('open');
      backdrop.classList.remove('open');
      currentEditingTraining = null;
    };

    if (btnClose) btnClose.addEventListener('click', closePanel);
    if (btnCancel) btnCancel.addEventListener('click', closePanel);
    if (backdrop) backdrop.addEventListener('click', closePanel);

    // Quick status toggle buttons
    const btnStatusPrevu = document.getElementById('btn-set-status-prevu');
    const btnStatusTermine = document.getElementById('btn-set-status-termine');
    const btnStatusNonRealise = document.getElementById('btn-set-status-nonrealise');

    const updateStatusBtns = (activeStatus) => {
      if (!currentEditingTraining) return;
      currentEditingTraining.status = activeStatus;
      btnStatusPrevu.className = activeStatus === 'prévu' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
      btnStatusTermine.className = activeStatus === 'terminé' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
      btnStatusNonRealise.className = activeStatus === 'non réalisé' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';

      const badge = document.getElementById('panel-status-badge');
      if (badge) {
        badge.className = `badge-status status-tag-${activeStatus === 'terminé' ? 'termine' : (activeStatus === 'prévu' ? 'prevu' : 'nonrealise')}`;
        badge.textContent = activeStatus;
      }
    };

    if (btnStatusPrevu) btnStatusPrevu.addEventListener('click', () => updateStatusBtns('prévu'));
    if (btnStatusTermine) btnStatusTermine.addEventListener('click', () => updateStatusBtns('terminé'));
    if (btnStatusNonRealise) btnStatusNonRealise.addEventListener('click', () => updateStatusBtns('non réalisé'));

    // Add exercise inside panel
    const btnAddEx = document.getElementById('btn-add-exercise-to-panel');
    const inputExName = document.getElementById('new-ex-name');
    const inputExSets = document.getElementById('new-ex-sets');

    if (btnAddEx && inputExName && inputExSets) {
      btnAddEx.addEventListener('click', () => {
        const name = inputExName.value.trim();
        const sets = inputExSets.value.trim();
        if (!name) return;

        if (!currentEditingTraining.exercises) currentEditingTraining.exercises = [];
        currentEditingTraining.exercises.push({
          id: 'ex-' + Date.now(),
          name: name,
          sets: sets || '1 série',
          completed: false
        });

        inputExName.value = '';
        inputExSets.value = '';
        renderExercisesList(currentEditingTraining.exercises);
      });
    }

    // Save changes
    if (btnSave) {
      btnSave.addEventListener('click', async () => {
        if (!currentEditingTraining) return;

        const updatedData = {
          title: document.getElementById('edit-title').value.trim() || 'Entraînement',
          category: document.getElementById('edit-category').value,
          duration: Number(document.getElementById('edit-duration').value) || 60,
          date: document.getElementById('edit-date').value,
          time: document.getElementById('edit-time').value || '18:00',
          status: currentEditingTraining.status || 'prévu',
          intensity: Number(document.getElementById('edit-intensity').value) || 7,
          exercises: currentEditingTraining.exercises || [],
          notes: document.getElementById('edit-notes').value.trim(),
          bilan: document.getElementById('edit-bilan').value.trim()
        };

        try {
          const updated = await api.updateTraining(currentEditingTraining.id, updatedData);
          const idx = state.trainings.findIndex(t => t.id === currentEditingTraining.id);
          if (idx !== -1) state.trainings[idx] = updated;

          showToast('Séance mise à jour avec succès');
          closePanel();
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Delete workout
    if (btnDelete) {
      btnDelete.addEventListener('click', async () => {
        if (!currentEditingTraining) return;
        if (!confirm(`Supprimer définitivement l'entraînement "${currentEditingTraining.title}" ?`)) return;

        try {
          await api.deleteTraining(currentEditingTraining.id);
          state.trainings = state.trainings.filter(t => t.id !== currentEditingTraining.id);
          showToast('Séance supprimée');
          closePanel();
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }
  }

  // Open slide-over panel with training data
  function openSlideOverPanel(trainingId) {
    const training = state.trainings.find(t => t.id === trainingId);
    if (!training) return;

    currentEditingTraining = JSON.parse(JSON.stringify(training)); // deep clone

    document.getElementById('edit-training-id').value = training.id;
    document.getElementById('edit-title').value = training.title;
    document.getElementById('edit-category').value = training.category;
    document.getElementById('edit-duration').value = training.duration || 60;
    document.getElementById('edit-date').value = training.date;
    document.getElementById('edit-time').value = training.time || '18:00';
    document.getElementById('edit-intensity').value = training.intensity || 7;
    document.getElementById('intensity-val-label').textContent = `${training.intensity || 7}/10`;
    document.getElementById('edit-notes').value = training.notes || '';
    document.getElementById('edit-bilan').value = training.bilan || '';

    // Quick status buttons state
    const currentStatus = training.status || 'prévu';
    document.getElementById('btn-set-status-prevu').className = currentStatus === 'prévu' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
    document.getElementById('btn-set-status-termine').className = currentStatus === 'terminé' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
    document.getElementById('btn-set-status-nonrealise').className = currentStatus === 'non réalisé' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';

    const badge = document.getElementById('panel-status-badge');
    badge.className = `badge-status status-tag-${currentStatus === 'terminé' ? 'termine' : (currentStatus === 'prévu' ? 'prevu' : 'nonrealise')}`;
    badge.textContent = currentStatus;

    renderExercisesList(currentEditingTraining.exercises || []);

    document.getElementById('panel-training').classList.add('open');
    document.getElementById('panel-training-backdrop').classList.add('open');
  }

  // Render exercises checklist inside slide-over
  function renderExercisesList(exercises) {
    const container = document.getElementById('panel-exercises-list');
    const counter = document.getElementById('exercises-counter');
    if (!container) return;

    container.innerHTML = '';
    if (counter) counter.textContent = `${exercises.length} exercice${exercises.length > 1 ? 's' : ''}`;

    if (exercises.length === 0) {
      container.innerHTML = `<div style="font-size: 11.5px; color: var(--text-muted); padding: 8px 0;">Aucun exercice ajouté. Utilisez le formulaire ci-dessous pour en ajouter.</div>`;
      return;
    }

    exercises.forEach((ex, idx) => {
      const item = document.createElement('div');
      item.className = `exercise-item ${ex.completed ? 'done' : ''}`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!ex.completed;
      checkbox.style.accentColor = 'var(--accent-primary)';
      checkbox.addEventListener('change', () => {
        ex.completed = checkbox.checked;
        item.classList.toggle('done', ex.completed);
      });

      const content = document.createElement('div');
      content.className = 'exercise-item-content';
      content.innerHTML = `
        <strong>${escapeHtml(ex.name)}</strong>
        <span style="color: var(--text-muted); font-size: 11px;">(${escapeHtml(ex.sets)})</span>
      `;

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-secondary btn-sm btn-icon';
      delBtn.style.cssText = 'width: 24px; height: 24px; border: none; font-size: 11px;';
      delBtn.textContent = '✕';
      delBtn.title = 'Supprimer l\'exercice';
      delBtn.addEventListener('click', () => {
        exercises.splice(idx, 1);
        renderExercisesList(exercises);
      });

      item.appendChild(checkbox);
      item.appendChild(content);
      item.appendChild(delBtn);
      container.appendChild(item);
    });
  }

  // New Training Modal
  function initNewTrainingModal() {
    const modal = document.getElementById('modal-new-training');
    const btnClose = document.getElementById('btn-close-new-training-modal');
    const btnCancel = document.getElementById('btn-cancel-new-training');
    const btnSubmit = document.getElementById('btn-submit-new-training');

    const closeModal = () => modal.classList.remove('open');
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    if (btnSubmit) {
      btnSubmit.addEventListener('click', async () => {
        const title = document.getElementById('new-training-title').value.trim();
        const date = document.getElementById('new-training-date').value;
        const category = document.getElementById('new-training-category').value;
        const duration = Number(document.getElementById('new-training-duration').value) || 60;
        const time = document.getElementById('new-training-time').value || '18:30';
        const status = document.getElementById('new-training-status').value || 'prévu';
        const notes = document.getElementById('new-training-notes').value.trim();

        if (!title || !date) {
          showToast('Veuillez renseigner un titre et une date', 'error');
          return;
        }

        try {
          const created = await api.createTraining({
            title,
            date,
            time,
            category,
            duration,
            status,
            notes,
            exercises: [],
            bilan: ''
          });

          state.trainings.push(created);
          showToast('Séance planifiée avec succès !');
          closeModal();
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }
  }

  function openNewTrainingModal(defaultDate) {
    const modal = document.getElementById('modal-new-training');
    document.getElementById('new-training-title').value = '';
    document.getElementById('new-training-date').value = defaultDate || formatDateKey(new Date());
    document.getElementById('new-training-duration').value = 60;
    document.getElementById('new-training-time').value = '18:30';
    document.getElementById('new-training-status').value = 'prévu';
    document.getElementById('new-training-notes').value = '';
    modal.classList.add('open');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Self initialize handlers on load
  initHandlers();

  return {
    render,
    openNewTrainingModal,
    openSlideOverPanel
  };
})();
