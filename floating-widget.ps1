Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$csharp = @"
using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

public class FloatingForm : Form {
    public bool AllowFocus = false;

    protected override CreateParams CreateParams {
        get {
            CreateParams cp = base.CreateParams;
            // WS_EX_TOPMOST (0x00000008) | WS_EX_TOOLWINDOW (0x00000080) | WS_EX_NOACTIVATE (0x08000000)
            cp.ExStyle |= 0x08000088;
            return cp;
        }
    }

    protected override void OnShown(EventArgs e) {
        base.OnShown(e);
        ForceTopMost();
    }

    public void ForceTopMost() {
        // HWND_TOPMOST = -1, SWP_NOSIZE (0x0001) | SWP_NOMOVE (0x0002) | SWP_NOACTIVATE (0x0010) | SWP_SHOWWINDOW (0x0040)
        SetWindowPos(this.Handle, new IntPtr(-1), 0, 0, 0, 0, 0x0053);
    }

    protected override void WndProc(ref Message m) {
        const int WM_MOUSEACTIVATE = 0x0021;
        const int MA_NOACTIVATE = 3;
        if (!AllowFocus && m.Msg == WM_MOUSEACTIVATE) {
            m.Result = (IntPtr)MA_NOACTIVATE;
            return;
        }
        base.WndProc(ref m);
    }

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    public static extern IntPtr SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);

    public const byte VK_CONTROL = 0x11;
    public const byte VK_C = 0x43;
    public const byte VK_V = 0x56;
    public const uint KEYEVENTF_KEYUP = 0x0002;

    public static void DragWindow(IntPtr hwnd) {
        ReleaseCapture();
        SendMessage(hwnd, 0xA1, 0x2, 0);
    }

    public static void SendCtrlC() {
        keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
        keybd_event(VK_C, 0, 0, UIntPtr.Zero);
        Thread.Sleep(35);
        keybd_event(VK_C, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }

    public static void SendCtrlV() {
        keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
        keybd_event(VK_V, 0, 0, UIntPtr.Zero);
        Thread.Sleep(35);
        keybd_event(VK_V, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@

Add-Type -TypeDefinition $csharp -ReferencedAssemblies System.Windows.Forms, System.Drawing

# Load API Key from config.json
$configPath = Join-Path $PSScriptRoot "config.json"
function Get-ApiKey {
    if (Test-Path $configPath) {
        try {
            $cfg = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
            return $cfg.apiKey
        } catch {}
    }
    return ""
}

function Invoke-GroqAI([string]$systemPrompt, [string]$userPrompt) {
    $apiKey = Get-ApiKey
    if ([string]::IsNullOrWhiteSpace($apiKey)) {
        throw "API Key missing in config.json"
    }

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $bodyObj = @{
        model = "qwen/qwen3.8-27b"
        temperature = 0.1
        response_format = @{ type = "json_object" }
        messages = @(
            @{ role = "system"; content = $systemPrompt },
            @{ role = "user"; content = $userPrompt }
        )
    }
    $jsonBody = $bodyObj | ConvertTo-Json -Depth 6 -Compress
    $utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonBody)

    $req = [System.Net.HttpWebRequest]::Create("https://api.groq.com/openai/v1/chat/completions")
    $req.Method = "POST"
    $req.ContentType = "application/json; charset=utf-8"
    $req.Headers.Add("Authorization", "Bearer " + $apiKey.Trim())
    $req.Timeout = 15000

    $stream = $req.GetRequestStream()
    $stream.Write($utf8Bytes, 0, $utf8Bytes.Length)
    $stream.Close()

    $resp = $req.GetResponse()
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream(), [System.Text.Encoding]::UTF8)
    $rawResp = $reader.ReadToEnd()
    $reader.Close()

    $parsed = $rawResp | ConvertFrom-Json
    $content = $parsed.choices[0].message.content
    return ($content | ConvertFrom-Json)
}

# Create Floating Bar Form
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$form = New-Object FloatingForm
$form.Text = "Banglish Floating Assistant"
$form.FormBorderStyle = "FixedToolWindow"
$form.ControlBox = $false
$form.TopMost = $true
$form.StartPosition = "Manual"
$form.Size = New-Object System.Drawing.Size(255, 50)
$form.Location = New-Object System.Drawing.Point([int](($screen.Width - 255) / 2), ($screen.Top + 65))
$form.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)

