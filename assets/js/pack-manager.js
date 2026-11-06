/**
 * 達成パック管理・マイルストーン自動フィルタ＆3ステータスモーダル【Firestoreクラウド同期完全版】
 */

// ==========================================
// 🔥 FIREBASE SDK API（main.jsの設計・バージョンに完全準拠、名前衝突を完全回避）
// ==========================================
import {
  doc as firestoreDoc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// ==========================================
// 1. 状態管理（ステータス）
// ==========================================
let packMasterData = [];
let itemMasterMap = {};

let userSaveData = {
  currentMilestones: {
    rank: "0",
    quest: "0-0",
    tower: "0",
    "tower-all": "0",
    "tower-blue": "0",
    "tower-red": "0",
    "tower-green": "0",
    "tower-yellow": "0",
  },
  packSettings: {},
};

const PACK_CATEGORIES = [
  { key: "rank", name: "ランク" },
  { key: "quest", name: "クエスト" },
  { key: "tower", name: "無窮の塔" },
  { key: "tower-blue", name: "属性塔(藍)" },
  { key: "tower-red", name: "属性塔(紅)" },
  { key: "tower-green", name: "属性塔(翠)" },
  { key: "tower-yellow", name: "属性塔(黄)" },
  { key: "tower-all", name: "属性塔(全)" },
];

function catConfigMatches(key, jsonCategory) {
  if (!key || !jsonCategory) return false;
  return key.replace(/-/g, "_") === jsonCategory.replace(/-/g, "_");
}

// ==========================================
// ⚙️ ベース課金額定数
// ==========================================
const BASE_PRICE_OPTIONS = [
  { value: "160", label: "160円" },
  { value: "650", label: "650円" },
  { value: "1000", label: "1000円" },
  { value: "1500", label: "1500円" },
  { value: "3000", label: "3,000円" },
  { value: "6000", label: "6,000円" },
  { value: "11800", label: "11,800" },
];

// ==========================================
// 📅 属性塔 開催曜日スケジュール定数 (0:日, 1:月, 2:火, 3:水, 4:木, 5:金, 6:土)
// ==========================================
const TOWER_SCHEDULE = {
  // 各曜日に「開催されている」属性キーを配列で定義
  1: ["tower-blue"],
  2: ["tower-red"],
  3: ["tower-green"],
  4: ["tower-yellow"],
  5: ["tower-blue", "tower-red"],
  6: ["tower-green", "tower-yellow"],
  0: ["tower-blue", "tower-red", "tower-green", "tower-yellow"], // 日曜は全開放
};

/**
 * ⏰ ゲーム内の「午前4:00更新」を考慮した現在の曜日（0〜6）を取得する
 */
function getGameCurrentDay() {
  const now = new Date();
  // 現在時刻から4時間を引いた時点の曜日を返すことで、AM 0:00〜3:59 までは前日扱いにする
  const gameTime = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  return gameTime.getDay();
}

// ==========================================
// 📄 2. CLOUD FIRESTORE 連動通信ロジック
// ==========================================

/**
 * 📥 Firestoreから選択中ワールドの進行度・パック設定を読み込む
 */
async function loadUserPackDataFromFirestore(userId, worldId) {
  if (!window.db) {
    console.error("🚨 Firestoreインスタンスが利用できません。");
    return;
  }
  try {
    console.log(
      `⏳ Firestoreからワールド [${worldId}] のパックデータをロード中...`,
    );
    const worldDocRef = firestoreDoc(
      window.db,
      "users",
      userId,
      "worlds",
      worldId,
    );
    const docSnap = await getDoc(worldDocRef);

    resetUserSaveData();

    if (docSnap.exists()) {
      const data = docSnap.data();

      // 🌟 ベース課金帯の復元（なければ11800）
      userSaveData.basePrice = String(data.basePrice || "11800");
      syncBasePriceSelectorUI();

      // ① 進捗情報 (currentMilestones) の復元
      if (data.currentMilestones) {
        Object.keys(data.currentMilestones).forEach((dbKey) => {
          const appKey = dbKey.replace(/_/g, "-");
          userSaveData.currentMilestones[appKey] = String(
            data.currentMilestones[dbKey] || "0",
          );
        });
      }

      const qVal = userSaveData.currentMilestones["quest"] || "0-0";
      const qParts = qVal.split("-");
      userSaveData.currentMilestones["quest-chapter"] = String(
        qParts[0] || "0",
      );
      userSaveData.currentMilestones["quest-stage"] = String(qParts[1] || "0");

      // ② 各パックの個別カスタム設定 (packSettings) の復元
      if (data.packSettings) {
        Object.keys(data.packSettings).forEach((packId) => {
          userSaveData.packSettings[packId] = {
            price: String(data.packSettings[packId].price),
            status: data.packSettings[packId].status || "unconfigured",
          };
        });
      }
      console.log(
        "✅ パックデータの復元が完了しました。",
        userSaveData.packSettings,
      );
    }
  } catch (error) {
    console.error("🚨 Firestoreからのデータ読み込みに失敗しました:", error);
  }
}

/**
 * 💾 現在の画面入力・設定（userSaveData）をFirestoreへマージ保存する
 */
async function saveUserPackDataToFirestore(userId, worldId) {
  if (!window.db) return;

  const firestoreMilestones = {};
  Object.keys(userSaveData.currentMilestones).forEach((key) => {
    if (
      key === "quest-chapter" ||
      key === "quest-stage" ||
      key === "quest_chapter" ||
      key === "quest_stage"
    )
      return;
    const dbKey = key.replace(/-/g, "_");
    firestoreMilestones[dbKey] = userSaveData.currentMilestones[key];
  });

  // 🌟 更新ボタンで保存するのは「未設定（unconfigured）ではないもの」に完全に限定
  const firestorePackSettings = {};
  Object.keys(userSaveData.packSettings).forEach((packId) => {
    const setting = userSaveData.packSettings[packId];
    if (!setting) return;

    if (setting.status === "unconfigured") {
      return;
    }

    firestorePackSettings[packId] = {
      price: setting.price,
      status: setting.status,
    };
  });

  try {
    const worldDocRef = firestoreDoc(
      window.db,
      "users",
      userId,
      "worlds",
      worldId,
    );
    await setDoc(
      worldDocRef,
      {
        currentMilestones: firestoreMilestones,
        basePrice: userSaveData.basePrice,
        packSettings: firestorePackSettings,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    console.log(
      `🎯 クラウドへ保存完了。保存された有効設定数: ${Object.keys(firestorePackSettings).length}`,
    );
  } catch (error) {
    console.error("🚨 Firestoreへの保存に失敗しました:", error);
    throw error;
  }
}

function resetUserSaveData() {
  userSaveData.currentMilestones = {
    rank: "0",
    quest: "0-0",
    tower: "0",
    "tower-all": "0",
    "tower-blue": "0",
    "tower-red": "0",
    "tower-green": "0",
    "tower-yellow": "0",
  };
  userSaveData.packSettings = {};
}

// ==========================================
// 3. データ取得・構造変換
// ==========================================
async function loadPortalData() {
  try {
    const [packRes, itemRes] = await Promise.all([
      fetch("./assets/json/pack-master.json"),
      fetch("./assets/json/item-master.json"),
    ]);

    if (!packRes.ok || !itemRes.ok)
      throw new Error("JSONデータの取得に失敗しました。");

    const rawPackData = await packRes.json();
    const rawItemData = await itemRes.json();

    itemMasterMap = {};
    rawItemData.forEach((item) => {
      itemMasterMap[item.id] = {
        name: item.name,
        imagePath: item.imagePath || "assets/images/item/default.webp",
      };
    });

    packMasterData = rawPackData.map((group) => {
      const userSetting = userSaveData.packSettings[group.id] || {};
      const currentStatus = userSetting.status || "unconfigured";

      let selectedPrice = "11800";

      // 🌟 ステータスが「未設定」なら表示金額を無条件にベース金額に置き換える
      if (currentStatus === "unconfigured") {
        const hasBasePriceInMaster = group.packs?.some(
          (p) => String(p.price) === userSaveData.basePrice,
        );
        const fallbackPrice =
          group.packs && group.packs.length > 0
            ? String(group.packs[0].price)
            : "11800";
        selectedPrice = hasBasePriceInMaster
          ? userSaveData.basePrice
          : fallbackPrice;
      } else {
        // 未設定以外は過去の個別設定（なければマスタの初期値）
        selectedPrice = userSetting.price
          ? String(userSetting.price)
          : group.packs && group.packs.length > 0
            ? String(group.packs[0].price)
            : "11800";
      }

      let targetPack = group.packs.find(
        (p) => String(p.price) === selectedPrice,
      );
      if (!targetPack && group.packs && group.packs.length > 0) {
        targetPack = group.packs[0];
      }

      const rewardItems = (targetPack?.rewards || []).map((r) => {
        const itemMeta = itemMasterMap[r.item] || {
          name: r.item,
          imagePath: "assets/images/item/default.webp",
        };
        return {
          name: itemMeta.name,
          imagePath: itemMeta.imagePath,
          count: r.count,
        };
      });

      const catConfig = PACK_CATEGORIES.find((c) =>
        catConfigMatches(c.key, group.category),
      );

      return {
        id: group.id,
        category: group.category,
        milestone: group.milestone,
        target: `${catConfig ? catConfig.name : group.category} ${group.milestone}`,
        reward: rewardItems,
        allPacksRaw: group.packs,
        status: currentStatus,
        selectedPrice: selectedPrice,
      };
    });
  } catch (error) {
    console.error("マスタデータのパースに失敗しました:", error);
  }
}

// 🎯 【バグ修正】matchへのインデックス指定を追加してクラッシュを完全に排除
function extractNumber(str) {
  if (!str) return 0;
  const match = str.match(/\d+([-.]\d+)?/);
  if (!match) return 0;
  return parseFloat(match[0].replace("-", "."));
}

function syncTowerAllMilestone() {
  const blue = extractNumber(userSaveData.currentMilestones["tower-blue"]);
  const red = extractNumber(userSaveData.currentMilestones["tower-red"]);
  const green = extractNumber(userSaveData.currentMilestones["tower-green"]);
  const yellow = extractNumber(userSaveData.currentMilestones["tower-yellow"]);
  userSaveData.currentMilestones["tower-all"] = String(
    Math.min(blue, red, green, yellow),
  );
}

// ==========================================
// 4. モーダル生成・制御ロジック
// ==========================================
function openPackModal(packId) {
  const pack = packMasterData.find((p) => p.id === packId);
  if (!pack) return;

  const oldModal = document.getElementById("js-pack-modal");
  if (oldModal) oldModal.remove();
  const modalHtml = `
    <div id="js-pack-modal" class="c-modal-overlay">
      <div class="c-modal-window">
        <header class="c-modal-window__header"><h2>${pack.target}</h2></header>
        <div class="c-modal-window__body">
          <div class="p-modal-settings">
            
            <div class="p-modal-settings__group">
              <label>課金額:</label>
              <!-- 🌟 矢印ラッパーで囲む -->
              <div class="p-modal-settings__select-wrap">
                <select id="js-modal-price-select">
                  ${pack.allPacksRaw.map((p) => `<option value="${p.price}" ${String(p.price) === String(pack.selectedPrice) ? "selected" : ""}>${parseInt(p.price).toLocaleString()}円</option>`).join("")}
                </select>
              </div>
            </div>
            
            <div class="p-modal-settings__group">
              <label>ステータス:</label>
              <!-- 🌟 矢印ラッパーで囲む -->
              <div class="p-modal-settings__select-wrap">
                <select id="js-modal-status-select">
                  <option value="unconfigured" ${pack.status === "unconfigured" ? "selected" : ""}>未設定</option>
                  <option value="planned" ${pack.status === "planned" ? "selected" : ""}>購入予定</option>
                  <option value="pending" ${pack.status === "pending" ? "selected" : ""}>検討中</option>
                  <option value="ignored" ${pack.status === "ignored" ? "selected" : ""}>買わない</option>
                </select>
              </div>
            </div>
            
          </div>
          <div id="js-modal-reward-preview" class="p-modal-reward-list"></div>
        </div>
        <footer class="c-modal-window__footer"><button id="js-modal-close-btn" class="c-btn-close">閉じる</button></footer>
      </div>
    </div>

  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);
  updateModalPreview(packId);

  document
    .getElementById("js-modal-price-select")
    .addEventListener("change", async (e) => {
      updatePackPriceAndPreview(packId, e.target.value);
    });

  document
    .getElementById("js-modal-status-select")
    .addEventListener("change", (e) => {
      const newStatus = e.target.value;
      if (!userSaveData.packSettings[packId])
        userSaveData.packSettings[packId] = { price: pack.selectedPrice };
      userSaveData.packSettings[packId].status = newStatus;
      pack.status = newStatus;
    });

  const closeModal = () => {
    document.getElementById("js-pack-modal").remove();
    renderPackPortalOnlyCards();
  };

  document
    .getElementById("js-modal-close-btn")
    .addEventListener("click", closeModal);
  document.getElementById("js-pack-modal").addEventListener("click", (e) => {
    e.target === e.currentTarget && closeModal();
  });
}

function updatePackPriceAndPreview(packId, price) {
  const pack = packMasterData.find((p) => p.id === packId);
  if (!pack) return;

  if (!userSaveData.packSettings[packId])
    userSaveData.packSettings[packId] = { status: pack.status };
  userSaveData.packSettings[packId].price = price;
  pack.selectedPrice = price;

  const targetRaw = pack.allPacksRaw.find(
    (p) => String(p.price) === String(price),
  );
  pack.reward = (targetRaw?.rewards || []).map((r) => {
    const itemMeta = itemMasterMap[r.item] || {
      name: r.item,
      imagePath: "assets/images/item/default.webp",
    };
    return {
      name: itemMeta.name,
      imagePath: itemMeta.imagePath,
      count: r.count,
    };
  });

  updateModalPreview(packId);
}

function updateModalPreview(packId) {
  const pack = packMasterData.find((p) => p.id === packId);
  const previewArea = document.getElementById("js-modal-reward-preview");
  if (!pack || !previewArea) return;

  previewArea.innerHTML = pack.reward
    .map(
      (item) => `
    <div class="p-modal-reward-row">
      <img src="${item.imagePath}" alt="${item.name}" class="p-modal-reward-row__img" onerror="this.src='assets/images/item/default.webp'">
      <span class="p-modal-reward-row__name">${item.name}</span>
      <span class="p-pack-card__reward-count">×${item.count.toLocaleString()}</span>
    </div>
  `,
    )
    .join("");
}

// ==========================================
// 5. レンダリング制御
// ==========================================
function createPackCardHtml(pack) {
  const statusLabel =
    pack.status === "unconfigured"
      ? "未設定"
      : pack.status === "planned"
        ? "購入予定"
        : pack.status === "pending"
          ? "検討中"
          : "買わない";
  return `
    <article class="p-pack-card is-status-${pack.status} js-pack-card" data-pack-id="${pack.id}">
      <div class="p-pack-card__header-row">
        <h3 class="p-pack-card__target">${pack.target}</h3>
        <div class="p-pack-card__badges">
          <span class="p-pack-card__price-badge">${parseInt(pack.selectedPrice).toLocaleString()}円</span>
          <span class="p-pack-card__tag-badge">${statusLabel}</span>
        </div>
      </div>
      <div class="p-pack-card__reward-grid">
        ${pack.reward.map((item) => `<div class="p-pack-card__reward-item" title="${item.name}"><img src="${item.imagePath}" alt="${item.name}" class="p-pack-card__reward-img" onerror="this.src='assets/images/item/default.webp'"><span class="p-pack-card__reward-count">×${item.count.toLocaleString()}</span></div>`).join("")}
      </div>
    </article>
  `;
}

/**
 * 🗺️ [初回・切替専用] ボードの列骨組みと入力欄を完全に初期構築する
 */
function renderPackPortalFullStructure() {
  const urgentBoard = document.querySelector(".js-pack-urgent-board");
  const futureBoard = document.querySelector(".js-pack-future-board");
  const completedBoard = document.querySelector(".js-pack-completed-board");

  if (!urgentBoard || !futureBoard || !completedBoard) return;

  syncTowerAllMilestone();

  // 🌟 ゲーム内の現在の曜日を取得
  const currentDay = getGameCurrentDay();
  const openTowers = TOWER_SCHEDULE[currentDay] || [];

  const generateSkeleton = (isAccordion) => {
    return PACK_CATEGORIES.map((cat) => {
      const isTowerAll = cat.key === "tower-all";

      // 🌟 属性塔（blue, red, green, yellow）かつ、本日の開催リストに含まれていない場合は「非開催（暗転）」
      const isAttributeTower = [
        "tower-blue",
        "tower-red",
        "tower-green",
        "tower-yellow",
      ].includes(cat.key);
      const isTodayClosed = isAttributeTower && !openTowers.includes(cat.key);

      // 🌟 カラムごと暗転させるための状態クラス（is-tower-closed）を確定
      const columnStatusClass = isTodayClosed ? "is-tower-closed" : "";

      if (isAccordion) {
        return `
          <div class="p-pack-column p-pack-column--${cat.key} ${columnStatusClass}">
            <h4 class="p-pack-column__title">${cat.name}</h4>
            <div class="p-pack-gallery js-pack-gallery-space" data-cat-key="${cat.key}"></div>
          </div>`;
      }

      let inputHtml = "";

      if (cat.key === "quest") {
        const chVal = userSaveData.currentMilestones["quest-chapter"] || "0";
        const stVal = userSaveData.currentMilestones["quest-stage"] || "0";

        inputHtml = `
          <div class="p-pack-column__filter-quest">
            <div class="p-pack-quest-row">
              <div class="p-pack-mini-counter js-progress-item">
                <button type="button" class="p-pack-mini-counter__btn js-counter-minus">−</button>
                <input type="number" class="p-pack-mini-counter__input js-milestone-input-quest" data-cat-key="quest-chapter" value="${chVal}" inputmode="numeric" min="0">
                <button type="button" class="p-pack-mini-counter__btn js-counter-plus">+</button>
              </div>
              <span class="p-pack-quest-separator">-</span>
              <div class="p-pack-mini-counter js-progress-item">
                <button type="button" class="p-pack-mini-counter__btn js-counter-minus">−</button>
                <input type="number" class="p-pack-mini-counter__input js-milestone-input-quest" data-cat-key="quest-stage" value="${stVal}" inputmode="numeric" min="0">
                <button type="button" class="p-pack-mini-counter__btn js-counter-plus">+</button>
              </div>
            </div>
            <input type="hidden" class="js-milestone-input" data-cat-key="quest" value="${userSaveData.currentMilestones["quest"] || "0-0"}">
          </div>`;
      } else {
        // 🌟 【修正】isTodayClosed による readonly 制限を完全撤廃。「属性塔(全)」のみを readonly に制限します。
        const isReadOnly = isTowerAll;

        inputHtml = `
          <div class="p-pack-column__filter ${isReadOnly ? "is-disabled-filter" : ""} js-progress-item">
            <div class="p-pack-counter-field">
              ${isReadOnly ? "" : `<button type="button" class="p-pack-counter-btn js-counter-minus">−</button>`}
              <input type="number" 
                     class="p-pack-counter-input p-pack-counter-input--single js-milestone-input" 
                     data-cat-key="${cat.key}" 
                     value="${userSaveData.currentMilestones[cat.key] || "0"}" 
                     inputmode="numeric"
                     min="0"
                     ${isReadOnly ? "readonly tabindex='-1'" : ""}>
              ${isReadOnly ? "" : `<button type="button" class="p-pack-counter-btn js-counter-plus">+</button>`}
            </div>
          </div>`;
      }

      // 🌟 各カラムの最外枠
      return `
        <div class="p-pack-column p-pack-column--${cat.key} ${columnStatusClass}">
          <h4 class="p-pack-column__title">${cat.name}</h4>
          ${inputHtml}
          <div class="p-pack-gallery js-pack-gallery-space" data-cat-key="${cat.key}"></div>
        </div>`;
    }).join("");
  };

  urgentBoard.innerHTML = generateSkeleton(false);
  futureBoard.innerHTML = generateSkeleton(true);
  completedBoard.innerHTML = generateSkeleton(true);

  renderPackPortalOnlyCards();
  bindInputEvents();
}

function renderPackPortalOnlyCards() {
  syncTowerAllMilestone();

  const towerAllInput = document.querySelector(
    '.js-milestone-input[data-cat-key="tower-all"]',
  );
  if (towerAllInput)
    towerAllInput.value = userSaveData.currentMilestones["tower-all"];

  let completedPacks = [];
  let uncollectedPacks = [];

  packMasterData.forEach((pack) => {
    const userProgress = userSaveData.currentMilestones[pack.category] || "0";
    if (extractNumber(pack.milestone) <= extractNumber(userProgress)) {
      completedPacks.push(pack);
    } else {
      uncollectedPacks.push(pack);
    }
  });

  document.querySelectorAll(".js-pack-gallery-space").forEach((space) => {
    space.innerHTML = "";
  });

  PACK_CATEGORIES.forEach((cat) => {
    const catUncollected = uncollectedPacks.filter((p) =>
      catConfigMatches(cat.key, p.category),
    );
    catUncollected.sort(
      (a, b) => extractNumber(a.milestone) - extractNumber(b.milestone),
    );

    const catCompleted = completedPacks.filter((p) =>
      catConfigMatches(cat.key, p.category),
    );
    catCompleted.sort(
      (a, b) => extractNumber(a.milestone) - extractNumber(b.milestone),
    );

    const urgentList = catUncollected.slice(0, 3);
    const futureList = catUncollected.slice(3);

    const urgentSpace = document.querySelector(
      `.js-pack-urgent-board .js-pack-gallery-space[data-cat-key="${cat.key}"]`,
    );
    const futureSpace = document.querySelector(
      `.js-pack-future-board .js-pack-gallery-space[data-cat-key="${cat.key}"]`,
    );
    const completedSpace = document.querySelector(
      `.js-pack-completed-board .js-pack-gallery-space[data-cat-key="${cat.key}"]`,
    );

    if (urgentSpace)
      urgentSpace.innerHTML =
        urgentList.length > 0
          ? urgentList.map(createPackCardHtml).join("")
          : '<p class="p-pack-empty-text">表示対象なし</p>';
    if (futureSpace)
      futureSpace.innerHTML =
        futureList.length > 0
          ? futureList.map(createPackCardHtml).join("")
          : '<p class="p-pack-empty-text">表示対象なし</p>';
    if (completedSpace)
      completedSpace.innerHTML =
        catCompleted.length > 0
          ? catCompleted.map(createPackCardHtml).join("")
          : '<p class="p-pack-empty-text">表示対象なし</p>';
  });

  document.querySelectorAll(".js-pack-card").forEach((card) => {
    card.addEventListener("click", () => openPackModal(card.dataset.packId));
  });
}

// ==========================================
// 6. インタラクション・イベント制御
// ==========================================
function bindInputEvents() {
  document
    .querySelectorAll(".js-milestone-input, .js-milestone-input-quest")
    .forEach((input) => {
      if (input.hasAttribute("readonly")) return;

      input.addEventListener("input", (e) => {
        const catKey = input.dataset.catKey;
        userSaveData.currentMilestones[catKey] = e.target.value;

        if (catKey === "quest-chapter" || catKey === "quest-stage") {
          const chInput = document.querySelector(
            '.js-milestone-input-quest[data-cat-key="quest-chapter"]',
          );
          const stInput = document.querySelector(
            '.js-milestone-input-quest[data-cat-key="quest-stage"]',
          );
          const ch = chInput ? chInput.value.trim() : "0";
          const st = stInput ? stInput.value.trim() : "0";
          const combinedQuest = `${ch}-${st}`;
          userSaveData.currentMilestones["quest"] = combinedQuest;
          const hiddenQuestInput = document.querySelector(
            '.js-milestone-input[data-cat-key="quest"]',
          );
          if (hiddenQuestInput) hiddenQuestInput.value = combinedQuest;
        }

        clearTimeout(window.milestoneTimeout);
        window.milestoneTimeout = setTimeout(() => {
          renderPackPortalOnlyCards();
        }, 350);
      });
    });
}

function initAccordion() {
  document.querySelectorAll(".js-archive-toggle").forEach((toggleBtn) => {
    toggleBtn.addEventListener("click", (e) => {
      const btn = e.currentTarget;
      const targetId = btn.dataset.target;
      const contentEl = document.getElementById(`board-${targetId}`);

      if (!contentEl) return;

      const expanded = btn.getAttribute("aria-expanded") === "true";
      const nextState = !expanded;

      btn.setAttribute("aria-expanded", String(nextState));
      btn.querySelector(".js-archive-icon").textContent = nextState ? "▲" : "▼";

      if (nextState) {
        btn.classList.add("is-open");
        contentEl.classList.add("is-open");
      } else {
        btn.classList.remove("is-open");
        contentEl.classList.remove("is-open");
      }
    });
  });
}

function bindUpdateTrigger(userId, worldId) {
  const updateBtn = document.getElementById("js-pack-btn-update");
  if (!updateBtn) return;

  updateBtn.replaceWith(updateBtn.cloneNode(true));
  const newUpdateBtn = document.getElementById("js-pack-btn-update");

  newUpdateBtn.addEventListener("click", async () => {
    try {
      newUpdateBtn.disabled = true;
      newUpdateBtn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';

      document
        .querySelectorAll(".js-milestone-input, .js-milestone-input-quest")
        .forEach((input) => {
          const catKey = input.dataset.catKey;
          if (catKey)
            userSaveData.currentMilestones[catKey] = input.value.trim() || "0";
        });

      const chInput = document.querySelector(
        '.js-milestone-input-quest[data-cat-key="quest-chapter"]',
      );
      const stInput = document.querySelector(
        '.js-milestone-input-quest[data-cat-key="quest-stage"]',
      );
      if (chInput || stInput) {
        const ch = chInput ? chInput.value.trim() : "0";
        const st = stInput ? stInput.value.trim() : "0";
        userSaveData.currentMilestones["quest"] = `${ch}-${st}`;
      }

      userSaveData.packSettings = {};

      packMasterData.forEach((pack) => {
        const currentPrice = pack.selectedPrice || "11800";
        const currentStatus = pack.status || "unconfigured";
        const defaultPrice =
          pack.allPacksRaw && pack.allPacksRaw.length > 0
            ? String(pack.allPacksRaw[0].price)
            : "11800";

        if (currentStatus !== "unconfigured" || currentPrice !== defaultPrice) {
          userSaveData.packSettings[pack.id] = {
            price: currentPrice,
            status: currentStatus,
          };
        }
      });

      syncTowerAllMilestone();
      await saveUserPackDataToFirestore(userId, worldId);
      await loadPortalData();
      renderPackPortalOnlyCards();

      newUpdateBtn.classList.add("is-success-flash");
      newUpdateBtn.innerHTML =
        '<i class="fa-solid fa-circle-check"></i> 更新完了！';
      setTimeout(() => {
        alert(
          "進捗、およびカスタム変更された達成パックのみをクラウドへ正常に保存しました！",
        );
      }, 100);
    } catch (error) {
      alert("データの保存に失敗しました。通信環境を確認してください。");
    } finally {
      newUpdateBtn.disabled = false;
      setTimeout(() => {
        newUpdateBtn.classList.remove("is-success-flash");
        newUpdateBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> 更新する';
      }, 1500);
    }
  });
}

// ==========================================
// 🔒 7. リアルタイム認証ゲート監視
// ==========================================
const auth = getAuth();

onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log(`👤 [Packs] ログイン確認 (UID: ${user.uid})`);
    const activeWorldId = sessionStorage.getItem("app_current_world_id");

    if (activeWorldId) {
      await loadUserPackDataFromFirestore(user.uid, activeWorldId);
      initBasePriceSelector(); // 🌟 ベースセレクターの監視初期化
      await loadPortalData();
      renderPackPortalFullStructure();
      initAccordion();
      bindUpdateTrigger(user.uid, activeWorldId);
    } else {
      const urgentBoard = document.querySelector(".js-pack-urgent-board");
      if (urgentBoard) {
        urgentBoard.innerHTML = `<p class="p-pack-empty-text p-pack-empty-text--full-width">ヘッダーのワールド選択から、管理するワールドを選んでください。</p>`;
      }
    }
  } else {
    window.location.href = "login.html";
  }
});

window.addEventListener("appWorldChanged", async (e) => {
  const newWorldId = e.detail.worldId;
  const user = auth.currentUser;
  if (user && newWorldId) {
    await loadUserPackDataFromFirestore(user.uid, newWorldId);
    await loadPortalData();
    renderPackPortalFullStructure();
    bindUpdateTrigger(user.uid, newWorldId);
  }
});

// ==========================================
// 🚀 トップへ戻るボタン
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const scrollToTopBtn = document.getElementById("scrollToTopBtn");
  if (!scrollToTopBtn) return;

  let lastScrollY = window.scrollY;

  window.addEventListener("scroll", () => {
    const currentScrollY = window.scrollY;
    if (currentScrollY < 300) {
      scrollToTopBtn.classList.remove("is-show");
    } else if (currentScrollY < lastScrollY) {
      scrollToTopBtn.classList.add("is-show");
    } else {
      scrollToTopBtn.classList.remove("is-show");
    }
    lastScrollY = currentScrollY;
  });

  scrollToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

// ==========================================
// ➕➖ 完全数値型ポチポチ一括制御 ＆ クエスト自動結合ロジック
// ==========================================
document.addEventListener("click", (event) => {
  const isPlus = event.target.classList.contains("js-counter-plus");
  const isMinus = event.target.classList.contains("js-counter-minus");

  if (!isPlus && !isMinus) return;

  // ボタンから一番近い progress-item（入力の塊）を探す
  const container = event.target.closest(".js-progress-item");
  if (!container) return;

  // 通常のインプットか、クエスト専用のインプットかを自動判定して取得
  const inputEl =
    container.querySelector(".js-milestone-input") ||
    container.querySelector(".js-milestone-input-quest");
  if (!inputEl) return;

  const catKey = inputEl.dataset.catKey;
  let currentValue = parseInt(inputEl.value, 10) || 0;
  const min = parseInt(inputEl.min, 10) || 0;

  // 数値の増減処理
  if (isPlus) {
    currentValue++;
  } else if (isMinus && currentValue > min) {
    currentValue--;
  }

  // 画面の数字を書き換え、内部ステートを更新
  inputEl.value = String(currentValue);
  userSaveData.currentMilestones[catKey] = String(currentValue);

  // 🌟 クエスト（章・ステージ）が動いた場合は、両方の最新値を安全にガッチャンコして同期する
  if (catKey === "quest-chapter" || catKey === "quest-stage") {
    const chInput = document.querySelector(
      '.js-milestone-input-quest[data-cat-key="quest-chapter"]',
    );
    const stInput = document.querySelector(
      '.js-milestone-input-quest[data-cat-key="quest-stage"]',
    );

    const ch = chInput ? chInput.value.trim() : "0";
    const st = stInput ? stInput.value.trim() : "0";
    const combinedQuest = `${ch}-${st}`;

    // 内部データと、クラウド保存時にスキャンされる隠し input の値を完全に同期
    userSaveData.currentMilestones["quest"] = combinedQuest;
    const hiddenQuestInput = document.querySelector(
      '.js-milestone-input[data-cat-key="quest"]',
    );
    if (hiddenQuestInput) hiddenQuestInput.value = combinedQuest;
  }

  // リアルタイムにパックの達成・未達成判定を回して再描画
  renderPackPortalOnlyCards();
});

// 🌟 画面上のベース課金帯セレクターの値の同期
function syncBasePriceSelectorUI() {
  const selector = document.getElementById("js-base-price-select");
  if (selector) {
    selector.value = userSaveData.basePrice;
  }
}

// 🌟 基準課金帯セレクターの動的生成 ＆ イベント初期化
function initBasePriceSelector() {
  const container = document.querySelector(".js-base-price-container");
  if (!container) return;

  // 冒頭の定数配列（BASE_PRICE_OPTIONS）を元にBEM準拠のHTMLを組み立てる
  const optionsHtml = BASE_PRICE_OPTIONS.map((opt) => {
    const isSelected =
      String(opt.value) === String(userSaveData.basePrice) ? "selected" : "";
    return `<option value="${opt.value}" ${isSelected}>${opt.label}</option>`;
  }).join("");

  container.innerHTML = `
    <div class="p-pack-base-filter">
      <label for="js-base-price-select" class="p-pack-base-filter__label">ベースの課金額：</label>
      <div class="p-pack-base-filter__select-wrap">
        <select id="js-base-price-select" class="p-pack-base-filter__select">
          ${optionsHtml}
        </select>
      </div>
       <span class="p-pack-base-filter__note">※ステータスが「未設定」の項目のみ、ここで選んだ金額の内容に一括で置き換わります。</span>
    </div>
  `;

  // 生成したセレクターに対してチェンジイベントを付与
  const selector = document.getElementById("js-base-price-select");
  if (!selector) return;

  selector.addEventListener("change", async (e) => {
    userSaveData.basePrice = e.target.value;
    console.log(`💎 基準課金帯が変更されました: ${userSaveData.basePrice}円帯`);

    // マスタデータの初期金額の再マッピングを行って一括リフレッシュ
    await loadPortalData();
    renderPackPortalOnlyCards();
  });
}
