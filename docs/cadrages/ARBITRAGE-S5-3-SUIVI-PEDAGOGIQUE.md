# Arbitrage — S5.3, suivi pédagogique d'Investudy

*2026-11-12 · Méthode : [METHODE-D-ARBITRAGE](../METHODE-D-ARBITRAGE.md) (options dont le statu quo, grille recalculée, recommandation, **décision laissée à la Direction produit**). **Aucun code n'est écrit** tant que la décision n'est pas prise.*

## 1. La question
Comment construire S5.3 : les **présences**, les **évaluations**, la **clôture de session**, puis les **certificats et attestations** (avec la suggestion d'ambassadeur au chargé de compte) ? C'est la dernière pièce du module Investudy ; elle débloque les tableaux de bord Investudy (S6.2).

## 2. Ce qui existe et ce qui contraint
| Fait | Source |
|---|---|
| Une session a quatre états (Planifiée, Ouverte, Clôturée, Annulée) ; **la clôture n'est pas encore faite** ; une session clôturée ne se modifie plus et ne s'annule pas | D48, recette S5.2a |
| Les inscriptions ont les états En attente, Confirmée, Annulée, À remplacer ; seuls les **inscrits confirmés** apparaissent à la feuille de présence | S5.2b, CU-I-50 |
| **Aucune table** de présence, d'évaluation ni de certification n'existe ; les permissions `training.attendance`, `training.evaluation`, `training.certification` sont dans le catalogue | catalogue des droits |
| Les **formateurs sont externes et sans accès à l'application** ; le flux I3 les fait pourtant saisir présences et évaluations. **FD-11** (option B recommandée : le responsable saisit, sans compte formateur) **n'a pas de réponse enregistrée** | FD-11, D31 |
| Aucun responsable Investudy n'est désigné ; le CEO l'est de fait (à confirmer) | FD-11 |
| Seuils de départ **proposés, non validés** : 80 % de présence et 10 sur 20 pour un certificat ; 80 % de présence pour une attestation | D31, CU-I-60 |
| Le chargé de compte n'a **aucun droit de lecture** sur les certifications, alors que la suggestion d'ambassadeur en dépend | D31, CU-I-62 |
| Le rendu **PDF** par le serveur attend la charte des documents | D61 |
| La **durée de conservation** des données des apprenants n'est pas validée juridiquement | D11, D65 |
| Une absence ne stocke jamais de diagnostic ; pas de donnée sensible dans le CRM (ADR-0009) : à tenir pour les observations de présence | ADR-0009, ADR-0013 |

## 3. Options
| Option | Contenu |
|---|---|
| **A. Statu quo** | Ne pas faire S5.3 maintenant (le module Investudy s'arrête aux inscriptions) |
| **B. Tout en un lot** | Clôture, présences, évaluations, certificats, attestations, révocation, suggestion d'ambassadeur, PDF |
| **C. Trois lots** | **(a)** clôture + présences ; **(b)** évaluations + seuils (calcul et suggestion) ; **(c)** certificats et attestations (délivrance, révocation, numérotation), suggestion d'ambassadeur. Chaque lot est livré, recetté et validé |
| **D. Minimum** | Clôture + présences + **attestation de suivi seule** ; ni évaluations, ni certificat de réussite |

## 4. Grille (5 critères, poids de 1 à 5, notes de 1 à 5 ; maximum 95)
| Critère (poids) | A | B | C | D |
|---|---|---|---|---|
| Valeur pour Investudy (5) | 1 | 5 | 4 | 3 |
| Règles métier connues (4) | 5 | 2 | 3 | 4 |
| Tenable à court terme (4) | 5 | 1 | 4 | 5 |
| Réversibilité (3) | 5 | 2 | 4 | 4 |
| Débloque la suite : S6.2, ambassadeurs (3) | 1 | 5 | 5 | 3 |
| **Total** | **63** | **58** | **75** | **72** |

*Calculs : A = 5 + 20 + 20 + 15 + 3 = 63 ; B = 25 + 8 + 4 + 6 + 15 = 58 ; C = 20 + 12 + 16 + 12 + 15 = 75 ; D = 15 + 16 + 20 + 12 + 9 = 72.*

**Écart entre la grille et la recommandation.** L'écart entre C et D est faible (3 points). D est presque le premier lot de C : les deux commencent de la même façon, par la clôture et les présences. La différence est ce qu'on s'engage à faire après. Je recommande C parce qu'il garde la possibilité de s'arrêter après le lot (a) ou (b) sans avoir tout figé. A a un total honorable parce que ne rien faire ne coûte rien, mais il laisse Investudy sans présence ni certificat, et bloque S6.2.

## 5. Risques et dette de l'option recommandée (C)
- **Règles encore inconnues** (seuils, barème, réouverture) : elles sont posées comme valeurs de départ « à confirmer » et rendues **paramétrables** plutôt que codées, comme pour les congés et les contrats.
- **Saisie par une seule personne** si FD-11 B est retenu : charge de saisie pour le responsable (le CEO de fait) ; pas de traçabilité à la source (le formateur ne saisit pas).
- **Données personnelles des apprenants** (présences, notes) : la durée de conservation n'est pas validée (D11, D65). Dette ouverte, à inscrire au lot (a).
- **Dette créée** : PDF des certificats reporté à la charte des documents (D61) ; réouverture d'une session clôturée à cadrer ; pas de notification (la suggestion d'ambassadeur reste dans l'écran).

## 6. Recommandation
**Option C, en trois lots**, en commençant par le lot (a) : clôture de session et présences. Un lot = une demande de fusion, une recette, vos « Je valide », comme pour RH-2 à RH-4.

## 7. Décision attendue
**Réponse courte : « C » (ou A, B, D), puis les sous-décisions ci-dessous.** « Applique les recommandations » vaut décision pour tout ce qui est recommandé.

| N° | Sous-décision | Options | Ma recommandation |
|---|---|---|---|
| **S1** | **Qui saisit les présences et les évaluations** (FD-11, sans réponse enregistrée) | A comptes formateurs · **B le responsable saisit** (feuille d'émargement du formateur) · C mixte | **B** : conforme à l'organisation (formateurs externes sans accès) ; C reste possible plus tard |
| **S2** | **Modèle de présence** | A matin / après-midi / retard / observation (CU-I-50) · **B par séance : présent, retard, absent** (sans texte libre) | **B** : plus simple, adapté aux sessions du jour et du soir (D46), pas de texte libre sensible |
| **S3** | **Calcul du taux de présence** | Retard compte comme présent · retard compte comme absent | Retard = présent, **sauf** décision contraire |
| **S4** | **Barème des évaluations** (CU-I-52) | **Note sur 20** · acquis / non acquis · compétences | **Note sur 20** (seuil 10/20), sans commentaire libre |
| **S5** | **Seuils de départ** (D31) | Confirmer 80 % et 10/20 (certificat), 80 % (attestation) · corriger | **Confirmer**, comme valeurs paramétrables « à confirmer » |
| **S6** | **Délivrance** | Automatique dès les seuils · **suggérée puis délivrée à la main** par le responsable | **Suggérée puis manuelle** (jamais automatique, comme la suggestion d'ambassadeur) |
| **S7** | **Réouverture d'une session clôturée** | Interdite · **permission dédiée, motif obligatoire, tracée** | **Permission dédiée** (D31) |
| **S8** | **Visibilité pour le chargé de compte** (suggestion d'ambassadeur) | **Suggestion seule, sans lecture des certifications** · lecture limitée à ses entreprises | **Suggestion seule** (moins de droits à ouvrir) |
| **S9** | **PDF du certificat** | Attendre la charte (D61) · **enregistrement + aperçu écran d'abord** | **Enregistrement + aperçu** ; PDF avec la charte |
| **S10** | **Conservation des données des apprenants** (D11, D65) | Avis juridique avant la mise en production · durée fixée maintenant | **Avis juridique** ; dette inscrite au lot (a) |

## 8. Ce que fera le lot (a), si C est retenu
Clôture de session (permission dédiée, confirmation, présences figées) ; feuille de présence par séance pour les inscrits confirmés ; correction avant la clôture avec auteur, date et ancienne valeur dans l'audit ; consultation par la Direction ; écran, démonstration, recette (mutants, Newman, fiches de test). Aucune évaluation ni certificat dans ce lot.

## 9. Décision

**Décidé** (2026-11-16, Direction produit : « Applique les recommandations ») : **option C**, en trois lots, en commençant par le lot (a). Toutes les sous-décisions S1 à S10 sont retenues telles que recommandées (tableau §7). Consigné en **D72** du registre des décisions ; ADR-0016.

**Lot (a) — API, écran et recette livrés et validés** (2026-11-16/17) : clôture/réouverture de session, présences aux séances, mutants (42/43, un survivant expliqué), Newman, fiches de test. ADR-0016.

**Lot (b) — API, écran et recette livrés et validés le 2026-11-23** : évaluations (note sur 20) et seuils d'éligibilité (calcul et suggestion, jamais de délivrance), mutants (35/36, un survivant expliqué), Newman, fiches de test. ADR-0017. **Reste à faire** : lot (c) — certificats, attestations, révocation, suggestion d'ambassadeur (S6, S8, S9) — sur feu vert de la Direction produit.
