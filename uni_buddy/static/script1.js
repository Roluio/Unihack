document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('loginSection');
    const signupSection = document.getElementById('signupSection');
    const showSignupBtn = document.getElementById('showSignupBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');

    const langDropdown = document.getElementById('langDropdown');
    const langMenuBtn = document.getElementById('langMenuBtn');
    const langOptionsList = document.getElementById('langOptions');
    const langOptionBtns = document.querySelectorAll('.lang-option');

    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginStatus = document.getElementById('loginStatus');
    const signupStatus = document.getElementById('signupStatus');

    let currentLang = 'en';

    const translations = {
        en: {
            langLabel: "LANGUAGE",
            loginTitle: "LOG IN",
            signupTitle: "SIGN UP",
            username: "USERNAME:",
            email: "EMAIL:",
            password: "PASSWORD:",
            confirmPassword: "CONFIRM PASSWORD:",
            forgot: "FORGOT PASSWORD",
            submit: "ENTER →",
            registerBtn: "REGISTER →",
            noAccount: "DONT HAVE AN ACCOUNT?",
            createAccount: "CREATE ACCOUNT",
            haveAccount: "ALREADY HAVE AN ACCOUNT?",
            loginLink: "LOG IN",
            checking: "Checking...",
            creating: "Creating account...",
            connError: "Server connection error.",
            accountCreated: "Account created! Enter your password to log in."
        },
        ro: {
            langLabel: "LIMBĂ",
            loginTitle: "AUTENTIFICARE",
            signupTitle: "CREARE CONT",
            username: "UTILIZATOR:",
            email: "EMAIL:",
            password: "PAROLĂ:",
            confirmPassword: "CONFIRMĂ PAROLA:",
            forgot: "AI UITAT PAROLA?",
            submit: "INTRĂ →",
            registerBtn: "ÎNREGISTRARE →",
            noAccount: "NU AI CONT?",
            createAccount: "CREEAZĂ CONT",
            haveAccount: "AI DEJA UN CONT?",
            loginLink: "AUTENTIFICĂ-TE",
            checking: "Se verifică...",
            creating: "Se creează contul...",
            connError: "Eroare de conexiune cu serverul.",
            accountCreated: "Cont creat! Introdu parola pentru a intra."
        }
    };

    function applyLanguage(lang) {
        currentLang = lang;
        const dict = translations[lang];

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                el.textContent = dict[key];
            }
        });

        langOptionBtns.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
        });
    }

    langMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        langOptionsList.classList.toggle('hidden');
        langMenuBtn.classList.toggle('open');
    });

    langOptionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedLang = btn.getAttribute('data-lang');
            loginStatus.textContent = '';
            signupStatus.textContent = '';
            applyLanguage(selectedLang);

            langOptionsList.classList.add('hidden');
            langMenuBtn.classList.remove('open');
        });
    });

    document.addEventListener('click', (e) => {
        if (!langDropdown.contains(e.target)) {
            langOptionsList.classList.add('hidden');
            langMenuBtn.classList.remove('open');
        }
    });

    showSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginStatus.textContent = '';
        loginSection.classList.add('hidden');
        signupSection.classList.remove('hidden');
    });

    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signupStatus.textContent = '';
        signupSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        loginStatus.style.color = '#3a235b';
        loginStatus.textContent = translations[currentLang].checking;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const result = await response.json();

            if (response.ok && result.success) {
                loginStatus.style.color = '#2e7d32';
                loginStatus.textContent = result.message;
                setTimeout(() => {
                    window.location.href = result.redirect || '/profile';
                }, 600);
            } else {
                loginStatus.style.color = '#c62828';
                loginStatus.textContent = result.message;
            }
        } catch (error) {
            loginStatus.style.color = '#c62828';
            loginStatus.textContent = translations[currentLang].connError;
        }
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('signupUsername').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;

        signupStatus.style.color = '#3a235b';
        signupStatus.textContent = translations[currentLang].creating;

        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, confirmPassword })
            });
            const result = await response.json();

            if (response.ok && result.success) {
                signupStatus.style.color = '#2e7d32';
                signupStatus.textContent = result.message;

                setTimeout(() => {
                    signupForm.reset();
                    signupStatus.textContent = '';
                    signupSection.classList.add('hidden');
                    loginSection.classList.remove('hidden');
                    document.getElementById('loginUsername').value = username;
                    loginStatus.style.color = '#2e7d32';
                    loginStatus.textContent = translations[currentLang].accountCreated;
                }, 1200);
            } else {
                signupStatus.style.color = '#c62828';
                signupStatus.textContent = result.message;
            }
        } catch (error) {
            signupStatus.style.color = '#c62828';
            signupStatus.textContent = translations[currentLang].connError;
        }
    });
});