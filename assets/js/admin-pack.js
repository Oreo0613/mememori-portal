/**
 * =========================================================================
 * 📦 ウルトラセールパック管理専用 制御スクリプト（バージョン比較同期・1/3）
 * =========================================================================
 */

// --- 0. 課金額ごとのデフォルト有償ダイヤ数マスタ ---
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

// --- 1. メモリ上の管理用データと状態管理 ---
let temporaryPackData = []; // ここには純粋なパック配列（packs）のみを格納
let currentLastUpdated = ""; // 現在の最終更新日時
let itemMaster = [];
let selectedItems = {};
let activeCategory = "rank";
let activePrice = "11800";
let editingPackId = null;

// 日本語マップ
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

const itemGrid = document.querySelector(".js-item-grid");

// --- 2. IndexedDB 制御クラス（メタデータ・パックデータ管理） ---
class PackDB {
  constructor() {
    this.dbName = "mememori-portal-db";
    this.dbVersion = 2; // バージョン比較構造のためDB構造をアップデート
    this.packStore = "packs";
    this.metaStore = "metadata";
    this.db = null;
  }

  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.packStore)) {
          db.createObjectStore(this.packStore, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(this.metaStore)) {
          db.createObjectStore(this.metaStore);
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // ローカルブラウザの全データを一括取得
  async loadLocalState() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.packStore, this.metaStore],
        "readonly",
      );
      const packStore = transaction.objectStore(this.packStore);
      const metaStore = transaction.objectStore(this.metaStore);

      const packsRequest = packStore.getAll();
      const metaRequest = metaStore.get("lastUpdated");

      transaction.oncomplete = () => {
        resolve({
          packs: packsRequest.result || [],
          lastUpdated: metaRequest.result || "",
        });
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // ローカルブラウザのデータを最新情報で完全上書き
  async saveAll(packs, lastUpdated) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.packStore, this.metaStore],
        "readwrite",
      );
      const packStore = transaction.objectStore(this.packStore);
      const metaStore = transaction.objectStore(this.metaStore);

      packStore.clear().onsuccess = () => {
        packs.forEach((pack) => packStore.put(pack));
      };
      metaStore.put(lastUpdated, "lastUpdated");

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

const db = new PackDB();

// --- 3. 初期化ライフサイクル ---
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await db.open();
    await loadItemMaster();
    await loadPackMasterAndSync(); // 🌟 バージョン比較＆自動同期処理
    initDynamicFilters();
    renderTable();
    syncTabsWithForm();
    setupFormEventListeners();
  } catch (err) {
    console.error("アプリケーションの初期化に失敗しました:", err);
  }
});

// --- 4. アイテムマスタ（JSON）の非同期読み込み ---
async function loadItemMaster() {
  try {
    const response = await fetch("assets/json/item-master.json");
    if (!response.ok) throw new Error("アイテムマスタの読み込みに失敗しました");
    itemMaster = await response.json();
    itemMaster.sort((a, b) => a.sortOrder - b.sortOrder);

    renderItemGrid();
    initFixedDiamondUI();
  } catch (error) {
    console.error("マスタ初期化エラー:", error);
  }
}

// 🌟 JSONファイルとブラウザデータの「lastUpdated」比較・競合自動解決ロジック
async function loadPackMasterAndSync() {
  try {
    // 1. ブラウザ側（IndexedDB）のデータを取得
    const localState = await db.loadLocalState();

    // 2. サーバー（ローカルファイル）側の JSON データを取得
    let jsonState = { packs: [], lastUpdated: "" };
    try {
      const response = await fetch("assets/json/pack-master.json");
      if (response.ok) {
        const fileData = await response.json();
        // 古い配列形式だった場合の互換性ケア、および新オブジェクト形式のパース
        if (Array.isArray(fileData)) {
          jsonState.packs = fileData;
          jsonState.lastUpdated = new Date(0).toISOString(); // 日付がなければ最古にする
        } else {
          jsonState.packs = fileData.packs || [];
          jsonState.lastUpdated =
            fileData.lastUpdated || new Date(0).toISOString();
        }
      }
    } catch (e) {
      console.log(
        "pack-master.json が未生成、または読み込めないためスキップします。",
      );
    }

    // 3. タイムスタンプの比較（ミリ秒換算）
    const localTime = localState.lastUpdated
      ? new Date(localState.lastUpdated).getTime()
      : 0;
    const jsonTime = jsonState.lastUpdated
      ? new Date(jsonState.lastUpdated).getTime()
      : 0;

    if (jsonTime > localTime) {
      // JSONファイルのほうが新しい ➔ ブラウザ側をJSONデータで上書きアップデート
      temporaryPackData = jsonState.packs;
      currentLastUpdated = jsonState.lastUpdated;
      await db.saveAll(temporaryPackData, currentLastUpdated);
      console.log(
        `🔄 JSONファイルが新しいため、ローカルDBを更新しました。(${jsonState.lastUpdated})`,
      );
    } else {
      // ブラウザ（IndexedDB）のほうが新しい、または同一 ➔ ブラウザのデータを優先採用
      temporaryPackData = localState.packs;
      currentLastUpdated = localState.lastUpdated || new Date().toISOString();
      if (!localState.lastUpdated) {
        // 初回起動時などでDB側の日付が空なら初期保存
        await db.saveAll(temporaryPackData, currentLastUpdated);
      }
      console.log(
        `💾 ブラウザのローカルDBデータを優先採用しました。(${currentLastUpdated})`,
      );
    }
  } catch (error) {
    console.error("パックマスタの同期・解析に失敗しました:", error);
  }
}

