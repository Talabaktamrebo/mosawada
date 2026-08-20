/* ============================================================
   مسودة إضافة إعلان — منطق التطبيق
   تطبيق مستقل بالكامل عن مشروع «طلبك تم» الفعلي (Supabase).
   يستخدم Firestore (إن أُعدّ) أو التخزين المحلي كنسخة احتياطية.
   ============================================================ */

/* ===== الفئات (مطابقة لأدمن «طلبك تم») ===== */
const CATS = [
  { id: 'apt-rent',   label: 'شقق للإيجار',        type: 'apartment' },
  { id: 'apt-sale',   label: 'شقق للبيع',          type: 'apartment' },
  { id: 'car-rent',   label: 'سيارات للإيجار',      type: 'car' },
  { id: 'car-sale',   label: 'سيارات للبيع',        type: 'car' },
  { id: 'equip-rent', label: 'معدات للإيجار',       type: 'equipment' },
  { id: 'equip-sale', label: 'معدات للبيع',         type: 'equipment' },
  { id: 'shop-rent',  label: 'محلات تجارية للإيجار', type: 'shop' },
  { id: 'shop-sale',  label: 'محلات تجارية للبيع',   type: 'shop' },
  { id: 'farm-rent',  label: 'أراضي للإيجار',       type: 'farm' },
  { id: 'farm-sale',  label: 'أراضي للبيع',         type: 'farm' },
  { id: 'free-ad',    label: 'مهن وخدمات',          type: 'freead' },
];
const getCat = id => CATS.find(c => c.id === id);
const isApt   = id => getCat(id)?.type === 'apartment';
const isCar   = id => getCat(id)?.type === 'car';
const isShop  = id => getCat(id)?.type === 'shop';
const isFarm  = id => getCat(id)?.type === 'farm';
const isEquip = id => getCat(id)?.type === 'equipment';
const isFreeAd= id => getCat(id)?.type === 'freead';
const isRent  = id => id.endsWith('-rent');

/* ===== الأدوار والشركاء =====
   manager  : المدير — يدير الحسابات، يشوف كل الفئات
   employee : موظف الشركة (الوضع الأصلي) — كل الفئات، بلا قيود
   الباقي   : شركاء خارجيون — كل واحد محصور بفئاته فقط */
const ROLE_LABELS = {
  manager: 'مدير',
  employee: 'موظف الشركة',
  'car-dealer': 'معرض سيارات',
  realestate: 'محل عقاري',
  'equipment-agent': 'وكيل معدات',
};
// null = بلا قيود (كل الفئات)
const ROLE_CATEGORIES = {
  manager: null,
  employee: null,
  'car-dealer': ['car-rent', 'car-sale'],
  realestate: ['apt-rent', 'apt-sale', 'shop-rent', 'shop-sale', 'farm-rent', 'farm-sale'],
  'equipment-agent': ['equip-rent', 'equip-sale'],
};
function allowedCats() {
  const allow = myProfile ? ROLE_CATEGORIES[myProfile.role] : null;
  return allow ? CATS.filter(c => allow.includes(c.id)) : CATS;
}
function groupLabelFor(profile) {
  if (!profile) return 'غير مصنّف';
  if (profile.businessName) return profile.businessName;
  if (profile.role === 'employee') return 'فريق المكتب';
  return ROLE_LABELS[profile.role] || 'غير مصنّف';
}

const CITIES = ['جبلة', 'اللاذقية', 'أخرى'];
const NEIGHBORHOODS = ['حي العمارة','حي العزي','حي الدريبة','حي القلعة',
  'حي السوق (المدينة القديمة)','حي الفيض','حي الجبيبات','حي النقعة',
  'حي الميناء','حي الكورنيش','حي التغرة','حي الجركس',
  'حي جب جويخة','المتحلق','حي الصليبة','حي المهجع',
  'حي المفيض','ضاحية المجد','أخرى'];

const CAR_BRANDS = ['تويوتا','هيونداي','كيا','نيسان','شيفروليه','سوزوكي','فورد','مرسيدس','بي إم دبليو','هوندا','مازدا','ميتسوبيشي','فولكس واغن','بيجو','رينو','سكودا','أوبل','فيات','MG','شيري','جيلي','BYD','أخرى'];
const CAR_CLASSES = ['سيدان','هاتشباك','SUV','بيك أب','فان','كوبيه','كروس أوفر'];
const FREE_HANDY = ['كهربائي','سباك','دهان','نجار','لحام','ميكانيكي','حداد','عامل بناء','تركيب','توصيل','سيارة نقل صغيرة','حلّاق','عامل','دروس خصوصية','مدرس'];
const FREE_HOME  = ['طبخ منزلي','تنظيف منازل','غسيل وكي','رعاية أطفال','رعاية مسنّين','خياطة منزلية','ترتيب البيت'];

/* ===== حالة عامة ===== */
let db = null;               // مرجع Firestore (إن توفّر)
let useCloud = false;
let drafts = [];             // القائمة المحمّلة حالياً
let images = [null, null, null, null, null]; // Data URLs للصور الخمس
let currentCatId = 'apt-rent';
const LOCAL_KEY = 'tt-drafts-v1';
const PARTNERS_COLLECTION = 'partners';
let myProfile = null;        // { role, businessName, email } — صاحب الجلسة الحالية
let allPartners = [];        // كل الحسابات (يُحمَّل للمدير فقط)

/* ===== تهيئة Firebase (اختياري) ===== */
let auth = null;

function initFirebase() {
  const cfg = window.FIREBASE_CONFIG || {};
  if (!cfg.apiKey || !cfg.projectId) { useCloud = false; return; }
  try {
    firebase.initializeApp(cfg);
    db = firebase.firestore();
    auth = firebase.auth();
    useCloud = true;
  } catch (e) {
    console.warn('Firebase init failed, falling back to local storage', e);
    useCloud = false;
  }
}

/* ===== تسجيل الدخول =====
   بدون Firebase: التطبيق يعمل محلياً على الجهاز ولا يطلب دخولاً.
   مع Firebase: لا يُفتح التطبيق إلا بحساب موظف صالح. */
