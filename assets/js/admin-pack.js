/**
 * =========================================================================
 * 📦 ウルトラセールパック管理専用 制御スクリプト（3グループ固定・前半）
 * =========================================================================
 */

// --- 1. 仮保存データを保持するメイン配列（メモリ上管理） ---
let temporaryPackData = [
  {
    id: "p1",
    category: "rank",
    price: "11800",
    milestone: "200",
    rewards: [
      { item: "item_25", count: 1000 }, // 潜在宝珠
      { item: "item_05", count: 50 }, // プラチナガチャチケット
    ],
  },
  {
    id: "p2",
    category: "quest",
    price: "11800",
    milestone: "10-24",
    rewards: [
      { item: "item_25", count: 1000 },
      { item: "item_20", count: 50 }, // 魔装香油
    ],
  },
];

// --- 2. 状態管理 ---
let itemMaster = []; // JSONから読み込むアイテムマスタ
let selectedItems = {}; // フォームで現在選択中のアイテムと個数 { item_id: count }
let activeCategory = "rank";
let activePrice = "11800";
let editingPackId = null; // nullなら新規登録モード、値があれば編集モード

// 日本語マップ（カテゴリ用）
const categoryMap = {
  rank: "ランク",
  quest: "クエスト",
  tower: "無窮の塔",
  "tower-blue": "藍塔",
  "tower-red": "紅塔",
  "tower-green": "翠塔",
  "tower-yellow": "黄塔",
  "tower-all": "塔(全)",
};

// DOM要素の取得
const itemGrid = document.querySelector(".js-item-grid");

// --- 3. 初期化ライフサイクル ---
document.addEventListener("DOMContentLoaded", async () => {
  await loadItemMaster(); // ① 先にアイテムマスタを読み込む
  initDynamicFilters(); // タブの自動組み立て
  renderTable(); // テーブル初期描画
  syncTabsWithForm(); // フォームへ初期値を同期
  setupFormEventListeners(); // イベントの登録（※後半で定義）
});

// --- 4. アイテムマスタ（JSON）の非同期読み込み ---
async function loadItemMaster() {
  try {
    const response = await fetch("assets/json/item-master.json");
    if (!response.ok) throw new Error("アイテムマスタの読み込みに失敗しました");
    itemMaster = await response.json();

    // sortOrder（昇順）に並び替え
    itemMaster.sort((a, b) => a.sortOrder - b.sortOrder);

    // 画像グリッドを生成
    renderItemGrid();
  } catch (error) {
    console.error("マスタ初期化エラー:", error);
  }
}

// 選択用画像グリッドの動的描画
function renderItemGrid() {
  if (!itemGrid) return;
  itemGrid.innerHTML = itemMaster
    .map(
      (item) => `
    <div class="p-item-card js-item-card" data-id="${item.id}" title="${item.name}">
      <img src="${item.imagePath}" alt="${item.name}" class="p-item-card__image">
      <span class="p-item-card__name">${item.name}</span>
    </div>
  `,
    )
    .join("");
}

// --- 5. フィルター動的生成・同期処理 ---
function initDynamicFilters() {
  const categoryContainer = document.querySelector(".js-tabs-category");
  const priceContainer = document.querySelector(".js-tabs-price");
  if (!categoryContainer || !priceContainer) return;

  const uniqueCategories = [
    "rank",
    "quest",
    "tower",
    "tower-blue",
    "tower-red",
    "tower-green",
    "tower-yellow",
    "tower-all",
  ];
  const uniquePrices = ["11800", "6000", "3000", "1500", "1000", "650", "160"];

  // カテゴリタブ組み立て
  uniqueCategories.forEach((cat) => {
    const li = document.createElement("li");
    li.className = `admin-tabs__item ${cat === activeCategory ? "is-active" : ""}`;
    li.dataset.category = cat;
    li.textContent = categoryMap[cat] || cat;
    li.addEventListener("click", (e) => {
      if (editingPackId) return;
      categoryContainer
        .querySelector(".is-active")
        .classList.remove("is-active");
      e.currentTarget.classList.add("is-active");
      activeCategory = e.currentTarget.dataset.category;
      syncTabsWithForm();
      updateTableDisplay();
    });
    categoryContainer.appendChild(li);
  });

  // 課金額タブ組み立て
  uniquePrices.forEach((price) => {
    const li = document.createElement("li");
    li.className = `admin-tabs__item ${price === activePrice ? "is-active" : ""}`;
    li.dataset.price = price;
    li.textContent = `💎 ${Number(price).toLocaleString()}`;
    li.addEventListener("click", (e) => {
      if (editingPackId) return;
      priceContainer.querySelector(".is-active").classList.remove("is-active");
      e.currentTarget.classList.add("is-active");
      activePrice = e.currentTarget.dataset.price;
      syncTabsWithForm();
      updateTableDisplay();
    });
    priceContainer.appendChild(li);
  });
}

