/**
 * PC Global Shortcut & Clipboard Bridge (Node.js)
 * Registers global shortcuts on Windows:
 *   - Alt + Q : Convert Selected Banglish -> Auto-Paste English in-place (ZERO clicks, stays in WhatsApp)
 *   - Alt + W : Select Customer Message -> Floating Mini Popup showing Bengali Meaning + Suggested English -> Press Enter to Auto-Paste!
 */
const { spawn, exec } = require('child_process');
const path = require('path');
const GeminiAssistant = require('./public/gemini.js');

class HotkeyBridge {
  constructor({ getConfig, port }) {
    this.getConfig = getConfig;
    this.port = port;
    this.psProcess = null;
    this.isActive = false;
    this.isBusy = false;
    this.popupPath = path.join(__dirname, 'popup.ps1');
  }

  start() {
    if (process.platform !== 'win32') {
      console.log('ℹ️ Global Hotkey is only supported on Windows.');
      return;
    }

    const psScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms

$code = @'
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class GlobalHotkeyLoop {
    [DllImport("user32.dll")]
    public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll")]
    public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    [DllImport("user32.dll")]
    public static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [StructLayout(LayoutKind.Sequential)]
    public struct MSG {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public int pt_x;
        public int pt_y;
    }

    public const uint MOD_ALT = 0x0001;
    public const uint MOD_NOREPEAT = 0x4000;
    public const uint WM_HOTKEY = 0x0312;
    public const byte VK_CONTROL = 0x11;
    public const byte VK_MENU = 0x12;
    public const byte VK_C = 0x43;
    public const byte VK_V = 0x56;
    public const uint KEYEVENTF_KEYUP = 0x0002;

    public static void ReleaseModifiers() {
        keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }

    public static void SendCtrlC() {
        ReleaseModifiers();
        Thread.Sleep(60);
        keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
        keybd_event(VK_C, 0, 0, UIntPtr.Zero);
        Thread.Sleep(30);
        keybd_event(VK_C, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
'@

Add-Type -TypeDefinition $code

# Register Alt+Q (id=1, VK_Q=0x51) and Alt+W (id=2, VK_W=0x57)
$ok1 = [GlobalHotkeyLoop]::RegisterHotKey([IntPtr]::Zero, 1, [GlobalHotkeyLoop]::MOD_ALT -bor [GlobalHotkeyLoop]::MOD_NOREPEAT, 0x51)
$ok2 = [GlobalHotkeyLoop]::RegisterHotKey([IntPtr]::Zero, 2, [GlobalHotkeyLoop]::MOD_ALT -bor [GlobalHotkeyLoop]::MOD_NOREPEAT, 0x57)

$initJson = @{ event = "ready"; altQ = $ok1; altW = $ok2 } | ConvertTo-Json -Compress
[Console]::WriteLine($initJson)
[Console]::Out.Flush()

$msg = New-Object GlobalHotkeyLoop+MSG
while ([GlobalHotkeyLoop]::GetMessage([ref]$msg, [IntPtr]::Zero, 0, 0) -ne 0) {
    if ($msg.message -eq [GlobalHotkeyLoop]::WM_HOTKEY) {
        $id = $msg.wParam.ToInt32()
        [GlobalHotkeyLoop]::SendCtrlC()
        Start-Sleep -Milliseconds 140
        $clipText = ""
        try {
            if ([System.Windows.Forms.Clipboard]::ContainsText()) {
                $clipText = [System.Windows.Forms.Clipboard]::GetText()
            }
        } catch {}
        $ev = @{
            event = "hotkey"
            id = $id
            text = $clipText
        } | ConvertTo-Json -Compress
        [Console]::WriteLine($ev)
        [Console]::Out.Flush()
    }
}
`;

    const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');

    this.psProcess = spawn(
      'powershell.exe',
      ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedCommand],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
    );

    let buffer = '';
    this.psProcess.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line.trim());
          this.handleBridgeMessage(msg);
        } catch (_) {}
      }
    });

    this.psProcess.on('exit', () => {
      this.isActive = false;
    });
  }

  async handleBridgeMessage(msg) {
    if (msg.event === 'ready') {
      this.isActive = Boolean(msg.altQ || msg.altW);
      if (this.isActive) {
        console.log('⚡ PC In-App Shortcuts Active (No tab switching needed):');
        console.log('   👉 [Alt + Q] : Convert Selected Banglish -> Auto-Paste English in WhatsApp');
        console.log('   👉 [Alt + W] : Customer Msg -> Floating Bangla Translation & Suggested Reply');
      }
      return;
    }

    if (msg.event === 'hotkey') {
      if (msg.id === 1) {
        await this.handleAltQ(msg.text || '');
      } else if (msg.id === 2) {
        await this.handleAltW(msg.text || '');
      }
    }
  }

  /**
   * Alt + Q: Type Banglish/Bangla in WhatsApp -> Select -> Press Alt+Q -> Replaces with English immediately
   */
  async handleAltQ(capturedText) {
    if (this.isBusy) return;
    const text = (capturedText || '').trim();
    if (!text) {
      this.playBeep(300, 150);
      return;
    }

    const config = this.getConfig();
    if (!config.apiKey) {
      this.playBeep(300, 200);
      this.openBrowserWindow(`http://localhost:${this.port}`);
      return;
    }

    this.isBusy = true;
    this.playBeep(650, 70);

    try {
      const result = await GeminiAssistant.convertBanglishToEnglish({
        text,
        tone: config.tone || 'polite',
        businessContext: config.businessContext || '',
        apiKey: config.apiKey
      });

      const englishText = (result.primary || '').trim();
      if (englishText) {
        await this.setClipboardAndPaste(englishText);
        this.playBeep(980, 90);
      }
    } catch (err) {
      this.playBeep(260, 250);
      console.error('❌ [Alt+Q] Error:', err.message);
    } finally {
      this.isBusy = false;
    }
  }

  /**
   * Alt + W: Select customer message in WhatsApp -> Press Alt+W
   * Shows a small floating dialog right on top of WhatsApp with Bangla meaning & Suggested English
   */
  async handleAltW(customerText) {
    if (this.isBusy) return;
    const text = (customerText || '').trim();
    if (!text) {
      this.playBeep(300, 150);
      return;
    }

    const config = this.getConfig();
    if (!config.apiKey) {
      this.playBeep(300, 200);
      this.openBrowserWindow(`http://localhost:${this.port}`);
      return;
    }

    this.isBusy = true;
    this.playBeep(750, 70);

    try {
      const result = await GeminiAssistant.generateCustomerReply({
        customerMessage: text,
        hint: '',
        tone: config.tone || 'polite',
        businessContext: config.businessContext || '',
        apiKey: config.apiKey
      });

      const banglaMeaning = result.customerBanglaMeaning || 'কাস্টমারের মেসেজ পর্যালোচনা করা হয়েছে।';
      // Pick the short WhatsApp answer by default so it's not overly long
      const shortOption = result.suggestedReplies?.find(r => r.title && r.title.toLowerCase().includes('short')) || result.suggestedReplies?.[0];
      const suggestedEnglish = shortOption?.english || result.short || result.primary || '';
      const suggestedBangla = shortOption?.bangla || result.primaryBangla || '';

      this.showFloatingPopup({
        banglaMeaning,
        suggestedEnglish,
        suggestedBangla
      });
    } catch (err) {
      this.playBeep(260, 250);
      console.error('❌ [Alt+W] Error:', err.message);
    } finally {
      this.isBusy = false;
    }
  }

  /**
   * Spawns a native floating dialog on top of WhatsApp
   */
  showFloatingPopup({ banglaMeaning, suggestedEnglish, suggestedBangla }) {
    spawn(
      'powershell.exe',
      ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', this.popupPath],
      {
        windowsHide: true,
        env: {
          ...process.env,
          B2E_MEANING_B64: Buffer.from(banglaMeaning || '', 'utf8').toString('base64'),
          B2E_ENGLISH_B64: Buffer.from(suggestedEnglish || '', 'utf8').toString('base64'),
          B2E_BANGLA_B64: Buffer.from(suggestedBangla || '', 'utf8').toString('base64')
        }
      }
    );
  }

  readClipboard() {
    return new Promise((resolve) => {
      const ps = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
if ([System.Windows.Forms.Clipboard]::ContainsText()) {
  [Console]::Write([System.Windows.Forms.Clipboard]::GetText())
}
`;
      const encoded = Buffer.from(ps, 'utf16le').toString('base64');
      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
        { windowsHide: true }
      );
      let out = '';
      child.stdout.on('data', (d) => (out += d.toString('utf8')));
      child.on('close', () => resolve(out));
    });
  }

  setClipboardAndPaste(text) {
    return new Promise((resolve) => {
      const base64Text = Buffer.from(text, 'utf8').toString('base64');
      const ps = `
Add-Type -AssemblyName System.Windows.Forms
$bytes = [System.Convert]::FromBase64String('${base64Text}')
$str = [System.Text.Encoding]::UTF8.GetString($bytes)
[System.Windows.Forms.Clipboard]::SetText($str)
Start-Sleep -Milliseconds 60
[System.Windows.Forms.SendKeys]::SendWait('^v')
`;
      const encoded = Buffer.from(ps, 'utf16le').toString('base64');
      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
        { windowsHide: true }
      );
      child.on('close', () => resolve());
    });
  }

  playBeep(freq = 800, durationMs = 80) {
    if (process.platform !== 'win32') return;
    exec(`powershell -NoProfile -WindowStyle Hidden -Command "[console]::beep(${freq},${durationMs})"`);
  }

  openBrowserWindow(url) {
    exec(`start chrome --app="${url}" --window-size=920,700`, (err) => {
      if (err) {
        exec(`start msedge --app="${url}" --window-size=920,700`, (err2) => {
          if (err2) {
            exec(`start "" "${url}"`);
          }
        });
      }
    });
  }

  stop() {
    if (this.psProcess) {
      this.psProcess.kill();
      this.psProcess = null;
    }
  }
}

module.exports = HotkeyBridge;
