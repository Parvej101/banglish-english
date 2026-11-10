/**
 * Banglish -> English Business Assistant Server (100% Node.js)
 * - Serves the Web & Mobile PWA on localhost + Local Wi-Fi (LAN)
 * - Syncs Gemini API Key & Business Settings with PC Global Shortcuts (Alt+Q / Alt+W)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const HotkeyBridge = require('./hotkey-bridge');

const PORT = process.env.PORT || 3847;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CONFIG_FILE = path.join(__dirname, 'config.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (_) {}
  return {
    apiKey: process.env.GEMINI_API_KEY || '',
    businessContext: '',
    tone: 'polite'
  };
}

function saveConfig(newData) {
  const current = loadConfig();
  const updated = {
    ...current,
    ...newData
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

function getLanUrls(port) {
  const interfaces = os.networkInterfaces();
  const urls = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        urls.push(`http://${iface.address}:${port}`);
      }
    }
  }
  return urls;
}

const hotkeyBridge = new HotkeyBridge({
  getConfig: loadConfig,
  port: PORT
});

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // API: Get or Update Config
  if (pathname === '/api/config') {
    if (req.method === 'GET') {
      const cfg = loadConfig();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ...cfg,
          hotkeyActive: hotkeyBridge.isActive,
          lanUrls: getLanUrls(PORT)
        })
      );
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const saved = saveConfig({
            apiKey: typeof payload.apiKey === 'string' ? payload.apiKey.trim() : undefined,
            businessContext:
              typeof payload.businessContext === 'string'
                ? payload.businessContext.trim()
                : undefined,
            tone: typeof payload.tone === 'string' ? payload.tone : undefined
          });
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, config: saved }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });
      return;
    }
  }

  // API: Read PC Clipboard (helpful fallback for LAN/Local devices)
  if (pathname === '/api/clipboard' && req.method === 'GET') {
    const text = await hotkeyBridge.readClipboard();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ text }));
    return;
  }

  // Static Files
  let safePath = pathname === '/' ? '/index.html' : pathname;
  safePath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const lanUrls = getLanUrls(PORT);
  console.log('============================================================');
  console.log('🚀 Banglish -> English Business Assistant is running!');
  console.log(`💻 PC URL     : http://localhost:${PORT}`);
  if (lanUrls.length > 0) {
    console.log(`📱 Mobile URL : ${lanUrls.join('  or  ')} (Same Wi-Fi)`);
  }
  console.log('============================================================');

  if (!process.argv.includes('--no-hotkey')) {
    hotkeyBridge.start();
  }

  if (process.argv.includes('--open')) {
    hotkeyBridge.openBrowserWindow(`http://localhost:${PORT}`);
  }
});

process.on('SIGINT', () => {
  hotkeyBridge.stop();
  process.exit(0);
});

