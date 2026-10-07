/* -------------------------------------------------------------------------
   1. 画面専用の変数定義 ＆ 選択肢マスター
   ------------------------------------------------------------------------- */
// パッシブ効果の選択肢リスト
const PASSIVE_OPTIONS = [
  "未設定",
  "攻撃力(%)",
  "HP(%)",
  "HPドレイン(%)",
  "防御力(%)",
  "腕力(%)",
  "技力(%)",
  "魔力(%)",
  "耐久力(%)",
  "クリティカル(%)",
  "回避(%)",
  "スピード",
  "防御貫通",
  "物魔防御貫通",
  "命中(%)",
  "クリティカル耐性(%)",
  "弱体効果命中(%)",
  "弱体効果耐性(%)",
  "物理防御力(%)",
  "魔法防御力(%)",
  "物理クリダメ緩和(%)",
  "魔法クリダメ緩和(%)",
  "クリダメ強化(%)",
];

// 💡 フィルター用・ドロップダウン用のアイコン画像
var ATTR_IMAGES = [
  { name: "藍", url: "assets/images/filter-icon/icon-attr-blue.png" },
  { name: "紅", url: "assets/images/filter-icon/icon-attr-red.png" },
  { name: "翠", url: "assets/images/filter-icon/icon-attr-green.png" },
  { name: "黄", url: "assets/images/filter-icon/icon-attr-yellow.png" },
  { name: "天", url: "assets/images/filter-icon/icon-attr-holy.png" },
  { name: "冥", url: "assets/images/filter-icon/icon-attr-dark.png" },
];
var TYPE_IMAGES = [
  {
    name: "ウォーリアー",
    url: "assets/images/filter-icon/icon-type-warrior.png",
  },
  { name: "スナイパー", url: "assets/images/filter-icon/icon-type-gunner.png" },
  {
    name: "ソーサラー",
    url: "assets/images/filter-icon/icon-type-sorcerer.png",
  },
];

// キャラクター詳細データのモック（読み込みテスト用）
var cachedDetailPackage = {
  status: {
    id: "1",
    speed: 120,
    str: 500,
    dex: 450,
    mag: 200,
    sta: 600,
    defInitial: 100,
    hpCustom: 15000,
    penCustom: 50,
    tags: "アタッカー",
  },
  skills: {
    A1: {
      name: "アクティブスキル1",
      normal: "敵単体に300%の物理ダメージ",
      ct: "4",
    },
    A2: {
      name: "アクティブスキル2",
      normal: "敵全体に150%の物理ダメージ",
      ct: "6",
    },
    P1: { name: "パッシブスキル1", normal: "戦闘開始時、自身の攻撃力+10%" },
    P2: {
      name: "パッシブスキル2",
      normal: "自身のHPが50%以下の時、回避率+15%",
    },
  },
  weapon: {
    name: "ヴァルキリースピア",
    mika: {
      val: "腕力+100",
      p1: "攻撃力(%)+10",
      p2: "クリティカル(%)+5",
      p3: "未設定",
    },
  },
};

var currentDetailIndex = -1; // 現在詳細を見ているキャラのインデックス番

/* =========================================================================
   🧙‍♀️ ログイン成功後の初期化処理（JSON読み込み）
   ========================================================================= */
window.onAdminAuthSuccess = function (user) {
  console.log(
    "admin.js からの通知：ローカルJSONによるキャラクターページの描画を開始します。",
  );

  if (typeof showLoading === "function") showLoading();

  const charJsonUrl = "assets/json/character-master.json";

  fetch(charJsonUrl)
    .then((response) => {
      if (!response.ok)
        throw new Error("キャラクターマスタの読込に失敗しました。");
      return response.json();
    })
    .then(function (charData) {
      if (typeof characterMaster === "undefined") window.characterMaster = [];
      characterMaster = charData;

      // 👤 キャラクター一覧をIDの大きい順（降順）にソート
      characterMaster.sort(function (a, b) {
        return Number(b.id) - Number(a.id);
      });
      console.log(
        "🌸 [JSON] キャラクターデータを読み込み、ID降順にソートしました！件数:",
        characterMaster.length,
      );

      renderGridHTML(characterMaster);

      if (typeof buildFilterButtons === "function") buildFilterButtons();
      if (typeof buildCustomDropdowns === "function") buildCustomDropdowns();
    })
    .catch(function (error) {
      console.error("JSONデータの読込中にエラーが発生しました:", error);
      alert(
        "キャラクターマスタの読込に失敗しました。assets/json/character-master.json があるか確認してください。",
      );
    })
    .then(function () {
      if (typeof hideLoading === "function") hideLoading();
    });
};

