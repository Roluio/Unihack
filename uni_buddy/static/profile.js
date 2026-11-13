document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanels = document.querySelectorAll('.tab-panel');

    navItems.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            navItems.forEach(item => item.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
        });
    });

    const toggleEditBtn = document.getElementById('toggleEditBtn');
    const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
    const editProfilePanel = document.getElementById('editProfilePanel');
    const settingsPanel = document.getElementById('settingsPanel');

    toggleEditBtn.addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
        editProfilePanel.classList.toggle('hidden');
    });

    toggleSettingsBtn.addEventListener('click', () => {
        editProfilePanel.classList.add('hidden');
        settingsPanel.classList.toggle('hidden');
    });

    // Salvare editare profil
    const editProfileForm = document.getElementById('editProfileForm');
    const editStatus = document.getElementById('editStatus');

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

    // Salvare setări (Cont privat / Notificări email)
    const chkPrivateAccount = document.getElementById('chkPrivateAccount');
    const chkEmailNotif = document.getElementById('chkEmailNotif');

    chkPrivateAccount.addEventListener('change', async () => {
        await fetch('/api/profile/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ private_account: chkPrivateAccount.checked })
        });
    });

    chkEmailNotif.addEventListener('change', async () => {
        await fetch('/api/profile/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email_notifications: chkEmailNotif.checked })
        });
    });

    // Schimbare limbă (RO / EN)
    const langDropdown = document.getElementById('langDropdown');
    const langMenuBtn = document.getElementById('langMenuBtn');
    const langOptionsList = document.getElementById('langOptions');
    const langOptionBtns = document.querySelectorAll('.lang-option');
    let currentLang = 'ro';

    const translations = {
        ro: {
            langLabel: "LIMBĂ",
            logout: "DECONECTARE",
            navProfile: "PROFILUL MEU",
            navPosts: "POSTĂRILE MELE",
            navMessages: "MESAJE",
            navNotifications: "NOTIFICĂRI",
            navSearch: "CĂUTARE",
            navFriends: "PRIETENI",
            editProfile: "EDITEAZĂ PROFIL",
            settings: "SETĂRI",
            editTitle: "EDITARE INFORMAȚII PROFIL",
            lblName: "NUME COMPLET:",
            lblFaculty: "FACULTATE:",
            lblYear: "AN DE STUDIU:",
            lblBio: "DESPRE MINE:",
            saveChanges: "SALVEAZĂ",
            settingsTitle: "SETĂRI CONT & CONFIDENȚIALITATE",
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
            logout: "LOG OUT",
            navProfile: "MY PROFILE",
            navPosts: "MY POSTS",
            navMessages: "MESSAGES",
            navNotifications: "NOTIFICATIONS",
            navSearch: "SEARCH",
            navFriends: "FRIENDS",
            editProfile: "EDIT PROFILE",
            settings: "SETTINGS",
            editTitle: "EDIT PROFILE INFORMATION",
            lblName: "FULL NAME:",
            lblFaculty: "FACULTY:",
            lblYear: "YEAR OF STUDY:",
            lblBio: "ABOUT ME:",
            saveChanges: "SAVE CHANGES",
            settingsTitle: "ACCOUNT & PRIVACY SETTINGS",
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