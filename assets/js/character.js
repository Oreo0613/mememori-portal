/**
 * =========================================================================
 * 🌐 メメモリポータル：ワールド×キャラクター管理（マップ構造化・軽量エコ版 1/3）
 * =========================================================================
 */

// 状態管理変数
let characterMasterList = [];
let userOwnedMap = {}; // 現在のワールドにおけるユーザーの所持状況 { charId: { rarity: "SR", ... } }
let activeFilterAttr = "ALL";
let activeFilterType = "ALL";
let currentModalCharData = null; // 現在モーダルで表示しているキャラの生データ
let currentWeaponMode = "mika"; // 初期選択をミカエル(mika)に設定

// レアリティの選択肢（未所持〜LR10、R/R+は除外）
const RARITY_OPTIONS = [
  "未所持",
  "SR",
  "SR+",
  "SSR",
  "SSR+",
  "UR",
  "UR+",
  "LR",
  "LR+1",
  "LR+2",
  "LR+3",
  "LR+4",
  "LR+5",
  "LR+6",
  "LR+7",
  "LR+8",
  "LR+9",
  "LR+10",
];

// Firebaseの各SDK関数および参照を保持する安全なスコープ変数
let _db, _uid, _worldId;
let _collection, _doc, _getDoc, _setDoc, _serverTimestamp;

/**
 * 1. メインインフラ（main.js）のロード完了後に直接呼び出される初期化関数
 */
window.initUserCharacterTab = async function (
  masterData,
  db,
  auth,
  uid,
  worldId,
  fbCollection,
  fbGetDocs,
  fbDoc,
  fbSetDoc,
  fbServerTimestamp,
  fbGetDoc,
) {
  console.log("👥 [CharacterTab] 起動トリガーを検知しました（マップ構造版）。");

  // インフラ参照を保存
  _db = db;
  _uid = uid;
  _worldId = worldId;

  _collection =
    fbCollection ||
    window.collection ||
    (window.FirebaseBundle ? window.FirebaseBundle.collection : null);
  _doc =
    fbDoc ||
    window.doc ||
    (window.FirebaseBundle ? window.FirebaseBundle.doc : null);
  _setDoc =
    fbSetDoc ||
    window.setDoc ||
    (window.FirebaseBundle ? window.FirebaseBundle.setDoc : null);
  _serverTimestamp =
    fbServerTimestamp ||
    window.serverTimestamp ||
    (window.FirebaseBundle ? window.FirebaseBundle.serverTimestamp : null);

  // getDoc関数をセット
  _getDoc =
    fbGetDoc || // 💡 main.js から渡された関数を最優先にします
    window.getDoc ||
    (window.FirebaseBundle ? window.FirebaseBundle.getDoc : null);

  // マスタデータを確実に格納
  if (masterData && masterData.length > 0) {
    characterMasterList = masterData;
  } else if (window.characterMaster && window.characterMaster.length > 0) {
    characterMasterList = window.characterMaster;
  } else {
    console.warn("⚠️ マスタデータが空のため、100ms後に再実行します。");
    setTimeout(
      () =>
        window.initUserCharacterTab(
          masterData,
          db,
          auth,
          uid,
          worldId,
          fbCollection,
          fbGetDocs,
          fbDoc,
          fbSetDoc,
          fbServerTimestamp,
          fbGetDoc,
        ),
      100,
    );
    return;
  }

  // ① 静的HTML画像フィルターのイベント登録
  bindUserFilterEvents();

  // ② クラウドからセーブデータを同期ロードして一覧を生成
  await loadAndRenderCharacterGrid();

  // ③ 性能確認モーダルの開閉・タブ切り替えイベントを登録
  setupUserModalEvents();

  // 画面下の「更新する」ボタンに一括保存イベントをバインド
  const charUpdateBtn = document.getElementById("js-character-btn-update");
  if (charUpdateBtn) {
    charUpdateBtn.onclick = async () => {
      await saveAllCharacterRarityData();
    };
  }
};

/**
 * 2. Firestoreからマップ構造の所持状況を同期ロード
 */
