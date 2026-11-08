(function () {
  'use strict';

  /* НАСТРОЙКА. Укажите адрес обработчика заявок (POST, JSON).
     Пока адрес пустой, форма работает в демо-режиме и заявки никуда не уходят. */
  var CONFIG = { endpoint: '' };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };

  /* Позиции сверены с каталогом Росприроднадзора: https://rpn.gov.ru/fkko/ */
  var WASTE = [
    ['47110101521', 'Лампы ртутные, ртутно-кварцевые, люминесцентные, утратившие потребительские свойства', 'hazard'],
    ['47192000521', 'Отходы термометров ртутных', 'hazard'],
    ['48221102532', 'Аккумуляторы компьютерные кислотные неповрежденные отработанные', 'hazard'],
    ['92011001532', 'Аккумуляторы свинцовые отработанные неповрежденные, с электролитом', 'auto'],
    ['92021001102', 'Кислота аккумуляторная серная отработанная', 'auto'],
    ['40611001313', 'Отходы минеральных масел моторных', 'auto'],
    ['40612001313', 'Отходы минеральных масел гидравлических, не содержащих галогены', 'auto'],
    ['40615001313', 'Отходы минеральных масел трансмиссионных', 'auto'],
    ['92130201523', 'Фильтры очистки масла автотранспортных средств отработанные', 'auto'],
    ['92130101524', 'Фильтры воздушные автотранспортных средств отработанные', 'auto'],
    ['92111001504', 'Шины пневматические автомобильные отработанные', 'auto'],
    ['91920101393', 'Песок, загрязненный нефтью или нефтепродуктами (содержание нефти или нефтепродуктов 15% и более)', 'oil'],
    ['91920102394', 'Песок, загрязненный нефтью или нефтепродуктами (содержание нефти или нефтепродуктов менее 15%)', 'oil'],
    ['91920401603', 'Обтирочный материал, загрязненный нефтью или нефтепродуктами (содержание нефти или нефтепродуктов 15% и более)', 'oil'],
    ['91920402604', 'Обтирочный материал, загрязненный нефтью или нефтепродуктами (содержание нефти или нефтепродуктов менее 15%)', 'oil'],
    ['73111001724', 'Отходы из жилищ несортированные (исключая крупногабаритные)', 'tko'],
    ['73120001724', 'Мусор и смет уличный', 'tko'],
    ['73310001724', 'Мусор от офисных и бытовых помещений организаций несортированный (исключая крупногабаритный)', 'tko'],
    ['73321001724', 'Мусор и смет производственных помещений малоопасный', 'tko'],
    ['73339001714', 'Смет с территории предприятия малоопасный', 'tko'],
    ['73210001304', 'Отходы (осадки) из выгребных ям', 'liquid'],
    ['73210101304', 'Отходы коммунальные жидкие неканализованных объектов водопотребления', 'liquid'],
    ['72220001394', 'Ил избыточный биологических очистных сооружений хозяйственно-бытовых и смешанных сточных вод', 'liquid'],
    ['72310202394', 'Осадок механической очистки нефтесодержащих сточных вод, содержащий нефтепродукты в количестве менее 15%', 'liquid'],
    ['81290101724', 'Мусор от сноса и разборки зданий несортированный', 'build'],
    ['89000001724', 'Отходы (мусор) от строительных и ремонтных работ', 'build'],
    ['46811202514', 'Тара из черных металлов, загрязненная лакокрасочными материалами (содержание менее 5%)', 'build'],
    ['89111002524', 'Инструменты лакокрасочные (кисти, валики), загрязненные лакокрасочными материалами (в количестве менее 5%)', 'build']
  ].map(function (w) { return { code: w[0], name: w[1], cat: w[2], cls: w[0].charAt(10) }; });

  var CATS = [
    ['all', 'Все'], ['tko', 'ТКО и уборка'], ['liquid', 'Жидкие и очистные'], ['build', 'Стройка и снос'],
    ['auto', 'Автопарк и сервис'], ['oil', 'Нефтепродукты'], ['hazard', 'Ртуть и батареи']
  ];
  var ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
  var CLASS_NAME = { 1: 'чрезвычайно опасные', 2: 'высокоопасные', 3: 'умеренно опасные', 4: 'малоопасные' };
  var BLOCK = {
    4: 'Отходы потребления: материалы и изделия, утратившие потребительские свойства',
    7: 'Водоснабжение, водоотведение, деятельность с отходами',
    8: 'Отходы строительства и ремонта',
    9: 'Прочие виды деятельности'
  };
  var FORM = {
    10: 'Жидкое: вещества, растворы', 30: 'Дисперсные системы', 31: 'Эмульсия', 39: 'Прочие дисперсные системы',
    50: 'Изделия из твёрдых материалов', 51: 'Изделие из одного материала', 52: 'Изделия из нескольких материалов',
    53: 'Изделия, содержащие жидкость', 60: 'Изделия из волокон', 71: 'Смесь твёрдых материалов',
    72: 'Смесь твёрдых материалов и изделий'
  };

  function groups(c) { return [c[0], c.slice(1, 3), c.slice(3, 6), c.slice(6, 8), c.slice(8, 10), c[10]]; }
  function pretty(c) { return groups(c).join(' '); }
  function codeHTML(c) { return groups(c).map(function (g) { return '<span>' + g + '</span>'; }).join(''); }
  function byCode(c) { return WASTE.filter(function (w) { return w.code === c; })[0]; }
  function icon(n) { return '<svg class="i" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function norm(s) { return s.toLowerCase().replace(/ё/g, 'е'); }

  /* Меню */
  var toggle = document.querySelector('.menu-toggle');
  var nav = $('nav');
  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    toggle.querySelector('use').setAttribute('href', open ? '#i-x' : '#i-list');
  }
  toggle.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
  nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') setMenu(false); });

  /* Появление при прокрутке */
  var targets = document.querySelectorAll('.reveal, .timeline');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach(function (t) { io.observe(t); });
  } else {
    targets.forEach(function (t) { t.classList.add('is-in'); });
  }

  /* Первый экран: по одному примеру на каждый класс */
  var heroCodes = ['73111001724', '40611001313', '92011001532', '47110101521'];
  var heroShort = ['Отходы из жилищ несортированные', 'Отходы минеральных масел моторных', 'Аккумуляторы свинцовые отработанные', 'Лампы ртутные, люминесцентные'];
  var heroI = 0;
  var heroCard = document.querySelector('.code-card');
  function paintHero() {
    var c = heroCodes[heroI];
    $('heroCode').innerHTML = codeHTML(c);
    $('heroName').innerHTML = heroShort[heroI] + '<br><b>' + ROMAN[c[10]] + ' класс опасности</b>';
  }
  paintHero();
  if (!reduceMotion) {
    setInterval(function () {
      if (document.hidden) return;
      heroCard.classList.add('is-swap');
      setTimeout(function () {
        heroI = (heroI + 1) % heroCodes.length;
        paintHero();
        heroCard.classList.remove('is-swap');
      }, 320);
    }, 3800);
  }

  /* Поиск и список кодов */
  var state = { q: '', cat: 'all', cls: '', active: '73111001724', list: [] };

  function matches() {
    var q = norm(state.q.trim());
    var digits = q.replace(/\D/g, '');
    var isCode = digits.length > 0 && /^[\d\s]+$/.test(q);
    return WASTE.filter(function (w) {
      if (state.cat !== 'all' && w.cat !== state.cat) return false;
      if (state.cls && w.cls !== state.cls) return false;
      if (!q) return true;
      return isCode ? w.code.indexOf(digits) === 0 : norm(w.name).indexOf(q) !== -1;
    });
  }

  function renderChips() {
    $('catChips').innerHTML = CATS.map(function (c) {
      return '<button class="chip" type="button" data-cat="' + c[0] + '" aria-pressed="' + (state.cat === c[0]) + '">' + c[1] + '</button>';
    }).join('');
    $('classChips').innerHTML = [1, 2, 3, 4].map(function (n) {
      return '<button class="chip" type="button" data-cls="' + n + '" aria-label="' + ROMAN[n] + ' класс" aria-pressed="' + (state.cls === String(n)) + '">' + ROMAN[n] + '</button>';
    }).join('');
  }

  function renderResults() {
    var found = matches();
    var box = $('fkkoResults');
    if (!found.length) {
      box.innerHTML = '<div class="results__empty"><p>В этой подборке такой позиции нет. <button class="link-btn" type="button" data-reset>Сбросить фильтры</button></p><p>Опишите отход в <a href="#quiz">заявке</a>, и мы подберём код по полному каталогу.</p></div>';
    } else {
      box.innerHTML = found.map(function (w) {
        var added = state.list.indexOf(w.code) !== -1;
        return '<div class="row' + (w.code === state.active ? ' is-active' : '') + '">' +
          '<button class="row__main" type="button" data-show="' + w.code + '"><span class="row__code">' + pretty(w.code) + '</span><span class="row__name">' + w.name + '</span></button>' +
          '<button class="row__add" type="button" data-toggle="' + w.code + '" aria-pressed="' + added + '" aria-label="' + (added ? 'Убрать из списка' : 'Добавить в список') + ': ' + pretty(w.code) + '">' + icon(added ? 'check' : 'plus') + '</button></div>';
      }).join('');
    }
    $('fkkoCount').textContent = found.length ? 'Показано позиций: ' + found.length : '';
    $('addAll').hidden = state.cat === 'all' || !found.length || found.every(function (w) { return state.list.indexOf(w.code) !== -1; });
  }

  function renderDecode() {
    var w = byCode(state.active);
    var c = w.code;
    $('decode').innerHTML = '<h3>' + w.name + '</h3><div class="code">' + codeHTML(c) + '</div><dl>' +
      '<div><dt>Блок ' + c[0] + '</dt><dd>' + BLOCK[c[0]] + '</dd></div>' +
      '<div><dt>' + c.slice(1, 8) + '</dt><dd>Происхождение и состав</dd></div>' +
      '<div><dt>' + c.slice(8, 10) + '</dt><dd>' + FORM[c.slice(8, 10)] + '</dd></div>' +
      '<div><dt>' + c[10] + '</dt><dd>' + ROMAN[c[10]] + ' класс, ' + CLASS_NAME[c[10]] + '</dd></div></dl>' +
      '<a class="decode__link" href="https://rpn.gov.ru/fkko/' + c + '/" target="_blank" rel="noopener">Карточка в каталоге' + icon('arrow-up-right') + '</a>';
  }

  function renderList() {
    $('listCount').textContent = state.list.length;
    $('listEmpty').hidden = state.list.length > 0;
    $('listActions').hidden = state.list.length === 0;
    $('myList').innerHTML = state.list.map(function (c) {
      return '<li title="' + byCode(c).name + '"><span>' + pretty(c) + '</span><button type="button" data-remove="' + c + '" aria-label="Удалить ' + pretty(c) + '">' + icon('trash') + '</button></li>';
    }).join('');
  }

  function toggleCode(c) {
    var i = state.list.indexOf(c);
    if (i === -1) state.list.push(c); else state.list.splice(i, 1);
    renderResults(); renderList();
  }
  function filterChanged() { renderChips(); renderResults(); }

  $('fkkoSearch').addEventListener('input', function (e) { state.q = e.target.value; renderResults(); });
  $('catChips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]');
    if (b) { state.cat = b.dataset.cat; filterChanged(); }
  });
  $('classChips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cls]');
    if (b) { state.cls = state.cls === b.dataset.cls ? '' : b.dataset.cls; filterChanged(); }
  });
  $('fkkoResults').addEventListener('click', function (e) {
    var t = e.target.closest('[data-toggle],[data-show],[data-reset]');
    if (!t) return;
    if (t.dataset.toggle) { state.active = t.dataset.toggle; toggleCode(t.dataset.toggle); renderDecode(); }
    else if (t.dataset.show) { state.active = t.dataset.show; renderResults(); renderDecode(); }
    else {
      state.q = ''; state.cat = 'all'; state.cls = '';
      $('fkkoSearch').value = '';
      filterChanged();
    }
  });
  $('myList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-remove]');
    if (b) toggleCode(b.dataset.remove);
  });
  $('addAll').addEventListener('click', function () {
    matches().forEach(function (w) { if (state.list.indexOf(w.code) === -1) state.list.push(w.code); });
    renderResults(); renderList();
  });
  $('copyList').addEventListener('click', function () {
    var label = this.querySelector('span');
    var text = state.list.map(function (c) { return pretty(c) + '\t' + byCode(c).name; }).join('\n');
    function done(msg) {
      label.textContent = msg;
      setTimeout(function () { label.textContent = 'Скопировать'; }, 1800);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done('Скопировано'); }, function () { done('Не удалось'); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      done(ok ? 'Скопировано' : 'Не удалось');
    }
  });

  document.querySelectorAll('[data-class]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.cls = b.dataset.class; state.cat = 'all'; state.q = '';
      $('fkkoSearch').value = '';
      filterChanged();
      var first = matches()[0];
      if (first) { state.active = first.code; renderResults(); renderDecode(); }
      $('fkko').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  renderChips(); renderResults(); renderDecode(); renderList();

  /* Квиз */
  var STEPS = [
    { id: 'task', type: 'radio', title: 'Какая задача сейчас?', opts: ['Получить новую лицензию', 'Добавить виды отходов в действующую', 'Внести изменения в реестр', 'Запускаю перевозки, нужен план'] },
    { id: 'waste', type: 'checkbox', title: 'Что планируете перевозить?', hint: 'Можно выбрать несколько вариантов.', opts: ['ТКО и уборка территорий', 'Жидкие отходы и ил', 'Строительные отходы', 'Отходы автопарка: масла, шины, фильтры', 'Ртутные лампы, аккумуляторы', 'Пока не знаю'], only: 'Пока не знаю' },
    { id: 'fleet', type: 'radio', title: 'Что с транспортом?', opts: ['Есть своя техника', 'Техника в аренде или лизинге', 'Транспорта пока нет'] },
    { id: 'ready', type: 'checkbox', title: 'Что у вас уже готово?', hint: 'Отметьте всё, что есть.', opts: ['Документы о квалификации работников', 'Санитарно-эпидемиологическое заключение', 'Список кодов ФККО', 'Пока ничего'], only: 'Пока ничего' }
  ];
  var total = STEPS.length + 1;
  var cur = 0;
  var form = $('quizForm');

  form.innerHTML =
    '<div class="steps" aria-hidden="true">' + new Array(total + 1).join('<i></i>') + '</div>' +
    '<p class="step-count" id="stepCount"></p>' +
    STEPS.map(function (s) {
      return '<fieldset data-step hidden><legend tabindex="-1">' + s.title + '</legend>' +
        (s.hint ? '<p class="hint">' + s.hint + '</p>' : '') +
        '<div class="opts">' + s.opts.map(function (o) {
          return '<label class="opt' + (s.type === 'radio' ? ' opt--radio' : '') + '"><input type="' + s.type + '" name="' + s.id + '" value="' + o + '"' + (s.only === o ? ' data-only' : '') + '><span class="opt__box">' + (s.type === 'radio' ? '' : icon('check')) + '</span><span>' + o + '</span></label>';
        }).join('') + '</div><p class="err" role="alert"></p></fieldset>';
    }).join('') +
    '<fieldset data-step hidden><legend tabindex="-1">Куда отправить расчёт?</legend>' +
      '<div class="form-group"><label for="qName">Имя</label><input class="input" id="qName" name="name" autocomplete="name" placeholder="Как к вам обращаться"><p class="err" role="alert"></p></div>' +
      '<div class="form-group"><label for="qPhone">Телефон</label><input class="input" id="qPhone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 123-45-67"><p class="err" role="alert"></p></div>' +
      '<input class="hp" type="text" name="company_site" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<p class="attached" id="attached" hidden></p>' +
      '<div class="form-group"><label class="consent"><input type="checkbox" id="qConsent" name="consent"><span>Согласен на обработку персональных данных для подготовки расчёта</span></label><p class="err" role="alert"></p></div>' +
    '</fieldset>' +
    '<div class="wizard__nav"><button class="btn btn--ghost" type="button" id="qBack">' + icon('arrow-left') + '<span>Назад</span></button>' +
    '<button class="btn btn--gold" type="submit" id="qNext"><span>Далее</span>' + icon('arrow-right') + '</button></div>';

  var sets = form.querySelectorAll('[data-step]');
  var ticks = form.querySelectorAll('.steps i');

  function showStep(n, focus) {
    cur = n;
    sets.forEach(function (f, i) {
      f.hidden = i !== n;
      f.classList.toggle('enter', i === n && !!focus);
    });
    ticks.forEach(function (t, i) { t.classList.toggle('on', i <= n); });
    $('stepCount').textContent = n < STEPS.length ? 'Вопрос ' + (n + 1) + ' из ' + STEPS.length : 'Последний шаг';
    $('qBack').hidden = n === 0;
    $('qNext').querySelector('span').textContent = n === total - 1 ? 'Получить расчёт' : 'Далее';
    $('qNext').querySelector('.i').style.display = n === total - 1 ? 'none' : '';
    if (n === total - 1) {
      var a = $('attached');
      a.hidden = state.list.length === 0;
      a.textContent = 'К заявке приложим ваш список кодов ФККО, позиций: ' + state.list.length + '.';
    }
    if (focus) sets[n].querySelector('legend').focus({ preventScroll: true });
  }

  /* Вариант «пока не знаю» исключает остальные */
  form.addEventListener('change', function (e) {
    var t = e.target;
    if (t.type !== 'checkbox' || t.id === 'qConsent' || !t.checked) return;
    form.querySelectorAll('input[name="' + t.name + '"]').forEach(function (o) {
      if (o !== t && (t.hasAttribute('data-only') || o.hasAttribute('data-only'))) o.checked = false;
    });
  });

  function setErr(el, msg) {
    var p = el.closest('.form-group').querySelector('.err');
    p.textContent = msg;
    if (el.classList.contains('input')) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }
  function phoneOk(v) {
    var d = v.replace(/\D/g, '');
    return d.length === 10 || (d.length === 11 && /^[78]/.test(d));
  }
  function validate() {
    if (cur < STEPS.length) {
      var chosen = form.querySelector('input[name="' + STEPS[cur].id + '"]:checked');
      sets[cur].querySelector('.err').textContent = chosen ? '' : 'Выберите вариант, чтобы продолжить.';
      return !!chosen;
    }
    var a = setErr($('qName'), $('qName').value.trim() ? '' : 'Укажите имя.');
    var b = setErr($('qPhone'), phoneOk($('qPhone').value) ? '' : 'Проверьте номер: нужно 10 цифр после кода страны.');
    var c = setErr($('qConsent'), $('qConsent').checked ? '' : 'Нужно ваше согласие, чтобы мы могли связаться.');
    return a && b && c;
  }

  function values(name) {
    return Array.prototype.map.call(form.querySelectorAll('input[name="' + name + '"]:checked'), function (i) { return i.value; });
  }
  function showResult(demo) {
    $('wizard').innerHTML = '<div class="result" tabindex="-1">' + icon('seal-check') +
      '<h3>Заявка принята</h3><p>Свяжемся с вами, уточним детали и подготовим расчёт.</p>' +
      (demo ? '<p class="demo">Демо-режим: заявка сформирована, но не отправлена. Укажите адрес обработчика в assets/js/main.js.</p>' : '') + '</div>';
    $('wizard').firstChild.focus({ preventScroll: true });
  }
  function submit() {
    if (form.elements.company_site.value) return; /* скрытое поле заполняют только боты */
    var btn = $('qNext');
    var label = btn.querySelector('span');
    var payload = {
      task: values('task'), waste: values('waste'), fleet: values('fleet'), ready: values('ready'),
      name: $('qName').value.trim(), phone: $('qPhone').value.trim(),
      codes: state.list.map(function (c) { return { code: pretty(c), name: byCode(c).name }; })
    };
    if (!CONFIG.endpoint) { showResult(true); return; }
    btn.disabled = true; label.textContent = 'Отправляем…';
    fetch(CONFIG.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); showResult(false); })
      .catch(function () {
        btn.disabled = false; label.textContent = 'Отправить ещё раз';
        setErr($('qConsent'), 'Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.');
      });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;
    if (cur === total - 1) submit(); else showStep(cur + 1, true);
  });
  $('qBack').addEventListener('click', function () { showStep(cur - 1, true); });
  showStep(0, false);
})();
