/**
 * =========================================================================
 * 🌐 メメモリポータル：ワールド×キャラクター管理（BEM・静的画像フィルター完全連動版）
 * =========================================================================
 */

// 状態管理変数
let characterMasterList = [];
let userOwnedData = {}; // 現在のワールドにおけるユーザーの所持・レアリティ状況
let activeFilterAttr = "ALL";
let activeFilterType = "ALL";
let currentModalCharData = null; // 現在モーダルで表示しているキャラの生データ
let currentWeaponMode = "mika"; // 初期選択をミカエル(mika)に設定

// レアリティの選択肢（未所持〜LR10、R/R+は除外）
const RARITY_OPTIONS = [
  "未所持",
  "SR",
  "SR+",
  "SSR",
  "SSR+",
  "UR",
  "UR+",
  "LR",
  "LR+1",
  "LR+2",
  "LR+3",
  "LR+4",
  "LR+5",
  "LR+6",
  "LR+7",
  "LR+8",
  "LR+9",
  "LR+10",
];

// Firebaseの各SDK関数および参照を保持する安全なスコープ変数
let _db, _uid, _worldId;
let _collection, _doc, _getDocs, _setDoc, _serverTimestamp;

/**
 * 1. メインインフラ（main.js）のロード完了後に直接呼び出される初期化関数
 * 🛠️ 修正：Firebaseモジュール関数をmain.jsのインポート環境から100%安全に引き継ぎます
 */
// --- character.js 修正後 ---
window.initUserCharacterTab = async function (
  masterData,
  db,
  auth,
  uid,
  worldId,
  // ★ main.jsから渡されたFirebase関数をここで受け取る
  fbCollection,
  fbGetDocs,
  fbDoc,
  fbSetDoc,
  fbServerTimestamp,
) {
  console.log("👥 [CharacterTab] 起動トリガーを検知しました。");

  // インフラ参照を保存
  _db = db;
  _uid = uid;
  _worldId = worldId;

  // ★ 渡された関数を優先的に代入し、なければ従来のフォールバックを行う
  _collection =
    fbCollection ||
    window.collection ||
    (window.FirebaseBundle ? window.FirebaseBundle.collection : null);
  _getDocs =
    fbGetDocs ||
    window.getDocs ||
    (window.FirebaseBundle ? window.FirebaseBundle.getDocs : null);
  _doc =
    fbDoc ||
    window.doc ||
    (window.FirebaseBundle ? window.FirebaseBundle.doc : null);
  _setDoc =
    fbSetDoc ||
    window.setDoc ||
    (window.FirebaseBundle ? window.FirebaseBundle.setDoc : null);
  _serverTimestamp =
    fbServerTimestamp ||
    window.serverTimestamp ||
    (window.FirebaseBundle ? window.FirebaseBundle.serverTimestamp : null);

  // マスタデータを確実に格納
  if (masterData && masterData.length > 0) {
    characterMasterList = masterData;
  } else if (window.characterMaster && window.characterMaster.length > 0) {
    characterMasterList = window.characterMaster;
  } else {
    console.warn("⚠️ マスタデータが空のため、100ms後に再実行します。");
    setTimeout(
      () => window.initUserCharacterTab(masterData, db, auth, uid, worldId),
      100,
    );
    return;
  }

  // ① 静的HTML画像フィルターのイベント登録
  bindUserFilterEvents();

  // ② クラウドからセーブデータを同期ロードして一覧を生成
  await loadAndRenderCharacterGrid();

  // ③ 性能確認モーダルの開閉・タブ切り替えイベントを登録
  setupUserModalEvents();

  // 画面下の「更新する」ボタンに一括保存イベントをバインドします
  const charUpdateBtn = document.getElementById("js-character-btn-update");
  if (charUpdateBtn) {
    charUpdateBtn.onclick = async () => {
      await saveAllCharacterRarityData();
    };
  }
};

/**
 * 2. Firestoreから所持状況を同期ロード
 * 🛠️ 修正：関数存在チェックを追加し、TypeErrorを完璧に防ぎます
 */
