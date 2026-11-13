
import os

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

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
