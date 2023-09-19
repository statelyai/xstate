# Glossaire

[The World of Statecharts (Glossary)](https://statecharts.dev/glossary/).

## Action

Une action est un [effet](../guides/effects.md) exécuté lors d'une transition d'état. Les actions sont exécutés sans qu'il soit nécessaire d'attendre une réponse.

## Acteur

Un acteur est une entité qui peut envoyer des messages à d'autres acteurs, recevoir des messages, changer d'état et créer (engendrer) d'autres acteurs.

## État atomique

Un état atomique est un état qui n'a pas d'états enfants. En opposition à l'état composé.

## État composé

Un état composé a au moins un état enfant. L'un de ces états enfants doit être l'état initial, qui est l'état d'entrée (on considérera un état composé comme une mini machine à états finis) par défaut lorsque l'état composé parent est entré.

## Condition

Se référer à [condition](#guard).

## Action d'entrée (à l'entrée de l'état)

Une action d'entrée est une [action](#action) qui est exécutée lorsque l'on rentre dans un nouvel état. Elle est exécutée en tout une fois, lorsque l'état est signalé.

## Événement

Un événement est l'action de déclencher une transiion. C'est l'utilisateur qui la déclenche le plus souvent. Les machines d'état les reçoivent et éxécutent la potentielle transition.

## Transition sans événement

Une transition sans événement est une transition qui est automatiquement prise lorsque son état parent est actif.

## Action de sortie (à la sortie de l'état)

Une action de sortie est une [action](#action) qui est exécutée lorsque son état parent est quitté.

## External transition

Dans SCXML, une transition externe est une transition qui quitte l'état source lorsque l'état cible est un descendant de l'état source. Voir [selecting transitions (SCXML)](https://www.w3.org/TR/scxml/#SelectingTransitions) pour plu de détails.

## État final

Un état final est une indication que la machine est "en fin de vie", et qu'aucun autre événement ne sera géré à partir de celui-ci.

## Sécurité

Une sécurité est une fonction retournant un booléan qui détermine si une transition sera éffectuée (si la condition est évaluée à _true_) ou non (_false_). Également appelée [condition](#condition).

## État de l'historique

Un état d'historique est un pseudo-état qui se souviendra et effectuera la transition vers les états antérieurs les plus récemment actifs de son état parent, ou un état cible par défaut.

## Etat initial

Considérons un état composé C. L'état initial I de C est l'état enfant de C par lequel il débutera. C'est le premier enfant de C et les prochains évènements internes à C se feront à partir de I, qui pourra éventuellement migré vers un état lambda de C.

## Evénement interne

Un événement interne est un événement déclenché par la machine d'état elle-même. Les événements internes sont traités immédiatement après l'événement précédent.

Dans SCXML, une transition interne est une transition qui passe à un état cible descendant sans quitter l'état source. Il s'agit du comportement de transition par défaut. Voir [selecting transitions (SCXML)](https://www.w3.org/TR/scxml/#SelectingTransitions) pour plus de détails.

## Modèle mathématique de calcul

Un modèle mathématique de calcul est une façon de décrire comment les choses sont calculées . Exemple : Étant donné une entrée, quelle sera la sortie ?
Avec les machines à états et les diagrammes d'états, la fonction pertinente est la _fonction de transition d'état_ (voir [Finite state machine: Mathematical model (Wikipedia)](https://en.wikipedia.org/wiki/Finite-state_machine#Mathematical_model))

Voir [Modèle de calcul (Wikipedia)](https://en.wikipedia.org/wiki/Model_of_computation) et [Mathematical model (Wikipedia)](https://en.wikipedia.org/wiki/Mathematical_model) pour plus d'informations .

## État orthogonal

Voir [état parallèle](#parallel-state).

## État parallèle

Un état parallèle est un état composé où tous ses états enfants (appelés _regions_) sont actifs simultanément. Les états enfants d'un état parallèle sont indépendants l'un de l'autre.

## Pseudo-état

Un état transitoire ; par exemple, un [état initial](#initial-state) ou un [état d'historique](#history-state).

## Événement déclenché

Voir [événement interne](#événement-interne).

## Service

Un service est une [machine](#state-machine) interprétée ; c'est-à-dire un [acteur](#acteur) qui représente une machine. C'est le service que l'on utilise pour intéragir avec la machine le plus souvent.

## State machine

## Machine d'état

Une machine à états est un modèle mathématique du comportement d'un système. Il décrit le comportement via les [états](#state), les [évènements](#event) et les [transitions](#transition).

## État

Un état représente le comportement global d'une machine d'état. Dans les diagrammes d'états, l'état est l'agrégat de tous les états actifs (qui peuvent être atomiques, composés, parallèles et/ou finaux).

## État transitoire

Un état transitoire est un état qui n'a que des [transitions sans événement](#eventless-transition).

## Transition

Une transition est une description de la cible-[état(s)](#état) et des[actions](#action) d'une machine d'état lorsqu'un [événement](#événement) spécifique est déclenché.

## Formalisme visuel

Un formalisme visuel est un langage exact (comme un langage de programmation) qui utilise principalement des symboles visuels (états, transitions, etc.) au lieu uniquement de code ou de texte. Les diagrammes d'états sont des formalismes visuels.

> Les formalismes visuels sont des langages schématiques et intuitifs, mais mathématiquement rigoureux.
>
> – https://link.springer.com/referenceworkentry/10.1007%2F978-0-387-39940-9_444
