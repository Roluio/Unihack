
document.addEventListener("DOMContentLoaded", () => {

    // Find the UniBuddy AI button
    const buddyButton = document.getElementById("buddyBtn");

    if (buddyButton) {
        buddyButton.addEventListener("click", () => {
            window.location.href = "/ai";
        });
    }

});
