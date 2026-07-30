/* 真机模拟：用 jsdom 加载单文件 HTML，捕获启动/交互报错 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync('减脂追踪工作台.html', 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + e.message + (e.detail ? (' | ' + e.detail) : '')));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true, virtualConsole: vc
});

function done() {
  const w = dom.window;
  const funcs = ['doCheckin', 'saveBody', 'addFood', 'exportExcel', 'renderAll', 'computeTargets', 'targetsFor', 'saveProfile', 'importJSON', 'openProfile'];
  const rep = funcs.map(f => f + ': ' + typeof w[f]).join('\n');
  let callErr = [];
  try {
    const t = w.computeTargets('2026-07-30');
    callErr.push('computeTargets OK -> kcal=' + t.kcal + ' protein=' + t.protein + ' water=' + t.water + ' strength/wk=' + t.strengthPerWeek);
  } catch (e) { callErr.push('computeTargets THREW: ' + e.message); }
  try { w.doCheckin(); callErr.push('doCheckin OK, streak=' + w.streak()); }
  catch (e) { callErr.push('doCheckin THREW: ' + e.message); }
  try { w.renderAll(); callErr.push('renderAll OK'); }
  catch (e) { callErr.push('renderAll THREW: ' + e.message); }
  // 检查关键 DOM 是否渲染出内容（非空白）
  const home = w.document.getElementById('goalBars');
  const cal = w.document.getElementById('calBox');
  console.log('=== 启动错误 ===');
  console.log(errors.length ? errors.join('\n') : '（无）');
  console.log('=== 关键函数 ===\n' + rep);
  console.log('=== 交互调用 ===\n' + callErr.join('\n'));
  console.log('=== 渲染产物 ===');
  console.log('goalBars 子节点数:', home ? home.children.length : 'NULL');
  console.log('calBox 内容长度:', cal ? (cal.innerHTML || '').length : 'NULL');
  console.log('RESULT:', (errors.length === 0 && callErr.every(x => !x.includes('THREW'))) ? 'PASS' : 'CHECK');
}
setTimeout(done, 600);
