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
  // ➔ ✨ 【ここを修正！】JSON内の並び順を、ご希望通りの「ID降順（数字の大きい順・最新順）」に整える
  const outputData = [].concat(characterMaster).sort(function (a, b) {
    return Number(b.id) - Number(a.id); // ⭕️ b - a にすることで、IDの大きい順（135→134...）に固定します！
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
    "💾 最新の character-master.json をID降順（大きい順）でローカルに出力しました。これを差し替えてください。",
  );
}

/* -------------------------------------------------------------------------
      絞り込みフィルター ＆ カスタムドロップダウンの構築
     ------------------------------------------------------------------------- */
function buildFilterButtons() {
  const aOpt = document.getElementById("filterAttrOptions");
  if (aOpt) {
    aOpt.innerHTML =
      `<label class="filter-section__label is-active"><input type="radio" name="filterAttr" value="ALL" checked onchange="execFiltering()"><div class="form-icon"><img src="assets/images/filter-icon/icon-all.png" alt="ALL"></div></label>` +
      ATTR_IMAGES.map(
        (i) =>
          `<label class="filter-section__label"><input type="radio" name="filterAttr" value="${i.name}" onchange="execFiltering()"><div class="form-icon"><img src="${i.url}"></div></label>`,
      ).join("");
  }
  const tOpt = document.getElementById("filterTypeOptions");
  if (tOpt) {
    tOpt.innerHTML =
      `<label class="filter-section__label is-active"><input type="radio" name="filterType" value="ALL" checked onchange="execFiltering()"><div class="form-icon"><img src="assets/images/filter-icon/icon-all.png" alt="ALL"></div></label>` +
      TYPE_IMAGES.map(
        (i) =>
          `<label class="filter-section__label"><input type="radio" name="filterType" value="${i.name}" onchange="execFiltering()"><div class="form-icon"><img src="${i.url}"></div></label>`,
      ).join("");
  }
}

