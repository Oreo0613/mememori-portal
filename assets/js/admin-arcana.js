/* -------------------------------------------------------------------------
   1. アルカナ画面専用の変数・モックデータ定義
   ------------------------------------------------------------------------- */
// 💡 23種類の効果タグマスター
var EFFECT_TAGS_MASTER = [
  "HP", "攻撃力", "クリダメ強化", "物理クリダメ緩和", "魔法クリダメ緩和",
  "HPドレイン", "カウンタ", "物魔防御貫通", "防御貫通", "耐久力", "クリティカル",
  "クリティカル耐性", "防御力", "物理防御力", "魔法防御力", "腕力", "技力",
  "魔力", "命中", "回避", "弱体効果命中", "弱体効果耐性", "パーティLv上限"
];

// マスタデータ用グローバル変数
var arcanaMaster = [];

// 状態管理用グローバル変数
var curEditingArcana = null;
var curSlotIdx = null;

/* =========================================================================
   🧙‍♀️ ログイン成功後の初期化処理（2つのJSONを爆速読み込み）
   ========================================================================= */
window.onAdminAuthSuccess = function (user) {
  console.log("admin.js からの通知：ローカルJSONによるアルカナページの描画を開始します。");

  if (typeof showLoading === "function") showLoading();

  const charJsonUrl = "assets/json/character-master.json";
  const arcanaJsonUrl = "assets/json/arcana-master.json";

  // 2つのJSONファイルを同時に爆速で並列ダウンロード！
  Promise.all([
    fetch(charJsonUrl).then(response => {
      if (!response.ok) throw new Error("キャラクターマスタの読込に失敗しました。");
      return response.json();
    }),
    fetch(arcanaJsonUrl).then(response => {
      if (!response.ok) throw new Error("アルカナマスタの読込に失敗しました。");
      return response.json();
    })
  ])
  .then(function ([charData, arcanaData]) {
    if (typeof characterMaster === "undefined") window.characterMaster = [];
    characterMaster = charData;
    console.log("🌸 [JSON] キャラクターデータを読み込みました！件数:", characterMaster.length);

    arcanaMaster = arcanaData;

    // 🔮 【ID小さい順ソート】
    arcanaMaster.sort(function (a, b) {
      return Number(a.id) - Number(b.id);
    });
    console.log("🔥 [JSON] アルカナデータを読み込み、ID降順にソートしました！件数:", arcanaMaster.length);

    drawTable();
  })
  .catch(function (error) {
    console.error("JSONデータの読込中にエラーが発生しました:", error);
    alert("マスタデータの読込に失敗しました。ファイル名やパス（assets/json/内にあるか）を確認してください。");
  })
  .then(function () {
    if (typeof hideLoading === "function") hideLoading();
  });
};

/* -------------------------------------------------------------------------
     アプリケーション起動 ＆ メインテーブル（一覧）描画
     ------------------------------------------------------------------------- */
// アルカナ一覧テーブルを動的に描画する関数
function drawTable() {
  var tbody = document.getElementById("arTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (arcanaMaster.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-sub);">表示可能なデータがありません</td></tr>';
    return;
  }

  arcanaMaster.forEach(function (ar) {
    var row = document.createElement("tr");
    row.id = "ar-row-" + ar.id;

    // 4枠のキャラアイコンスロットを生成するロジック（親のcharacterMaster配列を参照）
    var makeS = function (idx) {
      var cId = ar["charId" + idx];
      if (!cId) return '<div class="slot slot--hide">-</div>';
      var c = characterMaster.find(function (ch) {
        return String(ch.id).trim() === String(cId).trim();
      });
      var inner = c
        ? '<img src="' + c.iconUrl + '" title="' + c.name + '">'
        : '<div style="font-size:10px;">' + cId + "</div>";
      return '<div class="slot">' + inner + "</div>";
    };

    row.innerHTML =
      '<td style="text-align:center; font-weight:bold; color:var(--text-sub);">' +
      ar.id +
      "</td>" +
      "<td><strong>" +
      ar.name +
      "</strong></td>" +
      '<td><div class="slots">' +
      makeS(1) +
      makeS(2) +
      makeS(3) +
      makeS(4) +
      "</div></td>" +
      "<td>" +
      ar.effect +
      "</td>" +
      '<td style="text-align:center;"><button class="ar-btn" onclick="openCard(' +
      ar.id +
      ')"><i class="fa-regular fa-pen-to-square"></i> 編集</button></td>';
    tbody.appendChild(row);
  });
}

