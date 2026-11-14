"""
UniBuddy AI - Gemini API integration layer.

All calls to the Gemini API go through this module so that:
  * the API key stays on the server (never sent to the browser),
  * model selection / fallback lives in one place,
  * the Flask routes in app.py stay small.

Configuration (environment variables or a .env file next to app.py):
    GEMINI_API_KEY   required - get one free at https://aistudio.google.com/apikey
    GEMINI_MODEL     optional - preferred model id (default: gemini-3.8-flash)
"""

import json
import os
import re
from pathlib import Path

# ------------------------------------------------------------------
# Tiny .env loader (avoids an extra dependency)
# ------------------------------------------------------------------

def _load_dotenv():
    env_file = Path(__file__).with_name(".env")
    if not env_file.exists():
        return
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


_load_dotenv()

try:
    from google import genai
    from google.genai import types
    from google.genai import errors as genai_errors
    SDK_AVAILABLE = True
except ImportError:  # pragma: no cover - handled at runtime with a clear message
    genai = types = genai_errors = None
    SDK_AVAILABLE = False


# ------------------------------------------------------------------
# Models: try the preferred one first, then fall back if a model id is
# unknown (404), overloaded (503) or out of quota (429).
# ------------------------------------------------------------------

DEFAULT_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
]


def model_candidates():
    preferred = os.environ.get("GEMINI_MODEL", "").strip()
    models = [preferred] if preferred else []
    models += [m for m in DEFAULT_MODELS if m not in models]
    return models


class AIError(Exception):
    """Error with a message that is safe to show to the user."""

    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


_client = None


def api_key_configured():
    return bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))


def get_client():
    global _client

    if not SDK_AVAILABLE:
        raise AIError(
            "Pachetul google-genai nu este instalat. "
            "Rulează: pip install -r requirements.txt",
            status=503,
        )

    if not api_key_configured():
        raise AIError(
            "Cheia GEMINI_API_KEY nu este configurată pe server. "
            "Vezi README.md (pasul 'Cheia Gemini').",
            status=503,
        )

    if _client is None:
        key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        _client = genai.Client(api_key=key)

    return _client


# ------------------------------------------------------------------
# Low level generation helper
# ------------------------------------------------------------------

MAX_DOC_BYTES = 15 * 1024 * 1024  # inline upload limit we allow

SUPPORTED_DOC_MIMES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "text/html",
    "image/png",
    "image/jpeg",
    "image/webp",
}


def guess_mime(filename, declared):
    declared = (declared or "").split(";")[0].strip().lower()
    if declared in SUPPORTED_DOC_MIMES:
        return declared

    ext = Path(filename or "").suffix.lower()
    return {
        ".pdf": "application/pdf",
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".csv": "text/csv",
        ".html": "text/html",
        ".htm": "text/html",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    }.get(ext)


def _document_part(document):
    """document = {"data": bytes, "mime": str, "name": str}"""
    if not document:
        return None

    if len(document["data"]) > MAX_DOC_BYTES:
        raise AIError("Fișierul este prea mare (maxim 15 MB).", status=413)

    mime = guess_mime(document.get("name"), document.get("mime"))
    if not mime:
        raise AIError(
            "Tip de fișier nesuportat. Folosește PDF, TXT, MD, CSV, PNG sau JPG.",
            status=415,
        )

    return types.Part.from_bytes(data=document["data"], mime_type=mime)


def _friendly_api_error(exc):
    code = getattr(exc, "code", None)

    if code in (400,) and "API key" in str(exc):
        return AIError("Cheia GEMINI_API_KEY este invalidă.", status=503)
    if code in (401, 403):
        return AIError(
            "Gemini a refuzat cererea (cheie invalidă sau fără permisiuni).",
            status=503,
        )
    if code == 429:
        return AIError(
            "Limita de cereri Gemini a fost atinsă. Încearcă din nou peste un minut.",
            status=429,
        )
    return AIError("Serviciul Gemini nu a putut răspunde. Încearcă din nou.", status=502)


