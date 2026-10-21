/**
 * =========================================================================
 * 🌐 メメモリポータル：ワールド×キャラクター管理（B案・画像フィルター＆モーダルセレクト仕様）
 * =========================================================================
 */

// 💡 指定いただいたアセット画像を100%再利用
var ATTR_IMAGES = [
  { name: "藍", url: "assets/images/filter-icon/icon-attr-blue.png" },
  { name: "紅", url: "assets/images/filter-icon/icon-attr-red.png" },
  { name: "翠", url: "assets/images/filter-icon/icon-attr-green.png" },
  { name: "黄", url: "assets/images/filter-icon/icon-attr-yellow.png" },
  { name: "天", url: "assets/images/filter-icon/icon-attr-holy.png" },
  { name: "冥", url: "assets/images/filter-icon/icon-attr-dark.png" },
];

var TYPE_IMAGES = [
  {
    name: "ウォーリアー",
    url: "assets/images/filter-icon/icon-type-warrior.png",
  },
  { name: "スナイパー", url: "assets/images/filter-icon/icon-type-gunner.png" },
  {
    name: "ソーサラー",
    url: "assets/images/filter-icon/icon-type-sorcerer.png",
  },
];

// 状態管理変数
let characterMasterList = [];
let userOwnedData = {}; // 現在のワールドにおけるユーザーの所持・レアリティ状況
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
  "LR+10",
];

// Firebaseインスタンスとセッション情報を一時格納する内部変数
let _db, _uid, _worldId;

/**
 * 1. メインインフラ（main.js）のロード完了後に直接呼び出される初期化関数
 */
window.initUserCharacterTab = async function (
  masterData,
  db,
  auth,
  uid,
  worldId,
) {
  console.log("👥 [CharacterTab] 起動トリガーを検知しました。");

  // インフラ参照をスコープ変数へ保存
  _db = db;
  _uid = uid;
  _worldId = worldId;

  // main.jsから手渡された本物のマスタデータを格納
  if (masterData && masterData.length > 0) {
    characterMasterList = masterData;
  } else if (window.characterMaster && window.characterMaster.length > 0) {
    characterMasterList = window.characterMaster;
  } else {
    console.warn("⚠️ マスタデータが空のため、100ms後に再実行します。");
    setTimeout(
      () => window.initUserCharacterTab(masterData, db, auth, uid, worldId),
      100,
    );
    return;
  }

  // ① 画像フィルターのボタンを動的に組み立て
  buildUserFilterButtons();

  // ② クラウドからセーブデータを同期ロードして一覧を生成
  await loadAndRenderCharacterGrid();

  // ③ 性能確認モーダルの開閉・タブ切り替えイベントを登録
  setupUserModalEvents();
};

/**
 * 2. Firestoreから所持状況を同期ロード
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

  try {
    userOwnedData = {};

    // サブコレクション（ownedCharacters）から所持レアリティをロード
    const ownedRef = window.collection(
      _db,
      "users",
      _uid,
      "worlds",
      _worldId,
      "ownedCharacters",
    );
    const querySnapshot = await window.getDocs(ownedRef);

    querySnapshot.forEach((docSnap) => {
      userOwnedData[docSnap.id] = docSnap.data();
    });

    // グリッドを綺麗に描画
    renderCharacterGrid();
  } catch (error) {
    console.error("🚨 Firestoreからの所持状況のロードに失敗しました:", error);
    gridEl.innerHTML =
      '<div class="character-grid__loading">セーブデータの取得に失敗しました。</div>';
  }
}

/**
 * 3. キャラクターアイコン一覧グリッドの生成（B案：アイコンのみ・グレーアウト連動仕様）
 */