/* -------------------------------------------------------------------------
    💡 最新のJSONデータをパソコンへ自動エクスポート（保存）する共通関数
   ------------------------------------------------------------------------- */
function exportUpdatedJsonFile() {
  // 保存する前に、JSON内の並び順を綺麗な「ID昇順（数字の小さい順）」に並び替えて整える
  const outputData = [].concat(arcanaMaster).sort(function(a, b) {
    return Number(a.id) - Number(b.id);
  });

  const jsonString = JSON.stringify(outputData, null, 4);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = "arcana-master.json"; // 💡 この名前でダウンロードさせます
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log("💾 最新の arcana-master.json をローカルに出力しました。これを差し替えてください。");
}

/* -------------------------------------------------------------------------
     3. モーダルウィンドウの制御（表示・非表示・データ流し込み）
     ------------------------------------------------------------------------- */
// 【既存編集】データを選んでモーダルを開く
function openCard(id) {
  var ar = arcanaMaster.find(function (a) {
    return String(a.id) === String(id);
  });
  if (!ar) return;
  curEditingArcana = JSON.parse(JSON.stringify(ar)); // オリジナル保護

  document.getElementById("mdTitleInput").value = curEditingArcana.name;
  document.getElementById("mdEffectInput").value = curEditingArcana.effect;

  document.querySelector(".pk-side").classList.remove("is-active");
  renderModalSlots();
  renderTagCheckboxes();

  var overlay = document.getElementById("mdOverlay");
  if (overlay) overlay.classList.add("is-active");
  curSlotIdx = null;
}

// 【新規追加】まっさらな状態でモーダルを開く
function openCardForNew() {
  var nextId = String(
    arcanaMaster.length > 0
      ? Math.max.apply(null, arcanaMaster.map(function (a) { return Number(a.id); })) + 1
      : 1
  );
  curEditingArcana = {
    id: nextId,
    name: "",
    charId1: "",
    charId2: "",
    charId3: "",
    charId4: "",
    effect: "",
    tags: "",
  };

  document.getElementById("mdTitleInput").value = "";
  document.getElementById("mdEffectInput").value = "";
  document.getElementById("mdTitleInput").focus();

  document.querySelector(".pk-side").classList.remove("is-active");
  renderModalSlots();
  renderTagCheckboxes();

  var overlay = document.getElementById("mdOverlay");
  if (overlay) overlay.classList.add("is-active");
  curSlotIdx = null;
}

// モーダルを閉じ、メインテーブルをリフレッシュ
function closeCard() {
  var overlay = document.getElementById("mdOverlay");
  if (overlay) overlay.classList.remove("is-active");
  document.querySelector(".pk-side").classList.remove("is-active");
  drawTable();
}

function closeCardOutside(e) {
  if (e.target.id === "mdOverlay") closeCard();
}

/* -------------------------------------------------------------------------
     4. 編成スロット ＆ キャラクターピッカー連動
     ------------------------------------------------------------------------- */
