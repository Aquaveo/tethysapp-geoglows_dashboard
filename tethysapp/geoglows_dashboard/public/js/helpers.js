let getCSRFToken = function() {
    const cookies = document.cookie.split("; ");
    for (const cookie of cookies) {
        if (cookie.startsWith("csrftoken=")) {
            return cookie.split("=")[1];
        }
    }
    return null;
}
