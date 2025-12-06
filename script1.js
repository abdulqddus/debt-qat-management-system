(function() {
    "use strict";
    
    // 🔥 التحقق من توفر المكتبات المطلوبة
    if (typeof firebase === 'undefined') {
        alert('خطأ: مكتبة Firebase غير محملة. يرجى التحقق من اتصال الإنترنت.');
        return;
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
    
    // تهيئة Firebase مع معالجة الأخطاء
    let auth, database;
    try {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        database = firebase.database();
    } catch (error) {
        console.error('خطأ في تهيئة Firebase:', error);
        showToast('⚠️ وضع عدم الاتصال: البيانات ستخزن محلياً فقط', 'warning');
    }
    
    // مفاتيح التخزين
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

    // 🚀 نظام التحميل البطيء
    const lazyLoader = {
        loadedComponents: new Set(),
        
        loadComponent(componentName, loader) {
            if (this.loadedComponents.has(componentName)) {
                return Promise.resolve();
            }
            
            return new Promise((resolve) => {
                setTimeout(() => {
                    try {
                        loader();
                        this.loadedComponents.add(componentName);
                        resolve();
                    } catch (error) {
                        console.error(`خطأ في تحميل المكون ${componentName}:`, error);
                        resolve();
                    }
                }, 50);
            });
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
        toast.className = `toast ${type === 'error' ? 'error' : type === 'warning' ? 'warning' : type === 'info' ? 'info' : ''}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : type === 'info' ? 'info-circle' : 'check-circle'}"></i>
            ${message}
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // 🔥 تشفير كلمة المرور باستخدام SHA-256
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

    function showApp(){ 
        // ✅ إخفاء صفحة تسجيل الدخول
        const loginPage = document.getElementById('loginPage');
        if (loginPage) {
            loginPage.classList.remove('active');
            loginPage.classList.add('hidden');
        }
        
        // ✅ إظهار صفحة التطبيق
        const appPage = document.getElementById('appPage');
        if (appPage) {
            appPage.classList.remove('hidden');
            appPage.classList.add('active');
        }
        
        showPage('dashboardPage');
        updateDateTime();
        checkConnection();
        setupNavScroll();
        setupConnectionMonitoring();
        
        // ✅ تأكد من تحديث واجهة المستخدم
        refreshUI();
    }
    
    function showLogin(){ 
        // ✅ إظهار صفحة تسجيل الدخول
        const loginPage = document.getElementById('loginPage');
        if (loginPage) {
            loginPage.classList.remove('hidden');
            loginPage.classList.add('active');
        }
        
        // ✅ إخفاء صفحة التطبيق
        const appPage = document.getElementById('appPage');
        if (appPage) {
            appPage.classList.remove('active');
            appPage.classList.add('hidden');
        }
        
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) {
            syncStatus.classList.add('hidden');
        }
        
        document.getElementById('loginName').value = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginMessage').textContent = '';
        
        // ✅ إعادة تهيئة زر Google عند العودة لصفحة التسجيل
        setTimeout(() => {
            const googleBtn = document.getElementById('googleSignInBtn');
            if (googleBtn) {
                googleBtn.innerHTML = '<i class="fab fa-google" style="color: #db4437;"></i> تسجيل الدخول بحساب Google';
                googleBtn.disabled = false;
                googleBtn.classList.remove('loading');
            }
        }, 100);
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
            console.error('خطأ في تحديث التاريخ:', error);
            const currentDateTimeEl = document.getElementById('currentDateTime');
            if (currentDateTimeEl) {
                currentDateTimeEl.textContent = now.toLocaleString();
            }
        }
    }

    // نظام إدارة المستخدمين المحسن
    async function createAccount(name, password) {
        if(!name || !password){ 
            return { success: false, message: 'الرجاء إدخال اسم المستخدم وكلمة المرور' };
        }
        
        if (password.length < 6) {
            return { success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
        }
        
        if (name.length < 3) {
            return { success: false, message: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' };
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
            
            // ✅ إضافة هذا الجزء: عرض التطبيق مباشرة
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
                    console.warn('فشل المزامنة مع Firebase، البيانات مخزنة محلياً:', firebaseError);
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
            
            // ✅ إضافة هذا الجزء: عرض التطبيق مباشرة
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

    // إعداد شريط التنقل المتحرك
    function setupNavScroll() {
        const navContainer = document.getElementById('navContainer');
        if (!navContainer) return;
        
        let lastScrollY = window.scrollY;
        let isCompact = false;

        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            
            if (currentScrollY > 50 && !isCompact) {
                navContainer.classList.add('compact');
                isCompact = true;
            } else if (currentScrollY <= 50 && isCompact) {
                navContainer.classList.remove('compact');
                isCompact = false;
            }
            
            lastScrollY = currentScrollY;
        });
    }

    // 🚀 نظام تسجيل الدخول بحساب Google المحسن والمصلح
    function setupGoogleSignIn() {
        const googleSignInBtn = document.getElementById('googleSignInBtn');
        if (!googleSignInBtn || !auth) return;
        
        // تنظيف الأحداث القديمة أولاً
        eventManager.cleanupElement(googleSignInBtn);
        
        let isProcessing = false;
        let originalHTML = googleSignInBtn.innerHTML;
        
        eventManager.addListener(googleSignInBtn, 'click', async function() {
            // منع النقر المتعدد أثناء المعالجة
            if (isProcessing) {
                console.log('العملية جارية بالفعل، يتم تجاهل النقر');
                return;
            }
            
            try {
                // وضع المعالجة
                isProcessing = true;
                const originalHTML = googleSignInBtn.innerHTML;
                googleSignInBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارِ التسجيل...';
                googleSignInBtn.disabled = true;
                googleSignInBtn.classList.add('loading');
                
                console.log('بدء تسجيل الدخول بحساب Google...');
                
                const provider = new firebase.auth.GoogleAuthProvider();
                provider.addScope('email');
                provider.addScope('profile');
                
                // إعداد اللغة العربية
                firebase.auth().useDeviceLanguage();
                
                let result;
                try {
                    console.log('محاولة تسجيل الدخول مع Google...');
                    result = await auth.signInWithPopup(provider);
                    console.log('تم تسجيل الدخول بنجاح:', result.user?.email);
                } catch (authError) {
                    console.error('خطأ في تسجيل الدخول بحساب Google:', authError);
                    
                    // محاولة طريقة بديلة
                    if (authError.code === 'auth/popup-blocked') {
                        showToast('🔒 تم حظر النافذة المنبثقة. جاري استخدام طريقة التوجيه...', 'warning');
                        result = await auth.signInWithRedirect(provider);
                        return;
                    }
                    throw authError;
                }
                
                const user = result.user;
                
                if (!user) {
                    throw new Error('فشل في الحصول على بيانات المستخدم');
                }
                
                // ✅ تأكد من أن currentUser لديه قيمة صحيحة
                currentUser = user.displayName || user.email || `user_${user.uid.substring(0, 8)}`;
                console.log('المستخدم الحالي:', currentUser);
                
                // ✅ تأكد من أن userPassword ليس null
                userPassword = await hashPassword(user.uid);
                
                // تحقق مما إذا كان المستخدم موجوداً بالفعل
                const existingUserData = localStorage.getItem(`${KEY_DEBTS}_${currentUser}`);
                
                if (!existingUserData) {
                    // إنشاء بيانات افتراضية للمستخدم الجديد
                    console.log('إنشاء بيانات جديدة للمستخدم...');
                    debts = [];
                    qats = [];
                    
                    // إضافة بيانات تجريبية حقيقية
                    const sampleDebts = [
                        {
                            id: uid('d'),
                            name: 'محمد أحمد',
                            totalAmount: 5000,
                            paidAmount: 2000,
                            remainingAmount: 3000,
                            date: new Date().toISOString().slice(0,10),
                            timeOfDay: 'صباحاً',
                            payments: [
                                {
                                    id: uid('p'),
                                    amount: 2000,
                                    date: new Date().toISOString().slice(0,10)
                                }
                            ]
                        }
                    ];
                    
                    const sampleQats = [
                        {
                            id: uid('q'),
                            type: 'قات ممتاز',
                            count: '50',
                            date: new Date().toISOString().slice(0,10)
                        }
                    ];
                    
                    localStorage.setItem(`${KEY_DEBTS}_${currentUser}`, JSON.stringify(sampleDebts));
                    localStorage.setItem(`${KEY_QAT}_${currentUser}`, JSON.stringify(sampleQats));
                } else {
                    // تحميل البيانات الحالية للمستخدم
                    console.log('تحميل البيانات الحالية للمستخدم...');
                    const storedDebts = localStorage.getItem(`${KEY_DEBTS}_${currentUser}`);
                    const storedQat = localStorage.getItem(`${KEY_QAT}_${currentUser}`);
                    
                    debts = storedDebts ? JSON.parse(storedDebts) : [];
                    qats = storedQat ? JSON.parse(storedQat) : [];
                }
                
                // ✅ حفظ بيانات المستخدم بشكل حقيقي
                localStorage.setItem(KEY_USER, currentUser);
                localStorage.setItem(`${KEY_PASSWORD}_${currentUser}`, userPassword);
                localStorage.setItem(`${KEY_DEBTS}_${currentUser}`, JSON.stringify(debts));
                localStorage.setItem(`${KEY_QAT}_${currentUser}`, JSON.stringify(qats));
                
                console.log('تم حفظ بيانات المستخدم بنجاح');
                
                // ✅ إعادة تعيين الزر فوراً
                googleSignInBtn.innerHTML = originalHTML;
                googleSignInBtn.disabled = false;
                googleSignInBtn.classList.remove('loading');
                
                // ✅ هنا نستدعي showApp() مباشرة
                showApp();
                showToast(`✅ تم تسجيل الدخول بنجاح! مرحباً ${currentUser}`);
                
            } catch (error) {
                console.error('تفاصيل الخطأ في تسجيل الدخول بحساب Google:', error);
                
                // ✅ إعادة تعيين الزر في حالة الخطأ
                googleSignInBtn.innerHTML = '<i class="fab fa-google" style="color: #db4437;"></i> تسجيل الدخول بحساب Google';
                googleSignInBtn.disabled = false;
                googleSignInBtn.classList.remove('loading');
                
                // ✅ رسائل الخطأ المحددة
                let errorMessage = 'حدث خطأ غير معروف';
                
                if (error.code === 'auth/popup-blocked') {
                    errorMessage = '🔒 تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة';
                } else if (error.code === 'auth/popup-closed-by-user') {
                    errorMessage = 'تم إغلاق نافذة التسجيل قبل اكتمال العملية';
                } else if (error.code === 'auth/network-request-failed') {
                    errorMessage = '❌ مشكلة في الاتصال بالإنترنت';
                } else if (error.code === 'auth/cancelled-popup-request') {
                    errorMessage = 'تم إلغاء طلب النافذة المنبثقة';
                } else if (error.message === 'انتهت المهلة') {
                    errorMessage = '❌ انتهت المهلة، حاول مرة أخرى';
                } else if (error.code === 'auth/account-exists-with-different-credential') {
                    errorMessage = 'هذا الحساب مرتبط بطريقة تسجيل دخول أخرى';
                } else {
                    errorMessage = `❌ خطأ في التسجيل: ${error.message || 'غير معروف'}`;
                }
                
                showToast(errorMessage, 'error');
                
            } finally {
                // ✅ تأكد من إعادة تعيين حالة المعالجة
                isProcessing = false;
            }
        });
        
        // ✅ إعادة تعيين الزر عند تسجيل الخروج
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            eventManager.addListener(logoutBtn, 'click', function() {
                // إعادة تعيين زر Google عند تسجيل الخروج
                setTimeout(() => {
                    googleSignInBtn.innerHTML = '<i class="fab fa-google" style="color: #db4437;"></i> تسجيل الدخول بحساب Google';
                    googleSignInBtn.disabled = false;
                    googleSignInBtn.classList.remove('loading');
                }, 100);
            });
        }
    }

    // نظام المزامنة مع Firebase
    const syncStatus = document.getElementById('syncStatus');
    const syncIcon = document.getElementById('syncIcon');
    const syncText = document.getElementById('syncText');

    function updateSyncStatus(status, text) {
        if (!syncStatus) return;
        
        syncStatus.classList.remove('hidden', 'online', 'offline', 'syncing');
        
        if (status === 'online') {
            syncStatus.classList.add('online');
            syncIcon.textContent = '✓';
            syncText.textContent = text || 'مزامنة';
        } else if (status === 'offline') {
            syncStatus.classList.add('offline');
            syncIcon.textContent = '!';
            syncText.textContent = text || 'غير متصل';
        } else if (status === 'syncing') {
            syncStatus.classList.add('syncing');
            syncIcon.textContent = '↻';
            syncText.textContent = text || 'جارِ المزامنة...';
        }
        
        syncStatus.classList.remove('hidden');
    }

    // 🚀 نظام المزامنة مع Retry Logic
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
                setTimeout(() => {
                    if (!syncInProgress) updateSyncStatus('online', 'مزامنة');
                }, 3000);
                break;
                
            } catch (error) {
                console.error(`محاولة ${attempt} فشلت:`, error);
                
                if (attempt === maxRetries) {
                    updateSyncStatus('offline', 'خطأ في المزامنة');
                    showToast('❌ فشل في حفظ البيانات على السحابة', 'error');
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
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
                
                // دمج البيانات المحلية مع السحابية (الأحدث يفوز)
                const lastLocalUpdate = localStorage.getItem(`lastUpdate_${currentUser}`);
                const lastCloudUpdate = data.lastSync || '0';
                
                if (new Date(lastCloudUpdate) > new Date(lastLocalUpdate)) {
                    debts = cloudDebts;
                    qats = cloudQats;
                    userPassword = data.password || userPassword;
                    
                    saveToLocalStorage();
                    updateSyncStatus('online', 'تم تحميل البيانات');
                    
                    setTimeout(() => {
                        if (!syncInProgress) updateSyncStatus('online', 'مزامنة');
                    }, 3000);
                    
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
                showToast('✅ البيانات محدثة على جميع الأجهزة');
            }
        } catch (error) {
            console.error('خطأ في المزامنة:', error);
        }
    }

    // نظام النسخ الاحتياطي المتقدم
    function backupAllData() {
        try {
            backupData = {
                debts: JSON.parse(JSON.stringify(debts)),
                qats: JSON.parse(JSON.stringify(qats)),
                user: currentUser,
                timestamp: new Date().toISOString(),
                version: '2.0',
                statistics: {
                    totalDebts: debts.reduce((sum, debt) => sum + debt.totalAmount, 0),
                    totalPaid: debts.reduce((sum, debt) => sum + debt.paidAmount, 0),
                    totalRemaining: debts.reduce((sum, debt) => sum + debt.remainingAmount, 0),
                    debtsCount: debts.length,
                    qatsCount: qats.length,
                    activeDebts: debts.filter(debt => debt.remainingAmount > 0).length
                }
            };
            
            localStorage.setItem(`backup_${currentUser}`, JSON.stringify(backupData));
            
            showToast('✅ تم إنشاء نسخة احتياطية من جميع البيانات', 'success');
            
            const debtCount = debts.length;
            const qatCount = qats.length;
            const totalAmount = debts.reduce((sum, debt) => sum + debt.totalAmount, 0);
            
            showToast(`📊 تفاصيل النسخة: ${debtCount} ديون، ${qatCount} سجلات قات، ${totalAmount} ريال إجمالي`, 'info');
            
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
        
        if (confirm(`هل تريد استعادة البيانات من النسخة الاحتياطية؟\n\n📅 تاريخ النسخة: ${new Date(backupData.timestamp).toLocaleString('ar-SA')}\n👤 المستخدم: ${backupData.user}\n📁 تحتوي على: ${backupData.debts.length} ديون، ${backupData.qats.length} سجلات قات`)) {
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

    // 🚀 دوال إدارة الديون المحسنة
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
        
        // تحقق حقيقي من البيانات
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
        
        if(amount > 1000000) {
            showToast('❌ المبلغ كبير جداً', 'error');
            amountInput.focus();
            return;
        }

        // البحث عن دين موجود بنفس الاسم والتاريخ والوقت
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
            
            // نقل الدين المحدث إلى الأعلى
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
        
        // حفظ حقيقي في localStorage
        saveToLocalStorage();
        
        // مزامنة حقيقية مع Firebase
        await syncToFirebaseWithRetry();
        
        // تحديث الواجهة
        renderDebts();
        updateSummary();
        updateDashboard();
        updateDebtorSelect();
        
        // تفريغ الحقول
        nameInput.value = '';
        amountInput.value = '';
        dateInput.value = '';
        timeSelect.value = 'صباحاً';
        
        // إظهار رسالة نجاح حقيقية
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

    // دوال التصيير المحسنة
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
            debtCard.className = 'list-item debt-item fade-in';
            
            const debtColor = getDebtColor(debt.remainingAmount, debt.totalAmount);
            
            debtCard.innerHTML = `
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h4 style="margin:0;">${debt.name}</h4>
                        <span class="${debtColor}">${debt.remainingAmount} / ${debt.totalAmount} ريال</span>
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
                            ${debt.payments.length > 3 ? `
                                <div style="font-size:11px; color:var(--muted); margin-top:4px;">
                                    + ${debt.payments.length - 3} تسديدات أخرى
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
            
            debtsListEl.appendChild(debtCard);
        });
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

    // 🚀 نظام العرض الهجين المحسن مع إصلاح تسرب الذاكرة
    function renderDebtsSummary() {
        const debtsSummaryEl = document.getElementById('debtsSummary');
        if (!debtsSummaryEl) return;
        
        // تنظيف أي أحداث سابقة لمنع تسرب الذاكرة
        document.querySelectorAll('.view-toggle').forEach(btn => {
            eventManager.cleanupElement(btn);
        });
        
        debtsSummaryEl.innerHTML = '';
        
        if(!debts || debts.length === 0){ 
            debtsSummaryEl.innerHTML='<p style="text-align:center;padding:20px;color:var(--muted);">لا توجد سجلات</p>'; 
            return; 
        }

        try {
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

            // تحميل المحتوى مع التعامل مع الأخطاء
            setTimeout(() => {
                try {
                    if (currentViewMode === 'table') {
                        const tableContent = createSummaryTable();
                        if (tableContent) {
                            debtsSummaryEl.innerHTML += tableContent;
                            setupViewToggleEvents();
                        } else {
                            throw new Error('فشل في إنشاء الجدول');
                        }
                    } else {
                        const cardsContent = createSummaryCards();
                        if (cardsContent) {
                            debtsSummaryEl.innerHTML += cardsContent;
                            setupViewToggleEvents();
                        } else {
                            throw new Error('فشل في إنشاء البطاقات');
                        }
                    }
                } catch (error) {
                    console.error('خطأ في عرض الملخص:', error);
                    debtsSummaryEl.innerHTML += `
                        <div class="card">
                            <p style="text-align:center;padding:20px;color:var(--danger);">
                                <i class="fas fa-exclamation-triangle"></i>
                                حدث خطأ في عرض البيانات: ${error.message}
                            </p>
                        </div>
                    `;
                    // إعادة المحاولة بعد ثانية
                    setTimeout(renderDebtsSummary, 1000);
                }
            }, 10);
        } catch (error) {
            console.error('خطأ فادح في renderDebtsSummary:', error);
            debtsSummaryEl.innerHTML = `
                <div class="card">
                    <p style="text-align:center;padding:20px;color:var(--danger);">
                        <i class="fas fa-exclamation-triangle"></i>
                        خطأ في تحميل الملخص التفصيلي
                    </p>
                </div>
            `;
        }
    }

    function getTotalDebtors() {
        const debtors = new Set();
        debts.forEach(debt => debtors.add(debt.name));
        return debtors.size;
    }

    function createSummaryTable() {
        try {
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

                if (new Date(debt.date) > new Date(debtors[debt.name].latestDate)) {
                    debtors[debt.name].latestDate = debt.date;
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
                                    <th>📅 آخر تاريخ</th>
                                    <th>🔄 التسديدات</th>
                                    <th>📈 نسبة السداد</th>
                                    <th>🎯 الحالة</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            // ترتيب المتدينين حسب المبلغ المتبقي (الأكبر أولاً)
            const sortedDebtors = Object.keys(debtors).sort((a, b) => debtors[b].remaining - debtors[a].remaining);

            sortedDebtors.forEach(name => {
                const debtor = debtors[name];
                const statusColor = getDebtColor(debtor.remaining, debtor.total);
                const statusText = debtor.remaining === 0 ? 'مسدد' : debtor.paid === 0 ? 'غير مسدد' : 'قيد السداد';
                const progressPercent = debtor.total > 0 ? ((debtor.paid / debtor.total) * 100).toFixed(1) : '0';

                tableHTML += `
                    <tr class="debt-row" data-debtor="${name}">
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
                        <td><span style="color: var(--muted); font-size: 11px;">${formatDate(debtor.latestDate)}</span></td>
                        <td>${debtor.paymentsCount}</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 8px; min-width:120px;">
                                <div style="flex: 1; background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; overflow:hidden;">
                                    <div style="width: ${progressPercent}%; height: 100%; background: ${
                                        progressPercent == 100 ? 'var(--success)' : 
                                        progressPercent > 70 ? 'var(--primary)' : 
                                        progressPercent > 30 ? 'var(--warning)' : 'var(--danger)'
                                    }; border-radius: 4px; transition: width 0.3s ease;"></div>
                                </div>
                                <span style="font-size: 11px; color: var(--muted); font-weight:bold; min-width:35px;">${progressPercent}%</span>
                            </div>
                        </td>
                        <td>
                            <span style="padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; background: ${
                                statusColor === 'debt-paid' ? 'var(--success)' : 
                                statusColor === 'debt-high' ? 'var(--danger)' : 
                                statusColor === 'debt-medium' ? 'var(--warning)' : 'var(--info)'
                            }; color: white; display:inline-block; min-width:80px; text-align:center;">
                                <i class="fas fa-${
                                    statusColor === 'debt-paid' ? 'check' : 
                                    statusColor === 'debt-high' ? 'exclamation-triangle' : 
                                    statusColor === 'debt-medium' ? 'clock' : 'info-circle'
                                }"></i>
                                ${statusText}
                            </span>
                        </td>
                    </tr>
                `;
            });

            // صف الإجمالي
            const grandStatusColor = getDebtColor(grandRemaining, grandTotal);
            const grandProgressPercent = grandTotal > 0 ? ((grandPaid / grandTotal) * 100).toFixed(1) : '0';

            tableHTML += `
                            </tbody>
                            <tfoot>
                                <tr style="background: rgba(59, 130, 246, 0.1); font-weight: bold; border-top: 2px solid var(--primary);">
                                    <td>🏆 الإجمالي</td>
                                    <td>${debts.length}</td>
                                    <td><span style="color: var(--warning);">${grandTotal.toLocaleString()} ريال</span></td>
                                    <td><span style="color: var(--success);">${grandPaid.toLocaleString()} ريال</span></td>
                                    <td><span class="${grandStatusColor}">${grandRemaining.toLocaleString()} ريال</span></td>
                                    <td>-</td>
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
                                            <span style="font-size: 11px; color: var(--muted); font-weight:bold; min-width:35px;">${grandProgressPercent}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span style="padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; background: ${
                                            grandStatusColor === 'debt-paid' ? 'var(--success)' : 
                                            grandStatusColor === 'debt-high' ? 'var(--danger)' : 
                                            grandStatusColor === 'debt-medium' ? 'var(--warning)' : 'var(--info)'
                                        }; color: white;">
                                            ${grandRemaining === 0 ? 'جميع الديون مسددة' : 'قيد السداد'}
                                        </span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            `;

            // إضافة أحداث الصفوف للنقر لعرض التفاصيل
            setTimeout(() => {
                document.querySelectorAll('.debt-row').forEach(row => {
                    eventManager.addListener(row, 'click', function() {
                        const debtorName = this.getAttribute('data-debtor');
                        showDebtorDetails(debtorName);
                    });
                });
            }, 100);

            return tableHTML;
        } catch (error) {
            console.error('خطأ في إنشاء الجدول:', error);
            return `
                <div class="card">
                    <p style="text-align:center;padding:20px;color:var(--danger);">
                        <i class="fas fa-exclamation-triangle"></i>
                        حدث خطأ في إنشاء الجدول
                    </p>
                </div>
            `;
        }
    }

    function createSummaryCards() {
        try {
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

                if (new Date(debt.date) > new Date(debtors[debt.name].latestDate)) {
                    debtors[debt.name].latestDate = debt.date;
                }

                grandTotal += debt.totalAmount;
                grandPaid += debt.paidAmount;
                grandRemaining += debt.remainingAmount;
            });

            let cardsHTML = `
                <div class="card">
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 16px;">
            `;

            // ترتيب المتدينين حسب المبلغ المتبقي (الأكبر أولاً)
            const sortedDebtors = Object.keys(debtors).sort((a, b) => debtors[b].remaining - debtors[a].remaining);

            sortedDebtors.forEach(name => {
                const debtor = debtors[name];
                const debtColor = getDebtColor(debtor.remaining, debtor.total);
                const progressPercent = debtor.total > 0 ? ((debtor.paid / debtor.total) * 100).toFixed(1) : '0';
                const statusText = debtor.remaining === 0 ? 'مسدد بالكامل' : debtor.paid === 0 ? 'لم يبدأ السداد' : 'قيد السداد';

                cardsHTML += `
                    <div class="debtor-card" data-debtor="${name}" style="
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
                                ${statusText}
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

            // إضافة أحداث البطاقات للنقر لعرض التفاصيل
            setTimeout(() => {
                document.querySelectorAll('.debtor-card').forEach(card => {
                    eventManager.addListener(card, 'click', function() {
                        const debtorName = this.getAttribute('data-debtor');
                        showDebtorDetails(debtorName);
                    });
                });
            }, 100);

            return cardsHTML;
        } catch (error) {
            console.error('خطأ في إنشاء البطاقات:', error);
            return `
                <div class="card">
                    <p style="text-align:center;padding:20px;color:var(--danger);">
                        <i class="fas fa-exclamation-triangle"></i>
                        حدث خطأ في إنشاء البطاقات
                    </p>
                </div>
            `;
        }
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

    function showDebtorDetails(debtorName) {
        const matchingDebts = debts.filter(debt => debt.name === debtorName);
        if (matchingDebts.length === 0) return;

        // إنشاء نافذة منبثقة لعرض التفاصيل
        const modalHTML = `
            <div class="modal" id="debtorDetailsModal">
                <div class="modal-content" style="max-width: 800px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3 style="margin: 0; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-user-circle"></i>
                            التفاصيل الكاملة لـ ${debtorName}
                        </h3>
                        <button id="closeDebtorDetails" class="ghost small">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div style="max-height: 60vh; overflow-y: auto; padding-right: 10px;">
                        ${createDebtorDetails(debtorName, matchingDebts)}
                    </div>
                </div>
            </div>
        `;

        // إزالة النافذة القديمة إذا كانت موجودة
        const oldModal = document.getElementById('debtorDetailsModal');
        if (oldModal) oldModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // إضافة الأحداث
        const closeBtn = document.getElementById('closeDebtorDetails');
        if (closeBtn) {
            eventManager.addListener(closeBtn, 'click', function() {
                const modal = document.getElementById('debtorDetailsModal');
                if (modal) modal.remove();
            });
        }

        // إغلاق النافذة بالنقر خارجها
        const modal = document.getElementById('debtorDetailsModal');
        if (modal) {
            eventManager.addListener(modal, 'click', function(e) {
                if (e.target === this) {
                    this.remove();
                }
            });
        }
    }

    function createDebtorDetails(debtorName, debts) {
        const totalAmount = debts.reduce((sum, debt) => sum + debt.totalAmount, 0);
        const paidAmount = debts.reduce((sum, debt) => sum + debt.paidAmount, 0);
        const remainingAmount = totalAmount - paidAmount;

        let detailsHTML = `
            <div class="card" style="margin-bottom: 20px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; text-align: center;">
                    <div>
                        <div style="font-size: 12px; color: var(--muted);">عدد الديون</div>
                        <div style="font-size: 24px; font-weight: bold; color: var(--primary);">${debts.length}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--muted);">الإجمالي</div>
                        <div style="font-size: 24px; font-weight: bold; color: var(--warning);">${totalAmount.toLocaleString()} ريال</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--muted);">المسدد</div>
                        <div style="font-size: 24px; font-weight: bold; color: var(--success);">${paidAmount.toLocaleString()} ريال</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--muted);">المتبقي</div>
                        <div style="font-size: 24px; font-weight: bold; color: var(--danger);">${remainingAmount.toLocaleString()} ريال</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h4 style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-list"></i>
                    تفاصيل الديون (${debts.length})
                </h4>
        `;

        debts.forEach((debt, index) => {
            const debtColor = getDebtColor(debt.remainingAmount, debt.totalAmount);
            const progressPercent = debt.totalAmount > 0 ? ((debt.paidAmount / debt.totalAmount) * 100).toFixed(1) : '0';

            detailsHTML += `
                <div style="padding: 15px; background: rgba(255,255,255,0.05); border-radius: 12px; margin-bottom: 10px; border-left: 4px solid ${
                    debtColor === 'debt-paid' ? 'var(--success)' : 
                    debtColor === 'debt-high' ? 'var(--danger)' : 
                    debtColor === 'debt-medium' ? 'var(--warning)' : 'var(--info)'
                };">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <div>
                            <div style="font-weight: bold; margin-bottom: 5px;">الدين ${index + 1}</div>
                            <div style="font-size: 12px; color: var(--muted);">
                                ${debt.date} - ${debt.timeOfDay}
                            </div>
                        </div>
                        <span class="${debtColor}" style="font-weight: bold; font-size: 16px;">
                            ${debt.remainingAmount.toLocaleString()} / ${debt.totalAmount.toLocaleString()} ريال
                        </span>
                    </div>
                    
                    <div style="margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 5px;">
                            <span style="color: var(--success);">مسدد: ${debt.paidAmount.toLocaleString()} ريال</span>
                            <span style="color: var(--muted);">${progressPercent}%</span>
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
                                التسديدات (${debt.payments.length})
                            </div>
                            ${debt.payments.slice(0, 5).map(payment => `
                                <div style="font-size: 11px; color: var(--success); padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                    +${payment.amount.toLocaleString()} ريال - ${payment.date}
                                </div>
                            `).join('')}
                            ${debt.payments.length > 5 ? `
                                <div style="font-size: 10px; color: var(--muted); text-align: center; padding: 5px 0;">
                                    + ${debt.payments.length - 5} تسديدات أخرى
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        });

        detailsHTML += `</div>`;
        return detailsHTML;
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
                        <span class="${getDebtColor(debt.remainingAmount, debt.totalAmount)}">
                            ${debt.totalAmount} ريال
                        </span>
                    </div>
                `).join('') : '<p style="text-align:center;padding:20px;color:var(--muted);">لا توجد ديون حديثة</p>';
            }

            // تحديث آخر التسديدات
            const recentPaymentsElement = document.getElementById('recentPayments');
            if (recentPaymentsElement) {
                const allPayments = [];
                debts.forEach(debt => {
                    if (debt.payments) {
                        debt.payments.forEach(payment => {
                            allPayments.push({
                                name: debt.name,
                                amount: payment.amount,
                                date: payment.date
                            });
                        });
                    }
                });
                
                const recentPayments = allPayments.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
                
                recentPaymentsElement.innerHTML = recentPayments.length ? recentPayments.map(payment => `
                    <div class="list-item debt-item">
                        <div>
                            <strong>${payment.name}</strong>
                            <div style="font-size: 12px; color: var(--muted);">
                                ${payment.date}
                            </div>
                        </div>
                        <span style="color: var(--success);">
                            +${payment.amount} ريال
                        </span>
                    </div>
                `).join('') : '<p style="text-align:center;padding:20px;color:var(--muted);">لا توجد تسديدات حديثة</p>';
            }
        } catch (error) {
            console.error('خطأ في تحديث لوحة التحكم:', error);
        }
    }

    // 🚀 نظام القات المحسن مع العرض الهجين
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
        
        if (parseInt(count) <= 0) {
            showToast('❌ الرجاء إدخال عدد صحيح أكبر من الصفر', 'error');
            countInput.focus();
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
        
        // تنظيف أي أحداث سابقة لمنع تسرب الذاكرة
        document.querySelectorAll('.qat-view-toggle, .delete-qat').forEach(btn => {
            eventManager.cleanupElement(btn);
        });
        
        qatListEl.innerHTML = '';
        
        if(!qats || qats.length === 0){ 
            qatListEl.innerHTML='<p style="text-align:center;padding:20px;color:var(--muted);">لا توجد سجلات</p>'; 
            return; 
        }

        try {
            // شريط التحكم بالعرض للقات
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

            // تحميل البطيء للمحتوى
            setTimeout(() => {
                try {
                    if (currentQatViewMode === 'table') {
                        const tableContent = createQatTable();
                        if (tableContent) {
                            qatListEl.innerHTML += tableContent;
                            setupViewToggleEvents();
                        }
                    } else {
                        const cardsContent = createQatCards();
                        if (cardsContent) {
                            qatListEl.innerHTML += cardsContent;
                            setupViewToggleEvents();
                        }
                    }
                } catch (error) {
                    console.error('خطأ في عرض القات:', error);
                    qatListEl.innerHTML += `
                        <div class="card">
                            <p style="text-align:center;padding:20px;color:var(--danger);">
                                <i class="fas fa-exclamation-triangle"></i>
                                حدث خطأ في عرض سجل القات
                            </p>
                        </div>
                    `;
                }
            }, 10);
        } catch (error) {
            console.error('خطأ فادح في renderQats:', error);
            qatListEl.innerHTML = `
                <div class="card">
                    <p style="text-align:center;padding:20px;color:var(--danger);">
                        <i class="fas fa-exclamation-triangle"></i>
                        خطأ في تحميل سجل القات
                    </p>
                </div>
            `;
        }
    }

    function getTotalQatTypes() {
        const types = new Set();
        qats.forEach(qat => types.add(qat.type));
        return types.size;
    }

    function createQatTable() {
        try {
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

            // إضافة أحداث الحذف
            setTimeout(() => {
                document.querySelectorAll('.delete-qat').forEach(btn => {
                    eventManager.addListener(btn, 'click', function() {
                        const index = parseInt(this.getAttribute('data-index'));
                        if (!isNaN(index)) {
                            deleteQat(index);
                        }
                    });
                });
            }, 100);

            return tableHTML;
        } catch (error) {
            console.error('خطأ في إنشاء جدول القات:', error);
            return `
                <div class="card">
                    <p style="text-align:center;padding:20px;color:var(--danger);">
                        <i class="fas fa-exclamation-triangle"></i>
                        حدث خطأ في إنشاء جدول القات
                    </p>
                </div>
            `;
        }
    }

    function createQatCards() {
        try {
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

            // إضافة أحداث الحذف
            setTimeout(() => {
                document.querySelectorAll('.delete-qat').forEach(btn => {
                    eventManager.addListener(btn, 'click', function() {
                        const index = parseInt(this.getAttribute('data-index'));
                        if (!isNaN(index)) {
                            deleteQat(index);
                        }
                    });
                });
            }, 100);

            return cardsHTML;
        } catch (error) {
            console.error('خطأ في إنشاء بطاقات القات:', error);
            return `
                <div class="card">
                    <p style="text-align:center;padding:20px;color:var(--danger);">
                        <i class="fas fa-exclamation-triangle"></i>
                        حدث خطأ في إنشاء بطاقات القات
                    </p>
                </div>
            `;
        }
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

    // 🚀 نظام الحذف مع تأكيد حقيقي
    function deleteQat(index) {
        if (index < 0 || index >= qats.length) return;
        
        const qatToDelete = qats[index];
        
        // إنشاء نافذة تأكيد حقيقية
        const confirmHTML = `
            <div class="modal" id="deleteQatConfirmModal">
                <div class="modal-content" style="max-width: 400px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: var(--danger); margin-bottom: 15px;"></i>
                        <h3 style="margin: 0 0 10px 0;">تأكيد الحذف</h3>
                        <p style="color: var(--muted); margin: 0;">
                            هل أنت متأكد من حذف سجل القات؟
                        </p>
                        <div style="background: var(--card-hover); padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <strong>${qatToDelete.type}</strong>
                            <div style="color: var(--muted); font-size: 12px;">
                                العدد: ${qatToDelete.count} | التاريخ: ${qatToDelete.date}
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button id="confirmDeleteQat" class="danger" style="flex: 1;">
                            <i class="fas fa-trash"></i> نعم، احذف
                        </button>
                        <button id="cancelDeleteQat" class="ghost" style="flex: 1;">
                            <i class="fas fa-times"></i> إلغاء
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // إزالة النافذة القديمة إذا كانت موجودة
        const oldModal = document.getElementById('deleteQatConfirmModal');
        if (oldModal) oldModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', confirmHTML);
        
        // أحداث التأكيد الحقيقية
        const confirmBtn = document.getElementById('confirmDeleteQat');
        const cancelBtn = document.getElementById('cancelDeleteQat');
        const modal = document.getElementById('deleteQatConfirmModal');
        
        if (confirmBtn) {
            eventManager.addListener(confirmBtn, 'click', async function() {
                // حذف حقيقي من المصفوفة
                qats.splice(index, 1);
                
                // حفظ حقيقي
                saveToLocalStorage();
                await syncToFirebaseWithRetry();
                
                // تحديث الواجهة
                renderQats();
                updateDashboard();
                updateSettingsStats();
                
                // إغلاق النافذة
                if (modal) modal.remove();
                
                showToast('✅ تم حذف سجل القات بنجاح');
            });
        }
        
        if (cancelBtn) {
            eventManager.addListener(cancelBtn, 'click', function() {
                if (modal) modal.remove();
            });
        }
        
        // إغلاق بالنقر خارج النافذة
        if (modal) {
            eventManager.addListener(modal, 'click', function(e) {
                if (e.target === this) {
                    this.remove();
                }
            });
        }
    }

    // 🚀 نظام سجل الدين التفصيلي المحسن
    function showDebtHistory(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            showToast('⚠️ الرجاء إدخال نص للبحث', 'warning');
            return;
        }
        
        // البحث عن المتدينين المطابقين
        const matchingDebts = debts.filter(debt => 
            debt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            debt.date.includes(searchTerm)
        );

        if (matchingDebts.length === 0) {
            showToast('❌ لا توجد نتائج للبحث', 'error');
            return;
        }

        // عرض السجل التفصيلي
        const debtHistoryCard = document.getElementById('debtHistoryCard');
        const debtHistoryList = document.getElementById('debtHistoryList');
        
        if (debtHistoryCard && debtHistoryList) {
            debtHistoryCard.classList.remove('hidden');
            
            // شريط التحكم بالعرض لسجل الدين التفصيلي
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

            // تحميل البطيء للمحتوى
            setTimeout(() => {
                try {
                    if (currentDebtHistoryViewMode === 'table') {
                        const tableContent = createDebtHistoryTable(matchingDebts, searchTerm);
                        if (tableContent) {
                            debtHistoryList.innerHTML += tableContent;
                            setupViewToggleEvents();
                        }
                    } else {
                        const cardsContent = createDebtHistoryCards(matchingDebts, searchTerm);
                        if (cardsContent) {
                            debtHistoryList.innerHTML += cardsContent;
                            setupViewToggleEvents();
                        }
                    }
                } catch (error) {
                    console.error('خطأ في عرض سجل الدين:', error);
                    debtHistoryList.innerHTML += `
                        <div class="card">
                            <p style="text-align:center;padding:20px;color:var(--danger);">
                                <i class="fas fa-exclamation-triangle"></i>
                                حدث خطأ في عرض سجل الدين
                            </p>
                        </div>
                    `;
                }
            }, 10);

            // التمرير إلى قسم السجل التفصيلي
            debtHistoryCard.scrollIntoView({ behavior: 'smooth' });
            showToast(`📊 عرض السجل التفصيلي لـ ${new Set(matchingDebts.map(d => d.name)).size} متدين`);
        }
    }

    function createDebtHistoryTable(matchingDebts, searchTerm) {
        try {
            // تجميع الديون حسب اسم المتدين والتاريخ والوقت
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
        } catch (error) {
            console.error('خطأ في إنشاء جدول سجل الدين:', error);
            return `
                <div class="card">
                    <p style="text-align:center;padding:20px;color:var(--danger);">
                        <i class="fas fa-exclamation-triangle"></i>
                        حدث خطأ في إنشاء جدول سجل الدين
                    </p>
                </div>
            `;
        }
    }

    function createDebtHistoryCards(matchingDebts, searchTerm) {
        try {
            // تجميع الديون حسب اسم المتدين
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
                        
                        <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-top: 10px;">
                            <div style="font-size: 11px; color: var(--muted); margin-bottom: 5px;">
                                <i class="fas fa-calendar"></i>
                                التفاصيل اليومية:
                            </div>
                            ${Array.from(new Set(debtor.debts.map(d => d.date))).slice(0, 3).map(date => {
                                const dayDebts = debtor.debts.filter(d => d.date === date);
                                const dayTotal = dayDebts.reduce((sum, d) => sum + d.totalAmount, 0);
                                const dayPaid = dayDebts.reduce((sum, d) => sum + d.paidAmount, 0);
                                const dayRemaining = dayTotal - dayPaid;
                                const dayName = getDayName(date);
                                return `
                                    <div style="font-size: 10px; color: var(--muted); padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                        ${date} (${dayName}): ${dayTotal.toLocaleString()} ريال - مسدد: ${dayPaid.toLocaleString()} ريال
                                    </div>
                                `;
                            }).join('')}
                            ${new Set(debtor.debts.map(d => d.date)).size > 3 ? 
                                `<div style="font-size: 10px; color: var(--primary); text-align:center; padding:5px 0;">
                                    + ${new Set(debtor.debts.map(d => d.date)).size - 3} أيام أخرى
                                </div>` : ''
                            }
                        </div>
                    </div>
                `;
            });

            cardsHTML += `
                    </div>
                </div>
            `;

            return cardsHTML;
        } catch (error) {
            console.error('خطأ في إنشاء بطاقات سجل الدين:', error);
            return `
                <div class="card">
                    <p style="text-align:center;padding:20px;color:var(--danger);">
                        <i class="fas fa-exclamation-triangle"></i>
                        حدث خطأ في إنشاء بطاقات سجل الدين
                    </p>
                </div>
            `;
        }
    }

    // 🚀 دوال التصدير المتقدمة مع معالجة الأخطاء
    async function exportToExcel(data, filename) {
        if (!data || data.length === 0) {
            showToast('لا توجد بيانات للتصدير', 'error');
            return;
        }
        
        if (typeof ExcelJS === 'undefined') {
            showToast('مكتبة ExcelJS غير محملة. لا يمكن التصدير إلى Excel', 'error');
            return;
        }
        
        if (typeof saveAs === 'undefined') {
            showToast('مكتبة FileSaver غير محملة. لا يمكن حفظ الملف', 'error');
            return;
        }
        
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("البيانات", {
                views: [{ showGridLines: true }],
                pageSetup: { 
                    paperSize: 9,
                    orientation: 'landscape',
                    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 }
                }
            });

            // عنوان التقرير
            const titleRow = worksheet.addRow(['تقرير نظام إدارة الديون والقات']);
            titleRow.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF2E86AB' } };
            titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
            worksheet.mergeCells(`A1:${String.fromCharCode(64 + Object.keys(data[0]).length)}1`);
            titleRow.height = 30;

            // معلومات التصدير
            const infoRow = worksheet.addRow([
                `تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}`,
                `المستخدم: ${currentUser}`,
                `إجمالي السجلات: ${data.length}`
            ]);
            infoRow.font = { name: 'Arial', size: 10, color: { argb: 'FF666666' } };
            infoRow.alignment = { vertical: 'middle', horizontal: 'center' };
            worksheet.mergeCells(`A2:${String.fromCharCode(64 + Object.keys(data[0]).length)}2`);

            // سطر فارغ
            worksheet.addRow([]);

            // العناوين
            const headers = Object.keys(data[0]);
            const headerRow = worksheet.addRow(headers);
            
            headerRow.eachCell((cell, colNumber) => {
                cell.font = {
                    name: 'Arial',
                    size: 12,
                    bold: true,
                    color: { argb: 'FFFFFFFF' }
                };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF2E86AB' }
                };
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: 'center',
                    wrapText: true
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF000000' } },
                    left: { style: 'thin', color: { argb: 'FF000000' } },
                    bottom: { style: 'thin', color: { argb: 'FF000000' } },
                    right: { style: 'thin', color: { argb: 'FF000000' } }
                };
            });
            headerRow.height = 25;

            // البيانات
            data.forEach((row, rowIndex) => {
                const dataRow = worksheet.addRow(Object.values(row));
                
                dataRow.eachCell((cell, colNumber) => {
                    cell.font = {
                        name: 'Arial',
                        size: 10
                    };
                    cell.alignment = {
                        vertical: 'middle',
                        horizontal: 'right',
                        wrapText: true
                    };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
                    };

                    if (rowIndex % 2 === 0) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF8F9FA' }
                        };
                    }
                });
                dataRow.height = 20;
            });

            // ضبط عرض الأعمدة
            worksheet.columns.forEach(column => {
                let maxLength = 0;
                column.eachCell({ includeEmpty: true }, cell => {
                    try {
                        const cellValue = cell.value ? cell.value.toString() : '';
                        const columnLength = cellValue.length;
                        if (columnLength > maxLength) {
                            maxLength = columnLength;
                        }
                    } catch (error) {
                        console.log('خطأ في معالجة الخلية:', error);
                    }
                });
                column.width = Math.min(Math.max(maxLength + 3, 12), 35);
            });

            // تجميد الصفوف الأولى
            worksheet.views = [
                { state: 'frozen', xSplit: 0, ySplit: 4 }
            ];

            // توقيع
            const signatureRow = worksheet.addRow(['تم الإنشاء تلقائياً بواسطة نظام إدارة الديون والقات']);
            signatureRow.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF999999' } };
            signatureRow.alignment = { vertical: 'middle', horizontal: 'center' };
            worksheet.mergeCells(`A${worksheet.rowCount}:${String.fromCharCode(64 + Object.keys(data[0]).length)}${worksheet.rowCount}`);

            // حفظ الملف
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `${filename}.xlsx`);
            showToast(`✅ تم تصدير البيانات إلى ${filename}.xlsx`);
        } catch (error) {
            console.error('خطأ في التصدير إلى Excel:', error);
            showToast('❌ حدث خطأ أثناء التصدير إلى Excel', 'error');
        }
    }

    async function exportToWord(data, title, filename) {
        if (!data || data.length === 0) {
            showToast('لا توجد بيانات للتصدير', 'error');
            return;
        }
        
        if (typeof saveAs === 'undefined') {
            showToast('مكتبة FileSaver غير محملة. لا يمكن حفظ الملف', 'error');
            return;
        }
        
        try {
            // إنشاء محتوى HTML مبسط ومتوافق مع Word
            let htmlContent = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" 
      xmlns:w="urn:schemas-microsoft-com:office:word" 
      xmlns="http://www.w3.org//TR/REC-html40">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        body {
            font-family: 'Simplified Arabic', 'Times New Roman', serif;
            direction: rtl;
            text-align: right;
            margin: 20px;
            line-height: 1.6;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #2E86AB;
            padding-bottom: 15px;
        }
        .header h1 {
            color: #2E86AB;
            font-size: 24px;
            margin-bottom: 10px;
        }
        .info-section {
            background: #f8f9fa;
            padding: 15px;
            margin: 20px 0;
            border-right: 4px solid #2E86AB;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 12px;
        }
        table, th, td {
            border: 1px solid #000000;
        }
        th {
            background-color: #2E86AB;
            color: white;
            padding: 10px;
            text-align: right;
            font-weight: bold;
        }
        td {
            padding: 8px 10px;
            text-align: right;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ccc;
            font-size: 11px;
            color: #666;
        }
        .total-row {
            background-color: #e8f5e8;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title}</h1>
        <div>نظام إدارة الديون والقات المتقدم</div>
    </div>

    <div class="info-section">
        <div><strong>تاريخ التصدير:</strong> ${new Date().toLocaleDateString('ar-SA')}</div>
        <div><strong>المستخدم:</strong> ${currentUser}</div>
        <div><strong>إجمالي السجلات:</strong> ${data.length}</div>
    </div>

    <table>
        <thead>
            <tr>
`;

            // العناوين
            Object.keys(data[0]).forEach(header => {
                htmlContent += `               <th>${header}</th>\n`;
            });

            htmlContent += `            </tr>
        </thead>
        <tbody>
`;

            // البيانات
            data.forEach((row, index) => {
                const isTotalRow = index === data.length - 1 && row['اسم المتدين'] === 'الإجمالي';
                const rowClass = isTotalRow ? 'total-row' : '';
                
                htmlContent += `            <tr class="${rowClass}">\n`;
                Object.values(row).forEach(cell => {
                    htmlContent += `               <td>${cell}</td>\n`;
                });
                htmlContent += `            </tr>\n`;
            });

            htmlContent += `        </tbody>
    </table>

    <div class="footer">
        <div>تم إنشاء هذا التقرير بواسطة نظام إدارة الديون والقات المتقدم</div>
        <div>جميع الحقوق محفوظة © ${new Date().getFullYear()}</div>
        <div style="margin-top: 20px;">
            <div>التوقيع: _________________________</div>
            <div>التاريخ: _________________________</div>
        </div>
    </div>
</body>
</html>`;

            // إنشاء ملف Word
            const blob = new Blob([htmlContent], { 
                type: 'application/msword'
            });
            
            saveAs(blob, `${filename}.doc`);
            
            showToast(`✅ تم تصدير البيانات إلى ${filename}.doc`);

        } catch (error) {
            console.error('خطأ في التصدير إلى Word:', error);
            showToast('❌ حدث خطأ أثناء التصدير إلى Word', 'error');
        }
    }

    // إعداد الأحداث المحسنة
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
                    // ✅ لا نحتاج لاستدعاء showApp() هنا لأنها تستدعى داخل loginUser()
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
                    // ✅ لا نحتاج لاستدعاء showApp() هنا لأنها تستدعى داخل createAccount()
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
        const changePasswordModal = document.getElementById('changePasswordModal');
        const saveNewPassword = document.getElementById('saveNewPassword');
        const cancelChangePassword = document.getElementById('cancelChangePassword');
        
        if (saveNewPassword) eventManager.addListener(saveNewPassword, 'click', changePasswordHandler);
        if (cancelChangePassword) {
            eventManager.addListener(cancelChangePassword, 'click', () => {
                if (changePasswordModal) changePasswordModal.classList.add('hidden');
            });
        }

        // أحداث نافذة حذف البيانات
        const deleteConfirmModal = document.getElementById('deleteConfirmModal');
        const confirmDeleteAll = document.getElementById('confirmDeleteAll');
        const cancelDeleteAll = document.getElementById('cancelDeleteAll');
        
        if (confirmDeleteAll) eventManager.addListener(confirmDeleteAll, 'click', deleteAllData);
        if (cancelDeleteAll) {
            eventManager.addListener(cancelDeleteAll, 'click', () => {
                if (deleteConfirmModal) deleteConfirmModal.classList.add('hidden');
            });
        }

        // أحداث نافذة التصدير
        const exportModal = document.getElementById('exportModal');
        const closeExportModal = document.getElementById('closeExportModal');
        const exportDebtsExcelBtn = document.getElementById('exportDebtsExcelBtn');
        const exportDebtsWordBtn = document.getElementById('exportDebtsWordBtn');
        const exportSummaryExcelBtn = document.getElementById('exportSummaryExcelBtn');
        const exportSummaryWordBtn = document.getElementById('exportSummaryWordBtn');
        
        if (closeExportModal) {
            eventManager.addListener(closeExportModal, 'click', () => {
                if (exportModal) exportModal.classList.add('hidden');
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

        // إعداد قوائم الأيام
        setupDaysDropdowns();
    }

    // إعداد قوائم الأيام
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

    // دوال إدارة كلمة المرور
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
        
        if (newPass.length < 6) {
            showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
            return;
        }
        
        try {
            userPassword = await hashPassword(newPass);
            saveToLocalStorage();
            await syncToFirebaseWithRetry();
            const changePasswordModal = document.getElementById('changePasswordModal');
            if (changePasswordModal) changePasswordModal.classList.add('hidden');
            showToast('تم تغيير كلمة المرور بنجاح');
        } catch (error) {
            showToast('❌ فشل في تغيير كلمة المرور', 'error');
        }
    }

    // تحسين أزرار لوحة التحكم
    function setupDashboardActions() {
        const addDebtBtn = document.getElementById('quickAddDebt');
        const addPaymentBtn = document.getElementById('quickAddPayment');
        const addQatBtn = document.getElementById('quickAddQat');
        const exportReportBtn = document.getElementById('quickExport');
        
        if (addDebtBtn) {
            eventManager.addListener(addDebtBtn, 'click', function() {
                showPage('debtsPage');
                setTimeout(() => {
                    const debtName = document.getElementById('debtName');
                    if (debtName) {
                        debtName.focus();
                        showToast('👤 ابدأ بإدخال اسم المتدين لإضافة دين جديد', 'info');
                    }
                }, 300);
            });
        }

        if (addPaymentBtn) {
            eventManager.addListener(addPaymentBtn, 'click', function() {
                showPage('debtsPage');
                setTimeout(() => {
                    const debtorSelect = document.getElementById('debtorSelect');
                    if (debtorSelect && debtorSelect.options.length > 1) {
                        debtorSelect.focus();
                        showToast('💰 اختر المتدين وأدخل مبلغ التسديد', 'info');
                    } else {
                        showToast('⚠️ لا توجد ديون نشطة للتسديد', 'warning');
                    }
                }, 300);
            });
        }

        if (addQatBtn) {
            eventManager.addListener(addQatBtn, 'click', function() {
                showPage('qatPage');
                setTimeout(() => {
                    const qatType = document.getElementById('qatType');
                    if (qatType) {
                        qatType.focus();
                        showToast('🌿 ابدأ بإدخال نوع القات', 'info');
                    }
                }, 300);
            });
        }

        if (exportReportBtn) {
            eventManager.addListener(exportReportBtn, 'click', function() {
                const exportModal = document.getElementById('exportModal');
                if (exportModal) {
                    exportModal.classList.remove('hidden');
                }
            });
        }
    }

    // 🚀 نظام إعداد أحداث التبديل مع منع تسرب الذاكرة
    function setupViewToggleEvents() {
        // أحداث تبديل عرض الديون
        document.querySelectorAll('.view-toggle').forEach(btn => {
            eventManager.cleanupElement(btn);
            eventManager.addListener(btn, 'click', function() {
                currentViewMode = this.getAttribute('data-view');
                localStorage.setItem('debtViewMode', currentViewMode);
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
        
        // مراقبة اتصال Firebase
        if (database) {
            const connectionRef = database.ref('.info/connected');
            connectionRef.on('value', (snapshot) => {
                const connected = snapshot.val() === true;
                if (connected) {
                    updateSyncStatus('online', 'متصـل بالسحابة');
                }
            });
        }
    }

    // 🚀 تحسين أزرار لوحة التحكم
    function enhanceDashboardButtons() {
        const quickActions = document.querySelectorAll('.quick-action-btn');
        
        quickActions.forEach(btn => {
            btn.style.transition = 'all 0.3s ease';
            
            eventManager.addListener(btn, 'mouseenter', function() {
                this.style.transform = 'translateY(-5px) scale(1.05)';
                this.style.boxShadow = 'var(--shadow-lg)';
            });
            
            eventManager.addListener(btn, 'mouseleave', function() {
                this.style.transform = 'translateY(0) scale(1)';
                this.style.boxShadow = 'var(--shadow)';
            });
        });
    }

    // 🚀 نظام حذف جميع البيانات
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
            
            const deleteConfirmModal = document.getElementById('deleteConfirmModal');
            if (deleteConfirmModal) deleteConfirmModal.classList.add('hidden');
            
            showToast('✅ تم حذف جميع البيانات بنجاح', 'success');
            showToast('💾 تم إنشاء نسخة احتياطية تلقائية يمكنك الاستعادة منها', 'info');
        } catch (error) {
            console.error('خطأ في حذف البيانات:', error);
            showToast('❌ فشل في حذف البيانات', 'error');
        }
    }

    // 🚀 نظام تصدير البيانات إلى ملف
    function exportDataToFile() {
        try {
            // إعداد البيانات الحقيقية للتصدير
            const exportData = {
                debts: JSON.parse(JSON.stringify(debts)),
                qats: JSON.parse(JSON.stringify(qats)),
                user: currentUser,
                timestamp: new Date().toISOString(),
                version: '2.0',
                statistics: {
                    totalDebts: debts.reduce((sum, debt) => sum + debt.totalAmount, 0),
                    totalPaid: debts.reduce((sum, debt) => sum + debt.paidAmount, 0),
                    totalRemaining: debts.reduce((sum, debt) => sum + debt.remainingAmount, 0),
                    debtsCount: debts.length,
                    qatsCount: qats.length,
                    activeDebts: debts.filter(debt => debt.remainingAmount > 0).length
                }
            };
            
            // تحويل إلى JSON مع تنسيق
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { 
                type: 'application/json;charset=utf-8' 
            });
            
            // إنشاء رابط تحميل حقيقي
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `نسخة-احتياطية-${currentUser}-${new Date().toISOString().slice(0,10)}.json`;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // تحرير الذاكرة
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
            showToast(`✅ تم إنشاء نسخة احتياطية تحتوي على ${debts.length} دين و ${qats.length} سجل قات`);
            
            // تحديث حالة النسخ الاحتياطي
            backupData = exportData;
            localStorage.setItem(`backup_${currentUser}`, JSON.stringify(backupData));
            
        } catch (error) {
            console.error('خطأ في التصدير:', error);
            showToast('❌ فشل في إنشاء النسخة الاحتياطية', 'error');
        }
    }

    // 🚀 نظام استيراد البيانات من ملف
    function importDataFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.txt';
        
        eventManager.addListener(input, 'change', async function(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            eventManager.addListener(reader, 'load', async function(e) {
                try {
                    const importedData = JSON.parse(e.target.result);
                    
                    if (isValidBackupData(importedData)) {
                        if (confirm(`هل تريد استيراد البيانات من الملف؟\n\n📅 تاريخ النسخة: ${new Date(importedData.timestamp).toLocaleString('ar-SA')}\n👤 المستخدم: ${importedData.user}\n📁 تحتوي على: ${importedData.debts.length} ديون، ${importedData.qats.length} سجلات قات`)) {
                                
                                backupData = importedData;
                                debts = JSON.parse(JSON.stringify(importedData.debts));
                                qats = JSON.parse(JSON.stringify(importedData.qats));
                                
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

    function isValidBackupData(data) {
        return data && 
               data.debts && Array.isArray(data.debts) &&
               data.qats && Array.isArray(data.qats) &&
               data.user && typeof data.user === 'string' &&
               data.timestamp && typeof data.timestamp === 'string';
    }

    // 🚀 نظام البحث والتصفية
    function filterDebts(searchTerm) {
        const debtsListEl = document.getElementById('debtsList');
        if (!debtsListEl) return;
        
        debtsListEl.innerHTML = '';
        
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

        filteredDebts.forEach(debt => {
            const debtCard = document.createElement('div');
            debtCard.className = 'list-item debt-item fade-in';
            
            const debtColor = getDebtColor(debt.remainingAmount, debt.totalAmount);
            
            debtCard.innerHTML = `
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h4 style="margin:0;">${debt.name}</h4>
                        <span class="${debtColor}">${debt.remainingAmount} / ${debt.totalAmount} ريال</span>
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
                            ${debt.payments.length > 3 ? `
                                <div style="font-size:11px; color:var(--muted); margin-top:4px;">
                                    + ${debt.payments.length - 3} تسديدات أخرى
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
            
            debtsListEl.appendChild(debtCard);
        });
    }

    function filterQats(searchTerm) {
        const qatListEl = document.getElementById('qatList');
        if (!qatListEl) return;
        
        qatListEl.innerHTML = '';
        
        const filteredQats = qats.filter(qat => 
            qat.type.toLowerCase().includes(searchTerm) ||
            qat.date.includes(searchTerm) ||
            qat.count.toString().includes(searchTerm)
        );
        
        if(filteredQats.length === 0){ 
            qatListEl.innerHTML='<p style="text-align:center;padding:20px;color:var(--muted);">لا توجد نتائج للبحث</p>'; 
            return; 
        }
        
        filteredQats.forEach(qat => {
            const div = document.createElement('div');
            div.className = 'list-item qat-item fade-in';
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

    // 🚀 الدوال العالمية للتصدير
    async function exportDebtsToExcel() {
        try {
            const exportModal = document.getElementById('exportModal');
            if (exportModal) exportModal.classList.add('hidden');
            
            if (!debts || debts.length === 0) {
                showToast('❌ لا توجد بيانات للتصدير', 'error');
                return;
            }
            
            if (typeof ExcelJS === 'undefined') {
                showToast('مكتبة ExcelJS غير محملة', 'error');
                return;
            }
            
            // إظهار حالة التحميل
            const exportBtn = document.getElementById('exportExcel') || document.getElementById('exportDebtsExcelBtn');
            const originalText = exportBtn ? exportBtn.innerHTML : '';
            if (exportBtn) {
                exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارِ التصدير...';
                exportBtn.disabled = true;
            }
            
            // حساب الإحصائيات الحقيقية
            const totalAmount = debts.reduce((sum, debt) => sum + debt.totalAmount, 0);
            const paidAmount = debts.reduce((sum, debt) => sum + debt.paidAmount, 0);
            const remainingAmount = totalAmount - paidAmount;

            // تحضير البيانات الحقيقية
            const data = debts.map(debt => ({
                'اسم المتدين': debt.name,
                'التاريخ': debt.date,
                'الوقت': debt.timeOfDay,
                'المبلغ الإجمالي': debt.totalAmount,
                'المبلغ المسدد': debt.paidAmount,
                'المبلغ المتبقي': debt.remainingAmount,
                'نسبة السداد': `${((debt.paidAmount / debt.totalAmount) * 100).toFixed(1)}%`,
                'الحالة': debt.remainingAmount === 0 ? 'مسدد بالكامل' : 
                          debt.paidAmount === 0 ? 'لم يسدد' : 'مسدد جزئياً',
                'عدد التسديدات': debt.payments ? debt.payments.length : 0,
                'آخر تحديث': new Date().toLocaleDateString('ar-SA')
            }));

            // إضافة صف الإجمالي
            data.push({
                'اسم المتدين': 'الإجمالي',
                'التاريخ': '-',
                'الوقت': '-',
                'المبلغ الإجمالي': totalAmount,
                'المبلغ المسدد': paidAmount,
                'المبلغ المتبقي': remainingAmount,
                'نسبة السداد': `${((paidAmount / totalAmount) * 100).toFixed(1)}%`,
                'الحالة': remainingAmount === 0 ? 'تم سداد جميع الديون' : 'توجد ديون متبقية',
                'عدد التسديدات': debts.reduce((sum, debt) => sum + (debt.payments ? debt.payments.length : 0), 0),
                'آخر تحديث': '-'
            });

            await exportToExcel(data, `تقرير-الديون-${currentUser}-${new Date().toISOString().slice(0,10)}`);
            
        } catch (error) {
            console.error('خطأ في التصدير:', error);
            showToast('❌ فشل في تصدير الملف', 'error');
        } finally {
            // إعادة حالة الزر
            const exportBtn = document.getElementById('exportExcel') || document.getElementById('exportDebtsExcelBtn');
            if (exportBtn) {
                exportBtn.innerHTML = originalText;
                exportBtn.disabled = false;
            }
        }
    }

    async function exportDebtsToWord() {
        try {
            const exportModal = document.getElementById('exportModal');
            if (exportModal) exportModal.classList.add('hidden');
            
            if (!debts || debts.length === 0) {
                showToast('❌ لا توجد بيانات للتصدير', 'error');
                return;
            }
            
            const totalAmount = debts.reduce((sum, debt) => sum + debt.totalAmount, 0);
            const paidAmount = debts.reduce((sum, debt) => sum + debt.paidAmount, 0);
            const remainingAmount = totalAmount - paidAmount;

            const data = debts.map(debt => ({
                'المتدين': debt.name,
                'التاريخ': debt.date,
                'الوقت': debt.timeOfDay,
                'الإجمالي': `${debt.totalAmount.toLocaleString()} ريال`,
                'المسدد': `${debt.paidAmount.toLocaleString()} ريال`,
                'المتبقي': `${debt.remainingAmount.toLocaleString()} ريال`,
                'نسبة السداد': `${((debt.paidAmount / debt.totalAmount) * 100).toFixed(1)}%`,
                'الحالة': debt.remainingAmount === 0 ? 'مسدد بالكامل' : 
                          debt.paidAmount === 0 ? 'لم يسدد' : 'مسدد جزئياً'
            }));

            data.push({
                'المتدين': 'الإجمالي',
                'التاريخ': '-',
                'الوقت': '-',
                'الإجمالي': `${totalAmount.toLocaleString()} ريال`,
                'المسدد': `${paidAmount.toLocaleString()} ريال`,
                'المتبقي': `${remainingAmount.toLocaleString()} ريال`,
                'نسبة السداد': `${((paidAmount / totalAmount) * 100).toFixed(1)}%`,
                'الحالة': remainingAmount === 0 ? 'تم سداد جميع الديون' : 'توجد ديون متبقية'
            });

            await exportToWord(data, 'تقرير مفصل للديون', `تقرير-الديون-${new Date().toISOString().slice(0,10)}`);
        } catch (error) {
            console.error('خطأ في التصدير:', error);
            showToast('❌ فشل في تصدير الملف', 'error');
        }
    }

    async function exportSummaryToExcel() {
        try {
            const exportModal = document.getElementById('exportModal');
            if (exportModal) exportModal.classList.add('hidden');
            
            if (!debts || debts.length === 0) {
                showToast('❌ لا توجد بيانات للتصدير', 'error');
                return;
            }
            
            if (typeof ExcelJS === 'undefined') {
                showToast('مكتبة ExcelJS غير محملة', 'error');
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
                'المتبقي': debtors[name].remaining + ' ريال',
                'الحالة': debtors[name].remaining === 0 ? 'مسدد بالكامل' : 
                          debtors[name].remaining === debtors[name].total ? 'لم يسدد' : 'مسدد جزئياً'
            }));
            
            await exportToExcel(data, `ملخص-الديون-${new Date().toISOString().slice(0,10)}`);
            
        } catch (error) {
            console.error('خطأ في التصدير:', error);
            showToast('❌ فشل في تصدير الملف', 'error');
        }
    }

    async function exportSummaryToWord() {
        try {
            const exportModal = document.getElementById('exportModal');
            if (exportModal) exportModal.classList.add('hidden');
            
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
                'المتبقي': debtors[name].remaining + ' ريال',
                'الحالة': debtors[name].remaining === 0 ? 'مسدد بالكامل' : 
                          debtors[name].remaining === debtors[name].total ? 'لم يسدد' : 'مسدد جزئياً'
            }));
            
            await exportToWord(data, 'ملخص الديون', `ملخص-الديون-${new Date().toISOString().slice(0,10)}`);
        } catch (error) {
            console.error('خطأ في التصدير:', error);
            showToast('❌ فشل في تصدير الملف', 'error');
        }
    }

    // تعريف الدوال العامة
    window.showExportOptions = function() {
        const exportModal = document.getElementById('exportModal');
        if (exportModal) {
            exportModal.classList.remove('hidden');
        }
    };

    window.closeExportModal = function() {
        const exportModal = document.getElementById('exportModal');
        if (exportModal) {
            exportModal.classList.add('hidden');
        }
    };

    window.renderDebtsSummary = renderDebtsSummary;
    window.showDebtHistory = showDebtHistory;
    window.getTotalQatTypes = getTotalQatTypes;
    window.getDayName = getDayName;

    // التهيئة النهائية
    async function init() {
        try {
            // ✅ تأكد من إعادة تعيين زر Google عند التحميل
            const googleBtn = document.getElementById('googleSignInBtn');
            if (googleBtn) {
                googleBtn.innerHTML = '<i class="fab fa-google" style="color: #db4437;"></i> تسجيل الدخول بحساب Google';
                googleBtn.disabled = false;
                googleBtn.classList.remove('loading');
            }
            
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
            
            // تحميل الأنظمة المتقدمة بعد التأكد من استقرار التطبيق
            setTimeout(() => {
                setupGoogleSignIn();
                setupDashboardActions();
                enhanceDashboardButtons();
                setupViewToggleEvents();
            }, 500);
            
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

    // بدء التطبيق
    document.addEventListener('DOMContentLoaded', init);
    // ========== نظام العمل بدون إنترنت ==========
const OFFLINE_MODE = {
  isActive: !navigator.onLine,
  autoSaveInterval: null,
  offlineMessage: null,
  
  init() {
    console.log('🔋 نظام عدم الاتصال: جاهز');
    
    // العناصر
    this.offlineMessage = document.getElementById('offlineMessage');
    
    // مراقبة حالة الاتصال
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // بدء الحفظ التلقائي
    this.startAutoSave();
    
    // إذا كان غير متصل، تحميل البيانات
    if (this.isActive) {
      setTimeout(() => this.loadFromLocalStorage(), 500);
    }
  },
  
  handleOnline() {
    this.isActive = false;
    if (this.offlineMessage) {
      this.offlineMessage.classList.add('hidden');
    }
    showToast('✅ تم استعادة الاتصال بالإنترنت', 'success');
    
    // محاولة المزامنة مع السحابة
    setTimeout(() => {
      if (currentUser && database) {
        syncToFirebaseWithRetry();
      }
    }, 2000);
  },
  
  handleOffline() {
    this.isActive = true;
    if (this.offlineMessage) {
      this.offlineMessage.classList.remove('hidden');
    }
    showToast('⚡ أنت الآن في وضع عدم الاتصال', 'warning');
  },
  
  startAutoSave() {
    // إيقاف الفاصل الزمني القديم إن وجد
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    // حفظ كل 30 ثانية
    this.autoSaveInterval = setInterval(() => {
      if (currentUser && (debts.length > 0 || qats.length > 0)) {
        this.saveDataLocally();
      }
    }, 30000);
  },
  
  saveDataLocally() {
    try {
      const data = {
        debts: debts,
        qats: qats,
        user: currentUser,
        lastSave: new Date().toISOString(),
        version: '2.0'
      };
      
      localStorage.setItem('offline_backup', JSON.stringify(data));
      console.log('💾 تم الحفظ المحلي:', new Date().toLocaleTimeString());
    } catch (error) {
      console.error('❌ خطأ في الحفظ المحلي:', error);
    }
  },
  
  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('offline_backup');
      if (saved) {
        const data = JSON.parse(saved);
        
        // التحقق من صحة البيانات
        if (data && data.debts && data.qats) {
          debts = Array.isArray(data.debts) ? data.debts : [];
          qats = Array.isArray(data.qats) ? data.qats : [];
          
          // تحديث الواجهة
          refreshUI();
          
          // إظهار التاريخ
          const time = data.lastSave ? new Date(data.lastSave).toLocaleString('ar-SA') : 'غير معروف';
          showToast(`📂 تم تحميل البيانات المخزنة (آخر حفظ: ${time})`, 'info');
        }
      } else {
        console.log('📭 لا توجد بيانات مخزنة محلياً');
      }
    } catch (error) {
      console.error('❌ خطأ في تحميل البيانات المحلية:', error);
      showToast('❌ خطأ في تحميل البيانات المخزنة', 'error');
    }
  },
  
  // دالة للتحقق مما إذا كان يمكن العمل بدون إنترنت
  canWorkOffline() {
    if (!this.isActive) return true;
    
    const saved = localStorage.getItem('offline_backup');
    if (!saved) {
      showToast('❌ لا توجد بيانات مخزنة للعمل بدون إنترنت', 'error');
      return false;
    }
    
    return true;
  }
};

// ========== دوال جديدة للتطبيق ==========

// دالة الاتصال بالمطور - مع رقمك الحقيقي
function contactDeveloper() {
  const whatsappURL = 'https://wa.me/966778942829?text=مرحباً، أود الاستفسار عن تطبيق محفظة الديون الذكية';
  const emailURL = 'mailto:support@debtwallet.com?subject=استفسار عن تطبيق محفظة الديون&body=اسمي: %0D%0A%0D%0Aاستفساري:';
  
  const userChoice = confirm('اختر طريقة التواصل:\n\n✅ موافق → واتساب (966778942829)\n❌ إلغاء → بريد إلكتروني');
  
  if (userChoice) {
    // افتح واتساب
    window.open(whatsappURL, '_blank');
    showToast('📞 يتم فتح واتساب للرقم: 966778942829');
  } else {
    // افتح بريد إلكتروني
    window.open(emailURL, '_blank');
    showToast('📧 يتم فتح بريد إلكتروني');
  }
}

// دالة اتصل بالدعم الفني (مباشرة لواتساب)
function contactSupport() {
  const whatsappURL = 'https://wa.me/966778942829?text=مرحباً، أحتاج دعم فني لتطبيق محفظة الديون الذكية';
  window.open(whatsappURL, '_blank');
  showToast('📞 يتم الاتصال بالدعم الفني على واتساب');
}

// تهيئة الأسئلة الشائعة
function setupFAQ() {
  document.querySelectorAll('.faq-question').forEach(btn => {
    // تنظيف الأحداث القديمة
    btn.removeEventListener('click', handleFAQClick);
    
    // إضافة حدث جديد
    btn.addEventListener('click', handleFAQClick);
  });
}

function handleFAQClick() {
  const answer = this.nextElementSibling;
  const isVisible = answer.style.display === 'block';
  
  // إغلاق جميع الإجابات الأخرى
  document.querySelectorAll('.faq-answer').forEach(ans => {
    ans.style.display = 'none';
  });
  
  document.querySelectorAll('.faq-question').forEach(q => {
    q.classList.remove('active');
  });
  
  // إظهار/إخفاء الإجابة الحالية
  if (!isVisible) {
    answer.style.display = 'block';
    this.classList.add('active');
  }
}

// دالة فتح صفحة حول التطبيق
function showAboutPage() {
  showPage('aboutPage');
}

// دالة فتح صفحة المساعدة
function showHelpPage() {
  showPage('helpPage');
  setTimeout(setupFAQ, 100); // تهيئة الأسئلة الشائعة
}

// ========== تحسين دالة showPage ==========
const originalShowPage = window.showPage;
window.showPage = function(pageId) {
  // استدعاء الدالة الأصلية
  if (originalShowPage) {
    originalShowPage(pageId);
  }
  
  // تهيئة إضافية حسب الصفحة
  switch(pageId) {
    case 'helpPage':
      setTimeout(setupFAQ, 300);
      break;
    case 'aboutPage':
      // يمكن إضافة تهيئة إضافية هنا
      break;
  }
};

// ========== التهيئة النهائية ==========
document.addEventListener('DOMContentLoaded', function() {
  // تشغيل نظام عدم الاتصال
  setTimeout(() => OFFLINE_MODE.init(), 1000);
  
  // إخفاء شاشة التحميل
  window.addEventListener('load', function() {
    setTimeout(function() {
      const splashScreen = document.getElementById('splash-screen');
      if (splashScreen) {
        splashScreen.style.opacity = '0';
        setTimeout(() => {
          splashScreen.style.display = 'none';
        }, 500);
      }
    }, 1500);
  });
  
  // تحديث زر الإعدادات للوصول للصفحات الجديدة
  setTimeout(() => {
    // إضافة الأحداث للأزرار الجديدة
    const aboutBtn = document.getElementById('aboutApp');
    const helpBtn = document.getElementById('helpCenter');
    
    if (aboutBtn) {
      aboutBtn.onclick = () => showAboutPage();
    }
    
    if (helpBtn) {
      helpBtn.onclick = () => showHelpPage();
    }
  }, 2000);
});

// ========== تحسينات إضافية ==========

// إضافة زر "اتصل بالدعم" في صفحة حول التطبيق
function addContactButton() {
  const aboutPage = document.getElementById('aboutPage');
  if (aboutPage && !aboutPage.querySelector('.contact-button-added')) {
    const contactBtn = document.createElement('button');
    contactBtn.className = 'success';
    contactBtn.innerHTML = '<i class="fas fa-headset"></i> اتصل بالدعم الفني';
    contactBtn.onclick = contactDeveloper;
    contactBtn.style.width = '100%';
    contactBtn.style.marginTop = '15px';
    
    const contactSection = aboutPage.querySelector('.contact-section');
    if (contactSection) {
      contactSection.appendChild(contactBtn);
      aboutPage.classList.add('contact-button-added');
    }
  }
}

// تحديث كل 5 ثوانٍ للتحقق من حالة الاتصال
setInterval(() => {
  if (!navigator.onLine && !OFFLINE_MODE.isActive) {
    OFFLINE_MODE.handleOffline();
  }
}, 5000);
// دالة العودة للإعدادات من أي صفحة
function goBackToSettings() {
  showPage('settingsPage');
}

// دالة العودة للصفحة الرئيسية
function goToHome() {
  showPage('dashboardPage');
}
})();