/* -------------------------------------------------------------------------
   キャラクター一覧グリッドを動的に組み立てる関数
   ------------------------------------------------------------------------- */
function renderGridHTML(charList) {
  const grid = document.getElementById("charGrid");
  if (!grid) return;

  grid.innerHTML = charList
    .map((char, i) => {
      const isFinished =
        char.isFinished === true || String(char.isFinished) === "TRUE";
      return `
        <div class="char-card ${!isFinished ? "perf-not-ready" : ""}" onclick="openCharacterDetail(${i})" data-attr="${char.attr}" data-type="${char.type}">
          <img src="${char.iconUrl}" class="char-icon" onerror="this.onerror=null; this.src='https://placehold.co';">
        </div>
      `;
    })
    .join("");
}

/* -------------------------------------------------------------------------
      💡 最新のJSONデータをパソコンへ自動エクスポート（保存）する共通関数
     ------------------------------------------------------------------------- */
function exportUpdatedJsonFile() {
  // 保存する前に、JSON内の並び順を綺麗な「ID昇順（数字の小さい順）」に並び替えて整える
  const outputData = [].concat(characterMaster).sort(function (a, b) {
    return Number(a.id) - Number(b.id);
  });

  const jsonString = JSON.stringify(outputData, null, 4);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "character-master.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(
    "💾 最新の character-master.json をローカルに出力しました。これを差し替えてください。",
  );
}

/* -------------------------------------------------------------------------
      絞り込みフィルター ＆ カスタムドロップダウンの構築
     ------------------------------------------------------------------------- */
function buildFilterButtons() {
  const aOpt = document.getElementById("filterAttrOptions");
  if (aOpt) {
    aOpt.innerHTML =
      `<label><input type="radio" name="filterAttr" value="ALL" checked onchange="execFiltering()"><div class="form-icon"><img src="assets/images/filter-icon/icon-all.png" alt="ALL"></div></label>` +
      ATTR_IMAGES.map(
        (i) =>
          `<label><input type="radio" name="filterAttr" value="${i.name}" onchange="execFiltering()"><div class="form-icon"><img src="${i.url}"></div></label>`,
      ).join("");
  }
  const tOpt = document.getElementById("filterTypeOptions");
  if (tOpt) {
    tOpt.innerHTML =
      `<label><input type="radio" name="filterType" value="ALL" checked onchange="execFiltering()"><div class="form-icon"><img src="assets/images/filter-icon/icon-all.png" alt="ALL"></div></label>` +
      TYPE_IMAGES.map(
        (i) =>
          `<label><input type="radio" name="filterType" value="${i.name}" onchange="execFiltering()"><div class="form-icon"><img src="${i.url}"></div></label>`,
      ).join("");
  }
}

function execFiltering() {
  const attrRadio = document.querySelector('input[name="filterAttr"]:checked');
  const typeRadio = document.querySelector('input[name="filterType"]:checked');
  if (!attrRadio || !typeRadio) return;

  const a = attrRadio.value;
  const t = typeRadio.value;

  document.querySelectorAll(".char-card").forEach((c) => {
    c.style.display =
      (a === "ALL" || c.dataset.attr === a) &&
      (t === "ALL" || c.dataset.type === t)
        ? "flex"
        : "none";
  });
}

function buildCustomDropdowns() {
  const attrMenu = document.getElementById("ddAttrMenu");
  if (attrMenu) {
    attrMenu.innerHTML = ATTR_IMAGES.map(function (item) {
      return (
        '<div class="dd-item" style="display:flex; align-items:center; gap:10px; padding:10px; cursor:pointer;" onclick="setDDValue(\'Attr\', \'' +
        item.name +
        "', '" +
        item.url +
        "')\">" +
        '<img src="' +
        item.url +
        '" style="width:22px; height:22px;"> <span>' +
        item.name +
        "</span></div>"
      );
    }).join("");
  }

  const typeMenu = document.getElementById("ddTypeMenu");
  if (typeMenu) {
    typeMenu.innerHTML = TYPE_IMAGES.map(function (item) {
      return (
        '<div class="dd-item" style="display:flex; align-items:center; gap:10px; padding:10px; cursor:pointer;" onclick="setDDValue(\'Type\', \'' +
        item.name +
        "', '" +
        item.url +
        "')\">" +
        '<img src="' +
        item.url +
        '" style="width:22px; height:22px;"> <span>' +
        item.name +
        "</span></div>"
      );
    }).join("");
  }
}

