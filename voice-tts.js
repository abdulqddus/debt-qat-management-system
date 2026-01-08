/**
 * 🔊 TTS System - نظام التحدث النصي المنفصل
 * نظام صوتي عربي منفصل يمكن استدعاؤه من أي مكان في التطبيق
 */

'use strict';

class TTSSystem {
    constructor() {
        this.isSpeaking = false;
        this.queue = [];
        this.rate = 0.9;
        this.volume = 1;
        this.voices = [];
        this.currentVoice = null;
        this.isInitialized = false;
        
        this.init();
    }
    
    /**
     * تهيئة النظام
     */
    async init() {
        try {
            if (!('speechSynthesis' in window)) {
                console.warn('⚠️ المتصفح لا يدعم نظام التحدث');
                return false;
            }
            
            // انتظار تحميل الأصوات
            this.loadVoices();
            
            // محاولة إيجاد صوت عربي
            setTimeout(() => {
                const arabicVoices = this.voices.filter(v => v.lang.startsWith('ar'));
                if (arabicVoices.length > 0) {
                    this.currentVoice = arabicVoices[0];
                    console.log(`✅ صوت عربي متاح: ${this.currentVoice.name}`);
                }
            }, 1000);
            
            this.isInitialized = true;
            console.log('✅ نظام التحدث جاهز');
            return true;
            
        } catch (error) {
            console.error('❌ خطأ في تهيئة نظام التحدث:', error);
            return false;
        }
    }
    
    /**
     * تحميل الأصوات المتاحة
     */
    loadVoices() {
        this.voices = window.speechSynthesis.getVoices();
        
        if (this.voices.length === 0) {
            setTimeout(() => this.loadVoices(), 500);
        }
    }
    
    /**
     * التحدث بنص معين
     */
    speak(text, options = {}) {
        if (!this.isInitialized || !text) return;
        
        const config = {
            rate: options.rate || this.rate,
            volume: options.volume || this.volume,
            voice: options.voice || this.currentVoice,
            lang: 'ar-SA'
        };
        
        // إلغاء أي كلام سابق
        if (this.isSpeaking) {
            window.speechSynthesis.cancel();
        }
        
        try {
            const utterance = new SpeechSynthesisUtterance(text);
            
            // إعداد الإعدادات
            utterance.rate = config.rate;
            utterance.volume = config.volume;
            utterance.lang = config.lang;
            
            if (config.voice) {
                utterance.voice = config.voice;
            }
            
            // أحداث الكلام
            utterance.onstart = () => {
                this.isSpeaking = true;
                console.log('🔊 بدء التحدث:', text.substring(0, 50) + '...');
            };
            
            utterance.onend = () => {
                this.isSpeaking = false;
                console.log('🔊 انتهاء التحدث');
                
                // معالجة العنصر التالي في الطابور
                if (this.queue.length > 0) {
                    const nextText = this.queue.shift();
                    this.speak(nextText);
                }
            };
            
            utterance.onerror = (event) => {
                this.isSpeaking = false;
                console.error('❌ خطأ في التحدث:', event.error);
            };
            
            // بدء الكلام
            window.speechSynthesis.speak(utterance);
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء النطق:', error);
        }
    }
    
    /**
     * التحدث بشكل متأخر
     */
    speakLater(text, delay = 1000) {
        setTimeout(() => {
            this.speak(text);
        }, delay);
    }
    
    /**
     * إضافة نص إلى طابور التحدث
     */
    queueSpeak(text) {
        if (this.isSpeaking) {
            this.queue.push(text);
        } else {
            this.speak(text);
        }
    }
    
    /**
     * إيقاف التحدث
     */
    stop() {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            this.isSpeaking = false;
            this.queue = [];
        }
    }
    
    /**
     * التحدث برقم عربي
     */
    speakNumber(number) {
        const arabicNumbers = {
            0: 'صفر',
            1: 'واحد',
            2: 'اثنين',
            3: 'ثلاثة',
            4: 'أربعة',
            5: 'خمسة',
            6: 'ستة',
            7: 'سبعة',
            8: 'ثمانية',
            9: 'تسعة',
            10: 'عشرة',
            100: 'مئة',
            1000: 'ألف',
            1000000: 'مليون'
        };
        
        if (arabicNumbers[number]) {
            this.speak(arabicNumbers[number]);
        } else if (number < 20) {
            // الأرقام من 11-19
            const units = number % 10;
            this.speak(`عشرة و ${arabicNumbers[units]}`);
        } else if (number < 100) {
            // الأرقام من 20-99
            const tens = Math.floor(number / 10) * 10;
            const units = number % 10;
            
            if (units === 0) {
                this.speak(arabicNumbers[tens] || `${tens}`);
            } else {
                this.speak(`${arabicNumbers[tens] || tens} و ${arabicNumbers[units]}`);
            }
        } else if (number < 1000) {
            // الأرقام من 100-999
            const hundreds = Math.floor(number / 100);
            const remainder = number % 100;
            
            if (remainder === 0) {
                this.speak(`${arabicNumbers[hundreds]} مئة`);
            } else {
                this.speak(`${arabicNumbers[hundreds]} مئة و`);
                this.speakNumber(remainder);
            }
        } else {
            // الأرقام الكبيرة
            this.speak(number.toLocaleString('ar-SA'));
        }
    }
    
    /**
     * التحدث بمبلغ مالي
     */
    speakAmount(amount, currency = 'ريال') {
        const amountText = amount.toLocaleString('ar-SA');
        this.speak(`${amountText} ${currency}`);
    }
    
    /**
     * التحدث بتاريخ
     */
    speakDate(dateString) {
        const date = new Date(dateString);
        const day = date.toLocaleDateString('ar-SA', { weekday: 'long' });
        const dayNumber = date.getDate();
        const month = date.toLocaleDateString('ar-SA', { month: 'long' });
        const year = date.getFullYear();
        
        this.speak(`يوم ${day} ${dayNumber} ${month} سنة ${year}`);
    }
    
    /**
     * التحدث بوقت
     */
    speakTime(timeOfDay) {
        if (timeOfDay === 'صباحاً') {
            this.speak('في الصباح');
        } else if (timeOfDay === 'ظهراً') {
            this.speak('في الظهر');
        } else if (timeOfDay === 'مساءً') {
            this.speak('في المساء');
        } else if (timeOfDay === 'ليلاً') {
            this.speak('في الليل');
        } else {
            this.speak(timeOfDay);
        }
    }
    
    /**
     * الحصول على حالة النظام
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isSpeaking: this.isSpeaking,
            queueLength: this.queue.length,
            voicesCount: this.voices.length,
            hasArabicVoice: !!this.currentVoice
        };
    }
}

// إنشاء نسخة عامة من النظام
window.TTSSystem = TTSSystem;
window.tts = new TTSSystem();

console.log('✅ نظام التحدث المنفصل جاهز للاستخدام');