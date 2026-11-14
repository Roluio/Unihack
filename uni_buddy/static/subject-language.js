
// ==========================================
// UNIBUDDY - SUBJECT LANGUAGE SUGGESTIONS
// RO / EN - DYNAMIC SUBJECT LIST
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    const subjectInput = document.getElementById("postCategory");

    if (!subjectInput) return;

    const subjects = {
        ro: [
            "Fizică",
            "Matematică",
            "Programare",
            "Electronică",
            "Automatică",
            "Baze De Date",
            "Rețele De Calculatoare",
            "Inteligență Artificială"
        ],

        en: [
            "Physics",
            "Mathematics",
            "Programming",
            "Electronics",
            "Automation",
            "Databases",
            "Computer Networks",
            "Artificial Intelligence"
        ]
    };

    // ======================================
    // CREATE A NEW SUGGESTION LIST
    // ======================================

    const oldList = document.getElementById(
        "subjectSuggestions"
    );

    if (oldList) {
        oldList.remove();
    }

    const suggestionList = document.createElement("datalist");

    suggestionList.id = "subjectSuggestions";

    document.body.appendChild(suggestionList);

    subjectInput.setAttribute(
        "list",
        "subjectSuggestions"
    );

    // ======================================
    // GET CURRENT LANGUAGE
    // ======================================

    function getLanguage() {
        const saved = localStorage.getItem(
            "UniBuddyForumLanguage"
        );

        return saved === "en" ? "en" : "ro";
    }

    // ======================================
    // UPDATE SUBJECT SUGGESTIONS
    // ======================================

    function updateSuggestions() {
        const language = getLanguage();

        suggestionList.replaceChildren();

        subjects[language].forEach(subject => {

            const option = document.createElement("option");

            option.value = subject;

            suggestionList.appendChild(option);

        });

        subjectInput.placeholder =
            language === "ro"
                ? "Scrie materia (ex: Fizică)"
                : "Enter subject (e.g. Physics)";
    }

    // ======================================
    // LANGUAGE CHANGE
    // ======================================

    document.querySelectorAll(
        ".lang-option[data-lang]"
    ).forEach(button => {

        button.addEventListener("click", () => {

            // forum.js saves the selected language.
            // Update after its event handler finishes.
            queueMicrotask(() => {
                updateSuggestions();
            });

        });

    });

    // ======================================
    // INITIALIZE
    // ======================================

    updateSuggestions();

});
