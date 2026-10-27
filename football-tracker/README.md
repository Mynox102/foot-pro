# ⚽ Football Progression Tracker

Application web personnelle moderne, épurée et sombre pour le suivi complet de votre progression au football.

---

## 🌟 Fonctionnalités Principales

### 1. 📅 Calendrier Hebdomadaire
- Navigation semaine par semaine avec repère visuel du jour actuel.
- Ajout de séances d'entraînement avec **date, heure, durée, titre et catégorie** :
  - **Technique** (vert émeraude)
  - **Vitesse** (bleu ciel)
  - **Endurance** (ambre)
  - **Poids du corps** (violet)
- Gestion des 3 statuts : **Prévu**, **Terminé**, **Non réalisé**.
- **Panneau latéral de détails** complet :
  - Modification et suppression de la séance.
  - Changement de statut rapide en 1 clic.
  - **Liste d'exercices personnalisés** (nom, répétitions/temps, cases à cocher).
  - Évaluation de l'intensité ressentie (**RPE 1 à 10**).
  - Notes de séance et **Bilan personnel** (points forts, axes de progression).

### 2. 📊 Statistiques & Charge de Travail
- **Graphique multi-courbes** : suivi du nombre d'entraînements terminés par semaine, avec **4 courbes distinctes** pour chaque catégorie.
- **Graphique du temps total d'entraînement par semaine** (volume horaire en heures).
- **Filtre de période interactif** : 4 semaines, 8 semaines, 12 semaines, 6 mois, Tout l'historique.
- Indicateurs clés en temps réel : volume horaire cumulé, taux de complétion, catégorie prédominante.

### 3. ⚡ Tests Physiques Personnalisés
- Création libre de tests avec :
  - **Nom du test** et protocole d'évaluation.
  - **3 types de mesures pris en charge** :
    1. **Temps** (ex: chrono sprint 30m en secondes)
    2. **Nombre** (ex: paliers VMA, jongles pied faible, pompes)
    3. **Réussites sur un nombre d'essais** (ex: 8 tirs cadrés sur 10)
  - **Unité personnalisable** (`s`, `km/h`, `jongles`, `tirs`, etc.).
- Ajout de mesures datées avec notes de conditions.
- **Calcul automatique du record personnel** (le meilleur chrono pour un test de temps, la valeur max pour un nombre, le meilleur ratio pour les essais).
- **Courbe de progression SVG individuelle** pour chaque test et historique chronologique avec option de suppression.

### 4. 🧠 Coach IA Football Connecté
- Interface conversationnelle avec un préparateur physique et entraîneur tactique virtuel.
- **Accès direct aux données de l'application** : l'IA consulte automatiquement votre calendrier d'entraînement, vos volumes par catégorie et l'historique de vos tests physiques.
- **Génération de programmes et séances en langage naturel** :
  - *« Propose-moi une séance axée vitesse et vivacité pour vendredi à 18h »*
  - Le coach structure la séance et affiche une **fiche de proposition interactive**.
  - **Demande de confirmation obligatoire** : un bouton *« Confirmer et ajouter au calendrier »* permet de valider l'action avant son enregistrement !
- **Intégration sécurisée de l'API Google Gemini** :
  - Compatible avec `gemini-3.8-flash` et `gemini-1.5-flash`.
  - Aucune fausse simulation : si la clé n'est pas renseignée, l'interface avertit clairement l'utilisateur et guide la configuration.
  - Bouton de test direct de la clé dans les paramètres.

---

## 🚀 Démarrage Rapide

### Option 1 : Double-cliquer sur le script
Double-cliquez simplement sur **`start.bat`** à la racine du dossier.

### Option 2 : En ligne de commande
```bash
# Avec Node.js installé :
node server.js

# Ou avec agy-node (Antigravity) :
agy-node server.js
```

L'application s'ouvre sur :  
👉 **`http://localhost:3000`**

---

## 🔑 Configuration du Coach IA (Clé Google Gemini Gratuite)

1. Rendez-vous sur [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Connectez-vous avec votre compte Google et cliquez sur **"Create API key"**.
3. Dans l'application, cliquez sur l'icône **⚙** à côté de **Coach IA** en bas de la barre latérale (ou sur le bandeau d'alerte).
4. Collez votre clé et cliquez sur **Tester la clé** puis **Enregistrer**.

> **Sécurité** : Votre clé est stockée localement dans le fichier `data/football_data.json` de votre machine et n'est transmise qu'aux serveurs sécurisés de Google.

---

## 💾 Persistance des Données & Sauvegardes

- Toutes vos données sont automatiquement enregistrées sur votre disque dans `data/football_data.json`.
- Un bouton **Données & Sauvegarde** dans la barre latérale permet d'exporter une copie JSON ou de restaurer des données en 1 clic.
