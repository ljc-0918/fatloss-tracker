/* ========== 减脂追踪工作台 · 界面渲染层 ========== */
function $(id) { return document.getElementById(id); }
function toast(msg) {
  var t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._tm); t._tm = setTimeout(function () { t.classList.remove('show'); }, 1900);
}
function go(p, btn) {
  document.querySelectorAll('.page').forEach(function (x) { x.classList.remove('active'); });
  $('page-' + p).classList.add('active');
  document.querySelectorAll('#nav button').forEach(function (b) { b.classList.remove('on'); });
  if (btn) btn.classList.add('on');
  $('main').scrollTop = 0;
  renderAll();
}

/* ================= 个人档案 ================= */
function openProfile() {
  var p = store.profile;
  pGender.value = p.gender; pAge.value = p.age; pHeight.value = p.height;
  pAct.value = p.activity; pInt.value = p.intensity; pTW.value = p.targetWeight || '';
  pManual.checked = p.manual;
  mKcal.value = p.mKcal || ''; mPro.value = p.mProtein || ''; mWater.value = p.mWater || ''; mStr.value = p.mStrength || '';
  toggleManual();
  previewTargets();
  $('mask').classList.add('show');
}
function closeProfile() { $('mask').classList.remove('show'); }
function toggleManual() { $('manualBox').style.display = pManual.checked ? 'block' : 'none'; }
function previewTargets() {
  var bak = JSON.parse(JSON.stringify(store.profile));
  store.profile = {
    gender: pGender.value, age: +pAge.value || 30, height: +pHeight.value || 170,
    activity: +pAct.value, intensity: +pInt.value, targetWeight: +pTW.value || null,
    manual: pManual.checked, mKcal: +mKcal.value || null, mProtein: +mPro.value || null,
    mWater: +mWater.value || null, mStrength: +mStr.value || null
  };
  var t = computeTargets();
  store.profile = bak;
  $('tPreview').innerHTML =
    '<div class="grid2">' +
    '<div class="stat"><div class="v">' + t.bmr + '</div><div class="l">基础代谢 BMR</div></div>' +
    '<div class="stat"><div class="v">' + t.tdee + '</div><div class="l">每日总消耗 TDEE</div></div>' +
    '<div class="stat"><div class="v" style="color:var(--red)">' + t.kcal + '</div><div class="l">目标热量 kcal</div></div>' +
    '<div class="stat"><div class="v" style="color:var(--teal)">' + t.protein + '</div><div class="l">目标蛋白质 g</div></div>' +
    '<div class="stat"><div class="v" style="color:var(--brand)">' + t.water + '</div><div class="l">目标饮水 ml（训练日 ' + t.waterTrain + '）</div></div>' +
    '<div class="stat"><div class="v" style="color:var(--purple)">' + t.strengthPerWeek + ' 次</div><div class="l">每周力量训练</div></div>' +
    '</div><div class="hint">当前依据体重 <b>' + (t.hasWeight ? t.weight + ' kg' : '（未录入，按标准体重估算）') +
    '</b>；日均缺口约 <b>' + t.deficit + ' kcal</b>，理论每周减重 <b>' + t.weeklyLoss + ' kg</b>。' +
    (t.hasWeight ? '录入新体重后目标会自动重算。' : '') + '</div>';
}
function saveProfile() {
  store.profile = {
    gender: pGender.value, age: +pAge.value || 30, height: +pHeight.value || 170,
    activity: +pAct.value, intensity: +pInt.value, targetWeight: +pTW.value || null,
    manual: pManual.checked, mKcal: +mKcal.value || null, mProtein: +mPro.value || null,
    mWater: +mWater.value || null, mStrength: +mStr.value || null
  };
  save(); closeProfile(); toast('档案已保存，目标已更新'); renderAll();
}

/* ================= 打卡 ================= */
function doCheckin() {
  var t = todayStr();
  if (store.checkin[t]) { delete store.checkin[t]; toast('已取消今日打卡'); }
  else { store.checkin[t] = true; toast('🎉 打卡成功，继续保持！'); }
  save(); renderHome();
}

/* ================= 首页 ================= */
function renderHome() {
  var t = todayStr(), tg = targetsFor(t);
  $('todayStr').textContent = t;
  var done = !!store.checkin[t];
  $('checkinCard').classList.toggle('undone', !done);
  $('ckTitle').textContent = done ? '✅ 今日已打卡' : '今日未打卡';
  $('ckSub').textContent = done ? '数据已归档，明天继续' : '完成记录后点击打卡归档';
  $('ckBtn').textContent = done ? '已完成' : '✓ 打卡';
  $('streakStr').textContent = '已连续 ' + streak() + ' 天';

  var b = store.body[t] || {}, ik = dayIntake(t), sp = store.sport[t] || {};
  var bmi = calcBMI(b.weight || latestWeight());
  $('hWeight').textContent = fmt(b.weight, 1);
  $('hBMI').textContent = fmt(bmi, 1);
  $('hBMIL').textContent = 'BMI ' + bmiLabel(bmi);
  $('hWater').textContent = b.water || '--';
  $('hIn').textContent = ik.kcal ? Math.round(ik.kcal) : '--';
  $('hOut').textContent = sp.burn || '--';
  var g = $('hGap');
  if (sp.burn && ik.kcal) {
    var gap = sp.burn - ik.kcal;
    g.textContent = (gap > 0 ? '-' : '+') + Math.abs(Math.round(gap));
    g.className = 'v ' + (gap > 0 ? 'pos' : 'neg');
  } else { g.textContent = '--'; g.className = 'v'; }

  var ws = weekStrength(t);
  var rows = [
    ['热量摄入', ik.kcal, tg.kcal, 'kcal', '#e5484d', true],
    ['蛋白质', ik.protein, tg.protein, 'g', '#0d9488', false],
    ['饮水', b.water || 0, tg.waterToday, 'ml', '#3b6cf0', false],
    ['本周力量训练', ws.done, tg.strengthPerWeek, '次', '#8b5cf6', false]
  ];
  $('goalBars').innerHTML = rows.map(function (r) {
    var pct = Math.min(100, r[1] / r[2] * 100);
    var over = r[5] && r[1] > r[2];
    return '<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;font-size:11.5px">' +
      '<span style="color:var(--sub)">' + r[0] + '</span><span style="font-weight:600' + (over ? ';color:var(--red)' : '') + '">' +
      fmt(r[1], r[3] === 'g' ? 1 : 0) + ' / ' + r[2] + ' ' + r[3] + '</span></div>' +
      '<div class="bar"><i style="width:' + pct + '%;background:' + (over ? '#e5484d' : r[4]) + '"></i></div></div>';
  }).join('');

  $('tdeeInfo').innerHTML =
    '<div class="grid3">' +
    '<div class="stat"><div class="v" style="font-size:16px">' + tg.bmr + '</div><div class="l">BMR</div></div>' +
    '<div class="stat"><div class="v" style="font-size:16px">' + tg.tdee + '</div><div class="l">TDEE</div></div>' +
    '<div class="stat"><div class="v" style="font-size:16px;color:var(--green)">' + tg.deficit + '</div><div class="l">目标日缺口</div></div>' +
    '</div><div class="hint">目标随体重自动更新 · 当前依据 <b>' + (tg.hasWeight ? tg.weight + ' kg' : '标准体重估算') +
    '</b> · 理论每周减 <b>' + tg.weeklyLoss + ' kg</b> · 目标体重 <b>' + tg.targetWeight + ' kg</b></div>';
  renderCal();
}
function renderCal() {
  var now = new Date(), y = now.getFullYear(), m = now.getMonth();
  var first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
  var html = ['日', '一', '二', '三', '四', '五', '六'].map(function (w) { return '<div class="wd">' + w + '</div>'; }).join('');
  for (var i = 0; i < first; i++) html += '<div></div>';
  for (var d = 1; d <= days; d++) {
    var k = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var cls = 'day';
    if (store.checkin[k]) cls += ' ok';
    if (k === todayStr()) cls += ' today';
    if (k > todayStr()) cls += ' dim';
    html += '<div class="' + cls + '">' + d + (store.checkin[k] ? '✓' : '') + '</div>';
  }
  $('cal').innerHTML = html;
}

