import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc  } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

/* =========================================================================
   🧙‍♀️ ログイン成功後の初期化処理
   ========================================================================= */

// 💡 admin.js が認証に成功したあと、自動でこの関数を呼び出し
window.onAdminAuthSuccess = function (user) {
  console.log("admin.js からの通知：アルカナページの描画を開始します。");

  // 🌀 読み込み中ローディングを出す
  if (typeof showLoading === "function") showLoading();

  // ─── ✨【ここから変更】最新のFirebase(v9+)形式の書き方に修正 ───
  
  // 💡【追加】admin.jsで初期化されたFirebaseから、最新の接続インスタンス（db）を取得する1行
  const db = getFirestore();

  // 💡【変更】古い「firebase.firestore().collection(...).get()」を廃止し、
  // 事前にimportした最新の「getDocs(collection(db, "コレクション名"))」という形に書き換え
  getDocs(collection(db, "arcana_master"))
    .then(function(querySnapshot) {
      // ─── 💡【ここから下は元の処理と同じです】 ───
      
      // 一旦、ローカルの配列をリセット
      arcanaMaster = [];
      
      // データベースから取得したデータを1件ずつ配列に詰め込む
      querySnapshot.forEach(function(doc) {
        arcanaMaster.push(doc.data());
      });

      console.log("🔥 Firestoreからデータをダウンロードしました！件数:", arcanaMaster.length);

      // データが揃ったのでメインテーブル（一覧）を描画！
      drawTable();
    })
    .catch(function(error) {
      console.error("データの読み込みに失敗しました:", error);
      alert("データの取得に失敗しました。セキュリティルール等を確認してください。");
    })
    .then(function() {
      // 🌀 成功しても失敗してもローディングを消す
      if (typeof hideLoading === "function") hideLoading();
    });
};


/* -------------------------------------------------------------------------
   1. アルカナ画面専用の変数・モックデータ定義
   ------------------------------------------------------------------------- */
// 💡 23種類の効果タグマスター
var EFFECT_TAGS_MASTER = [
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

// 💡 ローカル動作確認用のアルカナ初期データ
var arcanaMaster = [
  {
    id: "1",
    name: "愚者のアルカナ",
    charId1: "1",
    charId2: "2",
    charId3: "",
    charId4: "",
    effect: "味方全体の攻撃力+10%",
    tags: "攻撃力",
  },
  {
    id: "2",
    name: "魔術師のアルカナ",
    charId1: "3",
    charId2: "4",
    charId3: "1",
    charId4: "",
    effect: "最大HP+15%、魔力+5",
    tags: "HP, 魔力",
  },
];

// 初期データは空っぽにしておく（Firestoreからダウンロードするため）
var arcanaMaster = [];

// 状態管理用グローバル変数
var curEditingArcana = null;
var curSlotIdx = null;

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
        return String(ch.id) === String(cId);
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
  if (overlay) {
    overlay.classList.add("is-active");
  }
  curSlotIdx = null;
}

