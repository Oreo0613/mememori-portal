/**
 * =========================================================================
 * 📦 ウルトラセールパック管理専用 制御スクリプト（日本時間表記版・1/3）
 * =========================================================================
 */

// --- 0. 課金額ごとのデフォルト有償ダイヤ数マスタ（上部で一括管理） ---
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
let temporaryPackData = []; // 純粋なパック配列形式 [...]
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

// --- 2. IndexedDB 制御クラス ---
class PackDB {
  constructor() {
    this.dbName = "mememori-portal-db";
    this.dbVersion = 4; // 日本時間対応およびレコード管理のため最適化
    this.storeName = "pack-master";
    this.db = null;
  }

  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        // 旧構造のストアが存在する場合は一度クリアして再生成
        if (db.objectStoreNames.contains(this.storeName)) {
          db.deleteObjectStore(this.storeName);
        }
        db.createObjectStore(this.storeName, { keyPath: "id" });
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async getAll() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.storeName, "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveAll(dataArray) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      store.clear().onsuccess = () => {
        if (dataArray.length === 0) {
          resolve();
          return;
        }
        let count = 0;
        dataArray.forEach((item) => {
          const req = store.put(item);
          req.onsuccess = () => {
            count++;
            if (count === dataArray.length) resolve();
          };
          req.onerror = () => reject(req.error);
        });
      };
    });
  }
}

const db = new PackDB();

// --- 3. 初期化ライフサイクル ---
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await db.open(); // ① IndexedDBの接続開始
    await loadItemMaster(); // ② 先にアイテムマスタを読み込む
    await loadPackMasterAndSync(); // 🌟③ レコード単位でのマージ・同期処理
    initDynamicFilters(); // ④ タブの自動組み立て
    renderTable(); // ⑤ テーブル初期描画
    syncTabsWithForm(); // ⑥ フォームへ初期値を同期
    setupFormEventListeners(); // ⑦ イベントの登録
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

    // sortOrder（昇順）に並び替え
    itemMaster.sort((a, b) => a.sortOrder - b.sortOrder);

    // 画像グリッドと固定ダイヤUIを生成
    renderItemGrid();
    initFixedDiamondUI();
  } catch (error) {
    console.error("マスタ初期化エラー:", error);
  }
}

// 🌟 JSONファイルとブラウザデータの「lastUpdated」比較・競合自動解決ロジック
async function loadPackMasterAndSync() {
  try {
    const localPacks = await db.getAll();
    let jsonPacks = [];

    try {
      const response = await fetch("assets/json/pack-master.json");
      if (response.ok) {
        const fileData = await response.json();
        // 配列またはメタオブジェクト構造からの柔軟な配列抽出
        jsonPacks = Array.isArray(fileData) ? fileData : fileData.packs || [];
      }
    } catch (e) {
      console.log(
        "pack-master.json が未生成または読み込めないためローカルデータのみで開始します。",
      );
    }

    const mergedMap = new Map();

    // 1. まずIndexedDBのローカルデータをすべて格納
    localPacks.forEach((pack) => mergedMap.set(pack.id, pack));

    // 2. 次にJSONファイルのデータを1件ずつ日本時間比較しながらマージ
    jsonPacks.forEach((jsonPack) => {
      const localPack = mergedMap.get(jsonPack.id);

      if (!localPack) {
        // ローカル側に存在しないマイルストーンならそのまま採用
        mergedMap.set(jsonPack.id, jsonPack);
      } else {
        // 双方が持つデータは日本時間のタイムスタンプ文字列をミリ秒換算して比較
        const localTime = localPack.lastUpdated
          ? new Date(localPack.lastUpdated.replace(/-/g, "/")).getTime()
          : 0;
        const jsonTime = jsonPack.lastUpdated
          ? new Date(jsonPack.lastUpdated.replace(/-/g, "/")).getTime()
          : 0;

        if (jsonTime > localTime) {
          // JSONファイル側の編集日時が本当に新しい場合のみ上書きマージ
          mergedMap.set(jsonPack.id, jsonPack);
        }
      }
    });

    // 3. マージ完了データを展開し、ローカルDB側へ永続同期保存
    temporaryPackData = Array.from(mergedMap.values());
    await db.saveAll(temporaryPackData);
    console.log(
      `📊 日本時間ベースでのデータ検証完了。総件数: ${temporaryPackData.length} 件`,
    );
  } catch (error) {
    console.error("パックマスタのマージ・同期処理に失敗しました:", error);
  }
}

