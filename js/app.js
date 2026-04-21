// 既存の宣言と衝突しないよう、安全に window.app を定義します
if (!window.app) {
    window.app = {};
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const API_BASE = "https://nyanpre-whitesns-api.hf.space";

    // --- State Management ---
    let accounts = JSON.parse(localStorage.getItem('whiteSNS_accounts')) || [];
    let currentUser = JSON.parse(localStorage.getItem('whiteSNS_user')) || null;
    let token = localStorage.getItem('whiteSNS_token') || null;
    let bookmarks = JSON.parse(localStorage.getItem('whiteSNS_bookmarks')) || [];
    let drafts = JSON.parse(localStorage.getItem('whiteSNS_drafts')) || [];

    let SERVER_POSTS = [];
    let viewedUserProfile = null;
    let currentView = 'home';
    let replyTargetPost = null;
    let notifPollInterval = null;
    let viewHistory = []; 
    let draftAutoSaveTimer = null;

    // --- DOM Elements ---
    const headerTitle = document.getElementById('header-title');
    const headerAvatar = document.getElementById('header-avatar');
    const postSection = document.getElementById('post-section');
    const profileHeader = document.getElementById('profile-header');
    const profileTabs = document.getElementById('profile-tabs');
    const feed = document.getElementById('feed');
    const navItems = document.querySelectorAll('.nav-item');
    const tabItems = document.querySelectorAll('.tab-item');
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const loginModal = document.getElementById('login-modal');
    const composeModal = document.getElementById('compose-modal');
    const draftsModal = document.getElementById('drafts-modal');
    const profileEditModal = document.getElementById('profile-edit-modal');
    const composeInput = document.getElementById('compose-input');
    const composeHighlight = document.getElementById('compose-highlight');
    const submitComposeBtn = document.getElementById('submit-compose-btn');
    const draftListBtn = document.getElementById('draft-list-btn');

    // --- Toast Notifications ---
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const icons = { success: '✅', error: '❌', info: 'ℹ️' };
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span>${icons[type] || '💬'}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- Helpers ---
    function saveLocalState() {
        if (currentUser) {
            localStorage.setItem('whiteSNS_user', JSON.stringify(currentUser));
            const idx = accounts.findIndex(a => a.handle === currentUser.handle);
            const accountData = { user: currentUser, token, bookmarks };
            if (idx > -1) accounts[idx] = accountData;
            else accounts.push(accountData);
            localStorage.setItem('whiteSNS_accounts', JSON.stringify(accounts));
        }
        localStorage.setItem('whiteSNS_drafts', JSON.stringify(drafts));
        localStorage.setItem('whiteSNS_bookmarks', JSON.stringify(bookmarks));
        if (token) localStorage.setItem('whiteSNS_token', token);
    }

    async function apiFetch(endpoint, method = 'GET', body = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, options);
            if (!res.ok) {
                if (res.status === 401) { logout(); return null; }
                throw new Error(`API Error: ${res.status}`);
            }
            return await res.json();
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    function logout() {
        if (currentUser) {
            accounts = accounts.filter(a => a.handle !== currentUser.handle);
            localStorage.setItem('whiteSNS_accounts', JSON.stringify(accounts));
        }
        if (accounts.length > 0) {
            switchAccount(accounts[0].handle);
        } else {
            currentUser = null;
            token = null;
            bookmarks = [];
            localStorage.removeItem('whiteSNS_user');
            localStorage.removeItem('whiteSNS_token');
            localStorage.removeItem('whiteSNS_bookmarks');
            if (notifPollInterval) { clearInterval(notifPollInterval); notifPollInterval = null; }
            renderHeaderState();
            renderView('home');
            document.getElementById('login-modal').classList.add('modal-open');
        }
    }

    function switchAccount(handle) {
        const acc = accounts.find(a => a.handle === handle);
        if (!acc) return;
        currentUser = acc.user;
        token = acc.token;
        bookmarks = acc.bookmarks || [];
        saveLocalState();
        location.reload();
    }

    function formatTimeAgo(dateString) {
        if (!dateString) return "不明";
        const d = new Date(dateString);
        if (isNaN(d)) return "たった今";
        const diff = Math.floor((new Date() - d) / 1000);
        if (diff < 60) return "たった今";
        if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
        return `${d.getMonth() + 1}月${d.getDate()}日`;
    }

    async function updateNotifBadge() {
        if (!token) return;
        const res = await apiFetch('/api/notifications/unread_count');
        const badge = document.getElementById('notif-badge');
        if (!badge) return;
        if (res && res.count > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    function startNotifPolling() {
        if (notifPollInterval) clearInterval(notifPollInterval);
        updateNotifBadge();
        notifPollInterval = setInterval(updateNotifBadge, 30000);
    }

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

    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.contains('dark');
        if (isDark) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            themeIcon.textContent = 'dark_mode';
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            themeIcon.textContent = 'light_mode';
        }
    });

    function formatPostText(text) {
        if (!text) return '';
        let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        escaped = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-primary font-medium hover:underline" onclick="event.stopPropagation()">$1</a>');
        escaped = escaped.replace(/(#\S+)/g, '<span class="hashtag text-primary font-medium cursor-pointer hover:underline">$1</span>');
        escaped = escaped.replace(/(@[a-zA-Z0-9_.-]+)/g, '<span class="mention text-primary font-medium cursor-pointer hover:underline" data-handle="$1">$1</span>');
        return escaped;
    }

    function checkOGP(text) {
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
        if (!urlMatch) return '';
        const url = urlMatch[1];
        let hostname = 'リンク';
        try { hostname = new URL(url).hostname; } catch (e) { }
        return `
            <a href="${url}" target="_blank" class="block mt-2 mx-1 border border-borderBase/50 dark:border-darkBorder/50 rounded-xl overflow-hidden hover:bg-black/5 dark:hover:bg-white/5 transition" onclick="event.stopPropagation()">
                <div class="h-24 bg-gradient-to-br from-indigo-100 to-pink-100 dark:from-slate-800 dark:to-slate-700 flex flex-col items-center justify-center text-textSub dark:text-darkTextSub">
                    <span class="material-symbols-rounded !text-2xl opacity-50 mb-0.5">link</span>
                    <span class="text-[10px] font-mono opacity-80">${hostname}</span>
                </div>
                <div class="p-2 bg-white/50 dark:bg-slate-900/50 border-t border-borderBase/50 dark:border-darkBorder/50">
                    <div class="text-[13px] font-bold truncate mb-0.5">${hostname}</div>
                    <div class="text-[11px] text-textSub dark:text-darkTextSub line-clamp-1">${url}</div>
                </div>
            </a>
        `;
    }

    function renderSkeleton(count = 5) {
        return Array.from({ length: count }).map(() => `
            <div class="skeleton-post">
                <div class="skeleton-avatar"></div>
                <div class="flex-1 pt-1">
                    <div class="skeleton-line" style="width: 40%"></div>
                    <div class="skeleton-line" style="width: 90%"></div>
                </div>
            </div>
        `).join('');
    }

    function updateHighlight() {
        const text = composeInput.value;
        const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const highlighted = escaped.replace(/(#[^\s]+)/g, '<span class="text-primary font-medium">$1</span>')
            .replace(/(@[a-zA-Z0-9_.-]+)/g, '<span class="text-primary font-medium">$1</span>')
            + "\u200B";
        composeHighlight.innerHTML = highlighted;
    }

    composeInput.addEventListener('input', () => {
        updateHighlight();
        const length = composeInput.value.length;
        document.getElementById('compose-char-count').textContent = `${length} / 500`;
        submitComposeBtn.disabled = length === 0 || length > 500;

        if (draftAutoSaveTimer) clearTimeout(draftAutoSaveTimer);
        draftAutoSaveTimer = setTimeout(() => {
            const text = composeInput.value.trim();
            if (text && !replyTargetPost) {
                const existingIdx = drafts.findIndex(d => d.isAuto);
                const draftData = { id: Date.now(), text, date: new Date().toLocaleString(), isAuto: true };
                if (existingIdx > -1) drafts[existingIdx] = draftData;
                else drafts.unshift(draftData);
                saveLocalState();
            }
        }, 2000);
    });

    composeInput.addEventListener('scroll', () => {
        composeHighlight.scrollTop = composeInput.scrollTop;
    });

    function openComposeModal(replyTarget = null) {
        if (!currentUser) { document.getElementById('login-modal').classList.add('modal-open'); return; }
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
        composeInput.focus();
    }

    document.getElementById('close-compose-btn').addEventListener('click', () => { composeModal.classList.remove('modal-open'); });
    document.getElementById('fab-post')?.addEventListener('click', () => openComposeModal());

    draftListBtn.addEventListener('click', () => {
        if (replyTargetPost) { showToast('返信画面では下書き保存できません。', 'info'); return; }
        const text = composeInput.value.trim();
        if (text) {
            if (drafts.length >= 30) {
                showToast('下書きが上限に達しています。', 'error');
            } else {
                drafts.unshift({ id: Date.now(), text: text, date: new Date().toLocaleString() });
                composeInput.value = "";
                updateHighlight();
                saveLocalState();
                showToast('下書きを保存しました', 'success');
            }
        }
        renderDraftsList();
        draftsModal.classList.add('modal-open');
    });

    document.getElementById('close-drafts-btn').addEventListener('click', () => { draftsModal.classList.remove('modal-open'); });

    function renderDraftsList() {
        const list = document.getElementById('drafts-list');
        if (drafts.length === 0) { list.innerHTML = `<div class="p-8 text-center text-textSub font-bold opacity-50 text-[13px]">下書きはありません</div>`; return; }
        list.innerHTML = drafts.map(d => `
            <div class="px-4 py-3 border-b border-borderBase/50 dark:border-darkBorder/50 hover:bg-black/5 dark:hover:bg-white/5 transition flex items-start gap-2 cursor-pointer draft-item" data-id="${d.id}">
                <div class="flex-1">
                    <p class="text-[10px] text-textSub dark:text-darkTextSub mb-0.5 font-mono">${d.date}</p>
                    <p class="text-[13px] font-medium line-clamp-2">${formatPostText(d.text)}</p>
                </div>
                <button class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 text-red-500 transition delete-draft" data-id="${d.id}"><span class="material-symbols-rounded !text-[18px]">delete</span></button>
            </div>
        `).join('');

        document.querySelectorAll('.draft-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.delete-draft')) return;
                const id = parseInt(el.getAttribute('data-id'));
                const d = drafts.find(x => x.id === id);
                if (d) {
                    composeInput.value = d.text;
                    composeInput.dispatchEvent(new Event('input'));
                    drafts = drafts.filter(x => x.id !== id);
                    saveLocalState();
                    document.getElementById('close-drafts-btn').click();
                }
            });
        });
        document.querySelectorAll('.delete-draft').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.getAttribute('data-id'));
                drafts = drafts.filter(x => x.id !== id);
                saveLocalState();
                renderDraftsList();
            });
        });
    }

    submitComposeBtn.addEventListener('click', async () => {
        if (!currentUser) return;
        const text = composeInput.value.trim();
        if (text === '') return;
        submitComposeBtn.disabled = true;
        const payload = { text: text };
        if (replyTargetPost) payload.parent_id = replyTargetPost.id;
        const res = await apiFetch('/api/posts', 'POST', payload);
        submitComposeBtn.disabled = false;
        if (res && res.success) {
            document.getElementById('close-compose-btn').click();
            composeInput.value = "";
            showToast('投稿しました ✓');
            refreshFeed();
        } else {
            showToast('投稿に失敗しました', 'error');
        }
    });

    function openProfileEdit() {
        if (!currentUser) return;
        document.getElementById('edit-display-name').value = currentUser.displayName;
        document.getElementById('edit-avatar-url').value = currentUser.avatar;
        document.getElementById('edit-banner-url').value = currentUser.banner || '';
        document.getElementById('edit-bio').value = currentUser.bio || "";
        profileEditModal.classList.add('modal-open');
    }

    document.getElementById('close-profile-edit').addEventListener('click', () => profileEditModal.classList.remove('modal-open'));

    document.getElementById('profile-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            display_name: document.getElementById('edit-display-name').value,
            avatar: document.getElementById('edit-avatar-url').value,
            banner: document.getElementById('edit-banner-url').value,
            bio: document.getElementById('edit-bio').value
        };
        const res = await apiFetch('/api/profile', 'PUT', payload);
        if (res && res.success) {
            Object.assign(currentUser, payload);
            saveLocalState();
            document.getElementById('close-profile-edit').click();
            showToast('更新しました ✓');
            renderHeaderState();
            if (currentView === 'profile') renderView('profile');
        }
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const handle = document.getElementById('bsky-handle').value;
        const password = document.getElementById('bsky-app-password').value;
        const errorDiv = document.getElementById('login-error');
        const spinner = document.getElementById('login-spinner');
        errorDiv.classList.add('hidden');
        spinner.classList.remove('hidden');

        try {
            const res = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ handle, app_password: password })
            });
            const data = await res.json();
            if (data.success) {
                token = data.token;
                const profRes = await fetch(`${API_BASE}/api/profile/${data.handle}`);
                const profData = profRes.ok ? await profRes.json() : null;
                currentUser = {
                    handle: data.handle,
                    displayName: profData?.display_name || data.handle,
                    avatar: profData?.avatar || `https://ui-avatars.com/api/?name=${data.handle}`,
                    bio: profData?.bio || "",
                    banner: profData?.banner || ""
                };
                saveLocalState();
                document.getElementById('close-login-btn').click();
                renderHeaderState();
                startNotifPolling();
                refreshFeed();
            } else {
                errorDiv.textContent = data.error || "失敗しました";
                errorDiv.classList.remove('hidden');
            }
        } catch (err) {
            errorDiv.textContent = "接続エラー";
            errorDiv.classList.remove('hidden');
        } finally {
            spinner.classList.add('hidden');
        }
    });

    function renderHeaderState() {
        if (currentUser) {
            headerAvatar.classList.remove('hidden');
            headerAvatar.innerHTML = `<img src="${currentUser.avatar}" class="w-full h-full object-cover">`;
            document.getElementById('fab-post')?.classList.remove('hidden');
        } else {
            headerAvatar.classList.add('hidden');
        }
    }

    headerAvatar.addEventListener('click', () => {
        renderAccountSwitcher();
        document.getElementById('account-modal').classList.add('modal-open');
    });

    function renderAccountSwitcher() {
        const list = document.getElementById('account-list');
        list.innerHTML = accounts.map(a => `
            <div class="account-item ${a.handle === currentUser?.handle ? 'active' : ''}" onclick="window.app.switchAccount('${a.handle}')">
                <img src="${a.user.avatar}" class="w-8 h-8 rounded-full">
                <div class="flex-1 truncate text-[13px] font-bold">${a.user.displayName}</div>
            </div>
        `).join('');
    }

    document.getElementById('close-account-modal').addEventListener('click', () => document.getElementById('account-modal').classList.remove('modal-open'));
    document.getElementById('logout-all-btn').addEventListener('click', () => logout());

    function updatePostSection() {
        if (currentUser) {
            postSection.innerHTML = `
                <div class="flex gap-2 p-2 px-3 items-center" onclick="window.app.openComposeModal()">
                    <div class="w-8 h-8 rounded-full overflow-hidden border border-black/5"><img src="${currentUser.avatar}" class="w-full h-full object-cover"></div>
                    <div class="text-textSub text-[14px] opacity-70">いまどうしてる？</div>
                </div>`;
            postSection.classList.remove('hidden');
        } else {
            postSection.innerHTML = `<div class="py-4 text-center"><button class="bg-primary text-white py-1.5 px-6 rounded-full font-bold" onclick="document.getElementById('login-modal').classList.add('modal-open')">ログインする</button></div>`;
            postSection.classList.remove('hidden');
        }
    }

    async function updateProfileHeader() {
        const targetUser = viewedUserProfile || currentUser;
        if (!targetUser) return;
        const isMe = targetUser.handle === currentUser?.handle;
        profileHeader.innerHTML = `
            <div class="h-28 bg-primary relative" style="${targetUser.banner ? `background-image:url(${targetUser.banner});background-size:cover;` : ''}">
                <div class="absolute -bottom-10 left-4 w-20 h-20 bg-white dark:bg-slate-900 rounded-full p-1"><img src="${targetUser.avatar}" class="w-full h-full object-cover rounded-full"></div>
                ${isMe ? `<button class="absolute -bottom-8 right-3 border px-3 py-1.5 rounded-full font-bold text-[12px]" onclick="window.app.openProfileEdit()">編集</button>` : ''}
            </div>
            <div class="pt-12 px-4 pb-3">
                <h2 class="font-bold text-[18px]">${targetUser.displayName}</h2>
                <p class="text-textSub text-[12px] font-mono">${targetUser.handle}</p>
                <p class="mt-2 text-[14px]">${targetUser.bio || ''}</p>
            </div>`;
        profileHeader.classList.remove('hidden');
        profileTabs.classList.remove('hidden');
    }

    function renderFeed(posts) {
        if (!posts || posts.length === 0) {
            feed.innerHTML = `<div class="p-8 text-center text-textSub text-[13px] font-bold">投稿はありません</div>`;
            return;
        }
        feed.innerHTML = posts.map(post => `
            <article class="px-4 py-3 border-b border-black/5 dark:border-white/5 hover:bg-black/5 transition cursor-pointer" data-post-id="${post.id}">
                <div class="flex gap-3">
                    <div class="w-9 h-9 rounded-full shrink-0 overflow-hidden"><img src="${post.avatar}" class="w-full h-full object-cover"></div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 mb-1">
                            <span class="font-bold text-[14px] truncate">${post.user || post.handle}</span>
                            <span class="text-textSub text-[12px] opacity-80">${formatTimeAgo(post.time)}</span>
                        </div>
                        <p class="text-[14px] leading-snug">${formatPostText(post.text)}</p>
                    </div>
                </div>
            </article>
        `).join('');
    }

    async function refreshFeed() {
        feed.innerHTML = renderSkeleton();
        const data = await apiFetch('/api/posts');
        if (data) { SERVER_POSTS = data; renderFeed(data); }
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.getAttribute('data-view');
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            renderView(view);
        });
    });

    function renderView(view) {
        currentView = view;
        postSection.classList.add('hidden');
        profileHeader.classList.add('hidden');
        profileTabs.classList.add('hidden');
        feed.innerHTML = '';
        if (view === 'home') { headerTitle.textContent = 'ホーム'; updatePostSection(); refreshFeed(); }
        else if (view === 'profile') { headerTitle.textContent = 'プロフィール'; updateProfileHeader(); updateTabContent('posts', viewedUserProfile || currentUser); }
        else if (view === 'notifications') { headerTitle.textContent = '通知'; renderNotifications(); }
    }

    async function renderNotifications() {
        const data = await apiFetch('/api/notifications');
        if (!data || data.length === 0) { feed.innerHTML = '<div class="p-8 text-center">通知はありません</div>'; return; }
        feed.innerHTML = data.map(n => `<div class="p-4 border-b text-[13px] font-bold">${n.actor_handle} さんがアクションしました</div>`).join('');
    }

    async function updateTabContent(tabName, user) {
        if (tabName === 'posts') renderFeed(SERVER_POSTS.filter(p => p.handle === user.handle));
    }

    tabItems.forEach(tab => {
        tab.addEventListener('click', () => {
            tabItems.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            updateTabContent(tab.getAttribute('data-tab'), viewedUserProfile || currentUser);
        });
    });

    // --- HTMLから呼べるように app オブジェクトに登録 ---
    window.app.openComposeModal = openComposeModal;
    window.app.renderView = renderView;
    window.app.openProfileEdit = openProfileEdit;
    window.app.switchAccount = switchAccount;
    window.app.refreshFeed = refreshFeed;

    // --- 初期化 ---
    renderHeaderState();
    if (token) startNotifPolling();
    refreshFeed();
});
