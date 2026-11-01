/**
 * =========================================================================
 * 📦 ウルトラセールパック管理専用 制御スクリプト（ダイヤ固定構成・前半）
 * =========================================================================
 */

// --- 0. 🌟 課金額ごとのデフォルト有償ダイヤ数マスタ（上部で一括管理） ---
const DEFAULT_DIAMOND_COUNTS = {
  11800: 5900,
  6000: 3000,
  3000: 1500,
  1500: 750,
  1000: 500,
  650: 325,
  160: 80,
};

// 有償ダイヤのアイテムID定義
const DIAMOND_ITEM_ID = "item_01";

// --- 1. 仮保存データを保持するメイン配列（メモリ上管理） ---
let temporaryPackData = [];

// --- 2. 状態管理 ---
let itemMaster = []; // JSONから読み込むアイテムマスタ
let selectedItems = {}; // フォームで現在選択中の「カスタムアイテム」と個数 { item_id: count }
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
    // 固定ダイヤ枠の表示を初期化
    initFixedDiamondUI();
  } catch (error) {
    console.error("マスタ初期化エラー:", error);
  }
}

// 🌟 選択用画像グリッドの動的描画（有償ダイヤ item_01 を自動で除外する）
function renderItemGrid() {
  if (!itemGrid) return;
  itemGrid.innerHTML = itemMaster
    .filter((item) => item.id !== DIAMOND_ITEM_ID) // 👈 有償ダイヤをグリッドから除外！
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

// 💎 フォーム内の固定ダイヤ枠に、マスタから取得した画像と名前を最初からセットする関数
function initFixedDiamondUI() {
  const diamondItem = itemMaster.find((m) => m.id === DIAMOND_ITEM_ID);
  const fixedZone = document.querySelector(
    ".js-fixed-diamond-row .p-selected-row__item-zone",
  );
  if (diamondItem && fixedZone) {
    fixedZone.innerHTML = `
      <img src="${diamondItem.imagePath}" alt="${diamondItem.name}" class="p-selected-row__image">
      <span class="p-selected-row__name">${diamondItem.name}</span>
    `;
  }
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

  // 📂 カテゴリタブ組み立て
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

  // 💳 課金額タブ組み立て（エラー修正完了版）
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
      renderTable(); // 報酬内容アイコンが切り替わるため再ビルド
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

  // 💎 金額タブが切り替わったら、フォームの固定ダイヤ入力欄にデフォルト数を自動自動同期
  const diamondInput = document.querySelector(".js-diamond-count-input");
  if (diamondInput && !editingPackId) {
    diamondInput.value = DEFAULT_DIAMOND_COUNTS[activePrice] || 0;
  }
}

// --- 6. テーブル描画・制御（「画像×個数」の一行収め仕様） ---
function renderTable() {
  const tbody = document.querySelector(".js-pack-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  temporaryPackData.forEach((pack) => {
    const tr = document.createElement("tr");
    tr.dataset.category = pack.category;
    tr.dataset.id = pack.id;

    const catLabel = categoryMap[pack.category] || pack.category;
    const conditionText = `${catLabel} ${pack.milestone}`;
    const currentPricePack = pack.packs.find((p) => p.price === activePrice);

    let rewardContentHtml = "";
    if (currentPricePack && currentPricePack.rewards) {
      rewardContentHtml = currentPricePack.rewards
        .map((r) => {
          const matchedItem = itemMaster.find((m) => m.id === r.item);
          const imgSrc = matchedItem
            ? matchedItem.imagePath
            : "assets/images/item/placeholder.webp";
          const itemName = matchedItem ? matchedItem.name : r.item;
          return `
            <div class="p-table-reward__item" title="${itemName}">
              <img src="${imgSrc}" alt="${itemName}" class="p-table-reward__image">
              <span class="p-table-reward__count">×${r.count.toLocaleString()}</span>
            </div>
          `;
        })
        .join("");
    }

    const priceText = Number(activePrice).toLocaleString() + "円";

    tr.innerHTML = `
        <td><span class="condition-text">${conditionText}</span></td>
        <td>${priceText}</td>
        <td><div class="p-table-reward">${rewardContentHtml}</div></td>
        <td>
          <button class="table-edit-btn js-edit-btn" data-id="${pack.id}">編集</button>
          <button class="table-delete-btn js-delete-btn" data-id="${pack.id}">削除</button>
        </td>
      `;
    tbody.appendChild(tr);
  });

  updateTableDisplay();
}