function syncTabsWithForm() {
  const categoryInput = document.querySelector(".js-form-category-display");
  const priceInput = document.querySelector(".js-form-price-display");
  if (categoryInput)
    categoryInput.value = categoryMap[activeCategory] || activeCategory;
  if (priceInput)
    priceInput.value = Number(activePrice).toLocaleString() + "円";
}

// --- 6. テーブル描画・制御 ---
function renderTable() {
  const tbody = document.querySelector(".js-pack-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  temporaryPackData.forEach((pack) => {
    const tr = document.createElement("tr");
    tr.dataset.category = pack.category;
    tr.dataset.price = pack.price;
    tr.dataset.id = pack.id;

    const catLabel = categoryMap[pack.category] || pack.category;
    const conditionText = `${catLabel} ${pack.milestone}`;
    const priceText = Number(pack.price).toLocaleString() + "円";

    // アイテム名をマスタから検索して表示を組み立て
    const rewardTexts = pack.rewards
      .map((r) => {
        const matchedItem = itemMaster.find((m) => m.id === r.item);
        const itemName = matchedItem ? matchedItem.name : r.item;
        return `${itemName}×${r.count}`;
      })
      .join(", ");

    tr.innerHTML = `
        <td><span class="condition-text">${conditionText}</span></td>
        <td>${priceText}</td>
        <td>${rewardTexts}</td>
        <td><button class="table-edit-btn js-edit-btn" data-id="${pack.id}">✏️ 編集</button></td>
      `;
    tbody.appendChild(tr);
  });

  updateTableDisplay();
}

function updateTableDisplay() {
  const tableRows = document.querySelectorAll(".js-pack-table-body tr");
  tableRows.forEach((row) => {
    const isMatch =
      row.dataset.category === activeCategory &&
      row.dataset.price === activePrice;
    row.style.display = isMatch ? "" : "none";
  });
}

// --- 7. フォームのモード管理・同期ロジック ---
function loadPackToForm(packId) {
  const pack = temporaryPackData.find((p) => p.id === packId);
  if (!pack) return;

  editingPackId = packId;

  document.querySelectorAll(".js-pack-table-body tr").forEach((row) => {
    row.classList.toggle("is-active", row.dataset.id === packId);
  });

  const modeTitle = document.querySelector(".js-form-mode-title");
  const cancelBtn = document.querySelector(".js-cancel-btn");
  const saveBtn = document.querySelector(".js-save-btn");
  if (modeTitle) {
    modeTitle.textContent = `編集モード [ID: ${packId}]`;
    modeTitle.classList.add("is-edit");
  }
  if (cancelBtn) cancelBtn.style.display = "";
  if (saveBtn) saveBtn.textContent = "変更を確定する";

  document.querySelector(".js-form-milestone").value = pack.milestone;
  document.querySelector(".js-form-category-display").value =
    categoryMap[pack.category] || pack.category;
  document.querySelector(".js-form-price-display").value =
    Number(pack.price).toLocaleString() + "円";

  selectedItems = {};
  pack.rewards.forEach((r) => {
    selectedItems[r.item] = r.count;
  });
  updateItemSelectorUI();

  document.querySelector(".js-form-milestone").focus();
}

function resetFormToNewMode() {
  editingPackId = null;

  document.querySelectorAll(".js-pack-table-body tr").forEach((row) => {
    row.classList.remove("is-active");
  });

  const modeTitle = document.querySelector(".js-form-mode-title");
  const cancelBtn = document.querySelector(".js-cancel-btn");
  const saveBtn = document.querySelector(".js-save-btn");
  if (modeTitle) {
    modeTitle.textContent = "新規登録モード";
    modeTitle.classList.remove("is-edit");
  }
  if (cancelBtn) cancelBtn.style.display = "none";
  if (saveBtn) saveBtn.textContent = "仮保存 (Enter)";

  document.querySelector(".js-form-milestone").value = "";
  selectedItems = {};
  updateItemSelectorUI();

  syncTabsWithForm();
  document.querySelector(".js-form-milestone").focus();
}