function showLogin(show) {
  document.getElementById('loginScreen').hidden = !show;
  document.getElementById('headerLogout').hidden = !useCloud;
  document.body.classList.toggle('locked', show);
}

function loginError(msg) {
  const el = document.getElementById('loginError');
  if (!msg) { el.hidden = true; return; }
  el.textContent = msg;
  el.hidden = false;
}

const AUTH_MESSAGES = {
  'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة',
  'auth/user-not-found': 'ما في حساب بهذا البريد',
  'auth/wrong-password': 'كلمة السر غير صحيحة',
  'auth/invalid-credential': 'البريد أو كلمة السر غير صحيحة',
  'auth/too-many-requests': 'محاولات كثيرة — جرّب بعد شوي',
  'auth/network-request-failed': 'ما في اتصال بالإنترنت',
  'auth/user-disabled': 'هذا الحساب موقوف',
};

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  const btn = document.getElementById('loginBtn');
  loginError('');
  if (!auth) { loginError('إعدادات Firebase ناقصة — راجع ملف firebase-config.js'); return; }
  if (!email || !pass) { loginError('املأ البريد وكلمة السر'); return; }

  btn.disabled = true; btn.textContent = 'جارٍ الدخول…';
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    // onAuthStateChanged يتكفّل بفتح التطبيق
  } catch (e) {
    loginError(AUTH_MESSAGES[e.code] || ('تعذّر الدخول: ' + (e.message || e.code)));
  } finally {
    btn.disabled = false; btn.textContent = 'تسجيل الدخول';
  }
}
window.doLogin = doLogin;

async function doLogout() {
  if (!auth) return;
  if (!confirm('تسجيل الخروج من التطبيق؟')) return;
  try { await auth.signOut(); } catch (e) { toast('تعذّر الخروج', 'err'); }
}
window.doLogout = doLogout;

/* ===== ملف الحساب (partners/{uid}) — الدور يحدّد الفئات المسموحة =====
   أول من يسجّل دخول بالتطبيق (ولا يوجد أي حساب مصنَّف بعد) يصير «مدير»
   تلقائياً — آمن هنا لأنه لا يوجد تسجيل ذاتي بالتطبيق: فقط من يملك
   بريداً وكلمة سرّ أعطاهما إياه المدير أصلاً يقدر يدخل من الأساس. */
async function loadMyProfile(user) {
  const doc = await db.collection(PARTNERS_COLLECTION).doc(user.uid).get();
  if (doc.exists) { myProfile = { uid: user.uid, ...doc.data() }; return myProfile; }

  const anyDoc = await db.collection(PARTNERS_COLLECTION).limit(1).get();
  if (anyDoc.empty) {
    const bootstrap = { role: 'manager', businessName: '', email: user.email || '', createdAt: firebase.firestore.FieldValue.serverTimestamp() };
    await db.collection(PARTNERS_COLLECTION).doc(user.uid).set(bootstrap);
    myProfile = { uid: user.uid, ...bootstrap };
    return myProfile;
  }
  myProfile = null;
  return null;
}

/* إنشاء حساب جديد (موظف/شريك) من داخل التطبيق دون طرد المدير من جلسته:
   نستخدم نسخة Firebase ثانوية مؤقتة لإنشاء المستخدم، ثم نتخلّص منها فوراً —
   جلسة المدير على النسخة الأساسية تبقى بلا أي تأثير طوال الوقت. */
async function createPartnerAccount({ email, password, role, businessName }) {
  const cfg = window.FIREBASE_CONFIG;
  const secondaryName = 'Secondary-' + Date.now();
  const secondaryApp = firebase.initializeApp(cfg, secondaryName);
  try {
    const cred = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
    const newUid = cred.user.uid;
    await db.collection(PARTNERS_COLLECTION).doc(newUid).set({
      role, businessName: businessName || '', email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: auth.currentUser ? auth.currentUser.uid : null,
    });
    return newUid;
  } finally {
    try { await secondaryApp.auth().signOut(); } catch (e) {}
    try { await secondaryApp.delete(); } catch (e) {}
  }
}

/* ===== تخزين محلي (نسخة احتياطية بدون سحابة) ===== */
function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); }
  catch (e) { return []; }
}
function saveLocal(list) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
}

/* ===== قراءة/كتابة المعلقات ===== */
// وقت المستند بالمللي ثانية — يقبل serverTimestamp (سحابة) أو رقم (محلي)
function _draftTime(d) {
  const t = d.createdAt;
  if (!t) return 0;
  if (typeof t === 'number') return t;
  if (t.toMillis) return t.toMillis();
  return new Date(t).getTime() || 0;
}

// الشريك الخارجي (معرض/محل عقاري/وكيل معدات) يشوف مسوداته هو بس؛
// المدير والموظف الداخلي يشوفوا الكل — نفس منطق allowedCats للفئات.
function isPrivilegedRole(role) { return role === 'manager' || role === 'employee'; }

async function fetchDrafts() {
  if (useCloud) {
    const col = db.collection(window.DRAFTS_COLLECTION || 'drafts');
    if (myProfile && !isPrivilegedRole(myProfile.role)) {
      // بلا orderBy هون عمداً: فهرس مركّب غير مطلوب لفلتر مساواة وحيد،
      // والترتيب بيصير محلياً بعد الجلب.
      const snap = await col.where('submittedByUid', '==', myProfile.uid).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => _draftTime(b) - _draftTime(a));
    }
    const snap = await col.orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  return loadLocal().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

async function addDraft(data) {
  data.createdAt = useCloud
    ? firebase.firestore.FieldValue.serverTimestamp()
    : Date.now();
  if (useCloud && auth?.currentUser) {
    data.createdBy = auth.currentUser.email || '';
    data.submittedByUid = auth.currentUser.uid;
    data.submittedByGroup = groupLabelFor(myProfile);
    data.submittedByRole = myProfile ? myProfile.role : '';
  }
  if (useCloud) {
    await db.collection(window.DRAFTS_COLLECTION || 'drafts').add(data);
  } else {
    const list = loadLocal();
    list.push({ id: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), ...data });
    saveLocal(list);
  }
}

