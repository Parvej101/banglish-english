/**
 * Multi-Provider AI Assistant Module (Groq + Google Gemini)
 * Accurate Direct Translation + Smart Customer Message Assistant
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GeminiAssistant = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const GROQ_MODEL = 'qwen/qwen3.8-27b';
  const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';
  const GEMINI_FALLBACK_MODEL = 'gemini-2.0-flash';

  const TONE_DESCRIPTIONS = {
    polite: 'Polite and professional',
    short: 'Short and concise WhatsApp chat style',
    sales: 'Engaging and helpful sales tone',
    apology: 'Courteous and apologetic'
  };

  function buildSystemInstruction(businessContext = '') {
    return `You are a high-precision Translator and Business English Assistant for an online business owner in Bangladesh.

TRANSLATION RULES:
1. Translate accurately what the user provides.
2. Keep the meaning exact without hallucinating questions or extra details.
${businessContext ? `STORE CONTEXT:\n${businessContext.trim()}\n` : ''}
Always output pure valid JSON only.`;
  }

  function detectProvider(apiKey = '', explicitProvider = '') {
    if (explicitProvider) return explicitProvider;
    if (apiKey.startsWith('gsk_')) return 'groq';
    if (apiKey.startsWith('AIza')) return 'gemini';
    return 'groq';
  }

  async function callGroqAPI({ apiKey, prompt, systemInstruction }) {
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const payload = {
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errMsg = `Groq API Error (${response.status})`;
      try {
        const errData = await response.json();
        if (errData?.error?.message) {
          errMsg = errData.error.message;
        }
      } catch (_) {}
      throw new Error(errMsg);
    }

    const data = await response.json();
    const rawText = data?.choices?.[0]?.message?.content;
    if (!rawText) {
      throw new Error('AI থেকে কোনো উত্তর পাওয়া যায়নি। আবার চেষ্টা করুন।');
    }

    return parseJSONSafe(rawText);
  }

  async function callGeminiAPI({ apiKey, prompt, systemInstruction, model = GEMINI_DEFAULT_MODEL }) {
    const cleanKey = apiKey.trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;

    const payload = {
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errMsg = `Gemini API Error (${response.status})`;
      try {
        const errData = await response.json();
        if (errData?.error?.message) {
          errMsg = errData.error.message;
        }
      } catch (_) {}

      if (errMsg.includes('suspended') || errMsg.includes('Permission denied')) {
        throw new Error('Gemini API Key সাসপেন্ড হয়েছে। অনুগ্রহ করে Groq API Key ব্যবহার করুন।');
      }

      if (model === GEMINI_DEFAULT_MODEL && (response.status === 404 || response.status === 400)) {
        return callGeminiAPI({
          apiKey: cleanKey,
          prompt,
          systemInstruction,
          model: GEMINI_FALLBACK_MODEL
        });
      }

      throw new Error(errMsg);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('AI থেকে কোনো উত্তর পাওয়া যায়নি।');
    }

    return parseJSONSafe(rawText);
  }

  function parseJSONSafe(rawText) {
    try {
      return JSON.parse(rawText);
    } catch (_) {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch (__) {}
      }
      return {
        primary: rawText.trim(),
        short: rawText.trim(),
        polite: rawText.trim()
      };
    }
  }

  async function dispatchAICall({ apiKey, prompt, systemInstruction, provider = 'auto' }) {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('API Key সেট করা নেই! Settings থেকে Groq অথবা Gemini API Key দিন।');
    }

    const resolvedProvider = provider === 'auto' ? detectProvider(apiKey) : provider;

    if (resolvedProvider === 'groq') {
      return callGroqAPI({ apiKey, prompt, systemInstruction });
    } else {
      return callGeminiAPI({ apiKey, prompt, systemInstruction });
    }
  }

  /**
   * Mode 1: Banglish/Bangla -> Business English
   */
  async function convertBanglishToEnglish({
    text,
    tone = 'polite',
    businessContext = '',
    apiKey,
    provider = 'auto'
  }) {
    if (!text || !text.trim()) {
      throw new Error('কনভার্ট করার জন্য কিছু টেক্সট লিখুন বা পেস্ট করুন।');
    }

    const toneGuide = TONE_DESCRIPTIONS[tone] || TONE_DESCRIPTIONS.polite;
    const systemInstruction = buildSystemInstruction(businessContext);

    const prompt = `Translate the following Banglish or Bengali text into accurate, natural English.
DO NOT hallucinate or add unrelated context. Translate directly what is written.

Selected Tone: ${toneGuide}

Text to translate:
"""
${text.trim()}
"""

Provide a JSON response with:
{
  "primary": "Accurate, natural English translation",
  "short": "Short direct translation",
  "polite": "Polite phrasing of the translation"
}`;

    return dispatchAICall({ apiKey, prompt, systemInstruction, provider });
  }

  /**
   * Mode 2: Smart Customer Assistant (Bangla Meaning + Suggested Replies in Bangla & English + Custom Hint)
   */
  async function generateCustomerReply({
    customerMessage,
    hint = '',
    tone = 'polite',
    businessContext = '',
    apiKey,
    provider = 'auto'
  }) {
    if (!customerMessage && !hint) {
      throw new Error('কাস্টমারের মেসেজ অথবা আপনার উত্তরের হিন্ট দিন।');
    }

    const toneGuide = TONE_DESCRIPTIONS[tone] || TONE_DESCRIPTIONS.polite;
    const systemInstruction = `You are a Smart Customer Support Assistant for an online business owner in Bangladesh.
The business owner needs to:
1. Understand clearly what the customer is asking in simple Bengali (বাংলা অর্থ).
2. Get 2 ready-to-use suggested replies, each with BOTH its Bengali meaning and professional English translation.
3. If the owner provides a custom hint/reply (in Banglish or Bangla), convert that hint into professional English as the Primary reply.
${businessContext ? `Store Context: ${businessContext}\n` : ''}
Always output pure valid JSON only.`;

    const prompt = `Analyze this customer message and generate the response.

Customer's Message:
"""
${(customerMessage || '(No message)').trim()}
"""

Owner's Custom Hint (Optional, written in Banglish/Bangla):
"""
${(hint || '').trim()}
"""

Selected Tone: ${toneGuide}

Return pure JSON with EXACTLY this structure:
{
  "customerBanglaMeaning": "কাস্টমার কী বলেছেন তার ১ লাইনের একদম সহজ বাংলা অর্থ",
  "primary": "A short, simple, direct 1-sentence WhatsApp reply in English (no extra fluff)",
  "primaryBangla": "উপরের উত্তরের ১ লাইনের সহজ বাংলা অর্থ",
  "suggestedReplies": [
    {
      "title": "Short Reply",
      "bangla": "সংক্ষিপ্ত বাংলা উত্তর",
      "english": "Short 1-sentence English reply ready to send"
    },
    {
      "title": "Polite Reply",
      "bangla": "ভদ্র বাংলা উত্তর",
      "english": "Polite English reply ready to send"
    }
  ]
}`;

    return dispatchAICall({ apiKey, prompt, systemInstruction, provider });
  }

  return {
    convertBanglishToEnglish,
    generateCustomerReply,
    detectProvider,
    TONE_DESCRIPTIONS
  };
});
