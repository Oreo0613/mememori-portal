import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs, // ➕ 追加
  collection, // ➕ 追加
  deleteDoc, // ➕ 追加
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const ADMIN_UID = "ZcWgnVNxShfjr1byRolwgdASFLi2"; // 🔒 管理者UID
const auth = getAuth();
const db = getFirestore();

let scheduleList = [];
let userCharactersMap = {}; // 🔮 相方魔女のレアリティをキャラクター図鑑から裏連動するマップ
let activeEditIndex = null;

// レアリティの定数マスター
const RARITY_MASTER = [
  { id: "none", name: "未所持" },
  { id: "SR", name: "SR" },
  { id: "SR_plus", name: "SR+" },
  { id: "SSR", name: "SSR" },
  { id: "SSR_plus", name: "SSR+" },
  { id: "UR", name: "UR" },
  { id: "UR_plus", name: "UR+" },
  { id: "LR", name: "LR" },
  { id: "LR_1", name: "LR+1" },
  { id: "LR_2", name: "LR+2" },
  { id: "LR_3", name: "LR+3" },
  { id: "LR_4", name: "LR+4" },
  { id: "LR_5", name: "LR+5" },
  { id: "LR_6", name: "LR+6" },
  { id: "LR_7", name: "LR+7" },
  { id: "LR_8", name: "LR+8" },
  { id: "LR_9", name: "LR+9" },
  { id: "LR_10", name: "LR+10" },
];

onAuthStateChanged(auth, async (user) => {
  if (user && user.uid === ADMIN_UID) {
    document.body.classList.remove("is-loading");
    await loadScheduleData();
    initScheduleEvents();
  } else {
    window.location.href = "index.html";
  }
});

// 🔄 1. ロード処理
async function loadScheduleData() {
  const user = auth.currentUser;
  const currentWorldId = sessionStorage.getItem("app_current_world_id");
  if (!user || !currentWorldId) return;
  try {
    if (!window.arcanaMaster || window.arcanaMaster.length === 0) {
      try {
        const arcanaRes = await fetch("assets/json/arcana-master.json");
        if (arcanaRes.ok) window.arcanaMaster = await arcanaRes.json();
      } catch (e) {
        console.error("🚨 アルカナマスタの通信エラー:", e);
      }
    }

    const [scheduleSnap, charSnap] = await Promise.all([
      getDoc(
        doc(
          db,
          "users",
          user.uid,
          "worlds",
          currentWorldId,
          "gachaSchedule",
          "status",
        ),
      ),
      getDoc(
        doc(
          db,
          "users",
          user.uid,
          "worlds",
          currentWorldId,
          "characterStatus",
          "status",
        ),
      ),
    ]);

    scheduleList = [];
    if (scheduleSnap.exists()) {
      const scheduleMap = scheduleSnap.data().scheduleMap || {};
      Object.keys(scheduleMap).forEach((charaId) => {
        scheduleList.push(scheduleMap[charaId]);
      });
    }

    userCharactersMap = {};
    if (charSnap.exists()) {
      const dataMap = charSnap.data().ownedMap || {};
      Object.keys(dataMap).forEach((charId) => {
        userCharactersMap[charId] = dataMap[charId].rarity || "未所持";
      });
    }

    renderScheduleTable();
  } catch (error) {
    console.error("🚨 ロード失敗:", error);
  }
}

// 🔄 2. 保存処理
async function saveScheduleData() {
  const user = auth.currentUser;
  const currentWorldId = sessionStorage.getItem("app_current_world_id");
  if (!user || !currentWorldId) return;
  try {
    const scheduleMap = {};
    scheduleList.forEach((item) => {
      if (item && item.charaId) {
        scheduleMap[String(item.charaId).trim()] = item;
      }
    });

    const statusDocRef = doc(
      db,
      "users",
      user.uid,
      "worlds",
      currentWorldId,
      "gachaSchedule",
      "status",
    );
    await setDoc(statusDocRef, {
      scheduleMap: scheduleMap,
      updatedAt: serverTimestamp(),
    });

    updateSummary();
  } catch (error) {
    console.error("🚨 保存失敗:", error);
    throw error;
  }
}

