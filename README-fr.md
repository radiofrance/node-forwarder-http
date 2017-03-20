# Forwarder HTTP

[![Build
Status](https://travis-ci.org/radiofrance/node-forwarder-http.svg?branch=master)](https://travis-ci.org/radiofrance/node-forwarder-http)

```forwarder-http``` est un utilitaire pour transférer des requêtes
HTTP/HTTPS à une liste de serveurs cible. À chaque requête :

Il est conçu pour être simple, configurable et extensible via toute sorte
d''événements.

Actuellement, seule les versions de node ```>=6.x.x``` sont supportées.

## Le cas d'usage à @RadioFrance

Certaines de nos applications reçoivent beaucoup de données en entrée, et ces
données doivent alimenter non seulement la production mais également les
environnements de développement et de test. Nous avions besoin d'une application
qui soit petite et très performante.

## Utilisation

Le meilleur moyen de l'expliquer est via un exemple

```
const Forwarder = require('forwarder-http')

const server = new Forwarder({
  // La liste de serveurs cible
  forwardTargets: ['http://target-nb-1.com', 'http://target-nb-2'],

  // Ajout d'un header à toute requête entrante
  forwardHeaders: {'token': 'some-complicated-hash'},

  // Définition du code de retour de l'application à chaque requête
  responseStatusCode: 204
})
```

Vous trouverez dans le répertoire [exemples](https://github.com/radiofrance/node-forwarder-http/forwarder/blob/master/examples) plusieurs autres types d'utilisation, comment utiliser les évenements, comment passer par HTTPS, ...

## Options

Le constructeur du `Forwarder` constructor a quelques options, dont le but est de permettre à l'utilisateur de contrôler comment chaque requête à chaque cible est faîte et la réponse au client.

- **https**: _bool_. Créer un serveur HTTPS (Défaut ```false```)
- **https**: _object_. Options à passer au constructeur _https.createServer_.
- **timeout**: _int_. Timeout dans les requêtes aux serveurs cible. (Défaut: null)
- **forwardTargets**: _array_. Liste des serveurs cible. Cf. [les exemples](https://github.com/radiofrance/node-forwarder-http/blob/master/examples).
- **forwardHeaders**: _object_. En-têtes à ajouter à la requête transférée. (Défaut: aucun)
- **forwardOpts**: _object_. Options  à passer au constructeur de la requête http/https. Voir [l'example](https://github.com/radiofrance/node-forwarder-http/blob/master/examples/using-https) et [toutes les options disponibles](https://nodejs.org/api/https.html#https_https_request_options_callback)
- **responseStatusCode**: Status code que le serveur envoie au client.
- **responseBody**: body que le serveur envoie au client.
- **responseHeaders**: En-têtes que le serveur doit ajouter à sa réponse.

## Événements

La libraire vous permeter d'écouter des événements tout le long du cicle de vie
du transfer des requêtes, et de tout modifier sur la route.

- **request** ```(incommingMessage, response)```: L'événement ```request``` du
serveur HTTP/HTTPS. Si vous appelez ```response.end()``` dans un callback callback, la requête ne sera pas transférée.
- **response** ```(incommingMessage, response)```: Appelé avant que le serveur
ne réponde au client.
- **requestError** ```(error, incommingMessage)```: erreur dans la gestion de la
requête arrivante.
- **forwardRequest** ```(options, incommingMessage)```: vous permet de modifier chaque
requête transférée à chaque cible. Le premier argument est le array passé aux constructeurs
[http.request](https://nodejs.org/api/http.html#http_http_request_options_callback) and
[https.request](https://nodejs.org/api/https.html#https_https_request_options_callback), après que
toutes les configurations ont été appliquées. Si vous faîtes ```options.cancel = true```, la requête actuelle ne
sera pas transférée à la cible courante. Vous trouverez dans les exemples un ... exemple de ceci.
- **forwardResponse** ```(request, incommingMessage)```: vous permet de
gérer chaque réponse de chaque cible.
- **forwardRequestError** ```(error, request)```: erreur dans une des
requêtes transférées.

Voir comment [utiliser les événements](https://github.com/radiofrance/node-forwarder-http/blob/master/examples/using-events.js).

## Remerciements

-
**[node-http-proxy](https://github.com/nodejitsu/node-http-proxy)**:
notre librairie a commencée comme une version simplifiée et modernisée de celle-ci. ```node-http-proxy``` peut également servir de proxy et supporte des versions de node plus anciennes. Elle ne permet cependant qu'une seule cible dans le transfer des requêtes, ce qui ne répondait pas à notre besoin. Finalement nous avons tout re-écrit, mais merci beaucoup aux équipes de [nodejitsu](https://nodejitsu.com/) pour l'inspiration.