/* ================= 身体数据 ================= */
function saveBody() {
  var d = bDate.value, w = +bWeight.value;
  var fat = +bFat.value, waist = +bWaist.value, arm = +bArm.value, thigh = +bThigh.value;
  if (!d) return toast('请选择日期');
  if (!w && !fat && !waist && !arm && !thigh && !bNote.value.trim() && dayWater(d) === 0) return toast('请至少填写一项');
  store.body[d] = store.body[d] || {};
  if (w) store.body[d].weight = w; else delete store.body[d].weight;
  store.body[d].fat = fat || null; store.body[d].waist = waist || null;
  store.body[d].arm = arm || null; store.body[d].thigh = thigh || null;
  store.body[d].note = bNote.value.trim();
  store.body[d].water = dayWater(d);
  save(); toast('已保存 · 目标已按新体重更新'); renderAll();
}
function delBody(d) { if (confirm('删除 ' + d + ' 的身体数据？')) { delete store.body[d]; save(); renderAll(); } }

/* ---- 饮品按次记录 UI ---- */
function addCustomDrink() {
  var v = +drinkCustom.value; if (!v || v <= 0) return toast('请输入容量');
  addDrink(bDate.value, '自定义 ' + v + 'ml', v); drinkCustom.value = ''; toast('已记录 +' + v + 'ml');
}
function renderDrink() {
  var d = bDate.value || todayStr();
  $('drinkPresets').innerHTML = DRINK_PRESETS.map(function (p) {
    return '<button onclick="addDrink(bDate.value,\'' + p.label + '\',' + p.ml + ')">' + p.icon + ' ' + p.label + '<span class="ml">' + p.ml + ' ml · ' + p.kind + '</span></button>';
  }).join('');
  var arr = store.drinks[d] || [], total = dayWater(d), tg = targetsFor(d), goal = tg.waterToday || 2000;
  var pct = goal ? Math.min(100, Math.round(total / goal * 100)) : 0;
  var html = '<div style="display:flex;justify-content:space-between;align-items:baseline"><div class="t1">今日饮水（' + d + '）</div><div class="num">' + total + ' / ' + goal + ' ml</div></div>';
  html += '<div class="bar"><i style="width:' + pct + '%;background:' + (pct >= 100 ? 'var(--green)' : '#2196f3') + '"></i></div>';
  html += '<div class="muted" style="margin-top:3px">' + (pct >= 100 ? '✅ 已达标' : '还差 ' + Math.max(0, goal - total) + ' ml 达标') + '</div>';
  if (arr.length) {
    html += arr.map(function (it, i) {
      var tm = new Date(it.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      return '<div class="rec"><div style="flex:1"><div class="t1">' + it.label + '</div><div class="muted">' + tm + '</div></div><div class="num">' + it.ml + ' ml</div><button class="del" onclick="delDrink(\'' + d + '\',' + i + ')">✕</button></div>';
    }).join('');
  } else {
    html += '<div class="muted" style="text-align:center;padding:10px 0">还没有记录，点上面的按钮记一次吧</div>';
  }
  $('drinkToday').innerHTML = html;
}
var chartRange = 7, chartMetric = 'weight';
function setChartRange(n) {
  chartRange = n;
  [7, 30, 90].forEach(function (x) { var e = $('seg' + x); if (e) e.classList.toggle('on', x === n); });
  renderChart();
}
function setChartMetric(m) {
  chartMetric = m;
  [['weight', 'segMWeight'], ['fat', 'segMFat'], ['waist', 'segMWaist']].forEach(function (p) { var e = $(p[1]); if (e) e.classList.toggle('on', p[0] === m); });
  renderChart();
}
var METRIC_META = { weight: { unit: 'kg', label: '体重', color: '#3b6cf0', target: true }, fat: { unit: '%', label: '体脂率', color: '#8b5cf6', target: false }, waist: { unit: 'cm', label: '腰围', color: '#0d9488', target: false } };
function renderChart() {
  var meta = METRIC_META[chartMetric], box = $('chartBox'), end = new Date(), pts = [];
  for (var i = chartRange - 1; i >= 0; i--) {
    var d = new Date(end); d.setDate(d.getDate() - i);
    var k = dstr(d), rec = store.body[k];
    if (rec && rec[chartMetric]) pts.push({ date: k, w: +rec[chartMetric] });
  }
  if (pts.length < 2) { box.innerHTML = '<div class="muted" style="text-align:center;padding:26px 0">📈 记录 2 天以上「' + meta.label + '」后生成曲线</div>'; return; }
  var W = 372, H = 190, pL = 38, pR = 12, pT = 18, pB = 30;
  var ws = pts.map(function (p) { return p.w; }), tw = meta.target ? computeTargets().targetWeight : null;
  var min = Math.min.apply(null, ws), max = Math.max.apply(null, ws);
  var span = Math.max(max - min, 0.5); min -= span * .15; max += span * .15;
  if (tw && tw < min && max - tw < 8) min = tw - span * .1;
  function X(i) { return pL + (W - pL - pR) * (i / (pts.length - 1)); }
  function Y(v) { return pT + (H - pT - pB) * (1 - (v - min) / (max - min)); }
  var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(p.w).toFixed(1); }).join('');
  var area = line + 'L' + X(pts.length - 1).toFixed(1) + ',' + (H - pB) + 'L' + X(0).toFixed(1) + ',' + (H - pB) + 'Z';
  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%">';
  s += '<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + meta.color + '" stop-opacity=".25"/><stop offset="1" stop-color="' + meta.color + '" stop-opacity="0"/></linearGradient></defs>';
  for (var gi = 0; gi <= 3; gi++) {
    var gy = pT + (H - pT - pB) * gi / 3, gv = max - (max - min) * gi / 3;
    s += '<line x1="' + pL + '" y1="' + gy + '" x2="' + (W - pR) + '" y2="' + gy + '" stroke="#eef1f7"/>';
    s += '<text x="' + (pL - 5) + '" y="' + (gy + 3) + '" font-size="9" fill="#7a8299" text-anchor="end">' + gv.toFixed(1) + '</text>';
  }
  if (tw > min && tw < max) {
    var ty = Y(tw);
    s += '<line x1="' + pL + '" y1="' + ty + '" x2="' + (W - pR) + '" y2="' + ty + '" stroke="#16a34a" stroke-dasharray="4 3"/>';
    s += '<text x="' + (W - pR) + '" y="' + (ty - 4) + '" font-size="9" fill="#16a34a" text-anchor="end">目标 ' + tw + '</text>';
  }
  s += '<path d="' + area + '" fill="url(#ag)"/><path d="' + line + '" fill="none" stroke="' + meta.color + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
  pts.forEach(function (p, i) {
    s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.w).toFixed(1) + '" r="3" fill="#fff" stroke="' + meta.color + '" stroke-width="2"/>';
    var show = pts.length <= 8 || i === 0 || i === pts.length - 1 || i % Math.ceil(pts.length / 6) === 0;
    if (show) {
      s += '<text x="' + X(i).toFixed(1) + '" y="' + (H - pB + 14) + '" font-size="8.5" fill="#7a8299" text-anchor="middle">' + p.date.slice(5) + '</text>';
      if (pts.length <= 10) s += '<text x="' + X(i).toFixed(1) + '" y="' + (Y(p.w) - 7) + '" font-size="9" fill="#1c2333" font-weight="700" text-anchor="middle">' + p.w + '</text>';
    }
  });
  s += '</svg>';
  var diff = pts[pts.length - 1].w - pts[0].w;
  box.innerHTML = s + '<div class="muted" style="text-align:center">' + meta.label + '区间变化：<b class="' + (diff <= 0 ? 'pos' : 'neg') + '">' + (diff > 0 ? '+' : '') + diff.toFixed(1) + ' ' + meta.unit + '</b></div>';
}
function renderBody() {
  renderChart();
  var dates = Object.keys(store.body).sort().reverse().slice(0, 60);
  $('bodyList').innerHTML = dates.map(function (d) {
    var r = store.body[d], bmi = calcBMI(r.weight);
    var extra = [];
    if (r.fat) extra.push('体脂 ' + r.fat + '%');
    if (r.waist) extra.push('腰 ' + r.waist);
    if (r.arm) extra.push('臂 ' + r.arm);
    if (r.thigh) extra.push('腿 ' + r.thigh);
    return '<div class="rec"><div style="flex:1"><div class="t1">' + d + (store.checkin[d] ? ' <span class="tag g">已打卡</span>' : '') + '</div>' +
      (r.note ? '<div class="t2">📝 ' + esc(r.note) + '</div>' : '') + '</div>' +
      '<div class="num">' + (r.weight ? r.weight + ' kg' : '--') +
      '<div class="muted" style="font-weight:400">BMI ' + fmt(bmi, 1) + ' · 💧' + (r.water || '--') + (extra.length ? '<br>' + esc(extra.join(' · ')) : '') + '</div></div>' +
      '<button class="del" onclick="delBody(\'' + d + '\')">✕</button></div>';
  }).join('') || '<div class="muted" style="text-align:center;padding:14px 0">暂无记录</div>';
}