/**
 * =========================================================================
 * 📦 ウルトラセールパック管理専用 制御スクリプト（日本時間表記版・2/3）
 * =========================================================================
 */

// 選択用画像グリッドの動的描画（有償ダイヤ除外 ＋ defaultPackPricesに応じたフィルター）
function renderItemGrid() {
  if (!itemGrid) return;
  itemGrid.innerHTML = itemMaster
    .filter((item) => {
      // 1. 有償ダイヤは常に除外
      if (item.id === DIAMOND_ITEM_ID) return false;

      // 2. defaultPackPrices が設定されている場合は金額チェック
      if (
        item.defaultPackPrices &&
        typeof item.defaultPackPrices === "string"
      ) {
        // カンマで区切って空白を除去し配列化する（例: ["6000", "11800"]）
        const allowedPrices = item.defaultPackPrices
          .split(",")
          .map((p) => p.trim());
        // 現在フォームで選ばれている金額（activePrice）が含まれている場合のみ表示
        return allowedPrices.includes(activePrice);
      }

      // 指定がないアイテムはすべての価格で表示
      return true;
    })
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

// 💎 フォーム内の固定ダイヤ枠にマスタから取得した画像と名前をセット
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

  // 💳 課金額タブ組み立て（initDynamicFilters 内）
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
      renderTable(); // 金額切り替え時はテーブルを再ビルド

      // 🌟ここを追記：タブ切り替え時にピッカーの表示アイテムを最新化
      renderItemGrid();
      updateItemSelectorUI();
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

  // 金額タブが切り替わったらフォームの固定ダイヤ入力欄にデフォルト数を自動同期
  const diamondInput = document.querySelector(".js-diamond-count-input");
  if (diamondInput && !editingPackId) {
    diamondInput.value = DEFAULT_DIAMOND_COUNTS[activePrice] || 0;
  }
}

// フォームへのデータ読み込み（編集モード）
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

// フォームのリセット（新規登録モード）
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
 * 📦 ウルトラセールパック管理専用 制御スクリプト（日本時間表記版・3/3）
 * =========================================================================
 */

