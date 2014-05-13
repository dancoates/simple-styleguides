var nsg = require("../");
nsg({
    files : [
        "sass/partials/*.scss",
        "sass/style.scss"
    ],
    output : "styleguide/",
    webDir : "styleguide/"
});

