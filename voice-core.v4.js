/**
 * ============================================================================
 * 🎤 VOICE SYSTEM v5.3 - النسخة الكاملة مع نظام الحذف الفعلي
 * نظام صوتي عربي متكامل لإدارة الديون يجمع أفضل مميزات v3 و v4
 * ============================================================================
 */

'use strict';

// ============================================================================
// 1) CONFIGURATION - الإعدادات الكاملة
// ============================================================================
const VOICE_CONFIG = {
    LANGUAGE: 'ar-SA',
    SPEECH_RATE: 0.9,
    BUFFER_DELAY: 800,
    DUPLICATE_WINDOW: 4000,
    SIMILARITY_THRESHOLD: 0.75,
    ENABLE_TTS: true,
    AUTO_CONFIRM: false,
    UI_THEME: 'modern'
};
// في بداية الملف، أضف التحقق من توفر الأنظمة المنفصلة
if (window.tts) {
    console.log('✅ نظام التحدث المنفصل متاح');
}

if (window.voiceNotify) {
    console.log('✅ نظام الإشعارات المنفصل متاح');
}

// ثم في دالة speak داخل VoiceSystemV5:
/**
 * 🗣️ التحدث باستخدام نظام التحدث المنفصل
 */
 
 
function speak(text) {
    if (!VOICE_CONFIG.ENABLE_TTS) {
        console.log('🗣️ (بدون صوت):', text);
        return;
    }
    
    // استخدام نظام التحدث المنفصل إذا كان متاحاً
    if (window.tts && typeof window.tts.speak === 'function') {
        try {
            window.tts.speak(text);
        } catch (error) {
            console.error('❌ خطأ في نظام التحدث المنفصل:', error);
            this.fallbackSpeak(text);
        }
    } else {
        this.fallbackSpeak(text);
    }

}
/**
 * النسخة الاحتياطية للتحدث
 */
 function fallbackSpeak(text) {
    try {
        if (!window.speechSynthesis) return;
        
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = VOICE_CONFIG.LANGUAGE;
        utterance.rate = VOICE_CONFIG.SPEECH_RATE;
        utterance.volume = 1;
        
        const voices = window.speechSynthesis.getVoices();
        const arabicVoice = voices.find(v => v.lang.startsWith('ar'));
        if (arabicVoice) utterance.voice = arabicVoice;
        
        window.speechSynthesis.speak(utterance);
        
    } catch (error) {
        console.error('❌ خطأ في التحدث الاحتياطي:', error);
    }
}

/**
 * 💬 عرض إشعار باستخدام نظام الإشعارات المنفصل
 */
function showNotification(text, type = 'info') {
    console.log(`💬 ${type}: ${text}`);
    
    // استخدام نظام الإشعارات المنفصل إذا كان متاحاً
    if (window.voiceNotify && typeof window.voiceNotify.quick === 'function') {
        // تحديد مدة العرض حسب النوع
        let duration = 'normal';
        if (type === 'info' && (text.includes('استعلام') || text.includes('باقي') || text.includes('ديون'))) {
            duration = 'long';
        } else if (type === 'query') {
            duration = 'long';
        }
        
        window.voiceNotify.quick(text, type, duration);
    } else {
        // النسخة الاحتياطية
        this.fallbackNotification(text, type);
    }
}
// ============================================================================
// 2) CORE MODULES - الوحدات الأساسية الكاملة
// ============================================================================

/**
 * 🧠 SPEECH BUFFER PRO - المخزن المؤقت الذكي المحسن
 */
class SpeechBufferPro {
    constructor() {
        this.buffer = [];
        this.timer = null;
        this.delay = VOICE_CONFIG.BUFFER_DELAY;
        this.maxSize = 5;
    }
    
    push(text) {
        console.log('📥 إضافة للنص:', text);
        
        // إزالة العناصر القديمة إذا تجاوز الحد
        if (this.buffer.length >= this.maxSize) {
            this.buffer.shift();
        }
        
        this.buffer.push(text);
        
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            const finalText = this.flush();
            if (finalText && finalText.trim().length > 0) {
                console.log('📤 نص مكتمل:', finalText);
                if (window.voiceSystem) {
                    window.voiceSystem.processFinalSpeech(finalText);
                }
            }
        }, this.delay);
    }
    
    flush() {
        const fullText = this.buffer.join(' ').trim();
        this.buffer = [];
        return fullText;
    }
    
    reset() {
        this.buffer = [];
        clearTimeout(this.timer);
    }
}

/**
 * 🔄 DUPLICATE GUARD PRO - حارس التكرار الذكي
 */
class DuplicateGuardPro {
    constructor() {
        this.lastCommands = new Map();
        this.window = VOICE_CONFIG.DUPLICATE_WINDOW;
    }
    
    isDuplicate(text, command = null) {
        const now = Date.now();
        
        // تنظيف الذاكرة القديمة
        this.cleanOldEntries(now);
        
        // حساب تشابه النصوص
        for (const [key, entry] of this.lastCommands.entries()) {
            const similarity = this.calculateSimilarity(entry.text, text);
            if (similarity > VOICE_CONFIG.SIMILARITY_THRESHOLD) {
                if (now - entry.timestamp < this.window) {
                    console.log(`⚠️ كلام مكرر (تشابه ${similarity.toFixed(2)})`);
                    return true;
                }
            }
        }
        
        // إضافة الجديدة
        const commandKey = command ? 
            `${command.type}_${command.name}_${command.amount}` : 
            `text_${text.substring(0, 20)}`;
            
        this.lastCommands.set(commandKey, {
            text: text,
            command: command,
            timestamp: now
        });
        
        return false;
    }
    
    cleanOldEntries(now) {
        for (const [key, entry] of this.lastCommands.entries()) {
            if (now - entry.timestamp > this.window) {
                this.lastCommands.delete(key);
            }
        }
    }
    
    calculateSimilarity(text1, text2) {
        const normalized1 = text1.toLowerCase().replace(/[أإآء]/g, 'ا');
        const normalized2 = text2.toLowerCase().replace(/[أإآء]/g, 'ا');
        
        const words1 = new Set(normalized1.split(/\s+/));
        const words2 = new Set(normalized2.split(/\s+/));
        
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        
        return union.size === 0 ? 0 : intersection.size / union.size;
    }
    
    clear() {
        this.lastCommands.clear();
    }
}

/**
 * 👤 NAME CORRECTOR PRO - مصحح الأسماء المتقدم
 */
class NameCorrectorPro {
    constructor() {
        this.knownNames = [
            'علي', 'محمد', 'أحمد', 'محمود', 'خالد',
            'سعيد', 'عبدالله', 'عمر', 'يوسف', 'حسن',
            'سالم', 'فهد', 'ناصر', 'بدر', 'راشد',
            'طارق', 'ماجد', 'وليد', 'هشام', 'غازي'
        ];
        
        this.variations = {
            'علي': ['علي', 'علـي', 'عل ي', 'على'],
            'محمد': ['محمد', 'محم د', 'م حمد'],
            'أحمد': ['أحمد', 'احمد', 'اح م د']
        };
    }
    
    correct(name) {
        if (!name || name.trim() === '') return 'غير معروف';
        
        // تنظيف الاسم أولاً
        let cleanedName = this.cleanName(name);
        
        // البحث عن تطابق تام
        for (const knownName of this.knownNames) {
            if (cleanedName === knownName) {
                return knownName;
            }
        }
        
        // البحث عن تشابه
        for (const knownName of this.knownNames) {
            const similarity = this.calculateSimilarity(cleanedName, knownName);
            if (similarity > 0.6) {
                console.log(`✅ تصحيح الاسم: "${name}" → "${knownName}" (تشابه ${similarity.toFixed(2)})`);
                return knownName;
            }
        }
        
        // التحقق من المتغيرات
        for (const [correctName, variations] of Object.entries(this.variations)) {
            if (variations.includes(cleanedName)) {
                console.log(`✅ تصحيح متغير: "${name}" → "${correctName}"`);
                return correctName;
            }
        }
        
        return cleanedName || 'غير معروف';
    }
    
    cleanName(name) {
        const stopWords = [
            'ريال', 'ر', 'دولار', 'دينار', 'يورو',
            'دين', 'ديون', 'سدد', 'دفع', 'أدفع',
            'عليه', 'له', 'لديه', 'عند', 'عندي',
            'كم', 'باقي', 'احذف', 'امسح', 'آخر',
            'أخ', 'أخت', 'ابن', 'ابو', 'والد'
        ];
        
        let cleaned = name.trim();
        
        // إزالة الكلمات الزائدة
        stopWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            cleaned = cleaned.replace(regex, ' ');
        });
        
        // إزالة الأرقام والرموز
        cleaned = cleaned.replace(/[\d.,!?؛،]/g, '');
        
        // إزالة المسافات الزائدة
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        // تقصير إذا كان طويلاً
        if (cleaned.length > 20) {
            cleaned = cleaned.substring(0, 20).trim();
        }
        
        return cleaned;
    }
    
    calculateSimilarity(name1, name2) {
        const set1 = new Set(name1.toLowerCase());
        const set2 = new Set(name2.toLowerCase());
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        return union.size === 0 ? 0 : intersection.size / union.size;
    }
}

/**
 * 💰 AMOUNT EXTRACTOR PRO - مستخرج المبالغ الذكي
 */
class AmountExtractorPro {
    constructor() {
        // الحالات الخاصة المركبة
        this.specialCases = {
            'ثلاثة ألف': 3000, 'ثلاثه الف': 3000, 'ثلاثةالف': 3000,
            'ألفين': 2000, 'الفين': 2000,
            'أربعة ألف': 4000, 'اربعة الف': 4000,
            'خمسة ألف': 5000, 'خمسه الف': 5000,
            'ستة ألف': 6000, 'سته الف': 6000,
            'سبعة ألف': 7000, 'سبعه الف': 7000,
            'ثمانية ألف': 8000, 'ثمانيه الف': 8000,
            'تسعة ألف': 9000, 'تسعه الف': 9000,
            'عشرة ألف': 10000, 'عشره الف': 10000,
            'ثلاثمائة': 300, 'اربعمائة': 400, 'خمسمائة': 500
        };
        
        // الأرقام المفردة
        this.numbers = {
            'واحد': 1, 'احد': 1, 'واحدة': 1, 'واحده': 1,
            'اثنين': 2, 'اتنين': 2, 'اثنان': 2, 'اتنين': 2,
            'ثلاثة': 3, 'ثلاثه': 3, 'ثلاث': 3,
            'أربعة': 4, 'اربعة': 4, 'اربع': 4,
            'خمسة': 5, 'خمسه': 5, 'خمس': 5,
            'ستة': 6, 'سته': 6, 'ست': 6,
            'سبعة': 7, 'سبعه': 7, 'سبع': 7,
            'ثمانية': 8, 'ثمانيه': 8, 'ثماني': 8,
            'تسعة': 9, 'تسعه': 9, 'تسع': 9,
            'عشرة': 10, 'عشره': 10, 'عشر': 10,
            'عشرين': 20, 'ثلاثين': 30, 'اربعين': 40,
            'خمسين': 50, 'ستين': 60, 'سبعين': 70,
            'ثمانين': 80, 'تسعين': 90,
            'مئة': 100, 'مائة': 100, 'ميه': 100,
            'مئتين': 200, 'مائتين': 200
        };
        
        this.multipliers = {
            'ألف': 1000, 'الف': 1000, 'آلاف': 1000,
            'مليون': 1000000, 'ملايين': 1000000
        };
    }
    
