# Les enjeux

## Les enjeux de l'API

- Adhésion à la [Spécification SCXML de la W3C](https://www.w3.org/TR/scxml/) et le formalisme original des statecharts de David Harel
- Promouvoir une architecture basée sur les événements [Actor model](https://en.wikipedia.org/wiki/Actor_model)
- Compatibilité avec tous les frameworks et plateformes
- Possibilité de sérialiser complètement les définitions de machine en JSON (et SCXML)
- API `createMachine(...)` pure et fonctionnelle
- Zéro dépendances

## Choisir XState

Si vous décidez d'utiliser XState, [John Yanarella](https://github.com/CodeCatalyst) a très bien résumé ses raisons (liens et accent mis sur moi):

> Lorsque j'ai fait ce même choix quant à savoir si j'utilisais et défendais l'utilisation de XState là où je travaillais, les choses qui m'ont marqué étaient :
>
> 1. L'**engagement à comprendre l'état de la technique pertinent** et à éclairer la mise en œuvre sur la base d'articles de recherche existants ([article original sur les statecharts](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf) par Harel), Livres (Horrocks' ["Constructing the User Interface with Statecharts"](https://www.amazon.com/Constructing-User-Interface-Statecharts-Horrocks/dp/0201342782/ref=sr_1_3?ie=UTF8&qid=1548690916&sr=8-3&keywords=statecharts)), et les standards ([W3C's SCXML](https://www.w3.org/TR/scxml/)).
>
> La plupart des autres bibliothèques que j'ai examinées en cours de route sont des projets qui s'arrêtent au point d'implémenter de simples machines à états finis. (Si c'est tout ce dont vous avez besoin - et c'est peut-être le cas - David n'a pas tardé à souligner le peu de lignes qu'il faut pour lancer la vôtre.). Leur portée était raccourcie, car elles ne traitaient pas des limitations ultérieures qui peuvent être surmontées via un diagramme d'état.
>
> XState repose sur de bonnes bases en adoptant [la spécification SCXML du W3C](https://www.w3.org/TR/scxml/) - il bénéficie des recherches de ce groupe de travail sur les cas extrêmes.
>
> 2. C'est un **refuge du "syndrome de l'objet brillant"** consistant à adopter la dernière "bibliothèque de gestion d'état" du mois. Il implémente fidèlement un formalisme vieux de plus de 30 ans. Vous finissez par mettre votre logique la plus importante dans quelque chose que vous pouvez emporter avec vous dans n'importe quel framework d'interface utilisateur (et potentiellement dans d'autres implémentations dans d'autres langages). C'est une bibliothèque sans dépendance.
>
> Le monde du développement Front est le Far West, et il pourrait apprendre de ce que d'autres disciplines d'ingénierie ont connu et employé pendant des années.
>
> 3. Il a **passé un seuil critique de maturité** depuis la version 4, notamment depuis l'introduction du [visualiseur](https://statecharts.github.io/xstate-viz). Et ce n'est que la partie émergée de l'iceberg de ce qu'il pourrait accomplir ensuite, car lui (et [sa communauté] (https://github.com/statelyai/xstate/discussions)) ont introduit des outils qui tirent parti de la façon dont un diagramme d'état peut être visualisé, analysé et testé.
>
> 4. La **communauté** qui grandit tout autour et la prise de conscience qu'elle apporte aux machines à états finis et aux diagrammes d'états. Si vous relisez cet historique gitter, il y a une multitude de liens vers des articles de recherche, d'autres implémentations FSM et Statechart, etc. qui ont été collectés par [Erik Mogensen](https://twitter.com/mogsie) sur [statecharts.github.io](https://statecharts.github.io).
