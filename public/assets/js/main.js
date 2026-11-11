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

  /* Liens vers une section de la page (#contact, #simulateur…) : défilement animé en JS.
     Le défilement doux natif était annulé par le carrousel auto (il écrit scrollLeft à chaque image) → les boutons du menu ne bougeaient plus. */
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var a = e.target.closest && e.target.closest('a[href*="#"]');
    if (!a || a.pathname !== location.pathname || a.host !== location.host || a.hash.length < 2) return;
    var cible = document.getElementById(decodeURIComponent(a.hash.slice(1)));
    if (!cible || document.documentElement.classList.contains('ecrans')) return;
    e.preventDefault();
    var depart = window.scrollY;
    var fin = Math.max(0, cible.getBoundingClientRect().top + depart - (parseFloat(getComputedStyle(cible).scrollMarginTop) || 0));
    var duree = reduit ? 0 : Math.min(900, 300 + Math.abs(fin - depart) / 4), t0 = performance.now();
    history.pushState(null, '', a.hash);
    (function pas(t) {
      var p = duree ? Math.min(1, (t - t0) / duree) : 1;
      var e2 = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; // ease-in-out
      window.scrollTo({ top: depart + (fin - depart) * e2, behavior: 'instant' });
      if (p < 1) requestAnimationFrame(pas);
    })(t0);
  });

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
  /* Fiche bien : calendrier navigable mois par mois + choix arrivée / départ + demande de réservation.
     data-indispo = séjours déjà pris « arrivée/départ » (départ exclu : ce jour-là reste possible comme départ). */
  var dispo = document.querySelector('[data-dispo]');
  if (dispo) {
    var JOUR = 864e5;
    var ceJour = new Date();
    var auj = Date.UTC(ceJour.getFullYear(), ceJour.getMonth(), ceJour.getDate());
    var lireJour = function (s) { var p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); };
    var indispo = (dispo.dataset.indispo || '').split(',').filter(Boolean).map(function (r) { var p = r.split('/'); return [lireJour(p[0]), lireJour(p[1])]; });
    var nuitPrise = function (t) { return indispo.some(function (r) { return t >= r[0] && t < r[1]; }); };
    var nuitsLibres = function (a, b) { for (var t = a; t < b; t += JOUR) if (nuitPrise(t)) return false; return true; };
    var moisMin = Date.UTC(ceJour.getFullYear(), ceJour.getMonth(), 1);
    var vue = moisMin;
    var choix = { du: null, au: null };
    var calPrec = document.querySelector('[data-cal-prec]'), calSuiv = document.querySelector('[data-cal-suiv]');
    var unSeul = window.matchMedia('(max-width: 760px)');
    var dateLongue = function (t) { var d = new Date(t), m = MOIS[d.getUTCMonth()]; return d.getUTCDate() + ' ' + (anglais || arabe ? m : m.toLowerCase()) + ' ' + d.getUTCFullYear(); };

    var rendre = function () {
      var html = '';
      for (var k = 0; k < (unSeul.matches ? 1 : 2); k++) {
        var d0 = new Date(vue); d0.setUTCMonth(d0.getUTCMonth() + k);
        var an = d0.getUTCFullYear(), m = d0.getUTCMonth();
        var decalage = (d0.getUTCDay() + 6) % 7; // lundi = 0
        var nb = new Date(Date.UTC(an, m + 1, 0)).getUTCDate();
        html += '<div class="mois"><h3>' + MOIS[m] + ' ' + an + '</h3><div class="jours">';
        JOURS.forEach(function (j) { html += '<span class="entete" aria-hidden="true">' + j + '</span>'; });
        for (var i = 0; i < decalage; i++) html += '<span aria-hidden="true"></span>';
        for (var j = 1; j <= nb; j++) {
          var t = Date.UTC(an, m, j), passe = t < auj, pris = !passe && nuitPrise(t);
          var cls = passe ? ['passe'] : pris ? ['pris'] : [];
          var dansChoix = choix.du !== null && (t === choix.du || (choix.au !== null && t > choix.du && t <= choix.au));
          if (dansChoix) cls.push('choisi');
          if (t === choix.du) cls.push('debut');
          if (t === choix.au) cls.push('fin');
          // un jour pris reste cliquable comme jour de DÉPART si toutes les nuits d'avant sont libres
          var commeDepart = choix.du !== null && choix.au === null && t > choix.du && nuitsLibres(choix.du, t);
          var cliquable = !passe && (!pris || commeDepart);
          html += cliquable
            ? '<button type="button" data-jour="' + t + '" class="' + cls.join(' ') + '" aria-label="' + dateLongue(t) + '"' + (dansChoix ? ' aria-pressed="true"' : '') + '>' + j + '</button>'
            : '<span class="' + cls.join(' ') + '">' + j + '</span>';
        }
        html += '</div></div>';
      }
      dispo.innerHTML = html;
      if (calPrec) calPrec.disabled = vue <= moisMin;
    };

    dispo.addEventListener('click', function (e) {
      var b = e.target.closest('[data-jour]'); if (!b) return;
      var t = +b.dataset.jour;
      if (choix.du !== null && choix.au === null && t > choix.du && nuitsLibres(choix.du, t)) choix.au = t; // départ
      else if (!nuitPrise(t)) choix = { du: t, au: null }; // (nouvelle) arrivée
      rendre(); majCarte();
      var nouveau = dispo.querySelector('[data-jour="' + t + '"]'); if (nouveau) nouveau.focus();
    });
    var decaler = function (n) { var d = new Date(vue); d.setUTCMonth(d.getUTCMonth() + n); vue = Math.max(moisMin, d.getTime()); rendre(); };
    if (calPrec) calPrec.addEventListener('click', function () { decaler(-1); });
    if (calSuiv) calSuiv.addEventListener('click', function () { decaler(1); });
    unSeul.addEventListener('change', rendre);

    /* Carte « Demander à réserver » */
    var resaForm = document.querySelector('[data-reserver]');
    var TR = {
      fr: { dates: 'Choisissez vos dates d’arrivée et de départ dans le calendrier.', ok: 'Merci ! Votre demande est envoyée : Barka vous répond sur WhatsApp sous 24 h.', sujet: 'Demande de réservation', bien: 'Bien', arr: 'Arrivée', dep: 'Départ', nuits: 'Nuits', voy: 'Voyageurs', titre: 'Demande de réservation' },
      en: { dates: 'Choose your check-in and check-out dates in the calendar.', ok: 'Thank you! Your request has been sent: Barka will reply on WhatsApp within 24 hours.', sujet: 'Booking request', bien: 'Property', arr: 'Check-in', dep: 'Check-out', nuits: 'Nights', voy: 'Guests', titre: 'Booking request' },
      ar: { dates: 'اختر تاريخَي الوصول والمغادرة من التقويم.', ok: 'شكرًا! تم إرسال طلبك: ستردّ عليك بركة عبر واتساب خلال 24 ساعة.', sujet: 'طلب حجز', bien: 'العقار', arr: 'الوصول', dep: 'المغادرة', nuits: 'الليالي', voy: 'الضيوف', titre: 'طلب حجز' }
    }[arabe ? 'ar' : anglais ? 'en' : 'fr'];
    var nbNuits = function () { return choix.au !== null ? Math.round((choix.au - choix.du) / JOUR) : 0; };
    var majCarte = function () {
      if (!resaForm) return;
      resaForm.querySelector('[data-arrivee]').textContent = choix.du !== null ? dateLongue(choix.du) : '—';
      resaForm.querySelector('[data-depart]').textContent = choix.au !== null ? dateLongue(choix.au) : '—';
      resaForm.querySelector('[data-nuits]').textContent = nbNuits() || '—';
      var prix = parseFloat(resaForm.dataset.prix); // vide tant que Lyze n'a pas donné le prix
      var ligneTotal = resaForm.querySelector('[data-total-ligne]');
      ligneTotal.hidden = !(prix > 0 && nbNuits());
      if (!ligneTotal.hidden) resaForm.querySelector('[data-total]').textContent = new Intl.NumberFormat(arabe ? 'ar-MA' : anglais ? 'en-GB' : 'fr-FR').format(prix * nbNuits()) + ' MAD';
    };
    if (resaForm) {
      var etatResa = resaForm.querySelector('.etat'), boutonResa = resaForm.querySelector('button[type="submit"]');
      var dire = function (texte, classe) { etatResa.textContent = texte; etatResa.className = 'etat ' + (classe || ''); };
      resaForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!nbNuits()) { dire(TR.dates, 'erreur'); dispo.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
        if (!resaForm.reportValidity()) return;
        var f = new FormData(resaForm);
        var details = TR.titre + '\n' + TR.bien + ' : ' + resaForm.dataset.bien + '\n' + TR.arr + ' : ' + dateLongue(choix.du) + '\n' + TR.dep + ' : ' + dateLongue(choix.au)
          + '\n' + TR.nuits + ' : ' + nbNuits() + '\n' + TR.voy + ' : ' + f.get('voyageurs');
        var donnees = {
          nom: String(f.get('nom') || '').trim(), email: String(f.get('email') || '').trim(), telephone: String(f.get('telephone') || '').trim(),
          ville: resaForm.dataset.bien.slice(0, 60), message: details, site: String(f.get('site') || ''), langue: arabe ? 'ar' : anglais ? 'en' : 'fr', type: 'reservation'
        };
        var repli = function () {
          dire(T[donnees.langue].repli);
          window.location.href = 'mailto:contact@lyze.ma?subject=' + encodeURIComponent(TR.sujet) + '&body=' + encodeURIComponent(details + '\n\n' + donnees.nom + '\n' + donnees.email + '\n' + donnees.telephone);
        };
        boutonResa.disabled = true;
        dire(T[donnees.langue].envoi);
        fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(donnees) })
          .then(function (r) {
            if (r.ok) { resaForm.reset(); choix = { du: null, au: null }; rendre(); majCarte(); dire(TR.ok, 'ok'); }
            else if (r.status === 400) dire(T[donnees.langue].invalide, 'erreur');
            else repli(); // démo GitHub Pages (404/405) ou mail pas encore branché (503)
          })
          .catch(repli)
          .finally(function () { boutonResa.disabled = false; });
      });
    }
    rendre();
  }

  /* Textes de l'interface selon la langue de la page (fr / en / ar) */
  var lang = arabe ? 'ar' : anglais ? 'en' : 'fr';
  var T = {
    fr: {
      photo: 'Photo', devise: 'MAD', aucune: 'Cochez au moins une plateforme.',
      bruts: 'Revenus bruts', parAn: 'par an', fraisDe: 'Frais', comLyze: 'Commission Lyze Conciergerie', apresFrais: 'après frais', recevez: 'Vous recevez',
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
      bruts: 'Gross income', parAn: 'per year', fraisDe: 'Fees', comLyze: 'Lyze Conciergerie commission', apresFrais: 'after fees', recevez: 'You receive',
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
      bruts: 'المداخيل الإجمالية', parAn: 'في السنة', fraisDe: 'عمولة', comLyze: 'عمولة Lyze Conciergerie', apresFrais: 'بعد عمولة المنصة', recevez: 'صافي دخلك',
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
      // curseurs déplacés par la saisie au clavier : remettre à jour la partie remplie
      [curseur, nuits].forEach(function (r) { if (r) r.style.setProperty('--pct', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); });
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
          + mad(lyze) + ' (Lyze Conciergerie ' + nombre.format(commission) + ' %) = ' + T.vousTouchez + ' ' + mad(net) + '</p></li>';
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
      var option = function (l) { return '<option value="' + l.tel + '" data-iso="' + l.iso.toLowerCase() + '">' + l.nom + ' (' + l.tel + ')</option>'; };
      var html = enTete.map(option).join('') + '<option disabled>──────────</option>' + lignes.map(option).join('');
      selectsIndicatif.forEach(function (s) { s.innerHTML = html; s.selectedIndex = 0; listeAvecDrapeaux(s); });
    }).catch(function () { /* la liste par défaut (+212) reste dans le HTML */ });
  }

  /* Liste des pays avec drapeaux : les <option> natives ne peuvent pas afficher d'image, donc liste maison ;
     le <select> reste dans le formulaire (caché) et porte la valeur envoyée. */
  function listeAvecDrapeaux(select) {
    var drapeau = function (iso) { return new URL('../img/drapeaux/' + iso + '.svg', ici).href; };
    var opts = [].slice.call(select.options);
    var boite = document.createElement('div');
    boite.className = 'pays-choix';
    boite.innerHTML = '<button type="button" class="pays-bouton" aria-haspopup="listbox" aria-expanded="false">'
      + '<img alt="" width="24" height="18"><span></span><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M6 9l6 6 6-6"/></svg></button>'
      + '<ul class="pays-liste" role="listbox" tabindex="-1" hidden></ul>';
    var bouton = boite.querySelector('button'), liste = boite.querySelector('ul');
    bouton.setAttribute('aria-label', select.getAttribute('aria-label') || '');
    liste.innerHTML = opts.map(function (o, i) {
      if (o.disabled) return '<li class="pays-sep" role="separator"></li>';
      return '<li role="option" data-i="' + i + '" tabindex="-1"><img src="' + drapeau(o.dataset.iso) + '" alt="" width="24" height="18" loading="lazy"><span>' + o.textContent + '</span></li>';
    }).join('');
    var items = [].slice.call(liste.querySelectorAll('[role="option"]'));
    var afficher = function () {
      var o = select.options[select.selectedIndex];
      bouton.querySelector('img').src = drapeau(o.dataset.iso);
      bouton.querySelector('span').textContent = o.value;
      items.forEach(function (li) { li.setAttribute('aria-selected', String(+li.dataset.i === select.selectedIndex)); });
    };
    var ouvrir = function (oui) {
      liste.hidden = !oui; bouton.setAttribute('aria-expanded', String(oui));
      if (oui) { var sel = liste.querySelector('[aria-selected="true"]') || items[0]; sel.focus(); sel.scrollIntoView({ block: 'nearest' }); }
    };
    var choisir = function (li) {
      select.selectedIndex = +li.dataset.i;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      afficher(); ouvrir(false); bouton.focus();
    };
    bouton.addEventListener('click', function () { ouvrir(liste.hidden); });
    // preventDefault : la liste est dans un <label>, qui renverrait sinon le clic au bouton (liste rouverte)
    liste.addEventListener('click', function (e) { e.preventDefault(); var li = e.target.closest('[role="option"]'); if (li) choisir(li); });
    var recherche = '', minuterie;
    liste.addEventListener('keydown', function (e) {
      var i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var n = items[Math.min(items.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]; n.focus(); n.scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (i >= 0) choisir(items[i]); }
      else if (e.key === 'Escape' || e.key === 'Tab') { ouvrir(false); if (e.key === 'Escape') bouton.focus(); }
      else if (e.key.length === 1) { // taper les premières lettres d'un pays
        recherche += e.key.toLowerCase(); clearTimeout(minuterie); minuterie = setTimeout(function () { recherche = ''; }, 700);
        var t = items.slice(2).find(function (li) { return li.textContent.toLowerCase().indexOf(recherche) === 0; });
        if (t) { t.focus(); t.scrollIntoView({ block: 'nearest' }); }
      }
    });
    document.addEventListener('click', function (e) { if (!boite.contains(e.target)) ouvrir(false); });
    select.classList.add('pays-natif');
    select.tabIndex = -1;
    select.parentNode.insertBefore(boite, select);
    afficher();
  }

  /* Formulaire de contact : envoi par /api/contact (site hébergé), sinon repli sur la messagerie */
  var contact = document.querySelector('[data-contact]');
  if (contact) {
    var etat = contact.querySelector('.etat');
    var bouton = contact.querySelector('button[type="submit"]');
    var afficher = function (texte, classe) { etat.textContent = texte; etat.className = 'etat ' + (classe || ''); };
    // « Autre ville » : un champ libre apparaît pour écrire la ville
    var villeSel = contact.querySelector('select[name="ville"]');
    var villeAutre = contact.querySelector('.ville-autre');
    if (villeSel && villeAutre) villeSel.addEventListener('change', function () {
      var autre = villeSel.value === 'Autre ville';
      villeAutre.hidden = !autre; villeAutre.required = autre;
      if (autre) villeAutre.focus();
    });
    contact.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!contact.reportValidity()) return;
      var f = new FormData(contact);
      var tel = String(f.get('telephone') || '').trim();
      var donnees = {
        nom: String(f.get('nom') || '').trim(),
        email: String(f.get('email') || '').trim(),
        telephone: tel ? f.get('indicatif') + ' ' + tel : '',
        ville: f.get('ville') === 'Autre ville' ? String(f.get('ville_autre') || '').trim() : String(f.get('ville') || ''),
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

/* Soulignage du menu qui suit la section visible (accueil : Accueil / Propriétaires / Contact), pas seulement la page */
(function () {
  var liens = [].slice.call(document.querySelectorAll('.bar-nav a')).filter(function (a) {
    var h = a.getAttribute('href') || '';
    return h.charAt(0) === '#' || /^index\.html(#|$)/.test(h);
  });
  if (!document.body.classList.contains('accueil') || liens.length < 2) return;
  function cible(a) { var h = a.getAttribute('href').split('#')[1]; return h ? document.getElementById(h) : null; }
  function maj() {
    var actif = liens[0];
    liens.forEach(function (a) { var el = cible(a); if (el && el.getBoundingClientRect().top < innerHeight * 0.4) actif = a; });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) actif = liens[liens.length - 1];
    liens.forEach(function (a) { if (a === actif) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  addEventListener('scroll', maj, { passive: true });
  addEventListener('resize', maj);
  maj();
})();

// Curseurs du simulateur : partie remplie de la piste (--pct), la piste elle-même est beige en CSS
(function () {
  function pct(r) { r.style.setProperty('--pct', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); }
  document.querySelectorAll('.calcul input[type="range"]').forEach(pct);
  document.addEventListener('input', function (e) { if (e.target.matches && e.target.matches('.calcul input[type="range"]')) pct(e.target); });
})();
