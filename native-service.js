const http = require('http');
const GeminiAssistant = require('./public/gemini.js');
const fs = require('fs');
const path = require('path');

function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  } catch (_) {
    return {};
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/translate-in-place') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { text } = JSON.parse(body || '{}');
        const cfg = getConfig();
        const result = await GeminiAssistant.convertBanglishToEnglish({
          text,
          apiKey: cfg.apiKey,
          tone: cfg.tone || 'polite'
        });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, english: result.primary || '' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/customer-assist') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { customerMessage } = JSON.parse(body || '{}');
        const cfg = getConfig();
        const result = await GeminiAssistant.generateCustomerReply({
          customerMessage,
          apiKey: cfg.apiKey,
          tone: cfg.tone || 'polite'
        });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: true,
          banglaMeaning: result.customerBanglaMeaning || '',
          suggestedEnglish: result.primary || result.suggestedReplies?.[0]?.english || '',
          suggestedBangla: result.primaryBangla || result.suggestedReplies?.[0]?.bangla || ''
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(3848, '127.0.0.1', () => {
  console.log('⚡ Fast Native Hook Server listening on port 3848');
});