/* ================= 饮食 ================= */
function switchMode(m) {
  $('modeFood').classList.toggle('on', m === 'food');
  $('modeDish').classList.toggle('on', m === 'dish');
  $('boxFood').style.display = m === 'food' ? 'block' : 'none';
  $('boxDish').style.display = m === 'dish' ? 'block' : 'none';
}
function autoFill() {
  var db = allFoods(), n = dName.value.trim(), g = +dGrams.value;
  if (db[n] && g > 0) {
    var f = db[n], k = g / 100;
    dKcal.value = (f[0] * k).toFixed(1); dPro.value = (f[1] * k).toFixed(1);
    dCarb.value = (f[2] * k).toFixed(1); dFat.value = (f[3] * k).toFixed(1); dFiber.value = (f[4] * k).toFixed(1);
  }
}
function addFood() {
  var d = dDate.value;
  if (!d) return toast('请选择日期');
  var n = dName.value.trim();
  if (!n) return toast('请输入食物名称');
  if (!+dKcal.value) return toast('请填写热量，或换用「餐厅菜品」模式');
  (store.diet[d] = store.diet[d] || []).push({
    meal: dMeal.value, name: n, grams: +dGrams.value || null, kcal: +dKcal.value || 0,
    protein: +dPro.value || 0, carb: +dCarb.value || 0, fat: +dFat.value || 0, fiber: +dFiber.value || 0
  });
  save(); toast('已添加：' + n); clearFoodForm(); renderAll();
}
function clearFoodForm() { dName.value = dGrams.value = dKcal.value = dPro.value = dCarb.value = dFat.value = dFiber.value = ''; }
function saveMyFood() {
  var n = dName.value.trim(), g = +dGrams.value || 100, k = +dKcal.value;
  if (!n || !k) return toast('请先填写名称、重量与营养值');
  var r = 100 / g;
  store.myFoods[n] = [+(k * r).toFixed(1), +((+dPro.value || 0) * r).toFixed(1), +((+dCarb.value || 0) * r).toFixed(1),
  +((+dFat.value || 0) * r).toFixed(1), +((+dFiber.value || 0) * r).toFixed(1)];
  save(); fillFoodList(); toast('已存入我的常用食物，下次输名字自动带出');
}
function addDish() {
  var d = dDate.value, key = dishSel.value, n = +dishQty.value || 1;
  if (!d) return toast('请选择日期');
  if (!key) return toast('请选择菜品');
  var v = window.DISH_DB[key];
  var name = key.replace(/^【.*?】/, '') + (n !== 1 ? ' ×' + n : '');
  (store.diet[d] = store.diet[d] || []).push({
    meal: dMeal.value, name: name, grams: Math.round(v[0] * n), kcal: +(v[1] * n).toFixed(1),
    protein: +(v[2] * n).toFixed(1), carb: +(v[3] * n).toFixed(1), fat: +(v[4] * n).toFixed(1), fiber: +(v[5] * n).toFixed(1), est: true
  });
  save(); toast('已按均值估算添加：' + name); renderAll();
}
function delFood(d, i) {
  store.diet[d].splice(i, 1);
  if (!store.diet[d].length) delete store.diet[d];
  save(); renderAll();
}
function copyYesterday() {
  var d = dDate.value, y = new Date(d + 'T00:00:00'); y.setDate(y.getDate() - 1);
  var src = store.diet[dstr(y)];
  if (!src || !src.length) return toast('前一天没有饮食记录');
  store.diet[d] = (store.diet[d] || []).concat(JSON.parse(JSON.stringify(src)));
  save(); toast('已复制前一天的 ' + src.length + " 条记录"); renderAll();
}
function renderDiet() {
  var d = dDate.value || todayStr(), s = dayIntake(d), tg = targetsFor(d);
  var kGap = tg.kcal - s.kcal, pGap = tg.protein - s.protein;
  $('dietStats').innerHTML =
    '<div class="stat"><div class="v">' + Math.round(s.kcal) + '</div><div class="l">总摄入 / 目标 ' + tg.kcal + '</div></div>' +
    '<div class="stat"><div class="v ' + (kGap >= 0 ? 'pos' : 'neg') + '">' + (kGap >= 0 ? '剩余 ' : '超出 ') + Math.abs(Math.round(kGap)) + '</div><div class="l">热量缺口 kcal</div></div>' +
    '<div class="stat"><div class="v">' + fmt(s.protein, 1) + '</div><div class="l">蛋白质 / 目标 ' + tg.protein + 'g</div></div>' +
    '<div class="stat"><div class="v ' + (pGap <= 0 ? 'pos' : 'warn') + '">' + (pGap <= 0 ? '已达标 ✓' : '还差 ' + fmt(pGap, 1) + 'g') + '</div><div class="l">蛋白质缺口</div></div>';
  var bars = [['热量', s.kcal, tg.kcal, 'kcal', '#e5484d'], ['蛋白质', s.protein, tg.protein, 'g', '#0d9488'],
  ['碳水', s.carb, Math.round(tg.kcal * .45 / 4), 'g', '#f59e0b'], ['脂肪', s.fat, Math.round(tg.kcal * .25 / 9), 'g', '#8b5cf6'],
  ['膳食纤维', s.fiber, 25, 'g', '#16a34a']];
  $('dietBars').innerHTML = bars.map(function (b) {
    return '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--sub)"><span>' + b[0] +
      '</span><span>' + fmt(b[1], 1) + ' / ' + b[2] + ' ' + b[3] + '</span></div><div class="bar"><i style="width:' +
      Math.min(100, b[1] / b[2] * 100) + '%;background:' + b[4] + '"></i></div></div>';
  }).join('');
  var arr = store.diet[d] || [], html = '';
  ['早餐', '午餐', '晚餐', '加餐'].forEach(function (m) {
    var items = []; arr.forEach(function (f, i) { if (f.meal === m) items.push([f, i]); });
    if (!items.length) return;
    var mk = items.reduce(function (a, x) { return a + (+x[0].kcal || 0); }, 0);
    html += '<div class="meal-head"><span>' + m + '</span><span>' + Math.round(mk) + ' kcal</span></div>';
    items.forEach(function (x) {
      var f = x[0];
      html += '<div class="rec"><div style="flex:1"><div class="t1">' + esc(f.name) + (f.grams ? ' <span class="muted">' + f.grams + 'g</span>' : '') +
        (f.est ? ' <span class="tag o">估算</span>' : '') + '</div><div class="t2">蛋白 ' + fmt(f.protein, 1) + ' · 碳水 ' + fmt(f.carb, 1) +
        ' · 脂肪 ' + fmt(f.fat, 1) + ' · 纤维 ' + fmt(f.fiber, 1) + '</div></div><div class="num">' + Math.round(f.kcal) +
        '</div><button class="del" onclick="delFood(\'' + d + '\',' + x[1] + ')">✕</button></div>';
    });
  });
  $('dietList').innerHTML = html || '<div class="muted" style="text-align:center;padding:14px 0">当日暂无饮食记录</div>';
  renderDietRing();
}
function renderDietRing() {
  var d = dDate.value || todayStr(), s = dayIntake(d), tg = targetsFor(d);
  var box = $('kcalRing'); if (!box) return;
  var pct = s.kcal ? Math.min(100, s.kcal / tg.kcal * 100) : 0;
  var over = s.kcal > tg.kcal;
  var R = 34, C = 2 * Math.PI * R, off = C * (1 - pct / 100);
  box.innerHTML =
    '<svg viewBox="0 0 90 90" width="90" height="90" style="flex:none">' +
    '<circle cx="45" cy="45" r="' + R + '" fill="none" stroke="#eef1f7" stroke-width="9"/>' +
    '<circle cx="45" cy="45" r="' + R + '" fill="none" stroke="' + (over ? '#e5484d' : 'var(--red)') + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 45 45)"/>' +
    '<text x="45" y="42" font-size="15" font-weight="800" fill="#1c2333" text-anchor="middle">' + Math.round(s.kcal || 0) + '</text>' +
    '<text x="45" y="56" font-size="9" fill="#7a8299" text-anchor="middle">/ ' + tg.kcal + '</text></svg>' +
    '<div style="flex:1"><div style="font-size:13px;font-weight:700;margin-bottom:4px">' + (over ? '⚠️ 已超出预算' : '🍽 今日已用 ' + Math.round(pct) + '%') + '</div>' +
    '<div class="muted" style="line-height:1.7">目标热量 <b>' + tg.kcal + ' kcal</b><br>还剩 <b class="' + (over ? 'neg' : 'pos') + '">' + (over ? '超 ' + Math.round(s.kcal - tg.kcal) : Math.round(tg.kcal - s.kcal)) + ' kcal</b><br>蛋白质 <b>' + fmt(s.protein, 1) + ' / ' + tg.protein + ' g</b></div></div>';
}