// 🌟 現在の時刻を「YYYY-MM-DD HH:mm:ss」の日本時間形式の文字列で取得するヘルパー関数
function getJSTDateTimeString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// --- 6. テーブル描画・制御（マイルストーン数値の昇順ソート対応版） ---
function renderTable() {
  const tbody = document.querySelector(".js-pack-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  // 🌟 描画する前に、マイルストーン数値を賢く数値昇順（小さい順）に並び替える
  temporaryPackData.sort((a, b) => {
    // 文字列から比較用の先頭数値を取り出す（例: "10-24" ➔ 10、"120" ➔ 120）
    const numA = parseInt(a.milestone.split("-")[0], 10) || 0;
    const numB = parseInt(b.milestone.split("-")[0], 10) || 0;

    if (numA !== numB) {
      return numA - numB; // 先頭の数値が違えば昇順
    }
    // 万が一 "10-24" と "10-50" のように先頭が同じなら、後半の数値でさらに比較
    const subA = parseInt(a.milestone.split("-")[1], 10) || 0;
    const subB = parseInt(b.milestone.split("-")[1], 10) || 0;
    return subA - subB;
  });

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

    tr.innerHTML = `
        <td><span class="condition-text">${conditionText}</span></td>
        <td>${Number(activePrice).toLocaleString()}円</td>
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

// --- 7. 各種イベント・入力制限の登録 ---
function setupFormEventListeners() {
  // テーブル内イベントの一括バブリングキャッチ
  document
    .querySelector(".js-pack-table-body")
    .addEventListener("click", async (e) => {
      // ① 確認用の完了チェックボックス（js-table-check）切り替え時
      const tableCheck = e.target.closest(".js-table-check");
      if (tableCheck) {
        const pack = temporaryPackData.find(
          (p) => p.id === tableCheck.dataset.id,
        );
        if (pack) {
          const currentPricePack = pack.packs.find(
            (p) => p.price === activePrice,
          );
          if (currentPricePack) {
            currentPricePack.isChecked = tableCheck.checked;
            e.target.nextElementSibling.textContent = tableCheck.checked
              ? "済"
              : "未";

            // 🌟該当レコードのタイムスタンプのみを日本時間で更新してセーブ
            pack.lastUpdated = getJSTDateTimeString();
            await db.saveAll(temporaryPackData);
          }
        }
        return;
      }

      // ② ✏️ 編集ボタン
      const editBtn = e.target.closest(".js-edit-btn");
      if (editBtn) {
        loadPackToForm(editBtn.dataset.id);
        return;
      }

      // ③ 🗑️ 削除ボタン
      const deleteBtn = e.target.closest(".js-delete-btn");
      if (deleteBtn) {
        const packId = deleteBtn.dataset.id;
        if (
          confirm(
            "このマイルストーンデータを完全に削除しますか？\n（※含まれるすべての金額データが破棄されます）",
          )
        ) {
          temporaryPackData = temporaryPackData.filter((p) => p.id !== packId);
          if (editingPackId === packId) resetFormToNewMode();
          await db.saveAll(temporaryPackData);
          renderTable();
        }
      }
    });

  // 📦 画像カードのクリック判定
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

  // 📝 マイルストーン入力欄制限＆Enterキーフック
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

  // 個数入力値の変更追従
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
  }

  // ボタンイベント紐付け
  document
    .querySelector(".js-cancel-btn")
    .addEventListener("click", resetFormToNewMode);
  document
    .querySelector(".js-save-btn")
    .addEventListener("click", saveFormData);

  // 💾 純粋な配列形式（各レコード内に個別のlastUpdatedを保持）でJSON出力する処理
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

// --- 8. データ保存ロジック（レコード個別日本時間スタンプ刻印） ---
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
  const currentTimeStamp = getJSTDateTimeString(); // 現在の日本時間

  if (editingPackId) {
    // 【編集モード】
    const pack = temporaryPackData.find((p) => p.id === editingPackId);
    if (pack) {
      pack.milestone = milestone;
      const idx = pack.packs.findIndex((p) => p.price === activePrice);
      if (idx !== -1) {
        pack.packs[idx].rewards = currentRewards;
        pack.packs[idx].isChecked = true; // 手動確定のためチェック済みに
      } else {
        pack.packs.push({
          price: activePrice,
          rewards: currentRewards,
          isChecked: true,
        });
      }
      // 🌟編集した特定レコードのみ最終更新日時を日本時間に更新
      pack.lastUpdated = currentTimeStamp;
    }
  } else {
    // 【新規登録モード】
    const targetId = `p_${activeCategory}_${milestone}`;
    if (temporaryPackData.some((p) => p.id === targetId)) {
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
      isChecked: false, // 初期値は未確認
    }));

    temporaryPackData.push({
      id: targetId,
      category: activeCategory,
      milestone: milestone,
      lastUpdated: currentTimeStamp, // 🌟新規データに日本時間スタンプを直下保持
      packs: generatedPacks,
    });
  }

  // ローカルDBの書き換えと画面更新
  await db.saveAll(temporaryPackData);
  renderTable();
  resetFormToNewMode();
}

// ユーティリティキーフック
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && editingPackId !== null) resetFormToNewMode();
});
