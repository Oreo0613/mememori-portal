// ==========================================================================
// 💎 ダイヤ管理機能（diamond.js）【1/3】
// ==========================================================================
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
  onAuthStateChanged,
  GoogleAuthProvider,
  reauthenticateWithPopup,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// 定数定義
const ADMIN_UID = "ZcWgnVNxShfjr1byRolwgdASFLi2";
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const TOKEN_STORAGE_KEY = "mememori_google_access_token";

// ステート管理変数
let currentUser = null;
let currentSheetId = null;

// ==========================================================================
// 1. 初期化・アクセス制限ガード（ページ直打ち防止）
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  initDateInputDefault();
  bindUIEvents();

  // main.js で window.auth / window.db が初期化されるのを待って認証監視を開始
  const waitFirebase = setInterval(() => {
    if (window.auth && window.db) {
      clearInterval(waitFirebase);
      startAuthGuard();
    }
  }, 50);
});

function startAuthGuard() {
  onAuthStateChanged(window.auth, async (user) => {
    // 未ログイン、または管理者UID以外の場合は即座に index.html へ強制リダイレクト
    if (!user || user.uid !== ADMIN_UID) {
      console.warn("⛔ 権限がありません。トップページへリダイレクトします。");
      window.location.href = "index.html";
      return;
    }

    currentUser = user;
    await initDiamondPage();
  });
}

// ==========================================================================
// 2. ページ初期ロード処理
// ==========================================================================
async function initDiamondPage() {
  updateTargetWorldLabel();

  try {
    // Firestoreの users/{userId} から連携中のスプレッドシートIDを取得
    const userDocRef = doc(window.db, "users", currentUser.uid);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists() && userSnap.data().diamondSheetId) {
      currentSheetId = userSnap.data().diamondSheetId;
      updateConfigUIState(true, currentSheetId);
      await loadWorldDiamondHistory();
    } else {
      currentSheetId = null;
      updateConfigUIState(false, null);
      showHistoryMessage(
        "スプレッドシートが未連携です。上の「スプレッドシート連携設定」から新規作成または紐づけを行ってください。",
      );
    }
  } catch (error) {
    console.error("🚨 初期データ取得エラー:", error);
    showHistoryMessage(
      "設定情報の読み込みに失敗しました。再読込してください。",
    );
  }
}

// ==========================================================================
// 3. Google API アクセストークン管理 ＆ 401自動再認証ガード
// ==========================================================================
async function requestFreshGoogleToken() {
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_FILE_SCOPE);

  const result = await reauthenticateWithPopup(
    window.auth.currentUser,
    provider,
  );
  const credential = GoogleAuthProvider.credentialFromResult(result);

  if (!credential || !credential.accessToken) {
    throw new Error("Googleアクセストークンの取得に失敗しました。");
  }

  sessionStorage.setItem(TOKEN_STORAGE_KEY, credential.accessToken);
  return credential.accessToken;
}

/**
 * Google Sheets API へのリクエストラッパー（401期限切れ検知時に自動でトークン更新してリトライ）
 */