// 【新規追加】まっさらな状態でモーダルを開く
function openCardForNew() {
  var nextId = String(
    arcanaMaster.length > 0
      ? Math.max.apply(
          null,
          arcanaMaster.map(function (a) {
            return Number(a.id);
          }),
        ) + 1
      : 1,
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
  if (overlay) {
    overlay.classList.add("is-active");
  }
  curSlotIdx = null;
}

// モーダルを閉じ、メインテーブルをリフレッシュ
function closeCard() {
  var overlay = document.getElementById("mdOverlay");
  if (overlay) {
    overlay.classList.remove("is-active");
  }
  document.querySelector(".pk-side").classList.remove("is-active");
  drawTable();
}

// ⚠️ 親に共通の背景クリックを設置したため、こちら側を誤動作防止用にガード
function closeCardOutside(e) {
  if (e.target.id === "mdOverlay") closeCard();
}

/* -------------------------------------------------------------------------
     4. 編成スロット ＆ キャラクターピッカー連動
     ------------------------------------------------------------------------- */
// モーダル内の4つのスロット枠を再描画
function renderModalSlots() {
  var sContainer = document.getElementById("mdSlots");
  sContainer.innerHTML = "";

  for (var idx = 1; idx <= 4; idx++) {
    var cId = curEditingArcana["charId" + idx];
    var char = characterMaster.find(function (ch) {
      return String(ch.id) === String(cId);
    });
    var innerContent = char
      ? '<img src="' +
        char.iconUrl +
        '" title="' +
        char.name +
        '"><div class="c-slot-del" onclick="clearSlot(' +
        idx +
        ', event)"><i class="fa-solid fa-x"></i></div>'
      : "枠" + idx;
    var slotHtml =
      '<div class="slot" id="c-slot-' +
      idx +
      '" onclick="selectCardSlot(' +
      idx +
      ');">' +
      innerContent +
      "</div>";
    sContainer.insertAdjacentHTML("beforeend", slotHtml);
  }
}

// 特定の編成スロットをクリックして青く光らせる
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

    document.getElementById("slbl").innerText =
      "枠" + idx + " のキャラクターを選択中";
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
      b.classList.remove("act");
    });
    btn.classList.add("act");
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
// モーダル内の23種類のチェックボックスを動的生成
function renderTagCheckboxes() {
  var tagContainer = document.getElementById("mdTagContainer");
  if (!tagContainer) return;
  tagContainer.innerHTML = "";

  var currentTags = curEditingArcana.tags
    ? curEditingArcana.tags.split(",").map(function (t) {
        return t.trim();
      })
    : [];

  EFFECT_TAGS_MASTER.forEach(function (tagName) {
    var isChecked = currentTags.indexOf(tagName) !== -1 ? "checked" : "";
    var label = document.createElement("label");
    label.innerHTML =
      '<input type="checkbox" class="md-effect-tag-cb" value="' +
      tagName +
      '" ' +
      isChecked +
      ' onchange="updateMdTagBadges()"> ' +
      tagName;
    tagContainer.appendChild(label);
  });
  updateMdTagBadges();
}

// チェックされたタグを回収してオシャレな横並びバッジを描画
function updateMdTagBadges() {
  var badgeArea = document.getElementById("mdSelectedBadgeArea");
  if (!badgeArea) return;
  badgeArea.innerHTML = "";

  // 1. まず、すべてのチェックボックスから一旦 "is-active" を外す
  var allBoxes = document.querySelectorAll(".md-effect-tag-cb");
  allBoxes.forEach(function (cb) {
    cb.classList.remove("is-active");
    // もし親の <label> に付けたい場合は、以下のようにします
    // if (cb.parentElement) cb.parentElement.classList.remove("is-active");
  });

  var checkedBoxes = document.querySelectorAll(".md-effect-tag-cb:checked");

  if (checkedBoxes.length === 0) {
    badgeArea.innerHTML =
      '<span style="font-size: 12px; color: rgba(255,255,255,0.2); font-style: italic;">選択中のタグはありません</span>';
    return;
  }

  // バッジ（効果タグ）を1つずつ描画
  checkedBoxes.forEach(function (cb) {
    cb.classList.add("is-active");// チェックボックスにクラス付与

    // バッジの生成処理
    var badge = document.createElement("span");
    badge.className = "md-effect-badge"
    badge.innerText = cb.value;
    badgeArea.appendChild(badge);
  });
}


