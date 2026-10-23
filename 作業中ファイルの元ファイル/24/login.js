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
  const loginBtn = document.getElementById("js-btn-login");

  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      const provider = new GoogleAuthProvider();
      try {
        loginBtn.classList.add("is-loading");
        loginBtn.disabled = true;
        await signInWithPopup(auth, provider);
      } catch (error) {
        console.error("❌ ログインに失敗しました。", error);
        loginBtn.classList.remove("is-loading");
        loginBtn.disabled = false;
        alert("ログインに失敗しました。アカウントを確認してください。");
      }
    });
  }

  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = "index.html";
    }
  });
});