async function fetchSheetsApi(url, options = {}, isRetry = false) {
  let token = sessionStorage.getItem(TOKEN_STORAGE_KEY);

  // トークンが未保存の場合はポップアップ認証で取得
  if (!token) {
    token = await requestFreshGoogleToken();
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });

  // 有効期限切れ（401 Unauthorized）を検知した場合、1回だけ再認証してリトライ
  if (response.status === 401 && !isRetry) {
    console.log(
      "🔄 アクセストークンの有効期限切れを検知。再認証を実行します...",
    );
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    await requestFreshGoogleToken();
    return fetchSheetsApi(url, options, true);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Sheets API Error (${response.status}): ${errText}`);
  }

  return response.json();
}

// ==========================================================================
// 4. ワールド情報ヘルパー（シートタブ名の生成）
// ==========================================================================
function getActiveWorldInfo() {
  const worldId = sessionStorage.getItem("app_current_world_id");
  if (!worldId) return null;

  const cachedListStr = sessionStorage.getItem("mememori_world_list");
  if (cachedListStr) {
    const worlds = JSON.parse(cachedListStr);
    const found = worlds.find((w) => String(w.id) === String(worldId));
    if (found) {
      return {
        worldId: found.id,
        worldNumber: found.worldNumber,
        worldName: found.worldName || "",
        sheetTitle: `W${found.worldNumber}_${found.id}`,
      };
    }
  }

  return {
    worldId,
    worldNumber: "0",
    worldName: "",
    sheetTitle: `W0_${worldId}`,
  };
}

function updateTargetWorldLabel() {
  const labelEl = document.getElementById("js-diamond-target-world-label");
  if (!labelEl) return;

  const worldInfo = getActiveWorldInfo();
  if (worldInfo) {
    labelEl.textContent =
      `W${worldInfo.worldNumber} ${worldInfo.worldName}`.trim();
  } else {
    labelEl.textContent = "ワールド未選択";
  }
}

// ==========================================================================
// 5. スプレッドシート新規自動作成 ＆ 既存シート紐づけ
// ==========================================================================
async function handleCreateNewSpreadsheet() {
  const btn = document.getElementById("js-diamond-create-sheet-btn");
  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 作成中...';

    const worldInfo = getActiveWorldInfo();
    const initialSheetTitle = worldInfo ? worldInfo.sheetTitle : "初期シート";

    // Google Sheets API で新規スプレッドシートを作成
    const createPayload = {
      properties: {
        title: "メメモリPORTAL_ダイヤ管理",
      },
      sheets: [
        {
          properties: {
            title: initialSheetTitle,
          },
        },
      ],
    };

    const createdData = await fetchSheetsApi(SHEETS_API_BASE, {
      method: "POST",
      body: JSON.stringify(createPayload),
    });

    const newSheetId = createdData.spreadsheetId;

    // 初期シートの1行目にヘッダーを書き込む
    await appendHeaderRow(newSheetId, initialSheetTitle);

    // FirestoreにスプレッドシートIDを保存
    await saveSheetIdToFirestore(newSheetId);

    alert(
      "Googleドライブに「メメモリPORTAL_ダイヤ管理」を作成し、連携しました！",
    );
    await loadWorldDiamondHistory();
  } catch (error) {
    console.error("🚨 シート新規作成エラー:", error);
    alert(
      "スプレッドシートの作成に失敗しました。認証ポップアップがブロックされていないか確認してください。",
    );
  } finally {
    btn.disabled = false;
    btn.innerHTML =
      '<i class="fa-solid fa-file-circle-plus"></i> スプレッドシートを新規自動作成';
  }
}

async function handleLinkExistingSpreadsheet(rawInput) {
  // URLが貼り付けられた場合は正規表現でID部分のみを抽出、IDそのままならトリムして使用
  const match = rawInput.match(/\/d\/([a-zA-Z0-9-_]+)/);
  const extractedId = match ? match[1] : rawInput.trim();

  if (!extractedId) {
    alert("有効なスプレッドシートのURLまたはIDを入力してください。");
    return;
  }

  const submitBtn = document.getElementById("js-diamond-link-submit-btn");
  try {
    submitBtn.disabled = true;
    submitBtn.textContent = "確認中...";

    // 実際にアクセス可能かメタデータを取得して検証
    await fetchSheetsApi(
      `${SHEETS_API_BASE}/${extractedId}?fields=properties.title`,
    );

    // Firestoreへ保存
    await saveSheetIdToFirestore(extractedId);

    document.getElementById("js-diamond-sheet-input").value = "";
    alert("スプレッドシートの紐づけが完了しました！");
    await loadWorldDiamondHistory();
  } catch (error) {
    console.error("🚨 既存シート紐づけエラー:", error);
    alert(
      "指定されたスプレッドシートにアクセスできませんでした。URL・IDやアクセス権限を確認してください。",
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "紐づける";
  }
}

async function saveSheetIdToFirestore(sheetId) {
  const userDocRef = doc(window.db, "users", currentUser.uid);
  await setDoc(
    userDocRef,
    { diamondSheetId: sheetId, updatedAt: serverTimestamp() },
    { merge: true },
  );
  currentSheetId = sheetId;
  updateConfigUIState(true, sheetId);
}

// ==========================================================================
// 6. シート（タブ）の存在確認・自動生成 ＆ ヘッダー書き込み
// ==========================================================================
async function ensureWorldTabExists(sheetId, tabTitle) {
  const meta = await fetchSheetsApi(
    `${SHEETS_API_BASE}/${sheetId}?fields=sheets.properties.title`,
  );
  const sheets = meta.sheets || [];
  const exists = sheets.some(
    (s) => s.properties && s.properties.title === tabTitle,
  );

  if (!exists) {
    // タブが存在しない場合は batchUpdate で新規タブを追加
    await fetchSheetsApi(`${SHEETS_API_BASE}/${sheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: { title: tabTitle },
            },
          },
        ],
      }),
    });

    // ヘッダー行（A1:D1）を自動挿入
    await appendHeaderRow(sheetId, tabTitle);
  }
}