# Keep TopMost timer
$topTimer = New-Object System.Windows.Forms.Timer
$topTimer.Interval = 1500
$topTimer.Add_Tick({ $form.ForceTopMost() })
$topTimer.Start()

# Drag Handle
$lblDrag = New-Object System.Windows.Forms.Label
$lblDrag.Text = ":: AI"
$lblDrag.ForeColor = [System.Drawing.Color]::FromArgb(110, 231, 183)
$lblDrag.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$lblDrag.Location = New-Object System.Drawing.Point(6, 12)
$lblDrag.Size = New-Object System.Drawing.Size(38, 22)
$lblDrag.Cursor = [System.Windows.Forms.Cursors]::SizeAll
$lblDrag.Add_MouseDown({ [FloatingForm]::DragWindow($form.Handle) })
$form.Controls.Add($lblDrag)

# Button 1: Convert Banglish -> English In-Place
$btnConvert = New-Object System.Windows.Forms.Button
$btnConvert.Text = "Banglish -> EN"
$btnConvert.Location = New-Object System.Drawing.Point(44, 6)
$btnConvert.Size = New-Object System.Drawing.Size(94, 32)
$btnConvert.BackColor = [System.Drawing.Color]::FromArgb(16, 185, 129)
$btnConvert.ForeColor = [System.Drawing.Color]::FromArgb(4, 47, 30)
$btnConvert.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$btnConvert.FlatStyle = "Flat"
$btnConvert.Cursor = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($btnConvert)

# Button 2: Customer Reply (Bangla Meaning + Short Answer)
$btnReply = New-Object System.Windows.Forms.Button
$btnReply.Text = "Reply / Meaning"
$btnReply.Location = New-Object System.Drawing.Point(142, 6)
$btnReply.Size = New-Object System.Drawing.Size(92, 32)
$btnReply.BackColor = [System.Drawing.Color]::FromArgb(59, 130, 246)
$btnReply.ForeColor = [System.Drawing.Color]::White
$btnReply.Font = New-Object System.Drawing.Font("Segoe UI", 8.0, [System.Drawing.FontStyle]::Bold)
$btnReply.FlatStyle = "Flat"
$btnReply.Cursor = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($btnReply)

# Expandable Result Panel (Hidden when collapsed)
$lblMeaningHeader = New-Object System.Windows.Forms.Label
$lblMeaningHeader.Text = "Customer Meaning (Bangla):"
$lblMeaningHeader.ForeColor = [System.Drawing.Color]::FromArgb(56, 189, 248)
$lblMeaningHeader.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$lblMeaningHeader.Location = New-Object System.Drawing.Point(10, 50)
$lblMeaningHeader.Size = New-Object System.Drawing.Size(280, 18)
$form.Controls.Add($lblMeaningHeader)

$txtMeaning = New-Object System.Windows.Forms.TextBox
$txtMeaning.Multiline = $true
$txtMeaning.ReadOnly = $true
$txtMeaning.Location = New-Object System.Drawing.Point(10, 70)
$txtMeaning.Size = New-Object System.Drawing.Size(330, 44)
$txtMeaning.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$txtMeaning.ForeColor = [System.Drawing.Color]::White
$txtMeaning.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)
$txtMeaning.BorderStyle = "FixedSingle"
$form.Controls.Add($txtMeaning)

$lblReplyHeader = New-Object System.Windows.Forms.Label
$lblReplyHeader.Text = "Suggested Short Reply (Auto-Copied):"
$lblReplyHeader.ForeColor = [System.Drawing.Color]::FromArgb(110, 231, 183)
$lblReplyHeader.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$lblReplyHeader.Location = New-Object System.Drawing.Point(10, 120)
$lblReplyHeader.Size = New-Object System.Drawing.Size(280, 18)
$form.Controls.Add($lblReplyHeader)

$txtReply = New-Object System.Windows.Forms.TextBox
$txtReply.Multiline = $true
$txtReply.Location = New-Object System.Drawing.Point(10, 140)
$txtReply.Size = New-Object System.Drawing.Size(330, 52)
$txtReply.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$txtReply.ForeColor = [System.Drawing.Color]::White
$txtReply.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)
$txtReply.BorderStyle = "FixedSingle"
$form.Controls.Add($txtReply)

$lblReplyBangla = New-Object System.Windows.Forms.Label
$lblReplyBangla.Text = ""
$lblReplyBangla.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$lblReplyBangla.Font = New-Object System.Drawing.Font("Segoe UI", 8.5)
$lblReplyBangla.Location = New-Object System.Drawing.Point(10, 196)
$lblReplyBangla.Size = New-Object System.Drawing.Size(330, 36)
$form.Controls.Add($lblReplyBangla)

