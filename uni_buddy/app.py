import os
import secrets
import time

import requests
from flask import (
    Flask,
    Response,
    render_template,
    request,
    jsonify,
    session,
    redirect,
    url_for
)

import gemini_service as ai

app = Flask(__name__)

# Uploads: the Library and forum accept files up to 25 MB, several per request.
app.config["MAX_CONTENT_LENGTH"] = 80 * 1024 * 1024
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_HTTPONLY"] = True

def load_secret_key():
    """FLASK_SECRET_KEY if set, otherwise a random key generated once and kept in instance/secret_key."""
    from_env = os.environ.get("FLASK_SECRET_KEY")
    if from_env:
        return from_env
    path = os.path.join(app.instance_path, "secret_key")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as handle:
            return handle.read().strip()
    os.makedirs(app.instance_path, exist_ok=True)
    key = secrets.token_hex(32)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(key)
    return key


app.secret_key = load_secret_key()

BACKEND_URL = os.environ.get("STUDYHUB_BACKEND_URL", "http://localhost:8080/api")

BACKEND_DOWN = "Serviciul nu este disponibil momentan. Încearcă din nou în câteva momente."

# Changes on every start, so browsers fetch fresh CSS/JS after an update.
ASSET_VERSION = str(int(time.time()))


@app.context_processor
def inject_helpers():
    def asset(filename):
        return url_for("static", filename=filename, v=ASSET_VERSION)
    return {"asset": asset}


def auth_headers():
    token = session.get("access_token")
    if not token:
        return {}
    return {"Authorization": f"Bearer {token}"}


def map_backend_profile(profile_data):
    first = (profile_data.get("firstName") or "").strip()
    last = (profile_data.get("lastName") or "").strip()
    username = profile_data.get("username") or ""
    full_name = f"{first} {last}".strip() or username
    initials = ((first[:1] + last[:1]) or username[:1]).upper()
    return {
        "id": profile_data.get("id") or "",
        "username": username,
        "email": profile_data.get("email") or "",
        "full_name": full_name,
        "firstName": first,
        "lastName": last,
        "initials": initials,
        "university": profile_data.get("university") or "",
        "faculty": profile_data.get("faculty") or "",
        "specialization": profile_data.get("specialization") or "",
        "studyYear": profile_data.get("studyYear") or 1,
        "bio": profile_data.get("bio") or "",
        "preferredLanguage": (profile_data.get("preferredLanguage") or "RO").upper(),
        "createdAt": profile_data.get("createdAt") or "",
    }


def refresh_access_token():
    """Use the refresh token to get a new access token (the access token lives 15 min)."""
    refresh_token = session.get("refresh_token")
    if not refresh_token:
        return False
    try:
        resp = requests.post(
            f"{BACKEND_URL}/auth/refresh",
            json={"refreshToken": refresh_token},
            timeout=5
        )
        body = resp.json() if resp.content else {}
    except (requests.RequestException, ValueError):
        return False

    if resp.status_code == 200 and body.get("accessToken"):
        session["access_token"] = body["accessToken"]
        session["refresh_token"] = body.get("refreshToken") or refresh_token
        return True
    return False


def backend_request(method, path, headers=None, **kwargs):
    """Call Spring Boot with the user's JWT; refresh the token once on 401.

    Raises requests.RequestException when the backend is unreachable.
    """
    kwargs.setdefault("timeout", 5)

    def send():
        merged = auth_headers()
        merged.update(headers or {})
        return requests.request(method, f"{BACKEND_URL}{path}", headers=merged, **kwargs)

    resp = send()
    if resp.status_code == 401 and refresh_access_token():
        resp.close()
        resp = send()
    return resp


def fetch_current_user():
    if not session.get("access_token"):
        return None, None

    try:
        resp = backend_request("GET", "/users/me")
        if resp.status_code == 200:
            user = map_backend_profile(resp.json())
            session["user_cache"] = user
            session["username"] = user["username"]
            return user["username"], user
        if resp.status_code in (401, 403):
            session.clear()
            return None, None
    except (requests.RequestException, ValueError):
        pass

    cached = session.get("user_cache")
    if cached:
        return cached.get("username"), cached
    return None, None


def render_app(template, active, **context):
    """Render a logged-in page, or send the visitor to the login page."""
    username, user = fetch_current_user()
    if not user:
        return redirect(url_for("index"))
    return render_template(template, username=username, user=user, active=active, **context)