/* ================= 运动 ================= */
function loadSportForm() {
  var r = store.sport[sDate.value] || {};
  sBurn.value = r.burn || ''; sStrength.value = r.strength ? '1' : '0'; sNote.value = r.strengthNote || '';
  renderSport();
}
function saveSport() {
  var d = sDate.value;
  if (!d) return toast('请选择日期');
  var prev = store.sport[d] || {};
  var items = prev.items || [];
  if (!+sBurn.value && sStrength.value !== '1' && !items.length) return toast('请填写全天消耗、添加动作或勾选力量训练');
  var hasStr = items.some(function (it) { return it.s; });
  store.sport[d] = { burn: +sBurn.value || 0, strength: sStrength.value === '1' || hasStr, strengthNote: sNote.value.trim(), items: items };
  save(); toast('运动数据已保存'); renderAll();
}
function delSport(d) { if (confirm('删除 ' + d + ' 的运动数据？')) { delete store.sport[d]; save(); renderAll(); } }

/* ---------- 标准动作库 ---------- */
function fillExerciseCats() {
  var cats = Object.keys(window.EXERCISE_DB || {});
  $('sCat').innerHTML = cats.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
  fillExOptions();
}
function fillExOptions() {
  var arr = (window.EXERCISE_DB || {})[$('sCat').value] || [];
  $('sEx').innerHTML = arr.map(function (e, i) { return '<option value="' + i + '">' + e.n + (e.s ? ' 💪' : '') + '</option>'; }).join('');
}
function addExercise() {
  var d = sDate.value;
  if (!d) return toast('请选择日期');
  var arr = (window.EXERCISE_DB || {})[$('sCat').value] || [];
  var e = arr[+$('sEx').value];
  if (!e) return toast('请选择动作');
  var min = +$('sMin').value;
  if (!min || min <= 0) return toast('请填写时长（分钟）');
  var w = weightOn(d) || 22 * Math.pow(store.profile.height / 100, 2);
  var kcal = Math.round(e.met * w * min / 60);
  var sets = +$('sSets').value || 0, reps = +$('sReps').value || 0;
  var r = store.sport[d] || { burn: 0, strength: false, strengthNote: '', items: [] };
  r.items = r.items || [];
  r.items.push({ cat: $('sCat').value, n: e.n, min: min, sets: sets, reps: reps, kcal: kcal, s: e.s ? 1 : 0 });
  if (e.s) { r.strength = true; if ($('sStrength')) sStrength.value = '1'; }
  store.sport[d] = r;
  save(); $('sMin').value = ''; $('sSets').value = ''; $('sReps').value = '';
  toast('已添加：' + e.n + ' ' + min + 'min ≈ ' + kcal + ' kcal');
  renderAll();
}
function delExercise(d, i) {
  var r = store.sport[d];
  if (!r || !r.items) return;
  r.items.splice(i, 1);
  if (!r.items.some(function (it) { return it.s; }) && sStrength.value !== '1') r.strength = false;
  if (!r.items.length && !r.burn && !r.strength && !r.strengthNote) delete store.sport[d];
  save(); renderAll();
}
function exMet(cat, n) {
  var a = (window.EXERCISE_DB || {})[cat] || [];
  for (var i = 0; i < a.length; i++) if (a[i].n === n) return a[i].met;
  return 5;
}
function saveTemplate() {
  var d = sDate.value || todayStr(), r = store.sport[d] || {};
  if (!r.items || !r.items.length) return toast('当天还没有动作可存为模板');
  var name = $('tplName').value.trim();
  if (!name) return toast('给模板起个名字');
  store.templates.push({
    name: name, items: r.items.map(function (it) {
      return { cat: it.cat, n: it.n, min: it.min, sets: it.sets, reps: it.reps, s: it.s };
    })
  });
  save(); $('tplName').value = ''; renderTemplates(); toast('已保存模板：' + name);
}
function applyTemplate(i) {
  var d = sDate.value || todayStr(), t = store.templates[i];
  if (!t) return;
  if (store.sport[d] && store.sport[d].items && store.sport[d].items.length && !confirm('套用模板将追加到 ' + d + ' 已有动作，继续？')) return;
  var w = weightOn(d) || 22 * Math.pow(store.profile.height / 100, 2);
  var r0 = store.sport[d] || { burn: 0, strength: false, strengthNote: '', items: [] };
  r0.items = r0.items || [];
  t.items.forEach(function (it) {
    r0.items.push({ cat: it.cat, n: it.n, min: it.min, sets: it.sets, reps: it.reps, s: it.s, kcal: Math.round(exMet(it.cat, it.n) * w * it.min / 60) });
    if (it.s) r0.strength = true;
  });
  if (r0.strength && $('sStrength')) sStrength.value = '1';
  store.sport[d] = r0; save(); toast('已套用模板：' + t.name); renderAll();
}
function delTemplate(i) {
  if (!confirm('删除模板「' + store.templates[i].name + '」？')) return;
  store.templates.splice(i, 1); save(); renderTemplates();
}
function renderTemplates() {
  var box = $('tplList'); if (!box) return;
  if (!store.templates.length) { box.innerHTML = '<div class="muted" style="padding:6px 0">还没有模板，先添加几个动作再存为模板。</div>'; return; }
  box.innerHTML = store.templates.map(function (t, i) {
    return '<div class="rec"><div style="flex:1"><div class="t1">' + esc(t.name) + '</div><div class="t2">' + t.items.length + ' 个动作 · ' +
      t.items.map(function (it) { return it.n + ' ' + it.min + 'min'; }).join('、') + '</div></div>' +
      '<button class="btn btn-ghost" style="width:auto;padding:7px 12px;margin-right:6px" onclick="applyTemplate(' + i + ')">套用</button>' +
      '<button class="del" onclick="delTemplate(' + i + ')">✕</button></div>';
  }).join('');
}
function exSummary(items) {
  return (items || []).map(function (it) {
    var q = it.sets && it.reps ? it.sets + '×' + it.reps + ' ' : '';
    return it.n + ' ' + q + it.min + 'min≈' + it.kcal + 'kcal' + (it.note ? '(' + it.note + ')' : '');
  }).join('；');
}
function renderSport() {
  var d = sDate.value || todayStr(), sp = store.sport[d] || {}, ik = dayIntake(d), tg = targetsFor(d);
  var burn = sp.burn || 0, gap = burn - ik.kcal;
  $('sportStats').innerHTML =
    '<div class="stat"><div class="v">' + (burn || '--') + '</div><div class="l">全天消耗 / 目标 ' + tg.tdee + '</div></div>' +
    '<div class="stat"><div class="v">' + (ik.kcal ? Math.round(ik.kcal) : '--') + '</div><div class="l">饮食摄入 kcal</div></div>' +
    '<div class="stat"><div class="v ' + (gap > 0 ? 'pos' : 'neg') + '">' + (burn && ik.kcal ? (gap > 0 ? '-' : '+') + Math.abs(Math.round(gap)) : '--') + '</div><div class="l">热量收支</div></div>';
  var ws = weekStrength(d);
  var h = '';
  if (burn && ik.kcal) {
    h = gap > 0
      ? '✅ 当日热量缺口 <b class="pos">' + Math.round(gap) + ' kcal</b>（目标 ' + tg.deficit + '）。约 7700 kcal ≈ 减脂 1kg。'
      : '⚠️ 当日热量盈余 <b class="neg">' + Math.abs(Math.round(gap)) + ' kcal</b>，摄入超过消耗，注意调整。';
  } else h = '录入当日「饮食」与「全天消耗」后自动计算收支。';
  h += '<br>💪 本周力量训练 <b>' + ws.done + ' / ' + tg.strengthPerWeek + '</b> 次' + (ws.done >= tg.strengthPerWeek ? ' <span class="tag g">已达标</span>' : '（本周起始 ' + ws.start + '）');
  $('sportHint').innerHTML = h;
  /* 当日动作列表 */
  var items = sp.items || [], exSum = 0;
  items.forEach(function (it) { exSum += it.kcal || 0; });
  $('exList').innerHTML = (items.length
    ? '<div class="hint" style="margin-top:8px">当日动作合计 ≈ <b>' + exSum + ' kcal</b></div>' + items.map(function (it, i) {
      return '<div class="rec"><div style="flex:1"><div class="t1">' + esc(it.n) + (it.s ? ' <span class="tag p">💪</span>' : ' <span class="tag g">🏃</span>') + '</div>' +
        '<div class="t2">' + esc(it.cat) + ' · ' + (it.sets && it.reps ? it.sets + '组×' + it.reps + '次 · ' : '') + it.min + ' min' + (it.note ? ' · ' + esc(it.note) : '') + '</div></div>' +
        '<div class="num">≈' + it.kcal + '<div class="muted" style="font-weight:400">kcal</div></div>' +
        '<button class="del" onclick="delExercise(\'' + d + '\',' + i + ')">✕</button></div>';
    }).join('')
    : '');
  var dates = Object.keys(store.sport).sort().reverse().slice(0, 60);
  $('sportList').innerHTML = dates.map(function (k) {
    var r = store.sport[k], kk = dayIntake(k).kcal, gg = r.burn - kk;
    var sub = r.items && r.items.length ? r.items.map(function (it) { return it.n + ' ' + it.min + 'min'; }).join('、') : (r.strengthNote || '');
    return '<div class="rec"><div style="flex:1"><div class="t1">' + k + (r.strength ? ' <span class="tag p">💪 力量</span>' : '') + '</div>' +
      (sub ? '<div class="t2">' + esc(sub) + '</div>' : '') + '</div><div class="num">🔥 ' + (r.burn || '--') +
      '<div class="muted" style="font-weight:400">收支 ' + (kk && r.burn ? (gg > 0 ? '-' : '+') + Math.abs(Math.round(gg)) : '--') + '</div></div>' +
      '<button class="del" onclick="delSport(\'' + k + '\')">✕</button></div>';
  }).join('') || '<div class="muted" style="text-align:center;padding:14px 0">暂无记录</div>';
  renderTemplates();
}

