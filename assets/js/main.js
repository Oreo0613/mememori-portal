// ==========================================================================
// 🔥 ① FIREBASE INFRASTRUCTURE (初期化・認証・基本監視)
// ==========================================================================
// import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
// import {
//   getFirestore,
//   collection,
//   addDoc,
//   serverTimestamp,
// } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// import {
//   getAuth,
//   onAuthStateChanged,
//   signOut,
// } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// ==========================================================================
// 🔥 ① FIREBASE INFRASTRUCTURE (初期化・認証・基本監視)
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// Firebaseの初期設定
const firebaseConfig = {
  apiKey: "AIzaSyCxPoxxpZMYJAF4I_HM-QeZxI120YOg5YA",
  authDomain: "://firebaseapp.com",
  projectId: "mememori-potal",
  storageBucket: "mememori-potal.firebasestorage.app",
  messagingSenderId: "773521822661",
  appId: "1:773521822661:web:3d106588f9fcec7867b1ac",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// アカウント情報の保存処理
async function saveAccountData(userId, accountData) {
  try {
    const userDocRef = doc(db, "users", userId);
    await setDoc(userDocRef, accountData, { merge: true });
  } catch (error) {
    console.error("エラー:", error);
  }
}

// アカウント情報のロード処理
async function loadAccountData(userId) {
  try {
    const userDocRef = doc(db, "users", userId);
    const docSnap = await getDoc(userDocRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error("エラー:", error);
    return null;
  }
}

// 📄 ページ読み込み時のエントリーポイント
document.addEventListener("DOMContentLoaded", async () => {
  await insertFooter();
  setActiveNavigation();

  await insertWorldSelector();
  // 💡 共通モーダル制御・イベント初期化関数を起動
  initWorldSelectorEvent();
});

// 📁 共通フッター挿入
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

// 🧭 ナビゲーションのアクティブ制御
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

// 🌐 ワールドセレクターHTML挿入
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
 * 💡【バグ修正版】引数オブジェクトへの依存を無くし、
 * セッションストレージ内のカスタムアカウント名のみでクラス付与状態を完全に制御・同期する
 */
function checkAccountRegistrationStatus() {
  const accountTrigger = document.querySelector(".js-account-trigger");
  const addWorldBtn = document.querySelector(".js-create-world");

  // アプリ側で手動保存したカスタム名（リロード時はFirestoreからここに同期される）を取得
  const savedCustomName = sessionStorage.getItem("app_custom_username");

  if (!savedCustomName) {
    // ➔ ①アカウント未登録状態：視覚的補正(is-require-setup)をオンにし、ワールド追加ボタンをロック(is-disabled)
    if (accountTrigger) accountTrigger.classList.add("is-require-setup");
    if (addWorldBtn) {
      addWorldBtn.classList.add("is-disabled");
      addWorldBtn.setAttribute("title", "先にアカウント名を設定してください");
    }
    return false;
  } else {
    // ➔ ②アカウント登録完了状態：すべてのロッククラスを安全に除去
    if (accountTrigger) accountTrigger.classList.remove("is-require-setup");
    if (addWorldBtn) {
      addWorldBtn.classList.remove("is-disabled");
      addWorldBtn.removeAttribute("title");
    }
    return true;
  }
}

// ==========================================================================
// 🕹️ ② UI INTERACTION & LOCK GUARD (モーダル開閉・順序ロック・フォーム通信)
// ==========================================================================
function initWorldSelectorEvent() {
  // --- モーダル1（ワールド選択）の要素 ---
  const modalSelect = document.getElementById("js-world-modal");
  const openSelectBtn = document.getElementById("js-world-modal-open");
  const closeSelectBtn = document.getElementById("js-world-modal-close");
  const overlaySelect = document.getElementById("js-world-modal-overlay");
  const choiceBtns = document.querySelectorAll(".js-world-choice");
  const currentWorldNumber = document.getElementById("js-current-world-number");
  const modalWorldText = document.getElementById("js-modal-user-text"); // 💡 表示位置の同期用

  // --- モーダル3（アカウント情報編集）の要素 ---
  const modalAccount = document.getElementById("js-account-modal");
  const openAccountBtns = document.querySelectorAll(".js-account-trigger");
  const closeAccountBtn = document.getElementById("js-account-modal-close");
  const overlayAccount = document.getElementById("js-account-modal-overlay");
  const accountNameForm = document.getElementById("js-account-name-form");
  const inputAccountName = document.getElementById("js-input-account-name");
  const fullUidText = document.getElementById("js-account-full-uid");

  // 🔒 初期状態（閉じているとき）は inert を付与して完全に眠らせておく
  if (modalSelect) modalSelect.setAttribute("inert", "");
  if (modalAccount) modalAccount.setAttribute("inert", "");

  // タイミングのズレを防ぐため、一瞬遅れて確実に要素を捕まえて初期化する
  setTimeout(() => {
    const modalAdd = document.getElementById("js-create-modal");
    if (modalAdd) modalAdd.setAttribute("inert", "");
  }, 50);

  // --------------------------------------------------------------------------
  // 🟢 モーダル1：ワールド選択モーダルの開閉
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // 🔵 モーダル2：ワールド追加モーダルの開閉（★アカウント未登録時のロック付き）
  // --------------------------------------------------------------------------
  document.addEventListener("click", (e) => {
    const targetAddTrigger = e.target.closest(".js-create-world");
    if (!targetAddTrigger) return;

    // CSSの pointer-events: none が適用されている場合は通常発動しませんが、
    // JavaScript側でもセッション状態を見て二重で厳格にインターセプトガードをかけます
    const savedCustomName = sessionStorage.getItem("app_custom_username");
    if (!savedCustomName) {
      alert(
        "順番に登録しましょう！まずは「アカウント設定」からカスタムアカウント名を保存してください。",
      );

      // アカウント設定モーダル（モーダル3）を自動起動
      if (modalAccount) {
        modalAccount.classList.add("is-open");
        modalAccount.removeAttribute("aria-hidden");
        modalAccount.removeAttribute("inert");
        if (inputAccountName) {
          inputAccountName.value = "";
          inputAccountName.focus();
        }
      }
      return; // ここで処理を遮断し、ワールド追加モーダルは絶対に開かせない
    }

    // アカウント名が設定済みであれば通常通り開く
    const modalAdd = document.getElementById("js-create-modal");
    if (modalAdd) {
      modalAdd.classList.add("is-open");
      modalAdd.removeAttribute("aria-hidden");
      modalAdd.removeAttribute("inert");
    }
  });

  // モーダル2（ワールド追加）を閉じる処理
  document.addEventListener("click", (e) => {
    const modalAdd = document.getElementById("js-create-modal");
    if (!modalAdd) return;

    const isOverlay = e.target.id === "js-create-modal-overlay";
    const isCloseBtn = e.target.closest("#js-create-world-close");

    if (isOverlay || isCloseBtn) {
      modalAdd.classList.remove("is-open");
      modalAdd.setAttribute("aria-hidden", "true");
      modalAdd.setAttribute("inert", "");
    }
  });

  // --------------------------------------------------------------------------
  // 🪪 モーダル3：アカウント情報編集モーダルの開閉
  // --------------------------------------------------------------------------
  openAccountBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!modalAccount) return;

      const user = auth.currentUser;
      if (user) {
        // 💡 Googleの user.displayName は一切見ない
        const savedCustomName = sessionStorage.getItem("app_custom_username");
        if (inputAccountName) {
          inputAccountName.value = savedCustomName ? savedCustomName : "";
        }

        // システム識別用のUIDだけを画面のグレー背景エリアに反映
        if (fullUidText) fullUidText.textContent = user.uid;
      }

      modalAccount.classList.add("is-open");
      modalAccount.removeAttribute("aria-hidden");
      modalAccount.removeAttribute("inert");

      if (inputAccountName) inputAccountName.focus();
    });
  });

  const closeAccountModal = () => {
    if (modalAccount) {
      modalAccount.classList.remove("is-open");
      modalAccount.setAttribute("aria-hidden", "true");
      modalAccount.setAttribute("inert", "");
    }
  };
  if (closeAccountBtn)
    closeAccountBtn.addEventListener("click", closeAccountModal);
  if (overlayAccount)
    overlayAccount.addEventListener("click", closeAccountModal);

  // --------------------------------------------------------------------------
  // 🌍 選択ワールドの切り替え・画面テキスト同期
  // --------------------------------------------------------------------------
  choiceBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const selectedWorldText = btn.textContent;

      choiceBtns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      if (currentWorldNumber)
        currentWorldNumber.textContent = selectedWorldText;
      closeSelectModal();
    });
  });

  // --------------------------------------------------------------------------
  // 📝 フォーム送信：①ワールド新規追加（Firestoreデータ保存）
  // --------------------------------------------------------------------------
  const createWorldForm = document.getElementById("js-create-world-form");
  if (createWorldForm) {
    createWorldForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const inputNumber = document
        .getElementById("js-input-world-number")
        ?.value.trim();
      const inputName = document
        .getElementById("js-input-world-name")
        ?.value.trim();

      if (!inputNumber) return;

      const user = auth.currentUser;
      if (!user) return;

      try {
        console.log(`⏳ ユーザー「${user.uid}」の領域へデータを送信中...`);

        await addDoc(collection(db, "users", user.uid, "worlds"), {
          worldNumber: Number(inputNumber),
          worldName: inputName || null,
          createdAt: serverTimestamp(),
        });

        console.log("✅ 正常に書き込みが完了しました！");

        // 🌍 【追加・修正】左上のバッジにワールド番号とワールド名を即時同期
        if (currentWorldNumber) {
          currentWorldNumber.textContent = `ワールド ${inputNumber}`;
        }

        // ✨ ここを追加：新設したIDを取得して、入力されたワールド名（空なら"（名称未設定）"など）を反映
        const currentWorldNameElement = document.getElementById(
          "js-current-world-name",
        );
        if (currentWorldNameElement) {
          currentWorldNameElement.textContent = inputName || "名称未設定";
        }

        createWorldForm.reset();
        const modalAdd = document.getElementById("js-create-modal");
        if (modalAdd) {
          modalAdd.classList.remove("is-open");
          modalAdd.setAttribute("aria-hidden", "true");
          modalAdd.setAttribute("inert", "");
        }
        closeSelectModal();
      } catch (error) {
        console.error("❌ 本番階層への保存に失敗しました。原因:", error);
        alert(
          "ワールドの登録に失敗しました。設定や通信環境を確認してください。",
        );
      }
    });
  }

  // --------------------------------------------------------------------------
  // 📝 フォーム送信：②カスタムアカウント名変更・UIロックのリアルタイム解除
  // --------------------------------------------------------------------------
  if (accountNameForm) {
    accountNameForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const newName = inputAccountName?.value.trim();
      if (!newName) return;

      const user = auth.currentUser;
      if (!user) return;

      try {
        console.log(
          `⏳ 画面にカスタムアカウント名「${newName}」を即時反映中...`,
        );

        // 💡送信ボタンのフォーカスを安全に解除（アクセシビリティ警告エラー対策）
        const activeSubmitBtn = accountNameForm.querySelector(
          "button[type='submit']",
        );
        if (activeSubmitBtn) {
          activeSubmitBtn.blur();
        }

        // 🌍 モーダル1ヘッダー内の名前要素を取得して即時書き換え
        const modalHeaderName = document.getElementById("js-modal-user-text");
        if (modalHeaderName) {
          modalHeaderName.textContent = newName;
        }

        // 💡 Google側への同期を遮断し、アプリ専用の一時メモリ（セッション）に手動カスタム名を保存する
        sessionStorage.setItem("app_custom_username", newName);

        // 🔥 Firestoreの一番上の階層（users/ユーザーID）に保存する
        await saveAccountData(user.uid, {
          accountId: user.uid,
          accountName: newName,
          updatedAt: serverTimestamp(),
        });

        // 💡 ロック制御関数を呼び出して、追加ボタンのロック解除とオーラ消去をリアルタイム実行
        checkAccountRegistrationStatus();

        alert(
          "アカウント設定を更新しました。これでワールドの登録が可能になります！",
        );
        closeAccountModal();
      } catch (error) {
        console.error("❌ アカウント名更新エラー:", error);
        alert("保存に失敗しました。");
      }
    });
  }
}