    extract(text) {
        if (!text || typeof text !== 'string') return 0;
        
        const normalized = this.normalizeText(text);
        console.log('💰 استخراج المبلغ من:', normalized);
        
        // 1. الحالات الخاصة أولاً
        for (const [phrase, amount] of Object.entries(this.specialCases)) {
            if (normalized.includes(phrase.toLowerCase())) {
                console.log(`✅ حالة خاصة: "${phrase}" → ${amount}`);
                return amount;
            }
        }
        
        // 2. أرقام إنجليزية
        const englishMatch = normalized.match(/(\d+)/);
        if (englishMatch) {
            let amount = parseInt(englishMatch[1], 10);
            
            // التحقق من المضاعفات
            for (const [mult, factor] of Object.entries(this.multipliers)) {
                if (normalized.includes(mult.toLowerCase()) && amount > 0) {
                    const result = amount * factor;
                    console.log(`✅ ${amount} × ${mult} → ${result}`);
                    return result;
                }
            }
            
            console.log(`✅ رقم إنجليزي: ${amount}`);
            return amount;
        }
        
        // 3. تحليل عربي معقد
        let total = 0;
        let current = 0;
        const words = normalized.split(' ');
        
        for (const word of words) {
            if (this.numbers[word] !== undefined) {
                const value = this.numbers[word];
                
                if (value >= 100) {
                    if (current === 0) current = 1;
                    total += current * value;
                    current = 0;
                } else {
                    current += value;
                }
            } else if (this.multipliers[word] !== undefined) {
                if (current === 0) current = 1;
                total += current * this.multipliers[word];
                current = 0;
            }
        }
        
        total += current;
        
        if (total > 0) {
            console.log(`✅ مبلغ عربي: ${total}`);
            return total;
        }
        
        // 4. محاولة البحث عن "مئة" أو "مائة" منفردة
        if (normalized.includes('مئة') || normalized.includes('مائة') || normalized.includes('ميه')) {
            return 100;
        }
        
        console.log('❌ لم أجد مبلغاً');
        return 0;
    }
    
    normalizeText(text) {
        return text
            .toLowerCase()
            .replace(/[أإآء]/g, 'ا')
            .replace(/[ة]/g, 'ه')
            .replace(/[ى]/g, 'ي')
            .replace(/[.,!?؛،]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
}

/**
 * 🧩 COMMAND PARSER PRO - محلل الأوامر المتقدم
 */
class CommandParserPro {
    constructor() {
        this.nameCorrector = new NameCorrectorPro();
        this.amountExtractor = new AmountExtractorPro();
        this.context = {
            lastPerson: '',
            lastAmount: 0,
            lastCommand: '',
            lastTime: Date.now()
        };
    }
    
    parse(text) {
        console.log('🧩 تحليل الأمر:', text);
        
        const normalized = this.normalizeText(text);
        let command = null;
        
        // المحاولة مع كل نوع أمر
        command = this.parseAddDebt(normalized, text) ||
                  this.parsePayment(normalized, text) ||
                  this.parseQuery(normalized, text) ||
                  this.parseDelete(normalized, text) ||
                  this.parseQuickAdd(normalized, text);
        
        // إذا لم نجد أمراً، نعتبره إضافة سريعة
        if (!command) {
            command = this.attemptQuickCommand(normalized, text);
        }
        
        // تحديث السياق إذا كان الأمر صحيحاً
        if (command && command.valid) {
            this.updateContext(command);
        }
        
        return command || { 
            type: 'unknown', 
            originalText: text, 
            valid: false,
            suggestion: 'جرّب: "محمد دين ثلاثة ألف" أو "سدد علي خمسمائة"'
        };
    }
    
    parseAddDebt(normalized, original) {
        const patterns = [
            // "محمد دين ثلاثة ألف"
            /^(.*?)\s+(?:دين|ديون|عليه|قرض|سلف)\s+(.*)$/i,
            // "دين محمد ثلاثة ألف"
            /^(?:دين|ديون|عليه|قرض)\s+(.*?)\s+(.*)$/i,
            // "ثلاثة ألف على محمد"
            /^(.*)\s+(?:على|عليه|ل|لدى)\s+(.*)$/i,
            // "لمحمد ألف ريال"
            /^ل(.*?)\s+(.*)$/i
        ];
        
        for (const pattern of patterns) {
            const match = normalized.match(pattern);
            if (match) {
                let namePart, amountPart;
                
                if (pattern.source.includes('على')) {
                    amountPart = match[1];
                    namePart = match[2];
                } else if (normalized.startsWith('دين') || normalized.startsWith('عليه')) {
                    namePart = match[1];
                    amountPart = match[2];
                } else if (normalized.startsWith('ل')) {
                    namePart = match[1];
                    amountPart = match[2];
                } else {
                    namePart = match[1];
                    amountPart = match[2];
                }
                
                const name = this.nameCorrector.correct(namePart);
                const amount = this.amountExtractor.extract(amountPart);
                
                if (name && name !== 'غير معروف' && amount > 0) {
                    return {
                        type: 'add',
                        name: name,
                        amount: amount,
                        originalText: original,
                        valid: true,
                        confidence: 0.9
                    };
                }
            }
        }
        
        return null;
    }
    
    parsePayment(normalized, original) {
        const patterns = [
            // "سدد محمد ألف"
            /^(?:سدد|دفع|أدفع|أعطيت)\s+(.*?)\s+(.*)$/i,
            // "محمد سدد ألف"
            /^(.*?)\s+(?:سدد|دفع|أعطى)\s+(.*)$/i,
            // "سدد ألف" (باستخدام السياق)
            /^(?:سدد|دفع)\s+(.*)$/i
        ];
        
        for (const pattern of patterns) {
            const match = normalized.match(pattern);
            if (match) {
                let name, amount;
                
                if (match[2]) {
                    name = this.nameCorrector.correct(match[1]);
                    amount = this.amountExtractor.extract(match[2]);
                } else {
                    amount = this.amountExtractor.extract(match[1]);
                    name = this.context.lastPerson || 'غير معروف';
                }
                
                if (amount > 0) {
                    return {
                        type: 'pay',
                        name: name,
                        amount: amount,
                        originalText: original,
                        valid: true,
                        confidence: 0.8
                    };
                }
            }
        }
        
        return null;
    }
    
    parseQuery(normalized, original) {
        const patterns = [
            // "كم باقي على محمد"
            /^(?:كم|كيف)\s+(?:باقي|وضع|تبقى|متبقى)\s+(?:على|عليه|ل)?\s*(.*)$/i,
            // "محمد كم باقي"
            /^(.*?)\s+(?:كم|كيف)\s+(?:باقي|عليه|له)$/i,
            // "باقي محمد"
            /^(?:باقي|متبقي|وضع)\s+(.*)$/i,
            // "ديون محمد"
            /^(?:ديون|دين)\s+(.*)$/i
        ];
        
        for (const pattern of patterns) {
            const match = normalized.match(pattern);
            if (match) {
                const name = this.nameCorrector.correct(match[1]);
                if (name && name !== 'غير معروف') {
                    return {
                        type: 'query',
                        name: name,
                        originalText: original,
                        valid: true,
                        confidence: 0.9
                    };
                }
            }
        }
        
        return null;
    }
    
    parseDelete(normalized, original) {
        const patterns = [
            // "احذف دين محمد"
            /^(?:احذف|امسح|شطب|ألغ|ازل)\s+(?:دين|ديون|ديونه|ديوني)\s+(.*)$/i,
            // "احذف محمد"
            /^(?:احذف|امسح|شطب|ألغ|ازل)\s+(.*)$/i,
            // "محمد احذف"
            /^(.*?)\s+(?:احذف|امسح|شطب)$/i,
            // "ازل دين محمد"
            /^(?:ازل|أزل)\s+(?:دين)?\s*(.*)$/i
        ];
        
        for (const pattern of patterns) {
            const match = normalized.match(pattern);
            if (match) {
                let namePart;
                
                if (pattern.source.includes('ازل') || pattern.source.includes('أزل')) {
                    namePart = match[1];
                } else if (match[2]) {
                    namePart = match[1];
                } else {
                    namePart = match[1];
                }
                
                const name = this.nameCorrector.correct(namePart);
                if (name && name !== 'غير معروف') {
                    return {
                        type: 'delete',
                        name: name,
                        originalText: original,
                        valid: true,
                        confidence: 0.9
                    };
                }
            }
        }
        
        return null;
    }
    
    parseQuickAdd(normalized, original) {
        // نمط بسيط: "محمد ألف"
        const words = normalized.split(' ');
        if (words.length === 2) {
            const name = this.nameCorrector.correct(words[0]);
            const amount = this.amountExtractor.extract(words[1]);
            
            if (name && name !== 'غير معروف' && amount > 0) {
                return {
                    type: 'add',
                    name: name,
                    amount: amount,
                    originalText: original,
                    valid: true,
                    confidence: 0.6
                };
            }
        }
        
        return null;
    }
    
    attemptQuickCommand(normalized, original) {
        // محاولة استخراج الاسم والمبلغ بشكل عام
        const amount = this.amountExtractor.extract(normalized);
        if (amount > 0) {
            // البحث عن اسم في النص
            const possibleName = this.extractPossibleName(normalized);
            const name = this.nameCorrector.correct(possibleName);
            
            if (name && name !== 'غير معروف') {
                return {
                    type: 'add',
                    name: name,
                    amount: amount,
                    originalText: original,
                    valid: true,
                    confidence: 0.5
                };
            }
        }
        
        return null;
    }
    
    extractPossibleName(text) {
        // إزالة الكلمات المرتبطة بالمبالغ
        const amountWords = [
            'ريال', 'ر', 'دين', 'ديون', 'سدد', 'دفع',
            'ألف', 'الف', 'مئة', 'مائة', 'ميه'
        ];
        
        let cleaned = text;
        amountWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            cleaned = cleaned.replace(regex, '');
        });
        
        // أخذ أول كلمة غير رقمية
        const words = cleaned.split(' ').filter(w => w && !/\d/.test(w));
        return words[0] || '';
    }
    
