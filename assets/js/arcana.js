import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// 優先度の選択肢定義
const PRIORITY_OPTIONS = [
  { value: "LR解放済", label: "LR解放済" },
  { value: "★5", label: "★★★★★" },
  { value: "★4", label: "★★★★" },
  { value: "★3", label: "★★★" },
  { value: "★2", label: "★★" },
  { value: "★1", label: "★" },
  { value: "", label: "未設定" },
];

// 💡 23種類の効果タグマスタ
const EFFECT_TAGS_MASTER = [
  "HP",
  "攻撃力",
  "クリダメ強化",
  "物理クリダメ緩和",
  "魔法クリダメ緩和",
  "HPドレイン",
  "カウンタ",
  "物魔防御貫通",
  "防御貫通",
  "耐久力",
  "クリティカル",
  "クリティカル耐性",
  "防御力",
  "物理防御力",
  "魔法防御力",
  "腕力",
  "技力",
  "魔力",
  "命中",
  "回避",
  "弱体効果命中",
  "弱体効果耐性",
  "パーティLv上限",
];

let arcanaMaster = [];
let userArcanaStatusMap = {}; // { arcanaId: "LR解放済" 等 }
let currentUserId = null;
let currentWorldId = null;
let selectedFilters = []; // 💡 選択中のフィルター配列

/**
 * 🔮 アルカナページの初期化エントリーポイント
 */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("⏳ [Arcana] アルカナページの初期化を開始します...");

  // 1. まずマスタデータを読み込む
  await loadMasters();

  // 2. フィルターボタンの描画 ＆ クリアボタンのイベント設定
  renderFilterChips();
  initFilterClearEvent();

  // 3. 認証情報の準備ができるのを待ってから処理を開始
  const checkAuthReady = setInterval(async () => {
    if (window.auth) {
      clearInterval(checkAuthReady);

      window.auth.onAuthStateChanged(async (user) => {
        if (!user) {
          console.warn("⚠️ ログインしていません。ログインページに移動します。");
          window.location.href = "login.html";
          return;
        }
        currentUserId = user.uid;

        // 初回ロード＆描画の実行
        await initAndRenderArcana();

        // 4. 「更新する」ボタンのクリックイベントを設定
        initUpdateEvent();
      });
    }
  }, 100);

  window.addEventListener("appWorldChanged", async (e) => {
    if (!currentUserId) return;
    const newWorldId =
      e.detail?.worldId || sessionStorage.getItem("app_current_world_id");
    currentWorldId = newWorldId;
    await initAndRenderArcana();
  });
});

/**
 * 🏷️ フィルターチップスを動的に生成・描画する関数
 */
function renderFilterChips() {
  const container = document.getElementById("arcanaFilterChips");
  if (!container) return;
  container.innerHTML = "";

  EFFECT_TAGS_MASTER.forEach((tagName) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "arcana-filter-chip";
    btn.textContent = tagName;

    if (selectedFilters.includes(tagName)) {
      btn.classList.add("is-active");
    }

    btn.addEventListener("click", () => {
      const idx = selectedFilters.indexOf(tagName);
      if (idx !== -1) {
        selectedFilters.splice(idx, 1);
        btn.classList.remove("is-active");
      } else {
        selectedFilters.push(tagName);
        btn.classList.add("is-active");
      }
      renderArcanaTable(); // 絞り込みを反映して再描画
    });

    container.appendChild(btn);
  });
}

/**
 * 🧹 「選択をクリア」ボタンのイベント設定
 */
function initFilterClearEvent() {
  const clearBtn = document.getElementById("js-clear-filters");
  if (!clearBtn) return;

  clearBtn.addEventListener("click", () => {
    selectedFilters = [];
    renderFilterChips(); // チップスの見た目をリセット
    renderArcanaTable(); // テーブルを全件表示に戻す
  });
}

/**
 * 🌍 ワールドごとの進捗データをFirestoreから取得し、テーブルを構築・再描画する共通関数
 */
async function initAndRenderArcana() {
  currentWorldId = sessionStorage.getItem("app_current_world_id") || "w1";
  userArcanaStatusMap = {};
  await fetchUserArcanaStatus();
  renderArcanaTable();
}

/**
 * 📦 JSONマスタデータをロード
 */