function renderModalSlots() {
  var sContainer = document.getElementById("mdSlots");
  sContainer.innerHTML = "";

  for (var idx = 1; idx <= 4; idx++) {
    var cId = curEditingArcana["charId" + idx];
    var char = characterMaster.find(function (ch) {
      return String(ch.id) === String(cId);
    });
    var innerContent = char
      ? '<img src="' + char.iconUrl + '" title="' + char.name + '"><div class="c-slot-del" onclick="clearSlot(' + idx + ', event)"><i class="fa-solid fa-x"></i></div>'
      : "枠" + idx;
    var slotHtml = '<div class="slot" id="c-slot-' + idx + '" onclick="selectCardSlot(' + idx + ');">' + innerContent + '</div>';
    sContainer.insertAdjacentHTML("beforeend", slotHtml);
  }
}

function selectCardSlot(idx) {
  if (!curEditingArcana) return;
  document.querySelectorAll(".md-main .slot").forEach(function (s) {
    s.classList.remove("sel");
  });

  var target = document.getElementById("c-slot-" + idx);
  if (target) {
    target.classList.add("sel");
    curSlotIdx = idx;

    var pickerWindow = document.querySelector(".pk-side");
    if (pickerWindow) pickerWindow.classList.add("is-active");

    document.getElementById("slbl").innerText = "枠" + idx + " のキャラクターを選択中";
    flt("all", document.querySelector(".pk-flx .pk-btn"));
  }
}

// 右側のピッカーでキャラアイコンが選ばれた時の格納処理
function executePickCharacter(char) {
  if (!curEditingArcana || !curSlotIdx) return;
  curEditingArcana["charId" + curSlotIdx] = char.id;
  renderModalSlots();

  // 連続選択アシスト（次の空き枠へスライド）
  var nextIdx = curSlotIdx + 1;
  if (nextIdx <= 4) {
    selectCardSlot(nextIdx);
  } else {
    curSlotIdx = null;
    document.querySelector(".pk-side").classList.remove("is-active");
  }
}

// スロットのキャラを外す（ゴミ箱・バツボタン）
function clearSlot(idx, e) {
  if (e) e.stopPropagation();
  if (!curEditingArcana) return;
  curEditingArcana["charId" + idx] = "";
  renderModalSlots();
  selectCardSlot(idx);
}

// 右側選択パネル内の属性フィルター（絞り込み）
function flt(elm, btn) {
  if (btn) {
    btn.parentElement.querySelectorAll(".pk-btn").forEach(function (b) {
      b.classList.remove("is-active");
    });
    btn.classList.add("is-active");
  }
  var grid = document.getElementById("pGrid");
  if (!grid) return;
  grid.innerHTML = "";

  characterMaster.forEach(function (c) {
    if (elm !== "all" && String(c.attr).trim() !== elm) return;
    var card = document.createElement("div");
    card.className = "pk-card";
    card.onclick = function () {
      executePickCharacter(c);
    };
    card.innerHTML = '<img src="' + c.iconUrl + '" title="' + c.name + '">';
    grid.appendChild(card);
  });
}

/* -------------------------------------------------------------------------
     5. 効果タグコントロール（チェックボックス ＆ バッジ）
     ------------------------------------------------------------------------- */
function renderTagCheckboxes() {
  var tagContainer = document.getElementById("mdTagContainer");
  if (!tagContainer) return;
  tagContainer.innerHTML = "";

  var currentTags = curEditingArcana.tags
    ? curEditingArcana.tags.split(",").map(function (t) { return t.trim(); })
    : [];

  EFFECT_TAGS_MASTER.forEach(function (tagName) {
    var isChecked = currentTags.indexOf(tagName) !== -1 ? "checked" : "";
    var label = document.createElement("label");
    label.innerHTML =
      '<input type="checkbox" class="md-effect-tag-cb" value="' + tagName + '" ' + isChecked + ' onchange="updateMdTagBadges()"> ' + tagName;
    tagContainer.appendChild(label);
  });
  updateMdTagBadges();
}

