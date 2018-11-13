/**
 * Welcome to your Workbox-powered service worker!
 *
 * You'll need to register this file in your web app and you should
 * disable HTTP caching for this file too.
 * See https://goo.gl/nhQhGp
 *
 * The rest of the code is auto-generated. Please don't update this file
 * directly; instead, make changes to your Workbox build configuration
 * and re-run your build process.
 * See https://goo.gl/2aRDsh
 */

importScripts("workbox-v3.6.3/workbox-sw.js");
workbox.setConfig({modulePathPrefix: "workbox-v3.6.3"});

workbox.core.setCacheNameDetails({prefix: "gatsby-plugin-offline"});

workbox.skipWaiting();
workbox.clientsClaim();

/**
 * The workboxSW.precacheAndRoute() method efficiently caches and responds to
 * requests for URLs in the manifest.
 * See https://goo.gl/S9QRab
 */
self.__precacheManifest = [
  {
    "url": "webpack-runtime-11678f0e417a45e0817f.js"
  },
  {
    "url": "app-bb424ae2c920a662ed45.js"
  },
  {
    "url": "component---node-modules-gatsby-plugin-offline-app-shell-js-9c49c867da16740cb193.js"
  },
  {
    "url": "index.html",
    "revision": "46f93ae96f4c001bbeca6e1c9d28c1e0"
  },
  {
    "url": "offline-plugin-app-shell-fallback/index.html",
    "revision": "193f6e2136c1e8bdc778f8ee27843e4e"
  },
  {
    "url": "0.b6f197430f783b3e67aa.css"
  },
  {
    "url": "component---src-pages-index-md.f54fc3172bdcc895e000.css"
  },
  {
    "url": "component---src-pages-index-md-6f54d0efc79b3e9d284c.js"
  },
  {
    "url": "0-cd1b0e258db295904d86.js"
  },
  {
    "url": "static/d/864/path---index-6a9-YV2xtnt8tPyAY05Un6wm26zkpgI.json",
    "revision": "7e74f848bb043b2e9cb23f5e98bcaf25"
  },
  {
    "url": "component---src-pages-404-js.f54fc3172bdcc895e000.css"
  },
  {
    "url": "component---src-pages-404-js-5fb30b038d0d5ccc3a4f.js"
  },
  {
    "url": "static/d/164/path---404-html-516-62a-NZuapzHg3X9TaN1iIixfv1W23E.json",
    "revision": "c2508676a2f33ea9f1f0bf472997f9a0"
  },
  {
    "url": "static/d/520/path---offline-plugin-app-shell-fallback-a-30-c5a-NZuapzHg3X9TaN1iIixfv1W23E.json",
    "revision": "c2508676a2f33ea9f1f0bf472997f9a0"
  },
  {
    "url": "manifest.webmanifest",
    "revision": "63677c9c6da159326077da550af433a9"
  }
].concat(self.__precacheManifest || []);
workbox.precaching.suppressWarnings();
workbox.precaching.precacheAndRoute(self.__precacheManifest, {});

workbox.routing.registerNavigationRoute("/offline-plugin-app-shell-fallback/index.html", {
  whitelist: [/^[^?]*([^.?]{5}|\.html)(\?.*)?$/],
  blacklist: [/\?(.+&)?no-cache=1$/],
});

workbox.routing.registerRoute(/\.(?:png|jpg|jpeg|webp|svg|gif|tiff|js|woff|woff2|json|css)$/, workbox.strategies.staleWhileRevalidate(), 'GET');
workbox.routing.registerRoute(/^https:/, workbox.strategies.networkFirst(), 'GET');
"use strict";

/* global workbox */
self.addEventListener("message", function (event) {
  var api = event.data.api;

  if (api === "gatsby-runtime-cache") {
    var resources = event.data.resources;
    var cacheName = workbox.core.cacheNames.runtime;
    event.waitUntil(caches.open(cacheName).then(function (cache) {
      return Promise.all(resources.map(function (resource) {
        return cache.add(resource).catch(function (e) {
          // ignore TypeErrors - these are usually due to
          // external resources which don't allow CORS
          if (!(e instanceof TypeError)) throw e;
        });
      }));
    }));
  }
});