/* 测试运动/饮食速记解析器 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync('减脂追踪工作台.html', 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true, virtualConsole: vc
});

const w = dom.window;
const cases = [
  { text: '锻炼41分钟，活动664大卡，步行6601步，', expectItems: 3, expectBurn: null, desc: 'Apple Watch 摘要' },
  { text: '今天卧推40分钟 跑步20分钟 死虫式3组', expectItems: 3, expectBurn: null, desc: '常规力量+有氧' },
  { text: '昨天深蹲30分钟', expectItems: 1, expectBurn: null, desc: '昨天日期' },
  { text: '全天消耗2400大卡', expectItems: 0, expectBurn: 2400, desc: '全天总消耗' },
  { text: '走路3300步', expectItems: 1, expectBurn: null, desc: '走路步数' },
  { text: '活动300大卡', expectItems: 1, expectBurn: null, desc: '活动大卡' }
];

let pass = 0, fail = 0;
setTimeout(() => {
  cases.forEach(c => {
    const r = w.parseExerciseNote(c.text);
    const okItems = r.items.length === c.expectItems;
    const okBurn = r.burn === c.expectBurn;
    if (okItems && okBurn) {
      pass++;
      console.log('PASS:', c.desc, '| items=' + r.items.length, '| burn=' + r.burn);
    } else {
      fail++;
      console.log('FAIL:', c.desc, '| expected items=' + c.expectItems + ' got=' + r.items.length, '| expected burn=' + c.expectBurn + ' got=' + r.burn);
      console.log('  raw:', JSON.stringify(r));
    }
  });
  console.log('RESULT: pass=' + pass + ' fail=' + fail + ' errors=' + errors.length);
  process.exit(fail || errors.length ? 1 : 0);
}, 600);