function toggleDD(id) {
  const e = document.getElementById(id);
  if (e) e.style.display = e.style.display === "block" ? "none" : "block";
}

/* -------------------------------------------------------------------------
     4. キャラクター詳細・性能確認モーダルの制御
     ------------------------------------------------------------------------- */
function openCharacterDetail(idx) {
  currentDetailIndex = idx;
  const baseInfo = characterMaster[idx];
  if (!baseInfo) return;

  document.getElementById("cd-avatar").src = baseInfo.iconUrl;
  document.getElementById("cd-name").innerText = baseInfo.name;
  document.getElementById("cd-attr").innerText = baseInfo.attr;
  document.getElementById("cd-type").innerText = baseInfo.type;

  const rarityEl = document.getElementById("cd-rarity");
  if (rarityEl) rarityEl.innerText = baseInfo.rarity || "限定";

  let cleanTags = baseInfo.tags
    ? baseInfo.tags.replace(/,?\s*\[完了\]/, "").replace(/^,\s*/, "")
    : "";
  document.getElementById("cd-tags-display").innerText = cleanTags
    ? "🏷️ " + cleanTags
    : "";

  runStatusCalculationEngine(cachedDetailPackage.status, baseInfo.type);
  switchWeaponTrigger("mika");

  document.getElementById("charDetailModal").classList.add("is-active");
}

function runStatusCalculationEngine(status, type) {
  let atkVal = 0;
  if (type === "ウォーリアー" || type === "ウォーリア") atkVal = status.str;
  else if (type === "スナイパー") atkVal = status.dex;
  else if (type === "ソーサラー") atkVal = status.mag;

  const hitVal = Math.floor(status.str * 0.5);
  const critVal = Math.floor(status.dex * 0.5);
  const debuffVal = Math.floor(status.mag * 0.5);

  document.getElementById("v-stat-speed").innerText =
    status.speed.toLocaleString();
  document.getElementById("v-stat-atk").innerText = atkVal.toLocaleString();
  document.getElementById("v-stat-hit").innerText = hitVal.toLocaleString();
  document.getElementById("v-stat-crit").innerText = critVal.toLocaleString();
  document.getElementById("v-stat-debuff").innerText =
    debuffVal.toLocaleString();

  const physDef = status.str;
  const magDef = status.mag;
  const evadeVal = Math.floor(status.dex * 0.5);
  const staVal = Math.floor(status.sta * 0.5);

  document.getElementById("v-stat-hp").innerText = (
    status.hpCustom || 0
  ).toLocaleString();
  document.getElementById("v-stat-def").innerText =
    status.defInitial.toLocaleString();
  document.getElementById("v-stat-pdef").innerText = physDef.toLocaleString();
  document.getElementById("v-stat-mdef").innerText = magDef.toLocaleString();
  document.getElementById("v-stat-evade").innerText = evadeVal.toLocaleString();
  document.getElementById("v-stat-critres").innerText = staVal.toLocaleString();
}

function switchWeaponTrigger(mode) {
  document
    .querySelectorAll("#charDetailModal .admin-btn")
    .forEach((b) => b.classList.remove("active"));
  const targetBtn = document.getElementById(`btn-wp-${mode}`);
  if (targetBtn) targetBtn.classList.add("active");

  ["A1", "A2", "P1", "P2"].forEach((slot) => {
    const sk = cachedDetailPackage.skills[slot] || {
      name: "未設定",
      normal: "",
    };
    document.getElementById(`sk-${slot}-name`).innerText = sk.name;
    document.getElementById(`sk-${slot}-text`).innerText =
      sk.normal || "未登録";

    const ctArea = document.getElementById(`sk-${slot}-ct-area`);
    if (ctArea) {
      ctArea.innerHTML =
        sk.ct && sk.ct !== "0"
          ? `<span class="tag-badge" style="background:#1e1b4b; color:#a5b4fc; border:1px solid #4338ca;">CT: ${sk.ct}</span>`
          : "";
    }
  });

  const w = cachedDetailPackage.weapon || { name: "" };
  if (mode === "normal") {
    document.getElementById("v-w-name").innerText = "専用武器なし (未装備)";
    document.getElementById("v-w-val").innerText = "固有値: -";
    document.getElementById("v-w-passives-lbl").style.display = "none";
    document.getElementById("v-w-passives").innerHTML =
      "<li>パッシブ効果はありません</li>";
  } else {
    const wd = w[mode] || { val: "", p1: "", p2: "", p3: "" };
    document.getElementById("v-w-name").innerText = w.name
      ? w.name
      : "専用武器名未設定";
    document.getElementById("v-w-val").innerText = `固有値: ${wd.val || "-"}`;
    document.getElementById("v-w-passives-lbl").style.display = "block";

    const pUl = document.getElementById("v-w-passives");
    pUl.innerHTML = "";
    [wd.p1, wd.p2, wd.p3].forEach((pStr) => {
      if (pStr && pStr !== "未設定") {
        const li = document.createElement("li");
        li.innerText = `● ${pStr}`;
        pUl.appendChild(li);
      }
    });
  }
}

