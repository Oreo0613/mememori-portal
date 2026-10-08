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

  // 2. スキル・専用武器効果（5つの引き出し）の流し込み
  const skills = baseInfo.skills || [];
  skills.forEach((skill) => {
    const type = skill.type; // "A1", "A2", "P1", "P2", "WP"

    // スキル名の反映
    const nameElem = document.getElementById(`sk-${type}-name`);
    if (nameElem) nameElem.innerText = skill.name || "-";

    // クールタイム(CT)の反映
    const ctArea = document.getElementById(`sk-${type}-ct-area`);
    if (ctArea) {
      if (
        skill.ct !== null &&
        skill.ct !== undefined &&
        String(skill.ct) !== "0"
      ) {
        ctArea.innerHTML = `<span class="tag-badge" style="background:#1e1b4b; color:#a5b4fc; border:1px solid #4338ca;">CT: ${skill.ct}</span>`;
      } else {
        ctArea.innerHTML = "";
      }
    }

    // スキルテキストの反映（★段階的なフォールバック処理を実装）
    const textElem = document.getElementById(`sk-${type}-text`);
    if (textElem) {
      // 基準として通常武器のテキストをセット
      let displayText = skill.nomalText || "";

      // ➔ 【サタン(asta)選択時】
      if (mode === "asta") {
        displayText = skill.astarothText || skill.nomalText || "";
      }
      // ➔ 【ミカエル(mika)選択時】ミカエルが無ければサタン、それも無ければ通常
      else if (mode === "mika") {
        displayText =
          skill.michaelText || skill.astarothText || skill.nomalText || "";
      }
      // ➔ 【メタトロン(meta)選択時】メタトロンが無ければミカエル ➔ サタン ➔ 通常
      else if (mode === "meta") {
        displayText =
          skill.metatronText ||
          skill.michaelText ||
          skill.astarothText ||
          skill.nomalText ||
          "";
      }

      // 画面に改行付きで反映
      if (displayText) {
        textElem.innerHTML = displayText.replace(/\n/g, "<br>");
      } else {
        textElem.innerHTML = "未登録";
      }

      // ✨ 専用武器効果(WP)のすべてが空欄ならカードごと非表示にする
      if (type === "WP") {
        // 全てのテキスト項目が空っぽ（"" または無い）かどうか判定
        const isAllEmpty =
          !skill.nomalText &&
          !skill.astarothText &&
          !skill.michaelText &&
          !skill.metatronText;

        // HTML上のスキルカード全体（md-card__skill-box）を取得
        const skillBox = textElem.closest(".md-card__skill-box");

        if (skillBox) {
          if (isAllEmpty) {
            // 4段階すべてが空っぽなら、存在ごと綺麗に消し去る！
            skillBox.style.display = "none";
          } else {
            // どこか1つでも文字が書き込まれていれば、通常通り表示する
            skillBox.style.display = "block"; // または元々のCSSに合わせて "flex" など
          }
        }
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
  // もしHTML側に各スキルの入力欄（例: id="pe-sk-A1-name" や id="pe-sk-A1-nomalText" など）が
  // 用意されていれば、以下の処理で開いた瞬間に自動で中身がカチッとセットされます！
  const skills = s.skills || [];
  skills.forEach((skill) => {
    const type = skill.type; // "A1", "A2", "P1", "P2", "WP"

    // スキル名入力欄へのセット
    const nameInput = document.getElementById(`pe-sk-${type}-name`);
    if (nameInput) nameInput.value = skill.name || "";

    // 各武器段階のテキストエリアへのセット
    const tNormal = document.getElementById(`pe-sk-${type}-nomalText`);
    if (tNormal) tNormal.value = skill.nomalText || "";

    const tAsta = document.getElementById(`pe-sk-${type}-astarothText`);
    if (tAsta) tAsta.value = skill.astarothText || "";

    const tMika = document.getElementById(`pe-sk-${type}-michaelText`);
    if (tMika) tMika.value = skill.michaelText || "";

    const tMeta = document.getElementById(`pe-sk-${type}-metatronText`);
    if (tMeta) tMeta.value = skill.metatronText || "";
  });

  document.getElementById("charPerfEditModal").classList.add("is-active");
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
     消えていた仮の保存関数
     ------------------------------------------------------------------------- */
function savePerformanceData() {
  alert("保存処理の準備中");
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
