# Concepts

XState est une bibliothèque permettant de créer, interpréter et exécuter des machines à états finis et des diagrammes d'états. Elle permet aussi de gérer les invocations de ces machines en tant qu'acteurs. Les concepts informatiques fondamentaux suivants sont importants pour savoir comment tirer le meilleur parti de XState, et en général pour tous vos projets logiciels actuels et futurs.

## Machines à états finis

Une machine à états finis est un modèle mathématique de calcul qui décrit le comportement d'un système qui est dans un seul état à la fois. Par exemple, supposons une machine à états avec un nombre fini (2) d'états : "endormi" et "éveillé". À tout moment, vous êtes soit "endormi", soit "éveillé". Il vous est impossible d'être à la fois « endormi » et « éveillé » en même temps, et il vous est impossible de n'être ni « endormi » ni « éveillé ».

Généralement, les machines à états finis ont cinq caractéristiques :

- Un nombre fini d'**états**
- Un nombre fini d'**événements**
- Un **état initial**
- Une **fonction de transition** qui fait migrer vers l'état suivant en fonction des paramètres et de l'évenement
- Un ensemble (qui peut être vide) d'**états finaux**

Un **état** fait référence à un "mode" ou "état" fini, d'un système modélisé par une machine à états, et ne décrit pas toutes les données (éventuellement infinies) liées à ce système. Il est de nature _qualitatif_, condition siné qua none d'un nombre fini d'**étas**.
Par exemple, l'eau peut être dans l'un des 4 états : "glace", "liquide", "gaz" ou "plasma". Cependant, la température de l'eau peut varier et sa mesure est _quantitative_ et infinie.

Plus de ressources:

- [Finite-state machine](https://en.wikipedia.org/wiki/Finite-state_machine) Wikipédia
- [Understanding State Machines](https://www.freecodecamp.org/news/state-machines-basics-of-computer-science-d42855debc66/) par Mark Shead
- [▶️ A-Level Comp Sci: Finite State Machine](https://www.youtube.com/watch?v=4rNYAvsSkwk)

## Diagrammes d'états

Les diagrammes d'états sont un formalisme permettant de modéliser des systèmes réactifs avec état. L'informaticien David Harel a présenté ce formalisme comme une extension des machines à états dans son article de 1987 [Statecharts : A Visual Formalism for Complex Systems](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf). Certaines des extensions incluent :

- Transitions sécurisées
- Actions (entrée, sortie, transition)
- État étendu ou une extension infinie (quantitative) de l'état (contexte)
- États orthogonaux (parallèles)
- États hiérarchiques (imbriqués)
- Historique des états passés

More resources:

- [Statecharts: A Visual Formalism for Complex Systems](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf) par David Harel
- [The World of Statecharts](https://statecharts.github.io/) par Erik Mogensen

## Le modèle de l'acteur

Le modèle de l'**acteur** est un autre modèle mathématique de calcul très ancien qui se marie bien avec les machines à états. Il précise que toute chose peut être représenté par un « acteur ». Un **acteur** peut faire trois choses:

- **Recevoir** des messages
- **Envoyer** des messages aux autres acteurs
- Éxécuter une action avec les messages qu'il a reçus (son **comportement**), comme :
  - changer son état local (_qualititatif_ et _quantitatif_)
  - envoyer des messages aux autres acteurs
  - _générer_ de nouveaux acteurs

Le comportement d'un acteur peut être décrit par une machine à états (ou un diagramme d'états).

Davantage de ressources:

- [Actor model](https://en.wikipedia.org/wiki/Actor_model) Wikipédia
- [The actor model in 10 minutes](https://www.brianstorti.com/the-actor-model/) par Brian Storti
