/* Mimi, die Museumsmaus – Adventskalender des Melihus
   Reines JavaScript, keine externen Bibliotheken, keine Cookies, kein Tracking. */
(function () {
  'use strict';

  var ZEITZONE = 'Europe/Zurich';
  var PLATZHALTER = 'bilder/platzhalter.svg';
  var raster = document.getElementById('raster');
  var statusEl = document.getElementById('status');
  var testEl = document.getElementById('testmodus');
  var dialog = document.getElementById('film-dialog');
  var dlgFolge = document.getElementById('film-folge');
  var dlgTitel = document.getElementById('film-titel');
  var buehne = document.getElementById('film-buehne');
  var hinweis = document.getElementById('film-hinweis');
  var schliessen = document.getElementById('film-schliessen');
  var letzterAusloeser = null;

  /* ---------- Datum: echtes Datum in Zürich oder Testdatum aus ?datum=JJJJ-MM-TT ---------- */
  function heuteInZuerich() {
    // en-CA liefert das Format JJJJ-MM-TT
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: ZEITZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
  }

  function gueltigesDatum(text) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text || '')) return false;
    var d = new Date(text + 'T12:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === text;
  }

  var testDatum = new URLSearchParams(window.location.search).get('datum');
  var heute = gueltigesDatum(testDatum) ? testDatum : heuteInZuerich();
  if (gueltigesDatum(testDatum)) {
    var t = testDatum.split('-');
    testEl.textContent = 'Testmodus: Der Kalender tut so, als wäre heute der ' + Number(t[2]) + '.' + Number(t[1]) + '.' + t[0] + '.';
    testEl.hidden = false;
  }

  function tagText(datum) {
    var teile = datum.split('-');
    var monate = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    return Number(teile[2]) + '. ' + monate[Number(teile[1]) - 1];
  }

  /* ---------- Hilfsfunktionen ---------- */
  function el(tag, klasse, text) {
    var e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (text) e.textContent = text;
    return e;
  }

  function bild(folge, klasse) {
    var img = el('img', klasse);
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = folge.vorschaubild || PLATZHALTER;
    img.addEventListener('error', function () {
      if (img.src.indexOf(PLATZHALTER) === -1) img.src = PLATZHALTER;
    });
    return img;
  }

  function youtubeId(folge) {
    var id = (folge.youtube || '').trim();
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
  }

  /* ---------- Kalender aufbauen ---------- */
  function aufbauen(folgen) {
    raster.textContent = '';
    folgen.forEach(function (folge) {
      var offen = folge.datum <= heute;
      var klasse = folge.datum < heute ? ' ist-offen' : (offen ? ' ist-heute' : ' ist-zu');
      var li = el('li', 'tuerchen' + klasse);
      var knopf = el('button', 'tuerchen-knopf');
      knopf.type = 'button';
      knopf.setAttribute('aria-label', offen
        ? 'Türchen ' + folge.nummer + ': ' + folge.titel + '. Film ansehen.'
        : 'Türchen ' + folge.nummer + ', noch zu. Es öffnet sich am ' + tagText(folge.datum) + '.');

      var innen = el('span', 'tuerchen-innen');
      if (offen) {
        innen.appendChild(bild(folge, 'tuerchen-bild'));
        innen.appendChild(el('span', 'tuerchen-titel', folge.titel));
        var nr = el('span', 'tuerchen-nr', String(folge.nummer));
        nr.setAttribute('aria-hidden', 'true');
        innen.appendChild(nr);
      }
      var tuer = el('span', 'tuerchen-tuer');
      tuer.setAttribute('aria-hidden', 'true');
      tuer.appendChild(el('span', 'tuerchen-zahl', String(folge.nummer)));
      tuer.appendChild(el('span', 'tuerchen-knauf'));

      knopf.appendChild(innen);
      knopf.appendChild(tuer);
      knopf.addEventListener('click', function () {
        letzterAusloeser = knopf;
        if (offen) {
          var ersteMal = !li.classList.contains('ist-offen');
          li.classList.add('ist-offen');
          var ruhig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          // beim ersten Öffnen kurz warten, damit man das Türchen aufgehen sieht
          window.setTimeout(function () { zeigeFilm(folge); }, ersteMal && !ruhig ? 650 : 0);
        } else {
          zeigeGesperrt(folge);
        }
      });
      li.appendChild(knopf);
      raster.appendChild(li);
    });
    statusEl.textContent = '';
    statusEl.hidden = true;
  }

  /* ---------- Dialog ---------- */
  function dialogOeffnen() {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    schliessen.focus();
  }

  function dialogLeeren() {
    buehne.textContent = '';     // entfernt auch einen laufenden YouTube-Player oder ein Video
    hinweis.hidden = true;
  }

  function zeigeGesperrt(folge) {
    dialogLeeren();
    dlgFolge.textContent = 'Türchen ' + folge.nummer;
    dlgTitel.textContent = 'Noch ein bisschen Geduld!';
    var p = el('p', 'film-nachricht', 'Dieses Türchen öffnet sich am ' + tagText(folge.datum) + '.');
    buehne.appendChild(p);
    dialogOeffnen();
  }

  function zeigeFilm(folge) {
    dialogLeeren();
    dlgFolge.textContent = 'Türchen ' + folge.nummer + ' · ' + tagText(folge.datum);
    dlgTitel.textContent = folge.titel;

    var videoPfad = (folge.video || '').trim();
    var id = youtubeId(folge);

    if (videoPfad) {
      // Eigenes Video von der Melihus-Seite
      var v = document.createElement('video');
      v.className = 'film-video';
      v.controls = true;
      v.setAttribute('playsinline', '');
      v.preload = 'none';
      v.poster = PLATZHALTER;
      if (folge.vorschaubild) {
        var probe = new Image();
        probe.onload = function () { v.poster = folge.vorschaubild; };
        probe.src = folge.vorschaubild;
      }
      v.src = videoPfad;
      v.setAttribute('aria-label', 'Film: ' + folge.titel);
      v.addEventListener('error', function () { bald(); });
      buehne.appendChild(v);
    } else if (id) {
      // YouTube erst nach Klick laden – vorher keine Verbindung zu YouTube
      var platz = el('div', 'film-platzhalter');
      platz.appendChild(bild(folge, 'film-vorschau'));
      var start = el('button', 'film-start');
      start.type = 'button';
      start.appendChild(el('span', 'film-start-symbol'));
      start.appendChild(el('span', '', 'Film abspielen'));
      start.addEventListener('click', function () {
        var f = document.createElement('iframe');
        f.className = 'film-frame';
        f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&playsinline=1&autoplay=1&modestbranding=1';
        f.title = 'Film: ' + folge.titel;
        f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        f.setAttribute('allowfullscreen', '');
        f.referrerPolicy = 'strict-origin-when-cross-origin';
        buehne.textContent = '';
        buehne.appendChild(f);
        f.focus();
      });
      platz.appendChild(start);
      buehne.appendChild(platz);
      hinweis.hidden = false;
    } else {
      bald();
    }
    dialogOeffnen();

    function bald() {
      buehne.textContent = '';
      var box = el('div', 'film-platzhalter film-bald');
      box.appendChild(bild(folge, 'film-vorschau'));
      box.appendChild(el('p', 'film-nachricht', 'Dieser Film kommt bald.'));
      buehne.appendChild(box);
      hinweis.hidden = true;
    }
  }

  function dialogZu() {
    dialogLeeren();
    if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
    }
  }

  schliessen.addEventListener('click', dialogZu);
  dialog.addEventListener('close', function () {
    dialogLeeren();
    if (letzterAusloeser) letzterAusloeser.focus();
  });
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) dialogZu();   // Klick neben das Fenster schliesst es
  });

  /* ---------- Daten laden ---------- */
  fetch('kalender.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (daten) {
      var folgen = (daten.folgen || []).slice().sort(function (a, b) { return a.nummer - b.nummer; });
      if (!folgen.length) throw new Error('leer');
      // Testschalter in kalender.json: "alleOffen": true öffnet alle Türchen (vor der Veröffentlichung auf false setzen)
      if (daten.alleOffen === true && !gueltigesDatum(testDatum)) {
        heute = '2026-12-31';
        testEl.textContent = 'Testmodus: Alle Türchen sind zum Ausprobieren freigeschaltet.';
        testEl.hidden = false;
      }
      aufbauen(folgen);
    })
    .catch(function () {
      statusEl.textContent = 'Der Adventskalender konnte gerade nicht geladen werden. Bitte versuche es später noch einmal.';
    });
})();
