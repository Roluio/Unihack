# Unihack: StudyGram / UniBuddy

Aplicația combină ramurile `robert` (interfață StudyGram, Buddy AI cu Gemini, temă dark, forum, bibliotecă, mesaje) și `denisa` (backend Spring Boot cu conturi JWT, profil și prietenii).

## Structură

| Folder | Conținut |
|---|---|
| `uni_buddy/` | Aplicația Flask (frontend + proxy către Spring Boot + Buddy AI) |
| `studyhub-backend/` | Backend Spring Boot + PostgreSQL (auth JWT, profil, căutare, prietenii) |
| `UniBuddy/` | Copii vechi ale proiectului (`backend-java`, `legacy`), păstrate doar pentru referință |

## Cum comunică

Browserul vorbește doar cu Flask (port 5000). Flask ține tokenurile JWT în sesiune și apelează Spring Boot (port 8080, `STUDYHUB_BACKEND_URL`). Când tokenul de acces expiră (15 min), Flask îl reînnoiește automat cu refresh token-ul.

- Conturi, login, profil, căutare studenți, prietenii: Spring Boot.
- Buddy AI (`/api/ai/*`): Flask + Gemini. Cere o sesiune validă.
- Forum, notificări, bibliotecă, mesaje: stocate în browser (localStorage / IndexedDB).
- Setările „cont privat" și „notificări pe email" rămân în sesiune (backend-ul nu le are).
- Schimbarea parolei și a emailului nu există în backend. Endpointul `/api/profile/password` răspunde cu 501, iar emailul nu se modifică.

## Pornire

### 1. Baza de date și backend (Java 21 + PostgreSQL)

```bash
# creează baza `studyhub` și userul din studyhub-backend/.env
cd studyhub-backend
./mvnw spring-boot:run        # Windows: mvnw.cmd spring-boot:run
```

Valorile din `studyhub-backend/.env` (`DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`) trebuie exportate ca variabile de mediu pentru `mvnw`. În VS Code, `.vscode/launch.json` le încarcă singur din acest fișier.

### 2. Aplicația Flask

```bash
cd uni_buddy
python -m venv .venv
.venv\Scripts\activate         # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env         # apoi pune GEMINI_API_KEY în .env
python app.py
```

Deschide http://127.0.0.1:5000, creează un cont (se loghează cu **email** și parolă de minim 8 caractere). Utilizatorii demo `student1` nu mai există.

## Note
- Nu urca `.env` pe GitHub (este în `.gitignore`).
- Setează `DB_PASSWORD`, `JWT_SECRET` și `FLASK_SECRET_KEY` înainte de orice deploy.
- Fără backend-ul Java pornit, login-ul răspunde cu „Backend-ul Java nu răspunde".
