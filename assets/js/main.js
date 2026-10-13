// 📄 ページが読み込まれたら実行
document.addEventListener("DOMContentLoaded", async () => {
  // 💡 呪文「await」をつけて実行。フッターの挿入が100%終わるまで、次の行に進まない！
  await insertFooter(); 

  // 💡 フッターが確実に入った後に、満を持して実行される！
  setActiveNavigation(); 
});

/**
* 📁 関数①：フッターを読み込んで画面に挿入する関数
* (awaitを使うために、関数の頭に async をつけます)
*/
async function insertFooter() {
  const footerContainer = document.getElementById("js-footer-container");
  if (!footerContainer) return;

  try {
      // fetchの前に await をつけることで、ファイルを取得し終わるまで待つ
      const response = await fetch("assets/includes/footer.html");
      if (!response.ok) throw new Error("フッターの読み込みに失敗しました");
      
      const htmlData = await response.text();
      footerContainer.innerHTML = htmlData; // 画面に合体！
  } catch (error) {
      console.error("エラー発生:", error);
  }
}

/**
* 🧭 関数②：ナビゲーションに is-active を付与する関数
*/
function setActiveNavigation() {
  const currentPath = window.location.pathname.toLowerCase();
  const navLinks = document.querySelectorAll('.js-nav-trigger');

  navLinks.forEach(link => {
      const targetHref = link.getAttribute('href').toLowerCase();
      if (targetHref === 'index.html') {
          if (currentPath.endsWith('index.html') || currentPath.endsWith('/')) {
              link.classList.add('is-active');
          } else {
              link.classList.remove('is-active');
          }
      } else {
          if (currentPath.includes(targetHref)) {
              link.classList.add('is-active');
          } else {
              link.classList.remove('is-active');
          }
      }
  });
}
