(() => {
    "use strict";
    
    // 🔥 تكوين Firebase - مدمج من الكودين
    const firebaseConfig = {
        apiKey: "AIzaSyB1KgAYSe--Vq0ninrIaMDSh34llRJfW9Y",
        authDomain: "qat-debt-management-system.firebaseapp.com",
        databaseURL: "https://qat-debt-management-system-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "qat-debt-management-system",
        storageBucket: "qat-debt-management-system.firebasestorage.app",
        messagingSenderId: "827162170021",
        appId: "1:827162170021:web:ba352c809d7a4fc5b1f34c"
    };
    
    // تهيئة Firebase - مدمج من الكودين
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const database = firebase.database();
    
    // مفاتيح التخزين
    const KEY_USER = 'dq_current_user';
    const KEY_PASSWORD = 'dq_user_password';
    const KEY_DEBTS = 'dq_debts';
    const KEY_QAT = 'dq_qat';

    // المتغيرات العامة - مدمجة من الكودين
    let currentUser = null;
    let userPassword = null;
    let debts = [];
    let qats = [];
    let isOnline = false;
    let syncInProgress = false;
    let backupData = null;

    // 🚀 نظام العرض الهجين - إضافة جديدة
    let currentViewMode = localStorage.getItem('debtViewMode') || 'table';
    let currentDebtHistoryViewMode = localStorage.getItem('debtHistoryViewMode') || 'table';
    let currentQatViewMode = localStorage.getItem('qatViewMode') || 'table';

    // الدوال الأساسية - مدمجة من الكودين
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

    function hashPassword(password) {
        return btoa(password + 'salt123');
    }

    function verifyPassword(password, hashedPassword) {
        return hashPassword(password) === hashedPassword;
    }

    function uid(prefix='id'){ 
        return prefix+'_'+Date.now()+'_'+Math.floor(Math.random()*9999); 
    }

    function showApp(){ 
        document.getElementById('loginPage').classList.add('hidden'); 
        document.getElementById('appPage').classList.remove('hidden');
        showPage('dashboardPage');
        updateDateTime();
        checkConnection();
        setupNavScroll();
    }
    
    function showLogin(){ 
        document.getElementById('loginPage').classList.remove('hidden'); 
        document.getElementById('appPage').classList.add('hidden');
        document.getElementById('syncStatus').classList.add('hidden');
        document.getElementById('loginName').value = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginMessage').textContent = '';
    }

    function showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(pageId).classList.add('active');
        
        // إخفاء جميع قوائم الأيام عند تغيير الصفحة
        document.querySelectorAll('.day-selector').forEach(selector => {
            selector.classList.remove('active');
        });
        
        // تحديث الواجهة حسب الصفحة - مدمج من الكودين
        if (pageId === 'dashboardPage') {
            updateDashboard();
        } else if (pageId === 'debtsPage') {
            renderDebts();
            updateSummary();
            updateDebtorSelect();
            // إخفاء سجل الدين التفصيلي عند تغيير الصفحة
            document.getElementById('debtHistoryCard').classList.add('hidden');
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
            minute: '2-digit'
        };
        const dateTimeString = now.toLocaleDateString('ar-SA', options);
        document.getElementById('currentDateTime').textContent = dateTimeString;
    }

    // نظام إدارة المستخدمين المحسن - مدمج من الكودين
    function setupUserSystem() {
        window.createAccount = function(name, password) {
            if(!name || !password){ 
                return { success: false, message: 'الرجاء إدخال اسم المستخدم وكلمة المرور' };
            }
            
            if (password.length < 4) {
                return { success: false, message: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' };
            }
            
            const existingUser = localStorage.getItem(KEY_USER);
            if (existingUser === name) {
                return { success: false, message: 'اسم المستخدم موجود مسبقاً' };
            }
            
            try {
                currentUser = name;
                userPassword = hashPassword(password);
                debts = [];
                qats = [];
                
                localStorage.setItem(KEY_USER, currentUser);
                localStorage.setItem(`${KEY_PASSWORD}_${currentUser}`, userPassword);
                localStorage.setItem(`${KEY_DEBTS}_${currentUser}`, JSON.stringify(debts));
                localStorage.setItem(`${KEY_QAT}_${currentUser}`, JSON.stringify(qats));
                
                return { 
                    success: true, 
                    message: `تم إنشاء حساب جديد لـ ${name}`,
                    user: currentUser
                };
                
            } catch (error) {
                console.error('خطأ في إنشاء الحساب:', error);
                return { success: false, message: 'حدث خطأ في إنشاء الحساب' };
            }
        };

        window.loginUser = function(name, password) {
            if(!name || !password){ 
                return { success: false, message: 'الرجاء إدخال اسم المستخدم وكلمة المرور' };
            }
            
            try {
                const storedUser = localStorage.getItem(KEY_USER);
                if (storedUser !== name) {
                    return { success: false, message: 'اسم المستخدم غير موجود' };
                }
                
                const storedPassword = localStorage.getItem(`${KEY_PASSWORD}_${name}`);
                if (!storedPassword || !verifyPassword(password, storedPassword)) {
                    return { success: false, message: 'كلمة المرور غير صحيحة' };
                }
                
                currentUser = name;
                userPassword = storedPassword;
                
                const storedDebts = localStorage.getItem(`${KEY_DEBTS}_${name}`);
                const storedQat = localStorage.getItem(`${KEY_QAT}_${name}`);
                
                debts = storedDebts ? JSON.parse(storedDebts) : [];
                qats = storedQat ? JSON.parse(storedQat) : [];
                
                return { 
                    success: true, 
                    message: `مرحباً ${name}!`,
                    user: currentUser
                };
                
            } catch (error) {
                console.error('خطأ في تسجيل الدخول:', error);
                return { success: false, message: 'حدث خطأ في تسجيل الدخول' };
            }
        };
    }

    // إعداد شريط التنقل المتحرك - من الكود الثاني
    function setupNavScroll() {
        const navContainer = document.getElementById('navContainer');
        const pages = document.querySelectorAll('.page');
        let lastScrollY = window.scrollY;
        let isCompact = false;

        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            
            if (currentScrollY > 50 && !isCompact) {
                navContainer.classList.add('compact');
                pages.forEach(page => page.classList.add('compact-view'));
                isCompact = true;
            } else if (currentScrollY <= 50 && isCompact) {
                navContainer.classList.remove('compact');
                pages.forEach(page => page.classList.remove('compact-view'));
                isCompact = false;
            }
            
            lastScrollY = currentScrollY;
        });
    }

    // نظام تسجيل الدخول بحساب Google - من الكود الأول
    function setupGoogleSignIn() {
        const googleSignInBtn = document.getElementById('googleSignInBtn');
        if (googleSignInBtn) {
            googleSignInBtn.addEventListener('click', async function() {
                try {
                    const provider = new firebase.auth.GoogleAuthProvider();
                    const result = await auth.signInWithPopup(provider);
                    const user = result.user;
                    
                    currentUser = user.displayName || user.email;
                    userPassword = hashPassword(user.uid);
                    
                    // تحميل البيانات الحالية أو إنشاء جديدة
                    const storedDebts = localStorage.getItem(`${KEY_DEBTS}_${currentUser}`);
                    const storedQat = localStorage.getItem(`${KEY_QAT}_${currentUser}`);
                    
                    debts = storedDebts ? JSON.parse(storedDebts) : [];
                    qats = storedQat ? JSON.parse(storedQat) : [];
                    
                    // حفظ بيانات المستخدم
                    localStorage.setItem(KEY_USER, currentUser);
                    localStorage.setItem(`${KEY_PASSWORD}_${currentUser}`, userPassword);
                    localStorage.setItem(`${KEY_DEBTS}_${currentUser}`, JSON.stringify(debts));
                    localStorage.setItem(`${KEY_QAT}_${currentUser}`, JSON.stringify(qats));
                    
                    showApp();
                    showToast(`مرحباً ${currentUser}! تم تسجيل الدخول بحساب Google بنجاح`);
                    
                } catch (error) {
                    console.error('خطأ في تسجيل الدخول بحساب Google:', error);
                    showToast('حدث خطأ في تسجيل الدخول بحساب Google', 'error');
                }
            });
        }
    }

    // نظام المزامنة مع Firebase - من الكود الثاني
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

    async function syncToFirebase() {
        if (!currentUser || !isOnline) return;
        
        syncInProgress = true;
        updateSyncStatus('syncing', 'جارِ حفظ البيانات...');
        
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
        } catch (error) {
            console.error('خطأ في المزامنة:', error);
            updateSyncStatus('offline', 'خطأ في المزامنة');
        }
        
        syncInProgress = false;
    }

    async function loadFromFirebase() {
        if (!currentUser || !isOnline) return;
        
        updateSyncStatus('syncing', 'جارِ تحميل البيانات...');
        
        try {
            const snapshot = await database.ref(`users/${currentUser}`).once('value');
            const data = snapshot.val();
            
            if (data) {
                debts = data.debts || [];
                qats = data.qats || [];
                userPassword = data.password || hashPassword('123456');
                
                saveToLocalStorage();
                
                updateSyncStatus('online', 'تم تحميل البيانات');
                setTimeout(() => {
                    if (!syncInProgress) updateSyncStatus('online', 'مزامنة');
                }, 3000);
                
                return true;
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
        
        const lastLocalUpdate = localStorage.getItem(`lastUpdate_${currentUser}`);
        const lastCloudUpdate = await getLastCloudUpdate();
        
        if (lastCloudUpdate > lastLocalUpdate) {
            await loadFromFirebase();
            showToast('🔁 تم تحديث البيانات من السحابة');
        } else if (lastLocalUpdate > lastCloudUpdate) {
            await syncToFirebase();
            showToast('☁️ تم رفع التحديثات إلى السحابة');
        } else {
            showToast('✅ البيانات محدثة على جميع الأجهزة');
        }
    }

    async function getLastCloudUpdate() {
        try {
            const snapshot = await database.ref(`users/${currentUser}/lastSync`).once('value');
            return snapshot.val() || '0';
        } catch (error) {
            return '0';
        }
    }

    // نظام النسخ الاحتياطي المتقدم - من الكود الثاني
    function backupAllData() {
        try {
            backupData = {
                debts: JSON.parse(JSON.stringify(debts)),
                qats: JSON.parse(JSON.stringify(qats)),
                user: currentUser,
                timestamp: new Date().toISOString(),
                version: '1.0'
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
                backupData = JSON.parse(storedBackup);
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

    // دوال إدارة البيانات - مدمجة من الكودين
    function saveToLocalStorage() {
        if (!currentUser) return;
        
        localStorage.setItem(KEY_USER, currentUser);
        localStorage.setItem(`${KEY_PASSWORD}_${currentUser}`, userPassword);
        localStorage.setItem(`${KEY_DEBTS}_${currentUser}`, JSON.stringify(debts));
        localStorage.setItem(`${KEY_QAT}_${currentUser}`, JSON.stringify(qats));
        localStorage.setItem(`lastUpdate_${currentUser}`, new Date().toISOString());
    }

    function loadFromLocalStorage() {
        if (!currentUser) return;
        
        const storedPassword = localStorage.getItem(`${KEY_PASSWORD}_${currentUser}`);
        const storedDebts = localStorage.getItem(`${KEY_DEBTS}_${currentUser}`);
        const storedQat = localStorage.getItem(`${KEY_QAT}_${currentUser}`);
        
        userPassword = storedPassword || hashPassword('123456');
        debts = storedDebts ? JSON.parse(storedDebts) : [];
        qats = storedQat ? JSON.parse(storedQat) : [];
        
        debts.forEach(debt => {
            if (!debt.payments) debt.payments = [];
            if (!debt.remainingAmount) {
                debt.remainingAmount = debt.totalAmount - (debt.paidAmount || 0);
            }
        });
        
        refreshUI();
    }

    function refreshUI(){
        document.getElementById('welcomeText').textContent = currentUser ? ('مرحباً، ' + currentUser) : 'مرحباً';
        updateDebtorSelect();
        renderDebts();
        renderQats();
        updateSummary();
        updateDashboard();
        updateSettingsStats();
    }

    // دوال إدارة الديون - مدمجة من الكودين
    function addDebt(){
        const name = document.getElementById('debtName').value.trim();
        const amount = parseFloat(document.getElementById('debtAmount').value);
        const date = document.getElementById('debtDate').value || new Date().toISOString().slice(0,10);
        const timeOfDay = document.getElementById('debtTime').value || 'صباحاً';
        
        if(!name || !amount || amount <= 0){ 
            showToast('الرجاء إدخال اسم ومبلغ صحيح للدين', 'error');
            return; 
        }

        const existingDebtIndex = debts.findIndex(debt => 
            debt.name === name && debt.date === date && debt.timeOfDay === timeOfDay
        );

        if (existingDebtIndex !== -1) {
            const existingDebt = debts[existingDebtIndex];
            existingDebt.totalAmount += amount;
            existingDebt.remainingAmount += amount;
            showToast(`تم تحديث دين ${name} بمبلغ ${amount} ريال`);
        } else {
            debts.unshift({
                id: uid('d'),
                name, 
                totalAmount: amount,
                paidAmount: 0,
                remainingAmount: amount,
                date, 
                timeOfDay,
                payments: []
            });
            showToast(`تم إضافة دين جديد لـ ${name} بمبلغ ${amount} ريال`);
        }
        
        saveToLocalStorage();
        syncToFirebase();
        renderDebts();
        updateSummary();
        updateDashboard();
        updateDebtorSelect();
        
        document.getElementById('debtName').value = '';
        document.getElementById('debtAmount').value = '';
        document.getElementById('debtDate').value = '';
        document.getElementById('debtTime').value = 'صباحاً';
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

    function addPayment() {
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
        syncToFirebase();
        renderDebts();
        updateSummary();
        updateDashboard();
        updateDebtorSelect();
        
        paymentAmount.value = '';
        paymentDate.value = '';
    }

    // دوال التصيير المحسنة - من الكود الثاني
    function renderDebts() {
        const debtsListEl = document.getElementById('debtsList');
        if (!debtsListEl) return;
        
        debtsListEl.innerHTML = '';
        
        if(!debts.length){ 
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
                    ${debt.payments.length > 0 ? `
                        <div class="payment-section">
                            <strong>التسديدات:</strong>
                            ${debt.payments.map(payment => `
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

    // 🚀 نظام العرض الهجين المحسن - بداية الإضافة
    function renderDebtsSummary() {
        const debtsSummaryEl = document.getElementById('debtsSummary');
        if (!debtsSummaryEl) return;
        
        debtsSummaryEl.innerHTML = '';
        
        if(!debts.length){ 
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

        if (currentViewMode === 'table') {
            debtsSummaryEl.innerHTML += createSummaryTable();
        } else {
            debtsSummaryEl.innerHTML += createSummaryCards();
        }

        // إضافة أحداث التبديل - تم الإصلاح هنا
        setTimeout(() => {
            document.querySelectorAll('.view-toggle').forEach(btn => {
                btn.addEventListener('click', function() {
                    currentViewMode = this.getAttribute('data-view');
                    localStorage.setItem('debtViewMode', currentViewMode);
                    renderDebtsSummary(); // إعادة التصيير فوراً
                    showToast(`تم التبديل إلى عرض ${currentViewMode === 'table' ? 'الجدول' : 'البطاقات'}`);
                });
            });
        }, 100);
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
                    paymentsCount: debt.payments.length
                };
            }
            debtors[debt.name].total += debt.totalAmount;
            debtors[debt.name].paid += debt.paidAmount;
            debtors[debt.name].remaining += debt.remainingAmount;
            debtors[debt.name].debtsCount++;
            debtors[debt.name].paymentsCount += debt.payments.length;

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
                                <td>${debts.reduce((sum, debt) => sum + debt.payments.length, 0)}</td>
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
                row.addEventListener('click', function() {
                    const debtorName = this.getAttribute('data-debtor');
                    showDebtorDetails(debtorName);
                });
            });
        }, 100);

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
            debtors[debt.name].payments.push(...debt.payments);

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
                card.addEventListener('click', function() {
                    const debtorName = this.getAttribute('data-debtor');
                    showDebtorDetails(debtorName);
                });
            });
        }, 100);

        return cardsHTML;
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-SA');
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

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // إضافة الأحداث
        document.getElementById('closeDebtorDetails').addEventListener('click', function() {
            document.getElementById('debtorDetailsModal').remove();
        });

        // إغلاق النافذة بالنقر خارجها
        document.getElementById('debtorDetailsModal').addEventListener('click', function(e) {
            if (e.target === this) {
                this.remove();
            }
        });
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
                    
                    ${debt.payments.length > 0 ? `
                        <div style="background: rgba(16, 185, 129, 0.1); padding: 10px; border-radius: 8px; margin-top: 10px;">
                            <div style="font-size: 11px; color: var(--success); margin-bottom: 5px;">
                                <i class="fas fa-history"></i>
                                التسديدات (${debt.payments.length})
                            </div>
                            ${debt.payments.map(payment => `
                                <div style="font-size: 11px; color: var(--success); padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                    +${payment.amount.toLocaleString()} ريال - ${payment.date}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        });

        detailsHTML += `</div>`;
        return detailsHTML;
    }
    // 🚀 نهاية نظام العرض الهجين المحسن

    function updateDashboard() {
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
            recentDebtsElement.innerHTML = recentDebts.map(debt => `
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
            `).join('');
        }

        // تحديث آخر التسديدات
        const recentPaymentsElement = document.getElementById('recentPayments');
        if (recentPaymentsElement) {
            const allPayments = [];
            debts.forEach(debt => {
                debt.payments.forEach(payment => {
                    allPayments.push({
                        name: debt.name,
                        amount: payment.amount,
                        date: payment.date
                    });
                });
            });
            
            const recentPayments = allPayments.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
            
            recentPaymentsElement.innerHTML = recentPayments.map(payment => `
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
            `).join('');
        }
    }

    // 🚀 نظام القات المحسن مع العرض الهجين
    function addQat(){
        const type = document.getElementById('qatType').value.trim();
        const count = document.getElementById('qatCountInput').value.trim();
        const date = document.getElementById('qatDate').value || new Date().toISOString().slice(0,10);
        
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
        syncToFirebase();
        renderQats();
        updateDashboard();
        updateSettingsStats();
        showToast(`تم إضافة ${count} من نوع ${type}`);
        
        document.getElementById('qatType').value = '';
        document.getElementById('qatCountInput').value = '';
        document.getElementById('qatDate').value = '';
    }

    function renderQats(){
        const qatListEl = document.getElementById('qatList');
        if (!qatListEl) return;
        
        qatListEl.innerHTML = '';
        
        if(!qats.length){ 
            qatListEl.innerHTML='<p style="text-align:center;padding:20px;color:var(--muted);">لا توجد سجلات</p>'; 
            return; 
        }

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

        if (currentQatViewMode === 'table') {
            qatListEl.innerHTML += createQatTable();
        } else {
            qatListEl.innerHTML += createQatCards();
        }

        // إضافة أحداث التبديل للقات
        setTimeout(() => {
            document.querySelectorAll('.qat-view-toggle').forEach(btn => {
                btn.addEventListener('click', function() {
                    currentQatViewMode = this.getAttribute('data-view');
                    localStorage.setItem('qatViewMode', currentQatViewMode);
                    renderQats();
                    showToast(`تم التبديل إلى عرض ${currentQatViewMode === 'table' ? 'الجدول' : 'البطاقات'}`);
                });
            });
        }, 100);
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

        // إضافة أحداث الحذف
        setTimeout(() => {
            document.querySelectorAll('.delete-qat').forEach(btn => {
                btn.addEventListener('click', function() {
                    const index = parseInt(this.getAttribute('data-index'));
                    deleteQat(index);
                });
            });
        }, 100);

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

        // إضافة أحداث الحذف
        setTimeout(() => {
            document.querySelectorAll('.delete-qat').forEach(btn => {
                btn.addEventListener('click', function() {
                    const index = parseInt(this.getAttribute('data-index'));
                    deleteQat(index);
                });
            });
        }, 100);

        return cardsHTML;
    }

    function getDayName(dateString) {
        const date = new Date(dateString);
        const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        return days[date.getDay()];
    }

    function deleteQat(index) {
        if (confirm('هل أنت متأكد من حذف هذا السجل؟')) {
            qats.splice(index, 1);
            saveToLocalStorage();
            syncToFirebase();
            renderQats();
            updateDashboard();
            updateSettingsStats();
            showToast('تم حذف سجل القات بنجاح');
        }
    }

    // 🚀 نظام سجل الدين التفصيلي المحسن مع العرض الهجين
    function showDebtHistory(searchTerm) {
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

            if (currentDebtHistoryViewMode === 'table') {
                debtHistoryList.innerHTML += createDebtHistoryTable(matchingDebts, searchTerm);
            } else {
                debtHistoryList.innerHTML += createDebtHistoryCards(matchingDebts, searchTerm);
            }

            // إضافة أحداث التبديل لسجل الدين التفصيلي
            setTimeout(() => {
                document.querySelectorAll('.debt-history-view-toggle').forEach(btn => {
                    btn.addEventListener('click', function() {
                        currentDebtHistoryViewMode = this.getAttribute('data-view');
                        localStorage.setItem('debtHistoryViewMode', currentDebtHistoryViewMode);
                        showDebtHistory(searchTerm); // إعادة التصيير بنفس مصطلح البحث
                        showToast(`تم التبديل إلى عرض ${currentDebtHistoryViewMode === 'table' ? 'الجدول' : 'البطاقات'}`);
                    });
                });
            }, 100);

            // التمرير إلى قسم السجل التفصيلي
            debtHistoryCard.scrollIntoView({ behavior: 'smooth' });
            showToast(`📊 عرض السجل التفصيلي لـ ${new Set(matchingDebts.map(d => d.name)).size} متدين`);
        }
    }

    function createDebtHistoryTable(matchingDebts, searchTerm) {
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
            debtGroups[key].payments.push(...debt.payments);
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
    }

    // دوال التصدير المتقدمة - من الكود الثاني
    async function exportToExcel(data, filename) {
        if (data.length === 0) {
            showToast('لا توجد بيانات للتصدير', 'error');
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
        if (data.length === 0) {
            showToast('لا توجد بيانات للتصدير', 'error');
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
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${filename}.doc`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showToast(`✅ تم تصدير البيانات إلى ${filename}.doc`);

        } catch (error) {
            console.error('خطأ في التصدير إلى Word:', error);
            showToast('❌ حدث خطأ أثناء التصدير إلى Word', 'error');
        }
    }

    // إعداد الأحداث - مدمجة من الكودين مع الإصلاحات
    function setupEventListeners() {
        // أحداث تسجيل الدخول
        const btnLogin = document.getElementById('btnLogin');
        const btnRegister = document.getElementById('btnRegister');
        const logoutBtn = document.getElementById('logoutBtn');
        const googleSignInBtn = document.getElementById('googleSignInBtn');

        btnLogin.addEventListener('click', function(){
            const name = document.getElementById('loginName').value.trim();
            const password = document.getElementById('loginPassword').value.trim();
            
            const result = loginUser(name, password);
            
            if (result.success) {
                showApp();
                showToast(result.message);
            } else {
                document.getElementById('loginMessage').textContent = result.message;
                document.getElementById('loginMessage').style.color = 'var(--danger)';
            }
        });

        btnRegister.addEventListener('click', function(){
            const name = document.getElementById('loginName').value.trim();
            const password = document.getElementById('loginPassword').value.trim();
            
            const result = createAccount(name, password);
            
            if (result.success) {
                showApp();
                showToast(result.message);
            } else {
                document.getElementById('loginMessage').textContent = result.message;
                document.getElementById('loginMessage').style.color = 'var(--danger)';
            }
        });

        logoutBtn.addEventListener('click', ()=>{
            localStorage.removeItem(KEY_USER);
            currentUser = null;
            userPassword = null;
            showLogin();
            showToast('تم تسجيل الخروج بنجاح');
        });

        // أحداث التنقل
        const navDebts = document.getElementById('navDebts');
        const navQat = document.getElementById('navQat');
        const navSummary = document.getElementById('navSummary');
        const navDashboard = document.getElementById('navDashboard');
        const navSettings = document.getElementById('navSettings');

        navDebts.addEventListener('click', () => showPage('debtsPage'));
        navQat.addEventListener('click', () => showPage('qatPage'));
        navSummary.addEventListener('click', () => showPage('summaryPage'));
        navDashboard.addEventListener('click', () => showPage('dashboardPage'));
        navSettings.addEventListener('click', () => showPage('settingsPage'));

        // أحداث الديون
        const saveDebtBtn = document.getElementById('saveDebt');
        const savePaymentBtn = document.getElementById('savePayment');
        const saveQatBtn = document.getElementById('saveQat');
        const clearDebtBtn = document.getElementById('clearDebt');
        const clearQatBtn = document.getElementById('clearQat');
        
        if (saveDebtBtn) saveDebtBtn.addEventListener('click', addDebt);
        if (savePaymentBtn) savePaymentBtn.addEventListener('click', addPayment);
        if (saveQatBtn) saveQatBtn.addEventListener('click', addQat);
        
        if (clearDebtBtn) clearDebtBtn.addEventListener('click', () => {
            document.getElementById('debtName').value = '';
            document.getElementById('debtAmount').value = '';
            document.getElementById('debtDate').value = '';
            document.getElementById('debtTime').value = 'صباحاً';
            showToast('تم تفريغ الحقول');
        });
        
        if (clearQatBtn) clearQatBtn.addEventListener('click', () => {
            document.getElementById('qatType').value = '';
            document.getElementById('qatCountInput').value = '';
            document.getElementById('qatDate').value = '';
            showToast('تم تفريغ الحقول');
        });

        // أحداث التاريخ
        const setTodayDebt = document.getElementById('setTodayDebt');
        const setYesterdayDebt = document.getElementById('setYesterdayDebt');
        const setTodayQat = document.getElementById('setTodayQat');
        const setYesterdayQat = document.getElementById('setYesterdayQat');
        
        if (setTodayDebt) setTodayDebt.addEventListener('click', () => setDateToField('debtDate', 0));
        if (setYesterdayDebt) setYesterdayDebt.addEventListener('click', () => setDateToField('debtDate', -1));
        if (setTodayQat) setTodayQat.addEventListener('click', () => setDateToField('qatDate', 0));
        if (setYesterdayQat) setYesterdayQat.addEventListener('click', () => setDateToField('qatDate', -1));

        // أحداث التصدير
        const exportExcel = document.getElementById('exportExcel');
        const exportWord = document.getElementById('exportWord');
        const exportSummaryExcel = document.getElementById('exportSummaryExcel');
        const exportSummaryWord = document.getElementById('exportSummaryWord');
        
        if (exportExcel) exportExcel.addEventListener('click', () => exportDebtsToExcel());
        if (exportWord) exportWord.addEventListener('click', () => exportDebtsToWord());
        if (exportSummaryExcel) exportSummaryExcel.addEventListener('click', () => exportSummaryToExcel());
        if (exportSummaryWord) exportSummaryWord.addEventListener('click', () => exportSummaryToWord());

        // أحداث الإدارة
        const changePassword = document.getElementById('changePassword');
        const deleteData = document.getElementById('deleteData');
        const exportAllData = document.getElementById('exportAllData');
        const importData = document.getElementById('importData');
        
        if (changePassword) changePassword.addEventListener('click', () => showChangePasswordModal());
        if (deleteData) deleteData.addEventListener('click', () => deleteAllData());
        if (exportAllData) exportAllData.addEventListener('click', () => exportDataToFile());
        if (importData) importData.addEventListener('click', () => importDataFromFile());

        // أحداث نافذة كلمة المرور
        const changePasswordModal = document.getElementById('changePasswordModal');
        const saveNewPassword = document.getElementById('saveNewPassword');
        const cancelChangePassword = document.getElementById('cancelChangePassword');
        
        if (saveNewPassword) saveNewPassword.addEventListener('click', changePasswordHandler);
        if (cancelChangePassword) cancelChangePassword.addEventListener('click', () => {
            changePasswordModal.classList.add('hidden');
        });

        // أحداث البحث مع Enter - تم الإصلاح هنا
        const searchDebts = document.getElementById('searchDebts');
        const searchQat = document.getElementById('searchQat');
        const quickSearchBtn = document.getElementById('quickSearchBtn');
        
        if (searchDebts) {
            searchDebts.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                filterDebts(searchTerm);
            });
            
            // حدث الضغط على Enter للانتقال للسجل التفصيلي - تم الإصلاح هنا
            searchDebts.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    const searchTerm = this.value.trim();
                    if (searchTerm) {
                        showDebtHistory(searchTerm);
                    }
                }
            });
        }

        if (searchQat) {
            searchQat.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                filterQats(searchTerm);
            });

            // حدث الضغط على Enter للبحث في القات
            searchQat.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    const searchTerm = this.value.trim();
                    if (searchTerm) {
                        filterQats(searchTerm);
                        showToast(`عرض نتائج البحث عن: "${searchTerm}"`);
                    }
                }
            });
        }

        // حدث زر البحث السريع - تم الإصلاح هنا
        if (quickSearchBtn) {
            quickSearchBtn.addEventListener('click', function() {
                const searchTerm = document.getElementById('searchDebts').value.trim();
                if (searchTerm) {
                    showDebtHistory(searchTerm);
                } else {
                    showToast('⚠️ الرجاء إدخال اسم أو تاريخ للبحث', 'warning');
                }
            });
        }

        // إعداد قوائم الأيام
        setupDaysDropdowns();
    }

    // إعداد قوائم الأيام - من الكود الثاني
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
            button.addEventListener('click', (e) => {
                const dayOfWeek = parseInt(e.target.getAttribute('data-day'));
                const selector = e.target.closest('.day-selector');
                const dateField = selector.parentElement.querySelector('input[type="date"]');
                
                setDateByDayOfWeek(dateField, dayOfWeek);
                selector.classList.remove('active');
            });
        });

        // إظهار/إخفاء القوائم
        document.querySelectorAll('.day-selector > button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const selector = e.target.closest('.day-selector');
                document.querySelectorAll('.day-selector').forEach(s => {
                    if (s !== selector) s.classList.remove('active');
                });
                selector.classList.toggle('active');
            });
        });

        // إخفاء القوائم عند النقر خارجها
        document.addEventListener('click', () => {
            document.querySelectorAll('.day-selector').forEach(selector => {
                selector.classList.remove('active');
            });
        });
    }

    function setDateByDayOfWeek(dateField, dayOfWeek) {
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

    // دوال إدارة كلمة المرور - مدمجة من الكودين
    function showChangePasswordModal() {
        const modal = document.getElementById('changePasswordModal');
        modal.classList.remove('hidden');
        
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
    }

    function changePasswordHandler() {
        const current = document.getElementById('currentPassword').value;
        const newPass = document.getElementById('newPassword').value;
        const confirm = document.getElementById('confirmPassword').value;
        
        if (!current || !newPass || !confirm) {
            showToast('الرجاء ملء جميع الحقول', 'error');
            return;
        }
        
        if (!verifyPassword(current, userPassword)) {
            showToast('كلمة المرور الحالية غير صحيحة', 'error');
            return;
        }
        
        if (newPass !== confirm) {
            showToast('كلمة المرور الجديدة غير متطابقة', 'error');
            return;
        }
        
        if (newPass.length < 4) {
            showToast('كلمة المرور يجب أن تكون 4 أحرف على الأقل', 'error');
            return;
        }
        
        userPassword = hashPassword(newPass);
        saveToLocalStorage();
        syncToFirebase();
        document.getElementById('changePasswordModal').classList.add('hidden');
        showToast('تم تغيير كلمة المرور بنجاح');
    }

    // تحسين أزرار لوحة التحكم - من الكود الثاني
    function setupDashboardActions() {
        const addDebtBtn = document.getElementById('quickAddDebt');
        const addPaymentBtn = document.getElementById('quickAddPayment');
        const addQatBtn = document.getElementById('quickAddQat');
        const exportReportBtn = document.getElementById('quickExport');
        
        if (addDebtBtn) {
            addDebtBtn.addEventListener('click', function() {
                showPage('debtsPage');
                setTimeout(() => {
                    document.getElementById('debtName').focus();
                    showToast('👤 ابدأ بإدخال اسم المتدين لإضافة دين جديد', 'info');
                }, 300);
            });
        }

        if (addPaymentBtn) {
            addPaymentBtn.addEventListener('click', function() {
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
            addQatBtn.addEventListener('click', function() {
                showPage('qatPage');
                setTimeout(() => {
                    document.getElementById('qatType').focus();
                    showToast('🌿 ابدأ بإدخال نوع القات', 'info');
                }, 300);
            });
        }

        if (exportReportBtn) {
            exportReportBtn.addEventListener('click', function() {
                showExportOptions();
            });
        }
    }

    function showExportOptions() {
        const exportHTML = `
            <div class="modal" id="exportModal">
                <div class="modal-content">
                    <h3 style="margin-bottom:20px;display:flex;align-items:center;gap:10px;">
                        <i class="fas fa-file-export"></i>
                        خيارات التصدير
                    </h3>
                    <p style="color:var(--muted);margin-bottom:20px;">اختر نوع التقرير الذي تريد تصديره:</p>
                    
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:25px;">
                        <button class="primary" onclick="exportDebtsToExcel()">
                            <i class="fas fa-file-excel"></i>
                            ديون - Excel
                        </button>
                        <button class="success" onclick="exportDebtsToWord()">
                            <i class="fas fa-file-word"></i>
                            ديون - Word
                        </button>
                        <button class="primary" onclick="exportSummaryToExcel()">
                            <i class="fas fa-file-excel"></i>
                            ملخص - Excel
                        </button>
                        <button class="success" onclick="exportSummaryToWord()">
                            <i class="fas fa-file-word"></i>
                            ملخص - Word
                        </button>
                    </div>
                    
                    <div style="display:flex;gap:10px;">
                        <button class="ghost" style="flex:1;" onclick="closeExportModal()">إلغاء</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', exportHTML);
    }

    // التهيئة النهائية - مدمجة من الكودين
    function init() {
        // تحديث الوقت
        updateDateTime();
        setInterval(updateDateTime, 60000);
        
        // التحقق من الاتصال
        window.addEventListener('online', checkConnection);
        window.addEventListener('offline', checkConnection);
        setupConnectionMonitoring();
        
        // إعداد الأنظمة
        setupUserSystem();
        setupGoogleSignIn();
        setupEventListeners();
        setupDashboardActions();
        enhanceDashboardButtons();
        
        // تحميل البيانات إذا كان المستخدم مسجل الدخول
        const storedUser = localStorage.getItem(KEY_USER);
        if(storedUser){
            currentUser = storedUser;
            loadFromLocalStorage();
            showApp();
            
            // محاولة المزامنة مع Firebase
            setTimeout(() => enhancedSync(), 3000);
        }
        
        // تعيين التواريخ الافتراضية
        const today = new Date().toISOString().slice(0,10);
        const debtDate = document.getElementById('debtDate');
        const qatDate = document.getElementById('qatDate');
        const paymentDate = document.getElementById('paymentDate');
        if (debtDate) debtDate.value = today;
        if (qatDate) qatDate.value = today;
        if (paymentDate) paymentDate.value = today;

        // تحميل النسخة الاحتياطية إذا وجدت
        if (currentUser) {
            const storedBackup = localStorage.getItem(`backup_${currentUser}`);
            if (storedBackup) {
                backupData = JSON.parse(storedBackup);
            }
        }
    }

    // الدوال العالمية للتصدير - من الكود الثاني
    window.exportDebtsToExcel = async function() {
        closeExportModal();
        const totalAmount = debts.reduce((sum, debt) => sum + debt.totalAmount, 0);
        const paidAmount = debts.reduce((sum, debt) => sum + debt.paidAmount, 0);
        const remainingAmount = totalAmount - paidAmount;

        const data = debts.map(debt => ({
            'اسم المتدين': debt.name,
            'التاريخ': debt.date,
            'الوقت': debt.timeOfDay,
            'المبلغ الإجمالي': `${debt.totalAmount.toLocaleString()} ريال`,
            'المبلغ المسدد': `${debt.paidAmount.toLocaleString()} ريال`,
            'المبلغ المتبقي': `${debt.remainingAmount.toLocaleString()} ريال`,
            'نسبة السداد': `${((debt.paidAmount / debt.totalAmount) * 100).toFixed(1)}%`,
            'الحالة': debt.remainingAmount === 0 ? '✅ مسدد بالكامل' : 
                      debt.paidAmount === 0 ? '❌ لم يسدد' : '🟡 مسدد جزئياً'
        }));

        data.push({
            'اسم المتدين': 'الإجمالي',
            'التاريخ': '-',
            'الوقت': '-',
            'المبلغ الإجمالي': `${totalAmount.toLocaleString()} ريال`,
            'المبلغ المسدد': `${paidAmount.toLocaleString()} ريال`,
            'المبلغ المتبقي': `${remainingAmount.toLocaleString()} ريال`,
            'نسبة السداد': `${((paidAmount / totalAmount) * 100).toFixed(1)}%`,
            'الحالة': remainingAmount === 0 ? '✅ تم سداد جميع الديون' : '🟡 توجد ديون متبقية'
        });

        await exportToExcel(data, `تقرير-الديون-${new Date().toISOString().slice(0,10)}`);
    };

    window.exportDebtsToWord = async function() {
        closeExportModal();
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
    };

    window.exportSummaryToExcel = async function() {
        closeExportModal();
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
    };

    window.exportSummaryToWord = async function() {
        closeExportModal();
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
    };

    window.closeExportModal = function() {
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.remove();
        }
    };

// دوال مفقودة تحتاج لإضافتها
function setupConnectionMonitoring() {
    const connectionRef = database.ref('.info/connected');
    
    connectionRef.on('value', (snapshot) => {
        isOnline = snapshot.val() === true;
        
        if (isOnline) {
            showToast('🌐 متصل بالإنترنت - جاهز للمزامنة');
            setTimeout(() => enhancedSync(), 2000);
        } else {
            showToast('📱 وضع عدم الاتصال - استخدام البيانات المحلية', 'warning');
        }
    });
}

function enhanceDashboardButtons() {
    const quickActions = document.querySelectorAll('.quick-action-btn');
    
    quickActions.forEach(btn => {
        btn.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.05)';
        });
        
        btn.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
        
        btn.addEventListener('mousedown', function() {
            this.style.transform = 'translateY(-2px) scale(0.98)';
        });
        
        btn.addEventListener('mouseup', function() {
            this.style.transform = 'translateY(-5px) scale(1.05)';
        });
    });
}