function execFiltering() {
  const attrRadio = document.querySelector('input[name="filterAttr"]:checked');
  const typeRadio = document.querySelector('input[name="filterType"]:checked');
  if (!attrRadio || !typeRadio) return;

  const a = attrRadio.value;
  const t = typeRadio.value;

  // =========================================================================
  // ✨ クリックされた選択肢の見た目をアクティブにする
  // =========================================================================
  // 1. 属性フィルターの周りの見た目をリセットして、選ばれた要素の親（labelなど）に付与
  if (attrRadio) {
    attrRadio.parentElement.parentElement
      .querySelectorAll("label")
      .forEach((lbl) => {
        lbl.classList.remove("is-active");
      });
    attrRadio.parentElement.classList.add("is-active");
  }

  // 2. タイプフィルターの周りの見た目をリセットして、選ばれた要素の親（labelなど）に付与
  if (typeRadio) {
    typeRadio.parentElement.parentElement
      .querySelectorAll("label")
      .forEach((lbl) => {
        lbl.classList.remove("is-active");
      });
    typeRadio.parentElement.classList.add("is-active");
  }
  // =========================================================================

  // 135件のカードの表示・非表示切り替え
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

var currentWeaponMode = "nomal"; // 💡 現在選択されている武器段階を保持する変数

/* -------------------------------------------------------------------------
        4. キャラクター詳細・性能　確認モーダルの制御
------------------------------------------------------------------------- */
function openCharacterDetail(idx) {
  currentDetailIndex = idx;
  const baseInfo = characterMaster[idx]; // ⭕️ 読み込んだJSONのリアルなデータを直接取得
  if (!baseInfo) return;

  // 基本情報の反映
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

  // ⭕️ ステータス計算エンジンに、JSON内のリアルな数値を流し込む
  if (baseInfo.status) {
    runStatusCalculationEngine(baseInfo.status, baseInfo.type);
  }

  // ⭕️ モーダルを開いたときは、まず「ミカエル武器（mika）」の状態で初期描画
  switchWeaponTrigger("mika");

  document.getElementById("charDetailModal").classList.add("is-active");
}

function runStatusCalculationEngine(status, type) {
  // 数値計算のために、文字列を数字（Number）に変換
  const spd = Number(status.speed || 0);
  const str = Number(status.str || 0);
  const dex = Number(status.dex || 0);
  const mag = Number(status.mag || 0);
  const sta = Number(status.sta || 0);
  const defInitial = Number(status.defInitial || 0);

  // 📋 タイプ別に攻撃力を自動判定
  let atkVal = 0;
  if (type === "ウォーリアー" || type === "ウォーリア") atkVal = str;
  else if (type === "スナイパー") atkVal = dex;
  else if (type === "ソーサラー") atkVal = mag;

  // 📊 二次ステータスの自動計算
  const hitVal = Math.floor(str * 0.5);
  const critVal = Math.floor(dex * 0.5);
  const debuffVal = Math.floor(mag * 0.5);
  const calculatedHP = sta * 10; // ✨ HPは純粋に耐久力の10倍！
  const physDef = str;
  const magDef = mag;
  const evadeVal = Math.floor(dex * 0.5);
  const staVal = Math.floor(sta * 0.5);

  // OFFENSE パラメータ
  document.getElementById("calculated-speed").innerText = spd.toLocaleString();
  document.getElementById("calculated-atk").innerText = atkVal.toLocaleString();
  document.getElementById("calculated-hit").innerText = hitVal.toLocaleString();
  document.getElementById("calculated-crit").innerText =
    critVal.toLocaleString();
  document.getElementById("calculated-debuff").innerText =
    debuffVal.toLocaleString();

  // DEFENSE パラメータ
  document.getElementById("calculated-hp").innerText =
    calculatedHP.toLocaleString();
  document.getElementById("calculated-def").innerText =
    defInitial.toLocaleString();
  document.getElementById("calculated-pdef").innerText =
    physDef.toLocaleString();
  document.getElementById("calculated-mdef").innerText =
    magDef.toLocaleString();
  document.getElementById("calculated-evade").innerText =
    evadeVal.toLocaleString();
  document.getElementById("calculated-critres").innerText =
    staVal.toLocaleString();
}

// 専用装備ボタンの切り替えによる読込データの操作
function switchWeaponTrigger(mode) {
  currentWeaponMode = mode;

  // 1. タブボタンのアクティブ状態切り替え
  document
    .querySelectorAll("#charDetailModal .ar-btn") // 💡 HTMLに合わせて .admin-btn から .ar-btn に修正
    .forEach((b) => b.classList.remove("is-active"));

  // HTMLのid（btn-wp-normal, btn-wp-asta, btn-wp-mika, btn-wp-meta）と完全に同期
  let btnId = `btn-wp-${mode}`;
  const targetBtn = document.getElementById(btnId);
  if (targetBtn) targetBtn.classList.add("is-active");

  const baseInfo = characterMaster[currentDetailIndex];
  if (!baseInfo) return;

  // 2. スキル・専用武器効果（5つの引き出し）のデータを100%再取得して流し込み
  const ALL_SKILL_TYPES = ["A1", "A2", "P1", "P2", "WP"];
  const skills = baseInfo.skills || [];

  // 定義されている5つの枠（A1〜WP）をベースに、今選んだキャラのデータを毎回100%上書き取得
  ALL_SKILL_TYPES.forEach((type) => {
    // 🔍 今選んだキャラのJSONからスキルデータを再取得（無ければ空データをセット）
    const skill = skills.find((sk) => sk.type === type) || {
      name: "",
      ct: 0,
      nomalText: "",
      astarothText: "",
      michaelText: "",
      metatronText: "",
    };

    // 🏷️ スキル名の反映（今選んだキャラのデータで完全に上書き）
    const nameElem = document.getElementById(`sk-${type}-name`);
    if (nameElem) nameElem.innerText = skill.name || "-";

    // ⏳ クールタイム(CT)の反映
    const ctArea = document.getElementById(`sk-${type}-ct-area`);
    if (ctArea) {
      if (
        skill.ct !== null &&
        skill.ct !== undefined &&
        String(skill.ct) !== "0" &&
        String(skill.ct) !== ""
      ) {
        ctArea.innerHTML = `<span class="tag-badge" style="background:#1e1b4b; color:#a5b4fc; border:1px solid #4338ca;">CT: ${skill.ct}</span>`;
      } else {
        ctArea.innerHTML = ""; // 今選んだキャラにCTがなければエリアを空にする
      }
    }

    // 📄 スキルテキストの反映（段階的なフォールバックを適用して上書き）
    const textElem = document.getElementById(`sk-${type}-text`);
    if (textElem) {
      let displayText = skill.nomalText || "";
      if (mode === "asta")
        displayText = skill.astarothText || skill.nomalText || "";
      else if (mode === "mika")
        displayText =
          skill.michaelText || skill.astarothText || skill.nomalText || "";
      else if (mode === "meta")
        displayText =
          skill.metatronText ||
          skill.michaelText ||
          skill.astarothText ||
          skill.nomalText ||
          "";

      // 文字が書き込まれていればそれを表示、未入力なら「未登録」という文字で前のキャラの残像を完全に潰す！
      if (displayText && displayText.trim() !== "") {
        textElem.innerHTML = displayText.replace(/\n/g, "<br>");
      } else {
        textElem.innerHTML =
          '<span style="color: #64748b; font-style: italic;">未登録</span>';
      }

      // ✨ 専用武器効果(WP)カードの表示・非表示の自動切り替え
      if (type === "WP") {
        const isAllEmpty =
          !skill.nomalText &&
          !skill.astarothText &&
          !skill.michaelText &&
          !skill.metatronText;
        const skillBox = textElem.closest(".md-card__skill-box");
        if (skillBox) skillBox.style.display = isAllEmpty ? "none" : "block";
      }
    }
  });

  // 3. 専用武器基本ステータス（パッシブ効果）の表示制御
  const w = baseInfo.weapon;
  if (!w || mode === "normal" || mode === "nomal") {
    document.getElementById("v-w-name").innerText = "専用武器なし (未装備)";
    document.getElementById("v-w-val").innerText = "固有値: -";
    document.getElementById("v-w-passives-lbl").style.display = "none";
    document.getElementById("v-w-passives").innerHTML =
      "<li>パッシブ効果はありません</li>";
  } else {
    // 引数（mode）を JSON内の武器オブジェクトのキー名に翻訳（旧名の安全なマッピング）
    let searchMode = mode;
    if (mode === "asta") searchMode = "astaroth";
    if (mode === "mika") searchMode = "michael";
    if (mode === "meta") searchMode = "metatron";

    const wd = w[searchMode] || {
      stat: "",
      passive1: "",
      passive2: "",
      passive3: "",
    };

    document.getElementById("v-w-name").innerText = w.name
      ? w.name
      : "専用武器名未設定";
    document.getElementById("v-w-val").innerText = `固有値: ${wd.stat || "-"}`;
    document.getElementById("v-w-passives-lbl").style.display = "block";

    const pUl = document.getElementById("v-w-passives");
    pUl.innerHTML = "";

    [wd.passive1, wd.passive2, wd.passive3].forEach((pStr) => {
      if (pStr && pStr !== "未設定" && pStr !== "") {
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
   5. 性能編集エディタ（性能編集モーダル）の制御（本物データ完全同期版）
   ------------------------------------------------------------------------- */
function openPerformanceEditor() {
  const s = characterMaster[currentDetailIndex]; // ⭕️ 選択中のキャラの本物データ
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

  // 📊 1. 基本パラメータ（ステータス）をフォームへ流し込む
  const realStatus = s.status || {
    str: 0,
    dex: 0,
    mag: 0,
    sta: 0,
    speed: 0,
    defInitial: 0,
    penCustom: 0,
  };
  document.getElementById("pe-str").value = realStatus.str || "";
  document.getElementById("pe-dex").value = realStatus.dex || "";
  document.getElementById("pe-mag").value = realStatus.mag || "";
  document.getElementById("pe-sta").value = realStatus.sta || "";
  document.getElementById("pe-speed").value = realStatus.speed || "";
  document.getElementById("pe-defInitial").value = realStatus.defInitial || "";
  document.getElementById("pe-penCustom").value = realStatus.penCustom || 0;
  document.getElementById("pe-charTags").value = s.tags || "";

  // 専用武器の名前
  document.getElementById("pe-w-name").value =
    (s.weapon && s.weapon.name) || "";

  // 🔮 2. 5つのスキル情報（A1, A2, P1, P2, WP）を編集欄へ全自動セット
  // =========================================================================
  // ✨ 【スキル入力エリアの自動生成：A1・A2のみクールタイム入力欄を出現させる】
  // =========================================================================
  const skillsArea = document.getElementById("pe-skills-area");
  if (skillsArea) {
    const SKILL_LABELS = {
      A1: "ACTIVE 1",
      A2: "ACTIVE 2",
      P1: "PASSIVE 1",
      P2: "PASSIVE 2",
      WP: "専用武器効果",
    };

    skillsArea.innerHTML = Object.keys(SKILL_LABELS)
      .map((type) => {
        // ⏳ A1・A2の時だけクールタイム（CT）の入力タグを作る
        let ctInputHtml = "";
        if (type === "A1" || type === "A2") {
          ctInputHtml = `<input type="number" id="pe-sk-${type}-ct" class="perf-form__input-text ct" min="0" placeholder="0" />`;
        }

        return `
          <div class="perf-form__group-box">
            <div class="perf-form__heading-area">
              <div class="perf-form__group-heading-tag">${SKILL_LABELS[type]}</div>
              <input type="text" id="pe-sk-${type}-name" class="perf-form__input-text" placeholder="スキル名を入力" />
              ${ctInputHtml}
            </div>
            <div class="perf-form__field-grid-quad">
              <div class="perf-form__field-sub"><label class="perf-form__label-normal">通常テキスト</label><textarea id="pe-sk-${type}-nomalText" rows="4" class="perf-form__textarea"></textarea></div>
              <div class="perf-form__field-sub"><label class="perf-form__label-satan">サタン効果 (astaroth)</label><textarea id="pe-sk-${type}-astarothText" rows="4" class="perf-form__textarea"></textarea></div>
              <div class="perf-form__field-sub"><label class="perf-form__label-michael">ミカエル効果 (michael)</label><textarea id="pe-sk-${type}-michaelText" rows="4" class="perf-form__textarea"></textarea></div>
              <div class="perf-form__field-sub"><label class="perf-form__label-metatron">メタトロン効果 (metatron)</label><textarea id="pe-sk-${type}-metatronText" rows="4" class="perf-form__textarea"></textarea></div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // =========================================================================
  // 🛡️ 専用武器エディタの自動生成（stat一本化 ＆ 完璧な双方向完全同期版）
  // =========================================================================
  const weaponContainer = document.getElementById("pe-w-rarity-container");
  if (weaponContainer) {
    const WEAPON_STAGES = {
      normal: {
        label: "専用武器なし (normal)",
        hasFields: false,
        color: "muted",
      },
      astaroth: {
        label: "サタン (astaroth)",
        hasFields: true,
        color: "orange",
        defaultVal: "529560",
      },
      michael: {
        label: "ミカエル (michael)",
        hasFields: true,
        color: "blue",
        defaultVal: "794343",
      },
      metatron: {
        label: "メタトロン (metatron)",
        hasFields: true,
        color: "purple",
        defaultVal: "953210",
      },
    };

    const w = s.weapon || {};
    let finalHtml = "";

    const stages = Object.keys(WEAPON_STAGES);
    for (let j = 0; j < stages.length; j++) {
      const m = stages[j];
      const cfg = WEAPON_STAGES[m];

      if (m === "normal") {
        finalHtml += `
          <div class="perf-form__weapon-stage-box perf-form__weapon-stage-box--disabled">
            <span class="perf-form__group-heading perf-form__group-heading--${cfg.color}">${cfg.label}</span>
            <div class="perf-form__weapon-empty-text">専用武器なし (枠線のみ)</div>
          </div>
        `;
        continue;
      }

      // ⭕️ 既存マスタに習い、stat値または旧データから値を引き出す（valは完全に無視）
      const wd = w[m] || { stat: "", passive1: "", passive2: "", passive3: "" };
      let passivePairsHtml = "";

      for (let num = 1; num <= 3; num++) {
        const pStr = wd[`passive${num}`] || wd[`p${num}`] || "未設定+0";
        let type = "未設定";
        let val = "0";

        if (pStr.indexOf("+") !== -1) {
          const parts = pStr.split("+");
          type = parts[0];
          val = parts[1].replace("%", "");
        } else if (pStr !== "") {
          type = pStr;
        }

        let selectOptionsHtml = "";
        for (let o = 0; o < PASSIVE_OPTIONS.length; o++) {
          const opt = PASSIVE_OPTIONS[o];
          const isSelected = opt === type ? "selected" : "";
          selectOptionsHtml += `<option value="${opt}" ${isSelected}>${opt}</option>`;
        }

        // 💡 id名に正確な「passive\${num}」を付与して双方向同期に備える
        passivePairsHtml += `
           <div class="perf-form__passive-row">
             <div class="perf-form__select-box">
               <select id="pe-w-${m}-passive${num}-type" class="perf-form__select" onchange="syncWeaponPassiveDropdowns(this)">
                 ${selectOptionsHtml}
               </select>
             </div>
             <div class="perf-form__value-box">
               <input type="number" id="pe-w-${m}-passive${num}-num" class="perf-form__input-num-short" value="${val}" placeholder="0" oninput="syncWeaponPassiveNumbers(this)" />
             </div>
           </div>
         `;
      }

      const currentVal = wd.stat || "";
      const displayVal =
        currentVal !== "" && currentVal !== undefined
          ? currentVal
          : cfg.defaultVal;

      finalHtml += `
        <div class="perf-form__weapon-stage-box">
          <span class="perf-form__group-heading perf-form__group-heading--${cfg.color}">${cfg.label}</span>
          <div class="perf-form__field perf-form__field--flex-between">
            <label class="perf-form__field-label">武具固有値</label>
            <input type="text" id="pe-w-${m}-stat" class="perf-form__input-text-short" value="${displayVal}" placeholder="未設定" />
          </div>
          <span class="perf-form__field-sub-label">専用パッシブ効果</span>
          <div class="perf-form__passive-container">
            ${passivePairsHtml}
          </div>
        </div>
      `;
    }
    weaponContainer.innerHTML = finalHtml;
  }

  // 🔮 組み立てたばかりのスキル入力欄へ、JSONデータを100%確実に流し込む
  const ALL_SKILL_TYPES = ["A1", "A2", "P1", "P2", "WP"];
  const skills = s.skills || [];

  ALL_SKILL_TYPES.forEach((type) => {
    const skill = skills.find((sk) => sk.type === type) || {
      name: "",
      ct: "",
      nomalText: "",
      astarothText: "",
      michaelText: "",
      metatronText: "",
    };

    const nameInput = document.getElementById(`pe-sk-${type}-name`);
    if (nameInput) nameInput.value = skill.name || "";

    const ctInput = document.getElementById(`pe-sk-${type}-ct`);
    if (ctInput) {
      ctInput.value =
        skill.ct !== undefined && skill.ct !== null && String(skill.ct) !== "0"
          ? skill.ct
          : "";
    }

    if (document.getElementById(`pe-sk-${type}-nomalText`))
      document.getElementById(`pe-sk-${type}-nomalText`).value =
        skill.nomalText || "";
    if (document.getElementById(`pe-sk-${type}-astarothText`))
      document.getElementById(`pe-sk-${type}-astarothText`).value =
        skill.astarothText || "";
    if (document.getElementById(`pe-sk-${type}-michaelText`))
      document.getElementById(`pe-sk-${type}-michaelText`).value =
        skill.michaelText || "";
    if (document.getElementById(`pe-sk-${type}-metatronText`))
      document.getElementById(`pe-sk-${type}-metatronText`).value =
        skill.metatronText || "";
  });

  document.getElementById("charPerfEditModal").classList.add("is-active");
}

// 🔄 【効果名同期の決定版】インデックス番号[3]で確実に引き抜いて三段階を双方向連動
function syncWeaponPassiveDropdowns(changedSelect) {
  const idParts = changedSelect.id.split("-");
  const pSlot = idParts[3]; // 💡 インデックス[3]を指定して "passive1"〜"passive3" を正確に引き出す！

  const targetStages = ["astaroth", "michael", "metatron"];
  for (let k = 0; k < targetStages.length; k++) {
    const stageName = targetStages[k];
    const targetSelect = document.getElementById(
      `pe-w-${stageName}-${pSlot}-type`,
    );

    if (targetSelect && targetSelect !== changedSelect) {
      targetSelect.value = changedSelect.value;
    }
  }
}

window.syncWeaponPassiveDropdowns = syncWeaponPassiveDropdowns;

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

// 実装日からの経過日数の計算
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

/* -------------------------------------------------------------------------
   消えていたエディタを閉じる関数
   ------------------------------------------------------------------------- */
function closePerfEditor() {
  document.getElementById("charPerfEditModal").classList.remove("is-active");
}

/* -------------------------------------------------------------------------
     ✨ 【性能データ保存 ＆ 最新JSON自動エクスポート：既存マスタ（stat）100%準拠版】
     ------------------------------------------------------------------------- */
function savePerformanceData() {
  const charId = document.getElementById("pe-charId").value;
  if (!charId) return alert("キャラクターIDが見つかりません。");

  const targetChar = window.characterMaster.find(
    (c) => String(c.id) === String(charId),
  );
  if (!targetChar) return alert("対象のキャラクターデータが見つかりません。");

  // 1. 完了フラグ（既存の文字列 "TRUE" / "FALSE" 形式に統一）
  const isChecked = document.getElementById("isFinished").checked;
  targetChar.isFinished = isChecked ? "TRUE" : "FALSE";

  // 2. 📊 基礎パラメータの回収
  targetChar.status = {
    str: String(document.getElementById("pe-str").value || 0),
    dex: String(document.getElementById("pe-dex").value || 0),
    mag: String(document.getElementById("pe-mag").value || 0),
    sta: String(document.getElementById("pe-sta").value || 0),
    speed: String(document.getElementById("pe-speed").value || 0),
    defInitial: String(document.getElementById("pe-defInitial").value || 0),
    penCustom: String(document.getElementById("pe-penCustom").value || 0),
  };

  // 3. 🏷️ 特徴タグの回収
  targetChar.tags = document.getElementById("pe-charTags").value.trim();

  // 4. 🔮 5大スキル回収
  const ALL_SKILL_TYPES = ["A1", "A2", "P1", "P2", "WP"];
  targetChar.skills = [];

  ALL_SKILL_TYPES.forEach((type) => {
    const is_active = type === "A1" || type === "A2";
    const ct_el = document.getElementById(`pe-sk-${type}-ct`);
    const ct_val = is_active ? (ct_el ? ct_el.value : "") : "";

    targetChar.skills.push({
      type: type,
      name: document.getElementById(`pe-sk-${type}-name`).value.trim(),
      ct: ct_val ? Number(ct_val) : null,
      nomalText: document.getElementById(`pe-sk-${type}-nomalText`).value || "",
      astarothText:
        document.getElementById(`pe-sk-${type}-astarothText`).value || "",
      michaelText:
        document.getElementById(`pe-sk-${type}-michaelText`).value || "",
      metatronText:
        document.getElementById(`pe-sk-${type}-metatronText`).value || "",
    });
  });

  // 5. 🛡️ 専用武器エディタ回収（valキーは永久追放し、既存マスタ通りの stat へ一本化！）
  targetChar.weapon = {
    name: document.getElementById("pe-w-name").value.trim(),
  };

  const WEAPON_STAGES = ["astaroth", "michael", "metatron"];
  WEAPON_STAGES.forEach((m) => {
    targetChar.weapon[m] = {
      stat: document.getElementById(`pe-w-${m}-stat`).value.trim(), // ⭕️ statのみで美しく回収
    };

    for (let num = 1; num <= 3; num++) {
      const type = document.getElementById(
        `pe-w-${m}-passive${num}-type`,
      ).value;
      const numVal =
        document.getElementById(`pe-w-${m}-passive${num}-num`).value || "0";

      const suffix = type.includes("%") ? "%" : "";
      const combinedPassiveStr =
        type === "未設定" ? "未設定+0" : `${type}+${numVal}${suffix}`;

      // ⭕️ 正しい既存形式「passive1〜3」にのみ格納！
      targetChar.weapon[m][`passive${num}`] = combinedPassiveStr;
    }
  });

  // 🧹 6. ルート直下にこびり付いていた古いゴミ文字（str, spd等）および新規マスタ側の不要キーを抹消
  const trashKeys = [
    "str",
    "dex",
    "mag",
    "sta",
    "spd",
    "def",
    "pen",
    "defInitial",
    "penCustom",
    "speed",
  ];
  trashKeys.forEach((key) => {
    if (key in targetChar) delete targetChar[key];
  });

  // 🤝 7. 後半のソート、リフレッシュ、ファイル自動ダウンロード
  window.characterMaster.sort(function (a, b) {
    return Number(b.id) - Number(a.id);
  });

  closePerfEditor();
  renderGridHTML(window.characterMaster);
  exportUpdatedJsonFile();

  alert(
    `✨ 【性能データ保存大成功！】\n「${targetChar.name}」のデータ構造を100%既存ルール（stat）に最適化し、最新のJSONファイルを出力しました！`,
  );
}

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