def error_message(body, fallback):
    msg = body.get("message") if isinstance(body, dict) else None
    if not msg and isinstance(body, dict) and isinstance(body.get("validationErrors"), dict):
        msg = next(iter(body["validationErrors"].values()), None)
    return msg or fallback


# ==========================================
# PAGES
# ==========================================

@app.route("/")
def index():
    username, user = fetch_current_user()
    if user:
        return redirect(url_for("home_feed"))
    return render_template("login.html")


@app.route("/home")
def home_feed():
    return render_app("home.html", "home")


@app.route("/library")
def library():
    return render_app("library.html", "library")


@app.route("/calendar")
def calendar_page():
    return render_app("calendar.html", "calendar")


@app.route("/messages")
def messages():
    return render_app("messages.html", "messages")


@app.route("/friends")
def friends():
    return render_app("friends.html", "friends")


@app.route("/search")
def search():
    username, user = fetch_current_user()
    if not user:
        return redirect(url_for("index"))
    return redirect(url_for("friends") + "#find")


@app.route("/notifications")
def notifications():
    return render_app("notifications.html", "notifications")


@app.route("/profile")
def profile():
    return render_app("profile.html", "profile")


@app.route("/logout")
def logout():
    refresh_token = session.get("refresh_token")
    if refresh_token:
        try:
            requests.post(
                f"{BACKEND_URL}/auth/logout",
                json={"refreshToken": refresh_token},
                timeout=3
            )
        except requests.RequestException:
            pass
    session.clear()
    return redirect(url_for("index"))


# ==========================================
# AUTH API -> SPRING BOOT
# ==========================================

def start_session(body, fallback_username):
    """Store the tokens of a fresh login. Nothing from a previous account survives."""
    session.clear()
    session["access_token"] = body["accessToken"]
    session["refresh_token"] = body.get("refreshToken", "")
    session["username"] = body.get("username", fallback_username)
    username, user = fetch_current_user()
    return user


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("username", "")).strip()
    password = str(data.get("password", "")).strip()

    if not email or not password:
        return jsonify({"success": False, "message": "Completează toate câmpurile."}), 400

    try:
        resp = requests.post(
            f"{BACKEND_URL}/auth/login",
            json={"email": email, "password": password},
            timeout=5
        )
        body = resp.json() if resp.content else {}

        if resp.status_code == 200 and "accessToken" in body:
            user = start_session(body, email)
            return jsonify({
                "success": True,
                "message": "Bine ai revenit!",
                "language": (user or {}).get("preferredLanguage", "RO").lower(),
                "redirect": "/home"
            })

        msg = body.get("message") or "Email sau parolă incorectă."
        return jsonify({"success": False, "message": msg}), resp.status_code

    except requests.RequestException:
        return jsonify({"success": False, "message": BACKEND_DOWN}), 503


@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}

    def field(name, limit=200):
        # collapse repeated spaces so "Automatica  si Calculatoare" matches the same faculty
        return " ".join(str(data.get(name, "")).split())[:limit]

    first_name = field("firstName", 100)
    last_name = field("lastName", 100)
    username = field("username", 50)
    email = field("email", 255)
    password = str(data.get("password", "")).strip()
    confirm_password = str(data.get("confirmPassword", "")).strip()
    university = field("university")
    faculty = field("faculty")
    specialization = field("specialization")
    try:
        study_year = int(data.get("studyYear"))
    except (TypeError, ValueError):
        study_year = 0

    required = [first_name, last_name, username, email, password, confirm_password,
                university, faculty, specialization]
    if not all(required):
        return jsonify({"success": False, "message": "Completează toate câmpurile."}), 400

    if password != confirm_password:
        return jsonify({"success": False, "message": "Parolele nu coincid."}), 400

    if len(password) < 8:
        return jsonify({"success": False, "message": "Parola trebuie să aibă minim 8 caractere."}), 400

    if not 1 <= study_year <= 6:
        return jsonify({"success": False, "message": "Anul de studiu trebuie să fie între 1 și 6."}), 400

    payload = {
        "firstName": first_name,
        "lastName": last_name,
        "username": username,
        "email": email,
        "password": password,
        "university": university,
        "faculty": faculty,
        "specialization": specialization,
        "studyYear": study_year
    }

    try:
        resp = requests.post(f"{BACKEND_URL}/auth/register", json=payload, timeout=5)
        body = resp.json() if resp.content else {}

        if resp.status_code in (200, 201) and "accessToken" in body:
            start_session(body, username)
            return jsonify({
                "success": True,
                "message": "Cont creat cu succes!",
                "redirect": "/home"
            })

        return jsonify({"success": False, "message": error_message(body, "Eroare la înregistrare.")}), resp.status_code

    except requests.RequestException:
        return jsonify({"success": False, "message": BACKEND_DOWN}), 503


