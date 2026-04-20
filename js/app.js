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
    let viewHistory = []; // To support back button
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
            // Update in accounts array
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
        location.reload(); // Hard reload to reset all states cleanly
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

    // --- Notification Badge ---
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
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (!localStorage.getItem('theme')) initTheme();
    });

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

    // --- Format Utils ---
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

    // --- Skeleton Loading ---
    function renderSkeleton(count = 5) {
        return Array.from({ length: count }).map(() => `
            <div class="skeleton-post">
                <div class="skeleton-avatar"></div>
                <div class="flex-1 pt-1">
                    <div class="skeleton-line" style="width: 40%"></div>
                    <div class="skeleton-line" style="width: 90%"></div>
                    <div class="skeleton-line" style="width: 70%"></div>
                </div>
            </div>
        `).join('');
    }

    // --- Compose ---
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

        // Auto-save draft
        if (draftAutoSaveTimer) clearTimeout(draftAutoSaveTimer);
        draftAutoSaveTimer = setTimeout(() => {
            const text = composeInput.value.trim();
            if (text && !replyTargetPost) {
                // Keep only the most recent auto-draft or update existing one
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
        composeHighlight.scrollLeft = composeInput.scrollLeft;
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

    // --- Drafts ---
    draftListBtn.addEventListener('click', () => {
        if (replyTargetPost) { showToast('返信画面では下書き保存できません。', 'info'); return; }
        const text = composeInput.value.trim();
        if (text) {
            if (drafts.length >= 30) {
                showToast('下書きが上限（30件）に達しています。古い下書きを削除してください。', 'error');
            } else {
                drafts.unshift({ id: Date.now(), text: text, date: new Date().toLocaleString() });
                composeInput.value = "";
                updateHighlight();
                saveLocalState();
                showToast('下書きを保存しました ✓', 'success');
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
                <button class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 transition delete-draft" data-id="${d.id}"><span class="material-symbols-rounded !text-[18px]">delete</span></button>
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

    // Submit Post
    submitComposeBtn.addEventListener('click', async () => {
        if (!currentUser) return;
        const text = composeInput.value.trim();
        if (text === '') return;

        submitComposeBtn.disabled = true;
        submitComposeBtn.textContent = '送信中...';

        const payload = { text: text };
        if (replyTargetPost) payload.parent_id = replyTargetPost.id;

        const res = await apiFetch('/api/posts', 'POST', payload);

        submitComposeBtn.disabled = false;
        submitComposeBtn.textContent = '投稿する';

        if (res && res.success) {
            document.getElementById('close-compose-btn').click();
            composeInput.value = "";
            showToast('投稿しました ✓', 'success');
            refreshFeed();
        } else {
            showToast('投稿に失敗しました。サーバーの接続を確認してください。', 'error');
        }
    });

    // --- Profile Edit ---
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
        const btn = document.querySelector('#profile-edit-form button[type="submit"]');
        btn.disabled = true;
        btn.textContent = "保存中...";

        const payload = {
            display_name: document.getElementById('edit-display-name').value,
            avatar: document.getElementById('edit-avatar-url').value || `https://ui-avatars.com/api/?name=${currentUser.displayName}&background=random`,
            banner: document.getElementById('edit-banner-url').value || '',
            bio: document.getElementById('edit-bio').value
        };

        const res = await apiFetch('/api/profile', 'PUT', payload);

        btn.disabled = false;
        btn.textContent = "保存";

        if (res && res.success) {
            currentUser.displayName = payload.display_name;
            currentUser.avatar = payload.avatar;
            currentUser.banner = payload.banner;
            currentUser.bio = payload.bio;
            saveLocalState();
            document.getElementById('close-profile-edit').click();
            showToast('プロフィールを更新しました ✓', 'success');
            renderHeaderState();
            if (currentView === 'profile') renderView('profile');
        } else {
            showToast('プロフィール更新に失敗しました。', 'error');
        }
    });

    // --- Login ---
    document.getElementById('close-login-btn').addEventListener('click', () => loginModal.classList.remove('modal-open'));

    // Auto-fill remembered credentials
    const savedHandle = localStorage.getItem('whiteSNS_auth_handle');
    const savedPass = localStorage.getItem('whiteSNS_auth_pass');
    if (savedHandle) document.getElementById('bsky-handle').value = savedHandle;
    if (savedPass) document.getElementById('bsky-app-password').value = savedPass;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const handle = document.getElementById('bsky-handle').value;
        const password = document.getElementById('bsky-app-password').value;
        const submitBtn = document.getElementById('login-submit-btn');
        const spinner = document.getElementById('login-spinner');
        const errorDiv = document.getElementById('login-error');

        if (!handle || !password) return;

        errorDiv.classList.add('hidden');
        submitBtn.disabled = true;
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

                localStorage.setItem('whiteSNS_auth_handle', handle);
                localStorage.setItem('whiteSNS_auth_pass', password);

                const profRes = await fetch(`${API_BASE}/api/profile/${data.handle}`);
                if (profRes.ok) {
                    const profData = await profRes.json();
                    currentUser = {
                        handle: profData.handle,
                        displayName: profData.display_name,
                        avatar: profData.avatar || `https://ui-avatars.com/api/?name=${profData.handle}&background=random`,
                        bio: profData.bio,
                        banner: profData.banner || ''
                    };
                } else {
                    currentUser = {
                        handle: data.handle,
                        displayName: data.handle,
                        avatar: `https://ui-avatars.com/api/?name=${data.handle}&background=random`,
                        bio: "",
                        banner: ""
                    };
                }

                saveLocalState();
                document.getElementById('close-login-btn').click();
                renderHeaderState();
                startNotifPolling();
                showToast(`ようこそ、${currentUser.displayName}さん！`, 'success');
                refreshFeed();
            } else {
                console.error("Login failed:", data);
                errorDiv.textContent = data.error || "ログインに失敗しました。";
                errorDiv.classList.remove('hidden');
            }
        } catch (err) {
            console.error("Connection error:", err);
            errorDiv.textContent = "サーバーに接続できません。";
            errorDiv.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            spinner.classList.add('hidden');
        }
    });

    // Mock Login trigger
    document.getElementById('mock-login-btn').addEventListener('click', () => {
        showToast('モックログインは廃止されました。Blueskyアカウントでログインしてください。', 'info');
    });

    function renderHeaderState() {
        if (currentUser) {
            headerAvatar.classList.remove('hidden');
            headerAvatar.innerHTML = `<img src="${currentUser.avatar}" alt="Avatar" class="w-full h-full object-cover">`;
            document.getElementById('fab-post')?.classList.remove('hidden');
        } else {
            headerAvatar.classList.add('hidden');
            document.getElementById('fab-post')?.classList.add('hidden');
        }
    }

    // Account Switcher Trigger
    headerAvatar.addEventListener('click', () => {
        renderAccountSwitcher();
        document.getElementById('account-modal').classList.add('modal-open');
    });

    function renderAccountSwitcher() {
        const list = document.getElementById('account-list');
        list.innerHTML = accounts.map(a => `
            <div class="account-item ${a.handle === currentUser?.handle ? 'active' : ''}" onclick="window.SNS_switchAccount('${a.handle}')">
                <img src="${a.user.avatar}" class="w-8 h-8 rounded-full">
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-[13px] truncate">${a.user.displayName}</div>
                    <div class="text-[11px] opacity-60 truncate">${a.handle}</div>
                </div>
                ${a.handle === currentUser?.handle ? '<span class="material-symbols-rounded text-primary !text-[18px]">check_circle</span>' : ''}
            </div>
        `).join('');
    }
    window.SNS_switchAccount = switchAccount;
    document.getElementById('close-account-modal').addEventListener('click', () => document.getElementById('account-modal').classList.remove('modal-open'));
    document.getElementById('add-account-btn').addEventListener('click', () => {
        document.getElementById('account-modal').classList.remove('modal-open');
        document.getElementById('login-modal').classList.add('modal-open');
    });
    document.getElementById('logout-all-btn').addEventListener('click', () => logout());

    // --- Rendering ---
    function updatePostSection() {
        if (currentUser) {
            postSection.innerHTML = `
                <div class="flex gap-2 p-2 px-3 items-center" onclick="document.getElementById('fab-post').click()">
                    <div class="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-black/5 dark:border-white/5 shadow-sm">
                        <img src="${currentUser.avatar}" alt="Avatar" class="w-full h-full object-cover">
                    </div>
                    <div class="text-textSub dark:text-darkTextSub text-[14px] ml-1 opacity-70">いまどうしてる？</div>
                </div>`;
            postSection.classList.remove('hidden');
        } else {
            postSection.innerHTML = `
                <div class="py-4 text-center">
                    <button class="bg-gradient-to-r from-primary to-secondary text-white font-bold py-1.5 px-6 rounded-full text-[13px] shadow-sm hover:opacity-90" onclick="document.getElementById('login-modal').classList.add('modal-open');">ログインする</button>
                </div>`;
            postSection.classList.remove('hidden');
        }
    }

    async function updateProfileHeader() {
        const targetUser = viewedUserProfile || currentUser;
        if (!targetUser) { profileTabs.classList.add('hidden'); return; }

        const isMe = targetUser.handle === currentUser?.handle;
        const bannerStyle = targetUser.banner
            ? `background-image: url('${targetUser.banner}'); background-size: cover; background-position: center;`
            : '';
        const bannerClass = targetUser.banner ? '' : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500';

        profileHeader.innerHTML = `
            <div class="h-28 ${bannerClass} relative" style="${bannerStyle}">
                <div class="absolute -bottom-10 left-4 w-20 h-20 bg-white dark:bg-slate-900 rounded-full p-1 shadow-md">
                    <img src="${targetUser.avatar || `https://ui-avatars.com/api/?name=${targetUser.handle}&background=random`}" alt="Avatar" class="w-full h-full object-cover rounded-full">
                </div>
                ${isMe ? `
                <button class="absolute -bottom-8 right-3 border border-borderBase dark:border-darkBorder bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-full font-bold hover:bg-black/5 text-[12px]" onclick="document.getElementById('profile-edit-btn').click()">プロフィールを編集</button>
                <button id="profile-edit-btn" class="hidden"></button>
                ` : `
                <button id="follow-btn" class="absolute -bottom-8 right-3 bg-gradient-to-r from-primary to-secondary text-white px-4 py-1.5 rounded-full font-bold text-[12px] shadow-md" data-handle="${targetUser.handle}">フォロー</button>
                `}
            </div>
            <div class="pt-12 px-4 pb-3">
                <h2 class="font-bold text-[18px]">${targetUser.displayName || targetUser.handle}</h2>
                <p class="text-textSub dark:text-darkTextSub text-[12px] font-mono mt-0.5 opacity-80">${targetUser.handle}</p>
                <p class="mt-2 text-[14px] leading-snug whitespace-pre-wrap">${targetUser.bio || '自己紹介はまだありません。'}</p>
                <div id="follow-stats" class="flex gap-4 mt-2 text-[13px] text-textSub dark:text-darkTextSub">
                    <span class="skeleton-line" style="width:100px; display:inline-block;"></span>
                </div>
            </div>`;

        profileTabs.classList.remove('hidden');

        // Fetch follow info
        const followInfo = await apiFetch(`/api/follows/${targetUser.handle}`);
        const statsEl = document.getElementById('follow-stats');
        if (statsEl && followInfo) {
            statsEl.innerHTML = `
                <span class="cursor-pointer hover:underline" onclick="window.SNS_openUserList('followers')"><strong>${followInfo.followers}</strong> フォロワー</span>
                <span class="opacity-40">·</span>
                <span class="cursor-pointer hover:underline" onclick="window.SNS_openUserList('following')"><strong>${followInfo.following}</strong> フォロー中</span>`;
        }
        window.SNS_openUserList = (type) => openUserList(type, targetUser.handle);

        const followBtn = document.getElementById('follow-btn');
        if (followBtn && followInfo) {
            if (followInfo.is_following) {
                followBtn.textContent = 'フォロー中';
                followBtn.className = 'absolute -bottom-8 right-3 border border-borderBase dark:border-darkBorder bg-white/80 dark:bg-slate-900/80 text-textMain dark:text-white px-4 py-1.5 rounded-full font-bold text-[12px]';
            }
            followBtn.addEventListener('click', async () => {
                const res = await apiFetch('/api/follows', 'POST', { target_handle: targetUser.handle });
                if (res) {
                    showToast(res.action === 'followed' ? `${targetUser.handle} をフォローしました ✓` : 'フォローを解除しました', res.action === 'followed' ? 'success' : 'info');
                    updateProfileHeader();
                }
            });
        }

        // Fetch full profile for other users if needed
        if (!isMe && (!viewedUserProfile?.displayName || viewedUserProfile.displayName === viewedUserProfile.handle)) {
            const res = await apiFetch(`/api/profile/${targetUser.handle}`);
            if (res && res.display_name) {
                viewedUserProfile = {
                    handle: res.handle,
                    displayName: res.display_name,
                    avatar: res.avatar || `https://ui-avatars.com/api/?name=${res.handle}&background=random`,
                    bio: res.bio,
                    banner: res.banner || ''
                };
                updateProfileHeader();
            }
        }

        // Profile edit button wire-up
        document.getElementById('profile-edit-btn')?.addEventListener('click', () => openProfileEdit());
    }

    function renderFeed(posts) {
        if (!posts || posts.length === 0) {
            feed.innerHTML = `<div class="p-8 text-center text-textSub text-[13px] font-bold opacity-50">まだ投稿がありません</div>`;
            return;
        }

        feed.innerHTML = posts.map(post => {
            const avatar = post.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user || post.handle)}&background=random`;
            const isBookmarked = bookmarks.includes(post.id);
            let parentHtml = '';

            if (post.parent_id) {
                const parent = SERVER_POSTS.find(p => p.id === post.parent_id);
                if (parent) {
                    parentHtml = `<div class="text-[11px] text-secondary dark:text-pink-400 mb-1 ml-10 font-medium"><span class="material-symbols-rounded !text-[13px] align-text-bottom">reply</span> <span class="mention cursor-pointer hover:underline" data-handle="${parent.handle}">返信先: ${parent.handle}</span></div>`;
                }
            }

            return `
            <article class="px-4 py-3 border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer relative group/post" data-post-id="${post.id}">
                ${post.isPinned ? '<div class="text-[11px] text-textSub opacity-60 mb-1 ml-10 flex items-center gap-1"><span class="material-symbols-rounded !text-[14px]">push_pin</span> 固定された投稿</div>' : ''}
                ${parentHtml}
                <div class="flex gap-3">
                    <div class="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0 overflow-hidden avatar-click cursor-pointer border border-black/5 dark:border-white/5" data-handle="${post.handle}">
                        <img src="${avatar}" alt="Avatar" class="w-full h-full object-cover pointer-events-none">
                    </div>
                    <div class="flex-1 min-w-0 pt-0.5">
                        <div class="flex items-center gap-1.5 mb-1">
                            <span class="font-bold text-[14px] truncate hover:underline avatar-click cursor-pointer" data-handle="${post.handle}">${post.user || post.handle}</span>
                            <span class="text-textSub dark:text-darkTextSub text-[12px] font-mono opacity-80 truncate">${post.handle}</span>
                            <span class="text-textSub dark:text-darkTextSub text-[12px] opacity-40">·</span>
                            <span class="text-textSub dark:text-darkTextSub text-[12px] opacity-80">${formatTimeAgo(post.time)}</span>
                        </div>
                        <p class="text-[14px] leading-snug whitespace-pre-wrap">${formatPostText(post.text)}</p>
                        ${checkOGP(post.text)}

                        <div class="flex justify-between items-center mt-2.5 text-textSub dark:text-darkTextSub pr-4 opacity-80 group-hover/post:opacity-100 transition-opacity">
                            <button class="flex items-center gap-1 hover:text-primary group transition action-btn" data-action="reply">
                                <div class="w-7 h-7 flex items-center justify-center rounded-full group-hover:bg-primary/10 transition pointer-events-none"><span class="material-symbols-rounded !text-[18px]">chat_bubble</span></div>
                                <span class="text-[12px] font-medium pointer-events-none mt-0.5">${post.replies > 0 ? post.replies : ''}</span>
                            </button>
                            <button class="flex items-center gap-1 hover:text-green-500 group transition action-btn ${post.repost_id ? 'repost-active' : ''}" data-action="repost">
                                <div class="w-7 h-7 flex items-center justify-center rounded-full group-hover:bg-green-500/10 transition pointer-events-none"><span class="material-symbols-rounded !text-[18px]">repeat</span></div>
                            </button>
                            <button class="flex items-center gap-1 ${post.is_liked ? 'is-liked' : ''} hover:text-secondary group transition action-btn" data-action="like">
                                <div class="w-7 h-7 flex items-center justify-center rounded-full group-hover:bg-secondary/10 transition pointer-events-none"><span class="material-symbols-rounded !text-[18px]">favorite</span></div>
                                <span class="count text-[12px] font-medium pointer-events-none mt-0.5">${post.likes > 0 ? post.likes : ''}</span>
                            </button>
                            <button class="flex items-center gap-1 ${isBookmarked ? 'text-primary' : ''} hover:text-primary group transition action-btn" data-action="bookmark">
                                <div class="w-7 h-7 flex items-center justify-center rounded-full group-hover:bg-primary/10 transition pointer-events-none"><span class="material-symbols-rounded !text-[18px] ${isBookmarked ? '!font-bold' : ''}">bookmark</span></div>
                            </button>
                            ${(post.handle === currentUser?.handle) ? `
                            <button class="flex items-center gap-1 hover:text-primary group transition action-btn" data-action="pin">
                                <div class="w-7 h-7 flex items-center justify-center rounded-full group-hover:bg-primary/10 transition pointer-events-none"><span class="material-symbols-rounded !text-[18px] ${post.isPinned ? '!font-bold text-primary' : ''}">push_pin</span></div>
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </article>
        `;
        }).join('');
    }

    async function refreshFeed() {
        feed.innerHTML = renderSkeleton(5);

        const data = await apiFetch('/api/posts');
        if (data) {
            SERVER_POSTS = data;
        }

        renderFeed(SERVER_POSTS);
    }

    // --- Notifications View ---
    async function renderNotifications() {
        feed.innerHTML = renderSkeleton(3);
        if (!currentUser) {
            feed.innerHTML = '<div class="p-8 text-center text-[13px] font-bold opacity-50">通知を見るにはログインしてください</div>';
            return;
        }
        // Reset badge
        const badge = document.getElementById('notif-badge');
        if (badge) badge.classList.add('hidden');

        const data = await apiFetch('/api/notifications');
        if (!data || data.length === 0) {
            feed.innerHTML = '<div class="p-8 text-center text-[13px] font-bold opacity-50">まだ通知はありません</div>';
            return;
        }

        const typeLabels = {
            mention: `<span class="text-primary font-bold">メンション</span> しました`,
            like: `あなたの投稿に <span class="text-secondary font-bold">いいね</span> しました`,
            reply: `あなたの投稿に <span class="text-primary font-bold">返信</span> しました`,
            follow: `あなたを <span class="text-primary font-bold">フォロー</span> しました`,
        };
        const typeIcons = { mention: 'alternate_email', like: 'favorite', reply: 'chat_bubble', follow: 'person_add' };
        const typeColors = { mention: 'text-primary', like: 'text-secondary', reply: 'text-primary', follow: 'text-green-500' };

        feed.innerHTML = data.map(n => `
            <div class="px-4 py-3 border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition flex gap-3 cursor-pointer ${n.is_read ? 'opacity-70' : ''}" data-post-id="${n.post_id || ''}">
                <div class="w-8 flex justify-center mt-1">
                    <span class="material-symbols-rounded ${typeColors[n.type] || 'text-primary'} !text-xl">${typeIcons[n.type] || 'notifications'}</span>
                </div>
                <div class="flex-1">
                    <p class="text-[13px]">
                        <span class="mention font-bold cursor-pointer hover:underline" data-handle="${n.actor_handle}">${n.actor_handle}</span> さんが ${typeLabels[n.type] || '通知を送りました'}
                    </p>
                    ${n.post_text ? `<p class="text-[13px] text-textSub dark:text-darkTextSub mt-1 pl-2 border-l-2 border-borderBase line-clamp-3">${n.post_text}</p>` : ''}
                    <p class="text-[11px] text-textSub dark:text-darkTextSub mt-1">${formatTimeAgo(n.created_at)}</p>
                </div>
            </div>
        `).join('');
    }

    // Routing
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.getAttribute('data-view');
            if (view === 'home' && currentView === 'home') { refreshFeed(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            viewedUserProfile = null;
            renderView(view);
        });
    });

    function renderView(view, pushHistory = true) {
        if (pushHistory) viewHistory.push({ view: currentView, viewedUser: viewedUserProfile });
        currentView = view;
        postSection.classList.add('hidden');
        profileHeader.classList.add('hidden');
        profileTabs.classList.add('hidden');
        feed.classList.remove('hidden');
        document.getElementById('post-detail').classList.add('hidden');
        feed.innerHTML = '';
        window.scrollTo({ top: 0, behavior: 'instant' });
        
        document.getElementById('back-btn').classList.toggle('hidden', viewHistory.length <= 1);

        if (view === 'home') {
            headerTitle.textContent = 'ホーム';
            updatePostSection();
            if (SERVER_POSTS.length > 0) renderFeed(SERVER_POSTS);
            else refreshFeed();
        } else if (view === 'profile') {
            const targetUser = viewedUserProfile || currentUser;
            headerTitle.textContent = 'プロフィール';
            profileHeader.classList.remove('hidden');
            updateProfileHeader();
            if (targetUser) updateTabContent('posts', targetUser);
        } else if (view === 'notifications') {
            headerTitle.textContent = '通知';
            renderNotifications();
        } else if (view === 'search') {
            headerTitle.textContent = '検索';
            feed.innerHTML = `
                <div class="p-2 mb-2">
                    <div class="relative">
                        <span class="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-textSub opacity-60 !text-[20px]">search</span>
                        <input type="text" id="srch" placeholder="キーワード検索..." class="w-full pl-9 pr-3 py-2 rounded-xl bg-white/50 dark:bg-white/5 border border-black/5 outline-none focus:ring-1 focus:ring-primary text-[14px]">
                    </div>
                </div>
                <div id="srch-res"><h3 class="font-bold text-[14px] px-3 mb-2 opacity-80">トレンド</h3><div class="px-3"><span class="hashtag text-primary font-bold cursor-pointer hover:underline text-[15px]">#初めての投稿</span></div></div>
            `;
            document.getElementById('srch').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const q = e.target.value.toLowerCase();
                    const r = SERVER_POSTS.filter(p => p.text.toLowerCase().includes(q));
                    const currentTop = feed.innerHTML;
                    renderFeed(r);
                    const resHTML = feed.innerHTML;
                    feed.innerHTML = currentTop;
                    document.getElementById('srch-res').innerHTML = `<h3 class="font-bold text-[14px] px-3 mb-2 opacity-80">検索結果 : ${q}</h3>${resHTML}`;
                }
            });
        }
    }

    feed.addEventListener('click', async (e) => {
        const profEl = e.target.closest('.avatar-click, .mention');
        if (profEl) {
            e.stopPropagation();
            if (!currentUser) { document.getElementById('login-modal').classList.add('modal-open'); return; }
            const h = profEl.getAttribute('data-handle')?.replace('@', '');
            if (!h) return;
            viewedUserProfile = { handle: h }; // Will be populated by updateProfileHeader
            navItems.forEach(i => i.classList.remove('active'));
            document.querySelector('.nav-item[data-view="profile"]').classList.add('active');
            renderView('profile');
            return;
        }

        if (e.target.classList.contains('hashtag')) {
            e.stopPropagation();
            const tag = e.target.textContent;
            navItems.forEach(i => i.classList.remove('active'));
            document.querySelector('.nav-item[data-view="search"]').classList.add('active');
            renderView('search');
            setTimeout(() => {
                const searchInput = document.getElementById('srch');
                if (searchInput) {
                    searchInput.value = tag;
                    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
                }
            }, 50);
            return;
        }

        // Notification click to open post
        const notifEl = e.target.closest('[data-post-id]');
        if (notifEl && currentView === 'notifications') {
            const pid = notifEl.getAttribute('data-post-id');
            if (pid) {
                renderPostDetail(pid);
            }
            return;
        }

        const actBtn = e.target.closest('.action-btn');
        if (actBtn) {
            e.stopPropagation();
            if (!currentUser) { document.getElementById('login-modal').classList.add('modal-open'); return; }
            const pid = parseInt(actBtn.closest('article').getAttribute('data-post-id'));
            const action = actBtn.getAttribute('data-action');
            if (action === 'bookmark') {
                const idx = bookmarks.indexOf(pid);
                if (idx > -1) bookmarks.splice(idx, 1); else bookmarks.push(pid);
                localStorage.setItem('whiteSNS_bookmarks', JSON.stringify(bookmarks));
                actBtn.classList.toggle('text-primary');
                actBtn.querySelector('.material-symbols-rounded').classList.toggle('!font-bold');
                apiFetch('/api/posts/bookmark', 'POST', { post_id: pid });
                showToast(bookmarks.includes(pid) ? 'ブックマークしました ✓' : 'ブックマークを解除しました', 'info');
            } else if (action === 'like') {
                const isLiked = actBtn.classList.contains('is-liked');
                actBtn.classList.toggle('is-liked');
                const countEl = actBtn.querySelector('.count');
                if (countEl) {
                    let count = parseInt(countEl.textContent) || 0;
                    countEl.textContent = isLiked ? (count > 1 ? count - 1 : '') : (count + 1);
                }
                apiFetch('/api/posts/like', 'POST', { post_id: pid });
            } else if (action === 'repost') {
                openRepostMenu(pid);
            } else if (action === 'reply') {
                openComposeModal({ id: pid, handle: actBtn.closest('article').querySelector('.font-mono').textContent });
            } else if (action === 'pin') {
                const isPinned = actBtn.closest('article').querySelector('.material-symbols-rounded[span="push_pin"]');
                if (confirm(isPinned ? '固定を解除しますか？' : 'プロフィールに固定しますか？')) {
                    apiFetch(isPinned ? '/api/posts/unpin' : '/api/posts/pin', 'POST', { post_id: pid });
                    showToast(isPinned ? '固定解除しました' : '固定しました');
                    setTimeout(() => location.reload(), 500);
                }
            }
        } else {
            // Click on post to see detail
            const postEl = e.target.closest('article[data-post-id]');
            if (postEl && currentView !== 'notifications') {
                renderPostDetail(postEl.getAttribute('data-post-id'));
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

    async function updateTabContent(tabName, user) {
        if (!user) return;
        if (tabName === 'posts') {
            const filtered = SERVER_POSTS.filter(p => p.handle === user.handle);
            // Handle Pinned Post
            if (user.pinned_post_id) {
                const pinnedIdx = filtered.findIndex(p => p.id === user.pinned_post_id);
                if (pinnedIdx > -1) {
                    const pinned = filtered.splice(pinnedIdx, 1)[0];
                    renderFeed([ { ...pinned, isPinned: true }, ...filtered ]);
                    return;
                }
            }
            renderFeed(filtered);
        } else if (tabName === 'likes') {
            feed.innerHTML = renderSkeleton(3);
            const data = await apiFetch(`/api/likes/${user.handle}`);
            if (data) renderFeed(data);
            else feed.innerHTML = `<div class="p-8 text-center text-[13px] font-bold opacity-50">まだありません</div>`;
        } else if (tabName === 'bookmarks' && user.handle === currentUser?.handle) {
            renderFeed(SERVER_POSTS.filter(p => bookmarks.includes(p.id)));
        } else {
            feed.innerHTML = `<div class="p-8 text-center text-[13px] font-bold opacity-50">まだありません</div>`;
        }
    }

    // --- New Functions Implementation ---

    async function renderPostDetail(postId) {
        renderView('post_detail');
        headerTitle.textContent = '投稿';
        const pdContainer = document.getElementById('post-detail');
        feed.classList.add('hidden');
        pdContainer.classList.remove('hidden');
        pdContainer.innerHTML = renderSkeleton(1);

        const res = await apiFetch(`/api/posts/${postId}`);
        if (!res || !res.post) {
            pdContainer.innerHTML = '<div class="p-8 text-center opacity-50">投稿が見つかりませんでした</div>';
            return;
        }

        const p = res.post;
        pdContainer.innerHTML = `
            <div class="p-4 border-b border-borderBase dark:border-darkBorder animate-fade-in">
                <div class="flex gap-3 mb-4">
                    <img src="${p.avatar}" class="w-12 h-12 rounded-full avatar-click" data-handle="${p.handle}">
                    <div class="flex-1">
                        <div class="font-bold text-[16px]">${p.user}</div>
                        <div class="text-textSub dark:text-darkTextSub text-[14px] font-mono opacity-80">${p.handle}</div>
                    </div>
                </div>
                <div class="text-[17px] leading-relaxed mb-4 whitespace-pre-wrap">${formatPostText(p.text)}</div>
                <div class="text-textSub dark:text-darkTextSub text-[14px] mb-4 pb-4 border-b border-borderBase dark:border-darkBorder">
                    ${new Date(p.time).toLocaleString('ja-JP')}
                </div>
                <div class="flex gap-6 py-2 border-b border-borderBase dark:border-darkBorder text-[14px]">
                    <span><strong>${p.likes}</strong> いいね</span>
                </div>
                <div class="flex justify-around py-2">
                    <button class="flex items-center hover:text-primary transition" onclick="window.SNS_openReply(${p.id}, '${p.handle}')"><span class="material-symbols-rounded">chat_bubble</span></button>
                    <button class="flex items-center hover:text-green-500 transition" onclick="window.SNS_openRepost(${p.id})"><span class="material-symbols-rounded">repeat</span></button>
                    <button class="flex items-center ${p.is_liked ? 'text-secondary' : 'hover:text-secondary'} transition" onclick="window.SNS_toggleLike(this, ${p.id})"><span class="material-symbols-rounded ${p.is_liked ? '!font-bold' : ''}">favorite</span></button>
                </div>
            </div>
            <div id="replies-list"></div>
        `;
        
        const rList = document.getElementById('replies-list');
        if (res.replies && res.replies.length > 0) {
            rList.innerHTML = res.replies.map(r => `
                <div class="p-4 border-b border-borderBase/50 dark:border-darkBorder/50 flex gap-3 cursor-pointer" onclick="window.SNS_renderPostDetail(${r.id})">
                    <img src="${r.avatar}" class="w-9 h-9 rounded-full avatar-click" data-handle="${r.handle}">
                    <div class="flex-1">
                        <div class="flex items-center gap-1.5 mb-1">
                            <span class="font-bold text-[14px]">${r.user}</span>
                            <span class="text-textSub dark:text-darkTextSub text-[12px] opacity-60">${r.handle}</span>
                        </div>
                        <div class="text-[14px]">${formatPostText(r.text)}</div>
                    </div>
                </div>
            `).join('');
        }
    }

    // Global helpers
    window.SNS_openReply = (id, h) => openComposeModal({ id, handle: h });
    window.SNS_openRepost = (id) => openRepostMenu(id);
    window.SNS_renderPostDetail = (id) => renderPostDetail(id);
    window.SNS_toggleLike = async (btn, id) => {
        const icon = btn.querySelector('.material-symbols-rounded');
        icon.classList.toggle('!font-bold');
        btn.classList.toggle('text-secondary');
        apiFetch('/api/posts/like', 'POST', { post_id: id });
    };

    async function openUserList(type, handle) {
        const modal = document.getElementById('user-list-modal');
        const title = document.getElementById('user-list-title');
        const content = document.getElementById('user-list-content');
        
        title.textContent = type === 'followers' ? 'フォロワー' : 'フォロー中';
        content.innerHTML = renderSkeleton(3);
        modal.classList.add('modal-open');

        const users = await apiFetch(`/api/follows/${handle}/${type}`);
        if (!users || users.length === 0) {
            content.innerHTML = '<div class="p-8 text-center opacity-50">ユーザーが見つかりませんでした</div>';
            return;
        }

        content.innerHTML = users.map(u => `
            <div class="user-list-item avatar-click" data-handle="${u.handle}">
                <img src="${u.avatar || `https://ui-avatars.com/api/?name=${u.handle}`}" class="w-10 h-10 rounded-full">
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-[14px] truncate">${u.display_name || u.handle}</div>
                    <div class="text-[12px] opacity-60 truncate">${u.handle}</div>
                </div>
            </div>
        `).join('');
    }
    document.getElementById('close-user-list-modal').addEventListener('click', () => document.getElementById('user-list-modal').classList.remove('modal-open'));

    let currentRepostTargetId = null;
    function openRepostMenu(postId) {
        currentRepostTargetId = postId;
        const menu = document.getElementById('repost-menu');
        menu.classList.remove('hidden');
    }
    document.getElementById('repost-menu-overlay').addEventListener('click', () => document.getElementById('repost-menu').classList.add('hidden'));
    
    document.querySelectorAll('.repost-menu-item').forEach(btn => {
        btn.addEventListener('click', async () => {
            const action = btn.getAttribute('data-action');
            document.getElementById('repost-menu').classList.add('hidden');
            
            if (action === 'repost') {
                const res = await apiFetch('/api/posts/repost', 'POST', { post_id: currentRepostTargetId });
                if (res && res.success) { showToast('リポストしました'); refreshFeed(); }
            } else {
                openComposeModal();
                composeInput.value = `RT @handle `; // Simplified indicator
                composeInput.dispatchEvent(new Event('input'));
            }
        });
    });

    document.getElementById('back-btn').addEventListener('click', () => {
        if (viewHistory.length > 1) {
            viewHistory.pop(); // current
            const prev = viewHistory.pop(); // previous
            viewedUserProfile = prev.viewedUser;
            renderView(prev.view, false);
        }
    });

    renderHeaderState();
    if (token) startNotifPolling();
    refreshFeed();
});
