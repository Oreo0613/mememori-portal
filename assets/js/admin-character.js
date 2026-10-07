import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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

// 💡 フィルター用・ドロップダウン用のアイコン画像のモック
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
   🧙‍♀️ ログイン成功後の初期化処理
   ========================================================================= */

// 💡 admin.js が認証に成功したあと、自動でこの関数を呼び出し
window.onAdminAuthSuccess = function (user) {
  console.log("admin.js からの通知：キャラクターページの描画を開始します。");

  // 🌀 画面ロックとローディングの開始
  if (typeof showLoading === "function") showLoading();

  // 💡 最新の関数を使ってデータベース（Firestore）の接続インスタンスを準備
  const db = getFirestore();

  // Firestoreから「character_master」コレクションの全データをロードする
  getDocs(collection(db, "character_master"))
    .then(function (querySnapshot) {
      // 💡 共通データの characterMaster 配列を一回リセット
      window.characterMaster = [];

      // データベースから取得したキャラデータを1件ずつ配列に詰め込む
      querySnapshot.forEach(function (doc) {
        window.characterMaster.push(doc.data());
      });

      // 🔴【追加】IDを数字に変換して、大きい順（降順）に並び替える
      window.characterMaster.sort((a, b) => Number(b.id) - Number(a.id));

      console.log(
        "🔥 Firestoreからキャラクターデータをロードしました！件数:",
        window.characterMaster.length,
      );

      // 1. データが揃ったので、本物のデータでキャラクター一覧（グリッド）を描画！
      renderGridHTML(window.characterMaster);
      // 2. カスタムドロップダウンの組み立て
      buildCustomDropdowns();
      // 3. 絞り込みフィルターの組み立て
      buildFilterButtons();
    })
    .catch(function (error) {
      console.error("キャラクターデータの読み込みに失敗しました:", error);
      alert(
        "データの取得に失敗しました。セキュリティルール等を確認してください。",
      );
    })
    .then(function () {
      // 🌀 成功しても失敗してもローディングを消す
      if (typeof hideLoading === "function") hideLoading();
    });
};

/* -------------------------------------------------------------------------
   キャラクター一覧グリッドを動的に組み立てる関数
   ------------------------------------------------------------------------- */