function renderCharacterGrid() {
  const gridEl = document.getElementById("userCharGrid");
  if (!gridEl) return;

  gridEl.innerHTML = "";

  // 属性・タイプの二重フィルター処理
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

  // 136体の魔女を純粋なアイコンカードとしてズラリと配置
  filteredList.forEach((char) => {
    const currentRarity = userOwnedData[char.id]?.rarity || "未所持";
    const isNotOwned = currentRarity === "未所持";

    // カードのラッパー枠（グレーアウト判定クラス is-not-owned を付与）
    const wrapEl = document.createElement("div");
    wrapEl.className = `user-char-card-wrap js-char-wrap ${isNotOwned ? "is-not-owned" : ""}`;
    wrapEl.setAttribute("data-char-id", char.id);
    wrapEl.id = `user-char-card-${char.id}`; // 後からモーダル側で動的に点灯させるための識別ID

    // キャラクターアイコン部分
    const iconEl = document.createElement("div");
    iconEl.className = "user-char-icon";

    const imgEl = document.createElement("img");
    imgEl.src = char.iconUrl || "https://placehold.co";
    imgEl.alt = char.name;
    imgEl.loading = "lazy";
    iconEl.appendChild(imgEl);

    // アイコンをクリックした時だけ、あの詳しい性能確認モーダルを起動
    iconEl.addEventListener("click", () => {
      openUserCharDetailModal(char);
    });

    wrapEl.appendChild(iconEl);
    gridEl.appendChild(wrapEl);
  });
}

/**
 * 4. ユーザー用性能確認モーダルの起動（一軍共通テーマ完全準拠 ＆ セレクトボックス内蔵版）
 */
