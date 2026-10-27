import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
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

// 23種類の効果タグマスタ
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
let userCharactersMap = {}; // { charId: { rarity: "SSR", ... } } の形で保持する
let currentUserId = null;
let currentWorldId = null;
let selectedFilters = []; // 選択中のフィルター配列

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

  // 3. 合算効果モーダルのHTML枠組みを挿入
  injectArcanaTotalModal();

  // 4. 認証情報の準備ができるのを待ってから処理を開始
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

        // 5. 「更新する」ボタンのクリックイベントを設定
        initUpdateEvent();
      });
    }
  }, 100);

  // ワールド切り替えイベントを監視
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
  userCharactersMap = {}; // 💡 追加：初期化

  // 💡 変更：アルカナステータスとキャラクターのレアリティ双方を取得する
  await Promise.all([
    fetchUserArcanaStatus(),
    fetchUserCharactersStatus(), // 💡 追加：キャラクターデータを取得する関数を並列で走らせる
  ]);

  renderArcanaTable();
}

/**
 * 📥 【追加】Firestoreからユーザーのキャラクター育成（レアリティ）進捗を取得
 */
async function fetchUserCharactersStatus() {
  if (!currentUserId || !currentWorldId || !window.db) return;
  try {
    const charCollectionRef = collection(
      window.db,
      "users",
      currentUserId,
      "worlds",
      currentWorldId,
      "ownedCharacters",
    );
    const querySnapshot = await getDocs(charCollectionRef);

    querySnapshot.forEach((doc) => {
      userCharactersMap[doc.id] = doc.data(); // doc.id は 'c001' など。中身は { rarity: "SSR" } など
    });
    console.log(
      "📥 [Arcana] キャラクターのレアリティマップを読み込みました",
      userCharactersMap,
    );
  } catch (error) {
    console.error("🚨 キャラクター所持情報の取得に失敗しました:", error);
    userCharactersMap = {};
  }
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

/**
 * 📥 Firestoreからユーザーのアルカナ進捗を取得
 */
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

  // フィルタリングの適用（OR条件：選択されたタグのいずれかを含んでいれば表示）
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

    // 「LR解放済」グループのときだけ「合計効果を見る」ボタンを添える
    let extraButtonHtml = "";
    if (opt.value === "LR解放済") {
      extraButtonHtml = `<button type="button" class="p-arcana-total-btn js-open-total-modal">効果の合計を見る</button>`;
    }

    headerRow.innerHTML = `
      <td colspan="4">
        <div class="p-arcana-group-header__content">
        <span class="p-arcana-group-header__title">${group.label}</span>
        <span class="p-arcana-group-header__badge">${group.list.length}件</span>
        <span class="p-arcana-group-header__button">${extraButtonHtml}</span>
        </div>
      </td>
    `;

    headerRow.onclick = (e) => {
      if (e.target.closest(".js-open-total-modal")) {
        openTotalEffectsModal();
        return;
      }
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

      // 「未定」と「空欄」の判定を含むスロット描画
      const makeSlotHtml = (idx) => {
        const cId = ar[`charId${idx}`];
        if (!cId) return '<div class="slot slot--hide">-</div>';

        if (cId === "未定") {
          return '<div class="slot" style="font-size: 10px; color: var(--text-sub); font-weight: bold; background: var(--input-bg-sub); border: 1px dashed var(--border-light);" title="未定">未定</div>';
        }

        const foundChar = charMaster.find(
          (ch) => String(ch.id).trim() === String(cId).trim(),
        );

        if (!foundChar) {
          return `<div class="slot slot__id-fallback">${cId}</div>`;
        }

        // 💡 データベース（Firestore）からこのキャラクターの現在のレアリティを取得
        const userCharData = userCharactersMap[foundChar.id];
        const currentRarity = userCharData ? userCharData.rarity : "未所持"; // デフォルトを未所持に変更

        // 💡 所持状況・レアリティに応じたクラス名の動的分離
        let rarityClassName = "";
        if (currentRarity === "未所持") {
          // 🌟【新仕様】未所持の場合は開発ルールに準拠した状態クラスを付与
          rarityClassName = "is-not-owned";
        } else {
          // 所持している場合はセーフクラスに変換（例: "SSR+" -> "rarity--ssr-plus"）
          const safeRarityClass = String(currentRarity)
            .toLowerCase()
            .replace("+", "-plus");
          rarityClassName = `rarity--${safeRarityClass}`;
        }

        // 🌟【main.jsの共通関数を利用】
        let starsHtml = "";
        let plusHtml = "";

        // 所持している場合のみ星やプラスバッジを抽出（未所持なら空のまま）
        if (
          currentRarity !== "未所持" &&
          typeof window.createCharacterBadgeElement === "function"
        ) {
          const badgeEl = window.createCharacterBadgeElement(
            foundChar,
            currentRarity,
          );
          const starsEl = badgeEl.querySelector(".c-chara-card__stars");
          const plusImgEl = badgeEl.querySelector(".c-chara-card__plus-badge");

          if (starsEl) starsHtml = starsEl.innerHTML;
          if (plusImgEl && plusImgEl.classList.contains("is-active")) {
            plusHtml = plusImgEl.innerHTML;
          }
        }

        // .slotの直下にimgと装飾パーツをすべて同階層で並べる構造
        return `
          <div class="slot ${rarityClassName}" data-rarity="${currentRarity}" title="${foundChar.name} (${currentRarity})">
            <!-- 1. キャラクターの顔グラフィック -->
            <img src="${foundChar.iconUrl}" alt="${foundChar.name}">
            
            <!-- 2. 枠線（同じ階層） -->
            <div class="slot__border"></div>
            
            <!-- 3. ☆マーク（同じ階層） -->
            <div class="slot__stars">
              ${starsHtml}
            </div>
            
            <!-- 4. ＋画像（同じ階層） -->
            <div class="slot__plus">
              ${plusHtml}
            </div>
          </div>
        `;
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

/**
 * 📝 effectsList から効果テキストを動的生成
 */
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

/**
 * 📊 合算効果マトリクスモーダルのHTMLを動的挿入
 */
function injectArcanaTotalModal() {
  if (document.getElementById("js-arcana-total-modal")) return;
  const modalHtml = `
    <div id="js-arcana-total-modal" class="c-modal c-arcana-modal" aria-hidden="true" inert>
        <div class="c-modal__overlay js-arcana-total-modal-close"></div>
        <div class="c-arcana-modal__container c-modal__container">
            <header class="c-world-modal__header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <span style="font-weight:bold; font-size:1.5rem;">📊 LR解放済みアルカナ 合算効果一覧</span>
                <button type="button" class="c-world-modal__close-btn js-arcana-total-modal-close" style="background:none; border:none; font-size:2rem; cursor:pointer;">&times;</button>
            </header>
            <div class="p-arcana-matrix-wrapper">
                <table class="p-arcana-matrix-table">
                    <thead>
                        <tr>
                            <th style="width: 35%;">ステータス</th>
                            <th style="width: 21%;">％</th>
                            <th style="width: 22%;">固定値</th>
                            <th style="width: 22%;">キャラLv×</th>
                        </tr>
                    </thead>
                    <tbody id="js-arcana-matrix-tbody">
                        <!-- 動的挿入 -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  // 💡 修正：閉じるボタンをクリックしたときにフォーカスを外してから非表示にする
  document.querySelectorAll(".js-arcana-total-modal-close").forEach((btn) => {
    btn.addEventListener("click", () => {
      // フォーカスがあたっている要素がモーダル内であれば強制的に外す（blur）
      const activeEl = document.activeElement;
      const modal = document.getElementById("js-arcana-total-modal");
      if (modal && modal.contains(activeEl)) {
        activeEl.blur();
      }

      if (modal) {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        modal.setAttribute("inert", "");

        document.body.classList.remove("is-modal-open");
      }
    });
  });
}

/**
 * 🧮 LR解放済みのアルカナ効果を合算してモーダルに表示する関数
 */
function openTotalEffectsModal() {
  injectArcanaTotalModal();

  const lrArcanaIds = Object.keys(userArcanaStatusMap).filter(
    (id) => userArcanaStatusMap[id] === "LR解放済",
  );

  const totals = {};
  EFFECT_TAGS_MASTER.forEach((tagName) => {
    totals[tagName] = { percent: 0, fixed: 0, charLv: 0 };
  });

  lrArcanaIds.forEach((id) => {
    const ar = arcanaMaster.find((item) => String(item.id) === String(id));
    if (!ar || !Array.isArray(ar.effectsList)) return;

    ar.effectsList.forEach((eff) => {
      if (!eff.status || !eff.type || eff.value === undefined) return;
      if (totals[eff.status]) {
        totals[eff.status][eff.type] += Number(eff.value) || 0;
      }
    });
  });

  const tbody = document.getElementById("js-arcana-matrix-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  let hasData = false;

  EFFECT_TAGS_MASTER.forEach((tagName) => {
    const p = totals[tagName].percent;
    const f = totals[tagName].fixed;
    const c = totals[tagName].charLv;

    if (p === 0 && f === 0 && c === 0) return;

    hasData = true;
    const tr = document.createElement("tr");

    const pStr = p > 0 ? `${p}%` : "-";
    const fStr = f > 0 ? f.toLocaleString() : "-";
    const cStr = c > 0 ? `キャラLv×${c}` : "-";

    tr.innerHTML = `
      <td>${tagName}</td>
      <td>${pStr}</td>
      <td>${fStr}</td>
      <td>${cStr}</td>
    `;
    tbody.appendChild(tr);
  });

  if (!hasData) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--theme-text-muted); padding:20px;">LR解放済みに設定されたアルカナ効果がありません</td></tr>`;
  }

  const modal = document.getElementById("js-arcana-total-modal");
  if (modal) {
    modal.classList.add("is-open");
    modal.removeAttribute("aria-hidden");
    modal.removeAttribute("inert");

    document.body.classList.add("is-modal-open");
  }
}

window.handlePrioritySelectChange = function (selectElement) {
  const arcanaId = selectElement.getAttribute("data-arcana-id");
  const newPriority = selectElement.value;
  userArcanaStatusMap[arcanaId] = newPriority;
};

/**
 * 💾 「更新する」ボタンが押されたときの一括保存
 */
function initUpdateEvent() {
  const updateBtn = document.getElementById("js-arcana-btn-update");
  if (!updateBtn) return;

  updateBtn.addEventListener("click", async () => {
    const currentWorldId = sessionStorage.getItem("app_current_world_id");

    // 🛑 【ガード追加】ワールドが選択されていない、または未登録の場合のブロック
    if (!currentUserId || !currentWorldId || !window.db) {
      alert(
        "ワールドが選択されていません。「ワールド選択」から有効なワールドを選んでから更新してください。",
      );
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
