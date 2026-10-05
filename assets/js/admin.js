/* =========================================================================
   👑 admin.js：すべての管理画面で使い回す「共通」のJavaScript
   ========================================================================= */

/* -------------------------------------------------------------------------
   👥 ログイン認証 (管理ページ共通)
   ------------------------------------------------------------------------- */

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
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

// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 🛡️ Google固有のID
const ADMIN_UID = "ZcWgnVNxShfjr1byRolwgdASFLi2";

// 各管理画面が「認証成功後に動かしたい自分専用の処理」を一時的に入れておくグローバルな箱
window.onAdminAuthSuccess = null;

// 🚀 画面読み込み時に、自動的にログイン状態の監視をスタート
window.addEventListener("DOMContentLoaded", function () {
  onAuthStateChanged(auth, (user) => {
    // すでにログインしている場合
    if (user) {
      if (user.uid === ADMIN_UID) {
        console.log("👑 管理者ログイン成功:", user.uid);

        // 各HTML（キャラ面やアルカナ面）が用意した「自分専用の処理」があれば、ここで自動実行する！
        if (typeof window.onAdminAuthSuccess === "function") {
          window.onAdminAuthSuccess(user);
        }
      } else {
        alert("エラー：管理者権限がありません。");
        signOut(auth).then(() => {
          window.location.href = "./index.html";
        });
      }
      // ログインしていない場合
    } else {
      const provider = new GoogleAuthProvider();
      signInWithPopup(auth, provider).catch((error) => {
        alert("ログインに失敗しました: " + error.message);
      });
    }
  });
});

// -------------------------------------------------------------------------
//  ログアウトボタンのイベント紐付け
// -------------------------------------------------------------------------
export function logoutAdmin() {
  signOut(auth)
    .then(() => {
      alert("ログアウトしました。");
      window.location.href = "./index.html";
    })
    .catch((error) => {
      console.error("ログアウトエラー:", error);
    });
}

// -------------------------------------------------------------------------
// ログアウトボタンのイベント紐付け
// -------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
  var logoutBtn = document.getElementById("globalLogoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", function (e) {
    e.preventDefault();

    if (confirm("ログアウトしますか？")) {
      logoutAdmin(); // 上記の共通関数を実行
    }
  });
});

/* -------------------------------------------------------------------------
   1. 共有マスターデータ（アルカナ画面でもキャラ画面でも使い回す配列）
   ------------------------------------------------------------------------- */
// 💡 ローカル動作確認用のキャラクターダミーデータ（一元管理）
window.characterMaster = [
  {
    id: "1",
    name: "キャラクターA",
    attr: "藍",
    type: "ウォーリアー",
    rarity: "限定",
    iconUrl: "https://placehold.co",
  },
  {
    id: "2",
    name: "キャラクターB",
    attr: "紅",
    type: "スナイパー",
    rarity: "恒常",
    iconUrl: "https://placehold.co",
  },
  {
    id: "3",
    name: "キャラクターC",
    attr: "翠",
    type: "ソーサラー",
    rarity: "限定",
    iconUrl: "https://placehold.co",
  },
  {
    id: "4",
    name: "キャラクターD",
    attr: "黄",
    type: "ウォーリアー",
    rarity: "恒常",
    iconUrl: "https://placehold.co",
  },
];

/* -------------------------------------------------------------------------
     2. 共通UIコントロール（モーダルの外側背景をクリックしたら閉じる処理）
     ------------------------------------------------------------------------- */
// 💡 画面上のどこかがクリックされたとき、それがモーダルの「黒背景」自身だったら自動で閉じる仕組み
document.addEventListener("click", function (event) {
  var clickedElement = event.target;
  if (!clickedElement) return;

  // 💡 アルカナ側の暗幕（mdOverlay）か、キャラ側のアトラス暗幕（charModal / charDetailModal）かを一括判定
  var isArcanaOverlay = clickedElement.id === "mdOverlay";
  var isCharMasterOverlay = clickedElement.id === "charModal";
  var isCharDetailOverlay = clickedElement.id === "charDetailModal";
  var isPerfEditOverlay = clickedElement.id === "charPerfEditModal";

  // アルカナマスタ側のモーダルを閉じる呼び出し
  if (isArcanaOverlay && typeof closeCard === "function") {
    console.log(
      "［共通処理］アルカナモーダルの外側クリックを検知。安全に閉じます。",
    );
    closeCard();
  }

  // キャラクターマスタ側の編集モーダルを閉じる呼び出し
  if (isCharMasterOverlay && typeof closeModal === "function") {
    console.log(
      "［共通処理］キャラクターマスタ編集モーダルの外側クリックを検知。安全に閉じます。",
    );
    closeModal();
  }

  // キャラクター詳細モーダルを閉じる呼び出し
  if (isCharDetailOverlay && typeof closeDetailModal === "function") {
    console.log(
      "［共通処理］キャラクター詳細モーダルの外側クリックを検知。安全に閉じます。",
    );
    closeDetailModal();
  }

  // キャラクター性能編集モーダルを閉じる呼び出し
  if (isPerfEditOverlay && typeof closePerfEditor === "function") {
    console.log(
      "［共通処理］性能編集モーダルの外側クリックを検知。安全に閉じます。",
    );
    closePerfEditor();
  }
});

/* =========================================================================
   🌀 共通ローディングアニメーション制御
   ========================================================================= */

// 画面内にまだオーバーレイがなければ、自動的にHTMLを作成して埋め込む（手抜き仕様）
function ensureLoadingOverlay() {
  let overlay = document.getElementById("globalLoadingOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "globalLoadingOverlay";
    overlay.className = "admin-loading-overlay"; // 👈 作成したCSSクラスを付与

    const spinner = document.createElement("div");
    spinner.className = "admin-spinner";

    overlay.appendChild(spinner);
    document.body.appendChild(overlay);
  }
  return overlay;
}

/**
 * 🎬 ローディングアニメーションを開始する（画面をロックしてぐるぐる回す）
 */
window.showLoading = function () {
  const overlay = ensureLoadingOverlay();
  overlay.classList.add("is-active"); // 状態クラス「is-active」を付与して表示
};

/**
 * 🛑 ローディングアニメーションを終了する（画面を元に戻す）
 */
window.hideLoading = function () {
  const overlay = document.getElementById("globalLoadingOverlay");
  if (overlay) {
    overlay.classList.remove("is-active"); // 状態クラス「is-active」を外して非表示
  }
};
