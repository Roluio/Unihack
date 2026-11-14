document.addEventListener('DOMContentLoaded', () => {
    const hashTab = window.location.hash.replace('#', '');
    if (hashTab && document.getElementById(`tab-${hashTab}`)) {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const activeBtn = document.querySelector(`.nav-item[data-tab="${hashTab}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        document.getElementById(`tab-${hashTab}`).classList.add('active');
    }

    const navItems = document.querySelectorAll('button.nav-item[data-tab]');
    const tabPanels = document.querySelectorAll('.tab-panel');

    navItems.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${targetTab}`).classList.add('active');

            if (targetTab === 'friends') loadFriends();
            if (targetTab === 'notifications') loadNotifications();
            if (targetTab === 'search') searchPeers('');
        });
    });

    const toggleEditBtn = document.getElementById('toggleEditBtn');
    const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
    const editProfilePanel = document.getElementById('editProfilePanel');
    const settingsPanel = document.getElementById('settingsPanel');

    if (toggleEditBtn && toggleSettingsBtn) {
        toggleEditBtn.addEventListener('click', () => {
            settingsPanel.classList.add('hidden');
            editProfilePanel.classList.toggle('hidden');
        });
        toggleSettingsBtn.addEventListener('click', () => {
            editProfilePanel.classList.add('hidden');
            settingsPanel.classList.toggle('hidden');
        });
    }

    const editProfileForm = document.getElementById('editProfileForm');
    const editStatus = document.getElementById('editStatus');

    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const full_name = document.getElementById('inputFullName').value;
            const faculty = document.getElementById('inputFaculty').value;
            const year = document.getElementById('inputYear').value;
            const bio = document.getElementById('inputBio').value;

            const response = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name, faculty, year, bio })
            });
            const result = await response.json();

            if (result.success) {
                document.getElementById('displayFullName').textContent = result.user.full_name;
                const facultyLine = document.getElementById('facultyLine');
                const displayFaculty = document.getElementById('displayFaculty');
                const displayYear = document.getElementById('displayYear');
                const facultySeparator = document.getElementById('facultySeparator');

                displayFaculty.textContent = result.user.faculty;
                displayYear.textContent = result.user.year;
                facultySeparator.textContent = (result.user.faculty && result.user.year) ? ' • ' : '';
                facultyLine.style.display = (result.user.faculty || result.user.year) ? 'block' : 'none';

                const displayBio = document.getElementById('displayBio');
                displayBio.textContent = result.user.bio;
                displayBio.style.display = result.user.bio ? 'block' : 'none';

                editStatus.textContent = currentLang === 'ro' ? 'Profil actualizat în baza de date!' : 'Profile updated!';
                setTimeout(() => { editStatus.textContent = ''; }, 2500);
            } else {
                editStatus.textContent = result.message || 'Eroare la actualizare';
            }
        });
    }

    const chkPrivateAccount = document.getElementById('chkPrivateAccount');
    const chkEmailNotif = document.getElementById('chkEmailNotif');

    if (chkPrivateAccount) {
        chkPrivateAccount.addEventListener('change', async () => {
            await fetch('/api/profile/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ private_account: chkPrivateAccount.checked })
            });
        });
    }

    if (chkEmailNotif) {
        chkEmailNotif.addEventListener('change', async () => {
            await fetch('/api/profile/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email_notifications: chkEmailNotif.checked })
            });
        });
    }

    // ==========================================
    // CAUTARE STUDENTI (Spring Boot /api/users/search)
    // ==========================================
    const searchInput = document.getElementById('searchInput');
    const searchResultsContainer = document.getElementById('searchResultsContainer');
    let searchTimer = null;

    async function searchPeers(query) {
        if (!searchResultsContainer) return;
        try {
            const resp = await fetch(`/api/users/search?query=${encodeURIComponent(query)}`);
            const users = await resp.json();
            if (!Array.isArray(users) || users.length === 0) {
                searchResultsContainer.innerHTML = `<p class="empty-msg">Niciun student găsit.</p>`;
                return;
            }
            searchResultsContainer.innerHTML = users.map(u => `
                <div class="sub-card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <div>
                        <strong>${u.firstName} ${u.lastName}</strong> <span style="opacity:0.7;">@${u.username}</span>
                        <div style="font-size:0.85rem;opacity:0.8;">${u.faculty || ''} • Anul ${u.studyYear || '-'}</div>
                    </div>
                    <button type="button" class="primary-button" onclick="sendFriendRequest('${u.id}', this)">+ Adaugă prieten</button>
                </div>
            `).join('');
        } catch (e) {
            searchResultsContainer.innerHTML = `<p class="empty-msg">Eroare la căutare.</p>`;
        }
    }

    window.sendFriendRequest = async (userId, btn) => {
        btn.disabled = true;
        btn.textContent = 'Se trimite...';
        const resp = await fetch(`/api/friends/request/${userId}`, { method: 'POST' });
        const data = await resp.json();
        if (resp.ok) {
            btn.textContent = 'Cerere trimisă ✓';
        } else {
            btn.textContent = data.message || 'Eroare';
        }
    };

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => searchPeers(searchInput.value.trim()), 300);
        });
    }

    // ==========================================
    // CERERI PRIETENIE (Notifications tab)
    // ==========================================
    const notificationsContainer = document.getElementById('notificationsContainer');

    async function loadNotifications() {
        if (!notificationsContainer) return;
        try {
            const resp = await fetch('/api/friends/requests/received');
            const requests = await resp.json();
            if (!Array.isArray(requests) || requests.length === 0) {
                notificationsContainer.innerHTML = `<p class="empty-msg">Nicio cerere de prietenie nouă.</p>`;
                return;
            }
            notificationsContainer.innerHTML = requests.map(r => `
                <div class="sub-card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <div>
                        <strong>${r.user.firstName} ${r.user.lastName}</strong> (@${r.user.username}) ți-a trimis o cerere de prietenie.
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button type="button" class="primary-button" onclick="respondRequest('${r.requestId}', 'accept')">Acceptă</button>
                        <button type="button" class="secondary-button" onclick="respondRequest('${r.requestId}', 'reject')">Refuză</button>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            notificationsContainer.innerHTML = `<p class="empty-msg">Eroare la încărcarea notificărilor.</p>`;
        }
    }

    window.respondRequest = async (requestId, action) => {
        await fetch(`/api/friends/${action}/${requestId}`, { method: 'POST' });
        loadNotifications();
        loadFriends();
    };

    // ==========================================
    // LISTA PRIETENI (Friends tab)
    // ==========================================
    const friendsContainer = document.getElementById('friendsContainer');

    async function loadFriends() {
        if (!friendsContainer) return;
        try {
            const resp = await fetch('/api/friends');
            const friends = await resp.json();
            if (!Array.isArray(friends) || friends.length === 0) {
                friendsContainer.innerHTML = `<p class="empty-msg">Lista de prieteni este goală.</p>`;
                return;
            }
            friendsContainer.innerHTML = friends.map(f => `
                <div class="sub-card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <div>
                        <strong>${f.firstName} ${f.lastName}</strong> <span style="opacity:0.7;">@${f.username}</span>
                        <div style="font-size:0.85rem;opacity:0.8;">${f.faculty || ''} • Anul ${f.studyYear || '-'}</div>
                    </div>
                    <button type="button" class="secondary-button" onclick="removeFriend('${f.id}')">Elimină</button>
                </div>
            `).join('');
        } catch (e) {
            friendsContainer.innerHTML = `<p class="empty-msg">Eroare la încărcarea prietenilor.</p>`;
        }
    }

    window.removeFriend = async (friendId) => {
        await fetch(`/api/friends/${friendId}`, { method: 'DELETE' });
        loadFriends();
    };

    if (hashTab === 'friends') loadFriends();
    if (hashTab === 'notifications') loadNotifications();
    if (hashTab === 'search') searchPeers('');

    // 4. Schimbare limba (RO / EN)
    const langDropdown = document.getElementById('langDropdown');
    const langMenuBtn = document.getElementById('langMenuBtn');
    const langOptionsList = document.getElementById('langOptions');
    const langOptionBtns = document.querySelectorAll('.lang-option');
    let currentLang = 'ro';

    const translations = {
        ro: {
            langLabel: "LIMBĂ", logout: "Deconectare", navHome: "Acasă", homeTitle: "Acasă",
            emptyHome: "Nicio postare recentă de la prieteni.", navProfile: "Profilul meu",
            navPosts: "Postările mele", navMessages: "Mesaje", navNotifications: "Notificări",
            navSearch: "Căutare", navFriends: "Prieteni", editProfile: "Editează profil",
            settings: "Setări", editTitle: "Editare informații profil", lblName: "Nume complet",
            lblFaculty: "Facultate", lblYear: "An de studiu", lblBio: "Despre mine",
            saveChanges: "Salvează", settingsTitle: "Setări cont & confidențialitate",
            setPrivate: "Cont privat", setPrivateDesc: "Doar prietenii aprobați îți pot vedea profilul și activitatea.",
            setEmailNotif: "Notificări pe email", setEmailDesc: "Primește alerte când cineva îți trimite un mesaj nou.",
            setAccountEmail: "Email asociat", emptyPosts: "Nicio postare încă.",
            emptyMessages: "Niciun mesaj încă.", emptyNotifications: "Nicio notificare încă.",
            emptyFriends: "Lista de prieteni este goală.", searchPlaceholder: "Caută..."
        },
        en: {
            langLabel: "LANGUAGE", logout: "Log out", navHome: "Home", homeTitle: "Home",
            emptyHome: "No recent posts from friends.", navProfile: "My profile",
            navPosts: "My posts", navMessages: "Messages", navNotifications: "Notifications",
            navSearch: "Search", navFriends: "Friends", editProfile: "Edit profile",
            settings: "Settings", editTitle: "Edit profile information", lblName: "Full name",
            lblFaculty: "Faculty", lblYear: "Year of study", lblBio: "About me",
            saveChanges: "Save changes", settingsTitle: "Account & privacy settings",
            setPrivate: "Private account", setPrivateDesc: "Only approved friends can view your profile and activity.",
            setEmailNotif: "Email notifications", setEmailDesc: "Receive alerts when someone sends you a new message.",
            setAccountEmail: "Associated email", emptyPosts: "No posts yet.",
            emptyMessages: "No messages yet.", emptyNotifications: "No notifications yet.",
            emptyFriends: "Your friends list is empty.", searchPlaceholder: "Search..."
        }
    };

    langMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        langOptionsList.classList.toggle('hidden');
    });

    langOptionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentLang = btn.getAttribute('data-lang');
            const dict = translations[currentLang];
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (dict[key]) el.textContent = dict[key];
            });
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                if (dict[key]) el.placeholder = dict[key];
            });
            langOptionBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-lang') === currentLang));
            langOptionsList.classList.add('hidden');
        });
    });

    document.addEventListener('click', (e) => {
        if (!langDropdown.contains(e.target)) {
            langOptionsList.classList.add('hidden');
        }
    });
});