async function loadMasters() {
  try {
    const charJsonUrl = "assets/json/character-master.json";
    const arcanaJsonUrl = "assets/json/arcana-master.json";

    const [charRes, arcanaRes] = await Promise.all([
      fetch(charJsonUrl),
      fetch(arcanaJsonUrl),
    ]);

    if (!charRes.ok || !arcanaRes.ok)
      throw new Error("マスタデータの読込に失敗しました。");

    window.characterMaster = await charRes.json();
    arcanaMaster = await arcanaRes.json();

    arcanaMaster.sort((a, b) => Number(a.id) - Number(b.id));
  } catch (error) {
    console.error("🚨 マスタデータの読込エラー:", error);
    const tbody = document.getElementById("arcanaTableBody");
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="p-arcana-table__error-message">マスタデータの読み込みに失敗しました。</td></tr>';
    }
  }
}

async function fetchUserArcanaStatus() {
  if (!currentUserId || !currentWorldId || !window.db) return;
  try {
    const statusDocRef = doc(
      window.db,
      "users",
      currentUserId,
      "worlds",
      currentWorldId,
      "arcanaStatus",
      "status",
    );
    const docSnap = await getDoc(statusDocRef);
    if (docSnap.exists()) {
      userArcanaStatusMap = docSnap.data().statusMap || {};
    } else {
      userArcanaStatusMap = {};
    }
  } catch (error) {
    console.error("🚨 アルカナ進捗の取得に失敗しました:", error);
    userArcanaStatusMap = {};
  }
}

/**
 * 📊 アルカナ一覧テーブルを動的に描画（フィルター＆グループ化対応版）
 */
function renderArcanaTable() {
  const tbody = document.getElementById("arcanaTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (arcanaMaster.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="p-arcana-table__loading">表示可能なデータがありません</td></tr>';
    return;
  }

  // 💡 フィルタリングの適用（OR条件：選択されたタグのいずれかを含んでいれば表示）
  let targetList = arcanaMaster;
  if (selectedFilters.length > 0) {
    targetList = arcanaMaster.filter((ar) => {
      if (!Array.isArray(ar.effectsList)) return false;
      return ar.effectsList.some((eff) => selectedFilters.includes(eff.status));
    });
  }

  if (targetList.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="p-arcana-table__loading" style="text-align:center; padding:30px;">条件に一致するアルカナがありません</td></tr>';
    return;
  }

  const charMaster = window.characterMaster || [];

  const groups = {};
  PRIORITY_OPTIONS.forEach((opt) => {
    groups[opt.value] = {
      label: opt.label || "未設定",
      list: [],
    };
  });

  // 絞り込み後のリストを優先度グループに仕分ける
  targetList.forEach((ar) => {
    const currentPriority = userArcanaStatusMap[ar.id] || "";
    if (groups[currentPriority]) {
      groups[currentPriority].list.push(ar);
    } else {
      groups[""].list.push(ar);
    }
  });

  if (!window.collapsedArcanaGroups) {
    window.collapsedArcanaGroups = { "": true };
  }

  PRIORITY_OPTIONS.forEach((opt) => {
    const group = groups[opt.value];
    if (group.list.length === 0) return;

    const headerRow = document.createElement("tr");
    headerRow.className = "p-arcana-group-header";
    if (window.collapsedArcanaGroups[opt.value]) {
      headerRow.classList.add("is-collapsed");
    }

    headerRow.innerHTML = `
      <td colspan="4">
        <div class="p-arcana-group-header__content">
          <span class="p-arcana-group-header__title">${group.label}</span>
          <span class="p-arcana-group-header__badge">${group.list.length}件</span>
        </div>
      </td>
    `;

    headerRow.onclick = () => {
      const isCurrentlyCollapsed = window.collapsedArcanaGroups[opt.value];
      window.collapsedArcanaGroups[opt.value] = !isCurrentlyCollapsed;
      renderArcanaTable();
    };

    tbody.appendChild(headerRow);

    group.list.forEach((ar) => {
      const row = document.createElement("tr");
      row.id = `arcana-row-${ar.id}`;
      row.className = "p-arcana-table__data-row";

      if (window.collapsedArcanaGroups[opt.value]) {
        row.classList.add("is-hidden");
      }

      const currentPriority = userArcanaStatusMap[ar.id] || "";
      if (currentPriority === "LR解放済") {
        row.classList.add("ar-done");
      }

      const makeSlotHtml = (idx) => {
        const cId = ar[`charId${idx}`];
        if (!cId) return '<div class="slot slot--hide">-</div>';

        if (cId === "未定") {
          return '<div class="slot" style="font-size: 10px; color: var(--text-sub); font-weight: bold; background: var(--input-bg-sub); border: 1px dashed var(--border-light);" title="未定">未定</div>';
        }

        const foundChar = charMaster.find(
          (ch) => String(ch.id).trim() === String(cId).trim(),
        );
        return foundChar
          ? `<div class="slot"><img src="${foundChar.iconUrl}" alt="${foundChar.name}" title="${foundChar.name}"></div>`
          : `<div class="slot slot__id-fallback">${cId}</div>`;
      };

      let selectOptionsHtml = "";
      PRIORITY_OPTIONS.forEach((item) => {
        const selected = opt.value === item.value ? "selected" : "";
        selectOptionsHtml += `<option value="${item.value}" ${selected}>${item.label}</option>`;
      });

      row.innerHTML = `
        <td class="p-arcana-table__td-name">
          <span class="p-arcana-table__id-badge">${ar.id}</span>
          <strong class="p-arcana-table__name-text">${ar.name}</strong>
        </td>
        <td class="p-arcana-table__td-chars">
          <div class="slots">
            ${makeSlotHtml(1)}
            ${makeSlotHtml(2)}
            ${makeSlotHtml(3)}
            ${makeSlotHtml(4)}
          </div>
        </td>
        <td class="p-arcana-table__td-effect">${formatEffectsText(ar.effectsList)}</td>
        <td class="p-arcana-table__td-priority">
          <select class="p-arcana-priority-select" data-arcana-id="${ar.id}" onchange="handlePrioritySelectChange(this)">
            ${selectOptionsHtml}
          </select>
        </td>
      `;

      tbody.appendChild(row);
    });
  });
}

