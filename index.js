var nsg = function(options) {
    var util = {
        _       : require("underscore"),
        fs      : require('fs'),
        glob    : require('glob'),
        yaml    : require('yamljs'),
        md      : require('markdown').markdown
    };
    

    var defaults = {};
    var settings = util._.extend(defaults, options);

    return new Nsg(util, settings);
};


var Nsg = function(util, settings) {
    this.util = util;
    this.settings = settings;
    this.getFileData();
};


Nsg.prototype.getFileData = function() {
    var _this = this;

    var readFiles = function(err, files){
        files.forEach(readFile);
    };

    var readFile = function(file, index, arr) {
        _this.util.fs.readFile(file, {encoding: "UTF8"}, _this.parseFileData.bind(_this));
    }

    _this.util.glob(_this.settings.files, readFiles);
};


Nsg.prototype.parseFileData = function(err, data) {
    var _this = this;

    var blocks = data.match(/\/\*.*styleguide[\s\S]*?\*\//g);
    
    if(!blocks || blocks.length === 0) return;

    blocks = blocks.map(function(str){
        var block = str.replace("/*styleguide", "").replace("*/", "");
        var subBlocks = block.split(/\-{3,}/);

        return {
            conf : _this.util.yaml.parse(subBlocks[0]),
            body : _this.util.md.toHTML(subBlocks.slice(1).join('---'))
        };

    });


};


//Nsg.prototype.wait = function()


module.exports = nsg;