// ==========================================================================
// ヘッダー行の書き込み（A1:G1 の7列構成）
// ==========================================================================
async function appendHeaderRow(sheetId, tabTitle) {
  const range = encodeURIComponent(`${tabTitle}!A1:G1`);
  await fetchSheetsApi(
    `${SHEETS_API_BASE}/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({
        values: [
          [
            "日付",
            "所持ダイヤ数",
            "運命チケット",
            "導きチケット",
            "信託チケット",
            "秘奥チケット",
            "メモ",
          ],
        ],
      }),
    },
  );
}

let cachedWorldRows = [];

// ==========================================================================
// 7. 履歴データの読み込み ＆ 選択日付に応じたフォーム自動反映
// ==========================================================================
async function loadWorldDiamondHistory() {
  updateTargetWorldLabel();

  if (!currentSheetId) {
    cachedWorldRows = [];
    showHistoryMessage("スプレッドシートが未連携です。");
    return;
  }

  const worldInfo = getActiveWorldInfo();
  if (!worldInfo) {
    cachedWorldRows = [];
    showHistoryMessage("ヘッダーからワールドを選択してください。");
    return;
  }

  showHistoryMessage("シートからデータを読み込んでいます...");

  try {
    const meta = await fetchSheetsApi(
      `${SHEETS_API_BASE}/${currentSheetId}?fields=sheets.properties.title`,
    );
    const sheets = meta.sheets || [];
    const tabExists = sheets.some(
      (s) => s.properties && s.properties.title === worldInfo.sheetTitle,
    );

    if (!tabExists) {
      cachedWorldRows = [];
      syncFormWithSelectedDate();
      showHistoryMessage(
        `「${worldInfo.sheetTitle}」の記録はまだありません。上のフォームから最初の記録を登録してください。`,
      );
      return;
    }

    // データ行（A2:G）を取得
    const range = encodeURIComponent(`${worldInfo.sheetTitle}!A2:G`);
    const result = await fetchSheetsApi(
      `${SHEETS_API_BASE}/${currentSheetId}/values/${range}`,
    );
    const rows = result.values || [];

    cachedWorldRows = rows;

    if (rows.length === 0) {
      syncFormWithSelectedDate();
      showHistoryMessage(
        "記録データがありません。最初の資産を記録しましょう！",
      );
      return;
    }

    // 選択中の記録日（初期値は今日）に合わせてフォームへ自動セット
    syncFormWithSelectedDate();

    renderHistoryTable(rows);
  } catch (error) {
    console.error("🚨 履歴読み込みエラー:", error);
    showHistoryMessage(
      "履歴の読み込みに失敗しました。「再読込」ボタンを押して再試行してください。",
    );
  }
}

/**
 * 選択されている「記録日」のデータがあれば全項目をセットし、なければチケットのみ前回値を引き継ぐ
 */
function syncFormWithSelectedDate() {
  const dateInput = document.getElementById("js-diamond-input-date");
  const amountInput = document.getElementById("js-diamond-input-amount");
  const fateInput = document.getElementById("js-diamond-input-fate");
  const guidanceInput = document.getElementById("js-diamond-input-guidance");
  const oracleInput = document.getElementById("js-diamond-input-oracle");
  const arcanaInput = document.getElementById("js-diamond-input-arcana-ticket");
  const memoInput = document.getElementById("js-diamond-input-memo");
  const submitBtn = document.getElementById("js-diamond-submit-btn");

  if (!Array.isArray(cachedWorldRows) || cachedWorldRows.length === 0) {
    if (amountInput) amountInput.value = "";
    if (fateInput) fateInput.value = "";
    if (guidanceInput) guidanceInput.value = "";
    if (oracleInput) oracleInput.value = "";
    if (arcanaInput) arcanaInput.value = "";
    if (memoInput) memoInput.value = "";
    if (submitBtn) {
      submitBtn.innerHTML =
        '<i class="fa-solid fa-pen-to-square"></i> 記録する';
    }
    return;
  }

  // 入力欄の日付（YYYY-MM-DD）をシートの形式（YYYY/MM/DD）に変換
  const targetDateSlash = dateInput ? dateInput.value.replace(/-/g, "/") : "";

  // 選択中の日付と一致する行を探す
  const matchedRows = cachedWorldRows.filter(
    (row) => String(row.at(0) || "").trim() === targetDateSlash,
  );
  const todayRecord = matchedRows.length > 0 ? matchedRows.at(-1) : null;

  if (todayRecord) {
    // ① すでにその日のデータがある場合：所持ダイヤ数・チケット・メモを復元し、ボタンを「上書き更新」にする
    const valAmount = todayRecord.at(1);
    const valFate = todayRecord.at(2);
    const valGuidance = todayRecord.at(3);
    const valOracle = todayRecord.at(4);
    const valArcana = todayRecord.at(5);
    const valMemo = todayRecord.at(6);

    if (amountInput) {
      amountInput.value =
        valAmount !== undefined ? String(valAmount).replace(/,/g, "") : "";
    }
    if (fateInput) fateInput.value = valFate !== undefined ? valFate : "";
    if (guidanceInput) {
      guidanceInput.value = valGuidance !== undefined ? valGuidance : "";
    }
    if (oracleInput) {
      oracleInput.value = valOracle !== undefined ? valOracle : "";
    }
    if (arcanaInput) {
      arcanaInput.value = valArcana !== undefined ? valArcana : "";
    }
    if (memoInput) memoInput.value = valMemo !== undefined ? valMemo : "";
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> 上書き更新する';
    }
  } else {
    // ② その日のデータがまだない場合：ダイヤとメモは空欄にし、チケットだけ最新行から引き継ぐ
    const latestRow = cachedWorldRows.at(-1);
    if (amountInput) amountInput.value = "";
    if (memoInput) memoInput.value = "";

    const valFate = latestRow.at(2);
    const valGuidance = latestRow.at(3);
    const valOracle = latestRow.at(4);
    const valArcana = latestRow.at(5);

    if (fateInput) {
      fateInput.value = valFate !== undefined && valFate !== "" ? valFate : "";
    }
    if (guidanceInput) {
      guidanceInput.value =
        valGuidance !== undefined && valGuidance !== "" ? valGuidance : "";
    }
    if (oracleInput) {
      oracleInput.value =
        valOracle !== undefined && valOracle !== "" ? valOracle : "";
    }
    if (arcanaInput) {
      arcanaInput.value =
        valArcana !== undefined && valArcana !== "" ? valArcana : "";
    }
    if (submitBtn) {
      submitBtn.innerHTML =
        '<i class="fa-solid fa-pen-to-square"></i> 記録する';
    }
  }
}

function renderHistoryTable(rows) {
  const messageEl = document.getElementById("js-diamond-history-message");
  const tableWrap = document.getElementById("js-diamond-table-wrap");
  const tbody = document.getElementById("js-diamond-history-tbody");

  if (!tbody || !tableWrap || !messageEl) return;

  tbody.innerHTML = "";

  // 古い順のまま1行ずつ「前回比」を自動計算してから、新しい順（逆順）に並べ替える
  const processedRows = rows.map((row, index) => {
    const currentAmount =
      row[1] !== undefined && row[1] !== ""
        ? Number(String(row[1]).replace(/,/g, ""))
        : NaN;

    let diffNum = null;
    if (index > 0 && !isNaN(currentAmount)) {
      const prevRow = rows[index - 1];
      const prevAmount =
        prevRow[1] !== undefined && prevRow[1] !== ""
          ? Number(String(prevRow[1]).replace(/,/g, ""))
          : NaN;
      if (!isNaN(prevAmount)) {
        diffNum = currentAmount - prevAmount;
      }
    }

    return { row, currentAmount, diffNum };
  });

  const reversedRows = processedRows.reverse();

  reversedRows.forEach(({ row, currentAmount, diffNum }) => {
    const dateStr = row[0] || "-";
    const fateStr =
      row[2] !== undefined && row[2] !== ""
        ? Number(row[2]).toLocaleString()
        : "-";
    const guidanceStr =
      row[3] !== undefined && row[3] !== ""
        ? Number(row[3]).toLocaleString()
        : "-";
    const oracleStr =
      row[4] !== undefined && row[4] !== ""
        ? Number(row[4]).toLocaleString()
        : "-";
    const arcanaStr =
      row[5] !== undefined && row[5] !== ""
        ? Number(row[5]).toLocaleString()
        : "-";
    const memoStr = row[6] || "";

    const tr = document.createElement("tr");

    // A列：記録日
    const tdDate = document.createElement("td");
    tdDate.className = "p-diamond-table__date";
    tdDate.textContent = dateStr;

    // B列：所持ダイヤ数
    const tdAmount = document.createElement("td");
    tdAmount.className = "p-diamond-table__amount";
    tdAmount.textContent = isNaN(currentAmount)
      ? row[1] || "-"
      : currentAmount.toLocaleString();

    // 画面表示用に自動計算した「前回比」
    const tdDiff = document.createElement("td");
    tdDiff.className = "p-diamond-table__diff";
    if (diffNum !== null) {
      if (diffNum > 0) {
        tdDiff.textContent = `+${diffNum.toLocaleString()}`;
        tdDiff.classList.add("is-plus");
      } else if (diffNum < 0) {
        tdDiff.textContent = diffNum.toLocaleString();
        tdDiff.classList.add("is-minus");
      } else {
        tdDiff.textContent = "±0";
        tdDiff.classList.add("is-zero");
      }
    } else {
      tdDiff.textContent = "-";
      tdDiff.classList.add("is-zero");
    }

    // C〜F列：各種チケット
    const createTicketCell = (val) => {
      const td = document.createElement("td");
      td.className = "p-diamond-table__ticket";
      td.textContent = val;
      return td;
    };

    // G列：メモ
    const tdMemo = document.createElement("td");
    tdMemo.className = "p-diamond-table__memo";
    tdMemo.textContent = memoStr;

    tr.appendChild(tdDate);
    tr.appendChild(tdAmount);
    tr.appendChild(tdDiff);
    tr.appendChild(createTicketCell(fateStr));
    tr.appendChild(createTicketCell(guidanceStr));
    tr.appendChild(createTicketCell(oracleStr));
    tr.appendChild(createTicketCell(arcanaStr));
    tr.appendChild(tdMemo);

    tbody.appendChild(tr);
  });

  messageEl.classList.add("is-hidden");
  tableWrap.classList.remove("is-hidden");
}

// ==========================================================================
// 8. ダイヤ・チケット記録の送信（同日なら上書き更新、新規日なら最終行追記）
// ==========================================================================
async function handleRecordSubmit(e) {
  e.preventDefault();

  if (!currentSheetId) {
    alert("先にGoogleスプレッドシートを連携してください。");
    return;
  }

  const worldInfo = getActiveWorldInfo();
  if (!worldInfo) {
    alert("記録対象のワールドが選択されていません。");
    return;
  }

  const rawDate = document.getElementById("js-diamond-input-date").value;
  const amountVal = Number(
    document.getElementById("js-diamond-input-amount").value,
  );
  const fateRaw = document.getElementById("js-diamond-input-fate").value.trim();
  const guidanceRaw = document
    .getElementById("js-diamond-input-guidance")
    .value.trim();
  const oracleRaw = document
    .getElementById("js-diamond-input-oracle")
    .value.trim();
  const arcanaRaw = document
    .getElementById("js-diamond-input-arcana-ticket")
    .value.trim();
  const memoVal = document.getElementById("js-diamond-input-memo").value.trim();

  if (!rawDate || isNaN(amountVal)) return;

  const fateVal = fateRaw !== "" ? Number(fateRaw) : "";
  const guidanceVal = guidanceRaw !== "" ? Number(guidanceRaw) : "";
  const oracleVal = oracleRaw !== "" ? Number(oracleRaw) : "";
  const arcanaVal = arcanaRaw !== "" ? Number(arcanaRaw) : "";

  const formattedDate = rawDate.replace(/-/g, "/");
  const submitBtn = document.getElementById("js-diamond-submit-btn");

  const rowValues = [
    formattedDate,
    amountVal,
    fateVal,
    guidanceVal,
    oracleVal,
    arcanaVal,
    memoVal,
  ];

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';

    // 1. 該当ワールドのシートタブが無ければ自動作成
    await ensureWorldTabExists(currentSheetId, worldInfo.sheetTitle);

    // 2. すでに同じ日付の行が存在するか検索（cachedWorldRows の index 0 がシートの2行目）
    const existingIndex = cachedWorldRows.findIndex(
      (row) => String(row.at(0) || "").trim() === formattedDate,
    );

    if (existingIndex !== -1) {
      // 【上書き更新】1行目がヘッダーなので、シート上の行番号は existingIndex + 2
      const targetRowNumber = existingIndex + 2;
      const rangeUpdate = encodeURIComponent(
        `${worldInfo.sheetTitle}!A${targetRowNumber}:G${targetRowNumber}`,
      );
      await fetchSheetsApi(
        `${SHEETS_API_BASE}/${currentSheetId}/values/${rangeUpdate}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          body: JSON.stringify({
            values: [rowValues],
          }),
        },
      );
    } else {
      // 【新規追記】同じ日付がなければ最終行へ新しく追加
      const rangeAppend = encodeURIComponent(`${worldInfo.sheetTitle}!A:G`);
      await fetchSheetsApi(
        `${SHEETS_API_BASE}/${currentSheetId}/values/${rangeAppend}:append?valueInputOption=USER_ENTERED`,
        {
          method: "POST",
          body: JSON.stringify({
            values: [rowValues],
          }),
        },
      );
    }

    // 履歴テーブルとフォーム状態を最新化（ボタン文言も syncFormWithSelectedDate 内で自動復元される）
    await loadWorldDiamondHistory();
  } catch (error) {
    console.error("🚨 資産記録エラー:", error);
    alert(
      "スプレッドシートへの書き込みに失敗しました。通信状況や認証状態を確認してください。",
    );
    if (submitBtn) {
      submitBtn.innerHTML =
        '<i class="fa-solid fa-pen-to-square"></i> 記録する';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
    }
  }
}

