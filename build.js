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

function _requireCopy(filename) {
  if (!filename.startsWith(src)) {
    throw Error('[RuntimeError]');
  }
  const resource = filename.substr(src.length + 1);
  fs.copyFileSync(filename, path.resolve(dist, resource));
  return baseUrl + resource;
}

function _requireFile(filename) {
  if (!filename.startsWith(src)) {
    throw Error('[RuntimeError]');
  }
  const resource = filename.substr(src.length + 1);

  const hash = md5File(filename).substr(0, 6);

  fs.copyFileSync(
    filename,
    path.resolve(dist, resource)
  );

  return baseUrl + resource + `?v=${hash}`;
}

function _requireTemplate(filename) {
  if (!filename.startsWith(src)) {
    throw Error('[RuntimeError]');
  }
  const resource = filename.substr(src.length + 1);

  const hash = md5File(filename).substr(0, 6);
  fs.writeFileSync(path.resolve(dist, resource), ejsRenderFile(filename));

  return baseUrl + resource + `?v=${hash}`;
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

  postcss([
    require('autoprefixer'),
    require('cssnano')
  ]).process(source, {
    from: filename,
    map: false,
  }).then(({css: content}) => {
    fs.writeFileSync(path.resolve(dist, resource), content);
  });

  return baseUrl + resource + `?v=${hash}`;
}

const _required = {};

function _require(resource) {
  const filename = path.resolve(src, resource);
  const basename = path.basename(filename);

  if (_required[filename]) {
    return _required[filename];
  }

  let url;

  switch (basename) {
    case 'favicon.ico':
      url = _requireCopy(filename);
      break;

    case 'browserconfig.xml':
    case 'site.webmanifest':
      url = _requireTemplate(filename);
      break;

    default:
      const ext = path.extname(filename);

      // noinspection JSRedundantSwitchStatement
      switch (ext) {
        case '.css':
          url = _requireStylesheet(filename);
          break;

        default:
          url = _requireFile(filename);
          break;
      }

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
  removeComments: true,
});
fs.writeFileSync(path.resolve(dist, 'index.html'), html);