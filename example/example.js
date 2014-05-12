var nsg = require("../");
nsg({
    files : [
        "sass/partials/*.scss",
        "sass/style.scss"
    ],
    js : [
        "js/jquer.js"
    ],
    css : [
        "css/normalize.css"
    ],
    output : "styleguide/"
});

