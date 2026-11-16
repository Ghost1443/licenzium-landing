(function () {
  'use strict';

  /* Адрес обработчика заявок берётся из <meta name="lead-endpoint"> в index.html.
     Пока он пустой, формы работают в демо-режиме и заявки никуда не уходят. */
  var endpointMeta = document.querySelector('meta[name="lead-endpoint"]');
  var CONFIG = { endpoint: endpointMeta ? endpointMeta.content.trim() : '' };

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

  /* Квиз: один и тот же квиз работает на странице и во всплывающем окне */
  var STEPS = [
    { id: 'task', type: 'radio', title: 'Какая задача сейчас?', opts: ['Получить новую лицензию', 'Добавить виды отходов в действующую', 'Внести изменения в реестр', 'Запускаю перевозки, нужен план'] },
    { id: 'waste', type: 'checkbox', title: 'Что планируете перевозить?', hint: 'Можно выбрать несколько вариантов.', opts: ['ТКО и уборка территорий', 'Жидкие отходы и ил', 'Строительные отходы', 'Отходы автопарка: масла, шины, фильтры', 'Ртутные лампы, аккумуляторы', 'Пока не знаю'], only: 'Пока не знаю' },
    { id: 'fleet', type: 'radio', title: 'Что с транспортом?', opts: ['Есть своя техника', 'Техника в аренде или лизинге', 'Транспорта пока нет'] },
    { id: 'ready', type: 'checkbox', title: 'Что у вас уже готово?', hint: 'Отметьте всё, что есть.', opts: ['Документы о квалификации работников', 'Санитарно-эпидемиологическое заключение', 'Список кодов ФККО', 'Пока ничего'], only: 'Пока ничего' }
  ];
  var TOTAL = STEPS.length + 1;

  function phoneOk(v) {
    var d = v.replace(/\D/g, '');
    return d.length === 10 || (d.length === 11 && /^[78]/.test(d));
  }
  function setErr(el, msg) {
    var p = el.closest('.form-group').querySelector('.err');
    p.textContent = msg;
    if (el.classList.contains('input')) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }
  function checkContacts(form) {
    var a = setErr(form.elements.name, form.elements.name.value.trim() ? '' : 'Укажите имя.');
    var b = setErr(form.elements.phone, phoneOk(form.elements.phone.value) ? '' : 'Проверьте номер: нужно 10 цифр после кода страны.');
    var c = setErr(form.elements.consent, form.elements.consent.checked ? '' : 'Нужно ваше согласие, чтобы мы могли связаться.');
    return a && b && c;
  }
  function resultHTML(title, text, demo) {
    return '<div class="result-msg" tabindex="-1">' + icon('seal-check') + '<h3>' + title + '</h3><p>' + text + '</p>' +
      (demo ? '<p class="demo">Демо-режим: заявка сформирована, но не отправлена. Укажите адрес обработчика в meta lead-endpoint в index.html.</p>' : '') + '</div>';
  }
  /* Отправка заявки. Пока CONFIG.endpoint пустой, сразу показываем демо-ответ. */
  function send(payload, btn, label, errTarget, onDone) {
    if (!CONFIG.endpoint) { onDone(true); return; }
    var old = label.textContent;
    btn.disabled = true; label.textContent = 'Отправляем…';
    fetch(CONFIG.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ page: location.href }, payload)) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); onDone(false); })
      .catch(function () {
        btn.disabled = false; label.textContent = old;
        setErr(errTarget, 'Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.');
      });
  }

  var quizCount = 0;
  function createQuiz(root) {
    var uid = 'q' + (++quizCount);
    var cur = 0, done = false, form;

    function render() {
      done = false; cur = 0;
      root.innerHTML = '<form novalidate>' +
        '<div class="steps" aria-hidden="true">' + new Array(TOTAL + 1).join('<i></i>') + '</div>' +
        '<p class="step-count"></p>' +
        STEPS.map(function (s) {
          return '<fieldset data-step hidden><legend tabindex="-1">' + s.title + '</legend>' +
            (s.hint ? '<p class="hint">' + s.hint + '</p>' : '') +
            '<div class="opts">' + s.opts.map(function (o) {
              return '<label class="opt' + (s.type === 'radio' ? ' opt--radio' : '') + '"><input type="' + s.type + '" name="' + s.id + '" value="' + o + '"' + (s.only === o ? ' data-only' : '') + '><span class="opt__box">' + (s.type === 'radio' ? '' : icon('check')) + '</span><span>' + o + '</span></label>';
            }).join('') + '</div><p class="err" role="alert"></p></fieldset>';
        }).join('') +
        '<fieldset data-step hidden><legend tabindex="-1">Куда отправить расчёт?</legend>' +
          '<div class="form-group"><label for="' + uid + 'n">Имя</label><input class="input" id="' + uid + 'n" name="name" autocomplete="name" placeholder="Как к вам обращаться"><p class="err" role="alert"></p></div>' +
          '<div class="form-group"><label for="' + uid + 'p">Телефон</label><input class="input" id="' + uid + 'p" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 123-45-67"><p class="err" role="alert"></p></div>' +
          '<input class="hp" type="text" name="company_site" tabindex="-1" autocomplete="off" aria-hidden="true">' +
          '<p class="attached" hidden></p>' +
          '<div class="form-group"><label class="consent"><input type="checkbox" name="consent"><span>Согласен на обработку персональных данных для подготовки расчёта</span></label><p class="err" role="alert"></p></div>' +
        '</fieldset>' +
        '<div class="wizard__nav"><button class="btn btn--ghost" type="button" data-back>' + icon('arrow-left') + '<span>Назад</span></button>' +
        '<button class="btn btn--gold" type="submit" data-next><span>Далее</span>' + icon('arrow-right') + '</button></div></form>';
      form = root.querySelector('form');
      form.addEventListener('change', onChange);
      form.addEventListener('submit', onSubmit);
      form.querySelector('[data-back]').addEventListener('click', function () { show(cur - 1, true); });
      show(0, false);
    }

    function show(n, focus) {
      cur = n;
      var sets = form.querySelectorAll('[data-step]');
      var next = form.querySelector('[data-next]');
      sets.forEach(function (f, i) { f.hidden = i !== n; f.classList.toggle('enter', i === n && !!focus); });
      form.querySelectorAll('.steps i').forEach(function (t, i) { t.classList.toggle('on', i <= n); });
      form.querySelector('.step-count').textContent = n < STEPS.length ? 'Вопрос ' + (n + 1) + ' из ' + STEPS.length : 'Последний шаг';
      form.querySelector('[data-back]').hidden = n === 0;
      next.querySelector('span').textContent = n === TOTAL - 1 ? 'Получить расчёт' : 'Далее';
      next.querySelector('.i').style.display = n === TOTAL - 1 ? 'none' : '';
      if (n === TOTAL - 1) {
        var a = form.querySelector('.attached');
        a.hidden = state.list.length === 0;
        a.textContent = 'К заявке приложим ваш список кодов ФККО, позиций: ' + state.list.length + '.';
      }
      if (focus) sets[n].querySelector('legend').focus({ preventScroll: true });
    }

    /* Вариант «пока не знаю» исключает остальные */
    function onChange(e) {
      var t = e.target;
      if (t.type !== 'checkbox' || t.name === 'consent' || !t.checked) return;
      form.querySelectorAll('input[name="' + t.name + '"]').forEach(function (o) {
        if (o !== t && (t.hasAttribute('data-only') || o.hasAttribute('data-only'))) o.checked = false;
      });
    }

    function values(name) {
      return Array.prototype.map.call(form.querySelectorAll('input[name="' + name + '"]:checked'), function (i) { return i.value; });
    }

    function onSubmit(e) {
      e.preventDefault();
      if (cur < STEPS.length) {
        var chosen = form.querySelector('input[name="' + STEPS[cur].id + '"]:checked');
        form.querySelectorAll('[data-step]')[cur].querySelector('.err').textContent = chosen ? '' : 'Выберите вариант, чтобы продолжить.';
        if (chosen) show(cur + 1, true);
        return;
      }
      if (!checkContacts(form) || form.elements.company_site.value) return;
      var btn = form.querySelector('[data-next]');
      send({
        type: 'quiz', task: values('task'), waste: values('waste'), fleet: values('fleet'), ready: values('ready'),
        name: form.elements.name.value.trim(), phone: form.elements.phone.value.trim(),
        codes: state.list.map(function (c) { return { code: pretty(c), name: byCode(c).name }; })
      }, btn, btn.querySelector('span'), form.elements.consent, function (demo) {
        done = true;
        root.innerHTML = resultHTML('Заявка принята', 'Свяжемся с вами, уточним детали и подготовим расчёт.', demo);
        root.firstChild.focus({ preventScroll: true });
      });
    }

    render();
    return { reset: function () { if (done) render(); } };
  }

  var quizzes = [];
  document.querySelectorAll('[data-quiz]').forEach(function (el) { quizzes.push({ el: el, q: createQuiz(el) }); });

  /* Всплывающие окна */
  var callBody = $('callBody');
  var callTemplate = callBody.innerHTML;
  function bindCall() {
    var form = $('callForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!checkContacts(form) || form.elements.company_site.value) return;
      var btn = form.querySelector('button[type="submit"]');
      send({ type: 'callback', topic: $('callTitle').textContent, name: form.elements.name.value.trim(), phone: form.elements.phone.value.trim() },
        btn, $('callSubmit'), form.elements.consent, function (demo) {
          callBody.innerHTML = resultHTML('Спасибо, заявка принята', 'Перезвоним вам в течение нескольких минут.', demo);
          callBody.firstChild.focus({ preventScroll: true });
        });
    });
  }
  bindCall();

  function openModal(kind, trigger) {
    var dlg = $(kind === 'call' ? 'callModal' : 'quizModal');
    if (typeof dlg.showModal !== 'function') {
      $(kind === 'call' ? 'contacts' : 'quiz').scrollIntoView();
      return;
    }
    if (kind === 'call') {
      callBody.innerHTML = callTemplate;
      bindCall();
      var title = (trigger && trigger.dataset.callTitle) || 'Заказать звонок';
      $('callTitle').textContent = title;
      $('callSubmit').textContent = title;
    } else {
      quizzes.forEach(function (x) { if (dlg.contains(x.el)) x.q.reset(); });
    }
    setMenu(false);
    dlg.showModal();
    document.documentElement.classList.add('modal-open');
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-open]');
    if (t) { e.preventDefault(); openModal(t.dataset.open, t); }
  });
  document.querySelectorAll('dialog.modal').forEach(function (dlg) {
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    });
    dlg.addEventListener('close', function () { document.documentElement.classList.remove('modal-open'); });
  });
})();