// ─── ⭕️ 修正後の renderGridHTML 関数 ───
function renderGridHTML(charList) {
  const grid = document.getElementById("charGrid");
  if (!grid) return;

  grid.innerHTML = charList
    .map((char, i) => {
      // 🔴【修正】本物の true でも、文字列の "true" でも、どちらでも 100% 完了と判定する
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

// フィルターの実行（ALLまたは選択された属性・タイプ以外をパッと非表示にする）
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

// モーダル内のカスタムドロップダウン（属性・タイプ選択）の中身を生成
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
        '" style="width:22px; height:22px;"> ' +
        "<span>" +
        item.name +
        "</span>" +
        "</div>"
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
        '" style="width:22px; height:22px;"> ' +
        "<span>" +
        item.name +
        "</span>" +
        "</div>"
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
// キャラクター詳細モーダルを開く
function openCharacterDetail(idx) {
  currentDetailIndex = idx;
  const baseInfo = characterMaster[idx];
  if (!baseInfo) return;

  document.getElementById("cd-avatar").src = baseInfo.iconUrl;
  document.getElementById("cd-name").innerText = baseInfo.name;
  document.getElementById("cd-attr").innerText = baseInfo.attr;
  document.getElementById("cd-type").innerText = baseInfo.type;

  // 💡 【修正】詳細画面の正しいID（cd-rarity）を取得して表示を更新します（formRarityを巻き込まない）
  const rarityEl = document.getElementById("cd-rarity");
  if (rarityEl) {
    rarityEl.innerText = baseInfo.rarity || "限定";
  }

  let cleanTags = baseInfo.tags
    ? baseInfo.tags.replace(/,?\s*\[完了\]/, "").replace(/^,\s*/, "")
    : "";
  document.getElementById("cd-tags-display").innerText = cleanTags
    ? "🏷️ " + cleanTags
    : "";

  // パラメーター自動計算エンジンの実行
  runStatusCalculationEngine(cachedDetailPackage.status, baseInfo.type);
  switchWeaponTrigger("mika"); // 初期表示はミカエル武器タブ

  document.getElementById("charDetailModal").classList.add("is-active");
}

// 📊 パラメーター自動計算エンジン（タイプ別の割り振りロジック）
function runStatusCalculationEngine(status, type) {
  let atkVal = 0;
  // 💡 タイプ別に攻撃力に反映する基礎パラメータをスイッチする定石ロジック
  if (type === "ウォーリアー" || type === "ウォーリア") {
    atkVal = status.str; // ウォーリアーは腕力（STR）が攻撃力になる
  } else if (type === "スナイパー") {
    atkVal = status.dex; // スナイパーは技力（DEX）が攻撃力になる
  } else if (type === "ソーサラー") {
    atkVal = status.mag; // ソーサラーは魔力（MAG）が攻撃力になる
  }

  const hitVal = Math.floor(status.str * 0.5); // 腕力の半分が命中
  const critVal = Math.floor(status.dex * 0.5); // 技力の半分がクリティカル
  const debuffVal = Math.floor(status.mag * 0.5); // 魔力の半分が弱体効果命中

  document.getElementById("v-stat-speed").innerText =
    status.speed.toLocaleString();
  document.getElementById("v-stat-atk").innerText = atkVal.toLocaleString();
  document.getElementById("v-stat-hit").innerText = hitVal.toLocaleString();
  document.getElementById("v-stat-crit").innerText = critVal.toLocaleString();
  document.getElementById("v-stat-debuff").innerText =
    debuffVal.toLocaleString();

  const physDef = status.str; // 腕力＝物理防御力
  const magDef = status.mag; // 魔力＝魔法防御力
  const evadeVal = Math.floor(status.dex * 0.5); // 技力の半分が回避
  const staVal = Math.floor(status.sta * 0.5); // 耐久力の半分がクリ耐性

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

// 専用武器のタブ切り替え処理
function switchWeaponTrigger(mode) {
  document
    .querySelectorAll("#charDetailModal .admin-btn")
    .forEach((b) => b.classList.remove("active"));
  const targetBtn = document.getElementById(`btn-wp-${mode}`);
  if (targetBtn) targetBtn.classList.add("active");

  // 4大スキルのテキスト流し込み
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

  // 武器パッシブの流し込み
  const w = cachedDetailPackage.weapon || { name: "" };
  if (mode === "normal") {
    document.getElementById("v-w-name").innerText = "専用武器なし (未装備)";
    document.getElementById("v-w-val").innerText = "固有値: -";
    document.getElementById("v-w-passives-lbl").style.display = "none";
    document.getElementById("v-w-passives").innerHTML =
      "<li>パッシバ効果はありません</li>";
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
// 性能編集画面を開く
function openPerformanceEditor() {
  const s = characterMaster[currentDetailIndex];
  if (!s) return;

  document.getElementById("charDetailModal").classList.remove("is-active");
  document.getElementById("pe-charId").value = s.id;
  document.getElementById("pe-avatar").src = s.iconUrl;
  document.getElementById("pe-header-info").innerHTML =
    `<h3 style="margin:0; font-size:16px; font-weight:bold;">${s.name}</h3><span class="tag-badge">${s.attr} / ${s.type}</span>`;

  // 🔴【修正】データが存在し、かつ「厳格に大文字の"TRUE"であるとき」だけをTRUEにする安全な判定
  const isCharFinished =
    s && s.isFinished && String(s.isFinished).trim() === "TRUE";

  const checkboxEl = document.getElementById("isFinished");
  const labelEl = document.querySelector(".perf-form__checkbox-label");

  if (checkboxEl) {
    // 💡 1. 内部のチェック状態（レ点）を確実に同期
    checkboxEl.checked = isCharFinished;

    // 💡 2. 【最重要】検証モードのHTML属性（見た目）にも大文字の文字を直接ハメ込む！
    if (isCharFinished) {
      checkboxEl.setAttribute("checked", "TRUE");
      if (labelEl) labelEl.classList.add("is-active"); // デザイン変更用のクラス（あれば）
    } else {
      checkboxEl.setAttribute("checked", "FALSE");
      if (labelEl) labelEl.classList.remove("is-active");
    }

    console.log(
      `👁️ 読み込み完了: [${s.name}] のデータベース値: ${s.isFinished} ➔ 反映属性:`,
      checkboxEl.getAttribute("checked"),
    );
  }

  // フォームに初期値をセット（モックデータから流し込み）
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

// 性能編集画面を閉じる
function closePerfEditor() {
  document.getElementById("charPerfEditModal").classList.remove("is-active");
}

// ─── ⭕️ ③ データ保存時：見た目と連動して TRUE / FALSE を文字で書き込む ───
function savePerformanceData() {
  const s = characterMaster[currentDetailIndex];
  if (!s) return alert("キャラクターの指定が正しくありません");

  if (typeof showLoading === "function") showLoading();

  // 💡 画面上のHTML属性から、今入っている「"TRUE"」または「"FALSE"」の文字を直接ぶっこ抜く！
  const checkboxEl = document.getElementById("isFinished");
  const currentStatusText = checkboxEl
    ? checkboxEl.getAttribute("checked")
    : "FALSE";

  // 💡 文字列のままデータベース（Firestore）へ送るデータを組み立て
  const updateData = {
    isFinished: currentStatusText,
  };

  const db = getFirestore();
  const docRef = doc(db, "character_master", String(s.id));

  setDoc(docRef, updateData, { merge: true })
    .then(function () {
      console.log(`💾 Firestore同期完了: ID ${s.id} = ${currentStatusText}`);

      // ローカルのデータ配列も同じ「文字（"TRUE" / "FALSE"）」で上書き同期
      window.characterMaster[currentDetailIndex].isFinished = currentStatusText;

      if (typeof hideLoading === "function") hideLoading();
      closePerfEditor();

      // 一覧画面の描画をリフレッシュ
      renderGridHTML(window.characterMaster);

      if (currentStatusText === "TRUE") {
        alert(`✨ 「${s.name}」の性能入力を「完了」として保存しました！`);
      } else {
        alert(`✨ 「${s.name}」の性能データを保存しました（未完了）。`);
      }
    })
    .catch(function (error) {
      console.error("❌ 保存エラー:", error);
      if (typeof hideLoading === "function") hideLoading();
      alert("⚠️ 保存に失敗しました:\n" + error.message);
    });
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

      // 今の状態を反転
      checkbox.checked = !checkbox.checked;

      // 💡 TRUE と FALSE の文字をHTML属性へリアルタイムにハメ込む！
      if (checkbox.checked) {
        checkbox.setAttribute("checked", "TRUE");
        label.classList.add("is-active");
      } else {
        checkbox.setAttribute("checked", "FALSE");
        label.classList.remove("is-active");
      }

      console.log(
        "☑️ クリック連動：現在の属性値 =",
        checkbox.getAttribute("checked"),
      );
    });
  }
});

/* -------------------------------------------------------------------------
     大元のキャラクターマスタ編集・新規登録登録フォーム制御
     ------------------------------------------------------------------------- */
// 詳細画面の「⚙️ マスタ編集」から呼び出す連動処理
function openAdminEditFromDetail() {
  document.getElementById("charDetailModal").classList.remove("is-active");
  openModalForEditByIndex(currentDetailIndex);
}

// 既存キャラの編集フォーム展開
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
  document.getElementById("formStartDate").value = d.releaseDate || ""; // 保存されている「releaseDate」を、カレンダーの入力欄（formStartDate）にセット！
  calculateElapsedDays(d.releaseDate || ""); // 編集画面を開いた瞬間に、実装経過日数を自動計算して「◯日」と表示させる関数を動かす！

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
  if (delBtn) delBtn.style.display = "block"; // 既存編集時は「削除ボタンを表示」
}

// 🔓 新規登録ボタン（openModalForCreate）を押したときの処理
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
  if (delBtn) delBtn.style.display = "none"; // 👈 新規作成時は「削除ボタンを非表示」
}

function closeModal() {
  document.getElementById("charModal").classList.remove("is-active");
}

// 「保存する」が押されたときのデータ同期処理
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
    releaseDate: formStartDate || "", // スプレッドシートのヘッダー名と一致させます
    iconUrl: formIconUrl || "https://placehold.co",
    coverUrl: formCoverUrl || "https://placehold.co",
    tags: "",
  };

  const existingIdx = characterMaster.findIndex(function (c) {
    return String(c.id) === String(formId);
  });

  // ─── 💡 saveMasterData の後半、既存更新か新規追加の判定部分から ───
  let alertMessage = ""; // 変数の宣言

  if (existingIdx !== -1) {
    characterMaster[existingIdx] = Object.assign(
      {},
      characterMaster[existingIdx],
      formData,
    );
    alertMessage = `✨ 「${formName}」のマスタ情報を更新しました！`;
  } else {
    characterMaster.push(formData); // 新規登録
    alertMessage = `🎉 新規キャラクター「${formName}」を登録しました！`;
  }

  // ─── ✨Firestore書き込み処理 ───

  // 1. 保存ボタンが押された瞬間に、画面全体をロックしてぐるぐるを開始！
  if (typeof showLoading === "function") showLoading();

  // 最新のFirebase形式でデータベース（db）を呼び出します
  const db = getFirestore();

  // 「character_master」というコレクションの中に、キャラIDをファイル名にしたドキュメントを保存・上書きする設定
  const docRef = doc(db, "character_master", String(formData.id));

  // 🚀 本物の Firestore データベースへデータを送信して、完了をじっと待ちます（then）
  setDoc(docRef, formData, { merge: true })
    .then(function () {
      console.log("💾 Firestore 同期完了: キャラクターID " + formData.id);

      // 最新のデータをローカルの配列（characterMaster）にも即時反映させる
      if (existingIdx !== -1) {
        window.characterMaster[existingIdx] = Object.assign(
          {},
          window.characterMaster[existingIdx],
          formData,
        );
      }

      // 待ち時間が終わったのでぐるぐるを消す
      if (typeof hideLoading === "function") hideLoading();

      // モーダル（入力画面）を閉じる
      closeModal();

      // 最新のデータでキャラクター一覧（グリッド）を再描画する
      renderGridHTML(window.characterMaster);

      // 最後に親切なポップアップを表示する
      alert(alertMessage);
    })
    .catch(function (error) {
      // ⚠️ 万が一の通信エラーや権限エラーに対するセーフティ
      console.error("❌ Firestoreへの保存に失敗しました:", error);
      if (typeof hideLoading === "function") hideLoading();
      alert(
        "⚠️ データベースへの保存に失敗しました。通信環境やログイン状態を確認してください。\n" +
          error.message,
      );
    });
}

