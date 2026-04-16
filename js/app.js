document.addEventListener('DOMContentLoaded', () => {
    // --- 既存の変数定義 ---
    const postInput = document.getElementById('post-input');
    const charCount = document.getElementById('char-count');
    const postBtn = document.getElementById('post-btn');
    const contentTabs = document.querySelectorAll('.tab-item'); // 上部のタブ（投稿/返信など）
    
    // --- 追加：ボトムナビ関連の変数 ---
    const bottomNavItems = document.querySelectorAll('.nav-item');
    const headerTitle = document.getElementById('header-title');
    const feed = document.getElementById('feed');
    const postSection = document.querySelector('section.p-4.border-b'); // 投稿エリア
    const topTabNav = document.querySelector('nav.flex.border-b'); // 上部タブナビ

    // 1. 文字数カウンター（既存）
    postInput.addEventListener('input', () => {
        const length = postInput.value.length;
        charCount.textContent = `${length} / 500`;
        postBtn.disabled = length === 0 || length > 500;
    });

    // 2. ボトムナビゲーション切り替え
    bottomNavItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.getAttribute('data-view');

            // アクティブ状態の切り替え
            bottomNavItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // 表示内容の切り替え
            updateView(view);
        });
    });

    function updateView(view) {
        // ビューに応じて表示をカスタマイズ
        if (view === 'home') {
            headerTitle.textContent = 'ホーム';
            postSection.classList.remove('hidden'); // ホームでは投稿欄を出す
            topTabNav.classList.add('hidden');    // ホームでは上部タブは隠す（X風）
            feed.innerHTML = `<div class="p-10 text-center text-gray-400">タイムラインの投稿がここに並びます</div>`;
        } 
        else if (view === 'search') {
            headerTitle.textContent = '検索';
            postSection.classList.add('hidden');
            topTabNav.classList.add('hidden');
            feed.innerHTML = `<div class="p-4"><input type="text" placeholder="キーワード検索" class="w-full p-2 bg-gray-100 rounded-lg"></div>`;
        } 
        else if (view === 'notifications') {
            headerTitle.textContent = '通知';
            postSection.classList.add('hidden');
            topTabNav.classList.add('hidden');
            feed.innerHTML = `<div class="p-10 text-center text-gray-400">通知はありません</div>`;
        } 
        else if (view === 'profile') {
            headerTitle.textContent = 'プロフィール';
            postSection.classList.add('hidden'); // プロフィールでは投稿欄は隠す
            topTabNav.classList.remove('hidden'); // プロフィール画面のみ上部タブを表示
            feed.innerHTML = `<div class="p-10 text-center text-gray-400">「投稿」タブのコンテンツ</div>`;
        }
    }

    // 3. 上部タブ切り替え（プロフィール画面内用）
    contentTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            contentTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const tabName = tab.getAttribute('data-tab');
            feed.innerHTML = `<div class="p-10 text-center text-gray-400">「${tabName}」の内容を表示中</div>`;
        });
    });

    // 初期表示設定
    updateView('home');
});