/* ================= 数据备份 ================= */
function xc(v, t) {
  if (v === null || v === undefined || v === '') return '<Cell><Data ss:Type="String"></Data></Cell>';
  if (t === 'n') return '<Cell><Data ss:Type="Number">' + v + '</Data></Cell>';
  return '<Cell><Data ss:Type="String">' + String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</Data></Cell>';
}
function xr(c) { return '<Row>' + c.join('') + '</Row>'; }
function xs(n, r) { return '<Worksheet ss:Name="' + n + '"><Table>' + r.join('') + '</Table></Worksheet>'; }
function dl(blob, name) {
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
}
function exportExcel() {
  var all = {};
  [store.body, store.diet, store.sport, store.checkin].forEach(function (o) { Object.keys(o).forEach(function (d) { all[d] = 1; }); });
  var dates = Object.keys(all).sort();
  var s1 = [xr(['日期', '体重kg', 'BMI', '饮水ml', '饮水目标', '体脂%', '腰围cm', '臂围cm', '腿围cm', '摄入kcal', '目标kcal', '热量缺口', '蛋白g', '目标蛋白g', '碳水g', '脂肪g', '纤维g', '全天消耗', 'TDEE', '热量收支', '力量训练', '打卡', '备注'].map(function (h) { return xc(h); }))];
  dates.forEach(function (d) {
    var b = store.body[d] || {}, ik = dayIntake(d), sp = store.sport[d] || {}, tg = targetsFor(d);
    var bmi = calcBMI(b.weight);
    s1.push(xr([xc(d), xc(b.weight, 'n'), xc(bmi ? +bmi.toFixed(1) : null, 'n'), xc(b.water, 'n'), xc(tg.waterToday, 'n'),
    xc(b.fat, 'n'), xc(b.waist, 'n'), xc(b.arm, 'n'), xc(b.thigh, 'n'),
    xc(ik.kcal ? +ik.kcal.toFixed(1) : null, 'n'), xc(tg.kcal, 'n'), xc(ik.kcal ? Math.round(tg.kcal - ik.kcal) : null, 'n'),
    xc(ik.protein ? +ik.protein.toFixed(1) : null, 'n'), xc(tg.protein, 'n'), xc(ik.carb ? +ik.carb.toFixed(1) : null, 'n'),
    xc(ik.fat ? +ik.fat.toFixed(1) : null, 'n'), xc(ik.fiber ? +ik.fiber.toFixed(1) : null, 'n'), xc(sp.burn, 'n'), xc(tg.tdee, 'n'),
    xc(sp.burn && ik.kcal ? Math.round(sp.burn - ik.kcal) : null, 'n'),
    xc(sp.strength ? '✓ ' + (sp.strengthNote || '已完成') : (store.sport[d] ? '未进行' : '')),
    xc(store.checkin[d] ? '✓' : ''), xc(b.note || '')]));
  });
  var s2 = [xr(['日期', '餐次', '食物', '重量g', '热量kcal', '蛋白g', '碳水g', '脂肪g', '纤维g', '估算'].map(function (h) { return xc(h); }))];
  Object.keys(store.diet).sort().forEach(function (d) {
    store.diet[d].forEach(function (f) {
      s2.push(xr([xc(d), xc(f.meal), xc(f.name), xc(f.grams, 'n'), xc(f.kcal, 'n'), xc(f.protein, 'n'), xc(f.carb, 'n'), xc(f.fat, 'n'), xc(f.fiber, 'n'), xc(f.est ? '估算' : '')]));
    });
  });
  var s3 = [xr(['日期', '体重kg', 'BMI', '体脂%', '腰围cm', '臂围cm', '腿围cm', '饮水ml', '饮品明细', '备注'].map(function (h) { return xc(h); }))];
  Object.keys(store.body).sort().forEach(function (d) {
    var b = store.body[d], bmi = calcBMI(b.weight);
    s3.push(xr([xc(d), xc(b.weight, 'n'), xc(bmi ? +bmi.toFixed(1) : null, 'n'), xc(b.fat, 'n'), xc(b.waist, 'n'), xc(b.arm, 'n'), xc(b.thigh, 'n'), xc(b.water, 'n'), xc((store.drinks[d] || []).map(function (x) { return x.label; }).join('、') || ''), xc(b.note || '')]));
  });
  var s4 = [xr(['日期', '全天消耗kcal', '摄入kcal', '热量收支', '力量训练', '训练内容', '动作明细'].map(function (h) { return xc(h); }))];
  Object.keys(store.sport).sort().forEach(function (d) {
    var r = store.sport[d], k = dayIntake(d).kcal;
    s4.push(xr([xc(d), xc(r.burn, 'n'), xc(k ? +k.toFixed(1) : null, 'n'), xc(k && r.burn ? Math.round(r.burn - k) : null, 'n'), xc(r.strength ? '✓' : '未进行'), xc(r.strengthNote || ''), xc(exSummary(r.items))]));
  });
  var p = store.profile, tg = computeTargets();
  var s5 = [xr([xc('项目'), xc('数值')])];
  [['性别', p.gender === 'male' ? '男' : '女'], ['年龄', p.age], ['身高cm', p.height], ['最新体重kg', tg.weight || '未录入'],
  ['BMI', tg.bmi ? tg.bmi.toFixed(1) : ''], ['活动系数', p.activity], ['减脂强度', (p.intensity * 100) + '%'],
  ['BMR', tg.bmr], ['TDEE', tg.tdee], ['目标热量kcal', tg.kcal], ['目标蛋白质g', tg.protein],
  ['目标饮水ml', tg.water], ['训练日饮水ml', tg.waterTrain], ['每周力量训练次数', tg.strengthPerWeek],
  ['日均目标缺口kcal', tg.deficit], ['理论周减重kg', tg.weeklyLoss], ['目标体重kg', tg.targetWeight]]
    .forEach(function (r) { s5.push(xr([xc(r[0]), xc(r[1])])); });
  var xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    xs('每日总表', s1) + xs('饮食明细', s2) + xs('身体数据', s3) + xs('运动消耗', s4) + xs('目标与档案', s5) + '</Workbook>';
  dl(new Blob(['\ufeff' + xml], { type: 'application/vnd.ms-excel' }), '减脂追踪备份_' + todayStr() + '.xls');
  toast('📊 Excel 已导出');
}
function exportJSON() {
  dl(new Blob([JSON.stringify(store, null, 1)], { type: 'application/json' }), '减脂数据存档_' + todayStr() + '.json');
  toast('💾 JSON 存档已导出（可用于换手机恢复）');
}
function importJSON(input) {
  var f = input.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function () {
    try {
      var d = JSON.parse(r.result);
      if (!d.body && !d.diet) throw 0;
      if (!confirm('导入将覆盖当前数据，确定继续？（建议先导出备份）')) return;
      store = Object.assign({ profile: defaultProfile(), body: {}, diet: {}, sport: {}, checkin: {}, myFoods: {} }, d);
      store.profile = Object.assign(defaultProfile(), store.profile || {});
      save(); initForms(); renderAll(); toast('✅ 数据已恢复');
    } catch (e) { toast('文件格式不正确'); }
    input.value = '';
  };
  r.readAsText(f);
}
function openBackup() { $('maskB').classList.add('show'); }
function closeBackup() { $('maskB').classList.remove('show'); }

