import os
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

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "unibuddy_development_secret")

BACKEND_URL = os.environ.get("STUDYHUB_BACKEND_URL", "http://localhost:8080/api")


def auth_headers():
    token = session.get("access_token")
    if not token:
        return {}
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def map_backend_profile(profile_data):
    first = profile_data.get("firstName", "").strip()
    last = profile_data.get("lastName", "").strip()
    full_name = f"{first} {last}".strip() or profile_data.get("username", "")
    return {
        "id": profile_data.get("id", ""),
        "username": profile_data.get("username", ""),
        "email": profile_data.get("email", ""),
        "full_name": full_name,
        "firstName": first,
        "lastName": last,
        "university": profile_data.get("university", "Universitatea Politehnica Timisoara"),
        "faculty": profile_data.get("faculty", ""),
        "specialization": profile_data.get("specialization", "Informatica"),
        "year": str(profile_data.get("studyYear") or ""),
        "bio": profile_data.get("bio") or "",
        "preferredLanguage": profile_data.get("preferredLanguage", "RO"),
        "private_account": session.get("private_account", False),
        "email_notifications": session.get("email_notifications", True)
    }


def fetch_current_user():
    if not session.get("access_token"):
        return None, None

    try:
        resp = requests.get(f"{BACKEND_URL}/users/me", headers=auth_headers(), timeout=5)
        if resp.status_code == 200:
            user = map_backend_profile(resp.json())
            session["user_cache"] = user
            session["username"] = user["username"]
            return user["username"], user
        if resp.status_code in (401, 403):
            session.clear()
            return None, None
    except requests.RequestException:
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


@app.route("/ai")
def ai_page():
    username, user = fetch_current_user()
    if not user:
        return redirect(url_for("index"))
    return render_template("ai.html", username=username, user=user)


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
            "message": "Backend-ul Java (port 8080) nu răspunde. Pornește Spring Boot!"
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
            "message": "Backend-ul Java (port 8080) nu răspunde. Pornește Spring Boot!"
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
    full_name = str(data.get("full_name", current["full_name"])).strip()
    faculty = str(data.get("faculty", current["faculty"])).strip() or "Automatica si Calculatoare"
    raw_year = str(data.get("year", current["year"])).strip()
    bio = str(data.get("bio", current["bio"])).strip()
    lang = str(data.get("preferredLanguage", current.get("preferredLanguage", "RO"))).upper()
    if lang not in ("RO", "EN"):
        lang = "RO"

    name_parts = full_name.split(" ", 1)
    first_name = name_parts[0] if len(name_parts[0]) >= 2 else current["firstName"]
    last_name = name_parts[1].strip() if len(name_parts) > 1 and len(name_parts[1].strip()) >= 2 else (current["lastName"] or "Student")

    try:
        study_year = int("".join(ch for ch in raw_year if ch.isdigit()) or "1")
        study_year = max(1, min(6, study_year))
    except ValueError:
        study_year = 1

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
        resp = requests.put(f"{BACKEND_URL}/users/me", json=payload, headers=auth_headers(), timeout=5)
        body = resp.json() if resp.content else {}

        if resp.status_code == 200:
            updated_user = map_backend_profile(body)
            session["user_cache"] = updated_user
            return jsonify({"success": True, "user": updated_user})

        return jsonify({"success": False, "message": body.get("message", "Eroare la salvare.")}), resp.status_code
    except requests.RequestException:
        return jsonify({"success": False, "message": "Eroare de conexiune cu backend-ul."}), 503


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

@app.route("/api/users/search")
def proxy_search_users():
    if not session.get("access_token"):
        return jsonify([]), 401
    q = request.args.get("query", "").strip()
    try:
        resp = requests.get(
            f"{BACKEND_URL}/users/search",
            params={"query": q} if q else {},
            headers=auth_headers(),
            timeout=5
        )
        return jsonify(resp.json() if resp.status_code == 200 else []), resp.status_code
    except requests.RequestException:
        return jsonify([]), 503


@app.route("/api/friends")
def proxy_friends():
    if not session.get("access_token"):
        return jsonify([]), 401
    try:
        resp = requests.get(f"{BACKEND_URL}/friends", headers=auth_headers(), timeout=5)
        return jsonify(resp.json() if resp.status_code == 200 else []), resp.status_code
    except requests.RequestException:
        return jsonify([]), 503


@app.route("/api/friends/requests/received")
def proxy_received_requests():
    if not session.get("access_token"):
        return jsonify([]), 401
    try:
        resp = requests.get(f"{BACKEND_URL}/friends/requests/received", headers=auth_headers(), timeout=5)
        return jsonify(resp.json() if resp.status_code == 200 else []), resp.status_code
    except requests.RequestException:
        return jsonify([]), 503


@app.route("/api/friends/request/<receiver_id>", methods=["POST"])
def proxy_send_request(receiver_id):
    if not session.get("access_token"):
        return jsonify({"message": "Neautorizat"}), 401
    resp = requests.post(f"{BACKEND_URL}/friends/request/{receiver_id}", headers=auth_headers(), timeout=5)
    return jsonify(resp.json() if resp.content else {}), resp.status_code


@app.route("/api/friends/accept/<request_id>", methods=["POST"])
def proxy_accept_request(request_id):
    if not session.get("access_token"):
        return jsonify({"message": "Neautorizat"}), 401
    resp = requests.post(f"{BACKEND_URL}/friends/accept/{request_id}", headers=auth_headers(), timeout=5)
    return jsonify(resp.json() if resp.content else {}), resp.status_code


@app.route("/api/friends/reject/<request_id>", methods=["POST"])
def proxy_reject_request(request_id):
    if not session.get("access_token"):
        return jsonify({"message": "Neautorizat"}), 401
    resp = requests.post(f"{BACKEND_URL}/friends/reject/{request_id}", headers=auth_headers(), timeout=5)
    return jsonify(resp.json() if resp.content else {}), resp.status_code


@app.route("/api/friends/<friend_id>", methods=["DELETE"])
def proxy_remove_friend(friend_id):
    if not session.get("access_token"):
        return jsonify({"message": "Neautorizat"}), 401
    resp = requests.delete(f"{BACKEND_URL}/friends/{friend_id}", headers=auth_headers(), timeout=5)
    return jsonify(resp.json() if resp.content else {}), resp.status_code


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)