function updateMdTagBadges() {
  var badgeArea = document.getElementById("mdSelectedBadgeArea");
  if (!badgeArea) return;
  badgeArea.innerHTML = "";

  var allBoxes = document.querySelectorAll(".md-effect-tag-cb");
  allBoxes.forEach(function (cb) {
    cb.classList.remove("is-active");
  });

  var checkedBoxes = document.querySelectorAll(".md-effect-tag-cb:checked");

  if (checkedBoxes.length === 0) {
    badgeArea.innerHTML = '<span style="font-size: 12px; color: rgba(255,255,255,0.2); font-style: italic;">選択中のタグはありません</span>';
    return;
  }

  checkedBoxes.forEach(function (cb) {
    cb.classList.add("is-active");
    var badge = document.createElement("span");
    badge.className = "md-effect-badge";
    badge.innerText = cb.value;
    badgeArea.appendChild(badge);
  });
}

/* -------------------------------------------------------------------------
   6. データ保存コミット（ローカルメモリ更新 ＆ 自動ダウンロード）
   ------------------------------------------------------------------------- */
// 右下の「更新する」ボタンが押された時のデータ上書き処理
function toggleCardStatus() {
  if (!curEditingArcana) return alert("編集中のデータが見つかりません");

  var inputName = document.getElementById("mdTitleInput").value.trim();
  var inputEffect = document.getElementById("mdEffectInput").value.trim();

  if (!inputName) return alert("アルカナ名を入力してください");

  var selectedTags = [];
  document.querySelectorAll(".md-effect-tag-cb:checked").forEach(function (cb) {
    selectedTags.push(cb.value);
  });

  curEditingArcana.name = inputName;
  curEditingArcana.effect = inputEffect;
  curEditingArcana.tags = selectedTags.join(", ");

  var existingIdx = arcanaMaster.findIndex(function (a) {
    return String(a.id) === String(curEditingArcana.id);
  });

  var alertMessage = "";

  if (existingIdx !== -1) {
    arcanaMaster[existingIdx] = curEditingArcana;
    alertMessage = "✨ アルカナ「" + inputName + "」の組み合わせ情報を更新しました！";
  } else {
    arcanaMaster.push(curEditingArcana);
    alertMessage = "🎉 新規アルカナ「" + inputName + "」を登録しました！";
  }

  // 画面表示用の昇順ソート（最新が下）を維持
  arcanaMaster.sort(function (a, b) {
    return Number(a.id) - Number(b.id);
  });

  closeCard();
  drawTable();

  // 💡 最新状態のJSONファイルを自動ダウンロード
  exportUpdatedJsonFile();

  alert(alertMessage + "\n最新のJSONファイルを assets/json/ に上書き配置してください。");
}

// =================================================================
// 🗑️ 表示中のアルカナをマスタから完全に削除する関数（Firestore完全卒業）
// =================================================================
function deleteCard() {
  if (!curEditingArcana) return alert("編集中のデータが見つかりません");

  if (!confirm("⚠️ 本当にアルカナ「" + curEditingArcana.name + "」を削除しますか？\nこの操作は取り消せません。")) {
    return;
  }

  // 配列から間引く
  arcanaMaster = arcanaMaster.filter(function (a) {
    return String(a.id) !== String(curEditingArcana.id);
  });

  closeCard();
  drawTable();

  // 💡 最新状態のJSONファイルを自動ダウンロード
  exportUpdatedJsonFile();

  alert("✨ アルカナを削除し、最新のJSONをダウンロードしました。ファイルを上書き配置してください。");
}

/* =========================================================================
   🌐 HTML側（onclick / onchange）から関数を呼べるようにする公開処理
   ========================================================================= */
window.openCardForNew = openCardForNew;
window.openCard = openCard;
window.toggleCardStatus = toggleCardStatus;
window.selectCardSlot = selectCardSlot;
window.closeCardOutside = closeCardOutside;
window.flt = flt;
window.updateMdTagBadges = updateMdTagBadges;
window.clearSlot = clearSlot;
window.deleteCard = deleteCard;
