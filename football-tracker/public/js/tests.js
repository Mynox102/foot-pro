/**
 * Football Tracker - Module Tests Physiques & Évaluations
 */

window.testsModule = (() => {
  let activeHistoryTest = null;

  function initHandlers() {
    const btnCreateTest = document.getElementById('btn-create-test');
    if (btnCreateTest) {
      btnCreateTest.addEventListener('click', () => openTestFormModal());
    }

    initTestFormModal();
    initAddMeasureModal();
    initHistoryModal();
  }

  // Render test cards grid
  function render() {
    const grid = document.getElementById('tests-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (state.tests.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
          <div style="font-size: 32px; margin-bottom: 12px;">⚡</div>
          <h3 style="font-size: 16px; margin-bottom: 6px;">Aucun test physique configuré</h3>
          <p style="font-size: 13px; color: var(--text-secondary); max-width: 440px; margin: 0 auto 16px;">Créez votre premier test (ex: Sprint 30m, VMA, Tirs cadrés, Jongles...) pour mesurer vos progrès objectifs.</p>
          <button class="btn btn-primary" onclick="window.testsModule.openTestFormModal()">Créer un test</button>
        </div>
      `;
      return;
    }

    state.tests.forEach(test => {
      const card = createTestCard(test);
      grid.appendChild(card);
    });
  }

  // Create single test card
  function createTestCard(test) {
    const card = document.createElement('div');
    card.className = 'test-card';

    const measures = test.measures || [];
    const count = measures.length;
    const latest = count > 0 ? measures[count - 1] : null;
    const first = count > 0 ? measures[0] : null;

    // Calculate Best Record
    let recordStr = 'Aucun';
    let latestStr = 'Aucune mesure';
    let trendStr = 'Données insuffisantes';
    let isPositiveTrend = true;

    if (count > 0) {
      if (test.type === 'temps') {
        const best = Math.min(...measures.map(m => Number(m.value)));
        recordStr = `${best} ${test.unit}`;
        latestStr = `${latest.value} ${test.unit}`;

        if (count > 1) {
          const diff = Number(latest.value) - Number(first.value);
          const pct = Math.abs(Math.round((diff / Number(first.value)) * 100));
          if (diff < 0) {
            trendStr = `Gain de ${Math.abs(diff).toFixed(2)}s (-${pct}%)`;
            isPositiveTrend = true;
          } else if (diff > 0) {
            trendStr = `+${diff.toFixed(2)}s (+${pct}%)`;
            isPositiveTrend = false;
          } else {
            trendStr = `Stable (=)`;
          }
        }
      } else if (test.type === 'reussites') {
        const best = measures.reduce((max, m) => {
          const ratio = Number(m.value) / (Number(m.attempts) || 10);
          const maxRatio = Number(max.value) / (Number(max.attempts) || 10);
          return ratio > maxRatio ? m : max;
        }, measures[0]);
        const bestPct = Math.round((Number(best.value) / (Number(best.attempts) || 10)) * 100);
        recordStr = `${best.value}/${best.attempts || 10} (${bestPct}%)`;

        const latestPct = Math.round((Number(latest.value) / (Number(latest.attempts) || 10)) * 100);
        latestStr = `${latest.value}/${latest.attempts || 10} (${latestPct}%)`;

        if (count > 1) {
          const firstPct = Math.round((Number(first.value) / (Number(first.attempts) || 10)) * 100);
          const diffPct = latestPct - firstPct;
          trendStr = `${diffPct >= 0 ? '+' : ''}${diffPct}% de réussite`;
          isPositiveTrend = diffPct >= 0;
        }
      } else { // 'nombre'
        const best = Math.max(...measures.map(m => Number(m.value)));
        recordStr = `${best} ${test.unit}`;
        latestStr = `${latest.value} ${test.unit}`;

        if (count > 1) {
          const diff = Number(latest.value) - Number(first.value);
          const pct = Math.abs(Math.round((diff / Number(first.value)) * 100));
          trendStr = `${diff >= 0 ? '+' : ''}${diff} ${test.unit} (${diff >= 0 ? '+' : '-'}${pct}%)`;
          isPositiveTrend = diff >= 0;
        }
      }
    }

    let typeBadgeLabel = 'Chrono';
    if (test.type === 'nombre') typeBadgeLabel = 'Quantité / Valeur';
    if (test.type === 'reussites') typeBadgeLabel = 'Réussites / Essais';

    card.innerHTML = `
      <div>
        <div class="test-card-top">
          <div>
            <span class="badge-category cat-vitesse" style="font-size: 10px; margin-bottom: 6px;">${typeBadgeLabel}</span>
            <div class="test-name">${escapeHtml(test.name)}</div>
          </div>
          <span style="font-size: 11px; color: var(--text-muted); background: #1a202c; padding: 3px 8px; border-radius: var(--radius-sm);">${escapeHtml(test.unit)}</span>
        </div>
        <p class="test-protocol">${escapeHtml(test.protocol || 'Aucune consigne spécifique.')}</p>
      </div>

      <div class="test-metrics-row">
        <div class="test-metric-box">
          <span class="test-metric-label">Record personnel</span>
          <span class="test-metric-value test-metric-record">${recordStr}</span>
        </div>
        <div class="test-metric-box">
          <span class="test-metric-label">Dernière mesure</span>
          <span class="test-metric-value">${latestStr}</span>
        </div>
      </div>

      <div style="font-size: 11.5px; display: flex; align-items: center; justify-content: space-between;">
        <span style="color: var(--text-muted);">${count} mesure${count > 1 ? 's' : ''}</span>
        <span style="color: ${isPositiveTrend ? '#34d399' : '#f87171'}; font-weight: 500;">${trendStr}</span>
      </div>

      <div class="test-card-actions">
        <button class="btn btn-primary btn-sm btn-add-measure" style="font-size: 11.5px;">+ Mesure</button>
        <button class="btn btn-secondary btn-sm btn-view-history" style="font-size: 11.5px;">Historique & Courbe</button>
        <div style="display: flex; gap: 4px;">
          <button class="btn btn-secondary btn-sm btn-icon btn-edit-test" title="Modifier le test">✎</button>
          <button class="btn btn-danger btn-sm btn-icon btn-delete-test" title="Supprimer le test">✕</button>
        </div>
      </div>
    `;

    // Action handlers
    card.querySelector('.btn-add-measure').addEventListener('click', () => openAddMeasureModal(test.id));
    card.querySelector('.btn-view-history').addEventListener('click', () => openHistoryModal(test.id));
    card.querySelector('.btn-edit-test').addEventListener('click', () => openTestFormModal(test));
    card.querySelector('.btn-delete-test').addEventListener('click', async () => {
      if (!confirm(`Supprimer le test "${test.name}" et tout son historique ?`)) return;
      try {
        await api.deleteTest(test.id);
        state.tests = state.tests.filter(t => t.id !== test.id);
        showToast('Test supprimé');
        render();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    return card;
  }

  // Test Creation / Edit Modal
  function initTestFormModal() {
    const modal = document.getElementById('modal-test-form');
    const btnClose = document.getElementById('btn-close-test-form-modal');
    const btnCancel = document.getElementById('btn-cancel-test-form');
    const btnSubmit = document.getElementById('btn-submit-test-form');
    const selectType = document.getElementById('test-form-type');
    const inputUnit = document.getElementById('test-form-unit');

    const closeModal = () => modal.classList.remove('open');
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    // Auto suggest unit when selecting type
    if (selectType && inputUnit) {
      selectType.addEventListener('change', () => {
        if (!inputUnit.value) {
          if (selectType.value === 'temps') inputUnit.value = 's';
          else if (selectType.value === 'reussites') inputUnit.value = 'réussites';
          else inputUnit.value = 'reps';
        }
      });
    }

    if (btnSubmit) {
      btnSubmit.addEventListener('click', async () => {
        const id = document.getElementById('test-form-id').value;
        const name = document.getElementById('test-form-name').value.trim();
        const type = document.getElementById('test-form-type').value;
        const unit = document.getElementById('test-form-unit').value.trim();
        const protocol = document.getElementById('test-form-protocol').value.trim();

        if (!name || !unit) {
          showToast('Veuillez renseigner le nom et l\'unité', 'error');
          return;
        }

        try {
          if (id) {
            // Edit existing
            const updated = await api.updateTest(id, { name, unit, protocol });
            const idx = state.tests.findIndex(t => t.id === id);
            if (idx !== -1) {
              state.tests[idx].name = updated.name;
              state.tests[idx].unit = updated.unit;
              state.tests[idx].protocol = updated.protocol;
            }
            showToast('Test mis à jour avec succès');
          } else {
            // Create new
            const created = await api.createTest({ name, type, unit, protocol });
            state.tests.push(created);
            showToast('Nouveau test créé !');
          }
          closeModal();
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }
  }

  function openTestFormModal(testToEdit = null) {
    const modal = document.getElementById('modal-test-form');
    const title = document.getElementById('modal-test-form-title');
    const selectType = document.getElementById('test-form-type');

    if (testToEdit) {
      title.textContent = 'Modifier le test';
      document.getElementById('test-form-id').value = testToEdit.id;
      document.getElementById('test-form-name').value = testToEdit.name;
      selectType.value = testToEdit.type;
      selectType.disabled = true; // don't change type after creation
      document.getElementById('test-form-unit').value = testToEdit.unit;
      document.getElementById('test-form-protocol').value = testToEdit.protocol || '';
    } else {
      title.textContent = 'Créer un test personnalisé';
      document.getElementById('test-form-id').value = '';
      document.getElementById('test-form-name').value = '';
      selectType.value = 'temps';
      selectType.disabled = false;
      document.getElementById('test-form-unit').value = 's';
      document.getElementById('test-form-protocol').value = '';
    }

    modal.classList.add('open');
  }

  // Add Measure Modal
  function initAddMeasureModal() {
    const modal = document.getElementById('modal-add-measure');
    const btnClose = document.getElementById('btn-close-add-measure-modal');
    const btnCancel = document.getElementById('btn-cancel-add-measure');
    const btnSubmit = document.getElementById('btn-submit-add-measure');

    const closeModal = () => modal.classList.remove('open');
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    if (btnSubmit) {
      btnSubmit.addEventListener('click', async () => {
        const testId = document.getElementById('measure-test-id').value;
        const test = state.tests.find(t => t.id === testId);
        if (!test) return;

        const date = document.getElementById('measure-date').value;
        const notes = document.getElementById('measure-notes').value.trim();

        let value;
        let attempts;

        if (test.type === 'reussites') {
          value = Number(document.getElementById('measure-successes').value);
          attempts = Number(document.getElementById('measure-total-attempts').value) || 10;
          if (isNaN(value) || value < 0) {
            showToast('Veuillez saisir un nombre valide de réussites', 'error');
            return;
          }
        } else {
          value = Number(document.getElementById('measure-val').value);
          if (isNaN(value)) {
            showToast('Veuillez saisir une valeur numérique', 'error');
            return;
          }
        }

        try {
          const res = await api.addMeasure(testId, { date, value, attempts, notes });
          test.measures = res.test.measures;
          showToast('Mesure enregistrée !');
          closeModal();
          render();

          // If history modal is currently open for this test, refresh it too
          if (activeHistoryTest && activeHistoryTest.id === testId) {
            openHistoryModal(testId);
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }
  }

  function openAddMeasureModal(testId) {
    const test = state.tests.find(t => t.id === testId);
    if (!test) return;

    const modal = document.getElementById('modal-add-measure');
    const title = document.getElementById('modal-add-measure-title');
    const groupSingle = document.getElementById('group-measure-single-val');
    const groupAttempts = document.getElementById('group-measure-attempts');
    const singleLabel = document.getElementById('measure-single-label');

    document.getElementById('measure-test-id').value = test.id;
    title.textContent = `Ajouter une mesure : ${test.name}`;

    // Format current date YYYY-MM-DD
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('measure-date').value = today;
    document.getElementById('measure-notes').value = '';

    if (test.type === 'reussites') {
      groupSingle.style.display = 'none';
      groupAttempts.style.display = 'grid';
      document.getElementById('measure-successes').value = '';
      document.getElementById('measure-total-attempts').value = '10';
    } else {
      groupSingle.style.display = 'flex';
      groupAttempts.style.display = 'none';
      singleLabel.textContent = `Valeur (${test.unit})`;
      document.getElementById('measure-val').value = '';
    }

    modal.classList.add('open');
  }

  // History & Progression Modal
  function initHistoryModal() {
    const modal = document.getElementById('modal-test-history');
    const btnClose = document.getElementById('btn-close-history-modal');
    const btnCloseFooter = document.getElementById('btn-close-history-modal-footer');

    const closeModal = () => {
      modal.classList.remove('open');
      activeHistoryTest = null;
    };

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCloseFooter) btnCloseFooter.addEventListener('click', closeModal);
  }

  function openHistoryModal(testId) {
    const test = state.tests.find(t => t.id === testId);
    if (!test) return;

    activeHistoryTest = test;
    const modal = document.getElementById('modal-test-history');
    document.getElementById('modal-history-test-name').textContent = test.name;
    document.getElementById('modal-history-test-protocol').textContent = test.protocol || 'Protocole non renseigné';

    renderHistoryProgressionChart(test);
    renderHistoryTable(test);

    modal.classList.add('open');
  }

  // Render individual test progression curve in SVG
  function renderHistoryProgressionChart(test) {
    const container = document.getElementById('test-progress-chart-container');
    if (!container) return;
    container.innerHTML = '';

    const measures = (test.measures || []).slice().sort((a, b) => a.date.localeCompare(b.date));

    if (measures.length < 2) {
      container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 12px;">
          Ajoutez au moins 2 mesures datées pour afficher la courbe d'évolution.
        </div>
      `;
      return;
    }

    const width = container.clientWidth || 600;
    const height = 180;
    const padding = { top: 20, right: 30, bottom: 30, left: 45 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Get normalized numeric value for charting
    const values = measures.map(m => {
      if (test.type === 'reussites') {
        return Math.round((Number(m.value) / (Number(m.attempts) || 10)) * 100);
      }
      return Number(m.value);
    });

    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);

    if (minVal === maxVal) {
      minVal = minVal * 0.9;
      maxVal = maxVal * 1.1;
    } else {
      const margin = (maxVal - minVal) * 0.15;
      minVal -= margin;
      maxVal += margin;
    }

    const getX = (idx) => padding.left + (idx / (measures.length - 1)) * chartW;
    const getY = (val) => padding.top + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;

    let svg = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="overflow: visible;">`;

    // Horizontal grid
    for (let i = 0; i <= 3; i++) {
      const val = minVal + ((maxVal - minVal) / 3) * i;
      const y = getY(val);
      const displayVal = test.type === 'temps' ? val.toFixed(2) : Math.round(val);
      svg += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#1e2433" stroke-width="1" />
        <text x="${padding.left - 8}" y="${y + 4}" fill="#64748b" font-size="10" text-anchor="end">${displayVal}</text>
      `;
    }

    // Path curve
    let pathD = '';
    measures.forEach((m, idx) => {
      const x = getX(idx);
      const y = getY(values[idx]);
      if (idx === 0) pathD += `M ${x} ${y}`;
      else {
        const prevX = getX(idx - 1);
        const prevY = getY(values[idx - 1]);
        const cpX1 = prevX + (x - prevX) / 2;
        pathD += ` C ${cpX1} ${prevY}, ${cpX1} ${y}, ${x} ${y}`;
      }
    });

    // Stroke color: emerald
    svg += `<path d="${pathD}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" />`;

    // Points & Tooltips
    measures.forEach((m, idx) => {
      const x = getX(idx);
      const val = values[idx];
      const y = getY(val);
      const label = test.type === 'reussites' ? `${m.value}/${m.attempts || 10} (${val}%)` : `${m.value} ${test.unit}`;

      svg += `
        <circle cx="${x}" cy="${y}" r="4" fill="#0f121a" stroke="#10b981" stroke-width="2">
          <title>${m.date} : ${label}${m.notes ? ' (' + m.notes + ')' : ''}</title>
        </circle>
        <text x="${x}" y="${height - 8}" fill="#94a3b8" font-size="10" text-anchor="middle">${m.date.slice(5)}</text>
      `;
    });

    svg += `</svg>`;
    container.innerHTML = svg;
  }

  // Render Table of all measures
  function renderHistoryTable(test) {
    const tbody = document.getElementById('test-measures-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const measures = (test.measures || []).slice().reverse(); // newest first

    if (measures.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="padding: 16px; text-align: center; color: var(--text-muted);">Aucune mesure enregistrée.</td></tr>`;
      return;
    }

    measures.forEach(m => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #1a202c';

      let displayScore = `${m.value} ${test.unit}`;
      if (test.type === 'reussites') {
        const pct = Math.round((Number(m.value) / (Number(m.attempts) || 10)) * 100);
        displayScore = `<strong>${m.value}/${m.attempts || 10}</strong> <span style="color: #10b981; font-size: 11px;">(${pct}%)</span>`;
      }

      tr.innerHTML = `
        <td style="padding: 10px 12px; color: var(--text-secondary);">${m.date}</td>
        <td style="padding: 10px 12px; font-weight: 600;">${displayScore}</td>
        <td style="padding: 10px 12px; color: var(--text-secondary); font-size: 11.5px;">${escapeHtml(m.notes || '-')}</td>
        <td style="padding: 10px 12px; text-align: right;">
          <button class="btn btn-secondary btn-sm btn-icon btn-del-measure" style="width: 22px; height: 22px; font-size: 10px;" title="Supprimer cette mesure">✕</button>
        </td>
      `;

      tr.querySelector('.btn-del-measure').addEventListener('click', async () => {
        if (!confirm(`Supprimer la mesure du ${m.date} ?`)) return;
        try {
          await api.deleteMeasure(test.id, m.id);
          test.measures = test.measures.filter(item => item.id !== m.id);
          showToast('Mesure supprimée');
          openHistoryModal(test.id);
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });

      tbody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  initHandlers();

  return {
    render,
    openTestFormModal,
    openAddMeasureModal,
    openHistoryModal
  };
})();
