/**
 * Frontend Application Logic (100% Vanilla JavaScript)
 * Supports both standalone Mobile PWA & PC Local Server + Global Hotkey sync
 */
(function () {
  const STORAGE_KEYS = {
    API_KEY: 'b2e_gemini_api_key',
    BUSINESS_CONTEXT: 'b2e_business_context',
    TONE: 'b2e_selected_tone',
    AUTO_COPY: 'b2e_auto_copy',
    HISTORY: 'b2e_recent_history'
  };

  let state = {
    mode: 'convert', // 'convert' | 'reply'
    tone: localStorage.getItem(STORAGE_KEYS.TONE) || 'polite',
    apiKey: localStorage.getItem(STORAGE_KEYS.API_KEY) || '',
    businessContext: localStorage.getItem(STORAGE_KEYS.BUSINESS_CONTEXT) || '',
    autoCopy: localStorage.getItem(STORAGE_KEYS.AUTO_COPY) !== 'false',
    history: loadHistory(),
    serverAvailable: false
  };

  // DOM Elements
  const els = {
    hotkeyBadge: document.getElementById('hotkeyBadge'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    apiKeyBanner: document.getElementById('apiKeyBanner'),
    bannerSetupBtn: document.getElementById('bannerSetupBtn'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    toggleKeyVisibilityBtn: document.getElementById('toggleKeyVisibilityBtn'),
    businessContextInput: document.getElementById('businessContextInput'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    lanUrlBox: document.getElementById('lanUrlBox'),
    lanUrlList: document.getElementById('lanUrlList'),

    tabConvert: document.getElementById('tabConvert'),
    tabReply: document.getElementById('tabReply'),
    modeConvertPanel: document.getElementById('modeConvertPanel'),
    modeReplyPanel: document.getElementById('modeReplyPanel'),
    tonePills: document.getElementById('tonePills'),

    oneTapPasteConvertBtn: document.getElementById('oneTapPasteConvertBtn'),
    banglishInput: document.getElementById('banglishInput'),
    pasteInputBtn: document.getElementById('pasteInputBtn'),
    clearInputBtn: document.getElementById('clearInputBtn'),
    autoCopyCheckbox: document.getElementById('autoCopyCheckbox'),
    convertActionBtn: document.getElementById('convertActionBtn'),

    customerMsgInput: document.getElementById('customerMsgInput'),
    replyHintInput: document.getElementById('replyHintInput'),
    pasteCustomerBtn: document.getElementById('pasteCustomerBtn'),
    clearCustomerBtn: document.getElementById('clearCustomerBtn'),
    clearHintBtn: document.getElementById('clearHintBtn'),
    pasteAndReplyBtn: document.getElementById('pasteAndReplyBtn'),
    generateReplyBtn: document.getElementById('generateReplyBtn'),

    statusIndicator: document.getElementById('statusIndicator'),
    customerSummaryBox: document.getElementById('customerSummaryBox'),
    customerSummaryText: document.getElementById('customerSummaryText'),
    outputPrimary: document.getElementById('outputPrimary'),
    outputShort: document.getElementById('outputShort'),
    outputPolite: document.getElementById('outputPolite'),
    primaryBanglaBox: document.getElementById('primaryBanglaBox'),
    outputPrimaryBangla: document.getElementById('outputPrimaryBangla'),
    suggestedRepliesWrap: document.getElementById('suggestedRepliesWrap'),
    suggestedRepliesList: document.getElementById('suggestedRepliesList'),
    variationsGrid: document.getElementById('variationsGrid'),

    historyList: document.getElementById('historyList'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    toast: document.getElementById('toast')
  };

  // Initialize App
  async function init() {
    els.autoCopyCheckbox.checked = state.autoCopy;
    setActiveTone(state.tone);
    renderHistory();

    // Sync with PC Local Server if available
    await syncWithLocalServer();
    updateApiKeyBanner();
    handleUrlParameters();
    bindEvents();

    // Register Service Worker for Mobile PWA installability
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }

  async function syncWithLocalServer() {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) return;
      const data = await res.json();
      state.serverAvailable = true;

      if (data.hotkeyActive) {
        els.hotkeyBadge.classList.remove('hidden');
      } else {
        setTimeout(async () => {
          try {
            const retry = await fetch('/api/config');
            if (retry.ok) {
              const retryData = await retry.json();
              if (retryData.hotkeyActive) {
                els.hotkeyBadge.classList.remove('hidden');
              }
            }
          } catch (_) {}
        }, 3500);
      }

      // Prefer server config if localStorage is empty, or push localStorage to server
      if (data.apiKey && !state.apiKey) {
        state.apiKey = data.apiKey;
        localStorage.setItem(STORAGE_KEYS.API_KEY, state.apiKey);
      } else if (state.apiKey && !data.apiKey) {
        saveConfigToServer();
      }

      if (data.businessContext && !state.businessContext) {
        state.businessContext = data.businessContext;
        localStorage.setItem(STORAGE_KEYS.BUSINESS_CONTEXT, state.businessContext);
      }

      if (Array.isArray(data.lanUrls) && data.lanUrls.length > 0) {
        els.lanUrlBox.classList.remove('hidden');
        els.lanUrlList.innerHTML = data.lanUrls
          .map((u) => `<code>${u}</code>`)
          .join('');
      }
    } catch (_) {
      // Running as static PWA without local Node server
      state.serverAvailable = false;
    }
  }

  async function saveConfigToServer() {
    if (!state.serverAvailable) return;
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: state.apiKey,
          businessContext: state.businessContext,
          tone: state.tone
        })
      });
    } catch (_) {}
  }

  function handleUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const customerParam = params.get('customer') || params.get('text');

    if (modeParam === 'reply') {
      switchMode('reply');
      if (customerParam) {
        els.customerMsgInput.value = customerParam;
        setTimeout(() => runCustomerReply(), 150);
      } else {
        // Automatically try reading clipboard into customer message box
        readClipboardText().then((clip) => {
          if (clip && !els.customerMsgInput.value) {
            els.customerMsgInput.value = clip;
            setTimeout(() => runCustomerReply(), 150);
          }
        });
      }
    } else if (customerParam) {
      els.banglishInput.value = customerParam;
      setTimeout(() => runQuickConvert(true), 150);
    }
  }

  function bindEvents() {
    // Mode Tabs
    els.tabConvert.addEventListener('click', () => switchMode('convert'));
    els.tabReply.addEventListener('click', () => switchMode('reply'));

    // Tone Selector
    els.tonePills.addEventListener('click', (e) => {
      const btn = e.target.closest('.tone-pill');
      if (!btn) return;
      setActiveTone(btn.dataset.tone);
      saveConfigToServer();
    });

    // Settings Modal
    els.openSettingsBtn.addEventListener('click', openSettings);
    els.bannerSetupBtn.addEventListener('click', openSettings);
    els.closeSettingsBtn.addEventListener('click', closeSettings);
    els.settingsModal.addEventListener('click', (e) => {
      if (e.target === els.settingsModal) closeSettings();
    });

    els.toggleKeyVisibilityBtn.addEventListener('click', () => {
      const isPwd = els.apiKeyInput.type === 'password';
      els.apiKeyInput.type = isPwd ? 'text' : 'password';
      els.toggleKeyVisibilityBtn.textContent = isPwd ? '🙈 Hide' : '👁️ Show';
    });

    els.saveSettingsBtn.addEventListener('click', async () => {
      state.apiKey = els.apiKeyInput.value.trim();
      state.businessContext = els.businessContextInput.value.trim();
      localStorage.setItem(STORAGE_KEYS.API_KEY, state.apiKey);
      localStorage.setItem(STORAGE_KEYS.BUSINESS_CONTEXT, state.businessContext);
      await saveConfigToServer();
      updateApiKeyBanner();
      closeSettings();
      showToast('✅ Settings সংরক্ষিত হয়েছে!');
    });

    // Auto-copy checkbox
    els.autoCopyCheckbox.addEventListener('change', () => {
      state.autoCopy = els.autoCopyCheckbox.checked;
      localStorage.setItem(STORAGE_KEYS.AUTO_COPY, String(state.autoCopy));
    });

    // Quick Chips
    document.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        els.banglishInput.value = chip.dataset.text;
        els.banglishInput.focus();
        runQuickConvert();
      });
    });

    // Mode 1 Buttons
    els.oneTapPasteConvertBtn.addEventListener('click', async () => {
      const clip = await readClipboardText();
      if (!clip) {
        showToast('ক্লিপবোর্ডে কোনো টেক্সট পাওয়া যায়নি বা পারমিশন দেওয়া হয়নি।', true);
        els.banglishInput.focus();
        return;
      }
      els.banglishInput.value = clip;
      await runQuickConvert(true);
    });

    els.pasteInputBtn.addEventListener('click', async () => {
      const clip = await readClipboardText();
      if (clip) {
        els.banglishInput.value = clip;
        els.banglishInput.focus();
      }
    });

    els.clearInputBtn.addEventListener('click', () => {
      els.banglishInput.value = '';
      els.banglishInput.focus();
    });

    els.convertActionBtn.addEventListener('click', () => runQuickConvert(false));

    // Mode 2 Buttons
    els.pasteCustomerBtn.addEventListener('click', async () => {
      const clip = await readClipboardText();
      if (clip) {
        els.customerMsgInput.value = clip;
        els.replyHintInput.focus();
      }
    });

    els.clearCustomerBtn.addEventListener('click', () => {
      els.customerMsgInput.value = '';
      els.customerMsgInput.focus();
    });

    els.clearHintBtn.addEventListener('click', () => {
      els.replyHintInput.value = '';
      els.replyHintInput.focus();
    });

    els.pasteAndReplyBtn.addEventListener('click', async () => {
      const clip = await readClipboardText();
      if (clip) {
        els.customerMsgInput.value = clip;
      }
      await runCustomerReply();
    });

    els.generateReplyBtn.addEventListener('click', () => runCustomerReply());

    // Keyboard Shortcuts inside the Web App (Ctrl+Enter or Cmd+Enter)
    els.banglishInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runQuickConvert(false);
      }
    });

    els.replyHintInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey || !e.shiftKey) && e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        runCustomerReply();
      }
    });

    // Copy Buttons on Output Cards
    document.querySelectorAll('.copy-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const targetEl = document.getElementById(btn.dataset.target);
        if (!targetEl || targetEl.classList.contains('empty-placeholder')) return;
        const text = targetEl.textContent.trim();
        if (!text || text === '—') return;
        await copyToClipboard(text);
        showToast('📋 কপি হয়েছে! এখন কাস্টমারকে Paste করুন।');
      });
    });

    // Clear History
    els.clearHistoryBtn.addEventListener('click', () => {
      state.history = [];
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      renderHistory();
    });
  }

  function switchMode(mode) {
    state.mode = mode;
    const isConvert = mode === 'convert';
    els.tabConvert.classList.toggle('active', isConvert);
    els.tabReply.classList.toggle('active', !isConvert);
    els.modeConvertPanel.classList.toggle('hidden', !isConvert);
    els.modeReplyPanel.classList.toggle('hidden', isConvert);
    if (isConvert) {
      els.customerSummaryBox.classList.add('hidden');
      els.primaryBanglaBox.classList.add('hidden');
      els.suggestedRepliesWrap.classList.add('hidden');
      els.variationsGrid.classList.remove('hidden');
    } else {
      els.variationsGrid.classList.add('hidden');
    }
  }

  function setActiveTone(tone) {
    state.tone = tone;
    localStorage.setItem(STORAGE_KEYS.TONE, tone);
    document.querySelectorAll('.tone-pill').forEach((pill) => {
      pill.classList.toggle('active', pill.dataset.tone === tone);
    });
  }

  function updateApiKeyBanner() {
    els.apiKeyBanner.classList.toggle('hidden', Boolean(state.apiKey));
  }

  function openSettings() {
    els.apiKeyInput.value = state.apiKey;
    els.businessContextInput.value = state.businessContext;
    els.settingsModal.classList.remove('hidden');
  }

  function closeSettings() {
    els.settingsModal.classList.add('hidden');
  }

  // Run Mode 1: Quick Banglish -> English Conversion
  async function runQuickConvert(forceAutoCopy = false) {
    const text = els.banglishInput.value.trim();
    if (!text) {
      showToast('অনুগ্রহ করে কিছু টেক্সট লিখুন বা পেস্ট করুন।', true);
      return;
    }
    if (!state.apiKey) {
      openSettings();
      showToast('প্রথমে আপনার Gemini API Key সেট করুন।', true);
      return;
    }

    setLoading(true);
    els.customerSummaryBox.classList.add('hidden');

    try {
      const result = await window.GeminiAssistant.convertBanglishToEnglish({
        text,
        tone: state.tone,
        businessContext: state.businessContext,
        apiKey: state.apiKey
      });

      displayResults(result);
      addToHistory(text, result.primary);

      if (state.autoCopy || forceAutoCopy) {
        await copyToClipboard(result.primary);
        showToast('✅ English কনভার্ট ও অটো-কপি হয়েছে! এখন Paste (Ctrl+V) করুন।');
      } else {
        showToast('✅ English কনভার্ট সম্পন্ন!');
      }
    } catch (err) {
      showToast(err.message || 'কনভার্ট করতে সমস্যা হয়েছে।', true);
      setStatus('Error', false);
    } finally {
      setLoading(false);
    }
  }

  // Run Mode 2: Customer Reply Generator
  async function runCustomerReply() {
    const customerMessage = els.customerMsgInput.value.trim();
    const hint = els.replyHintInput.value.trim();

    if (!customerMessage && !hint) {
      showToast('কাস্টমারের মেসেজ অথবা আপনার উত্তরের হিন্ট দিন।', true);
      return;
    }
    if (!state.apiKey) {
      openSettings();
      showToast('প্রথমে আপনার Gemini API Key সেট করুন।', true);
      return;
    }

    setLoading(true);

    try {
      const result = await window.GeminiAssistant.generateCustomerReply({
        customerMessage,
        hint,
        tone: state.tone,
        businessContext: state.businessContext,
        apiKey: state.apiKey
      });

      if (result.customerSummaryBangla) {
        els.customerSummaryText.textContent = result.customerSummaryBangla;
        els.customerSummaryBox.classList.remove('hidden');
      }

      if (result.primaryBangla) {
        els.outputPrimaryBangla.textContent = result.primaryBangla;
        els.primaryBanglaBox.classList.remove('hidden');
      } else {
        els.primaryBanglaBox.classList.add('hidden');
      }

      renderSuggestedReplies(result.suggestedReplies);
      displayResults(result);
      addToHistory(hint || customerMessage, result.primary);

      if (state.autoCopy) {
        await copyToClipboard(result.primary);
        showToast('✅ কাস্টমার রিপ্লাই তৈরি ও অটো-কপি হয়েছে!');
      }
    } catch (err) {
      showToast(err.message || 'রিপ্লাই তৈরি করতে সমস্যা হয়েছে।', true);
      setStatus('Error', false);
    } finally {
      setLoading(false);
    }
  }

  function renderSuggestedReplies(replies) {
    if (!Array.isArray(replies) || replies.length === 0) {
      els.suggestedRepliesWrap.classList.add('hidden');
      return;
    }

    els.suggestedRepliesWrap.classList.remove('hidden');
    els.suggestedRepliesList.innerHTML = replies
      .map(
        (r, idx) => `
      <div class="suggested-card">
        <div class="suggested-card-top">
          <span class="suggested-badge">📌 ${escapeHtml(r.title || `Option ${idx + 1}`)}</span>
          <button class="copy-btn copy-suggested-btn" data-en="${encodeURIComponent(r.english || '')}">📋 Copy</button>
        </div>
        <div class="suggested-bangla">বাংলা অর্থ: ${escapeHtml(r.bangla || '')}</div>
        <div class="suggested-english">${escapeHtml(r.english || '')}</div>
      </div>
    `
      )
      .join('');

    els.suggestedRepliesList.querySelectorAll('.copy-suggested-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const text = decodeURIComponent(btn.dataset.en);
        if (text) {
          await copyToClipboard(text);
          showToast('📋 এই English রিপ্লাই কপি হয়েছে! এখন চ্যাটে পেস্ট করুন।');
        }
      });
    });
  }

  function displayResults(result) {
    els.outputPrimary.classList.remove('empty-placeholder');
    els.outputPrimary.textContent = result.primary || '';
    els.outputShort.textContent = result.short || result.primary || '—';
    els.outputPolite.textContent = result.polite || result.primary || '—';
    setStatus('Auto-Copied ✓', true);
  }

  function setLoading(isLoading) {
    els.convertActionBtn.disabled = isLoading;
    els.generateReplyBtn.disabled = isLoading;
    els.oneTapPasteConvertBtn.disabled = isLoading;

    if (isLoading) {
      els.statusIndicator.textContent = 'Converting...';
      els.statusIndicator.className = 'status-pill loading';
    }
  }

  function setStatus(label, isSuccess) {
    els.statusIndicator.textContent = label;
    els.statusIndicator.className = `status-pill ${isSuccess ? 'success' : ''}`;
  }

  // Clipboard Helpers (Works on HTTPS, localhost, AND HTTP LAN via fallback)
  async function readClipboardText() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) return text.trim();
      }
    } catch (_) {}

    // Fallback to PC server clipboard if running on local network
    if (state.serverAvailable) {
      try {
        const res = await fetch('/api/clipboard');
        if (res.ok) {
          const data = await res.json();
          if (data.text) return data.text.trim();
        }
      } catch (_) {}
    }
    return '';
  }

  async function copyToClipboard(text) {
    if (!text) return false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}

    // Fallback textarea copy for non-HTTPS LAN mobile browsers
    try {
      const temp = document.createElement('textarea');
      temp.value = text;
      temp.style.position = 'fixed';
      temp.style.opacity = '0';
      document.body.appendChild(temp);
      temp.focus();
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
      return true;
    } catch (_) {
      return false;
    }
  }

  // History Management
  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
    } catch (_) {
      return [];
    }
  }

  function addToHistory(sourceText, englishText) {
    if (!englishText) return;
    state.history.unshift({
      src: sourceText.slice(0, 90),
      en: englishText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    state.history = state.history.slice(0, 10);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(state.history));
    renderHistory();
  }

  function renderHistory() {
    if (!state.history.length) {
      els.historyList.innerHTML =
        '<p class="empty-history">এখনো কোনো মেসেজ কনভার্ট করা হয়নি।</p>';
      return;
    }

    els.historyList.innerHTML = state.history
      .map(
        (item, idx) => `
      <div class="history-item">
        <div class="history-item-content">
          <div class="history-src">${escapeHtml(item.src)}</div>
          <div class="history-en">${escapeHtml(item.en)}</div>
        </div>
        <button class="copy-btn history-copy-btn" data-idx="${idx}">📋 Copy</button>
      </div>
    `
      )
      .join('');

    els.historyList.querySelectorAll('.history-copy-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const item = state.history[Number(btn.dataset.idx)];
        if (item) {
          await copyToClipboard(item.en);
          showToast('📋 History থেকে কপি হয়েছে!');
        }
      });
    });
  }

  function escapeHtml(str = '') {
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

  let toastTimer = null;
  function showToast(msg, isError = false) {
    els.toast.textContent = msg;
    els.toast.className = `toast ${isError ? 'error' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.add('hidden');
    }, 3200);
  }

  init();
})();