async function loadAndRenderCharacterGrid() {
  const gridEl = document.getElementById("userCharGrid");
  if (!gridEl) return;

  gridEl.innerHTML =
    '<div class="character-grid__loading">データ通信中...</div>';

  if (!_worldId) {
    gridEl.innerHTML =
      '<div class="character-grid__loading">ヘッダーからワールドを選択すると魔女一覧が表示されます。</div>';
    return;
  }

  // 💡【安全ガード修正版】getDocを確実にフォールバック回収します
  if (!_getDoc) {
    _getDoc =
      window.getDoc ||
      (window.FirebaseBundle ? window.FirebaseBundle.getDoc : null);
  }
  if (!_doc) {
    _doc =
      window.doc || (window.FirebaseBundle ? window.FirebaseBundle.doc : null);
  }

  // 最終チェック
  if (!_doc || !_getDoc) {
    if (window.FirebaseMeme) {
      _doc = window.FirebaseMeme.doc;
      _getDoc = window.FirebaseMeme.getDoc;
      _setDoc = window.FirebaseMeme.setDoc;
    } else {
      gridEl.innerHTML =
        '<div class="character-grid__loading">インフラ初期化エラー。再読み込みしてください。</div>';
      return;
    }
  }

  try {
    userOwnedMap = {};

    // 💡 特定のドキュメント1件のみを取得するように変更
    const statusDocRef = _doc(
      _db,
      "users",
      _uid,
      "worlds",
      _worldId,
      "characterStatus",
      "status",
    );
    const docSnap = await _getDoc(statusDocRef);

    if (docSnap.exists()) {
      const dataMap = docSnap.data().ownedMap || {};

      Object.keys(dataMap).forEach((charId) => {
        userOwnedMap[charId] = {
          rarity: dataMap[charId].rarity || "未所持",
          originalRarity: dataMap[charId].rarity || "未所持",
          isDirty: false,
        };
      });
    }

    // グリッドを描画
    renderCharacterGrid();
  } catch (error) {
    console.error(
      "🚨 Firestoreからのキャラクターマップロードに失敗しました:",
      error,
    );
    gridEl.innerHTML =
      '<div class="character-grid__loading">セーブデータの取得に失敗しました。</div>';
  }
}

/**
 * 3. キャラクターアイコン一覧グリッドの生成
 */
function renderCharacterGrid() {
  const gridEl = document.getElementById("userCharGrid");
  if (!gridEl) return;

  gridEl.innerHTML = "";

  const filteredList = characterMasterList.filter((char) => {
    const matchAttr =
      activeFilterAttr === "ALL" || char.attr === activeFilterAttr;
    const matchType =
      activeFilterType === "ALL" || char.type === activeFilterType;
    return matchAttr && matchType;
  });

  if (filteredList.length === 0) {
    gridEl.innerHTML =
      '<div class="character-grid__loading">該当するキャラクターがいません。</div>';
    return;
  }

  filteredList.forEach((char) => {
    const currentRarity = userOwnedMap[char.id]?.rarity || "未所持";
    const isNotOwned = currentRarity === "未所持";

    const wrapEl = document.createElement("div");
    wrapEl.className = `user-char-card-wrap js-char-wrap ${isNotOwned ? "is-not-owned" : ""}`;
    wrapEl.setAttribute("data-char-id", char.id);
    wrapEl.id = `user-char-card-${char.id}`;

    const displayRarity = isNotOwned ? "SR" : currentRarity.replace("+", "_");
    const cardEl = getSafeCharacterBadgeElement(char, displayRarity);

    cardEl.addEventListener("click", () => {
      openUserCharDetailModal(char);
    });

    wrapEl.appendChild(cardEl);
    gridEl.appendChild(wrapEl);
  });
}

/**
 * 4. ユーザー用性能確認モーダルの起動
 */
