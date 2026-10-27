/**
 * Football Tracker - Module Coach IA Football
 */

window.coachModule = (() => {
  const chatHistory = [];
  let isSending = false;

  function initHandlers() {
    const input = document.getElementById('coach-chat-input');
    const btnSend = document.getElementById('btn-send-chat');
    const quickPrompts = document.getElementById('quick-prompts');
    const btnConfigBanner = document.getElementById('btn-config-key-banner');
    const btnSidebarAi = document.getElementById('btn-sidebar-ai-settings');

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
      // Auto-grow textarea
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });
    }

    if (btnSend) {
      btnSend.addEventListener('click', sendMessage);
    }

    if (quickPrompts) {
      quickPrompts.addEventListener('click', (e) => {
        const chip = e.target.closest('.prompt-chip');
        if (!chip) return;
        const promptText = chip.dataset.prompt;
        if (promptText) {
          input.value = promptText;
          sendMessage();
        }
      });
    }

    if (btnConfigBanner) {
      btnConfigBanner.addEventListener('click', () => openAISettingsModal());
    }

    if (btnSidebarAi) {
      btnSidebarAi.addEventListener('click', () => openAISettingsModal());
    }

    initAISettingsModal();
  }

  function onEnterPage() {
    updateApiKeyBanner();
    if (chatHistory.length === 0) {
      showWelcomeMessage();
    }
    scrollToBottom();
  }

  function updateApiKeyBanner() {
    const banner = document.getElementById('coach-api-warning');
    const isConfigured = Boolean(state.settings.hasGeminiKey || state.settings.geminiApiKey);
    if (banner) {
      banner.style.display = isConfigured ? 'none' : 'flex';
    }
    updateSidebarAIStatus();
  }

  function showWelcomeMessage() {
    const welcomeText = `Bonjour ! Je suis ton **Coach IA Football**.

Pose-moi tes questions d'entraînement, par exemple :
- *"Écris-moi un plan pour cette semaine avec 2 séances techniques et 2 séances de vitesse."*
- *"Donne-moi une séance de vitesse pour aujourd'hui."*
- *"Propose-moi 3 exercices de dribble solo."*

Je m'appuie sur un programme de 10 séances de vitesse et 50 exercices solo pour construire mes réponses.`;

    addMessage('coach', welcomeText);
  }

  async function sendMessage() {
    const input = document.getElementById('coach-chat-input');
    const message = input.value.trim();
    if (!message || isSending) return;

    // Check if key is configured
    const isConfigured = Boolean(state.settings.hasGeminiKey || state.settings.geminiApiKey);
    if (!isConfigured) {
      addMessage('user', message);
      input.value = '';
      input.style.height = 'auto';

      const unconfiguredWarning = `⚠️ **Le Coach IA n'est pas encore configuré.**

Pour dialoguer en direct avec l'intelligence artificielle et bénéficier d'analyses et de programmes personnalisés basés sur vos entraînements, une **clé API Google Gemini** est requise.

👉 Cliquez sur le bouton ci-dessous pour configurer votre clé d'API gratuite en 1 minute.`;

      addMessage('coach', unconfiguredWarning, [], true);
      return;
    }

    // Add user message to UI
    addMessage('user', message);
    input.value = '';
    input.style.height = 'auto';
    isSending = true;

    // Show loading indicator
    const loadingElem = showLoadingIndicator();

    try {
      // Send to server proxy with current history
      const historyPayload = chatHistory.map(m => ({ role: m.role, text: m.text }));
      const response = await api.sendChatMessage(message, historyPayload, state.settings.geminiApiKey);

      loadingElem.remove();

      if (response.error) {
        if (response.error === 'API_KEY_REQUIRED') {
          addMessage('coach', `⚠️ ${response.message}`, [], true);
          updateApiKeyBanner();
        } else {
          addMessage('coach', `⚠️ **Erreur lors de la génération** :\n${response.message}`);
        }
      } else {
        // Success
        addMessage('coach', response.reply, response.proposals || []);
      }
    } catch (err) {
      loadingElem.remove();
      addMessage('coach', `⚠️ **Erreur de communication** : ${err.message}`);
    } finally {
      isSending = false;
      scrollToBottom();
    }
  }

  function addMessage(role, text, proposals = [], showConfigButton = false) {
    chatHistory.push({ role, text, proposals });

    const container = document.getElementById('chat-history');
    if (!container) return;

    const msgElem = document.createElement('div');
    msgElem.className = `chat-message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = role === 'coach' ? '⚽' : '👤';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    // Parse Markdown text
    const cleanText = text.replace(/```proposal[\s\S]*?```/g, '').trim();
    bubble.innerHTML = renderMarkdown(cleanText);

    // Show Config Button if required
    if (showConfigButton) {
      const configBtn = document.createElement('button');
      configBtn.className = 'btn btn-primary btn-sm';
      configBtn.style.marginTop = '12px';
      configBtn.textContent = '⚙ Configurer ma clé API Gemini';
      configBtn.addEventListener('click', () => openAISettingsModal());
      bubble.appendChild(configBtn);
    }

    msgElem.appendChild(avatar);
    msgElem.appendChild(bubble);
    container.appendChild(msgElem);

    scrollToBottom();
  }

  // Create an interactive proposal card with CONFIRMATION button
  function createProposalCard(proposal) {
    const box = document.createElement('div');
    box.className = 'proposal-box';

    const isCreate = proposal.action === 'create_training';
    const trainingData = proposal.training || {};
    const catClass = trainingData.category ? trainingData.category.replace(/\s+/g, '') : 'Technique';

    let exercisesHtml = '';
    if (Array.isArray(trainingData.exercises) && trainingData.exercises.length > 0) {
      exercisesHtml = `
        <div class="proposal-exercises">
          <strong style="color: var(--text-secondary); font-size: 11px;">Exercices proposés :</strong>
          <ul style="margin: 4px 0 0 16px; padding: 0;">
            ${trainingData.exercises.map(ex => `<li>${escapeHtml(ex.name)} (${escapeHtml(ex.sets || '')})</li>`).join('')}
          </ul>
        </div>
      `;
    }

    box.innerHTML = `
      <div class="proposal-box-header">
        <span class="badge-category cat-${catClass.toLowerCase()}">${trainingData.category || 'Football'}</span>
        <span style="font-size: 11.5px; color: var(--text-muted);">${trainingData.date || 'Date à venir'} à ${trainingData.time || '18:30'} (${trainingData.duration || 60} min)</span>
      </div>

      <div class="proposal-title">${escapeHtml(trainingData.title || 'Séance suggérée')}</div>
      
      ${trainingData.notes ? `<p style="font-size: 12px; color: var(--text-secondary); margin: 0;">${escapeHtml(trainingData.notes)}</p>` : ''}
      ${exercisesHtml}

      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px;">
        <span style="font-size: 11px; color: var(--text-muted);">Confirmation requise pour validation</span>
        <button class="btn btn-primary btn-sm btn-confirm-proposal">
          ✓ Confirmer et ajouter au calendrier
        </button>
      </div>
    `;

    const confirmBtn = box.querySelector('.btn-confirm-proposal');
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Ajout en cours...';

      try {
        if (isCreate) {
          const newWorkout = await api.createTraining({
            title: trainingData.title || 'Entraînement suggéré',
            category: trainingData.category || 'Technique',
            date: trainingData.date || new Date().toISOString().slice(0, 10),
            time: trainingData.time || '18:30',
            duration: Number(trainingData.duration) || 60,
            status: trainingData.status || 'prévu',
            exercises: trainingData.exercises || [],
            notes: trainingData.notes || 'Ajouté par le Coach IA',
            bilan: ''
          });

          state.trainings.push(newWorkout);
          confirmBtn.textContent = '✓ Ajouté au calendrier !';
          confirmBtn.className = 'btn btn-secondary btn-sm';
          confirmBtn.style.color = '#10b981';
          showToast(`Séance "${newWorkout.title}" ajoutée au calendrier !`, 'success');

          // Refresh calendar view in background
          if (window.calendarModule) window.calendarModule.render();
        } else if (proposal.action === 'update_training' && proposal.id) {
          const updated = await api.updateTraining(proposal.id, trainingData);
          const idx = state.trainings.findIndex(t => t.id === proposal.id);
          if (idx !== -1) state.trainings[idx] = updated;

          confirmBtn.textContent = '✓ Modification appliquée !';
          confirmBtn.className = 'btn btn-secondary btn-sm';
          showToast(`Séance modifiée avec succès !`, 'success');
          if (window.calendarModule) window.calendarModule.render();
        }
      } catch (err) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Réessayer';
        showToast(err.message, 'error');
      }
    });

    return box;
  }

  function showLoadingIndicator() {
    const container = document.getElementById('chat-history');
    const msgElem = document.createElement('div');
    msgElem.className = 'chat-message coach';
    msgElem.innerHTML = `
      <div class="chat-avatar">⚽</div>
      <div class="chat-bubble" style="color: var(--text-muted); font-size: 13px; font-style: italic;">
        Le Coach prépare ta séance...
      </div>
    `;
    container.appendChild(msgElem);
    scrollToBottom();
    return msgElem;
  }

  function scrollToBottom() {
    const container = document.getElementById('chat-history');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // Basic Markdown Renderer for Chat Bubble
  function renderMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);

    // Bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic *text*
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Headers ###
    html = html.replace(/^### (.*$)/gim, '<h4 style="margin: 8px 0 4px; font-size: 13.5px; color: #fff;">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 style="margin: 10px 0 6px; font-size: 14.5px; color: #fff;">$1</h3>');

    // Bullet points
    html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');

    // Numbered lists
    html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');

    // Line breaks
    html = html.replace(/\n\n/g, '<p></p>');
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- AI SETTINGS MODAL ---
  function initAISettingsModal() {
    const modal = document.getElementById('modal-ai-settings');
    const btnClose = document.getElementById('btn-close-ai-settings');
    const btnCancel = document.getElementById('btn-cancel-ai-settings');
    const btnSave = document.getElementById('btn-save-ai-settings');
    const btnTest = document.getElementById('btn-test-ai-key');
    const btnToggleVis = document.getElementById('btn-toggle-key-visibility');
    const inputKey = document.getElementById('input-gemini-key');

    const closeModal = () => modal.classList.remove('open');
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    // Password show / hide
    if (btnToggleVis && inputKey) {
      btnToggleVis.addEventListener('click', () => {
        if (inputKey.type === 'password') {
          inputKey.type = 'text';
          btnToggleVis.textContent = 'Masquer';
        } else {
          inputKey.type = 'password';
          btnToggleVis.textContent = 'Afficher';
        }
      });
    }

    // Test API key
    if (btnTest) {
      btnTest.addEventListener('click', async () => {
        const key = inputKey.value.trim();
        const statusDiv = document.getElementById('ai-test-status');
        statusDiv.style.display = 'block';

        if (!key) {
          statusDiv.innerHTML = '<span style="color: #ef4444;">Veuillez renseigner une clé avant de tester.</span>';
          return;
        }

        statusDiv.innerHTML = '<span style="color: var(--text-muted);">Test de connexion en cours...</span>';
        btnTest.disabled = true;

        try {
          const model = document.getElementById('select-gemini-model').value || 'gemini-3.8-flash';
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: 'Reponds uniquement par le mot OK' }] }]
            })
          });

          if (res.ok) {
            statusDiv.innerHTML = '<span style="color: #10b981; font-weight: 600;">✓ Connexion réussie ! Votre clé Gemini est valide.</span>';
          } else {
            const errData = await res.json().catch(() => ({}));
            const msg = errData.error?.message || `Code erreur HTTP ${res.status}`;
            statusDiv.innerHTML = `<span style="color: #ef4444;">Erreur Gemini : ${msg}</span>`;
          }
        } catch (err) {
          statusDiv.innerHTML = `<span style="color: #ef4444;">Impossible de joindre l'API : ${err.message}</span>`;
        } finally {
          btnTest.disabled = false;
        }
      });
    }

    // Save Settings
    if (btnSave) {
      btnSave.addEventListener('click', async () => {
        const key = inputKey.value.trim();
        const model = document.getElementById('select-gemini-model').value;

        try {
          await api.saveSettings({ geminiApiKey: key, model: model });
          state.settings.geminiApiKey = key;
          state.settings.hasGeminiKey = Boolean(key);
          state.settings.model = model;

          updateApiKeyBanner();
          closeModal();
          showToast('Paramètres du Coach IA enregistrés !', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }
  }

  function openAISettingsModal() {
    const modal = document.getElementById('modal-ai-settings');
    const inputKey = document.getElementById('input-gemini-key');
    const selectModel = document.getElementById('select-gemini-model');
    const statusDiv = document.getElementById('ai-test-status');

    statusDiv.style.display = 'none';
    inputKey.value = state.settings.geminiApiKey || '';
    if (state.settings.model) selectModel.value = state.settings.model;

    modal.classList.add('open');
  }

  initHandlers();

  return {
    onEnterPage,
    openAISettingsModal
  };
})();
