/**
 * 💬 Voice Notifications - نظام الإشعارات المنفصل
 * نظام إشعارات منفصل مع مزايا متقدمة
 */

'use strict';

class VoiceNotifications {
    constructor() {
        this.notifications = [];
        this.maxNotifications = 3;
        this.duration = {
            short: 3000,
            normal: 5000,
            long: 8000,
            veryLong: 10000
        };
        this.position = 'top-right'; // top-left, top-right, bottom-left, bottom-right
        this.zIndex = 9999;
        
        this.init();
    }
    
    /**
     * تهيئة النظام
     */
    init() {
        console.log('💬 نظام الإشعارات المنفصل جاهز');
        
        // إضافة الأنماط
        this.injectStyles();
        
        // تنظيف الإشعارات القديمة كل 5 ثواني
        setInterval(() => this.cleanup(), 5000);
    }
    
    /**
     * حقن الأنماط
     */
    injectStyles() {
        const styleId = 'voice-notifications-styles';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .voice-notification {
                position: fixed;
                padding: 16px 24px;
                border-radius: 12px;
                color: white;
                font-family: 'Tajawal', sans-serif;
                font-size: 15px;
                z-index: 10000;
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(10px);
                border-left: 5px solid rgba(255, 255, 255, 0.3);
                max-width: 400px;
                min-width: 300px;
                word-break: break-word;
                line-height: 1.6;
                animation: notificationSlideIn 0.3s ease;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            @keyframes notificationSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            @keyframes notificationFadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            
            .voice-notification.info {
                background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            }
            
            .voice-notification.success {
                background: linear-gradient(135deg, #10b981, #059669);
            }
            
            .voice-notification.warning {
                background: linear-gradient(135deg, #f59e0b, #d97706);
            }
            
            .voice-notification.error {
                background: linear-gradient(135deg, #ef4444, #dc2626);
            }
            
            .voice-notification.query {
                background: linear-gradient(135deg, #0ea5e9, #0369a1);
            }
            
            .voice-notification.delete {
                background: linear-gradient(135deg, #7c3aed, #6d28d9);
            }
            
            .notification-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            
            .notification-title {
                font-weight: bold;
                font-size: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .notification-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s;
            }
            
            .notification-close:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: scale(1.1);
            }
            
            .notification-content {
                font-size: 14px;
                opacity: 0.9;
                line-height: 1.5;
            }
            
            .notification-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 8px;
                font-size: 11px;
                opacity: 0.7;
            }
            
            .notification-timer {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .notification-progress {
                flex: 1;
                height: 3px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 3px;
                overflow: hidden;
            }
            
            .notification-progress-bar {
                height: 100%;
                background: white;
                width: 100%;
                transition: width 0.1s linear;
            }
            
            .notification-action {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                padding: 4px 12px;
                border-radius: 15px;
                font-size: 11px;
                cursor: pointer;
                transition: all 0.3s;
            }
            
            .notification-action:hover {
                background: rgba(255, 255, 255, 0.3);
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * عرض إشعار
     */
    show(options) {
        const config = {
            title: options.title || '',
            message: options.message || '',
            type: options.type || 'info',
            duration: options.duration || 'normal',
            position: options.position || this.position,
            actions: options.actions || [],
            onClose: options.onClose || null,
            onAction: options.onAction || null
        };
        
        // تحديد مدة العرض
        let displayDuration = this.duration[config.duration] || this.duration.normal;
        
        // إنشاء معرف فريد للإشعار
        const id = 'notification-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        // إزالة الإشعارات القديمة إذا تجاوزنا الحد
        if (this.notifications.length >= this.maxNotifications) {
            const oldest = this.notifications.shift();
            this.remove(oldest.id);
        }
        
        // إضافة للإشعارات النشطة
        this.notifications.push({ id, config });
        
        // إنشاء عنصر الإشعار
        const notification = document.createElement('div');
        notification.id = id;
        notification.className = `voice-notification ${config.type}`;
        
        // تحديد الموقع
        const positionStyles = this.getPositionStyles(config.position);
        Object.assign(notification.style, positionStyles);
        
        // إنشاء المحتوى
        notification.innerHTML = this.createNotificationContent(config, displayDuration, id);
        
        // إضافة للصفحة
        document.body.appendChild(notification);
        
        // بدء المؤقت
        this.startTimer(notification, displayDuration, id);
        
        // إضافة أحداث
        this.bindEvents(notification, id, config);
        
        return id;
    }
    
    /**
     * إنشاء محتوى الإشعار
     */
    createNotificationContent(config, duration, id) {
        const icon = this.getIcon(config.type);
        const title = config.title || this.getDefaultTitle(config.type);
        
        return `
            <div class="notification-header">
                <div class="notification-title">
                    ${icon}
                    <span>${title}</span>
                </div>
                <button class="notification-close" data-id="${id}">✕</button>
            </div>
            
            <div class="notification-content">
                ${config.message}
            </div>
            
            <div class="notification-footer">
                <div class="notification-timer">
                    <div class="notification-progress">
                        <div class="notification-progress-bar" id="progress-${id}"></div>
                    </div>
                    <span>${Math.floor(duration/1000)}s</span>
                </div>
                
                ${config.actions.length > 0 ? `
                    <div class="notification-actions">
                        ${config.actions.map((action, index) => `
                            <button class="notification-action" data-action="${action.name}" data-id="${id}">
                                ${action.label}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * الحصول على الأيقونة المناسبة
     */
    getIcon(type) {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            query: '🔍',
            delete: '🗑️'
        };
        return icons[type] || icons.info;
    }
    
    /**
     * الحصول على العنوان الافتراضي
     */
    getDefaultTitle(type) {
        const titles = {
            info: 'معلومة',
            success: 'نجاح',
            warning: 'تحذير',
            error: 'خطأ',
            query: 'استعلام',
            delete: 'حذف'
        };
        return titles[type] || 'إشعار';
    }
    
    /**
     * الحصول على أنماط الموقع
     */
    getPositionStyles(position) {
        const positions = {
            'top-right': { top: '20px', right: '20px' },
            'top-left': { top: '20px', left: '20px' },
            'bottom-right': { bottom: '20px', right: '20px' },
            'bottom-left': { bottom: '20px', left: '20px' },
            'top-center': { top: '20px', left: '50%', transform: 'translateX(-50%)' },
            'bottom-center': { bottom: '20px', left: '50%', transform: 'translateX(-50%)' }
        };
        
        return positions[position] || positions['top-right'];
    }
    
    /**
     * بدء المؤقت
     */
    startTimer(notification, duration, id) {
        const progressBar = document.getElementById(`progress-${id}`);
        if (!progressBar) return;
        
        let timeLeft = duration;
        const updateInterval = 100; // تحديث كل 100ms
        const totalSteps = duration / updateInterval;
        
        const interval = setInterval(() => {
            timeLeft -= updateInterval;
            const progressPercent = (timeLeft / duration) * 100;
            
            if (progressBar) {
                progressBar.style.width = progressPercent + '%';
            }
            
            // تحديث الوقت المتبقي
            const timeElement = notification.querySelector('.notification-timer span');
            if (timeElement) {
                timeElement.textContent = Math.ceil(timeLeft / 1000) + 's';
            }
            
            if (timeLeft <= 0) {
                clearInterval(interval);
                this.remove(id);
            }
        }, updateInterval);
        
        // حفظ المؤقت للإشعار
        notification.dataset.timerId = interval;
    }
    
    /**
     * ربط الأحداث
     */
    bindEvents(notification, id, config) {
        // حدث الإغلاق
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.remove(id);
                if (config.onClose) config.onClose();
            });
        }
        
        // أحداث الأزرار
        const actionBtns = notification.querySelectorAll('.notification-action');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const actionName = btn.dataset.action;
                this.remove(id);
                if (config.onAction) config.onAction(actionName);
            });
        });
        
        // إغلاق عند النقر خارج الإشعار
        notification.addEventListener('click', (e) => {
            if (e.target === notification) {
                this.remove(id);
                if (config.onClose) config.onClose();
            }
        });
    }
    
    /**
     * إزالة إشعار
     */
    remove(id) {
        const notification = document.getElementById(id);
        if (!notification) return;
        
        // إلغاء المؤقت
        if (notification.dataset.timerId) {
            clearInterval(parseInt(notification.dataset.timerId));
        }
        
        // تأثير الخروج
        notification.style.animation = 'notificationFadeOut 0.3s ease';
        notification.style.opacity = '0';
        
        // إزالته بعد التأثير
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
            
            // إزالته من المصفوفة
            this.notifications = this.notifications.filter(n => n.id !== id);
        }, 300);
    }
    
    /**
     * تنظيف جميع الإشعارات
     */
    clearAll() {
        this.notifications.forEach(notification => {
            this.remove(notification.id);
        });
    }
    
    /**
     * تنظيف الإشعارات القديمة
     */
    cleanup() {
        // تنظيف الإشعارات التي لم تعد موجودة في DOM
        this.notifications = this.notifications.filter(notification => {
            const element = document.getElementById(notification.id);
            if (!element) {
                return false;
            }
            return true;
        });
    }
    
    /**
     * عرض إشعار سريع
     */
    quick(message, type = 'info', duration = 'normal') {
        return this.show({
            message,
            type,
            duration
        });
    }
    
    /**
     * عرض إشعار نجاح
     */
    success(message, duration = 'normal') {
        return this.quick(message, 'success', duration);
    }
    
    /**
     * عرض إشعار خطأ
     */
    error(message, duration = 'normal') {
        return this.quick(message, 'error', duration);
    }
    
    /**
     * عرض إشعار تحذير
     */
    warning(message, duration = 'normal') {
        return this.quick(message, 'warning', duration);
    }
    
    /**
     * عرض إشعار استعلام (بوقت أطول)
     */
    query(message, duration = 'long') {
        return this.quick(message, 'query', duration);
    }
    
    /**
     * عرض إشعار حذف
     */
    delete(message, duration = 'normal') {
        return this.quick(message, 'delete', duration);
    }
}

// إنشاء نسخة عامة
window.VoiceNotifications = VoiceNotifications;
window.voiceNotify = new VoiceNotifications();

console.log('💬 نظام الإشعارات المنفصل جاهز للاستخدام');