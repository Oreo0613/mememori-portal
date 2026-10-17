// 🔮 魔女マスタデータのキャッシュ用変数（配列に変更）
let characterMaster = [];

// 📜 魔女マスタデータ（JSON）の非同期読み込み処理
async function fetchCharacterMaster() {
  try {
    const response = await fetch("assets/json/character-master.json");
    if (!response.ok)
      throw new Error("キャラクターマスタの読み込みに失敗しました");
    characterMaster = await response.json();
    console.log(
      "✅ キャラクターマスタデータのロードが完了しました",
      characterMaster,
    );
  } catch (error) {
    console.error("🚨 キャラクターマスタデータのロードエラー:", error);
  }
}

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

      let iconSrc = "assets/images/chara-icon/1.webp";
      if (charId && Array.isArray(characterMaster)) {
        const foundChara = characterMaster.find(
          (c) => String(c.id) === String(charId),
        );
        if (foundChara && foundChara.iconUrl) {
          iconSrc = foundChara.iconUrl;
        }
      }

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

        // 💡 【修正】要素の安全ガードを追加（nullエラーによるJS停止を完全に防止）
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

  // 💡 【追記】JS内に用意したピッカーの箱を自動生成し、クリック監視（起動コード）を有効化する
  injectAndInitCharacterPicker();

  initWorldSelectorEvent();
  initPortalDashboardEvents();
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
  // 🟢 モーダル1：ワールド選択モーダルの開閉
  // --------------------------------------------------------------------------
  if (openSelectBtn && modalSelect) {
    openSelectBtn.addEventListener("click", () => {
      modalSelect.classList.add("is-open");
      modalSelect.removeAttribute("aria-hidden");
      modalSelect.removeAttribute("inert");
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
    });
  }

  const closeArchiveModal = () => {
    if (modalArchive) {
      modalArchive.classList.remove("is-open");
      modalArchive.setAttribute("aria-hidden", "true");
      modalArchive.setAttribute("inert", "");
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
// 🔄 【新設】ヘッダーのワールドセレクター表示を強制的に最新情報へ同期する関数
// ==========================================================================
function syncHeaderWorldSelector(worldNumber, worldName) {
  const currentWorldNumber = document.getElementById("js-current-world-number");
  const currentWorldNameElement = document.getElementById(
    "js-current-world-name",
  );

  if (currentWorldNumber) {
    currentWorldNumber.textContent = worldNumber
      ? `W ${worldNumber}`
      : "未登録";
  }
  if (currentWorldNameElement) {
    currentWorldNameElement.textContent = worldName || "";
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

    const data = docSnap.data();

    // Firestoreからロードした最新のワールド番号とワールド名を、左上ヘッダーにも強制同期させる！
    syncHeaderWorldSelector(data.worldNumber, data.worldName);

    // クエスト章・ステージのバラバラ分解配置連動
    const questStr = data.questProgress || ""; // 例: "13-28"
    let chapter = "";
    let stage = "";
    if (questStr.includes("-")) {
      const parts = questStr.split("-");
      chapter = parts[0];
      stage = parts[1];
    }
    document.getElementById("js-portal-quest-chapter").value = chapter;
    document.getElementById("js-portal-quest-stage").value = stage;

    // 各種塔・数値インプットの同期
    document.getElementById("js-portal-muguu").value = data.towerMuguu || "";
    document.getElementById("js-portal-tower-blue").value =
      data.towerBlue || "";
    document.getElementById("js-portal-tower-red").value = data.towerRed || "";
    document.getElementById("js-portal-tower-green").value =
      data.towerGreen || "";
    document.getElementById("js-portal-tower-yellow").value =
      data.towerYellow || "";
    document.getElementById("js-portal-world-memo").value =
      data.worldMemo || "";

    // 詳細設定アコーディオンパーツの同期
    document.getElementById("js-portal-setting-name").value =
      data.worldName || "";
    document.getElementById("js-portal-setting-start-date").value =
      data.startDate || "";
    document.getElementById("js-portal-setting-link").value =
      data.externalLink || "";

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
    if (previewImg && data.characterId && Array.isArray(characterMaster)) {
      const foundChara = characterMaster.find(
        (c) => String(c.id) === String(data.characterId),
      );
      if (foundChara && foundChara.iconUrl) {
        previewImg.src = foundChara.iconUrl;
      } else {
        previewImg.src = "assets/images/chara-icon/1.webp";
      }
    }

    const statusSelect = document.getElementById("js-portal-setting-status");
    if (statusSelect) {
      // 過去データがtrue（または未設定）なら active、明示的に false の場合のみ archived を選択
      statusSelect.value = data.isActive !== false ? "active" : "archived";
    }

    // 💡 【新設連動】パーティ5人分のデータをマッピング復元
    const partyArray = data.partyMembers || [null, null, null, null, null];
    partyArray.forEach((charaId, i) => {
      const idx = i + 1;
      const inputField = document.getElementById(
        `js-portal-party-chara-${idx}`,
      );
      const imgField = document.getElementById(`js-portal-party-img-${idx}`);

      if (inputField) inputField.value = charaId || "";
      if (imgField) {
        if (charaId && Array.isArray(characterMaster)) {
          const found = characterMaster.find(
            (c) => String(c.id) === String(charaId),
          );
          if (found) {
            imgField.src = found.iconUrl;
            imgField.classList.remove("is-hidden"); // CSS側で画像を表示状態にする
            return;
          }
        }
        imgField.src = "";
        imgField.classList.add("is-hidden"); // キャラ未設定時は画像を隠して「+」を出す
      }
    });

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
          faviconImg.src =
            "http://www.google.com/s2/favicons?domain=" + data.externalLink;
        }
      } else {
        // 💡 直接スタイルを書き換えず、設計図の共通非表示クラス「is-hidden」を付与
        linkBtn.classList.add("is-hidden");
      }
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
// 📥 【新設】ダッシュボード側のリアルタイム数値保存 ＆ アコーディオン開閉
// ==========================================================================
function initPortalDashboardEvents() {
  const toggleBtn = document.getElementById("js-portal-settings-toggle");
  const contentPanel = document.getElementById("js-portal-settings-content");

  // 1. 詳細設定アコーディオンのクリーンな開閉
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

  // 2. 「設定と数値を保存」ボタンのFirestore連動コミット処理
  const updateBtn = document.getElementById("js-portal-btn-update");
  if (updateBtn) {
    updateBtn.addEventListener("click", async () => {
      const user = auth.currentUser;
      const currentWorldId = sessionStorage.getItem("app_current_world_id");

      if (!user || !currentWorldId) {
        alert("ワールドが選択されていないか、セッションが切れています。");
        return;
      }

      // UIインプット値の回収
      const chapter = document
        .getElementById("js-portal-quest-chapter")
        .value.trim();
      const stage = document
        .getElementById("js-portal-quest-stage")
        .value.trim();
      const questProgressStr = chapter && stage ? `${chapter}-${stage}` : ""; // 分割値を結合

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

      // 詳細設定エリアの回収
      const worldName = document
        .getElementById("js-portal-setting-name")
        .value.trim();
      const startDate = document.getElementById(
        "js-portal-setting-start-date",
      ).value;
      const externalLink = document
        .getElementById("js-portal-setting-link")
        .value.trim();

      // 💡 HTML側の隠しインプットである id="js-portal-setting-character-id" から値を回収するよう修正
      const characterId = document
        .getElementById("js-portal-setting-character-id")
        .value.trim();

      const statusValue = document.getElementById(
        "js-portal-setting-status",
      )?.value;
      const isActive = statusValue === "active"; // "active" の場合のみ true

      try {
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

        // 詳細設定エリアの回収のすぐ後ろあたりに追記（720行目付近）
        const partyChara1 = document.getElementById(
          "js-portal-party-chara-1",
        ).value;
        const partyChara2 = document.getElementById(
          "js-portal-party-chara-2",
        ).value;
        const partyChara3 = document.getElementById(
          "js-portal-party-chara-3",
        ).value;
        const partyChara4 = document.getElementById(
          "js-portal-party-chara-4",
        ).value;
        const partyChara5 = document.getElementById(
          "js-portal-party-chara-5",
        ).value;

        // 💡 Firestoreのオブジェクト構造へ配列データとして合流コミット
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

            // 💡 追加：パーティメンバー情報をFirestoreへ格納
            partyMembers: [
              partyChara1 || null,
              partyChara2 || null,
              partyChara3 || null,
              partyChara4 || null,
              partyChara5 || null,
            ],

            isActive: isActive,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        alert("ワールドの進捗数値をFirestoreへ正常に保存しました！");

        // 保存内容を上部セレクターや一覧に再反映・同期
        await loadWorldList(user.uid);

        // 💡 もし詳細設定で非アクティブ化（アーカイブ化）された場合のUI制御
        if (!isActive) {
          // 1. セッションから選択中のワールドIDを削除
          sessionStorage.removeItem("app_current_world_id");

          // 2. 選択中クラス（is-active）をすべての選択肢ボタンから完全に外す（見た目のリセット）
          document
            .querySelectorAll(".js-world-choice")
            .forEach((b) => b.classList.remove("is-active"));

          // 3. チェックボックスのチェックを明示的に外す
          const activeCheckbox = document.getElementById(
            "js-portal-setting-active",
          );
          if (activeCheckbox) {
            activeCheckbox.checked = false;
          }

          // 4. ヘッダーのワールド表示を「未登録」にリセット
          syncHeaderWorldSelector(null, "");

          alert(
            "ワールドをアーカイブ化しました。ワールド選択から新しいワールドを選ぶか追加してください。",
          );

          window.location.reload();
        } else {
          await loadPortalDashboardData(user.uid, currentWorldId);
        }
      } catch (error) {
        console.error("🚨 保存エラー:", error);
        alert("数値の保存に失敗しました。");
      } finally {
        updateBtn.disabled = false;
        // 💡 index.html 側の初期表示である「更新する」という文言と完全に一致させる
        updateBtn.innerHTML =
          '<i class="fa-solid fa-floppy-disk"></i> 更新する';
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
    <div id="js-character-modal" class="c-modal c-world-modal" aria-hidden="true" inert>
        <div class="c-modal__overlay js-character-modal-close"></div>
        <div class="c-world-modal__container c-modal__container">
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
                <div id="js-character-select-list" class="c-world-modal__grid"></div>
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
      const inputEl = document.getElementById(`js-portal-party-chara-${i}`);
      if (inputEl && inputEl.value) {
        selectedPartyCharIds.push(String(inputEl.value));
      }
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