# ==========================================
# PROFILE API -> SPRING BOOT
# ==========================================

@app.route("/api/profile/update", methods=["POST"])
def update_profile():
    username, current = fetch_current_user()
    if not current:
        return jsonify({"success": False, "message": "Neautorizat."}), 401

    data = request.get_json(silent=True) or {}

    def text(name, limit):
        value = str(data.get(name, current.get(name) or ""))
        return (value.strip() if name == "bio" else " ".join(value.split()))[:limit]

    try:
        study_year = int(data.get("studyYear", current["studyYear"]))
    except (TypeError, ValueError):
        study_year = current["studyYear"]

    lang = str(data.get("preferredLanguage", current["preferredLanguage"])).upper()
    if lang not in ("RO", "EN"):
        lang = "RO"

    # The username and the email belong to the account and are not edited here.
    payload = {
        "firstName": text("firstName", 100),
        "lastName": text("lastName", 100),
        "username": current["username"],
        "profilePictureUrl": None,
        "bio": text("bio", 1000),
        "university": text("university", 200),
        "faculty": text("faculty", 200),
        "specialization": text("specialization", 200),
        "studyYear": study_year,
        "preferredLanguage": lang
    }

    try:
        resp = backend_request("PUT", "/users/me", json=payload)
        body = resp.json() if resp.content else {}

        if resp.status_code == 200:
            updated_user = map_backend_profile(body)
            session["user_cache"] = updated_user
            return jsonify({"success": True, "user": updated_user})

        return jsonify({"success": False, "message": error_message(body, "Eroare la salvare.")}), resp.status_code
    except (requests.RequestException, ValueError):
        return jsonify({"success": False, "message": BACKEND_DOWN}), 503


@app.route("/api/profile/password", methods=["POST"])
def change_password():
    username, user = fetch_current_user()
    if not user:
        return jsonify({"success": False, "message": "Neautorizat."}), 401

    data = request.get_json(silent=True) or {}
    current = str(data.get("currentPassword", ""))
    new = str(data.get("newPassword", ""))
    confirm = str(data.get("confirmPassword", ""))

    if not current or not new:
        return jsonify({"success": False, "message": "Completează toate câmpurile."}), 400
    if new != confirm:
        return jsonify({"success": False, "message": "Parolele noi nu coincid."}), 400

    try:
        resp = backend_request("PUT", "/users/me/password",
                               json={"currentPassword": current, "newPassword": new})
        body = resp.json() if resp.content else {}
        if resp.status_code == 200:
            return jsonify({"success": True, "message": "Parola a fost schimbată."})
        return jsonify({"success": False, "message": error_message(body, "Parola nu a putut fi schimbată.")}), resp.status_code
    except (requests.RequestException, ValueError):
        return jsonify({"success": False, "message": BACKEND_DOWN}), 503


@app.route("/api/catalog")
def catalog():
    """Universities and faculties already used (suggestions on the sign-up form)."""
    try:
        resp = requests.get(f"{BACKEND_URL}/auth/catalog", timeout=5)
        return jsonify(resp.json()), resp.status_code
    except (requests.RequestException, ValueError):
        return jsonify({"universities": [], "faculties": []})


# ==========================================
# FORUM, MESSAGES, LIBRARY, FRIENDS, NOTIFICATIONS -> SPRING BOOT
# ==========================================

FORWARDED_HEADERS = (
    "Content-Type", "Content-Disposition", "Content-Length",
    "Content-Range", "Accept-Ranges", "X-Content-Type-Options"
)

AREAS = "posts,conversations,drive,notifications,friends,users,calendar"


