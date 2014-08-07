var nsg = function(options, callback) {
    var util = {
        _       : require("underscore"),
        fs      : require('fs'),
        glob    : require('glob'),
        yaml    : require('yamljs'),
        md      : require('marked'),
        hb      : require('handlebars'),
        mkdirp  : require('mkdirp'),
        hljs    : require('highlight.js'),
        ncp     : require('ncp').ncp
    };
    
    var defaults = {
        indexTemplateFolder : __dirname + "/template/default/index/",
        itemTemplate : __dirname + "/template/default/item/item.html",
        outputDir : "styleguide/",
        webDir : "/",
        assetDir : 'assets/',
        encoding : "UTF8",
        captureCSS : true
    };

    var settings = util._.extend(defaults, options);

    return new Nsg(util, settings, callback);
};


var Nsg = function(util, settings, callback) {
    this.util = util;
    this.settings = settings;
    this.helpers = this.getHelpers();
    this.callback = callback;
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
    var re = !_this.settings.captureCSS ?
        new RegExp(/\/\*.*?styleguide[\s\S]*?\*\//g) :
        new RegExp(/\/\*((?!end)\s)*styleguide[\s\S]*?end\s*?styleguide.*?\*\//g);

    var blocks = data.match(re);

    if(!blocks || blocks.length === 0) {
        callback.call(this, []);
        return;
    }

    blocks = blocks.map(function(str){
        console.log(str + "DELIMITARRR");
        var block = str.replace("/*styleguide", "")
                       .replace(/\*\//g, "");
        var subBlocks = block.split(/\-{3,}/);

        return {
            info : _this.util.yaml.parse(subBlocks[0]),
            body : subBlocks.slice(1).join('---')
        };

    });

    callback.call(this, blocks);
};


Nsg.prototype.generateFiles = function(blocks) {
    var _this = this;
    var fs = _this.util.fs;
    var toProcess = blocks.length + 2; // +2 is the index creation & asset copy
    _this.callback = _this.callback ?
        _this.util._.after(toProcess, _this.callback) :
        function(){};

    var organizedBlocks = blocks.reduce(function(obj, block) {
        var cat = block.info.category;
        var parent = _this.helpers.traverseObj(obj, cat);
        parent.items.push(block);
        return obj;
    }, {});


    var singleTemplatePath = _this.settings.itemTemplate;
    var indexTemplatePathMain = _this.settings.indexTemplateFolder + "main.html";
    var indexTemplatePathItem = _this.settings.indexTemplateFolder + "item.html";
    var indexTemplatePathNav = _this.settings.indexTemplateFolder + "nav.html";

    // Create single templates
    var opts = {encoding: "UTF8"};
    fs.readFile(singleTemplatePath, opts, function(err, data){
        var template = _this.util.hb.compile(data);
        _this.generatePartials(organizedBlocks, template);

    });

    // Register handlebars helpers
    _this.registerHBHelpers();

    // Scope mainTemplate
    var mainTemplate;
    // Callback to generate index once templates are read
    var callback = _this.util._.after(3, function() {
        _this.generateIndex(organizedBlocks, mainTemplate);
    });

    // Read Main Template
    fs.readFile(indexTemplatePathMain, opts, function(err, data){
        mainTemplate = _this.util.hb.compile(data);
        callback();
    });

    // Read recursive category template
    fs.readFile(indexTemplatePathItem, opts, function(err, data){
        _this.util.hb.registerHelper('recursiveCategory', function(subCat, context){
            var itemTemplate = _this.util.hb.compile(data);
            return itemTemplate({
                settings : _this.settings,
                content: {
                    categories: subCat,
                    context : context
                }
            });
        });
        callback();
    });

    // Read recursive navigation template
    fs.readFile(indexTemplatePathNav, opts, function(err, data){
        _this.util.hb.registerHelper('recursiveNav', function(subCat, context){
            var itemTemplate = _this.util.hb.compile(data);
            return itemTemplate({
                settings : _this.settings,
                content: {
                    categories: subCat,
                    context : context
                }
            });
        });
        callback();
    });

    _this.copyAssets();
};

Nsg.prototype.registerHBHelpers = function() {
    var _this = this;
    // Register helpers
    _this.util.hb.registerHelper('filePath', function(cat, title){
        return _this.settings.webDir + (cat.split('=>').map(function(part){
            return _this.helpers.getSlug(part.trim());
        }).join('/')) + "/" +  _this.helpers.getSlug(title) + ".html";
    });

    _this.util.hb.registerHelper('highlight', function(html){
        var highlighted = _this.util.hljs.highlight('html', html);
        return "<pre class='sg-highlighted hljs'><code>" + highlighted.value + "</code></pre>";
    });

    _this.util.hb.registerHelper('getId', function(cat, title){
        var catSlug = _this.helpers.getSlug(cat);
        var titleSlug = _this.util._.isString(title) ? "-" + _this.helpers.getSlug(title) : "";
        return catSlug + titleSlug;
    });

    _this.util.hb.registerHelper('setContext', function(context, key){
        this.context = _this.helpers.getSlug(context + "-" + key);
    });

    _this.util.hb.registerHelper('markdown', function(string){
        return _this.util.md(string);
    });

    _this.util.hb.registerHelper('sgLog', function(log){
        console.log("handlebars log: " + log);
    });
};

Nsg.prototype.generateIndex = function(blocks, template) {
    var _this = this;
    _this.util.mkdirp(_this.settings.outputDir, function(){
        var data = template({
            settings : _this.settings,
            content : {
                categories : blocks
            }
        });
        var fileName = _this.settings.outputDir + "index.html";
        _this.util.fs.writeFile(fileName, data, function(err){
            console.log(_this.settings.outputDir + 'index.html Created');
            _this.callback();
        });
    });
};

Nsg.prototype.copyAssets = function() {
    var _this = this;
    var source = _this.settings.indexTemplateFolder + "assets/";
    var dest = _this.settings.outputDir + _this.settings.assetDir;
    _this.util.ncp(source, dest, function(err){
        _this.callback();
    });
};

Nsg.prototype.generatePartials = function(blocks, template, currentPath) {
    var _this = this;
    var fs = _this.util.fs;
    var output = _this.settings.outputDir;
    var startPath = currentPath ? currentPath + "/" : "";

    _this.util._.each(blocks, function(obj, cat) {
        var folderName = _this.helpers.getSlug(cat);
        var folderPath = output + startPath + folderName;
        
        _this.util.mkdirp(folderPath, function(err){
            if(obj.items) {
                obj.items.forEach(function(item){
                    var data = template({
                        settings: _this.settings,
                        content: item
                    });
                    var title = item.info.title;
                    var fileName = folderPath + '/' +  _this.helpers.getSlug(title) + ".html";
                    fs.writeFile(fileName, data, function(err){
                        console.log(fileName + ' Created');
                        _this.callback();
                    });
                });
            }
        });

        if(obj.subcat) {
            var newPath = startPath + folderName;
            _this.generatePartials(obj.subcat, template, newPath);
        }
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
            return name
                .replace(' ', '-')
                .replace(/[^a-zA-Z0-9\-\_]/g, "")
                .toLowerCase();
        },
        traverseObj : function(obj, pattern) {
            var arr = pattern.split('=>').map(function(s){
                return s.trim();
            });
            var current = obj;
            arr.forEach(function(cat, index){
                current[cat] = current[cat] || {};
                current[cat].items = current[cat].items || [];
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