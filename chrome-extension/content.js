/**
 * Robust Floating Pill for Meta Business Suite & WhatsApp Web
 */
(function () {
  const DEFAULT_GROQ_KEY = '';
  const GROQ_MODEL = 'qwen/qwen3.8-27b';

  let lastSelectedText = '';
  let activeEditableEl = null;

  // Floating Action Pill
  const pill = document.createElement('div');
  pill.id = 'b2e-floating-pill';
  pill.style.cssText = `
    position: fixed !important;
    z-index: 2147483647 !important;
    display: none;
    align-items: center;
    gap: 8px;
    background: #0f172a !important;
    border: 1.5px solid #10b981 !important;
    border-radius: 999px !important;
    padding: 6px 10px !important;
    box-shadow: 0 10px 30px rgba(0,0,0,0.65) !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    user-select: none !important;
    pointer-events: auto !important;
  `;

  const btnConvert = document.createElement('button');
  btnConvert.textContent = '⚡ Banglish → EN';
  btnConvert.style.cssText = `
    background: #10b981 !important;
    color: #042f1e !important;
    border: none !important;
    border-radius: 999px !important;
    padding: 6px 12px !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    cursor: pointer !important;
    display: inline-block !important;
  `;

  const btnReply = document.createElement('button');
  btnReply.textContent = '💬 বাংলা অর্থ + Reply';
  btnReply.style.cssText = `
    background: #3b82f6 !important;
    color: #ffffff !important;
    border: none !important;
    border-radius: 999px !important;
    padding: 6px 12px !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    cursor: pointer !important;
    display: inline-block !important;
  `;

  pill.appendChild(btnConvert);
  pill.appendChild(btnReply);
  document.documentElement.appendChild(pill);

  // Floating Result Card
  const card = document.createElement('div');
  card.id = 'b2e-floating-card';
  card.style.cssText = `
    position: fixed !important;
    z-index: 2147483647 !important;
    display: none;
    width: 350px !important;
    background: #0f172a !important;
    color: #f8fafc !important;
    border: 1.5px solid #334155 !important;
    border-radius: 12px !important;
    padding: 14px !important;
    box-shadow: 0 16px 36px rgba(0,0,0,0.7) !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    font-size: 13px !important;
    line-height: 1.5 !important;
  `;
  document.documentElement.appendChild(card);

  pill.addEventListener('mousedown', (e) => e.stopPropagation());
  card.addEventListener('mousedown', (e) => e.stopPropagation());

  function checkSelection(clientX, clientY) {
    const sel = window.getSelection();
    let text = sel ? sel.toString().trim() : '';

    const active = document.activeElement;
    if (
      !text &&
      active &&
      (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT') &&
      active.selectionStart !== active.selectionEnd
    ) {
      text = active.value.substring(active.selectionStart, active.selectionEnd).trim();
    }

    if (text && text.length > 1) {
      lastSelectedText = text;
      activeEditableEl = active;

      let x = (clientX || window.innerWidth / 2) - 100;
      let y = (clientY || window.innerHeight / 2) - 55;

      if (sel && sel.rangeCount > 0) {
        try {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            x = rect.left + rect.width / 2 - 110;
            y = rect.top - 48;
          }
        } catch (_) {}
      }

      x = Math.max(15, Math.min(window.innerWidth - 250, x));
      y = Math.max(15, y);

      pill.style.left = `${x}px`;
      pill.style.top = `${y}px`;
      pill.style.display = 'flex';
    } else {
      pill.style.display = 'none';
    }
  }

  document.addEventListener('mouseup', (e) => {
    if (pill.contains(e.target) || card.contains(e.target)) return;
    setTimeout(() => checkSelection(e.clientX, e.clientY), 30);
  });

  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || !sel.toString().trim()) {
      pill.style.display = 'none';
    }
  });

  async function callGroq(systemPrompt, userPrompt) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEFAULT_GROQ_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  }

  function replaceSelectedOrCopy(newText) {
    navigator.clipboard.writeText(newText).catch(() => {});
    const active = activeEditableEl || document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
      const start = active.selectionStart;
      const end = active.selectionEnd;
      active.setRangeText(newText, start, end, 'end');
      active.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    if (active && active.isContentEditable) {
      active.focus();
      document.execCommand('insertText', false, newText);
      return true;
    }
    return false;
  }

  btnConvert.addEventListener('click', async () => {
    if (!lastSelectedText) return;
    btnConvert.textContent = '⏳ Translating...';
    try {
      const res = await callGroq(
        'You are a direct Banglish/Bengali to English translator. Translate accurately into natural English. Return pure JSON: {"english":"..."}',
        `Translate to English: ${lastSelectedText}`
      );
      if (res.english) {
        const replaced = replaceSelectedOrCopy(res.english);
        pill.style.display = 'none';
        if (!replaced) {
          showCard('Translated & Copied to Clipboard!', res.english, '');
        }
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      btnConvert.textContent = '⚡ Banglish → EN';
    }
  });

  btnReply.addEventListener('click', async () => {
    if (!lastSelectedText) return;
    btnReply.textContent = '⏳ Thinking...';
    try {
      const res = await callGroq(
        'You assist a business owner. 1. Give simple Bengali meaning of the customer message (banglaMeaning). 2. Give a short 1-sentence English reply (shortEnglish) and its Bengali meaning (shortBangla). Return pure JSON: {"banglaMeaning":"...","shortEnglish":"...","shortBangla":"..."}',
        `Customer message: ${lastSelectedText}`
      );
      pill.style.display = 'none';
      if (res.shortEnglish) {
        navigator.clipboard.writeText(res.shortEnglish).catch(() => {});
      }
      showCard(res.banglaMeaning, res.shortEnglish, res.shortBangla);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      btnReply.textContent = '💬 বাংলা অর্থ + Reply';
    }
  });

  function showCard(banglaMeaning, shortEnglish, shortBangla) {
    card.style.left = pill.style.left;
    card.style.top = `${Math.min(window.innerHeight - 240, parseInt(pill.style.top, 10) + 10)}px`;
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <strong style="color:#38bdf8;font-size:12px;">🧐 কাস্টমার যা বলেছেন (বাংলা অর্থ):</strong>
        <button id="b2e-close-card" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;">✕</button>
      </div>
      <div style="background:#1e293b;padding:8px 10px;border-radius:8px;margin-bottom:10px;color:#f1f5f9;font-size:12.5px;">
        ${banglaMeaning || ''}
      </div>
      <strong style="color:#6ee7b7;font-size:12px;display:block;margin-bottom:4px;">💡 Short English Reply (Auto-Copied!):</strong>
      <div style="background:#1e293b;padding:8px 10px;border-radius:8px;margin-bottom:6px;color:#fff;font-weight:600;font-size:13px;">
        ${shortEnglish || ''}
      </div>
      ${shortBangla ? `<div style="color:#94a3b8;font-size:12px;margin-bottom:10px;">বাংলা অর্থ: ${shortBangla}</div>` : ''}
      <button id="b2e-copy-btn" style="width:100%;background:#10b981;color:#042f1e;border:none;padding:8px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;">
        📋 Copy Reply (Ready to Paste)
      </button>
    `;
    card.style.display = 'block';

    card.querySelector('#b2e-close-card').onclick = () => {
      card.style.display = 'none';
    };
    card.querySelector('#b2e-copy-btn').onclick = () => {
      navigator.clipboard.writeText(shortEnglish || '');
      card.querySelector('#b2e-copy-btn').textContent = '✅ Copied! Now Paste (Ctrl+V)';
      setTimeout(() => {
        card.style.display = 'none';
      }, 700);
    };
  }
})();
