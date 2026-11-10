# MacroDroid দিয়ে Android-এ Banglish AI Floating Bubble সেটআপ (২ মিনিটে)

এই সেটআপটি করলে আপনার ফোনে WhatsApp, Messenger বা Facebook-এ যেকোনো লেখা **"Copy"** করার সাথে সাথেই স্ক্রিনের ওপর আমাদের Groq AI-এর **ভাসমান ডায়ালগ (Floating Popup)** ভেসে উঠবে—**আপনাকে কখনোই WhatsApp বন্ধ করতে হবে না!**

---

## 🛠️ ধাপে ধাপে সেটআপ:

### ধাপ ১: MacroDroid ইনস্টল করুন
1. ফোনের **Google Play Store** থেকে **[MacroDroid - Device Automation](https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid)** অ্যাপটি ইনস্টল করুন (এটি সম্পূর্ণ ফ্রি)।
2. অ্যাপটি খুলে প্রয়োজনীয় অ্যাক্সেসিবিলিটি পারমিশনগুলো এলাউ (Allow) করে দিন।

---

### ধাপ ২: ম্যাক্রো তৈরি করুন (Trigger)
1. MacroDroid-এর হোমে গিয়ে **"Add Macro"** বাটনে চাপ দিন।
2. **Triggers (+ বাটনে ট্যাপ করুন):**
   - সিলেক্ট করুন: **Device Events** ➔ **Clipboard Refresh / Changed**।
   - (এর মানে: WhatsApp-এ কোনো মেসেজ কপি করলেই এটি চালু হবে)।

---

### ধাপ ৩: Groq AI কানেক্ট করুন (Actions)
1. **Actions (+ বাটনে ট্যাপ করুন):**
   - সিলেক্ট করুন: **Connectivity** ➔ **HTTP Request**।
   - **Request Method:** `POST`
   - **URL:** `https://api.groq.com/openai/v1/chat/completions`
   - **Header যোগ করুন:**
     - Header Name: `Content-Type`  |  Header Value: `application/json`
     - Header Name: `Authorization` |  Header Value: `Bearer আপনার_GROQ_API_KEY`
   - **Body (Text/JSON):** নিচের অংশটি কপি করে পেস্ট করুন:
```json
{
  "model": "qwen/qwen3.8-27b",
  "temperature": 0.1,
  "messages": [
    {
      "role": "system",
      "content": "You assist a Bangladeshi business owner. If customer message: explain in 1 line Bangla & give short English reply. If Banglish text: translate directly to English. Keep response short and clear."
    },
    {
      "role": "user",
      "content": "{clipboard}"
    }
  ]
}
```
   - **Save response to string variable:** টিক দিয়ে একটি ভ্যারিয়েবলের নাম দিন (যেমন: `ai_reply`)।

---

### ধাপ ৪: স্ক্রিনের ওপর ভাসমান ডায়ালগ দেখানো (Floating Dialog)
1. আবার **Actions (+ বাটনে ট্যাপ করুন):**
   - সিলেক্ট করুন: **Notifications** ➔ **Display Dialog** (বা Floating Text)।
   - **Title:** `⚡ AI Assistant`
   - **Message Text:** সিলেক্ট করুন `[lv=ai_reply]` (AI থেকে আসা উত্তর)।
   - **Button 1:** `Copy Reply` (অ্যাকশন দিন: *Clipboard ➔ Set Clipboard*)।

2. ম্যাক্রোটির একটি নাম দিন (যেমন: **Banglish Assistant**) এবং সেভ করুন।

---

## 🎯 ফলাফল (ফোনে ব্যবহারের ম্যাজিক):
- আপনি WhatsApp-এ কোনো কাস্টমারের মেসেজ বা নিজের Banglish লেখা সিলেক্ট করে শুধু **"Copy"** চাপবেন।
- সাথে সাথে আপনার স্ক্রিনের ওপর আমাদের AI-এর ডায়ালগ ভেসে উঠবে।
- **"Copy Reply"**-এ ট্যাপ করে চ্যাট বক্সে সরাসরি **Paste** করে কাস্টমারকে পাঠিয়ে দিন!