def generate(contents, system, temperature=0.7, json_output=False):
    """Run a generation, falling back across models. Returns response text."""
    client = get_client()

    config_kwargs = {
        "system_instruction": system,
        "temperature": temperature,
    }
    if json_output:
        config_kwargs["response_mime_type"] = "application/json"

    config = types.GenerateContentConfig(**config_kwargs)

    last_error = None

    for model in model_candidates():
        try:
            response = client.models.generate_content(
                model=model, contents=contents, config=config
            )
        except genai_errors.APIError as exc:
            last_error = exc
            # unknown model / overloaded / quota -> try the next model
            if getattr(exc, "code", None) in (404, 429, 500, 503):
                continue
            raise _friendly_api_error(exc) from exc
        except Exception as exc:  # network etc.
            raise AIError(
                "Nu m-am putut conecta la Gemini. Verifică conexiunea la internet."
            ) from exc

        text = (getattr(response, "text", None) or "").strip()
        if text:
            return text

        # empty text usually means the answer was blocked by safety filters
        raise AIError(
            "Gemini nu a returnat un răspuns (posibil blocat de filtrele de siguranță). "
            "Reformulează întrebarea.",
            status=422,
        )

    raise _friendly_api_error(last_error) if last_error else AIError(
        "Niciun model Gemini nu este disponibil."
    )


# ------------------------------------------------------------------
# Prompt building
# ------------------------------------------------------------------

LANG_NAMES = {"ro": "Romanian", "en": "English"}


def _lang(language):
    return LANG_NAMES.get(language, "Romanian")


def persona(profile, language):
    """System prompt personalised with what we know about the student."""
    bits = []
    if profile.get("full_name"):
        bits.append(f"name: {profile['full_name']}")
    if profile.get("faculty"):
        bits.append(f"faculty: {profile['faculty']}")
    if profile.get("year"):
        bits.append(f"year of study: {profile['year']}")
    if profile.get("bio"):
        bits.append(f"about them: {profile['bio']}")

    student = "; ".join(bits) if bits else "no profile details provided"

    return (
        "You are UniBuddy AI, a friendly, encouraging and highly capable study "
        "companion inside a university student platform. You can explain concepts, "
        "answer questions, summarize papers, create quizzes and flashcards, build "
        "study plans, give study/career/wellbeing advice, and write or debug code "
        "and scripts.\n"
        f"Student profile ({student}).\n"
        "Adapt depth, examples and vocabulary to this student's field and level. "
        "When it helps, connect answers to their faculty.\n"
        f"Always answer in {_lang(language)} unless the student clearly writes in "
        "another language or asks for one. Use clear Markdown (short paragraphs, "
        "bullets, **bold** for key terms, fenced code blocks for code). Be accurate: "
        "if you are unsure, say so instead of inventing facts. When the student "
        "supplies a document or notes, ground your answer in them and say when the "
        "document does not contain the answer."
    )


def _history_contents(history):
    contents = []
    for item in history[-12:]:
        role = "user" if item.get("role") == "user" else "model"
        text = str(item.get("content", "")).strip()
        if text:
            contents.append(
                types.Content(role=role, parts=[types.Part.from_text(text=text)])
            )
    return contents


def _user_parts(text, notes=None, document=None):
    parts = []

    doc_part = _document_part(document)
    if doc_part is not None:
        parts.append(doc_part)

    if notes:
        parts.append(
            types.Part.from_text(
                text="<course_notes>\n" + notes[:20000] + "\n</course_notes>"
            )
        )

    parts.append(types.Part.from_text(text=text))
    return parts


# ------------------------------------------------------------------
# Public features
# ------------------------------------------------------------------

def chat(message, history, notes, language, profile, document=None):
    contents = _history_contents(history)
    contents.append(
        types.Content(role="user", parts=_user_parts(message, notes, document))
    )
    return generate(contents, persona(profile, language), temperature=0.7)


SUMMARY_STYLES = {
    "short": "a concise summary of at most 150 words",
    "detailed": (
        "a structured summary with: a one-sentence TL;DR, key ideas as bullets, "
        "important definitions/formulas, and 'what to remember for the exam'"
    ),
    "paper": (
        "a research-paper style summary with the sections: Problem, Method, "
        "Key results, Limitations, Why it matters"
    ),
    "eli5": "an extremely simple explanation, as if for a curious 12-year-old",
}


