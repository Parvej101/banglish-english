#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent

TrayTip "Banglish Assistant Ready", "Alt+Q ও Alt+W সক্রিয় আছে", 1

; ----------------------------------------------------------------------
; Alt + Q: Instant Replace Banglish/Bangla -> English in WhatsApp
; ----------------------------------------------------------------------
!q::
{
    A_Clipboard := ""
    Send "^c"
    if !ClipWait(1.2) {
        ToolTip("⚠️ কিছু সিলেক্ট করা নেই!", , , 1)
        SetTimer () => ToolTip(, , , 1), -1500
        return
    }

    selectedText := Trim(A_Clipboard)
    if (selectedText == "")
        return

    ToolTip("⏳ English অনুবাদ হচ্ছে...", , , 1)

    try {
        http := ComObject("WinHttp.WinHttpRequest.5.1")
        http.Open("POST", "http://127.0.0.1:3848/translate-in-place", false)
        http.SetRequestHeader("Content-Type", "application/json; charset=utf-8")
        jsonPayload := '{"text":' . JsonEscape(selectedText) . '}'
        http.Send(jsonPayload)

        if (http.Status == 200) {
            resp := http.ResponseText
            english := ExtractJsonValue(resp, "english")
            if (english != "") {
                A_Clipboard := english
                Sleep 80
                Send "^v"
                ToolTip("✅ English পেস্ট হয়েছে!", , , 1)
                SetTimer () => ToolTip(, , , 1), -1500
                return
            }
        }
    } catch as err {
        ToolTip("❌ অনুবাদে সমস্যা হয়েছে!", , , 1)
        SetTimer () => ToolTip(, , , 1), -2000
    }
}

; ----------------------------------------------------------------------
; Alt + W: Customer Message -> Floating Window with Bangla & Suggested Reply
; ----------------------------------------------------------------------
!w::
{
    A_Clipboard := ""
    Send "^c"
    if !ClipWait(1.2) {
        ToolTip("⚠️ কাস্টমারের মেসেজ সিলেক্ট করুন!", , , 1)
        SetTimer () => ToolTip(, , , 1), -1500
        return
    }

    customerMsg := Trim(A_Clipboard)
    if (customerMsg == "")
        return

    ToolTip("⏳ কাস্টমারের মেসেজ বিশ্লেষণ হচ্ছে...", , , 1)

    try {
        http := ComObject("WinHttp.WinHttpRequest.5.1")
        http.Open("POST", "http://127.0.0.1:3848/customer-assist", false)
        http.SetRequestHeader("Content-Type", "application/json; charset=utf-8")
        jsonPayload := '{"customerMessage":' . JsonEscape(customerMsg) . '}'
        http.Send(jsonPayload)

        ToolTip(, , , 1)

        if (http.Status == 200) {
            resp := http.ResponseText
            bMeaning := ExtractJsonValue(resp, "banglaMeaning")
            sEnglish := ExtractJsonValue(resp, "suggestedEnglish")
            sBangla := ExtractJsonValue(resp, "suggestedBangla")

            ShowReplyGui(bMeaning, sEnglish, sBangla)
        }
    } catch as err {
        ToolTip("❌ এরর: " . err.Message, , , 1)
        SetTimer () => ToolTip(, , , 1), -2000
    }
}

ShowReplyGui(bMeaning, sEnglish, sBangla)
{
    myGui := Gui("+AlwaysOnTop +ToolWindow -MaximizeBox", "WhatsApp Smart Assistant")
    myGui.BackColor := "0x0f172a"
    myGui.SetFont("s10 c0x38bdf8", "Segoe UI")
    myGui.Add("Text", "w460", "🧐 কাস্টমার যা জানতে চেয়েছেন (বাংলা অর্থ):")

    myGui.SetFont("s9.5 c0xf1f5f9", "Segoe UI")
    editMeaning := myGui.Add("Edit", "w460 r3 ReadOnly Background0x1e293b", bMeaning)

    myGui.SetFont("s10 c0x6ee7b7", "Segoe UI")
    myGui.Add("Text", "w460 y+12", "💡 প্রস্তাবিত English উত্তর (প্রয়োজনে এডিট করতে পারেন):")

    myGui.SetFont("s10 c0xf1f5f9", "Segoe UI")
    editReply := myGui.Add("Edit", "w460 r4 Background0x1e293b", sEnglish)

    myGui.SetFont("s9 c0x94a3b8", "Segoe UI")
    myGui.Add("Text", "w460 y+8", "বাংলা অর্থ: " . sBangla)

    myGui.SetFont("s10 Bold", "Segoe UI")
    btnPaste := myGui.Add("Button", "w340 h42 Default", "🚀 সরাসরি WhatsApp-এ Paste করুন (Enter)")
    btnCancel := myGui.Add("Button", "x+10 w110 h42", "✕ Cancel")

    btnPaste.OnEvent("Click", (*) => (
        replyText := editReply.Text,
        myGui.Destroy(),
        A_Clipboard := replyText,
        Sleep(100),
        Send("^v")
    ))

    btnCancel.OnEvent("Click", (*) => myGui.Destroy())

    myGui.Show("w490 Center")
}

JsonEscape(str) {
    str := StrReplace(str, "\", "\\")
    str := StrReplace(str, '"', '\"')
    str := StrReplace(str, "`n", "\n")
    str := StrReplace(str, "`r", "\r")
    return '"' . str . '"'
}

ExtractJsonValue(json, key) {
    pattern := '"' . key . '"\s*:\s*"((?:[^"\\]|\\.)*)"'
    if RegExMatch(json, pattern, &match) {
        val := match[1]
        val := StrReplace(val, '\"', '"')
        val := StrReplace(val, '\n', "`n")
        val := StrReplace(val, '\r', "")
        val := StrReplace(val, '\\', '\')
        return val
    }
    return ""
}