    normalizeText(text) {
        return text
            .replace(/ريال/gi, '')
            .replace(/ر\b/gi, '')
            .replace(/[.,!?؛،]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    updateContext(command) {
        this.context.lastPerson = command.name;
        if (command.amount) this.context.lastAmount = command.amount;
        this.context.lastCommand = command.type;
        this.context.lastTime = Date.now();
    }
}

// ============================================================================
// 3) DEBT API COMPLETE - واجهة الديون الكاملة مع الجسر المحسن
// ============================================================================

/**
 * 🔗 DEBT API - التكامل الحقيقي مع التطبيق
 */
class DebtAPI {
    /**
     * إضافة دين جديد - النسخة الكاملة
     */
    static add(data) {
        console.log('💾 DebtAPI.add:', data);
        
        try {
            // 1. الانتقال لصفحة الديون
            this.goToDebtsPage();
            
            // 2. تعبئة النموذج بعد تأخير
            setTimeout(() => {
                this.fillDebtForm(data);
                
                // 3. الحفظ بعد تأخير إضافي
                setTimeout(() => {
                    this.executeSave(data);
                }, 500);
            }, 800);
            
            return true;
        } catch (error) {
            console.error('❌ خطأ في DebtAPI.add:', error);
            return false;
        }
    }
    
    /**
     * تسديد دفعة - النسخة الكاملة
     */
    static pay(data) {
        console.log('💸 DebtAPI.pay:', data);
        
        try {
            // 1. الانتقال لصفحة الديون
            this.goToDebtsPage();
            
            // 2. التأخير لتحميل الصفحة
            setTimeout(() => {
                // 3. البحث عن المتدين في القائمة
                const debtorSelect = document.getElementById('debtorSelect');
                if (!debtorSelect) {
                    this.showMessage('لم أجد قائمة المتدينين', 'error');
                    return;
                }
                
                let found = false;
                const options = Array.from(debtorSelect.options);
                
                for (let i = 0; i < options.length; i++) {
                    const optionText = options[i].textContent;
                    if (optionText.includes(data.name)) {
                        debtorSelect.selectedIndex = i;
                        debtorSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        found = true;
                        console.log(`✅ اختيار المتدين: ${data.name}`);
                        break;
                    }
                }
                
                if (!found) {
                    this.showMessage(`لم أجد ${data.name} في القائمة`, 'error');
                    return;
                }
                
                // 4. تعبئة مبلغ التسديد
                const paymentAmount = document.getElementById('paymentAmount');
                if (paymentAmount) {
                    paymentAmount.value = data.amount;
                    paymentAmount.dispatchEvent(new Event('input', { bubbles: true }));
                    paymentAmount.dispatchEvent(new Event('change', { bubbles: true }));
                }
                
                // 5. اختيار التاريخ الحالي
                const paymentDate = document.getElementById('paymentDate');
                if (paymentDate) {
                    paymentDate.value = new Date().toISOString().split('T')[0];
                    paymentDate.dispatchEvent(new Event('change', { bubbles: true }));
                }
                
                // 6. النقر على زر التسديد
                setTimeout(() => {
                    const savePaymentBtn = document.getElementById('savePayment');
                    if (savePaymentBtn) {
                        savePaymentBtn.click();
                        this.showMessage(`✅ تم تسديد ${data.amount} ريال لـ ${data.name}`, 'success');
                    }
                }, 300);
                
            }, 1000);
            
            return true;
        } catch (error) {
            console.error('❌ خطأ في DebtAPI.pay:', error);
            return false;
        }
    }
    
    /**
     * استعلام عن دين - النسخة المحسنة مع الجسر
     */
    static query(data) {
        console.log('🔍 DebtAPI.query:', data);
        
        try {
            // === استخدام جسر النظام الصوتي أولاً (الأفضل) ===
            if (window.voiceSystemBridge) {
                console.log('✅ استخدام voiceSystemBridge');
                return this.queryFromVoiceBridge(data);
            }
            
            // === الطريقة 1: البحث في `window.debts` إذا كان متاحاً ===
            if (window.debts && Array.isArray(window.debts)) {
                console.log('✅ استخدام window.debts');
                return this.queryFromDebtsArray(data);
            }
            
            // === الطريقة 2: البحث في localStorage ===
            const user = localStorage.getItem('dq_current_user');
            if (user) {
                console.log('✅ البحث في localStorage');
                return this.queryFromLocalStorage(data, user);
            }
            
            // === الطريقة 3: البحث في الواجهة المرئية ===
            console.log('✅ البحث في الواجهة المرئية');
            return this.queryFromUI(data);
            
        } catch (error) {
            console.error('❌ خطأ في الاستعلام:', error);
            return `حدث خطأ في البحث عن ديون ${data.name}`;
        }
    }
    
    /**
     * البحث عبر جسر النظام الصوتي
     */
    static queryFromVoiceBridge(data) {
        const result = window.voiceSystemBridge.queryDebtor(data.name);
        
        if (!result.found) {
            return result.message;
        }
        
        let response = `📊 ${result.name}:\n`;
        response += `• عدد الديون: ${result.debtsCount}\n`;
        response += `• الإجمالي: ${result.formatted.total}\n`;
        response += `• المسدد: ${result.formatted.paid}\n`;
        response += `• المتبقي: ${result.formatted.remaining}\n`;
        response += `• نسبة السداد: ${result.formatted.percentage}\n`;
        
        // حالة الدين
        if (result.remaining === 0) {
            response += `• ✅ الحالة: مسدد بالكامل`;
        } else if (result.paid === 0) {
            response += `• ⚠️ الحالة: لم يبدأ السداد`;
        } else if (result.percentage >= 70) {
            response += `• 🟢 الحالة: متقدم في السداد`;
        } else if (result.percentage >= 30) {
            response += `• 🟡 الحالة: متوسط السداد`;
        } else {
            response += `• 🔴 الحالة: متأخر في السداد`;
        }
        
        // إضافة التفاصيل إذا كانت قليلة
        if (result.debtsCount <= 5 && result.debts) {
            response += '\n\n📋 التفاصيل:';
            result.debts.forEach((debt, idx) => {
                const debtRemaining = (debt.totalAmount || 0) - (debt.paidAmount || 0);
                response += `\n${idx + 1}. ${debt.date || 'بدون تاريخ'} - ${(debt.totalAmount || 0).toLocaleString()} ريال`;
                
                if (debtRemaining > 0) {
                    response += ` (باقي: ${debtRemaining.toLocaleString()} ريال)`;
                } else {
                    response += ' ✅ مسدد';
                }
                
                // إضافة الوقت إذا موجود
                if (debt.timeOfDay) {
                    response += ` - ${debt.timeOfDay}`;
                }
            });
        }
        
        return response;
    }
    
    /**
     * البحث في مصفوفة الديون العالمية
     */
    static queryFromDebtsArray(data) {
        const debtorDebts = window.debts ? 
            window.debts.filter(debt => 
                debt.name && debt.name.toLowerCase().includes(data.name.toLowerCase())
            ) : [];
        
        if (debtorDebts.length === 0) {
            return `لا توجد ديون مسجلة لـ ${data.name}`;
        }
        
        return this.formatDebtResult(data.name, debtorDebts);
    }
    
    /**
     * البحث في localStorage
     */
    static queryFromLocalStorage(data, user) {
        const debtsKey = `dq_debts_${user}`;
        const debtsJSON = localStorage.getItem(debtsKey);
        
        if (!debtsJSON) {
            return `لا توجد بيانات محفوظة لـ ${data.name}`;
        }
        
        try {
            const debts = JSON.parse(debtsJSON);
            if (!Array.isArray(debts)) {
                return `بيانات غير صالحة لـ ${data.name}`;
            }
            
            const debtorDebts = debts.filter(debt => 
                debt.name && debt.name.toLowerCase().includes(data.name.toLowerCase())
            );
            
            if (debtorDebts.length === 0) {
                return `لا توجد ديون في السجلات لـ ${data.name}`;
            }
            
            return this.formatDebtResult(data.name, debtorDebts);
            
        } catch (error) {
            console.error('❌ خطأ في تحليل localStorage:', error);
            return `تعذر قراءة سجلات ${data.name}`;
        }
    }
    
    /**
     * البحث في الواجهة المرئية
     */
    static queryFromUI(data) {
        // الانتقال لصفحة الديون أولاً
        this.goToDebtsPage();
        
        // تأخير لتحميل الصفحة
        setTimeout(() => {
            let result = '';
            const foundDebts = [];
            
            // البحث في عناصر الديون المعروضة
            const debtElements = document.querySelectorAll('.debt-item, .list-item, [class*="debt"], tr');
            
            debtElements.forEach(element => {
                const text = element.textContent.toLowerCase();
                if (text.includes(data.name.toLowerCase())) {
                    foundDebts.push({
                        text: element.textContent.trim(),
                        element: element
                    });
                }
            });
            
            if (foundDebts.length === 0) {
                result = `لا توجد ديون معروضة لـ ${data.name}`;
            } else {
                result = `وجدت ${foundDebts.length} دين لـ ${data.name}:\n\n`;
                foundDebts.forEach((debt, idx) => {
                    // استخراج المعلومات من النص
                    const amountMatch = debt.text.match(/(\d+(?:,\d+)*)/);
                    const amount = amountMatch ? amountMatch[1] : 'غير محدد';
                    
                    result += `${idx + 1}. ${debt.text.substring(0, 50)}...\n`;
                    result += `   💰 المبلغ التقريبي: ${amount}\n\n`;
                });
            }
            
            // إظهار النتيجة
            if (window.voiceSystem) {
                window.voiceSystem.speak(result.replace(/\n/g, ' ').substring(0, 100));
                window.voiceSystem.showNotification(result, 'info');
            }
            
        }, 1000);
        
        return `جارِ البحث عن ديون ${data.name}...`;
    }
    
    /**
     * حذف ديون متدين - النسخة الفعلية الكاملة
     */
    static delete(data) {
        console.log('🗑️ DebtAPI.delete:', data);
        
        try {
            // 1. التأكد من وجود الديون
            if (!window.voiceSystemBridge) {
                return this.manualDelete(data.name);
            }
            
            // 2. استخدام جسر النظام الصوتي للحذف الفعلي
            console.log('🔗 استخدام voiceSystemBridge.deleteDebtorDebts');
            const result = window.voiceSystemBridge.deleteDebtorDebts(data.name);
            
            if (result && result.success) {
                this.showMessage(result.message || `✅ تم حذف ديون ${data.name}`, 'success');
                return result;
            } else {
                // 3. إذا فشل جسر الصوت، حاول الطريقة اليدوية
                return this.manualDelete(data.name);
            }
            
        } catch (error) {
            console.error('❌ خطأ في DebtAPI.delete:', error);
            return this.manualDelete(data.name);
        }
    }
    
    /**
     * حذف يدوي عند فشل الجسر
     */
    static manualDelete(name) {
        console.log('🔧 حذف يدوي لـ:', name);
        
        // 1. الانتقال لصفحة الديون
        this.goToDebtsPage();
        
        // 2. الانتظار لتحميل الصفحة
        return new Promise((resolve) => {
            setTimeout(() => {
                try {
                    // 3. البحث عن المتدين في سجل البحث
                    const searchInput = document.getElementById('searchDebts');
                    if (searchInput) {
                        searchInput.value = name;
                        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                        
                        // 4. النقر على بحث للعثور على الديون
                        const searchBtn = document.getElementById('quickSearchBtn');
                        if (searchBtn) {
                            searchBtn.click();
                            
                            // 5. الانتظار ثم حذف
                            setTimeout(() => {
                                this.executeManualDeletion(name);
                                resolve({
                                    success: true,
                                    message: `✅ تم بدء عملية حذف ديون ${name} يدوياً`
                                });
                            }, 1000);
                        } else {
                            resolve({
                                success: false,
                                message: `❌ لم أتمكن من إيجاد زر البحث`
                            });
                        }
                    } else {
                        resolve({
                            success: false,
                            message: `❌ لم أجد حقل البحث`
                        });
                    }
                } catch (error) {
                    console.error('❌ خطأ في الحذف اليدوي:', error);
                    resolve({
                        success: false,
                        message: `❌ حدث خطأ في الحذف اليدوي: ${error.message}`
                    });
                }
            }, 800);
        });
    }
    
    /**
     * تنفيذ الحذف اليدوي
     */
    static executeManualDeletion(name) {
        try {
            console.log('🔧 تنفيذ الحذف اليدوي لـ:', name);
            
            // البحث عن جميع أزرار الحذف في الصفحة
            const deleteButtons = document.querySelectorAll('button');
            let foundDeleteButton = false;
            
            for (const button of deleteButtons) {
                const buttonText = button.textContent.toLowerCase();
                const buttonId = button.id.toLowerCase();
                
                // البحث عن أزرار حذف
                if (buttonText.includes('حذف') || 
                    buttonText.includes('احذف') || 
                    buttonText.includes('امسح') ||
                    buttonId.includes('delete') ||
                    button.classList.contains('delete-debt') ||
                    button.classList.contains('delete-debt-group')) {
                    
                    console.log('✅ وجدت زر حذف:', button.textContent);
                    button.click();
                    foundDeleteButton = true;
                    
                    // تأكيد الحذف في نافذة التأكيد
                    setTimeout(() => {
                        this.confirmDeletionDialog();
                    }, 500);
                    
                    break;
                }
            }
            
            if (!foundDeleteButton) {
                console.log('⚠️ لم أجد أزرار حذف، أبحث في جدول الديون');
                this.deleteFromDebtsTable(name);
            }
            
        } catch (error) {
            console.error('❌ خطأ في تنفيذ الحذف:', error);
        }
    }
    
    /**
     * تأكيد الحذف في النافذة المنبثقة
     */
    static confirmDeletionDialog() {
        try {
            // البحث عن أزرار التأكيد في النوافذ المنبثقة
            const modals = document.querySelectorAll('.modal, [class*="modal"], [class*="dialog"]');
            
            for (const modal of modals) {
                if (modal.style.display !== 'none' && 
                    !modal.classList.contains('hidden') && 
                    window.getComputedStyle(modal).display !== 'none') {
                    
                    // البحث عن أزرار نعم/تأكيد/حذف داخل النافذة
                    const confirmButtons = modal.querySelectorAll('button');
                    
                    for (const btn of confirmButtons) {
                        const btnText = btn.textContent.toLowerCase();
                        
                        if (btnText.includes('نعم') || 
                            btnText.includes('تأكيد') || 
                            btnText.includes('حذف') ||
                            btnText.includes('احذف') ||
                            btnText.includes('موافق')) {
                            
                            console.log('✅ وجدت زر تأكيد:', btn.textContent);
                            btn.click();
                            return true;
                        }
                    }
                }
            }
            
            // إذا لم نجد نوافذ، نبحث عن أزرار تأكيد مباشرة
            const allConfirmButtons = document.querySelectorAll('button');
            for (const btn of allConfirmButtons) {
                const btnText = btn.textContent.toLowerCase();
                if ((btnText.includes('نعم') && btnText.includes('حذف')) ||
                    (btnText.includes('تأكيد') && btnText.includes('حذف'))) {
                    console.log('✅ وجدت زر تأكيد مباشر:', btn.textContent);
                    btn.click();
                    return true;
                }
            }
            
            return false;
            
        } catch (error) {
            console.error('❌ خطأ في تأكيد الحذف:', error);
            return false;
        }
    }
    
    /**
     * حذف من جدول الديون مباشرة
     */
    static deleteFromDebtsTable(name) {
        try {
            console.log('🔍 البحث في جدول الديون عن:', name);
            
            // البحث في جدول الديون عن الصفوف التي تحتوي على الاسم
            const debtRows = document.querySelectorAll('tr');
            let deletedCount = 0;
            
            for (const row of debtRows) {
                const rowText = row.textContent.toLowerCase();
                if (rowText.includes(name.toLowerCase())) {
                    console.log('✅ وجدت صف يحتوي على الاسم:', name);
                    
                    // البحث عن زر حذف في هذا الصف
                    const deleteBtn = row.querySelector('button');
                    if (deleteBtn) {
                        deleteBtn.click();
                        deletedCount++;
                        
                        // تأكيد الحذف
                        setTimeout(() => {
                            this.confirmDeletionDialog();
                        }, 300);
                    }
                }
            }
            
            if (deletedCount > 0) {
                console.log(`✅ تم بدء حذف ${deletedCount} دين`);
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('❌ خطأ في حذف الجدول:', error);
            return false;
        }
    }
    
    // ===== الدوال المساعدة =====
    
    static fillDebtForm(data) {
        console.log('🖊️ تعبئة النموذج:', data);
        
        const fields = [
            { id: 'debtName', value: data.name },
            { id: 'debtAmount', value: data.amount },
            { id: 'debtDate', value: data.date || this.getCurrentDate() },
            { id: 'debtTime', value: data.time || this.getCurrentTime() }
        ];
        
        fields.forEach(field => {
            const element = document.getElementById(field.id);
            if (element) {
                element.value = field.value;
                // ⚠️ تشغيل الأحداث المهمة
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`✅ ${field.id} ← ${field.value}`);
            }
        });
    }
    
    static executeSave(data) {
        console.log('💾 تنفيذ الحفظ...');
        
        // الطريقة 1: استخدام addDebt الأصلية
        if (typeof window.addDebt === 'function') {
            console.log('✅ استخدام window.addDebt()');
            window.addDebt();
            this.showMessage('✅ تم حفظ الدين بنجاح', 'success');
            return true;
        }
        
        // الطريقة 2: النقر على زر saveDebt
        const saveBtn = document.getElementById('saveDebt');
        if (saveBtn) {
            console.log('✅ النقر على saveDebt');
            saveBtn.click();
            this.showMessage('✅ تم حفظ الدين بنجاح', 'success');
            return true;
        }
        
        // الطريقة 3: البحث عن أي زر حفظ
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
            if (btn.textContent.includes('حفظ') || btn.id.includes('save')) {
                console.log('✅ وجدت زر حفظ:', btn.textContent);
                btn.click();
                this.showMessage('✅ تم حفظ الدين بنجاح', 'success');
                return true;
            }
        }
        
        console.error('❌ لم أجد طريقة للحفظ');
        this.showMessage('❌ لم أتمكن من حفظ الدين', 'error');
        return false;
    }
    
    static goToDebtsPage() {
        const currentPage = document.querySelector('.content-page.active');
        
        if (currentPage && currentPage.id === 'debtsPage') {
            return true;
        }
        
        const debtsBtn = document.querySelector('[data-page="debtsPage"], #navDebts');
        if (debtsBtn) {
            debtsBtn.click();
            return true;
        }
        
        return false;
    }
    
    static getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    }
    