async function loadAndRenderCharacterGrid() {
  const gridEl = document.getElementById("userCharGrid");
  if (!gridEl) return;

  gridEl.innerHTML =
    '<div class="character-grid__loading">データ通信中...</div>';

  if (!_worldId) {
    gridEl.innerHTML =
      '<div class="character-grid__loading">ヘッダーからワールドを選択すると魔女一覧が表示されます。</div>';
    return;
  }

  // インフラ関数が準備できているか安全チェック
  if (!_collection || !_getDocs) {
    if (window.FirebaseMeme) {
      _collection = window.FirebaseMeme.collection;
      _getDocs = window.FirebaseMeme.getDocs;
      _doc = window.FirebaseMeme.doc;
      _setDoc = window.FirebaseMeme.setDoc;
      _serverTimestamp = window.FirebaseMeme.serverTimestamp;
    } else if (window.db_functions) {
      _collection = window.db_functions.collection;
      _getDocs = window.db_functions.getDocs;
      _doc = window.db_functions.doc;
      _setDoc = window.db_functions.setDoc;
    } else {
      gridEl.innerHTML =
        '<div class="character-grid__loading">インフラ初期化エラー。再読み込みしてください。</div>';
      return;
    }
  }

  try {
    userOwnedData = {};

    // 安全にバインドされたコレクション参照を使用
    const ownedRef = _collection(
      _db,
      "users",
      _uid,
      "worlds",
      _worldId,
      "ownedCharacters",
    );
    const querySnapshot = await _getDocs(ownedRef);

    // --- loadAndRenderCharacterGrid 内のクエリ取得ループ部分を以下に差し替え ---
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      // 💡【追加】あとで変更があったか比較できるように、読み込み時の初期値を保存しておく
      data.originalRarity = data.rarity || "未所持";

      userOwnedData[docSnap.id] = data;
    });

    // グリッドを美しく描画
    renderCharacterGrid();
  } catch (error) {
    console.error("🚨 Firestoreからの所持状況のロードに失敗しました:", error);
    gridEl.innerHTML =
      '<div class="character-grid__loading">セーブデータの取得に失敗しました。</div>';
  }
}

/**
 * 3. キャラクターアイコン一覧グリッドの生成（B案：アイコンのみ・グレーアウト連動）
 */
function renderCharacterGrid() {
  const gridEl = document.getElementById("userCharGrid");
  if (!gridEl) return;

  gridEl.innerHTML = "";

  const filteredList = characterMasterList.filter((char) => {
    const matchAttr =
      activeFilterAttr === "ALL" || char.attr === activeFilterAttr;
    const matchType =
      activeFilterType === "ALL" || char.type === activeFilterType;
    return matchAttr && matchType;
  });

  if (filteredList.length === 0) {
    gridEl.innerHTML =
      '<div class="character-grid__loading">該当するキャラクターがいません。</div>';
    return;
  }

  filteredList.forEach((char) => {
    const currentRarity = userOwnedData[char.id]?.rarity || "未所持";
    const isNotOwned = currentRarity === "未所持";

    const wrapEl = document.createElement("div");
    wrapEl.className = `user-char-card-wrap js-char-wrap ${isNotOwned ? "is-not-owned" : ""}`;
    wrapEl.setAttribute("data-char-id", char.id);
    wrapEl.id = `user-char-card-${char.id}`;

    const iconEl = document.createElement("div");
    iconEl.className = "user-char-icon";

    const imgEl = document.createElement("img");
    imgEl.src = char.iconUrl || "https://placehold.co";
    imgEl.alt = char.name;
    imgEl.loading = "lazy";
    iconEl.appendChild(imgEl);

    iconEl.addEventListener("click", () => {
      openUserCharDetailModal(char);
    });

    wrapEl.appendChild(iconEl);
    gridEl.appendChild(wrapEl);
  });
}

/**
 * 4. ユーザー用性能確認モーダルの起動（モーダル内レアリティセレクトボックス内蔵版）
 */
