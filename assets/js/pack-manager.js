/**
 * pack-manager.js (1/2)
 * 達成パック管理・マイルストーン自動フィルタ＆3ステータスモーダル完全版
 */

// ==========================================
// 1. 状態管理（ステータス）
// ==========================================
let packMasterData = [];
let itemMasterMap = {}; // アイテムIDをキーにしたオブジェクトマスタのキャッシュ

// ユーザーのセーブデータ構造（画面右下の更新ボタンで一括保存される想定）
let userSaveData = {
  // 各カテゴリーの現在マイルストーン（初期値：0）
  currentMilestones: {
    rank: "0",
    quest: "0-0",
    tower: "0",
    "tower-all": "0", // 🌟 4つの属性塔の最小値が自動で同期されます
    "tower-blue": "0",
    "tower-red": "0",
    "tower-green": "0",
    "tower-yellow": "0",
  },
  // 各パック固有の設定情報（ユーザーがモーダルで変更したもの）
  packSettings: {
    // "p_quest_7-28": { price: "11800", status: "planned" } のように保存されます
  },
};

// 全画面で共通使用する固定の8カテゴリー定義
const PACK_CATEGORIES = [
  { key: "rank", name: "ランク" },
  { key: "quest", name: "クエスト" },
  { key: "tower", name: "無窮の塔" },
  { key: "tower-blue", name: "属性塔(藍)" },
  { key: "tower-red", name: "属性塔(紅)" },
  { key: "tower-green", name: "属性塔(翠)" },
  { key: "tower-yellow", name: "属性塔(黄)" },
  { key: "tower-all", name: "属性塔(全)" }, // 🌟 手入力させないカテゴリ
];

// アンダースコアとハイフンを同一視してカテゴリーを判定するヘルパー
function catConfigMatches(key, jsonCategory) {
  if (!key || !jsonCategory) return false;
  return key.replace("-", "_") === jsonCategory.replace("-", "_");
}

// ==========================================
// 2. データ取得・構造変換
// ==========================================
async function loadPortalData() {
  try {
    // パックマスタとアイテムマスタのjsonを同時に並列取得
    const [packRes, itemRes] = await Promise.all([
      fetch("./assets/json/pack-master.json"),
      fetch("./assets/json/item-master.json"),
    ]);

    if (!packRes.ok)
      throw new Error(`パックデータ読込エラー: ${packRes.status}`);
    if (!itemRes.ok)
      throw new Error(`アイテムデータ読込エラー: ${itemRes.status}`);

    const rawPackData = await packRes.json();
    const rawItemData = await itemRes.json();

    // アイテムマスタをオブジェクト型でマッピング（名前と画像パスを保持）
    rawItemData.forEach((item) => {
      itemMasterMap[item.id] = {
        name: item.name,
        imagePath: item.imagePath || "assets/images/item/default.webp", // 代替用
      };
    });

    // パックマスタ構造をアプリのカード用フラット形式に変換
    const formattedData = rawPackData.map((group) => {
      // ユーザー設定があればそれを適用、なければデフォルトで最高額の11800円を表示
      const userSetting = userSaveData.packSettings[group.id] || {};
      const selectedPrice = userSetting.price || "11800";
      const currentStatus = userSetting.status || "planned"; // デフォルト：購入予定

      // 選択された価格のパックを抽出。見つからない場合は最初のパックをフォールバック
      const targetPack =
        group.packs.find((p) => p.price === selectedPrice) ||
        (group.packs.length > 0 ? group.packs : null);

      // 報酬アイテム配列をHTML描画用のオブジェクト配列に変換
      const rewardItems =
        targetPack && targetPack.rewards
          ? targetPack.rewards.map((r) => {
              const itemMeta = itemMasterMap[r.item] || {
                name: r.item,
                imagePath: "assets/images/item/default.webp",
              };
              return {
                name: itemMeta.name,
                imagePath: itemMeta.imagePath,
                count: r.count,
              };
            })
          : [];

      // カテゴリーの日本語名を取得
      const catConfig = PACK_CATEGORIES.find((c) =>
        catConfigMatches(c.key, group.category),
      );
      const categoryName = catConfig ? catConfig.name : group.category;

      return {
        id: group.id,
        category: group.category,
        milestone: group.milestone,
        target: `${categoryName} ${group.milestone}`,
        reward: rewardItems,
        allPacksRaw: group.packs, // モーダル切り替え用の元データを保持
        status: currentStatus,
        selectedPrice: selectedPrice,
      };
    });

    packMasterData = formattedData;
  } catch (error) {
    console.error("データの読み込みまたはパースに失敗しました:", error);
  }
}

function extractNumber(str) {
  if (!str) return 0;
  const match = str.match(/\d+([-.]\d+)?/);
  if (!match) return 0;
  const numStr = match[0].replace("-", ".");
  return parseFloat(numStr);
}

