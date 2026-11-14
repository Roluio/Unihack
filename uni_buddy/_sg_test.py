import json
import traceback

out = {}

try:
    from app import app

    c = app.test_client()
    c.post("/api/login", json={"username": "student1", "password": "parola123"})

    r = c.post("/api/ai/chat", json={
        "message": "Ce formula e in notes.txt? Raspunde scurt.",
        "language": "ro",
        "index": [{"name": "notes.txt", "folder": "Physics", "source": "library", "size": 120}],
        "files": [{"name": "notes.txt", "source": "library", "text": "Legea lui Ohm: U = R * I."}],
    })
    out["chat"] = [r.status_code, r.get_json()]

    out["bad_base64"] = c.post("/api/ai/chat", json={
        "message": "x",
        "files": [{"name": "a.pdf", "mime": "application/pdf", "data": "!!!"}],
    }).status_code
except Exception:
    out["error"] = traceback.format_exc()

with open("_sg_result.json", "w", encoding="utf-8") as handle:
    handle.write(json.dumps(out, ensure_ascii=False, indent=1))
