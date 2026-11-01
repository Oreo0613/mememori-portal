/**
 * pack-manager.js
 * 達成パック管理・独立3セクション全件表示バグ修正完全版
 */

// ==========================================
// 1. 状態管理（ステータス）
// ==========================================
let packMasterData = []; 
let userSaveData = {
  checkedPackIds: [] // 回収済みのパックIDリスト（本来はFirestoreから同期）
};

// 全画面で共通使用する固定の8カテゴリー定義
const PACK_CATEGORIES = [
  { key: 'rank', name: 'ランク達成' },
  { key: 'quest', name: 'クエスト達成' },
  { key: 'tower_all', name: '無窮の塔' },
  { key: 'tower_element_all', name: '属性塔(全)' },
  { key: 'tower_blue', name: '属性塔(藍)' },
  { key: 'tower_red', name: '属性塔(紅)' },
  { key: 'tower_green', name: '属性塔(翠)' },
  { key: 'tower_yellow', name: '属性塔(黄)' }
];

// ==========================================
// 2. データ取得・自動昇順ソート
// ==========================================
async function loadPackMasterData() {
  try {
    const response = await fetch('./assets/json/pack-master.json');
    if (!response.ok) throw new Error(`HTTPエラー。Status: ${response.status}`);
    const rawData = await response.json();
    
    // target内の数字（120や12-4など）を自動抽出し、小さい順に自動ソート
    packMasterData = rawData.sort((a, b) => {
      return extractNumber(a.target) - extractNumber(b.target);
    });
  } catch (error) {
    console.error('パックマスタデータの取得に失敗しました:', error);
  }
}

function extractNumber(str) {
  if (!str) return 0;
  const match = str.match(/\d+([-.]\d+)?/);
  if (!match) return 0;
  // 文字列そのものを取得し、ハイフンをドットに置換
  const numStr = match[0].replace('-', '.');
  return parseFloat(numStr);
}

// ==========================================
// 3. HTMLテンプレート生成 (BEMベース・ボタン排除)
// ==========================================
/**
 * パックカード1枚のコンポーネントHTMLを生成する
 */
function createPackCardHtml(pack) {
  const isChecked = userSaveData.checkedPackIds.includes(pack.id);
  const checkedClass = isChecked ? 'is-checked' : '';
  
  // 報酬配列（reward）を箇条書きアイテムに展開
  const rewardListItems = pack.reward.map(item => `
    <li class="p-pack-card__reward-item">${item}</li>
  `).join('');

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
/**
 * 🧱 ボードコンテナ直下に入る「列（.p-pack-column）」のHTML群を組み立てる共通関数
 * @param {Array} sourcePackList - 抽出元となるパックのリスト
 * @param {number|null} limitPerColumn - 1カラムあたりの最大表示数（nullの場合は全件表示）
 */
function generateBoardColumnsHtml(sourcePackList, limitPerColumn = null) {
  return PACK_CATEGORIES.map(cat => {
    // 1. このカテゴリーに属するパックを抽出
    let catPacks = sourcePackList.filter(pack => pack.category === cat.key);
    
    // 2. 表示制限がある場合（直近エリアなど）は、最前線から指定件数だけを切り取る
    if (limitPerColumn !== null && limitPerColumn !== undefined) {
      catPacks = catPacks.slice(0, limitPerColumn);
    }
    
    if (catPacks.length === 0) return ''; 

    return `
      <div class="p-pack-column p-pack-column--${cat.key}">
        <h4 class="p-pack-column__title">${cat.name}</h4>
        <div class="p-pack-gallery">
          ${catPacks.map(pack => createPackCardHtml(pack)).join('')}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 画面全体の達成パックエリアを最新状態に再描画する
 */
function renderPackPortal() {
  const urgentBoard = document.querySelector('.js-pack-urgent-board');
  const futureBoard = document.querySelector('.js-pack-future-board');
  const completedBoard = document.querySelector('.js-pack-completed-board');
  
  if (!urgentBoard || !futureBoard || !completedBoard) return;

  // エリア③用：達成済みデータを完全分離
  const completedPacks = packMasterData.filter(pack => userSaveData.checkedPackIds.includes(pack.id));

  // エリア①・②用候補：未達成データを抽出
  const uncollectedPacks = packMasterData.filter(pack => !userSaveData.checkedPackIds.includes(pack.id));

  // 各カテゴリの「最前線3件（エリア①）」と「4件目以降（エリア②）」をロジックで綺麗に分配
  let urgentPacks = [];
  let futurePacks = [];

  PACK_CATEGORIES.forEach(cat => {
    const catUncollected = uncollectedPacks.filter(pack => pack.category === cat.key);
    urgentPacks = urgentPacks.concat(catUncollected.slice(0, 3)); // 各カテゴリ最前線3つ
    futurePacks = futurePacks.concat(catUncollected.slice(3));    // 4つ目以降すべて
  });

  // 4. それぞれの独立したボードへ流し込み（第2引数を省略、または正しく制御してバグを修正）
  urgentBoard.innerHTML = urgentPacks.length > 0
    ? generateBoardColumnsHtml(urgentPacks) 
    : '<p style="color:#64748b; font-size:0.9rem; padding:12px;">🎉 すべてのパックを回収完了しました！</p>';

  futureBoard.innerHTML = futurePacks.length > 0
    ? generateBoardColumnsHtml(futurePacks)
    : '<p style="color:#64748b; font-size:0.9rem; padding:12px;">⏳ 先行する未来の目標パックはありません</p>';

  completedBoard.innerHTML = completedPacks.length > 0
    ? generateBoardColumnsHtml(completedPacks)
    : '<p style="color:#64748b; font-size:0.9rem; padding:12px;">✅ 獲得・達成済みのパックはまだありません</p>';

  // イベントの再バインド
  bindCardEvents();
}

// ==========================================
// 5. インタラクション・イベント制御
// ==========================================
/**
 * 将来モーダルを実装するためのカードクリック時フック関数
 */
function handleCardClick(event) {
  const card = event.currentTarget;
  const packId = card.dataset.packId;
  
  console.log(`パックカード [ID: ${packId}] がクリックされました。将来ここでモーダルを展開します。`);
  
  // 💡 【テスト用動作確認コード】
  // 今はモーダルがまだ無いので、カードをクリックしたらその場で「達成 ⇄ 未達成」が切り替わって、
  // カードが3つのエリア間をシュッと自動移動する快適な挙動をテストできます。
  if (userSaveData.checkedPackIds.includes(packId)) {
    userSaveData.checkedPackIds = userSaveData.checkedPackIds.filter(id => id !== packId);
  } else {
    userSaveData.checkedPackIds.push(packId);
  }
  renderPackPortal();
}

/**
 * カード自体へのクリックリスナーバインド
 */
function bindCardEvents() {
  document.querySelectorAll('.js-pack-card').forEach(card => {
    card.removeEventListener('click', handleCardClick);
    card.addEventListener('click', handleCardClick);
  });
}

function initAccordion() {
  document.querySelectorAll('.js-archive-toggle').forEach(toggleBtn => {
    toggleBtn.addEventListener('click', (event) => {
      const btn = event.currentTarget;
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', !expanded);
      btn.querySelector('.js-archive-icon').textContent = expanded ? '▼' : '▲';
    });
  });
}

// 起動エントリーポイント
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(async () => {
    await loadPackMasterData();
    renderPackPortal();
    initAccordion();
  }, 60);
});
