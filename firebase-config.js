/* ============================================================
   إعدادات Firebase — مشروع منفصل تماماً
   ------------------------------------------------------------
   ⚠️  هذا المشروع لا علاقة له بقاعدة بيانات «طلبك تم» الفعلية
       (Supabase). أنشئ مشروع Firebase جديداً ومستقلاً لهذه
       المسودات فقط.

   كيف تملأ القيم:
   1) افتح https://console.firebase.google.com  ← Add project
   2) بعد الإنشاء: Build → Firestore Database → Create database
      اختر Production mode ثم أقرب منطقة (europe-west مثلاً)
   3) Project settings (⚙) → General → Your apps → Web (</>)
      سجّل التطبيق وانسخ كائن firebaseConfig والصقه تحت
   4) Firestore → Rules → الصق القواعد الموجودة في README.md

   إذا تركت القيم فارغة، التطبيق يشتغل بوضع «محلي» على الجهاز
   الواحد فقط — مفيد للتجربة، لكن الموظفين لن يتشاركوا القائمة.
   ============================================================ */

window.FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

/* اسم مجموعة المسودات داخل Firestore — لا داعي لتغييره */
window.DRAFTS_COLLECTION = "drafts";
