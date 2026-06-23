'use strict';

const { src, dest, series, parallel, watch } = require('gulp');
const browserSync = require('browser-sync').create();
const cleanCSS = require('gulp-clean-css');
const terser = require('gulp-terser');
const rename = require('gulp-rename');

function styles() {
  return src('css/style.css')
    .pipe(cleanCSS())
    .pipe(rename({ suffix: '.min' }))
    .pipe(dest('css'))
    .pipe(browserSync.stream());
}

function scripts() {
  return src('js/custom.js')
    .pipe(terser())
    .pipe(rename({ suffix: '.min' }))
    .pipe(dest('js'));
}

function vendorStyles() {
  return src('node_modules/bootstrap/dist/css/bootstrap.min.css')
    .pipe(dest('css/bootstrap'));
}

function vendorScripts() {
  return src('node_modules/bootstrap/dist/js/bootstrap.bundle.min.js')
    .pipe(dest('js/bootstrap'));
}

function serve() {
  browserSync.init({ server: { baseDir: '.' }, notify: false });
  watch('css/style.css', styles);
  watch('js/custom.js', series(scripts, reload));
  watch('index.html', reload);
}

function reload(done) {
  browserSync.reload();
  done();
}

exports.build = parallel(styles, scripts, vendorStyles, vendorScripts);
exports.dev = series(exports.build, serve);
exports.default = exports.build;
