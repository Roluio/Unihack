# UniBuddy / StudyHub — Unihack

Platformă pentru studenți: profil, bibliotecă de materiale, mesagerie și **UniBuddy AI** (Google Gemini API).

## Structura proiectului (după unificarea ramurilor)

| Folder | Ce conține |
|---|---|
| `uni_buddy/` | Aplicația principală (Flask): login, home, profil, Library, Messages, **AI**. Baza: ramura `larisa`, care era un superset al ramurii `laura`. |
| `backend-java/` | Backend Spring Boot + PostgreSQL (auth JWT, prietenii) din ramura `denisa`. Nu este conectat încă la aplicația Flask. |
| `legacy/` | Pagina de login StudyHub și fișiere de test (`robert/`, `src/`, `public/`), păstrate pentru referință. |

Ramurile `main`, `mainapp`, `denisa/index.html` și `laura/index.html` aveau doar `index.html` gol și au fost omise.

## Pornire rapidă

```bash
cd uni_buddy
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env               # Windows: copy .env.example .env
# deschide .env și lipește cheia în GEMINI_API_KEY

python app.py
```

Deschide http://127.0.0.1:5000 și loghează-te cu `student1` / `parola123` (sau creează un cont).

### Cheia Gemini
1. Intră pe https://aistudio.google.com/apikey și creează o cheie gratuită.
2. Pune-o în `uni_buddy/.env` ca `GEMINI_API_KEY=...`. Cheia rămâne doar pe server.
3. Opțional: `GEMINI_MODEL=...` pentru alt model. Dacă modelul e indisponibil sau a depășit cota, aplicația încearcă automat următorul din listă (`gemini_service.py`, `DEFAULT_MODELS`).

## Ce poate face AI-ul

Pagina `/ai` (butonul ✦ BUDDY) are cinci moduri:

- **Chat**: răspunde la întrebări, explică, dă sfaturi, scrie și depanează cod. Este personalizat cu numele, facultatea, anul și bio-ul din profil. Păstrează istoricul conversației și răspunde în RO sau EN.
- **Summary**: rezumă text, notițe sau un PDF/imagine, în patru stiluri (detaliat, scurt, articol științific, explicat simplu).
- **Quiz**: test grilă interactiv, cu număr de întrebări și dificultate alese de tine. Are scor și explicații.
- **Flashcards**: carduri care se întorc la click.
- **Study plan**: plan zi cu zi, după examen, număr de zile și ore pe zi.

Materialele pot fi notițe lipite sau un fișier atașat (PDF, TXT, MD, CSV, PNG, JPG, max 15 MB).

În **Library**, butonul „Ask UniBuddy AI" trimite fișierul deschis către Gemini, deci poți pune întrebări direct despre document.

## Endpoint-uri (Flask, necesită sesiune)

`GET /api/ai/status` · `POST /api/ai/chat` · `/api/ai/summarize` · `/api/ai/quiz` · `/api/ai/flashcards` · `/api/ai/plan`

Acceptă JSON sau `multipart/form-data` (cu câmpul `file`). Limită: 20 cereri/minut/utilizator.

## Note pentru echipă
- `app.secret_key` și utilizatorii sunt demo (în memorie). Pentru producție, mutați autentificarea pe `backend-java` sau pe o bază de date.
- Nu urcați `.env` pe GitHub (este deja în `.gitignore`).
- Parola bazei de date și secretul JWT din `backend-java/.../application.yml` au valori implicite de dezvoltare. Setați `DB_PASSWORD` și `JWT_SECRET` înainte de orice deploy.