function updateTableDisplay() {
  const tableRows = document.querySelectorAll(".js-pack-table-body tr");
  tableRows.forEach((row) => {
    const pack = temporaryPackData.find((p) => p.id === row.dataset.id);
    const isCategoryMatch = row.dataset.category === activeCategory;
    const hasPriceData = pack
      ? pack.packs.some((p) => p.price === activePrice)
      : false;
    row.style.display = isCategoryMatch && hasPriceData ? "" : "none";
  });
}

// --- 7. フォームのモード管理・同期ロジック（前述の最新版を維持） ---
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
    Number(activePrice).toLocaleString() + "円";

  selectedItems = {};
  const currentPricePack = pack.packs.find((p) => p.price === activePrice);

  if (currentPricePack && currentPricePack.rewards) {
    currentPricePack.rewards.forEach((r) => {
      if (r.item === DIAMOND_ITEM_ID) {
        document.querySelector(".js-diamond-count-input").value = r.count;
      } else {
        selectedItems[r.item] = r.count;
      }
    });
  }
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

function updateItemSelectorUI() {
  const cards = itemGrid.querySelectorAll(".js-item-card");
  cards.forEach((card) => {
    const itemId = card.dataset.id;
    card.classList.toggle("is-selected", selectedItems[itemId] !== undefined);
  });

  const selectedItemIds = Object.keys(selectedItems);
  const rows = document.querySelectorAll(".js-selected-row");

  rows.forEach((row, index) => {
    const itemZone = row.querySelector(".js-item-zone");
    const countInput = row.querySelector(".js-count-input");
    const itemId = selectedItemIds[index];

    if (itemId) {
      const item = itemMaster.find((m) => m.id === itemId);
      itemZone.innerHTML = `
        <img src="${item.imagePath}" alt="${item.name}" class="p-selected-row__image">
        <span class="p-selected-row__name">${item.name}</span>
      `;
      countInput.disabled = false;
      countInput.value = selectedItems[itemId];
      countInput.dataset.id = itemId;
    } else {
      itemZone.innerHTML = `<span class="p-selected-row__placeholder">未選択</span>`;
      countInput.disabled = true;
      countInput.value = "";
      countInput.removeAttribute("data-id");
    }
  });
}

