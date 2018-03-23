"use strict";
exports.__esModule = true;
var fs = require("fs");
var gulp = require("gulp");
var mocha = require("gulp-mocha");
var ts = require("gulp-typescript");
gulp.task("default", function () {
    // Doing nothing
    // TODO: Build entire project(server & client)
});
gulp.task("build-server", function () {
    var tsProject = ts.createProject("tsconfig.json");
    return tsProject.src()
        .pipe(tsProject())
        .js
        .pipe(gulp.dest(tsProject.options.outDir));
});
gulp.task("test", function () {
    var arr = JSON.parse(fs.readFileSync("./server/src/test/tests.json", "utf-8"));
    var tests = [];
    for (var t in arr) {
        if (arr[t]) {
            tests.push("./server/build/test/" + t + ".test.js");
        }
    }
    // gulp.src("./out/test/*.test.js")
    gulp.src(tests)
        .pipe(mocha());
});