// 🧮 テーブルレンダリング（5つの進行ステータスごとにグループ化して描画）
function renderScheduleTable() {
  // 🛠️ HTML側の単一コンテナ（tbody）を取得
  const tbodyMain = document.getElementById("js-schedule-table-body-main");
  if (!tbodyMain) return;

  tbodyMain.innerHTML = "";

  const master = window.characterMaster || [];
  const arcanaMaster = window.arcanaMaster || [];
  const today = new Date("2026-11-08");

  // ① 5つの進行ステータスグループを定義
  const groups = [
    { id: "completed", name: "✅ ① 完了", items: [] },
    { id: "top_priority", name: "🔥 ② 最優先", items: [] },
    { id: "priority", name: "🔷 ③ 優先", items: [] },
    { id: "postponed", name: "💤 ④ 後回し", items: [] },
    { id: "temp_completed", name: "📦 ⑤ 仮完了", items: [] },
  ];

  // ② 現在のソート基準に従ってリスト全体をソート
  const sortSelect = document.querySelector(".js-select-sort");
  const criteria = sortSelect ? sortSelect.value : "days";
  sortScheduleList(criteria);

  // ③ ソート済みのデータを各進行ステータスグループに分配
  scheduleList.forEach((item) => {
    const targetGroup = groups.find((g) => g.id === item.status) || groups[2]; // 不正値は③優先へ
    targetGroup.items.push(item);
  });

  // ④ グループごとに行を組み立ててテーブルへ追加
  groups.forEach((group) => {
    // 🏢 グループのタイトル行（仕切り）を生成
    const groupHeaderTr = document.createElement("tr");
    groupHeaderTr.className = "p-schedule-table__row-group-title";
    groupHeaderTr.innerHTML = `<td colspan="15" class="p-schedule-table__group-title-cell">${group.name} (${group.items.length}体)</td>`;
    tbodyMain.appendChild(groupHeaderTr);

    // 🦊 グループに所属する魔女の行を順に生成
    group.items.forEach((item) => {
      // 元の scheduleList 内での正しいインデックスを取得（モーダル連動用）
      const originalIndex = scheduleList.findIndex(
        (s) => s.charaId === item.charaId,
      );

      const foundChara = master.find(
        (c) => String(c.id).trim() === String(item.charaId).trim(),
      );

      const isSpecialType =
        foundChara && (foundChara.attr === "天" || foundChara.attr === "冥");
      const defaultTargetSR = isSpecialType ? 14 : 8;
      const baseDiamondRate = isSpecialType ? 19000 : 18500;

      let matchedArcanaList = [];
      if (arcanaMaster.length > 0) {
        const targetCharaIdStr = String(item.charaId).trim();
        matchedArcanaList = arcanaMaster.filter((a) => {
          return (
            (a.charId1 && String(a.charId1).trim() === targetCharaIdStr) ||
            (a.charId2 && String(a.charId2).trim() === targetCharaIdStr) ||
            (a.charId3 && String(a.charId3).trim() === targetCharaIdStr) ||
            (a.charId4 && String(a.charId4).trim() === targetCharaIdStr)
          );
        });
      }

      const targetSR =
        item.targetSR !== undefined ? item.targetSR : defaultTargetSR;
      const currentSR = item.currentSR || 0;
      const giftSR = item.giftSR || 0;
      const diffSR = Math.max(0, targetSR - currentSR);
      const remainingDiamonds = diffSR * baseDiamondRate;

      const countUnmei = item.historyUnmeiCount || 0;
      const countMichi = item.historyMichiCount || 0;
      const countPickup = item.historyPickupCount || 0;
      const consumedDiamonds =
        countUnmei * 500 + countMichi * 500 + countPickup * 300;

      const pureGachaSR = currentSR - giftSR;
      const costPerBody =
        pureGachaSR > 0 ? Math.floor(consumedDiamonds / pureGachaSR) : 0;

      // 📅 毎日自動更新：今日の「午前0時0分0秒」を動的に取得して基準日にする
      const systemNow = new Date();
      const today = new Date(
        systemNow.getFullYear(),
        systemNow.getMonth(),
        systemNow.getDate(),
      );

      // キャラクターマスタからガチャ種別と終了日を安全に取得
      const gachaType =
        foundChara && foundChara.gachaType
          ? foundChara.gachaType
          : item.gachaType || "ガチャ";
      const endDateStr =
        foundChara && foundChara.gachaEndDate
          ? foundChara.gachaEndDate
          : item.lastEndDate;

      let scheduleHtml = "";

      if (endDateStr) {
        // ガチャ終了日の時分秒のズレを無くすため、こちらも日付のみでオブジェクト化
        const rawEndDate = new Date(endDateStr);
        const endDate = new Date(
          rawEndDate.getFullYear(),
          rawEndDate.getMonth(),
          rawEndDate.getDate(),
        );

        // ミリ秒の差分を日数（1日＝86,400,000ミリ秒）に変換して計算
        const diffTime = endDate - today;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0) {
          // 🔥 開催中の場合のみ、is-active-gacha（赤文字）を適用
          scheduleHtml = `
            <div class="p-schedule-table__gacha-info">
              <span class="c-badge-gacha-type">${gachaType}</span>
              <span class="p-schedule-table__days is-active-gacha">🔥 開催中 あと ${diffDays}日</span>
            </div>`;
        } else {
          // 💤 終了している場合は、通常色に固定
          const elapsedDays = Math.abs(diffDays);
          scheduleHtml = `
            <div class="p-schedule-table__gacha-info">
              <span class="c-badge-gacha-type c-badge-gacha-type--past">${gachaType}</span>
              <span class="p-schedule-table__days">${elapsedDays}日経過</span>
            </div>`;
        }
      } else {
        scheduleHtml = `<span style="color: var(--text-sub); font-style: italic;">スケジュール未定</span>`;
      }

      const scoresObj = item.scores || {
        quest: 1,
        battle: 1,
        guild: 1,
        arcana: 1,
        raid: 1,
      };
      const totalScore =
        (scoresObj.quest || 1) +
        (scoresObj.battle || 1) +
        (scoresObj.guild || 1) +
        (scoresObj.arcana || 1) +
        (scoresObj.raid || 1);

      const tr = document.createElement("tr");
      tr.className = "p-schedule-table__row p-schedule-table__row--body";

      // 👑 魔女アイコン列
      const charaCell = document.createElement("td");
      charaCell.className =
        "p-schedule-table__cell p-schedule-table__cell--center p-schedule-table__cell--common";

      const charaBox = document.createElement("div");
      charaBox.className = "p-schedule-table__chara-container";

      const charaBtn = document.createElement("button");
      charaBtn.type = "button";
      charaBtn.className =
        "p-schedule-table__chara-btn p-schedule-table__chara-btn--fixed-width";

      if (foundChara && window.createCharacterBadgeElement) {
        const displayRarity = item.currentRarity || "none";
        const badgeEl = window.createCharacterBadgeElement(
          foundChara,
          displayRarity,
        );

        if (displayRarity === "none" && badgeEl) {
          badgeEl.classList.remove("is-rarity-none");
          badgeEl.classList.add("is-not-owned");
        }
        charaBtn.appendChild(badgeEl);
      }
      charaBtn.addEventListener("click", () =>
        openScheduleModal(originalIndex),
      );
      charaBox.appendChild(charaBtn);
      charaCell.appendChild(charaBox);
      tr.appendChild(charaCell);

      // 👥 アルカナ構成列
      const arcanaCharsCell = document.createElement("td");
      arcanaCharsCell.className =
        "p-schedule-table__cell p-schedule-table__cell--evaluation";

      // 📜 アルカナ効果列
      const arcanaEffectCell = document.createElement("td");
      arcanaEffectCell.className =
        "p-schedule-table__cell p-schedule-table__cell--evaluation";

      if (matchedArcanaList.length > 0) {
        const targetCharaIdStr = String(item.charaId).trim();
        matchedArcanaList.forEach((arcana) => {
          const charaItemWrap = document.createElement("div");
          charaItemWrap.className = "p-schedule-table__arcana-item";

          const slotsContainer = document.createElement("div");
          slotsContainer.className = "slots js-schedule-slots-wrap";

          for (let i = 1; i <= 4; i++) {
            const cId = arcana[`charId${i}`];
            if (cId && String(cId).trim() !== targetCharaIdStr) {
              slotsContainer.appendChild(createSlotElement(arcana, i, master));
            }
          }
          charaItemWrap.appendChild(slotsContainer);
          arcanaCharsCell.appendChild(charaItemWrap);

          const effectItemWrap = document.createElement("div");
          effectItemWrap.className = "p-schedule-table__arcana-effect-item";
          effectItemWrap.textContent = formatEffectsText(arcana.effectsList);
          arcanaEffectCell.appendChild(effectItemWrap);
        });
      } else {
        const charaItemWrap = document.createElement("div");
        charaItemWrap.className = "p-schedule-table__arcana-item";
        charaItemWrap.innerHTML =
          '<div class="slots js-schedule-slots-wrap"><span class="p-schedule-table__arcana-empty">-</span></div>';
        arcanaCharsCell.appendChild(charaItemWrap);

        const effectItemWrap = document.createElement("div");
        effectItemWrap.className = "p-schedule-table__arcana-effect-item";
        effectItemWrap.innerHTML =
          '<span style="color: var(--text-muted); font-style: italic;">なし</span>';
        arcanaEffectCell.appendChild(effectItemWrap);
      }

      tr.appendChild(arcanaCharsCell);
      tr.appendChild(arcanaEffectCell);

      // 主な用途列
      const usageCell = document.createElement("td");
      usageCell.className =
        "p-schedule-table__cell p-schedule-table__cell--evaluation";
      usageCell.innerHTML = `<div>${item.usage || "未入力"}</div>`;
      tr.appendChild(usageCell);

      ["quest", "battle", "guild", "arcana", "raid"].forEach((key) => {
        const td = document.createElement("td");
        td.className =
          "p-schedule-table__cell p-schedule-table__cell--center p-schedule-table__cell--evaluation";
        td.innerHTML = `<span class="p-schedule-table__score-num">${scoresObj[key] || 1}</span>`;
        tr.appendChild(td);
      });

      const scoreCell = document.createElement("td");
      scoreCell.className =
        "p-schedule-table__cell p-schedule-table__cell--center p-schedule-table__cell--evaluation";
      scoreCell.innerHTML = `<span class="p-schedule-table__total-score">${totalScore}</span>`;
      tr.appendChild(scoreCell);

      const scheduleCell = document.createElement("td");
      scheduleCell.className =
        "p-schedule-table__cell p-schedule-table__cell--gacha";
      scheduleCell.innerHTML = scheduleHtml;
      tr.appendChild(scheduleCell);

      const countCell = document.createElement("td");
      countCell.className =
        "p-schedule-table__cell p-schedule-table__cell--center p-schedule-table__cell--gacha";
      countCell.innerHTML = `<span class="p-schedule-table__cost-value">あと ${diffSR} 体</span>`;
      tr.appendChild(countCell);

      const costCell = document.createElement("td");
      costCell.className =
        "p-schedule-table__cell p-schedule-table__cell--gacha";
      costCell.innerHTML = `<div class="p-schedule-table__cost-flex"><span class="p-schedule-table__cost-value p-schedule-table__cost-value--alert">${remainingDiamonds.toLocaleString()}</span></div>`;
      tr.appendChild(costCell);

      const totalCostCell = document.createElement("td");
      totalCostCell.className =
        "p-schedule-table__cell p-schedule-table__cell--gacha";
      totalCostCell.innerHTML = `<div class="p-schedule-table__cost-flex"><span class="p-schedule-table__cost-value">${consumedDiamonds.toLocaleString()}</span></div>`;
      tr.appendChild(totalCostCell);

      const unitCostCell = document.createElement("td");
      unitCostCell.className =
        "p-schedule-table__cell p-schedule-table__cell--gacha";
      unitCostCell.innerHTML = `<div class="p-schedule-table__cost-flex"><span class="p-schedule-table__cost-value" style="color: #475569;">${costPerBody.toLocaleString()}</span></div>`;
      tr.appendChild(unitCostCell);

      // 📈 【統計的リニューアル】スパークライン効率インジケーター列
      const sparklineCell = document.createElement("td");
      sparklineCell.className =
        "p-schedule-table__cell p-schedule-table__cell--gacha";

      if (pureGachaSR > 0) {
        // ① 1体あたりの実際の消費ダイヤを算出
        const actualCostPerBody = consumedDiamonds / pureGachaSR;

        // ② 基準となる期待値と最大値の定義
        const baseExpect = isSpecialType ? 19000 : 18500;
        const maxLimit = 35000; // ユーザー指定の最大上限値

        // ③ メーターの長さ（パーセンテージ）を単純割合で計算（上限100%ガード）
        let displayPercentage = (actualCostPerBody / maxLimit) * 100;
        displayPercentage = Math.max(5, Math.min(100, displayPercentage));

        // ④ 期待値（センターライン）の表示位置を動的に計算
        const centerLinePosition = (baseExpect / maxLimit) * 100;

        // ⑤ 期待値（分岐点）と、どれだけ離れているかでヒートマップの色（クラス）を5段階判定
        let luckClass = "is-normal-luck";
        let luckTitle = "";

        // 期待値からの差額を計算
        const diffFromExpect = actualCostPerBody - baseExpect;

        if (diffFromExpect <= -5000) {
          luckClass = "is-super-good-luck"; // 期待値より5000ダイヤ以上安い（濃い青）
          luckTitle = `超神引き！(期待値より大幅に安上がり) [1体あたり平均: ${Math.round(actualCostPerBody).toLocaleString()}ダイヤ]`;
        } else if (diffFromExpect < -1000) {
          luckClass = "is-good-luck"; // 期待値より1000〜5000ダイヤ安い（薄い青）
          luckTitle = `微良引き (平均よりやや低コスト) [1体あたり平均: ${Math.round(actualCostPerBody).toLocaleString()}ダイヤ]`;
        } else if (diffFromExpect >= 8000) {
          luckClass = "is-super-bad-luck"; // 期待値より8000ダイヤ以上高い（濃い赤：30000ダイヤ前後〜大爆死）
          luckTitle = `大爆死中…(深刻な沼状態) [1体あたり平均: ${Math.round(actualCostPerBody).toLocaleString()}ダイヤ]`;
        } else if (diffFromExpect >= 1500) {
          luckClass = "is-bad-luck"; // 期待値より1500〜8000ダイヤ高い（薄い赤）
          luckTitle = `微沼気味 (平均よりやや高コスト) [1体あたり平均: ${Math.round(actualCostPerBody).toLocaleString()}ダイヤ]`;
        } else {
          luckClass = "is-normal-luck"; // 期待値のほぼジャスト圏内（グレー）
          luckTitle = `期待値通り (標準的な引き) [1体あたり平均: ${Math.round(actualCostPerBody).toLocaleString()}ダイヤ]`;
        }

        sparklineCell.innerHTML = `
          <div class="p-schedule-sparkline" title="${luckTitle}">
            <div class="p-schedule-sparkline__bar ${luckClass}" style="width: ${displayPercentage}%"></div>
            <!-- 👇 属性（4属性 or 天冥）に合わせて期待値の縦線を動的に配置 -->
            <div class="p-schedule-sparkline__center-line" style="left: ${centerLinePosition}%"></div>
          </div>
        `;
      } else {
        sparklineCell.innerHTML = `<span style="color: var(--text-muted); font-style: italic;">-</span>`;
      }

      tr.appendChild(sparklineCell);

      tbodyMain.appendChild(tr);
    });
  });

  updateSummary();
}

