(function() {
    "use strict";
    
    // 🔥 التحقق من توفر المكتبات المطلوبة
    if (typeof firebase === 'undefined') {
        console.warn('تحذير: مكتبة Firebase غير محملة. وضع عدم الاتصال نشط.');
    }
    
    if (typeof ExcelJS === 'undefined') {
        console.warn('تحذير: مكتبة ExcelJS غير محملة. لن تعمل وظيفة التصدير إلى Excel.');
    }
    
    if (typeof saveAs === 'undefined') {
        console.warn('تحذير: مكتبة FileSaver غير محملة. لن تعمل وظيفة حفظ الملفات.');
    }
    
    // 🔥 تكوين Firebase
    let firebaseConfig;
    try {
        firebaseConfig = window.FIREBASE_CONFIG;
        if (!firebaseConfig || !firebaseConfig.apiKey) {
            throw new Error('Firebase configuration not found');
        }
    } catch (error) {
        console.error('خطأ في تكوين Firebase:', error);
        firebaseConfig = {
            apiKey: "demo-key-only",
            authDomain: "demo.firebaseapp.com",
            databaseURL: "https://demo.firebaseio.com",
            projectId: "demo-project",
            storageBucket: "demo.appspot.com",
            messagingSenderId: "000000000000",
            appId: "1:000000000000:web:0000000000000000"
        };
    }
    
    // تهيئة Firebase
    let auth, database;
    try {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        database = firebase.database();
    } catch (error) {
        console.error('خطأ في تهيئة Firebase:', error);
    }
    
    // مفاتيح التخزين المحلي
    const KEY_USER = 'dq_current_user';
    const KEY_PASSWORD = 'dq_user_password';
    const KEY_DEBTS = 'dq_debts';
    const KEY_QAT = 'dq_qat';

    // المتغيرات العامة
    let currentUser = null;
    let userPassword = null;
    let debts = [];
    let qats = [];
    let isOnline = navigator.onLine;
    let syncInProgress = false;
    let backupData = null;

    // 🚀 نظام العرض الهجين
    let currentViewMode = localStorage.getItem('debtViewMode') || 'table';
    let currentDebtHistoryViewMode = localStorage.getItem('debtHistoryViewMode') || 'table';
    let currentQatViewMode = localStorage.getItem('qatViewMode') || 'table';

    // 🚀 نظام إدارة الأحداث
    const eventManager = {
        listeners: new Map(),
        
        addListener(element, event, handler) {
            if (!element) return;
            if (!this.listeners.has(element)) {
                this.listeners.set(element, new Map());
            }
            element.addEventListener(event, handler);
            this.listeners.get(element).set(event, handler);
        },
        
        removeAllListeners() {
            this.listeners.forEach((events, element) => {
                events.forEach((handler, event) => {
                    element.removeEventListener(event, handler);
                });
            });
            this.listeners.clear();
        },
        
        cleanupElement(element) {
            const events = this.listeners.get(element);
            if (events) {
                events.forEach((handler, event) => {
                    element.removeEventListener(event, handler);
                });
                this.listeners.delete(element);
            }
        }
    };

    // 🚀 نظام البحث مع Debouncing
    function createDebouncedSearch(delay = 300) {
        let timeoutId;
        
        return function(searchFunction, searchTerm) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                searchFunction(searchTerm);
            }, delay);
        };
    }

    const debouncedSearch = createDebouncedSearch(300);

    // الدوال الأساسية
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#ef4444' : 
                        type === 'warning' ? '#f59e0b' : 
                        type === 'info' ? '#3b82f6' : '#10b981'};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            z-index: 10001;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // 🔥 تشفير كلمة المرور
    async function hashPassword(password) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(password + 'salt_' + window.btoa(password));
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.error('خطأ في تشفير كلمة المرور:', error);
            return window.btoa(password + 'salt_' + Date.now());
        }
    }

    async function verifyPassword(password, hashedPassword) {
        const newHash = await hashPassword(password);
        return newHash === hashedPassword;
    }

    function uid(prefix='id'){ 
        return prefix+'_'+Date.now()+'_'+Math.floor(Math.random()*9999); 
    }

    // إدارة الصفحات
    function showApp(){ 
        const loginPage = document.getElementById('loginPage');
        const appPage = document.getElementById('appPage');
        
        if (loginPage) {
            loginPage.classList.remove('active');
            loginPage.classList.add('hidden');
        }
        
        if (appPage) {
            appPage.classList.remove('hidden');
            appPage.classList.add('active');
        }
        
        showPage('dashboardPage');
        updateDateTime();
        refreshUI();
    }
    
    function showLogin(){ 
        const loginPage = document.getElementById('loginPage');
        const appPage = document.getElementById('appPage');
        
        if (loginPage) {
            loginPage.classList.remove('hidden');
            loginPage.classList.add('active');
        }
        
        if (appPage) {
            appPage.classList.remove('active');
            appPage.classList.add('hidden');
        }
        
        document.getElementById('loginName').value = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginMessage').textContent = '';
    }

    function showPage(pageId) {
        // تحديث أزرار التنقل
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-page') === pageId) {
                btn.classList.add('active');
            }
        });
        
        // إخفاء جميع الصفحات وإظهار الصفحة المطلوبة
        document.querySelectorAll('.content-page').forEach(page => {
            page.classList.remove('active');
        });
        
        const pageElement = document.getElementById(pageId);
        if (pageElement) {
            pageElement.classList.add('active');
        }
        
        // إخفاء جميع قوائم الأيام عند تغيير الصفحة
        document.querySelectorAll('.day-selector').forEach(selector => {
            selector.classList.remove('active');
        });
        
        // تحديث الواجهة حسب الصفحة
        if (pageId === 'dashboardPage') {
            updateDashboard();
        } else if (pageId === 'debtsPage') {
            renderDebts();
            updateSummary();
            updateDebtorSelect();
            // إخفاء سجل الدين التفصيلي عند تغيير الصفحة
            const debtHistoryCard = document.getElementById('debtHistoryCard');
            if (debtHistoryCard) debtHistoryCard.classList.add('hidden');
        } else if (pageId === 'qatPage') {
            renderQats();
        } else if (pageId === 'summaryPage') {
            updateSummary();
            renderDebtsSummary();
        } else if (pageId === 'settingsPage') {
            updateSettingsStats();
        }
    }

    function updateDateTime() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };
        
        try {
            const dateTimeString = now.toLocaleDateString('ar-SA', options);
            const currentDateTimeEl = document.getElementById('currentDateTime');
            if (currentDateTimeEl) {
                currentDateTimeEl.textContent = dateTimeString;
            }
        } catch (error) {
            const currentDateTimeEl = document.getElementById('currentDateTime');
            if (currentDateTimeEl) {
                currentDateTimeEl.textContent = now.toLocaleString();
            }
        }
    }

    // نظام إدارة المستخدمين
    async function createAccount(name, password) {
        if(!name || !password){ 
            return { success: false, message: 'الرجاء إدخال اسم المستخدم وكلمة المرور' };
        }
        
        if (password.length < 6) {
            return { success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
        }
        
        const existingUser = localStorage.getItem(KEY_USER);
        if (existingUser === name) {
            return { success: false, message: 'اسم المستخدم موجود مسبقاً' };
        }
        
        try {
            currentUser = name;
            userPassword = await hashPassword(password);
            debts = [];
            qats = [];
            
            localStorage.setItem(KEY_USER, currentUser);
            localStorage.setItem(`${KEY_PASSWORD}_${currentUser}`, userPassword);
            localStorage.setItem(`${KEY_DEBTS}_${currentUser}`, JSON.stringify(debts));
            localStorage.setItem(`${KEY_QAT}_${currentUser}`, JSON.stringify(qats));
            
            showApp();
            
            // محاولة المزامنة مع Firebase
            if (database) {
                try {
                    await database.ref(`users/${currentUser}`).set({
                        debts: debts,
                        qats: qats,
                        password: userPassword,
                        lastSync: new Date().toISOString()
                    });
                } catch (firebaseError) {
                    console.warn('فشل المزامنة مع Firebase:', firebaseError);
                }
            }
            
            return { 
                success: true, 
                message: `تم إنشاء حساب جديد لـ ${name}`,
                user: currentUser
            };
            
        } catch (error) {
            console.error('خطأ في إنشاء الحساب:', error);
            return { success: false, message: 'حدث خطأ في إنشاء الحساب' };
        }
    }

    async function loginUser(name, password) {
        if(!name || !password){ 
            return { success: false, message: 'الرجاء إدخال اسم المستخدم وكلمة المرور' };
        }
        
        try {
            const storedUser = localStorage.getItem(KEY_USER);
            if (storedUser !== name) {
                return { success: false, message: 'اسم المستخدم غير موجود' };
            }
            
            const storedPassword = localStorage.getItem(`${KEY_PASSWORD}_${name}`);
            if (!storedPassword) {
                return { success: false, message: 'كلمة المرور غير صحيحة' };
            }
            
            const isValid = await verifyPassword(password, storedPassword);
            if (!isValid) {
                return { success: false, message: 'كلمة المرور غير صحيحة' };
            }
            
            currentUser = name;
            userPassword = storedPassword;
            
            const storedDebts = localStorage.getItem(`${KEY_DEBTS}_${name}`);
            const storedQat = localStorage.getItem(`${KEY_QAT}_${name}`);
            
            debts = storedDebts ? JSON.parse(storedDebts) : [];
            qats = storedQat ? JSON.parse(storedQat) : [];
            
            showApp();
            
            // محاولة تحميل من Firebase
            if (database) {
                try {
                    await loadFromFirebase();
                } catch (firebaseError) {
                    console.warn('فشل تحميل البيانات من Firebase:', firebaseError);
                }
            }
            
            return { 
                success: true, 
                message: `مرحباً ${name}!`,
                user: currentUser
            };
            
        } catch (error) {
            console.error('خطأ في تسجيل الدخول:', error);
            return { success: false, message: 'حدث خطأ في تسجيل الدخول' };
        }
    }

    // نظام تسجيل الدخول بحساب Google
    function setupGoogleSignIn() {
        const googleSignInBtn = document.getElementById('googleSignInBtn');
        if (!googleSignInBtn || !auth) return;
        
        eventManager.cleanupElement(googleSignInBtn);
        
        eventManager.addListener(googleSignInBtn, 'click', async function() {
            try {
                const originalHTML = googleSignInBtn.innerHTML;
                googleSignInBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارِ التسجيل...';
                googleSignInBtn.disabled = true;
                
                const provider = new firebase.auth.GoogleAuthProvider();
                provider.addScope('email');
                provider.addScope('profile');
                
                const result = await auth.signInWithPopup(provider);
                const user = result.user;
                
                if (!user) {
                    throw new Error('فشل في الحصول على بيانات المستخدم');
                }
                
                currentUser = user.displayName || user.email || `user_${user.uid.substring(0, 8)}`;
                userPassword = await hashPassword(user.uid);
                
                // تحقق مما إذا كان المستخدم موجوداً
                const existingUserData = localStorage.getItem(`${KEY_DEBTS}_${currentUser}`);
                
                if (!existingUserData) {
                    debts = [];
                    qats = [];
                    
                    localStorage.setItem(`${KEY_DEBTS}_${currentUser}`, JSON.stringify(debts));
                    localStorage.setItem(`${KEY_QAT}_${currentUser}`, JSON.stringify(qats));
                } else {
                    const storedDebts = localStorage.getItem(`${KEY_DEBTS}_${currentUser}`);
                    const storedQat = localStorage.getItem(`${KEY_QAT}_${currentUser}`);
                    
                    debts = storedDebts ? JSON.parse(storedDebts) : [];
                    qats = storedQat ? JSON.parse(storedQat) : [];
                }
                
                localStorage.setItem(KEY_USER, currentUser);
                localStorage.setItem(`${KEY_PASSWORD}_${currentUser}`, userPassword);
                
                showApp();
                showToast(`✅ تم تسجيل الدخول بنجاح! مرحباً ${currentUser}`);
                
            } catch (error) {
                console.error('خطأ في تسجيل الدخول بحساب Google:', error);
                showToast('❌ فشل في تسجيل الدخول بحساب Google', 'error');
            } finally {
                googleSignInBtn.innerHTML = '<i class="fab fa-google" style="color: #db4437;"></i> تسجيل الدخول بحساب Google';
                googleSignInBtn.disabled = false;
            }
        });
    }

    // نظام المزامنة
    function updateSyncStatus(status, text) {
        const syncStatus = document.getElementById('syncStatus');
        const syncIcon = document.getElementById('syncIcon');
        const syncText = document.getElementById('syncText');
        
        if (!syncStatus) return;
        
        syncStatus.classList.remove('hidden', 'online', 'offline', 'syncing');
        
        if (status === 'online') {
            syncStatus.classList.add('online');
            if (syncIcon) syncIcon.textContent = '✓';
            if (syncText) syncText.textContent = text || 'مزامنة';
        } else if (status === 'offline') {
            syncStatus.classList.add('offline');
            if (syncIcon) syncIcon.textContent = '!';
            if (syncText) syncText.textContent = text || 'غير متصل';
        } else if (status === 'syncing') {
            syncStatus.classList.add('syncing');
            if (syncIcon) syncIcon.textContent = '↻';
            if (syncText) syncText.textContent = text || 'جارِ المزامنة...';
        }
        
        syncStatus.classList.remove('hidden');
    }

    async function syncToFirebaseWithRetry(maxRetries = 3) {
        if (!currentUser || !isOnline || !database) {
            updateSyncStatus('offline', 'غير متصل');
            return;
        }
        
        if (syncInProgress) return;
        
        syncInProgress = true;
        updateSyncStatus('syncing', 'جارِ حفظ البيانات...');
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await database.ref(`users/${currentUser}`).set({
                    debts: debts,
                    qats: qats,
                    password: userPassword,
                    lastSync: new Date().toISOString()
                });
                
                updateSyncStatus('online', 'تم المزامنة');
                break;
                
            } catch (error) {
                console.error(`محاولة ${attempt} فشلت:`, error);
                
                if (attempt === maxRetries) {
                    updateSyncStatus('offline', 'خطأ في المزامنة');
                    showToast('❌ فشل في حفظ البيانات على السحابة', 'error');
                }
            }
        }
        
        syncInProgress = false;
    }

    async function loadFromFirebase() {
        if (!currentUser || !isOnline || !database) {
            return false;
        }
        
        updateSyncStatus('syncing', 'جارِ تحميل البيانات...');
        
        try {
            const snapshot = await database.ref(`users/${currentUser}`).once('value');
            const data = snapshot.val();
            
            if (data) {
                const cloudDebts = data.debts || [];
                const cloudQats = data.qats || [];
                
                const lastLocalUpdate = localStorage.getItem(`lastUpdate_${currentUser}`);
                const lastCloudUpdate = data.lastSync || '0';
                
                if (new Date(lastCloudUpdate) > new Date(lastLocalUpdate)) {
                    debts = cloudDebts;
                    qats = cloudQats;
                    userPassword = data.password || userPassword;
                    
                    saveToLocalStorage();
                    updateSyncStatus('online', 'تم تحميل البيانات');
                    return true;
                }
            }
        } catch (error) {
            console.error('خطأ في تحميل البيانات:', error);
            updateSyncStatus('offline', 'خطأ في التحميل');
        }
        
        return false;
    }

    function checkConnection() {
        const onlineStatus = navigator.onLine;
        
        if (onlineStatus !== isOnline) {
            isOnline = onlineStatus;
            
            if (isOnline) {
                updateSyncStatus('online', 'متصل - مزامنة');
                setTimeout(() => enhancedSync(), 2000);
            } else {
                updateSyncStatus('offline', 'غير متصل');
            }
        }
    }

    async function enhancedSync() {
        if (!currentUser) return;
        
        try {
            if (database) {
                await loadFromFirebase();
                await syncToFirebaseWithRetry();
            }
        } catch (error) {
            console.error('خطأ في المزامنة:', error);
        }
    }

    // نظام النسخ الاحتياطي
    function backupAllData() {
        try {
            backupData = {
                debts: JSON.parse(JSON.stringify(debts)),
                qats: JSON.parse(JSON.stringify(qats)),
                user: currentUser,
                timestamp: new Date().toISOString(),
                version: '2.0'
            };
            
            localStorage.setItem(`backup_${currentUser}`, JSON.stringify(backupData));
            showToast('✅ تم إنشاء نسخة احتياطية من جميع البيانات', 'success');
            
        } catch (error) {
            console.error('خطأ في النسخ الاحتياطي:', error);
            showToast('❌ فشل في إنشاء نسخة احتياطية', 'error');
        }
    }

    function restoreData() {
        if (!backupData) {
            const storedBackup = localStorage.getItem(`backup_${currentUser}`);
            if (storedBackup) {
                try {
                    backupData = JSON.parse(storedBackup);
                } catch (error) {
                    showToast('❌ ملف النسخة الاحتياطية تالف', 'error');
                    return;
                }
            }
        }
        
        if (!backupData) {
            showToast('❌ لا توجد نسخة احتياطية للاستعادة', 'error');
            return;
        }
        
        if (confirm(`هل تريد استعادة البيانات من النسخة الاحتياطية؟`)) {
            try {
                debts = JSON.parse(JSON.stringify(backupData.debts));
                qats = JSON.parse(JSON.stringify(backupData.qats));
                
                saveToLocalStorage();
                refreshUI();
                
                showToast('✅ تم استعادة جميع البيانات بنجاح', 'success');
                
            } catch (error) {
                console.error('خطأ في استعادة البيانات:', error);
                showToast('❌ فشل في استعادة البيانات', 'error');
            }
        }
    }

    // دوال إدارة البيانات
    function saveToLocalStorage() {
        if (!currentUser) return;
        
        try {
            localStorage.setItem(KEY_USER, currentUser);
            localStorage.setItem(`${KEY_PASSWORD}_${currentUser}`, userPassword);
            localStorage.setItem(`${KEY_DEBTS}_${currentUser}`, JSON.stringify(debts));
            localStorage.setItem(`${KEY_QAT}_${currentUser}`, JSON.stringify(qats));
            localStorage.setItem(`lastUpdate_${currentUser}`, new Date().toISOString());
        } catch (error) {
            console.error('خطأ في حفظ البيانات:', error);
            showToast('❌ فشل في حفظ البيانات محلياً', 'error');
        }
    }

    function loadFromLocalStorage() {
        if (!currentUser) return;
        
        try {
            const storedPassword = localStorage.getItem(`${KEY_PASSWORD}_${currentUser}`);
            const storedDebts = localStorage.getItem(`${KEY_DEBTS}_${currentUser}`);
            const storedQat = localStorage.getItem(`${KEY_QAT}_${currentUser}`);
            
            userPassword = storedPassword || '';
            debts = storedDebts ? JSON.parse(storedDebts) : [];
            qats = storedQat ? JSON.parse(storedQat) : [];
            
            // تأكيد سلامة البيانات
            if (!Array.isArray(debts)) debts = [];
            if (!Array.isArray(qats)) qats = [];
            
            debts = debts.filter(debt => debt && debt.name && debt.totalAmount);
            qats = qats.filter(qat => qat && qat.type && qat.count);
            
            debts.forEach(debt => {
                if (!debt.payments) debt.payments = [];
                if (typeof debt.remainingAmount === 'undefined') {
                    debt.remainingAmount = debt.totalAmount - (debt.paidAmount || 0);
                }
                if (!debt.id) debt.id = uid('d');
            });
            
            refreshUI();
        } catch (error) {
            console.error('خطأ في تحميل البيانات:', error);
            debts = [];
            qats = [];
            saveToLocalStorage();
        }
    }

    function refreshUI(){
        const welcomeText = document.getElementById('welcomeText');
        if (welcomeText) {
            welcomeText.textContent = currentUser ? ('مرحباً، ' + currentUser) : 'مرحباً';
        }
        updateDebtorSelect();
        renderDebts();
        renderQats();
        updateSummary();
        updateDashboard();
        updateSettingsStats();
    }

    // إدارة الديون
    async function addDebt(){
        const nameInput = document.getElementById('debtName');
        const amountInput = document.getElementById('debtAmount');
        const dateInput = document.getElementById('debtDate');
        const timeSelect = document.getElementById('debtTime');
        
        if (!nameInput || !amountInput || !dateInput || !timeSelect) return;
        
        const name = nameInput.value.trim();
        const amount = parseFloat(amountInput.value);
        const date = dateInput.value || new Date().toISOString().slice(0,10);
        const timeOfDay = timeSelect.value || 'صباحاً';
        
        if(!name){ 
            showToast('❌ الرجاء إدخال اسم المتدين', 'error');
            nameInput.focus();
            return; 
        }
        
        if(!amount || amount <= 0 || isNaN(amount)){ 
            showToast('❌ الرجاء إدخال مبلغ صحيح', 'error');
            amountInput.focus();
            return; 
        }

        // البحث عن دين موجود
        const existingDebtIndex = debts.findIndex(debt => 
            debt.name === name && debt.date === date && debt.timeOfDay === timeOfDay
        );

        let successMessage = '';
        
        if (existingDebtIndex !== -1) {
            // تحديث الدين الموجود
            const existingDebt = debts[existingDebtIndex];
            const oldAmount = existingDebt.totalAmount;
            existingDebt.totalAmount += amount;
            existingDebt.remainingAmount += amount;
            successMessage = `تم تحديث دين ${name} من ${oldAmount} إلى ${existingDebt.totalAmount} ريال`;
            
            const updatedDebt = debts.splice(existingDebtIndex, 1)[0];
            debts.unshift(updatedDebt);
        } else {
            // إضافة دين جديد
            const newDebt = {
                id: uid('d'),
                name, 
                totalAmount: amount,
                paidAmount: 0,
                remainingAmount: amount,
                date, 
                timeOfDay,
                payments: [],
                createdAt: new Date().toISOString()
            };
            debts.unshift(newDebt);
            successMessage = `تم إضافة دين جديد لـ ${name} بمبلغ ${amount} ريال`;
        }
        
        saveToLocalStorage();
        await syncToFirebaseWithRetry();
        renderDebts();
        updateSummary();
        updateDashboard();
        updateDebtorSelect();
        
        nameInput.value = '';
        amountInput.value = '';
        dateInput.value = '';
        timeSelect.value = 'صباحاً';
        
        showToast(`✅ ${successMessage}`);
    }

    function updateDebtorSelect() {
        const debtorSelect = document.getElementById('debtorSelect');
        if (!debtorSelect) return;
        
        debtorSelect.innerHTML = '<option value="">👤 اختر المتدين</option>';
        const debtors = {};
        
        debts.forEach(debt => {
            if (debt.remainingAmount > 0) {
                if (!debtors[debt.name]) {
                    debtors[debt.name] = {
                        totalRemaining: 0,
                        debts: []
                    };
                }
                debtors[debt.name].totalRemaining += debt.remainingAmount;
                debtors[debt.name].debts.push(debt);
            }
        });

        Object.keys(debtors).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = `${name} (المتبقي: ${debtors[name].totalRemaining} ريال)`;
            debtorSelect.appendChild(option);
        });
    }

    async function addPayment() {
        const debtorSelect = document.getElementById('debtorSelect');
        const paymentAmount = document.getElementById('paymentAmount');
        const paymentDate = document.getElementById('paymentDate');
        
        if (!debtorSelect || !paymentAmount) return;
        
        const debtorName = debtorSelect.value;
        const amount = parseFloat(paymentAmount.value);
        const date = paymentDate.value || new Date().toISOString().slice(0,10);
        
        if(!debtorName || !amount || amount <= 0){ 
            showToast('الرجاء اختيار المتدين وإدخال مبلغ تسديد صحيح', 'error');
            return; 
        }

        const debtorDebts = debts.filter(debt => 
            debt.name === debtorName && debt.remainingAmount > 0
        );

        if (debtorDebts.length === 0) {
            showToast('لا توجد ديون متبقية لهذا المدين', 'error');
            return;
        }

        let remainingPayment = amount;
        let totalPaid = 0;
        
        debtorDebts.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        for (let debt of debtorDebts) {
            if (remainingPayment <= 0) break;
            
            const paymentAmount = Math.min(remainingPayment, debt.remainingAmount);
            debt.paidAmount += paymentAmount;
            debt.remainingAmount -= paymentAmount;
            remainingPayment -= paymentAmount;
            totalPaid += paymentAmount;
            
            debt.payments.unshift({
                id: uid('p'),
                amount: paymentAmount,
                date
            });
        }

        if (remainingPayment > 0) {
            showToast(`تم تسديد ${totalPaid} ريال، المبلغ الزائد: ${remainingPayment} ريال سيُعاد`, 'warning');
        } else {
            showToast(`تم تسديد ${totalPaid} ريال بنجاح لـ ${debtorName}`);
        }

        saveToLocalStorage();
        await syncToFirebaseWithRetry();
        renderDebts();
        updateSummary();
        updateDashboard();
        updateDebtorSelect();
        
        paymentAmount.value = '';
        paymentDate.value = '';
    }

    // 🚀 نظام العرض الهجين للديون
    function renderDebts() {
        const debtsListEl = document.getElementById('debtsList');
        if (!debtsListEl) return;
        
        eventManager.cleanupElement(debtsListEl);
        debtsListEl.innerHTML = '';
        
        if(!debts || debts.length === 0){ 
            debtsListEl.innerHTML='<p style="text-align:center;padding:20px;color:var(--muted);">لا توجد سجلات</p>'; 
            return; 
        }

        // شريط التحكم بالعرض
        const controlBar = `
            <div class="card" style="margin-bottom:20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <h4 style="margin:0; display:flex; align-items:center; gap:10px;">
                            <i class="fas fa-list"></i>
                            قائمة الديون
                        </h4>
                        <p style="color:var(--muted); margin:5px 0 0 0; font-size:12px;">
                            ${debts.length} سجل دين
                        </p>
                    </div>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <span style="color:var(--muted); font-size:12px;">طريقة العرض:</span>
                        <div style="display:flex; background:var(--card-hover); padding:4px; border-radius:12px;">
                            <button class="view-toggle ${currentViewMode === 'table' ? 'primary small' : 'ghost small'}" data-view="table">
                                <i class="fas fa-table"></i>
                                جدول
                            </button>
                            <button class="view-toggle ${currentViewMode === 'cards' ? 'primary small' : 'ghost small'}" data-view="cards">
                                <i class="fas fa-th-large"></i>
                                بطاقات
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        debtsListEl.innerHTML = controlBar;

        // تحميل المحتوى حسب طريقة العرض
        setTimeout(() => {
            if (currentViewMode === 'table') {
                debtsListEl.innerHTML += createDebtsTable();
            } else {
                debtsListEl.innerHTML += createDebtsCards();
            }
            setupViewToggleEvents();
        }, 10);
    }

    function createDebtsTable() {
        let tableHTML = `
            <div class="card">
                <div class="table-container">
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>👤 اسم المتدين</th>
                                <th>💰 المبلغ الإجمالي</th>
                                <th>✅ المسدد</th>
                                <th>⏳ المتبقي</th>
                                <th>📅 التاريخ</th>
                                <th>⏰ الوقت</th>
                                <th>📊 الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        debts.forEach(debt => {
            const statusColor = getDebtColor(debt.remainingAmount, debt.totalAmount);
            const statusText = debt.remainingAmount === 0 ? 'مسدد' : 
                              debt.paidAmount === 0 ? 'غير مسدد' : 'قيد السداد';
            
            tableHTML += `
                <tr>
                    <td>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-user" style="color:var(--primary);"></i>
                            <strong>${debt.name}</strong>
                        </div>
                    </td>
                    <td><span style="color: var(--warning); font-weight:bold;">${debt.totalAmount.toLocaleString()} ريال</span></td>
                    <td><span style="color: var(--success); font-weight:bold;">${debt.paidAmount.toLocaleString()} ريال</span></td>
                    <td><span class="${statusColor}" style="font-weight:bold;">${debt.remainingAmount.toLocaleString()} ريال</span></td>
                    <td><span style="color: var(--muted);">${debt.date}</span></td>
                    <td><span style="color: var(--info);">${debt.timeOfDay}</span></td>
                    <td>
                        <span style="padding: 4px 12px; border-radius: 15px; font-size: 11px; font-weight: bold; background: ${
                            statusColor === 'debt-paid' ? 'var(--success)' : 
                            statusColor === 'debt-high' ? 'var(--danger)' : 
                            statusColor === 'debt-medium' ? 'var(--warning)' : 'var(--info)'
                        }; color: white;">
                            ${statusText}
                        </span>
                    </td>
                </tr>
            `;
        });

        tableHTML += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        return tableHTML;
    }

    function createDebtsCards() {
        let cardsHTML = `
            <div class="card">
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
        `;

        debts.forEach(debt => {
            const statusColor = getDebtColor(debt.remainingAmount, debt.totalAmount);
            const progressPercent = debt.totalAmount > 0 ? ((debt.paidAmount / debt.totalAmount) * 100).toFixed(1) : '0';
            
            cardsHTML += `
                <div class="debt-card" style="
                    background: linear-gradient(135deg, var(--card) 0%, var(--card-hover) 100%);
                    padding: 20px;
                    border-radius: var(--radius);
                    border-left: 4px solid ${
                        statusColor === 'debt-paid' ? 'var(--success)' : 
                        statusColor === 'debt-high' ? 'var(--danger)' : 
                        statusColor === 'debt-medium' ? 'var(--warning)' : 'var(--info)'
                    };
                    transition: all 0.3s ease;
                    border: 1px solid rgba(255,255,255,0.1);
                ">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div>
                            <h4 style="margin: 0 0 5px 0; color: var(--primary); display:flex; align-items:center; gap:8px;">
                                <i class="fas fa-user"></i>
                                ${debt.name}
                            </h4>
                            <div style="font-size: 12px; color: var(--muted);">
                                ${debt.date} - ${debt.timeOfDay}
                            </div>
                        </div>
                        <span class="${statusColor}" style="font-size: 18px; font-weight: bold;">
                            ${debt.remainingAmount.toLocaleString()} / ${debt.totalAmount.toLocaleString()} ريال
                        </span>
                    </div>
                    
                    <div style="margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px;">
                            <span style="color: var(--success);">
                                <i class="fas fa-check-circle"></i>
                                المسدد: ${debt.paidAmount.toLocaleString()} ريال
                            </span>
                            <span style="color: var(--muted); font-weight: bold;">
                                ${progressPercent}%
                            </span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercent}%; background: ${
                                progressPercent == 100 ? 'var(--success)' : 
                                progressPercent > 70 ? 'var(--primary)' : 
                                progressPercent > 30 ? 'var(--warning)' : 'var(--danger)'
                            };"></div>
                        </div>
                    </div>
                    
                    ${debt.payments && debt.payments.length > 0 ? `
                        <div style="background: rgba(16, 185, 129, 0.1); padding: 10px; border-radius: 8px; margin-top: 10px;">
                            <div style="font-size: 11px; color: var(--success); margin-bottom: 5px;">
                                <i class="fas fa-history"></i>
                                ${debt.payments.length} تسديد
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        cardsHTML += `
                </div>
            </div>
        `;

        return cardsHTML;
    }

    function getDebtColor(remaining, total) {
        if (remaining === 0) return 'debt-paid';
        const percentage = (remaining / total) * 100;
        if (percentage >= 70) return 'debt-high';
        if (percentage >= 30) return 'debt-medium';
        return 'debt-low';
    }

    function updateSummary() {
        const total = debts.reduce((sum, debt) => sum + debt.totalAmount, 0);
        const paid = debts.reduce((sum, debt) => sum + debt.paidAmount, 0);
        const remaining = total - paid;

        const totalDebtsEl = document.getElementById('totalDebts');
        const totalPaidEl = document.getElementById('totalPaid');
        const totalRemainingEl = document.getElementById('totalRemaining');
        
        if (totalDebtsEl) totalDebtsEl.textContent = total.toLocaleString() + ' ريال';
        if (totalPaidEl) totalPaidEl.textContent = paid.toLocaleString() + ' ريال';
        if (totalRemainingEl) totalRemainingEl.textContent = remaining.toLocaleString() + ' ريال';
    }

    // 🚀 نظام العرض الهجين للملخص التفصيلي
    function renderDebtsSummary() {
        const debtsSummaryEl = document.getElementById('debtsSummary');
        if (!debtsSummaryEl) return;
        
        eventManager.cleanupElement(debtsSummaryEl);
        debtsSummaryEl.innerHTML = '';
        
        if(!debts || debts.length === 0){ 
            debtsSummaryEl.innerHTML='<p style="text-align:center;padding:20px;color:var(--muted);">لا توجد سجلات</p>'; 
            return; 
        }

        // شريط التحكم بالعرض
        const controlBar = `
            <div class="card" style="margin-bottom:20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <h4 style="margin:0; display:flex; align-items:center; gap:10px;">
                            <i class="fas fa-chart-pie"></i>
                            ملخص الديون التفصيلي
                        </h4>
                        <p style="color:var(--muted); margin:5px 0 0 0; font-size:12px;">
                            ${debts.length} سجل دين • ${getTotalDebtors()} متدين
                        </p>
                    </div>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <span style="color:var(--muted); font-size:12px;">طريقة العرض:</span>
                        <div style="display:flex; background:var(--card-hover); padding:4px; border-radius:12px;">
                            <button class="view-toggle ${currentViewMode === 'table' ? 'primary small' : 'ghost small'}" data-view="table">
                                <i class="fas fa-table"></i>
                                جدول
                            </button>
                            <button class="view-toggle ${currentViewMode === 'cards' ? 'primary small' : 'ghost small'}" data-view="cards">
                                <i class="fas fa-th-large"></i>
                                بطاقات
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        debtsSummaryEl.innerHTML = controlBar;

        // تحميل المحتوى حسب طريقة العرض
        setTimeout(() => {
            if (currentViewMode === 'table') {
                debtsSummaryEl.innerHTML += createSummaryTable();
            } else {
                debtsSummaryEl.innerHTML += createSummaryCards();
            }
            setupViewToggleEvents();
        }, 10);
    }

    function getTotalDebtors() {
        const debtors = new Set();
        debts.forEach(debt => debtors.add(debt.name));
        return debtors.size;
    }

    function createSummaryTable() {
        const debtors = {};
        let grandTotal = 0, grandPaid = 0, grandRemaining = 0;

        debts.forEach(debt => {
            if (!debtors[debt.name]) {
                debtors[debt.name] = {
                    total: 0,
                    paid: 0,
                    remaining: 0,
                    debtsCount: 0,
                    latestDate: debt.date,
                    paymentsCount: debt.payments ? debt.payments.length : 0
                };
            }
            debtors[debt.name].total += debt.totalAmount;
            debtors[debt.name].paid += debt.paidAmount;
            debtors[debt.name].remaining += debt.remainingAmount;
            debtors[debt.name].debtsCount++;
            
            if (debt.payments) {
                debtors[debt.name].paymentsCount += debt.payments.length;
            }

            grandTotal += debt.totalAmount;
            grandPaid += debt.paidAmount;
            grandRemaining += debt.remainingAmount;
        });

        let tableHTML = `
            <div class="card">
                <div class="table-container">
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>👤 اسم المتدين</th>
                                <th>📊 عدد الديون</th>
                                <th>💰 الإجمالي</th>
                                <th>✅ المسدد</th>
                                <th>⏳ المتبقي</th>
                                <th>🔄 التسديدات</th>
                                <th>📈 نسبة السداد</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        const sortedDebtors = Object.keys(debtors).sort((a, b) => debtors[b].remaining - debtors[a].remaining);

        sortedDebtors.forEach(name => {
            const debtor = debtors[name];
            const statusColor = getDebtColor(debtor.remaining, debtor.total);
            const progressPercent = debtor.total > 0 ? ((debtor.paid / debtor.total) * 100).toFixed(1) : '0';

            tableHTML += `
                <tr>
                    <td>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <div style="width:8px; height:8px; border-radius:50%; background:${
                                statusColor === 'debt-paid' ? 'var(--success)' : 
                                statusColor === 'debt-high' ? 'var(--danger)' : 
                                statusColor === 'debt-medium' ? 'var(--warning)' : 'var(--info)'
                            };"></div>
                            <strong>${name}</strong>
                        </div>
                    </td>
                    <td>${debtor.debtsCount}</td>
                    <td><span style="color: var(--warning); font-weight:bold;">${debtor.total.toLocaleString()} ريال</span></td>
                    <td><span style="color: var(--success); font-weight:bold;">${debtor.paid.toLocaleString()} ريال</span></td>
                    <td><span class="${statusColor}" style="font-weight:bold;">${debtor.remaining.toLocaleString()} ريال</span></td>
                    <td>${debtor.paymentsCount}</td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px; min-width:120px;">
                            <div style="flex: 1; background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; overflow:hidden;">
                                <div style="width: ${progressPercent}%; height: 100%; background: ${
                                    progressPercent == 100 ? 'var(--success)' : 
                                    progressPercent > 70 ? 'var(--primary)' : 
                                    progressPercent > 30 ? 'var(--warning)' : 'var(--danger)'
                                }; border-radius: 4px;"></div>
                            </div>
                            <span style="font-size: 11px; color: var(--muted); font-weight:bold;">${progressPercent}%</span>
                        </div>
                    </td>
                </tr>
            `;
        });

        // صف الإجمالي
        const grandProgressPercent = grandTotal > 0 ? ((grandPaid / grandTotal) * 100).toFixed(1) : '0';

        tableHTML += `
                        </tbody>
                        <tfoot>
                            <tr style="background: rgba(59, 130, 246, 0.1); font-weight: bold; border-top: 2px solid var(--primary);">
                                <td>🏆 الإجمالي</td>
                                <td>${debts.length}</td>
                                <td><span style="color: var(--warning);">${grandTotal.toLocaleString()} ريال</span></td>
                                <td><span style="color: var(--success);">${grandPaid.toLocaleString()} ريال</span></td>
                                <td><span style="color: var(--danger);">${grandRemaining.toLocaleString()} ريال</span></td>
                                <td>${debts.reduce((sum, debt) => sum + (debt.payments ? debt.payments.length : 0), 0)}</td>
                                <td>
                                    <div style="display: flex; align-items: center; gap: 8px; min-width:120px;">
                                        <div style="flex: 1; background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; overflow:hidden;">
                                            <div style="width: ${grandProgressPercent}%; height: 100%; background: ${
                                                grandProgressPercent == 100 ? 'var(--success)' : 
                                                grandProgressPercent > 70 ? 'var(--primary)' : 
                                                grandProgressPercent > 30 ? 'var(--warning)' : 'var(--danger)'
                                            }; border-radius: 4px;"></div>
                                        </div>
                                        <span style="font-size: 11px; color: var(--muted); font-weight:bold;">${grandProgressPercent}%</span>
                                    </div>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;

        return tableHTML;
    }

    function createSummaryCards() {
        const debtors = {};
        let grandTotal = 0, grandPaid = 0, grandRemaining = 0;

        debts.forEach(debt => {
            if (!debtors[debt.name]) {
                debtors[debt.name] = {
                    total: 0,
                    paid: 0,
                    remaining: 0,
                    debtsCount: 0,
                    latestDate: debt.date,
                    payments: []
                };
            }
            debtors[debt.name].total += debt.totalAmount;
            debtors[debt.name].paid += debt.paidAmount;
            debtors[debt.name].remaining += debt.remainingAmount;
            debtors[debt.name].debtsCount++;
            
            if (debt.payments) {
                debtors[debt.name].payments.push(...debt.payments);
            }

            grandTotal += debt.totalAmount;
            grandPaid += debt.paidAmount;
            grandRemaining += debt.remainingAmount;
        });

        let cardsHTML = `
            <div class="card">
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 16px;">
        `;

        const sortedDebtors = Object.keys(debtors).sort((a, b) => debtors[b].remaining - debtors[a].remaining);

        sortedDebtors.forEach(name => {
            const debtor = debtors[name];
            const debtColor = getDebtColor(debtor.remaining, debtor.total);
            const progressPercent = debtor.total > 0 ? ((debtor.paid / debtor.total) * 100).toFixed(1) : '0';

            cardsHTML += `
                <div class="debtor-card" style="
                    background: linear-gradient(135deg, var(--card) 0%, var(--card-hover) 100%);
                    padding: 20px;
                    border-radius: var(--radius);
                    border-left: 4px solid ${
                        debtColor === 'debt-paid' ? 'var(--success)' : 
                        debtColor === 'debt-high' ? 'var(--danger)' : 
                        debtColor === 'debt-medium' ? 'var(--warning)' : 'var(--info)'
                    };
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: 1px solid rgba(255,255,255,0.1);
                ">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div>
                            <h4 style="margin: 0 0 5px 0; color: var(--primary); display:flex; align-items:center; gap:8px;">
                                <i class="fas fa-user"></i>
                                ${name}
                            </h4>
                            <div style="font-size: 12px; color: var(--muted);">
                                ${debtor.debtsCount} دين • آخر تحديث: ${formatDate(debtor.latestDate)}
                            </div>
                        </div>
                        <span class="${debtColor}" style="font-size: 18px; font-weight: bold;">
                            ${debtor.remaining.toLocaleString()} / ${debtor.total.toLocaleString()} ريال
                        </span>
                    </div>
                    
                    <div style="margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px;">
                            <span style="color: var(--success);">
                                <i class="fas fa-check-circle"></i>
                                المسدد: ${debtor.paid.toLocaleString()} ريال
                            </span>
                            <span style="color: var(--muted); font-weight: bold;">
                                ${progressPercent}%
                            </span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercent}%; background: ${
                                progressPercent == 100 ? 'var(--success)' : 
                                progressPercent > 70 ? 'var(--primary)' : 
                                progressPercent > 30 ? 'var(--warning)' : 'var(--danger)'
                            };"></div>
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="padding: 4px 12px; border-radius: 15px; font-size: 11px; font-weight: bold; background: ${
                            debtColor === 'debt-paid' ? 'var(--success)' : 
                            debtColor === 'debt-high' ? 'var(--danger)' : 
                            debtColor === 'debt-medium' ? 'var(--warning)' : 'var(--info)'
                        }; color: white;">
                            ${debtor.remaining === 0 ? 'مسدد بالكامل' : debtor.paid === 0 ? 'لم يبدأ السداد' : 'قيد السداد'}
                        </span>
                        <div style="font-size: 11px; color: var(--muted);">
                            <i class="fas fa-receipt"></i>
                            ${debtor.payments.length} تسديد
                        </div>
                    </div>
                </div>
            `;
        });

        cardsHTML += `
                </div>
                
                <!-- بطاقة الإجمالي -->
                <div style="margin-top: 20px; padding: 20px; background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05)); border-radius: var(--radius); border-left: 4px solid var(--primary);">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; text-align: center;">
                        <div>
                            <div style="font-size: 12px; color: var(--muted); margin-bottom: 5px;">إجمالي الديون</div>
                            <div style="font-size: 20px; font-weight: bold; color: var(--warning);">${grandTotal.toLocaleString()} ريال</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: var(--muted); margin-bottom: 5px;">المسدد</div>
                            <div style="font-size: 20px; font-weight: bold; color: var(--success);">${grandPaid.toLocaleString()} ريال</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: var(--muted); margin-bottom: 5px;">المتبقي</div>
                            <div style="font-size: 20px; font-weight: bold; color: var(--danger);">${grandRemaining.toLocaleString()} ريال</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: var(--muted); margin-bottom: 5px;">نسبة السداد</div>
                            <div style="font-size: 20px; font-weight: bold; color: var(--primary);">
                                ${grandTotal > 0 ? ((grandPaid / grandTotal) * 100).toFixed(1) : '0'}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return cardsHTML;
    }

    function formatDate(dateString) {
        try {
            if (!dateString) return 'غير محدد';
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return 'غير محدد';
            }
            return date.toLocaleDateString('ar-SA');
        } catch (error) {
            return 'غير محدد';
        }
    }

    function updateDashboard() {
        try {
            const total = debts.reduce((sum, debt) => sum + debt.totalAmount, 0);
            const paid = debts.reduce((sum, debt) => sum + debt.paidAmount, 0);
            const remaining = total - paid;
            const totalQat = qats.reduce((sum, qat) => sum + parseInt(qat.count || 0), 0);
            
            const dashboardTotalDebts = document.getElementById('dashboardTotalDebts');
            const dashboardTotalPaid = document.getElementById('dashboardTotalPaid');
            const dashboardTotalRemaining = document.getElementById('dashboardTotalRemaining');
            const dashboardTotalQat = document.getElementById('dashboardTotalQat');
            
            if (dashboardTotalDebts) dashboardTotalDebts.textContent = total.toLocaleString();
            if (dashboardTotalPaid) dashboardTotalPaid.textContent = paid.toLocaleString();
            if (dashboardTotalRemaining) dashboardTotalRemaining.textContent = remaining.toLocaleString();
            if (dashboardTotalQat) dashboardTotalQat.textContent = totalQat.toLocaleString();

            // تحديث الديون الأخيرة
            const recentDebts = debts.slice(0, 5);
            const recentDebtsElement = document.getElementById('recentDebts');
            if (recentDebtsElement) {
                recentDebtsElement.innerHTML = recentDebts.length ? recentDebts.map(debt => `
                    <div class="list-item debt-item">
                        <div>
                            <strong>${debt.name}</strong>
                            <div style="font-size: 12px; color: var(--muted);">
                                ${debt.date} - ${debt.timeOfDay}
                            </div>
                        </div>
                        <span>
                            ${debt.totalAmount} ريال
                        </span>
                    </div>
                `).join('') : '<p style="text-align:center;padding:20px;color:var(--muted);">لا توجد ديون حديثة</p>';
            }
        } catch (error) {
            console.error('خطأ في تحديث لوحة التحكم:', error);
        }
    }

    // 🚀 نظام القات مع العرض الهجين
    async function addQat(){
        const typeInput = document.getElementById('qatType');
        const countInput = document.getElementById('qatCountInput');
        const dateInput = document.getElementById('qatDate');
        
        if (!typeInput || !countInput || !dateInput) return;
        
        const type = typeInput.value.trim();
        const count = countInput.value.trim();
        const date = dateInput.value || new Date().toISOString().slice(0,10);
        
        if(!type || !count){ 
            showToast('الرجاء إدخال نوع وعدد القات', 'error');
            return; 
        }
        
        qats.unshift({
            id: uid('q'), 
            type, 
            count, 
            date
        });
        
        saveToLocalStorage();
        await syncToFirebaseWithRetry();
        renderQats();
        updateDashboard();
        updateSettingsStats();
        showToast(`تم إضافة ${count} من نوع ${type}`);
        
        typeInput.value = '';
        countInput.value = '';
        dateInput.value = '';
    }

    function renderQats(){
        const qatListEl = document.getElementById('qatList');
        if (!qatListEl) return;
        
        eventManager.cleanupElement(qatListEl);
        qatListEl.innerHTML = '';
        
        if(!qats || qats.length === 0){ 
            qatListEl.innerHTML='<p style="text-align:center;padding:20px;color:var(--muted);">لا توجد سجلات</p>'; 
            return; 
        }

        // شريط التحكم بالعرض
        const controlBar = `
            <div class="card" style="margin-bottom:20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <h4 style="margin:0; display:flex; align-items:center; gap:10px;">
                            <i class="fas fa-leaf"></i>
                            سجل القات
                        </h4>
                        <p style="color:var(--muted); margin:5px 0 0 0; font-size:12px;">
                            ${qats.length} سجل قات • ${getTotalQatTypes()} نوع
                        </p>
                    </div>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <span style="color:var(--muted); font-size:12px;">طريقة العرض:</span>
                        <div style="display:flex; background:var(--card-hover); padding:4px; border-radius:12px;">
                            <button class="qat-view-toggle ${currentQatViewMode === 'table' ? 'primary small' : 'ghost small'}" data-view="table">
                                <i class="fas fa-table"></i>
                                جدول
                            </button>
                            <button class="qat-view-toggle ${currentQatViewMode === 'cards' ? 'primary small' : 'ghost small'}" data-view="cards">
                                <i class="fas fa-th-large"></i>
                                بطاقات
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        qatListEl.innerHTML = controlBar;

        // تحميل المحتوى حسب طريقة العرض
        setTimeout(() => {
            if (currentQatViewMode === 'table') {
                qatListEl.innerHTML += createQatTable();
            } else {
                qatListEl.innerHTML += createQatCards();
            }
            setupViewToggleEvents();
        }, 10);
    }

    function getTotalQatTypes() {
        const types = new Set();
        qats.forEach(qat => types.add(qat.type));
        return types.size;
    }

    function createQatTable() {
        let tableHTML = `
            <div class="card">
                <div class="table-container">
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>🌿 نوع القات</th>
                                <th>🔢 العدد</th>
                                <th>📅 التاريخ</th>
                                <th>📊 اليوم</th>
                                <th>🔄 الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        qats.forEach((qat, index) => {
            const dayName = getDayName(qat.date);
            tableHTML += `
                <tr>
                    <td>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-leaf" style="color:var(--success);"></i>
                            <strong>${qat.type}</strong>
                        </div>
                    </td>
                    <td><span style="color: var(--warning); font-weight:bold;">${qat.count}</span></td>
                    <td><span style="color: var(--muted);">${qat.date}</span></td>
                    <td><span style="color: var(--info); font-weight:bold;">${dayName}</span></td>
                    <td>
                        <button class="ghost small delete-qat" data-index="${index}">
                            <i class="fas fa-trash"></i>
                            حذف
                        </button>
                    </td>
                </tr>
            `;
        });

        tableHTML += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        return tableHTML;
    }

    function createQatCards() {
        let cardsHTML = `
            <div class="card">
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
        `;

        qats.forEach((qat, index) => {
            const dayName = getDayName(qat.date);
            cardsHTML += `
                <div class="qat-card" style="
                    background: linear-gradient(135deg, var(--card) 0%, var(--card-hover) 100%);
                    padding: 20px;
                    border-radius: var(--radius);
                    border-left: 4px solid var(--success);
                    transition: all 0.3s ease;
                    border: 1px solid rgba(255,255,255,0.1);
                ">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div>
                            <h4 style="margin: 0 0 5px 0; color: var(--success); display:flex; align-items:center; gap:8px;">
                                <i class="fas fa-leaf"></i>
                                ${qat.type}
                            </h4>
                            <div style="font-size: 12px; color: var(--muted);">
                                ${qat.date} - ${dayName}
                            </div>
                        </div>
                        <span style="font-size: 24px; font-weight: bold; color: var(--warning);">
                            ${qat.count}
                        </span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="padding: 4px 12px; border-radius: 15px; font-size: 11px; font-weight: bold; background: var(--success); color: white;">
                            سجل قات
                        </span>
                        <button class="ghost small delete-qat" data-index="${index}">
                            <i class="fas fa-trash"></i>
                            حذف
                        </button>
                    </div>
                </div>
            `;
        });

        cardsHTML += `
                </div>
            </div>
        `;

        return cardsHTML;
    }

    function getDayName(dateString) {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return 'غير محدد';
            }
            const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
            return days[date.getDay()];
        } catch (error) {
            return 'غير محدد';
        }
    }

    // حذف سجل القات
    function deleteQat(index) {
        if (index < 0 || index >= qats.length) return;
        
        const qatToDelete = qats[index];
        
        if (confirm(`هل تريد حذف سجل القات: ${qatToDelete.type} - ${qatToDelete.count}؟`)) {
            qats.splice(index, 1);
            saveToLocalStorage();
            syncToFirebaseWithRetry();
            renderQats();
            updateDashboard();
            updateSettingsStats();
            showToast('✅ تم حذف سجل القات بنجاح');
        }
    }

    // 🚀 نظام سجل الدين التفصيلي مع العرض الهجين
    function showDebtHistory(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            showToast('⚠️ الرجاء إدخال نص للبحث', 'warning');
            return;
        }
        
        const matchingDebts = debts.filter(debt => 
            debt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            debt.date.includes(searchTerm)
        );

        if (matchingDebts.length === 0) {
            showToast('❌ لا توجد نتائج للبحث', 'error');
            return;
        }

        const debtHistoryCard = document.getElementById('debtHistoryCard');
        const debtHistoryList = document.getElementById('debtHistoryList');
        
        if (debtHistoryCard && debtHistoryList) {
            debtHistoryCard.classList.remove('hidden');
            
            // شريط التحكم بالعرض
            const controlBar = `
                <div class="card" style="margin-bottom:20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                        <div>
                            <h4 style="margin:0; display:flex; align-items:center; gap:10px;">
                                <i class="fas fa-history"></i>
                                سجل الدين التفصيلي
                            </h4>
                            <p style="color:var(--muted); margin:5px 0 0 0; font-size:12px;">
                                ${matchingDebts.length} سجل • ${new Set(matchingDebts.map(d => d.name)).size} متدين
                            </p>
                        </div>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <span style="color:var(--muted); font-size:12px;">طريقة العرض:</span>
                            <div style="display:flex; background:var(--card-hover); padding:4px; border-radius:12px;">
                                <button class="debt-history-view-toggle ${currentDebtHistoryViewMode === 'table' ? 'primary small' : 'ghost small'}" data-view="table">
                                    <i class="fas fa-table"></i>
                                    جدول
                                </button>
                                <button class="debt-history-view-toggle ${currentDebtHistoryViewMode === 'cards' ? 'primary small' : 'ghost small'}" data-view="cards">
                                    <i class="fas fa-th-large"></i>
                                    بطاقات
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            debtHistoryList.innerHTML = controlBar;

            // تحميل المحتوى حسب طريقة العرض
            setTimeout(() => {
                if (currentDebtHistoryViewMode === 'table') {
                    debtHistoryList.innerHTML += createDebtHistoryTable(matchingDebts, searchTerm);
                } else {
                    debtHistoryList.innerHTML += createDebtHistoryCards(matchingDebts, searchTerm);
                }
                setupViewToggleEvents();
                
                // التمرير إلى قسم السجل التفصيلي
                debtHistoryCard.scrollIntoView({ behavior: 'smooth' });
                showToast(`📊 عرض السجل التفصيلي لـ ${new Set(matchingDebts.map(d => d.name)).size} متدين`);
            }, 10);
        }
    }

    function createDebtHistoryTable(matchingDebts, searchTerm) {
        const debtGroups = {};
        matchingDebts.forEach(debt => {
            const key = `${debt.name}-${debt.date}-${debt.timeOfDay}`;
            if (!debtGroups[key]) {
                debtGroups[key] = {
                    name: debt.name,
                    date: debt.date,
                    timeOfDay: debt.timeOfDay,
                    dayName: getDayName(debt.date),
                    totalAmount: 0,
                    paidAmount: 0,
                    remainingAmount: 0,
                    payments: []
                };
            }
            debtGroups[key].totalAmount += debt.totalAmount;
            debtGroups[key].paidAmount += debt.paidAmount;
            debtGroups[key].remainingAmount += debt.remainingAmount;
            if (debt.payments) {
                debtGroups[key].payments.push(...debt.payments);
            }
        });

        let tableHTML = `
            <div class="card">
                <div class="table-container">
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>👤 الاسم</th>
                                <th>💰 المبلغ</th>
                                <th>📅 اليوم</th>
                                <th>📆 التاريخ</th>
                                <th>✅ المسدد</th>
                                <th>⏳ المتبقي</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        Object.values(debtGroups).forEach(debt => {
            const debtColor = getDebtColor(debt.remainingAmount, debt.totalAmount);
            
            tableHTML += `
                <tr>
                    <td>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-user" style="color:var(--primary);"></i>
                            <strong>${debt.name}</strong>
                        </div>
                    </td>
                    <td><span style="color: var(--warning); font-weight:bold;">${debt.totalAmount.toLocaleString()} ريال</span></td>
                    <td><span style="color: var(--info); font-weight:bold;">${debt.dayName} - ${debt.timeOfDay}</span></td>
                    <td><span style="color: var(--muted);">${debt.date}</span></td>
                    <td><span style="color: var(--success); font-weight:bold;">${debt.paidAmount.toLocaleString()} ريال</span></td>
                    <td><span class="${debtColor}" style="font-weight:bold;">${debt.remainingAmount.toLocaleString()} ريال</span></td>
                </tr>
            `;
        });

        // صف الإجمالي
        const totalAmount = matchingDebts.reduce((sum, debt) => sum + debt.totalAmount, 0);
        const totalPaid = matchingDebts.reduce((sum, debt) => sum + debt.paidAmount, 0);
        const totalRemaining = totalAmount - totalPaid;
        const totalStatusColor = getDebtColor(totalRemaining, totalAmount);

        tableHTML += `
                        </tbody>
                        <tfoot>
                            <tr style="background: rgba(59, 130, 246, 0.1); font-weight: bold; border-top: 2px solid var(--primary);">
                                <td>🏆 الإجمالي</td>
                                <td><span style="color: var(--warning);">${totalAmount.toLocaleString()} ريال</span></td>
                                <td>-</td>
                                <td>-</td>
                                <td><span style="color: var(--success);">${totalPaid.toLocaleString()} ريال</span></td>
                                <td><span class="${totalStatusColor}">${totalRemaining.toLocaleString()} ريال</span></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;

        return tableHTML;
    }

    function createDebtHistoryCards(matchingDebts, searchTerm) {
        const debtors = {};
        matchingDebts.forEach(debt => {
            if (!debtors[debt.name]) {
                debtors[debt.name] = {
                    total: 0,
                    paid: 0,
                    remaining: 0,
                    debts: []
                };
            }
            debtors[debt.name].total += debt.totalAmount;
            debtors[debt.name].paid += debt.paidAmount;
            debtors[debt.name].remaining += debt.remainingAmount;
            debtors[debt.name].debts.push(debt);
        });

        let cardsHTML = `
            <div class="card">
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 16px;">
        `;

        Object.keys(debtors).forEach(name => {
            const debtor = debtors[name];
            const debtColor = getDebtColor(debtor.remaining, debtor.total);
            const progressPercent = debtor.total > 0 ? ((debtor.paid / debtor.total) * 100).toFixed(1) : '0';

            cardsHTML += `
                <div class="debtor-card" style="
                    background: linear-gradient(135deg, var(--card) 0%, var(--card-hover) 100%);
                    padding: 20px;
                    border-radius: var(--radius);
                    border-left: 4px solid ${
                        debtColor === 'debt-paid' ? 'var(--success)' : 
                        debtColor === 'debt-high' ? 'var(--danger)' : 
                        debtColor === 'debt-medium' ? 'var(--warning)' : 'var(--info)'
                    };
                    transition: all 0.3s ease;
                    border: 1px solid rgba(255,255,255,0.1);
                ">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div>
                            <h4 style="margin: 0 0 5px 0; color: var(--primary); display:flex; align-items:center; gap:8px;">
                                <i class="fas fa-user"></i>
                                ${name}
                            </h4>
                            <div style="font-size: 12px; color: var(--muted);">
                                ${debtor.debts.length} سجل • ${new Set(debtor.debts.map(d => d.date)).size} يوم
                            </div>
                        </div>
                        <span class="${debtColor}" style="font-size: 18px; font-weight: bold;">
                            ${debtor.remaining.toLocaleString()} / ${debtor.total.toLocaleString()} ريال
                        </span>
                    </div>
                    
                    <div style="margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px;">
                            <span style="color: var(--success);">
                                <i class="fas fa-check-circle"></i>
                                المسدد: ${debtor.paid.toLocaleString()} ريال
                            </span>
                            <span style="color: var(--muted); font-weight: bold;">
                                ${progressPercent}%
                            </span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercent}%; background: ${
                                progressPercent == 100 ? 'var(--success)' : 
                                progressPercent > 70 ? 'var(--primary)' : 
                                progressPercent > 30 ? 'var(--warning)' : 'var(--danger)'
                            };"></div>
                        </div>
                    </div>
                </div>
            `;
        });

        cardsHTML += `
                </div>
            </div>
        `;

        return cardsHTML;
    }

    // 🚀 إعداد الأحداث المحسنة
    function setupEventListeners() {
        // أحداث تسجيل الدخول
        const btnLogin = document.getElementById('btnLogin');
        const btnRegister = document.getElementById('btnRegister');
        const logoutBtn = document.getElementById('logoutBtn');

        if (btnLogin) {
            eventManager.addListener(btnLogin, 'click', async function(){
                const name = document.getElementById('loginName').value.trim();
                const password = document.getElementById('loginPassword').value.trim();
                
                const result = await loginUser(name, password);
                
                if (result.success) {
                    showToast(result.message);
                } else {
                    const loginMessage = document.getElementById('loginMessage');
                    if (loginMessage) {
                        loginMessage.textContent = result.message;
                    }
                }
            });
        }

        if (btnRegister) {
            eventManager.addListener(btnRegister, 'click', async function(){
                const name = document.getElementById('loginName').value.trim();
                const password = document.getElementById('loginPassword').value.trim();
                
                const result = await createAccount(name, password);
                
                if (result.success) {
                    showToast(result.message);
                } else {
                    const loginMessage = document.getElementById('loginMessage');
                    if (loginMessage) {
                        loginMessage.textContent = result.message;
                    }
                }
            });
        }

        if (logoutBtn) {
            eventManager.addListener(logoutBtn, 'click', ()=>{
                localStorage.removeItem(KEY_USER);
                currentUser = null;
                userPassword = null;
                debts = [];
                qats = [];
                showLogin();
                showToast('تم تسجيل الخروج بنجاح');
            });
        }

        // أحداث التنقل
        document.querySelectorAll('.nav-btn').forEach(btn => {
            eventManager.addListener(btn, 'click', function() {
                const pageId = this.getAttribute('data-page');
                if (pageId) {
                    showPage(pageId);
                }
            });
        });

        // أحداث الديون
        const saveDebtBtn = document.getElementById('saveDebt');
        const savePaymentBtn = document.getElementById('savePayment');
        const saveQatBtn = document.getElementById('saveQat');
        const clearDebtBtn = document.getElementById('clearDebt');
        const clearQatBtn = document.getElementById('clearQat');
        
        if (saveDebtBtn) eventManager.addListener(saveDebtBtn, 'click', addDebt);
        if (savePaymentBtn) eventManager.addListener(savePaymentBtn, 'click', addPayment);
        if (saveQatBtn) eventManager.addListener(saveQatBtn, 'click', addQat);
        
        if (clearDebtBtn) {
            eventManager.addListener(clearDebtBtn, 'click', () => {
                const debtName = document.getElementById('debtName');
                const debtAmount = document.getElementById('debtAmount');
                const debtDate = document.getElementById('debtDate');
                const debtTime = document.getElementById('debtTime');
                
                if (debtName) debtName.value = '';
                if (debtAmount) debtAmount.value = '';
                if (debtDate) debtDate.value = '';
                if (debtTime) debtTime.value = 'صباحاً';
                showToast('تم تفريغ الحقول');
            });
        }
        
        if (clearQatBtn) {
            eventManager.addListener(clearQatBtn, 'click', () => {
                const qatType = document.getElementById('qatType');
                const qatCount = document.getElementById('qatCountInput');
                const qatDate = document.getElementById('qatDate');
                
                if (qatType) qatType.value = '';
                if (qatCount) qatCount.value = '';
                if (qatDate) qatDate.value = '';
                showToast('تم تفريغ الحقول');
            });
        }

        // أحداث التاريخ
        const setTodayDebt = document.getElementById('setTodayDebt');
        const setYesterdayDebt = document.getElementById('setYesterdayDebt');
        const setTodayQat = document.getElementById('setTodayQat');
        const setYesterdayQat = document.getElementById('setYesterdayQat');
        const setTodayPayment = document.getElementById('setTodayPayment');
        const setYesterdayPayment = document.getElementById('setYesterdayPayment');
        
        if (setTodayDebt) eventManager.addListener(setTodayDebt, 'click', () => setDateToField('debtDate', 0));
        if (setYesterdayDebt) eventManager.addListener(setYesterdayDebt, 'click', () => setDateToField('debtDate', -1));
        if (setTodayQat) eventManager.addListener(setTodayQat, 'click', () => setDateToField('qatDate', 0));
        if (setYesterdayQat) eventManager.addListener(setYesterdayQat, 'click', () => setDateToField('qatDate', -1));
        if (setTodayPayment) eventManager.addListener(setTodayPayment, 'click', () => setDateToField('paymentDate', 0));
        if (setYesterdayPayment) eventManager.addListener(setYesterdayPayment, 'click', () => setDateToField('paymentDate', -1));

        // أحداث التصدير
        const exportExcel = document.getElementById('exportExcel');
        const exportWord = document.getElementById('exportWord');
        const exportSummaryExcel = document.getElementById('exportSummaryExcel');
        const exportSummaryWord = document.getElementById('exportSummaryWord');
        
        if (exportExcel) eventManager.addListener(exportExcel, 'click', exportDebtsToExcel);
        if (exportWord) eventManager.addListener(exportWord, 'click', exportDebtsToWord);
        if (exportSummaryExcel) eventManager.addListener(exportSummaryExcel, 'click', exportSummaryToExcel);
        if (exportSummaryWord) eventManager.addListener(exportSummaryWord, 'click', exportSummaryToWord);

        // أحداث الإدارة
        const changePassword = document.getElementById('changePassword');
        const deleteData = document.getElementById('deleteData');
        const exportAllData = document.getElementById('exportAllData');
        const importData = document.getElementById('importData');
        
        if (changePassword) eventManager.addListener(changePassword, 'click', showChangePasswordModal);
        if (deleteData) eventManager.addListener(deleteData, 'click', showDeleteAllDataModal);
        if (exportAllData) eventManager.addListener(exportAllData, 'click', exportDataToFile);
        if (importData) eventManager.addListener(importData, 'click', importDataFromFile);

        // أحداث نافذة كلمة المرور
        const saveNewPassword = document.getElementById('saveNewPassword');
        const cancelChangePassword = document.getElementById('cancelChangePassword');
        
        if (saveNewPassword) eventManager.addListener(saveNewPassword, 'click', changePasswordHandler);
        if (cancelChangePassword) {
            eventManager.addListener(cancelChangePassword, 'click', () => {
                hideModal('changePasswordModal');
            });
        }

        // أحداث نافذة حذف البيانات
        const confirmDeleteAll = document.getElementById('confirmDeleteAll');
        const cancelDeleteAll = document.getElementById('cancelDeleteAll');
        
        if (confirmDeleteAll) eventManager.addListener(confirmDeleteAll, 'click', deleteAllData);
        if (cancelDeleteAll) {
            eventManager.addListener(cancelDeleteAll, 'click', () => {
                hideModal('deleteConfirmModal');
            });
        }

        // أحداث نافذة التصدير
        const closeExportModal = document.getElementById('closeExportModal');
        const exportDebtsExcelBtn = document.getElementById('exportDebtsExcelBtn');
        const exportDebtsWordBtn = document.getElementById('exportDebtsWordBtn');
        const exportSummaryExcelBtn = document.getElementById('exportSummaryExcelBtn');
        const exportSummaryWordBtn = document.getElementById('exportSummaryWordBtn');
        
        if (closeExportModal) {
            eventManager.addListener(closeExportModal, 'click', () => {
                hideModal('exportModal');
            });
        }
        
        if (exportDebtsExcelBtn) eventManager.addListener(exportDebtsExcelBtn, 'click', exportDebtsToExcel);
        if (exportDebtsWordBtn) eventManager.addListener(exportDebtsWordBtn, 'click', exportDebtsToWord);
        if (exportSummaryExcelBtn) eventManager.addListener(exportSummaryExcelBtn, 'click', exportSummaryToExcel);
        if (exportSummaryWordBtn) eventManager.addListener(exportSummaryWordBtn, 'click', exportSummaryToWord);

        // أحداث البحث مع Debouncing
        const searchDebts = document.getElementById('searchDebts');
        const searchQat = document.getElementById('searchQat');
        const quickSearchBtn = document.getElementById('quickSearchBtn');
        const searchQatBtn = document.getElementById('searchQatBtn');
        
        if (searchDebts) {
            eventManager.addListener(searchDebts, 'input', function() {
                const searchTerm = this.value.toLowerCase();
                debouncedSearch(filterDebts, searchTerm);
            });
            
            // حدث الضغط على Enter للانتقال للسجل التفصيلي
            eventManager.addListener(searchDebts, 'keypress', function(e) {
                if (e.key === 'Enter' || e.keyCode === 13) {
                    const searchTerm = this.value.trim();
                    if (searchTerm) {
                        showDebtHistory(searchTerm);
                    }
                }
            });
        }

        if (searchQat) {
            eventManager.addListener(searchQat, 'input', function() {
                const searchTerm = this.value.toLowerCase();
                debouncedSearch(filterQats, searchTerm);
            });

            // حدث الضغط على Enter للبحث في القات
            eventManager.addListener(searchQat, 'keypress', function(e) {
                if (e.key === 'Enter' || e.keyCode === 13) {
                    const searchTerm = this.value.trim();
                    if (searchTerm) {
                        filterQats(searchTerm);
                        showToast(`عرض نتائج البحث عن: "${searchTerm}"`);
                    }
                }
            });
        }

        // حدث زر البحث السريع
        if (quickSearchBtn) {
            eventManager.addListener(quickSearchBtn, 'click', function() {
                const searchTerm = document.getElementById('searchDebts').value.trim();
                if (searchTerm) {
                    showDebtHistory(searchTerm);
                } else {
                    showToast('⚠️ الرجاء إدخال اسم أو تاريخ للبحث', 'warning');
                }
            });
        }

        // حدث زر البحث في القات
        if (searchQatBtn) {
            eventManager.addListener(searchQatBtn, 'click', function() {
                const searchTerm = document.getElementById('searchQat').value.trim();
                if (searchTerm) {
                    filterQats(searchTerm);
                    showToast(`عرض نتائج البحث عن: "${searchTerm}"`);
                } else {
                    showToast('⚠️ الرجاء إدخال نص للبحث', 'warning');
                }
            });
        }

        // حدث إغلاق سجل الدين التفصيلي
        const closeDebtHistory = document.getElementById('closeDebtHistory');
        if (closeDebtHistory) {
            eventManager.addListener(closeDebtHistory, 'click', function() {
                const debtHistoryCard = document.getElementById('debtHistoryCard');
                if (debtHistoryCard) debtHistoryCard.classList.add('hidden');
            });
        }

        // أزرار لوحة التحكم السريعة
        const quickAddDebt = document.getElementById('quickAddDebt');
        const quickAddPayment = document.getElementById('quickAddPayment');
        const quickAddQat = document.getElementById('quickAddQat');
        const quickExport = document.getElementById('quickExport');
        
        if (quickAddDebt) eventManager.addListener(quickAddDebt, 'click', () => {
            showPage('debtsPage');
            setTimeout(() => {
                const debtName = document.getElementById('debtName');
                if (debtName) debtName.focus();
            }, 300);
        });
        
        if (quickAddPayment) eventManager.addListener(quickAddPayment, 'click', () => {
            showPage('debtsPage');
            setTimeout(() => {
                const debtorSelect = document.getElementById('debtorSelect');
                if (debtorSelect) debtorSelect.focus();
            }, 300);
        });
        
        if (quickAddQat) eventManager.addListener(quickAddQat, 'click', () => {
            showPage('qatPage');
            setTimeout(() => {
                const qatType = document.getElementById('qatType');
                if (qatType) qatType.focus();
            }, 300);
        });
        
        if (quickExport) eventManager.addListener(quickExport, 'click', showExportOptions);

        // 🚀 إعداد قوائم الأيام
        setupDaysDropdowns();
        
        // 🚀 إعداد أحداث التبديل
        setupViewToggleEvents();
    }

    function hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
    }

    // 🚀 إعداد قوائم الأيام
    function setupDaysDropdowns() {
        const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        
        // إعداد قوائم الأيام للدين
        const daysDropdownDebt = document.getElementById('daysDropdownDebt');
        if (daysDropdownDebt) {
            daysDropdownDebt.innerHTML = days.map((day, index) => `
                <button type="button" data-day="${index}">${day}</button>
            `).join('');
        }

        // إعداد قوائم الأيام للتسديد
        const daysDropdownPayment = document.getElementById('daysDropdownPayment');
        if (daysDropdownPayment) {
            daysDropdownPayment.innerHTML = days.map((day, index) => `
                <button type="button" data-day="${index}">${day}</button>
            `).join('');
        }

        // إعداد قوائم الأيام للقات
        const daysDropdownQat = document.getElementById('daysDropdownQat');
        if (daysDropdownQat) {
            daysDropdownQat.innerHTML = days.map((day, index) => `
                <button type="button" data-day="${index}">${day}</button>
            `).join('');
        }

        // إعداد أحداث قوائم الأيام
        document.querySelectorAll('.days-dropdown button').forEach(button => {
            eventManager.addListener(button, 'click', (e) => {
                const dayOfWeek = parseInt(e.target.getAttribute('data-day'));
                const selector = e.target.closest('.day-selector');
                const dateField = selector.parentElement.querySelector('input[type="date"]');
                
                setDateByDayOfWeek(dateField, dayOfWeek);
                if (selector) selector.classList.remove('active');
            });
        });

        // إظهار/إخفاء القوائم
        document.querySelectorAll('.day-selector > button').forEach(button => {
            eventManager.addListener(button, 'click', (e) => {
                e.stopPropagation();
                const selector = e.target.closest('.day-selector');
                document.querySelectorAll('.day-selector').forEach(s => {
                    if (s !== selector) s.classList.remove('active');
                });
                if (selector) selector.classList.toggle('active');
            });
        });

        // إخفاء القوائم عند النقر خارجها
        eventManager.addListener(document, 'click', () => {
            document.querySelectorAll('.day-selector').forEach(selector => {
                selector.classList.remove('active');
            });
        });
    }

    function setDateByDayOfWeek(dateField, dayOfWeek) {
        if (!dateField || isNaN(dayOfWeek)) return;
        
        const date = new Date();
        const currentDay = date.getDay();
        const diff = dayOfWeek - currentDay;
        date.setDate(date.getDate() + diff);
        dateField.value = date.toISOString().slice(0,10);
    }

    function setDateToField(fieldId, daysOffset = 0) {
        const date = new Date();
        date.setDate(date.getDate() + daysOffset);
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = date.toISOString().slice(0,10);
        }
    }

    // 🚀 نظام تبديل العرض
    function setupViewToggleEvents() {
        // أحداث تبديل عرض الديون
        document.querySelectorAll('.view-toggle').forEach(btn => {
            eventManager.cleanupElement(btn);
            eventManager.addListener(btn, 'click', function() {
                currentViewMode = this.getAttribute('data-view');
                localStorage.setItem('debtViewMode', currentViewMode);
                renderDebts();
                renderDebtsSummary();
                showToast(`تم التبديل إلى عرض ${currentViewMode === 'table' ? 'الجدول' : 'البطاقات'}`);
            });
        });

        // أحداث تبديل عرض سجل الدين التفصيلي
        document.querySelectorAll('.debt-history-view-toggle').forEach(btn => {
            eventManager.cleanupElement(btn);
            eventManager.addListener(btn, 'click', function() {
                currentDebtHistoryViewMode = this.getAttribute('data-view');
                localStorage.setItem('debtHistoryViewMode', currentDebtHistoryViewMode);
                const searchTerm = document.getElementById('searchDebts')?.value || '';
                if (searchTerm) {
                    showDebtHistory(searchTerm);
                }
            });
        });

        // أحداث تبديل عرض القات
        document.querySelectorAll('.qat-view-toggle').forEach(btn => {
            eventManager.cleanupElement(btn);
            eventManager.addListener(btn, 'click', function() {
                currentQatViewMode = this.getAttribute('data-view');
                localStorage.setItem('qatViewMode', currentQatViewMode);
                renderQats();
                showToast(`تم التبديل إلى عرض ${currentQatViewMode === 'table' ? 'الجدول' : 'البطاقات'}`);
            });
        });

        // أحداث حذف القات
        document.querySelectorAll('.delete-qat').forEach(btn => {
            eventManager.cleanupElement(btn);
            eventManager.addListener(btn, 'click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                if (!isNaN(index)) {
                    deleteQat(index);
                }
            });
        });
    }

    // 🚀 نظام البحث والتصفية
    function filterDebts(searchTerm) {
        const debtsListEl = document.getElementById('debtsList');
        if (!debtsListEl) return;
        
        const filteredDebts = debts.filter(debt => 
            debt.name.toLowerCase().includes(searchTerm) ||
            debt.date.includes(searchTerm) ||
            debt.timeOfDay.includes(searchTerm) ||
            debt.totalAmount.toString().includes(searchTerm)
        );
        
        if(filteredDebts.length === 0){ 
            debtsListEl.innerHTML='<p style="text-align:center;padding:20px;color:var(--muted);">لا توجد نتائج للبحث</p>'; 
            return; 
        }

        // تحديث العرض مع النتائج المصفاة
        const originalDebts = [...debts];
        debts = filteredDebts;
        renderDebts();
        debts = originalDebts;
    }

    function filterQats(searchTerm) {
        const qatListEl = document.getElementById('qatList');
        if (!qatListEl) return;
        
        const filteredQats = qats.filter(qat => 
            qat.type.toLowerCase().includes(searchTerm) ||
            qat.date.includes(searchTerm) ||
            qat.count.toString().includes(searchTerm)
        );
        
        if(filteredQats.length === 0){ 
            qatListEl.innerHTML='<p style="text-align:center;padding:20px;color:var(--muted);">لا توجد نتائج للبحث</p>'; 
            return; 
        }
        
        // تحديث العرض مع النتائج المصفاة
        const originalQats = [...qats];
        qats = filteredQats;
        renderQats();
        qats = originalQats;
    }

    // إدارة كلمة المرور
    function showChangePasswordModal() {
        const modal = document.getElementById('changePasswordModal');
        if (modal) {
            modal.classList.remove('hidden');
            
            const currentPassword = document.getElementById('currentPassword');
            const newPassword = document.getElementById('newPassword');
            const confirmPassword = document.getElementById('confirmPassword');
            
            if (currentPassword) currentPassword.value = '';
            if (newPassword) newPassword.value = '';
            if (confirmPassword) confirmPassword.value = '';
        }
    }

    async function changePasswordHandler() {
        const current = document.getElementById('currentPassword')?.value || '';
        const newPass = document.getElementById('newPassword')?.value || '';
        const confirm = document.getElementById('confirmPassword')?.value || '';
        
        if (!current || !newPass || !confirm) {
            showToast('الرجاء ملء جميع الحقول', 'error');
            return;
        }
        
        try {
            const isValid = await verifyPassword(current, userPassword);
            if (!isValid) {
                showToast('كلمة المرور الحالية غير صحيحة', 'error');
                return;
            }
        } catch (error) {
            showToast('خطأ في التحقق من كلمة المرور', 'error');
            return;
        }
        
        if (newPass !== confirm) {
            showToast('كلمة المرور الجديدة غير متطابقة', 'error');
            return;
        }
        
        try {
            userPassword = await hashPassword(newPass);
            saveToLocalStorage();
            await syncToFirebaseWithRetry();
            hideModal('changePasswordModal');
            showToast('تم تغيير كلمة المرور بنجاح');
        } catch (error) {
            showToast('❌ فشل في تغيير كلمة المرور', 'error');
        }
    }

    // حذف جميع البيانات
    function showDeleteAllDataModal() {
        const modal = document.getElementById('deleteConfirmModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    async function deleteAllData() {
        try {
            backupAllData();
            
            debts = [];
            qats = [];
            
            saveToLocalStorage();
            await syncToFirebaseWithRetry();
            refreshUI();
            
            hideModal('deleteConfirmModal');
            showToast('✅ تم حذف جميع البيانات بنجاح', 'success');
        } catch (error) {
            console.error('خطأ في حذف البيانات:', error);
            showToast('❌ فشل في حذف البيانات', 'error');
        }
    }

    // التصدير والاستيراد
    function exportDataToFile() {
        try {
            const exportData = {
                debts: debts,
                qats: qats,
                user: currentUser,
                timestamp: new Date().toISOString(),
                version: '2.0'
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { 
                type: 'application/json;charset=utf-8' 
            });
            
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `نسخة-احتياطية-${currentUser}-${new Date().toISOString().slice(0,10)}.json`;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
            showToast(`✅ تم إنشاء نسخة احتياطية`);
            
        } catch (error) {
            console.error('خطأ في التصدير:', error);
            showToast('❌ فشل في إنشاء النسخة الاحتياطية', 'error');
        }
    }

    function importDataFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        eventManager.addListener(input, 'change', async function(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            eventManager.addListener(reader, 'load', async function(e) {
                try {
                    const importedData = JSON.parse(e.target.result);
                    
                    if (importedData && importedData.debts && importedData.qats) {
                        if (confirm('هل تريد استيراد البيانات من الملف؟')) {
                            backupData = importedData;
                            debts = importedData.debts;
                            qats = importedData.qats;
                            
                            saveToLocalStorage();
                            await syncToFirebaseWithRetry();
                            refreshUI();
                            
                            showToast('✅ تم استيراد البيانات بنجاح', 'success');
                        }
                    } else {
                        showToast('❌ ملف غير صالح أو تالف', 'error');
                    }
                } catch (error) {
                    console.error('خطأ في استيراد البيانات:', error);
                    showToast('❌ فشل في استيراد البيانات', 'error');
                }
            });
            
            reader.readAsText(file);
        });
        
        input.click();
    }

    function updateSettingsStats() {
        const totalDebts = debts.reduce((sum, debt) => sum + debt.totalAmount, 0);
        const totalRecords = debts.length + qats.length;
        const activeDebts = debts.filter(debt => debt.remainingAmount > 0).length;
        const qatRecords = qats.length;
        
        const backupInfo = backupData ? 
            `آخر نسخة: ${new Date(backupData.timestamp).toLocaleString('ar-SA')}` : 
            'لا توجد نسخة';

        const statsTotalDebts = document.getElementById('statsTotalDebts');
        const statsTotalRecords = document.getElementById('statsTotalRecords');
        const statsActiveDebts = document.getElementById('statsActiveDebts');
        const statsQatRecords = document.getElementById('statsQatRecords');
        
        if (statsTotalDebts) statsTotalDebts.textContent = totalDebts.toLocaleString();
        if (statsTotalRecords) statsTotalRecords.textContent = totalRecords.toLocaleString();
        if (statsActiveDebts) statsActiveDebts.textContent = activeDebts.toLocaleString();
        if (statsQatRecords) statsQatRecords.textContent = qatRecords.toLocaleString();
        
        const backupStatus = document.getElementById('backupStatus');
        if (backupStatus) {
            backupStatus.textContent = backupInfo;
        }
    }

    // دوال التصدير
    function showExportOptions() {
        const exportModal = document.getElementById('exportModal');
        if (exportModal) {
            exportModal.classList.remove('hidden');
        }
    }

    async function exportDebtsToExcel() {
        try {
            hideModal('exportModal');
            
            if (!debts || debts.length === 0) {
                showToast('❌ لا توجد بيانات للتصدير', 'error');
                return;
            }
            
            if (typeof ExcelJS === 'undefined') {
                showToast('مكتبة ExcelJS غير محملة', 'error');
                return;
            }
            
            const data = debts.map(debt => ({
                'اسم المتدين': debt.name,
                'التاريخ': debt.date,
                'الوقت': debt.timeOfDay,
                'المبلغ الإجمالي': debt.totalAmount,
                'المبلغ المسدد': debt.paidAmount,
                'المبلغ المتبقي': debt.remainingAmount,
                'الحالة': debt.remainingAmount === 0 ? 'مسدد بالكامل' : 
                          debt.paidAmount === 0 ? 'لم يسدد' : 'مسدد جزئياً'
            }));
            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("الديون");
            
            // العناوين
            const headers = Object.keys(data[0]);
            const headerRow = worksheet.addRow(headers);
            
            // البيانات
            data.forEach(row => {
                worksheet.addRow(Object.values(row));
            });
            
            // حفظ الملف
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `ديون-${currentUser}-${new Date().toISOString().slice(0,10)}.xlsx`);
            showToast(`✅ تم تصدير البيانات إلى Excel`);
            
        } catch (error) {
            console.error('خطأ في التصدير:', error);
            showToast('❌ فشل في تصدير الملف', 'error');
        }
    }

    async function exportDebtsToWord() {
        try {
            hideModal('exportModal');
            
            if (!debts || debts.length === 0) {
                showToast('❌ لا توجد بيانات للتصدير', 'error');
                return;
            }
            
            const data = debts.map(debt => ({
                'المتدين': debt.name,
                'التاريخ': debt.date,
                'الوقت': debt.timeOfDay,
                'الإجمالي': `${debt.totalAmount.toLocaleString()} ريال`,
                'المسدد': `${debt.paidAmount.toLocaleString()} ريال`,
                'المتبقي': `${debt.remainingAmount.toLocaleString()} ريال`
            }));
            
            let htmlContent = `
                <html>
                <head><meta charset="UTF-8"></head>
                <body>
                    <h1>تقرير الديون</h1>
                    <table border="1">
                        <tr>
                            ${Object.keys(data[0]).map(header => `<th>${header}</th>`).join('')}
                        </tr>
                        ${data.map(row => `
                            <tr>
                                ${Object.values(row).map(cell => `<td>${cell}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </table>
                </body>
                </html>
            `;
            
            const blob = new Blob([htmlContent], { type: 'application/msword' });
            saveAs(blob, `ديون-${new Date().toISOString().slice(0,10)}.doc`);
            
            showToast(`✅ تم تصدير البيانات إلى Word`);
        } catch (error) {
            console.error('خطأ في التصدير:', error);
            showToast('❌ فشل في تصدير الملف', 'error');
        }
    }

    async function exportSummaryToExcel() {
        try {
            hideModal('exportModal');
            
            if (!debts || debts.length === 0) {
                showToast('❌ لا توجد بيانات للتصدير', 'error');
                return;
            }
            
            const debtors = {};
            debts.forEach(debt => {
                if (!debtors[debt.name]) {
                    debtors[debt.name] = {
                        total: 0,
                        paid: 0,
                        remaining: 0
                    };
                }
                debtors[debt.name].total += debt.totalAmount;
                debtors[debt.name].paid += debt.paidAmount;
                debtors[debt.name].remaining += debt.remainingAmount;
            });

            const data = Object.keys(debtors).map(name => ({
                'اسم المتدين': name,
                'إجمالي الدين': debtors[name].total + ' ريال',
                'المسدد': debtors[name].paid + ' ريال',
                'المتبقي': debtors[name].remaining + ' ريال'
            }));
            
            if (typeof ExcelJS === 'undefined') {
                showToast('مكتبة ExcelJS غير محملة', 'error');
                return;
            }
            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("ملخص الديون");
            
            // العناوين
            const headers = Object.keys(data[0]);
            const headerRow = worksheet.addRow(headers);
            
            // البيانات
            data.forEach(row => {
                worksheet.addRow(Object.values(row));
            });
            
            // حفظ الملف
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `ملخص-ديون-${new Date().toISOString().slice(0,10)}.xlsx`);
            
            showToast(`✅ تم تصدير الملخص إلى Excel`);
            
        } catch (error) {
            console.error('خطأ في التصدير:', error);
            showToast('❌ فشل في تصدير الملف', 'error');
        }
    }

    async function exportSummaryToWord() {
        try {
            hideModal('exportModal');
            
            if (!debts || debts.length === 0) {
                showToast('❌ لا توجد بيانات للتصدير', 'error');
                return;
            }
            
            const debtors = {};
            debts.forEach(debt => {
                if (!debtors[debt.name]) {
                    debtors[debt.name] = {
                        total: 0,
                        paid: 0,
                        remaining: 0
                    };
                }
                debtors[debt.name].total += debt.totalAmount;
                debtors[debt.name].paid += debt.paidAmount;
                debtors[debt.name].remaining += debt.remainingAmount;
            });

            const data = Object.keys(debtors).map(name => ({
                'المتدين': name,
                'الإجمالي': debtors[name].total + ' ريال',
                'المسدد': debtors[name].paid + ' ريال',
                'المتبقي': debtors[name].remaining + ' ريال'
            }));
            
            let htmlContent = `
                <html>
                <head><meta charset="UTF-8"></head>
                <body>
                    <h1>ملخص الديون</h1>
                    <table border="1">
                        <tr>
                            ${Object.keys(data[0]).map(header => `<th>${header}</th>`).join('')}
                        </tr>
                        ${data.map(row => `
                            <tr>
                                ${Object.values(row).map(cell => `<td>${cell}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </table>
                </body>
                </html>
            `;
            
            const blob = new Blob([htmlContent], { type: 'application/msword' });
            saveAs(blob, `ملخص-ديون-${new Date().toISOString().slice(0,10)}.doc`);
            
            showToast(`✅ تم تصدير الملخص إلى Word`);
        } catch (error) {
            console.error('خطأ في التصدير:', error);
            showToast('❌ فشل في تصدير الملف', 'error');
        }
    }

    // الدوال العالمية للصفحات
    function showAboutPage() {
        showPage('aboutPage');
    }

    function showHelpPage() {
        showPage('helpPage');
    }

    function goBackToSettings() {
        showPage('settingsPage');
    }

    function contactDeveloper() {
        window.open('https://wa.me/+967778942829?text=مرحباً، أود الاستفسار عن تطبيق محفظة الديون الذكية', '_blank');
    }

    function contactSupport() {
        window.open('https://wa.me/+967778942829?text=مرحباً، أحتاج دعم فني لتطبيق محفظة الديون الذكية', '_blank');
    }

    // التهيئة
    async function init() {
        try {
            // تحديث التاريخ والوقت
            updateDateTime();
            setInterval(updateDateTime, 60000);
            
            // إعداد التواريخ الافتراضية
            const today = new Date().toISOString().slice(0,10);
            ['debtDate', 'qatDate', 'paymentDate'].forEach(id => {
                const element = document.getElementById(id);
                if (element) element.value = today;
            });
            
            // تحميل البيانات الأساسية
            const storedUser = localStorage.getItem(KEY_USER);
            if(storedUser){
                currentUser = storedUser;
                loadFromLocalStorage();
                showApp();
                
                // تحميل المكونات غير الحرجة لاحقاً
                setTimeout(() => {
                    setupConnectionMonitoring();
                    enhancedSync();
                }, 1000);
            } else {
                showLogin();
            }
            
            // إعداد الأنظمة الأساسية
            setupEventListeners();
            setupGoogleSignIn();
            
            // تحميل النسخة الاحتياطية إذا وجدت
            if (currentUser) {
                const storedBackup = localStorage.getItem(`backup_${currentUser}`);
                if (storedBackup) {
                    try {
                        backupData = JSON.parse(storedBackup);
                    } catch (error) {
                        console.error('خطأ في تحميل النسخة الاحتياطية:', error);
                    }
                }
            }
            
            // مراقبة الاتصال
            window.addEventListener('online', checkConnection);
            window.addEventListener('offline', checkConnection);
            
        } catch (error) {
            console.error('خطأ في تهيئة التطبيق:', error);
            showToast('❌ حدث خطأ في تهيئة التطبيق', 'error');
        }
    }

    // 🚀 نظام مراقبة الاتصال
    function setupConnectionMonitoring() {
        window.addEventListener('online', () => {
            isOnline = true;
            updateSyncStatus('online', 'متصل - مزامنة');
            setTimeout(() => enhancedSync(), 2000);
        });
        
        window.addEventListener('offline', () => {
            isOnline = false;
            updateSyncStatus('offline', 'غير متصل');
        });
    }

    // تعريف الدوال العالمية
    window.showAboutPage = showAboutPage;
    window.showHelpPage = showHelpPage;
    window.goBackToSettings = goBackToSettings;
    window.contactDeveloper = contactDeveloper;
    window.contactSupport = contactSupport;
    window.showExportOptions = showExportOptions;
    window.closeExportModal = () => hideModal('exportModal');

    // بدء التطبيق
    document.addEventListener('DOMContentLoaded', init);

})();
