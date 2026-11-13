from flask import Flask, render_template, request, jsonify, session, redirect, url_for

app = Flask(__name__)
app.secret_key = "uni_buddy_secret_key_change_in_prod"

# Bază de date în memorie (fără date fictive pentru postări, prieteni, mesaje)
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

@app.route('/')
def home():
    if 'username' in session and session['username'] in USERS:
        return redirect(url_for('profile'))
    return render_template('login.html')

@app.route('/profile')
def profile():
    username = session.get('username')
    if not username or username not in USERS:
        return redirect(url_for('home'))
    return render_template('profile.html', username=username, user=USERS[username])

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('home'))

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify({"success": False, "message": "Completează toate câmpurile."}), 400

    if username in USERS and USERS[username]["password"] == password:
        session['username'] = username
        return jsonify({"success": True, "message": f"Bine ai revenit, {username}!", "redirect": "/profile"})
    else:
        return jsonify({"success": False, "message": "Username sau parolă incorectă."}), 401

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()
    confirm_password = data.get('confirmPassword', '').strip()

    if not username or not email or not password or not confirm_password:
        return jsonify({"success": False, "message": "Completează toate câmpurile."}), 400
    if '@' not in email or '.' not in email:
        return jsonify({"success": False, "message": "Introdu o adresă de email validă."}), 400
    if len(password) < 4:
        return jsonify({"success": False, "message": "Parola trebuie să aibă minim 4 caractere."}), 400
    if password != confirm_password:
        return jsonify({"success": False, "message": "Parolele nu coincid."}), 400
    if username in USERS:
        return jsonify({"success": False, "message": "Acest username este deja folosit."}), 409

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
    return jsonify({"success": True, "message": "Cont creat cu succes! Te poți loga acum."})

@app.route('/api/profile/update', methods=['POST'])
def update_profile():
    username = session.get('username')
    if not username or username not in USERS:
        return jsonify({"success": False, "message": "Neautorizat."}), 401

    data = request.get_json()
    USERS[username]["full_name"] = data.get("full_name", USERS[username]["full_name"]).strip()
    USERS[username]["faculty"] = data.get("faculty", USERS[username]["faculty"]).strip()
    USERS[username]["year"] = data.get("year", USERS[username]["year"]).strip()
    USERS[username]["bio"] = data.get("bio", USERS[username]["bio"]).strip()

    return jsonify({"success": True, "user": USERS[username]})

@app.route('/api/profile/settings', methods=['POST'])
def update_settings():
    username = session.get('username')
    if not username or username not in USERS:
        return jsonify({"success": False}), 401

    data = request.get_json()
    if "private_account" in data:
        USERS[username]["private_account"] = bool(data["private_account"])
    if "email_notifications" in data:
        USERS[username]["email_notifications"] = bool(data["email_notifications"])

    return jsonify({"success": True})

if __name__ == '__main__':
    app.run(debug=True)