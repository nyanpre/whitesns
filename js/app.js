document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let currentUser = JSON.parse(localStorage.getItem('whiteSNS_user')) || null;
    let bookmarks = JSON.parse(localStorage.getItem('whiteSNS_bookmarks')) || [];
    let drafts = JSON.parse(localStorage.getItem('whiteSNS_drafts')) || [];
    let viewedUserProfile = null;
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

    // Theme Elements
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    // Modals
    const loginModal = document.getElementById('login-modal');
    const composeModal = document.getElementById('compose-modal');
    const draftsModal = document.getElementById('drafts-modal');
    const profileEditModal = document.getElementById('profile-edit-modal');
    
    // Compose Elements
    const composeInput = document.getElementById('compose-input');
    const composeHighlight = document.getElementById('compose-highlight');
    const submitComposeBtn = document.getElementById('submit-compose-btn');
    const draftListBtn = document.getElementById('draft-list-btn');

    // --- MOCK Data ---
    const MOCK_PROFILES = JSON.parse(localStorage.getItem('whiteSNS_profiles')) || {
        "@guest": { displayName: "ゲストユーザー", handle: "@guest", avatar: "https://ui-avatars.com/api/?name=Guest&background=random" },
        "@system": { displayName: "システム", handle: "@system", avatar: "https://ui-avatars.com/api/?name=Sys&background=1d9bf0&color=fff" },
    };

    let MOCK_POSTS = JSON.parse(localStorage.getItem('whiteSNS_posts')) || [
        { id: 1, user: "ゲストユーザー", handle: "@guest", text: "今日からwhiteSNSを使い始めました！ #初めての投稿", time: "1時間前", likes: 15, retweets: 2, replies: 0 },
        { id: 2, user: "システム", handle: "@system", text: "ダークモードやURLプレビューなど、UIが進化したプロトタイプ版です！\n外部へのリンクもこんな感じになります。 https://github.com", time: "3時間前", likes: 120, retweets: 48, replies: 1 },
        { id: 3, parent_id: 2, user: "デモユーザー", handle: "@demo.bsky.social", text: "とても便利ですね！下書き機能も助かります。", time: "2時間前", likes: 5, retweets: 0, replies: 0 }
    ];

    function saveState() {
        localStorage.setItem('whiteSNS_posts', JSON.stringify(MOCK_POSTS));
        localStorage.setItem('whiteSNS_profiles', JSON.stringify(MOCK_PROFILES));
        if(currentUser) localStorage.setItem('whiteSNS_user', JSON.stringify(currentUser));
        localStorage.setItem('whiteSNS_drafts', JSON.stringify(drafts));
    }

    // --- Dark Mode ---
    let isDarkMode = localStorage.getItem('theme') === 'dark';
    if(isDarkMode) {
        document.documentElement.classList.add('dark');
        themeIcon.textContent = 'light_mode';
    }
    themeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        if(isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            themeIcon.textContent = 'light_mode';
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            themeIcon.textContent = 'dark_mode';
        }
    });

    // --- Format Utils ---
    function formatPostText(text) {
        if(!text) return '';
        let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        escaped = escaped.replace(/(#\S+)/g, '<span class="hashtag">$1</span>');
        escaped = escaped.replace(/(@[a-zA-Z0-9_.-]+)/g, '<span class="mention" data-handle="$1">$1</span>');
        
        // Auto convert URLs to links in text
        escaped = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-primary hover:underline" onclick="event.stopPropagation()">$1</a>');
        return escaped;
    }

    function checkOGP(text) {
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
        if(!urlMatch) return '';
        
        const url = urlMatch[1];
        let hostname = 'リンク';
        try { hostname = new URL(url).hostname; } catch(e){}

        return `
            <a href="${url}" target="_blank" class="ogp-card" onclick="event.stopPropagation()">
                <div class="ogp-img-placeholder"><span class="material-symbols-rounded !text-4xl text-white/50">link</span></div>
                <div class="p-3">
                    <div class="text-sm text-textSub dark:text-darkTextSub truncate">${hostname}</div>
                    <div class="font-bold text-textMain dark:text-darkTextMain truncate">ページプレビュー（Mock）</div>
                    <div class="text-sm text-textSub dark:text-darkTextSub line-clamp-2 mt-1">※将来的にここにリンク先のOGP情報が取得されて表示されます。</div>
                </div>
            </a>
        `;
    }

    // --- Compose Overlay Hack ---
    function updateHighlight() {
        const text = composeInput.value;
        const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const highlighted = escaped.replace(/(#[^\s]+)/g, '<span class="text-primary">$1</span>')
                                   .replace(/(@[a-zA-Z0-9_.-]+)/g, '<span class="text-primary">$1</span>')
                                   + "\u200B"; // 0-width space for trailing newline
        composeHighlight.innerHTML = highlighted;
    }

    composeInput.addEventListener('input', () => {
        updateHighlight();
        const length = composeInput.value.length;
        document.getElementById('compose-char-count').textContent = `${length} / 500`;
        submitComposeBtn.disabled = length === 0 || length > 500;
    });

    composeInput.addEventListener('scroll', () => {
        composeHighlight.scrollTop = composeInput.scrollTop;
        composeHighlight.scrollLeft = composeInput.scrollLeft;
    });

    // --- Compose Modal ---
    function openComposeModal(replyTarget = null) {
        if(!currentUser) { document.getElementById('login-modal').classList.add('modal-open'); return; }
        replyTargetPost = replyTarget;
        document.getElementById('compose-avatar').innerHTML = `<img src="${currentUser.avatar}" alt="Avatar" class="w-full h-full object-cover">`;
        
        if (replyTarget) {
            document.getElementById('reply-context').classList.remove('hidden');
            document.getElementById('reply-to-text').textContent = `返信先: ${replyTarget.handle}`;
            composeInput.value = "";
        } else {
            document.getElementById('reply-context').classList.add('hidden');
        }
        
        composeInput.dispatchEvent(new Event('input'));
        composeModal.classList.add('modal-open');
        document.getElementById('compose-modal-content').classList.add('modal-open-content');
        composeInput.focus();
    }

    document.getElementById('close-compose-btn').addEventListener('click', () => {
        composeModal.classList.remove('modal-open');
        document.getElementById('compose-modal-content').classList.remove('modal-open-content');
    });

    document.getElementById('fab-post')?.addEventListener('click', () => openComposeModal());

    // --- Drafts Modal ---
    draftListBtn.addEventListener('click', () => {
        if (replyTargetPost) {
            alert("返信画面では下書き保存できません。");
            return;
        }

        const text = composeInput.value.trim();
        if (text) { // Save current draft
            if (drafts.length >= 30) {
                alert("下書きがいっぱいです（最大30件）。古いものを削除するか投稿してください。");
            } else {
                drafts.unshift({ id: Date.now(), text: text, date: new Date().toLocaleString() });
                composeInput.value = "";
                updateHighlight();
                saveState();
            }
        }
        
        renderDraftsList();
        draftsModal.classList.add('modal-open');
        document.getElementById('drafts-modal-content').classList.add('modal-open-content');
    });

    document.getElementById('close-drafts-btn').addEventListener('click', () => {
        draftsModal.classList.remove('modal-open');
        document.getElementById('drafts-modal-content').classList.remove('modal-open-content');
    });

    function renderDraftsList() {
        const list = document.getElementById('drafts-list');
        if(drafts.length === 0) {
            list.innerHTML = `<div class="p-10 text-center text-textSub">下書きはありません</div>`;
            return;
        }
        list.innerHTML = drafts.map(d => `
            <div class="p-3 border-b border-borderBase dark:border-darkBorder hover:bg-gray-50 dark:hover:bg-gray-800 transition flex items-start gap-2 cursor-pointer draft-item" data-id="${d.id}">
                <div class="flex-1">
                    <p class="text-xs text-textSub mb-1">${d.date}</p>
                    <p class="text-sm line-clamp-2">${formatPostText(d.text)}</p>
                </div>
                <button class="btn-icon text-red-500 delete-draft" data-id="${d.id}"><span class="material-symbols-rounded !text-[20px]">delete</span></button>
            </div>
        `).join('');

        // Event listeners for draft items
        document.querySelectorAll('.draft-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if(e.target.closest('.delete-draft')) return; // ignore delete clicks
                const id = parseInt(el.getAttribute('data-id'));
                const d = drafts.find(x => x.id === id);
                if(d) {
                    composeInput.value = d.text;
                    composeInput.dispatchEvent(new Event('input'));
                    // Remove from drafts once loaded
                    drafts = drafts.filter(x => x.id !== parseInt(id));
                    saveState();
                    document.getElementById('close-drafts-btn').click();
                }
            });
        });

        document.querySelectorAll('.delete-draft').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.getAttribute('data-id'));
                drafts = drafts.filter(x => x.id !== parseInt(id));
                saveState();
                renderDraftsList(); // re-render
            });
        });
    }

    // Submit Post
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

        MOCK_POSTS.unshift(newPost);
        MOCK_PROFILES[currentUser.handle] = currentUser; // Update latest profile info
        saveState();
        
        document.getElementById('close-compose-btn').click();
        composeInput.value = "";
        
        if(currentView === 'home' || currentView === 'profile') renderView(currentView);
    });

    // --- Profile Edit Modal ---
    function openProfileEdit() {
        if(!currentUser) return;
        document.getElementById('edit-display-name').value = currentUser.displayName;
        document.getElementById('edit-avatar-url').value = currentUser.avatar;
        document.getElementById('edit-bio').value = currentUser.bio || "";
        
        profileEditModal.classList.add('modal-open');
        document.getElementById('profile-edit-content').classList.add('modal-open-content');
    }

    document.getElementById('close-profile-edit').addEventListener('click', () => {
        profileEditModal.classList.remove('modal-open');
        document.getElementById('profile-edit-content').classList.remove('modal-open-content');
    });

    document.getElementById('profile-edit-form').addEventListener('submit', (e) => {
        e.preventDefault();
        currentUser.displayName = document.getElementById('edit-display-name').value;
        const ava = document.getElementById('edit-avatar-url').value;
        currentUser.avatar = ava || `https://ui-avatars.com/api/?name=${currentUser.displayName}&background=random`;
        currentUser.bio = document.getElementById('edit-bio').value;
        
        MOCK_PROFILES[currentUser.handle] = currentUser;
        saveState();
        
        document.getElementById('close-profile-edit').click();
        renderHeaderState();
        if(currentView === 'profile') renderView('profile');
    });

    // --- Login (Mock for now) ---
    document.getElementById('close-login-btn').addEventListener('click', () => {
        loginModal.classList.remove('modal-open');
        document.getElementById('login-modal-content').classList.remove('modal-open-content');
    });
    
    document.getElementById('mock-login-btn').addEventListener('click', () => {
        finishLogin({
            did: "did:mock:12345",
            handle: "@raira0626.bsky.social",
            displayName: "TestUser",
            avatar: "https://ui-avatars.com/api/?name=Test&background=1d9bf0&color=fff",
            bio: "whiteSNSのプロトタイプテスターです"
        });
    });

    function finishLogin(userObj) {
        // preserve custom edits if they exist locally
        const existing = MOCK_PROFILES[userObj.handle];
        if(existing) {
            currentUser = existing;
        } else {
            currentUser = userObj;
            MOCK_PROFILES[userObj.handle] = currentUser;
            saveState();
        }
        
        localStorage.setItem('whiteSNS_user', JSON.stringify(currentUser));
        document.getElementById('close-login-btn').click();
        renderHeaderState();
        renderView(currentView);
    }

    function renderHeaderState() {
        if(currentUser) {
            headerAvatar.classList.remove('hidden');
            headerAvatar.innerHTML = `<img src="${currentUser.avatar}" alt="Avatar" class="w-full h-full object-cover">`;
            document.getElementById('fab-post')?.classList.remove('hidden');
        } else {
            headerAvatar.classList.add('hidden');
            document.getElementById('fab-post')?.classList.add('hidden');
        }
    }

    // --- Dynamic Rendering ---
    function updatePostSection() {
        if(currentUser) {
            postSection.innerHTML = `
                <div class="flex gap-3 p-2 cursor-text my-1 bg-white dark:bg-darkBg rounded-xl border border-gray-100 dark:border-darkBorder shadow-sm hover:bg-gray-50 dark:hover:bg-gray-900 transition" onclick="document.getElementById('fab-post').click()">
                    <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0 overflow-hidden">
                        <img src="${currentUser.avatar}" alt="Avatar" class="w-full h-full object-cover">
                    </div>
                    <div class="flex-1 flex items-center">
                        <div class="text-textSub dark:text-darkTextSub text-[16px]">いまどうしてる？</div>
                    </div>
                </div>`;
        } else {
            postSection.innerHTML = `
                <div class="p-4 flex flex-col justify-center items-center text-center">
                    <p class="font-bold mb-2">ログインしてコミュニティに参加しよう</p>
                    <button class="bg-primary text-white font-bold py-1.5 px-6 rounded-full" onclick="document.getElementById('login-modal').classList.add('modal-open'); document.getElementById('login-modal-content').classList.add('modal-open-content');">ログインする</button>
                </div>`;
        }
    }

    function updateProfileHeader() {
        const targetUser = viewedUserProfile || currentUser;
        if(targetUser) {
            const isMe = targetUser.handle === currentUser?.handle;
            profileHeader.innerHTML = `
                <div class="h-32 bg-gradient-to-r from-blue-400 to-indigo-500 w-full relative">
                    <div class="absolute -bottom-10 left-4 w-20 h-20 bg-white dark:bg-darkBg rounded-full p-1 shadow-md overflow-hidden">
                        <img src="${targetUser.avatar}" alt="Avatar" class="w-full h-full rounded-full object-cover">
                    </div>
                    ${isMe ? `
                    <button class="absolute -bottom-10 right-4 border border-borderBase dark:border-darkBorder px-4 py-1.5 rounded-full font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition shadow-sm text-sm" onclick="document.getElementById('profile-edit-btn').click()">
                        プロフィールを編集
                    </button>
                    <!-- hidden trigger -->
                    <button id="profile-edit-btn" class="hidden"></button>
                    ` : ''}
                </div>
                <div class="pt-12 px-4 pb-4 animate-fade-in">
                    <h2 class="font-bold text-xl">${targetUser.displayName}</h2>
                    <p class="text-textSub dark:text-darkTextSub text-sm">${targetUser.handle}</p>
                    <p class="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap">${targetUser.bio || '自己紹介はまだありません'}</p>
                </div>`;
            profileTabs.classList.remove('hidden');
            document.getElementById('profile-edit-btn')?.addEventListener('click', openProfileEdit);
        } else {
            profileTabs.classList.add('hidden');
        }
    }

    function renderFeed(posts) {
        if(posts.length === 0) {
            feed.innerHTML = `<div class="p-10 text-center text-textSub">投稿がありません</div>`;
            return;
        }

        feed.innerHTML = posts.map(post => {
            const profile = MOCK_PROFILES[post.handle] || { avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user)}&background=random` };
            const isBookmarked = bookmarks.includes(post.id);
            let parentHtml = '';

            if (post.parent_id) {
                const parent = MOCK_POSTS.find(p => p.id === post.parent_id);
                if (parent) {
                    parentHtml = `<div class="text-[13px] text-textSub dark:text-darkTextSub mb-1 ml-10"><span class="material-symbols-rounded !text-[14px]">reply</span> <span class="mention hover:underline" data-handle="${parent.handle}">返信先: ${parent.handle}</span></div>`;
                }
            }
            
            return `
            <article class="p-4 border-b border-borderBase dark:border-darkBorder hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors animate-fade-in cursor-pointer" data-post-id="${post.id}">
                ${parentHtml}
                <div class="flex gap-3">
                    <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0 overflow-hidden avatar-click cursor-pointer" data-handle="${post.handle}">
                        <img src="${profile.avatar}" alt="Avatar" class="w-full h-full object-cover pointer-events-none">
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 mb-1">
                            <span class="font-bold text-textMain dark:text-darkTextMain truncate hover:underline avatar-click cursor-pointer" data-handle="${post.handle}">${post.user}</span>
                            <span class="text-textSub dark:text-darkTextSub text-[14px] truncate">${post.handle}</span>
                            <span class="text-textSub dark:text-darkTextSub text-[14px]">·</span>
                            <span class="text-textSub dark:text-darkTextSub text-[14px]">${post.time}</span>
                        </div>
                        <p class="text-[15px] leading-relaxed whitespace-pre-wrap">${formatPostText(post.text)}</p>
                        ${checkOGP(post.text)}
                        
                        <div class="flex justify-between items-center mt-3 text-textSub dark:text-darkTextSub max-w-md pr-4">
                            <button class="flex items-center gap-1.5 hover:text-blue-500 group transition action-btn" data-action="reply">
                                <div class="p-1.5 rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition pointer-events-none"><span class="material-symbols-rounded !text-[20px]">chat_bubble</span></div>
                                <span class="text-sm font-medium pointer-events-none">${post.replies > 0 ? post.replies : ''}</span>
                            </button>
                            <button class="flex items-center gap-1.5 hover:text-pink-500 group transition action-btn" data-action="like">
                                <div class="p-1.5 rounded-full group-hover:bg-pink-50 dark:group-hover:bg-pink-900/30 transition pointer-events-none"><span class="material-symbols-rounded !text-[20px]">favorite</span></div>
                                <span class="text-sm font-medium pointer-events-none">${post.likes > 0 ? post.likes : ''}</span>
                            </button>
                            <button class="flex items-center gap-1.5 ${isBookmarked ? 'text-primary' : ''} hover:text-primary group transition action-btn" data-action="bookmark">
                                <div class="p-1.5 rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition pointer-events-none"><span class="material-symbols-rounded !text-[20px] ${isBookmarked ? '!font-bold' : ''}">bookmark</span></div>
                            </button>
                        </div>
                    </div>
                </div>
            </article>
        `}).join('');
    }

    // Routing
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            viewedUserProfile = null; // back to my profile
            renderView(item.getAttribute('data-view'));
        });
    });

    function renderView(view) {
        currentView = view;
        postSection.classList.add('hidden');
        profileHeader.classList.add('hidden');
        profileTabs.classList.add('hidden');
        feed.innerHTML = '';
        window.scrollTo({top: 0, behavior: 'instant'});

        if (view === 'home') {
            headerTitle.textContent = 'ホーム';
            postSection.classList.remove('hidden');
            updatePostSection();
            renderFeed(MOCK_POSTS);
        } else if (view === 'profile') {
            const targetUser = viewedUserProfile || currentUser;
            headerTitle.textContent = targetUser ? targetUser.displayName : 'プロフィール';
            profileHeader.classList.remove('hidden');
            updateProfileHeader();
            if(targetUser) updateTabContent('posts', targetUser);
        } else if (view === 'notifications') {
            headerTitle.textContent = '通知';
            if(currentUser) {
                feed.innerHTML = `
                    <div class="p-4 border-b border-borderBase dark:border-darkBorder bg-blue-50/50 dark:bg-blue-900/10">
                        <div class="flex gap-3">
                           <div class="w-10 flex justify-center"><span class="material-symbols-rounded text-blue-500 !text-3xl">chat_bubble</span></div>
                           <div class="flex-1 text-sm">
                               <img src="https://ui-avatars.com/api/?name=Guest&background=random" class="w-8 h-8 rounded-full mb-2">
                               <p><span class="font-bold">ゲストユーザー</span>さんがあなたの投稿に返信しました</p>
                           </div>
                        </div>
                    </div>`;
            } else { feed.innerHTML = '<div class="p-10 text-center"><p class="font-bold mb-4">ログインが必要です</p></div>'; }
        } else if (view === 'search') {
            headerTitle.textContent = '検索';
            feed.innerHTML = `
                <div class="p-4"><input type="text" id="srch" placeholder="キーワード検索" class="w-full p-3 rounded-full bg-gray-100 dark:bg-gray-800 outline-none"></div>
                <div id="srch-res" class="mt-4"><p class="text-center font-bold">トレンド: #初めての投稿</p></div>
            `;
            document.getElementById('srch').addEventListener('keydown', (e) => {
                if(e.key === 'Enter') {
                    const q = e.target.value.toLowerCase();
                    const r = MOCK_POSTS.filter(p => p.text.toLowerCase().includes(q));
                    const originalFeed = feed.innerHTML;
                    renderFeed(r);
                    const resHTML = feed.innerHTML;
                    feed.innerHTML = originalFeed;
                    document.getElementById('srch-res').innerHTML = resHTML;
                }
            });
        }
    }

    feed.addEventListener('click', (e) => {
        const profEl = e.target.closest('.avatar-click, .mention');
        if(profEl) {
            e.stopPropagation();
            if(!currentUser) return;
            const h = profEl.getAttribute('data-handle');
            viewedUserProfile = MOCK_PROFILES[h] || { displayName: h.substring(1), handle: h, avatar: `https://ui-avatars.com/api/?name=${h}&background=random` };
            navItems.forEach(i => i.classList.remove('active'));
            document.querySelector('.nav-item[data-view="profile"]').classList.add('active');
            renderView('profile');
            return;
        }

        const actBtn = e.target.closest('.action-btn');
        if(actBtn) {
            e.stopPropagation();
            if(!currentUser) return;
            const pid = parseInt(actBtn.closest('article').getAttribute('data-post-id'));
            const action = actBtn.getAttribute('data-action');
            if(action === 'bookmark') {
                const idx = bookmarks.indexOf(pid);
                if(idx > -1) bookmarks.splice(idx, 1); else bookmarks.push(pid);
                localStorage.setItem('whiteSNS_bookmarks', JSON.stringify(bookmarks));
                actBtn.classList.toggle('text-primary');
                actBtn.querySelector('.material-symbols-rounded').classList.toggle('!font-bold');
            } else if (action === 'reply') {
                const post = MOCK_POSTS.find(p => p.id === pid);
                if(post) openComposeModal(post);
            }
        }
    });

    tabItems.forEach(tab => {
        tab.addEventListener('click', () => {
            tabItems.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            updateTabContent(tab.getAttribute('data-tab'), viewedUserProfile || currentUser);
        });
    });

    function updateTabContent(tabName, user) {
        if(!user) return;
        if(tabName === 'posts') { renderFeed(MOCK_POSTS.filter(p => p.handle === user.handle)); }
        else if(tabName === 'bookmarks' && user.handle === currentUser?.handle) { renderFeed(MOCK_POSTS.filter(p => bookmarks.includes(p.id))); }
        else { feed.innerHTML = `<div class="p-10 text-center font-bold">まだありません</div>`; }
    }

    // Init
    renderHeaderState();
    renderView('home');
});
