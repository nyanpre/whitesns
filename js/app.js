document.addEventListener('DOMContentLoaded', () => {
    // 要素の取得
    const headerTitle = document.getElementById('header-title');
    const postSection = document.getElementById('post-section');
    const profileTabs = document.getElementById('profile-tabs');
    const feed = document.getElementById('feed');
    
    const postInput = document.getElementById('post-input');
    const charCount = document.getElementById('char-count');
    const postBtn = document.getElementById('post-btn');
    
    const navItems = document.querySelectorAll('.nav-item');
    const tabItems = document.querySelectorAll('.tab-item');

    // --- 1. 投稿入力ロジック ---
    postInput.addEventListener('input', () => {
        const length = postInput.value.length;
        charCount.textContent = `${length} / 500`;

        // ボタンの活性化
        postBtn.disabled = length === 0 || length > 500;

        // 文字数超過時の警告色
        if (length > 500) {
            charCount.classList.replace('text-gray-500', 'text-red-500');
        } else {
            charCount.classList.replace('text-red-500', 'text-gray-500');
        }
    });

    // --- 2. ボトムナビ切り替え (メインビュー管理) ---
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.getAttribute('data-view');

            // ナビボタンのアクティブ表示切り替え
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            renderView(view);
        });
    });

    function renderView(view) {
        // 全体をリセット
        postSection.classList.add('hidden');
        profileTabs.classList.add('hidden');
        window.scrollTo(0, 0);

        if (view === 'home') {
            headerTitle.textContent = 'ホーム';
            postSection.classList.remove('hidden');
            feed.innerHTML = `
                <div class="p-8 text-center text-gray-400">
                    <p>タイムラインを読み込み中...</p>
                </div>`;
        } 
        else if (view === 'search') {
            headerTitle.textContent = '検索';
            feed.innerHTML = `
                <div class="p-4">
                    <input type="text" placeholder="キーワード・#ハッシュタグで検索" 
                           class="w-full p-3 bg-gray-100 rounded-full outline-none border focus:border-blue-400">
                    <div class="mt-8 text-center text-gray-400 text-sm">トレンドのトピックがここに表示されます</div>
                </div>`;
        } 
        else if (view === 'notifications') {
            headerTitle.textContent = '通知';
            feed.innerHTML = `<div class="p-20 text-center text-gray-400">まだ通知はありません</div>`;
        } 
        else if (view === 'profile') {
            headerTitle.textContent = 'プロフィール';
            profileTabs.classList.remove('hidden'); // プロフィールのみ上部タブを表示
            updateTabContent('posts'); // 初期タブ
        }
    }

    // --- 3. プロフィール内タブ切り替え ---
    tabItems.forEach(tab => {
        tab.addEventListener('click', () => {
            tabItems.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const tabName = tab.getAttribute('data-tab');
            updateTabContent(tabName);
        });
    });

    function updateTabContent(tabName) {
        const contentMap = {
            'posts': 'あなたの投稿一覧',
            'replies': '返信した投稿',
            'media': 'アップロードした画像',
            'likes': 'いいねした投稿',
            'bookmarks': 'ブックマーク保存済み'
        };
        feed.innerHTML = `<div class="p-20 text-center text-gray-400">「${contentMap[tabName]}」はまだありません</div>`;
    }

    // 初期表示をホームに設定
    renderView('home');
});