function openUserCharDetailModal(char) {
  currentModalCharData = char;

  document.getElementById("ucd-avatar").src =
    char.iconUrl || "https://placehold.co";
  document.getElementById("ucd-name").textContent = char.name;

  let cleanTags = char.tags
    ? char.tags.replace(/,?\s*\[完了\]/, "").replace(/^,\s*/, "")
    : "";
  document.getElementById("ucd-tags-display").textContent = cleanTags
    ? "🏷️ " + cleanTags
    : "";

  document.getElementById("ucd-attr").textContent = char.attr;
  document.getElementById("ucd-type").textContent = char.type;
  document.getElementById("ucd-rarity").textContent = char.rarity || "限定";

  const initRarity = userOwnedMap[char.id]?.rarity || "未所持";
  const initCardWrap = document.getElementById("js-modal-chara-card-wrap");
  if (initCardWrap) {
    getSafeUpdateCardAppearance(initCardWrap, initRarity);
  }

  const minusBtn = document.getElementById("js-modal-rarity-minus");
  const plusBtn = document.getElementById("js-modal-rarity-plus");
  const displayEl = document.getElementById("js-modal-rarity-display");

  if (minusBtn && plusBtn && displayEl) {
    const savedRarity = userOwnedMap[char.id]?.rarity || "未所持";
    let currentIndex = RARITY_OPTIONS.indexOf(savedRarity);
    if (currentIndex === -1) currentIndex = 0;

    const updateRarityControlUI = (index) => {
      const targetRarity = RARITY_OPTIONS[index];
      displayEl.textContent = targetRarity;

      minusBtn.disabled = index === 0;
      plusBtn.disabled = index === RARITY_OPTIONS.length - 1;

      const originalRarity = userOwnedMap[char.id]?.originalRarity || "未所持";

      if (!userOwnedMap[char.id]) {
        userOwnedMap[char.id] = {};
      }
      userOwnedMap[char.id].rarity = targetRarity;
      userOwnedMap[char.id].isDirty = targetRarity !== originalRarity;

      const modalCardWrap = document.getElementById("js-modal-chara-card-wrap");
      if (modalCardWrap) {
        getSafeUpdateCardAppearance(modalCardWrap, targetRarity);
      }

      const listWrapCard = document.getElementById(`user-char-card-${char.id}`);
      if (listWrapCard) {
        listWrapCard.classList.toggle(
          "is-not-owned",
          targetRarity === "未所持",
        );
        const oldInnerCard = listWrapCard.querySelector(".c-chara-card");
        if (oldInnerCard) {
          getSafeUpdateCardAppearance(oldInnerCard, targetRarity);
        }
      }
    };

    updateRarityControlUI(currentIndex);

    minusBtn.onclick = (e) => {
      e.stopPropagation();
      if (currentIndex > 0) {
        currentIndex--;
        updateRarityControlUI(currentIndex);
      }
    };

    plusBtn.onclick = (e) => {
      e.stopPropagation();
      if (currentIndex < RARITY_OPTIONS.length - 1) {
        currentIndex++;
        updateRarityControlUI(currentIndex);
      }
    };
  }

  if (char.status) {
    runUserStatusCalculationEngine(char.status, char.type);
  }

  switchUserWeaponTrigger("mika");

  const modalEl = document.getElementById("userCharDetailModal");
  if (modalEl) {
    modalEl.classList.add("is-open");
    modalEl.removeAttribute("aria-hidden");
    modalEl.removeAttribute("inert");
    document.body.classList.add("is-modal-open");
  }
}

/**
 * 5. 管理者側から直移植したステータス自動計算エンジン
 */
function runUserStatusCalculationEngine(status, type) {
  const spd = Number(status.speed || 0);
  const str = Number(status.str || 0);
  const dex = Number(status.dex || 0);
  const mag = Number(status.mag || 0);
  const sta = Number(status.sta || 0);
  const defInitial = Number(status.defInitial || 0);

  let atkVal = 0;
  if (type === "ウォーリアー" || type === "ウォーリア") atkVal = str;
  else if (type === "スナイパー") atkVal = dex;
  else if (type === "ソーサラー") atkVal = mag;

  const hitVal = Math.floor(str * 0.5);
  const critVal = Math.floor(dex * 0.5);
  const debuffVal = Math.floor(mag * 0.5);
  const calculatedHP = sta * 10;
  const physDef = str;
  const magDef = mag;
  const evadeVal = Math.floor(dex * 0.5);
  const staVal = Math.floor(sta * 0.5);

  document.getElementById("uc-calculated-speed").textContent =
    spd.toLocaleString();
  document.getElementById("uc-calculated-atk").textContent =
    atkVal.toLocaleString();
  document.getElementById("uc-calculated-hit").textContent =
    hitVal.toLocaleString();
  document.getElementById("uc-calculated-crit").textContent =
    critVal.toLocaleString();
  document.getElementById("uc-calculated-debuff").textContent =
    debuffVal.toLocaleString();
  document.getElementById("uc-calculated-hp").textContent =
    calculatedHP.toLocaleString();
  document.getElementById("uc-calculated-def").textContent =
    defInitial.toLocaleString();
  document.getElementById("uc-calculated-pdef").textContent =
    physDef.toLocaleString();
  document.getElementById("uc-calculated-mdef").textContent =
    magDef.toLocaleString();
  document.getElementById("uc-calculated-evade").textContent =
    evadeVal.toLocaleString();
  document.getElementById("uc-calculated-critres").textContent =
    staVal.toLocaleString();
}

/**
 * 6. 専用装備・段階切り替えトリガー
 */