/* -------------------------------------------------------------------------
   6. データ保存コミット（モックデータ同期）
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

  // 🔔 保存アクションに応じた通知メッセージを入れておく変数を追加
  var alertMessage = "";

  if (existingIdx !== -1) {
    arcanaMaster[existingIdx] = curEditingArcana;
    console.log("📊 既存のアルカナID: " + curEditingArcana.id + " を更新しました。");
    
    alertMessage = "✨ アルカナ「" + inputName + "」の組み合わせ情報を更新しました！";
  } else {
    arcanaMaster.push(curEditingArcana);
    console.log("🆕 新しいアルカナID: " + curEditingArcana.id + " を追加しました。");
    
    alertMessage = "🎉 新規アルカナ「" + inputName + "」を登録しました！";
  }

  // ─── ✨【ここから変更】ダミータイマーを廃止し、本物のFirestore書き込み処理に修正 ───

  // 1. ボタンが押された瞬間に、画面全体をロックしてぐるぐるを開始！
  if (typeof showLoading === "function") showLoading();

  // 最新のFirebase(v9+)形式でデータベース（db）を呼び出します
  const db = getFirestore();

  // 「arcana_master」というコレクション（フォルダ）の中に、アルカナIDを名前にしたドキュメント（ファイル）を保存・上書きする設定
  const docRef = doc(db, "arcana_master", String(curEditingArcana.id));

  // 🚀 本物の Firestore データベースへデータを送信して、完了をじっと待ちます（then）
  setDoc(docRef, curEditingArcana, { merge: true })
    .then(function() {
      // 👍 データベースへの保存が成功したあとの処理
      console.log("💾 Firestore 同期完了: アルカナID " + curEditingArcana.id);

      // 待ち時間が終わったのでぐるぐるを消す
      if (typeof hideLoading === "function") hideLoading();

      // モーダルカード（入力画面）を閉じる
      closeCard();

      // 最新のデータで一覧テーブルを再描画する
      drawTable();

      // 最後に親切なポップアップを表示する
      alert(alertMessage);
    })
    .catch(function(error) {
      // ⚠️ 万が一、ネット接続エラーやセキュリティルール（権限）で弾かれた場合のセーフティネット
      console.error("❌ Firestoreへの保存に失敗しました:", error);
      
      // 画面がフリーズしないようにぐるぐるを解除
      if (typeof hideLoading === "function") hideLoading();
      
      // 原因をポップアップで教えてくれる安心設計
      alert("⚠️ データベースへの保存に失敗しました。通信環境やログイン状態を確認してください。\n" + error.message);
    });
}



// =================================================================
// 🗑️ 【修正版】表示中のアルカナをFirestoreから完全に削除する関数
// =================================================================
function deleteCard() {
  if (!curEditingArcana) return alert("編集中のデータが見つかりません");

  // 🛑 誤削除を防ぐための最終確認ポップアップ
  if (!confirm("⚠️ 本当にアルカナ「" + curEditingArcana.name + "」を削除しますか？\nこの操作は取り消せません。")) {
    return; // キャンセルされたら何もしない
  }

  // 🌀 削除完了まで画面をロックしてローディング開始
  if (typeof showLoading === "function") showLoading();

  const db = getFirestore();
  // 削除対象のドキュメント（ファイル）を指定
  const docRef = doc(db, "arcana_master", String(curEditingArcana.id));

  // 🚀 Firestoreからデータを削除
  deleteDoc(docRef)
    .then(function() {
      console.log("🗑️ Firestore 削除完了: アルカナID " + curEditingArcana.id);

      // ローカルの配列（一覧データ）からも削除したデータを間引く
      arcanaMaster = arcanaMaster.filter(function(a) {
        return String(a.id) !== String(curEditingArcana.id);
      });

      if (typeof hideLoading === "function") hideLoading();
      closeCard();   // モーダルを閉じる
      drawTable();   // 一覧テーブルをリフレッシュ
      alert("✨ アルカナを完全に消去しました。");
    })
    .catch(function(error) {
      console.error("❌ 削除に失敗しました:", error);
      if (typeof hideLoading === "function") hideLoading();
      alert("⚠️ 削除に失敗しました: " + error.message);
    });
}



/* =========================================================================
   🌐 HTML側（onclick / onchange）から関数を呼べるようにする公開処理
   ========================================================================= */
// 💡 window. に関数を入れることで、HTML側の onclick="openModalForCreate()" などが動くようになります！
window.openCardForNew = openCardForNew;
window.openCard = openCard;
window.toggleCardStatus = toggleCardStatus;
window.selectCardSlot = selectCardSlot;
window.closeCardOutside = closeCardOutside;
window.flt = flt;
window.updateMdTagBadges = updateMdTagBadges;
window.clearSlot = clearSlot;
window.deleteCard = deleteCard;