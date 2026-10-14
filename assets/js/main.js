// ==========================================================================
// 🔥 Firebase初期化（Live Server専用・最新モジュール式）
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCxPoxxpZMYJAF4I_HM-QeZxI120YOg5YA",
  authDomain: "://firebaseapp.com",
  projectId: "mememori-potal",
  storageBucket: "mememori-potal.firebasestorage.app",
  messagingSenderId: "773521822661",
  appId: "1:773521822661:web:3d106588f9fcec7867b1ac",
};

// 💡 Firebaseアプリ オブジェクトの作成！
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * 📄 ページが読み込まれたらすべてのインフラ関数を順番に実行する
 */
document.addEventListener("DOMContentLoaded", async () => {
  // 💡 1. 共通フッターの挿入とアクティブ化（完了を待つ）
  await insertFooter();
  setActiveNavigation();

  // 💡 2. 共通ワールドセレクターの挿入とイベント設定（完了を待つ）
  await insertWorldSelector();
  initWorldSelectorEvent();
});

/**
 * 📁 関数①：フッターを裏側で読み込んで画面に挿入する関数
 */
async function insertFooter() {
  const footerContainer = document.getElementById("js-footer-container");
  if (!footerContainer) return;

  try {
    const response = await fetch("assets/includes/footer.html");
    if (!response.ok) throw new Error("フッターの読み込みに失敗しました");
    footerContainer.innerHTML = await response.text();
  } catch (error) {
    console.error("フッターの読み込みエラー:", error);
  }
}

/**
 * 🧭 関数②：現在のURLと一致するフッターのナビボタンに is-active を付与する関数
 */
function setActiveNavigation() {
  const currentPath = window.location.pathname.toLowerCase();
  const navLinks = document.querySelectorAll(".js-nav-trigger");

  navLinks.forEach((link) => {
    const targetHref = link.getAttribute("href").toLowerCase();

    if (targetHref === "index.html") {
      if (currentPath.endsWith("index.html") || currentPath.endsWith("/")) {
        link.classList.add("is-active");
      } else {
        link.classList.remove("is-active");
      }
    } else {
      if (currentPath.includes(targetHref)) {
        link.classList.add("is-active");
      } else {
        link.classList.remove("is-active");
      }
    }
  });
}

/**
 * 🌐 関数③：ワールドセレクターを適切なコンテナに挿入する関数
 */
async function insertWorldSelector() {
  const targetContainer =
    document.getElementById("js-header-container") ||
    document.getElementById("js-world-selector-container");

  if (!targetContainer) return;

  try {
    const response = await fetch("assets/includes/world-selector.html");
    if (!response.ok)
      throw new Error("ワールドセレクターの読み込みに失敗しました");

    targetContainer.innerHTML = await response.text();
  } catch (error) {
    console.error("ワールドセレクターの読み込みエラー:", error);
  }
}

/**
 * ⚙️ 関数④：2つのモーダル（選択・追加）の開閉と連動を設定する関数
 */
