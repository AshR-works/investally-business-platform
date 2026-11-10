/**
 * Adresse e-mail cliquable : ouvre le logiciel de messagerie de l'utilisateur avec un message adressé à la personne (lien `mailto:`).
 * Le nom accessible dit où mène le lien ; sans adresse, un tiret discret remplace le lien.
 */
export function MailLink({ email, className }: { email: string | null | undefined; className?: string }) {
  const address = email?.trim();
  if (!address) return <span className="text-ink-2">—</span>;
  return (
    <a href={`mailto:${address}`} aria-label={`Écrire à ${address}`} className={className}>
      {address}
    </a>
  );
}