async function removeDraft(id) {
  if (useCloud) {
    await db.collection(window.DRAFTS_COLLECTION || 'drafts').doc(id).delete();
  } else {
    saveLocal(loadLocal().filter(d => d.id !== id));
  }
}

/* ===== أيقونات SVG (بديل الرموز التعبيرية) ===== */
const ICON_IMAGE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15.5l-5.5-5.5a1.5 1.5 0 0 0-2.12 0L3 20"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`;
const ICON_CLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const ICON_PIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg>`;
const ICON_USER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5"/></svg>`;
const ICON_PHONE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 4.5h3.4l1.6 4-2 1.4a12 12 0 0 0 6.6 6.6l1.4-2 4 1.6v3.4a1.5 1.5 0 0 1-1.6 1.5C10.6 20.4 3.6 13.4 3 6.1A1.5 1.5 0 0 1 4.5 4.5z"/></svg>`;
const ICON_TAG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12.5l-7.5 7.5a1.5 1.5 0 0 1-2.1 0L4 13.6V4h9.6l6.4 6.4a1.5 1.5 0 0 1 0 2.1z"/><circle cx="8.3" cy="8.3" r="1.3"/></svg>`;
const CAT_ICONS = {
  apartment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5L12 4l8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5.5h4V20"/></svg>`,
  car: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 15.5l1.4-5A2 2 0 0 1 6.8 9h10.4a2 2 0 0 1 1.9 1.5l1.4 5"/><rect x="2.5" y="15.5" width="19" height="4.5" rx="1.5"/><circle cx="6.5" cy="18" r="1"/><circle cx="17.5" cy="18" r="1"/></svg>`,
  shop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16l1.2 5.2a2 2 0 0 1-2 2.4h-.1a2 2 0 0 1-2-1.8 2 2 0 0 1-2 1.8 2 2 0 0 1-2-1.8 2 2 0 0 1-2 1.8 2 2 0 0 1-2-1.8 2 2 0 0 1-2 1.8h-.1a2 2 0 0 1-2-2.4L4 4z"/><path d="M5.5 11.5V20h13v-8.5"/></svg>`,
  farm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6"/></svg>`,
  equipment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6.5l3 3-7.5 7.5-4-1-1 4-3-3 4-1-1-4 7.5-7.5z"/><path d="M14.5 6.5l3-3 3 3-3 3"/></svg>`,
  freead: ICON_TAG,
};

