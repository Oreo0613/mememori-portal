/* -------------------------------------------------------------------------
   1. アルカナ画面専用の変数・モックデータ定義
   ------------------------------------------------------------------------- */
   var EFFECT_TAGS_MASTER = [
    "HP", "攻撃力", "クリダメ強化", "物理クリダメ緩和", "魔法クリダメ緩和",
    "HPドレイン", "カウンタ", "物魔防御貫通", "防御貫通", "耐久力", "クリティカル",
    "クリティカル耐性", "防御力", "物理防御力", "魔法防御力", "腕力", "技力",
    "魔力", "命中", "回避", "弱体効果命中", "弱体効果耐性", "パーティLv上限"
  ];
  
  var arcanaMaster = [];
  var curEditingArcana = null;
  var curSlotIdx = null;
  
  /* =========================================================================
     🧙‍♀️ ログイン成功後の初期化処理
     ========================================================================= */
  window.onAdminAuthSuccess = function (user) {
    console.log("admin.js からの通知：ローカルJSONによるアルカナページの描画を開始します。");
  
    if (typeof showLoading === "function") showLoading();
  
    const charJsonUrl = "assets/json/character-master.json";
    const arcanaJsonUrl = "assets/json/arcana-master.json";
  
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
      arcanaMaster = arcanaData;
  
      arcanaMaster.sort(function (a, b) {
        return Number(a.id) - Number(b.id);
      });
  
      drawTable();
    })
    .catch(function (error) {
      console.error("JSONデータの読込中にエラーが発生しました:", error);
      alert("マスタデータの読込に失敗しました。");
    })
    .then(function () {
      if (typeof hideLoading === "function") hideLoading();
    });
  };
  
  /* -------------------------------------------------------------------------
       アプリケーション起動 ＆ メインテーブル（一覧）描画
       ------------------------------------------------------------------------- */
  // 💡 effectsList から表示用テキストを動的生成するヘルパー
  function formatEffectsText(effectsList) {
    if (!Array.isArray(effectsList) || effectsList.length === 0) {
      return '<span style="color: var(--text-muted); font-style: italic;">効果なし</span>';
    }
  
    return effectsList.map(function(eff) {
      if (!eff.status || !eff.type) return "";
      var valStr = "";
      if (eff.type === "percent") {
        valStr = eff.status + eff.value + "%";
      } else if (eff.type === "fixed") {
        var numVal = Number(eff.value);
        valStr = eff.status + (isNaN(numVal) ? eff.value : numVal.toLocaleString());
      } else if (eff.type === "charLv") {
        valStr = eff.status + "キャラLv×" + eff.value;
      }
      return valStr;
    }).filter(Boolean).join(", ");
  }
  
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
  
      // 💡 ar.effect の代わりに effectsList から動的生成したテキストを表示
      var effectTextDisplay = formatEffectsText(ar.effectsList);
  
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
        effectTextDisplay +
        "</td>" +
        '<td style="text-align:center;"><button class="ar-btn" onclick="openCard(' +
        ar.id +
        ')"><i class="fa-regular fa-pen-to-square"></i> 編集</button></td>';
      tbody.appendChild(row);
    });
  }
  
  function exportUpdatedJsonFile() {
    const outputData = [].concat(arcanaMaster).sort(function(a, b) {
      return Number(a.id) - Number(b.id);
    });
  
    const jsonString = JSON.stringify(outputData, null, 4);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = "arcana-master.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  /* -------------------------------------------------------------------------
       3. モーダルウィンドウの制御
       ------------------------------------------------------------------------- */
  function openCard(id) {
    var ar = arcanaMaster.find(function (a) {
      return String(a.id) === String(id);
    });
    if (!ar) return;
    curEditingArcana = JSON.parse(JSON.stringify(ar));
  
    if (!Array.isArray(curEditingArcana.effectsList)) {
      curEditingArcana.effectsList = [];
    }
  
    document.getElementById("mdTitleInput").value = curEditingArcana.name;
  
    document.querySelector(".pk-side").classList.remove("is-active");
    renderModalSlots();
    renderEffectsEditor();
  
    var overlay = document.getElementById("mdOverlay");
    if (overlay) overlay.classList.add("is-active");
    curSlotIdx = null;
  }
  
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
      effectsList: [] // 💡 effect プロパティを持たせない
    };
  
    document.getElementById("mdTitleInput").value = "";
    document.getElementById("mdTitleInput").focus();
  
    document.querySelector(".pk-side").classList.remove("is-active");
    renderModalSlots();
    renderEffectsEditor();
  
    var overlay = document.getElementById("mdOverlay");
    if (overlay) overlay.classList.add("is-active");
    curSlotIdx = null;
  }
  
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
  
  function executePickCharacter(char) {
    if (!curEditingArcana || !curSlotIdx) return;
    curEditingArcana["charId" + curSlotIdx] = char.id;
    renderModalSlots();
  
    var nextIdx = curSlotIdx + 1;
    if (nextIdx <= 4) {
      selectCardSlot(nextIdx);
    } else {
      curSlotIdx = null;
      document.querySelector(".pk-side").classList.remove("is-active");
    }
  }
  
  function clearSlot(idx, e) {
    if (e) e.stopPropagation();
    if (!curEditingArcana) return;
    curEditingArcana["charId" + idx] = "";
    renderModalSlots();
    selectCardSlot(idx);
  }
  
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
       5. 構造化効果エディタ ＆ リアルタイムプレビュー関数
       ------------------------------------------------------------------------- */
  function renderEffectsEditor() {
    var container = document.getElementById("mdEffectsEditorList");
    if (!container) return;
    container.innerHTML = "";
  
    if (!Array.isArray(curEditingArcana.effectsList)) {
      curEditingArcana.effectsList = [];
    }
  
    if (curEditingArcana.effectsList.length === 0) {
      container.innerHTML = '<div style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 10px;">効果が登録されていません。「+ 効果を追加」を押してください。</div>';
      updateEffectPreview();
      return;
    }
  
    curEditingArcana.effectsList.forEach(function (eff, index) {
      var rowDiv = document.createElement("div");
      rowDiv.style.cssText = "display: flex; gap: 6px; align-items: center; background: var(--bg-main); padding: 6px; border-radius: 4px; border: 1px solid var(--border);";
  
      var statusOptionsHtml = '<option value="">-- ステータス選択 --</option>';
      EFFECT_TAGS_MASTER.forEach(function (tagName) {
        var selected = (eff.status === tagName) ? "selected" : "";
        statusOptionsHtml += '<option value="' + tagName + '" ' + selected + '>' + tagName + '</option>';
      });
  
      var typeOptionsHtml = '<option value="">-- タイプ選択 --</option>';
      typeOptionsHtml += '<option value="percent" ' + (eff.type === "percent" ? "selected" : "") + '>％ (percent)</option>';
      typeOptionsHtml += '<option value="fixed" ' + (eff.type === "fixed" ? "selected" : "") + '>固定値 (fixed)</option>';
      typeOptionsHtml += '<option value="charLv" ' + (eff.type === "charLv" ? "selected" : "") + '>キャラLv× (charLv)</option>';
  
      rowDiv.innerHTML = `
        <select oninput="updateEffectRow(` + index + `, 'status', this.value)" style="flex: 2; padding: 5px 8px; font-size: 12px;">
          ` + statusOptionsHtml + `
        </select>
        <select oninput="updateEffectRow(` + index + `, 'type', this.value)" style="flex: 2; padding: 5px 8px; font-size: 12px;">
          ` + typeOptionsHtml + `
        </select>
        <input type="number" placeholder="値入力" value="` + (eff.value !== undefined ? eff.value : "") + `" oninput="updateEffectRow(` + index + `, 'value', this.value)" style="flex: 1.5; padding: 5px 8px; font-size: 12px;" />
        <button type="button" class="ar-btn btn-delete" style="padding: 4px 8px; font-size: 11px;" onclick="removeEffectRow(` + index + `)"><i class="fa-solid xmark fa-x"></i></button>
      `;
      container.appendChild(rowDiv);
    });
  
    updateEffectPreview();
  }
  
  window.addEffectRow = function () {
    if (!Array.isArray(curEditingArcana.effectsList)) {
      curEditingArcana.effectsList = [];
    }
    curEditingArcana.effectsList.push({ status: "", type: "", value: "" });
    renderEffectsEditor();
  };
  
  window.updateEffectRow = function (index, field, val) {
    if (!curEditingArcana.effectsList[index]) return;
    if (field === "value") {
      curEditingArcana.effectsList[index][field] = val === "" ? "" : Number(val);
    } else {
      curEditingArcana.effectsList[index][field] = val;
    }
    updateEffectPreview();
  };
  
  window.removeEffectRow = function (index) {
    curEditingArcana.effectsList.splice(index, 1);
    renderEffectsEditor();
  };
  
  function updateEffectPreview() {
    var previewEl = document.getElementById("mdEffectPreviewText");
    if (!previewEl) return;
  
    if (!Array.isArray(curEditingArcana.effectsList) || curEditingArcana.effectsList.length === 0) {
      previewEl.textContent = "(未設定)";
      return;
    }
  
    var parts = [];
    curEditingArcana.effectsList.forEach(function(eff) {
      if (!eff.status || !eff.type || eff.value === "" || eff.value === undefined) return;
      var valStr = "";
      if (eff.type === "percent") {
        valStr = eff.status + eff.value + "%";
      } else if (eff.type === "fixed") {
        var numVal = Number(eff.value);
        valStr = eff.status + (isNaN(numVal) ? eff.value : numVal.toLocaleString());
      } else if (eff.type === "charLv") {
        valStr = eff.status + "キャラLv×" + eff.value;
      }
      if (valStr) {
        parts.push(valStr);
      }
    });
  
    previewEl.textContent = parts.length > 0 ? parts.join(", ") : "(未設定)";
  }
  
  /* -------------------------------------------------------------------------
     6. データ保存コミット
     ------------------------------------------------------------------------- */
  function toggleCardStatus() {
    if (!curEditingArcana) return alert("編集中のデータが見つかりません");
  
    var inputName = document.getElementById("mdTitleInput").value.trim();
    if (!inputName) return alert("アルカナ名を入力してください");
  
    curEditingArcana.name = inputName;
  
    // 💡 effect プロパティへの保存処理を完全に削除し、不必要なキーを残さないようにする
    if (curEditingArcana.effect !== undefined) {
      delete curEditingArcana.effect;
    }
    if (curEditingArcana.tags !== undefined) {
      delete curEditingArcana.tags;
    }
  
    var existingIdx = arcanaMaster.findIndex(function (a) {
      return String(a.id) === String(curEditingArcana.id);
    });
  
    var alertMessage = "";
  
    if (existingIdx !== -1) {
      arcanaMaster[existingIdx] = curEditingArcana;
      alertMessage = "✨ アルカナ「" + inputName + "」の情報を更新しました！";
    } else {
      arcanaMaster.push(curEditingArcana);
      alertMessage = "🎉 新規アルカナ「" + inputName + "」を登録しました！";
    }
  
    arcanaMaster.sort(function (a, b) {
      return Number(a.id) - Number(b.id);
    });
  
    closeCard();
    drawTable();
    exportUpdatedJsonFile();
  
    alert(alertMessage + "\n最新のJSONファイルを assets/json/ に上書き配置してください。");
  }
  
  function deleteCard() {
    if (!curEditingArcana) return alert("編集中のデータが見つかりません");
  
    if (!confirm("⚠️ 本当にアルカナ「" + curEditingArcana.name + "」を削除しますか？")) {
      return;
    }
  
    arcanaMaster = arcanaMaster.filter(function (a) {
      return String(a.id) !== String(curEditingArcana.id);
    });
  
    closeCard();
    drawTable();
    exportUpdatedJsonFile();
  
    alert("✨ アルカナを削除し、最新のJSONをダウンロードしました。ファイルを上書き配置してください。");
  }
  
  /* =========================================================================
     🌐 外部公開用ハンドラ
     ========================================================================= */
  window.openCardForNew = openCardForNew;
  window.openCard = openCard;
  window.toggleCardStatus = toggleCardStatus;
  window.selectCardSlot = selectCardSlot;
  window.closeCardOutside = closeCardOutside;
  window.flt = flt;
  window.clearSlot = clearSlot;
  window.deleteCard = deleteCard;