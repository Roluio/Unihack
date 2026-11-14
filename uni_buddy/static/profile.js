document.addEventListener('DOMContentLoaded', () => {
    const LANG_KEY = 'UniBuddyForumLanguage';
    const $ = (id) => document.getElementById(id);

    // ==========================================
    // TRADUCERI
    // ==========================================

    const translations = {
        ro: {
            langLabel: "LIMBĂ",
            logout: "Deconectare",
            navHome: "Acasă",
            homeTitle: "Acasă",
            emptyHome: "Nicio postare recentă de la prieteni.",
            navProfile: "Profilul meu",
            navPosts: "Postările mele",
            navMessages: "Mesaje",
            navNotifications: "Notificări",
            navSearch: "Căutare",
            navFriends: "Prieteni",
            editProfile: "Editează profil",
            settings: "Setări",
            editTitle: "Editare informații profil",
            lblName: "Nume complet",
            lblEmail: "Email",
            lblFaculty: "Facultate",
            lblYear: "An de studiu",
            lblBio: "Despre mine",
            saveChanges: "Salvează",
            cancel: "Anulează",
            settingsTitle: "Setări cont & confidențialitate",
            setPrivate: "Cont privat",
            setPrivateDesc: "Doar prietenii aprobați îți pot vedea profilul și activitatea.",
            setEmailNotif: "Notificări pe email",
            setEmailDesc: "Primește alerte când cineva îți trimite un mesaj nou.",
            setAccountEmail: "Email asociat",
            passwordTitle: "Schimbă parola",
            lblCurrentPassword: "Parola actuală",
            lblNewPassword: "Parola nouă",
            lblConfirmPassword: "Confirmă parola nouă",
            changePassword: "Schimbă parola",
            emptyPosts: "Nicio postare încă.",
            emptyMessages: "Niciun mesaj încă.",
            emptyNotifications: "Nicio notificare încă.",
            emptyFriends: "Lista de prieteni este goală.",
            searchPlaceholder: "Caută...",
            msgSaving: "Se salvează...",
            msgProfileUpdated: "Profil actualizat!",
            msgSettingsSaved: "Setare salvată.",
            msgPasswordChanged: "Parola a fost schimbată!",
            msgPasswordMismatch: "Parolele noi nu coincid.",
            msgError: "Eroare de conexiune cu serverul."
        },
        en: {
            langLabel: "LANGUAGE",
            logout: "Log out",
            navHome: "Home",
            homeTitle: "Home",
            emptyHome: "No recent posts from friends.",
            navProfile: "My profile",
            navPosts: "My posts",
            navMessages: "Messages",
            navNotifications: "Notifications",
            navSearch: "Search",
            navFriends: "Friends",
            editProfile: "Edit profile",
            settings: "Settings",
            editTitle: "Edit profile information",
            lblName: "Full name",
            lblEmail: "Email",
            lblFaculty: "Faculty",
            lblYear: "Year of study",
            lblBio: "About me",
            saveChanges: "Save changes",
            cancel: "Cancel",
            settingsTitle: "Account & privacy settings",
            setPrivate: "Private account",
            setPrivateDesc: "Only approved friends can view your profile and activity.",
            setEmailNotif: "Email notifications",
            setEmailDesc: "Receive alerts when someone sends you a new message.",
            setAccountEmail: "Associated email",
            passwordTitle: "Change password",
            lblCurrentPassword: "Current password",
            lblNewPassword: "New password",
            lblConfirmPassword: "Confirm new password",
            changePassword: "Change password",
            emptyPosts: "No posts yet.",
            emptyMessages: "No messages yet.",
            emptyNotifications: "No notifications yet.",
            emptyFriends: "Your friends list is empty.",
            searchPlaceholder: "Search...",
            msgSaving: "Saving...",
            msgProfileUpdated: "Profile updated!",
            msgSettingsSaved: "Setting saved.",
            msgPasswordChanged: "Password changed!",
            msgPasswordMismatch: "The new passwords do not match.",
            msgError: "Server connection error."
        }
    };

    function readSavedLang() {
        try {
            return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ro';
        } catch (e) {
            return 'ro';
        }
    }

    let currentLang = readSavedLang();
    const t = (key) => translations[currentLang][key] || key;

    // ==========================================
    // PRIETENI / CĂUTARE / CERERI (Spring Boot via Flask proxy)
    // ==========================================

    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    const searchInput = $('searchInput');
    const searchResultsContainer = $('searchResultsContainer');
    const friendsContainer = $('friendsContainer');
    const friendRequestsContainer = $('friendRequestsContainer');
    let searchTimer = null;

    const personLine = (u) => `
        <div>
            <strong>${esc(u.firstName)} ${esc(u.lastName)}</strong>
            <span style="opacity:0.7;">@${esc(u.username)}</span>
            <div style="font-size:0.85rem;opacity:0.8;">${esc(u.faculty)} • Anul ${esc(u.studyYear || '-')}</div>
        </div>`;

    const cardStyle = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;';

    async function fetchList(url) {
        const resp = await fetch(url);
        const data = await resp.json();
        return Array.isArray(data) ? data : [];
    }

    async function searchPeers(query) {
        if (!searchResultsContainer) return;
        try {
            const users = await fetchList(`/api/users/search?query=${encodeURIComponent(query)}`);
            if (users.length === 0) {
                searchResultsContainer.innerHTML = '<p class="empty-msg">Niciun student găsit.</p>';
                return;
            }
            searchResultsContainer.innerHTML = users.map(u => `
                <div class="sub-card" style="${cardStyle}">
                    ${personLine(u)}
                    <button type="button" class="primary-button" data-action="add-friend" data-id="${esc(u.id)}">+ Adaugă prieten</button>
                </div>`).join('');
        } catch (e) {
            searchResultsContainer.innerHTML = '<p class="empty-msg">Eroare la căutare.</p>';
        }
    }

    async function loadFriendRequests() {
        if (!friendRequestsContainer) return;
        try {
            const requests = await fetchList('/api/friends/requests/received');
            friendRequestsContainer.innerHTML = requests.map(r => `
                <div class="sub-card" style="${cardStyle}">
                    <div>
                        <strong>${esc(r.user.firstName)} ${esc(r.user.lastName)}</strong> (@${esc(r.user.username)})
                        ți-a trimis o cerere de prietenie.
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button type="button" class="primary-button" data-action="accept" data-id="${esc(r.requestId)}">Acceptă</button>
                        <button type="button" class="secondary-button" data-action="reject" data-id="${esc(r.requestId)}">Refuză</button>
                    </div>
                </div>`).join('');
        } catch (e) {
            friendRequestsContainer.innerHTML = '<p class="empty-msg">Eroare la încărcarea cererilor.</p>';
        }
    }

    async function loadFriends() {
        if (!friendsContainer) return;
        try {
            const friends = await fetchList('/api/friends');
            if (friends.length === 0) {
                friendsContainer.innerHTML = `<p class="empty-msg">${esc(t('emptyFriends'))}</p>`;
                return;
            }
            friendsContainer.innerHTML = friends.map(f => `
                <div class="sub-card" style="${cardStyle}">
                    ${personLine(f)}
                    <button type="button" class="secondary-button" data-action="remove-friend" data-id="${esc(f.id)}">Elimină</button>
                </div>`).join('');
        } catch (e) {
            friendsContainer.innerHTML = '<p class="empty-msg">Eroare la încărcarea prietenilor.</p>';
        }
    }

    function loadTabData(name) {
        if (name === 'friends') loadFriends();
        if (name === 'notifications') loadFriendRequests();
        if (name === 'search') searchPeers(searchInput ? searchInput.value.trim() : '');
    }

    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const { action, id } = btn.dataset;

        if (action === 'add-friend') {
            btn.disabled = true;
            btn.textContent = 'Se trimite...';
            try {
                const resp = await fetch(`/api/friends/request/${encodeURIComponent(id)}`, { method: 'POST' });
                const data = await resp.json().catch(() => ({}));
                btn.textContent = resp.ok ? 'Cerere trimisă ✓' : (data.message || 'Eroare');
            } catch (err) {
                btn.textContent = 'Eroare';
            }
        } else if (action === 'accept' || action === 'reject') {
            await fetch(`/api/friends/${action}/${encodeURIComponent(id)}`, { method: 'POST' });
            loadFriendRequests();
            loadFriends();
        } else if (action === 'remove-friend') {
            await fetch(`/api/friends/${encodeURIComponent(id)}`, { method: 'DELETE' });
            loadFriends();
        }
    });

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => searchPeers(searchInput.value.trim()), 300);
        });
    }

    // ==========================================
    // 1. TAB DIN URL (ex: /profile#notifications)
    // ==========================================

    const tabPanels = document.querySelectorAll('.tab-panel');

    function showTab(name) {
        const panel = $(`tab-${name}`);
        if (!panel) return;

        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));

        const btn = document.querySelector(`.nav-item[data-tab="${name}"]`);
        if (btn) btn.classList.add('active');
        panel.classList.add('active');
        loadTabData(name);
    }

    const hashTab = window.location.hash.replace('#', '');
    if (hashTab) showTab(hashTab);

    // ==========================================
    // 2. NAVIGARE ÎNTRE TAB-URI
    // ==========================================

    document.querySelectorAll('button.nav-item[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.getAttribute('data-tab');
            showTab(name);
            history.replaceState(null, '', name === 'profile' ? '/profile' : `#${name}`);
        });
    });

    // ==========================================
    // 3. PANOURI EDITARE / SETĂRI
    // ==========================================

    const toggleEditBtn = $('toggleEditBtn');
    const toggleSettingsBtn = $('toggleSettingsBtn');
    const editProfilePanel = $('editProfilePanel');
    const settingsPanel = $('settingsPanel');

    if (toggleEditBtn && editProfilePanel) {
        toggleEditBtn.addEventListener('click', () => {
            if (settingsPanel) settingsPanel.classList.add('hidden');
            editProfilePanel.classList.toggle('hidden');
            if (!editProfilePanel.classList.contains('hidden')) {
                $('inputFullName')?.focus();
            }
        });
    }

    if (toggleSettingsBtn && settingsPanel) {
        toggleSettingsBtn.addEventListener('click', () => {
            if (editProfilePanel) editProfilePanel.classList.add('hidden');
            settingsPanel.classList.toggle('hidden');
        });
    }

    $('cancelEditBtn')?.addEventListener('click', () => {
        editProfileForm?.reset();
        editProfilePanel?.classList.add('hidden');
    });

    function setStatus(el, text, ok) {
        if (!el) return;
        el.textContent = text;
        el.style.color = ok === undefined ? '' : (ok ? '#399b70' : '#c34060');
        if (ok) {
            clearTimeout(el._timer);
            el._timer = setTimeout(() => { el.textContent = ''; }, 2500);
        }
    }

    async function postJson(url, body) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        let result = {};
        try { result = await response.json(); } catch (e) { /* ignore */ }
        return { ok: response.ok && result.success, result };
    }

    // ==========================================
    // 4. EDITARE PROFIL
    // ==========================================

    const editProfileForm = $('editProfileForm');
    const editStatus = $('editStatus');

    function showUser(user) {
        const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };

        setText('displayFullName', user.full_name);
        setText('displayFaculty', user.faculty);
        setText('displayYear', user.year);
        setText('displayEmail', user.email);
        setText('facultySeparator', (user.faculty && user.year) ? ' • ' : '');

        const facultyLine = $('facultyLine');
        if (facultyLine) facultyLine.style.display = (user.faculty || user.year) ? 'block' : 'none';

        const displayBio = $('displayBio');
        if (displayBio) {
            displayBio.textContent = user.bio;
            displayBio.style.display = user.bio ? 'block' : 'none';
        }

        // Numele din bara laterală
        document.querySelectorAll('.profile-info strong').forEach(el => {
            el.textContent = user.full_name;
        });

        // Valorile implicite ale formularului (pentru "Anulează")
        ['inputFullName', 'inputEmail', 'inputFaculty', 'inputYear'].forEach(id => {
            const el = $(id);
            if (el) el.defaultValue = el.value;
        });
        const bio = $('inputBio');
        if (bio) bio.defaultValue = bio.value;
    }

    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setStatus(editStatus, t('msgSaving'));

            const body = {
                full_name: $('inputFullName').value,
                faculty: $('inputFaculty').value,
                year: $('inputYear').value,
                bio: $('inputBio').value
            };
            if ($('inputEmail')) body.email = $('inputEmail').value;

            try {
                const { ok, result } = await postJson('/api/profile/update', body);
                if (ok) {
                    showUser(result.user);
                    setStatus(editStatus, t('msgProfileUpdated'), true);
                } else {
                    setStatus(editStatus, result.message || t('msgError'), false);
                }
            } catch (err) {
                setStatus(editStatus, t('msgError'), false);
            }
        });
    }

    // ==========================================
    // 5. SETĂRI CONT
    // ==========================================

    const settingsStatus = $('settingsStatus');

    function bindSetting(id, field) {
        const checkbox = $(id);
        if (!checkbox) return;

        checkbox.addEventListener('change', async () => {
            try {
                const { ok, result } = await postJson('/api/profile/settings', { [field]: checkbox.checked });
                if (ok) {
                    setStatus(settingsStatus, t('msgSettingsSaved'), true);
                } else {
                    checkbox.checked = !checkbox.checked;
                    setStatus(settingsStatus, result.message || t('msgError'), false);
                }
            } catch (err) {
                checkbox.checked = !checkbox.checked;
                setStatus(settingsStatus, t('msgError'), false);
            }
        });
    }

    bindSetting('chkPrivateAccount', 'private_account');
    bindSetting('chkEmailNotif', 'email_notifications');

    // ==========================================
    // 6. SCHIMBARE PAROLĂ
    // ==========================================

    const passwordForm = $('passwordForm');
    const passwordStatus = $('passwordStatus');

    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const current_password = $('inputCurrentPassword').value;
            const new_password = $('inputNewPassword').value;
            const confirm_password = $('inputConfirmPassword').value;

            if (new_password !== confirm_password) {
                setStatus(passwordStatus, t('msgPasswordMismatch'), false);
                return;
            }

            setStatus(passwordStatus, t('msgSaving'));

            try {
                const { ok, result } = await postJson('/api/profile/password', {
                    current_password, new_password, confirm_password
                });
                if (ok) {
                    passwordForm.reset();
                    setStatus(passwordStatus, t('msgPasswordChanged'), true);
                } else {
                    setStatus(passwordStatus, result.message || t('msgError'), false);
                }
            } catch (err) {
                setStatus(passwordStatus, t('msgError'), false);
            }
        });
    }

    // ==========================================
    // 7. LIMBĂ (RO / EN) - salvată între pagini
    // ==========================================

    const langDropdown = $('langDropdown');
    const langMenuBtn = $('langMenuBtn');
    const langOptionsList = $('langOptions');
    const langOptionBtns = document.querySelectorAll('.lang-option');

    function applyLanguage(lang) {
        if (!translations[lang]) return;
        currentLang = lang;
        const dict = translations[lang];

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) el.textContent = dict[key];
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (dict[key]) el.placeholder = dict[key];
        });

        langOptionBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-lang') === lang));
        document.documentElement.lang = lang;
    }

    if (langMenuBtn && langOptionsList) {
        langMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            langOptionsList.classList.toggle('hidden');
        });
    }

    langOptionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
            applyLanguage(lang);
            langOptionsList?.classList.add('hidden');
        });
    });

    document.addEventListener('click', (e) => {
        if (langDropdown && langOptionsList && !langDropdown.contains(e.target)) {
            langOptionsList.classList.add('hidden');
        }
    });

    applyLanguage(currentLang);
});
