/**
 * =========================================================================
 * 📦 ウルトラセールパック管理専用 制御スクリプト（完全統合版・前半）
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

// 選択用画像グリッドの動的描画（有償ダイヤ item_01 を自動で除外する）
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

  // 💳 課金額タブ組み立て（修正完了版）
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
      renderTable(); // 報酬内容とチェック状態が切り替わるため再ビルド
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

  // 💎 金額タブが切り替わったら、フォームの固定ダイヤ入力欄にデフォルト数を自動同期
  const diamondInput = document.querySelector(".js-diamond-count-input");
  if (diamondInput && !editingPackId) {
    diamondInput.value = DEFAULT_DIAMOND_COUNTS[activePrice] || 0;
  }
}

// --- 6. テーブル描画・制御（「画像×個数」の一行収め仕様 ＆ 確認チェックボックス対応版） ---
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

    // 現在のisCheckedフラグの状態を取得（無ければデフォルトfalse）
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

// --- 7. フォームのモード管理・同期ロジック（ダイヤとカスタムを分離復元） ---
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
        // 💎 ダイヤは固定枠の入力値へ復元
        document.querySelector(".js-diamond-count-input").value = r.count;
      } else {
        // 📦 それ以外は最大3つのカスタムアイテム枠へ
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

// --- 8. 各種イベント・ショートカット・入力制限の登録（完全統合版） ---
function setupFormEventListeners() {
  // 🌟 一覧テーブル内のクリック判定（チェックボックス切り替え・編集・削除のバブリングキャッチ）
  document
    .querySelector(".js-pack-table-body")
    .addEventListener("click", (e) => {
      // ① テーブル上の確認チェックボックス（js-table-check）が切り替えられたとき
      const tableCheck = e.target.closest(".js-table-check");
      if (tableCheck) {
        const packId = tableCheck.dataset.id;
        const pack = temporaryPackData.find((p) => p.id === packId);
        if (pack) {
          // 現在アクティブな金額タブのパックデータを検索
          const currentPricePack = pack.packs.find(
            (p) => p.price === activePrice,
          );
          if (currentPricePack) {
            // チェックボックスのON/OFF状態をそのままisCheckedに格納（データ同期）
            currentPricePack.isChecked = tableCheck.checked;

            // 隣のテキスト表記（済 / 未）をリアルタイムに書き換える
            const textEl = tableCheck.nextElementSibling;
            if (textEl) {
              textEl.textContent = tableCheck.checked ? "済" : "未";
            }
          }
        }
        return;
      }

      // ② ✏️ 編集ボタンが押されたとき
      const editBtn = e.target.closest(".js-edit-btn");
      if (editBtn) {
        loadPackToForm(editBtn.dataset.id);
        return;
      }

      // ③ 🗑️ 削除ボタンが押されたとき
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
          // 配列から対象データを完全消去
          temporaryPackData = temporaryPackData.filter((p) => p.id !== packId);

          // 編集中データを消した場合はフォームも連動リセット
          if (editingPackId === packId) {
            resetFormToNewMode();
          }

          // テーブルを再描画
          renderTable();
        }
      }
    });

  // 📦 画像カードのクリック判定（親要素を確実に捉えて空きスロットへ割り当て）
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

  // 📝 【確定版】マイルストーン入力欄（最初から半角限定・不要な文字は即座に消去）
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

  // キャンセル・保存ボタンのイベント登録
  document
    .querySelector(".js-cancel-btn")
    .addEventListener("click", resetFormToNewMode);
  document
    .querySelector(".js-save-btn")
    .addEventListener("click", saveFormData);

  // 💾 pack-master.jsonを直接生成してPCへダウンロードする処理
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

// --- 9. データ保存ロジック（ダイヤ＋カスタム3枠・全金額スロット自動生成・isChecked対応版） ---
function saveFormData() {
  const milestone = document.querySelector(".js-form-milestone").value.trim();
  if (!milestone) {
    alert("マイルストーン数値を入力してください");
    return;
  }
  // 💎 現在の画面上のダイヤ入力数
  const diamondCount =
    parseInt(document.querySelector(".js-diamond-count-input").value, 10) || 0;

  // 💎 まずはダイヤを報酬の先頭配列に格納
  const currentRewards = [{ item: DIAMOND_ITEM_ID, count: diamondCount }];

  // 📦 選択されているカスタム枠（最大3枠）を合流させる
  Object.keys(selectedItems).forEach((itemId) => {
    currentRewards.push({ item: itemId, count: selectedItems[itemId] });
  });

  const allPrices = ["11800", "6000", "3000", "1500", "1000", "650", "160"];

  if (editingPackId) {
    // ==========================================
    // 【編集モード】既存パックの対象金額を上書き ＆ チェック済みに更新
    // ==========================================
    const pack = temporaryPackData.find((p) => p.id === editingPackId);
    if (pack) {
      pack.milestone = milestone;
      const pricePackIndex = pack.packs.findIndex(
        (p) => p.price === activePrice,
      );
      if (pricePackIndex !== -1) {
        pack.packs[pricePackIndex].rewards = currentRewards;
        pack.packs[pricePackIndex].isChecked = true; // 手動で編集確定したのでチェック済みに
      } else {
        pack.packs.push({
          price: activePrice,
          rewards: currentRewards,
          isChecked: true,
        });
      }
    }
  } else {
    // ==========================================
    // 【新規登録モード】⚠️ カテゴリ＋マイルストーンの重複チェック
    // ==========================================
    const targetId = `p_${activeCategory}_${milestone}`;
    const isDuplicate = temporaryPackData.some(
      (p) =>
        p.id === targetId ||
        (p.category === activeCategory && p.milestone === milestone),
    );

    if (isDuplicate) {
      const catLabel = categoryMap[activeCategory] || activeCategory;
      alert(
        `【重複エラー】\n「${catLabel} ${milestone}」はすでに登録されています。\n\n報酬内容を追加・変更したい場合は、左側の一覧にある該当データの『編集』ボタンから操作を行ってください。`,
      );
      return;
    }

    // 🌟 全金額スロットを一括仮生成（新規登録時はすべての金額を一律「チェックなし」にする！）
    const generatedPacks = allPrices.map((price) => {
      // 現在入力中の金額であれば画面のカスタム内容を入れ、それ以外は初期デフォルトダイヤを入れる
      const rewards =
        price === activePrice
          ? currentRewards
          : [
              {
                item: DIAMOND_ITEM_ID,
                count: DEFAULT_DIAMOND_COUNTS[price] || 0,
              },
            ];

      return {
        price: price,
        rewards: rewards,
        isChecked: false, // 💤 今開いている金額も含めて、すべて最初は「未確認」からスタート！
      };
    });

    const newPack = {
      id: `p_${activeCategory}_${milestone}`,
      category: activeCategory,
      milestone: milestone,
      packs: generatedPacks,
    };

    temporaryPackData.push(newPack);
  }

  // 画面表示をすべて最新にリフレッシュ
  renderTable();
  resetFormToNewMode();
}