function switchUserWeaponTrigger(mode) {
  currentWeaponMode = mode;

  ["normal", "asta", "mika", "meta"].forEach((m) => {
    const btn = document.getElementById(`ubtn-wp-${m}`);
    if (btn) btn.classList.toggle("is-active", m === mode);
  });

  const char = currentModalCharData;
  if (!char) return;

  const ALL_SKILL_TYPES = ["A1", "A2", "P1", "P2", "WP"];
  const skills = char.skills || [];

  ALL_SKILL_TYPES.forEach((type) => {
    const skill = skills.find((sk) => sk.type === type) || { name: "", ct: 0 };
    const nameElem = document.getElementById(`uc-sk-${type}-name`);
    if (nameElem) nameElem.textContent = skill.name || "-";

    const ctArea = document.getElementById(`uc-sk-${type}-ct-area`);
    if (ctArea) {
      ctArea.innerHTML = skill.ct
        ? `<span class="c-world-modal__btn-world">CT: ${skill.ct}</span>`
        : "";
    }

    const textElem = document.getElementById(`uc-sk-${type}-text`);
    if (textElem) {
      let displayText = skill.nomalText || "";
      if (mode === "asta")
        displayText = skill.astarothText || skill.nomalText || "";
      else if (mode === "mika")
        displayText =
          skill.michaelText || skill.astarothText || skill.nomalText || "";
      else if (mode === "meta")
        displayText =
          skill.metatronText ||
          skill.michaelText ||
          skill.astarothText ||
          skill.nomalText ||
          "";

      textElem.innerHTML =
        displayText && displayText.trim() !== ""
          ? displayText.replace(/\n/g, "<br>")
          : '<span style="color: var(--text-muted); font-style: italic;">未登録</span>';

      if (type === "WP") {
        const isAllEmpty =
          !skill.nomalText &&
          !skill.astarothText &&
          !skill.michaelText &&
          !skill.metatronText;
        const skillBox = textElem.closest(".c-char-detail__skill-box");
        if (skillBox) skillBox.style.display = isAllEmpty ? "none" : "block";
      }
    }
  });

  const w = char.weapon;
  const wpNameEl = document.getElementById("uc-v-w-name");
  const wpValEl = document.getElementById("uc-v-w-val");
  const wpLblEl = document.getElementById("uc-v-w-passives-lbl");
  const wpUl = document.getElementById("uc-v-w-passives");

  if (!w || mode === "normal" || mode === "nomal") {
    wpNameEl.textContent = "専用武器なし (未装備)";
    wpValEl.textContent = "固有値: -";
    if (wpLblEl) wpLblEl.style.display = "none";
    wpUl.innerHTML = "<li>パッシブ効果はありません</li>";
  } else {
    let searchMode =
      mode === "asta"
        ? "astaroth"
        : mode === "mika"
          ? "michael"
          : mode === "meta"
            ? "metatron"
            : mode;
    const wd = w[searchMode] || { stat: "" };

    wpNameEl.textContent = w.name || "専用武器名未設定";
    wpValEl.textContent = `固有値: ${wd.stat || "-"}`;
    if (wpLblEl) wpLblEl.style.display = "block";
    wpUl.innerHTML = "";

    [wd.passive1, wd.passive2, wd.passive3].forEach((pStr) => {
      if (pStr && pStr !== "未設定" && pStr !== "") {
        const li = document.createElement("li");
        li.textContent = `● ${pStr}`;
        wpUl.appendChild(li);
      }
    });
  }
}

/**
 * 7. モーダルおよび武器切り替えタブのイベント定義
 */
function setupUserModalEvents() {
  const modalEl = document.getElementById("userCharDetailModal");

  const closeModal = () => {
    if (modalEl) {
      const activeEl = document.activeElement;
      if (activeEl && modalEl.contains(activeEl)) activeEl.blur();
      modalEl.classList.remove("is-open");
      modalEl.setAttribute("aria-hidden", "true");
      modalEl.setAttribute("inert", "");
      document.body.classList.remove("is-modal-open");
      const gridEl = document.getElementById("userCharGrid");
      if (gridEl) gridEl.focus();
    }
  };

  document
    .querySelectorAll(".js-user-char-modal-close")
    .forEach((btn) => btn.addEventListener("click", closeModal));

  ["normal", "asta", "mika", "meta"].forEach((stage) => {
    document
      .getElementById(`ubtn-wp-${stage}`)
      ?.addEventListener("click", (e) => {
        e.stopPropagation();
        switchUserWeaponTrigger(stage);
      });
  });
}