function initWorldSelectorEvent() {
  const modalSelect = document.getElementById("js-world-modal");
  const openSelectBtn = document.getElementById("js-world-modal-open");
  const closeSelectBtn = document.getElementById("js-world-modal-close");
  const overlaySelect = document.getElementById("js-world-modal-overlay");
  const choiceBtns = document.querySelectorAll(".js-world-choice");

  const currentWorldBadge = document.getElementById("js-current-world-badge");
  const modalWorldText = document.getElementById("js-modal-world-text");

  // 🔒 初期状態（閉じているとき）は両方とも inert を付与して完全に眠らせておく
  if (modalSelect) modalSelect.setAttribute("inert", "");

  // 💡 タイミングのズレを防ぐため、一瞬遅れて確実に要素を捕まえて初期化する
  setTimeout(() => {
    const modalAdd = document.getElementById("js-create-modal");
    if (modalAdd) modalAdd.setAttribute("inert", "");
  }, 50);

  // ==========================================================================
  // 🟢 1枚目：ワールド選択モーダルの開閉ロジック
  // ==========================================================================
  if (openSelectBtn && modalSelect) {
    openSelectBtn.addEventListener("click", () => {
      modalSelect.classList.add("is-open");
      modalSelect.removeAttribute("aria-hidden");
      modalSelect.removeAttribute("inert");

      const activeBtn = modalSelect.querySelector(".js-world-choice.is-active");
      if (activeBtn) activeBtn.focus();
    });
  }

  const closeSelectModal = () => {
    if (modalSelect) {
      modalSelect.classList.remove("is-open");
      modalSelect.setAttribute("aria-hidden", "true");
      modalSelect.setAttribute("inert", "");
      if (openSelectBtn) openSelectBtn.focus();
    }
  };
  if (closeSelectBtn)
    closeSelectBtn.addEventListener("click", closeSelectModal);
  if (overlaySelect) overlaySelect.addEventListener("click", closeSelectModal);

  // ==========================================================================
  // 🔵 2枚目：ワールド追加モーダルの開閉・実体化ロジック
  // ==========================================================================
  document.addEventListener("click", (e) => {
    const modalAdd = document.getElementById("js-create-modal");
    if (!modalAdd) return;

    // 🔓 開く処理：新規追加ボタン（js-create-world）が押されたら
    if (e.target.closest(".js-create-world")) {
      modalAdd.classList.add("is-open");
      modalAdd.removeAttribute("aria-hidden");
      modalAdd.removeAttribute("inert"); // 開いた瞬間に確実に実体化
    }

    // 🔒 閉じる処理：×ボタン、またはオーバーレイがクリックされたら
    const isOverlay = e.target.id === "js-create-modal-overlay";
    const isCloseBtn = e.target.closest("#js-create-world-close");

    if (isOverlay || isCloseBtn) {
      modalAdd.classList.remove("is-open");
      modalAdd.setAttribute("aria-hidden", "true");
      modalAdd.setAttribute("inert", ""); // 閉じたら確実に幽霊状態に戻す
    }
  });

  // ==========================================================================
  // 🌍 3. ワールド選択時のテキスト書き換え処理
  // ==========================================================================
  choiceBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const selectedWorld = btn.getAttribute("data-world");
      const selectedWorldText = btn.textContent;

      choiceBtns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      if (currentWorldBadge) currentWorldBadge.textContent = selectedWorldText;
      if (modalWorldText) modalWorldText.textContent = selectedWorldText;

      closeSelectModal();
    });
  });

  // ==========================================================================
  // 📝 4. 【公式ステップ3】最新モジュール仕様によるデータ書き込み処理
  // ==========================================================================
  const createWorldForm = document.getElementById("js-create-world-form");

  if (createWorldForm) {
    // 💡 データベースの通信待ち（await）を行えるように、関数頭に「async」を付与
    createWorldForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const inputNumber = document
        .getElementById("js-input-world-number")
        ?.value.trim();
      const inputName = document
        .getElementById("js-input-world-name")
        ?.value.trim();

      if (!inputNumber) return;

      // ----------------------------------------------------------------------
      // 🔥 【本番通信】Firebase Firestore への非同期書き込み処理
      // ----------------------------------------------------------------------
      try {
        console.log("⏳ Firebaseへデータを送信中...");

        // 💡 インポートした最新の関数（addDoc、collection、serverTimestamp）を使用して送信
        await addDoc(collection(db, "worlds"), {
          worldNumber: Number(inputNumber), // 数値型に変換して保存
          worldName: inputName || null, // 空っぽならnullとして保存
          createdAt: serverTimestamp(), // サーバー側の正確な登録日時
        });

        console.log("✅ Firebaseへの書き込みが正常に完了しました！");

        // ----------------------------------------------------------------------
        // 🌍 ① ワールド番号の反映（通信成功時のみ実行）
        // ----------------------------------------------------------------------
        if (currentWorldBadge)
          currentWorldBadge.textContent = `W ${inputNumber}`;
        if (modalWorldText) modalWorldText.textContent = `W ${inputNumber}`;

        // ----------------------------------------------------------------------
        // 👤 ② ワールド名（ユーザー名エリア）の反映 ＆ 表示・非表示制御
        // ----------------------------------------------------------------------
        const modalUserText = document.getElementById("js-modal-user-text");
        const headerUserName = document.getElementById("js-user-name");

        if (inputName) {
          if (modalUserText) {
            modalUserText.textContent = inputName;
            modalUserText.classList.remove("is-hidden");
          }
          if (headerUserName) {
            headerUserName.textContent = inputName;
            headerUserName.classList.remove("is-hidden");
          }
        } else {
          if (modalUserText) modalUserText.classList.add("is-hidden");
          if (headerUserName) headerUserName.classList.add("is-hidden");
        }

        // ----------------------------------------------------------------------
        // 🔒 ③ クローズ・リセット連動
        // ----------------------------------------------------------------------
        createWorldForm.reset(); // フォームをクリア

        // モーダル2（追加）を閉じる
        const modalAdd = document.getElementById("js-create-modal");
        if (modalAdd) {
          modalAdd.classList.remove("is-open");
          modalAdd.setAttribute("aria-hidden", "true");
          modalAdd.setAttribute("inert", "");
        }

        // モーダル1（選択）も連鎖して閉じる
        closeSelectModal();
      } catch (error) {
        console.error("❌ Firebaseへの保存に失敗しました。原因:", error);
        alert(
          "ワールドの登録に失敗しました。設定や通信環境を確認してください。",
        );
      }
    });
  }
}
