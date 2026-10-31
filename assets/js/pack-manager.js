/**
 * pack-manager.js
 * 達成パック管理・Notion風動的フィルタリングロジック
 */

// ==========================================
// 1. 状態管理（ステータス）
// ==========================================
let packMasterData = []; // JSONからフェッチした全パックの固定データ
let userSaveData = {
  checkedPackIds: []     // 現在選択中ワールドの回収済みパックID（将来的にFirestoreと連動）
};

// ==========================================
// 2. データ取得・非同期初期化
// ==========================================
/**
 * パックのマスターJSONデータを読み込む（共通関数）
 */
async function loadPackMasterData() {
  try {
    const response = await fetch('./assets/json/pack-master.json');
    if (!response.ok) {
      throw new Error(`HTTPエラー。Status: ${response.status}`);
    }
    packMasterData = await response.json();
  } catch (error) {
    console.error('パックマスタデータの取得に失敗しました:', error);
    // 読み込み失敗時のミニマルフロントフォールバック
    packMasterData = [
      { id: 'err', category: 'rank', categoryName: 'エラー', target: 'データの読み込みに失敗しました', reward: 'JSONファイルの設定を確認してください', order: 1 }
    ];
  }
}

// ==========================================
// 3. HTMLテンプレート生成 (BEMベース)
// ==========================================
/**
 * パックカード1枚のコンポーネントHTMLを生成する
 */
function createPackCardHtml(pack) {
  const isChecked = userSaveData.checkedPackIds.includes(pack.id);
  const checkedClass = isChecked ? 'is-checked' : '';
  const btnText = isChecked ? '回収済' : '回収完了';
  
  // BEMのModifier色分けを特定 (tower_blue 等を一括で tower に統一)
  const modifier = pack.category.startsWith('tower') ? 'tower' : pack.category;

  return `
    <article class="p-pack-card ${checkedClass} js-pack-card" data-pack-id="${pack.id}">
      <span class="p-pack-card__tag p-pack-card__tag--${modifier}">${pack.categoryName}</span>
      <h3 class="p-pack-card__target">${pack.target}</h3>
      <p class="p-pack-card__reward">${pack.reward}</p>
      <div class="p-pack-card__footer">
        <button class="p-pack-card__btn js-pack-check-trigger">${btnText}</button>
      </div>
    </article>
  `;
}

// ==========================================
// 4. コアレンダリング（描画ロジック）
// ==========================================
/**
 * ポータル画面全体を再描画する（直近3選＆アーカイブの更新）
 */
function renderPackPortal() {
  const urgentGallery = document.querySelector('.js-pack-urgent-gallery');
  const archiveContent = document.querySelector('.js-archive-content');
  
  if (!urgentGallery || !archiveContent) return;

  // --- ① Notion機能再現：未獲得の中から直近の目標3選を自動抽出 ---
  const uncollectedPacks = packMasterData.filter(pack => !userSaveData.checkedPackIds.includes(pack.id));
  const urgentPacks = uncollectedPacks.sort((a, b) => a.order - b.order).slice(0, 3);

  urgentGallery.innerHTML = urgentPacks.length > 0 
    ? urgentPacks.map(pack => createPackCardHtml(pack)).join('')
    : '<p style="color:#64748b; font-size:0.9rem; padding:12px;">🎉 すべてのパックを回収完了しました！</p>';

  // --- ② カテゴリ別グループ一覧の一括描画 ---
  const categories = [
    { key: 'rank', name: 'ランク達成パック' },
    { key: 'quest', name: 'クエスト達成パック' },
    { key: 'tower_all', name: '無窮の塔パック' },
    { key: 'tower_blue', name: '属性塔（藍）パック' },
    { key: 'tower_red', name: '属性塔（紅）パック' },
    { key: 'tower_green', name: '属性塔（翠）パック' },
    { key: 'tower_yellow', name: '属性塔（黄）パック' }
  ];

  archiveContent.innerHTML = categories.map(cat => {
    const catPacks = packMasterData.filter(pack => pack.category === cat.key);
    if (catPacks.length === 0) return '';

    return `
      <div class="p-pack-group">
        <h4 class="p-pack-group__title">${cat.name}</h4>
        <div class="p-pack-gallery">
          ${catPacks.map(pack => createPackCardHtml(pack)).join('')}
        </div>
      </div>
    `;
  }).join('');

  // 動的に追加された要素へイベントフックを設定
  bindCardEvents();
}

// ==========================================
// 5. インタラクション・イベント制御
// ==========================================
/**
 * パックの回収ステータストグル処理
 */
function handleCheckTrigger(event) {
  const card = event.currentTarget.closest('.js-pack-card');
  if (!card) return;

  const packId = card.dataset.packId;

  if (userSaveData.checkedPackIds.includes(packId)) {
    userSaveData.checkedPackIds = userSaveData.checkedPackIds.filter(id => id !== packId);
  } else {
    userSaveData.checkedPackIds.push(packId);
  }

  // TODO: フェーズ6完了時にFirestoreへ連動保存を呼び出す
  // syncWithCloudFirestore(userSaveData.checkedPackIds);

  renderPackPortal();
}

function bindCardEvents() {
  document.querySelectorAll('.js-pack-check-trigger').forEach(btn => {
    btn.removeEventListener('click', handleCheckTrigger);
    btn.addEventListener('click', handleCheckTrigger);
  });
}

/**
 * アーカイブアコーディオン開閉イベント初期化
 */
function initAccordion() {
  const toggleBtn = document.querySelector('.js-archive-toggle');
  if (!toggleBtn) return;
  
  toggleBtn.addEventListener('click', () => {
    const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    toggleBtn.setAttribute('aria-expanded', !expanded);
    toggleBtn.querySelector('.js-archive-icon').textContent = expanded ? '▼' : '▲';
  });
}

// ==========================================
// 6. 起動エントリーポイント
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // main.js(型:module)によるヘッダー・フッターの非同期HTMLインクルード完了を
  // 安全に待機するために、僅かにディレイを置いてからパック画面をレンダリングする
  setTimeout(async () => {
    await loadPackMasterData();
    renderPackPortal();
    initAccordion();
  }, 60);
});