// ==========================================================================
// 9. UI制御・イベントバインド
// ==========================================================================
function initDateInputDefault() {
  const dateInput = document.getElementById("js-diamond-input-date");
  if (!dateInput) return;

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  dateInput.value = `${yyyy}-${mm}-${dd}`;
}

function updateConfigUIState(isLinked, sheetId) {
  const statusEl = document.getElementById("js-diamond-sheet-status");
  const toggleBtn = document.getElementById("js-diamond-config-toggle");
  const configBody = document.getElementById("js-diamond-config-body");
  const linkedInfo = document.getElementById("js-diamond-linked-info");
  const currentIdEl = document.getElementById("js-diamond-current-sheet-id");
  const openLinkEl = document.getElementById("js-diamond-open-sheet-link");

  if (isLinked && sheetId) {
    if (statusEl) {
      statusEl.textContent = "連携済み";
      statusEl.classList.add("is-linked");
    }
    if (linkedInfo) linkedInfo.classList.remove("is-hidden");
    if (currentIdEl) currentIdEl.textContent = sheetId;
    if (openLinkEl) {
      openLinkEl.href = `https://google.com{sheetId}/edit`;
    }
    // 連携済みの場合はアコーディオンをデフォルトで閉じる
    if (toggleBtn && configBody) {
      toggleBtn.classList.remove("is-open");
      toggleBtn.setAttribute("aria-expanded", "false");
      configBody.classList.add("is-hidden");
    }
  } else {
    if (statusEl) {
      statusEl.textContent = "未連携";
      statusEl.classList.remove("is-linked");
    }
    if (linkedInfo) linkedInfo.classList.add("is-hidden");
    // 未連携の場合は操作しやすいようアコーディオンを自動で開く
    if (toggleBtn && configBody) {
      toggleBtn.classList.add("is-open");
      toggleBtn.setAttribute("aria-expanded", "true");
      configBody.classList.remove("is-hidden");
    }
  }
}

