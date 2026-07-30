const fs = require('fs');
const path = require('path');
const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'src-index.html'), 'utf8');
const parts = ['food-db.js', 'fatloss-data.js', 'core.js', 'ui.js']
  .map(f => '<script>\n' + fs.readFileSync(path.join(dir, f), 'utf8') + '\n</script>')
  .join('\n');
const out = html.replace('<!--INJECT_SCRIPTS-->', parts);
const iconB64 = fs.readFileSync(path.join(dir, 'icon-180.png')).toString('base64');
const iconHref = 'data:image/png;base64,' + iconB64;
const iconTag = '<link rel="apple-touch-icon" sizes="180x180" href="' + iconHref + '">\n' +
  '<link rel="apple-touch-icon-precomposed" sizes="180x180" href="' + iconHref + '">\n' +
  '<link rel="icon" type="image/png" sizes="180x180" href="' + iconHref + '">';
const topIcon = '<img src="' + iconHref + '" style="width:28px;height:28px;border-radius:50%;vertical-align:middle;margin-right:6px;object-fit:cover">';
const out2 = out.replace('<!--ICON-->', iconTag).replace('<h1>🔥 减脂追踪工作台</h1>', '<h1>' + topIcon + ' 减脂追踪工作台</h1>');
const target = path.join(dir, '减脂追踪工作台.html');
fs.writeFileSync(target, out2, 'utf8');
// 同步生成 GitHub Pages 用 index.html（同源）
fs.writeFileSync(path.join(dir, 'index.html'), out2, 'utf8');
console.log('BUILD_OK size=' + (Buffer.byteLength(out2, 'utf8') / 1024).toFixed(1) + 'KB -> ' + target);
