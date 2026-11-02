/**
 * pack-manager.js
 * 達成パック管理・パックマスタ＆アイテムマスタ完全連動UI版
 */

// ==========================================
// 1. 状態管理（ステータス）
// ==========================================
let packMasterData = [];
let itemMasterMap = {}; // アイテムIDをキーにしたオブジェクトマスタのキャッシュ
let userSaveData = {
  checkedPackIds: [], // 回収済みのパックIDリスト（Firestoreから同期）
};

// 全画面で共通使用する固定の8カテゴリー定義（「達成」を排除しました）
const PACK_CATEGORIES = [
  { key: "rank", name: "ランク" },
  { key: "quest", name: "クエスト" },
  { key: "tower", name: "無窮の塔" },
  { key: "tower-all", name: "無窮の塔(全)" },
  { key: "tower-blue", name: "属性塔(藍)" },
  { key: "tower-red", name: "属性塔(紅)" },
  { key: "tower-green", name: "属性塔(翠)" },
  { key: "tower-yellow", name: "属性塔(黄)" },
];

// ==========================================
// アンダースコアとハイフンを同一視してカテゴリーを判定するヘルパー
// ==========================================
function catConfigMatches(key, jsonCategory) {
  if (!key || !jsonCategory) return false;
  return key.replace("-", "_") === jsonCategory.replace("-", "_");
}

// ==========================================
// 2. データ取得・構造変換・自動昇順ソート
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
      // 11800円のパックを最優先で抽出。見つからない場合は最初のパック
      const targetPack =
        group.packs.find((p) => p.price === "11800") ||
        (group.packs.length > 0 ? group.packs[0] : null);

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
        // タイトルを「カテゴリー名 マイルストーン」の形式に結合
        target: `${categoryName} ${group.milestone}`,
        reward: rewardItems,
      };
    });

    // 進行度（マイルストーン）順に自動で並び替え
    packMasterData = formattedData.sort((a, b) => {
      return extractNumber(a.milestone) - extractNumber(b.milestone);
    });
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

// ==========================================
// 3. HTMLテンプレート生成（アイテム画像×個数のグリッド表現）
// ==========================================
function createPackCardHtml(pack) {
  const isChecked = userSaveData.checkedPackIds.includes(pack.id);
  const checkedClass = isChecked ? "is-checked" : "";

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
    <article class="p-pack-card ${checkedClass} js-pack-card" data-pack-id="${pack.id}">
      <h3 class="p-pack-card__target">${pack.target}</h3>
      <div class="p-pack-card__reward-grid">
        ${rewardGridItems}
      </div>
    </article>
  `;
}

// ==========================================
// 4. コアレンダリング（3エリア独立分配処理）
// ==========================================
function generateBoardColumnsHtml(sourcePackList) {
  return PACK_CATEGORIES.map((cat) => {
    let catPacks = sourcePackList.filter((pack) =>
      catConfigMatches(cat.key, pack.category),
    );
    if (catPacks.length === 0) return "";

    return `
      <div class="p-pack-column p-pack-column--${cat.key}">
        <h4 class="p-pack-column__title">${cat.name}</h4>
        <div class="p-pack-gallery">
          ${catPacks.map((pack) => createPackCardHtml(pack)).join("")}
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

  const completedPacks = packMasterData.filter((pack) =>
    userSaveData.checkedPackIds.includes(pack.id),
  );
  const uncollectedPacks = packMasterData.filter(
    (pack) => !userSaveData.checkedPackIds.includes(pack.id),
  );

  let urgentPacks = [];
  let futurePacks = [];

  PACK_CATEGORIES.forEach((cat) => {
    const catUncollected = uncollectedPacks.filter((pack) =>
      catConfigMatches(cat.key, pack.category),
    );
    urgentPacks = urgentPacks.concat(catUncollected.slice(0, 3)); // 直近3つ
    futurePacks = futurePacks.concat(catUncollected.slice(3)); // 4つ目以降
  });

  urgentBoard.innerHTML =
    urgentPacks.length > 0
      ? generateBoardColumnsHtml(urgentPacks)
      : '<p style="color:#64748b; font-size:0.9rem; padding:12px;">🎉 すべてのパックを回収完了しました！</p>';

  futureBoard.innerHTML =
    futurePacks.length > 0
      ? generateBoardColumnsHtml(futurePacks)
      : '<p style="color:#64748b; font-size:0.9rem; padding:12px;">⏳ 先行する未来の目標パックはありません</p>';

  completedBoard.innerHTML =
    completedPacks.length > 0
      ? generateBoardColumnsHtml(completedPacks)
      : '<p style="color:#64748b; font-size:0.9rem; padding:12px;">✅ 獲得・達成済みのパックはまだありません</p>';

  bindCardEvents();
}

// ==========================================
// 5. インタラクション・イベント制御
// ==========================================
function handleCardClick(event) {
  const card = event.currentTarget;
  const packId = card.dataset.packId;

  if (userSaveData.checkedPackIds.includes(packId)) {
    userSaveData.checkedPackIds = userSaveData.checkedPackIds.filter(
      (id) => id !== packId,
    );
  } else {
    userSaveData.checkedPackIds.push(packId);
  }
  renderPackPortal();
}

function bindCardEvents() {
  document.querySelectorAll(".js-pack-card").forEach((card) => {
    card.removeEventListener("click", handleCardClick);
    card.addEventListener("click", handleCardClick);
  });
}

/**
 * アコーディオンのトグルイベント処理
 */
function handleAccordionToggle(event) {
  const btn = event.currentTarget;
  const expanded = btn.getAttribute("aria-expanded") === "true";
  btn.setAttribute("aria-expanded", !expanded);
  btn.querySelector(".js-archive-icon").textContent = expanded ? "▼" : "▲";
}

function initAccordion() {
  document.querySelectorAll(".js-archive-toggle").forEach((toggleBtn) => {
    toggleBtn.removeEventListener("click", handleAccordionToggle);
    toggleBtn.addEventListener("click", handleAccordionToggle);
  });
}

// 起動エントリーポイント
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(async () => {
    await loadPortalData();
    renderPackPortal();
    initAccordion();
  }, 60);
});
