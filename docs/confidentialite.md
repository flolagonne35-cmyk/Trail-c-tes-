# Politique de confidentialité — premier jet

> Brouillon à faire relire avant publication. Il décrit fidèlement le fonctionnement **actuel**
> de l'application (version sans compte ni serveur). À mettre à jour à chaque nouvelle fonction
> qui envoie des données (comptes, classement, partage de position).

**Responsable** : [ton nom ou ta société], [adresse], [e-mail de contact].

## Ce qui reste sur ton téléphone

Ton profil (prénom ou pseudo, apparence de l'avatar, date de création), tes sorties importées
(fichiers GPX : trace, horaires, altitudes, fréquence cardiaque si ta montre l'enregistre), les
captures d'écran que tu ajoutes, tes réglages et tes lieux récents sont enregistrés **uniquement
sur ton téléphone**. Nous ne les recevons pas. Désinstaller l'application les efface.

## Ce qui est envoyé, à qui, et pourquoi

L'application utilise les services publics de l'**IGN** (Géoplateforme, data.geopf.fr), sans
compte ni identifiant :

| Quand | Ce qui est envoyé | Pourquoi |
|---|---|---|
| Tu cherches une adresse | le texte tapé et ta position approximative (pour classer les résultats proches) | trouver l'adresse |
| Tu ouvres une côte | la position du pied de la côte ; ta position de départ | afficher l'adresse, calculer le trajet en voiture et à pied |
| La carte s'affiche | les numéros des carrés de carte visibles (donc la zone regardée) | afficher le Plan IGN |
| Tu importes le GPX d'une course | les points du parcours | obtenir les altitudes IGN |

La recherche de **villes** et le calcul des **boucles**, des **séances** et de la **nutrition** se
font sur le téléphone, sans rien envoyer (hors coach, voir plus bas). Les **sorties** que tu importes ne sont jamais envoyées.

Conditions de l'IGN : cartes.gouv.fr (mentions légales et données personnelles de la Géoplateforme).

## Le coach (intelligence artificielle)

Le coach est facultatif. Rien n'est envoyé tant que tu n'as pas donné ton accord sur son écran.
Quand tu lui écris, l'application envoie à **Anthropic** (société américaine, modèle Claude), par
l'intermédiaire de notre serveur (Cloudflare) :

- tes messages et les réponses précédentes de la conversation ;
- un résumé de ton entraînement : course visée, niveau déclaré, records, jours et programme de la
  semaine, nombre de sorties depuis lundi. Tu peux lire ce résumé mot pour mot sur l'écran du coach.

Ne sont **jamais** envoyés : ton prénom, ta position, tes traces GPS, ta fréquence cardiaque.

Anthropic traite ces données aux **États-Unis** (transfert hors Union européenne, encadré par les
clauses contractuelles types de ses conditions commerciales), les conserve en principe 30 jours et
ne les utilise pas pour entraîner ses modèles. Notre serveur ne garde pas les conversations ; avec
la limite d'usage, il garde un jour ou deux un compteur de messages par adresse IP. La conversation
est gardée sur ton téléphone : « Effacer la conversation » ou « Retirer mon accord » la supprime.

N'écris pas d'informations médicales précises au coach. Ses réponses peuvent être fausses et ne
remplacent pas un médecin.

## Localisation

L'application demande ta position **seulement quand elle est ouverte**, pour trouver les côtes
proches. Tu peux refuser : il suffit alors de chercher une ville ou une adresse.

## Ce que nous ne faisons pas

Pas de publicité, pas de revente de données, pas de mesure d'audience, pas de traceur.

## Tes droits

Les données étant sur ton téléphone, tu en gardes la maîtrise (suppression en désinstallant).
Pour toute question : [e-mail]. Réclamation possible auprès de la CNIL (cnil.fr).

## À ajouter avec les comptes en ligne (plus tard)

Données envoyées au serveur (pseudo, points, sorties partagées), hébergement en Europe, durée de
conservation, suppression du compte depuis l'application, consentement explicite pour la
fréquence cardiaque (donnée de santé) et pour le partage de position en direct.