@app.route("/api/<any(posts,conversations,drive,notifications,friends,users,calendar):area>",
           defaults={"rest": ""},
           methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
@app.route("/api/<any(posts,conversations,drive,notifications,friends,users,calendar):area>/<path:rest>",
           methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
def api_proxy(area, rest):
    """Forward the browser's call to Spring Boot with the user's JWT.

    JSON, multipart uploads and file downloads (streamed, with Range support)
    all pass through unchanged.
    """
    if not session.get("access_token"):
        return jsonify({"message": "Neautorizat."}), 401

    path = f"/{area}" + (f"/{rest}" if rest else "")
    kwargs = {"params": request.args.to_dict(flat=False), "stream": True, "timeout": (5, 300)}
    headers = {}

    if request.mimetype == "multipart/form-data":
        kwargs["files"] = [
            (key, (f.filename, f.read(), f.mimetype or "application/octet-stream"))
            for key in request.files
            for f in request.files.getlist(key)
        ]
        kwargs["data"] = [(k, v) for k in request.form for v in request.form.getlist(k)]
    elif request.is_json:
        kwargs["json"] = request.get_json(silent=True)
    elif request.data:
        kwargs["data"] = request.get_data()
        headers["Content-Type"] = request.content_type or "application/octet-stream"

    if request.headers.get("Range"):
        headers["Range"] = request.headers["Range"]

    try:
        resp = backend_request(request.method, path, headers=headers, **kwargs)
    except requests.RequestException:
        return jsonify({"message": BACKEND_DOWN}), 503

    out_headers = {name: resp.headers[name] for name in FORWARDED_HEADERS if name in resp.headers}
    if resp.headers.get("Content-Encoding"):
        out_headers.pop("Content-Length", None)

    response = Response(resp.iter_content(65536), status=resp.status_code, headers=out_headers)
    response.call_on_close(resp.close)
    return response


# ==========================================
# BUDDY (Gemini API)
# ==========================================

@app.route("/ai")
def ai_page():
    username, user = fetch_current_user()

    if not user:
        return redirect(url_for("index"))

    return render_template(
        "ai.html",
        username=username,
        user=user
    )


# Simple in-memory rate limit: max 40 AI calls / minute / user
_AI_CALLS = {}


def _rate_limited(username):
    now = time.time()
    recent = [t for t in _AI_CALLS.get(username, []) if now - t < 60]
    if len(recent) >= 40:
        _AI_CALLS[username] = recent
        return True
    recent.append(now)
    _AI_CALLS[username] = recent
    return False


def _json_field(value, default):
    import json as _json
    if isinstance(value, (list, dict)):
        return value
    try:
        parsed = _json.loads(value)
        return parsed if isinstance(parsed, type(default)) else default
    except (ValueError, TypeError):
        return default


def _clean_catalog(raw):
    """Sanitise the file catalog sent by the browser (the student's 'memory')."""
    catalog = []
    for item in (raw if isinstance(raw, list) else [])[:200]:
        if not isinstance(item, dict) or not item.get("key") or not item.get("name"):
            continue
        catalog.append({
            "key": str(item["key"])[:80],
            "name": str(item["name"])[:120],
            "mime": str(item.get("mime", ""))[:60],
            "source": str(item.get("source", ""))[:20],
            "folder": str(item.get("folder", ""))[:80],
            "supported": bool(item.get("supported", True)),
        })
    return catalog


def _ai_request():
    """Parse JSON or multipart body. Returns (payload dict, [documents])."""
    documents = []

    if request.mimetype == "multipart/form-data":
        payload = request.form.to_dict()

        for upload in request.files.getlist("file")[:ai.MAX_DOCS]:
            if upload and upload.filename:
                documents.append({
                    "data": upload.read(),
                    "mime": upload.mimetype,
                    "name": upload.filename
                })

        payload["history"] = _json_field(payload.get("history"), [])
        payload["catalog"] = _json_field(payload.get("catalog"), [])
    else:
        payload = request.get_json(silent=True) or {}

    return payload, documents


def _ai_endpoint(handler):
    """Shared auth / rate limit / error handling for AI routes."""
    username, user = fetch_current_user()

    if not user:
        return jsonify({
            "success": False,
            "message": "Neautorizat."
        }), 401

    if _rate_limited(username):
        return jsonify({
            "success": False,
            "message": "Prea multe cereri. Mai așteaptă puțin."
        }), 429

    try:
        payload, document = _ai_request()
        language = payload.get("language")
        language = language if language in ("ro", "en") else "ro"
        result = handler(payload, document, language, user)
        return jsonify({"success": True, **result})
    except ai.AIError as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), error.status
    except (ValueError, TypeError):
        return jsonify({
            "success": False,
            "message": "Cerere invalidă."
        }), 400


def _text(payload, key, limit=20000):
    return str(payload.get(key, "") or "").strip()[:limit]


@app.route("/api/ai/status")
def ai_status():
    username, user = fetch_current_user()

    if not user:
        return jsonify({"success": False}), 401

    return jsonify({
        "success": True,
        "configured": ai.api_key_configured() and ai.SDK_AVAILABLE,
        "models": ai.model_candidates()
    })


@app.route("/api/ai/chat", methods=["POST"])
def ai_chat():
    def run(payload, document, language, user):
        message = _text(payload, "message", 4000)
        if not message:
            raise ValueError("empty message")

        history = payload.get("history")
        history = history if isinstance(history, list) else []

        reply = ai.chat(
            message,
            history,
            _text(payload, "notes"),
            language,
            user,
            document,
            _clean_catalog(payload.get("catalog"))
        )
        return {"reply": reply}

    return _ai_endpoint(run)


@app.route("/api/ai/route", methods=["POST"])
def ai_route():
    """AI memory: pick which of the student's files a request needs."""
    def run(payload, document, language, user):
        message = _text(payload, "message", 1500)
        history = payload.get("history")
        history = history if isinstance(history, list) else []
        catalog = _clean_catalog(payload.get("catalog"))

        if not message or not catalog:
            return {"files": []}

        keys = ai.route_files(message, history, catalog, language, user)
        return {"files": keys}

    return _ai_endpoint(run)


@app.route("/api/ai/summarize", methods=["POST"])
def ai_summarize():
    def run(payload, document, language, user):
        text = _text(payload, "text", 60000)
        if not text and not document:
            raise ai.AIError(
                "Lipește un text sau încarcă un fișier de rezumat.",
                status=400
            )

        reply = ai.summarize(
            text,
            document,
            payload.get("style", "detailed"),
            language,
            user
        )
        return {"reply": reply}

    return _ai_endpoint(run)


@app.route("/api/ai/quiz", methods=["POST"])
def ai_quiz():
    def run(payload, document, language, user):
        topic = _text(payload, "topic", 300)
        text = _text(payload, "text", 60000)

        if not (topic or text or document):
            raise ai.AIError(
                "Spune-mi o temă, lipește notițe sau încarcă un fișier.",
                status=400
            )

        data = ai.quiz(
            topic,
            text,
            document,
            payload.get("count", 5),
            payload.get("difficulty", "medium"),
            language,
            user
        )
        return {"quiz": data}

    return _ai_endpoint(run)


@app.route("/api/ai/flashcards", methods=["POST"])
def ai_flashcards():
    def run(payload, document, language, user):
        topic = _text(payload, "topic", 300)
        text = _text(payload, "text", 60000)

        if not (topic or text or document):
            raise ai.AIError(
                "Spune-mi o temă, lipește notițe sau încarcă un fișier.",
                status=400
            )

        data = ai.flashcards(
            topic,
            text,
            document,
            payload.get("count", 10),
            language,
            user
        )
        return {"flashcards": data}

    return _ai_endpoint(run)


@app.route("/api/ai/plan", methods=["POST"])
def ai_plan():
    def run(payload, document, language, user):
        goal = _text(payload, "goal", 500)

        if not goal:
            raise ai.AIError(
                "Spune-mi pentru ce examen sau obiectiv vrei planul.",
                status=400
            )

        reply = ai.study_plan(
            goal,
            payload.get("days", 7),
            payload.get("hours", 2),
            _text(payload, "text", 60000),
            document,
            language,
            user
        )
        return {"reply": reply}

    return _ai_endpoint(run)


@app.errorhandler(413)
def too_large(error):
    return jsonify({
        "success": False,
        "message": "Fișierele sunt prea mari (maxim 32 MB)."
    }), 413


if __name__ == "__main__":
    app.run(
        host=os.environ.get("FLASK_HOST", "127.0.0.1"),
        port=int(os.environ.get("FLASK_PORT", "5000")),
        debug=os.environ.get("FLASK_DEBUG", "0") == "1"
    )