// --- 8. 各種イベント・ショートカット・入力制限の登録 ---
function setupFormEventListeners() {
  // 🌟 【修正】テーブル内のクリック判定（編集ボタンと削除ボタンの両方をバブリングキャッチ）
  document
    .querySelector(".js-pack-table-body")
    .addEventListener("click", (e) => {
      // ① 編集ボタンが押されたとき
      const editBtn = e.target.closest(".js-edit-btn");
      if (editBtn) {
        loadPackToForm(editBtn.dataset.id);
        return;
      }

      // ② 🗑️ 削除ボタンが押されたとき
      const deleteBtn = e.target.closest(".js-delete-btn");
      if (deleteBtn) {
        const packId = deleteBtn.dataset.id;
        const pack = temporaryPackData.find((p) => p.id === packId);
        if (!pack) return;

        const catLabel = categoryMap[pack.category] || pack.category;

        // 誤操作防止の確認アラート
        const isConfirmed = confirm(
          `【削除の確認】\n「${catLabel} ${pack.milestone}」のデータを完全に削除しますか？\n（※このマイルストーンに含まれるすべての金額パックが消去されます）`,
        );

        if (isConfirmed) {
          // メモリ上の配列から対象オブジェクトを完全に削る
          temporaryPackData = temporaryPackData.filter((p) => p.id !== packId);

          // もし今編集中のデータを消した場合はフォームもリセットする
          if (editingPackId === packId) {
            resetFormToNewMode();
          }

          // テーブルを再描画して最新状態を画面に反映
          renderTable();
        }
      }
    });

  if (itemGrid) {
    itemGrid.addEventListener("click", (e) => {
      const card = e.target.closest(".js-item-card");
      if (!card) return;

      const itemId = card.dataset.id;

      if (selectedItems[itemId] !== undefined) {
        delete selectedItems[itemId];
      } else {
        if (Object.keys(selectedItems).length >= 3) {
          alert("カスタム報酬アイテムは最大3つまでしか選択できません。");
          return;
        }
        selectedItems[itemId] = 1;
      }
      updateItemSelectorUI();
    });
  }

  const milestoneInput = document.querySelector(".js-form-milestone");
  if (milestoneInput) {
    milestoneInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/[^a-zA-Z0-9-]/g, "");
    });
    milestoneInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveFormData();
      }
    });
  }

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

  // 💾 pack-master.jsonを直接生成してダウンロードする処理
  document.querySelector(".js-generate-btn").addEventListener("click", () => {
    const jsonText = JSON.stringify(temporaryPackData, null, 2);
    const blob = new Blob([jsonText], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pack-master.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  });
}

// --- 9. データ保存ロジック（前述の重複チェック付きの最新版） ---
function saveFormData() {
  const milestone = document.querySelector(".js-form-milestone").value.trim();
  if (!milestone) {
    alert("マイルストーン数値を入力してください");
    return;
  }

  const diamondCount =
    parseInt(document.querySelector(".js-diamond-count-input").value, 10) || 0;
  const currentRewards = [{ item: DIAMOND_ITEM_ID, count: diamondCount }];

  Object.keys(selectedItems).forEach((itemId) => {
    currentRewards.push({ item: itemId, count: selectedItems[itemId] });
  });

  const allPrices = ["11800", "6000", "3000", "1500", "1000", "650", "160"];

  if (editingPackId) {
    const pack = temporaryPackData.find((p) => p.id === editingPackId);
    if (pack) {
      pack.milestone = milestone;
      const pricePackIndex = pack.packs.findIndex(
        (p) => p.price === activePrice,
      );
      if (pricePackIndex !== -1) {
        pack.packs[pricePackIndex].rewards = currentRewards;
      } else {
        pack.packs.push({ price: activePrice, rewards: currentRewards });
      }
    }
  } else {
    const targetId = `p_${activeCategory}_${milestone}`;
    const isDuplicate = temporaryPackData.some(
      (p) =>
        p.id === targetId ||
        (p.category === activeCategory && p.milestone === milestone),
    );

    if (isDuplicate) {
      const catLabel = categoryMap[activeCategory] || activeCategory;
      alert(
        `【重複エラー】\n「${catLabel} ${milestone}」はすでに登録されています。\n\n報酬内容を追加・変更したい場合は、左側の一覧にある該当データの『✏️ 編集』ボタンから操作を行ってください。`,
      );
      return;
    }

    const generatedPacks = allPrices.map((price) => {
      if (price === activePrice) {
        return { price: price, rewards: currentRewards };
      } else {
        const defaultDia = DEFAULT_DIAMOND_COUNTS[price] || 0;
        return {
          price: price,
          rewards: [{ item: DIAMOND_ITEM_ID, count: defaultDia }],
        };
      }
    });

    const newPack = {
      id: `p_${activeCategory}_${milestone}`,
      category: activeCategory,
      milestone: milestone,
      packs: generatedPacks,
    };

    temporaryPackData.push(newPack);
  }

  renderTable();
  resetFormToNewMode();
}