function openUserCharDetailModal(char) {
  currentModalCharData = char;

  // モーダル基本マスタ情報の反映
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

  // ⭕️ 内蔵されたレアリティセレクトボックスを動的に再生成・現在の値を復元
  const selectEl = document.getElementById("js-modal-user-rarity-select");
  if (selectEl) {
    selectEl.innerHTML = "";

    // 現在のFirestore上のレアリティを取得
    const savedRarity = userOwnedData[char.id]?.rarity || "未所持";

    RARITY_OPTIONS.forEach((opt) => {
      const optEl = document.createElement("option");
      optEl.value = opt;
      optEl.textContent = opt;
      if (opt === savedRarity) optEl.selected = true;
      selectEl.appendChild(optEl);
    });

    // 💡 イベントの二重登録を防ぐため、一度クリアしてからイベントリスナーをセット
    selectEl.onchange = async (e) => {
      const nextRarity = e.target.value;
      console.log(`✨ [レアリティ変更・保存] ${char.name} : ${nextRarity}`);

      // ① ローカルの所持データを更新
      if (!userOwnedData[char.id]) userOwnedData[char.id] = {};
      userOwnedData[char.id].rarity = nextRarity;
      userOwnedData[char.id].updatedAt = window.serverTimestamp
        ? window.serverTimestamp()
        : new Date();

      // ② 一覧側の該当キャラクターカードのグレーアウトをリアルタイムに連動点灯
      const listCard = document.getElementById(`user-char-card-${char.id}`);
      if (listCard) {
        if (nextRarity === "未所持") {
          listCard.classList.add("is-not-owned");
        } else {
          listCard.classList.remove("is-not-owned");
        }
      }

      // ③ Firestoreへの即時クラウド同期セーブ
      if (_db && _uid && _worldId) {
        try {
          const docRef = window.doc(
            _db,
            "users",
            _uid,
            "worlds",
            _worldId,
            "ownedCharacters",
            char.id,
          );
          await window.setDoc(
            docRef,
            {
              rarity: nextRarity,
              updatedAt: userOwnedData[char.id].updatedAt,
            },
            { merge: true },
          );
          console.log(
            `💾 [Firestore] ${char.name} の所持状況をマージ保存しました。`,
          );
        } catch (err) {
          console.error("🚨 所持状況のクラウド保存に失敗しました:", err);
        }
      }
    };
  }

  // ⭕️ 管理者ページの計算エンジンと完全に同じ計算式で数値を流し込み
  if (char.status) {
    runUserStatusCalculationEngine(char.status, char.type);
  }

  // ⭕️ モーダルを開いたときは、管理者ページに準拠し「ミカエル武器（mika）」の状態で初期描画
  switchUserWeaponTrigger("mika");

  // パーティ編集モーダルと100%共通の挙動で開く
  const modalEl = document.getElementById("userCharDetailModal");
  if (modalEl) {
    modalEl.classList.add("is-open");
    modalEl.removeAttribute("aria-hidden");
    modalEl.removeAttribute("inert");
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

  // タイプ別に攻撃力を自動判定
  let atkVal = 0;
  if (type === "ウォーリアー" || type === "ウォーリア") atkVal = str;
  else if (type === "スナイパー") atkVal = dex;
  else if (type === "ソーサラー") atkVal = mag;

  // 二次ステータスの自動計算
  const hitVal = Math.floor(str * 0.5);
  const critVal = Math.floor(dex * 0.5);
  const debuffVal = Math.floor(mag * 0.5);
  const calculatedHP = sta * 10;
  const physDef = str;
  const magDef = mag;
  const evadeVal = Math.floor(dex * 0.5);
  const staVal = Math.floor(sta * 0.5);

  // DOMへの流し込み（一般ユーザー用ID: uc-接頭辞）
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
 * 6. 専用装備・段階切り替えトリガー（4大スキル＆段階テキスト完全同期対応）
 */
function switchUserWeaponTrigger(mode) {
  currentWeaponMode = mode;

  // タブボタンのアクティブクラス(一軍の c-world-modal__filter-btn 仕様)の切り替え
  ["normal", "asta", "mika", "meta"].forEach((m) => {
    const btn = document.getElementById(`ubtn-wp-${m}`);
    if (btn) {
      if (m === mode) btn.classList.add("is-active");
      else btn.classList.remove("is-active");
    }
  });

  const char = currentModalCharData;
  if (!char) return;

  // 📑 5つのスキル枠（A1, A2, P1, P2, WP）に対して3段階フォールバックテキストの適用
  const ALL_SKILL_TYPES = ["A1", "A2", "P1", "P2", "WP"];
  const skills = char.skills || [];

  ALL_SKILL_TYPES.forEach((type) => {
    const skill = skills.find((sk) => sk.type === type) || {
      name: "",
      ct: 0,
      nomalText: "",
      astarothText: "",
      michaelText: "",
      metatronText: "",
    };

    const nameElem = document.getElementById(`uc-sk-${type}-name`);
    if (nameElem) nameElem.textContent = skill.name || "-";

    const ctArea = document.getElementById(`uc-sk-${type}-ct-area`);
    if (ctArea) {
      if (
        skill.ct !== null &&
        skill.ct !== undefined &&
        String(skill.ct) !== "0" &&
        String(skill.ct) !== ""
      ) {
        ctArea.innerHTML = `<span class="c-world-modal__btn-world" style="background:#1e1b4b; color:#a5b4fc; font-size:10px; padding:2px 6px; border-radius:4px;">CT: ${skill.ct}</span>`;
      } else {
        ctArea.innerHTML = "";
      }
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

      if (displayText && displayText.trim() !== "") {
        textElem.innerHTML = displayText.replace(/\n/g, "<br>");
      } else {
        textElem.innerHTML =
          '<span style="color: var(--text-muted); font-style: italic;">未登録</span>';
      }

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

  // 🛡️ 専用武器パッシブ基本ステータスの連動制御（管理者jsと完全同期）
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
    let searchMode = mode;
    if (mode === "asta") searchMode = "astaroth";
    if (mode === "mika") searchMode = "michael";
    if (mode === "meta") searchMode = "metatron";

    const wd = w[searchMode] || {
      stat: "",
      passive1: "",
      passive2: "",
      passive3: "",
    };

    wpNameEl.textContent = w.name ? w.name : "専用武器名未設定";
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
 * 7. モーダルおよび武器切り替えタブのイベント定義（.c-modal共通クローズ対応）
 */
function setupUserModalEvents() {
  const modalEl = document.getElementById("userCharDetailModal");

  const closeModal = () => {
    if (modalEl) {
      modalEl.classList.remove("is-open");
      modalEl.setAttribute("aria-hidden", "true");
      modalEl.setAttribute("inert", "");
    }
  };

  // 共通の閉じクラス「.js-user-char-modal-close」を一括バインド
  document.querySelectorAll(".js-user-char-modal-close").forEach((btn) => {
    btn.addEventListener("click", closeModal);
  });

  // 通常、サタン、ミカエル、メタトロンタブのクリックイベント登録
  ["normal", "asta", "mika", "meta"].forEach((stage) => {
    document
      .getElementById(`ubtn-wp-${stage}`)
      ?.addEventListener("click", (e) => {
        e.stopPropagation(); // 遮断幕へのクローズイベント連動をストップ
        switchUserWeaponTrigger(stage);
      });
  });
}

/**
 * 8. 一般ユーザー画面用：属性・タイプ画像フィルターボタンの動的生成
 * 🛠️ 修正：ご提示いただいた画像配列オブジェクトを完全に再利用する形へ最適化
 */
function buildUserFilterButtons() {
  const attrContainer = document.getElementById("userFilterAttrOptions");
  const typeContainer = document.getElementById("userFilterTypeOptions");

  // ① 属性フィルターの組み立て
  if (attrContainer) {
    attrContainer.innerHTML = "";

    // 「すべて」用の特別な全体画像ボタンを先頭に追加
    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = `c-world-modal__filter-btn ${activeFilterAttr === "ALL" ? "is-active" : ""}`;
    allBtn.style =
      "padding: 4px 12px; font-size:11px; font-weight:bold; height:32px; display:flex; align-items:center; gap:6px;";
    allBtn.innerHTML = `<img src="assets/images/filter-icon/icon-all.png" style="width:16px; height:16px; object-fit:contain;" alt="全部"> 全部`;
    allBtn.onclick = () => {
      activeFilterAttr = "ALL";
      Array.from(attrContainer.children).forEach((b) =>
        b.classList.remove("is-active"),
      );
      allBtn.classList.add("is-active");
      renderCharacterGrid();
    };
    attrContainer.appendChild(allBtn);

    // 配列をループして画像ボタンを生成
    ATTR_IMAGES.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `c-world-modal__filter-btn ${item.name === activeFilterAttr ? "is-active" : ""}`;
      btn.style =
        "padding: 4px 12px; font-size:11px; font-weight:bold; height:32px; display:flex; align-items:center; gap:6px;";
      btn.innerHTML = `<img src="${item.url}" style="width:16px; height:16px; object-fit:contain;" alt="${item.name}"> ${item.name}`;

      btn.onclick = () => {
        activeFilterAttr = item.name;
        Array.from(attrContainer.children).forEach((b) =>
          b.classList.remove("is-active"),
        );
        btn.classList.add("is-active");
        renderCharacterGrid();
      };
      attrContainer.appendChild(btn);
    });
  }

  // ② タイプフィルターの組み立て
  if (typeContainer) {
    typeContainer.innerHTML = "";

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = `c-world-modal__filter-btn ${activeFilterType === "ALL" ? "is-active" : ""}`;
    allBtn.style =
      "padding: 4px 12px; font-size:11px; font-weight:bold; height:32px; display:flex; align-items:center; gap:6px;";
    allBtn.innerHTML = `<img src="assets/images/filter-icon/icon-all.png" style="width:16px; height:16px; object-fit:contain;" alt="全部"> 全部`;
    allBtn.onclick = () => {
      activeFilterType = "ALL";
      Array.from(typeContainer.children).forEach((b) =>
        b.classList.remove("is-active"),
      );
      allBtn.classList.add("is-active");
      renderCharacterGrid();
    };
    typeContainer.appendChild(allBtn);

    TYPE_IMAGES.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `c-world-modal__filter-btn ${item.name === activeFilterType ? "is-active" : ""}`;
      btn.style =
        "padding: 4px 12px; font-size:11px; font-weight:bold; height:32px; display:flex; align-items:center; gap:6px;";
      btn.innerHTML = `<img src="${item.url}" style="width:16px; height:16px; object-fit:contain;" alt="${item.name}"> ${item.name}`;

      btn.onclick = () => {
        activeFilterType = item.name;
        Array.from(typeContainer.children).forEach((b) =>
          b.classList.remove("is-active"),
        );
        btn.classList.add("is-active");
        renderCharacterGrid();
      };
      typeContainer.appendChild(btn);
    });
  }
}

// 外部参照・手動テスト用のグローバル公開
window.switchUserWeaponTrigger = switchUserWeaponTrigger;
