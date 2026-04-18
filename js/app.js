document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let currentUser = JSON.parse(localStorage.getItem('whiteSNS_user')) || null;

    // --- DOM Elements ---
    const headerTitle = document.getElementById('header-title');
    const headerAvatar = document.getElementById('header-avatar');
    const postSection = document.getElementById('post-section');
    const profileHeader = document.getElementById('profile-header');
    const profileTabs = document.getElementById('profile-tabs');
    const feed = document.getElementById('feed');
    const navItems = document.querySelectorAll('.nav-item');
    const tabItems = document.querySelectorAll('.tab-item');

    // Login Modal Elements
    const loginModal = document.getElementById('login-modal');
    const loginModalContent = document.getElementById('login-modal-content');
    const closeLoginBtn = document.getElementById('close-login-btn');
    const loginForm = document.getElementById('login-form');
    const bskyHandle = document.getElementById('bsky-handle');
    const bskyPassword = document.getElementById('bsky-app-password');
    const loginError = document.getElementById('login-error');
    const loginSubmitBtn = document.getElementById('login-submit-btn');
    const loginSpinner = document.getElementById('login-spinner');
    const mockLoginBtn = document.getElementById('mock-login-btn');

    // --- Mock Data ---
    const MOCK_POSTS = [
        { id: 1, user: "ゲストユーザー", handle: "@guest", text: "今日からwhiteSNSを使い始めました！", time: "1時間前", likes: 15, retweets: 2, replies: 0 },
        { id: 2, user: "システム", handle: "@system", text: "Blueskyのログイン機能が実装されました。ログインしてアカウントを同期してみましょう！", time: "3時間前", likes: 120, retweets: 48, replies: 12 },
    ];

    // --- Modal Handlers ---
    function openLoginModal() {
        loginModal.classList.add('modal-open');
        loginModalContent.classList.add('modal-open-content');
        bskyHandle.focus();
    }

    function closeLoginModal() {
        loginModal.classList.remove('modal-open');
        loginModalContent.classList.remove('modal-open-content');
        loginForm.reset();
        loginError.classList.add('hidden');
    }

    closeLoginBtn.addEventListener('click', closeLoginModal);
    loginModal.addEventListener('click', (e) => {
        if(e.target === loginModal) closeLoginModal();
    });

    // --- Auth Handlers ---
    async function handleLogin(e) {
        e.preventDefault();
        const handle = bskyHandle.value.trim();
        const password = bskyPassword.value.trim();
        if(!handle || !password) {
            showLoginError("ハンドル名とパスワードを入力してください。");
            return;
        }

        loginError.classList.add('hidden');
        loginSpinner.classList.remove('hidden');
        loginSubmitBtn.disabled = true;

        try {
            // Hugging FaceのAPIエンドポイントへ送信
            const res = await fetch('https://nyanpre-whitesns-api.hf.space/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ handle: handle, app_password: password })
            });

            if (!res.ok) throw new Error("APIサーバーと通信できませんでした");
            const data = await res.json();

            if (data.success) {
                const user = {
                    did: data.did,
                    handle: `@${data.handle}`,
                    displayName: data.displayName,
                    avatar: data.avatar || "https://ui-avatars.com/api/?name=" + encodeURIComponent(data.displayName)
                };
                finishLogin(user);
            } else {
                showLoginError(data.error || "認証に失敗しました。");
            }
        } catch (err) {
            // ローカルテスト等で FastAPIが起動していない場合はエラーになる
            console.warn(err);
            showLoginError("バックエンドサーバーに接続できません。モックによるログインを試してください。");
        } finally {
            loginSpinner.classList.add('hidden');
            loginSubmitBtn.disabled = false;
        }
    }

    function showLoginError(msg) {
        loginError.textContent = msg;
        loginError.classList.remove('hidden');
    }

    function finishLogin(userObj) {
        currentUser = userObj;
        localStorage.setItem('whiteSNS_user', JSON.stringify(currentUser));
        closeLoginModal();
        renderHeaderState();
        renderView(document.querySelector('.nav-item.active').getAttribute('data-view'));
    }

    function logout() {
        if(confirm("ログアウトしますか？")) {
            currentUser = null;
            localStorage.removeItem('whiteSNS_user');
            renderHeaderState();
            renderView('profile'); // 状態が変わったのでプロフに戻してリセット
        }
    }

    loginForm.addEventListener('submit', handleLogin);

    // モックログイン（FastAPIを立てなくてもテスト可能）
    mockLoginBtn.addEventListener('click', () => {
        finishLogin({
            did: "did:mock:12345",
            handle: "@demo.bsky.social",
            displayName: "デモユーザー",
            avatar: "https://ui-avatars.com/api/?name=Demo&background=1d9bf0&color=fff"
        });
    });

    // --- Dynamic Resets Based on Auth ---
    function renderHeaderState() {
        if(currentUser) {
            headerAvatar.classList.remove('hidden');
            headerAvatar.innerHTML = `<img src="${currentUser.avatar}" alt="Avatar" class="w-full h-full object-cover">`;
            headerAvatar.onclick = logout; // クリックでログアウト（仮）
        } else {
            headerAvatar.classList.add('hidden');
        }
    }

    function updatePostSection() {
        if(currentUser) {
            postSection.innerHTML = `
                <div class="flex gap-3 animate-fade-in">
                    <div class="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0 overflow-hidden">
                        <img src="${currentUser.avatar}" alt="Avatar" class="w-full h-full object-cover">
                    </div>
                    <div class="flex-1">
                        <textarea id="post-input" maxlength="500" placeholder="いまどうしてる？" 
                            class="w-full h-20 resize-none outline-none text-lg placeholder:text-textSub bg-transparent mt-1"></textarea>
                        <div class="flex justify-between items-center mt-2 pt-2 border-t border-borderBase/50">
                            <div class="flex gap-2 text-primary">
                                <button type="button" class="btn-icon"><span class="material-symbols-rounded">image</span></button>
                            </div>
                            <div class="flex items-center gap-3">
                                <span id="char-count" class="text-sm text-textSub font-mono font-medium opacity-80">0 / 500</span>
                                <button id="post-btn" class="bg-primary hover:bg-blue-600 text-white px-5 py-1.5 rounded-full font-bold disabled:opacity-50 transition-all text-sm shadow-sm" disabled>
                                    投稿する
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
            setupPostListeners();
        } else {
            postSection.innerHTML = `
                <div class="p-6 flex flex-col justify-center items-center text-center animate-fade-in">
                    <p class="font-bold text-textMain mb-2">ログインしてコミュニティに参加しよう</p>
                    <p class="text-textSub text-sm mb-4">アカウントを持っていると、投稿やいいねができます。</p>
                    <button class="bg-black text-white px-6 py-2 rounded-full font-bold hover:bg-gray-800 transition trigger-login">ログインする</button>
                </div>`;
            document.querySelectorAll('.trigger-login').forEach(btn => btn.addEventListener('click', openLoginModal));
        }
    }

    function updateProfileHeader() {
        if(currentUser) {
            profileHeader.innerHTML = `
                <div class="h-32 bg-gray-200 w-full relative">
                    <div class="absolute -bottom-10 left-4 w-20 h-20 bg-white rounded-full p-1 border-4 border-white shadow-sm overflow-hidden">
                        <img src="${currentUser.avatar}" alt="Avatar" class="w-full h-full rounded-full object-cover">
                    </div>
                    <button class="absolute -bottom-10 right-4 border border-borderBase px-4 py-1.5 rounded-full font-bold hover:bg-gray-50 flex items-center gap-2">
                        <span class="material-symbols-rounded text-sm">settings</span>設定
                    </button>
                </div>
                <div class="pt-12 px-4 pb-4 animate-fade-in">
                    <h2 class="font-bold text-xl">${currentUser.displayName}</h2>
                    <p class="text-textSub text-sm">${currentUser.handle}</p>
                    <p class="mt-3 text-sm leading-relaxed">認証済みのBlueskyアカウントです。ようこそ！</p>
                    <div class="flex gap-4 mt-3 text-sm text-textSub">
                        <span class="hover:underline cursor-pointer"><b class="text-textMain">0</b> フォロー中</span>
                        <span class="hover:underline cursor-pointer"><b class="text-textMain">0</b> フォロワー</span>
                    </div>
                </div>`;
            profileTabs.classList.remove('hidden');
        } else {
            profileHeader.innerHTML = `
                <div class="p-10 flex flex-col justify-center items-center text-center animate-fade-in mt-10">
                    <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <span class="material-symbols-rounded !text-4xl text-gray-400">person_off</span>
                    </div>
                    <h2 class="font-bold text-xl mb-2 text-textMain">プロフィールを利用できません</h2>
                    <p class="text-textSub text-sm mb-6">自分のプロフィールや設定を確認するにはログインしてください。</p>
                    <button class="bg-primary text-white font-bold py-2 px-8 rounded-full shadow-sm hover:bg-blue-600 transition trigger-login">
                        ログイン・登録
                    </button>
                </div>`;
            profileTabs.classList.add('hidden');
            document.querySelectorAll('.trigger-login').forEach(btn => btn.addEventListener('click', openLoginModal));
            feed.innerHTML = '';
        }
    }

    // --- Event Listeners Sub-routines ---
    function setupPostListeners() {
        const postInput = document.getElementById('post-input');
        const charCount = document.getElementById('char-count');
        const postBtn = document.getElementById('post-btn');
        if(!postInput || !charCount || !postBtn) return;

        postInput.addEventListener('input', () => {
            const length = postInput.value.length;
            charCount.textContent = `${length} / 500`;
            postBtn.disabled = length === 0 || length > 500;
            charCount.classList.toggle('text-red-500', length > 500);
            charCount.classList.toggle('text-textSub', length <= 500);
        });

        postBtn.addEventListener('click', () => {
            if(!currentUser) return;
            const text = postInput.value;
            if(text.trim() === '') return;

            MOCK_POSTS.unshift({
                id: Date.now(),
                user: currentUser.displayName,
                handle: currentUser.handle,
                text: text,
                time: "たった今",
                likes: 0, retweets: 0, replies: 0
            });

            postInput.value = '';
            postInput.dispatchEvent(new Event('input'));
            if(document.querySelector('.nav-item[data-view="home"]').classList.contains('active')) {
                renderFeed(MOCK_Posts); // Wait typo fix
                renderFeed(MOCK_POSTS);
            }
        });
    }

    // --- Views ---
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.getAttribute('data-view');
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            renderView(view);
        });
    });

    function renderView(view) {
        postSection.classList.add('hidden');
        profileHeader.classList.add('hidden');
        profileTabs.classList.add('hidden');
        feed.innerHTML = '';
        window.scrollTo({top: 0, behavior: 'auto'});

        if (view === 'home') {
            headerTitle.textContent = 'ホーム';
            postSection.classList.remove('hidden');
            updatePostSection();
            if (currentUser) {
                renderFeed(MOCK_POSTS);
            } else {
                feed.innerHTML = `
                    <div class="flex flex-col items-center justify-center p-12 text-center animate-fade-in mt-4">
                        <span class="material-symbols-rounded !text-[56px] text-gray-300 mb-4">lock</span>
                        <p class="font-bold text-textMain text-lg mb-2">タイムラインはロックされています</p>
                        <p class="text-textSub text-sm leading-relaxed">他のユーザーの投稿を閲覧するには、<br>ログインしてください。</p>
                    </div>`;
            }
        } 
        else if (view === 'search') {
            headerTitle.textContent = '検索';
            feed.innerHTML = `
                <div class="p-4 animate-fade-in">
                    <div class="relative">
                        <span class="material-symbols-rounded absolute left-3 top-3.5 text-gray-400">search</span>
                        <input type="text" placeholder="キーワード検索" 
                               class="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-full outline-none focus:ring-1 focus:ring-primary transition-all">
                    </div>
                    <div class="mt-12 flex flex-col items-center justify-center text-center">
                        <p class="font-bold text-textMain mb-2">トレンドのトピック</p>
                        <p class="text-textSub text-sm">#話題のハッシュタグ はまだありません</p>
                    </div>
                </div>`;
        } 
        else if (view === 'notifications') {
            headerTitle.textContent = '通知';
            if(currentUser) {
                feed.innerHTML = `
                    <div class="flex flex-col items-center justify-center p-20 text-center animate-fade-in mt-10">
                        <span class="material-symbols-rounded !text-5xl text-gray-300 mb-4">notifications</span>
                        <p class="font-bold text-xl mb-2 text-textMain">通知はありません</p>
                    </div>`;
            } else {
                feed.innerHTML = `
                    <div class="flex flex-col items-center justify-center p-20 text-center animate-fade-in mt-10">
                        <p class="font-bold text-xl mb-2 text-textMain">ログインが必要です</p>
                        <p class="text-textSub text-sm mb-6">通知を確認するにはログインしてください。</p>
                        <button class="bg-primary text-white font-bold py-2 px-8 rounded-full hover:bg-blue-600 transition trigger-login">ログイン</button>
                    </div>`;
                    document.querySelectorAll('.trigger-login').forEach(btn => btn.addEventListener('click', openLoginModal));
            }
        } 
        else if (view === 'profile') {
            headerTitle.textContent = currentUser ? currentUser.displayName : 'プロフィール';
            profileHeader.classList.remove('hidden');
            updateProfileHeader();
            
            if(currentUser) {
                const activeTab = document.querySelector('.tab-item.active').getAttribute('data-tab');
                updateTabContent(activeTab);
            }
        }
    }

    // --- Feed Render ---
    function renderFeed(posts) {
        if(posts.length === 0) {
            feed.innerHTML = `<div class="p-10 text-center text-textSub">投稿がありません</div>`;
            return;
        }

        feed.innerHTML = posts.map(post => {
            const isMe = currentUser && currentUser.handle === post.handle;
            const avatarUrl = isMe ? currentUser.avatar : `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user)}&background=random`;
            
            return `
            <article class="p-4 border-b border-borderBase hover:bg-gray-50/50 transition-colors animate-fade-in cursor-pointer">
                <div class="flex gap-3">
                    <div class="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0 overflow-hidden">
                        <img src="${avatarUrl}" alt="Avatar" class="w-full h-full object-cover">
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 mb-1">
                            <span class="font-bold text-textMain truncate hover:underline">${post.user}</span>
                            <span class="text-textSub text-[14px] truncate">${post.handle}</span>
                            <span class="text-textSub text-[14px]">·</span>
                            <span class="text-textSub text-[14px] hover:underline">${post.time}</span>
                        </div>
                        <p class="text-textMain leading-relaxed whitespace-pre-wrap">${post.text}</p>
                        
                        <div class="flex justify-between items-center mt-3 text-textSub max-w-md pr-4">
                            <button class="flex items-center gap-1.5 hover:text-blue-500 group transition" onclick="event.stopPropagation()">
                                <div class="p-1.5 rounded-full group-hover:bg-blue-50 transition"><span class="material-symbols-rounded !text-[20px]">chat_bubble</span></div>
                                <span class="text-sm font-medium">${post.replies > 0 ? post.replies : ''}</span>
                            </button>
                            <button class="flex items-center gap-1.5 hover:text-green-500 group transition" onclick="event.stopPropagation()">
                                <div class="p-1.5 rounded-full group-hover:bg-green-50 transition"><span class="material-symbols-rounded !text-[20px]">cached</span></div>
                                <span class="text-sm font-medium">${post.retweets > 0 ? post.retweets : ''}</span>
                            </button>
                            <button class="flex items-center gap-1.5 hover:text-pink-500 group transition" onclick="event.stopPropagation()">
                                <div class="p-1.5 rounded-full group-hover:bg-pink-50 transition"><span class="material-symbols-rounded !text-[20px]">favorite</span></div>
                                <span class="text-sm font-medium">${post.likes > 0 ? post.likes : ''}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </article>
        `}).join('');
    }

    // --- Profile Tabs ---
    tabItems.forEach(tab => {
        tab.addEventListener('click', () => {
            tabItems.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            updateTabContent(tab.getAttribute('data-tab'));
        });
    });

    function updateTabContent(tabName) {
        if(!currentUser) return;
        
        if(tabName === 'posts') {
            const userPosts = MOCK_POSTS.filter(p => p.handle === currentUser.handle);
            renderFeed(userPosts);
        } else {
            const iconMap = { 'replies': 'chat_bubble', 'media': 'image', 'bookmarks': 'bookmark', 'likes': 'favorite' };
            feed.innerHTML = `
                <div class="flex flex-col items-center justify-center p-20 text-center animate-fade-in mt-6">
                    <span class="material-symbols-rounded !text-5xl text-gray-300 mb-4">${iconMap[tabName] || 'info'}</span>
                    <p class="font-bold text-xl text-textMain mb-2">まだありません</p>
                    <p class="text-textSub text-sm">ここにはあなたの${getTabDisplayName(tabName)}が表示されます。</p>
                </div>`;
        }
    }

    function getTabDisplayName(name) {
        const map = { 'replies': '返信', 'media': 'メディア', 'likes': 'いいね', 'bookmarks': '保存したコンテンツ' };
        return map[name] || name;
    }

    // 初期化
    renderHeaderState();
    renderView('home');
});