// 🌟 属性塔4種の最低値を計算して「属性塔(全)」に自動セットするロジック
function syncTowerAllMilestone() {
  const blue = extractNumber(userSaveData.currentMilestones["tower-blue"]);
  const red = extractNumber(userSaveData.currentMilestones["tower-red"]);
  const green = extractNumber(userSaveData.currentMilestones["tower-green"]);
  const yellow = extractNumber(userSaveData.currentMilestones["tower-yellow"]);

  // 4つの中で最も進捗の低い数値を算出
  const minVal = Math.min(blue, red, green, yellow);

  // 内部進捗文字列として反映（マイルストーン判定用にドットをハイフンに戻さないフラット処理）
  userSaveData.currentMilestones["tower-all"] = String(minVal);
}

// ==========================================
// 3. モーダル生成・制御ロジック
// ==========================================
function openPackModal(packId) {
  const pack = packMasterData.find((p) => p.id === packId);
  if (!pack) return;

  const oldModal = document.getElementById("js-pack-modal");
  if (oldModal) oldModal.remove();

  const modalHtml = `
    <div id="js-pack-modal" class="c-modal-overlay">
      <div class="c-modal-window">
        <header class="c-modal-window__header">
          <h2>${pack.target}</h2>
        </header>
        
        <div class="c-modal-window__body">
          <div class="p-modal-settings">
            <div class="p-modal-settings__group">
              <label>課金額:</label>
              <select id="js-modal-price-select" data-pack-id="${pack.id}">
                ${pack.allPacksRaw
                  .map(
                    (p) => `
                  <option value="${p.price}" ${p.price === pack.selectedPrice ? "selected" : ""}>
                    ${parseInt(p.price).toLocaleString()}円
                  </option>
                `,
                  )
                  .join("")}
              </select>
            </div>
            <div class="p-modal-settings__group">
              <label>ステータス:</label>
              <select id="js-modal-status-select" data-pack-id="${pack.id}">
                <option value="planned" ${pack.status === "planned" ? "selected" : ""}>購入予定</option>
                <option value="pending" ${pack.status === "pending" ? "selected" : ""}>検討中</option>
                <option value="ignored" ${pack.status === "ignored" ? "selected" : ""}>買わない</option>
              </select>
            </div>
          </div>

          <div id="js-modal-reward-preview" class="p-modal-reward-list"></div>
        </div>

        <footer class="c-modal-window__footer">
          <button id="js-modal-close-btn" class="c-btn-close">閉じる</button>
        </footer>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);
  updateModalPreview(packId);

  document
    .getElementById("js-modal-price-select")
    .addEventListener("change", (e) => {
      updatePackPriceAndPreview(packId, e.target.value);
    });

  document
    .getElementById("js-modal-status-select")
    .addEventListener("change", (e) => {
      const newStatus = e.target.value;
      if (!userSaveData.packSettings[packId]) {
        userSaveData.packSettings[packId] = { price: pack.selectedPrice };
      }
      userSaveData.packSettings[packId].status = newStatus;
      pack.status = newStatus;
    });

  const closeModal = () => {
    document.getElementById("js-pack-modal").remove();
    renderPackPortal();
  };

  document
    .getElementById("js-modal-close-btn")
    .addEventListener("click", closeModal);
  document.getElementById("js-pack-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
}

function updatePackPriceAndPreview(packId, price) {
  const pack = packMasterData.find((p) => p.id === packId);
  if (!pack) return;

  if (!userSaveData.packSettings[packId]) {
    userSaveData.packSettings[packId] = { status: pack.status };
  }
  userSaveData.packSettings[packId].price = price;
  pack.selectedPrice = price;

  const targetRaw = pack.allPacksRaw.find((p) => p.price === price);
  pack.reward = targetRaw
    ? targetRaw.rewards.map((r) => {
        const itemMeta = itemMasterMap[r.item] || {
          name: r.item,
          imagePath: "assets/images/item/default.webp",
        };
        return {
          name: itemMeta.name,
          imagePath: itemMeta.imagePath,
          count: r.count,
        };
      })
    : [];

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
// 4. コアレンダリング（3エリア独立分配 & フィルタ処理）
// ==========================================
function createPackCardHtml(pack) {
  const statusClass = `is-status-${pack.status}`;
  const statusLabel =
    pack.status === "planned"
      ? "購入予定"
      : pack.status === "pending"
        ? "検討中"
        : "買わない";

  const priceLabel = `${parseInt(pack.selectedPrice).toLocaleString()}円`;

  const rewardGridItems = pack.reward
    .map(
      (item) => `
    <div class="p-pack-card__reward-item" title="${item.name}">
      <img src="${item.imagePath}" alt="${item.name}" class="p-pack-card__reward-img" onerror="this.src='assets/images/item/default.webp'">
      <span class="p-pack-card__reward-count">×${item.count.toLocaleString()}</span>
    </div>
  `,
    )
    .join("");

  return `
    <article class="p-pack-card ${statusClass} js-pack-card" data-pack-id="${pack.id}">
      <div class="p-pack-card__header-row">
        <h3 class="p-pack-card__target">${pack.target}</h3>
        <div class="p-pack-card__badges">
          <span class="p-pack-card__price-badge">${priceLabel}</span>
          <span class="p-pack-card__tag-badge">${statusLabel}</span>
        </div>
      </div>
      <div class="p-pack-card__reward-grid">
        ${rewardGridItems}
      </div>
    </article>
  `;
}

function generateBoardColumnsHtml(sourcePackList, isAccordionSection = false) {
  // 🌟 修正：catPacks.length === 0 でも return "" せず、常に8列すべてを生成する
  return PACK_CATEGORIES.map((cat) => {
    let catPacks = sourcePackList.filter((pack) =>
      catConfigMatches(cat.key, pack.category),
    );

    // 進行度（マイルストーン数値）が小さい順に昇順ソート
    catPacks.sort(
      (a, b) => extractNumber(a.milestone) - extractNumber(b.milestone),
    );

    // アコーディオンエリア以外なら、枠と入力欄を必ず表示する
    let inputFieldHtml = "";
    if (!isAccordionSection) {
      const isTowerAll = cat.key === "tower-all";

      inputFieldHtml = `
        <div class="p-pack-column__filter ${isTowerAll ? "is-disabled-filter" : ""}">
          <label>現在進捗:</label>
          <input type="text" 
                 class="js-milestone-input" 
                 data-cat-key="${cat.key}" 
                 value="${userSaveData.currentMilestones[cat.key] || "0"}" 
                 placeholder="例: 14-28"
                 ${isTowerAll ? "readonly tabindex='-1'" : ""}>
        </div>
      `;
    }

    // 🌟 カードが0件の場合のプレースホルダー表現
    const cardsHtml =
      catPacks.length > 0
        ? catPacks.map((pack) => createPackCardHtml(pack)).join("")
        : `<p class="p-pack-empty-text">表示対象なし</p>`;

    return `
      <div class="p-pack-column p-pack-column--${cat.key}">
        <h4 class="p-pack-column__title">${cat.name}</h4>
        ${inputFieldHtml}
        <div class="p-pack-gallery">
          ${cardsHtml}
        </div>
      </div>
    `;
  }).join("");
}

function renderPackPortal() {
  const urgentBoard = document.querySelector(".js-pack-urgent-board");
  const futureBoard = document.querySelector(".js-pack-future-board");
  const completedBoard = document.querySelector(".js-pack-completed-board");

  if (!urgentBoard || !futureBoard || !completedBoard) return;

  // レンダリング直前に属性塔(全)の数値を最新の4塔から自動同期
  syncTowerAllMilestone();

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

  let urgentPacks = [];
  let futurePacks = [];

  PACK_CATEGORIES.forEach((cat) => {
    const catUncollected = uncollectedPacks.filter((pack) =>
      catConfigMatches(cat.key, pack.category),
    );
    catUncollected.sort(
      (a, b) => extractNumber(a.milestone) - extractNumber(b.milestone),
    );

    // 🌟 各ボードへの分配自体は行う（空の配列になっても下の generateBoardColumnsHtml が列を維持します）
    urgentPacks = urgentPacks.concat(catUncollected.slice(0, 3));
    futurePacks = futurePacks.concat(catUncollected.slice(3));
  });

  // 🌟 ボード全体のデータ有無判定ではなく、常に generateBoardColumnsHtml を呼び出して固定表示
  urgentBoard.innerHTML = generateBoardColumnsHtml(urgentPacks, false);
  futureBoard.innerHTML = generateBoardColumnsHtml(futurePacks, true);
  completedBoard.innerHTML = generateBoardColumnsHtml(completedPacks, true);

  bindEvents();
}

// ==========================================
// 5. インタラクション・イベント制御
// ==========================================
function bindEvents() {
  document.querySelectorAll(".js-pack-card").forEach((card) => {
    card.addEventListener("click", () => {
      openPackModal(card.dataset.packId);
    });
  });

  document.querySelectorAll(".js-milestone-input").forEach((input) => {
    if (input.hasAttribute("readonly")) return;

    input.addEventListener("input", (e) => {
      const catKey = input.dataset.catKey;
      userSaveData.currentMilestones[catKey] = e.target.value;

      clearTimeout(window.milestoneTimeout);
      window.milestoneTimeout = setTimeout(() => {
        renderPackPortal();

        const activeInput = document.querySelector(
          `.js-milestone-input[data-cat-key="${catKey}"]`,
        );
        if (activeInput) {
          activeInput.focus();
          activeInput.selectionStart = activeInput.selectionEnd =
            activeInput.value.length;
        }
      }, 400);
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

// 🌐 起動エントリーポイント
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(async () => {
    await loadPortalData();
    renderPackPortal();
    initAccordion();
  }, 60);
});