function openUserCharDetailModal(char) {
  currentModalCharData = char;

  // モーダル基本マスタ情報の反映
  document.getElementById("ucd-avatar").src =
    char.iconUrl || "https://placehold.co";
  document.getElementById("ucd-name").textContent = char.name;

  let cleanTags = char.tags
    ? char.tags.replace(/,?\s*\[完了\]/, "").replace(/^,\s*/, "")
    : "";
  document.getElementById("ucd-tags-display").textContent = cleanTags
    ? "🏷️ " + cleanTags
    : "";

  document.getElementById("ucd-attr").textContent = char.attr;
  document.getElementById("ucd-type").textContent = char.type;
  document.getElementById("ucd-rarity").textContent = char.rarity || "限定";

  // ⭕️ プラスマイナスボタンによるレアリティ変更の連動ロジック
  const minusBtn = document.getElementById("js-modal-rarity-minus");
  const plusBtn = document.getElementById("js-modal-rarity-plus");
  const displayEl = document.getElementById("js-modal-rarity-display");

  if (minusBtn && plusBtn && displayEl) {
    // 現在のFirestore上のレアリティを取得し、RARITY_OPTIONSのどこにあるかインデックスを探す
    const savedRarity = userOwnedData[char.id]?.rarity || "未所持";
    let currentIndex = RARITY_OPTIONS.indexOf(savedRarity);
    if (currentIndex === -1) currentIndex = 0; // 万が一見つからなければ「未所持(0)」にする安全ガード

    // --- openUserCharDetailModal 内の updateRarityControlUI を以下に差し替え ---
    const updateRarityControlUI = (index) => {
      const targetRarity = RARITY_OPTIONS[index];
      displayEl.textContent = targetRarity;

      minusBtn.disabled = index === 0;
      plusBtn.disabled = index === RARITY_OPTIONS.length - 1;

      // 💡【追加】最初にFirestoreから読み込んだ時のオリジナルレアリティを取得（なければ未所持）
      const originalRarity = userOwnedData[char.id]?.originalRarity || "未所持";

      if (!userOwnedData[char.id]) {
        userOwnedData[char.id] = {};
      }
      userOwnedData[char.id].rarity = targetRarity;

      // 💡【修正】画面上のレアリティと、読み込み時のレアリティが「異なる場合のみ」変更扱いにする！
      const isChanged = targetRarity !== originalRarity;
      userOwnedData[char.id].isDirty = isChanged;

      // 一覧側の該当キャラクターカードのグレーアウトをリアルタイムに連動点灯
      const listCard = document.getElementById(`user-char-card-${char.id}`);
      if (listCard) {
        if (targetRarity === "未所持") {
          listCard.classList.add("is-not-owned");
        } else {
          listCard.classList.remove("is-not-owned");
        }
      }
    };

    // 初期状態の表示を適用
    updateRarityControlUI(currentIndex);

    // マイナスボタンを押した時（レアリティを下げる）
    minusBtn.onclick = (e) => {
      e.stopPropagation();
      if (currentIndex > 0) {
        currentIndex--;
        updateRarityControlUI(currentIndex);
        console.log(
          `✨ [レアリティ減少変更] ${char.name} : ${RARITY_OPTIONS[currentIndex]}`,
        );
      }
    };

    // プラスボタンを押した時（レアリティを上げる）
    plusBtn.onclick = (e) => {
      e.stopPropagation();
      if (currentIndex < RARITY_OPTIONS.length - 1) {
        currentIndex++;
        updateRarityControlUI(currentIndex);
        console.log(
          `✨ [レアリティ増加変更] ${char.name} : ${RARITY_OPTIONS[currentIndex]}`,
        );
      }
    };
  }

  // ⭕️ 管理者ページの計算エンジンと完全に同じ計算式で数値を流し込み
  if (char.status) {
    runUserStatusCalculationEngine(char.status, char.type);
  }

  // ⭕️ モーダルを開いたときは「ミカエル武器（mika）」の状態で初期描画
  switchUserWeaponTrigger("mika");

  // パーティ編集モーダルと100%共通の挙動で開く
  const modalEl = document.getElementById("userCharDetailModal");
  if (modalEl) {
    modalEl.classList.add("is-open");
    modalEl.removeAttribute("aria-hidden");
    modalEl.removeAttribute("inert");

    document.body.classList.add("is-modal-open");

    // モーダルを開いた瞬間に、外枠と内枠両方のスクロール位置を一番上にリセットする
    const modalContainer = modalEl.querySelector(
      ".p-character-modal__container",
    );
    const modalBody = modalEl.querySelector(".m-char-detail-body");

    if (modalContainer) modalContainer.scrollTop = 0;
    if (modalBody) modalBody.scrollTop = 0;
  }
}

