// Même rendu sur tous les ordinateurs : entre 1000 et 1440 px de large, la page est mise en page
// sur 1440 px puis réduite (zoom) à la largeur réelle ; jamais agrandie (effet loupe sur 1920). Les CSS utilisent
// var(--vw) / var(--vh) au lieu de vw / vh, car le zoom multiplie aussi ces unités.
// Copie identique en ligne dans le <head> des pages de public/ (remplacer partout si modifié).
export const SCRIPT_ECHELLE =
  "(function(d){function f(){var w=innerWidth,z=w>=1000&&w<1440?w/1440:1,s=d.style;if(z===1){s.zoom='';['--vw','--vh','--svh','--dvh'].forEach(function(p){s.removeProperty(p)})}else{var h=innerHeight/z/100+'px';s.zoom=z;s.setProperty('--vw','14.4px');s.setProperty('--vh',h);s.setProperty('--svh',h);s.setProperty('--dvh',h)}}f();addEventListener('resize',f)})(document.documentElement)";
