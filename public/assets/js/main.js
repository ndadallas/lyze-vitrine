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
  // En mode écrans, rien ne défile : tout est visible d'emblée
  if ('IntersectionObserver' in window && !reduit && !document.documentElement.classList.contains('ecrans')) {
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
  var anglais = document.documentElement.lang === 'en';
  var MOIS = arabe
    ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر']
    : anglais
    ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    : ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  var JOURS = arabe ? ['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح'] : anglais ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
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
      html += '<span' + (estPris ? ' class="pris" title="' + (arabe ? 'محجوز' : anglais ? 'Unavailable' : 'Indisponible') + '"' : '') + '>' + d + '</span>';
    }
    el.innerHTML = html + '</div>';
  });

  /* Textes de l'interface selon la langue de la page (fr / en / ar) */
  var lang = arabe ? 'ar' : anglais ? 'en' : 'fr';
  var T = {
    fr: {
      photo: 'Photo', devise: 'MAD', aucune: 'Cochez au moins une plateforme.',
      bruts: 'Revenus bruts', parAn: 'par an', fraisDe: 'Frais', comLyze: 'Commission Lyze', apresFrais: 'après frais', recevez: 'Vous recevez',
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
        return 'Nom : ' + d.nom + '\nE-mail : ' + d.email + '\nTéléphone : ' + d.telephone
          + '\nVille du bien : ' + d.ville + '\nMeublé : ' + d.meuble + '\n\n' + d.message;
      }
    },
    en: {
      photo: 'Photo', devise: 'MAD', aucune: 'Tick at least one platform.',
      bruts: 'Gross income', parAn: 'per year', fraisDe: 'Fees', comLyze: 'Lyze commission', apresFrais: 'after fees', recevez: 'You receive',
      vousTouchez: 'you earn', envoi: 'Sending…',
      ok: 'Thank you, your message has been sent. We will get back to you shortly.',
      invalide: 'Please check the form fields.',
      repli: 'Online sending is not available: your email app opens with the message ready to send.',
      sujet: 'Message from the Lyze website',
      resa: function (d) {
        return 'Hello,\n\nI would like to entrust my property to Lyze.\nCity: ' + d.get('ville') + '\nType: ' + d.get('type')
          + '\nBedrooms: ' + d.get('chambres') + '\nPlan: ' + d.get('formule') + '\n';
      },
      corps: function (d) {
        return 'Name: ' + d.nom + '\nEmail: ' + d.email + '\nPhone: ' + d.telephone
          + '\nProperty city: ' + d.ville + '\nFurnished: ' + d.meuble + '\n\n' + d.message;
      }
    },
    ar: {
      photo: 'صورة', devise: 'درهم', aucune: 'اختر منصة واحدة على الأقل.',
      bruts: 'المداخيل الإجمالية', parAn: 'في السنة', fraisDe: 'عمولة', comLyze: 'عمولة Lyze', apresFrais: 'بعد عمولة المنصة', recevez: 'صافي دخلك',
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
        return 'الاسم: ' + d.nom + '\nالبريد الإلكتروني: ' + d.email + '\nالهاتف: ' + d.telephone
          + '\nمدينة العقار: ' + d.ville + '\nمفروش: ' + d.meuble + '\n\n' + d.message;
      }
    }
  }[lang];
  var nombre = new Intl.NumberFormat({ ar: 'ar-MA', en: 'en-GB', fr: 'fr-FR' }[lang], { maximumFractionDigits: 1 });
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
    var auto = c.hasAttribute('data-auto'); // s'arrête au survol de la souris (demande client 2026-11-04) et quand on le manipule
    if (auto) {
      // Défilement continu sans fin : cartes dupliquées une fois, on revient d'une demi-piste quand on l'a parcourue
      Array.prototype.slice.call(piste.children).forEach(function (el) {
        var copie = el.cloneNode(true);
        copie.setAttribute('aria-hidden', 'true');
        copie.setAttribute('tabindex', '-1');
        piste.appendChild(copie);
      });
      c.classList.add('auto');
      var pos = 0, dernier = 0, pauseJusqua = 0, survol = false;
      piste.addEventListener('mouseenter', function () { survol = true; });
      piste.addEventListener('mouseleave', function () { survol = false; });
      var pause = function () { pauseJusqua = performance.now() + 4000; };
      c.addEventListener('focusin', pause);
      piste.addEventListener('pointerdown', pause);
      piste.addEventListener('wheel', pause, { passive: true });
      var tour = function (t) {
        var moitie = piste.scrollWidth / 2;
        var reel = Math.abs(piste.scrollLeft);
        if (Math.abs(reel - Math.round(pos)) > 2) pos = reel; // l'utilisateur a bougé la piste
        var bouge = !survol && t > pauseJusqua && piste.offsetParent && dernier;
        if (bouge) pos += (t - dernier) * 0.04; // ≈ 40 px/s
        if (pos >= moitie) { pos -= moitie; bouge = true; }
        // n'écrire que si on avance nous-mêmes : sinon on couperait le défilement doux des flèches
        if (bouge) piste.scrollLeft = pos * sens;
        dernier = t;
        requestAnimationFrame(tour);
      };
      requestAnimationFrame(tour);
    }
    var maj = function () {
      if (auto) return; // piste sans fin : flèches toujours actives
      var x = Math.abs(piste.scrollLeft);
      prec.disabled = x < 4;
      suiv.disabled = x > piste.scrollWidth - piste.clientWidth - 4;
    };
    var aller = function (d) {
      if (auto) pause();
      piste.scrollBy({ left: d * sens * piste.clientWidth * 0.9, behavior: 'smooth' });
    };
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
    var nuits = calcul.querySelector('[data-nuits]');
    var nuitsSaisie = calcul.querySelector('[data-nuits-saisie]');
    var calculer = function () {
      var prix = Math.max(0, +curseur.value || 0);
      var html = '';
      if (nuits) { // vitrine : une plateforme, détail sur l'année
        var p = calcul.querySelector('input[name="plateforme"]:checked');
        var n = Math.max(0, +nuits.value || 0);
        var taux = p ? parseFloat(p.dataset.taux) : 0;
        var brut = prix * n, frais = brut * taux / 100, lyze = (brut - frais) * commission / 100;
        var ligne = function (titre, sous, val, classe) {
          return '<li class="ligne-annee ' + (classe || '') + '"><span>' + titre + '<small>' + sous + '</small></span><strong>' + val + '</strong></li>';
        };
        liste.innerHTML = ligne(T.bruts, T.parAn, mad(brut))
          + ligne(T.fraisDe + ' ' + (p ? p.dataset.nom : ''), nombre.format(taux) + ' %', '−' + mad(frais))
          + ligne(T.comLyze, nombre.format(commission) + ' % ' + T.apresFrais, '−' + mad(lyze))
          + ligne(T.recevez, T.parAn, mad(brut - frais - lyze), 'total');
        return;
      }
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
    if (nuits) {
      nuits.addEventListener('input', function () { nuitsSaisie.value = nuits.value; calculer(); });
      nuitsSaisie.addEventListener('input', function () {
        nuits.value = Math.min(+nuits.max, Math.max(0, Math.round(+nuitsSaisie.value || 0)));
        calculer();
      });
      nuitsSaisie.addEventListener('change', function () { nuitsSaisie.value = nuits.value; });
    }
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
        ville: String(f.get('ville') || ''),
        meuble: String(f.get('meuble') || ''),
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
        if (window.allerEcran) window.allerEcran('contact');
        else document.getElementById('contact').scrollIntoView({ behavior: reduit ? 'auto' : 'smooth' });
        contact.elements.nom.focus({ preventScroll: true });
      } else {
        window.location.href = 'mailto:contact@lyze.ma?subject=' + encodeURIComponent('Lyze') + '&body=' + encodeURIComponent(corps);
      }
    });
  }

  /* Accueil en écrans : une section à la fois ; menu, pointsEcrans, molette, clavier et glissé pour passer de l'une à l'autre */
  var ecrans = [].slice.call(document.querySelectorAll('[data-ecran]'));
  if (ecrans.length && document.documentElement.classList.contains('ecrans')) {
    var racine = document.documentElement;
    var ecranCourant = -1;
    var surAccueil = document.body.classList.contains('accueil');
    var pointsEcrans = document.createElement('nav');
    pointsEcrans.className = 'points-ecrans';
    pointsEcrans.setAttribute('aria-label', arabe ? 'أقسام الصفحة' : anglais ? 'Page sections' : 'Sections de la page');
    ecrans.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = '<span>' + s.dataset.ecran + '</span>';
      b.setAttribute('aria-label', s.dataset.ecran);
      b.addEventListener('click', function () { montrerEcran(i); });
      pointsEcrans.appendChild(b);
    });
    document.body.appendChild(pointsEcrans);
    // Accueil = grand en-tête + photo sur exactement un écran, quelle que soit la hauteur de l'en-tête (plus haute en arabe)
    var mesurerEnTete = function () {
      if (masthead && masthead.offsetHeight) racine.style.setProperty('--haut-masthead', masthead.offsetHeight + 'px');
      var barre = document.querySelector('.bar'); // barre fixe de l'accueil ou barre du haut des autres pages
      if (barre && barre.offsetHeight) racine.style.setProperty('--barre', barre.offsetHeight + 'px');
    };
    mesurerEnTete();
    if (document.fonts) document.fonts.ready.then(mesurerEnTete);
    window.addEventListener('resize', mesurerEnTete);

    var montrerEcran = function (i, sansHistorique) {
      i = Math.max(0, Math.min(ecrans.length - 1, i));
      if (i === ecranCourant) return;
      // Transition « défilement » : l'ancien écran part dans le sens de la molette pendant que le nouveau arrive
      racine.style.setProperty('--sens', i > ecranCourant ? 1 : -1);
      ecrans.forEach(function (e) { if (e.classList.contains('sortant')) e.classList.remove('sortant', 'actif'); });
      var ancien = ecranCourant > -1 ? ecrans[ecranCourant] : null;
      if (ancien && ecranCourant > -1 && !reduit) {
        ancien.classList.add('sortant');
        setTimeout(function () {
          if (!ancien.classList.contains('sortant')) return; // déjà nettoyé par une transition plus récente
          ancien.classList.remove('sortant');
          if (ancien !== ecrans[ecranCourant]) ancien.classList.remove('actif');
        }, 800); // = durée de ecran-sort dans style.css
      } else if (ancien) ancien.classList.remove('actif');
      ecranCourant = i;
      var s = ecrans[i];
      s.classList.add('actif');
      s.scrollTop = 0;
      racine.setAttribute('data-ecran', s.id);
      window.scrollTo(0, 0);
      [].forEach.call(pointsEcrans.children, function (b, j) { b.setAttribute('aria-current', j === i ? 'true' : 'false'); });
      // Lien du menu correspondant à l'écran affiché (accueil seulement : ailleurs le lien de la page reste souligné)
      if (surAccueil) document.querySelectorAll('.bar-nav a, .nav-grille a').forEach(function (l) {
        var h = l.getAttribute('href');
        var surEcran = i === 0 ? h === 'index.html' : h === '#' + s.id;
        if (surEcran) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
      });
      if (!sansHistorique) history.replaceState(null, '', i ? '#' + s.id : location.pathname + location.search);
    };
    // Un lien vers un bloc (#biens, #faq…) ouvre l'écran qui le contient
    var indexDe = function (id) {
      var cible = id && document.getElementById(id);
      var ecran = cible && cible.closest('[data-ecran]');
      return ecran ? ecrans.indexOf(ecran) : -1;
    };
    window.allerEcran = function (id) { var i = indexDe(id); if (i > -1) montrerEcran(i); };

    // Liens internes (#services, index.html…) : changent d'écran au lieu de défiler
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var h = a.getAttribute('href');
      var i = h === 'index.html' && surAccueil ? 0 : h.charAt(0) === '#' ? indexDe(h.slice(1)) : -1;
      if (i < 0) return;
      e.preventDefault();
      montrerEcran(i);
    });
    window.addEventListener('hashchange', function () { var i = indexDe(location.hash.slice(1)); if (i > -1) montrerEcran(i, true); });

    // Avance d'un écran seulement quand la section active est au bout (elle peut défiler un peu sur petit écran)
    var auBout = function (sens) {
      var s = ecrans[ecranCourant];
      var boite = s.classList.contains('hero') ? document.scrollingElement : s;
      return sens > 0 ? boite.scrollTop + boite.clientHeight >= boite.scrollHeight - 2 : boite.scrollTop <= 0;
    };
    var pasEcran = function (sens) {
      if (!auBout(sens)) return false;
      montrerEcran(ecranCourant + sens);
      return true;
    };
    // Molette : un cran = un écran. L'inertie du pavé tactile (petits deltas qui décroissent, sans pause) ne compte pas
    var derniereMolette = 0, dernierDelta = 0;
    window.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX) || Math.abs(e.deltaY) < 4) return;
      if (e.target.closest && e.target.closest('input[type="range"], textarea, select')) return;
      var sens = e.deltaY > 0 ? 1 : -1;
      if (!auBout(sens)) return;
      e.preventDefault();
      var maintenant = Date.now(), d = Math.abs(e.deltaY);
      var nouveauGeste = maintenant - derniereMolette > 150 || d > dernierDelta || d >= 100;
      derniereMolette = maintenant;
      dernierDelta = d;
      if (nouveauGeste) pasEcran(sens);
    }, { passive: false });
    document.addEventListener('keydown', function (e) {
      if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
      var sens = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 }[e.key];
      if (e.key === 'Home') { e.preventDefault(); return montrerEcran(0); }
      if (e.key === 'End') { e.preventDefault(); return montrerEcran(ecrans.length - 1); }
      if (sens && auBout(sens)) { e.preventDefault(); pasEcran(sens); }
    });
    var departY = null;
    window.addEventListener('touchstart', function (e) { departY = e.touches[0].clientY; }, { passive: true });
    window.addEventListener('touchend', function (e) {
      if (departY === null) return;
      var d = departY - e.changedTouches[0].clientY;
      departY = null;
      if (Math.abs(d) > 70) pasEcran(d > 0 ? 1 : -1);
    }, { passive: true });

    montrerEcran(Math.max(0, indexDe(location.hash.slice(1))), true);
  }

  /* Livret : le sélecteur change le nom du bien affiché */
  var choixBien = document.querySelector('[data-choix-bien]');
  if (choixBien) {
    choixBien.addEventListener('change', function () {
      document.querySelectorAll('[data-nom-bien]').forEach(function (n) { n.textContent = choixBien.value; });
    });
  }
})();