function closeDetailModal() {
  document.getElementById("charDetailModal").classList.remove("is-active");
}

/* -------------------------------------------------------------------------
   5. 性能編集エディタ（性能編集モーダル）の制御
   ------------------------------------------------------------------------- */
function openPerformanceEditor() {
  const s = characterMaster[currentDetailIndex];
  if (!s) return;

  document.getElementById("charDetailModal").classList.remove("is-active");
  document.getElementById("pe-charId").value = s.id;
  document.getElementById("pe-avatar").src = s.iconUrl;
  document.getElementById("pe-header-info").innerHTML =
    `<h3 style="margin:0; font-size:16px; font-weight:bold;">${s.name}</h3><span class="tag-badge">${s.attr} / ${s.type}</span>`;

  const isCharFinished =
    s && s.isFinished && String(s.isFinished).trim() === "TRUE";
  const checkboxEl = document.getElementById("isFinished");
  const labelEl = document.querySelector(".perf-form__checkbox-label");

  if (checkboxEl) {
    checkboxEl.checked = isCharFinished;
    if (isCharFinished) {
      checkboxEl.setAttribute("checked", "TRUE");
      if (labelEl) labelEl.classList.add("is-active");
    } else {
      checkboxEl.setAttribute("checked", "FALSE");
      if (labelEl) labelEl.classList.remove("is-active");
    }
  }

  const realStatus = cachedDetailPackage.status;
  document.getElementById("pe-str").value = realStatus.str;
  document.getElementById("pe-dex").value = realStatus.dex;
  document.getElementById("pe-mag").value = realStatus.mag;
  document.getElementById("pe-sta").value = realStatus.sta;
  document.getElementById("pe-speed").value = realStatus.speed;
  document.getElementById("pe-defInitial").value = realStatus.defInitial;
  document.getElementById("pe-penCustom").value = realStatus.penCustom || 0;
  document.getElementById("pe-charTags").value = s.tags || "";
  document.getElementById("pe-w-name").value =
    cachedDetailPackage.weapon.name || "";

  document.getElementById("charPerfEditModal").classList.add("is-active");
}

function closePerfEditor() {
  document.getElementById("charPerfEditModal").classList.remove("is-active");
}

// ─── 🚀 Firestoreへの書き込みを廃止し、ローカルメモリ更新＆自動ダウンロードへ変更 ───
function savePerformanceData() {
  const s = characterMaster[currentDetailIndex];
  if (!s) return alert("キャラクターの指定が正しくありません");

  const checkboxEl = document.getElementById("isFinished");
  const currentStatusText = checkboxEl
    ? checkboxEl.getAttribute("checked")
    : "FALSE";

  // ローカルのデータ配列を上書き更新
  window.characterMaster[currentDetailIndex].isFinished = currentStatusText;
  window.characterMaster[currentDetailIndex].tags = document
    .getElementById("pe-charTags")
    .value.trim();

  closePerfEditor();
  renderGridHTML(window.characterMaster);

  // 💡 変更が加わった最新のJSONファイルを自動ダウンロードさせる
  exportUpdatedJsonFile();

  alert(
    `✨ 「${s.name}」の性能データを更新し、最新のJSONファイルをダウンロードしました！assets/json/ に上書き配置してください。`,
  );
}

