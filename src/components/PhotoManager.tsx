"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePhoto, reorderPhotos } from "@/app/actions/photos";

export type PhotoItem = { id: string; url: string };

/** Réduit une photo à 2400 px de côté max (JPEG) avant l'envoi ; renvoie l'original si le navigateur ne sait pas la lire. */
async function reduire(f: File): Promise<Blob> {
  try {
    const img = await createImageBitmap(f);
    const echelle = Math.min(1, 2400 / Math.max(img.width, img.height));
    if (echelle === 1 && f.size < 2 * 1024 * 1024) return f;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * echelle);
    canvas.height = Math.round(img.height * echelle);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    return blob ?? f;
  } catch {
    return f;
  }
}

/**
 * Photos d'un bien, pour le propriétaire (espace) comme pour la gérante (admin) :
 * dépôt de fichiers par glisser-déposer ou « parcourir », tri par glisser (la 1re = couverture), suppression.
 * Les classes (.depot, .vignettes, .vignette…) sont stylées dans espace.css et dans le CSS admin.
 */
export function PhotoManager({ propertyId, initial }: { propertyId: string; initial: PhotoItem[] }) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initial);
  const [survol, setSurvol] = useState(false);
  const [envoi, setEnvoi] = useState(0); // nombre de fichiers en cours d'envoi
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);
  const [, startTransition] = useTransition();
  const enDeplacement = useRef<number | null>(null);
  const [cible, setCible] = useState<number | null>(null);
  const [zoom, setZoom] = useState<number | null>(null); // photo ouverte en grand

  async function envoyer(fichiers: FileList | null) {
    if (!fichiers || fichiers.length === 0) return;
    const liste = Array.from(fichiers);
    setEnvoi(liste.length);
    setMessage(null);
    const refusees: string[] = [];
    try {
      // Une photo par requête : l'hébergement limite chaque requête à 4,5 Mo.
      for (const [i, f] of liste.entries()) {
        const form = new FormData();
        form.set("propertyId", propertyId);
        form.append("photos", await reduire(f), f.name);
        const res = await fetch("/api/photos", { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as { photos?: PhotoItem[]; refused?: string[]; error?: string };
        if (!res.ok) {
          setMessage({ type: "erreur", texte: data.error ?? "L'envoi a échoué, réessayez." });
          return;
        }
        if (data.photos) setPhotos(data.photos);
        refusees.push(...(data.refused ?? []));
        setEnvoi(liste.length - i - 1);
      }
      setMessage(
        refusees.length
          ? { type: "erreur", texte: `Non ajoutées : ${refusees.join(", ")}.` }
          : { type: "ok", texte: "Photos ajoutées." },
      );
      router.refresh();
    } catch {
      setMessage({ type: "erreur", texte: "Connexion perdue pendant l'envoi, réessayez." });
    } finally {
      setEnvoi(0);
    }
  }

  function deplacer(de: number, vers: number) {
    if (de === vers) return;
    const avant = photos;
    const copie = [...photos];
    const [p] = copie.splice(de, 1);
    copie.splice(vers, 0, p);
    setPhotos(copie); // affichage immédiat, puis enregistrement
    startTransition(async () => {
      const r = await reorderPhotos(propertyId, copie.map((x) => x.id));
      if (r.error) {
        setPhotos(r.photos ?? avant);
        setMessage({ type: "erreur", texte: r.error });
      } else {
        router.refresh();
      }
    });
  }

  function supprimer(id: string) {
    if (!window.confirm("Supprimer cette photo ?")) return;
    const avant = photos;
    setPhotos(photos.filter((p) => p.id !== id));
    startTransition(async () => {
      const r = await deletePhoto(id);
      if (r.error) {
        setPhotos(avant);
        setMessage({ type: "erreur", texte: r.error });
      } else {
        if (r.photos) setPhotos(r.photos);
        router.refresh();
      }
    });
  }

  const fichierExterne = (e: React.DragEvent) => enDeplacement.current === null && e.dataTransfer.types.includes("Files");

  return (
    <div className="photos-gestion">
      <div className="photos-grille">
        <label
          className={`depot${survol ? " survol" : ""}${envoi ? " envoi" : ""}`}
          onDragEnter={(e) => { if (fichierExterne(e)) { e.preventDefault(); setSurvol(true); } }}
          onDragOver={(e) => { if (fichierExterne(e)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSurvol(false); }}
          onDrop={(e) => {
            setSurvol(false);
            if (enDeplacement.current !== null) return;
            e.preventDefault();
            envoyer(e.dataTransfer.files);
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true">
            <g fill="none" stroke="#9C6644" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4M7 9l5-5 5 5" />
              <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </g>
          </svg>
          <strong>{envoi ? `Envoi de ${envoi} photo${envoi > 1 ? "s" : ""}…` : "Déposez vos photos"}</strong>
          <small>ou cliquez pour parcourir — JPG, PNG, WebP, 10 Mo max</small>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            disabled={envoi > 0}
            onChange={(e) => { envoyer(e.target.files); e.target.value = ""; }}
          />
        </label>

        {photos.length === 0 ? (
          <p className="vignettes-vide">Aucune photo pour ce bien pour l&apos;instant.</p>
        ) : (
          <ul className="vignettes" aria-label="Photos du bien, dans l'ordre de l'annonce">
            {photos.map((photo, i) => (
              <li
                key={photo.id}
                className={`vignette${cible === i ? " cible" : ""}`}
                draggable
                onDragStart={(e) => {
                  enDeplacement.current = i;
                  e.currentTarget.classList.add("deplace");
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", photo.id);
                }}
                onDragEnd={(e) => {
                  e.currentTarget.classList.remove("deplace");
                  enDeplacement.current = null;
                  setCible(null);
                }}
                onDragOver={(e) => {
                  if (enDeplacement.current === null) return;
                  e.preventDefault();
                  if (cible !== i) setCible(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const de = enDeplacement.current;
                  setCible(null);
                  if (de !== null) deplacer(de, i);
                }}
              >
                <button type="button" className="vignette-voir" onClick={() => setZoom(i)} aria-label={`Voir la photo ${i + 1} en grand`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="" loading="lazy" draggable={false} />
                </button>
                {i === 0 && <span className="badge">Couverture</span>}
                <div className="vignette-actions">
                  <button type="button" onClick={() => deplacer(i, i - 1)} disabled={i === 0} aria-label="Avancer la photo">‹</button>
                  <button type="button" onClick={() => deplacer(i, i + 1)} disabled={i === photos.length - 1} aria-label="Reculer la photo">›</button>
                  <button type="button" className="suppr" onClick={() => supprimer(photo.id)} aria-label="Supprimer la photo">×</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {message && (
        <p className={`photos-message ${message.type}`} role={message.type === "erreur" ? "alert" : "status"}>
          {message.texte}
        </p>
      )}
      {zoom !== null && photos[zoom] && (
        <Visionneuse
          photos={photos}
          index={zoom}
          onChange={setZoom}
          onClose={() => setZoom(null)}
          onDelete={(id) => { setZoom(null); supprimer(id); }}
        />
      )}
    </div>
  );
}

/** Photo en grand : flèches pour passer d'une photo à l'autre, Échap pour fermer. */
function Visionneuse({
  photos,
  index,
  onChange,
  onClose,
  onDelete,
}: {
  photos: PhotoItem[];
  index: number;
  onChange: (i: number) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const fermer = useRef<HTMLButtonElement>(null);
  const n = photos.length;

  useEffect(() => {
    fermer.current?.focus();
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onChange((index + 1) % n);
      if (e.key === "ArrowLeft") onChange((index - 1 + n) % n);
    };
    document.addEventListener("keydown", touche);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", touche);
      document.body.style.overflow = overflow;
    };
  }, [index, n, onChange, onClose]);

  return (
    <div className="visionneuse" role="dialog" aria-modal="true" aria-label={`Photo ${index + 1} sur ${n}`} onClick={onClose}>
      <div className="visionneuse-cadre" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[index].url} alt={`Photo ${index + 1} sur ${n}`} />
        <div className="visionneuse-barre">
          <span>
            Photo {index + 1} / {n}
            {index === 0 ? " · couverture" : ""}
          </span>
          <div className="visionneuse-boutons">
            <button type="button" onClick={() => onChange((index - 1 + n) % n)} disabled={n < 2}>‹ Précédente</button>
            <button type="button" onClick={() => onChange((index + 1) % n)} disabled={n < 2}>Suivante ›</button>
            <button type="button" className="suppr" onClick={() => onDelete(photos[index].id)}>Supprimer</button>
            <button type="button" ref={fermer} onClick={onClose}>Fermer ×</button>
          </div>
        </div>
      </div>
    </div>
  );
}