function showHistoryMessage(text) {
  const messageEl = document.getElementById("js-diamond-history-message");
  const tableWrap = document.getElementById("js-diamond-table-wrap");

  if (tableWrap) tableWrap.classList.add("is-hidden");
  if (messageEl) {
    messageEl.textContent = text;
    messageEl.classList.remove("is-hidden");
  }
}

function bindUIEvents() {
  // 記録日のカレンダー変更時にフォーム内容を自動同期
  const dateInput = document.getElementById("js-diamond-input-date");
  if (dateInput) {
    dateInput.addEventListener("change", syncFormWithSelectedDate);
  }

  // アコーディオン開閉
  const toggleBtn = document.getElementById("js-diamond-config-toggle");
  const configBody = document.getElementById("js-diamond-config-body");
  if (toggleBtn && configBody) {
    toggleBtn.addEventListener("click", () => {
      const isHidden = configBody.classList.contains("is-hidden");
      if (isHidden) {
        configBody.classList.remove("is-hidden");
        toggleBtn.classList.add("is-open");
        toggleBtn.setAttribute("aria-expanded", "true");
      } else {
        configBody.classList.add("is-hidden");
        toggleBtn.classList.remove("is-open");
        toggleBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  // 新規自動作成ボタン
  const createBtn = document.getElementById("js-diamond-create-sheet-btn");
  if (createBtn) {
    createBtn.addEventListener("click", handleCreateNewSpreadsheet);
  }

  // 既存シート紐づけフォーム
  const linkForm = document.getElementById("js-diamond-link-form");
  if (linkForm) {
    linkForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const inputVal = document.getElementById("js-diamond-sheet-input").value;
      await handleLinkExistingSpreadsheet(inputVal);
    });
  }

  // ダイヤ記録送信フォーム
  const recordForm = document.getElementById("js-diamond-record-form");
  if (recordForm) {
    recordForm.addEventListener("submit", handleRecordSubmit);
  }

  // 再読込ボタン
  const reloadBtn = document.getElementById("js-diamond-reload-btn");
  if (reloadBtn) {
    reloadBtn.addEventListener("click", loadWorldDiamondHistory);
  }

  // ヘッダーのワールドセレクター切り替えイベント（main.js から発火）に連動
  window.addEventListener("appWorldChanged", async () => {
    await loadWorldDiamondHistory();
  });
}