/* =========================================================================
   ☑️ 完了チェックボックス（isFinished）のクリックイベント制御
   ========================================================================= */
document.addEventListener("DOMContentLoaded", function () {
  const label = document.querySelector(".perf-form__checkbox-label");
  const checkbox = document.getElementById("isFinished");

  if (label && checkbox) {
    label.addEventListener("click", function (e) {
      if (e.target === checkbox) return;
      e.preventDefault();
      checkbox.checked = !checkbox.checked;

      if (checkbox.checked) {
        checkbox.setAttribute("checked", "TRUE");
        label.classList.add("is-active");
      } else {
        checkbox.setAttribute("checked", "FALSE");
        label.classList.remove("is-active");
      }
    });
  }
});

/* -------------------------------------------------------------------------
     大元のキャラクターマスタ編集・新規登録登録フォーム制御
     ------------------------------------------------------------------------- */
function openAdminEditFromDetail() {
  document.getElementById("charDetailModal").classList.remove("is-active");
  openModalForEditByIndex(currentDetailIndex);
}

function openModalForEditByIndex(idx) {
  const d = characterMaster[idx];
  if (!d) return;
  document.getElementById("modalMainTitle").innerText =
    "キャラクターマスタ編集";
  document.getElementById("formId").value = d.id;
  document.getElementById("formName").value = d.name;
  document.getElementById("formIconUrl").value = d.iconUrl;
  document.getElementById("modalIconPreview").src =
    d.iconUrl || "https://placehold.jp";
  document.getElementById("formCoverUrl").value = d.coverUrl || "";
  document.getElementById("modalCoverPreview").src =
    d.coverUrl || "https://placehold.jp";
  document.getElementById("formRarity").value = d.rarity || "限定";
  document.getElementById("formStartDate").value = d.releaseDate || "";
  calculateElapsedDays(d.releaseDate || "");

  setDDValue(
    "Attr",
    d.attr,
    ATTR_IMAGES.find((i) => i.name === d.attr)?.url || "",
  );
  setDDValue(
    "Type",
    d.type,
    TYPE_IMAGES.find((i) => i.name === d.type)?.url || "",
  );

  document.getElementById("charModal").classList.add("is-active");

  var delBtn = document.getElementById("cmDeleteBtn");
  if (delBtn) delBtn.style.display = "block";
}

function openModalForCreate() {
  document.getElementById("charMasterForm").reset();
  document.getElementById("modalMainTitle").innerText = "新規キャラクター登録";

  // 新しいIDを仮発行（現在の最大ID+1）
  const nextId = String(
    characterMaster.length > 0
      ? Math.max.apply(
          null,
          characterMaster.map(function (c) {
            return Number(c.id);
          }),
        ) + 1
      : 1,
  );
  document.getElementById("formId").value = nextId;

  document.getElementById("formAttr").value = "";
  document.getElementById("ddAttrIcon").src = "";
  document.getElementById("ddAttrText").innerText = "選択...";
  document.getElementById("formType").value = "";
  document.getElementById("ddTypeIcon").src = "";
  document.getElementById("ddTypeText").innerText = "選択...";
  document.getElementById("formElapsedDays").value = "";
  document.getElementById("modalIconPreview").src = "https://placehold.jp";
  document.getElementById("modalCoverPreview").src = "https://placehold.jp";

  document.getElementById("charModal").classList.add("is-active");

  var delBtn = document.getElementById("cmDeleteBtn");
  if (delBtn) delBtn.style.display = "none";
}

function closeModal() {
  document.getElementById("charModal").classList.remove("is-active");
}