// 🛠️ スロット用DOM要素を作成するヘルパー
function createSlotElement(ar, idx, charMaster) {
  const cId = ar[`charId${idx}`];
  if (!cId) {
    const emptySlot = document.createElement("div");
    emptySlot.className = "slot slot--hide";
    emptySlot.textContent = "-";
    return emptySlot;
  }
  if (cId === "未定") {
    const tbdSlot = document.createElement("div");
    tbdSlot.className = "slot";
    tbdSlot.style.cssText =
      "font-size: 10px; color: var(--text-sub); font-weight: bold; background: var(--input-bg-sub); border: 1px dashed var(--border-light);";
    tbdSlot.textContent = "未定";
    return tbdSlot;
  }

  const foundChar = charMaster.find(
    (ch) => String(ch.id).trim() === String(cId).trim(),
  );
  if (!foundChar) {
    const fallbackSlot = document.createElement("div");
    fallbackSlot.className = "slot slot__id-fallback";
    fallbackSlot.textContent = cId;
    return fallbackSlot;
  }

  const currentRarity = userCharactersMap[foundChar.id] || "未所持";
  let rarityClassName =
    currentRarity === "未所持"
      ? "is-not-owned"
      : `rarity--${String(currentRarity).toLowerCase().replace("+", "-plus")}`;

  const slotDiv = document.createElement("div");
  slotDiv.className = `slot ${rarityClassName}`;
  slotDiv.title = `${foundChar.name} (${currentRarity})`;

  let starsHtml = "";
  let plusHtml = "";

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
    if (plusImgEl && plusImgEl.classList.contains("is-active"))
      plusHtml = plusImgEl.innerHTML;
  }

  slotDiv.innerHTML = `
        <img src="${foundChar.iconUrl}" alt="${foundChar.name}">
        <div class="slot__border"></div>
        <div class="slot__stars">${starsHtml}</div>
        <div class="slot__plus">${plusHtml}</div>
      `;
  return slotDiv;
}