    static getCurrentTime() {
        const hour = new Date().getHours();
        if (hour < 12) return 'صباحاً';
        if (hour < 17) return 'ظهراً';
        if (hour < 20) return 'مساءً';
        return 'ليلاً';
    }
    
    static showMessage(text, type = 'info') {
        if (window.voiceSystem) {
            window.voiceSystem.showNotification(text, type);
        } else {
            console.log(`💬 ${type}: ${text}`);
        }
    }
    
    /**
     * محاولة قراءة الديون من النظام الحالي - النسخة المحسنة
     */
    static tryReadDebtsFromSystem() {
        console.log('🔍 محاولة قراءة الديون من النظام...');
        
        // الطريقة 0: استخدام جسر النظام الصوتي (الأفضل)
        if (window.voiceSystemBridge) {
            try {
                const debts = window.voiceSystemBridge.getAllDebts();
                if (debts && Array.isArray(debts) && debts.length > 0) {
                    console.log(`✅ تم العثور على ${debts.length} دين (من الجسر)`);
                    return debts;
                }
            } catch (error) {
                console.warn('⚠️ فشل قراءة من الجسر:', error);
            }
        }
        
        // الطرق القديمة (للتوافق)
        const sources = [
            // 1. المتغير العالمي
            () => window.debts,
            
            // 2. من localStorage
            () => {
                const user = localStorage.getItem('dq_current_user');
                if (!user) return null;
                
                const debtsJSON = localStorage.getItem(`dq_debts_${user}`);
                if (!debtsJSON) return null;
                
                try {
                    return JSON.parse(debtsJSON);
                } catch (e) {
                    return null;
                }
            },
            
            // 3. من sessionStorage
            () => {
                const debtsJSON = sessionStorage.getItem('current_debts');
                if (!debtsJSON) return null;
                
                try {
                    return JSON.parse(debtsJSON);
                } catch (e) {
                    return null;
                }
            }
        ];
        
        for (const source of sources) {
            try {
                const debts = source();
                if (debts && Array.isArray(debts) && debts.length > 0) {
                    console.log(`✅ تم العثور على ${debts.length} دين`);
                    return debts;
                }
            } catch (error) {
                console.warn('⚠️ فشل مصدر بيانات:', error);
            }
        }
        
        console.warn('⚠️ لم أجد بيانات الديون');
        return null;
    }
    
    /**
     * تحديث ذاكرة الاستعلام مؤقتاً
     */
    static updateQueryCache() {
        if (!window.voiceSystem) return;
        
        // محاولة قراءة الديون كل 5 ثواني
        setInterval(() => {
            try {
                const debts = this.tryReadDebtsFromSystem();
                if (debts) {
                    window.voiceSystem.lastKnownDebts = debts;
                    console.log(`💾 تحديث ذاكرة الاستعلام: ${debts.length} دين`);
                }
            } catch (error) {
                console.warn('⚠️ فشل تحديث ذاكرة الاستعلام:', error);
            }
        }, 5000);
    }
}

// ============================================================================
// 4) VOICE SYSTEM v5.3 - النظام الرئيسي مع نظام الحذف الفعلي
// ============================================================================

class VoiceSystemV5 {
    constructor() {
        // الوحدات الأساسية
        this.speechBuffer = new SpeechBufferPro();
        this.duplicateGuard = new DuplicateGuardPro();
        this.commandParser = new CommandParserPro();
        
        // حالة النظام
        this.isListening = false;
        this.recognition = null;
        this.pendingCommand = null;
        this.pendingData = null;
        
        // إحصائيات
        this.stats = {
            commandsProcessed: 0,
            lastCommandTime: null,
            errors: 0
        };
        
        // ذاكرة مؤقتة للديون (للاستعلام)
        this.lastKnownDebts = null;
        this.cacheTimestamp = null;
        
        // إنشاء جسر اتصال مؤقت
        this.createVoiceBridge();
        
        // التهيئة
        this.initialize();
    }
    
