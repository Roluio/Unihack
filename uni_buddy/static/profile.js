document.addEventListener('DOMContentLoaded', () => {
    // 1. Activare tab din URL hash dacă venim din /home (ex: /profile#messages)
    const hashTab = window.location.hash.replace('#', '');
    if (hashTab && document.getElementById(`tab-${hashTab}`)) {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const activeBtn = document.querySelector(`.nav-item[data-tab="${hashTab}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        document.getElementById(`tab-${hashTab}`).classList.add('active');
    }

    // 2. Navigare între tab-urile de pe pagina de profil
    const navItems = document.querySelectorAll('button.nav-item[data-tab]');
    const tabPanels = document.querySelectorAll('.tab-panel');

    navItems.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
        });
    });

    // 3. Editare profil & Setări (rulăm doar dacă elementele există pe pagina curentă)
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

                editStatus.textContent = currentLang === 'ro' ? 'Profil actualizat!' : 'Profile updated!';
                setTimeout(() => { editStatus.textContent = ''; }, 2500);
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

    // 4. Schimbare limbă (RO / EN)
    const langDropdown = document.getElementById('langDropdown');
    const langMenuBtn = document.getElementById('langMenuBtn');
    const langOptionsList = document.getElementById('langOptions');
    const langOptionBtns = document.querySelectorAll('.lang-option');
    let currentLang = 'ro';

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
            lblFaculty: "Facultate",
            lblYear: "An de studiu",
            lblBio: "Despre mine",
            saveChanges: "Salvează",
            settingsTitle: "Setări cont & confidențialitate",
            setPrivate: "Cont privat",
            setPrivateDesc: "Doar prietenii aprobați îți pot vedea profilul și activitatea.",
            setEmailNotif: "Notificări pe email",
            setEmailDesc: "Primește alerte când cineva îți trimite un mesaj nou.",
            setAccountEmail: "Email asociat",
            emptyPosts: "Nicio postare încă.",
            emptyMessages: "Niciun mesaj încă.",
            emptyNotifications: "Nicio notificare încă.",
            emptyFriends: "Lista de prieteni este goală.",
            searchPlaceholder: "Caută..."
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
            lblFaculty: "Faculty",
            lblYear: "Year of study",
            lblBio: "About me",
            saveChanges: "Save changes",
            settingsTitle: "Account & privacy settings",
            setPrivate: "Private account",
            setPrivateDesc: "Only approved friends can view your profile and activity.",
            setEmailNotif: "Email notifications",
            setEmailDesc: "Receive alerts when someone sends you a new message.",
            setAccountEmail: "Associated email",
            emptyPosts: "No posts yet.",
            emptyMessages: "No messages yet.",
            emptyNotifications: "No notifications yet.",
            emptyFriends: "Your friends list is empty.",
            searchPlaceholder: "Search..."
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