/* ================= 阶段报告 ================= */
function periodDates(period) {
  var t = todayStr();
  if (period === 'week') {
    var s = weekStart(t), arr = [], d = new Date(s + 'T00:00:00');
    for (var i = 0; i < 7; i++) { if (dstr(d) <= t) arr.push(dstr(d)); d.setDate(d.getDate() + 1); }
    return arr;
  }
  var d0 = new Date(t + 'T00:00:00'), first = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-01', cur = new Date(first + 'T00:00:00'), arr2 = [];
  while (dstr(cur) <= t) { arr2.push(dstr(cur)); cur.setDate(cur.getDate() + 1); }
  return arr2;
}
function openReport(period) {
  $('rWeek').classList.toggle('on', period === 'week');
  $('rMonth').classList.toggle('on', period === 'month');
  renderReport(period);
  $('maskR').classList.add('show');
}
function closeReport() { $('maskR').classList.remove('show'); }
function renderReport(period) {
  var dates = periodDates(period), label = period === 'week' ? '本周' : '本月';
  var firstW = null, lastW = null, firstWa = null, lastWa = null;
  dates.forEach(function (d) {
    var r = store.body[d];
    if (r && r.weight) { if (firstW === null) firstW = r.weight; lastW = r.weight; }
    if (r && r.waist) { if (firstWa === null) firstWa = r.waist; lastWa = r.waist; }
  });
  var defSum = 0, defDays = 0, onKcal = 0, onPro = 0, sportDays = 0, strDays = 0, checkDays = 0, ikSum = 0, ikDays = 0;
  dates.forEach(function (d) {
    var ik = dayIntake(d), tg = targetsFor(d), r = store.sport[d] || {};
    if (ik.kcal) {
      ikSum += ik.kcal; ikDays++;
      if (r.burn) { defSum += (r.burn - ik.kcal); defDays++; }
      if (ik.kcal <= tg.kcal) onKcal++;
      if (ik.protein >= tg.protein) onPro++;
    }
    if (r.burn) sportDays++;
    if (r.strength) strDays++;
    if (store.checkin[d]) checkDays++;
  });
  var avgDef = defDays ? Math.round(defSum / defDays) : null;
  var tg = computeTargets();
  var rows = [
    ['记录天数', dates.length + ' 天'],
    ['打卡天数', checkDays + ' 天'],
    ['体重变化', (firstW !== null ? ((lastW - firstW <= 0 ? '' : '+') + (lastW - firstW).toFixed(1) + ' kg') : '—')],
    ['腰围变化', (firstWa !== null ? ((lastWa - firstWa <= 0 ? '' : '+') + (lastWa - firstWa).toFixed(1) + ' cm') : '—')],
    ['平均热量缺口', (avgDef !== null ? (avgDef >= 0 ? '每日 -' : '每日 +') + Math.abs(avgDef) + ' kcal' : '—')],
    ['热量达标天数', (ikDays ? onKcal + ' / ' + ikDays + ' 天' : '—')],
    ['蛋白达标天数', (ikDays ? onPro + ' / ' + ikDays + ' 天' : '—')],
    ['力量训练次数', strDays + ' 次（目标 ' + tg.strengthPerWeek * (period === 'week' ? 1 : 4) + '）']
  ];
  var h = '<div class="grid2" style="gap:8px">';
  rows.forEach(function (r) {
    h += '<div class="stat" style="text-align:left;padding:10px"><div style="font-size:15px;font-weight:800">' + r[1] + '</div><div class="l">' + r[0] + '</div></div>';
  });
  h += '</div>';
  var tip = '';
  if (firstW !== null && lastW < firstW) tip += '✅ ' + label + '体重下降 ' + (firstW - lastW).toFixed(1) + ' kg，方向正确。';
  else if (firstW !== null) tip += '⚠️ ' + label + '体重未下降，检查饮食或运动消耗是否到位。';
  if (firstWa !== null && lastWa < firstWa) tip += ' 腰围同步下降 ' + (firstWa - lastWa).toFixed(1) + ' cm，减脂真实有效！';
  if (avgDef !== null && avgDef > 0) tip += ' 平均每日热量缺口 ' + avgDef + ' kcal，理论每周约减 ' + (avgDef * 7 / 7700).toFixed(2) + ' kg。';
  if (onPro < ikDays * 0.6 && ikDays) tip += ' 蛋白质达标率偏低，增肌减脂期建议多吃蛋白。';
  if (!tip) tip = '📌 记录的数据还比较少，多记几天就能看到趋势啦。';
  h += '<div class="hint" style="margin-top:10px">' + tip + '</div>';
  $('reportBox').innerHTML = h;
}
function clearAll() {
  if (!confirm('⚠️ 将清空全部记录且不可恢复，确定？')) return;
  if (!confirm('再次确认：真的要清空所有数据吗？')) return;
  localStorage.removeItem(KEY); location.reload();
}

