var nsg = function(options) {
    var util = {
        _       : require("underscore"),
        fs      : require('fs'),
        glob    : require('glob'),
        yaml    : require('yamljs'),
        md      : require('marked'),
        hb      : require('handlebars'),
        mkdirp  : require('mkdirp'),
        hljs    : require('highlight.js')
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
            body : _this.util.md(subBlocks.slice(1).join('---'))
        };

    });

    callback.call(this, blocks);
};


Nsg.prototype.generateFiles = function(blocks) {
    var _this = this;
    var fs = _this.util.fs;
    var organizedBlocks = blocks.reduce(function(obj, block) {
        var cat = block.conf.category;
        var parent = _this.helpers.traverseObj(obj, cat);
        parent.items.push(block);
        return obj;
    }, {});


    var singleTemplatePath = _this.settings.template + "single/single.html";
    var indexTemplatePathMain = _this.settings.template + "index/main.html";
    var indexTemplatePathItem = _this.settings.template + "index/item.html";
    var indexTemplatePathNav = _this.settings.template + "index/nav.html";

    // Create single templates
    var opts = {encoding: "UTF8"};
    fs.readFile(singleTemplatePath, opts, function(err, data){
        var template = _this.util.hb.compile(data);
        _this.generatePartials(organizedBlocks, template);

    });

    // Scope mainTemplate
    var mainTemplate;
    // Callback to generate index once templates are read
    var callback = _this.util._.after(3, function() {
        _this.generateIndex(organizedBlocks, mainTemplate);
    });

    // Register helpers
    _this.util.hb.registerHelper('filePath', function(cat, title){
        return _this.settings.webDir + (cat.split('=>').map(function(part){
            return _this.helpers.getSlug(part.trim());
        }).join('/')) + "/" +  _this.helpers.getSlug(title) + ".html";
    });

    _this.util.hb.registerHelper('highlight', function(html){
        var highlighted = _this.util.hljs.highlight('html', html);
        return "<pre class='sg-highlighted'><code>" + highlighted.value + "</code></pre>";
    });

    _this.util.hb.registerHelper('getId', function(cat, title){
        var catSlug = _this.helpers.getSlug(cat);
        var titleSlug = _this.util._.isString(title) ? "-" + _this.helpers.getSlug(title) : "";
        return catSlug + titleSlug;
    });

    _this.util.hb.registerHelper('setContext', function(context, key){
        this.context = _this.helpers.getSlug(context + "-" + key);
    });

    _this.util.hb.registerHelper('sgLog', function(log){
        console.log("handlebars log: " + log);
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
            return itemTemplate({categories: subCat, context : context});
        });
        callback();
    });

    // Read recursive navigation template
    fs.readFile(indexTemplatePathNav, opts, function(err, data){
        _this.util.hb.registerHelper('recursiveNav', function(subCat, context){
            var itemTemplate = _this.util.hb.compile(data);
            return itemTemplate({categories: subCat, context : context});
        });
        callback();
    });

    

};

Nsg.prototype.generateIndex = function(blocks, template) {
    var _this = this;
    _this.util.mkdirp(_this.settings.output, function(){
        var data = template({categories : blocks});
        var fileName = _this.settings.output + "index.html";
        _this.util.fs.writeFile(fileName, data, function(err){
            console.log(_this.settings.output + 'index.html Created');
        });
    });
};

Nsg.prototype.generatePartials = function(blocks, template, currentPath) {
    var _this = this;
    var fs = _this.util.fs;
    var output = _this.settings.output;
    var startPath = currentPath ? currentPath + "/" : "";

    _this.util._.each(blocks, function(obj, cat) {
        var folderName = _this.helpers.getSlug(cat);
        var folderPath = output + startPath + folderName;
        
        _this.util.mkdirp(folderPath, function(err){
            if(obj.items) {
                obj.items.forEach(function(item){
                    var data = template(item);
                    var title = item.conf.title;
                    var fileName = folderPath + '/' +  _this.helpers.getSlug(title) + ".html";
                    fs.writeFile(fileName, data, function(err){
                        console.log(fileName + ' Created');
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