// 📝 アルカナ効果テキストフォーマッター
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

// 🛠️ 画面全体の操作イベント初期化
function initScheduleEvents() {
  const addBtn = document.querySelector(".js-btn-add-chara");
  if (addBtn) {
    addBtn.className =
      "p-schedule__btn p-schedule__btn--add js-open-character-picker";
    addBtn.dataset.targetInput = "js-hidden-chara-picker-trigger";
  }

  const sortSelect = document.querySelector(".js-select-sort");
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      sortScheduleList(sortSelect.value);
      renderScheduleTable();
    });
  }

  document.querySelectorAll(".js-mode-trigger").forEach((trigger) => {
    trigger.addEventListener("change", (e) => {
      const container = document.querySelector(".js-table-container");
      if (!container) return;
      container.className = `p-schedule__table-wrapper js-table-container is-mode-${e.target.value}`;
    });
  });

  const updateBtn = document.getElementById("js-schedule-btn-update");
  if (updateBtn) {
    updateBtn.addEventListener("click", async () => {
      try {
        updateBtn.disabled = true;
        await saveScheduleData();
        alert("投資計画の変更内容を保存しました！");
      } catch (error) {
        alert("保存に失敗しました。通信環境を確認してください。");
      } finally {
        updateBtn.disabled = false;
      }
    });
  }

  if (!document.getElementById("js-hidden-chara-picker-trigger")) {
    const hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.id = "js-hidden-chara-picker-trigger";
    document.body.appendChild(hiddenInput);

    hiddenInput.addEventListener("change", (e) => {
      const selectedId = e.target.value;
      if (!selectedId) return;

      const master = window.characterMaster || [];
      const foundChara = master.find(
        (c) => String(c.id) === String(selectedId),
      );
      if (!foundChara) return;

      if (
        scheduleList.some((item) => String(item.charaId) === String(selectedId))
      ) {
        alert("その魔女はすでに投資計画リストに含まれています。");
        return;
      }

      const isSpecialType =
        foundChara && (foundChara.attr === "天" || foundChara.attr === "冥");
      const initialTargetSR = isSpecialType ? 14 : 8;

      scheduleList.push({
        charaId: foundChara.id,
        charaName: foundChara.name,
        status: "planning",
        sortOrder: scheduleList.length,
        usage: "バトリ用",
        scores: { quest: 1, battle: 1, guild: 1, arcana: 1, raid: 1 },
        targetSR: initialTargetSR,
        currentSR: 0,
        giftSR: 0,
        currentRarity: "none",
        historyUnmeiCount: 0,
        historyMichiCount: 0,
        historyPickupCount: 0,
        lastEndDate: "2026-11-08",
      });
      renderScheduleTable();

      // 🛠️ 【修正】魔女を追加した際、即座にその魔女の詳細モーダルをオープン
      openScheduleModal(scheduleList.length - 1);

      hiddenInput.value = "";
    });
  }
  // 💎 初期表示を「キャラガチャ」モードに強制設定する
  const defaultRadio = document.querySelector(
    '.js-mode-trigger[value="gacha"]',
  );
  if (defaultRadio) {
    defaultRadio.checked = true; // ラジオボタンのチェックをガチャに変更
    defaultRadio.dispatchEvent(new Event("change")); // 変更イベントを発火させてテーブル表示をガチャに切り替える
  }
}