/**
 * 5. 管理者側から直移植したステータス自動計算エンジン
 */
function runUserStatusCalculationEngine(status, type) {
  const spd = Number(status.speed || 0);
  const str = Number(status.str || 0);
  const dex = Number(status.dex || 0);
  const mag = Number(status.mag || 0);
  const sta = Number(status.sta || 0);
  const defInitial = Number(status.defInitial || 0);

  // タイプ別に攻撃力を自動判定
  let atkVal = 0;
  if (type === "ウォーリアー" || type === "ウォーリア") atkVal = str;
  else if (type === "スナイパー") atkVal = dex;
  else if (type === "ソーサラー") atkVal = mag;

  // 二次ステータスの自動計算
  const hitVal = Math.floor(str * 0.5);
  const critVal = Math.floor(dex * 0.5);
  const debuffVal = Math.floor(mag * 0.5);
  const calculatedHP = sta * 10;
  const physDef = str;
  const magDef = mag;
  const evadeVal = Math.floor(dex * 0.5);
  const staVal = Math.floor(sta * 0.5);

  // DOMへの流し込み（一般ユーザー用ID: uc-接頭辞）
  document.getElementById("uc-calculated-speed").textContent =
    spd.toLocaleString();
  document.getElementById("uc-calculated-atk").textContent =
    atkVal.toLocaleString();
  document.getElementById("uc-calculated-hit").textContent =
    hitVal.toLocaleString();
  document.getElementById("uc-calculated-crit").textContent =
    critVal.toLocaleString();
  document.getElementById("uc-calculated-debuff").textContent =
    debuffVal.toLocaleString();

  document.getElementById("uc-calculated-hp").textContent =
    calculatedHP.toLocaleString();
  document.getElementById("uc-calculated-def").textContent =
    defInitial.toLocaleString();
  document.getElementById("uc-calculated-pdef").textContent =
    physDef.toLocaleString();
  document.getElementById("uc-calculated-mdef").textContent =
    magDef.toLocaleString();
  document.getElementById("uc-calculated-evade").textContent =
    evadeVal.toLocaleString();
  document.getElementById("uc-calculated-critres").textContent =
    staVal.toLocaleString();
}

/**
 * 6. 専用装備・段階切り替えトリガー（4大スキル＆段階テキスト完全同期対応）
 */
