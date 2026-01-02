/**
 * ============================================================================
 * 🎤 نظام الصوت الذكي للمستخدمين الأميين – Voice Core System
 * ============================================================================
 * الإصدار: v1.0 Stable
 * السنة: 2025
 * الهدف: إدخال الديون بالصوت العربي فقط
 * ============================================================================
 */

/* =========================
   الإعدادات العامة
========================= */
const VOICE_CORE_CONFIG = {
  LANGUAGE: 'ar-SA',
  DUPLICATE_WINDOW: 4000,
  CLICK_COOLDOWN: 1000,
  AUTO_SAVE: true
};

/* =========================
   أدوات مساعدة
========================= */
function sanitizeInput(text) {
  return text.replace(/[<>{}[\]]/g, '').trim();
}

/* =========================
   تحديد الوقت (صباح / مساء)
========================= */
function getTimeOfDay() {
  const hour = new Date().getHours();
  return hour < 12 ? 'صباحاً' : 'مساءً';
}

/* =========================
   منع التكرار
========================= */
let lastText = '';
let lastTime = 0;

function isDuplicate(text) {
  const now = Date.now();
  const duplicate =
    text === lastText &&
    now - lastTime < VOICE_CORE_CONFIG.DUPLICATE_WINDOW;

  lastText = text;
  lastTime = now;
  return duplicate;
}

/* =========================
   استخراج المبلغ (الكود الناجح)
   ⚠️ لا نغير المنطق العامل
========================= */
function extractAmount(text) {
  if (typeof text !== 'string') return 0;

  // أرقام إنجليزية مباشرة
  const directNumber = text.match(/\d+/);
  if (directNumber) return parseInt(directNumber[0], 10);

  const map = {
    صفر: 0,
    واحد: 1,
    اثنين: 2,
    اثنان: 2,
    ثلاثة: 3,
    أربعة: 4,
    خمسة: 5,
    ستة: 6,
    سبعة: 7,
    ثمانية: 8,
    تسعة: 9,
    عشرة: 10,
    مائة: 100,
    مئة: 100,
    ألف: 1000,
    ألفين: 2000
  };

  let total = 0;
  let current = 0;

  text.split(' ').forEach(word => {
    if (map[word] !== undefined) {
      if (map[word] === 100 || map[word] === 1000) {
        current = current === 0 ? 1 : current;
        total += current * map[word];
        current = 0;
      } else {
        current += map[word];
      }
    }
  });

  return total + current;
}

/* =========================
   تحليل الأمر الصوتي
========================= */
function parseCommand(text) {
  text = sanitizeInput(text);

  if (!text.includes('دين')) return null;

  const parts = text.split('دين');
  const name = parts[0].trim();
  const amount = extractAmount(parts[1]);

  if (!name || amount === 0) return null;

  return {
    name,
    amount,
    date: new Date().toISOString().slice(0, 10),
    time: getTimeOfDay()
  };
}

/* =========================
   تعبئة النموذج
========================= */
function fillForm(data) {
  const fields = {
    debtName: data.name,
    debtAmount: data.amount,
    debtDate: data.date,
    debtTime: data.time
  };

  for (const id in fields) {
    const el = document.getElementById(id);
    if (!el) continue;

    el.value = fields[id];
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/* =========================
   حفظ البيانات
========================= */
function saveData() {
  setTimeout(() => {
    const saveBtn = document.getElementById('saveDebt');
    if (saveBtn) {
      saveBtn.click(); // ⬅️ هذا هو الحل
    } else {
      console.error('❌ زر الحفظ غير موجود');
    }
  }, 300);
}

/* =========================
   المعالج الرئيسي
========================= */
function handleSpeech(text) {
  console.log('🎤 VOICE:', text);

  if (isDuplicate(text)) return;

  const parsed = parseCommand(text);
  if (!parsed) {
    alert('❌ لم يتم فهم الأمر');
    return;
  }

  fillForm(parsed);

  const confirmSave = confirm(
    `تأكيد الدين:\n\n` +
    `الاسم: ${parsed.name}\n` +
    `المبلغ: ${parsed.amount}\n` +
    `الوقت: ${parsed.time}\n\n` +
    `هل تريد الحفظ؟`
  );

  if (confirmSave && VOICE_CORE_CONFIG.AUTO_SAVE) {
    saveData();
  }
}

/* =========================
   تهيئة التعرف على الصوت
========================= */
let recognition;

function initVoice() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert('❌ المتصفح لا يدعم التعرف على الصوت');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = VOICE_CORE_CONFIG.LANGUAGE;
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = e => {
    const text = e.results[0][0].transcript;
    handleSpeech(text);
  };

  recognition.onerror = e => {
    console.warn('Voice error:', e.error);
  };
}

/* =========================
   زر التحكم
========================= */
function toggleListening() {
  if (!recognition) initVoice();
  recognition.start();
}

/* =========================
   إنشاء زر الصوت
========================= */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.createElement('button');
  btn.textContent = '🎤';
  btn.style.cssText =
    'position:fixed;bottom:20px;right:20px;font-size:24px;padding:15px;border-radius:50%;z-index:9999;';
  btn.onclick = toggleListening;
  document.body.appendChild(btn);
});