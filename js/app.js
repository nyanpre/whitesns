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
        "@guest": { displayName: "Guest User", handle: "@guest", avatar: "https://ui-avatars.com/api/?name=Guest&background=random" },
        "@system": { displayName: "System", handle: "@system", avatar: "https://ui-avatars.com/api/?name=Sys&background=6366f1&color=fff" },
    };

    let MOCK_POSTS = JSON.parse(localStorage.getItem('whiteSNS_posts')) || [
        { id: 1, user: "Guest User", handle: "@guest", text: "今日からwhiteSNSを使い始めました！ #初めての投稿", time: "1時間前", likes: 15, retweets: 2, replies: 0 },
        { id: 2, user: "System", handle: "@system", text: "ダークモードやURLプレビューなど、UIが進化したプロトタイプ版です！\n外部へのリンクもこんな感じになります。 https://github.com", time: "3時間前", likes: 120, retweets: 48, replies: 1 },
        { id: 3, parent_id: 2, user: "TestUser", handle: "@demo.bsky.social", text: "とても便利ですね！下書き機能も助かります。", time: "2時間前", likes: 5, retweets: 0, replies: 0 }
    ];

    function saveState() {
        localStorage.setItem('whiteSNS_posts', JSON.stringify(MOCK_POSTS));
        localStorage.setItem('whiteSNS_profiles', JSON.stringify(MOCK_PROFILES));
        if(currentUser) localStorage.setItem('whiteSNS_user', JSON.stringify(currentUser));
        localStorage.setItem('whiteSNS_drafts', JSON.stringify(drafts));
    }

    // --- Dark Mode ---
    function initTheme() {
        const saved = localStorage.getItem('theme');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (saved === 'dark' || (!saved && systemDark)) {
            document.documentElement.classList.add('dark');
            themeIcon.textContent = 'light_mode';
        } else {
            document.documentElement.classList.remove('dark');
            themeIcon.textContent = 'dark_mode';
        }
    }
    initTheme();
    // Watch for OS theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if(!localStorage.getItem('theme')) initTheme();
    });

    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.contains('dark');
        if(isDark) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            themeIcon.textContent = 'dark_mode';
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            themeIcon.textContent = 'light_mode';
        }
    });

    // --- Format Utils ---
    function formatPostText(text) {
        if(!text) return '';
        let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        escaped = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-primary font-medium hover:underline" onclick="event.stopPropagation()">$1</a>');
        escaped = escaped.replace(/(#\S+)/g, '<span class="hashtag text-primary font-medium cursor-pointer hover:underline">$1</span>');
        escaped = escaped.replace(/(@[a-zA-Z0-9_.-]+)/g, '<span class="mention text-primary font-medium cursor-pointer hover:underline" data-handle="$1">$1</span>');
        return escaped;
    }

    function checkOGP(text) {
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
        if(!urlMatch) return '';
        const url = urlMatch[1];
        let hostname = 'Link';
        try { hostname = new URL(url).hostname; } catch(e){}

        return `
            <a href="${url}" target="_blank" class="block mt-3 border border-borderBase dark:border-darkBorder rounded-2xl overflow-hidden hover:bg-black/5 dark:hover:bg-white/5 transition" onclick="event.stopPropagation()">
                <div class="h-32 bg-gradient-to-br from-indigo-100 to-pink-100 dark:from-slate-800 dark:to-slate-700 flex flex-col items-center justify-center text-textSub dark:text-darkTextSub">
                    <span class="material-symbols-rounded !text-4xl opacity-50 mb-1">link</span>
                    <span class="text-xs font-mono opacity-80">${hostname}</span>
                </div>
                <div class="p-4 bg-white dark:bg-slate-900 border-t border-borderBase dark:border-darkBorder">
                    <div class="font-bold truncate mb-1">Preview Card (Mock)</div>
                    <div class="text-[13px] text-textSub dark:text-darkTextSub line-clamp-2">This is a mock OGP preview card. In the future, this will show the actual preview image and description of the link.</div>
                </div>
            </a>
        `;
    }

    // --- Compose Overlay Hack ---
    function updateHighlight() {
        const text = composeInput.value;
        const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const highlighted = escaped.replace(/(#[^\s]+)/g, '<span class="text-primary font-medium">$1</span>')
                                   .replace(/(@[a-zA-Z0-9_.-]+)/g, '<span class="text-primary font-medium">$1</span>')
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
            document.getElementById('reply-to-text').textContent = `Replying to: ${replyTarget.handle}`;
            composeInput.value = "";
        } else {
            document.getElementById('reply-context').classList.add('hidden');
        }
        
        composeInput.dispatchEvent(new Event('input'));
        composeModal.classList.add('modal-open');
        composeInput.focus();
    }

    document.getElementById('close-compose-btn').addEventListener('click', () => {
        composeModal.classList.remove('modal-open');
    });

    document.getElementById('fab-post')?.addEventListener('click', () => openComposeModal());

    // --- Drafts Modal ---
    draftListBtn.addEventListener('click', () => {
        if (replyTargetPost) {
            alert("返信画面では下書き保存できません。");
            return;
        }
        const text = composeInput.value.trim();
        if (text) { 
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
    });

    document.getElementById('close-drafts-btn').addEventListener('click', () => {
        draftsModal.classList.remove('modal-open');
    });

    function renderDraftsList() {
        const list = document.getElementById('drafts-list');
        if(drafts.length === 0) {
            list.innerHTML = `<div class="p-10 text-center text-textSub font-bold opacity-50">No drafts</div>`;
            return;
        }
        list.innerHTML = drafts.map(d => `
            <div class="p-4 border-b border-borderBase dark:border-darkBorder hover:bg-black/5 dark:hover:bg-white/5 transition flex items-start gap-3 cursor-pointer draft-item" data-id="${d.id}">
                <div class="flex-1">
                    <p class="text-xs text-textSub dark:text-darkTextSub mb-1 font-mono">${d.date}</p>
                    <p class="text-[15px] font-medium line-clamp-2">${formatPostText(d.text)}</p>
                </div>
                <button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 transition delete-draft" data-id="${d.id}"><span class="material-symbols-rounded !text-[20px]">delete</span></button>
            </div>
        `).join('');

        document.querySelectorAll('.draft-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if(e.target.closest('.delete-draft')) return;
                const id = parseInt(el.getAttribute('data-id'));
                const d = drafts.find(x => x.id === id);
                if(d) {
                    composeInput.value = d.text;
                    composeInput.dispatchEvent(new Event('input'));
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
                renderDraftsList();
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
            time: "ただいま",
            likes: 0, retweets: 0, replies: 0
        };

        if (replyTargetPost) {
            newPost.parent_id = replyTargetPost.id;
            const parent = MOCK_POSTS.find(p => p.id == replyTargetPost.id);
            if(parent) parent.replies++;
        }

        MOCK_POSTS.unshift(newPost);
        MOCK_PROFILES[currentUser.handle] = currentUser; 
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
    }

    document.getElementById('close-profile-edit').addEventListener('click', () => {
        profileEditModal.classList.remove('modal-open');
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
    });
    
    document.getElementById('mock-login-btn').addEventListener('click', () => {
        finishLogin({
            did: "did:mock:12345",
            handle: "@raira0626.bsky.social",
            displayName: "TestUser",
            avatar: "https://ui-avatars.com/api/?name=Test&background=ec4899&color=fff",
            bio: "whiteSNSのプロトタイプテスターです"
        });
    });

    function finishLogin(userObj) {
        const existing = MOCK_PROFILES[userObj.handle];
        if(existing) currentUser = existing;
        else {
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
                <div class="flex gap-3 p-3 my-2 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-white dark:border-white/5 shadow-sm hover:shadow-md transition duration-300" onclick="document.getElementById('fab-post').click()">
                    <div class="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden shadow-sm">
                        <img src="${currentUser.avatar}" alt="Avatar" class="w-full h-full object-cover">
                    </div>
                    <div class="flex-1 flex items-center">
                        <div class="text-textSub dark:text-darkTextSub text-[16px] font-medium opacity-70">What's happening?</div>
                    </div>
                </div>`;
            postSection.classList.remove('hidden');    
        } else {
            postSection.innerHTML = `
                <div class="p-6 flex flex-col justify-center items-center text-center">
                    <p class="font-bold mb-3 text-lg">Join the Conversation</p>
                    <button class="bg-gradient-to-r from-primary to-secondary text-white font-bold py-2 px-8 rounded-full shadow-lg hover:scale-105 transition" onclick="document.getElementById('login-modal').classList.add('modal-open');">Log in</button>
                </div>`;
            postSection.classList.remove('hidden');
        }
    }

    function updateProfileHeader() {
        const targetUser = viewedUserProfile || currentUser;
        if(targetUser) {
            const isMe = targetUser.handle === currentUser?.handle;
            profileHeader.innerHTML = `
                <div class="h-40 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 w-full relative">
                    <div class="absolute -bottom-12 left-5 w-24 h-24 bg-white dark:bg-slate-900 rounded-full p-1.5 shadow-xl overflow-hidden">
                        <div class="w-full h-full rounded-full overflow-hidden">
                            <img src="${targetUser.avatar}" alt="Avatar" class="w-full h-full object-cover">
                        </div>
                    </div>
                    ${isMe ? `
                    <button class="absolute -bottom-10 right-5 border border-borderBase dark:border-darkBorder bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-5 py-2 rounded-full font-bold hover:bg-black/5 dark:hover:bg-white/10 transition shadow-sm text-sm" onclick="document.getElementById('profile-edit-btn').click()">
                        Edit Profile
                    </button>
                    <button id="profile-edit-btn" class="hidden"></button>
                    ` : ''}
                </div>
                <div class="pt-16 px-6 pb-6 animate-fade-in">
                    <h2 class="font-bold text-2xl">${targetUser.displayName}</h2>
                    <p class="text-textSub dark:text-darkTextSub text-[15px] font-mono mt-0.5 opacity-80">${targetUser.handle}</p>
                    <p class="mt-4 text-[16px] leading-relaxed whitespace-pre-wrap">${targetUser.bio || 'No bio yet.'}</p>
                </div>`;
            profileTabs.classList.remove('hidden');
            document.getElementById('profile-edit-btn')?.addEventListener('click', openProfileEdit);
        } else {
            profileTabs.classList.add('hidden');
        }
    }

    function renderFeed(posts) {
        if(posts.length === 0) {
            feed.innerHTML = `<div class="p-10 text-center text-textSub font-bold opacity-50">No posts yet</div>`;
            return;
        }

        feed.innerHTML = posts.map(post => {
            const profile = MOCK_PROFILES[post.handle] || { avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user)}&background=random` };
            const isBookmarked = bookmarks.includes(post.id);
            let parentHtml = '';

            if (post.parent_id) {
                const parent = MOCK_POSTS.find(p => p.id === post.parent_id);
                if (parent) {
                    parentHtml = `<div class="text-[13px] text-secondary dark:text-pink-400 mb-2 ml-12 font-medium"><span class="material-symbols-rounded !text-[16px] align-text-bottom">reply</span> <span class="mention cursor-pointer hover:underline" data-handle="${parent.handle}">Replying to ${parent.handle}</span></div>`;
                }
            }
            
            return `
            <article class="p-5 mb-4 glass-card hover:shadow-lg transition-all animate-fade-in cursor-pointer relative" data-post-id="${post.id}">
                ${parentHtml}
                <div class="flex gap-4">
                    <div class="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0 overflow-hidden avatar-click cursor-pointer shadow-sm border border-black/5 dark:border-white/5" data-handle="${post.handle}">
                        <img src="${profile.avatar}" alt="Avatar" class="w-full h-full object-cover pointer-events-none">
                    </div>
                    <div class="flex-1 min-w-0 pt-0.5">
                        <div class="flex items-center gap-2 mb-1.5">
                            <span class="font-bold text-[17px] truncate hover:underline avatar-click cursor-pointer" data-handle="${post.handle}">${post.user}</span>
                            <span class="text-textSub dark:text-darkTextSub text-[14px] font-mono opacity-80 truncate">${post.handle}</span>
                            <span class="text-textSub dark:text-darkTextSub text-[14px] opacity-50">·</span>
                            <span class="text-textSub dark:text-darkTextSub text-[14px] opacity-80">${post.time}</span>
                        </div>
                        <p class="text-[16px] leading-relaxed whitespace-pre-wrap">${formatPostText(post.text)}</p>
                        ${checkOGP(post.text)}
                        
                        <div class="flex justify-between items-center mt-4 text-textSub dark:text-darkTextSub max-w-md pr-6">
                            <button class="flex items-center gap-1.5 hover:text-primary group transition action-btn" data-action="reply">
                                <div class="w-9 h-9 flex items-center justify-center rounded-full group-hover:bg-primary/10 transition pointer-events-none"><span class="material-symbols-rounded !text-[20px]">chat_bubble</span></div>
                                <span class="text-[15px] font-medium pointer-events-none mt-0.5">${post.replies > 0 ? post.replies : ''}</span>
                            </button>
                            <button class="flex items-center gap-1.5 hover:text-secondary group transition action-btn" data-action="like">
                                <div class="w-9 h-9 flex items-center justify-center rounded-full group-hover:bg-secondary/10 transition pointer-events-none"><span class="material-symbols-rounded !text-[20px]">favorite</span></div>
                                <span class="text-[15px] font-medium pointer-events-none mt-0.5">${post.likes > 0 ? post.likes : ''}</span>
                            </button>
                            <button class="flex items-center gap-1.5 ${isBookmarked ? 'text-primary' : ''} hover:text-primary group transition action-btn" data-action="bookmark">
                                <div class="w-9 h-9 flex items-center justify-center rounded-full group-hover:bg-primary/10 transition pointer-events-none"><span class="material-symbols-rounded !text-[20px] ${isBookmarked ? '!font-bold' : ''}">bookmark</span></div>
                            </button>
                        </div>
                    </div>
                </div>
            </article>
        `}).join('');
    }

    async function refreshFeed() {
        feed.innerHTML = '<div class="flex justify-center p-10"><div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>';
        await new Promise(r => setTimeout(r, 500));
        renderFeed(MOCK_POSTS);
        window.scrollTo({top: 0, behavior: 'smooth'});
    }

    // Routing
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.getAttribute('data-view');
            // If home is clicked again while on home, refresh feed
            if (view === 'home' && currentView === 'home') {
                refreshFeed();
                return;
            }
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            viewedUserProfile = null; // back to my profile
            renderView(view);
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
            headerTitle.textContent = 'Home';
            updatePostSection();
            renderFeed(MOCK_POSTS);
        } else if (view === 'profile') {
            const targetUser = viewedUserProfile || currentUser;
            headerTitle.textContent = 'Profile';
            profileHeader.classList.remove('hidden');
            updateProfileHeader();
            if(targetUser) updateTabContent('posts', targetUser);
        } else if (view === 'notifications') {
            headerTitle.textContent = 'Notifications';
            if(currentUser) {
                feed.innerHTML = `
                    <div class="p-5 mb-4 glass-card bg-primary/5 dark:bg-primary/10">
                        <div class="flex gap-4">
                           <div class="w-10 flex justify-center"><span class="material-symbols-rounded text-primary !text-3xl">chat_bubble</span></div>
                           <div class="flex-1">
                               <img src="https://ui-avatars.com/api/?name=Guest&background=random" class="w-10 h-10 rounded-full mb-3 border border-white dark:border-darkBorder">
                               <p class="text-[16px]"><span class="font-bold">Guest User</span>さんがあなたの投稿に返信しました</p>
                           </div>
                        </div>
                    </div>`;
            } else { feed.innerHTML = '<div class="p-10 text-center font-bold opacity-50">Log in to see notifications</div>'; }
        } else if (view === 'search') {
            headerTitle.textContent = 'Search';
            feed.innerHTML = `
                <div class="p-2 mb-6">
                    <div class="relative">
                        <span class="material-symbols-rounded absolute left-4 top-1/2 -translate-y-1/2 text-textSub opacity-60">search</span>
                        <input type="text" id="srch" placeholder="Search keywords..." class="w-full pl-12 pr-4 py-4 rounded-full glass-card outline-none focus:ring-2 focus:ring-primary transition-shadow font-medium text-[16px]">
                    </div>
                </div>
                <div id="srch-res"><h3 class="font-bold text-lg px-4 mb-4">Trending</h3><div class="px-4"><span class="hashtag text-primary font-bold cursor-pointer hover:underline text-[17px]">#初めての投稿</span></div></div>
            `;
            document.getElementById('srch').addEventListener('keydown', (e) => {
                if(e.key === 'Enter') {
                    const q = e.target.value.toLowerCase();
                    const r = MOCK_POSTS.filter(p => p.text.toLowerCase().includes(q));
                    const currentTop = feed.innerHTML;
                    renderFeed(r);
                    const resHTML = feed.innerHTML;
                    feed.innerHTML = currentTop;
                    document.getElementById('srch-res').innerHTML = `<h3 class="font-bold text-lg px-4 mb-4">Results for "${q}"</h3>${resHTML}`;
                }
            });
        }
    }

    feed.addEventListener('click', (e) => {
        // Event delegation for Profile Routing
        const profEl = e.target.closest('.avatar-click, .mention');
        if(profEl) {
            e.stopPropagation();
            if(!currentUser) { document.getElementById('login-modal').classList.add('modal-open'); return; }
            const h = profEl.getAttribute('data-handle');
            viewedUserProfile = MOCK_PROFILES[h] || { displayName: h.substring(1), handle: h, avatar: `https://ui-avatars.com/api/?name=${h}&background=random` };
            navItems.forEach(i => i.classList.remove('active'));
            document.querySelector('.nav-item[data-view="profile"]').classList.add('active');
            renderView('profile');
            return;
        }

        // Event delegation for Hashtag Search Routing
        if(e.target.classList.contains('hashtag')) {
            e.stopPropagation();
            const tag = e.target.textContent;
            navItems.forEach(i => i.classList.remove('active'));
            const searchBtn = document.querySelector('.nav-item[data-view="search"]');
            searchBtn.classList.add('active');
            renderView('search');
            // Auto fill and trigger search
            setTimeout(() => {
                const searchInput = document.getElementById('srch');
                if(searchInput) {
                    searchInput.value = tag;
                    searchInput.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
                }
            }, 50);
            return;
        }

        const actBtn = e.target.closest('.action-btn');
        if(actBtn) {
            e.stopPropagation();
            if(!currentUser) { document.getElementById('login-modal').classList.add('modal-open'); return; }
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
        else { feed.innerHTML = `<div class="p-10 text-center font-bold opacity-50">Yet to come</div>`; }
    }

    // Init
    renderHeaderState();
    renderView('home');
});
