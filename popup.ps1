Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Decode-Base64Utf8([string]$b64) {
    if ([string]::IsNullOrEmpty($b64)) { return "" }
    try {
        $bytes = [System.Convert]::FromBase64String($b64)
        return [System.Text.Encoding]::UTF8.GetString($bytes)
    } catch {
        return $b64
    }
}

$BanglaMeaning    = Decode-Base64Utf8 $env:B2E_MEANING_B64
$SuggestedEnglish = Decode-Base64Utf8 $env:B2E_ENGLISH_B64
$SuggestedBangla  = Decode-Base64Utf8 $env:B2E_BANGLA_B64

$form = New-Object System.Windows.Forms.Form
$form.Text = "WhatsApp Quick Reply (Alt+W)"
$form.Size = New-Object System.Drawing.Size(450, 320)
$form.StartPosition = "CenterScreen"
$form.TopMost = $true
$form.FormBorderStyle = "FixedToolWindow"
$form.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$form.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)

# 1. Customer Meaning Header
$lbl1 = New-Object System.Windows.Forms.Label
$lbl1.Text = "Customer Message (Bangla Meaning):"
$lbl1.ForeColor = [System.Drawing.Color]::FromArgb(56, 189, 248)
$lbl1.Location = New-Object System.Drawing.Point(14, 10)
$lbl1.Size = New-Object System.Drawing.Size(405, 20)
$lbl1.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$form.Controls.Add($lbl1)

$txtMeaning = New-Object System.Windows.Forms.TextBox
$txtMeaning.Multiline = $true
$txtMeaning.ReadOnly = $true
$txtMeaning.ScrollBars = "Vertical"
$txtMeaning.Text = $BanglaMeaning
$txtMeaning.Location = New-Object System.Drawing.Point(14, 32)
$txtMeaning.Size = New-Object System.Drawing.Size(405, 48)
$txtMeaning.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$txtMeaning.ForeColor = [System.Drawing.Color]::FromArgb(241, 245, 249)
$txtMeaning.BorderStyle = "FixedSingle"
$form.Controls.Add($txtMeaning)

# 2. Short English Reply Header
$lbl2 = New-Object System.Windows.Forms.Label
$lbl2.Text = "Short Reply (English - Ready to Paste):"
$lbl2.ForeColor = [System.Drawing.Color]::FromArgb(110, 231, 183)
$lbl2.Location = New-Object System.Drawing.Point(14, 88)
$lbl2.Size = New-Object System.Drawing.Size(405, 20)
$lbl2.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$form.Controls.Add($lbl2)

$txtReply = New-Object System.Windows.Forms.TextBox
$txtReply.Multiline = $true
$txtReply.ScrollBars = "Vertical"
$txtReply.Text = $SuggestedEnglish
$txtReply.Location = New-Object System.Drawing.Point(14, 110)
$txtReply.Size = New-Object System.Drawing.Size(405, 58)
$txtReply.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$txtReply.ForeColor = [System.Drawing.Color]::FromArgb(241, 245, 249)
$txtReply.BorderStyle = "FixedSingle"
$form.Controls.Add($txtReply)

# 3. Bengali Meaning of this reply
$lbl3 = New-Object System.Windows.Forms.Label
$lbl3.Text = "Reply Meaning: " + $SuggestedBangla
$lbl3.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$lbl3.Location = New-Object System.Drawing.Point(14, 174)
$lbl3.Size = New-Object System.Drawing.Size(405, 42)
$form.Controls.Add($lbl3)

# 4. Paste Button
$btnPaste = New-Object System.Windows.Forms.Button
$btnPaste.Text = "Paste to WhatsApp (Enter)"
$btnPaste.Location = New-Object System.Drawing.Point(14, 224)
$btnPaste.Size = New-Object System.Drawing.Size(290, 40)
$btnPaste.BackColor = [System.Drawing.Color]::FromArgb(16, 185, 129)
$btnPaste.ForeColor = [System.Drawing.Color]::FromArgb(4, 47, 30)
$btnPaste.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$btnPaste.FlatStyle = "Flat"
$btnPaste.Cursor = [System.Windows.Forms.Cursors]::Hand

$btnPaste.Add_Click({
    [System.Windows.Forms.Clipboard]::SetText($txtReply.Text)
    $form.Close()
    Start-Sleep -Milliseconds 120
    [System.Windows.Forms.SendKeys]::SendWait('^v')
})
$form.Controls.Add($btnPaste)

# 5. Cancel Button
$btnCancel = New-Object System.Windows.Forms.Button
$btnCancel.Text = "Close (Esc)"
$btnCancel.Location = New-Object System.Drawing.Point(312, 224)
$btnCancel.Size = New-Object System.Drawing.Size(107, 40)
$btnCancel.BackColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$btnCancel.ForeColor = [System.Drawing.Color]::FromArgb(241, 245, 249)
$btnCancel.FlatStyle = "Flat"
$btnCancel.Cursor = [System.Windows.Forms.Cursors]::Hand
$btnCancel.Add_Click({ $form.Close() })
$form.Controls.Add($btnCancel)

$form.AcceptButton = $btnPaste
$form.CancelButton = $btnCancel

$form.Add_Shown({
    $form.Activate()
    $btnPaste.Focus()
})

[System.Windows.Forms.Application]::Run($form)