    /**
     * إنشاء جسر اتصال مؤقت
     */
    createVoiceBridge() {
        if (!window.voiceSystemBridge) {
            window.voiceSystemBridge = {
                getAllDebts: () => {
                    return this.lastKnownDebts || window.debts || [];
                },
                
                getActiveDebts: () => {
                    const debts = this.getAllDebts();
                    return debts.filter(debt => (debt.remainingAmount || 0) > 0);
                },
                
                searchDebtor: (name) => {
                    const debts = this.getAllDebts();
                    return debts.filter(debt => 
                        debt.name && debt.name.toLowerCase().includes(name.toLowerCase())
                    );
                },
                
                getStatistics: () => {
                    const debts = this.getAllDebts();
                    const total = debts.reduce((sum, debt) => sum + (debt.totalAmount || 0), 0);
                    const paid = debts.reduce((sum, debt) => sum + (debt.paidAmount || 0), 0);
                    const remaining = total - paid;
                    const activeDebts = debts.filter(debt => (debt.remainingAmount || 0) > 0).length;
                    const totalDebtors = new Set(debts.map(d => d.name)).size;
                    
                    return {
                        total: total,
                        paid: paid,
                        remaining: remaining,
                        activeDebts: activeDebts,
                        totalDebts: debts.length,
                        totalDebtors: totalDebtors,
                        formatted: {
                            total: total.toLocaleString() + ' ريال',
                            paid: paid.toLocaleString() + ' ريال',
                            remaining: remaining.toLocaleString() + ' ريال'
                        }
                    };
                },
                
                getDebtors: () => {
                    const debts = this.getAllDebts();
                    const debtors = {};
                    debts.forEach(debt => {
                        if (!debt.name) return;
                        
                        if (!debtors[debt.name]) {
                            debtors[debt.name] = {
                                name: debt.name,
                                total: 0,
                                paid: 0,
                                remaining: 0,
                                debtsCount: 0
                            };
                        }
                        debtors[debt.name].total += debt.totalAmount || 0;
                        debtors[debt.name].paid += debt.paidAmount || 0;
                        debtors[debt.name].remaining += debt.remainingAmount || 0;
                        debtors[debt.name].debtsCount++;
                    });
                    return Object.values(debtors);
                },
                
                queryDebtor: (name) => {
                    const debtorDebts = this.searchDebtor(name);
                    
                    if (debtorDebts.length === 0) {
                        return {
                            found: false,
                            message: `لا توجد ديون للمتدين ${name}`
                        };
                    }
                    
                    const total = debtorDebts.reduce((sum, debt) => sum + (debt.totalAmount || 0), 0);
                    const paid = debtorDebts.reduce((sum, debt) => sum + (debt.paidAmount || 0), 0);
                    const remaining = total - paid;
                    const percentage = total > 0 ? Math.round((paid / total) * 100) : 0;
                    
                    return {
                        found: true,
                        name: name,
                        total: total,
                        paid: paid,
                        remaining: remaining,
                        percentage: percentage,
                        debtsCount: debtorDebts.length,
                        formatted: {
                            total: total.toLocaleString() + ' ريال',
                            paid: paid.toLocaleString() + ' ريال',
                            remaining: remaining.toLocaleString() + ' ريال',
                            percentage: percentage + '%'
                        },
                        debts: debtorDebts
                    };
                },
                
                getTotalDebts: () => {
                    const stats = this.getStatistics();
                    return `إجمالي الديون: ${stats.formatted.total}، المسدد: ${stats.formatted.paid}، المتبقي: ${stats.formatted.remaining}`;
                },
                
                /**
                 * حذف ديون متدين - الاتصال بالنظام الرئيسي
                 */
                deleteDebtorDebts: (name) => {
                    console.log('🗑️ جسر الصوت يحاول حذف ديون:', name);
                    
                    // المحاولة 1: استخدام دالة النظام الرئيسي مباشرة
                    if (window.deleteDebtorDebts) {
                        console.log('✅ استخدام window.deleteDebtorDebts مباشرة');
                        return window.deleteDebtorDebts(name);
                    }
                    
                    // المحاولة 2: إذا كان التطبيق الرئيسي يحتوي على نظام حذف
                    if (window.debts && Array.isArray(window.debts)) {
                        console.log('✅ حذف مباشر من مصفوفة الديون');
                        const originalLength = window.debts.length;
                        const nameLower = name.toLowerCase();
                        
                        window.debts = window.debts.filter(debt => 
                            !debt.name || !debt.name.toLowerCase().includes(nameLower)
                        );
                        
                        const deletedCount = originalLength - window.debts.length;
                        
                        if (deletedCount > 0) {
                            // محاولة حفظ التغييرات
                            try {
                                if (window.saveToLocalStorage) {
                                    window.saveToLocalStorage();
                                }
                                
                                if (window.refreshUI) {
                                    window.refreshUI();
                                }
                                
                                return {
                                    success: true,
                                    message: `✅ تم حذف ${deletedCount} دين للمتدين ${name}`,
                                    deletedCount: deletedCount
                                };
                            } catch (error) {
                                console.error('❌ خطأ في حفظ التغييرات:', error);
                            }
                        }
                    }
                    
                    return {
                        success: false,
                        message: `❌ لم أتمكن من الاتصال بنظام الحذف الرئيسي`,
                        deletedCount: 0
                    };
                }
            };
            console.log('🌉 تم إنشاء جسر الاتصال للنظام الصوتي مع دالة حذف');
        }
    }
    
    /**
     * ✅ التهيئة المحسنة
     */
    initialize() {
        console.log('🚀 تهيئة النظام الصوتي v5.3...');
        
        // الانتظار حتى يكون التطبيق جاهزاً
        setTimeout(() => {
            this.createEnhancedUI();
            this.initSpeechRecognition();
            this.initSpeechSynthesis();
            this.setupEventListeners();
            
            console.log('✅ النظام الصوتي v5.3 جاهز');
            
            // إشعار ترحيبي
            setTimeout(() => {
                this.showNotification('🎤 النظام الصوتي جاهز للاستخدام', 'success');
                this.speak('مرحباً، أنا نظام إدارة الديون الصوتي، جاهز لخدمتك');
            }, 1000);
            
        }, 1500);
    }
    
    /**
     * 🎨 إنشاء واجهة مستخدم محسنة (من v4)
     */
    createEnhancedUI() {
        this.removeOldUI();
        this.createMainButton();
        this.createListeningIndicator();
        this.createConfirmationModal();
        this.createQuickActions();
        this.injectStyles();
    }
    
    createMainButton() {
        const btn = document.createElement('button');
        btn.id = 'voiceControlBtn';
        btn.className = 'voice-control-btn';
        btn.innerHTML = `
            <div class="voice-icon">
                <i class="fas fa-microphone"></i>
            </div>
            <div class="voice-label">تكلم لإدارة الديون</div>
        `;
        
        btn.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 70px;
            height: 70px;
            border-radius: 50%;
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            border: 3px solid white;
            color: white;
            cursor: pointer;
            z-index: 9998;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 5px;
            box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: 'Tajawal', sans-serif;
            font-size: 12px;
            text-align: center;
            padding: 0;
            overflow: hidden;
        `;
        
        // تأثيرات التفاعل (من v4)
        btn.onmouseenter = () => {
            btn.style.transform = 'scale(1.1)';
            btn.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.7)';
        };
        
        btn.onmouseleave = () => {
            if (!this.isListening) {
                btn.style.transform = 'scale(1)';
                btn.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)';
            }
        };
        
        btn.onclick = () => this.toggleListening();
        document.body.appendChild(btn);
    }
    
    createListeningIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'voiceListeningIndicator';
        indicator.className = 'voice-listening-indicator hidden';
        indicator.innerHTML = `
            <div class="pulse-dot"></div>
            <div class="listening-text">🎤 أستمع إليك...</div>
        `;
        
        indicator.style.cssText = `
            position: fixed;
            bottom: 110px;
            right: 40px;
            background: rgba(239, 68, 68, 0.95);
            color: white;
            padding: 12px 20px;
            border-radius: 20px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 9997;
            backdrop-filter: blur(10px);
            border: 2px solid white;
            font-family: 'Tajawal', sans-serif;
            font-size: 14px;
            font-weight: bold;
            animation: voiceSlideUp 0.3s ease;
        `;
        
        document.body.appendChild(indicator);
    }
    
    createConfirmationModal() {
        const modal = document.createElement('div');
        modal.id = 'voiceConfirmationModal';
        modal.className = 'voice-confirmation-modal hidden';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>تأكيد التسجيل الصوتي</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="voiceConfirmDetails" class="confirm-details">
                        <div class="loading-spinner">
                            <div></div><div></div><div></div><div></div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="voiceConfirmYes" class="btn-success">
                        <i class="fas fa-check"></i> نعم، احفظ
                    </button>
                    <button id="voiceConfirmNo" class="btn-danger">
                        <i class="fas fa-times"></i> إلغاء
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    createQuickActions() {
        const actions = document.createElement('div');
        actions.id = 'voiceQuickActions';
        actions.className = 'hidden';
        actions.innerHTML = `
            <div class="quick-actions-title">أوامر سريعة:</div>
            <div class="quick-actions-grid">
                <button class="quick-action" data-command="محمد دين ثلاثة ألف">
                    <span>➕ إضافة دين</span>
                </button>
                <button class="quick-action" data-command="سدد محمد ألف">
                    <span>💸 تسديد</span>
                </button>
                <button class="quick-action" data-command="كم باقي على محمد">
                    <span>🔍 استعلام</span>
                </button>
                <button class="quick-action" data-command="احذف دين محمد">
                    <span>🗑️ حذف</span>
                </button>
            </div>
        `;
        
        actions.style.cssText = `
            position: fixed;
            bottom: 110px;
            right: 40px;
            background: rgba(30, 41, 59, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 20px;
            z-index: 9996;
            border: 2px solid #3b82f6;
            min-width: 250px;
            animation: voiceSlideUp 0.3s ease;
        `;
        
        document.body.appendChild(actions);
    }
    
    injectStyles() {
        const styleId = 'voice-system-styles-v5';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            @keyframes voiceSlideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            @keyframes voicePulse {
                0% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.2); opacity: 0.7; }
                100% { transform: scale(1); opacity: 1; }
            }
            
            @keyframes voiceLoading {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .voice-control-btn.listening {
                background: linear-gradient(135deg, #ef4444, #dc2626) !important;
                animation: voicePulse 1.5s infinite !important;
            }
            
            .voice-listening-indicator .pulse-dot {
                width: 12px;
                height: 12px;
                background: white;
                border-radius: 50%;
                animation: voicePulse 1.5s infinite;
            }
            
            .voice-confirmation-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            }
            
            .voice-confirmation-modal .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(5px);
            }
            
            .voice-confirmation-modal .modal-content {
                position: relative;
                background: #1e293b;
                border-radius: 20px;
                padding: 25px;
                width: 90%;
                max-width: 450px;
                border: 2px solid #3b82f6;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
                animation: voiceSlideUp 0.3s ease;
                color: white;
                font-family: 'Tajawal', sans-serif;
            }
            
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid #3b82f6;
            }
            
            .modal-header h3 {
                margin: 0;
                color: #3b82f6;
                font-size: 22px;
            }
            
            .modal-close {
                background: none;
                border: none;
                color: #94a3b8;
                font-size: 24px;
                cursor: pointer;
                padding: 5px;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.3s;
            }
            
            .modal-close:hover {
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }
            
            .confirm-details {
                background: rgba(255, 255, 255, 0.05);
                padding: 20px;
                border-radius: 12px;
                margin-bottom: 25px;
                min-height: 100px;
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            
            .detail-row {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .detail-row:last-child {
                border-bottom: none;
            }
            
            .detail-label {
                color: #94a3b8;
                font-weight: bold;
                font-size: 14px;
            }
            
            .detail-value {
                color: white;
                font-weight: bold;
                text-align: left;
                font-size: 16px;
            }
            
            .modal-footer {
                display: flex;
                gap: 15px;
                justify-content: center;
            }
            
            .modal-footer button {
                flex: 1;
                padding: 14px;
                border-radius: 12px;
                border: none;
                font-weight: bold;
                font-size: 16px;
                cursor: pointer;
                transition: all 0.3s ease;
                font-family: 'Tajawal', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            
            .btn-success {
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
            }
            
            .btn-danger {
                background: linear-gradient(135deg, #ef4444, #dc2626);
                color: white;
            }
            
            .modal-footer button:hover {
                transform: translateY(-3px);
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
            }
            
            .hidden {
                display: none !important;
            }
            
            .loading-spinner {
                display: inline-block;
                width: 40px;
                height: 40px;
                margin: 20px auto;
            }
            
            .loading-spinner div {
                box-sizing: border-box;
                display: block;
                position: absolute;
                width: 32px;
                height: 32px;
                margin: 4px;
                border: 4px solid #3b82f6;
                border-radius: 50%;
                animation: voiceLoading 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
                border-color: #3b82f6 transparent transparent transparent;
            }
            
            .loading-spinner div:nth-child(1) {
                animation-delay: -0.45s;
            }
            
            .loading-spinner div:nth-child(2) {
                animation-delay: -0.3s;
            }
            
            .loading-spinner div:nth-child(3) {
                animation-delay: -0.15s;
            }
            
            .voice-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #3b82f6;
                color: white;
                padding: 15px 25px;
                border-radius: 12px;
                z-index: 9999;
                font-family: 'Tajawal', sans-serif;
                font-size: 15px;
                animation: voiceSlideUp 0.3s ease;
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
                border-left: 5px solid rgba(255, 255, 255, 0.3);
                max-width: 300px;
                word-break: break-word;
            }
            
            .voice-toast.success {
                background: #10b981;
            }
            
            .voice-toast.error {
                background: #ef4444;
            }
            
            .voice-toast.warning {
                background: #f59e0b;
            }
            
            .voice-toast.info {
                background: #3b82f6;
            }
            
            /* تحسينات للهواتف */
            @media (max-width: 768px) {
                .voice-control-btn {
                    width: 65px;
                    height: 65px;
                    bottom: 20px;
                    right: 20px;
                    font-size: 11px;
                }
                
                .voice-listening-indicator {
                    bottom: 95px;
                    right: 30px;
                    font-size: 13px;
                    padding: 10px 16px;
                }
                
                .voice-confirmation-modal .modal-content {
                    padding: 20px;
                    margin: 10px;
                }
                
                .modal-footer {
                    flex-direction: column;
                }
            }
            
            /* الأوامر السريعة */
            .quick-actions-title {
                color: #94a3b8;
                font-size: 12px;
                margin-bottom: 10px;
                text-align: center;
            }
            
            .quick-actions-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
            }
            
            .quick-action {
                background: rgba(59, 130, 246, 0.2);
                border: 1px solid #3b82f6;
                color: white;
                padding: 8px 12px;
                border-radius: 8px;
                cursor: pointer;
                font-family: 'Tajawal', sans-serif;
                font-size: 12px;
                transition: all 0.3s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
            }
            
            .quick-action:hover {
                background: rgba(59, 130, 246, 0.4);
                transform: translateY(-2px);
            }
        `;
        
        document.head.appendChild(style);
    }
    
    removeOldUI() {
        ['voiceControlBtn', 'voiceListeningIndicator', 'voiceConfirmationModal', 'voiceQuickActions'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
    }
    
    /**
     * 🎤 تهيئة نظام التعرف على الصوت
     */
    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            this.showNotification('المتصفح لا يدعم التعرف على الصوت', 'error');
            return false;
        }
        
        try {
            this.recognition = new SpeechRecognition();
            this.recognition.lang = VOICE_CONFIG.LANGUAGE;
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.maxAlternatives = 3;
            
            this.recognition.onstart = () => {
                this.isListening = true;
                this.updateListeningState(true);
                this.showNotification('🎤 أستمع إليك الآن...', 'listening');
            };
            
            this.recognition.onresult = (event) => {
                const text = event.results[0][0].transcript.trim();
                console.log('🎤 تم التعرف على:', text);
                this.speechBuffer.push(text);
            };
            
            this.recognition.onerror = (event) => {
                console.error('❌ خطأ STT:', event.error);
                
                if (event.error === 'not-allowed') {
                    this.showNotification('يجب السماح باستخدام الميكروفون', 'error');
                } else if (event.error === 'no-speech') {
                    this.showNotification('لم أسمع شيئاً', 'warning');
                } else {
                    this.showNotification('حدث خطأ في التعرف على الصوت', 'error');
                }
                
                this.stopListening();
            };
            
            this.recognition.onend = () => {
                this.stopListening();
            };
            
            return true;
            
        } catch (error) {
            console.error('❌ فشل في تهيئة STT:', error);
            this.showNotification('تعذر تهيئة نظام الصوت', 'error');
            return false;
        }
    }
    