def summarize(text, document, style, language, profile):
    style_text = SUMMARY_STYLES.get(style, SUMMARY_STYLES["detailed"])
    prompt = (
        f"Summarize the provided material. Produce {style_text}. "
        "Only use information from the material."
    )
    contents = [
        types.Content(
            role="user",
            parts=_user_parts(prompt, notes=text, document=document),
        )
    ]
    return generate(contents, persona(profile, language), temperature=0.3)


def _parse_json(text):
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"[\[{].*[\]}]", cleaned, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


def quiz(topic, text, document, count, difficulty, language, profile):
    count = max(3, min(int(count or 5), 15))
    difficulty = difficulty if difficulty in ("easy", "medium", "hard") else "medium"

    source = (
        "the provided material" if (text or document) else f"the topic: {topic}"
    )
    prompt = (
        f"Create a {difficulty} multiple-choice quiz with exactly {count} questions "
        f"based on {source}. Return ONLY valid JSON with this shape:\n"
        '{"title": str, "questions": [{"question": str, "options": [str, str, str, str], '
        '"answer_index": int (0-3), "explanation": str}]}\n'
        "Each question has exactly 4 plausible options and exactly one correct one; "
        "vary the position of the correct option. Explanations are 1-2 sentences."
    )
    contents = [
        types.Content(
            role="user", parts=_user_parts(prompt, notes=text, document=document)
        )
    ]
    raw = generate(contents, persona(profile, language), temperature=0.5, json_output=True)

    try:
        data = _parse_json(raw)
    except json.JSONDecodeError as exc:
        raise AIError("Testul generat nu a putut fi citit. Încearcă din nou.") from exc

    questions = []
    for q in data.get("questions", []):
        options = [str(o) for o in q.get("options", [])][:4]
        idx = q.get("answer_index")
        if len(options) == 4 and isinstance(idx, int) and 0 <= idx < 4 and q.get("question"):
            questions.append(
                {
                    "question": str(q["question"]),
                    "options": options,
                    "answer_index": idx,
                    "explanation": str(q.get("explanation", "")),
                }
            )

    if not questions:
        raise AIError("Nu am putut genera întrebări valide. Încearcă din nou.")

    return {"title": str(data.get("title") or topic or "Quiz"), "questions": questions}


def flashcards(topic, text, document, count, language, profile):
    count = max(4, min(int(count or 10), 25))
    source = "the provided material" if (text or document) else f"the topic: {topic}"
    prompt = (
        f"Create exactly {count} study flashcards from {source}. Return ONLY valid "
        'JSON: {"title": str, "cards": [{"front": str, "back": str}]}. '
        "Fronts are short questions or terms; backs are concise, accurate answers."
    )
    contents = [
        types.Content(
            role="user", parts=_user_parts(prompt, notes=text, document=document)
        )
    ]
    raw = generate(contents, persona(profile, language), temperature=0.4, json_output=True)

    try:
        data = _parse_json(raw)
    except json.JSONDecodeError as exc:
        raise AIError("Cardurile generate nu au putut fi citite. Încearcă din nou.") from exc

    cards = [
        {"front": str(c["front"]), "back": str(c["back"])}
        for c in data.get("cards", [])
        if c.get("front") and c.get("back")
    ]
    if not cards:
        raise AIError("Nu am putut genera carduri valide. Încearcă din nou.")

    return {"title": str(data.get("title") or topic or "Flashcards"), "cards": cards}


def study_plan(goal, days, hours_per_day, text, document, language, profile):
    days = max(1, min(int(days or 7), 60))
    hours = max(0.5, min(float(hours_per_day or 2), 12))
    prompt = (
        f"Build a realistic day-by-day study plan.\nGoal / exam: {goal}\n"
        f"Days available: {days}. Study time per day: {hours} hours.\n"
        "Format: a Markdown table or per-day headings with topics, concrete tasks, "
        "time blocks, short breaks, spaced-repetition reviews and a final-day "
        "checklist. If course notes/material are provided, base the topics on them."
    )
    contents = [
        types.Content(
            role="user", parts=_user_parts(prompt, notes=text, document=document)
        )
    ]
    return generate(contents, persona(profile, language), temperature=0.5)
