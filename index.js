var nsg = function(options) {
    var util = {
        _       : require("underscore"),
        fs      : require('fs'),
        glob    : require('glob'),
        yaml    : require('yamljs'),
        md      : require('markdown').markdown,
        hb      : require('handlebars')
    };
    
    var defaults = {
        template : __dirname + "/template/default/",
        encoding : "UTF8"
    };

    var settings = util._.extend(defaults, options);

    return new Nsg(util, settings);
};


var Nsg = function(util, settings) {
    this.util = util;
    this.settings = settings;
    this.helpers = this.getHelpers();
    this.readFileData();
};


Nsg.prototype.readFileData = function() {
    var _this = this;
    
    var readFiles = function(files){
        var cb = _this.helpers.ccc(files.length, _this.generateFiles, _this);
        files.forEach(function(file){
            readFile(file, cb);
        });
    };

    var readFile = function(file, callback) {
        var opts = {
            encoding: _this.settings.encoding
        };
        
        _this.util.fs.readFile(file, opts, function(err, data){
            _this.parseFileData(data, callback);
        });
    }

    _this.helpers.globFiles(_this.settings.files, readFiles);
};


Nsg.prototype.parseFileData = function(data, callback) {
    var _this = this;

    var blocks = data.match(/\/\*.*styleguide[\s\S]*?\*\//g);
    
    if(!blocks || blocks.length === 0) {
        callback.call(this, []);
        return;
    }

    blocks = blocks.map(function(str){
        var block = str.replace("/*styleguide", "").replace("*/", "");
        var subBlocks = block.split(/\-{3,}/);

        return {
            conf : _this.util.yaml.parse(subBlocks[0]),
            body : _this.util.md.toHTML(subBlocks.slice(1).join('---'))
        };

    });

    callback.call(this, blocks);
};


Nsg.prototype.generateFiles = function(blocks) {
    var _this = this;
    var organizedBlocks = blocks.reduce(function(obj, block) {
        var cat = block.conf.category;
        var parent = _this.helpers.traverseObj(obj, cat);
        parent.items.push(block);
        return obj;
    }, {});

    // Find assets
    this.findAssets(this.settings, function(){
        console.log(_this.settings);
    });


    var singleTemplatePath = _this.settings.template + "single";
    var fullTemplatePath = _this.settings.template + "compiled";
    //_this.util.fs.readFile();



};

Nsg.prototype.findAssets = function() {
    var _this = this;
    var numargs = arguments.length -1;
    var cb = _this.util._.after(numargs, arguments[numargs]);
    arguments[0] = [];
    _this.util._.each(arguments, function(item, index){
        // if(index === numargs) return;
        // _this.helpers.globFiles(item, function(files){
        //     item = files;
        //     cb();
        // });
        cb();
    });
};


Nsg.prototype.getHelpers = function() {
    // Return fun to allow for passing _this to closures
    var _this = this;
    var fns = {
        globFiles : function(filePaths, callback) {
            if(_this.util._.isString(filePaths)) {
                _this.util.glob(filePaths, function(err, files){
                    callback(files);
                });
            }
            if(_this.util._.isArray(filePaths)) {
                var cb = _this.util._.after(filePaths.length, callback);
                var arr = [];
                filePaths.forEach(function(filePath, index){
                    _this.util.glob(filePath, function(err, files){
                        arr = arr.concat(files);
                        cb(arr);
                    });
                });
            }
        },
        // Count, Concat, Callback
        ccc : function(amount, fn, context) {
            var aggregatedData = [];
            var hits = 0;
            return function(data) {
                hits ++;
                aggregatedData = aggregatedData.concat(data);
                if(hits === amount) {
                    fn.call(context, aggregatedData);
                }
            };
        },
        getSlug : function(name) {
            return name.replace(/[a-zA-Z0-9\-\_]/g, "").toLowerCase();
        },
        traverseObj : function(obj, pattern) {
            var arr = pattern.split('=>').map(function(s){
                return s.trim();
            });
            var current = obj;
            arr.forEach(function(cat, index){
                current[cat] = current[cat] || {};
                current[cat].items = current[cat].items || [];
                // not last
                if(index !== arr.length -1) {
                    current[cat].subcat = current[cat].subcat || {};
                    current = current[cat].subcat;
                } else {
                    current = current[cat];
                }
            });
            return current;
        }

    }
    return fns;
};


module.exports = nsg;