/* ===== أدوات مساعدة ===== */
function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toast(msg, kind) {
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = msg;
  document.getElementById('toastWrap').appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
function fmtNum(n) { return n == null || n === '' ? '' : Number(n).toLocaleString('en-US'); }
function fmtDate(ts) {
  let d;
  if (!ts) return '';
  if (typeof ts === 'number') d = new Date(ts);
  else if (ts.toDate) d = ts.toDate();
  else d = new Date(ts);
  return d.toLocaleDateString('ar', { day: 'numeric', month: 'short' }) + ' — ' +
    d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
}

/* ===== بناء عناصر النموذج (مساعدات) ===== */
function fg(label, inner, full) {
  return `<div class="form-group${full ? ' f-full' : ''}"><label class="form-label">${label}</label>${inner}</div>`;
}
function fText(id, label, ph, full) {
  return fg(label, `<input type="text" class="form-input" id="${id}" placeholder="${ph || ''}">`, full);
}
function fNum(id, label, ph, full) {
  return fg(label, `<input type="number" class="form-input" id="${id}" placeholder="${ph || ''}" min="0">`, full);
}
function fSel(id, label, opts, full) {
  return fg(label, `<select class="form-select" id="${id}"><option value="">— اختر —</option>${opts.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`, full);
}
function fChk(id, label) {
  return `<label class="chk"><input type="checkbox" id="${id}"><span>${label}</span></label>`;
}

/* ===== بناء نموذج الحقول الديناميكي حسب الفئة ===== */
function buildFieldsHTML(catId) {
  let h = '';

  /* القسم 1: معلومات أساسية */
  h += `<div class="fsec"><div class="fsec-title">معلومات الإعلان</div><div class="fsec-grid">`;
  h += fText('fTitle', 'عنوان الإعلان *', 'مثال: شقة مفروشة للإيجار في حي القلعة', true);
  h += fg('الفئة *', `<select class="form-select" id="fCatId" onchange="onCatChange()">${allowedCats().map(c => `<option value="${c.id}" ${c.id === catId ? 'selected' : ''}>${c.label}</option>`).join('')}</select>`);
  h += fg('المدينة *', `<select class="form-select" id="fCity">${CITIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>`);
  h += fg('الحي / المنطقة', `<select class="form-select" id="fNeighborhood"><option value="">-- اختياري --</option>${NEIGHBORHOODS.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select>`, true);

  if (!isFreeAd(catId)) {
    h += fNum('fPrice', `السعر بالدولار $ *${isRent(catId) ? ' (لليوم)' : ''}`, '0');
    h += fText('fClientName', 'اسم العميل *', 'مثال: أبو محمد');
    h += fg('رقم صاحب العقار (واتساب) *', `<input type="tel" class="form-input" id="fPhone" placeholder="9XXXXXXXX" inputmode="numeric" dir="ltr" oninput="this.value=this.value.replace(/[^0-9]/g,'')">`);
  } else {
    h += fText('fClientName', 'اسم العميل *', 'مثال: أبو محمد');
    h += fg('رقم التواصل (واتساب) *', `<input type="tel" class="form-input" id="fPhone" placeholder="9XXXXXXXX" inputmode="numeric" dir="ltr" oninput="this.value=this.value.replace(/[^0-9]/g,'')">`);
  }
  h += `</div></div>`;

  /* القسم 2: تفاصيل حسب الفئة */
  let s2 = '', s2title = '';
  if (isApt(catId)) {
    s2title = 'تفاصيل الشقة';
    s2 = fNum('fRooms', 'غرف النوم', '1') + fNum('fBaths', 'الحمامات', '1')
       + fNum('fArea', 'المساحة م²', '') + fText('fAptFloor', 'الطابق', 'مثال: الثالث')
       + fSel('fAptFurnished', 'الفرش', ['مفروش','غير مفروش','نصف مفروش'])
       + fSel('fAptHeating', 'التدفئة', ['مركزية','مازوت','كهرباء','غاز','لا يوجد'])
       + fSel('fAptView', 'الإطلالة', ['بحرية','جبلية','شارع رئيسي','عادية'])
       + fNum('fAptAge', 'عمر البناء (سنوات)', '');
    s2 += `<div class="f-full"><label class="form-label" style="display:block;margin-bottom:8px">مرافق إضافية</label><div class="chk-grid">${
      fChk('fAptSolar','طاقة شمسية') + fChk('fAptElevator','مصعد') + fChk('fAptGarage','كراج/موقف') + fChk('fAptWaterTank','خزان ماء')
    }</div></div>`;
  } else if (isCar(catId)) {
    s2title = 'تفاصيل السيارة';
    s2 = fSel('fCarType', 'الماركة *', CAR_BRANDS) + fText('fCarModel', 'الموديل *', 'مثال: كامري')
       + fNum('fCarYear', 'سنة الصنع', '2024') + fNum('fCarKm', 'المسافة (كم)', '')
       + fText('fCarColor', 'اللون', 'أبيض') + fSel('fCarClass', 'الفئة', CAR_CLASSES)
       + fSel('fCarGear', 'ناقل الحركة', ['أوتوماتيك','عادي']) + fSel('fCarFuel', 'الوقود', ['بنزين','ديزل','غاز','هجين','كهرباء'])
       + fSel('fCarCondition', 'الحالة', ['جديدة','مستعملة']);
    s2 += `<div class="f-full"><label class="form-label" style="display:block;margin-bottom:8px">مزايا إضافية</label><div class="chk-grid">${
      fChk('fCarCustoms','مدفوعة الجمارك') + fChk('fCarSunroof','فتحة سقف') + fChk('fCarCamera','كاميرا/حساسات')
    }</div></div>`;
  } else if (isShop(catId)) {
    s2title = 'تفاصيل المحل التجاري';
    s2 = fNum('fShopArea', 'المساحة م²', 'مثال: 40') + fText('fShopFloor', 'الطابق', 'مثال: أرضي')
       + fNum('fShopFronts', 'عدد الواجهات', '') + fText('fShopUse', 'يصلح لـ', 'مثال: مطعم، مكتب')
       + fSel('fShopFit', 'التجهيز', ['جاهز/ديكور كامل','على العظم','نصف تجهيز']);
    s2 += `<div class="f-full"><label class="form-label" style="display:block;margin-bottom:8px">مرافق المحل</label><div class="chk-grid">${
      fChk('fShopStorage','مستودع داخلي') + fChk('fShopBathroom','حمّام') + fChk('fShopAc','مكيّف') + fChk('fShopParking','موقف')
    }</div></div>`;
  } else if (isFarm(catId)) {
    s2title = 'تفاصيل الأرض';
    s2 = fSel('fFarmType', 'نوع الأرض *', ['أرض زراعية','أرض سكنية','أرض تجارية','أرض صناعية','أرض عقارية'])
       + fNum('fFarmArea', 'المساحة (م²) *', 'مثال: 500')
       + fText('fFarmWater', 'مصدر المياه والمرافق', 'مثال: بئر، شبكة ري، كهرباء')
       + fSel('fLandOwnership', 'نوع الملكية / الطابو', ['طابو أخضر','أميري','حكم محكمة','كاتب عدل']);
    s2 += `<div class="f-full"><label class="form-label" style="display:block;margin-bottom:8px">الخدمات والمرافق</label><div class="chk-grid">${
      fChk('fLandElectricity','كهرباء') + fChk('fLandWater','ماء') + fChk('fLandRoad','طريق معبّد') + fChk('fLandFenced','مسوّرة')
    }</div></div>`;
  } else if (isEquip(catId)) {
    s2title = 'تفاصيل المعدة';
    s2 = fSel('fEquipType', 'نوع المعدة', ['حفّار','رافعة','جرافة','مولّدة كهرباء','ضاغط هواء','رافعة شوكية','خلّاطة باطون','مضخّة','أخرى'])
       + fText('fEquipBrand', 'الماركة', 'مثال: كاتربيلر') + fNum('fEquipYear', 'سنة الصنع', 'مثال: 2018')
       + fNum('fEquipHours', 'ساعات التشغيل', '') + fSel('fEquipCondition', 'الحالة', ['جديدة','مستعملة'])
       + fSel('fEquipFuel', 'الوقود', ['ديزل','بنزين','كهرباء']);
    s2 += `<div class="f-full">${fChk('fEquipOperator','مع مشغّل/سائق')}</div>`;
  } else if (isFreeAd(catId)) {
    s2title = 'بيانات صاحب الإعلان';
    s2 = fg('نوع العمل *', `<select class="form-select" id="fFreeGroup" onchange="onFreeGroupChange()">
        <option value="handy">خدمات مهنية</option><option value="home">أسر منتجة</option>
      </select>`);
    s2 += fg('المهنة *', `<select class="form-select" id="fProfession">${FREE_HANDY.map(p => `<option>${esc(p)}</option>`).join('')}<option value="أخرى">أخرى</option></select>`);
  }
  const sec2 = s2 ? `<div class="fsec"><div class="fsec-title">${s2title}</div><div class="fsec-grid">${s2}</div></div>` : '';

  /* القسم 3: الوصف والصور */
  let s3 = '';
  s3 += fg('وصف الإعلان', `<textarea class="form-textarea" id="fDesc" placeholder="أي تفاصيل إضافية لاحظتها بالمعاينة..."></textarea>`, true);
  let imgSlots = '';
  for (let i = 0; i < 5; i++) {
    imgSlots += `<div class="img-slot" id="imgSlot${i}" onclick="document.getElementById('imgInput${i}').click()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <input type="file" id="imgInput${i}" accept="image/*" style="display:none" onchange="handleImg(${i}, this)">
    </div>`;
  }
  s3 += fg('صور المعاينة (حتى 5 صور)', `<div class="img-grid">${imgSlots}</div>`, true);
  const sec3 = `<div class="fsec"><div class="fsec-title">الوصف والصور</div><div class="fsec-grid">${s3}</div></div>`;

  return h + sec3 + sec2;
}

/* ===== أحداث النموذج ===== */
function onCatChange() {
  currentCatId = document.getElementById('fCatId').value;
  renderForm(true);
}
window.onCatChange = onCatChange;

function onFreeGroupChange() {
  const g = document.getElementById('fFreeGroup')?.value || 'handy';
  const sel = document.getElementById('fProfession');
  if (!sel) return;
  const list = g === 'home' ? FREE_HOME : FREE_HANDY;
  sel.innerHTML = list.map(p => `<option>${esc(p)}</option>`).join('') + '<option value="أخرى">أخرى</option>';
}
window.onFreeGroupChange = onFreeGroupChange;

/* الاحتفاظ بالقيم عند تبديل الفئة (نفس العنوان/المدينة/الحي/الوصف) */
function collectCommon() {
  return {
    title: document.getElementById('fTitle')?.value || '',
    city: document.getElementById('fCity')?.value || '',
    neighborhood: document.getElementById('fNeighborhood')?.value || '',
    desc: document.getElementById('fDesc')?.value || ''
  };
}
function applyCommon(v) {
  if (!v) return;
  const t = document.getElementById('fTitle'); if (t) t.value = v.title || '';
  const c = document.getElementById('fCity'); if (c) c.value = v.city || '';
  const n = document.getElementById('fNeighborhood'); if (n) n.value = v.neighborhood || '';
  const d = document.getElementById('fDesc'); if (d) d.value = v.desc || '';
}

function renderForm(keepCommon) {
  const common = keepCommon ? collectCommon() : null;
  document.getElementById('draftForm').innerHTML = buildFieldsHTML(currentCatId);
  applyCommon(common);
  if (isFreeAd(currentCatId)) onFreeGroupChange();
}

/* ===== الصور: رفع حقيقي لـ Supabase Storage (bucket منفصل «drafts») =====
   قبل التعديل كانت الصورة تُحوَّل base64 وتُخزَّن مباشرة جوّا مستند
   Firestore — أي صورة كاميرا حقيقية (2-5 م.ب) كانت تتخطى حد المستند
   الأقصى (1 م.ب)، وهذا بالضبط سبب فشل الحفظ أحياناً بلا سبب واضح.
   الآن يُرفَع الملف الفعلي لمخزن ملفات، ويُحفَظ رابط قصير بس بـ Firestore. */
let supabaseStorageClient = null;
function initSupabaseStorage() {
  const cfg = window.SUPABASE_CONFIG || {};
  if (!cfg.url || !cfg.anonKey || typeof supabase === 'undefined') return;
  try { supabaseStorageClient = supabase.createClient(cfg.url, cfg.anonKey); }
  catch (e) { console.warn('Supabase Storage init failed', e); }
}

async function handleImg(idx, input) {
  const file = input.files[0];
  if (!file) return;
  const slot = document.getElementById(`imgSlot${idx}`);

  if (!supabaseStorageClient) {
    toast('رفع الصور غير مُفعَّل — راجع ملف supabase-config.js', 'err');
    return;
  }

  slot.innerHTML = `<span class="busy">جارٍ الرفع…</span>`;
  try {
    const ext = ((file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')) || 'jpg';
    const path = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const bucket = window.DRAFTS_BUCKET || 'drafts';
    const up = await supabaseStorageClient.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
    if (up.error) throw up.error;
    const url = supabaseStorageClient.storage.from(bucket).getPublicUrl(path).data.publicUrl;

    images[idx] = url;
    slot.classList.add('filled');
    slot.innerHTML = `<img src="${url}"><span class="img-x" onclick="event.stopPropagation();removeImg(${idx})">${ICON_CLOSE}</span>
      <input type="file" id="imgInput${idx}" accept="image/*" style="display:none" onchange="handleImg(${idx}, this)">`;
  } catch (e) {
    console.error(e);
    toast('تعذّر رفع الصورة: ' + (e.message || e), 'err');
    removeImg(idx);
  }
}
window.handleImg = handleImg;
function removeImg(idx) {
  images[idx] = null;
  const slot = document.getElementById(`imgSlot${idx}`);
  slot.classList.remove('filled');
  slot.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    <input type="file" id="imgInput${idx}" accept="image/*" style="display:none" onchange="handleImg(${idx}, this)">`;
}
window.removeImg = removeImg;

/* ===== جمع بيانات النموذج للحفظ ===== */
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function chk(id) { const el = document.getElementById(id); return !!(el && el.checked); }

function collectFormData() {
  const catId = document.getElementById('fCatId').value;
  const data = {
    catId,
    catLabel: getCat(catId)?.label || catId,
    title: val('fTitle'),
    city: val('fCity'),
    neighborhood: val('fNeighborhood'),
    clientName: val('fClientName'),
    phone: val('fPhone'),
    desc: val('fDesc'),
    images: images.filter(Boolean),
  };
  if (!isFreeAd(catId)) data.price = val('fPrice');

  if (isApt(catId)) {
    Object.assign(data, {
      rooms: val('fRooms'), baths: val('fBaths'), area: val('fArea'), aptFloor: val('fAptFloor'),
      aptFurnished: val('fAptFurnished'), aptHeating: val('fAptHeating'), aptView: val('fAptView'), aptAge: val('fAptAge'),
      aptSolar: chk('fAptSolar'), aptElevator: chk('fAptElevator'), aptGarage: chk('fAptGarage'), aptWaterTank: chk('fAptWaterTank'),
    });
  } else if (isCar(catId)) {
    Object.assign(data, {
      carType: val('fCarType'), carModel: val('fCarModel'), carYear: val('fCarYear'), carKm: val('fCarKm'),
      carColor: val('fCarColor'), carClass: val('fCarClass'), carGear: val('fCarGear'), carFuel: val('fCarFuel'), carCondition: val('fCarCondition'),
      carCustoms: chk('fCarCustoms'), carSunroof: chk('fCarSunroof'), carCamera: chk('fCarCamera'),
    });
  } else if (isShop(catId)) {
    Object.assign(data, {
      shopArea: val('fShopArea'), shopFloor: val('fShopFloor'), shopFronts: val('fShopFronts'), shopUse: val('fShopUse'), shopFit: val('fShopFit'),
      shopStorage: chk('fShopStorage'), shopBathroom: chk('fShopBathroom'), shopAc: chk('fShopAc'), shopParking: chk('fShopParking'),
    });
  } else if (isFarm(catId)) {
    Object.assign(data, {
      farmType: val('fFarmType'), farmArea: val('fFarmArea'), farmWater: val('fFarmWater'), landOwnership: val('fLandOwnership'),
      landElectricity: chk('fLandElectricity'), landWater: chk('fLandWater'), landRoad: chk('fLandRoad'), landFenced: chk('fLandFenced'),
    });
  } else if (isEquip(catId)) {
    Object.assign(data, {
      equipType: val('fEquipType'), equipBrand: val('fEquipBrand'), equipYear: val('fEquipYear'), equipHours: val('fEquipHours'),
      equipCondition: val('fEquipCondition'), equipFuel: val('fEquipFuel'), equipOperator: chk('fEquipOperator'),
    });
  } else if (isFreeAd(catId)) {
    Object.assign(data, { freeGroup: val('fFreeGroup'), profession: val('fProfession') });
  }
  return data;
}

function validate(data) {
  if (!data.title) return 'عنوان الإعلان مطلوب';
  if (!data.city) return 'المدينة مطلوبة';
  if (!data.clientName) return 'اسم العميل مطلوب';
  if (!data.phone || data.phone.length < 8) return 'رقم التواصل غير صحيح';
  if (!isFreeAd(data.catId) && (!data.price || Number(data.price) < 0)) return 'السعر مطلوب';
  if (isCar(data.catId) && !data.carModel) return 'الموديل مطلوب';
  if (isFreeAd(data.catId) && !data.profession) return 'المهنة مطلوبة';
  return null;
}

/* ===== الحفظ ===== */
async function saveDraft() {
  const data = collectFormData();
  const err = validate(data);
  if (err) { toast(err, 'err'); return; }

  const btn = document.getElementById('btnSave');
  btn.disabled = true; btn.textContent = 'جارٍ الحفظ…';
  try {
    await addDraft(data);
    toast('تم الحفظ بالمعلقات', 'ok');
    cancelForm();
    await refreshPending();
  } catch (e) {
    console.error(e);
    toast('تعذّر الحفظ: ' + (e.message || e), 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'حفظ بالمعلقات';
  }
}
window.saveDraft = saveDraft;

/* ===== التنقّل بين الشاشات ===== */
function showView(id) {
  ['viewPending', 'viewForm', 'viewDetail', 'viewAdmin'].forEach(v => {
    document.getElementById(v).hidden = (v !== id);
  });
}

function openForm() {
  currentCatId = allowedCats()[0]?.id || 'apt-rent';
  images = [null, null, null, null, null];
  renderForm(false);
  document.getElementById('topTitle').textContent = 'تسجيل معاينة';
  document.getElementById('topSub').textContent = 'املأ التفاصيل ثم احفظ بالمعلقات';
  document.getElementById('formBar').hidden = false;
  document.body.classList.add('form-open');
  showView('viewForm');
}
window.openForm = openForm;

function cancelForm() {
  document.getElementById('formBar').hidden = true;
  document.body.classList.remove('form-open');
  showPending();
}
window.cancelForm = cancelForm;

function showPending() {
  document.getElementById('topTitle').textContent = 'المعلقات';
  document.getElementById('topSub').textContent = 'مسودات بانتظار الإضافة';
  showView('viewPending');
  refreshPending();
}
window.showPending = showPending;

/* ===== عرض قائمة المعلقات ===== */
function pcardMeta(d) {
  const bits = [];
  if (d.clientName) bits.push(`<span>${ICON_USER}${esc(d.clientName)}</span>`);
  if (d.city) bits.push(`<span>${ICON_PIN}${esc(d.city)}${d.neighborhood ? ' — ' + esc(d.neighborhood) : ''}</span>`);
  if (isCar(d.catId) && (d.carType || d.carModel)) bits.push(`<span>${esc(d.carType || '')} ${esc(d.carModel || '')}</span>`);
  if (isApt(d.catId) && d.rooms) bits.push(`<span>${d.rooms} غرف</span>`);
  if (d.phone) bits.push(`<span>${ICON_PHONE}<span class="pcard-num">${esc(d.phone)}</span></span>`);
  return bits.join('');
}

async function refreshPending() {
  try {
    drafts = await fetchDrafts();
  } catch (e) {
    console.error(e);
    toast('تعذّر تحميل المعلقات: ' + (e.message || e), 'err');
    drafts = [];
  }
  const list = document.getElementById('pendingList');
  const empty = document.getElementById('pendingEmpty');
  const headerCount = document.getElementById('headerPendingCount');

  if (!drafts.length) {
    list.innerHTML = ''; empty.hidden = false;
    headerCount.hidden = true;
  } else {
    empty.hidden = true;
    const n = drafts.length > 99 ? '99+' : drafts.length;
    headerCount.hidden = false; headerCount.textContent = n;
    list.innerHTML = renderGroupedPending(drafts);
  }
}

function pcardHTML(d) {
  const thumb = d.images && d.images[0]
    ? `<img src="${d.images[0]}">`
    : `<span class="pcard-thumb-ph">${CAT_ICONS[getCat(d.catId)?.type] || ICON_IMAGE}</span>`;
  return `
  <div class="pcard">
    <div class="pcard-thumb" onclick="openDetail('${d.id}')">${thumb}</div>
    <div class="pcard-body" onclick="openDetail('${d.id}')">
      <div class="pcard-top">
        <span class="pcard-cat">${CAT_ICONS[getCat(d.catId)?.type] || ''}${esc(d.catLabel || '')}</span>
        ${d.price ? `<span class="pcard-price">$${fmtNum(d.price)}</span>` : ''}
      </div>
      <div class="pcard-title">${esc(d.title || 'بدون عنوان')}</div>
      <div class="pcard-meta">${pcardMeta(d)}</div>
      <div class="pcard-time">${ICON_CLOCK}${fmtDate(d.createdAt)}</div>
    </div>
    <button class="pcard-done" title="تمّت إضافته بالأدمن — حذف" onclick="event.stopPropagation();confirmDone('${d.id}')">${ICON_CHECK}</button>
  </div>`;
}

/* تقسيم المعلقات لأقسام قابلة للطي حسب الشريك/الجهة — مسودات بلا وسم
   (مسجّلة قبل هذا التحديث، أو بالوضع المحلي بلا حسابات) تجمّع بقسم واحد
   بلا عنوان خاص فتبقى مرئية دون أن تُفقَد. */
function renderGroupedPending(list) {
  const groups = new Map();
  list.forEach(d => {
    const key = d.submittedByGroup || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  });
  const ungrouped = groups.get('') || [];
  const named = [...groups.entries()].filter(([k]) => k !== '');

  let html = named.map(([name, items]) => `
    <details class="pgroup" open>
      <summary class="pgroup-head">
        <span class="pgroup-name">${ICON_USER}${esc(name)}</span>
        <em class="pgroup-count">${items.length}</em>
      </summary>
      <div class="pgroup-body">${items.map(pcardHTML).join('')}</div>
    </details>`).join('');
  if (ungrouped.length) html += `<div class="pgroup-body">${ungrouped.map(pcardHTML).join('')}</div>`;
  return html;
}

/* ===== تفاصيل مسودة ===== */
const DETAIL_LABELS = {
  clientName: 'اسم العميل', price: 'السعر $', city: 'المدينة', neighborhood: 'الحي', phone: 'رقم التواصل', desc: 'الوصف',
  rooms: 'غرف النوم', baths: 'الحمامات', area: 'المساحة م²', aptFloor: 'الطابق', aptFurnished: 'الفرش', aptHeating: 'التدفئة', aptView: 'الإطلالة', aptAge: 'عمر البناء',
  carType: 'الماركة', carModel: 'الموديل', carYear: 'سنة الصنع', carKm: 'المسافة كم', carColor: 'اللون', carClass: 'الفئة', carGear: 'ناقل الحركة', carFuel: 'الوقود', carCondition: 'الحالة',
  shopArea: 'المساحة م²', shopFloor: 'الطابق', shopFronts: 'عدد الواجهات', shopUse: 'يصلح لـ', shopFit: 'التجهيز',
  farmType: 'نوع الأرض', farmArea: 'المساحة م²', farmWater: 'المرافق', landOwnership: 'الملكية',
  equipType: 'نوع المعدة', equipBrand: 'الماركة', equipYear: 'سنة الصنع', equipHours: 'ساعات التشغيل', equipCondition: 'الحالة', equipFuel: 'الوقود',
  freeGroup: 'نوع العمل', profession: 'المهنة',
  createdBy: 'سجّلها الموظف',
};
const BOOL_LABELS = {
  aptSolar:'طاقة شمسية', aptElevator:'مصعد', aptGarage:'كراج/موقف', aptWaterTank:'خزان ماء',
  carCustoms:'مدفوعة الجمارك', carSunroof:'فتحة سقف', carCamera:'كاميرا/حساسات',
  shopStorage:'مستودع داخلي', shopBathroom:'حمّام', shopAc:'مكيّف', shopParking:'موقف',
  landElectricity:'كهرباء', landWater:'ماء', landRoad:'طريق معبّد', landFenced:'مسوّرة',
  equipOperator:'مع مشغّل/سائق',
};

function openDetail(id) {
  const d = drafts.find(x => x.id === id);
  if (!d) return;
  const rows = Object.keys(DETAIL_LABELS)
    .filter(k => d[k] !== undefined && d[k] !== '' && k !== 'desc')
    .map(k => `<div class="drow"><dt>${DETAIL_LABELS[k]}</dt><dd>${esc(k === 'price' ? '$' + fmtNum(d[k]) : d[k])}</dd></div>`).join('');
  const flags = Object.keys(BOOL_LABELS).filter(k => d[k]).map(k => BOOL_LABELS[k]);
  const imgs = (d.images || []).map(u => `<img src="${u}">`).join('');

  document.getElementById('detailBody').innerHTML = `
    <div class="detail-head">
      <span class="pcard-cat">${CAT_ICONS[getCat(d.catId)?.type] || ''}${esc(d.catLabel || '')}</span>
      <h2>${esc(d.title || 'بدون عنوان')}</h2>
      <div class="pcard-meta" style="margin-top:8px">${pcardMeta(d)}</div>
    </div>
    ${imgs ? `<div class="detail-imgs">${imgs}</div>` : ''}
    <div class="dsec"><div class="dsec-title">التفاصيل</div>${rows || '<div class="drow"><dd>لا توجد تفاصيل إضافية</dd></div>'}</div>
    ${flags.length ? `<div class="dsec"><div class="dsec-title">مزايا</div><div class="drow"><dd>${flags.map(esc).join(' · ')}</dd></div></div>` : ''}
    ${d.desc ? `<div class="dsec"><div class="dsec-title">الوصف</div><div class="drow"><dd style="unicode-bidi:normal">${esc(d.desc)}</dd></div></div>` : ''}
    <div class="detail-actions">
      <button class="btn btn-green btn-block" onclick="confirmDone('${d.id}')">
        ${ICON_CHECK}
        تمّت إضافته بالأدمن — حذف من المعلقات
      </button>
      <button class="btn btn-ghost btn-block" onclick="showPending()">رجوع</button>
    </div>`;
  document.getElementById('topTitle').textContent = 'تفاصيل المسودة';
  document.getElementById('topSub').textContent = fmtDate(d.createdAt);
  showView('viewDetail');
}
window.openDetail = openDetail;

async function confirmDone(id) {
  if (!confirm('تم إضافة هذا الإعلان بالأدمن فعلاً؟ سيُحذف من المعلقات نهائياً.')) return;
  try {
    await removeDraft(id);
    toast('تم الحذف من المعلقات', 'ok');
    showPending();
  } catch (e) {
    toast('تعذّر الحذف: ' + (e.message || e), 'err');
  }
}
window.confirmDone = confirmDone;

/* ===== لوحة إدارة الحسابات (المدير فقط) ===== */
function genPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 8; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

async function openAdminPanel() {
  if (!myProfile || myProfile.role !== 'manager') return;
  document.getElementById('topTitle').textContent = 'إدارة الحسابات';
  document.getElementById('topSub').textContent = 'إنشاء ومتابعة حسابات الموظفين والشركاء';
  showView('viewAdmin');
  renderNewPartnerForm();
  await loadAllPartners();
}
window.openAdminPanel = openAdminPanel;

async function loadAllPartners() {
  const wrap = document.getElementById('partnerList');
  wrap.innerHTML = '<p class="admin-hint">جارٍ التحميل…</p>';
  try {
    const snap = await db.collection(PARTNERS_COLLECTION).orderBy('createdAt', 'desc').get();
    allPartners = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch (e) {
    wrap.innerHTML = '<p class="admin-hint">تعذّر تحميل الحسابات</p>';
    return;
  }
  if (!allPartners.length) { wrap.innerHTML = '<p class="admin-hint">ما في حسابات بعد</p>'; return; }
  wrap.innerHTML = allPartners.map(p => `
    <div class="partner-row">
      <div class="partner-row-main">
        <span class="partner-row-name">${esc(p.businessName || ROLE_LABELS[p.role] || p.role)}</span>
        <span class="partner-row-role">${esc(ROLE_LABELS[p.role] || p.role)}</span>
      </div>
      <div class="partner-row-email">${esc(p.email || '')}</div>
    </div>`).join('');
}

function renderNewPartnerForm() {
  const wrap = document.getElementById('newPartnerForm');
  wrap.innerHTML = `
    <div class="form-group"><label class="form-label">الدور *</label>
      <select class="form-select" id="npRole" onchange="onNewPartnerRoleChange()">
        <option value="employee">موظف بالشركة</option>
        <option value="car-dealer">معرض سيارات</option>
        <option value="realestate">محل عقاري</option>
        <option value="equipment-agent">وكيل معدات</option>
      </select>
    </div>
    <div class="form-group" id="npBizWrap" hidden><label class="form-label">اسم المعرض/المحل *</label>
      <input type="text" class="form-input" id="npBiz" placeholder="مثال: معرض عزام">
    </div>
    <div class="form-group"><label class="form-label">البريد الإلكتروني *</label>
      <input type="email" class="form-input" id="npEmail" placeholder="name@example.com" dir="ltr">
    </div>
    <div class="form-group"><label class="form-label">كلمة السر *</label>
      <div class="np-pass-row">
        <input type="text" class="form-input" id="npPass" value="${genPassword()}" dir="ltr">
        <button type="button" class="btn btn-ghost np-gen" onclick="document.getElementById('npPass').value=genPassword()">تجديد</button>
      </div>
    </div>
    <button type="button" class="btn btn-save btn-block" id="npSubmit" onclick="submitNewPartner()">إنشاء الحساب</button>`;
}
window.onNewPartnerRoleChange = function () {
  const role = document.getElementById('npRole').value;
  document.getElementById('npBizWrap').hidden = (role === 'employee');
};

async function submitNewPartner() {
  const role = document.getElementById('npRole').value;
  const biz = document.getElementById('npBiz')?.value.trim() || '';
  const email = document.getElementById('npEmail').value.trim().toLowerCase();
  const pass = document.getElementById('npPass').value;
  if (!email || !pass) { toast('املأ البريد وكلمة السر', 'err'); return; }
  if (role !== 'employee' && !biz) { toast('اسم المعرض/المحل مطلوب لهذا الدور', 'err'); return; }

  const btn = document.getElementById('npSubmit');
  btn.disabled = true; btn.textContent = 'جارٍ الإنشاء…';
  try {
    await createPartnerAccount({ email, password: pass, role, businessName: biz });
    toast('تم إنشاء الحساب — سلّم البيانات لصاحبه', 'ok');
    renderNewPartnerForm();
    await loadAllPartners();
  } catch (e) {
    const msg = e.code === 'auth/email-already-in-use' ? 'هذا البريد مستخدم لحساب آخر أصلاً'
      : e.code === 'auth/weak-password' ? 'كلمة السر ضعيفة — 6 أحرف على الأقل'
      : 'تعذّر الإنشاء: ' + (e.message || e.code);
    toast(msg, 'err');
    btn.disabled = false; btn.textContent = 'إنشاء الحساب';
  }
}
window.submitNewPartner = submitNewPartner;

/* ===== بدء التشغيل ===== */
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
  initSupabaseStorage();

  if (useCloud) {
    // انتظر Firebase ليقرّر: مسجّل دخول → حمّل ملف الحساب ثم افتح التطبيق، وإلا → شاشة الدخول
    auth.onAuthStateChanged(async user => {
      if (!user) { myProfile = null; showLogin(true); return; }
      showLogin(false);
      document.getElementById('loginPass').value = '';
      loginError('');
      try {
        await loadMyProfile(user);
      } catch (e) {
        console.error(e); myProfile = null;
      }
      const adminBtn = document.getElementById('headerAdminBtn');
      if (adminBtn) adminBtn.hidden = !myProfile || myProfile.role !== 'manager';
      if (!myProfile) {
        toast('حسابك غير مُهيّأ بعد — راجع المدير', 'err');
        return;
      }
      showPending();
    });
  } else {
    // وضع محلي: لا حسابات ولا مزامنة — التطبيق يفتح مباشرة
    showLogin(false);
    showPending();
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
