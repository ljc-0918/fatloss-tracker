/* ========== 减脂追踪工作台 · 数据层 & 自动目标推算引擎 ========== */
var KEY = 'fatloss_data_v2';
var store = load();

function defaultProfile() {
  return {
    gender: 'male', age: 30, height: 170,
    activity: 1.375,      // 活动系数
    intensity: 0.20,      // 减脂强度（热量赤字比例）
    targetWeight: null,   // 留空则按 BMI 22 自动推算
    manual: false,        // true = 用户手动锁定目标
    mKcal: null, mProtein: null, mWater: null, mStrength: null
  };
}
function load() {
  var s;
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { s = {}; }
  s.profile = Object.assign(defaultProfile(), s.profile || {});
  s.body = s.body || {}; s.diet = s.diet || {}; s.sport = s.sport || {};
  s.checkin = s.checkin || {}; s.myFoods = s.myFoods || {}; s.drinks = s.drinks || {};
  s.templates = s.templates || []; s.sync = s.sync || {}; s.reminder = s.reminder || { on: false, times: ['10:00', '15:00', '20:00'] };
  // 合并 AI 代录种子数据（本地已有该日期时以本地为准）
  var seed = window.FATLOSS_SEED || {};
  ['body', 'diet', 'sport', 'checkin'].forEach(function (sec) {
    var src = seed[sec] || {};
    Object.keys(src).forEach(function (d) { if (!(d in s[sec])) s[sec][d] = src[d]; });
  });
  return s;
}
function save() { localStorage.setItem(KEY, JSON.stringify(store)); }

/* ---------- 饮品按次记录 & 自动汇总 ---------- */
var DRINK_PRESETS = [
  { icon: '💧', label: '水杯 300ml', ml: 300, kind: '白水' },
  { icon: '💧', label: '矿泉水 550ml', ml: 550, kind: '白水' },
  { icon: '💧', label: '小瓶水 330ml', ml: 330, kind: '白水' },
  { icon: '☕', label: '美式·中杯', ml: 355, kind: '咖啡' },
  { icon: '☕', label: '美式·大杯', ml: 473, kind: '咖啡' },
  { icon: '🥛', label: '牛奶 250ml', ml: 250, kind: '奶' }
];
function dayWater(d) {
  var arr = store.drinks[d] || [], s = 0;
  for (var i = 0; i < arr.length; i++) s += arr[i].ml || 0;
  return s;
}
function addDrink(d, label, ml) {
  if (!d) return;
  store.drinks[d] = store.drinks[d] || [];
  store.drinks[d].push({ label: label, ml: ml, ts: Date.now() });
  store.body[d] = store.body[d] || {};
  store.body[d].water = dayWater(d);
  save(); renderAll();
}
function delDrink(d, idx) {
  if (!store.drinks[d]) return;
  store.drinks[d].splice(idx, 1);
  if (!store.drinks[d].length) delete store.drinks[d];
  if (store.body[d]) store.body[d].water = store.drinks[d] ? dayWater(d) : null;
  save(); renderAll();
}

