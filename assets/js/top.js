// 📄 ページが読み込まれたら実行
document.addEventListener("DOMContentLoaded", async () => {
  insertWorldSelector();
});


async function insertWorldSelector() {
  const footerContainer = document.getElementById("js-world-selector-container");
  if (!footerContainer) return;

  try {
    // fetchの前に await をつけることで、ファイルを取得し終わるまで待つ
    const response = await fetch("assets/includes/world-selector.html");
    if (!response.ok) throw new Error("ワールドセレクターの読み込みに失敗しました");

    const htmlData = await response.text();
    footerContainer.innerHTML = htmlData; // 画面に合体！
  } catch (error) {
    console.error("エラー発生:", error);
  }
}
