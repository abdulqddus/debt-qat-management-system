(function() {
    "use strict";
    
    // 🔥 التحقق من توفر المكتبات المطلوبة
    if (typeof firebase === 'undefined') {
        console.warn('تحذير: مكتبة Firebase غير محملة. وضع عدم الاتصال نشط.');
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

    // نظام العرض
    let currentViewMode = localStorage.getItem('debtViewMode') || 'table';

    // نظام إدارة الأحداث
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

    // تشفير كلمة المرور
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
        
        // تحديث الواجهة حسب الصفحة
        if (pageId === 'dashboardPage') {
            updateDashboard();
        } else if (pageId === 'debtsPage') {
            renderDebts();
            updateSummary();
            updateDebtorSelect();
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

    // تصيير الديون
    function renderDebts() {
        const debtsListEl = document.getElementById('debtsList');
        if (!debtsListEl) return;
        
        debtsListEl.innerHTML = '';
        
        if(!debts || debts.length === 0){ 
            debtsListEl.innerHTML='<p style="text-align:center;padding:20px;color:var(--muted);">لا توجد سجلات</p>'; 
            return; 
        }

        debts.forEach(debt => {
            const debtCard = document.createElement('div');
            debtCard.className = 'list-item debt-item';
            
            debtCard.innerHTML = `
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h4 style="margin:0;">${debt.name}</h4>
                        <span>${debt.remainingAmount} / ${debt.totalAmount} ريال</span>
                    </div>
                    <div style="font-size:12px; color:var(--muted); margin-top:4px;">
                        ${debt.date} - ${debt.timeOfDay}
                    </div>
                    ${debt.payments && debt.payments.length > 0 ? `
                        <div class="payment-section">
                            <strong>التسديدات:</strong>
                            ${debt.payments.slice(0, 3).map(payment => `
                                <div style="font-size:12px; margin-top:4px;">
                                    +${payment.amount} ريال في ${payment.date}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
            
            debtsListEl.appendChild(debtCard);
        });
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

    function renderDebtsSummary() {
        const debtsSummaryEl = document.getElementById('debtsSummary');
        if (!debtsSummaryEl) return;
        
        debtsSummaryEl.innerHTML = '';
        
        if(!debts || debts.length === 0){ 
            debtsSummaryEl.innerHTML='<p style="text-align:center;padding:20px;color:var(--muted);">لا توجد سجلات</p>'; 
            return; 
        }

        const total = debts.reduce((sum, debt) => sum + debt.totalAmount, 0);
        const paid = debts.reduce((sum, debt) => sum + debt.paidAmount, 0);
        const remaining = total - paid;
        
        const summaryHTML = `
            <div class="card">
                <h3>ملخص الديون</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px;">
                    <div style="text-align: center; padding: 20px; background: rgba(59, 130, 246, 0.1); border-radius: 12px;">
                        <div style="font-size: 24px; font-weight: bold; color: var(--warning);">${total.toLocaleString()}</div>
                        <div style="font-size: 14px; color: var(--muted);">إجمالي الديون</div>
                    </div>
                    <div style="text-align: center; padding: 20px; background: rgba(16, 185, 129, 0.1); border-radius: 12px;">
                        <div style="font-size: 24px; font-weight: bold; color: var(--success);">${paid.toLocaleString()}</div>
                        <div style="font-size: 14px; color: var(--muted);">المسدد</div>
                    </div>
                    <div style="text-align: center; padding: 20px; background: rgba(239, 68, 68, 0.1); border-radius: 12px;">
                        <div style="font-size: 24px; font-weight: bold; color: var(--danger);">${remaining.toLocaleString()}</div>
                        <div style="font-size: 14px; color: var(--muted);">المتبقي</div>
                    </div>
                </div>
            </div>
        `;
        
        debtsSummaryEl.innerHTML = summaryHTML;
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

    // نظام القات
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
        
        qatListEl.innerHTML = '';
        
        if(!qats || qats.length === 0){ 
            qatListEl.innerHTML='<p style="text-align:center;padding:20px;color:var(--muted);">لا توجد سجلات</p>'; 
            return; 
        }

        qats.forEach(qat => {
            const div = document.createElement('div');
            div.className = 'list-item qat-item';
            div.innerHTML = `
                <div>
                    <strong>${qat.type}</strong>
                    <div style="font-size:12px; color:var(--muted);">${qat.date}</div>
                </div>
                <span>${qat.count}</span>
            `;
            qatListEl.appendChild(div);
        });
    }

    // نظام البحث
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
            
            let historyHTML = '<div class="card">';
            historyHTML += '<h3>نتائج البحث:</h3>';
            
            matchingDebts.forEach(debt => {
                historyHTML += `
                    <div class="list-item debt-item" style="margin-bottom: 10px;">
                        <div>
                            <strong>${debt.name}</strong>
                            <div style="font-size:12px; color:var(--muted);">
                                ${debt.date} - ${debt.timeOfDay}
                            </div>
                        </div>
                        <span>${debt.totalAmount} ريال (متبقي: ${debt.remainingAmount} ريال)</span>
                    </div>
                `;
            });
            
            historyHTML += '</div>';
            debtHistoryList.innerHTML = historyHTML;
        }
    }

    // إعداد الأحداث
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

        // أحداث البحث
        const searchDebts = document.getElementById('searchDebts');
        const quickSearchBtn = document.getElementById('quickSearchBtn');
        
        if (searchDebts) {
            eventManager.addListener(searchDebts, 'keypress', function(e) {
                if (e.key === 'Enter') {
                    const searchTerm = this.value.trim();
                    if (searchTerm) {
                        showDebtHistory(searchTerm);
                    }
                }
            });
        }

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

        // أحداث الإغلاق
        const closeDebtHistory = document.getElementById('closeDebtHistory');
        if (closeDebtHistory) {
            eventManager.addListener(closeDebtHistory, 'click', function() {
                const debtHistoryCard = document.getElementById('debtHistoryCard');
                if (debtHistoryCard) debtHistoryCard.classList.add('hidden');
            });
        }

        // أحداث لوحة التحكم
        const quickAddDebt = document.getElementById('quickAddDebt');
        const quickAddPayment = document.getElementById('quickAddPayment');
        const quickAddQat = document.getElementById('quickAddQat');
        const quickExport = document.getElementById('quickExport');
        
        if (quickAddDebt) eventManager.addListener(quickAddDebt, 'click', () => showPage('debtsPage'));
        if (quickAddPayment) eventManager.addListener(quickAddPayment, 'click', () => showPage('debtsPage'));
        if (quickAddQat) eventManager.addListener(quickAddQat, 'click', () => showPage('qatPage'));
        if (quickExport) eventManager.addListener(quickExport, 'click', () => showExportOptions());

        // أحداث الإعدادات
        const changePassword = document.getElementById('changePassword');
        const deleteData = document.getElementById('deleteData');
        const exportAllData = document.getElementById('exportAllData');
        const importData = document.getElementById('importData');
        const aboutApp = document.getElementById('aboutApp');
        const helpCenter = document.getElementById('helpCenter');
        
        if (changePassword) eventManager.addListener(changePassword, 'click', showChangePasswordModal);
        if (deleteData) eventManager.addListener(deleteData, 'click', showDeleteAllDataModal);
        if (exportAllData) eventManager.addListener(exportAllData, 'click', exportDataToFile);
        if (importData) eventManager.addListener(importData, 'click', importDataFromFile);
        if (aboutApp) eventManager.addListener(aboutApp, 'click', showAboutPage);
        if (helpCenter) eventManager.addListener(helpCenter, 'click', showHelpPage);

        // أحداث النوافذ المنبثقة
        const cancelChangePassword = document.getElementById('cancelChangePassword');
        const saveNewPassword = document.getElementById('saveNewPassword');
        const cancelDeleteAll = document.getElementById('cancelDeleteAll');
        const confirmDeleteAll = document.getElementById('confirmDeleteAll');
        const closeExportModal = document.getElementById('closeExportModal');
        
        if (cancelChangePassword) eventManager.addListener(cancelChangePassword, 'click', () => hideModal('changePasswordModal'));
        if (saveNewPassword) eventManager.addListener(saveNewPassword, 'click', changePasswordHandler);
        if (cancelDeleteAll) eventManager.addListener(cancelDeleteAll, 'click', () => hideModal('deleteConfirmModal'));
        if (confirmDeleteAll) eventManager.addListener(confirmDeleteAll, 'click', deleteAllData);
        if (closeExportModal) eventManager.addListener(closeExportModal, 'click', () => hideModal('exportModal'));
    }

    function hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
    }

    function setDateToField(fieldId, daysOffset = 0) {
        const date = new Date();
        date.setDate(date.getDate() + daysOffset);
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = date.toISOString().slice(0,10);
        }
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

    // حذف البيانات
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

    // خيارات التصدير
    function showExportOptions() {
        const exportModal = document.getElementById('exportModal');
        if (exportModal) {
            exportModal.classList.remove('hidden');
        }
    }

    // الدوال العامة للصفحات الجديدة
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
        window.open('https://wa.me/966778942829?text=مرحباً، أود الاستفسار عن تطبيق محفظة الديون الذكية', '_blank');
    }

    function contactSupport() {
        window.open('https://wa.me/966778942829?text=مرحباً، أحتاج دعم فني لتطبيق محفظة الديون الذكية', '_blank');
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
            
        } catch (error) {
            console.error('خطأ في تهيئة التطبيق:', error);
            showToast('❌ حدث خطأ في تهيئة التطبيق', 'error');
        }
    }

    // تعريف الدوال العامة
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