$btnPasteReply = New-Object System.Windows.Forms.Button
$btnPasteReply.Text = "Copy Reply"
$btnPasteReply.Location = New-Object System.Drawing.Point(10, 236)
$btnPasteReply.Size = New-Object System.Drawing.Size(230, 34)
$btnPasteReply.BackColor = [System.Drawing.Color]::FromArgb(16, 185, 129)
$btnPasteReply.ForeColor = [System.Drawing.Color]::FromArgb(4, 47, 30)
$btnPasteReply.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$btnPasteReply.FlatStyle = "Flat"
$form.Controls.Add($btnPasteReply)

$btnCollapse = New-Object System.Windows.Forms.Button
$btnCollapse.Text = "Hide"
$btnCollapse.Location = New-Object System.Drawing.Point(248, 236)
$btnCollapse.Size = New-Object System.Drawing.Size(92, 34)
$btnCollapse.BackColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$btnCollapse.ForeColor = [System.Drawing.Color]::White
$btnCollapse.FlatStyle = "Flat"
$form.Controls.Add($btnCollapse)

# Action 1: Click "Banglish -> EN" Floating Button
$btnConvert.Add_Click({
    $btnConvert.Text = "Wait..."
    $form.Refresh()
    try {
        [FloatingForm]::SendCtrlC()
        Start-Sleep -Milliseconds 150
        $src = ""
        if ([System.Windows.Forms.Clipboard]::ContainsText()) {
            $src = [System.Windows.Forms.Clipboard]::GetText().Trim()
        }
        if (-not [string]::IsNullOrWhiteSpace($src)) {
            $sys = "You are a direct Banglish/Bengali to English translator. Translate accurately into natural English without adding extra questions. Return JSON: { `"english`": `"...`" }"
            $usr = "Translate directly to English: " + $src
            $res = Invoke-GroqAI $sys $usr
            if ($res.english) {
                [System.Windows.Forms.Clipboard]::SetText($res.english)
                Start-Sleep -Milliseconds 60
                [FloatingForm]::SendCtrlV()
            }
        }
    } catch {}
    $btnConvert.Text = "Banglish -> EN"
})

# Action 2: Click "Reply / Meaning" Floating Button
$btnReply.Add_Click({
    $btnReply.Text = "Wait..."
    $form.Refresh()
    try {
        [FloatingForm]::SendCtrlC()
        Start-Sleep -Milliseconds 150
        $src = ""
        if ([System.Windows.Forms.Clipboard]::ContainsText()) {
            $src = [System.Windows.Forms.Clipboard]::GetText().Trim()
        }
        if (-not [string]::IsNullOrWhiteSpace($src)) {
            $sys = "You assist a Bangladeshi business owner. 1. Translate the customer's message into simple Bengali (banglaMeaning). 2. Write a short 1-sentence English reply (shortEnglish) and its Bengali meaning (shortBangla). Return pure JSON: { `"banglaMeaning`": `"...`", `"shortEnglish`": `"...`", `"shortBangla`": `"...`" }"
            $usr = "Customer message: " + $src
            $res = Invoke-GroqAI $sys $usr

            $txtMeaning.Text = $res.banglaMeaning
            $txtReply.Text = $res.shortEnglish
            $lblReplyBangla.Text = "Bangla: " + $res.shortBangla

            if ($res.shortEnglish) {
                [System.Windows.Forms.Clipboard]::SetText($res.shortEnglish)
            }

            $form.Size = New-Object System.Drawing.Size(365, 295)
            $form.ForceTopMost()
        }
    } catch {
        $txtMeaning.Text = "Error: " + $_.Exception.Message
        $form.Size = New-Object System.Drawing.Size(365, 295)
    }
    $btnReply.Text = "Reply / Meaning"
})

# Action 3: Click "Copy Reply"
$btnPasteReply.Add_Click({
    if (-not [string]::IsNullOrWhiteSpace($txtReply.Text)) {
        [System.Windows.Forms.Clipboard]::SetText($txtReply.Text)
        $form.Size = New-Object System.Drawing.Size(255, 50)
    }
})

# Action 4: Hide Expanded Panel
$btnCollapse.Add_Click({
    $form.Size = New-Object System.Drawing.Size(255, 50)
})

[System.Windows.Forms.Application]::Run($form)