/**
 * 8. 属性・タイプフィルターのイベントバインド
 */
function bindUserFilterEvents() {
  const attrButtons = document.querySelectorAll(".js-filter-attr");
  attrButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilterAttr = btn.getAttribute("data-attr");
      attrButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderCharacterGrid();
    });
  });

  const typeButtons = document.querySelectorAll(".js-filter-type");
  typeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilterType = btn.getAttribute("data-type");
      typeButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderCharacterGrid();
    });
  });
}

/**
 * 💾 9. 「更新する」ボタン押下時の一括Firestore保存処理（マップ構造対応版）
 */
async function saveAllCharacterRarityData() {
  const updateBtn = document.getElementById("js-character-btn-update");
  if (!updateBtn) return;

  const currentWorldId = sessionStorage.getItem("app_current_world_id");
  if (!_db || !_uid || !currentWorldId || !_doc || !_setDoc) {
    alert(
      "ワールドが選択されていません。「ワールド選択」から有効なワールドを選んでから更新してください。",
    );
    return;
  }

  const dirtyCharIds = Object.keys(userOwnedMap).filter(
    (id) => userOwnedMap[id].isDirty === true,
  );

  if (dirtyCharIds.length === 0) {
    alert("変更されたデータはありません。");
    return;
  }

  const updatedCharNames = dirtyCharIds.map((id) => {
    const match = characterMasterList.find((c) => String(c.id) === String(id));
    return match ? match.name : "不明な魔女";
  });

  try {
    updateBtn.disabled = true;
    updateBtn.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';

    // 💡【マージ処理】これまでの保存データを1度取得してマージのベースにする
    const statusDocRef = _doc(
      _db,
      "users",
      _uid,
      "worlds",
      _worldId,
      "characterStatus",
      "status",
    );
    const docSnap = await _getDoc(statusDocRef);

    let currentMapInDb = {};
    if (docSnap.exists()) {
      currentMapInDb = docSnap.data().ownedMap || {};
    }

    // 変更部分を大きな1つのマップオブジェクトへマージ
    Object.keys(userOwnedMap).forEach((charId) => {
      if (userOwnedMap[charId].isDirty || currentMapInDb[charId]) {
        currentMapInDb[charId] = {
          rarity: userOwnedMap[charId].rarity,
          updatedAt: userOwnedMap[charId].isDirty
            ? new Date().toISOString()
            : currentMapInDb[charId].updatedAt || new Date().toISOString(),
        };
      }
    });

    // 💡【マップ書き込み】ループ処理を完全廃止し、ドキュメント1件のみに全員分を凝縮保存
    await _setDoc(
      statusDocRef,
      {
        ownedMap: currentMapInDb,
        updatedAt: _serverTimestamp ? _serverTimestamp() : new Date(),
      },
      { merge: true },
    );

    dirtyCharIds.forEach((charId) => {
      userOwnedMap[charId].originalRarity = userOwnedMap[charId].rarity;
      userOwnedMap[charId].isDirty = false;
    });

    console.log(
      `💾 [Firestore] マップ構造ドキュメントを1件更新しました。(変更対象: ${dirtyCharIds.length}件)`,
    );

    updateBtn.classList.add("is-success-flash");
    updateBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> 更新完了！';

    setTimeout(() => {
      alert(
        `【クラウド保存完了】\n以下のキャラクターの所持状況を正常に更新しました！\n\n対象: ${updatedCharNames.join("、")}`,
      );
    }, 100);
  } catch (error) {
    console.error("🚨 キャラクターデータの保存に失敗しました:", error);
    alert("データの保存に失敗しました。通信環境を確認してください。");
  } finally {
    updateBtn.disabled = false;
    setTimeout(() => {
      updateBtn.classList.remove("is-success-flash");
      updateBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> 更新する';
    }, 1500);
  }
}

function getSafeCharacterBadgeElement(char, rarity) {
  if (typeof window.createCharacterBadgeElement === "function")
    return window.createCharacterBadgeElement(char, rarity);
  const fallbackCard = document.createElement("div");
  fallbackCard.className = "c-chara-card";
  fallbackCard.innerHTML = `<div class="c-chara-card__image-wrapper"><img class="c-chara-card__img" src="${char.iconUrl || ""}" alt="${char.name}"></div>`;
  return fallbackCard;
}

function getSafeUpdateCardAppearance(element, rarity) {
  if (typeof window.updateCardAppearance === "function")
    window.updateCardAppearance(element, rarity);
}

window.switchUserWeaponTrigger = switchUserWeaponTrigger;
