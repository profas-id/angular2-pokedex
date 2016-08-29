/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
"use strict";
/**
 * Transform template html and css into executable code.
 * Intended to be used in a build step.
 */
var compiler = require('@angular/compiler');
var core_1 = require('@angular/core');
var path = require('path');
var compiler_private_1 = require('./compiler_private');
var core_private_1 = require('./core_private');
var reflector_host_1 = require('./reflector_host');
var static_reflection_capabilities_1 = require('./static_reflection_capabilities');
var static_reflector_1 = require('./static_reflector');
var GENERATED_FILES = /\.ngfactory\.ts$|\.css\.ts$|\.css\.shim\.ts$/;
var PREAMBLE = "/**\n * This file is generated by the Angular 2 template compiler.\n * Do not edit.\n */\n /* tslint:disable */\n\n";
var CodeGenerator = (function () {
    function CodeGenerator(options, program, host, staticReflector, compiler, reflectorHost) {
        this.options = options;
        this.program = program;
        this.host = host;
        this.staticReflector = staticReflector;
        this.compiler = compiler;
        this.reflectorHost = reflectorHost;
    }
    CodeGenerator.prototype.readFileMetadata = function (absSourcePath) {
        var moduleMetadata = this.staticReflector.getModuleMetadata(absSourcePath);
        var result = { components: [], ngModules: [], fileUrl: absSourcePath };
        if (!moduleMetadata) {
            console.log("WARNING: no metadata found for " + absSourcePath);
            return result;
        }
        var metadata = moduleMetadata['metadata'];
        var symbols = metadata && Object.keys(metadata);
        if (!symbols || !symbols.length) {
            return result;
        }
        var _loop_1 = function(symbol) {
            if (metadata[symbol] && metadata[symbol].__symbolic == 'error') {
                // Ignore symbols that are only included to record error information.
                return "continue";
            }
            var staticType = this_1.reflectorHost.findDeclaration(absSourcePath, symbol, absSourcePath);
            var annotations = this_1.staticReflector.annotations(staticType);
            annotations.forEach(function (annotation) {
                if (annotation instanceof core_1.NgModuleMetadata) {
                    result.ngModules.push(staticType);
                }
                else if (annotation instanceof core_1.ComponentMetadata) {
                    result.components.push(staticType);
                }
            });
        };
        var this_1 = this;
        for (var _i = 0, symbols_1 = symbols; _i < symbols_1.length; _i++) {
            var symbol = symbols_1[_i];
            _loop_1(symbol);
        }
        return result;
    };
    // Write codegen in a directory structure matching the sources.
    CodeGenerator.prototype.calculateEmitPath = function (filePath) {
        var root = this.options.basePath;
        for (var _i = 0, _a = this.options.rootDirs || []; _i < _a.length; _i++) {
            var eachRootDir = _a[_i];
            if (this.options.trace) {
                console.log("Check if " + filePath + " is under rootDirs element " + eachRootDir);
            }
            if (path.relative(eachRootDir, filePath).indexOf('.') !== 0) {
                root = eachRootDir;
            }
        }
        // transplant the codegen path to be inside the `genDir`
        var relativePath = path.relative(root, filePath);
        while (relativePath.startsWith('..' + path.sep)) {
            // Strip out any `..` path such as: `../node_modules/@foo` as we want to put everything
            // into `genDir`.
            relativePath = relativePath.substr(3);
        }
        return path.join(this.options.genDir, relativePath);
    };
    CodeGenerator.prototype.codegen = function () {
        var _this = this;
        var filePaths = this.program.getSourceFiles().map(function (sf) { return sf.fileName; }).filter(function (f) { return !GENERATED_FILES.test(f); });
        var fileMetas = filePaths.map(function (filePath) { return _this.readFileMetadata(filePath); });
        var ngModules = fileMetas.reduce(function (ngModules, fileMeta) {
            ngModules.push.apply(ngModules, fileMeta.ngModules);
            return ngModules;
        }, []);
        var analyzedNgModules = this.compiler.analyzeModules(ngModules);
        return Promise
            .all(fileMetas.map(function (fileMeta) { return _this.compiler
            .compile(fileMeta.fileUrl, analyzedNgModules, fileMeta.components, fileMeta.ngModules)
            .then(function (generatedModules) {
            generatedModules.forEach(function (generatedModule) {
                var sourceFile = _this.program.getSourceFile(fileMeta.fileUrl);
                var emitPath = _this.calculateEmitPath(generatedModule.moduleUrl);
                _this.host.writeFile(emitPath, PREAMBLE + generatedModule.source, false, function () { }, [sourceFile]);
            });
        }); }))
            .catch(function (e) { console.error(e.stack); });
    };
    CodeGenerator.create = function (options, program, compilerHost, reflectorHostContext) {
        var xhr = {
            get: function (s) {
                if (!compilerHost.fileExists(s)) {
                    // TODO: We should really have a test for error cases like this!
                    throw new Error("Compilation failed. Resource file not found: " + s);
                }
                return Promise.resolve(compilerHost.readFile(s));
            }
        };
        var urlResolver = compiler.createOfflineCompileUrlResolver();
        var reflectorHost = new reflector_host_1.ReflectorHost(program, compilerHost, options, reflectorHostContext);
        var staticReflector = new static_reflector_1.StaticReflector(reflectorHost);
        static_reflection_capabilities_1.StaticAndDynamicReflectionCapabilities.install(staticReflector);
        var htmlParser = new compiler_private_1.HtmlParser();
        var config = new compiler.CompilerConfig({
            genDebugInfo: options.debug === true,
            defaultEncapsulation: core_1.ViewEncapsulation.Emulated,
            logBindingUpdate: false,
            useJit: false
        });
        var normalizer = new compiler_private_1.DirectiveNormalizer(xhr, urlResolver, htmlParser, config);
        var expressionParser = new compiler_private_1.Parser(new compiler_private_1.Lexer());
        var elementSchemaRegistry = new compiler_private_1.DomElementSchemaRegistry();
        var console = new core_private_1.Console();
        var tmplParser = new compiler_private_1.TemplateParser(expressionParser, elementSchemaRegistry, htmlParser, console, []);
        var resolver = new compiler_private_1.CompileMetadataResolver(new compiler.NgModuleResolver(staticReflector), new compiler.DirectiveResolver(staticReflector), new compiler.PipeResolver(staticReflector), config, console, elementSchemaRegistry, staticReflector);
        var offlineCompiler = new compiler.OfflineCompiler(resolver, normalizer, tmplParser, new compiler_private_1.StyleCompiler(urlResolver), new compiler_private_1.ViewCompiler(config), new compiler_private_1.NgModuleCompiler(), new compiler_private_1.TypeScriptEmitter(reflectorHost));
        return new CodeGenerator(options, program, compilerHost, staticReflector, offlineCompiler, reflectorHost);
    };
    return CodeGenerator;
}());
exports.CodeGenerator = CodeGenerator;
//# sourceMappingURL=codegen.js.map