function switchUserWeaponTrigger(mode) {
  currentWeaponMode = mode;

  // タブボタンのアクティブクラスの切り替え
  ["normal", "asta", "mika", "meta"].forEach((m) => {
    const btn = document.getElementById(`ubtn-wp-${m}`);
    if (btn) {
      if (m === mode) btn.classList.add("is-active");
      else btn.classList.remove("is-active");
    }
  });

  const char = currentModalCharData;
  if (!char) return;

  // 📑 5つのスキル枠（A1, A2, P1, P2, WP）に対して3段階フォールバックテキストの適用
  const ALL_SKILL_TYPES = ["A1", "A2", "P1", "P2", "WP"];
  const skills = char.skills || [];

  ALL_SKILL_TYPES.forEach((type) => {
    const skill = skills.find((sk) => sk.type === type) || {
      name: "",
      ct: 0,
      nomalText: "",
      astarothText: "",
      michaelText: "",
      metatronText: "",
    };

    const nameElem = document.getElementById(`uc-sk-${type}-name`);
    if (nameElem) nameElem.textContent = skill.name || "-";

    const ctArea = document.getElementById(`uc-sk-${type}-ct-area`);
    if (ctArea) {
      if (
        skill.ct !== null &&
        skill.ct !== undefined &&
        String(skill.ct) !== "0" &&
        String(skill.ct) !== ""
      ) {
        ctArea.innerHTML = `<span class="c-world-modal__btn-world">CT: ${skill.ct}</span>`;
      } else {
        ctArea.innerHTML = "";
      }
    }

    const textElem = document.getElementById(`uc-sk-${type}-text`);
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

      if (displayText && displayText.trim() !== "") {
        textElem.innerHTML = displayText.replace(/\n/g, "<br>");
      } else {
        textElem.innerHTML =
          '<span style="color: var(--text-muted); font-style: italic;">未登録</span>';
      }

      if (type === "WP") {
        const isAllEmpty =
          !skill.nomalText &&
          !skill.astarothText &&
          !skill.michaelText &&
          !skill.metatronText;
        const skillBox = textElem.closest(".c-char-detail__skill-box");
        if (skillBox) skillBox.style.display = isAllEmpty ? "none" : "block";
      }
    }
  });

  // 🛡️ 専用武器パッシブ基本ステータスの連動制御
  const w = char.weapon;
  const wpNameEl = document.getElementById("uc-v-w-name");
  const wpValEl = document.getElementById("uc-v-w-val");
  const wpLblEl = document.getElementById("uc-v-w-passives-lbl");
  const wpUl = document.getElementById("uc-v-w-passives");

  if (!w || mode === "normal" || mode === "nomal") {
    wpNameEl.textContent = "専用武器なし (未装備)";
    wpValEl.textContent = "固有値: -";
    if (wpLblEl) wpLblEl.style.display = "none";
    wpUl.innerHTML = "<li>パッシブ効果はありません</li>";
  } else {
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

    wpNameEl.textContent = w.name ? w.name : "専用武器名未設定";
    wpValEl.textContent = `固有値: ${wd.stat || "-"}`;
    if (wpLblEl) wpLblEl.style.display = "block";
    wpUl.innerHTML = "";

    [wd.passive1, wd.passive2, wd.passive3].forEach((pStr) => {
      if (pStr && pStr !== "未設定" && pStr !== "") {
        const li = document.createElement("li");
        li.textContent = `● ${pStr}`;
        wpUl.appendChild(li);
      }
    });
  }
}

/**
 * 7. モーダルおよび武器切り替えタブのイベント定義
 */
function setupUserModalEvents() {
  const modalEl = document.getElementById("userCharDetailModal");

  const closeModal = () => {
    if (modalEl) {
      // ★ 1. 非表示にする前に、現在モーダル内の要素（閉じるボタン等）に当たっているフォーカスを解除する
      const activeEl = document.activeElement;
      if (activeEl && modalEl.contains(activeEl)) {
        activeEl.blur(); // フォーカスを強制解除
      }

      // 2. モーダルを眠らせる
      modalEl.classList.remove("is-open");
      modalEl.setAttribute("aria-hidden", "true");
      modalEl.setAttribute("inert", "");

      document.body.classList.remove("is-modal-open");

      // ★ 3. 画面全体のフォーカスが迷子にならないよう、キャラクターグリッドの親コンテナにフォーカスを移す
      const gridEl = document.getElementById("userCharGrid");
      if (gridEl) {
        gridEl.focus();
      }
    }
  };

  // 共通の閉じクラス「.js-user-char-modal-close」を一括バインド
  document.querySelectorAll(".js-user-char-modal-close").forEach((btn) => {
    btn.addEventListener("click", closeModal);
  });

  // 通常、サタン、ミカエル、メタトロンタブのクリックイベント登録
  ["normal", "asta", "mika", "meta"].forEach((stage) => {
    document
      .getElementById(`ubtn-wp-${stage}`)
      ?.addEventListener("click", (e) => {
        e.stopPropagation();
        switchUserWeaponTrigger(stage);
      });
  });
}

/**
 * 8. 一般ユーザー画面用：HTML内に用意された静的画像ボタンへのイベントバインド
 * 🛠️ 変更点：BEM修正された静的HTML側のクラス名（js-filter-attr / js-filter-type）に完全同期
 */
