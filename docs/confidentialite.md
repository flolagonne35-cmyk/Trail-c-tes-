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

## Le coach

Le coach a deux modes.

- **Coach intégré** (par défaut) : il répond sur ton téléphone, à partir de ton programme. Rien
  n'est envoyé.
- **Coach en ligne** (facultatif, à activer toi-même sur l'écran du coach) : une intelligence
  artificielle, un modèle ouvert (Gemma de Google ou Llama de Meta) hébergé par **Cloudflare**,
  l'hébergeur du site. L'application lui envoie tes messages et un résumé de ton entraînement :
  course visée, niveau déclaré, records, jours et programme de la semaine, nombre de sorties depuis
  lundi. Tu peux lire ce résumé mot pour mot sur l'écran du coach.

Ne sont **jamais** envoyés : ton prénom, ta position, tes traces GPS, ta fréquence cardiaque.

Cloudflare ne conserve pas les messages envoyés au modèle et ne s'en sert pas pour entraîner de
modèles ; le traitement peut avoir lieu hors de l'Union européenne (clauses contractuelles types).
Avec la limite d'usage, notre serveur garde un jour ou deux un compteur de messages par adresse IP.
La conversation est gardée sur ton téléphone ; « Effacer la conversation » la supprime, et tu
désactives le coach en ligne d'un geste.

« Demander à mon IA » ouvre ChatGPT, Claude ou Le Chat avec ta question déjà écrite : c'est toi
qui l'envoies, avec ton compte, selon les conditions de ce service.

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