// 📋 詳細モーダル動的生成
function openScheduleModal(index) {
  activeEditIndex = index;
  const item = scheduleList[index];
  const container = document.getElementById("js-schedule-modal-container");
  if (!container) return;

  document.body.classList.add("is-modal-open");

  const currentMode =
    document.querySelector(".js-mode-trigger:checked")?.value || "gacha";

  let scoreOptionsHtml = "";
  for (let v = 1; v <= 5; v++) {
    scoreOptionsHtml += `<option value="${v}">${v}</option>`;
  }

  const master = window.characterMaster || [];
  const foundChara = master.find((c) => String(c.id) === String(item.charaId));

  const isSpecialType =
    foundChara && (foundChara.attr === "天" || foundChara.attr === "冥");
  const defaultTargetSR = isSpecialType ? 14 : 8;
  const displayTargetSR =
    item.targetSR !== undefined ? item.targetSR : defaultTargetSR;

  // 1. 先に innerHTML でベースHTML構造を完全に確定させる
  container.innerHTML = `
    <div id="js-schedule-modal" class="p-schedule-modal is-active">
      <div class="p-schedule-modal__overlay js-close-modal"></div>
      <div class="p-schedule-modal__content">
        <div class="p-schedule-modal__header">
          <div class="p-schedule-modal__title-wrap">
            <span class="js-modal-chara-badge-anchor p-schedule-modal__badge-box"></span>
            <h3 class="p-schedule-modal__title">${item.charaName} の計画編集</h3>
          </div>
          <button type="button" class="p-schedule-modal__close-btn js-close-modal"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="p-schedule-modal__tabs">
          <button type="button" class="p-schedule-modal__tab-btn js-modal-tab-trigger ${currentMode === "gacha" ? "is-active" : ""}" data-tab="gacha">💎 キャラガチャ</button>
          <button type="button" class="p-schedule-modal__tab-btn js-modal-tab-trigger ${currentMode === "evaluation" ? "is-active" : ""}" data-tab="evaluation">⚔️ キャラ評価</button>
        </div>
        <div class="p-schedule-modal__body">
          <div class="p-schedule-modal__group">
            <div class="p-schedule-modal__group-title">■ 共通設定</div>
            <div class="p-schedule-modal__field">
              <label class="p-schedule-modal__label">進行ステータス</label>
              <select id="js-modal-status-select" class="p-schedule-modal__input">
                <option value="completed" ${item.status === "completed" ? "selected" : ""}>✅ ① 完了</option>
                <option value="top_priority" ${item.status === "top_priority" ? "selected" : ""}>🔥 ② 最優先</option>
                <option value="priority" ${item.status === "priority" ? "selected" : ""}>🔷 ③ 優先</option>
                <option value="postponed" ${item.status === "postponed" ? "selected" : ""}>💤 ④ 後回し</option>
                <option value="temp_completed" ${item.status === "temp_completed" ? "selected" : ""}>📦 ⑤ 仮完了</option>
              </select>
            </div>
          </div>

          
          <div id="js-modal-tab-evaluation" class="p-schedule-modal__tab-content ${currentMode === "evaluation" ? "is-active" : ""}">
            <div class="p-schedule-modal__group">
              <div class="p-schedule-modal__field"><label class="p-schedule-modal__label">主な用途</label><input type="text" id="js-modal-usage" class="p-schedule-modal__input" value="${item.usage || ""}"></div>
              <div class="p-schedule-modal__grid-scores">
                ${["quest", "battle", "guild", "arcana", "raid"]
                  .map((k) => {
                    const label =
                      k === "quest"
                        ? "攻略"
                        : k === "battle"
                          ? "バトリ"
                          : k === "guild"
                            ? "ギルバト"
                            : k === "arcana"
                              ? "アルカナ"
                              : "レイド";
                    const currentVal = item.scores?.[k] || 1;
                    const selectedOptions = scoreOptionsHtml.replace(
                      `value="${currentVal}"`,
                      `value="${currentVal}" selected`,
                    );
                    return `<div class="p-schedule-modal__score-field"><span class="p-schedule-modal__score-label">${label}</span><select class="p-schedule-modal__select-num js-modal-score" data-key="${k}">${selectedOptions}</select></div>`;
                  })
                  .join("")}
              </div>
            </div>
          </div>
          
          <div id="js-modal-tab-gacha" class="p-schedule-modal__tab-content ${currentMode === "gacha" ? "is-active" : ""}">
            <div class="p-schedule-modal__top-summary-box">
              <div class="p-schedule-modal__summary-row"><span>あと何体:</span><span id="js-modal-preview-diff" class="p-schedule-modal__summary-val">-</span></div>
              <div class="p-schedule-modal__summary-row"><span>あとダイヤいくつ:</span><span id="js-modal-preview-diamonds" class="p-schedule-modal__summary-val p-schedule-modal__summary-val--alert">-</span></div>
              <div class="p-schedule-modal__summary-row p-schedule-modal__summary-row--dashed"><span>累計コスト（履歴合計）:</span><span id="js-modal-preview-consumed" class="p-schedule-modal__summary-val">-</span></div>
            </div>
            <div class="p-schedule-modal__group">
              <div class="p-schedule-modal__group-title">🎯 [目標] エリア</div>
              <div class="p-schedule-modal__field"><label class="p-schedule-modal__label">目標SR数 ${isSpecialType ? "(天冥: 14体推奨)" : "(4属性: 8体推奨)"}</label><input type="number" id="js-modal-target-sr" class="p-schedule-modal__input js-modal-calc-trigger" value="${displayTargetSR}" min="0"></div>
            </div>
            <div class="p-schedule-modal__group">
              <div class="p-schedule-modal__group-title">📈 [経過] エリア</div>
              <div class="p-schedule-modal__field p-schedule-modal__field--rarity-margin">
                <label class="p-schedule-modal__label">現在のレアリティ</label>
                <select id="js-modal-current-rarity" class="p-schedule-modal__input p-schedule-modal__select-rarity">
                  ${RARITY_MASTER.map((r) => `<option value="${r.id}" ${(item.currentRarity || "none") === r.id ? "selected" : ""}>${r.name}</option>`).join("")}
                </select>
              </div>
              <div class="p-schedule-modal__field"><label class="p-schedule-modal__label">現在の獲得数 (体)</label><input type="number" id="js-modal-current-sr" class="p-schedule-modal__input js-modal-calc-trigger" value="${item.currentSR || 0}" min="0"></div>
              <div class="p-schedule-modal__field"><label class="p-schedule-modal__label">（うち）贈り物での獲得数 (体)</label><input type="number" id="js-modal-gift-sr" class="p-schedule-modal__input" value="${item.giftSR || 0}" min="0"></div>
            </div>
            <div class="p-schedule-modal__group">
              <div class="p-schedule-modal__group-title">📜 [ガチャ履歴] エリア</div>
              ${[
                ["unmei", "運命ガチャ回数 (回)", 500],
                ["michi", "導きガチャ回数 (回)", 500],
                ["pickup", "ピックアップガチャ回数 (回)", 300],
              ]
                .map(
                  ([k, label, rate]) => `
                <div class="p-schedule-modal__field">
                  <label class="p-schedule-modal__label">${label}</label>
                  <div class="p-schedule-modal__history-row-flex">
                    <input type="number" id="js-modal-history-${k}-count" class="p-schedule-modal__input js-modal-calc-trigger p-schedule-modal__input--flex-fill" value="${item[`history${k.charAt(0).toUpperCase() + k.slice(1)}Count`] || 0}" min="0">
                    <span class="p-schedule-modal__multiplier-label">× ${rate} ＝</span>
                    <span id="js-modal-subtotal-${k}" class="p-schedule-modal__subtotal-output">0</span>
                  </div>
                </div>
              `,
                )
                .join("")}
              <div class="p-schedule-modal__history-total-wrapper">
                <span>履歴小計合計:</span><span id="js-modal-history-total" class="p-schedule-modal__total-output">0 ダイヤ</span>
              </div>
            </div>
          </div>
        </div>
        <div class="p-schedule-modal__footer"><button type="button" class="p-schedule-modal__delete-btn id-btn-delete-record"><i class="fa-solid fa-trash-can"></i> 計画リストからこの魔女を削除する</button></div>
      </div>
    </div>
  `;

  // 2. HTML確定後に、生成されたアンカーを狙ってバッジDOMを安全に注入（これで画像が消えません）
  const anchor = container.querySelector(".js-modal-chara-badge-anchor");
  if (foundChara && anchor && window.createCharacterBadgeElement) {
    let displayRarity =
      item.status === "completed" ? "LR" : item.currentRarity || "none";
    // アプリ全体の命名規則（ハイフン/アンダースコア）のズレを吸収
    displayRarity = displayRarity.replace("_plus", "+");

    anchor.appendChild(
      window.createCharacterBadgeElement(foundChara, displayRarity),
    );
  }
  container.dataset.charaIdAttr = item.charaId;
  bindModalEvents(container, item);
}

