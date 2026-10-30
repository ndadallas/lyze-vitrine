/* Espace propriétaire — démo sans serveur : données fictives en mémoire. */
(function () {
  'use strict';

  var img = function (id, w) { return 'https://images.unsplash.com/photo-' + id + '?w=' + (w || 400) + '&q=80&auto=format&fit=crop'; };

  /* Dates "du" et "au" incluses (comme sur la maquette : 12 → 16 nov.) */
  var BIENS = [
    {
      id: 'villa', nom: 'Villa [Nom]', ville: 'Marrakech',
      photos: ['1708804654353-7ef66cba7776', '1565020244281-fe53df7df170', '1628642393776-70a715f2cc40', '1527760370098-806667fa3750', '1505576391880-b3f9d713dc4f', '1628642004970-1da51c8c7dec'],
      resas: [
        { client: 'Inès Haddad', du: '2026-10-08', au: '2026-10-12', voyageurs: 5, source: 'Booking' },
        { client: 'Youssef Bennani', du: '2026-11-03', au: '2026-11-07', voyageurs: 2, source: 'Booking' },
        { client: 'Sophie Martin', du: '2026-11-12', au: '2026-11-16', voyageurs: 4, source: 'Airbnb' },
        { client: 'Claire Dubois', du: '2026-11-21', au: '2026-11-25', voyageurs: 3, source: 'Direct' },
        { client: 'Thomas Leroy', du: '2026-11-28', au: '2026-12-02', voyageurs: 2, source: 'Booking' },
        { client: 'Karim Alaoui', du: '2026-12-18', au: '2026-12-27', voyageurs: 6, source: 'Airbnb' }
      ]
    },
    {
      id: 'appart', nom: 'Appart. [Nom]', ville: 'Casablanca',
      photos: ['1565020244281-fe53df7df170', '1527760370098-806667fa3750', '1505577058444-a3dab90d4253', '1635183094389-044b97f7c51c'],
      resas: [
        { client: 'Nadia El Fassi', du: '2026-11-09', au: '2026-11-13', voyageurs: 2, source: 'Direct' },
        { client: 'Marc Petit', du: '2026-11-19', au: '2026-11-22', voyageurs: 3, source: 'Booking' },
        { client: 'Julie Moreau', du: '2026-12-05', au: '2026-12-09', voyageurs: 2, source: 'Airbnb' }
      ]
    },
    {
      id: 'riad', nom: 'Riad [Nom]', ville: 'El Jadida',
      photos: ['1628642393776-70a715f2cc40', '1628642004970-1da51c8c7dec', '1527769668487-5804e45fed2a'],
      resas: [
        { client: 'Leïla Benjelloun', du: '2026-11-25', au: '2026-11-29', voyageurs: 4, source: 'Airbnb' }
      ]
    }
  ];

  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var JOUR = 86400000;

  var etat = { bien: BIENS[0], an: 2026, mois: 10, resa: null }; // novembre 2026
  etat.resa = etat.bien.resas[2];

  var $ = function (s) { return document.querySelector(s); };
  var date = function (iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var nuits = function (r) { return Math.round((date(r.au) - date(r.du)) / JOUR); };
  var abrege = function (nom) { var p = nom.split(' '); return p[0][0] + '. ' + p.slice(1).join(' '); };
  var court = function (d) { return d.getDate() + ' ' + MOIS_COURT[d.getMonth()]; };
  var capital = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };

  function resaDuJour(bien, d) {
    for (var i = 0; i < bien.resas.length; i++) {
      var r = bien.resas[i];
      if (d >= date(r.du) && d <= date(r.au)) return r;
    }
    return null;
  }

  /* Statut "aujourd'hui", figé au 14 novembre 2026 pour la démo */
  var AUJOURDHUI = new Date(2026, 10, 14);
  function statut(bien) {
    if (resaDuJour(bien, AUJOURDHUI)) return 'Occupé';
    var aVenir = bien.resas.some(function (r) { return date(r.du) > AUJOURDHUI && date(r.du) - AUJOURDHUI < 10 * JOUR; });
    return aVenir ? 'Réservé' : 'Libre';
  }

  function rendreListe() {
    var ul = $('[data-liste-biens]');
    ul.innerHTML = '';
    BIENS.forEach(function (b) {
      var li = document.createElement('li');
      var bt = document.createElement('button');
      bt.type = 'button';
      bt.setAttribute('aria-pressed', b === etat.bien ? 'true' : 'false');
      bt.innerHTML = '<img src="' + img(b.photos[0], 120) + '" alt=""><span><strong></strong><small></small></span><span class="statut"></span>';
      bt.querySelector('strong').textContent = b.nom;
      bt.querySelector('small').textContent = b.ville;
      bt.querySelector('.statut').textContent = statut(b);
      bt.addEventListener('click', function () { choisirBien(b); });
      li.appendChild(bt);
      ul.appendChild(li);
    });

    var sel = $('[data-filtre-bien]');
    if (!sel.options.length) {
      BIENS.forEach(function (b) { sel.add(new Option(b.nom + ' — ' + b.ville, b.id)); });
      sel.addEventListener('change', function () {
        choisirBien(BIENS.filter(function (b) { return b.id === sel.value; })[0]);
      });
    }
    sel.value = etat.bien.id;
  }

  function choisirBien(b) {
    etat.bien = b;
    var debut = new Date(etat.an, etat.mois, 1), fin = new Date(etat.an, etat.mois + 1, 0);
    etat.resa = b.resas.filter(function (r) { return date(r.au) >= debut && date(r.du) <= fin; })[0] || null;
    rendreTout();
    rendrePhotos();
  }

  function rendreCalendrier() {
    var an = etat.an, m = etat.mois;
    $('[data-mois-titre]').textContent = capital(MOIS[m]) + ' ' + an;
    var box = $('[data-jours]');
    box.innerHTML = '';
    var decalage = (new Date(an, m, 1).getDay() + 6) % 7;
    var nb = new Date(an, m + 1, 0).getDate();
    for (var i = 0; i < decalage; i++) {
      var v = document.createElement('div');
      v.className = 'jour vide';
      box.appendChild(v);
    }
    for (var d = 1; d <= nb; d++) {
      var jour = new Date(an, m, d);
      var r = resaDuJour(etat.bien, jour);
      var el = document.createElement(r ? 'button' : 'div');
      el.className = 'jour';
      el.textContent = d;
      if (r) {
        el.type = 'button';
        var choisie = r === etat.resa;
        el.classList.add(choisie ? 'reserve' : 'loue');
        el.setAttribute('aria-label', d + ' ' + MOIS[m] + ' : réservé par ' + r.client);
        if (choisie) {
          el.insertAdjacentHTML('beforeend', '<svg class="coche" aria-hidden="true"><use href="#i-coche"/></svg>');
        }
        if (d === 1 || +jour === +date(r.du)) {
          var et = document.createElement('span');
          et.className = 'etiquette';
          et.textContent = choisie ? abrege(r.client) : 'Complet';
          el.appendChild(et);
        }
        el.addEventListener('click', (function (resa) {
          return function () { etat.resa = resa; rendreCalendrier(); rendreDetail(); };
        })(r));
      }
      box.appendChild(el);
    }
  }

  function rendreDetail() {
    var box = $('[data-detail]');
    var r = etat.resa;
    if (!r) {
      box.innerHTML = '<span class="titre-p">Réservation sélectionnée</span><p class="vide-msg">Aucune réservation ce mois-ci pour ce bien. Cliquez sur un jour loué pour voir son détail.</p>';
      return;
    }
    var du = date(r.du), au = date(r.au);
    box.innerHTML =
      '<span class="titre-p">Réservation sélectionnée</span>' +
      '<h2></h2>' +
      '<dl>' +
      '<div><dt>Séjour</dt><dd>' + court(du) + ' → ' + court(au) + ' (' + nuits(r) + ' nuits)</dd></div>' +
      '<div><dt>Voyageurs</dt><dd>' + r.voyageurs + '</dd></div>' +
      '<div><dt>Source</dt><dd>' + r.source + '</dd></div>' +
      '<div><dt>Montant</dt><dd>[montant] MAD</dd></div>' +
      '<div><dt>Statut</dt><dd class="ok">Réservé <svg width="14" height="14" aria-hidden="true"><use href="#i-coche"/></svg></dd></div>' +
      '</dl>' +
      '<div class="synchro">Synchronisé avec Airbnb et Booking<small>il y a 5 min</small></div>';
    box.querySelector('h2').textContent = r.client;
  }

  function rendreStats() {
    var an = etat.an, m = etat.mois, nb = new Date(an, m + 1, 0).getDate(), pris = 0;
    for (var d = 1; d <= nb; d++) if (resaDuJour(etat.bien, new Date(an, m, d))) pris++;
    $('[data-stats]').innerHTML =
      '<span class="titre-p">' + capital(MOIS[m]) + ' ' + an + '</span>' +
      '<div><span>Taux d’occupation</span><strong>' + Math.round(pris / nb * 100) + ' %</strong></div>' +
      '<div><span>Nuits réservées</span><strong>' + pris + '</strong></div>' +
      '<div><span>Revenus du mois</span><strong>[montant] MAD</strong></div>';
  }

  function rendreTout() {
    rendreListe();
    rendreCalendrier();
    rendreDetail();
    rendreStats();
  }

  document.querySelectorAll('[data-mois]').forEach(function (b) {
    b.addEventListener('click', function () {
      etat.mois += +b.dataset.mois;
      if (etat.mois < 0) { etat.mois = 11; etat.an--; }
      if (etat.mois > 11) { etat.mois = 0; etat.an++; }
      choisirBien(etat.bien);
    });
  });

  /* Photos : dépôt (aperçu local, rien n'est envoyé) et réordonnancement par glisser */
  var photosParBien = {};
  BIENS.forEach(function (b) { photosParBien[b.id] = b.photos.map(function (id) { return img(id, 500); }); });
  var vignettes = $('[data-vignettes]');
  var enDeplacement = null;

  function rendrePhotos() {
    var liste = photosParBien[etat.bien.id];
    vignettes.innerHTML = '';
    liste.forEach(function (src, i) {
      var v = document.createElement('div');
      v.className = 'vignette';
      v.draggable = true;
      v.innerHTML = '<img alt="">' + (i === 0 ? '<span class="badge">Couverture</span>' : '');
      v.querySelector('img').src = src;
      v.addEventListener('dragstart', function (e) {
        enDeplacement = i;
        v.classList.add('deplace');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(i));
      });
      v.addEventListener('dragend', function () { v.classList.remove('deplace'); enDeplacement = null; });
      v.addEventListener('dragover', function (e) { if (enDeplacement !== null) e.preventDefault(); });
      v.addEventListener('drop', function (e) {
        if (enDeplacement === null) return;
        e.preventDefault();
        var deplacee = liste.splice(enDeplacement, 1)[0];
        liste.splice(i, 0, deplacee);
        rendrePhotos();
      });
      vignettes.appendChild(v);
    });
  }

  function ajouterFichiers(fichiers) {
    Array.prototype.forEach.call(fichiers, function (f) {
      if (f.type.indexOf('image/') === 0 && f.size <= 10 * 1024 * 1024) {
        photosParBien[etat.bien.id].push(URL.createObjectURL(f));
      }
    });
    rendrePhotos();
  }

  var depot = $('[data-depot]');
  var input = $('[data-fichiers]');
  input.addEventListener('change', function () { ajouterFichiers(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(function (t) {
    depot.addEventListener(t, function (e) { if (enDeplacement === null) { e.preventDefault(); depot.classList.add('survol'); } });
  });
  ['dragleave', 'drop'].forEach(function (t) {
    depot.addEventListener(t, function () { depot.classList.remove('survol'); });
  });
  depot.addEventListener('drop', function (e) {
    if (enDeplacement !== null) return;
    e.preventDefault();
    ajouterFichiers(e.dataTransfer.files);
  });

  rendreTout();
  rendrePhotos();
})();
