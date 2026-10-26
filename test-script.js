/**
 * ==========================================================================
 * 【共通関数】キャラクターカードの見た目を最新仕様に基づいて更新する
 * ==========================================================================
 *
 * @param {HTMLElement} cardElement - 見た目を変更したい対象の「.chara-card」要素
 * @param {string} rarity - ゲームデータから取得したレアリティ（例: "SR+", "LR_7"）
 */
/**
 * キャラクターカードの見た目を最新仕様に基づいて更新する（専用プラス画像対応版）
 */
function updateCardAppearance(cardElement, rarity) {
  if (!cardElement) return;

  const starContainer = cardElement.querySelector(".js-chara-stars");
  const plusBadge = cardElement.querySelector(".js-chara-plus");
  const plusImg = cardElement.querySelector(".js-chara-plus-img"); // 🌟専用画像タグを取得

  // 🌟【設定】各レアリティ専用のプラスバッジ画像のパス
  // 実際のフォルダ構成（assets/images/ 等）に合わせてパスを書き換えてください。
  const plusImagePaths = {
    "SR+": "assets/images/chara-icon/sr-plus.png",
    "SSR+": "assets/images/chara-icon/ssr-plus.png",
    "UR+": "assets/images/chara-icon/ur-plus.png",
  };

  // --------------------------------------------------------------------------
  // 1. 古いレアリティクラスの大掃除
  // --------------------------------------------------------------------------
  const classes = Array.from(cardElement.classList);
  classes.forEach((className) => {
    if (className.startsWith("is-rarity-")) {
      cardElement.classList.remove(className);
    }
  });

  // 2. 新しいレアリティクラスの付与
  const classSuffix = rarity.toLowerCase().replace("+", "_plus");
  cardElement.classList.add(`is-rarity-${classSuffix}`);

  // --------------------------------------------------------------------------
  // 3. 【アップデート】専用「＋」バッジ画像の表示＆差し替え制御
  // --------------------------------------------------------------------------
  if (plusBadge && plusImg) {
    if (rarity.endsWith("+")) {
      // 辞書から対象レアリティの画像パスを取得してsrcに注入
      const imagePath =
        plusImagePaths[rarity] || "assets/images/badge-default-plus.png";
      plusImg.src = imagePath;
      plusImg.alt = `${rarity} badge`;

      // バッジ表示クラスをON
      plusBadge.classList.add("is-active");
    } else {
      // プラスが付かない通常レアリティなら非表示にし、srcを空にする
      plusBadge.classList.remove("is-active");
      plusImg.src = "";
    }
  }

  // --------------------------------------------------------------------------
  // 4. 【修正版】LR〜LR10の星（★）の正確な生成ロジック
  // --------------------------------------------------------------------------
  if (starContainer) {
    // まずは前の星をきれいに大掃除（初期化）します
    starContainer.innerHTML = "";

    // レアリティが「LR」から始まる場合（通常LR、およびLR_1〜LR_10すべて）
    if (rarity.startsWith("LR")) {
      let totalStars = 0; // 画面に表示する星の総数
      let blueStarCount = 0; // 水色に染める星の数

      // 【ケースA】通常の「LR」の場合（進化直後）
      if (rarity === "LR") {
        totalStars = 0; // メメモリの仕様通り、星は「0個」（枠線のみ）
        blueStarCount = 0;
      }
      // 【ケースB】「LR_1」〜「LR_10」の場合
      else if (rarity.includes("_")) {
        // 「LR_7」などの文字列から、後半の数字（7）を切り出して整数（7）にします
        const lrLevel = parseInt(rarity.split("_")[1], 10);

        // LR1 〜 LR5 の場合（レベルの数だけ紫星が増える）
        if (lrLevel <= 5) {
          totalStars = lrLevel; // LR1なら1個、LR5なら5個
          blueStarCount = 0; // まだ水色はなし（すべて紫）
        }
        // LR6 〜 LR10 の場合（星5個固定で、左から段階的に水色化）
        else {
          totalStars = 5; // 星の総数は5個で固定
          blueStarCount = lrLevel - 5; // LR6なら1個、LR7なら2個… LR10なら5個すべて水色
        }
      }

      // 割り出した「totalStars」の数だけ、ループで星を1個ずつ組み立てて注入
      for (let i = 0; i < totalStars; i++) {
        const starSpan = document.createElement("span");
        starSpan.classList.add("chara-card__star");
        starSpan.textContent = "★";

        // 左からのループ回数(i)が、水色にすべき数(blueStarCount)未満なら水色クラスを付与
        if (i < blueStarCount) {
          starSpan.classList.add("chara-card__star--blue");
        } else {
          // それ以降の右側の星は、ベースの紫色クラスを付与
          starSpan.classList.add("chara-card__star--purple");
        }

        starContainer.appendChild(starSpan);
      }
    }
  }
}

/* ==========================================================================
 * 画面起動時のイベント監視
 * ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  const raritySelect = document.getElementById("rarity-select");
  const targetCard = document.querySelector(".js-chara-card");

  // 最初の表示をセレクトボックスの初期値（SR）に合わせる
  updateCardAppearance(targetCard, raritySelect.value);

  // セレクトボックスが変更されたら見た目を一発連動
  raritySelect.addEventListener("change", (e) => {
    updateCardAppearance(targetCard, e.target.value);
  });
});