/* ================= 到点提醒 ================= */
var _remTimers = [];
function toggleReminder() {
  var on = $('reminderOn').checked; store.reminder.on = on; save();
  if (on) { requestNotify(); scheduleReminders(); toast('🔔 已开启到点提醒（应用打开时生效）'); }
  else { _remTimers.forEach(clearTimeout); _remTimers = []; toast('已关闭提醒'); }
}
function requestNotify() { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) { } }
function scheduleReminders() {
  _remTimers.forEach(clearTimeout); _remTimers = [];
  var now = new Date();
  (store.reminder.times || ['10:00', '15:00', '20:00']).forEach(function (ts) {
    var p = ts.split(':'), fire = new Date(); fire.setHours(+p[0], +p[1], 0, 0);
    if (fire <= now) fire.setDate(fire.getDate() + 1);
    _remTimers.push(setTimeout(function () { fireReminder(ts); }, fire - now));
  });
}
function fireReminder(ts) {
  var msg = ts === '20:00' ? '🍗 记得补足今日蛋白质，离目标还差一点就达标啦' : '💧 该喝水啦，保持饮水量有助于代谢';
  toast(msg);
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification('减脂追踪提醒', { body: msg }); } catch (e) { }
  scheduleReminders();
}

/* ================= 云同步（GitHub） ================= */
function ghHeaders(token) { return { 'Authorization': 'token ' + token, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' }; }
function b64encode(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64decode(b64) { return decodeURIComponent(escape(atob(b64))); }
function saveSync() {
  store.sync.token = $('syncToken').value.trim(); store.sync.repo = $('syncRepo').value.trim();
  save(); toast('☁️ 云同步配置已保存');
}
function syncToCloud() {
  var s = store.sync || {}, token = s.token, repo = s.repo;
  if (!token || !repo) return toast('请先在备份页填写 Token 和仓库');
  var path = 'data.json', url = 'https://api.github.com/repos/' + repo + '/contents/' + path;
  fetch(url, { headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json' } }).then(function (r) { return r.json(); }).then(function (j) {
    var body = { message: 'sync ' + new Date().toLocaleString(), content: b64encode(JSON.stringify(store)) };
    if (j && j.sha) body.sha = j.sha;
    return fetch(url, { method: 'PUT', headers: ghHeaders(token), body: JSON.stringify(body) });
  }).then(function (r) { return r.json(); }).then(function (j) { if (j && j.commit) toast('☁️ 已同步到云端（' + repo + '）'); else toast('同步失败：' + ((j && j.message) || '未知错误')); }).catch(function () { toast('同步失败（网络/权限）'); });
}
function syncFromCloud() {
  var s = store.sync || {}, token = s.token, repo = s.repo;
  if (!token || !repo) return toast('请先填写 Token 和仓库');
  var path = 'data.json', url = 'https://api.github.com/repos/' + repo + '/contents/' + path;
  fetch(url, { headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json' } }).then(function (r) { return r.json(); }).then(function (j) {
    if (!j.content) return toast('云端还没有备份，先同步一次');
    if (!confirm('从云端恢复将合并覆盖本机对应数据，确定？')) return;
    var data = JSON.parse(b64decode(j.content));
    ['body', 'diet', 'sport', 'checkin', 'templates', 'myFoods'].forEach(function (k) { if (data[k]) store[k] = Object.assign(store[k] || {}, data[k]); });
    if (data.profile) store.profile = Object.assign(defaultProfile(), data.profile);
    save(); initForms(); renderAll(); toast('✅ 已从云端恢复');
  }).catch(function () { toast('恢复失败（网络/权限/文件不存在）'); });
}

/* ================= 初始化 ================= */
function fillFoodList() {
  $('foodList').innerHTML = Object.keys(allFoods()).map(function (n) { return '<option value="' + n + '">'; }).join('');
}
function initForms() {
  var t = todayStr();
  bDate.value = dDate.value = sDate.value = t;
  var b = store.body[t];
  bWeight.value = b && b.weight ? b.weight : '';
  bFat.value = b && b.fat ? b.fat : ''; bWaist.value = b && b.waist ? b.waist : '';
  bArm.value = b && b.arm ? b.arm : ''; bThigh.value = b && b.thigh ? b.thigh : '';
  bNote.value = b && b.note ? b.note : '';
  bBMI.value = b && b.weight ? fmt(calcBMI(b.weight), 1) : '';
  renderDrink();
  if ($('syncToken')) $('syncToken').value = store.sync.token || '';
  if ($('syncRepo')) $('syncRepo').value = store.sync.repo || '';
  if ($('reminderOn')) $('reminderOn').checked = !!store.reminder.on;
  fillExerciseCats();
  renderTemplates();
  loadSportForm();
}
function renderAll() { renderHome(); renderBody(); renderDiet(); renderSport(); renderDrink(); }

/* ================= 智能速记（语音 / 文字） ================= */
function startVoice(targetId) {
  var id = targetId || 'quickInput';
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (SR && !isIOS) {
    try {
      var r = new SR(); r.lang = 'zh-CN'; r.interimResults = false; r.maxAlternatives = 1;
      r.onstart = function () { toast('🎤 请说话…'); };
      r.onresult = function (e) { var t = e.results[0][0].transcript; $(id).value = ($(id).value ? $(id).value + ' ' : '') + t; };
      r.onerror = function (e) { toast('语音识别失败，请打字（' + (e.error || 'err') + '）'); };
      r.start();
      return;
    } catch (err) { /* fallthrough to guidance */ }
  }
  // iPhone / 不支持浏览器：引导用系统键盘自带的语音输入（iPhone 上可用）
  if ($(id)) $(id).focus();
  toast(isIOS ? 'iPhone 请点输入框，用键盘左下角 🎤 说话（系统自带，可用）' : '当前浏览器不支持语音，请直接打字或用键盘麦克风');
}
function parseExercise() {
  var t = $('exQuickInput').value;
  if (!t.trim()) return toast('请输入或语音录入内容');
  var r = parseExerciseNote(t);
  if (!r.items.length && !r.burn) return toast('没识别出动作，换个说法或手动添加~');
  var d = sDate.value || todayStr();
  var w = weightOn(d) || 22 * Math.pow(store.profile.height / 100, 2);
  var r0 = store.sport[d] || { burn: 0, strength: false, strengthNote: '', items: [] };
  r0.items = r0.items || [];
  if (r.burn) { r0.burn = r.burn; if ($('sBurn')) $('sBurn').value = r.burn; }
  r.items.forEach(function (it) {
    if (!it.kcal) it.kcal = Math.round(it.met * w * it.min / 60);
    delete it.met;
    r0.items.push(it);
    if (it.s) r0.strength = true;
  });
  if (r0.strength && $('sStrength')) sStrength.value = '1';
  store.sport[d] = r0;
  save();
  var names = r.items.map(function (i) { return i.n + (i.note ? '(' + i.note + ')' : '') + ' ' + i.min + 'min' + (i.kcal ? '≈' + i.kcal + 'kcal' : ''); }).join('、');
  var msg = '✅ 已添加 ' + r.items.length + ' 个动作' + (names ? '：' + names : '');
  if (r.burn) msg += (msg ? ' ｜ ' : '✅ ') + '全天消耗 ' + r.burn + ' kcal';
  if (r.unknown && r.unknown.length) msg += ' ｜ 未识别：' + r.unknown.join('、');
  toast(msg);
  $('exQuickInput').value = ''; renderAll();
}
function parseQuick() {
  var t = $('quickInput').value;
  if (!t.trim()) return toast('请输入或语音录入内容');
  var r = parseQuickNote(t);
  if (!r.items.length) return toast('没识别出食物，换个说法或手动录入~');
  var d = dDate.value || todayStr();
  r.items.forEach(function (it) {
    (store.diet[d] = store.diet[d] || []).push({
      meal: it.meal, name: it.name, grams: it.grams, kcal: it.kcal,
      protein: it.protein, carb: it.carb, fat: it.fat, fiber: it.fiber, est: it.est
    });
  });
  save();
  var names = r.items.map(function (i) { return i.meal.slice(0, 1) + i.name; }).join('、');
  var msg = '✅ 已添加 ' + r.items.length + ' 条：' + names;
  if (r.unknown && r.unknown.length) msg += ' ｜ 未识别：' + r.unknown.join('、');
  toast(msg);
  $('quickInput').value = ''; $('quickPreview').innerHTML = '';
  renderAll();
}
(function init() {
  $('dishSel').innerHTML = '<option value="">— 选择常见菜品 —</option>' +
    Object.keys(window.DISH_DB).map(function (k) { return '<option value="' + k + '">' + k + '</option>'; }).join('');
  fillFoodList(); initForms();
  bWeight.addEventListener('input', function () { var v = calcBMI(+bWeight.value); bBMI.value = v ? v.toFixed(1) : ''; });
  ['pGender', 'pAge', 'pHeight', 'pAct', 'pInt', 'pTW', 'mKcal', 'mPro', 'mWater', 'mStr'].forEach(function (id) {
    $(id).addEventListener('input', previewTargets); $(id).addEventListener('change', previewTargets);
  });
  renderAll();
  if (!localStorage.getItem(KEY)) setTimeout(function () { openProfile(); toast('先填写个人档案，自动生成你的专属目标'); }, 400);
  if (store.reminder.on) scheduleReminders();
})();