function deleteAllData() {
    if (confirm(`⚠️ تحذير: هذا الإجراء لا يمكن التراجع عنه!\n\nهل أنت متأكد من حذف جميع البيانات؟\n\nسيتم حذف:\n• ${debts.length} سجل ديون\n• ${qats.length} سجل قات\n• جميع الإحصائيات والتقارير`)) {
        
        backupAllData();
        
        debts = [];
        qats = [];
        
        saveToLocalStorage();
        refreshUI();
        
        showToast('✅ تم حذف جميع البيانات بنجاح', 'success');
        showToast('💾 تم إنشاء نسخة احتياطية تلقائية يمكنك الاستعادة منها', 'info');
    }
}

function exportDataToFile() {
    try {
        const exportData = {
            debts: debts,
            qats: qats,
            user: currentUser,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `نسخة-احتياطية-${currentUser}-${new Date().toISOString().slice(0,10)}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        showToast('✅ تم تصدير النسخة الاحتياطية إلى ملف', 'success');
        
    } catch (error) {
        console.error('خطأ في تصدير البيانات:', error);
        showToast('❌ فشل في تصدير البيانات', 'error');
    }
}

function importDataFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.txt';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (isValidBackupData(importedData)) {
                    if (confirm(`هل تريد استيراد البيانات من الملف؟\n\n📅 تاريخ النسخة: ${new Date(importedData.timestamp).toLocaleString('ar-SA')}\n👤 المستخدم: ${importedData.user}\n📁 تحتوي على: ${importedData.debts.length} ديون، ${importedData.qats.length} سجلات قات`)) {
                        
                        backupData = importedData;
                        debts = JSON.parse(JSON.stringify(importedData.debts));
                        qats = JSON.parse(JSON.stringify(importedData.qats));
                        
                        saveToLocalStorage();
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
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

function isValidBackupData(data) {
    return data && 
           data.debts && Array.isArray(data.debts) &&
           data.qats && Array.isArray(data.qats) &&
           data.user && 
           data.timestamp;
}

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
                ${debt.payments.length > 0 ? `
                    <div class="payment-section">
                        <strong>التسديدات:</strong>
                        ${debt.payments.map(payment => `
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

    document.getElementById('statsTotalDebts').textContent = totalDebts.toLocaleString();
    document.getElementById('statsTotalRecords').textContent = totalRecords.toLocaleString();
    document.getElementById('statsActiveDebts').textContent = activeDebts.toLocaleString();
    document.getElementById('statsQatRecords').textContent = qatRecords.toLocaleString();
    
    const backupStatus = document.getElementById('backupStatus');
    if (backupStatus) {
        backupStatus.textContent = backupInfo;
    }
}
    // بدء التطبيق
    init();
    
})();