function bindUserFilterEvents() {
  // ① 属性フィルターボタンのバインド
  const attrButtons = document.querySelectorAll(".js-filter-attr");
  attrButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const attrValue = btn.getAttribute("data-attr");
      activeFilterAttr = attrValue;

      attrButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      renderCharacterGrid();
    });
  });

  // ② タイプフィルターボタンのバインド
  const typeButtons = document.querySelectorAll(".js-filter-type");
  typeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const typeValue = btn.getAttribute("data-type");
      activeFilterType = typeValue;

      typeButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      renderCharacterGrid();
    });
  });
}

/**
 * 💾 9. 「更新する」ボタン押下時の一括Firestore保存処理（更新キャラ名お知らせ版）
 */
async function saveAllCharacterRarityData() {
  const updateBtn = document.getElementById("js-character-btn-update");
  if (!updateBtn) return;

  if (!_db || !_uid || !_worldId || !_doc || !_setDoc) {
    alert("インフラが初期化されていません。再読み込みしてください。");
    return;
  }

  // 💡【厳密判定】本当に最初のロード時（または前回保存時）から値が変わっているキャラのみを抽出
  const dirtyCharIds = Object.keys(userOwnedData).filter(
    (id) => userOwnedData[id].isDirty === true,
  );

  if (dirtyCharIds.length === 0) {
    alert("変更されたデータはありません。");
    return;
  }

  // 💡【確定】保存を実行する直前のタイミングで、確実に変更されているキャラクター名のみをリスト化
  const updatedCharNames = dirtyCharIds.map((id) => {
    const match = characterMasterList.find((c) => String(c.id) === String(id));
    return match ? match.name : "不明な魔女";
  });

  try {
    // ⏳ ボタンをローディング状態（二重クリック防止）にする
    updateBtn.disabled = true;
    updateBtn.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';

    // 変更があったキャラの分だけFirestoreにまとめて書き込み（並列実行）
    await Promise.all(
      dirtyCharIds.map(async (charId) => {
        const docRef = _doc(
          _db,
          "users",
          _uid,
          "worlds",
          _worldId,
          "ownedCharacters",
          charId,
        );

        await _setDoc(
          docRef,
          {
            rarity: userOwnedData[charId].rarity,
            updatedAt: _serverTimestamp ? _serverTimestamp() : new Date(),
          },
          { merge: true },
        );

        // 💡【重要解決策】保存に成功したので、現在のレアリティを次の比較用の「初期値」として上書き
        userOwnedData[charId].originalRarity = userOwnedData[charId].rarity;

        // クラウド保存が成功したので、一時変更フラグをリセット
        userOwnedData[charId].isDirty = false;
      }),
    );

    console.log(
      `💾 [Firestore] ${dirtyCharIds.length}件のキャラ所持状況を一括保存しました。`,
    );

    // ✨【アニメーション演出】成功フラッシュ文字とアイコン切り替え
    updateBtn.classList.add("is-success-flash");
    updateBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> 更新完了！';

    // 💡【通知】プラスマイナスゼロで戻したキャラは含まれず、本当にデータが変動した魔女だけを列挙してアラート
    setTimeout(() => {
      const charListText = updatedCharNames.join("、");
      alert(
        `【クラウド保存完了】\n以下のキャラクターの所持状況を正常に更新しました！\n\n対象: ${charListText}`,
      );
    }, 100);
  } catch (error) {
    console.error("🚨 キャラクターデータの保存に失敗しました:", error);
    alert("データの保存に失敗しました。通信環境を確認してください。");
  } finally {
    // ⏳ ロックを解除して、1.5秒後にボタンの見た目を「更新する」に戻す
    updateBtn.disabled = false;
    setTimeout(() => {
      updateBtn.classList.remove("is-success-flash");
      updateBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> 更新する';
    }, 1500);
  }
}

// 外部参照・手動テスト用のグローバル公開
window.switchUserWeaponTrigger = switchUserWeaponTrigger;