function bindModalEvents(container, item) {
  calculateModalPreview();
  container
    .querySelectorAll(".js-close-modal")
    .forEach((el) => el.addEventListener("click", closeModalAndSave));
  container.querySelectorAll(".js-modal-tab-trigger").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      container
        .querySelectorAll(".js-modal-tab-trigger")
        .forEach((b) => b.classList.remove("is-active"));
      container
        .querySelectorAll(".p-schedule-modal__tab-content")
        .forEach((tc) => tc.classList.remove("is-active"));
      e.target.classList.add("is-active");
      document
        .getElementById(`js-modal-tab-${e.target.dataset.tab}`)
        ?.classList.add("is-active");
    });
  });
  container
    .querySelectorAll(".js-modal-calc-trigger")
    .forEach((input) => input.addEventListener("input", calculateModalPreview));

  container
    .querySelector(".id-btn-delete-record")
    .addEventListener("click", async () => {
      if (confirm(`計画から ${item.charaName} を抹消しますか？`)) {
        try {
          scheduleList.splice(activeEditIndex, 1);
          await saveScheduleData();
          document
            .getElementById("js-schedule-modal")
            ?.classList.remove("is-active");

          // 🛠️ 【追加】削除によるクローズ時も body の状態クラスを削除
          document.body.classList.remove("is-modal-open");

          activeEditIndex = null;
          renderScheduleTable();
        } catch (e) {
          console.error("🚨 削除＆保存失敗:", e);
          alert("削除データの保存に失敗しました。");
        }
      }
    });
}

