/* Page d'un bien affiché sur le site (logement.html?id=…, demande 2026-11-18).
   Remplit la page depuis /api/biens?id=… PUIS charge main.js, qui lit la page une seule fois
   (calendrier des disponibilités, demande de réservation, visionneuse des photos).
   Textes saisis par les propriétaires : toujours en textContent, jamais en HTML. */
(function () {
  var moi = document.currentScript;
  var lang = (document.documentElement.lang || 'fr').slice(0, 2);
  var TEXTES = {
    fr: { voy: 'voyageurs', ch: 'chambres', photos: 'Voir les %n photos', absent: 'Ce bien n’est plus affiché sur le site.', retour: 'Retour à l’accueil', photo: 'photo' },
    en: { voy: 'guests', ch: 'bedrooms', photos: 'See all %n photos', absent: 'This property is no longer listed on the site.', retour: 'Back to home', photo: 'photo' },
    es: { voy: 'huéspedes', ch: 'habitaciones', photos: 'Ver las %n fotos', absent: 'Este alojamiento ya no aparece en el sitio.', retour: 'Volver al inicio', photo: 'foto' },
    it: { voy: 'ospiti', ch: 'camere', photos: 'Vedi le %n foto', absent: 'Questa struttura non è più presente sul sito.', retour: 'Torna alla home', photo: 'foto' },
    ar: { voy: 'ضيوف', ch: 'غرف', photos: 'شاهد الصور (%n)', absent: 'لم يعد هذا العقار معروضًا على الموقع.', retour: 'العودة إلى الرئيسية', photo: 'صورة' }
  };
  var T = TEXTES[lang] || TEXTES.fr;

  var image = function (url, w) { return '/_next/image?url=' + encodeURIComponent(url) + '&w=' + w + '&q=75'; }; // Next 16 : seule la qualité 75 est autorisée par défaut
  var el = function (tag, attrs, texte) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (texte != null) e.textContent = texte;
    return e;
  };
  var $ = function (s) { return document.querySelector(s); };

  var lancerMain = function () {
    var s = document.createElement('script');
    s.src = moi.dataset.main;
    document.head.appendChild(s);
  };

  var remplir = function (b) {
    document.title = b.name + ' — Lyze';
    $('.fiche .eyebrow').textContent = b.city;
    $('.fiche h1').textContent = b.name;

    var specs = $('.specs');
    [b.capacity ? b.capacity + ' ' + T.voy : null, b.bedrooms ? b.bedrooms + ' ' + T.ch : null, b.surface ? b.surface + ' m²' : null, b.kind]
      .filter(Boolean)
      .forEach(function (s, i) { if (i) specs.appendChild(el('i', {}, '·')); specs.appendChild(document.createTextNode(s)); });

    var desc = $('.fiche .description');
    if (b.description) { desc.textContent = b.description; desc.style.whiteSpace = 'pre-line'; } else desc.remove();
    var equip = $('.equipements');
    b.equipment.forEach(function (e) { equip.appendChild(el('li', {}, e)); });
    if (!b.equipment.length) equip.remove();

    // Photos : 4 grandes en haut + toutes dans la galerie (même adresse que la visionneuse de main.js)
    var mosaique = $('.mosaique'), bouton = mosaique.querySelector('.btn'), grille = $('.galerie-grille');
    b.photos.forEach(function (url, i) {
      var alt = b.name + ', ' + T.photo + ' ' + (i + 1);
      var a = el('a', { href: image(url, 1920) });
      a.appendChild(el('img', { src: image(url, 640), alt: alt, loading: 'lazy' }));
      grille.appendChild(a);
      if (i < 4) {
        var fig = el('figure');
        fig.appendChild(el('img', { class: 'photo', src: image(url, 1920), alt: alt }));
        mosaique.insertBefore(fig, bouton);
      }
    });
    bouton.textContent = T.photos.replace('%n', b.photos.length);
    if (b.photos.length < 2) bouton.remove();
    if (!b.photos.length) { mosaique.remove(); $('#galerie').remove(); }

    $('[data-dispo]').dataset.indispo = b.indispo.join(',');
    var form = $('[data-reserver]');
    form.dataset.bien = b.name + ' — ' + b.city;
    if (b.price) {
      form.dataset.prix = b.price;
      form.querySelector('.prix').firstChild.textContent = new Intl.NumberFormat(lang === 'ar' ? 'ar-MA' : lang).format(b.price) + ' ';
    } else {
      form.querySelector('.apartir').remove();
      form.querySelector('.prix').remove();
    }
  };

  var absent = function () {
    var main = $('main');
    main.textContent = '';
    var bloc = el('div', { class: 'logement-absent' });
    bloc.appendChild(el('p', {}, T.absent));
    bloc.appendChild(el('a', { class: 'btn', href: './' }, T.retour));
    main.appendChild(bloc);
  };

  // les liens de langue gardent le bien affiché
  document.querySelectorAll('a[href$="logement.html"]').forEach(function (a) { a.href += location.search; });

  var id = new URLSearchParams(location.search).get('id');
  (id ? fetch('/api/biens?id=' + encodeURIComponent(id)).then(function (r) { return r.ok ? r.json() : null; }) : Promise.resolve(null))
    .catch(function () { return null; })
    .then(function (b) { if (b) remplir(b); else absent(); })
    .then(lancerMain, lancerMain);
})();