    /**
     * 🔊 تهيئة نظام التحدث
     */
    initSpeechSynthesis() {
        if (!('speechSynthesis' in window)) {
            console.warn('⚠️ المتصفح لا يدعم التحدث الصوتي');
            return false;
        }
        
        // تحميل الأصوات العربية (من v4)
        setTimeout(() => {
            const voices = window.speechSynthesis.getVoices();
            const arabicVoices = voices.filter(v => v.lang.startsWith('ar'));
            if (arabicVoices.length > 0) {
                console.log(`✅ ${arabicVoices.length} صوت عربي متاح`);
            }
        }, 1000);
        
        return true;
    }
    
    /**
     * ⚙️ إعداد مستمعي الأحداث
     */
    setupEventListeners() {
        // ربط أحداث النافذة (من v4)
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('voiceConfirmationModal');
            if (modal && !modal.contains(e.target) && 
                e.target.id !== 'voiceControlBtn' &&
                !e.target.closest('#voiceConfirmationModal')) {
                this.closeConfirmationModal();
            }
        });
        
        // ربط أزرار النافذة
        const confirmYes = document.getElementById('voiceConfirmYes');
        const confirmNo = document.getElementById('voiceConfirmNo');
        const closeBtn = document.querySelector('.modal-close');
        
        if (confirmYes) {
            confirmYes.onclick = () => this.confirmSave();
        }
        
        if (confirmNo) {
            confirmNo.onclick = () => this.cancelSave();
        }
        
        if (closeBtn) {
            closeBtn.onclick = () => this.closeConfirmationModal();
        }
        
        // اختصار لوحة المفاتيح (من v4)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.code === 'Space') {
                e.preventDefault();
                this.toggleListening();
            }
            
            // Esc لإغلاق النوافذ
            if (e.key === 'Escape') {
                this.closeConfirmationModal();
            }
        });
        
        // أحداث الأوامر السريعة
        document.addEventListener('click', (e) => {
            if (e.target.closest('.quick-action')) {
                const command = e.target.closest('.quick-action').dataset.command;
                if (command) {
                    this.processFinalSpeech(command);
                }
            }
        });
    }
    
    /**
     * 🔄 التبديل بين حالة الاستماع
     */
    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }
    
    startListening() {
        if (!this.recognition) {
            if (!this.initSpeechRecognition()) {
                return;
            }
        }
        
        try {
            this.recognition.start();
        } catch (error) {
            console.error('❌ تعذر بدء الاستماع:', error);
            this.showNotification('تعذر بدء التسجيل الصوتي', 'error');
        }
    }
    
    stopListening() {
        this.isListening = false;
        this.updateListeningState(false);
    }
    
    /**
     * 🎯 تحديث حالة واجهة الاستماع
     */
    updateListeningState(isListening) {
        const btn = document.getElementById('voiceControlBtn');
        const indicator = document.getElementById('voiceListeningIndicator');
        
        if (btn) {
            if (isListening) {
                btn.classList.add('listening');
                btn.querySelector('.voice-label').textContent = 'يتحدث...';
            } else {
                btn.classList.remove('listening');
                btn.querySelector('.voice-label').textContent = 'تكلم لإدارة الديون';
            }
        }
        
        if (indicator) {
            if (isListening) {
                indicator.classList.remove('hidden');
            } else {
                indicator.classList.add('hidden');
            }
        }
    }
    
    /**
     * 🧠 معالجة النص النهائي
     */
    processFinalSpeech(text) {
        console.log('🧠 معالجة النص:', text);
        
        // التحقق من التكرار
        if (this.duplicateGuard.isDuplicate(text)) {
            this.showNotification('✅ تم تأكيد الأمر السابق', 'info');
            return;
        }
        
        // تحليل الأمر
        const command = this.commandParser.parse(text);
        
        if (!command.valid) {
            this.showNotification('❌ لم أفهم الأمر، حاول مرة أخرى', 'warning');
            this.speak('لم أفهم الأمر، حاول مرة أخرى');
            return;
        }
        
        // حفظ الأمر
        this.pendingCommand = command;
        
        // معالجة حسب النوع
        this.handleCommand(command);
    }
    
    /**
     * 🚀 معالجة الأمر
     */
    handleCommand(command) {
        console.log('🚀 تنفيذ الأمر:', command);
        
        this.stats.commandsProcessed++;
        this.stats.lastCommandTime = Date.now();
        
        switch (command.type) {
            case 'add':
                this.handleAddDebt(command);
                break;
            case 'pay':
                this.handleAddPayment(command);
                break;
            case 'query':
                this.handleQueryDebt(command);
                break;
            case 'delete':
                this.handleDeleteDebt(command);
                break;
            default:
                this.showNotification('نوع الأمر غير معروف', 'error');
        }
    }
    
    /**
     * ➕ معالجة إضافة دين باستخدام DebtAPI
     */
    handleAddDebt(command) {
        const debtData = {
            name: command.name,
            amount: command.amount,
            date: DebtAPI.getCurrentDate(),
            time: DebtAPI.getCurrentTime(),
            originalText: command.originalText
        };
        
        this.pendingData = debtData;
        
        // عرض التأكيد
        this.showDebtConfirmation(debtData);
        
        // التحدث بتأكيد
        this.speak(`فهمت: دين ${command.name} بمبلغ ${command.amount}`);
    }
    
    /**
     * 💸 معالجة تسديد دفعة باستخدام DebtAPI
     */
    handleAddPayment(command) {
        const paymentData = {
            name: command.name,
            amount: command.amount
        };
        
        this.showNotification(`💸 جارِ تسديد ${command.amount} ريال لـ ${command.name}...`, 'info');
        this.speak(`جارِ تسديد ${command.amount} ريال`);
        
        // استخدام DebtAPI الكاملة
        setTimeout(() => {
            const success = DebtAPI.pay(paymentData);
            if (success) {
                this.speak('تم بدء عملية التسديد');
            } else {
                this.showNotification('❌ فشل في تسجيل الدفعة', 'error');
            }
        }, 500);
    }
    
    /**
     * 🔍 معالجة استعلام باستخدام DebtAPI
     */
    handleQueryDebt(command) {
        console.log('🔍 معالجة الاستعلام:', command);
        
        this.showNotification(`🔍 جارِ البحث عن ديون ${command.name}...`, 'info');
        this.speak(`أبحث عن ديون ${command.name}`);
        
        // استخدام DebtAPI الكاملة
        setTimeout(() => {
            try {
                const result = DebtAPI.query(command);
                this.displayQueryResult(command.name, result);
            } catch (error) {
                console.error('❌ خطأ في الاستعلام:', error);
                const errorMsg = `حدث خطأ في البحث عن ديون ${command.name}`;
                this.speak(errorMsg);
                this.showNotification(errorMsg, 'error');
            }
        }, 800);
    }
    
    /**
     * 🗑️ معالجة حذف باستخدام DebtAPI الفعلية
     */
    async handleDeleteDebt(command) {
        console.log('🗑️ معالجة حذف ديون:', command);
        
        // 1. البحث أولاً عن ديون المتدين
        let debtorInfo = null;
        
        if (window.voiceSystemBridge) {
            debtorInfo = window.voiceSystemBridge.queryDebtor(command.name);
        }
        
        // 2. إذا لم يكن هناك ديون، نبلغ المستخدم
        if (debtorInfo && !debtorInfo.found) {
            this.speak(debtorInfo.message);
            this.showNotification(debtorInfo.message, 'info');
            return;
        }
        
        // 3. إذا كان هناك ديون، نعرض تفاصيلها ونطلب التأكيد
        let confirmMessage = `هل تريد حذف جميع ديون ${command.name}؟`;
        
        if (debtorInfo && debtorInfo.found) {
            confirmMessage = `هل تريد حذف ${debtorInfo.debtsCount} دين لـ ${command.name}؟\n` +
                           `المبلغ الإجمالي: ${debtorInfo.formatted.total}\n` +
                           `المتبقي: ${debtorInfo.formatted.remaining}`;
        }
        
        // 4. طلب التأكيد من المستخدم
        const userConfirmed = confirm(confirmMessage);
        
        if (!userConfirmed) {
            this.speak('تم إلغاء عملية الحذف');
            this.showNotification('تم إلغاء عملية الحذف', 'info');
            return;
        }
        
        // 5. تنفيذ الحذف الفعلي
        this.showNotification(`🗑️ جارِ حذف ديون ${command.name}...`, 'warning');
        this.speak(`جارِ حذف ديون ${command.name}`);
        
        try {
            // استخدام DebtAPI للحذف الفعلي
            const deleteResult = await DebtAPI.delete(command);
            
            if (deleteResult && deleteResult.success) {
                this.speak(`✅ تم حذف ديون ${command.name} بنجاح`);
                this.showNotification(deleteResult.message || `✅ تم حذف ديون ${command.name}`, 'success');
            } else {
                this.speak('❌ لم أتمكن من حذف الديون');
                this.showNotification(deleteResult?.message || '❌ فشل في حذف الديون', 'error');
            }
            
        } catch (error) {
            console.error('❌ خطأ في الحذف:', error);
            this.speak('حدث خطأ أثناء الحذف');
            this.showNotification('❌ حدث خطأ أثناء الحذف', 'error');
        }
    }
    
    /**
     * ✅ عرض تأكيد الدين المحسن
     */
    showDebtConfirmation(data) {
        const modal = document.getElementById('voiceConfirmationModal');
        const details = document.getElementById('voiceConfirmDetails');
        
        if (!modal || !details) {
            // إذا لم توجد النافذة، احفظ مباشرة
            this.confirmSave(data);
            return;
        }
        
        details.innerHTML = `
            <div class="confirmation-details">
                <div class="detail-row">
                    <span class="detail-label">👤 اسم المتدين:</span>
                    <span class="detail-value">${data.name}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">💰 المبلغ:</span>
                    <span class="detail-value">${data.amount.toLocaleString()} ريال</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">📅 التاريخ:</span>
                    <span class="detail-value">${data.date}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">⏰ الوقت:</span>
                    <span class="detail-value">${data.time}</span>
                </div>
                <div style="color: #94a3b8; font-size: 12px; margin-top: 15px; text-align: center;">
                    <i class="fas fa-info-circle"></i> تم تعبئة النموذج تلقائياً
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
        
        // ربط الأزرار
        this.bindConfirmationButtons();
        
        // إعطاء التركيز لزر التأكيد
        setTimeout(() => {
            document.getElementById('voiceConfirmYes')?.focus();
        }, 100);
    }
    
    bindConfirmationButtons() {
        const confirmYes = document.getElementById('voiceConfirmYes');
        const confirmNo = document.getElementById('voiceConfirmNo');
        const closeBtn = document.querySelector('.modal-close');
        
        if (confirmYes) {
            confirmYes.onclick = () => this.confirmSave();
        }
        
        if (confirmNo) {
            confirmNo.onclick = () => this.cancelSave();
        }
        
        if (closeBtn) {
            closeBtn.onclick = () => this.cancelSave();
        }
    }
    
    /**
     * 💾 تأكيد الحفظ
     */
    confirmSave(data = null) {
        const debtData = data || this.pendingData;
        if (!debtData) {
            this.showNotification('❌ لا توجد بيانات للحفظ', 'error');
            return;
        }
        
        console.log('💾 تأكيد الحفظ:', debtData);
        
        // استخدام DebtAPI الكاملة
        const success = DebtAPI.add(debtData);
        
        if (success) {
            this.speak('تم حفظ الدين بنجاح');
        }
        
        this.closeConfirmationModal();
        this.pendingData = null;
    }
    
    /**
     * ❌ إلغاء الحفظ
     */
    cancelSave() {
        this.speak('تم الإلغاء');
        this.showNotification('تم إلغاء الحفظ', 'info');
        this.closeConfirmationModal();
        this.pendingData = null;
    }
    
    /**
     * 🚪 إغلاق نافذة التأكيد
     */
    closeConfirmationModal() {
        const modal = document.getElementById('voiceConfirmationModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
    
    /**
     * 📊 عرض نتيجة الاستعلام
     */
    displayQueryResult(name, result) {
        console.log('📊 نتيجة الاستعلام:', result);
        
        const speakText = result
            .replace(/[•\n:]/g, ' ')
            .replace(/\s+/g, ' ')
            .substring(0, 150);
        
        this.speak(speakText + '...');
        this.showNotification(result, 'info');
    }
    
    /**
     * 🗣️ التحدث
     */
    speak(text) {
        if (!VOICE_CONFIG.ENABLE_TTS || !window.speechSynthesis) {
            console.log('🗣️ (بدون صوت):', text);
            return;
        }
        
        try {
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = VOICE_CONFIG.LANGUAGE;
            utterance.rate = VOICE_CONFIG.SPEECH_RATE;
            utterance.volume = 1;
            
            // البحث عن صوت عربي
            const voices = window.speechSynthesis.getVoices();
            const arabicVoice = voices.find(v => v.lang.startsWith('ar'));
            if (arabicVoice) utterance.voice = arabicVoice;
            
            window.speechSynthesis.speak(utterance);
            
        } catch (error) {
            console.error('❌ خطأ في التحدث:', error);
        }
    }
    
    /**
     * 💬 عرض إشعار محسن مع وقت أطول
     */
    showNotification(text, type = 'info') {
        console.log(`💬 ${type}: ${text}`);
        
        const colors = {
            info: '#3b82f6',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            listening: '#8b5cf6',
            query: '#0ea5e9' // لون خاص للاستعلامات
        };
        
        // تحديد وقت العرض حسب النوع
        let displayTime = 3000; // 3 ثواني افتراضياً
        if (type === 'info' && (text.includes('استعلام') || text.includes('باقي') || text.includes('ديون') || text.includes('إجمالي'))) {
            displayTime = 8000; // 8 ثواني للاستعلامات
        } else if (type === 'info') {
            displayTime = 5000; // 5 ثواني للمعلومات العامة
        }
        
        const color = colors[type] || colors.info;
        
        // إزالة الإشعار القديم
        const oldMsg = document.querySelector('.voice-toast');
        if (oldMsg) oldMsg.remove();
        
        // إنشاء الإشعار الجديد
        const msg = document.createElement('div');
        msg.className = `voice-toast ${type}`;
        msg.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 5px;">
                <div>${text}</div>
                <div style="font-size: 10px; opacity: 0.7; text-align: left; margin-top: 5px;">
                    ⏳ سيختفي بعد ${displayTime/1000} ثواني
                </div>
            </div>
        `;
        msg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${color};
            color: white;
            padding: 15px 25px;
            border-radius: 12px;
            z-index: 9999;
            font-family: 'Tajawal', sans-serif;
            font-size: 15px;
            animation: voiceSlideUp 0.3s ease;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
            border-left: 5px solid rgba(255, 255, 255, 0.3);
            max-width: 350px;
            word-break: break-word;
            line-height: 1.5;
        `;
        
        document.body.appendChild(msg);
        
        // إزالته بعد الوقت المحدد
        setTimeout(() => {
            msg.style.opacity = '0';
            msg.style.transition = 'opacity 0.5s ease';
            setTimeout(() => {
                if (msg.parentNode) {
                    msg.remove();
                }
            }, 500);
        }, displayTime);
        
        // إضافة زر إغلاق يدوي
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 5px;
            left: 5px;
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        closeBtn.onclick = () => {
            msg.style.opacity = '0';
            setTimeout(() => msg.remove(), 300);
        };
        msg.appendChild(closeBtn);
    }
    
    /**
     * 🔍 الحصول على أحدث بيانات الديون
     */
    getLatestDebts() {
        return this.lastKnownDebts;
    }
    
    /**
     * 🔄 تحديث بيانات الديون
     */
    updateDebtsData(newData) {
        console.log('🎤 تحديث بيانات الديون للنظام الصوتي');
        
        if (newData && newData.debts) {
            this.lastKnownDebts = newData.debts;
            this.cacheTimestamp = new Date().toLocaleString('ar-SA');
            
            // تحديث الجسر
            if (window.voiceSystemBridge) {
                window.voiceSystemBridge.lastKnownDebts = newData.debts;
            }
            
            console.log(`✅ ${newData.debts.length} دين متاح للاستعلام`);
            return { success: true, message: "تم تحديث البيانات" };
        }
        
        return { success: false, message: "بيانات غير صالحة" };
    }
    
    /**
     * 📊 الحصول على إحصائيات النظام
     */
    getStats() {
        return {
            ...this.stats,
            duplicateMemorySize: this.duplicateGuard.lastCommands.size,
            isListening: this.isListening,
            lastKnownDebtsCount: this.lastKnownDebts ? this.lastKnownDebts.length : 0,
            hasVoiceBridge: !!window.voiceSystemBridge
        };
    }
}

// ============================================================================
// 5) أنظمة الاستعلام والحذف المتقدمة
// ============================================================================

/**
 * استخراج اسم المتدين من الأمر
 */
function extractNameFromCommand(command) {
    const commandLower = command.toLowerCase();
    
    // أولاً: إزالة جميع كلمات الأوامر
    const removeWords = [
        'احذف', 'امسح', 'شطب', 'أزل', 'ازل', 'حذف',
        'دين', 'ديون', 'ديونه', 'ديونه',
        'ريال', 'مبلغ', 'عند', 'ل', 'على',
        'لكل', 'جميع', 'كل', 'كامل'
    ];
    
    // الحصول على الاسم عن طريق إزالة الكلمات الزائدة
    let words = commandLower.split(/\s+/);
    let filteredWords = [];
    
    for (let word of words) {
        let isCommandWord = false;
        for (let removeWord of removeWords) {
            if (word.includes(removeWord) || removeWord.includes(word)) {
                isCommandWord = true;
                break;
            }
        }
        
        if (!isCommandWord && word.length > 1 && isNaN(word)) {
            filteredWords.push(word);
        }
    }
    
    // أخذ أول كلمة (الاسم المحتمل)
    if (filteredWords.length > 0) {
        return filteredWords[0];
    }
    
    // إذا لم نجد، حاول البحث عن أسماء معروفة
    const knownNames = [
        'محمد', 'علي', 'أحمد', 'احمد', 'خالد', 'سعيد',
        'عبدالله', 'عمر', 'يوسف', 'حسن', 'سالم', 'فهد',
        'ناصر', 'بدر', 'راشد', 'طارق', 'ماجد', 'وليد',
        'هشام', 'غازي', 'عادل', 'سامي', 'نايف', 'سلمان'
    ];
    
    for (const knownName of knownNames) {
        if (commandLower.includes(knownName.toLowerCase())) {
            return knownName;
        }
    }
    
    // محاولة استخراج آخر كلمة
    const lastWord = words[words.length - 1];
    if (lastWord && lastWord.length > 1 && isNaN(lastWord)) {
        return lastWord;
    }
    
    return null;
}

/**
 * معالجة أمر الحذف
 */
function processDeleteCommand(command) {
    console.log('🗑️ معالجة أمر الحذف:', command);
    
    try {
        const name = extractNameFromCommand(command);
        if (!name) {
            return "لم أستطع معرفة اسم المتدين. حاول: 'احذف دين محمد'";
        }
        
        // إذا كان النظام الصوتي يعمل، استخدم جسره
        if (window.voiceSystemBridge) {
            const result = window.voiceSystemBridge.queryDebtor(name);
            
            if (!result.found) {
                return result.message;
            }
            
            // محاكاة حذف الديون
            const confirmMessage = `هل تريد حذف ${result.debtsCount} دين لـ ${name} بمبلغ إجمالي ${result.formatted.total}؟`;
            
            if (confirm(confirmMessage)) {
                // في الواقع، يجب أن يتم الحذف من التطبيق الرئيسي
                return `✅ تمت الموافقة على حذف ديون ${name} بمبلغ ${result.formatted.total}`;
            } else {
                return "❌ تم إلغاء الحذف";
            }
        }
        
        return `جارِ معالجة حذف ديون ${name}... استخدم واجهة التطبيق للتأكيد النهائي.`;
        
    } catch (error) {
        console.error('❌ خطأ في معالجة الحذف:', error);
        return "حدث خطأ أثناء محاولة الحذف";
    }
}

/**
 * نظام الاستعلام الصوتي المتكامل
 */
function processVoiceCommand(command) {
    const commandLower = command.toLowerCase();
    
    console.log('🎤 معالجة الأمر:', command);
    
    // الأوامر المباشرة
    if (commandLower.includes('إجمالي') || commandLower.includes('المجموع') || 
        commandLower.includes('الكل') || commandLower.includes('جميع')) {
        
        if (window.voiceSystemBridge) {
            const stats = window.voiceSystemBridge.getStatistics();
            return `إجمالي الديون: ${stats.formatted.total}، المسدد: ${stats.formatted.paid}، المتبقي: ${stats.formatted.remaining}`;
        }
        
        return "نظام الاستعلام غير متاح حالياً";
    }
    
    // استعلام عن متدين معين
    const name = extractNameFromCommand(command);
    if (name && (commandLower.includes('باقي') || commandLower.includes('ديون') || 
                 commandLower.includes('دين') || commandLower.includes('عند'))) {
        
        if (window.voiceSystemBridge) {
            const result = window.voiceSystemBridge.queryDebtor(name);
            
            if (!result.found) {
                return result.message;
            }
            
            return `${name}: إجمالي ${result.formatted.total}، مسدد ${result.formatted.paid}، باقي ${result.formatted.remaining}`;
        }
        
        return `جارِ البحث عن ديون ${name}...`;
    }
    
    // أوامر الحذف
    if (commandLower.includes('احذف') || commandLower.includes('امسح') || 
        commandLower.includes('شطب')) {
        return processDeleteCommand(command);
    }
    
    // استخدام النظام الصوتي الرئيسي للأوامر الأخرى
    if (window.voiceSystem) {
        return window.voiceSystem.processFinalSpeech ? 
               "جارِ معالجة الأمر..." : 
               "لم أفهم الأمر، حاول مرة أخرى";
    }
    
    return "النظام الصوتي غير جاهز. حاول لاحقاً.";
}

// ============================================================================
// 6) INITIALIZATION COMPLETE - التهيئة الكاملة
// ============================================================================

/**
 * انتظار تحميل التطبيق - النسخة الكاملة
 */
function waitForApp() {
    // التحقق من أن الصفحة محملة
    if (!document.body || document.body.children.length === 0) {
        setTimeout(waitForApp, 500);
        return;
    }
    
    // التحقق من وجود التطبيق
    const appPage = document.getElementById('appPage');
    if (!appPage) {
        setTimeout(waitForApp, 500);
        return;
    }
    
    // التحقق من أننا في التطبيق (ليس تسجيل دخول)
    const loginPage = document.getElementById('loginPage');
    if (loginPage && loginPage.classList.contains('active')) {
        // مراقبة الانتقال للتطبيق
        const observer = new MutationObserver(() => {
            if (appPage.classList.contains('active')) {
                observer.disconnect();
                initVoiceSystem();
            }
        });
        observer.observe(appPage, { attributes: true, attributeFilter: ['class'] });
        return;
    }
    
    // بدء النظام الصوتي
    initVoiceSystem();
}

/**
 * تهيئة النظام الصوتي - النسخة الكاملة
 */
function initVoiceSystem() {
    try {
        console.log('🚀 بدء النظام الصوتي v5.3...');
        
        // التحقق من تفضيلات المستخدم
        if (localStorage.getItem('voiceEnabled') === 'false') {
            console.log('🔇 الصوت معطل من قبل المستخدم');
            return;
        }
        
        // إنشاء النظام
        window.voiceSystem = new VoiceSystemV5();
        
        // تعريف الدوال العامة
        window.processVoiceCommand = processVoiceCommand;
        window.processDeleteCommand = processDeleteCommand;
        
        console.log('✅ النظام الصوتي v5.3 مفعل وجاهز');
        
        // بدء تحديث ذاكرة الاستعلام
        DebtAPI.updateQueryCache();
        
        // اختبار تلقائي
        setTimeout(() => {
            if (window.voiceSystem) {
                window.voiceSystem.showNotification('🎤 النظام الصوتي جاهز للاستخدام', 'success');
            }
        }, 2000);
        
    } catch (error) {
        console.error('❌ خطأ في تهيئة النظام الصوتي:', error);
    }
}

// ============================================================================
// 7) DEBUG TOOLS COMPLETE - أدوات التصحيح الكاملة
// ============================================================================

window.testVoiceSystem = function(command) {
    if (!window.voiceSystem) {
        console.error('❌ النظام الصوتي غير مفعل');
        return;
    }
    
    if (command) {
        console.log('🧪 اختبار يدوي:', command);
        window.voiceSystem.processFinalSpeech(command);
    } else {
        window.voiceSystem.showNotification('🎯 اختبار النظام', 'success');
        window.voiceSystem.speak('اختبار النظام الصوتي');
    }
};

window.voiceStatus = function() {
    console.group('🔍 حالة النظام الصوتي');
    console.log('✅ النظام:', window.voiceSystem ? 'مفعل' : 'معطل');
    console.log('✅ الجسر:', window.voiceSystemBridge ? 'موجود' : 'مفقود');
    console.log('✅ الزر:', document.getElementById('voiceControlBtn') ? 'موجود' : 'مفقود');
    console.log('✅ الحقول:', {
        debtName: document.getElementById('debtName') ? 'موجود' : 'مفقود',
        debtorSelect: document.getElementById('debtorSelect') ? 'موجود' : 'مفقود'
    });
    
    if (window.voiceSystem) {
        const stats = window.voiceSystem.getStats();
        console.log('📊 إحصائيات:', {
            commands: stats.commandsProcessed,
            debtsInMemory: stats.lastKnownDebtsCount,
            hasBridge: stats.hasVoiceBridge
        });
    }
    
    console.groupEnd();
};

// ============================================================================
// 8) اختبار الاستعلام الكامل
// ============================================================================

/**
 * اختبار الاستعلام مباشرة
 */
window.testQuery = function(name = 'محمد') {
    console.log(`🧪 اختبار الاستعلام عن: ${name}`);
    
    if (!window.voiceSystem) {
        console.error('❌ النظام الصوتي غير مفعل');
        return;
    }
    
    // اختبار مباشر
    const testCommand = {
        type: 'query',
        name: name,
        originalText: `اختبار استعلام ${name}`,
        valid: true
    };
    
    window.voiceSystem.handleQueryDebt(testCommand);
};

/**
 * عرض جميع الديون المتاحة
 */
window.showAllDebts = function() {
    console.group('📋 جميع الديون المتاحة');
    
    // من جسر النظام الصوتي
    if (window.voiceSystemBridge) {
        const debts = window.voiceSystemBridge.getAllDebts();
        console.log('✅ من voiceSystemBridge:', debts.length, 'دين');
        debts.forEach((debt, idx) => {
            console.log(`${idx + 1}. ${debt.name || 'بدون اسم'} - ${debt.totalAmount || 0} ريال`);
        });
    }
    
    // من النظام الصوتي
    if (window.voiceSystem && window.voiceSystem.lastKnownDebts) {
        console.log('✅ من voiceSystem:', window.voiceSystem.lastKnownDebts.length, 'دين');
    }
    
    console.groupEnd();
};

// ============================================================================
// 9) زر التبديل من v4
// ============================================================================

// تهيئة النظام عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    // الانتظار قليلاً لتحميل جميع العناصر
    setTimeout(() => {
        try {
            // التحقق من رغبة المستخدم في استخدام الصوت
            const voiceEnabled = localStorage.getItem('voiceEnabled') !== 'false';
            
            if (voiceEnabled) {
                // بدء النظام (سيتم استدعاؤه من waitForApp)
                console.log('🚀 نظام إدارة الديون الصوتي v5.3 - مفعل وجاهز');
                
                // إضافة زر التبديل السريع
                addVoiceToggleButton();
                
            } else {
                console.log('🔇 نظام الصوت معطل من قبل المستخدم');
            }
            
        } catch (error) {
            console.error('❌ فشل في تهيئة النظام الصوتي:', error);
        }
    }, 1500);
});

// إضافة زر التبديل السريع للصوت
function addVoiceToggleButton() {
    const navControls = document.querySelector('.nav-controls');
    if (!navControls) return;
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'voice-toggle-btn';
    toggleBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    toggleBtn.title = 'تفعيل/تعطيل الصوت';
    toggleBtn.style.cssText = `
        background: transparent;
        border: 2px solid #3b82f6;
        color: #3b82f6;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        margin-right: 10px;
        transition: all 0.3s;
    `;
    
    toggleBtn.onclick = () => {
        const voiceBtn = document.getElementById('voiceControlBtn');
        if (voiceBtn) {
            const isHidden = voiceBtn.style.display === 'none';
            
            if (isHidden) {
                voiceBtn.style.display = 'flex';
                localStorage.setItem('voiceEnabled', 'true');
                toggleBtn.style.background = '#3b82f6';
                toggleBtn.style.color = 'white';
                toggleBtn.title = 'تعطيل الصوت';
                
                // إعادة تهيئة النظام إذا لم يكن نشطاً
                if (!window.voiceSystem) {
                    initVoiceSystem();
                }
            } else {
                voiceBtn.style.display = 'none';
                localStorage.setItem('voiceEnabled', 'false');
                toggleBtn.style.background = 'transparent';
                toggleBtn.style.color = '#3b82f6';
                toggleBtn.title = 'تفعيل الصوت';
            }
        }
    };
    
    navControls.prepend(toggleBtn);
}

// ============================================================================
// 10) FINAL INITIALIZATION - التهيئة النهائية
// ============================================================================

// بدء التهيئة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForApp);
} else {
    waitForApp();
}

// اختصار للاستعلام السريع في الكونسول
console.info('💡 استخدم في الكونسول:');
console.info('testVoiceSystem("جملة صوتية") - لاختبار النظام');
console.info('testQuery("اسم") - لاختبار الاستعلام');
console.info('showAllDebts() - لعرض جميع الديون');
console.info('voiceStatus() - لرؤية حالة النظام');
console.info('processVoiceCommand("أمر") - لمعالجة أمر مباشر');

console.log(`
✅ ============================================
✅ VOICE SYSTEM v5.3 - النسخة الكاملة مع نظام الحذف الفعلي
✅ ============================================
✅ ✅ جميع الوظائف الكاملة الآن:
✅ 1. 🧠 نظام تخزين مؤقت ذكي
✅ 2. 🔄 حارس تكرار متقدم
✅ 3. 👤 مصحح أسماء محسن
✅ 4. 💰 مستخرج مبالغ دقيق
✅ 5. 🧩 محلل أوامر كامل
✅ 6. 🔗 DebtAPI كاملة (إضافة، تسديد، استعلام، حذف)
✅ 7. 🎨 واجهة مستخدم محسنة من v4
✅ 8. 🌉 جسر بيانات متكامل مع التطبيق الرئيسي
✅ 9. 🔄 تحديث ذاكرة تلقائي
✅ 10. 🛠️ أدوات تصحيح كاملة
✅ 11. 🔊 زر تبديل صوتي
✅ 12. 🗑️ نظام حذف صوتي فعلي متكامل
✅ ============================================
✅ ✅ النظام الصوتي الكامل جاهز للعمل!
✅ ============================================
`);