function calculateModalPreview() {
  const targetSR = Number(
    document.getElementById("js-modal-target-sr")?.value || 0,
  );
  const currentSR = Number(
    document.getElementById("js-modal-current-sr")?.value || 0,
  );
  const countUnmei = Number(
    document.getElementById("js-modal-history-unmei-count")?.value || 0,
  );
  const countMichi = Number(
    document.getElementById("js-modal-history-michi-count")?.value || 0,
  );
  const countPickup = Number(
    document.getElementById("js-modal-history-pickup-count")?.value || 0,
  );

  const container = document.getElementById("js-schedule-modal-container");
  const master = window.characterMaster || [];
  const foundChara = master.find(
    (c) =>
      String(c.id) === String(container ? container.dataset.charaIdAttr : ""),
  );

  const isSpecialType =
    foundChara && (foundChara.attr === "天" || foundChara.attr === "冥");
  const baseDiamondRate = isSpecialType ? 19000 : 18500;

  const diffSR = Math.max(0, targetSR - currentSR);
  const remainingDiamonds = diffSR * baseDiamondRate;

  const subtotalUnmei = countUnmei * 500;
  const subtotalMichi = countMichi * 500;
  const subtotalPickup = countPickup * 300;
  const consumedDiamonds = subtotalUnmei + subtotalMichi + subtotalPickup;

  document.getElementById("js-modal-preview-diff") &&
    (document.getElementById("js-modal-preview-diff").textContent =
      `あと ${diffSR} 体`);
  document.getElementById("js-modal-preview-diamonds") &&
    (document.getElementById("js-modal-preview-diamonds").textContent =
      `${remainingDiamonds.toLocaleString()} ダイヤ`);
  document.getElementById("js-modal-preview-consumed") &&
    (document.getElementById("js-modal-preview-consumed").textContent =
      `${consumedDiamonds.toLocaleString()} ダイヤ`);
  document.getElementById("js-modal-subtotal-unmei") &&
    (document.getElementById("js-modal-subtotal-unmei").textContent =
      subtotalUnmei.toLocaleString());
  document.getElementById("js-modal-subtotal-michi") &&
    (document.getElementById("js-modal-subtotal-michi").textContent =
      subtotalMichi.toLocaleString());
  document.getElementById("js-modal-subtotal-pickup") &&
    (document.getElementById("js-modal-subtotal-pickup").textContent =
      subtotalPickup.toLocaleString());
  document.getElementById("js-modal-history-total") &&
    (document.getElementById("js-modal-history-total").textContent =
      `${consumedDiamonds.toLocaleString()} ダイヤ`);
}

function closeModalAndSave() {
  if (activeEditIndex === null) return;
  const item = scheduleList[activeEditIndex];
  const container = document.getElementById("js-schedule-modal-container");
  if (!container) return;

  const statusSelect = document.getElementById("js-modal-status-select");
  if (statusSelect) item.status = statusSelect.value;

  item.usage = document.getElementById("js-modal-usage")?.value || "";

  container.querySelectorAll(".js-modal-score").forEach((select) => {
    if (!item.scores) item.scores = {};
    item.scores[select.dataset.key] = Number(select.value);
  });

  item.targetSR = Number(
    document.getElementById("js-modal-target-sr")?.value || 0,
  );
  item.currentSR = Number(
    document.getElementById("js-modal-current-sr")?.value || 0,
  );
  item.giftSR = Number(document.getElementById("js-modal-gift-sr")?.value || 0);
  item.currentRarity =
    document.getElementById("js-modal-current-rarity")?.value || "none";
  item.historyUnmeiCount = Number(
    document.getElementById("js-modal-history-unmei-count")?.value || 0,
  );
  item.historyMichiCount = Number(
    document.getElementById("js-modal-history-michi-count")?.value || 0,
  );
  item.historyPickupCount = Number(
    document.getElementById("js-modal-history-pickup-count")?.value || 0,
  );

  document.getElementById("js-schedule-modal")?.classList.remove("is-active");

  // 🛠️ 【追加】モーダルが閉じるため body の状態クラスを削除
  document.body.classList.remove("is-modal-open");

  activeEditIndex = null;
  renderScheduleTable();
}

