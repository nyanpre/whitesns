document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let currentUser = JSON.parse(localStorage.getItem('whiteSNS_user')) || null;
    let bookmarks = JSON.parse(localStorage.getItem('whiteSNS_bookmarks')) || [];
    let savedDraft = localStorage.getItem('whiteSNS_draft') || "";
    let viewedUserProfile = null; // null: view me, or {handle, ...}: view someone else
    let currentView = 'home';
    let replyTargetPost = null;

    // --- DOM Elements ---
    const headerTitle = document.getElementById('header-title');
    const headerAvatar = document.getElementById('header-avatar');
    const postSection = document.getElementById('post-section');
    const profileHeader = document.getElementById('profile-header');
    const profileTabs = document.getElementById('profile-tabs');
    const feed = document.getElementById('feed');
    const navItems = document.querySelectorAll('.nav-item');
    const tabItems = document.querySelectorAll('.tab-item');

    // Login Elements
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

    // Compose Elements
    const fabPost = document.getElementById('fab-post');
    const composeModal = document.getElementById('compose-modal');
    const composeModalContent = document.getElementById('compose-modal-content');
    const closeComposeBtn = document.getElementById('close-compose-btn');
    const composeInput = document.getElementById('compose-input');
    const draftComposeBtn = document.getElementById('draft-compose-btn');
    const submitComposeBtn = document.getElementById('submit-compose-btn');
    const composeAvatar = document.getElementById('compose-avatar');
    const replyContext = document.getElementById('reply-context');
    const replyToText = document.getElementById('reply-to-text');
    const composeCharCount = document.getElementById('compose-char-count');

    // --- Mock Data ---
    const MOCK_PROFILES = {
        "@guest": { displayName: "ゲストユーザー", handle: "@guest", avatar: "https://ui-avatars.com/api/?name=Guest&background=random" },
        "@system": { displayName: "システム", handle: "@system", avatar: "https://ui-avatars.com/api/?name=Sys&background=1d9bf0&color=fff" },
        "@demo.bsky.social": { displayName: "デモユーザー", handle: "@demo.bsky.social", avatar: "https://ui-avatars.com/api/?name=Demo&background=1d9bf0&color=fff" }
    };

    let localPosts = JSON.parse(localStorage.getItem('whiteSNS_posts'));
    let MOCK_POSTS = localPosts || [
        { id: 1, user: "ゲストユーザー", handle: "@guest", text: "今日からwhiteSNSを使い始めました！ #初めての投稿", time: "1時間前", likes: 15, retweets: 2, replies: 0 },
        { id: 2, user: "システム", handle: "@system", text: "最新のお知らせ。\n @demo.bsky.social さんもテスト中！", time: "3時間前", likes: 120, retweets: 48, replies: 1 },
        { id: 3, parent_id: 2, user: "デモユーザー", handle: "@demo.bsky.social", text: "とても便利ですね！", time: "2時間前", likes: 5, retweets: 0, replies: 0 }
    ];

    function savePosts() {
        localStorage.setItem('whiteSNS_posts', JSON.stringify(MOCK_POSTS));
    }

    // --- Format Utils ---
    function formatPostText(text) {
        if(!text) return '';
        let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        escaped = escaped.replace(/(#\S+)/g, '<span class="hashtag">$1</span>');
        escaped = escaped.replace(/(@[a-zA-Z0-9_.-]+)/g, '<span class="mention" data-handle="$1">$1</span>');
        return escaped;
    }

    // --- Modal Handlers ---
    // Login
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
    loginModal.addEventListener('click', (e) => { if(e.target === loginModal) closeLoginModal(); });

    // Compose
    function openComposeModal(replyToPost = null) {
        if(!currentUser) { openLoginModal(); return; }
        
        replyTargetPost = replyToPost;
        composeAvatar.innerHTML = `<img src="${currentUser.avatar}" alt="Avatar" class="w-full h-full object-cover">`;
        
        if (replyTargetPost) {
            replyContext.classList.remove('hidden');
            replyToText.textContent = `返信先: ${replyTargetPost.handle}`;
            composeInput.value = ""; // Don't load draft when replying
        } else {
            replyContext.classList.add('hidden');
            composeInput.value = savedDraft; // Load draft
        }
        
        composeInput.dispatchEvent(new Event('input')); // trigger validation
        
        composeModal.classList.add('modal-open');
        composeModalContent.classList.add('modal-open-content');
        composeInput.focus();
    }
    
    function closeComposeModal() {
        composeModal.classList.remove('modal-open');
        composeModalContent.classList.remove('modal-open-content');
        // Auto-save draft only if not a reply
        if (!replyTargetPost && composeInput.value.trim() !== "") {
            savedDraft = composeInput.value;
            localStorage.setItem('whiteSNS_draft', savedDraft);
        }
    }
    closeComposeBtn.addEventListener('click', closeComposeModal);
    composeModal.addEventListener('click', (e) => { if(e.target === composeModal) closeComposeModal(); });
    fabPost?.addEventListener('click', () => openComposeModal(null));

    // Draft Button logic
    draftComposeBtn.addEventListener('click', () => {
        if (!replyTargetPost) {
            savedDraft = composeInput.value;
            localStorage.setItem('whiteSNS_draft', savedDraft);
            alert("下書きを保存しました。");
        } else {
            alert("返信画面では下書き保存できません。");
        }
    });

    composeInput.addEventListener('input', () => {
        const length = composeInput.value.length;
        composeCharCount.textContent = `${length} / 500`;
        submitComposeBtn.disabled = length === 0 || length > 500;
        composeCharCount.classList.toggle('text-red-500', length > 500);
        composeCharCount.classList.toggle('text-textSub', length <= 500);
    });

    submitComposeBtn.addEventListener('click', () => {
        if(!currentUser) return;
        const text = composeInput.value.trim();
        if(text === '') return;

        const newPost = {
            id: Date.now(),
            user: currentUser.displayName,
            handle: currentUser.handle,
            text: text,
            time: "たった今",
            likes: 0, retweets: 0, replies: 0
        };

        if (replyTargetPost) {
            newPost.parent_id = replyTargetPost.id;
            const parent = MOCK_POSTS.find(p => p.id == replyTargetPost.id);
            if(parent) parent.replies++;
        }

        // 自分のプロフィールをMOCK_PROFILESにセット（表示用）
        MOCK_PROFILES[currentUser.handle] = currentUser;

        MOCK_POSTS.unshift(newPost);
        savePosts();
        
        // Clear draft if it was a normal post
        if (!replyTargetPost) {
            savedDraft = "";
            localStorage.removeItem('whiteSNS_draft');
        }
        
        closeComposeModal();

        // Refresh view immediately
        if(currentView === 'home' || currentView === 'profile') {
            renderView(currentView);
        }
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
            const res = await fetch('https://nyanpre-whitesns-api.hf.space/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ handle: handle, app_password: password })
            });

            if (!res.ok) throw new Error("API通信エラー");
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
        renderView(currentView);
    }

    function logout() {
        if(confirm("ログアウトしますか？")) {
            currentUser = null;
            localStorage.removeItem('whiteSNS_user');
            renderHeaderState();
            renderView('home');
        }
    }

    loginForm.addEventListener('submit', handleLogin);

    mockLoginBtn.addEventListener('click', () => {
        finishLogin({
            did: "did:mock:12345",
            handle: "@raira0626.bsky.social",
            displayName: "TestUser",
            avatar: "https://ui-avatars.com/api/?name=Test&background=1d9bf0&color=fff"
        });
    });

    // --- Header ---
    function renderHeaderState() {
        if(currentUser) {
            headerAvatar.classList.remove('hidden');
            headerAvatar.innerHTML = `<img src="${currentUser.avatar}" alt="Avatar" class="w-full h-full object-cover">`;
            headerAvatar.onclick = logout;
            fabPost?.classList.remove('hidden');
        } else {
            headerAvatar.classList.add('hidden');
            fabPost?.classList.add('hidden');
        }
    }

    // --- Dynamic Content Rendering ---
    function updatePostSection() {
        if(currentUser) {
            // トップの領域は押すとポップアップが開くダミーボタンとして機能
            postSection.innerHTML = `
                <div class="flex gap-3 animate-fade-in p-2 cursor-text" onclick="document.getElementById('fab-post').click()">
                    <div class="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0 overflow-hidden">
                        <img src="${currentUser.avatar}" alt="Avatar" class="w-full h-full object-cover">
                    </div>
                    <div class="flex-1 flex items-center">
                        <div class="text-textSub text-lg">いまどうしてる？</div>
                    </div>
                </div>`;
        } else {
            postSection.innerHTML = `
                <div class="p-6 flex flex-col justify-center items-center text-center animate-fade-in">
                    <p class="font-bold text-textMain mb-2">ログインしてコミュニティに参加しよう</p>
                    <button class="bg-black text-white px-6 py-2 rounded-full font-bold hover:bg-gray-800 transition trigger-login">ログインする</button>
                </div>`;
        }
    }

    function updateProfileHeader() {
        const targetUser = viewedUserProfile || currentUser;
        
        if(targetUser) {
            profileHeader.innerHTML = `
                <div class="h-32 bg-gray-200 w-full relative">
                    <div class="absolute -bottom-10 left-4 w-20 h-20 bg-white rounded-full p-1 border-4 border-white shadow-sm overflow-hidden">
                        <img src="${targetUser.avatar || 'https://ui-avatars.com/api/?name='+targetUser.displayName}" alt="Avatar" class="w-full h-full rounded-full object-cover">
                    </div>
                    ${!viewedUserProfile ? `
                    <button class="absolute -bottom-10 right-4 border border-borderBase px-4 py-1.5 rounded-full font-bold hover:bg-gray-50 flex items-center gap-2">
                        <span class="material-symbols-rounded text-sm">settings</span>設定
                    </button>` : ''}
                </div>
                <div class="pt-12 px-4 pb-4 animate-fade-in">
                    <h2 class="font-bold text-xl">${targetUser.displayName}</h2>
                    <p class="text-textSub text-sm">${targetUser.handle}</p>
                    <p class="mt-3 text-sm leading-relaxed">${targetUser.handle} のプロフィールです。</p>
                </div>`;
            profileTabs.classList.remove('hidden');
        } else {
            profileHeader.innerHTML = `
                <div class="p-10 flex flex-col justify-center text-center mt-10">
                    <h2 class="font-bold text-xl mb-2">プロフィールを利用できません</h2>
                    <button class="bg-primary text-white font-bold py-2 px-8 rounded-full trigger-login mx-auto">ログイン</button>
                </div>`;
            profileTabs.classList.add('hidden');
            feed.innerHTML = '';
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
            const profile = MOCK_PROFILES[post.handle];
            const avatarUrl = isMe ? currentUser.avatar : (profile ? profile.avatar : `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user)}&background=random`);
            const isBookmarked = bookmarks.includes(post.id);

            let parentHtml = '';
            if (post.parent_id) {
                const parent = MOCK_POSTS.find(p => p.id === post.parent_id);
                if (parent) {
                    parentHtml = `<div class="text-[13px] text-textSub mb-1"><span class="mention" data-handle="${parent.handle}">返信先: ${parent.handle}</span></div>`;
                }
            }
            
            return `
            <article class="p-4 border-b border-borderBase hover:bg-gray-50/50 transition-colors animate-fade-in cursor-pointer" data-post-id="${post.id}">
                ${parentHtml}
                <div class="flex gap-3">
                    <div class="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0 overflow-hidden avatar-click cursor-pointer" data-handle="${post.handle}">
                        <img src="${avatarUrl}" alt="Avatar" class="w-full h-full object-cover pointer-events-none">
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 mb-1">
                            <span class="font-bold text-textMain truncate hover:underline avatar-click cursor-pointer" data-handle="${post.handle}">${post.user}</span>
                            <span class="text-textSub text-[14px] truncate">${post.handle}</span>
                            <span class="text-textSub text-[14px]">·</span>
                            <span class="text-textSub text-[14px]">${post.time}</span>
                        </div>
                        <p class="text-textMain leading-relaxed whitespace-pre-wrap">${formatPostText(post.text)}</p>
                        
                        <div class="flex justify-between items-center mt-3 text-textSub max-w-md pr-4">
                            <button class="flex items-center gap-1.5 hover:text-blue-500 group transition action-btn" data-action="reply">
                                <div class="p-1.5 rounded-full group-hover:bg-blue-50 transition pointer-events-none"><span class="material-symbols-rounded !text-[20px]">chat_bubble</span></div>
                                <span class="text-sm font-medium pointer-events-none">${post.replies > 0 ? post.replies : ''}</span>
                            </button>
                            <button class="flex items-center gap-1.5 hover:text-pink-500 group transition action-btn" data-action="like">
                                <div class="p-1.5 rounded-full group-hover:bg-pink-50 transition pointer-events-none"><span class="material-symbols-rounded !text-[20px]">favorite</span></div>
                                <span class="text-sm font-medium pointer-events-none">${post.likes > 0 ? post.likes : ''}</span>
                            </button>
                            <button class="flex items-center gap-1.5 ${isBookmarked ? 'text-primary' : ''} hover:text-primary group transition action-btn" data-action="bookmark">
                                <div class="p-1.5 rounded-full group-hover:bg-blue-50 transition pointer-events-none"><span class="material-symbols-rounded !text-[20px] ${isBookmarked ? '!font-bold' : ''}">bookmark</span></div>
                            </button>
                        </div>
                    </div>
                </div>
            </article>
        `}).join('');
    }

    // --- Views ---
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.getAttribute('data-view');
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            viewedUserProfile = null; // reset to my profile if I click tab
            renderView(view);
        });
    });

    function navigateToProfile(handle) {
        if(!currentUser) return; // ログインしていない場合は飛べない
        if(handle === currentUser.handle) {
            viewedUserProfile = null; // View Myself
        } else {
            // Find user from mock or dynamically generate
            viewedUserProfile = MOCK_PROFILES[handle] || { displayName: handle.substring(1), handle: handle, avatar: `https://ui-avatars.com/api/?name=${handle}&background=random` };
        }
        
        navItems.forEach(i => i.classList.remove('active'));
        document.querySelector('.nav-item[data-view="profile"]').classList.add('active');
        renderView('profile');
    }

    function renderView(view) {
        currentView = view;
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
                    </div>`;
            }
        } 
        else if (view === 'search') {
            headerTitle.textContent = '検索';
            feed.innerHTML = `
                <div class="p-4 animate-fade-in">
                    <div class="relative">
                        <span class="material-symbols-rounded absolute left-3 top-3.5 text-gray-400">search</span>
                        <input type="text" id="mock-search-input" placeholder="キーワード検索" 
                               class="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-full outline-none focus:ring-1 focus:ring-primary transition-all">
                    </div>
                    <div id="search-results" class="mt-4">
                        <div class="mt-8 flex flex-col items-center justify-center text-center">
                            <p class="font-bold text-textMain mb-2">トレンド</p>
                            <p class="text-textSub text-sm">#初めての投稿</p>
                        </div>
                    </div>
                </div>`;
            
            // Search Input Logic
            const searchInput = document.getElementById('mock-search-input');
            const searchResults = document.getElementById('search-results');
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const q = searchInput.value.toLowerCase();
                    const res = MOCK_POSTS.filter(p => p.text.toLowerCase().includes(q));
                    if(res.length > 0) {
                        const originalFeed = feed.innerHTML; // Hack to reuse renderFeed
                        renderFeed(res);
                        const resultsHTML = feed.innerHTML;
                        feed.innerHTML = originalFeed; // restore search bar
                        document.getElementById('search-results').innerHTML = resultsHTML;
                    } else {
                        searchResults.innerHTML = '<div class="p-10 text-center text-textSub">見つかりませんでした</div>';
                    }
                }
            });
        } 
        else if (view === 'notifications') {
            headerTitle.textContent = '通知';
            if(currentUser) {
                feed.innerHTML = `
                    <article class="p-4 border-b border-borderBase hover:bg-gray-50 animate-fade-in cursor-pointer">
                        <div class="flex gap-3">
                           <div class="w-10 flex justify-center"><span class="material-symbols-rounded text-pink-500 !text-3xl">favorite</span></div>
                           <div class="flex-1">
                               <img src="https://ui-avatars.com/api/?name=Guest&background=random" class="w-8 h-8 rounded-full mb-2">
                               <p class="font-bold text-[15px]">ゲストユーザーさんがあなたの投稿をいいねしました</p>
                           </div>
                        </div>
                    </article>`;
            } else {
                feed.innerHTML = `
                    <div class="flex flex-col items-center p-20 text-center mt-10">
                        <p class="font-bold text-xl mb-2">ログインが必要です</p>
                        <button class="bg-primary text-white font-bold py-2 px-8 rounded-full trigger-login">ログイン</button>
                    </div>`;
            }
        } 
        else if (view === 'profile') {
            const targetUser = viewedUserProfile || currentUser;
            headerTitle.textContent = targetUser ? targetUser.displayName : 'プロフィール';
            profileHeader.classList.remove('hidden');
            updateProfileHeader();
            
            if(targetUser) {
                const activeTab = document.querySelector('.tab-item.active').getAttribute('data-tab');
                updateTabContent(activeTab, targetUser);
            }
        }
        
        // Setup Login triggers for dynamically added elements
        document.querySelectorAll('.trigger-login').forEach(btn => btn.addEventListener('click', openLoginModal));
    }

    // --- Event Delegation for DOM Elements ---
    feed.addEventListener('click', (e) => {
        // Handle Avatar / Mention Clicks
        const profileEl = e.target.closest('.avatar-click, .mention');
        if(profileEl) {
            e.stopPropagation();
            const handle = profileEl.getAttribute('data-handle');
            if(handle) navigateToProfile(handle);
            return;
        }

        // Handle Hastag Clicks
        if(e.target.classList.contains('hashtag')) {
            e.stopPropagation();
            document.querySelector('.nav-item[data-view="search"]').click();
            setTimeout(() => {
                const searchInp = document.getElementById('mock-search-input');
                if(searchInp) { searchInp.value = e.target.textContent; searchInp.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'})); }
            }, 100);
            return;
        }

        // Handle Actions
        const actionBtn = e.target.closest('.action-btn');
        if(actionBtn) {
            e.stopPropagation();
            if(!currentUser) { openLoginModal(); return; }

            const article = actionBtn.closest('article');
            const postId = parseInt(article.getAttribute('data-post-id'));
            const action = actionBtn.getAttribute('data-action');
            
            if(action === 'bookmark') {
                const idx = bookmarks.indexOf(postId);
                if(idx > -1) bookmarks.splice(idx, 1); else bookmarks.push(postId);
                localStorage.setItem('whiteSNS_bookmarks', JSON.stringify(bookmarks));
                actionBtn.classList.toggle('text-primary');
                actionBtn.querySelector('.material-symbols-rounded').classList.toggle('!font-bold');
            } else if (action === 'reply') {
                const post = MOCK_POSTS.find(p => p.id === postId);
                if(post) openComposeModal(post);
            }
        }
    });

    // --- Profile Tabs ---
    tabItems.forEach(tab => {
        tab.addEventListener('click', () => {
            tabItems.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            updateTabContent(tab.getAttribute('data-tab'), viewedUserProfile || currentUser);
        });
    });

    function updateTabContent(tabName, user) {
        if(!user) return;
        
        if(tabName === 'posts') {
            const userPosts = MOCK_POSTS.filter(p => p.handle === user.handle);
            renderFeed(userPosts);
        } else if (tabName === 'bookmarks' && user.handle === currentUser?.handle) {
            const bPosts = MOCK_POSTS.filter(p => bookmarks.includes(p.id));
            renderFeed(bPosts);
        } else {
            const iconMap = { 'replies': 'chat_bubble', 'media': 'image', 'bookmarks': 'bookmark', 'likes': 'favorite' };
            feed.innerHTML = `
                <div class="flex flex-col items-center justify-center p-20 text-center mt-6">
                    <span class="material-symbols-rounded !text-5xl text-gray-300 mb-4">${iconMap[tabName] || 'info'}</span>
                    <p class="font-bold text-xl text-textMain mb-2">まだありません</p>
                </div>`;
        }
    }

    // 初期化
    renderHeaderState();
    renderView('home');
});
