/**
 * 📄 ページが読み込まれたらすべてのインフラ関数を順番に実行する
 */
document.addEventListener("DOMContentLoaded", async () => {
    // 💡 1. 共通フッターの挿入とアクティブ化（完了を待つ）
    await insertFooter(); 
    setActiveNavigation(); 

    // 💡 2. 共通ワールドセレクター（ヘッダーまたは専用コンテナ）の挿入とイベント設定（完了を待つ）
    await insertWorldSelector();
    initWorldSelectorEvent();
});

/**
 * 📁 関数①：フッターを裏側で読み込んで画面に挿入する関数
 */
async function insertFooter() {
    const footerContainer = document.getElementById("js-footer-container");
    if (!footerContainer) return;

    try {
        const response = await fetch("assets/includes/footer.html");
        if (!response.ok) throw new Error("フッターの読み込みに失敗しました");
        footerContainer.innerHTML = await response.text();
    } catch (error) {
        console.error("フッターの読み込みエラー:", error);
    }
}

/**
 * 🧭 関数②：現在のURLと一致するフッターのナビボタンに is-active を付与する関数
 */
function setActiveNavigation() {
    const currentPath = window.location.pathname.toLowerCase();
    const navLinks = document.querySelectorAll('.js-nav-trigger');

    navLinks.forEach(link => {
        const targetHref = link.getAttribute('href').toLowerCase();

        // トップページ（index.html または ドメイン直下の /）の判定
        if (targetHref === 'index.html') {
            if (currentPath.endsWith('index.html') || currentPath.endsWith('/')) {
                link.classList.add('is-active');
            } else {
                link.classList.remove('is-active');
            }
        } 
        // 通常のページ（admin系など）の判定
        else {
            if (currentPath.includes(targetHref)) {
                link.classList.add('is-active');
            } else {
                link.classList.remove('is-active');
            }
        }
    });
}

/**
 * 🌐 関数③：ワールドセレクター（アイコン＆モーダル）を適切なコンテナに挿入する関数
 */
async function insertWorldSelector() {
    // 挿入先の候補（ヘッダー、またはindex用の別コンテナがあればそれを使う）
    const targetContainer = document.getElementById("js-header-container") || 
                            document.getElementById("js-world-selector-container");
    
    // どちらのコンテナもページ内に存在しない場合は、この機能が不要なページ（管理者画面など）と判断してスルー
    if (!targetContainer) return;

    try {
        const response = await fetch("assets/includes/world-selector.html");
        if (!response.ok) throw new Error("ワールドセレクターの読み込みに失敗しました");
        
        targetContainer.innerHTML = await response.text();
    } catch (error) {
        console.error("ワールドセレクターの読み込みエラー:", error);
    }
}

/**
 * ⚙️ 関数④：モーダルの開閉と、ワールドが切り替わった時のダブルテキスト連動を設定する関数
 */
function initWorldSelectorEvent() {
    const modal = document.getElementById("js-world-modal");
    const openBtn = document.getElementById("js-world-modal-open");
    const closeBtn = document.getElementById("js-world-modal-close");
    const overlay = document.getElementById("js-world-modal-overlay");
    const choiceBtns = document.querySelectorAll(".js-world-choice");
    
    const currentWorldBadge = document.getElementById("js-current-world-badge"); // 左上ヘッダー用
    const modalWorldText = document.getElementById("js-modal-world-text");       // モーダル内ヘッダー用

    // 画面内に要素がなければ、イベント設定をせず安全に終了（分岐処理）
    if (!modal || !openBtn) return;

    // 💡 初期状態（閉じているとき）は inert 属性を付与して中身のボタンを完全に無効化しておく
    modal.setAttribute("inert", "");

    // 🔓 1. 左上のキャラアイコン型ボタンをクリックしてモーダルを開く
    openBtn.addEventListener("click", () => {
        modal.classList.add("is-open");
        modal.removeAttribute("aria-hidden"); 
        modal.removeAttribute("inert");       // 💡 inertを外して、中のボタンを操作可能にする
        
        const activeBtn = modal.querySelector(".js-world-choice.is-active");
        if (activeBtn) activeBtn.focus();
    });

    // 🔒 2. モーダルを閉じる共通処理
    const closeModal = () => {
        modal.classList.remove("is-open");
        modal.setAttribute("inert", ""); // 💡 inertを付与してスリープ状態にする
        openBtn.focus();
    };
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (overlay) overlay.addEventListener("click", closeModal);

    // 🌍 3. モーダル内のワールドボタンが選ばれた時の処理
    choiceBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const selectedWorld = btn.getAttribute("data-world");      
            const selectedWorldText = btn.textContent;                

            // ボタンのスタイル切り替え
            choiceBtns.forEach(b => b.classList.remove("is-active"));
            btn.classList.add("is-active");

            // 左上ヘッダーのテキストを書き換え
            if (currentWorldBadge) currentWorldBadge.textContent = selectedWorldText;

            // モーダル内のヘッダーテキストを書き換え
            if (modalWorldText) modalWorldText.textContent = selectedWorldText;

            console.log(`🌍 アクティブワールドを変更しました: ${selectedWorld}`);

            // 💡 ここに、ワールド変更時に各タブのデータを再読み込みするカスタムイベントなどを後々挟めます

            // 最後にモーダルをフワッと閉じる
            closeModal();
        });
    });
}