function updateSummary() {
  // 🛠️ 【修正】「①完了」のみを完了済数としてカウント
  const completedCount = scheduleList.filter(
    (i) => i.status === "completed",
  ).length;

  // 🛠️ 【修正】「⑤仮完了」を含む、完了以外をすべて計画中数としてカウント
  const planningCount = scheduleList.filter(
    (i) => i.status !== "completed",
  ).length;

  let totalRemainingDiamonds = 0,
    totalConsumedDiamonds = 0;
  const master = window.characterMaster || [];

  scheduleList.forEach((item) => {
    totalConsumedDiamonds +=
      (item.historyUnmeiCount || 0) * 500 +
      (item.historyMichiCount || 0) * 500 +
      (item.historyPickupCount || 0) * 300;

    // 🛠️ 【修正】「①完了」以外の魔女（仮完了も含む）に対して、必要ダイヤの目安を算出
    if (item.status !== "completed") {
      const foundChara = master.find(
        (c) => String(c.id) === String(item.charaId),
      );
      const isSpecialType =
        foundChara && (foundChara.attr === "天" || foundChara.attr === "冥");
      const diffSR = Math.max(
        0,
        (item.targetSR !== undefined ? item.targetSR : isSpecialType ? 14 : 8) -
          (item.currentSR || 0),
      );
      totalRemainingDiamonds += diffSR * (isSpecialType ? 19000 : 18500);
    }
  });

  document.querySelector(".js-summary-completed-count") &&
    (document.querySelector(".js-summary-completed-count").innerHTML =
      `${completedCount} <small>体</small>`);
  document.querySelector(".js-summary-consumed-diamonds") &&
    (document.querySelector(".js-summary-consumed-diamonds").textContent =
      totalConsumedDiamonds.toLocaleString());
  document.querySelector(".js-summary-planning-count") &&
    (document.querySelector(".js-summary-planning-count").innerHTML =
      `${planningCount} <small>体</small>`);
  document.querySelector(".js-summary-total-diamonds") &&
    (document.querySelector(".js-summary-total-diamonds").textContent =
      totalRemainingDiamonds.toLocaleString());
}

function sortScheduleList(criteria) {
  if (criteria === "priority") {
    scheduleList.sort((a, b) => {
      const sA = a.scores || {
        quest: 1,
        battle: 1,
        guild: 1,
        arcana: 1,
        raid: 1,
      };
      const sB = b.scores || {
        quest: 1,
        battle: 1,
        guild: 1,
        arcana: 1,
        raid: 1,
      };
      return (
        (sB.quest || 1) +
        (sB.battle || 1) +
        (sB.guild || 1) +
        (sB.arcana || 1) +
        (sB.raid || 1) -
        ((sA.quest || 1) +
          (sA.battle || 1) +
          (sA.guild || 1) +
          (sA.arcana || 1) +
          (sA.raid || 1))
      );
    });
  } else if (criteria === "days") {
    // 📅 経過日数順（開催中を上へ、終了済は経過日数が大きい順）
    const master = window.characterMaster || [];
    const systemNow = new Date();
    const today = new Date(
      systemNow.getFullYear(),
      systemNow.getMonth(),
      systemNow.getDate(),
    );

    scheduleList.sort((a, b) => {
      // 1. 各魔女のマスタデータから終了日（endDate）を取得
      const charA = master.find(
        (c) => String(c.id).trim() === String(a.charaId).trim(),
      );
      const charB = master.find(
        (c) => String(c.id).trim() === String(b.charaId).trim(),
      );

      const dateStrA =
        charA && charA.gachaEndDate ? charA.gachaEndDate : a.lastEndDate;
      const dateStrB =
        charB && charB.gachaEndDate ? charB.gachaEndDate : b.lastEndDate;

      // 終了日がないものは最下位へフォールバック
      if (!dateStrA) return 1;
      if (!dateStrB) return -1;

      const dateA = new Date(dateStrA);
      const dateB = new Date(dateStrB);

      // 今日を基準とした残り日数（diffDays）を算出
      const diffA = Math.round(
        (new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate()) -
          today) /
          (1000 * 60 * 60 * 24),
      );
      const diffB = Math.round(
        (new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate()) -
          today) /
          (1000 * 60 * 60 * 24),
      );

      const isLiveA = diffA >= 0;
      const isLiveB = diffB >= 0;

      // 2. ソート順の判定フラグ
      if (isLiveA && !isLiveB) return -1; // Aが開催中、Bが終了済なら Aを上にする
      if (!isLiveA && isLiveB) return 1; // Bが開催中、Aが終了済なら Bを上にする

      if (isLiveA && isLiveB) {
        // 両方「開催中」なら、終了が迫っている（残り日数が少ない）順
        return diffA - diffB;
      } else {
        // 両方「終了済」なら、過去の終了日が古い（経過日数が大きい）順
        return diffA - diffB; // diffはマイナス値なので、値が小さい（＝より過去）方が上になる
      }
    });
  }
}

// ==========================================
// 🚀 トップへ戻るボタン
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const scrollToTopBtn = document.getElementById("scrollToTopBtn");
  if (!scrollToTopBtn) return;

  let lastScrollY = window.scrollY;

  window.addEventListener("scroll", () => {
    const currentScrollY = window.scrollY;
    if (currentScrollY < 300) {
      scrollToTopBtn.classList.remove("is-show");
    } else if (currentScrollY < lastScrollY) {
      scrollToTopBtn.classList.add("is-show");
    } else {
      scrollToTopBtn.classList.remove("is-show");
    }
    lastScrollY = currentScrollY;
  });

  scrollToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});
