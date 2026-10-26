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

let arcanaMaster = [];
let userArcanaStatusMap = {}; // { arcanaId: "LR解放済" 等 }
let currentUserId = null;
let currentWorldId = null;

/**
 * 🔮 アルカナページの初期化エントリーポイント
 */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("⏳ [Arcana] アルカナページの初期化を開始します...");

  // 1. まずマスタデータを読み込む
  await loadMasters();

  // 2. 認証情報の準備ができるのを待ってから処理を開始
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

        // 3. 「更新する」ボタンのクリックイベントを設定
        initUpdateEvent();
      });
    }
  }, 100);

  // 💡【キャラクターページ方式】ワールド切り替えイベントを監視して、データを完全に再取得＆再描画する
  window.addEventListener("appWorldChanged", async (e) => {
    if (!currentUserId) return;

    // イベントから渡された新しいワールドID、またはセッションから確実に対象を取得
    const newWorldId =
      e.detail?.worldId || sessionStorage.getItem("app_current_world_id");
    console.log(
      `🔄 [Arcana Bridge] ワールド変更を検知しました (新WID: ${newWorldId})。アルカナ一覧を再展開します。`,
    );

    currentWorldId = newWorldId;

    // 新しいワールドのデータで再ロード＆再レンダリングを実行
    await initAndRenderArcana();
  });
});

/**
 * 🌍 ワールドごとの進捗データをFirestoreから取得し、テーブルを構築・再描画する共通関数
 */
async function initAndRenderArcana() {
  // 1. 現在選択されているワールドIDをセッションから取得（なければ "w1"）
  currentWorldId = sessionStorage.getItem("app_current_world_id") || "w1";
  console.log(
    `📂 [Arcana] 対象ワールドID [${currentWorldId}] の進捗データを同期します...`,
  );

  // 2. 前のワールドのデータが残らないよう、マップを完全にリセット
  userArcanaStatusMap = {};

  // 3. Firestoreから新しいワールドの進捗を取得
  await fetchUserArcanaStatus();

  // 4. 最新のデータでテーブルを描画
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

    // ID順にソート
    arcanaMaster.sort((a, b) => Number(a.id) - Number(b.id));
    console.log(
      "✅ マスタデータのロード完了。キャラ件数:",
      window.characterMaster.length,
      "アルカナ件数:",
      arcanaMaster.length,
    );
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
      const data = docSnap.data();
      userArcanaStatusMap = data.statusMap || {};
      console.log(
        `📥 ワールド [${currentWorldId}] のアルカナ進捗データを正常に取得しました。`,
      );
    } else {
      userArcanaStatusMap = {};
      console.log(
        `ℹ️ ワールド [${currentWorldId}] のアルカナ進捗データはまだありません（初期状態）。`,
      );
    }
  } catch (error) {
    console.error("🚨 アルカナ進捗の取得に失敗しました:", error);
    userArcanaStatusMap = {};
  }
}

/**
 * 📊 アルカナ一覧テーブルを動的に描画（1つのテーブル内グループ化・開閉版）
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

  const charMaster = window.characterMaster || [];

  // ① 優先度グループの受け皿を初期化
  const groups = {};
  PRIORITY_OPTIONS.forEach((opt) => {
    groups[opt.value] = {
      label: opt.label || "未設定",
      list: [],
    };
  });

  // ② 全アルカナを現在の優先度ごとに仕分ける
  arcanaMaster.forEach((ar) => {
    const currentPriority = userArcanaStatusMap[ar.id] || "";
    if (groups[currentPriority]) {
      groups[currentPriority].list.push(ar);
    } else {
      groups[""].list.push(ar);
    }
  });

  // 💡【記憶保持】現在どのグループが閉じられている（collapsed）かの状態を維持するためのマップ
  if (!window.collapsedArcanaGroups) {
    window.collapsedArcanaGroups = { "": true }; // デフォルトで「未設定」グループだけは閉じておく
  }

  tbody.innerHTML = "";

  // ③ 1つのtbodyの中に、グループ見出し行とデータ行を連続で追加していく
  PRIORITY_OPTIONS.forEach((opt) => {
    const group = groups[opt.value];
    if (group.list.length === 0) return; // 0件のグループは表示しない

    // 🌟 3-1. グループの「区切り見出し行」を生成
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

    // 🔘 見出し行をクリックした時の開閉切り替えイベントを仕込む
    headerRow.onclick = () => {
      const isCurrentlyCollapsed = window.collapsedArcanaGroups[opt.value];
      window.collapsedArcanaGroups[opt.value] = !isCurrentlyCollapsed;
      renderArcanaTable();
    };

    tbody.appendChild(headerRow);

    // 🌟 3-2. グループに所属する「データ行」を生成して追加
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
        <td class="p-arcana-table__td-effect">${ar.effect}</td>
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
 * 🔄 セレクトボックス変更時：即時保存はせず、ローカルのメモリ（マップ）だけを更新する
 */
window.handlePrioritySelectChange = function (selectElement) {
  const arcanaId = selectElement.getAttribute("data-arcana-id");
  const newPriority = selectElement.value;
  userArcanaStatusMap[arcanaId] = newPriority;
};

/**
 * 💾 「更新する」ボタンが押されたとき：現在の全セレクトボックスの状態をまとめてFirestoreに一括保存
 */
function initUpdateEvent() {
  const updateBtn = document.getElementById("js-arcana-btn-update");
  if (!updateBtn) return;

  updateBtn.addEventListener("click", async () => {
    if (!currentUserId || !currentWorldId || !window.db) {
      alert("ユーザー情報またはワールド情報が取得できません。");
      return;
    }

    // 最新のセレクトボックスの状態をすべて回収してマップに反映
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

      // Firestoreへ一括マージ保存
      await setDoc(
        statusDocRef,
        {
          statusMap: userArcanaStatusMap,
          updatedAt: new Date(),
        },
        { merge: true },
      );

      console.log("✨ アルカナの優先度を一括保存しました！");

      // 最新のマップデータに基づいてテーブルを再レンダリング
      renderArcanaTable();

      // 成功演出（クラス切り替え）
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
