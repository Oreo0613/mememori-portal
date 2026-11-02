/**
 * pack-manager.js
 * 達成パック管理・パックマスタ＆アイテムマスタ完全連動版
 */

// ==========================================
// 1. 状態管理（ステータス）
// ==========================================
let packMasterData = [];
let itemMasterMap = {}; // アイテムIDをキーにした名前キャッシュ用のマップ
let userSaveData = {
  checkedPackIds: [], // 回収済みのパックIDリスト（Firestoreから同期）
};

// 全画面で共通使用する固定の8カテゴリー定義
const PACK_CATEGORIES = [
  { key: "rank", name: "ランク達成" },
  { key: "quest", name: "クエスト達成" },
  { key: "tower", name: "無窮の塔" },
  { key: "tower-all", name: "無窮の塔(一括)" },
  { key: "tower-blue", name: "属性塔(藍)" },
  { key: "tower-red", name: "属性塔(紅)" },
  { key: "tower-green", name: "属性塔(翠)" },
  { key: "tower-yellow", name: "属性塔(黄)" },
];

// ==========================================
// 2. データ取得・構造変換・自動昇順ソート
// ==========================================
async function loadPortalData() {
  try {
    // パックマスタとアイテムマスタのjsonを同時に並列取得
    const [packRes, itemRes] = await Promise.all([
      fetch("./assets/json/pack-master.json"),
      fetch("./assets/json/item-master.json"), // パスが異なる場合は適宜修正してください
    ]);

    if (!packRes.ok)
      throw new Error(`パックデータ読込エラー: ${packRes.status}`);
    if (!itemRes.ok)
      throw new Error(`アイテムデータ読込エラー: ${itemRes.status}`);

    const rawPackData = await packRes.json();
    const rawItemData = await itemRes.json();

    // アイテムIDから名前を爆速で引けるようにマップ化 (item_01 -> "有償ダイヤ" など)
    rawItemData.forEach((item) => {
      itemMasterMap[item.id] = item.name;
    });

    // パックマスタ構造をアプリのカード用フラット形式に変換
    const formattedData = rawPackData.map((group) => {
      // 11800円のパックを最優先で抽出
      const targetPack =
        group.packs.find((p) => p.price === "11800") || group.packs[0];

      // 報酬アイテム配列をアイテムマスタから日本語名に紐づけて展開
      const rewardStrings = targetPack
        ? targetPack.rewards.map((r) => {
            const itemName = itemMasterMap[r.item] || r.item; // マスタに無ければIDのまま表示
            return `${itemName} × ${r.count.toLocaleString()}`;
          })
        : [];

      return {
        id: group.id,
        category: group.category,
        milestone: group.milestone,
        target: `${group.milestone} 達成パック`,
        reward: rewardStrings,
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
// 3. HTMLテンプレート生成
// ==========================================
function createPackCardHtml(pack) {
  const isChecked = userSaveData.checkedPackIds.includes(pack.id);
  const checkedClass = isChecked ? "is-checked" : "";

  const rewardListItems = pack.reward
    .map(
      (item) => `
    <li class="p-pack-card__reward-item">${item}</li>
  `,
    )
    .join("");

  return `
    <article class="p-pack-card ${checkedClass} js-pack-card" data-pack-id="${pack.id}">
      <h3 class="p-pack-card__target">${pack.target}</h3>
      <ul class="p-pack-card__reward">
        ${rewardListItems}
      </ul>
    </article>
  `;
}

// ==========================================
// 4. コアレンダリング（3エリア独立分配処理）
// ==========================================
function generateBoardColumnsHtml(sourcePackList) {
  return PACK_CATEGORIES.map((cat) => {
    let catPacks = sourcePackList.filter((pack) => pack.category === cat.key);
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
    const catUncollected = uncollectedPacks.filter(
      (pack) => pack.category === cat.key,
    );
    urgentPacks = urgentPacks.concat(catUncollected.slice(0, 3)); // 直近3件
    futurePacks = futurePacks.concat(catUncollected.slice(3)); // それ以降
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

function initAccordion() {
  document.querySelectorAll(".js-archive-toggle").forEach((toggleBtn) => {
    toggleBtn.removeEventListener("click", handleAccordionToggle);
    toggleBtn.addEventListener("click", handleAccordionToggle);
  });
}

function handleAccordionToggle(event) {
  const btn = event.currentTarget;
  const expanded = btn.getAttribute("aria-expanded") === "true";
  btn.setAttribute("aria-expanded", !expanded);
  btn.querySelector(".js-archive-icon").textContent = expanded ? "▼" : "▲";
}

// 起動エントリーポイント
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(async () => {
    await loadPortalData();
    renderPackPortal();
    initAccordion();
  }, 60);
});