/* ---------- 日期工具 ---------- */
function dstr(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function todayStr() { return dstr(new Date()); }
function fmt(n, d) { return (n === null || n === undefined || isNaN(n) || n === '') ? '--' : Number(n).toFixed(d === undefined ? 0 : d); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function weekStart(dateStr) {
  var d = new Date(dateStr + 'T00:00:00'), w = (d.getDay() + 6) % 7; // 周一为首
  d.setDate(d.getDate() - w); return dstr(d);
}

/* ---------- 体重相关 ---------- */
function latestWeight() {
  var ks = Object.keys(store.body).filter(function (k) { return store.body[k] && store.body[k].weight; }).sort();
  return ks.length ? store.body[ks[ks.length - 1]].weight : null;
}
function weightOn(date) {
  var ks = Object.keys(store.body).filter(function (k) { return k <= date && store.body[k] && store.body[k].weight; }).sort();
  return ks.length ? store.body[ks[ks.length - 1]].weight : latestWeight();
}
function calcBMI(w) {
  var h = store.profile.height;
  if (!w || !h) return null;
  return w / Math.pow(h / 100, 2);
}
function bmiLabel(b) {
  if (b === null) return '';
  if (b < 18.5) return '偏瘦'; if (b < 24) return '正常'; if (b < 28) return '超重'; return '肥胖';
}

/* ================= 自动目标推算引擎 =================
 * BMR  : Mifflin-St Jeor 公式
 * TDEE : BMR × 活动系数
 * 热量 : TDEE ×(1−减脂强度)，并设安全下限
 * 蛋白 : 减脂期 1.8g/kg 体重；BMI≥28 改用理想体重×2.0（避免虚高）
 * 饮水 : 体重×35ml，训练日 +500ml，取整到 50，限 1500~4000
 * 训练 : 按活动量与 BMI 给出每周力量训练次数目标
 * ================================================== */
function computeTargets(dateForWeight) {
  var p = store.profile;
  var w = (dateForWeight ? weightOn(dateForWeight) : latestWeight());
  var h = p.height, a = p.age;
  var res = { weight: w, hasWeight: !!w };
  if (!w) { // 无体重时用 BMI 22 的估算体重先给一版参考
    w = 22 * Math.pow(h / 100, 2);
  }
  var bmr = p.gender === 'male'
    ? 10 * w + 6.25 * h - 5 * a + 5
    : 10 * w + 6.25 * h - 5 * a - 161;
  var tdee = bmr * p.activity;
  var kcal = tdee * (1 - p.intensity);
  var floor = Math.max(bmr * 1.05, p.gender === 'male' ? 1500 : 1200);
  kcal = Math.max(kcal, floor);

  var bmi = w / Math.pow(h / 100, 2);
  var protein = bmi >= 28 ? (22 * Math.pow(h / 100, 2)) * 2.0 : w * 1.8;

  var water = w * 35;
  water = Math.round(water / 50) * 50;
  water = Math.min(4000, Math.max(1500, water));

  var strength = 3;
  if (p.activity >= 1.55) strength = 4;
  if (p.activity >= 1.725) strength = 5;
  if (bmi >= 28 && strength < 4) strength = 4;

  res.bmr = Math.round(bmr);
  res.tdee = Math.round(tdee / 10) * 10;
  res.kcal = Math.round(kcal / 10) * 10;
  res.protein = Math.round(protein);
  res.water = water;
  res.waterTrain = Math.min(4000, water + 500);
  res.strengthPerWeek = strength;
  res.deficit = res.tdee - res.kcal;
  res.weeklyLoss = +(res.deficit * 7 / 7700).toFixed(2);
  res.targetWeight = p.targetWeight || Math.round(22 * Math.pow(h / 100, 2) * 10) / 10;
  res.bmi = bmi;

  if (p.manual) { // 手动锁定时覆盖
    if (p.mKcal) res.kcal = +p.mKcal;
    if (p.mProtein) res.protein = +p.mProtein;
    if (p.mWater) { res.water = +p.mWater; res.waterTrain = +p.mWater; }
    if (p.mStrength) res.strengthPerWeek = +p.mStrength;
    res.deficit = res.tdee - res.kcal;
    res.weeklyLoss = +(res.deficit * 7 / 7700).toFixed(2);
  }
  return res;
}
/* 当日目标（训练日自动上调饮水） */
function targetsFor(date) {
  var t = computeTargets(date);
  var sp = store.sport[date];
  t.waterToday = (sp && sp.strength) ? t.waterTrain : t.water;
  return t;
}

/* ---------- 营养汇总 ---------- */
function dayIntake(date) {
  var arr = store.diet[date] || [], s = { kcal: 0, protein: 0, carb: 0, fat: 0, fiber: 0 };
  arr.forEach(function (f) {
    s.kcal += +f.kcal || 0; s.protein += +f.protein || 0; s.carb += +f.carb || 0;
    s.fat += +f.fat || 0; s.fiber += +f.fiber || 0;
  });
  return s;
}
/* 本周力量训练完成次数 */
function weekStrength(date) {
  var ws = weekStart(date), n = 0, days = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(ws + 'T00:00:00'); d.setDate(d.getDate() + i);
    var k = dstr(d); days.push(k);
    if (store.sport[k] && store.sport[k].strength) n++;
  }
  return { done: n, days: days, start: ws };
}
function streak() {
  var n = 0, d = new Date();
  if (!store.checkin[todayStr()]) d.setDate(d.getDate() - 1);
  while (store.checkin[dstr(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
/* 合并系统食物库 + 我的自定义食物 */
function allFoods() { return Object.assign({}, window.FOOD_DB || {}, store.myFoods || {}); }

/* ================= 智能速记解析引擎（纯前端规则） =================
 * 支持：日期(今天/昨天/前天/具体日期)、餐次(早/午/晚/加)、份数/重量(两份/200克)
 * 解析后归到正确餐次，外食匹配 DISH_DB，食材匹配 FOOD_DB，库外标 unknown
 */
function cnNum(s) { var m = { '零': 0, '一': 1, '两': 2, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '半': 0.5 }; return (s in m) ? m[s] : null; }
var QTY_UNITS = ['份', '个', '碗', '片', '只', '杯', '包', '串', '贯', '根', '条', '块', '人份'];
var WT_UNITS = ['克', 'g', 'kg', '毫升', 'ml'];
var _dishMap = null;
function dishSearchMap() {
  if (_dishMap) return _dishMap;
  var m = {};
  Object.keys(window.DISH_DB || {}).forEach(function (k) {
    var base = k.replace(/\d+(\.\d+)?\s*(份|碗|个|片|只|杯|包|串|贯|根|条|块|人份|小包)/g, '').trim();
    var full = base.replace(/【(.*?)】/g, '$1').trim();   // 带前缀：沙县鸡腿饭
    var bare = base.replace(/【.*?】/g, '').trim();        // 裸名：鸡腿饭 / 兰州拉面 / 番茄牛腩
    if (full && !(full in m)) m[full] = k;
    if (bare && !(bare in m)) m[bare] = k;
  });
  _dishMap = m; return m;
}
var _ents = null;
function buildEntityList() {
  if (_ents) return _ents;
  var a = [];
  var dm = dishSearchMap();
  Object.keys(dm).forEach(function (k) { a.push({ type: 'dish', nm: k, per: window.DISH_DB[dm[k]] }); });
  var db = allFoods();
  Object.keys(db).forEach(function (k) { a.push({ type: 'food', nm: k, per: db[k] }); });
  a.sort(function (x, y) { return y.nm.length - x.nm.length; });
  _ents = a; return a;
}
var QNUM_RE = /(零|一|两|二|三|四|五|六|七|八|九|半|\d+(?:\.\d+)?)\s*(份|个|碗|片|只|杯|包|串|贯|根|条|块|人份|克|g|kg|毫升|ml)/;
function grabQty(s) { var m = s.match(QNUM_RE); if (m) return { qty: parseFloat(m[1]) || cnNum(m[1]) || 1, unit: (m[2] || '').toLowerCase() }; return { qty: null, unit: '' }; }
function trimQtyEnd(s) { return s.replace(/(零|一|两|二|三|四|五|六|七|八|九|半|\d+(?:\.\d+)?)\s*(份|个|碗|片|只|杯|包|串|贯|根|条|块|人份|克|g|kg|毫升|ml)?\s*$/, '').replace(/\s+$/, ''); }
function trimQtyStart(s) { return s.replace(/^\s*(零|一|两|二|三|四|五|六|七|八|九|半|\d+(?:\.\d+)?)\s*(份|个|碗|片|只|杯|包|串|贯|根|条|块|人份|克|g|kg|毫升|ml)?/, ''); }
function resolveQty(before, after) {
  var bq = grabQty(before);
  if (bq.qty !== null) return bq;
  var at = after.replace(/^[\s，,、；;。.]+/, '');
  var am = at.match(/^\s*(零|一|两|二|三|四|五|六|七|八|九|半|\d+(?:\.\d+)?)\s*(份|个|碗|片|只|杯|包|串|贯|根|条|块|人份|克|g|kg|毫升|ml)/);
  if (am) {
    var rest = at.slice(am[0].length).replace(/^[\s，,、；;。.]+/, '');
    var ents = buildEntityList();
    var isEntity = ents.some(function (e) { return rest.indexOf(e.nm) === 0; });
    if (!isEntity) return { qty: parseFloat(am[1]) || cnNum(am[1]) || 1, unit: (am[2] || '').toLowerCase() };
  }
  return { qty: null, unit: '' };
}
function addEntityItem(best, qty, unit, meal, res) {
  if (best.type === 'dish') {
    var n = (qty !== null && unit && QTY_UNITS.indexOf(unit) >= 0) ? qty : 1;
    var v = best.per;
    res.items.push({ meal: meal, name: best.nm + (n !== 1 ? ' ×' + n : ''), grams: Math.round(v[0] * n), kcal: +(v[1] * n).toFixed(1), protein: +(v[2] * n).toFixed(1), carb: +(v[3] * n).toFixed(1), fat: +(v[4] * n).toFixed(1), fiber: +(v[5] * n).toFixed(1), est: true });
  } else {
    var grams, estFlag;
    if (qty !== null && WT_UNITS.indexOf(unit) >= 0) { grams = (unit === 'kg') ? qty * 1000 : qty; estFlag = false; }
    else { grams = 100; estFlag = true; }
    var p = best.per, k = grams / 100;
    res.items.push({ meal: meal, name: best.nm + (grams !== 100 ? (' ' + Math.round(grams) + 'g') : ''), grams: Math.round(grams), kcal: +(p[0] * k).toFixed(1), protein: +(p[1] * k).toFixed(1), carb: +(p[2] * k).toFixed(1), fat: +(p[3] * k).toFixed(1), fiber: +(p[4] * k).toFixed(1), est: estFlag });
  }
}
function parseFoodsInText(text, meal, res) {
  var clean = text.replace(/(今天|今日|昨天|前天|早|早餐|早饭|早晨|上午|午|午饭|午餐|中饭|中午|晚|晚饭|晚餐|夜里|晚上|加餐|下午茶|点心|零食|夜宵|了|吃|喝|的|和|跟|与|我|要|想|点|买|来|去|餐|上)/g, ' ').replace(/[，,、；;。.]/g, ' ').trim();
  if (!clean) return;
  var ents = buildEntityList(), working = clean, guard = 0;
  while (working && working.trim() && guard++ < 60) {
    var best = null, bi = 1e9;
    for (var i = 0; i < ents.length; i++) { var idx = working.indexOf(ents[i].nm); if (idx >= 0 && idx < bi) { bi = idx; best = ents[i]; } }
    if (!best) { var left = working.replace(/\s+/g, ' ').trim(); if (left) { (res.unknown = res.unknown || []).push(left); } break; }
    var before = working.slice(0, bi), after = working.slice(bi + best.nm.length);
    var q = resolveQty(before, after);
    addEntityItem(best, q.qty, q.unit, meal, res);
    working = trimQtyEnd(before) + trimQtyStart(after);
  }
}
function parseQuickNote(raw) {
  var text = String(raw || '').replace(/\s+/g, ' ').trim();
  var res = { date: todayStr(), items: [] };
  if (!text) return res;
  var dm = text.match(/(20\d{2}[-\/]\d{1,2}[-\/]\d{1,2})/);
  if (dm) { var p = dm[1].replace(/\//g, '-').split('-'); if (p[1].length < 2) p[1] = '0' + p[1]; if (p[2].length < 2) p[2] = '0' + p[2]; res.date = p.join('-'); text = text.replace(dm[0], ' '); }
  else if (/前天/.test(text)) { var d = new Date(); d.setDate(d.getDate() - 2); res.date = dstr(d); text = text.replace(/前天/g, ' '); }
  else if (/昨天/.test(text)) { var d2 = new Date(); d2.setDate(d2.getDate() - 1); res.date = dstr(d2); text = text.replace(/昨天/g, ' '); }
  else if (/今天|今日/.test(text)) { text = text.replace(/今天|今日/g, ' '); }
  var anchors = [
    { re: /早|早餐|早饭|早晨|上午/, meal: '早餐' },
    { re: /加餐|下午茶|点心|零食|夜宵/, meal: '加餐' },
    { re: /午|午饭|午餐|中饭|中午/, meal: '午餐' },
    { re: /晚|晚饭|晚餐|夜里|晚上/, meal: '晚餐' }
  ];
  var pos = [];
  anchors.forEach(function (a) { var re = new RegExp(a.re.source, 'g'); var m; while ((m = re.exec(text)) !== null) { pos.push({ i: m.index, meal: a.meal }); } });
  pos.sort(function (x, y) { return x.i - y.i; });
  if (!pos.length) parseFoodsInText(text, '午餐', res);
  else for (var i = 0; i < pos.length; i++) { var s = pos[i].i; var e = (i + 1 < pos.length) ? pos[i + 1].i : text.length; parseFoodsInText(text.slice(s, e), pos[i].meal, res); }
  return res;
}

/* ================= 运动速记解析引擎（纯前端规则） =================
 * 识别动作名(EXERCISE_DB 全分类)、时长(30分钟/Xmin/X分)、组数×次数(4组12次/4×12)
 * 写入 store.sport[date].items，消耗按当日体重×MET 在 apply 时计算
 */
var _exMap = null;
function exerciseNameMap() {
  if (_exMap) return _exMap;
  var m = {};
  Object.keys(window.EXERCISE_DB || {}).forEach(function (cat) {
    (window.EXERCISE_DB[cat] || []).forEach(function (e) {
      var info = { cat: cat, met: e.met, s: e.s, n: e.n };
      var aliases = [e.n];
      var base = e.n.replace(/[（(].*?[)）]/g, '').trim(); // 去括号：引体向上(门框单杠) → 引体向上
      if (base) aliases.push(base);
      base.split('/').forEach(function (p) { // 复合名拆分：跑步机快走/慢跑/跑步 → 跑步机、快走、慢跑、跑步
        var pp = p.replace(/[（(].*?[)）]/g, '').trim();
        if (pp) aliases.push(pp);
      });
      aliases.forEach(function (a) { if (!(a in m)) m[a] = info; });
    });
  });
  var EX_ALIASES = {
    '卧推': '杠铃卧推', '深蹲': '杠铃深蹲', '划船': '杠铃/哑铃划船',
    '肩推': '肩推(哑铃/杠铃)', '引体': '引体向上/高位下拉', '高位下拉': '引体向上/高位下拉',
    '跑步': '跑步机跑步(10km/h)', '慢跑': '跑步机慢跑(8km/h)', '快走': '跑步机快走(6km/h)',
    '户外快走': '快走(户外)', '户外步行': '快走(户外)', '户外走路': '快走(户外)',
    '步行': '快走(户外)', '走路': '快走(户外)', '散步': '快走(户外)',
    '锻炼': '自由活动', '运动': '自由活动', '活动': '自由活动',
    '动感单车': '动感单车', '椭圆机': '椭圆机', '壶铃': '壶铃/水瓶摆荡', '水瓶摆荡': '壶铃/水瓶摆荡'
  };
  Object.keys(EX_ALIASES).forEach(function (a) { var c = EX_ALIASES[a]; if (m[c] && !(a in m)) m[a] = m[c]; });
  _exMap = m; return m;
}
function parseExerciseNote(raw) {
  var text = String(raw || '').replace(/[，,；;。.]+/g, ' ').replace(/\s+/g, ' ').trim();
  var res = { date: todayStr(), items: [], burn: null };
  if (!text) return res;
  var dm = text.match(/(20\d{2}[-\/]\d{1,2}[-\/]\d{1,2})/);
  if (dm) { var p = dm[1].replace(/\//g, '-').split('-'); if (p[1].length < 2) p[1] = '0' + p[1]; if (p[2].length < 2) p[2] = '0' + p[2]; res.date = p.join('-'); text = text.replace(dm[0], ' '); }
  else if (/前天/.test(text)) { var d = new Date(); d.setDate(d.getDate() - 2); res.date = dstr(d); text = text.replace(/前天/g, ' '); }
  else if (/昨天/.test(text)) { var d2 = new Date(); d2.setDate(d2.getDate() - 1); res.date = dstr(d2); text = text.replace(/昨天/g, ' '); }
  else if (/今天|今日/.test(text)) { text = text.replace(/今天|今日/g, ' '); }

  // 先处理 Apple Watch / 运动手环常见摘要句式
  // 全天总消耗 N 大卡 → 直接写入 burn（总消耗）
  var totalBurn = text.match(/(?:全天消耗|总消耗|全天总消耗)\s*(\d+)\s*(?:大卡|千卡|kcal|卡路里)/i);
  if (totalBurn) { res.burn = +totalBurn[1]; text = text.replace(totalBurn[0], ' '); }

  // 活动/消耗 N 大卡 → 记为固定消耗的"自由活动"
  var activeCal = text.match(/(?:活动|消耗|燃脂|燃烧)\s*(\d+)\s*(?:大卡|千卡|kcal|卡路里)/i);
  if (activeCal) {
    var kcal = +activeCal[1];
    res.items.push({ cat: '居家·有氧', n: '自由活动', min: Math.max(10, Math.round(kcal / 12)), sets: 0, reps: 0, s: 0, met: 6, kcal: kcal, note: '活动' + kcal + '大卡' });
    text = text.replace(activeCal[0], ' ');
  }

  // 锻炼/运动 N 分钟 → 自由活动
  var exerciseMin = text.match(/(?:锻炼|运动)\s*(\d+(?:\.\d+)?)\s*(?:分钟|分|min|m)/i);
  if (exerciseMin) {
    res.items.push({ cat: '居家·有氧', n: '自由活动', min: +exerciseMin[1], sets: 0, reps: 0, s: 0, met: 6 });
    text = text.replace(exerciseMin[0], ' ');
  }

  // 步行/走路/散步 N 步 → 按 110 步/分钟换算为户外快走
  var stepsMatch = text.match(/(?:步行|走路|散步)\s*(\d+)\s*步/);
  if (stepsMatch) {
    var min = Math.max(5, Math.round(+stepsMatch[1] / 110));
    res.items.push({ cat: '居家·有氧', n: '快走(户外)', min: min, sets: 0, reps: 0, s: 0, met: 4.5, note: stepsMatch[1] + '步' });
    text = text.replace(stepsMatch[0], ' ');
  }

  var map = exerciseNameMap();
  var names = Object.keys(map).sort(function (a, b) { return b.length - a.length; });
  var working = text, guard = 0;
  while (working && working.trim() && guard++ < 60) {
    var best = null, bi = 1e9;
    for (var i = 0; i < names.length; i++) { var idx = working.indexOf(names[i]); if (idx >= 0 && idx < bi) { bi = idx; best = names[i]; } }
    if (!best) { var left = working.replace(/\s+/g, ' ').trim(); if (left) (res.unknown = res.unknown || []).push(left); break; }
    var after = working.slice(bi + best.length).replace(/^[\s，,；;。.]+/, '');
    var dm2 = after.match(/^(\d+(?:\.\d+)?)\s*(分钟|分|min|m)\b/i);
    var min = null;
    if (dm2) { min = parseFloat(dm2[1]); after = after.slice(dm2[0].length).replace(/^[\s，,；;。.]+/, ''); }
    var sets = 0, reps = 0;
    var sr = after.match(/^(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+)\s*(?:次|个|下)?/);
    if (sr) { sets = +sr[1]; reps = +sr[2]; after = after.slice(sr[0].length).replace(/^[\s，,；;。.]+/, ''); }
    else { var sg = after.match(/^(\d+)\s*组/); if (sg) { sets = +sg[1]; after = after.slice(sg[0].length).replace(/^[\s，,；;。.]+/, ''); } }
    if (min === null) min = 20;
    var info = map[best];
    res.items.push({ cat: info.cat, n: info.n, min: min, sets: sets, reps: reps, s: info.s, met: info.met });
    working = after.trim();
  }
  return res;
}