/**
 * =========================================================================
 * 📦 ウルトラセールパック管理専用 制御スクリプト（バージョン比較同期・2/3）
 * =========================================================================
 */

function renderItemGrid() {
  if (!itemGrid) return;
  itemGrid.innerHTML = itemMaster
    .filter((item) => item.id !== DIAMOND_ITEM_ID)
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
      renderTable();
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

  const diamondInput = document.querySelector(".js-diamond-count-input");
  if (diamondInput && !editingPackId) {
    diamondInput.value = DEFAULT_DIAMOND_COUNTS[activePrice] || 0;
  }
}

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

/**
 * =========================================================================
 * 📦 ウルトラセールパック管理専用 制御スクリプト（バージョン比較同期・3/3）
 * =========================================================================
 */

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

    const isChecked = currentPricePack ? !!currentPricePack.isChecked : false;
    const checkedAttr = isChecked ? "checked" : "";
    const priceText = Number(activePrice).toLocaleString() + "円";

    tr.innerHTML = `
        <td><span class="condition-text">${conditionText}</span></td>
        <td>${priceText}</td>
        <td><div class="p-table-reward">${rewardContentHtml}</div></td>
        <td>
          <label class="p-table-check-label">
            <input type="checkbox" class="p-table-check-input js-table-check" data-id="${pack.id}" ${checkedAttr}>
            <span class="p-table-check-text">${isChecked ? "済" : "未"}</span>
          </label>
        </td>
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

function setupFormEventListeners() {
  document
    .querySelector(".js-pack-table-body")
    .addEventListener("click", async (e) => {
      const tableCheck = e.target.closest(".js-table-check");
      if (tableCheck) {
        const packId = tableCheck.dataset.id;
        const pack = temporaryPackData.find((p) => p.id === packId);
        if (pack) {
          const currentPricePack = pack.packs.find(
            (p) => p.price === activePrice,
          );
          if (currentPricePack) {
            currentPricePack.isChecked = tableCheck.checked;
            const textEl = tableCheck.nextElementSibling;
            if (textEl) textEl.textContent = tableCheck.checked ? "済" : "未";

            // 🌟 チェックの変更もデータ変更とみなし、タイムスタンプを更新してローカルセーブ
            currentLastUpdated = new Date().toISOString();
            await db.saveAll(temporaryPackData, currentLastUpdated);
          }
        }
        return;
      }

      const editBtn = e.target.closest(".js-edit-btn");
      if (editBtn) {
        loadPackToForm(editBtn.dataset.id);
        return;
      }

      const deleteBtn = e.target.closest(".js-delete-btn");
      if (deleteBtn) {
        const packId = deleteBtn.dataset.id;
        const pack = temporaryPackData.find((p) => p.id === packId);
        if (!pack) return;

        const catLabel = categoryMap[pack.category] || pack.category;
        if (
          confirm(
            `【削除の確認】\n「${catLabel} ${pack.milestone}」を完全に削除しますか？`,
          )
        ) {
          temporaryPackData = temporaryPackData.filter((p) => p.id !== packId);
          if (editingPackId === packId) resetFormToNewMode();

          // 🌟 削除時もタイムスタンプを更新してローカルセーブ
          currentLastUpdated = new Date().toISOString();
          await db.saveAll(temporaryPackData, currentLastUpdated);
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
          alert("カスタム報酬アイテムは最大3つまで選択できます。");
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
        if (itemId) selectedItems[itemId] = parseInt(e.target.value, 10) || 1;
      }
    });
  }

  document
    .querySelector(".js-cancel-btn")
    .addEventListener("click", resetFormToNewMode);
  document
    .querySelector(".js-save-btn")
    .addEventListener("click", saveFormData);

  // 🌟 全データをメタデータ（lastUpdated）付き構造にパッケージングして出力
  document.querySelector(".js-generate-btn").addEventListener("click", () => {
    const exportStructure = {
      lastUpdated: currentLastUpdated,
      packs: temporaryPackData,
    };
    const jsonText = JSON.stringify(exportStructure, null, 2);
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

// データ保存（保存のタイミングでタイムスタンプを自動更新）
async function saveFormData() {
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
        pack.packs[pricePackIndex].isChecked = true;
      } else {
        pack.packs.push({
          price: activePrice,
          rewards: currentRewards,
          isChecked: true,
        });
      }
    }
  } else {
    const targetId = `p_${activeCategory}_${milestone}`;
    const isDuplicate = temporaryPackData.some((p) => p.id === targetId);

    if (isDuplicate) {
      alert("【重複エラー】このマイルストーンは既に登録されています。");
      return;
    }

    const generatedPacks = allPrices.map((price) => ({
      price: price,
      rewards:
        price === activePrice
          ? currentRewards
          : [
              {
                item: DIAMOND_ITEM_ID,
                count: DEFAULT_DIAMOND_COUNTS[price] || 0,
              },
            ],
      isChecked: false,
    }));

    temporaryPackData.push({
      id: targetId,
      category: activeCategory,
      milestone: milestone,
      packs: generatedPacks,
    });
  }

  // 🌟 新規・編集保存時にタイムスタンプを「現在時刻」に更新し、DBに保存
  currentLastUpdated = new Date().toISOString();
  await db.saveAll(temporaryPackData, currentLastUpdated);

  renderTable();
  resetFormToNewMode();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && editingPackId !== null) resetFormToNewMode();
});
