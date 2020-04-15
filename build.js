const fs = require('fs');
const crypto = require('crypto');
const postcss = require('postcss');
const ejs = require('ejs');
const path = require('path');
const minify = require('html-minifier').minify;
const md5File = require('md5-file').sync;

const baseUrl = '/';
const src = path.resolve(__dirname, 'src');
const dist = path.resolve(__dirname, 'dist');


function ejsRenderFile(filename, data) {
  return ejs.render(fs.readFileSync(filename).toString(), Object.assign({
    require: _require
  }, data), {
    async: false
  });
}

function splitext(filename) {
  const path = filename.split('.');

  return [path.slice(0, -1).join('.'), path[path.length - 1]]
}

function _requireFile(filename) {
  if (!filename.startsWith(src)) {
    throw Error('[RuntimeError]');
  }
  const resource = filename.substr(src.length + 1);

  const [resource0, ext] = splitext(resource);
  const hash = md5File(filename).substr(0, 6);
  const destResource = `${resource0}.${hash}.${ext}`;

  fs.copyFileSync(
    filename,
    path.resolve(dist, destResource)
  );

  return baseUrl + destResource;
}

function _requireStylesheet(filename) {
  if (!filename.startsWith(src)) {
    throw Error('[RuntimeError]');
  }
  const resource = filename.substr(src.length + 1);

  const source = ejsRenderFile(filename, {});
  const cipher = crypto.createHash('md5');
  cipher.update(source);
  const hash = cipher.digest('hex').substr(0, 6);
  const [resource0, ext] = splitext(resource);
  const destResource = `${resource0}.${hash}.${ext}`;

  postcss([
    require('autoprefixer'),
    require('cssnano')
  ]).process(source, {
    from: filename,
    map: false,
  }).then(({css: content}) => {
    fs.writeFileSync(path.resolve(dist, destResource), content);
  });

  return baseUrl + destResource;
}

const _required = {};

function _require(resource) {
  const filename = path.resolve(src, resource);
  const ext = path.extname(filename);

  if (_required[filename]) {
    return _required[filename];
  }

  let url;
  // noinspection JSRedundantSwitchStatement
  switch (ext) {
    case '.css':
      url = _requireStylesheet(filename);
      break;
    default:
      url = _requireFile(filename);
      break;
  }

  _required[filename] = url;
  return url;
}


let html = ejsRenderFile(path.resolve(src, 'index.html'));
html = minify(html, {
  collapseWhitespace: true,
  minifyJS: true,
  collapseBooleanAttributes: true,
  collapseInlineTagWhitespace: true,
  removeComments: true,
});
fs.writeFileSync(path.resolve(dist, 'index.html'), html);