// ==========================================================================
// 🚪 ③ GOOGLE LOGOUT & SECURITY GATE (ログアウト・ログイン監視・防犯ロック)
// ==========================================================================

// 💡 1. ログアウトボタンのクリック処理
document.addEventListener("click", async (e) => {
  if (e.target.closest("#js-btn-logout")) {
    if (confirm("ログアウトしますか？")) {
      try {
        console.log("⏳ Googleからサインアウト中...");
        // ログアウト時はセッションストレージも綺麗にクリアする
        sessionStorage.removeItem("app_custom_username");
        await signOut(auth);
        console.log("👋 ログアウトが成功しました。");
      } catch (error) {
        console.error("❌ ログアウトに失敗しました。原因:", error);
      }
    }
  }
});

// 💡 2. メイン画面側の状態監視 ＆ ログイン必須の防犯ロック
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log(`👤 ログイン監視中... (UID: ${user.uid})`);

    // 🌍 HTML側の各ユーザー情報表示パーツを正確に捕まえる
    const headerTriggerName = document.getElementById("js-current-world-name"); // 左上トリガー内の名前
    const modalHeaderName = document.getElementById("js-modal-user-text"); // モーダル1ヘッダー内の名前
    const modalUidText = document.getElementById("js-modal-uid-text"); // モーダル1ヘッダー内のID枠

    // 🆔 UID表示の安全な切り出し反映
    if (modalUidText) {
      modalUidText.textContent = `ID: ${user.uid.substring(0, 8)}...`;
    }

    // 💡【コアアップデート】セッションではなく、Firestoreのデータベースから登録名を直接自動ロードする
    try {
      console.log("⏳ Firestoreからアカウント情報を自動ロード中...");
      const accountData = await loadAccountData(user.uid);

      if (accountData && accountData.accountName) {
        // ------------------------------------------------------------------
        // ⭕ アカウント名がすでに手動登録・保存されている場合の処理
        // ------------------------------------------------------------------
        const savedCustomName = accountData.accountName;
        console.log(
          `main.js:410 ⏳ 画面にカスタムアカウント名「${savedCustomName}」を即時反映中...`,
        );

        // セッションストレージ側にも最新値を同期してバックアップ
        sessionStorage.setItem("app_custom_username", savedCustomName);

        // 各種HTMLテキストの書き換えと、非表示(is-hidden)の安全な解除
        if (headerTriggerName) {
          headerTriggerName.textContent = savedCustomName;
          headerTriggerName.classList.remove("is-hidden"); // 確実に名前を表示させる
        }
        if (modalHeaderName) {
          modalHeaderName.textContent = savedCustomName;
        }
      } else {
        // ------------------------------------------------------------------
        // ❌ アカウント名がまだ手動登録されていない「初回訪問時」の処理
        // ------------------------------------------------------------------
        console.log(
          "ℹ️ Firestoreにまだアカウントデータが登録されていません。新規登録が必要です。",
        );

        // 未設定時は念のため一時メモリも確実に空にする
        sessionStorage.removeItem("app_custom_username");

        if (headerTriggerName) {
          headerTriggerName.textContent = "";
          headerTriggerName.classList.add("is-hidden"); // 登録されるまで左上の名前を完全に消し去る
        }
        if (modalHeaderName) {
          modalHeaderName.textContent = "未設定";
        }
      }
    } catch (error) {
      console.error("🚨 アカウント情報の自動ロードに失敗しました:", error);
    }

    // 💡 【超重要】上記データ取得が完了したタイミングでロック状態判定を呼び出す！
    // これにより、手動登録の有無に応じて is-require-setup や is-disabled が100%完璧に同期連動します。
    checkAccountRegistrationStatus();
  } else {
    console.log(
      "🔒 未ログイン状態を検知しました。認証ページへ強制移動します。",
    );
    window.location.href = "login.html";
  }
});
