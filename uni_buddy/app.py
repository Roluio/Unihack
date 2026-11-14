import os
import time

import requests
from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    session,
    redirect,
    url_for
)

import gemini_service as ai

app = Flask(__name__)

# Max upload for AI documents (several files per request): 32 MB
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024

app.secret_key = os.environ.get("FLASK_SECRET_KEY", "unibuddy_development_secret")

BACKEND_URL = os.environ.get("STUDYHUB_BACKEND_URL", "http://localhost:8080/api")

BACKEND_DOWN = "Backend-ul Java (port 8080) nu răspunde. Pornește Spring Boot!"


def auth_headers():
    token = session.get("access_token")
    if not token:
        return {}
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def map_backend_profile(profile_data):
    first = (profile_data.get("firstName") or "").strip()
    last = (profile_data.get("lastName") or "").strip()
    full_name = f"{first} {last}".strip() or profile_data.get("username") or ""
    return {
        "id": profile_data.get("id") or "",
        "username": profile_data.get("username") or "",
        "email": profile_data.get("email") or "",
        "full_name": full_name,
        "firstName": first,
        "lastName": last,
        "university": profile_data.get("university") or "Universitatea Politehnica Timisoara",
        "faculty": profile_data.get("faculty") or "",
        "specialization": profile_data.get("specialization") or "Informatica",
        "year": str(profile_data.get("studyYear") or ""),
        "bio": profile_data.get("bio") or "",
        "preferredLanguage": profile_data.get("preferredLanguage") or "RO",
        "private_account": session.get("private_account", False),
        "email_notifications": session.get("email_notifications", True)
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


def backend_request(method, path, **kwargs):
    """Call Spring Boot with the user's JWT; refresh the token once on 401.

    Raises requests.RequestException when the backend is unreachable.
    """
    kwargs.setdefault("timeout", 5)
    resp = requests.request(method, f"{BACKEND_URL}{path}", headers=auth_headers(), **kwargs)
    if resp.status_code == 401 and refresh_access_token():
        resp = requests.request(method, f"{BACKEND_URL}{path}", headers=auth_headers(), **kwargs)
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


# ==========================================
# PAGINI HTML
# ==========================================

@app.route("/")
def index():
    username, user = fetch_current_user()
    if user:
        return redirect(url_for("home_feed"))
    return render_template("login.html")


@app.route("/home")
def home_feed():
    username, user = fetch_current_user()
    if not user:
        return redirect(url_for("index"))
    return render_template("home.html", username=username, user=user)


@app.route("/profile")
def profile():
    username, user = fetch_current_user()
    if not user:
        return redirect(url_for("index"))
    return render_template("profile.html", username=username, user=user)


@app.route("/library")
def library():
    username, user = fetch_current_user()
    if not user:
        return redirect(url_for("index"))
    return render_template(
        "module_frame.html",
        username=username,
        user=user,
        module_title="Library",
        module_name="library",
        module_file="modules/library/index.html"
    )


@app.route("/messages")
def messages():
    username, user = fetch_current_user()
    if not user:
        return redirect(url_for("index"))
    return render_template(
        "module_frame.html",
        username=username,
        user=user,
        module_title="Messages",
        module_name="messages",
        module_file="modules/messages/messages.html"
    )


@app.route("/friends")
def friends():
    username, user = fetch_current_user()
    if not user:
        return redirect(url_for("index"))
    return redirect(url_for("profile") + "#friends")


@app.route("/notifications")
def notifications():
    username, user = fetch_current_user()
    if not user:
        return redirect(url_for("index"))
    return redirect(url_for("profile") + "#notifications")


@app.route("/search")
def search():
    username, user = fetch_current_user()
    if not user:
        return redirect(url_for("index"))
    return redirect(url_for("profile") + "#search")


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

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email_or_user = str(data.get("username", "")).strip()
    password = str(data.get("password", "")).strip()

    if not email_or_user or not password:
        return jsonify({"success": False, "message": "Completează toate câmpurile."}), 400

    try:
        resp = requests.post(
            f"{BACKEND_URL}/auth/login",
            json={"email": email_or_user, "password": password},
            timeout=5
        )
        body = resp.json() if resp.content else {}

        if resp.status_code == 200 and "accessToken" in body:
            session["access_token"] = body["accessToken"]
            session["refresh_token"] = body.get("refreshToken", "")
            session["username"] = body.get("username", email_or_user)
            fetch_current_user()
            return jsonify({
                "success": True,
                "message": f"Bine ai revenit, {session['username']}!",
                "redirect": "/home"
            })

        msg = body.get("message") or "Email sau parolă incorectă."
        return jsonify({"success": False, "message": msg}), resp.status_code

    except requests.RequestException:
        return jsonify({
            "success": False,
            "message": BACKEND_DOWN
        }), 503


@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    email = str(data.get("email", "")).strip()
    password = str(data.get("password", "")).strip()
    confirm_password = str(data.get("confirmPassword", "")).strip()

    if not all([username, email, password, confirm_password]):
        return jsonify({"success": False, "message": "Completează toate câmpurile."}), 400

    if password != confirm_password:
        return jsonify({"success": False, "message": "Parolele nu coincid."}), 400

    if len(password) < 8:
        return jsonify({"success": False, "message": "Parola trebuie să aibă minim 8 caractere."}), 400

    parts = [p for p in username.replace(".", " ").replace("_", " ").split() if p]
    first_name = parts[0].capitalize() if len(parts) >= 1 else "Student"
    last_name = parts[1].capitalize() if len(parts) >= 2 else "StudyHub"

    payload = {
        "firstName": first_name if len(first_name) >= 2 else "Student",
        "lastName": last_name if len(last_name) >= 2 else "StudyHub",
        "username": username,
        "email": email,
        "password": password,
        "university": "Universitatea Politehnica Timisoara",
        "faculty": "Automatica si Calculatoare",
        "specialization": "Informatica",
        "studyYear": 1
    }

    try:
        resp = requests.post(f"{BACKEND_URL}/auth/register", json=payload, timeout=5)
        body = resp.json() if resp.content else {}

        if resp.status_code in (200, 201):
            return jsonify({
                "success": True,
                "message": "Cont creat cu succes! Te poți autentifica acum cu email-ul."
            })

        msg = body.get("message")
        if not msg and isinstance(body.get("validationErrors"), dict):
            msg = next(iter(body["validationErrors"].values()))
        return jsonify({"success": False, "message": msg or "Eroare la înregistrare."}), resp.status_code

    except requests.RequestException:
        return jsonify({
            "success": False,
            "message": BACKEND_DOWN
        }), 503


# ==========================================
# PROFILE API -> SPRING BOOT
# ==========================================

@app.route("/api/profile/update", methods=["POST"])
def update_profile():
    username, current = fetch_current_user()
    if not current:
        return jsonify({"success": False, "message": "Neautorizat."}), 401

    data = request.get_json(silent=True) or {}

    # Limits (Spring Boot enforces its own as well)
    full_name = str(data.get("full_name", current["full_name"])).strip()[:80]
    faculty = str(data.get("faculty", current["faculty"])).strip()[:120] or "Automatica si Calculatoare"
    raw_year = str(data.get("year", current["year"])).strip()[:30]
    bio = str(data.get("bio", current["bio"])).strip()[:500]
    lang = str(data.get("preferredLanguage", current.get("preferredLanguage", "RO"))).upper()
    if lang not in ("RO", "EN"):
        lang = "RO"

    # The email belongs to the account in Spring Boot and cannot be edited here:
    # any "email" sent by the form is ignored and the real one is returned.

    if "full_name" in data and not full_name:
        return jsonify({"success": False, "message": "Numele nu poate fi gol."}), 400

    name_parts = full_name.split(" ", 1)
    first_name = name_parts[0] if len(name_parts[0]) >= 2 else current["firstName"]
    last_name = (
        name_parts[1].strip()
        if len(name_parts) > 1 and len(name_parts[1].strip()) >= 2
        else (current["lastName"] or "Student")
    )

    study_year = int("".join(ch for ch in raw_year if ch.isdigit())[:1] or "1")
    study_year = max(1, min(6, study_year))

    payload = {
        "firstName": first_name,
        "lastName": last_name,
        "username": current["username"],
        "profilePictureUrl": None,
        "bio": bio,
        "university": current.get("university") or "Universitatea Politehnica Timisoara",
        "faculty": faculty,
        "specialization": current.get("specialization") or "Informatica",
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

        msg = body.get("message")
        if not msg and isinstance(body.get("validationErrors"), dict):
            msg = next(iter(body["validationErrors"].values()), None)
        return jsonify({"success": False, "message": msg or "Eroare la salvare."}), resp.status_code
    except (requests.RequestException, ValueError):
        return jsonify({"success": False, "message": BACKEND_DOWN}), 503


@app.route("/api/profile/password", methods=["POST"])
def change_password():
    username, user = fetch_current_user()
    if not user:
        return jsonify({"success": False, "message": "Neautorizat."}), 401

    # Spring Boot has no change-password endpoint yet (accounts live only there).
    return jsonify({
        "success": False,
        "message": "Schimbarea parolei nu este disponibilă încă în backend."
    }), 501


@app.route("/api/profile/settings", methods=["POST"])
def update_settings():
    username, user = fetch_current_user()
    if not user:
        return jsonify({"success": False}), 401

    data = request.get_json(silent=True) or {}
    if isinstance(data.get("private_account"), bool):
        session["private_account"] = data["private_account"]
    if isinstance(data.get("email_notifications"), bool):
        session["email_notifications"] = data["email_notifications"]
    return jsonify({"success": True})


# ==========================================
# SEARCH & FRIENDS API -> SPRING BOOT
# ==========================================

def proxy(method, path, empty, **kwargs):
    """Forward a call to Spring Boot. `empty` ([] or {}) is the fallback body on errors."""
    is_list = isinstance(empty, list)

    if not session.get("access_token"):
        return jsonify(empty if is_list else {"message": "Neautorizat"}), 401
    try:
        resp = backend_request(method, path, **kwargs)
        try:
            body = resp.json() if resp.content else {}
        except ValueError:
            body = {}
        if is_list and resp.status_code != 200:
            body = empty
        return jsonify(body), resp.status_code
    except requests.RequestException:
        return jsonify(empty if is_list else {"message": BACKEND_DOWN}), 503


@app.route("/api/users/search")
def proxy_search_users():
    q = request.args.get("query", "").strip()
    return proxy("GET", "/users/search", [], params={"query": q} if q else {})


@app.route("/api/friends")
def proxy_friends():
    return proxy("GET", "/friends", [])


@app.route("/api/friends/requests/received")
def proxy_received_requests():
    return proxy("GET", "/friends/requests/received", [])


@app.route("/api/friends/request/<receiver_id>", methods=["POST"])
def proxy_send_request(receiver_id):
    return proxy("POST", f"/friends/request/{receiver_id}", {})


@app.route("/api/friends/accept/<request_id>", methods=["POST"])
def proxy_accept_request(request_id):
    return proxy("POST", f"/friends/accept/{request_id}", {})


@app.route("/api/friends/reject/<request_id>", methods=["POST"])
def proxy_reject_request(request_id):
    return proxy("POST", f"/friends/reject/{request_id}", {})


@app.route("/api/friends/<friend_id>", methods=["DELETE"])
def proxy_remove_friend(friend_id):
    return proxy("DELETE", f"/friends/{friend_id}", {})


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
    app.run(host="127.0.0.1", port=5000, debug=True)