// ===================================================================
// 🗑️ キャラクターマスタをFirestore（クラウド）から完全に抹消する関数
// ===================================================================
function deleteMasterCharacter() {
  // 画面の入力フォームから、今開いているキャラクターのIDと名前を取得
  const formId = document.getElementById("formId").value;
  const formName = document.getElementById("formName").value.trim();

  if (!formId) return alert("削除対象のキャラクターIDが見つかりません");

  // 🛑 誤クリックで大事なキャラを消さないための最終確認ポップアップ
  if (
    !confirm(
      "⚠️ 本当にキャラクター「" +
        formName +
        "」をマスタから完全に削除しますか？\nこの操作は取り消せません。",
    )
  ) {
    return; // キャンセルされたら何もしない
  }

  // 🌀 削除完了まで画面全体をロックしてローディング（ぐるぐる）を開始！
  if (typeof showLoading === "function") showLoading();

  const db = getFirestore();
  // 削除対象のドキュメント（ファイル）を指定
  const docRef = doc(db, "character_master", String(formId));

  // 🚀 本物の Firestore からキャラクターデータを消去！
  deleteDoc(docRef)
    .then(function () {
      console.log("🗑️ Firestore キャラクターマスタ削除完了: ID " + formId);

      // クラウド側が消えたので、ローカルのメモリ（配列）からもそのキャラを間引く
      window.characterMaster = window.characterMaster.filter(function (c) {
        return String(c.id) !== String(formId);
      });

      // 待ち時間が終わったので画面ロックを解除
      if (typeof hideLoading === "function") hideLoading();

      closeModal(); // 編集モーダルを閉じる
      window.onAdminAuthSuccess();

      alert(
        "✨ 「" + formName + "」のキャラクターマスタ情報を完全に消去しました。",
      );
    })
    .catch(function (error) {
      // ⚠️ 万が一、通信エラーなどが起きた場合のセーフティ
      console.error("❌ キャラクターの削除に失敗しました:", error);
      if (typeof hideLoading === "function") hideLoading();
      alert(
        "⚠️ 削除に失敗しました。通信環境を確認してください:\n" + error.message,
      );
    });
}

// 💡 windowに大公開して、HTML側の onclick="deleteMasterCharacter()" から呼べるように紐付けます
window.deleteMasterCharacter = deleteMasterCharacter;

// 経過日数の計算のための関数
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

/* =========================================================================
   ⚙️ ドロップダウン制御関数の追加（重複エラー解決版）
   ========================================================================= */

// 💡 177行目に古い toggleDD があるため、ここには setDDValue の実体だけを書きます！
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

// 💡 ドロップダウンの外側をクリックしたときに自動で閉じる仕組み
window.addEventListener("click", function (event) {
  if (!event.target.closest(".dd-container")) {
    document.querySelectorAll(".dd-menu").forEach((menu) => {
      menu.style.display = "none";
    });
  }
});

// 💡 177行目にある toggleDD と、上で作った setDDValue をHTML（window）へ大公開！
window.toggleDD = toggleDD;
window.setDDValue = setDDValue;

/* =========================================================================
   🌐 HTML側（onclick / onchange）から関数を呼べるようにする公開処理
   ========================================================================= */
// 💡 window. に関数を入れることで、HTML側の onclick="openModalForCreate()" などが動くようになります！
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