// ─── 🚀 マスタ情報の追加・更新時のFirestore送信を廃止、JSON自動ダウンロードへ変更 ───
function saveMasterData() {
  const formId = document.getElementById("formId").value;
  const formName = document.getElementById("formName").value.trim();
  const formAttr = document.getElementById("formAttr").value;
  const formType = document.getElementById("formType").value;
  const formRarity = document.getElementById("formRarity").value;
  const formStartDate = document.getElementById("formStartDate").value;
  const formIconUrl = document.getElementById("formIconUrl").value.trim();
  const formCoverUrl = document.getElementById("formCoverUrl").value.trim();

  if (!formName || !formAttr || !formType) {
    alert("名前、属性、タイプは必須入力です。");
    return;
  }

  const formData = {
    id: formId,
    name: formName,
    attr: formAttr,
    type: formType,
    rarity: formRarity,
    releaseDate: formStartDate || "",
    elapsedDays:
      document.getElementById("formElapsedDays").value.replace("日", "") || "0",
    iconUrl: formIconUrl || "https://placehold.co",
    coverUrl: formCoverUrl || "https://placehold.co",
    updatedAt: new Date().toLocaleString("ja-JP"),
    str: "",
    dex: "",
    mag: "",
    sta: "",
    spd: "",
    def: "",
    pen: "",
    tags: "",
    isFinished: "FALSE",
  };

  const existingIdx = characterMaster.findIndex(function (c) {
    return String(c.id) === String(formId);
  });

  if (existingIdx !== -1) {
    // 既存更新時、古い特殊パラメータや完了フラグを壊さないようにマージ
    window.characterMaster[existingIdx] = Object.assign(
      {},
      window.characterMaster[existingIdx],
      formData,
    );
  } else {
    // 新規キャラクター追加
    window.characterMaster.push(formData);
  }

  // 画面の降順ソート（最新が上）を維持
  window.characterMaster.sort(function (a, b) {
    return Number(b.id) - Number(a.id);
  });

  closeModal();
  renderGridHTML(window.characterMaster);

  // 💡 最新状態のJSONファイルを自動保存（ダウンロード）
  exportUpdatedJsonFile();

  alert(
    `🎉 キャラクター情報をローカルに反映し、最新のJSONをダウンロードしました！\nファイルをプロジェクトの assets/json/ に上書き保存してください。`,
  );
}

// ─── 🚀 マスタ削除時のFirestore送信を完全廃止 ───
function deleteMasterCharacter() {
  const formId = document.getElementById("formId").value;
  const formName = document.getElementById("formName").value.trim();

  if (!formId) return alert("削除対象のキャラクターIDが見つかりません");

  if (
    !confirm(
      `⚠️ 本当にキャラクター「${formName}」をマスタから完全に削除しますか？\nこの操作は取り消せません。`,
    )
  ) {
    return;
  }

  // メモリ配列から削除
  window.characterMaster = window.characterMaster.filter(function (c) {
    return String(c.id) !== String(formId);
  });

  closeModal();
  renderGridHTML(window.characterMaster);

  // 💡 削除完了後の最新JSONを自動保存
  exportUpdatedJsonFile();

  alert(
    `✨ 「${formName}」をマスタから消去し、最新のJSONをダウンロードしました。ファイルを上書き配置してください。`,
  );
}

window.deleteMasterCharacter = deleteMasterCharacter;

function calculateElapsedDays(startDateStr) {
  if (!startDateStr) {
    document.getElementById("formElapsedDays").value = "";
    return;
  }
  const start = new Date(startDateStr);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil(Math.abs(today - start) / (1000 * 60 * 60 * 24));
  document.getElementById("formElapsedDays").value = diffDays + "日";
}

function setDDValue(type, name, url) {
  const textEl = document.getElementById("dd" + type + "Text");
  const iconEl = document.getElementById("dd" + type + "Icon");
  if (textEl) textEl.innerText = name;
  if (iconEl) {
    iconEl.src = url;
    iconEl.style.display = url ? "inline-block" : "none";
  }
  const hiddenInput = document.getElementById("form" + type);
  if (hiddenInput) hiddenInput.value = name;
  const menu = document.getElementById("dd" + type + "Menu");
  if (menu) menu.style.display = "none";
}

window.addEventListener("click", function (event) {
  if (!event.target.closest(".dd-container")) {
    document.querySelectorAll(".dd-menu").forEach((menu) => {
      menu.style.display = "none";
    });
  }
});

window.toggleDD = toggleDD;
window.setDDValue = setDDValue;

/* =========================================================================
       🌐 HTML側（onclick / onchange）への関数公開
       ========================================================================= */
window.openModalForCreate = openModalForCreate;
window.execFiltering = execFiltering;
window.openCharacterDetail = openCharacterDetail;
window.closeDetailModal = closeDetailModal;
window.switchWeaponTrigger = switchWeaponTrigger;
window.openPerformanceEditor = openPerformanceEditor;
window.closePerfEditor = closePerfEditor;
window.savePerformanceData = savePerformanceData;
window.openAdminEditFromDetail = openAdminEditFromDetail;
window.closeModal = closeModal;
window.saveMasterData = saveMasterData;
window.calculateElapsedDays = calculateElapsedDays;
