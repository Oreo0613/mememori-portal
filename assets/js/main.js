// 🌐 外部リンクのドメインからファビコン画像URLを生成する共通関数
const FAVICON_API_BASE = "http://www.google.com/s2/favicons?domain=";

// 🔮 魔女マスタデータのキャッシュ用変数（配列に変更）
let characterMaster = [];

// 📜 魔女マスタデータ（JSON）の非同期読み込み処理
async function fetchCharacterMaster() {
  try {
    const response = await fetch("assets/json/character-master.json");
    if (!response.ok)
      throw new Error("キャラクターマスタの読み込みに失敗しました");

    characterMaster = await response.json();

    // 💡 window側にも確実に同期
    window.characterMaster = characterMaster;

    console.log(
      "✅ キャラクターマスタデータのロードが完了しました。件数:",
      characterMaster.length,
    );

    // 💡【追加】マスタのロードが完了した瞬間に、もしパーティ表示関数があれば自動で再描画をかける！
    if (typeof renderPartyListUI === "function") {
      renderPartyListUI();
    }

    // 💡 選択中のワールドがあればヘッダーアイコンも再同期
    const activeWorldId = sessionStorage.getItem("app_current_world_id");
    const user = auth.currentUser;
    if (user && activeWorldId) {
      const worldDocRef = doc(db, "users", user.uid, "worlds", activeWorldId);
      const docSnap = await getDoc(worldDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        syncHeaderWorldSelector(
          data.worldNumber,
          data.worldName,
          data.characterId,
        );
      }
    }
  } catch (error) {
    console.error("🚨 キャラクターマスタデータのロードエラー:", error);
  }
}

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
  getDocs,
  query,
  orderBy,
  where,
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

// 🌐 ワールド情報のロード・モーダルリスト生成処理
async function loadWorldList(userId) {
  const worldListContainer = document.querySelector(".js-world-list");
  if (!worldListContainer) return;

  try {
    console.log("⏳ Firestoreからワールド一覧をロード中...");

    const worldsRef = collection(db, "users", userId, "worlds");
    const q = query(worldsRef, orderBy("worldNumber", "asc"));
    const querySnapshot = await getDocs(q);

    worldListContainer.innerHTML = "";

    if (querySnapshot.empty) {
      worldListContainer.innerHTML =
        '<li class="c-world-modal__item" style="text-align:center; padding: 15px; color:#888;">登録されたワールドがありません</li>';
      return;
    }

    let activeCount = 0;
    // 💡 現在セッションに保存されている選択中ワールドIDを取得
    const cachedWorldId = sessionStorage.getItem("app_current_world_id");

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const worldId = docSnap.id;

      // isActive が明示的に false の場合は一軍セレクターから除外（アーカイブ隠蔽化）
      if (data.isActive === false) return;

      activeCount++;
      const worldNumber = data.worldNumber;
      const worldName = data.worldName || "";
      const charId = data.characterId || null;

      const iconSrc = getWorldIconSrc(charId);

      const li = document.createElement("li");
      li.className = "c-world-modal__item";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "c-world-modal__choice-btn js-world-choice";
      button.dataset.worldId = worldId;
      button.dataset.worldNumber = worldNumber;

      // 💡 【修正】現在選択中のワールドであれば最初からアクティブクラスを付与して視覚同期
      if (cachedWorldId && String(cachedWorldId) === String(worldId)) {
        button.classList.add("is-active");
      }

      const iconWrap = document.createElement("div");
      iconWrap.className = "c-world-modal__btn-icon";

      const img = document.createElement("img");
      img.src = iconSrc;
      img.alt = "";
      img.className = "c-world-modal__btn-img";
      iconWrap.appendChild(img);

      const infoWrap = document.createElement("div");
      infoWrap.className = "c-world-modal__btn-info";

      const numSpan = document.createElement("span");
      numSpan.className = "c-world-modal__btn-world";
      numSpan.textContent = `W ${worldNumber}`;

      const nameSpan = document.createElement("span");
      nameSpan.className = "c-world-modal__btn-name";
      nameSpan.textContent = worldName;

      infoWrap.appendChild(numSpan);
      infoWrap.appendChild(nameSpan);

      button.appendChild(iconWrap);
      button.appendChild(infoWrap);

      // 🌍 クリックした時のワールド切り替えイベント
      button.addEventListener("click", async () => {
        document
          .querySelectorAll(".js-world-choice")
          .forEach((b) => b.classList.remove("is-active"));
        button.classList.add("is-active");

        sessionStorage.setItem("app_current_world_id", worldId);

        // ワールド切替時にポータルの入力数値をFirestoreから同期ロードする
        await loadPortalDashboardData(userId, worldId);

        const modalSelect = document.getElementById("js-world-modal");
        if (modalSelect) {
          modalSelect.classList.remove("is-open");
          modalSelect.setAttribute("aria-hidden", "true");
          modalSelect.setAttribute("inert", "");
        }

        document.body.classList.remove("is-modal-open");

        const openSelectBtn = document.getElementById("js-world-modal-open");
        if (openSelectBtn) openSelectBtn.focus();
      });

      li.appendChild(button);
      worldListContainer.appendChild(li);
    });

    if (activeCount === 0) {
      worldListContainer.innerHTML =
        '<li class="c-world-modal__item--empty">アクティブなワールドがありません</li>';
    }

    console.log("✅ ワールド一覧のロードと生成が完了しました！");
  } catch (error) {
    console.error("🚨 ワールド一覧のロード中にエラーが発生しました:", error);
  }
}

