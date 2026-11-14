
import os
import time

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

# Max upload for AI documents (PDF/notes): 16 MB
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

# Cheie pentru sesiuni - doar pentru dezvoltare locală
app.secret_key = os.environ.get(
    "FLASK_SECRET_KEY",
    "unibuddy_development_secret"
)

# ==========================================
# UTILIZATORI DEMO
# ==========================================

USERS = {
    "student1": {
        "password": "parola123",
        "email": "student1@student.uni.ro",
        "full_name": "Student 1",
        "faculty": "",
        "year": "",
        "bio": "",
        "private_account": False,
        "email_notifications": True
    }
}


# ==========================================
# UTILIZATOR AUTENTIFICAT
# ==========================================

def current_user():
    username = session.get("username")

    if not username or username not in USERS:
        return None, None

    return username, USERS[username]


# ==========================================
# LOGIN PAGE
# ==========================================

@app.route("/")
def index():
    username, user = current_user()

    if user:
        return redirect(url_for("home_feed"))

    return render_template("login.html")


# ==========================================
# HOME PAGE
# ==========================================

@app.route("/home")
def home_feed():
    username, user = current_user()

    if not user:
        return redirect(url_for("index"))

    return render_template(
        "home.html",
        username=username,
        user=user
    )


# ==========================================
# PROFILE PAGE
# ==========================================

@app.route("/profile")
def profile():
    username, user = current_user()

    if not user:
        return redirect(url_for("index"))

    return render_template(
        "profile.html",
        username=username,
        user=user
    )


# ==========================================
# LIBRARY PAGE - GOOGLE DRIVE
# ==========================================

@app.route("/library")
def library():
    username, user = current_user()

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


# ==========================================
# MESSAGES PAGE
# ==========================================

@app.route("/messages")
def messages():
    username, user = current_user()

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


# ==========================================
# FRIENDS PAGE
# ==========================================

@app.route("/friends")
def friends():
    username, user = current_user()

    if not user:
        return redirect(url_for("index"))

    return redirect(url_for("profile") + "#friends")


# ==========================================
# NOTIFICATIONS PAGE
# ==========================================

@app.route("/notifications")
def notifications():
    username, user = current_user()

    if not user:
        return redirect(url_for("index"))

    return redirect(url_for("profile") + "#notifications")


# ==========================================
# SEARCH PAGE
# ==========================================

@app.route("/search")
def search():
    username, user = current_user()

    if not user:
        return redirect(url_for("index"))

    return redirect(url_for("profile") + "#search")


# ==========================================
# LOGOUT
# ==========================================

@app.route("/logout")
def logout():
    session.pop("username", None)
    return redirect(url_for("index"))


# ==========================================
# LOGIN API
# ==========================================

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    username = str(
        data.get("username", "")
    ).strip()

    password = str(
        data.get("password", "")
    ).strip()

    if not username or not password:
        return jsonify({
            "success": False,
            "message": "Completează toate câmpurile."
        }), 400

    if (
        username in USERS
        and USERS[username]["password"] == password
    ):
        session["username"] = username

        return jsonify({
            "success": True,
            "message": f"Bine ai revenit, {username}!",
            "redirect": "/home"
        })

    return jsonify({
        "success": False,
        "message": "Username sau parolă incorectă."
    }), 401


# ==========================================
# SIGNUP API
# ==========================================

@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}

    username = str(
        data.get("username", "")
    ).strip()

    email = str(
        data.get("email", "")
    ).strip()

    password = str(
        data.get("password", "")
    ).strip()

    confirm_password = str(
        data.get("confirmPassword", "")
    ).strip()

    if not all([
        username,
        email,
        password,
        confirm_password
    ]):
        return jsonify({
            "success": False,
            "message": "Completează toate câmpurile."
        }), 400

    if "@" not in email or "." not in email:
        return jsonify({
            "success": False,
            "message": "Introdu o adresă de email validă."
        }), 400

    if len(password) < 4:
        return jsonify({
            "success": False,
            "message": "Parola trebuie să aibă minim 4 caractere."
        }), 400

    if password != confirm_password:
        return jsonify({
            "success": False,
            "message": "Parolele nu coincid."
        }), 400

    if username in USERS:
        return jsonify({
            "success": False,
            "message": "Acest username este deja folosit."
        }), 409

    USERS[username] = {
        "password": password,
        "email": email,
        "full_name": username,
        "faculty": "",
        "year": "",
        "bio": "",
        "private_account": False,
        "email_notifications": True
    }

    return jsonify({
        "success": True,
        "message": "Cont creat cu succes! Te poți loga acum."
    })


# ==========================================
# UPDATE PROFILE API
# ==========================================

@app.route("/api/profile/update", methods=["POST"])
def update_profile():
    username, user = current_user()

    if not user:
        return jsonify({
            "success": False,
            "message": "Neautorizat."
        }), 401

    data = request.get_json(silent=True) or {}

    for field in [
        "full_name",
        "faculty",
        "year",
        "bio"
    ]:
        if field in data and isinstance(data[field], str):
            user[field] = data[field].strip()

    return jsonify({
        "success": True,
        "user": user
    })


# ==========================================
# PROFILE SETTINGS API
# ==========================================

@app.route("/api/profile/settings", methods=["POST"])
def update_settings():
    username, user = current_user()

    if not user:
        return jsonify({
            "success": False
        }), 401

    data = request.get_json(silent=True) or {}

    if isinstance(data.get("private_account"), bool):
        user["private_account"] = data["private_account"]

    if isinstance(data.get("email_notifications"), bool):
        user["email_notifications"] = data["email_notifications"]

    return jsonify({
        "success": True
    })


# ==========================================
# START SERVER
# ==========================================



# ==========================================
# UNIBUDDY AI (Gemini API)
# ==========================================

@app.route("/ai")
def ai_page():
    username, user = current_user()

    if not user:
        return redirect(url_for("index"))

    return render_template(
        "ai.html",
        username=username,
        user=user
    )


# Simple in-memory rate limit: max 20 AI calls / minute / user
_AI_CALLS = {}


def _rate_limited(username):
    now = time.time()
    recent = [t for t in _AI_CALLS.get(username, []) if now - t < 60]
    if len(recent) >= 20:
        _AI_CALLS[username] = recent
        return True
    recent.append(now)
    _AI_CALLS[username] = recent
    return False


def _ai_request():
    """Parse JSON or multipart body. Returns (payload dict, document|None)."""
    document = None

    if request.mimetype == "multipart/form-data":
        payload = request.form.to_dict()
        upload = request.files.get("file")
        if upload and upload.filename:
            document = {
                "data": upload.read(),
                "mime": upload.mimetype,
                "name": upload.filename
            }
        if payload.get("history"):
            import json as _json
            try:
                payload["history"] = _json.loads(payload["history"])
            except ValueError:
                payload["history"] = []
    else:
        payload = request.get_json(silent=True) or {}

    return payload, document


def _ai_endpoint(handler):
    """Shared auth / rate limit / error handling for AI routes."""
    username, user = current_user()

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
    username, user = current_user()

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
            document
        )
        return {"reply": reply}

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
        "message": "Fișierul este prea mare (maxim 16 MB)."
    }), 413


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
