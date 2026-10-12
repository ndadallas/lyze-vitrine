/* Lyze — vitrine V1 : comportements communs à toutes les pages. */
(function () {
  'use strict';

  var reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Menu mobile */
  var menu = document.getElementById('menu');
  document.querySelectorAll('[data-ouvre-menu]').forEach(function (b) {
    b.addEventListener('click', function () {
      menu.hidden = false;
      document.body.style.overflow = 'hidden';
      menu.querySelector('a').focus();
    });
  });
  function fermerMenu() {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    document.body.style.overflow = '';
  }
  if (menu) {
    menu.querySelector('[data-ferme-menu]').addEventListener('click', fermerMenu);
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', fermerMenu); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermerMenu(); });
  }

  /* Accueil : la barre compacte descend quand le grand en-tête sort de l'écran */
  var flottante = document.querySelector('.bar--flottante');
  var masthead = document.querySelector('.masthead');
  if (flottante && masthead && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      flottante.classList.toggle('est-visible', !e[0].isIntersecting);
    }).observe(masthead);
  }

  /* Apparitions au défilement + encre des lettrines */
  var aVoir = document.querySelectorAll('[data-apparait], [data-encre]');
  if ('IntersectionObserver' in window && !reduit) {
    /* Une lettrine masquée par son clip-path n'est jamais vue comme "visible" par
       l'observer : on observe donc son bloc parent et on la révèle avec lui. */
    var cibles = new Map();
    aVoir.forEach(function (el) {
      var observe = el.hasAttribute('data-encre') ? el.parentElement : el;
      if (!cibles.has(observe)) cibles.set(observe, []);
      cibles.get(observe).push(el);
    });
    var io = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (en) {
        if (!en.isIntersecting) return;
        cibles.get(en.target).forEach(function (el) { el.classList.add('vu'); });
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    cibles.forEach(function (_, observe) { io.observe(observe); });
  } else {
    aVoir.forEach(function (el) { el.classList.add('vu'); });
  }

  /* "SÉJOURS" glisse doucement pendant le défilement */
  var mots = document.querySelectorAll('[data-glisse]');
  if (mots.length && !reduit) {
    var section = mots[0].closest('section');
    var tic = false;
    var glisse = function () {
      tic = false;
      var r = section.getBoundingClientRect();
      var p = (window.innerHeight - r.top) / (window.innerHeight + r.height); // 0 → 1 pendant la traversée
      p = Math.min(1, Math.max(0, p));
      var x = (p - .5) * -8; // en %
      mots.forEach(function (m) { m.style.transform = 'translateX(' + x.toFixed(2) + '%)'; });
    };
    window.addEventListener('scroll', function () { if (!tic) { tic = true; requestAnimationFrame(glisse); } }, { passive: true });
    glisse();
  }

  /* Calendriers de disponibilité (fiche bien) */
  var MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  document.querySelectorAll('[data-calendrier]').forEach(function (el) {
    var parts = el.dataset.calendrier.split('-');
    var an = +parts[0], m = +parts[1] - 1;
    var pris = (el.dataset.pris || '').split(',').map(Number);
    var decalage = (new Date(an, m, 1).getDay() + 6) % 7; // lundi = 0
    var nbJours = new Date(an, m + 1, 0).getDate();
    var html = '<h3>' + MOIS[m] + ' ' + an + '</h3><div class="jours">';
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(function (j) { html += '<span class="entete">' + j + '</span>'; });
    for (var i = 0; i < decalage; i++) html += '<span aria-hidden="true"></span>';
    for (var d = 1; d <= nbJours; d++) {
      var estPris = pris.indexOf(d) > -1;
      html += '<span' + (estPris ? ' class="pris" title="Indisponible"' : '') + '>' + d + '</span>';
    }
    el.innerHTML = html + '</div>';
  });

  /* Barre de réservation (démo) : on emmène vers les biens */
  var resa = document.querySelector('[data-resa]');
  if (resa) {
    resa.addEventListener('submit', function (e) {
      e.preventDefault();
      document.getElementById('biens').scrollIntoView({ behavior: reduit ? 'auto' : 'smooth' });
    });
  }

  /* Livret : le sélecteur change le nom du bien affiché */
  var choixBien = document.querySelector('[data-choix-bien]');
  if (choixBien) {
    choixBien.addEventListener('change', function () {
      document.querySelectorAll('[data-nom-bien]').forEach(function (n) { n.textContent = choixBien.value; });
    });
  }

  /* Connexion (démo) : n'importe quels identifiants ouvrent l'espace */
  var connexion = document.querySelector('[data-connexion]');
  if (connexion) {
    connexion.addEventListener('submit', function (e) {
      e.preventDefault();
      var bouton = connexion.querySelector('button');
      bouton.textContent = 'Connexion…';
      bouton.disabled = true;
      setTimeout(function () { window.location.href = 'espace.html'; }, 500);
    });
  }
})();