// 📦 固定の3スロットに対して状態を正しく反映する
function updateItemSelectorUI() {
  // ① グリッドのハイライト処理
  const cards = itemGrid.querySelectorAll(".js-item-card");
  cards.forEach((card) => {
    const itemId = card.dataset.id;
    card.classList.toggle("is-selected", selectedItems[itemId] !== undefined);
  });

  // ② 3つの固定行（スロット）の更新
  const selectedItemIds = Object.keys(selectedItems);
  const rows = document.querySelectorAll(".js-selected-row");

  rows.forEach((row, index) => {
    const itemZone = row.querySelector(".js-item-zone");
    const countInput = row.querySelector(".js-count-input");
    const itemId = selectedItemIds[index];

    if (itemId) {
      // アイテムが割り振られている場合
      const item = itemMaster.find((m) => m.id === itemId);
      itemZone.innerHTML = `
        <img src="${item.imagePath}" alt="${item.name}" class="p-selected-row__image">
        <span class="p-selected-row__name">${item.name}</span>
      `;
      countInput.disabled = false;
      countInput.value = selectedItems[itemId];
      countInput.dataset.id = itemId;
    } else {
      // 空白スロットの場合
      itemZone.innerHTML = `<span class="p-selected-row__placeholder">未選択</span>`;
      countInput.disabled = true;
      countInput.value = "";
      countInput.removeAttribute("data-id");
    }
  });
}

function setupFormEventListeners() {
  document
    .querySelector(".js-pack-table-body")
    .addEventListener("click", (e) => {
      const editBtn = e.target.closest(".js-edit-btn");
      if (!editBtn) return;
      loadPackToForm(editBtn.dataset.id);
    });

  // 📦 【バグ修正版】画像カードのクリック判定（親要素を確実に捉える）
  if (itemGrid) {
    itemGrid.addEventListener("click", (e) => {
      const card = e.target.closest(".js-item-card");
      if (!card) return; // カード以外の隙間クリックは無視

      const itemId = card.dataset.id;

      if (selectedItems[itemId] !== undefined) {
        delete selectedItems[itemId];
      } else {
        // 最大3枠制限のチェック
        if (Object.keys(selectedItems).length >= 3) {
          alert("報酬アイテムは最大3つまでしか選択できません。");
          return;
        }
        selectedItems[itemId] = 1;
      }
      updateItemSelectorUI();
    });
  }

  // 個数入力イベントを親要素でバブリングキャッチ
  const slotsContainer = document.querySelector(".p-selected-slots");
  if (slotsContainer) {
    slotsContainer.addEventListener("input", (e) => {
      if (e.target.classList.contains("js-count-input")) {
        const itemId = e.target.dataset.id;
        if (itemId) {
          selectedItems[itemId] = parseInt(e.target.value, 10) || 1;
        }
      }
    });

    slotsContainer.addEventListener("keydown", (e) => {
      if (e.target.classList.contains("js-count-input") && e.key === "Enter") {
        e.preventDefault();
        saveFormData();
      }
    });
  }

  document
    .querySelector(".js-cancel-btn")
    .addEventListener("click", resetFormToNewMode);
  document
    .querySelector(".js-save-btn")
    .addEventListener("click", saveFormData);

  document
    .querySelector(".js-form-milestone")
    .addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveFormData();
      }
    });

  document.querySelector(".js-generate-btn").addEventListener("click", () => {
    const textarea = document.querySelector(".js-json-output");
    if (textarea) {
      textarea.value = JSON.stringify(temporaryPackData, null, 2);
    }
  });
}

function saveFormData() {
  const milestone = document.querySelector(".js-form-milestone").value.trim();
  if (!milestone) {
    alert("マイルストーン数値を入力してください");
    return;
  }

  const rewards = Object.keys(selectedItems).map((itemId) => {
    return { item: itemId, count: selectedItems[itemId] };
  });

  if (rewards.length === 0) {
    alert("アイテムを最低1つ選択してください");
    return;
  }

  if (editingPackId) {
    const index = temporaryPackData.findIndex((p) => p.id === editingPackId);
    if (index !== -1) {
      temporaryPackData[index].milestone = milestone;
      temporaryPackData[index].rewards = rewards;
    }
  } else {
    const newPack = {
      id: "p_" + Date.now(),
      category: activeCategory,
      price: activePrice,
      milestone: milestone,
      rewards: rewards,
    };
    temporaryPackData.push(newPack);
  }

  renderTable();
  resetFormToNewMode();
}
