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
  var arabe = document.documentElement.lang === 'ar';
  var MOIS = arabe
    ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر']
    : ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  var JOURS = arabe ? ['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح'] : ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  document.querySelectorAll('[data-calendrier]').forEach(function (el) {
    var parts = el.dataset.calendrier.split('-');
    var an = +parts[0], m = +parts[1] - 1;
    var pris = (el.dataset.pris || '').split(',').map(Number);
    var decalage = (new Date(an, m, 1).getDay() + 6) % 7; // lundi = 0
    var nbJours = new Date(an, m + 1, 0).getDate();
    var html = '<h3>' + MOIS[m] + ' ' + an + '</h3><div class="jours">';
    JOURS.forEach(function (j) { html += '<span class="entete">' + j + '</span>'; });
    for (var i = 0; i < decalage; i++) html += '<span aria-hidden="true"></span>';
    for (var d = 1; d <= nbJours; d++) {
      var estPris = pris.indexOf(d) > -1;
      html += '<span' + (estPris ? ' class="pris" title="' + (arabe ? 'محجوز' : 'Indisponible') + '"' : '') + '>' + d + '</span>';
    }
    el.innerHTML = html + '</div>';
  });

  /* Textes de l'interface selon la langue de la page (fr / ar) */
  var lang = document.documentElement.lang === 'ar' ? 'ar' : 'fr';
  var T = {
    fr: {
      photo: 'Photo', devise: 'MAD', aucune: 'Cochez au moins une plateforme.',
      vousTouchez: 'vous touchez', envoi: 'Envoi…',
      ok: 'Merci, votre message est bien parti. Nous vous répondons rapidement.',
      invalide: 'Vérifiez les champs du formulaire.',
      repli: 'L’envoi en ligne n’est pas disponible : votre messagerie s’ouvre avec le message prêt à partir.',
      sujet: 'Message depuis le site Lyze',
      resa: function (d) {
        return 'Bonjour,\n\nJe souhaite confier mon bien à Lyze.\nVille : ' + d.get('ville') + '\nType : ' + d.get('type')
          + '\nChambres : ' + d.get('chambres') + '\nFormule : ' + d.get('formule') + '\n';
      },
      corps: function (d) {
        return 'Nom : ' + d.nom + '\nE-mail : ' + d.email + '\nTéléphone : ' + d.telephone + '\n\n' + d.message;
      }
    },
    ar: {
      photo: 'صورة', devise: 'درهم', aucune: 'اختر منصة واحدة على الأقل.',
      vousTouchez: 'صافي دخلك', envoi: 'جارٍ الإرسال…',
      ok: 'شكرًا، وصلتنا رسالتك. سنتواصل معك قريبًا.',
      invalide: 'يرجى التحقق من حقول الاستمارة.',
      repli: 'الإرسال عبر الموقع غير متاح حاليًا: سيُفتح بريدك الإلكتروني والرسالة جاهزة للإرسال.',
      sujet: 'رسالة من موقع Lyze',
      resa: function (d) {
        return 'مرحبًا،\n\nأرغب في أن أعهد بعقاري إلى Lyze.\nالمدينة: ' + d.get('ville') + '\nنوع العقار: ' + d.get('type')
          + '\nعدد الغرف: ' + d.get('chambres') + '\nالصيغة: ' + d.get('formule') + '\n';
      },
      corps: function (d) {
        return 'الاسم: ' + d.nom + '\nالبريد الإلكتروني: ' + d.email + '\nالهاتف: ' + d.telephone + '\n\n' + d.message;
      }
    }
  }[lang];
  var nombre = new Intl.NumberFormat(lang === 'ar' ? 'ar-MA' : 'fr-FR', { maximumFractionDigits: 1 });
  var mad = function (n) { return nombre.format(Math.round(n)) + ' ' + T.devise; };
  var ici = document.currentScript ? document.currentScript.src : location.href;

  /* Hero : diaporama en fondu, avec points de navigation */
  var diapo = document.querySelector('[data-diaporama]');
  if (diapo) {
    var images = diapo.querySelectorAll('img');
    var points = document.querySelector('[data-diaporama-points]');
    var courant = 0, minuterie = null;
    var montrer = function (i) {
      images[courant].classList.remove('actif');
      points.children[courant].removeAttribute('aria-current');
      courant = (i + images.length) % images.length;
      images[courant].classList.add('actif');
      points.children[courant].setAttribute('aria-current', 'true');
    };
    var relancer = function () {
      clearInterval(minuterie);
      if (!reduit && images.length > 1) minuterie = setInterval(function () { montrer(courant + 1); }, 6000);
    };
    images.forEach(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', T.photo + ' ' + (i + 1) + ' / ' + images.length);
      b.addEventListener('click', function () { montrer(i); relancer(); });
      points.appendChild(b);
    });
    points.children[0].setAttribute('aria-current', 'true');
    relancer();
    // pas de défilement automatique pendant qu'on remplit le formulaire du hero
    var hero = diapo.closest('.hero');
    hero.addEventListener('focusin', function () { clearInterval(minuterie); });
    hero.addEventListener('focusout', relancer);
  }

  /* Carrousels horizontaux (nos biens) : flèches + défilement aimanté natif */
  document.querySelectorAll('[data-carrousel]').forEach(function (c) {
    var piste = c.querySelector('.carrousel-piste');
    var prec = c.querySelector('[data-prec]');
    var suiv = c.querySelector('[data-suiv]');
    var sens = getComputedStyle(piste).direction === 'rtl' ? -1 : 1;
    var maj = function () {
      var x = Math.abs(piste.scrollLeft);
      prec.disabled = x < 4;
      suiv.disabled = x > piste.scrollWidth - piste.clientWidth - 4;
    };
    var aller = function (d) { piste.scrollBy({ left: d * sens * piste.clientWidth * 0.9 }); };
    prec.addEventListener('click', function () { aller(-1); });
    suiv.addEventListener('click', function () { aller(1); });
    piste.addEventListener('scroll', function () { requestAnimationFrame(maj); }, { passive: true });
    window.addEventListener('resize', maj);
    maj();
  });

  /* Simulateur de revenus : prix de la nuit − frais de la plateforme − commission Lyze */
  var calcul = document.querySelector('[data-calcul]');
  if (calcul) {
    var commission = parseFloat(calcul.dataset.commission);
    var curseur = calcul.querySelector('[data-prix]');
    var saisie = calcul.querySelector('[data-prix-saisie]');
    var liste = calcul.querySelector('[data-resultats]');
    var calculer = function () {
      var prix = Math.max(0, +curseur.value || 0);
      var html = '';
      calcul.querySelectorAll('input[name="plateforme"]:checked').forEach(function (p) {
        var taux = parseFloat(p.dataset.taux);
        var frais = prix * taux / 100;
        var lyze = (prix - frais) * commission / 100;
        var net = prix - frais - lyze;
        html += '<li><div class="tete"><span><img src="' + p.dataset.logo + '" alt="">' + p.dataset.nom + '</span>'
          + '<strong>' + mad(net) + '</strong></div>'
          + '<p class="detail">' + mad(prix) + ' − ' + mad(frais) + ' (' + p.dataset.nom + ' ' + nombre.format(taux) + ' %) − '
          + mad(lyze) + ' (Lyze ' + nombre.format(commission) + ' %) = ' + T.vousTouchez + ' ' + mad(net) + '</p></li>';
      });
      liste.innerHTML = html || '<li class="vide">' + T.aucune + '</li>';
    };
    curseur.addEventListener('input', function () { saisie.value = curseur.value; calculer(); });
    saisie.addEventListener('input', function () {
      curseur.value = Math.min(+curseur.max, Math.max(0, Math.round(+saisie.value || 0)));
      calculer();
    });
    saisie.addEventListener('change', function () { saisie.value = curseur.value; });
    calcul.addEventListener('change', calculer);
    calculer();
  }

  /* Indicatifs téléphoniques de tous les pays (noms traduits par le navigateur) */
  var selectsIndicatif = document.querySelectorAll('[data-indicatifs]');
  if (selectsIndicatif.length) {
    fetch(new URL('../data/indicatifs.json', ici)).then(function (r) { return r.json(); }).then(function (pays) {
      var noms = 'DisplayNames' in Intl ? new Intl.DisplayNames([lang], { type: 'region' }) : null;
      var lignes = pays.map(function (p) { return { iso: p[0], tel: '+' + p[1], nom: noms ? noms.of(p[0]) : p[0] }; });
      lignes.sort(function (a, b) { return a.nom.localeCompare(b.nom, lang); });
      var enTete = ['MA', 'FR'].map(function (iso) { return lignes.find(function (l) { return l.iso === iso; }); });
      var option = function (l) { return '<option value="' + l.tel + '">' + l.nom + ' (' + l.tel + ')</option>'; };
      var html = enTete.map(option).join('') + '<option disabled>──────────</option>' + lignes.map(option).join('');
      selectsIndicatif.forEach(function (s) { s.innerHTML = html; s.selectedIndex = 0; });
    }).catch(function () { /* la liste par défaut (+212) reste dans le HTML */ });
  }

  /* Formulaire de contact : envoi par /api/contact (site hébergé), sinon repli sur la messagerie */
  var contact = document.querySelector('[data-contact]');
  if (contact) {
    var etat = contact.querySelector('.etat');
    var bouton = contact.querySelector('button[type="submit"]');
    var afficher = function (texte, classe) { etat.textContent = texte; etat.className = 'etat ' + (classe || ''); };
    contact.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!contact.reportValidity()) return;
      var f = new FormData(contact);
      var tel = String(f.get('telephone') || '').trim();
      var donnees = {
        nom: String(f.get('nom') || '').trim(),
        email: String(f.get('email') || '').trim(),
        telephone: tel ? f.get('indicatif') + ' ' + tel : '',
        message: String(f.get('message') || '').trim(),
        site: String(f.get('site') || ''),
        langue: lang
      };
      var repli = function () {
        afficher(T.repli);
        window.location.href = 'mailto:contact@lyze.ma?subject=' + encodeURIComponent(T.sujet) + '&body=' + encodeURIComponent(T.corps(donnees));
      };
      bouton.disabled = true;
      afficher(T.envoi);
      fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(donnees) })
        .then(function (r) {
          if (r.ok) { contact.reset(); afficher(T.ok, 'ok'); }
          else if (r.status === 400) afficher(T.invalide, 'erreur');
          else repli(); // 404/405 (démo GitHub Pages) ou 503 (service mail pas encore branché)
        })
        .catch(repli)
        .finally(function () { bouton.disabled = false; });
    });
  }

  /* Formulaire « Confier mon bien » : pré-remplit le formulaire de contact, sinon prépare un e-mail */
  var resa = document.querySelector('[data-resa]');
  if (resa) {
    resa.addEventListener('submit', function (e) {
      e.preventDefault();
      var corps = T.resa(new FormData(resa));
      if (contact) {
        contact.elements.message.value = corps;
        document.getElementById('contact').scrollIntoView({ behavior: reduit ? 'auto' : 'smooth' });
        contact.elements.nom.focus({ preventScroll: true });
      } else {
        window.location.href = 'mailto:contact@lyze.ma?subject=' + encodeURIComponent('Lyze') + '&body=' + encodeURIComponent(corps);
      }
    });
  }

  /* Livret : le sélecteur change le nom du bien affiché */
  var choixBien = document.querySelector('[data-choix-bien]');
  if (choixBien) {
    choixBien.addEventListener('change', function () {
      document.querySelectorAll('[data-nom-bien]').forEach(function (n) { n.textContent = choixBien.value; });
    });
  }
})();
