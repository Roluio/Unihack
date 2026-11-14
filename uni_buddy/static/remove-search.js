
/*
 * StudyGram - Remove Search from sidebar
 * Works with Romanian and English menus
 */

(function () {
    function removeSearch() {
        document.querySelectorAll(
            ".navigation .nav-item, .global-nav a"
        ).forEach(item => {

            const href = item.getAttribute("href") || "";
            const tab = item.getAttribute("data-tab") || "";
            const i18n = item.querySelector("[data-i18n]")
                ?.getAttribute("data-i18n") || "";

            const isSearch =
                href === "/search" ||
                href === "/profile#search" ||
                tab === "search" ||
                i18n === "navSearch";

            if (isSearch) {
                item.remove();
            }
        });
    }

    // Run immediately and after the DOM loads.
    removeSearch();

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            removeSearch
        );
    }
})();
