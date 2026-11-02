/**
 * pack-manager.js (1/3)
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

      // ① 進捗情報 (currentMilestones) の復元
      if (data.currentMilestones) {
        Object.keys(data.currentMilestones).forEach((dbKey) => {
          const appKey = dbKey.replace(/_/g, "-"); // 進捗キーのハイフン吸収
          userSaveData.currentMilestones[appKey] = String(
            data.currentMilestones[dbKey] || "0",
          );
        });
      } else {
        // メイン側データからの自動コンバート救済
        userSaveData.currentMilestones["rank"] = "0";
        userSaveData.currentMilestones["quest"] = data.questProgress || "0-0";
        userSaveData.currentMilestones["tower"] = String(
          data.towerMuguu || "0",
        );
        userSaveData.currentMilestones["tower-blue"] = String(
          data.towerBlue || "0",
        );
        userSaveData.currentMilestones["tower-red"] = String(
          data.towerRed || "0",
        );
        userSaveData.currentMilestones["tower-green"] = String(
          data.towerGreen || "0",
        );
        userSaveData.currentMilestones["tower-yellow"] = String(
          data.towerYellow || "0",
        );
      }

      // ② 各パックの個別カスタム設定 (packSettings) の復元
      // 🌟【最重要修正】マスタIDの形を崩さないよう、IDの文字列変換・置換を一切禁止します
      if (data.packSettings) {
        Object.keys(data.packSettings).forEach((packId) => {
          userSaveData.packSettings[packId] = {
            price: String(data.packSettings[packId].price || "11800"),
            status: data.packSettings[packId].status || "planned",
          };
        });
      }
      console.log(
        "✅ Firestoreからのパックデータ復元が完了しました。",
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
    const dbKey = key.replace(/-/g, "_");
    firestoreMilestones[dbKey] = userSaveData.currentMilestones[key];
  });

  // 🌟【最重要修正】パックIDの置換・変換を廃止し、元のIDのままでオブジェクトを構築
  const firestorePackSettings = {};
  Object.keys(userSaveData.packSettings).forEach((packId) => {
    firestorePackSettings[packId] = {
      price: userSaveData.packSettings[packId].price,
      status: userSaveData.packSettings[packId].status,
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
        packSettings: firestorePackSettings,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    console.log(
      `🎯 ワールド [${worldId}] のパックデータをクラウドへコミットしました。`,
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
// 3. データ取得・構造変換（クラウド設定反映・4択ステータス同期版）
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

      const defaultPrice =
        group.packs && group.packs.length > 0
          ? String(group.packs[0].price)
          : "11800";
      const selectedPrice = userSetting.price
        ? String(userSetting.price)
        : defaultPrice;

      // 🌟 デフォルト値を「unconfigured（未設定）」に指定
      const currentStatus = userSetting.status || "unconfigured";

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

    console.log(
      "🎯 4択ステータスをローカルマスタへ完全同期しました。",
      packMasterData,
    );
  } catch (error) {
    console.error("マスタデータのパースに失敗しました:", error);
  }
}

function extractNumber(str) {
  if (!str) return 0;
  const match = str.match(/\d+([-.]\d+)?/);
  if (!match) return 0;
  // 🌟 修正：matchオブジェクトではなく、抽出された文字列「match[0]」に対して置換を行います
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
// 4. モーダル生成・制御ロジック（4択セレクトボックス化）
// ==========================================
function openPackModal(packId) {
  const pack = packMasterData.find((p) => p.id === packId);
  if (!pack) return;

  const oldModal = document.getElementById("js-pack-modal");
  if (oldModal) oldModal.remove();

  // 🌟 ステータスのセレクトボックスを4択に拡張
  const modalHtml = `
    <div id="js-pack-modal" class="c-modal-overlay">
      <div class="c-modal-window">
        <header class="c-modal-window__header"><h2>${pack.target}</h2></header>
        <div class="c-modal-window__body">
          <div class="p-modal-settings">
            <div class="p-modal-settings__group">
              <label>課金額:</label>
              <select id="js-modal-price-select">
                ${pack.allPacksRaw.map((p) => `<option value="${p.price}" ${String(p.price) === String(pack.selectedPrice) ? "selected" : ""}>${parseInt(p.price).toLocaleString()}円</option>`).join("")}
              </select>
            </div>
            <div class="p-modal-settings__group">
              <label>ステータス:</label>
              <select id="js-modal-status-select">
                <option value="unconfigured" ${pack.status === "unconfigured" ? "selected" : ""}>未設定</option>
                <option value="planned" ${pack.status === "planned" ? "selected" : ""}>購入予定</option>
                <option value="pending" ${pack.status === "pending" ? "selected" : ""}>検討中</option>
                <option value="ignored" ${pack.status === "ignored" ? "selected" : ""}>買わない</option>
              </select>
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
// 5. レンダリング制御（入力欄を破壊しない工夫・4択バッジ対応）
// ==========================================
function createPackCardHtml(pack) {
  // 🌟 ステータスに応じた適切なテキストラベルを生成
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

  const generateSkeleton = (isAccordion) => {
    return PACK_CATEGORIES.map((cat) => {
      const isTowerAll = cat.key === "tower-all";
      const inputHtml = isAccordion
        ? ""
        : `
        <div class="p-pack-column__filter ${isTowerAll ? "is-disabled-filter" : ""}">
          <label>現在進捗:</label>
          <input type="text" class="js-milestone-input" data-cat-key="${cat.key}" value="${userSaveData.currentMilestones[cat.key] || "0"}" placeholder="例: 14-28" ${isTowerAll ? "readonly tabindex='-1'" : ""}>
        </div>`;
      return `
        <div class="p-pack-column p-pack-column--${cat.key}">
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

/**
 * 🃏 [超重要] 入力欄を一切壊さず、カードのギャラリースペースだけをクリアして再分配する高速描画関数
 */
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
  document.querySelectorAll(".js-milestone-input").forEach((input) => {
    if (input.hasAttribute("readonly")) return;

    input.addEventListener("input", (e) => {
      const catKey = input.dataset.catKey;
      userSaveData.currentMilestones[catKey] = e.target.value;

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
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", !expanded);
      btn.querySelector(".js-archive-icon").textContent = expanded ? "▼" : "▲";
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

      // ① 進捗入力欄の数値を一括回収
      document.querySelectorAll(".js-milestone-input").forEach((input) => {
        const catKey = input.dataset.catKey;
        if (catKey)
          userSaveData.currentMilestones[catKey] = input.value.trim() || "0";
      });

      // ==========================================================================
      // 🌟【最重要修正】未設定(デフォルト価格)のパックはFirestoreに一切書き込まない
      // ==========================================================================
      userSaveData.packSettings = {}; // 一旦初期化して差分だけを回収

      packMasterData.forEach((pack) => {
        const currentPrice = pack.selectedPrice || "11800";
        const currentStatus = pack.status || "unconfigured";

        const defaultPrice =
          pack.allPacksRaw && pack.allPacksRaw.length > 0
            ? String(pack.allPacksRaw[0].price)
            : "11800";

        // 「ステータスが未設定」かつ「価格もデフォルト価格のまま」ならクラウド保存対象から除外！
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
      await loadPortalData();
      renderPackPortalFullStructure();
      initAccordion();
      bindUpdateTrigger(user.uid, activeWorldId);
    } else {
      const urgentBoard = document.querySelector(".js-pack-urgent-board");
      if (urgentBoard)
        urgentBoard.innerHTML = `<p class="p-pack-empty-text" style="grid-column: 1/-1; padding: 40px;">ヘッダーのワールド選択から、管理するワールドを選んでください。</p>`;
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
// 🚀 トップへ戻るボタン (Scroll To Top) スマートスクロール制御ロジック
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const scrollToTopBtn = document.getElementById("scrollToTopBtn");
  if (!scrollToTopBtn) return;

  // 直前のスクロール位置を記録する変数
  let lastScrollY = window.scrollY;

  window.addEventListener("scroll", () => {
    const currentScrollY = window.scrollY;

    // ① そもそもスクロール位置が300px未満なら絶対に非表示
    if (currentScrollY < 300) {
      scrollToTopBtn.classList.remove("is-show");
    }
    // ② 300px以上スクロールしており、かつ「上スクロール」を検知した場合のみ表示
    else if (currentScrollY < lastScrollY) {
      scrollToTopBtn.classList.add("is-show");
    }
    // ③ 下スクロール中の場合は非表示にする
    else {
      scrollToTopBtn.classList.remove("is-show");
    }

    // 現在のスクロール位置を次の判定用に記憶
    lastScrollY = currentScrollY;
  });

  // ボタンクリック時に最上部へスムーズスクロール
  scrollToTopBtn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });
});