function formatEffectsText(effectsList) {
  if (!Array.isArray(effectsList) || effectsList.length === 0) {
    return '<span style="color: var(--text-muted); font-style: italic;">効果なし</span>';
  }

  return effectsList
    .map(function (eff) {
      if (!eff.status || !eff.type) return "";
      var valStr = "";
      if (eff.type === "percent") {
        valStr = eff.status + eff.value + "%";
      } else if (eff.type === "fixed") {
        var numVal = Number(eff.value);
        valStr =
          eff.status + (isNaN(numVal) ? eff.value : numVal.toLocaleString());
      } else if (eff.type === "charLv") {
        valStr = eff.status + "キャラLv×" + eff.value;
      }
      return valStr;
    })
    .filter(Boolean)
    .join(", ");
}

window.handlePrioritySelectChange = function (selectElement) {
  const arcanaId = selectElement.getAttribute("data-arcana-id");
  const newPriority = selectElement.value;
  userArcanaStatusMap[arcanaId] = newPriority;
};

function initUpdateEvent() {
  const updateBtn = document.getElementById("js-arcana-btn-update");
  if (!updateBtn) return;

  updateBtn.addEventListener("click", async () => {
    if (!currentUserId || !currentWorldId || !window.db) {
      alert("ユーザー情報またはワールド情報が取得できません。");
      return;
    }

    document.querySelectorAll(".p-arcana-priority-select").forEach((sel) => {
      const arcanaId = sel.getAttribute("data-arcana-id");
      userArcanaStatusMap[arcanaId] = sel.value;
    });

    try {
      updateBtn.disabled = true;
      updateBtn.classList.add("is-loading");

      const statusDocRef = doc(
        window.db,
        "users",
        currentUserId,
        "worlds",
        currentWorldId,
        "arcanaStatus",
        "status",
      );

      await setDoc(
        statusDocRef,
        {
          statusMap: userArcanaStatusMap,
          updatedAt: new Date(),
        },
        { merge: true },
      );

      renderArcanaTable();
      updateBtn.classList.add("is-success-flash");

      setTimeout(() => {
        alert("アルカナの優先度情報を正常に保存しました！");
      }, 100);
    } catch (error) {
      console.error("🚨 優先度の一括保存に失敗しました:", error);
      alert("保存中にエラーが発生しました。");
    } finally {
      updateBtn.disabled = false;
      updateBtn.classList.remove("is-loading");
      setTimeout(() => {
        updateBtn.classList.remove("is-success-flash");
      }, 1500);
    }
  });
}
