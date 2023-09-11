
var LEAFLET_MAP = (function() {
    "use strict"; // And enable strict mode for this library

    var public_interface = {};    // Object returned by the module

    var init_map = function() { // Map methods
        // Create Map
        var m_map = L.map('leaflet-map', {
            zoom: 3,
            center: [0, 0],
            fullscreenControl: true,
        });

        // Add Basemap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(m_map);
    };

    // Initialization: jQuery function that gets called when the DOM tree finishes loading
    $(function() {
        init_map();
    });

    return public_interface; // TODO what's this for?

}()); 