// 📄 ページ読み込み時のエントリーポイント（ピッカー起動対応版）
document.addEventListener("DOMContentLoaded", async () => {
  // 🔥 最優先で魔女マスタデータをロードしてメモリにキャッシュする
  await fetchCharacterMaster();

  await insertFooter();
  setActiveNavigation();
  await insertWorldSelector();

  injectAndInitCharacterPicker();

  initWorldSelectorEvent();
  initPortalDashboardEvents();

  initPartySystemEvents();
  initPartyDragAndDrop();
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

// 🔮 キャラクターIDからアイコンURLを確実に取得する共通ヘルパー関数
function getWorldIconSrc(characterId) {
  const DEFAULT_ICON_PATH = "assets/images/chara-icon/1.webp"; // 共通の初期値アイコン

  if (
    characterId &&
    Array.isArray(characterMaster) &&
    characterMaster.length > 0
  ) {
    const foundChara = characterMaster.find(
      (c) => String(c.id).trim() === String(characterId).trim(),
    );
    if (foundChara && foundChara.iconUrl) {
      return foundChara.iconUrl;
    }
  }
  return DEFAULT_ICON_PATH; // 未設定、またはマスタにない場合は初期値を返す
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

  // アプリ側で手動保存したカスタム名を取得
  const savedCustomName = sessionStorage.getItem("app_custom_username");

  if (!savedCustomName) {
    if (accountTrigger) accountTrigger.classList.add("is-require-setup");
    if (addWorldBtn) {
      addWorldBtn.classList.add("is-disabled");
      addWorldBtn.setAttribute("title", "先にアカウント名を設定してください");
    }
    return false;
  } else {
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

  // --- モーダル3（アカウント情報編集）の要素 ---
  const modalAccount = document.getElementById("js-account-modal");
  const openAccountBtns = document.querySelectorAll(".js-account-trigger");
  const closeAccountBtn = document.getElementById("js-account-modal-close");
  const overlayAccount = document.getElementById("js-account-modal-overlay");
  const accountNameForm = document.getElementById("js-account-name-form");
  const inputAccountName = document.getElementById("js-input-account-name");
  const fullUidText = document.getElementById("js-account-full-uid");

  // --- モーダル4（アーカイブ管理復活モーダル）の要素 ---
  const modalArchive = document.getElementById("js-archive-modal");
  const openArchiveBtn = document.getElementById("js-btn-open-archive-manager");
  const closeArchiveBtn = document.getElementById("js-archive-modal-close");
  const overlayArchive = document.getElementById("js-archive-modal-overlay");

  // 🔒 初期状態（閉じているとき）は inert を付与して完全に眠らせておく
  if (modalSelect) modalSelect.setAttribute("inert", "");
  if (modalAccount) modalAccount.setAttribute("inert", "");
  if (modalArchive) modalArchive.setAttribute("inert", "");

  // タイミングのズレを防ぐため、一瞬遅れて確実に要素を捕まえて初期化する
  setTimeout(() => {
    const modalAdd = document.getElementById("js-create-modal");
    if (modalAdd) modalAdd.setAttribute("inert", "");
  }, 50);

  // --------------------------------------------------------------------------
  // 💡 汎用閉じクラス（js-modal-close）の共通一括クローズ処理
  // --------------------------------------------------------------------------
  document.addEventListener("click", (e) => {
    if (e.target.closest(".js-modal-close")) {
      document.querySelectorAll(".c-modal, .c-world-modal").forEach((modal) => {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        modal.setAttribute("inert", "");
      });
    }
  });

  // --------------------------------------------------------------------------
  // 🟢 モーダル1：ワールド選択モーダルの開閉
  // --------------------------------------------------------------------------
  if (openSelectBtn && modalSelect) {
    openSelectBtn.addEventListener("click", () => {
      modalSelect.classList.add("is-open");
      modalSelect.removeAttribute("aria-hidden");
      modalSelect.removeAttribute("inert");

      document.body.classList.add("is-modal-open");
    });
  }

  const closeSelectModal = () => {
    if (modalSelect) {
      modalSelect.classList.remove("is-open");
      modalSelect.setAttribute("aria-hidden", "true");
      modalSelect.setAttribute("inert", "");

      document.body.classList.remove("is-modal-open");
      if (openSelectBtn) openSelectBtn.focus();
    }
  };
  if (closeSelectBtn)
    closeSelectBtn.addEventListener("click", closeSelectModal);
  if (overlaySelect) overlaySelect.addEventListener("click", closeSelectModal);

  // --------------------------------------------------------------------------
  // ⚙️ モーダル4：アーカイブ管理モーダルの開閉トリガー連携
  // --------------------------------------------------------------------------
  if (openArchiveBtn && modalArchive) {
    openArchiveBtn.addEventListener("click", async () => {
      const user = auth.currentUser;
      if (!user) return;

      // 親である選択モーダルを閉じる
      closeSelectModal();

      // 非アクティブリストを集計ロード
      await loadArchiveWorldList(user.uid);

      modalArchive.classList.add("is-open");
      modalArchive.removeAttribute("aria-hidden");
      modalArchive.removeAttribute("inert");

      document.body.classList.add("is-modal-open");
    });
  }

  const closeArchiveModal = () => {
    if (modalArchive) {
      modalArchive.classList.remove("is-open");
      modalArchive.setAttribute("aria-hidden", "true");
      modalArchive.setAttribute("inert", "");

      document.body.classList.remove("is-modal-open");
    }
  };
  if (closeArchiveBtn)
    closeArchiveBtn.addEventListener("click", closeArchiveModal);
  if (overlayArchive)
    overlayArchive.addEventListener("click", closeArchiveModal);

  // --------------------------------------------------------------------------
  // 🔵 モーダル2：ワールド追加モーダルの開閉（★アカウント未登録時のロック付き）
  // --------------------------------------------------------------------------
  document.addEventListener("click", (e) => {
    const targetAddTrigger = e.target.closest(".js-create-world");
    if (!targetAddTrigger) return;

    const savedCustomName = sessionStorage.getItem("app_custom_username");
    if (!savedCustomName) {
      alert(
        "順番に登録しましょう！まずは「アカウント設定」からカスタムアカウント名を保存してください。",
      );

      if (modalAccount) {
        modalAccount.classList.add("is-open");
        modalAccount.removeAttribute("aria-hidden");
        modalAccount.removeAttribute("inert");
        if (inputAccountName) {
          inputAccountName.value = "";
          inputAccountName.focus();
        }
      }
      return;
    }

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
        const savedCustomName = sessionStorage.getItem("app_custom_username");
        if (inputAccountName) {
          inputAccountName.value = savedCustomName ? savedCustomName : "";
        }
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
      const activeInput = modalAccount.querySelector(
        "input:focus, button:focus",
      );
      if (activeInput) {
        activeInput.blur();
      }
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
  // 📝 フォーム送信：①ワールド新規追加（Firestoreデータ保存 ＆ 即時ロード連動）
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

        // 1. Firestoreへデータ保存（新しく追加されたドキュメントの参照を newWorldRef として受け取る）
        const newWorldRef = await addDoc(
          collection(db, "users", user.uid, "worlds"),
          {
            worldNumber: Number(inputNumber),
            worldName: inputName || null,
            isActive: true,
            createdAt: serverTimestamp(),
          },
        );

        console.log(
          `✅ 正常に書き込みが完了しました！ドキュメントID: ${newWorldRef.id}`,
        );

        // 💡 【ここが重要！】新規登録したワールドを「現在選択中のワールド」としてセッションに登録する
        sessionStorage.setItem("app_current_world_id", newWorldRef.id);

        // 1. 先にフォームをリセットし、送信ボタンのフォーカスを安全に外す
        createWorldForm.reset();

        const statusSelect = document.getElementById(
          "js-portal-setting-status",
        );
        if (statusSelect) statusSelect.value = "active";

        const activeSubmitBtn = document.getElementById(
          "js-create-world-submit",
        );
        if (activeSubmitBtn) {
          activeSubmitBtn.blur();
        }

        // 2. 警告対策：ダッシュボードデータを読み込む前に、確実にモーダルを完全に閉じて眠らせる
        const modalAdd = document.getElementById("js-create-modal");
        if (modalAdd) {
          modalAdd.classList.remove("is-open");
          modalAdd.setAttribute("aria-hidden", "true");
          modalAdd.setAttribute("inert", "");
        }

        // 3. モーダル内のワールド一覧リストを最新状態に再読み込み
        await loadWorldList(user.uid);

        // 4. 新規登録したワールドの情報をダッシュボードに反映・同期する
        // (この中でフォーカスが移動しても、すでにモーダルは閉じているので警告は出ません)
        await loadPortalDashboardData(user.uid, newWorldRef.id);

        // ワールド選択モーダルも一緒にクローズ
        const modalSelect = document.getElementById("js-world-modal");
        if (modalSelect) {
          modalSelect.classList.remove("is-open");
          modalSelect.setAttribute("aria-hidden", "true");
          modalSelect.setAttribute("inert", "");
        }
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

        const activeSubmitBtn = accountNameForm.querySelector(
          "button[type='submit']",
        );
        if (activeSubmitBtn) {
          activeSubmitBtn.blur();
        }

        const modalHeaderName = document.getElementById("js-modal-user-text");
        if (modalHeaderName) {
          modalHeaderName.textContent = newName;
        }

        sessionStorage.setItem("app_custom_username", newName);

        await saveAccountData(user.uid, {
          accountId: user.uid,
          accountName: newName,
          updatedAt: serverTimestamp(),
        });

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
// 🔄 【デバッグログ付き対策版】ヘッダーのワールドセレクター表示を同期する関数
// ==========================================================================
function syncHeaderWorldSelector(worldNumber, worldName, characterId = null) {
  const currentWorldNumber = document.getElementById("js-current-world-number");
  const currentWorldNameElement = document.getElementById(
    "js-current-world-name",
  );
  const iconWrap = document.querySelector(".c-world-selector__icon-wrap");

  if (currentWorldNumber) {
    currentWorldNumber.textContent = worldNumber
      ? `W ${worldNumber}`
      : "未登録";
  }
  if (currentWorldNameElement) {
    currentWorldNameElement.textContent = worldName || "";
  }

  if (iconWrap) {
    // 💡【修正】共通関数を使ってアイコンURLを取得（未設定なら自動的に1.webpになる）
    const iconSrc = getWorldIconSrc(characterId);

    iconWrap.innerHTML = "";

    // 💡【修正】フォントアイコンは廃止し、常に詳細設定と同じimgタグの見た目に統一
    const img = document.createElement("img");
    img.className = "c-world-selector__img";
    img.src = iconSrc;
    img.alt = worldName || "ワールドアイコン";
    img.style.cssText =
      "width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;";
    iconWrap.appendChild(img);
  }
}

// ==========================================================================
// 📥 【修正確定版】ポータルデータのロード・UIへのマッピング復元処理
// ==========================================================================
async function loadPortalDashboardData(userId, worldId) {
  try {
    console.log(`⏳ ワールド [${worldId}] のデータを読み込み中...`);
    const worldDocRef = doc(db, "users", userId, "worlds", worldId);
    const docSnap = await getDoc(worldDocRef);
    if (!docSnap.exists()) return;

    // --- main.js の修正対象箇所 (修正後) ---
    const data = docSnap.data();

    // クエスト章・ステージのバラバラ分解配置連動
    const questStr = data.questProgress || ""; // 例: "13-28"
    let chapter = "";
    let stage = "";
    if (questStr.includes("-")) {
      const parts = questStr.split("-");
      chapter = parts[0];
      stage = parts[1];
    }

    // 💡 安全ガードを追加：要素が存在する場合のみ値をセットする
    const inputChapter = document.getElementById("js-portal-quest-chapter");
    const inputStage = document.getElementById("js-portal-quest-stage");
    if (inputChapter) inputChapter.value = chapter;
    if (inputStage) inputStage.value = stage;

    // 各種塔・数値インプットの同期
    const elMuguu = document.getElementById("js-portal-muguu");
    const elBlue = document.getElementById("js-portal-tower-blue");
    const elRed = document.getElementById("js-portal-tower-red");
    const elGreen = document.getElementById("js-portal-tower-green");
    const elYellow = document.getElementById("js-portal-tower-yellow");
    const elMemo = document.getElementById("js-portal-world-memo");

    if (elMuguu) elMuguu.value = data.towerMuguu || "";
    if (elBlue) elBlue.value = data.towerBlue || "";
    if (elRed) elRed.value = data.towerRed || "";
    if (elGreen) elGreen.value = data.towerGreen || "";
    if (elYellow) elYellow.value = data.towerYellow || "";
    if (elMemo) elMemo.value = data.worldMemo || "";

    // 詳細設定アコーディオンパーツの同期
    const elSettingName = document.getElementById("js-portal-setting-name");
    const elSettingDate = document.getElementById(
      "js-portal-setting-start-date",
    );
    const elSettingLink = document.getElementById("js-portal-setting-link");

    if (elSettingName) elSettingName.value = data.worldName || "";
    if (elSettingDate) elSettingDate.value = data.startDate || "";
    if (elSettingLink) elSettingLink.value = data.externalLink || "";

    // 💡 HTML側の id="js-portal-setting-character-id" と完全に一致させ、値を復元
    const charIdField = document.getElementById(
      "js-portal-setting-character-id",
    );
    if (charIdField) {
      charIdField.value = data.characterId || "";
    }

    // 💡 ロードしたキャラクターIDに基づいて、詳細設定内のアイコン画像を最新に切り替える
    const previewImg = document.getElementById(
      "js-portal-setting-icon-preview",
    );
    if (previewImg) {
      // 💡【修正】共通関数を使って、未設定（空）の場合も自動で初期値になるよう同期
      previewImg.src = getWorldIconSrc(data.characterId);
    }

    const statusSelect = document.getElementById("js-portal-setting-status");

    if (statusSelect) {
      // 過去データがtrue（または未設定）なら active、明示的に false の場合のみ archived を選択
      statusSelect.value = data.isActive !== false ? "active" : "archived";
    }

    // 🔗 差し替え後：複数対応のパーティ配列データを復元（古いデータ構造の互換ガード付き）
    if (data.parties && Array.isArray(data.parties)) {
      currentPartiesState = data.parties;
    } else if (data.partyMembers) {
      // 古い1パーティ仕様データがある場合の自動変換処理
      currentPartiesState = [
        {
          partyName: "メインパーティー",
          members: data.partyMembers,
        },
      ];
    } else {
      currentPartiesState = [];
    }

    // パーティリスト一覧UIをレンダリング
    renderPartyListUI();

    // 最終更新日時
    const updatedEl = document.getElementById("js-portal-world-updated");
    if (updatedEl && data.updatedAt) {
      const date = data.updatedAt.toDate();
      updatedEl.textContent = `最終更新: ${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
    }

    // 外部リンクボタンの即時制御
    const linkBtn = document.getElementById("js-portal-external-link");
    if (linkBtn) {
      if (data.externalLink) {
        linkBtn.href = data.externalLink;

        linkBtn.classList.remove("is-hidden");

        const faviconImg = linkBtn.querySelector("img");
        if (faviconImg) {
          faviconImg.src = FAVICON_API_BASE + data.externalLink;
        }
      } else {
        // 💡 直接スタイルを書き換えず、設計図の共通非表示クラス「is-hidden」を付与
        linkBtn.classList.add("is-hidden");
      }
    }

    // 🟢すべてのマッピングが終わったこのタイミングで、左上ヘッダーセレクターへ値を同期する！
    syncHeaderWorldSelector(data.worldNumber, data.worldName, data.characterId);

    // ✨ワールド切り替え時に、キャラクター一覧側のグリッドも最新データで再描画させる

    if (typeof window.initUserCharacterTab === "function") {
      console.log(
        "🔄 [World Switch Bridge] ワールド変更を検知したため、キャラクター一覧を再展開します。",
      );
      window.initUserCharacterTab(
        characterMaster,
        db,
        auth,
        userId,
        worldId,
        collection,
        getDocs,
        doc,
        setDoc,
        serverTimestamp,
      );
    }

    console.log("✅ ダッシュボードデータのUIマッピングが完了しました");
  } catch (error) {
    console.error("🚨 ダッシュボードロードエラー:", error);
  }
}

// ==========================================================================
// 📥 アーカイブされた非アクティブワールドの一覧集計・復帰処理
// ==========================================================================
async function loadArchiveWorldList(userId) {
  const archiveContainer = document.getElementById("js-archive-world-list");
  if (!archiveContainer) return;

  try {
    const worldsRef = collection(db, "users", userId, "worlds");
    const q = query(worldsRef, where("isActive", "==", false));
    const querySnapshot = await getDocs(q);

    archiveContainer.innerHTML = "";

    if (querySnapshot.empty) {
      archiveContainer.innerHTML =
        '<li style="text-align:center; padding:10px; color:#aaa; font-size:12px;">アーカイブされたワールドはありません</li>';
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const worldId = docSnap.id;
      const worldNumber = data.worldNumber;
      const worldName = data.worldName || "名称未設定";

      const li = document.createElement("li");
      li.style.cssText =
        "display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:8px 12px; border-radius:6px; border:1px solid #e2e8f0;";

      li.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="background:#94a3b8; color:#fff; font-size:10px; font-weight:bold; padding:2px 5px; border-radius:4px;">W ${worldNumber}</span>
          <span style="font-size:13px; color:#1e293b; font-weight:bold;">${worldName}</span>
        </div>
        <button type="button" class="js-portal-restore-btn" data-world-id="${worldId}" style="background:#10b981; color:#fff; font-size:11px; padding:4px 10px; border-radius:4px; font-weight:bold; cursor:pointer;">復帰</button>
      `;

      // 復帰ボタンのイベント登録
      li.querySelector(".js-portal-restore-btn").addEventListener(
        "click",
        async (e) => {
          if (confirm(`ワールド ${worldNumber} をアクティブに戻しますか？`)) {
            const wId = e.target.dataset.worldId;
            const worldDocRef = doc(db, "users", userId, "worlds", wId);
            await setDoc(
              worldDocRef,
              { isActive: true, updatedAt: serverTimestamp() },
              { merge: true },
            );

            alert("ワールドをアクティブリストに戻しました！");
            await loadWorldList(userId); // 一軍リスト再生成
            await loadArchiveWorldList(userId); // アーカイブ内再生成
          }
        },
      );

      archiveContainer.appendChild(li);
    });
  } catch (error) {
    console.error("🚨 アーカイブロードエラー:", error);
  }
}

// ==========================================================================
// 📥 【修正・アニメーション追加版】ダッシュボード側のデータ保存 ＆ アコーディオン
// ==========================================================================
function initPortalDashboardEvents() {
  // --------------------------------------------------------------------------
  // ⚙️ 1. 詳細設定アコーディオンのクリーンな開閉処理（更新ボタンとは完全独立）
  // --------------------------------------------------------------------------
  const toggleBtn = document.getElementById("js-portal-settings-toggle");
  const contentPanel = document.getElementById("js-portal-settings-content");

  if (toggleBtn && contentPanel) {
    contentPanel.style.display = "none";
    toggleBtn.addEventListener("click", () => {
      if (contentPanel.style.display === "none") {
        contentPanel.style.display = "block";
        toggleBtn.innerHTML =
          '<i class="fa-solid fa-gear"></i> ワールドの詳細設定を隠す';
      } else {
        contentPanel.style.display = "none";
        toggleBtn.innerHTML =
          '<i class="fa-solid fa-gear"></i> ワールドの詳細設定を編集';
      }
    });
  }

  // --------------------------------------------------------------------------
  // 💾 2. 「更新する」ボタンのFirestore連動コミット ＆ アニメーション処理
  // --------------------------------------------------------------------------
  const updateBtn = document.getElementById("js-portal-btn-update");
  if (updateBtn) {
    updateBtn.addEventListener("click", async () => {
      const user = auth.currentUser;
      const currentWorldId = sessionStorage.getItem("app_current_world_id");

      if (!user || !currentWorldId) {
        alert("ワールドが選択されていないか、セッションが切れています。");
        return;
      }

      // ① メイン画面（ダッシュボード）側の入力値回収
      const chapter = document
        .getElementById("js-portal-quest-chapter")
        .value.trim();
      const stage = document
        .getElementById("js-portal-quest-stage")
        .value.trim();
      const questProgressStr = chapter && stage ? `${chapter}-${stage}` : "";

      const towerMuguu = document
        .getElementById("js-portal-muguu")
        .value.trim();
      const towerBlue = document
        .getElementById("js-portal-tower-blue")
        .value.trim();
      const towerRed = document
        .getElementById("js-portal-tower-red")
        .value.trim();
      const towerGreen = document
        .getElementById("js-portal-tower-green")
        .value.trim();
      const towerYellow = document
        .getElementById("js-portal-tower-yellow")
        .value.trim();
      const worldMemo = document
        .getElementById("js-portal-world-memo")
        .value.trim();

      // ② アコーディオン内（詳細設定）の入力値回収
      const worldName = document
        .getElementById("js-portal-setting-name")
        .value.trim();
      const startDate = document.getElementById(
        "js-portal-setting-start-date",
      ).value;
      const externalLink = document
        .getElementById("js-portal-setting-link")
        .value.trim();
      const characterId = document
        .getElementById("js-portal-setting-character-id")
        .value.trim();
      const statusValue = document.getElementById(
        "js-portal-setting-status",
      )?.value;
      const isActive = statusValue === "active";

      try {
        // ⏳ ローディング状態へ移行
        updateBtn.disabled = true;
        updateBtn.innerHTML =
          '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';

        const worldDocRef = doc(
          db,
          "users",
          user.uid,
          "worlds",
          currentWorldId,
        );

        // Firestoreへマージ保存
        await setDoc(
          worldDocRef,
          {
            questProgress: questProgressStr,
            towerMuguu: towerMuguu ? Number(towerMuguu) : null,
            towerBlue: towerBlue ? Number(towerBlue) : null,
            towerRed: towerRed ? Number(towerRed) : null,
            towerGreen: towerGreen ? Number(towerGreen) : null,
            towerYellow: towerYellow ? Number(towerYellow) : null,
            worldMemo: worldMemo || null,
            worldName: worldName || "名称未設定",
            startDate: startDate || null,
            externalLink: externalLink || null,
            characterId: characterId || null,
            parties: currentPartiesState, // キャッシュされているパーティ配列
            isActive: isActive,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        // 💡 リストや表示の再同期
        await loadWorldList(user.uid);

        // 💡 もし詳細設定で非アクティブ化（アーカイブ化）された場合のUI制御
        if (!isActive) {
          sessionStorage.removeItem("app_current_world_id");
          document
            .querySelectorAll(".js-world-choice")
            .forEach((b) => b.classList.remove("is-active"));

          const activeCheckbox = document.getElementById(
            "js-portal-setting-active",
          );
          if (activeCheckbox) activeCheckbox.checked = false;

          syncHeaderWorldSelector(null, "");
          alert(
            "ワールドをアーカイブ化しました。ワールド選択から新しいワールドを選ぶか追加してください。",
          );
          window.location.reload();
          return; // アーカイブ時はリロードが入るためここで処理を抜ける
        }

        // 通常の更新成功時：最新データを再描画
        await loadPortalDashboardData(user.uid, currentWorldId);

        // ✨【アニメーション演出】成功フラッシュクラスを付与し、文言を切り替える
        updateBtn.classList.add("is-success-flash");
        updateBtn.innerHTML =
          '<i class="fa-solid fa-circle-check"></i> 更新完了！';

        // アラートの表示タイミングを少しずらすことで、ボタンの緑フラッシュがユーザーの目に入るように調整
        setTimeout(() => {
          alert("ワールド情報をクラウドへ正常に保存しました！");
        }, 100);
      } catch (error) {
        console.error("🚨 保存エラー:", error);
        alert("数値の保存に失敗しました。");
      } finally {
        // ⏳ ロックを解除して、一定時間後にボタンの見た目を「更新する」に戻す処理
        updateBtn.disabled = false;

        // すでにアーカイブ化されてリロードが走っている場合はこの処理をスキップさせるガード
        if (isActive) {
          setTimeout(() => {
            updateBtn.classList.remove("is-success-flash");
            updateBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> 更新する';
          }, 1500); // 1.5秒間フラッシュと完了文字を維持
        }
      }
    });
  }
}

// ==========================================================================
// 🚪 ③ GOOGLE LOGOUT & SECURITY GATE (ログアウト・ログイン監視・防犯ロック)
// ==========================================================================

// 💡 1. ログアウトボタン of クリック処理
document.addEventListener("click", async (e) => {
  if (e.target.closest("#js-btn-logout")) {
    if (confirm("ログアウトしますか？")) {
      try {
        console.log("⏳ Googleからサインアウト中...");
        // ログアウト時はセッションストレージも綺麗にクリアする
        sessionStorage.removeItem("app_custom_username");
        sessionStorage.removeItem("app_current_world_id");
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

    const modalHeaderName = document.getElementById("js-modal-user-text");
    const modalUidText = document.getElementById("js-modal-uid-text");

    if (modalUidText) {
      modalUidText.textContent = `ID: ${user.uid.substring(0, 8)}...`;
    }

    try {
      console.log("⏳ Firestoreからアカウント情報を自動ロード中...");
      const accountData = await loadAccountData(user.uid);

      if (accountData && accountData.accountName) {
        const savedCustomName = accountData.accountName;
        sessionStorage.setItem("app_custom_username", savedCustomName);
        if (modalHeaderName) modalHeaderName.textContent = savedCustomName;
      } else {
        sessionStorage.removeItem("app_custom_username");
        if (modalHeaderName) modalHeaderName.textContent = "未設定";
      }

      // 登録されたワールド一覧をロードしてモーダルにセットする
      await loadWorldList(user.uid);

      // 💡 セッションに「選択中ワールド」が残っていれば自動でデータをダッシュボードに復元ロードする
      const activeWorldId = sessionStorage.getItem("app_current_world_id");
      if (activeWorldId) {
        await loadPortalDashboardData(user.uid, activeWorldId);
      }

      // 🔥Firestoreの全ロードが完了したこの瞬間に、キャラクタータブの初期化を直接叩く！
      if (typeof window.initUserCharacterTab === "function") {
        console.log(
          "🚀 [Main Bridge] インフラの準備が整ったため、キャラ一覧を即時展開します。",
        );
        window.initUserCharacterTab(
          characterMaster,
          db,
          auth,
          user.uid,
          activeWorldId,
          collection,
          getDocs,
          doc,
          setDoc,
          serverTimestamp,
        );
      }
    } catch (error) {
      console.error("🚨 アカウント情報の自動ロードに失敗しました:", error);
    }

    checkAccountRegistrationStatus();
  } else {
    console.log(
      "🔒 未ログイン状態を検知しました。認証ページへ強制移動します。",
    );
    window.location.href = "login.html";
  }
});

// ==========================================================================
// 🔮 【本番直結型】キャラクターピッカー完全自動生成 ＆ 動的ターゲット連動
// ==========================================================================

/**
 * 💡 1. 外部ファイル不要！JS側でキャラクターピッカーのHTMLを自動生成して画面に挿入する
 */
function injectAndInitCharacterPicker() {
  const container = document.getElementById("js-character-picker-container");
  if (!container) return;

  // 📝 管理画面の属性フィルター付き構造を1枚のテンプレート文字列として定義
  container.innerHTML = `
    <div id="js-character-modal" class="c-modal c-world-modal c-character-picker" aria-hidden="true" inert>
        <div class="c-modal__overlay js-character-modal-close"></div>
        <div class="c-world-modal__container c-modal__container c-character-picker__container">
            <header class="c-world-modal__header">
                <div class="c-account-modal__title-wrap">
                    <i class="fa-solid fa-user-gear"></i>
                    <span class="c-account-modal__title">キャラクター選択</span>
                </div>
                <button type="button" class="c-world-modal__close-btn js-character-modal-close">&times;</button>
            </header>

            <div class="c-world-modal__content">
                <!-- 🏷️ 属性の絞り込みフィルターエリア（管理画面から継承） -->
                <div class="c-world-modal__filter-flex">
                    <button type="button" class="c-world-modal__filter-btn is-active js-attr-filter" data-attr="all"><img class="c-world-modal__filter-img" src="assets/images/filter-icon/icon-all.png" alt="ALL"></button>
                    <button type="button" class="c-world-modal__filter-btn js-attr-filter" data-attr="藍"><img class="c-world-modal__filter-img" src="assets/images/filter-icon/icon-attr-blue.png" alt="藍"></button>
                    <button type="button" class="c-world-modal__filter-btn js-attr-filter" data-attr="紅"><img class="c-world-modal__filter-img" src="assets/images/filter-icon/icon-attr-red.png" alt="紅"></button>
                    <button type="button" class="c-world-modal__filter-btn js-attr-filter" data-attr="翠"><img class="c-world-modal__filter-img" src="assets/images/filter-icon/icon-attr-green.png" alt="翠"></button>
                    <button type="button" class="c-world-modal__filter-btn js-attr-filter" data-attr="黄"><img class="c-world-modal__filter-img" src="assets/images/filter-icon/icon-attr-yellow.png" alt="黄"></button>
                    <button type="button" class="c-world-modal__filter-btn js-attr-filter" data-attr="天"><img class="c-world-modal__filter-img" src="assets/images/filter-icon/icon-attr-holy.png" alt="天"></button>
                    <button type="button" class="c-world-modal__filter-btn js-attr-filter" data-attr="冥"><img class="c-world-modal__filter-img" src="assets/images/filter-icon/icon-attr-dark.png" alt="冥"></button>
                </div>
                
                <!-- 👥 キャラクターアイコンが並ぶグリッド領域 -->
                <div id="js-character-select-list" class="c-world-modal__grid c-character-picker-grid"></div>
            </div>
        </div>
    </div>
  `;

  // HTML生成が完了したので、即座に中身のイベント制御をバインドする
  bindCharacterPickerEvents();
}

// ==========================================================================
// 🔮 【完全部品共通化】キャラクターピッカーHTML非同期ロード ＆ 動的ターゲット連動
// ==========================================================================
function bindCharacterPickerEvents() {
  const modalChara = document.getElementById("js-character-modal");
  const closeCharaBtns = document.querySelectorAll(".js-character-modal-close");
  const gridContainer = document.getElementById("js-character-select-list");
  const filterBtns = document.querySelectorAll(".js-attr-filter");

  if (!modalChara || !gridContainer) return;

  // 格納先のターゲットと、ピッカーを起動した親ボタンを記憶するスコープ変数
  let activeInputTargetId = "";
  let activePreviewTargetId = "";
  let activeTriggerBtn = null; // 💡 今回ピッカーを開いたボタンの要素を一時保存する変数

  // 🔓 アプリ内すべての「js-open-character-picker」クラスを持つ要素のクリックを検知
  document.addEventListener("click", (e) => {
    const triggerBtn = e.target.closest(".js-open-character-picker");
    if (!triggerBtn) return;

    // 💡 警告対策：現在アクティブになった親起動ボタンを記憶しておく
    activeTriggerBtn = triggerBtn;

    // トリガーボタンに書き込まれている「ターゲットID」をその場で記憶！
    activeInputTargetId = triggerBtn.dataset.targetInput;
    activePreviewTargetId = triggerBtn.dataset.targetPreview;

    // 属性フィルターの選択表示を「ALL」にリセット
    filterBtns.forEach((btn) => btn.classList.remove("is-active"));
    const allBtn = Array.from(filterBtns).find(
      (btn) => btn.dataset.attr === "all",
    );
    if (allBtn) allBtn.classList.add("is-active");

    // リストの初期描画
    renderFilteredCharacters("all");

    modalChara.classList.add("is-open");
    modalChara.removeAttribute("aria-hidden");
    modalChara.removeAttribute("inert");
  });

  // モーダルをクローズする処理
  const closeCharaModal = () => {
    // 💡 【最重要解決策】非表示（inert/aria-hidden）にする前に、フォーカスを元の親ボタンへ安全に戻す！
    if (activeTriggerBtn) {
      activeTriggerBtn.focus();
    }

    modalChara.classList.remove("is-open");
    modalChara.setAttribute("aria-hidden", "true");
    modalChara.setAttribute("inert", "");
  };

  closeCharaBtns.forEach((btn) =>
    btn.addEventListener("click", closeCharaModal),
  );

  // 属性タブによるフィルタリング（ onclick の排除 ）
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderFilteredCharacters(btn.dataset.attr);
    });
  });

  // フィルター条件に基づく魔女カードの動的展開
  function renderFilteredCharacters(attrFilter) {
    gridContainer.innerHTML = "";

    if (!Array.isArray(characterMaster) || characterMaster.length === 0) {
      gridContainer.innerHTML =
        '<li class="c-world-modal__item--empty">データがありません</li>';
      return;
    }

    // 💡 現在選択中のインプットの値（自分自身の枠のキャラクターID）を取得
    const currentSelectedId = activeInputTargetId
      ? document.getElementById(activeInputTargetId)?.value
      : "";

    // 💡 パーティ5人の枠から、すでに選択されているキャラクターIDをすべて集計（重複除外の対象）
    const selectedPartyCharIds = [];
    for (let i = 1; i <= 5; i++) {
      // 💡 探しに行くIDを「js-portal-modal-chara-」に変更します
      const inputEl = document.getElementById(`js-portal-modal-chara-${i}`);
      if (inputEl && inputEl.value) {
        selectedPartyCharIds.push(String(inputEl.value));
      }
    }

    // ==========================================================================
    // 🟢【修正】配列の先頭に「選択解除（空にする）」のアイテムを配置
    // ==========================================================================
    // 💡 ワールドの詳細設定（メインアイコン）から開かれた場合は、✖ボタンを表示しない（スキップする）
    if (activeInputTargetId !== "js-portal-setting-character-id") {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "c-world-modal__card m-remove-chara";
      if (!currentSelectedId) {
        removeButton.classList.add("is-selected");
      }
      removeButton.style.cssText =
        "display:flex; align-items:center; justify-content:center; background:#fee2e2; border:1px dashed #ef4444;";
      removeButton.title = "選択を解除する";

      // 解除ボタンの見た目（バツ印などのテキストやアイコン）
      const removeIcon = document.createElement("span");
      removeIcon.textContent = "✖";
      removeIcon.style.cssText =
        "font-size: 16px; font-weight: bold; color: #ef4444;";
      removeButton.appendChild(removeIcon);

      // 解除ボタンをクリックした時のクリア処理
      removeButton.addEventListener("click", () => {
        if (activeInputTargetId) {
          const targetInput = document.getElementById(activeInputTargetId);
          if (targetInput) {
            targetInput.value = ""; // IDを空にする
            targetInput.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
        if (activePreviewTargetId) {
          const targetPreview = document.getElementById(activePreviewTargetId);
          if (targetPreview) {
            targetPreview.src = "";
            targetPreview.classList.add("is-hidden"); // 画像を隠して、HTML側の「+」を復活させる
          }
        }
        closeCharaModal();
      });
      gridContainer.appendChild(removeButton);
    }

    characterMaster.forEach((chara) => {
      if (attrFilter !== "all" && String(chara.attr).trim() !== attrFilter)
        return;

      const charaIdStr = String(chara.id);

      // 💡 【重複対策】他の枠で選択済みのキャラは除外する（ただし、今自分が選択しているキャラ自身は表示を残す）
      if (
        selectedPartyCharIds.includes(charaIdStr) &&
        charaIdStr !== String(currentSelectedId)
      ) {
        return;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "c-world-modal__card";
      if (charaIdStr === String(currentSelectedId)) {
        button.classList.add("is-selected");
      }

      const img = document.createElement("img");
      img.src = chara.iconUrl || "assets/images/chara-icon/1.webp";
      img.alt = chara.name || "";

      button.appendChild(img);

      // 🌍 アイコン決定・値の書き込みコミット処理
      button.addEventListener("click", () => {
        if (activeInputTargetId) {
          const targetInput = document.getElementById(activeInputTargetId);
          if (targetInput) {
            targetInput.value = chara.id;

            // 💡【重要】値が書き換わったことをブラウザにリアルタイム通知するイベントを発火
            targetInput.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }

        if (activePreviewTargetId) {
          const targetPreview = document.getElementById(activePreviewTargetId);
          if (targetPreview) {
            targetPreview.src =
              chara.iconUrl || "assets/images/chara-icon/1.webp";
            targetPreview.classList.remove("is-hidden");
          }
        }

        closeCharaModal();
      });

      gridContainer.appendChild(button);
    });
  }
}

// ==========================================================================
// 👥 複数パーティ管理データステート・メモリ（新規追加）
// ==========================================================================
let currentPartiesState = []; // 現在選択中ワールドのパーティ配列をキャッシュする
let activeEditingPartyIndex = null; // 現在編集中のパーティインデックス (0〜7)

// 🔓 パーティ管理全体のイベント初期化
function initPartySystemEvents() {
  const modalParty = document.getElementById("js-party-edit-modal");
  const closePartyBtns = document.querySelectorAll(
    ".js-party-edit-modal-close",
  );
  const addPartyBtn = document.getElementById("js-portal-btn-add-party");
  const savePartyBtn = document.getElementById("js-portal-btn-save-party");
  const deletePartyBtn = document.getElementById("js-portal-btn-delete-party");

  if (!modalParty) return;

  // モーダルクローズ
  const closePartyModal = () => {
    // 💡 エラー対策：非表示にする前に、現在モーダル内のボタンにあたっているフォーカスを強制解除して外へ逃がす
    const activeEl = document.activeElement;
    if (activeEl && modalParty.contains(activeEl)) {
      activeEl.blur();
    }

    // パーティリスト一覧のコンテナにフォーカスを安全に移動
    const partyListContainer = document.getElementById("js-portal-party-list");
    if (partyListContainer) {
      partyListContainer.focus();
    }

    modalParty.classList.remove("is-open");
    modalParty.setAttribute("aria-hidden", "true");
    modalParty.setAttribute("inert", "");

    document.body.classList.remove("is-modal-open");

    activeEditingPartyIndex = null;
  };
  closePartyBtns.forEach((btn) =>
    btn.addEventListener("click", closePartyModal),
  );
  // ➕ 新規パーティ追加処理
  if (addPartyBtn) {
    addPartyBtn.addEventListener("click", () => {
      if (currentPartiesState.length >= 8) {
        alert("パーティは最大8つまでしか作成できません。");
        return;
      }

      const newParty = {
        partyName: `新規パーティー ${currentPartiesState.length + 1}`,
        members: [null, null, null, null, null],
      };

      currentPartiesState.push(newParty);
      renderPartyListUI();
      openPartyEditModal(currentPartiesState.length - 1);
    });
  }

  // 💾 モーダル内「反映する」ボタン押下時
  if (savePartyBtn) {
    savePartyBtn.addEventListener("click", () => {
      if (activeEditingPartyIndex === null) return;

      const inputName = document
        .getElementById("js-input-party-name")
        .value.trim();
      currentPartiesState[activeEditingPartyIndex].partyName =
        inputName || "名称未設定パーティ";

      for (let i = 1; i <= 5; i++) {
        const val =
          document.getElementById(`js-portal-modal-chara-${i}`).value || null;
        currentPartiesState[activeEditingPartyIndex].members[i - 1] = val;
      }

      renderPartyListUI();

      // 💡 ボタンのフォーカスを先に外してからクローズ処理へ
      savePartyBtn.blur();
      closePartyModal();
    });
  }

  // 🗑️ フォーカスを安全なコンテナへ逃がしてからモーダルを閉じる
  if (deletePartyBtn) {
    deletePartyBtn.addEventListener("click", () => {
      if (activeEditingPartyIndex === null) return;

      // 1. 配列（メモリ上）からサクッと削除
      currentPartiesState.splice(activeEditingPartyIndex, 1);

      // 2. 裏の一覧UIを即座に再描画
      renderPartyListUI();

      // 非表示にする前に、ボタンのフォーカスを強制的に外して親コンテナへ逃がす
      deletePartyBtn.blur();
      const partyListContainer = document.getElementById(
        "js-portal-party-list",
      );
      if (partyListContainer) {
        partyListContainer.focus();
      }

      closePartyModal();
    });
  }
}

// 👥 メモリデータを元に、右側のパーティカード一覧を生成
function renderPartyListUI() {
  const container = document.getElementById("js-portal-party-list");
  if (!container) return;

  container.innerHTML = "";

  if (currentPartiesState.length === 0) {
    container.innerHTML =
      '<p class="c-world-form__help" style="text-align:center; padding:12px;">登録されたパーティがありません。</p>';
    return;
  }

  const master = window.characterMaster || [];

  currentPartiesState.forEach((party, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "p-portal-party-card";

    // ── ① パーティ名 ＆ 並び替えボタンを包むヘッダーエリア ──
    const headerDiv = document.createElement("div");
    headerDiv.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 8px;";

    const nameSpan = document.createElement("span");
    nameSpan.className = "p-portal-party-card__name";
    nameSpan.textContent = party.partyName;
    headerDiv.appendChild(nameSpan);

    // ↕️ 上下並び替えボタンのコンテナ
    const orderBtnsDiv = document.createElement("div");
    orderBtnsDiv.style.cssText = "display: flex; gap: 4px;";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "js-party-order-up p-party-order-btn";
    upBtn.textContent = "▲";
    upBtn.disabled = index === 0;
    upBtn.style.cssText = "font-size: 10px; padding: 2px 6px; cursor: pointer;";
    upBtn.addEventListener("click", (e) => movePartyOrder(index, "up", e));

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "js-party-order-down p-party-order-btn";
    downBtn.textContent = "▼";
    downBtn.disabled = index === currentPartiesState.length - 1;
    downBtn.style.cssText =
      "font-size: 10px; padding: 2px 6px; cursor: pointer;";
    downBtn.addEventListener("click", (e) => movePartyOrder(index, "down", e));

    orderBtnsDiv.appendChild(upBtn);
    orderBtnsDiv.appendChild(downBtn);
    headerDiv.appendChild(orderBtnsDiv);

    card.appendChild(headerDiv);

    // ── ② キャラクターのスロット部分 ──
    const slotsDiv = document.createElement("div");
    slotsDiv.className = "p-portal-party__slots";

    party.members.forEach((charaId, slotIdx) => {
      const slotIcon = document.createElement("div");
      slotIcon.className = "p-portal-party__slot";

      if (charaId && Array.isArray(master) && master.length > 0) {
        const found = master.find(
          (c) => String(c.id).trim() === String(charaId).trim(),
        );
        if (found) {
          slotIcon.classList.add("has-character");
          const img = document.createElement("img");
          img.src = found.iconUrl || "assets/images/chara-icon/1.webp";
          img.alt = found.name || "";
          slotIcon.appendChild(img);
        } else {
          slotIcon.innerHTML = "<span>+</span>";
        }
      } else {
        slotIcon.innerHTML = "<span>+</span>";
      }
      slotsDiv.appendChild(slotIcon);
    });

    card.appendChild(slotsDiv);

    card.addEventListener("click", () => {
      openPartyEditModal(index);
    });

    container.appendChild(card);
  });
}

// 🔓 編集モーダルを開き、データをインプットへ流し込む
function openPartyEditModal(index) {
  activeEditingPartyIndex = index;
  const party = currentPartiesState[index];

  document.getElementById("js-input-party-name").value = party.partyName;

  party.members.forEach((charaId, i) => {
    const idx = i + 1;
    const inputField = document.getElementById(`js-portal-modal-chara-${idx}`);
    const imgField = document.getElementById(`js-portal-modal-img-${idx}`);

    if (inputField) inputField.value = charaId || "";
    if (imgField) {
      if (charaId && Array.isArray(characterMaster)) {
        const found = characterMaster.find(
          (c) => String(c.id) === String(charaId),
        );
        if (found) {
          imgField.src = found.iconUrl;
          imgField.classList.remove("is-hidden");
          return;
        }
      }
      imgField.src = "";
      imgField.classList.add("is-hidden");
    }
  });

  const modalParty = document.getElementById("js-party-edit-modal");
  if (modalParty) {
    modalParty.classList.add("is-open");
    modalParty.removeAttribute("aria-hidden");
    modalParty.removeAttribute("inert");

    document.body.classList.add("is-modal-open");
  }
}

// ⚔️ モーダル編集枠専用のドラッグ＆ドロップ入れ替え（スワップ）機能
// 🟢 バグを修正した正しいイベント処理
function initPartyDragAndDrop() {
  const slots = document.querySelectorAll(
    ".js-party-modal-slots .p-portal-party__slot",
  );
  let draggedSlot = null;

  slots.forEach((slot) => {
    slot.setAttribute("draggable", "true");

    // ① ドラッグ開始：動かしている本人に付与
    slot.addEventListener("dragstart", (e) => {
      draggedSlot = slot;
      slot.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", slot.dataset.targetInput);
    });

    // ② ドラッグ終了：成否に関わらず、動かしていた本人のクラスを絶対に外す
    slot.addEventListener("dragend", () => {
      slot.classList.remove("is-dragging");
      slots.forEach((s) => s.classList.remove("is-drag-over")); // 全枠の重なりクラスも掃除
      draggedSlot = null;
    });

    // ③ 他の枠の上に重なったとき：重なられた側の枠に「is-drag-over」を付与
    slot.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (draggedSlot && slot !== draggedSlot) {
        slot.classList.add("is-drag-over"); // 👈 is-drag-over に修正
      }
    });

    // ④ 重なりから外れたとき：重なられていた枠から「is-drag-over」を外す
    slot.addEventListener("dragleave", () => {
      slot.classList.remove("is-drag-over");
    });

    // ⑤ ドロップされたとき
    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      slot.classList.remove("is-drag-over");
      if (!draggedSlot || draggedSlot === slot) return;

      const srcInputId = draggedSlot.dataset.targetInput;
      const srcImgId = draggedSlot.dataset.targetPreview;
      const destInputId = slot.dataset.targetInput;
      const destImgId = slot.dataset.targetPreview;

      const srcInput = document.getElementById(srcInputId);
      const srcImg = document.getElementById(srcImgId);
      const destInput = document.getElementById(destInputId);
      const destImg = document.getElementById(destImgId);

      if (!srcInput || !destInput) return;

      const tempValue = srcInput.value;
      srcInput.value = destInput.value;
      destInput.value = tempValue;

      const tempImgSrc = srcImg.src;
      const tempImgHidden = srcImg.classList.contains("is-hidden");

      if (destImg.classList.contains("is-hidden")) {
        srcImg.classList.add("is-hidden");
      } else {
        srcImg.classList.remove("is-hidden");
      }
      srcImg.src = destImg.src;

      if (tempImgHidden) {
        destImg.classList.add("is-hidden");
      } else {
        destImg.classList.remove("is-hidden");
      }
      destImg.src = tempImgSrc;

      srcInput.dispatchEvent(new Event("change", { bubbles: true }));
      destInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

// 🔄 パーティの並び順を上下させる関数
function movePartyOrder(index, direction, event) {
  if (event) event.stopPropagation();
  const targetIndex = direction === "up" ? index - 1 : index + 1;

  // 配列の範囲外にいかないようにガード
  if (targetIndex < 0 || targetIndex >= currentPartiesState.length) return;

  // 配列内で要素を入れ替える（スワップ）
  const temp = currentPartiesState[index];
  currentPartiesState[index] = currentPartiesState[targetIndex];
  currentPartiesState[targetIndex] = temp;

  // 画面を再描画して新しい並び順を反映
  renderPartyListUI();
}
