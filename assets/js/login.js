// ==========================================================================
// 🔥 認証専用ページ制御スクリプト（login.js）
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// Firebaseの初期設定
const firebaseConfig = {
  apiKey: "AIzaSyCxPoxxpZMYJAF4I_HM-QeZxI120YOg5YA",
  authDomain: "mememori-potal.firebaseapp.com",
  projectId: "mememori-potal",
  storageBucket: "mememori-potal.firebasestorage.app",
  messagingSenderId: "773521822661",
  appId: "1:773521822661:web:3d106588f9fcec7867b1ac",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

document.addEventListener("DOMContentLoaded", () => {
  const googleLoginBtn = document.querySelector(".js-btn-google-login");
  const demoLoginBtn = document.querySelector(".js-btn-demo-login");

  // 1. Googleアカウントでの通常ログイン処理
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", async () => {
      const provider = new GoogleAuthProvider();
      try {
        googleLoginBtn.classList.add("is-loading");
        googleLoginBtn.disabled = true;
        await signInWithPopup(auth, provider);
      } catch (error) {
        console.error("❌ ログインに失敗しました。", error);
        googleLoginBtn.classList.remove("is-loading");
        googleLoginBtn.disabled = false;
        alert("ログインに失敗しました。アカウントを確認してください。");
      }
    });
  }

  // 2. ログインなしでデモを試す処理
  if (demoLoginBtn) {
    demoLoginBtn.addEventListener("click", () => {
      // セッションストレージにデモモード用のフラグをセット
      sessionStorage.setItem("mememori_portal_demo", "true");
      // ポータルメイン画面へ遷移
      window.location.href = "index.html";
    });
  }

  // 3. ログイン状態の監視（認証済みユーザーは自動でindex.htmlへ）
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // ログインが成功した場合はデモフラグをクリアしておく
      sessionStorage.removeItem("mememori_portal_demo");
      window.location.href = "index.html";
    }
  });
});
