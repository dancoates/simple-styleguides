var nsg = require("../");
nsg({
    files : [
        "sass/partials/*.scss",
        "sass/style.scss"
    ],
    outputDir : "styleguide/",
    webDir : "/styleguide/",
    captureCSS : true
});

