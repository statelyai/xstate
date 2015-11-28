/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	var greuler = __webpack_require__(2);
	var estado = __webpack_require__(5);

	window.greuler = greuler;

	window.machine = estado.machine(`
	idle {
	  idle
	    -> err_insert_coin (SELECT)
	  dispensed
	    -> err_insert_coin (SELECT)
	  err_insert_coin
	    <- (SELECT)
	} -> wait_for_select (COIN)

	wait_for_select {
	  idle 
	    -> err_processing (COIN)
	  err_processing
	    <- (COIN)
	} -> dispensing (SELECT)

	dispensing {
	  idle
	    -> err_dispensing (COIN)
	    -> err_dispensing (SELECT)
	  err_dispensing
	    <- (SELECT)
	    <- (COIN)
	} -> idle.dispensed (DISPENSED)
	`);

	var nodes = [], links = [];

	function getNodes(node) {
	  node.states.map((state) => {
	    nodes.push({ id: state._id.join('.') });

	    getNodes(state);
	  });

	  node.transitions.map((transition) => {
	    links.push({
	      source: node._id.join('.'),
	      target: transition.targetState._id.join('.'),
	      weight: transition.event,
	    });

	    node.states.filter((state) => state.initial)
	      .map((state) => {
	        links.push({
	          source: node._id.join('.'),
	          target: state._id.join('.'),
	        })
	      })
	  });
	}

	getNodes(window.machine);

	function transition(state, action) {
	  window.m.selector.traverseAllEdgesBetween({
	    source: window.machine.getState(state)._id.join('.'),
	    target: window.machine.getState(window.machine.transition(state, action))._id.join('.')
	  }, {
	    keepStroke: false
	  });
	}

	window.transition = transition;

	window.m = greuler({
	  target: '#hello-world',
	  width: 900,
	  height: 900,
	  data: {
	    nodes: nodes,
	    links: links
	  },
	  directed: true
	}).update()

/***/ },
/* 1 */,
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	var require;var require;!function(t){if(true)module.exports=t();else if("function"==typeof define&&define.amd)define([],t);else{var e;e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,e.greuler=t()}}(function(){return function t(e,n,r){function i(a,u){if(!n[a]){if(!e[a]){var s="function"==typeof require&&require;if(!u&&s)return require(a,!0);if(o)return o(a,!0);var l=new Error("Cannot find module '"+a+"'");throw l.code="MODULE_NOT_FOUND",l}var d=n[a]={exports:{}};e[a][0].call(d.exports,function(t){var n=e[a][1][t];return i(n?n:t)},d,d.exports,t,e,n,r)}return n[a].exports}for(var o="function"==typeof require&&require,a=0;a<r.length;a++)i(r[a]);return i}({1:[function(t,e,n){"use strict";e.exports=function(t){return null==t?[]:Array.isArray(t)?t:[t]}},{}],2:[function(t,e,n){"use strict";function r(t){var e;if(arguments.length){if("number"!=typeof t||t!==t||t%1!==0||1>t)throw new TypeError("lcg()::invalid input argument. Seed must be a positive integer.");e=t}else e=Date.now()%1e8;return function(t){var n,r;if(!arguments.length)return e^=i,e=a*e%o,r=e/o,e^=i,r;if("number"!=typeof t||t!==t||t%1!==0||1>t)throw new TypeError("lcg()::invalid input argument. Array length must be a positive integer.");n=new Array(t);for(var u=0;t>u;u++)e^=i,e=a*e%o,n[u]=e/o,e^=i;return n}}var i=123459876,o=2147483647,a=16807;e.exports=r},{}],3:[function(t,e,n){"use strict";var r=Object.prototype.hasOwnProperty,i=Object.prototype.toString,o=function(t){return"function"==typeof Array.isArray?Array.isArray(t):"[object Array]"===i.call(t)},a=function(t){if(!t||"[object Object]"!==i.call(t))return!1;var e=r.call(t,"constructor"),n=t.constructor&&t.constructor.prototype&&r.call(t.constructor.prototype,"isPrototypeOf");if(t.constructor&&!e&&!n)return!1;var o;for(o in t);return"undefined"==typeof o||r.call(t,o)};e.exports=function u(){var t,e,n,r,i,s,l=arguments[0],d=1,c=arguments.length,f=!1;for("boolean"==typeof l?(f=l,l=arguments[1]||{},d=2):("object"!=typeof l&&"function"!=typeof l||null==l)&&(l={});c>d;++d)if(t=arguments[d],null!=t)for(e in t)n=l[e],r=t[e],l!==r&&(f&&r&&(a(r)||(i=o(r)))?(i?(i=!1,s=n&&o(n)?n:[]):s=n&&a(n)?n:{},l[e]=u(f,s,r)):"undefined"!=typeof r&&(l[e]=r));return l}},{}],4:[function(t,e,n){"use strict";function r(t){return t&&t.__esModule?t:{"default":t}}function i(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(n,"__esModule",{value:!0});var o=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}(),a=t("arrify"),u=r(a),s=t("extend"),l=r(s),d=t("./elements/node"),c=r(d),f=t("./elements/edge"),h=r(f),g=t("./Graph"),p=r(g),y=t("./selector/GreulerDefaultTransition"),v=r(y),m=window.d3,w=window.cola,k=function(){function t(e,n){i(this,t);var r=this;this.events=m.dispatch("layout","firstLayoutEnd"),this.markerId="marker-"+e,this.defaultOptions(n),this.createGraph(),this.selector=new v["default"](this),this.nodeDrawer=c["default"]().owner(this),this.edgeDrawer=h["default"]().owner(this),this.layout=w.d3adaptor(),this.layout.on("tick",function(){r.tick()});var o=!0;this.layout.on("end",function(){o&&(r.events.firstLayoutEnd(),o=!1)})}return o(t,[{key:"createGraph",value:function(){var t=this.options.data,e=t.nodes,n=t.links;t.nodes=[],t.links=[],this.graph=new p["default"](this,t),e.forEach(function(t){this.graph.addNode(t)},this),n.forEach(function(t){this.graph.addEdge(t)},this)}},{key:"defaultOptions",value:function(t){t=this.options=l["default"]({width:700,height:300,animationTime:1e3,labels:!0,directed:!1},t),this.options.data=l["default"]({nodes:[],links:[],groups:[],constraints:[],avoidOverlaps:!0,size:[t.width,t.height],linkDistance:function(t){return t.linkDistance||80}},this.options.data)}},{key:"initLayout",value:function(t){var e=this;if(!t.skipLayout){var n={nodes:!0,links:!0,groups:!0,constraints:!0,distanceMatrix:!0,size:!0};Object.keys(e.options.data).forEach(function(t){var r=e.options.data[t];n[t]?e.layout[t](u["default"](r)):e.layout[t].apply(e.layout,u["default"](r))},this),this.layout.start.apply(this.layout,t.iterations)}}},{key:"tick",value:function(){this.edgeGroup.call(this.edgeDrawer),this.nodeGroup.call(this.nodeDrawer)}},{key:"update",value:function(t){return t=l["default"](!0,{skipLayout:!1,iterations:[]},t),this.initLayout(t),this.build(t),t.skipLayout&&this.tick(),this}},{key:"build",value:function(){this.root=m.select(this.options.target).selectAll("svg.greuler").data([this.options]),this.root.enter=this.root.enter().append("svg").attr("class","greuler"),this.root.enter.append("svg:defs").append("svg:marker").attr("id",this.markerId).attr("viewBox","0 -5 10 10").attr("refX",9).attr("markerWidth",5).attr("markerHeight",5).attr("orient","auto").append("svg:path").attr("d","M0,-4L10,0L0,4L2,0").attr("stroke-width","0px").attr("fill-opacity",1).attr("fill","#777"),this.root.attr("width",this.options.width).attr("height",this.options.height),this.edgeGroup=this.root.selectAll("g.edges").data(function(t){return[t.data]}),this.edgeGroup.enter().append("g").attr("class","edges"),this.nodeGroup=this.root.selectAll("g.nodes").data(function(t){return[t.data]}),this.nodeGroup.enter().append("g").attr("class","nodes")}}]),t}();n["default"]=k,e.exports=n["default"]},{"./Graph":5,"./elements/edge":8,"./elements/node":9,"./selector/GreulerDefaultTransition":16,arrify:1,extend:3}],5:[function(t,e,n){"use strict";function r(t){return t&&t.__esModule?t:{"default":t}}function i(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}function o(t,e){for(var n=0;n<t.length;n+=1)if(t[n].id===e)return!0}Object.defineProperty(n,"__esModule",{value:!0});var a=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}(),u=t("extend"),s=r(u),l=t("./utils"),d=r(l),c=t("./const"),f={r:10,fill:"#2980B9"},h={stroke:c.colors.LIGHT_GRAY},g=function(){function t(e,n){i(this,t),this.owner=e,this.nodes=n.nodes,this.edges=n.links}return a(t,[{key:"addNode",value:function(){for(var e=0;e<arguments.length;e+=1){var n=arguments[e];if(!n.hasOwnProperty("id"))throw Error("the object must have the property `id`");if(this.getNode(n))throw Error("node already in store");this.nodes.push(t.appendNodeDefaults.call(this.owner,n))}}},{key:"getNode",value:function(t){return this.getNodesByFn(function(e){return e.id===t.id})[0]}},{key:"getNodesByFn",value:function(t){return this.nodes.filter(t)}},{key:"getAdjacentNodes",value:function(t){for(var e,n=[],r={},i=0;i<this.edges.length;i+=1){var o=this.edges[i];e=null,o.source.id===t.id?e=o.target:o.target.id===t.id&&(e=o.source),e&&!r[e.id]&&(r[e.id]=!0,n.push(e))}return n}},{key:"getSuccessorNodes",value:function(t){for(var e,n=[],r={},i=0;i<this.edges.length;i+=1){var o=this.edges[i];e=null,o.source.id===t.id&&(e=o.target),e&&!r[e.id]&&(r[e.id]=!0,n.push(e))}return n}},{key:"getPredecessorNodes",value:function(t){for(var e,n=[],r={},i=0;i<this.edges.length;i+=1){var o=this.edges[i];e=null,o.target.id===t.id&&(e=o.source),e&&!r[e.id]&&(r[e.id]=!0,n.push(e))}return n}},{key:"removeNode",value:function(t){this.removeNodesByFn(function(e){return e.id===t.id})}},{key:"removeNodes",value:function(t){this.removeNodesByFn(function(e){return o(t,e.id)})}},{key:"removeNodesByFn",value:function(t){var e;for(e=0;e<this.nodes.length;e+=1)if(t(this.nodes[e],e)){var n=this.nodes.splice(e,1);this.removeEdges(this.getIncidentEdges(n[0])),e-=1}}},{key:"addEdge",value:function(){for(var e=0;e<arguments.length;e+=1){var n=arguments[e];if(!n.hasOwnProperty("source")||!n.hasOwnProperty("target"))throw Error("the edge must have the properties `source` and `target`");var r=n.source,i=n.target;if("object"!=typeof r&&(r=this.getNode({id:n.source})),"object"!=typeof i&&(i=this.getNode({id:n.target})),!r||!i)throw Error("new edge does not join existing vertices");n.source=r,n.target=i,this.edges.push(t.appendEdgeDefaults.call(this.owner,n))}}},{key:"getEdge",value:function(t){return this.getEdgesByFn(function(e){return e.id===t.id})[0]}},{key:"getEdgesBetween",value:function(t){return this.getEdgesByFn(function(e){return e.source.id===t.source&&e.target.id===t.target})}},{key:"getAllEdgesBetween",value:function(t){return this.getEdgesByFn(function(e){return e.source.id===t.source&&e.target.id===t.target||e.source.id===t.target&&e.target.id===t.source})}},{key:"removeEdge",value:function(t){this.removeEdgesByFn(function(e){return e.id===t.id})}},{key:"removeEdges",value:function(t){this.removeEdgesByFn(function(e){return o(t,e.id)})}},{key:"removeEdgesByFn",value:function(t){var e;for(e=0;e<this.edges.length;e+=1)t(this.edges[e],e)&&(this.edges.splice(e,1),e-=1)}},{key:"getEdgesByFn",value:function(t){return this.edges.filter(t)}},{key:"getOutgoingEdges",value:function(t){return this.getEdgesByFn(function(e){return e.source.id===t.id})}},{key:"getIncomingEdges",value:function(t){return this.getEdgesByFn(function(e){return e.target.id===t.id})}},{key:"getIncidentEdges",value:function(t){return this.getOutgoingEdges(t).concat(this.getIncomingEdges(t))}},{key:"add",value:function(){for(var t=0;t<arguments.length;t+=1){var e=arguments[t];e.hasOwnProperty("source")&&e.hasOwnProperty("target")?this.addEdge(e):this.addNode(e)}}}],[{key:"appendNodeDefaults",value:function(t){return t.hasOwnProperty("id")||(t.id=d["default"].id()),t=s["default"]({},f,this.options.nodeDefaults,t),t.hasOwnProperty("width")||(t.width=2*t.r),t.hasOwnProperty("height")||(t.height=2*t.r),t}},{key:"appendEdgeDefaults",value:function(t){return t.hasOwnProperty("id")||(t.id=d["default"].id()),t=s["default"]({},h,this.options.edgeDefaults,t)}},{key:"random",value:function(t){function e(t,e){a[t][e]=a[e][t]=!0}t=s["default"]({order:10,size:15,connected:!1,multiGraph:!1,pseudoGraph:!1},t);var n,r,i,o=[],a=[];for(n=0;n<t.order;n+=1)a[n]=[],o.push({id:n});var u=[];if(n=0,t.connected){for(n=1;n<t.order;n+=1)i=Math.floor(Math.random()*n),e(n,i),u.push({source:n,target:i});n-=1}for(;n<t.size;n+=1)r=Math.floor(Math.random()*t.order),i=Math.floor(Math.random()*t.order),r!==i||t.pseudoGraph?a[r][i]&&!t.multiGraph?n-=1:(e(r,i),u.push({source:r,target:i})):n-=1;return{nodes:o,links:u}}}]),t}();n["default"]=g,e.exports=n["default"]},{"./const":7,"./utils":17,extend:3}],6:[function(t,e,n){"use strict";function r(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(n,"__esModule",{value:!0});var i=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}(),o=function(){function t(e,n){r(this,t),this.x=e,this.y=n}return i(t,null,[{key:"neg",value:function(e){return new t(-e.x,-e.y)}},{key:"len",value:function(e){return Math.sqrt(t.lenSq(e))}},{key:"lenSq",value:function(t){return t.x*t.x+t.y*t.y}},{key:"unit",value:function(e){if(0===e.x&&0===e.y)throw Error("the length of the vector is 0");var n=this.len(e);return new t(e.x/n,e.y/n)}},{key:"orthogonal",value:function(e){return new t(-e.y,e.x)}},{key:"angleDeg",value:function(t){return 180*Math.atan2(t.y,t.x)/Math.PI}},{key:"add",value:function(e,n){return new t(e.x+n.x,e.y+n.y)}},{key:"sub",value:function(e,n){return new t(e.x-n.x,e.y-n.y)}},{key:"dot",value:function(t,e){return t.x*e.x+t.y*e.y}},{key:"scale",value:function(e,n){return new t(e.x*n,e.y*n)}},{key:"mid",value:function(e,n){return t.scale(t.add(e,n),.5)}},{key:"angleBetween",value:function(e,n){return Math.acos(t.dot(e,n)/t.len(e)-t.len(n))}},{key:"rotate",value:function(e,n){var r=Math.cos(n),i=Math.sin(n),o=e.x*r-e.y*i,a=e.x*i+e.y*r;return new t(o,a)}}]),t}();n["default"]=o,e.exports=n["default"]},{}],7:[function(t,e,n){"use strict";Object.defineProperty(n,"__esModule",{value:!0});var r=window.d3,i=r.scale.category20(),o={},a=["BLUE","ORANGE","GREEN","RED","PURPLE","BROWN","PINK","GRAY","YELLOW","CYAN"];a.forEach(function(t,e){o[t]=i.range()[2*e],o["LIGHT_"+t]=i.range()[2*e+1]}),o.randomFromPalette=function(){return i.range()[Math.floor(20*Math.random())]},n.colors=o},{}],8:[function(t,e,n){"use strict";function r(t){return t&&t.__esModule?t:{"default":t}}Object.defineProperty(n,"__esModule",{value:!0});var i=t("extend"),o=r(i),a=t("../Vector"),u=r(a),s=t("../utils"),l=r(s),d=window.d3;n["default"]=function(){function t(t,e){var n=t.r,r=u["default"].unit(u["default"].sub(e,t));return u["default"].add(t,u["default"].scale(r,n))}function e(t,e,n){function r(t){return t*Math.PI/180}for(var o=i.graph.getAdjacentNodes(t),a=new u["default"](0,0),s=0;s<o.length;s+=1){var l=o[s];t.id!==l.id&&(a=u["default"].unit(u["default"].add(a,u["default"].unit(u["default"].sub(t,l)))))}0===a.x&&0===a.y&&(a=u["default"].unit(new u["default"](0,-1)));var d=u["default"].orthogonal(a),c=u["default"].scale(a,t.r+4),f=r(25),h=f+(n-1)*f,g=u["default"].add(t,u["default"].rotate(c,h)),p=u["default"].add(t,u["default"].rotate(c,-h)),y=.6*e*(n+1),v=u["default"].add(t,u["default"].scale(a,t.r+y)),m=u["default"].add(g,u["default"].scale(a,.5*y)),w=u["default"].add(p,u["default"].scale(a,.5*y)),k=u["default"].add(m,u["default"].scale(d,y/4)),b=u["default"].add(w,u["default"].scale(d,-y/4));return{path:[g,k,v,b,p],dir:d}}function n(n,r,i){var a,s,l,d,c;if(a=n.source,s=n.target,a.id>s.id){var f=[s,a];a=f[0],s=f[1]}r[a.id]=r[a.id]||{},l=a,d=s,a.id!==s.id&&(l=t(a,s),d=t(s,a)),c=r[a.id][s.id]=r[a.id][s.id]||{count:1,mid:u["default"].mid(l,d),direction:-1};var h=[];if(a.id===s.id){var g=e(a,i,c.count);h=g.path,n.unit=g.dir}else{var p=u["default"].unit(u["default"].sub(s,a));o["default"](c,{unit:p,unitOrthogonal:u["default"].orthogonal(p)}),h.push(u["default"].add(c.mid,u["default"].scale(c.unitOrthogonal,Math.floor(c.count/2)*i*c.direction))),n.unit=c.unit}c.count+=1,c.direction*=-1;var y=t(n.source,h[0]),v=t(n.target,h[h.length-1]);n.path=[y].concat(h).concat([v])}function r(t){function e(t){t.attr("transform",function(t){var e=u["default"].angleDeg(t.unit),n=t.path[Math.floor(t.path.length/2)];return l["default"].transform({translate:n,rotate:e})})}var r=t.selectAll("g.edge").data(function(t){return t.links},function(t){return t.id});r.enter().append("g").attr("class","edge").attr("opacity",0).attr("id",function(t){return l["default"].ns(t.id)}).transition("enter").attr("opacity",1),r.each(function(t){var e=d.select(this),n={directed:t.directed||i.options.directed};n["source-"+t.source.id]=!0,n["target-"+t.target.id]=!0,e.classed(n)});var o={};r.each(function(t){n(t,o,17)});var s=r.selectAll("path").data(function(t){return[t,t]});s.enter().append("path").attr("stroke",function(t){return t.stroke}).attr("fill","transparent").attr("stroke-width",2).each(function(t,e){var n=d.select(this);n.attr("opacity",e?0:1),0===e&&n.classed("base",!0),1===e&&(n.attr("stroke-width",5),n.classed("traversal",!0))}),l["default"].conditionalTransition(s,!i.nodeDragging).attr("d",function(t){return a(t.path)}),s.each(function(t,e){var n=d.select(this),r=d.select(this.parentNode);0===e&&n.attr("marker-end",r.classed("directed")?"url(#"+i.markerId+")":null)});var c=r.selectAll("text").data(function(t){return[t]});c.enter().append("text").attr("font-size","9px").attr("dominant-baseline","text-after-edge").attr("text-anchor","middle").call(e),l["default"].conditionalTransition(c,!i.nodeDragging).text(function(t){return t.weight}).call(e),c.exit().remove(),r.exit().remove()}var i,a=d.svg.line().x(function(t){return t.x}).y(function(t){return t.y}).tension(1.5).interpolate("bundle");return r.owner=function(t){return arguments.length?(i=t,r):i},r},e.exports=n["default"]},{"../Vector":6,"../utils":17,extend:3}],9:[function(t,e,n){"use strict";function r(t){return t&&t.__esModule?t:{"default":t}}Object.defineProperty(n,"__esModule",{value:!0});var i=t("../utils"),o=r(i),a=t("../const"),u=window.d3;n["default"]=function(){function t(t){var n=t.selectAll("g.node").data(function(t){return t.nodes},function(t){return t.id}),r=e.layout,i=n.enter().append("g").attr("class",function(t){return"node "+(t["class"]||"")}).attr("id",function(t){return o["default"].ns(t.id)}).attr("transform",function(t){return o["default"].transform({translate:t})}).on("mouseover",function(){var t=u.select(this);t.over||t.style("cursor","pointer"),t.over=!0}).on("mouseout",function(){var t=u.select(this);t.over=!1,t.style("cursor",null)}).attr("opacity",0);i.transition("enter").attr("opacity",1),i.call(r.drag);var s=r.drag().on("dragstart.d3adaptor"),l=r.drag().on("dragend.d3adaptor");r.drag().on("dragstart.d3adaptor",function(){e.nodeDragging=!0,s.apply(void 0,arguments)}).on("dragend.d3adaptor",function(){e.nodeDragging=!1,l.apply(void 0,arguments)}),i.append("circle").attr("fill",function(t){return t.fill}).attr("r",function(t){return t.r}),i.append("text").classed("label",!0).attr("fill","white").attr("font-size","12px").attr("text-anchor","middle").attr("dominant-baseline","central"),n.selectAll("text.label").text(function(t){return"label"in t?t.label:t.id}),i.append("text").classed("outer-top-right",!0).attr("fill",a.colors.BLUE).attr("font-size","9px").attr("text-anchor","start").attr("x",function(t){return t.width/2-2}).attr("y",function(t){return-t.height/2+3}),n.selectAll("text.outer-top-right").text(function(t){return"topRightLabel"in t?t.topRightLabel:void 0}),i.append("text").classed("outer-top-left",!0).attr("fill",a.colors.BLUE).attr("font-size","9px").attr("text-anchor","end").attr("x",function(t){return-t.width/2-2}).attr("y",function(t){return-t.height/2+3}),n.selectAll("text.outer-top-left").text(function(t){return"topLeftLabel"in t?t.topLeftLabel:void 0}),o["default"].conditionalTransition(n,!e.nodeDragging).attr("transform",function(t){return o["default"].transform({translate:t})}),n.exit().remove()}var e;return t.owner=function(n){return arguments.length?(e=n,t):e},t},e.exports=n["default"]},{"../const":7,"../utils":17}],10:[function(t,e,n){"use strict";function r(t){return t&&t.__esModule?t:{"default":t}}function i(t){function e(t){var e=y.select(t.target),n=e.attr("greuler-id");return n||(n=d["default"].id(),e.attr("greuler-id",n),v[n]=new s["default"](n,t)),v[n]}return e(t)}Object.defineProperty(n,"__esModule",{value:!0});var o=t("./polyfills"),a=r(o),u=t("./Draw"),s=r(u),l=t("./utils"),d=r(l),c=t("./Graph"),f=r(c),h=t("./const"),g=t("./player/index"),p=r(g);a["default"]();var y=window.d3,v=[];i.Graph=f["default"],i.colors=h.colors,i.player=p["default"],n["default"]=i,e.exports=n["default"]},{"./Draw":4,"./Graph":5,"./const":7,"./player/index":13,"./polyfills":14,"./utils":17}],11:[function(t,e,n){"use strict";function r(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(n,"__esModule",{value:!0});var i=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}(),o=function(){function t(e,n){r(this,t),this.index=0,this.speed=n,this.actions=e,this.timer=null}return i(t,[{key:"play",value:function(){this.index<this.actions.length&&(this.actions[this.index++](),this.timer=setTimeout(this.play.bind(this),this.speed))}},{key:"pause",value:function(){clearTimeout(this.timer)}},{key:"stop",value:function(){this.pause(),this.index=0}}]),t}();n["default"]=o,e.exports=n["default"]},{}],12:[function(t,e,n){"use strict";function r(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(n,"__esModule",{value:!0});var i=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}(),o=function(){function t(e,n){r(this,t),this.instance=e,this.speed=n||e.options.animationTime,this.fn=null,this.timer=null}return i(t,[{key:"run",value:function(t){this.fn=t(this.instance),this.play()}},{key:"runAnimation",value:function(t){if(Array.isArray(t))return t.forEach(this.runAnimation,this);if("function"==typeof t)return t(this.instance);var e=this.instance[t.type];return e[t.op].apply(e,t.args||[])}},{key:"play",value:function(t){var e=this,n=this.fn.next(t);if(!n.done){var r=this.speed,i=this.runAnimation(n.value);i&&"object"==typeof i&&"number"==typeof i.delay&&(r=i.delay),this.timer=window.requestTimeout(function(){e.play(n.value)},r)}}},{key:"pause",value:function(){window.clearRequestTimeout(this.timer)}}]),t}();n["default"]=o,e.exports=n["default"]},{}],13:[function(t,e,n){"use strict";function r(t){return t&&t.__esModule?t:{"default":t}}Object.defineProperty(n,"__esModule",{value:!0});var i=t("./Fixed"),o=r(i),a=t("./Generator"),u=r(a);n["default"]={FixedInterval:o["default"],Generator:u["default"]},e.exports=n["default"]},{"./Fixed":11,"./Generator":12}],14:[function(t,e,n){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n["default"]=function(){!function(t,e){try{t.querySelector(":scope body")}catch(n){["querySelector","querySelectorAll"].forEach(function(n){var r=e[n];e[n]=function(e){if(/(^|,)\s*:scope/.test(e)){var i=this.id;this.id="ID_"+Date.now(),e=e.replace(/((^|,)\s*):scope/g,"$1#"+this.id);var o=t[n](e);return this.id=i,o}return r.call(this,e)}})}}(window.document,Element.prototype),window.requestAnimFrame=function(){return window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame||function(t,e){window.setTimeout(t,1e3/60)}}(),window.requestTimeout=function(t,e){function n(){var o=(new Date).getTime(),a=o-r;a>=e?t.call():i.value=requestAnimFrame(n)}if(!(window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame&&window.mozCancelRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame))return window.setTimeout(t,e);var r=(new Date).getTime(),i={};return i.value=requestAnimFrame(n),i},window.clearRequestTimeout=function(t){window.cancelAnimationFrame?window.cancelAnimationFrame(t.value):window.webkitCancelAnimationFrame?window.webkitCancelAnimationFrame(t.value):window.webkitCancelRequestAnimationFrame?window.webkitCancelRequestAnimationFrame(t.value):window.mozCancelRequestAnimationFrame?window.mozCancelRequestAnimationFrame(t.value):window.oCancelRequestAnimationFrame?window.oCancelRequestAnimationFrame(t.value):window.msCancelRequestAnimationFrame?window.msCancelRequestAnimationFrame(t.value):clearTimeout(t)}},e.exports=n["default"]},{}],15:[function(t,e,n){"use strict";function r(t){return t&&t.__esModule?t:{"default":t}}function i(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(n,"__esModule",{value:!0});var o=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}(),a=t("../utils"),u=r(a),s=t("extend"),l=r(s),d=function(){function t(e){i(this,t),this.owner=e,this.graph=e.graph,this.defaultStyleOptions={}}return o(t,[{key:"getDefaultStyleOptions",value:function(){return l["default"]({duration:this.getAnimationTime(),stroke:"#E74C3C"},this.defaultStyleOptions)}},{key:"getStyleOptions",value:function(t){return l["default"]({},this.getDefaultStyleOptions(),t)}},{key:"getAnimationTime",value:function(){return this.owner.options.animationTime}},{key:"select",value:function(t){return Array.isArray(t)||(t=[t]),t.length||t.push({id:-1}),t=t.filter(Boolean),this.owner.root.selectAll(t.map(function(t){return"#"+u["default"].ns(t.id)}).join(", "))}},{key:"innerEdgeSelector",value:function(t){return t.selectAll("path.base")}},{key:"innerNodeSelector",value:function(t){return t.selectAll("circle")}}]),t}();n["default"]=d,e.exports=n["default"]},{"../utils":17,extend:3}],16:[function(t,e,n){"use strict";function r(t){return t&&t.__esModule?t:{"default":t}}function i(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}function o(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function, not "+typeof e);t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),e&&(t.__proto__=e)}Object.defineProperty(n,"__esModule",{value:!0});var a=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}(),u=function(t,e,n){for(var r=!0;r;){var i=t,o=e,a=n;u=l=s=void 0,r=!1,null===i&&(i=Function.prototype);var u=Object.getOwnPropertyDescriptor(i,o);if(void 0!==u){if("value"in u)return u.value;var s=u.get;return void 0===s?void 0:s.call(a)}var l=Object.getPrototypeOf(i);if(null===l)return void 0;t=l,e=o,n=a,r=!0}},s=t("extend"),l=r(s),d=t("./Graph"),c=r(d),f=window.d3,h="highlight",g=function(t){function e(){i(this,e),u(Object.getPrototypeOf(e.prototype),"constructor",this).apply(this,arguments)}return o(e,t),a(e,[{key:"getEdges",value:function(){return this.innerEdgeSelector(this.select(this.graph.edges))}},{key:"getNodes",value:function(){return this.innerNodeSelector(this.select(this.graph.nodes))}},{key:"doTemporalHighlightNode",value:function(t,e){return this.innerNodeSelector(t).transition(h).duration(this.getAnimationTime()/2).attr("r",function(t){return e.r||1.5*t.r}).transition(h).duration(this.getAnimationTime()/2).attr("r",function(t){return t.r})}},{key:"doTemporalHighlightEdges",value:function(t,e){return this.innerEdgeSelector(t).transition(h).duration(this.getAnimationTime()/2).attr("stroke",e.stroke).transition(h).duration(this.getAnimationTime()/2).attr("stroke",function(t){return t.stroke})}},{key:"traverseEdgeWithDirection",value:function(t,e){var n=arguments.length<=2||void 0===arguments[2]?-1:arguments[2];return t.selectAll("path.traversal").each(function(){var t=f.select(this),n=this.getTotalLength();t.attr("stroke",e.stroke).attr("stroke-dasharray",n+" "+n).attr("stroke-dashoffset",n).attr("opacity",1)}).transition("dasharray").duration(e.duration).attr("stroke-dashoffset",function(t){var r=this.getTotalLength(),i=2*r,o=0;return-1!==n&&t.target.id===n&&(o=i),e.reverse&&(o=i-o),o}).attr("opacity",0).each("end",function(){var t=f.select(this);t.attr("stroke-dasharray",null).attr("stroke-dashoffset",null).attr("opacity",0)})}},{key:"traverseEdges",value:function(t,e,n){return e=l["default"]({keepStroke:!0,reverse:!1},this.getStyleOptions(),e),t.call(this.traverseEdgeWithDirection,e,n),e.keepStroke&&this.innerEdgeSelector(t).transition("update").duration(e.duration).attr("stroke",e.stroke),this.innerEdgeSelector(t)}},{key:"getNode",value:function(t){return this.innerNodeSelector(this.select(this.graph.getNode(t)))}},{key:"getEdge",value:function(t){return this.innerEdgeSelector(this.select(this.graph.getEdge(t)))}},{key:"highlightNode",value:function(t,e){return this.doTemporalHighlightNode(this.select(this.graph.getNode(t)),this.getStyleOptions(e))}},{key:"highlightEdge",value:function(t,e){return this.doTemporalHighlightEdges(this.select(this.graph.getEdge(t)),this.getStyleOptions(e))}},{key:"highlightIncidentEdges",value:function(t,e){return this.doTemporalHighlightEdges(this.select(this.graph.getIncidentEdges(t)),this.getStyleOptions(e))}},{key:"highlightOutgoingEdges",value:function(t,e){return this.doTemporalHighlightEdges(this.select(this.graph.getOutgoingEdges(t)),this.getStyleOptions(e))}},{key:"highlightIncomingEdges",value:function(t,e){return this.doTemporalHighlightEdges(this.select(this.graph.getIncomingEdges(t)),this.getStyleOptions(e))}},{key:"traverseOutgoingEdges",value:function(t,e){return this.traverseEdges(this.select(this.graph.getOutgoingEdges(t)),this.getStyleOptions(e))}},{key:"traverseIncomingEdges",value:function(t,e){return this.traverseEdges(this.select(this.graph.getIncomingEdges(t)),this.getStyleOptions(e))}},{key:"traverseIncidentEdges",value:function(t,e){return this.traverseEdges(this.select(this.graph.getIncidentEdges(t)),this.getStyleOptions(e))}},{key:"traverseEdgesBetween",value:function(t,e){return this.traverseEdges(this.select(this.graph.getEdgesBetween(t)),this.getStyleOptions(e),t.source)}},{key:"traverseAllEdgesBetween",value:function(t,e){return this.traverseEdges(this.select(this.graph.getAllEdgesBetween(t)),this.getStyleOptions(e),t.source)}}]),e}(c["default"]);n["default"]=g,e.exports=n["default"]},{"./Graph":15,extend:3}],17:[function(t,e,n){"use strict";function r(t){return t&&t.__esModule?t:{"default":t}}Object.defineProperty(n,"__esModule",{value:!0});var i=t("compute-lcg"),o=r(i),a=o["default"](1);n["default"]={id:function(){var t=a(),e=String.fromCharCode(Math.floor(26*t)+97);return e+t.toString(16).substr(2)},transform:function(t){var e="";return"translate"in t&&(e+=" translate("+t.translate.x+", "+t.translate.y+")"),"rotate"in t&&(e+=" rotate("+t.rotate+")"),"scale"in t&&(e+=" scale("+t.scale+")"),e},transition:function(t){return t.transition("layout").duration(300).ease("linear")},conditionalTransition:function(t,e){return e?this.transition(t):t},ns:function(t){return"greuler-"+t}},e.exports=n["default"]},{"compute-lcg":2}]},{},[10])(10)});

/***/ },
/* 3 */,
/* 4 */,
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, '__esModule', {
	  value: true
	});

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

	var _dfa = __webpack_require__(6);

	var _dfa2 = _interopRequireDefault(_dfa);

	var _nfa = __webpack_require__(110);

	var _stateReducer = __webpack_require__(111);

	var _stateReducer2 = _interopRequireDefault(_stateReducer);

	var _utilsSignalFilter = __webpack_require__(112);

	var _utilsSignalFilter2 = _interopRequireDefault(_utilsSignalFilter);

	var _utilsMapState = __webpack_require__(113);

	var _utilsMatchesState = __webpack_require__(114);

	var _utilsMatchesState2 = _interopRequireDefault(_utilsMatchesState);

	var _parser = __webpack_require__(109);

	exports.machine = _dfa2['default'];
	exports.nfaMachine = _nfa.machine;
	exports.stateReducer = _stateReducer2['default'];
	exports.signalFilter = _utilsSignalFilter2['default'];
	exports.mapState = _utilsMapState.mapState;
	exports.mapOnEntry = _utilsMapState.mapOnEntry;
	exports.mapOnExit = _utilsMapState.mapOnExit;
	exports.matchesState = _utilsMatchesState2['default'];
	exports.parse = _parser.parse;

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, '__esModule', {
	  value: true
	});
	exports['default'] = machine;

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

	var _machine = __webpack_require__(7);

	var _machine2 = _interopRequireDefault(_machine);

	function machine(data) {
	  return new _machine2['default'](data, {
	    deterministic: true
	  });
	}

	module.exports = exports['default'];

/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, '__esModule', {
	  value: true
	});

	var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

	var _get = function get(_x4, _x5, _x6) { var _again = true; _function: while (_again) { var object = _x4, property = _x5, receiver = _x6; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x4 = parent; _x5 = property; _x6 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

	function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

	var _lodashObjectDefaults = __webpack_require__(8);

	var _lodashObjectDefaults2 = _interopRequireDefault(_lodashObjectDefaults);

	var _lodashFunctionCurry = __webpack_require__(35);

	var _lodashFunctionCurry2 = _interopRequireDefault(_lodashFunctionCurry);

	var _state = __webpack_require__(63);

	var _state2 = _interopRequireDefault(_state);

	var Machine = (function (_State) {
	  _inherits(Machine, _State);

	  function Machine(data) {
	    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

	    _classCallCheck(this, Machine);

	    _get(Object.getPrototypeOf(Machine.prototype), 'constructor', this).call(this, data);

	    this.options = (0, _lodashObjectDefaults2['default'])(options, {
	      deterministic: true
	    });

	    this.mapStateRefs();
	  }

	  _createClass(Machine, [{
	    key: 'transition',
	    value: function transition() {
	      var fromState = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];
	      var signal = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

	      var states = _get(Object.getPrototypeOf(Machine.prototype), 'transition', this).call(this, fromState, signal);

	      if (this.options.deterministic) {
	        return states.length ? states[0] : false;
	      }

	      return states;
	    }
	  }]);

	  return Machine;
	})(_state2['default']);

	exports['default'] = Machine;
	module.exports = exports['default'];

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	var assign = __webpack_require__(9),
	    assignDefaults = __webpack_require__(33),
	    createDefaults = __webpack_require__(34);

	/**
	 * Assigns own enumerable properties of source object(s) to the destination
	 * object for all destination properties that resolve to `undefined`. Once a
	 * property is set, additional values of the same property are ignored.
	 *
	 * **Note:** This method mutates `object`.
	 *
	 * @static
	 * @memberOf _
	 * @category Object
	 * @param {Object} object The destination object.
	 * @param {...Object} [sources] The source objects.
	 * @returns {Object} Returns `object`.
	 * @example
	 *
	 * _.defaults({ 'user': 'barney' }, { 'age': 36 }, { 'user': 'fred' });
	 * // => { 'user': 'barney', 'age': 36 }
	 */
	var defaults = createDefaults(assign, assignDefaults);

	module.exports = defaults;


/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	var assignWith = __webpack_require__(10),
	    baseAssign = __webpack_require__(26),
	    createAssigner = __webpack_require__(28);

	/**
	 * Assigns own enumerable properties of source object(s) to the destination
	 * object. Subsequent sources overwrite property assignments of previous sources.
	 * If `customizer` is provided it's invoked to produce the assigned values.
	 * The `customizer` is bound to `thisArg` and invoked with five arguments:
	 * (objectValue, sourceValue, key, object, source).
	 *
	 * **Note:** This method mutates `object` and is based on
	 * [`Object.assign`](http://ecma-international.org/ecma-262/6.0/#sec-object.assign).
	 *
	 * @static
	 * @memberOf _
	 * @alias extend
	 * @category Object
	 * @param {Object} object The destination object.
	 * @param {...Object} [sources] The source objects.
	 * @param {Function} [customizer] The function to customize assigned values.
	 * @param {*} [thisArg] The `this` binding of `customizer`.
	 * @returns {Object} Returns `object`.
	 * @example
	 *
	 * _.assign({ 'user': 'barney' }, { 'age': 40 }, { 'user': 'fred' });
	 * // => { 'user': 'fred', 'age': 40 }
	 *
	 * // using a customizer callback
	 * var defaults = _.partialRight(_.assign, function(value, other) {
	 *   return _.isUndefined(value) ? other : value;
	 * });
	 *
	 * defaults({ 'user': 'barney' }, { 'age': 36 }, { 'user': 'fred' });
	 * // => { 'user': 'barney', 'age': 36 }
	 */
	var assign = createAssigner(function(object, source, customizer) {
	  return customizer
	    ? assignWith(object, source, customizer)
	    : baseAssign(object, source);
	});

	module.exports = assign;


/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	var keys = __webpack_require__(11);

	/**
	 * A specialized version of `_.assign` for customizing assigned values without
	 * support for argument juggling, multiple sources, and `this` binding `customizer`
	 * functions.
	 *
	 * @private
	 * @param {Object} object The destination object.
	 * @param {Object} source The source object.
	 * @param {Function} customizer The function to customize assigned values.
	 * @returns {Object} Returns `object`.
	 */
	function assignWith(object, source, customizer) {
	  var index = -1,
	      props = keys(source),
	      length = props.length;

	  while (++index < length) {
	    var key = props[index],
	        value = object[key],
	        result = customizer(value, source[key], key, object, source);

	    if ((result === result ? (result !== value) : (value === value)) ||
	        (value === undefined && !(key in object))) {
	      object[key] = result;
	    }
	  }
	  return object;
	}

	module.exports = assignWith;


/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	var getNative = __webpack_require__(12),
	    isArrayLike = __webpack_require__(17),
	    isObject = __webpack_require__(15),
	    shimKeys = __webpack_require__(21);

	/* Native method references for those with the same name as other `lodash` methods. */
	var nativeKeys = getNative(Object, 'keys');

	/**
	 * Creates an array of the own enumerable property names of `object`.
	 *
	 * **Note:** Non-object values are coerced to objects. See the
	 * [ES spec](http://ecma-international.org/ecma-262/6.0/#sec-object.keys)
	 * for more details.
	 *
	 * @static
	 * @memberOf _
	 * @category Object
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names.
	 * @example
	 *
	 * function Foo() {
	 *   this.a = 1;
	 *   this.b = 2;
	 * }
	 *
	 * Foo.prototype.c = 3;
	 *
	 * _.keys(new Foo);
	 * // => ['a', 'b'] (iteration order is not guaranteed)
	 *
	 * _.keys('hi');
	 * // => ['0', '1']
	 */
	var keys = !nativeKeys ? shimKeys : function(object) {
	  var Ctor = object == null ? undefined : object.constructor;
	  if ((typeof Ctor == 'function' && Ctor.prototype === object) ||
	      (typeof object != 'function' && isArrayLike(object))) {
	    return shimKeys(object);
	  }
	  return isObject(object) ? nativeKeys(object) : [];
	};

	module.exports = keys;


/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	var isNative = __webpack_require__(13);

	/**
	 * Gets the native function at `key` of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @param {string} key The key of the method to get.
	 * @returns {*} Returns the function if it's native, else `undefined`.
	 */
	function getNative(object, key) {
	  var value = object == null ? undefined : object[key];
	  return isNative(value) ? value : undefined;
	}

	module.exports = getNative;


/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	var isFunction = __webpack_require__(14),
	    isObjectLike = __webpack_require__(16);

	/** Used to detect host constructors (Safari > 5). */
	var reIsHostCtor = /^\[object .+?Constructor\]$/;

	/** Used for native method references. */
	var objectProto = Object.prototype;

	/** Used to resolve the decompiled source of functions. */
	var fnToString = Function.prototype.toString;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/** Used to detect if a method is native. */
	var reIsNative = RegExp('^' +
	  fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
	  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
	);

	/**
	 * Checks if `value` is a native function.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
	 * @example
	 *
	 * _.isNative(Array.prototype.push);
	 * // => true
	 *
	 * _.isNative(_);
	 * // => false
	 */
	function isNative(value) {
	  if (value == null) {
	    return false;
	  }
	  if (isFunction(value)) {
	    return reIsNative.test(fnToString.call(value));
	  }
	  return isObjectLike(value) && reIsHostCtor.test(value);
	}

	module.exports = isNative;


/***/ },
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	var isObject = __webpack_require__(15);

	/** `Object#toString` result references. */
	var funcTag = '[object Function]';

	/** Used for native method references. */
	var objectProto = Object.prototype;

	/**
	 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objToString = objectProto.toString;

	/**
	 * Checks if `value` is classified as a `Function` object.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isFunction(_);
	 * // => true
	 *
	 * _.isFunction(/abc/);
	 * // => false
	 */
	function isFunction(value) {
	  // The use of `Object#toString` avoids issues with the `typeof` operator
	  // in older versions of Chrome and Safari which return 'function' for regexes
	  // and Safari 8 which returns 'object' for typed array constructors.
	  return isObject(value) && objToString.call(value) == funcTag;
	}

	module.exports = isFunction;


/***/ },
/* 15 */
/***/ function(module, exports) {

	/**
	 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
	 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(1);
	 * // => false
	 */
	function isObject(value) {
	  // Avoid a V8 JIT bug in Chrome 19-20.
	  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
	  var type = typeof value;
	  return !!value && (type == 'object' || type == 'function');
	}

	module.exports = isObject;


/***/ },
/* 16 */
/***/ function(module, exports) {

	/**
	 * Checks if `value` is object-like.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	 */
	function isObjectLike(value) {
	  return !!value && typeof value == 'object';
	}

	module.exports = isObjectLike;


/***/ },
/* 17 */
/***/ function(module, exports, __webpack_require__) {

	var getLength = __webpack_require__(18),
	    isLength = __webpack_require__(20);

	/**
	 * Checks if `value` is array-like.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
	 */
	function isArrayLike(value) {
	  return value != null && isLength(getLength(value));
	}

	module.exports = isArrayLike;


/***/ },
/* 18 */
/***/ function(module, exports, __webpack_require__) {

	var baseProperty = __webpack_require__(19);

	/**
	 * Gets the "length" property value of `object`.
	 *
	 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
	 * that affects Safari on at least iOS 8.1-8.3 ARM64.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {*} Returns the "length" value.
	 */
	var getLength = baseProperty('length');

	module.exports = getLength;


/***/ },
/* 19 */
/***/ function(module, exports) {

	/**
	 * The base implementation of `_.property` without support for deep paths.
	 *
	 * @private
	 * @param {string} key The key of the property to get.
	 * @returns {Function} Returns the new function.
	 */
	function baseProperty(key) {
	  return function(object) {
	    return object == null ? undefined : object[key];
	  };
	}

	module.exports = baseProperty;


/***/ },
/* 20 */
/***/ function(module, exports) {

	/**
	 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
	 * of an array-like value.
	 */
	var MAX_SAFE_INTEGER = 9007199254740991;

	/**
	 * Checks if `value` is a valid array-like length.
	 *
	 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
	 */
	function isLength(value) {
	  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
	}

	module.exports = isLength;


/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	var isArguments = __webpack_require__(22),
	    isArray = __webpack_require__(23),
	    isIndex = __webpack_require__(24),
	    isLength = __webpack_require__(20),
	    keysIn = __webpack_require__(25);

	/** Used for native method references. */
	var objectProto = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/**
	 * A fallback implementation of `Object.keys` which creates an array of the
	 * own enumerable property names of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names.
	 */
	function shimKeys(object) {
	  var props = keysIn(object),
	      propsLength = props.length,
	      length = propsLength && object.length;

	  var allowIndexes = !!length && isLength(length) &&
	    (isArray(object) || isArguments(object));

	  var index = -1,
	      result = [];

	  while (++index < propsLength) {
	    var key = props[index];
	    if ((allowIndexes && isIndex(key, length)) || hasOwnProperty.call(object, key)) {
	      result.push(key);
	    }
	  }
	  return result;
	}

	module.exports = shimKeys;


/***/ },
/* 22 */
/***/ function(module, exports, __webpack_require__) {

	var isArrayLike = __webpack_require__(17),
	    isObjectLike = __webpack_require__(16);

	/** Used for native method references. */
	var objectProto = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/** Native method references. */
	var propertyIsEnumerable = objectProto.propertyIsEnumerable;

	/**
	 * Checks if `value` is classified as an `arguments` object.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isArguments(function() { return arguments; }());
	 * // => true
	 *
	 * _.isArguments([1, 2, 3]);
	 * // => false
	 */
	function isArguments(value) {
	  return isObjectLike(value) && isArrayLike(value) &&
	    hasOwnProperty.call(value, 'callee') && !propertyIsEnumerable.call(value, 'callee');
	}

	module.exports = isArguments;


/***/ },
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	var getNative = __webpack_require__(12),
	    isLength = __webpack_require__(20),
	    isObjectLike = __webpack_require__(16);

	/** `Object#toString` result references. */
	var arrayTag = '[object Array]';

	/** Used for native method references. */
	var objectProto = Object.prototype;

	/**
	 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objToString = objectProto.toString;

	/* Native method references for those with the same name as other `lodash` methods. */
	var nativeIsArray = getNative(Array, 'isArray');

	/**
	 * Checks if `value` is classified as an `Array` object.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isArray([1, 2, 3]);
	 * // => true
	 *
	 * _.isArray(function() { return arguments; }());
	 * // => false
	 */
	var isArray = nativeIsArray || function(value) {
	  return isObjectLike(value) && isLength(value.length) && objToString.call(value) == arrayTag;
	};

	module.exports = isArray;


/***/ },
/* 24 */
/***/ function(module, exports) {

	/** Used to detect unsigned integer values. */
	var reIsUint = /^\d+$/;

	/**
	 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
	 * of an array-like value.
	 */
	var MAX_SAFE_INTEGER = 9007199254740991;

	/**
	 * Checks if `value` is a valid array-like index.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
	 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
	 */
	function isIndex(value, length) {
	  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
	  length = length == null ? MAX_SAFE_INTEGER : length;
	  return value > -1 && value % 1 == 0 && value < length;
	}

	module.exports = isIndex;


/***/ },
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	var isArguments = __webpack_require__(22),
	    isArray = __webpack_require__(23),
	    isIndex = __webpack_require__(24),
	    isLength = __webpack_require__(20),
	    isObject = __webpack_require__(15);

	/** Used for native method references. */
	var objectProto = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/**
	 * Creates an array of the own and inherited enumerable property names of `object`.
	 *
	 * **Note:** Non-object values are coerced to objects.
	 *
	 * @static
	 * @memberOf _
	 * @category Object
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names.
	 * @example
	 *
	 * function Foo() {
	 *   this.a = 1;
	 *   this.b = 2;
	 * }
	 *
	 * Foo.prototype.c = 3;
	 *
	 * _.keysIn(new Foo);
	 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
	 */
	function keysIn(object) {
	  if (object == null) {
	    return [];
	  }
	  if (!isObject(object)) {
	    object = Object(object);
	  }
	  var length = object.length;
	  length = (length && isLength(length) &&
	    (isArray(object) || isArguments(object)) && length) || 0;

	  var Ctor = object.constructor,
	      index = -1,
	      isProto = typeof Ctor == 'function' && Ctor.prototype === object,
	      result = Array(length),
	      skipIndexes = length > 0;

	  while (++index < length) {
	    result[index] = (index + '');
	  }
	  for (var key in object) {
	    if (!(skipIndexes && isIndex(key, length)) &&
	        !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
	      result.push(key);
	    }
	  }
	  return result;
	}

	module.exports = keysIn;


/***/ },
/* 26 */
/***/ function(module, exports, __webpack_require__) {

	var baseCopy = __webpack_require__(27),
	    keys = __webpack_require__(11);

	/**
	 * The base implementation of `_.assign` without support for argument juggling,
	 * multiple sources, and `customizer` functions.
	 *
	 * @private
	 * @param {Object} object The destination object.
	 * @param {Object} source The source object.
	 * @returns {Object} Returns `object`.
	 */
	function baseAssign(object, source) {
	  return source == null
	    ? object
	    : baseCopy(source, keys(source), object);
	}

	module.exports = baseAssign;


/***/ },
/* 27 */
/***/ function(module, exports) {

	/**
	 * Copies properties of `source` to `object`.
	 *
	 * @private
	 * @param {Object} source The object to copy properties from.
	 * @param {Array} props The property names to copy.
	 * @param {Object} [object={}] The object to copy properties to.
	 * @returns {Object} Returns `object`.
	 */
	function baseCopy(source, props, object) {
	  object || (object = {});

	  var index = -1,
	      length = props.length;

	  while (++index < length) {
	    var key = props[index];
	    object[key] = source[key];
	  }
	  return object;
	}

	module.exports = baseCopy;


/***/ },
/* 28 */
/***/ function(module, exports, __webpack_require__) {

	var bindCallback = __webpack_require__(29),
	    isIterateeCall = __webpack_require__(31),
	    restParam = __webpack_require__(32);

	/**
	 * Creates a `_.assign`, `_.defaults`, or `_.merge` function.
	 *
	 * @private
	 * @param {Function} assigner The function to assign values.
	 * @returns {Function} Returns the new assigner function.
	 */
	function createAssigner(assigner) {
	  return restParam(function(object, sources) {
	    var index = -1,
	        length = object == null ? 0 : sources.length,
	        customizer = length > 2 ? sources[length - 2] : undefined,
	        guard = length > 2 ? sources[2] : undefined,
	        thisArg = length > 1 ? sources[length - 1] : undefined;

	    if (typeof customizer == 'function') {
	      customizer = bindCallback(customizer, thisArg, 5);
	      length -= 2;
	    } else {
	      customizer = typeof thisArg == 'function' ? thisArg : undefined;
	      length -= (customizer ? 1 : 0);
	    }
	    if (guard && isIterateeCall(sources[0], sources[1], guard)) {
	      customizer = length < 3 ? undefined : customizer;
	      length = 1;
	    }
	    while (++index < length) {
	      var source = sources[index];
	      if (source) {
	        assigner(object, source, customizer);
	      }
	    }
	    return object;
	  });
	}

	module.exports = createAssigner;


/***/ },
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	var identity = __webpack_require__(30);

	/**
	 * A specialized version of `baseCallback` which only supports `this` binding
	 * and specifying the number of arguments to provide to `func`.
	 *
	 * @private
	 * @param {Function} func The function to bind.
	 * @param {*} thisArg The `this` binding of `func`.
	 * @param {number} [argCount] The number of arguments to provide to `func`.
	 * @returns {Function} Returns the callback.
	 */
	function bindCallback(func, thisArg, argCount) {
	  if (typeof func != 'function') {
	    return identity;
	  }
	  if (thisArg === undefined) {
	    return func;
	  }
	  switch (argCount) {
	    case 1: return function(value) {
	      return func.call(thisArg, value);
	    };
	    case 3: return function(value, index, collection) {
	      return func.call(thisArg, value, index, collection);
	    };
	    case 4: return function(accumulator, value, index, collection) {
	      return func.call(thisArg, accumulator, value, index, collection);
	    };
	    case 5: return function(value, other, key, object, source) {
	      return func.call(thisArg, value, other, key, object, source);
	    };
	  }
	  return function() {
	    return func.apply(thisArg, arguments);
	  };
	}

	module.exports = bindCallback;


/***/ },
/* 30 */
/***/ function(module, exports) {

	/**
	 * This method returns the first argument provided to it.
	 *
	 * @static
	 * @memberOf _
	 * @category Utility
	 * @param {*} value Any value.
	 * @returns {*} Returns `value`.
	 * @example
	 *
	 * var object = { 'user': 'fred' };
	 *
	 * _.identity(object) === object;
	 * // => true
	 */
	function identity(value) {
	  return value;
	}

	module.exports = identity;


/***/ },
/* 31 */
/***/ function(module, exports, __webpack_require__) {

	var isArrayLike = __webpack_require__(17),
	    isIndex = __webpack_require__(24),
	    isObject = __webpack_require__(15);

	/**
	 * Checks if the provided arguments are from an iteratee call.
	 *
	 * @private
	 * @param {*} value The potential iteratee value argument.
	 * @param {*} index The potential iteratee index or key argument.
	 * @param {*} object The potential iteratee object argument.
	 * @returns {boolean} Returns `true` if the arguments are from an iteratee call, else `false`.
	 */
	function isIterateeCall(value, index, object) {
	  if (!isObject(object)) {
	    return false;
	  }
	  var type = typeof index;
	  if (type == 'number'
	      ? (isArrayLike(object) && isIndex(index, object.length))
	      : (type == 'string' && index in object)) {
	    var other = object[index];
	    return value === value ? (value === other) : (other !== other);
	  }
	  return false;
	}

	module.exports = isIterateeCall;


/***/ },
/* 32 */
/***/ function(module, exports) {

	/** Used as the `TypeError` message for "Functions" methods. */
	var FUNC_ERROR_TEXT = 'Expected a function';

	/* Native method references for those with the same name as other `lodash` methods. */
	var nativeMax = Math.max;

	/**
	 * Creates a function that invokes `func` with the `this` binding of the
	 * created function and arguments from `start` and beyond provided as an array.
	 *
	 * **Note:** This method is based on the [rest parameter](https://developer.mozilla.org/Web/JavaScript/Reference/Functions/rest_parameters).
	 *
	 * @static
	 * @memberOf _
	 * @category Function
	 * @param {Function} func The function to apply a rest parameter to.
	 * @param {number} [start=func.length-1] The start position of the rest parameter.
	 * @returns {Function} Returns the new function.
	 * @example
	 *
	 * var say = _.restParam(function(what, names) {
	 *   return what + ' ' + _.initial(names).join(', ') +
	 *     (_.size(names) > 1 ? ', & ' : '') + _.last(names);
	 * });
	 *
	 * say('hello', 'fred', 'barney', 'pebbles');
	 * // => 'hello fred, barney, & pebbles'
	 */
	function restParam(func, start) {
	  if (typeof func != 'function') {
	    throw new TypeError(FUNC_ERROR_TEXT);
	  }
	  start = nativeMax(start === undefined ? (func.length - 1) : (+start || 0), 0);
	  return function() {
	    var args = arguments,
	        index = -1,
	        length = nativeMax(args.length - start, 0),
	        rest = Array(length);

	    while (++index < length) {
	      rest[index] = args[start + index];
	    }
	    switch (start) {
	      case 0: return func.call(this, rest);
	      case 1: return func.call(this, args[0], rest);
	      case 2: return func.call(this, args[0], args[1], rest);
	    }
	    var otherArgs = Array(start + 1);
	    index = -1;
	    while (++index < start) {
	      otherArgs[index] = args[index];
	    }
	    otherArgs[start] = rest;
	    return func.apply(this, otherArgs);
	  };
	}

	module.exports = restParam;


/***/ },
/* 33 */
/***/ function(module, exports) {

	/**
	 * Used by `_.defaults` to customize its `_.assign` use.
	 *
	 * @private
	 * @param {*} objectValue The destination object property value.
	 * @param {*} sourceValue The source object property value.
	 * @returns {*} Returns the value to assign to the destination object.
	 */
	function assignDefaults(objectValue, sourceValue) {
	  return objectValue === undefined ? sourceValue : objectValue;
	}

	module.exports = assignDefaults;


/***/ },
/* 34 */
/***/ function(module, exports, __webpack_require__) {

	var restParam = __webpack_require__(32);

	/**
	 * Creates a `_.defaults` or `_.defaultsDeep` function.
	 *
	 * @private
	 * @param {Function} assigner The function to assign values.
	 * @param {Function} customizer The function to customize assigned values.
	 * @returns {Function} Returns the new defaults function.
	 */
	function createDefaults(assigner, customizer) {
	  return restParam(function(args) {
	    var object = args[0];
	    if (object == null) {
	      return object;
	    }
	    args.push(customizer);
	    return assigner.apply(undefined, args);
	  });
	}

	module.exports = createDefaults;


/***/ },
/* 35 */
/***/ function(module, exports, __webpack_require__) {

	var createCurry = __webpack_require__(36);

	/** Used to compose bitmasks for wrapper metadata. */
	var CURRY_FLAG = 8;

	/**
	 * Creates a function that accepts one or more arguments of `func` that when
	 * called either invokes `func` returning its result, if all `func` arguments
	 * have been provided, or returns a function that accepts one or more of the
	 * remaining `func` arguments, and so on. The arity of `func` may be specified
	 * if `func.length` is not sufficient.
	 *
	 * The `_.curry.placeholder` value, which defaults to `_` in monolithic builds,
	 * may be used as a placeholder for provided arguments.
	 *
	 * **Note:** This method does not set the "length" property of curried functions.
	 *
	 * @static
	 * @memberOf _
	 * @category Function
	 * @param {Function} func The function to curry.
	 * @param {number} [arity=func.length] The arity of `func`.
	 * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
	 * @returns {Function} Returns the new curried function.
	 * @example
	 *
	 * var abc = function(a, b, c) {
	 *   return [a, b, c];
	 * };
	 *
	 * var curried = _.curry(abc);
	 *
	 * curried(1)(2)(3);
	 * // => [1, 2, 3]
	 *
	 * curried(1, 2)(3);
	 * // => [1, 2, 3]
	 *
	 * curried(1, 2, 3);
	 * // => [1, 2, 3]
	 *
	 * // using placeholders
	 * curried(1)(_, 3)(2);
	 * // => [1, 2, 3]
	 */
	var curry = createCurry(CURRY_FLAG);

	// Assign default placeholders.
	curry.placeholder = {};

	module.exports = curry;


/***/ },
/* 36 */
/***/ function(module, exports, __webpack_require__) {

	var createWrapper = __webpack_require__(37),
	    isIterateeCall = __webpack_require__(31);

	/**
	 * Creates a `_.curry` or `_.curryRight` function.
	 *
	 * @private
	 * @param {boolean} flag The curry bit flag.
	 * @returns {Function} Returns the new curry function.
	 */
	function createCurry(flag) {
	  function curryFunc(func, arity, guard) {
	    if (guard && isIterateeCall(func, arity, guard)) {
	      arity = undefined;
	    }
	    var result = createWrapper(func, flag, undefined, undefined, undefined, undefined, undefined, arity);
	    result.placeholder = curryFunc.placeholder;
	    return result;
	  }
	  return curryFunc;
	}

	module.exports = createCurry;


/***/ },
/* 37 */
/***/ function(module, exports, __webpack_require__) {

	var baseSetData = __webpack_require__(38),
	    createBindWrapper = __webpack_require__(40),
	    createHybridWrapper = __webpack_require__(43),
	    createPartialWrapper = __webpack_require__(61),
	    getData = __webpack_require__(50),
	    mergeData = __webpack_require__(62),
	    setData = __webpack_require__(59);

	/** Used to compose bitmasks for wrapper metadata. */
	var BIND_FLAG = 1,
	    BIND_KEY_FLAG = 2,
	    PARTIAL_FLAG = 32,
	    PARTIAL_RIGHT_FLAG = 64;

	/** Used as the `TypeError` message for "Functions" methods. */
	var FUNC_ERROR_TEXT = 'Expected a function';

	/* Native method references for those with the same name as other `lodash` methods. */
	var nativeMax = Math.max;

	/**
	 * Creates a function that either curries or invokes `func` with optional
	 * `this` binding and partially applied arguments.
	 *
	 * @private
	 * @param {Function|string} func The function or method name to reference.
	 * @param {number} bitmask The bitmask of flags.
	 *  The bitmask may be composed of the following flags:
	 *     1 - `_.bind`
	 *     2 - `_.bindKey`
	 *     4 - `_.curry` or `_.curryRight` of a bound function
	 *     8 - `_.curry`
	 *    16 - `_.curryRight`
	 *    32 - `_.partial`
	 *    64 - `_.partialRight`
	 *   128 - `_.rearg`
	 *   256 - `_.ary`
	 * @param {*} [thisArg] The `this` binding of `func`.
	 * @param {Array} [partials] The arguments to be partially applied.
	 * @param {Array} [holders] The `partials` placeholder indexes.
	 * @param {Array} [argPos] The argument positions of the new function.
	 * @param {number} [ary] The arity cap of `func`.
	 * @param {number} [arity] The arity of `func`.
	 * @returns {Function} Returns the new wrapped function.
	 */
	function createWrapper(func, bitmask, thisArg, partials, holders, argPos, ary, arity) {
	  var isBindKey = bitmask & BIND_KEY_FLAG;
	  if (!isBindKey && typeof func != 'function') {
	    throw new TypeError(FUNC_ERROR_TEXT);
	  }
	  var length = partials ? partials.length : 0;
	  if (!length) {
	    bitmask &= ~(PARTIAL_FLAG | PARTIAL_RIGHT_FLAG);
	    partials = holders = undefined;
	  }
	  length -= (holders ? holders.length : 0);
	  if (bitmask & PARTIAL_RIGHT_FLAG) {
	    var partialsRight = partials,
	        holdersRight = holders;

	    partials = holders = undefined;
	  }
	  var data = isBindKey ? undefined : getData(func),
	      newData = [func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary, arity];

	  if (data) {
	    mergeData(newData, data);
	    bitmask = newData[1];
	    arity = newData[9];
	  }
	  newData[9] = arity == null
	    ? (isBindKey ? 0 : func.length)
	    : (nativeMax(arity - length, 0) || 0);

	  if (bitmask == BIND_FLAG) {
	    var result = createBindWrapper(newData[0], newData[2]);
	  } else if ((bitmask == PARTIAL_FLAG || bitmask == (BIND_FLAG | PARTIAL_FLAG)) && !newData[4].length) {
	    result = createPartialWrapper.apply(undefined, newData);
	  } else {
	    result = createHybridWrapper.apply(undefined, newData);
	  }
	  var setter = data ? baseSetData : setData;
	  return setter(result, newData);
	}

	module.exports = createWrapper;


/***/ },
/* 38 */
/***/ function(module, exports, __webpack_require__) {

	var identity = __webpack_require__(30),
	    metaMap = __webpack_require__(39);

	/**
	 * The base implementation of `setData` without support for hot loop detection.
	 *
	 * @private
	 * @param {Function} func The function to associate metadata with.
	 * @param {*} data The metadata.
	 * @returns {Function} Returns `func`.
	 */
	var baseSetData = !metaMap ? identity : function(func, data) {
	  metaMap.set(func, data);
	  return func;
	};

	module.exports = baseSetData;


/***/ },
/* 39 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {var getNative = __webpack_require__(12);

	/** Native method references. */
	var WeakMap = getNative(global, 'WeakMap');

	/** Used to store function metadata. */
	var metaMap = WeakMap && new WeakMap;

	module.exports = metaMap;

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 40 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {var createCtorWrapper = __webpack_require__(41);

	/**
	 * Creates a function that wraps `func` and invokes it with the `this`
	 * binding of `thisArg`.
	 *
	 * @private
	 * @param {Function} func The function to bind.
	 * @param {*} [thisArg] The `this` binding of `func`.
	 * @returns {Function} Returns the new bound function.
	 */
	function createBindWrapper(func, thisArg) {
	  var Ctor = createCtorWrapper(func);

	  function wrapper() {
	    var fn = (this && this !== global && this instanceof wrapper) ? Ctor : func;
	    return fn.apply(thisArg, arguments);
	  }
	  return wrapper;
	}

	module.exports = createBindWrapper;

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 41 */
/***/ function(module, exports, __webpack_require__) {

	var baseCreate = __webpack_require__(42),
	    isObject = __webpack_require__(15);

	/**
	 * Creates a function that produces an instance of `Ctor` regardless of
	 * whether it was invoked as part of a `new` expression or by `call` or `apply`.
	 *
	 * @private
	 * @param {Function} Ctor The constructor to wrap.
	 * @returns {Function} Returns the new wrapped function.
	 */
	function createCtorWrapper(Ctor) {
	  return function() {
	    // Use a `switch` statement to work with class constructors.
	    // See http://ecma-international.org/ecma-262/6.0/#sec-ecmascript-function-objects-call-thisargument-argumentslist
	    // for more details.
	    var args = arguments;
	    switch (args.length) {
	      case 0: return new Ctor;
	      case 1: return new Ctor(args[0]);
	      case 2: return new Ctor(args[0], args[1]);
	      case 3: return new Ctor(args[0], args[1], args[2]);
	      case 4: return new Ctor(args[0], args[1], args[2], args[3]);
	      case 5: return new Ctor(args[0], args[1], args[2], args[3], args[4]);
	      case 6: return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5]);
	      case 7: return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
	    }
	    var thisBinding = baseCreate(Ctor.prototype),
	        result = Ctor.apply(thisBinding, args);

	    // Mimic the constructor's `return` behavior.
	    // See https://es5.github.io/#x13.2.2 for more details.
	    return isObject(result) ? result : thisBinding;
	  };
	}

	module.exports = createCtorWrapper;


/***/ },
/* 42 */
/***/ function(module, exports, __webpack_require__) {

	var isObject = __webpack_require__(15);

	/**
	 * The base implementation of `_.create` without support for assigning
	 * properties to the created object.
	 *
	 * @private
	 * @param {Object} prototype The object to inherit from.
	 * @returns {Object} Returns the new object.
	 */
	var baseCreate = (function() {
	  function object() {}
	  return function(prototype) {
	    if (isObject(prototype)) {
	      object.prototype = prototype;
	      var result = new object;
	      object.prototype = undefined;
	    }
	    return result || {};
	  };
	}());

	module.exports = baseCreate;


/***/ },
/* 43 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {var arrayCopy = __webpack_require__(44),
	    composeArgs = __webpack_require__(45),
	    composeArgsRight = __webpack_require__(46),
	    createCtorWrapper = __webpack_require__(41),
	    isLaziable = __webpack_require__(47),
	    reorder = __webpack_require__(57),
	    replaceHolders = __webpack_require__(58),
	    setData = __webpack_require__(59);

	/** Used to compose bitmasks for wrapper metadata. */
	var BIND_FLAG = 1,
	    BIND_KEY_FLAG = 2,
	    CURRY_BOUND_FLAG = 4,
	    CURRY_FLAG = 8,
	    CURRY_RIGHT_FLAG = 16,
	    PARTIAL_FLAG = 32,
	    PARTIAL_RIGHT_FLAG = 64,
	    ARY_FLAG = 128;

	/* Native method references for those with the same name as other `lodash` methods. */
	var nativeMax = Math.max;

	/**
	 * Creates a function that wraps `func` and invokes it with optional `this`
	 * binding of, partial application, and currying.
	 *
	 * @private
	 * @param {Function|string} func The function or method name to reference.
	 * @param {number} bitmask The bitmask of flags. See `createWrapper` for more details.
	 * @param {*} [thisArg] The `this` binding of `func`.
	 * @param {Array} [partials] The arguments to prepend to those provided to the new function.
	 * @param {Array} [holders] The `partials` placeholder indexes.
	 * @param {Array} [partialsRight] The arguments to append to those provided to the new function.
	 * @param {Array} [holdersRight] The `partialsRight` placeholder indexes.
	 * @param {Array} [argPos] The argument positions of the new function.
	 * @param {number} [ary] The arity cap of `func`.
	 * @param {number} [arity] The arity of `func`.
	 * @returns {Function} Returns the new wrapped function.
	 */
	function createHybridWrapper(func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary, arity) {
	  var isAry = bitmask & ARY_FLAG,
	      isBind = bitmask & BIND_FLAG,
	      isBindKey = bitmask & BIND_KEY_FLAG,
	      isCurry = bitmask & CURRY_FLAG,
	      isCurryBound = bitmask & CURRY_BOUND_FLAG,
	      isCurryRight = bitmask & CURRY_RIGHT_FLAG,
	      Ctor = isBindKey ? undefined : createCtorWrapper(func);

	  function wrapper() {
	    // Avoid `arguments` object use disqualifying optimizations by
	    // converting it to an array before providing it to other functions.
	    var length = arguments.length,
	        index = length,
	        args = Array(length);

	    while (index--) {
	      args[index] = arguments[index];
	    }
	    if (partials) {
	      args = composeArgs(args, partials, holders);
	    }
	    if (partialsRight) {
	      args = composeArgsRight(args, partialsRight, holdersRight);
	    }
	    if (isCurry || isCurryRight) {
	      var placeholder = wrapper.placeholder,
	          argsHolders = replaceHolders(args, placeholder);

	      length -= argsHolders.length;
	      if (length < arity) {
	        var newArgPos = argPos ? arrayCopy(argPos) : undefined,
	            newArity = nativeMax(arity - length, 0),
	            newsHolders = isCurry ? argsHolders : undefined,
	            newHoldersRight = isCurry ? undefined : argsHolders,
	            newPartials = isCurry ? args : undefined,
	            newPartialsRight = isCurry ? undefined : args;

	        bitmask |= (isCurry ? PARTIAL_FLAG : PARTIAL_RIGHT_FLAG);
	        bitmask &= ~(isCurry ? PARTIAL_RIGHT_FLAG : PARTIAL_FLAG);

	        if (!isCurryBound) {
	          bitmask &= ~(BIND_FLAG | BIND_KEY_FLAG);
	        }
	        var newData = [func, bitmask, thisArg, newPartials, newsHolders, newPartialsRight, newHoldersRight, newArgPos, ary, newArity],
	            result = createHybridWrapper.apply(undefined, newData);

	        if (isLaziable(func)) {
	          setData(result, newData);
	        }
	        result.placeholder = placeholder;
	        return result;
	      }
	    }
	    var thisBinding = isBind ? thisArg : this,
	        fn = isBindKey ? thisBinding[func] : func;

	    if (argPos) {
	      args = reorder(args, argPos);
	    }
	    if (isAry && ary < args.length) {
	      args.length = ary;
	    }
	    if (this && this !== global && this instanceof wrapper) {
	      fn = Ctor || createCtorWrapper(func);
	    }
	    return fn.apply(thisBinding, args);
	  }
	  return wrapper;
	}

	module.exports = createHybridWrapper;

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 44 */
/***/ function(module, exports) {

	/**
	 * Copies the values of `source` to `array`.
	 *
	 * @private
	 * @param {Array} source The array to copy values from.
	 * @param {Array} [array=[]] The array to copy values to.
	 * @returns {Array} Returns `array`.
	 */
	function arrayCopy(source, array) {
	  var index = -1,
	      length = source.length;

	  array || (array = Array(length));
	  while (++index < length) {
	    array[index] = source[index];
	  }
	  return array;
	}

	module.exports = arrayCopy;


/***/ },
/* 45 */
/***/ function(module, exports) {

	/* Native method references for those with the same name as other `lodash` methods. */
	var nativeMax = Math.max;

	/**
	 * Creates an array that is the composition of partially applied arguments,
	 * placeholders, and provided arguments into a single array of arguments.
	 *
	 * @private
	 * @param {Array|Object} args The provided arguments.
	 * @param {Array} partials The arguments to prepend to those provided.
	 * @param {Array} holders The `partials` placeholder indexes.
	 * @returns {Array} Returns the new array of composed arguments.
	 */
	function composeArgs(args, partials, holders) {
	  var holdersLength = holders.length,
	      argsIndex = -1,
	      argsLength = nativeMax(args.length - holdersLength, 0),
	      leftIndex = -1,
	      leftLength = partials.length,
	      result = Array(leftLength + argsLength);

	  while (++leftIndex < leftLength) {
	    result[leftIndex] = partials[leftIndex];
	  }
	  while (++argsIndex < holdersLength) {
	    result[holders[argsIndex]] = args[argsIndex];
	  }
	  while (argsLength--) {
	    result[leftIndex++] = args[argsIndex++];
	  }
	  return result;
	}

	module.exports = composeArgs;


/***/ },
/* 46 */
/***/ function(module, exports) {

	/* Native method references for those with the same name as other `lodash` methods. */
	var nativeMax = Math.max;

	/**
	 * This function is like `composeArgs` except that the arguments composition
	 * is tailored for `_.partialRight`.
	 *
	 * @private
	 * @param {Array|Object} args The provided arguments.
	 * @param {Array} partials The arguments to append to those provided.
	 * @param {Array} holders The `partials` placeholder indexes.
	 * @returns {Array} Returns the new array of composed arguments.
	 */
	function composeArgsRight(args, partials, holders) {
	  var holdersIndex = -1,
	      holdersLength = holders.length,
	      argsIndex = -1,
	      argsLength = nativeMax(args.length - holdersLength, 0),
	      rightIndex = -1,
	      rightLength = partials.length,
	      result = Array(argsLength + rightLength);

	  while (++argsIndex < argsLength) {
	    result[argsIndex] = args[argsIndex];
	  }
	  var offset = argsIndex;
	  while (++rightIndex < rightLength) {
	    result[offset + rightIndex] = partials[rightIndex];
	  }
	  while (++holdersIndex < holdersLength) {
	    result[offset + holders[holdersIndex]] = args[argsIndex++];
	  }
	  return result;
	}

	module.exports = composeArgsRight;


/***/ },
/* 47 */
/***/ function(module, exports, __webpack_require__) {

	var LazyWrapper = __webpack_require__(48),
	    getData = __webpack_require__(50),
	    getFuncName = __webpack_require__(52),
	    lodash = __webpack_require__(54);

	/**
	 * Checks if `func` has a lazy counterpart.
	 *
	 * @private
	 * @param {Function} func The function to check.
	 * @returns {boolean} Returns `true` if `func` has a lazy counterpart, else `false`.
	 */
	function isLaziable(func) {
	  var funcName = getFuncName(func),
	      other = lodash[funcName];

	  if (typeof other != 'function' || !(funcName in LazyWrapper.prototype)) {
	    return false;
	  }
	  if (func === other) {
	    return true;
	  }
	  var data = getData(other);
	  return !!data && func === data[0];
	}

	module.exports = isLaziable;


/***/ },
/* 48 */
/***/ function(module, exports, __webpack_require__) {

	var baseCreate = __webpack_require__(42),
	    baseLodash = __webpack_require__(49);

	/** Used as references for `-Infinity` and `Infinity`. */
	var POSITIVE_INFINITY = Number.POSITIVE_INFINITY;

	/**
	 * Creates a lazy wrapper object which wraps `value` to enable lazy evaluation.
	 *
	 * @private
	 * @param {*} value The value to wrap.
	 */
	function LazyWrapper(value) {
	  this.__wrapped__ = value;
	  this.__actions__ = [];
	  this.__dir__ = 1;
	  this.__filtered__ = false;
	  this.__iteratees__ = [];
	  this.__takeCount__ = POSITIVE_INFINITY;
	  this.__views__ = [];
	}

	LazyWrapper.prototype = baseCreate(baseLodash.prototype);
	LazyWrapper.prototype.constructor = LazyWrapper;

	module.exports = LazyWrapper;


/***/ },
/* 49 */
/***/ function(module, exports) {

	/**
	 * The function whose prototype all chaining wrappers inherit from.
	 *
	 * @private
	 */
	function baseLodash() {
	  // No operation performed.
	}

	module.exports = baseLodash;


/***/ },
/* 50 */
/***/ function(module, exports, __webpack_require__) {

	var metaMap = __webpack_require__(39),
	    noop = __webpack_require__(51);

	/**
	 * Gets metadata for `func`.
	 *
	 * @private
	 * @param {Function} func The function to query.
	 * @returns {*} Returns the metadata for `func`.
	 */
	var getData = !metaMap ? noop : function(func) {
	  return metaMap.get(func);
	};

	module.exports = getData;


/***/ },
/* 51 */
/***/ function(module, exports) {

	/**
	 * A no-operation function that returns `undefined` regardless of the
	 * arguments it receives.
	 *
	 * @static
	 * @memberOf _
	 * @category Utility
	 * @example
	 *
	 * var object = { 'user': 'fred' };
	 *
	 * _.noop(object) === undefined;
	 * // => true
	 */
	function noop() {
	  // No operation performed.
	}

	module.exports = noop;


/***/ },
/* 52 */
/***/ function(module, exports, __webpack_require__) {

	var realNames = __webpack_require__(53);

	/**
	 * Gets the name of `func`.
	 *
	 * @private
	 * @param {Function} func The function to query.
	 * @returns {string} Returns the function name.
	 */
	function getFuncName(func) {
	  var result = (func.name + ''),
	      array = realNames[result],
	      length = array ? array.length : 0;

	  while (length--) {
	    var data = array[length],
	        otherFunc = data.func;
	    if (otherFunc == null || otherFunc == func) {
	      return data.name;
	    }
	  }
	  return result;
	}

	module.exports = getFuncName;


/***/ },
/* 53 */
/***/ function(module, exports) {

	/** Used to lookup unminified function names. */
	var realNames = {};

	module.exports = realNames;


/***/ },
/* 54 */
/***/ function(module, exports, __webpack_require__) {

	var LazyWrapper = __webpack_require__(48),
	    LodashWrapper = __webpack_require__(55),
	    baseLodash = __webpack_require__(49),
	    isArray = __webpack_require__(23),
	    isObjectLike = __webpack_require__(16),
	    wrapperClone = __webpack_require__(56);

	/** Used for native method references. */
	var objectProto = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/**
	 * Creates a `lodash` object which wraps `value` to enable implicit chaining.
	 * Methods that operate on and return arrays, collections, and functions can
	 * be chained together. Methods that retrieve a single value or may return a
	 * primitive value will automatically end the chain returning the unwrapped
	 * value. Explicit chaining may be enabled using `_.chain`. The execution of
	 * chained methods is lazy, that is, execution is deferred until `_#value`
	 * is implicitly or explicitly called.
	 *
	 * Lazy evaluation allows several methods to support shortcut fusion. Shortcut
	 * fusion is an optimization strategy which merge iteratee calls; this can help
	 * to avoid the creation of intermediate data structures and greatly reduce the
	 * number of iteratee executions.
	 *
	 * Chaining is supported in custom builds as long as the `_#value` method is
	 * directly or indirectly included in the build.
	 *
	 * In addition to lodash methods, wrappers have `Array` and `String` methods.
	 *
	 * The wrapper `Array` methods are:
	 * `concat`, `join`, `pop`, `push`, `reverse`, `shift`, `slice`, `sort`,
	 * `splice`, and `unshift`
	 *
	 * The wrapper `String` methods are:
	 * `replace` and `split`
	 *
	 * The wrapper methods that support shortcut fusion are:
	 * `compact`, `drop`, `dropRight`, `dropRightWhile`, `dropWhile`, `filter`,
	 * `first`, `initial`, `last`, `map`, `pluck`, `reject`, `rest`, `reverse`,
	 * `slice`, `take`, `takeRight`, `takeRightWhile`, `takeWhile`, `toArray`,
	 * and `where`
	 *
	 * The chainable wrapper methods are:
	 * `after`, `ary`, `assign`, `at`, `before`, `bind`, `bindAll`, `bindKey`,
	 * `callback`, `chain`, `chunk`, `commit`, `compact`, `concat`, `constant`,
	 * `countBy`, `create`, `curry`, `debounce`, `defaults`, `defaultsDeep`,
	 * `defer`, `delay`, `difference`, `drop`, `dropRight`, `dropRightWhile`,
	 * `dropWhile`, `fill`, `filter`, `flatten`, `flattenDeep`, `flow`, `flowRight`,
	 * `forEach`, `forEachRight`, `forIn`, `forInRight`, `forOwn`, `forOwnRight`,
	 * `functions`, `groupBy`, `indexBy`, `initial`, `intersection`, `invert`,
	 * `invoke`, `keys`, `keysIn`, `map`, `mapKeys`, `mapValues`, `matches`,
	 * `matchesProperty`, `memoize`, `merge`, `method`, `methodOf`, `mixin`,
	 * `modArgs`, `negate`, `omit`, `once`, `pairs`, `partial`, `partialRight`,
	 * `partition`, `pick`, `plant`, `pluck`, `property`, `propertyOf`, `pull`,
	 * `pullAt`, `push`, `range`, `rearg`, `reject`, `remove`, `rest`, `restParam`,
	 * `reverse`, `set`, `shuffle`, `slice`, `sort`, `sortBy`, `sortByAll`,
	 * `sortByOrder`, `splice`, `spread`, `take`, `takeRight`, `takeRightWhile`,
	 * `takeWhile`, `tap`, `throttle`, `thru`, `times`, `toArray`, `toPlainObject`,
	 * `transform`, `union`, `uniq`, `unshift`, `unzip`, `unzipWith`, `values`,
	 * `valuesIn`, `where`, `without`, `wrap`, `xor`, `zip`, `zipObject`, `zipWith`
	 *
	 * The wrapper methods that are **not** chainable by default are:
	 * `add`, `attempt`, `camelCase`, `capitalize`, `ceil`, `clone`, `cloneDeep`,
	 * `deburr`, `endsWith`, `escape`, `escapeRegExp`, `every`, `find`, `findIndex`,
	 * `findKey`, `findLast`, `findLastIndex`, `findLastKey`, `findWhere`, `first`,
	 * `floor`, `get`, `gt`, `gte`, `has`, `identity`, `includes`, `indexOf`,
	 * `inRange`, `isArguments`, `isArray`, `isBoolean`, `isDate`, `isElement`,
	 * `isEmpty`, `isEqual`, `isError`, `isFinite` `isFunction`, `isMatch`,
	 * `isNative`, `isNaN`, `isNull`, `isNumber`, `isObject`, `isPlainObject`,
	 * `isRegExp`, `isString`, `isUndefined`, `isTypedArray`, `join`, `kebabCase`,
	 * `last`, `lastIndexOf`, `lt`, `lte`, `max`, `min`, `noConflict`, `noop`,
	 * `now`, `pad`, `padLeft`, `padRight`, `parseInt`, `pop`, `random`, `reduce`,
	 * `reduceRight`, `repeat`, `result`, `round`, `runInContext`, `shift`, `size`,
	 * `snakeCase`, `some`, `sortedIndex`, `sortedLastIndex`, `startCase`,
	 * `startsWith`, `sum`, `template`, `trim`, `trimLeft`, `trimRight`, `trunc`,
	 * `unescape`, `uniqueId`, `value`, and `words`
	 *
	 * The wrapper method `sample` will return a wrapped value when `n` is provided,
	 * otherwise an unwrapped value is returned.
	 *
	 * @name _
	 * @constructor
	 * @category Chain
	 * @param {*} value The value to wrap in a `lodash` instance.
	 * @returns {Object} Returns the new `lodash` wrapper instance.
	 * @example
	 *
	 * var wrapped = _([1, 2, 3]);
	 *
	 * // returns an unwrapped value
	 * wrapped.reduce(function(total, n) {
	 *   return total + n;
	 * });
	 * // => 6
	 *
	 * // returns a wrapped value
	 * var squares = wrapped.map(function(n) {
	 *   return n * n;
	 * });
	 *
	 * _.isArray(squares);
	 * // => false
	 *
	 * _.isArray(squares.value());
	 * // => true
	 */
	function lodash(value) {
	  if (isObjectLike(value) && !isArray(value) && !(value instanceof LazyWrapper)) {
	    if (value instanceof LodashWrapper) {
	      return value;
	    }
	    if (hasOwnProperty.call(value, '__chain__') && hasOwnProperty.call(value, '__wrapped__')) {
	      return wrapperClone(value);
	    }
	  }
	  return new LodashWrapper(value);
	}

	// Ensure wrappers are instances of `baseLodash`.
	lodash.prototype = baseLodash.prototype;

	module.exports = lodash;


/***/ },
/* 55 */
/***/ function(module, exports, __webpack_require__) {

	var baseCreate = __webpack_require__(42),
	    baseLodash = __webpack_require__(49);

	/**
	 * The base constructor for creating `lodash` wrapper objects.
	 *
	 * @private
	 * @param {*} value The value to wrap.
	 * @param {boolean} [chainAll] Enable chaining for all wrapper methods.
	 * @param {Array} [actions=[]] Actions to peform to resolve the unwrapped value.
	 */
	function LodashWrapper(value, chainAll, actions) {
	  this.__wrapped__ = value;
	  this.__actions__ = actions || [];
	  this.__chain__ = !!chainAll;
	}

	LodashWrapper.prototype = baseCreate(baseLodash.prototype);
	LodashWrapper.prototype.constructor = LodashWrapper;

	module.exports = LodashWrapper;


/***/ },
/* 56 */
/***/ function(module, exports, __webpack_require__) {

	var LazyWrapper = __webpack_require__(48),
	    LodashWrapper = __webpack_require__(55),
	    arrayCopy = __webpack_require__(44);

	/**
	 * Creates a clone of `wrapper`.
	 *
	 * @private
	 * @param {Object} wrapper The wrapper to clone.
	 * @returns {Object} Returns the cloned wrapper.
	 */
	function wrapperClone(wrapper) {
	  return wrapper instanceof LazyWrapper
	    ? wrapper.clone()
	    : new LodashWrapper(wrapper.__wrapped__, wrapper.__chain__, arrayCopy(wrapper.__actions__));
	}

	module.exports = wrapperClone;


/***/ },
/* 57 */
/***/ function(module, exports, __webpack_require__) {

	var arrayCopy = __webpack_require__(44),
	    isIndex = __webpack_require__(24);

	/* Native method references for those with the same name as other `lodash` methods. */
	var nativeMin = Math.min;

	/**
	 * Reorder `array` according to the specified indexes where the element at
	 * the first index is assigned as the first element, the element at
	 * the second index is assigned as the second element, and so on.
	 *
	 * @private
	 * @param {Array} array The array to reorder.
	 * @param {Array} indexes The arranged array indexes.
	 * @returns {Array} Returns `array`.
	 */
	function reorder(array, indexes) {
	  var arrLength = array.length,
	      length = nativeMin(indexes.length, arrLength),
	      oldArray = arrayCopy(array);

	  while (length--) {
	    var index = indexes[length];
	    array[length] = isIndex(index, arrLength) ? oldArray[index] : undefined;
	  }
	  return array;
	}

	module.exports = reorder;


/***/ },
/* 58 */
/***/ function(module, exports) {

	/** Used as the internal argument placeholder. */
	var PLACEHOLDER = '__lodash_placeholder__';

	/**
	 * Replaces all `placeholder` elements in `array` with an internal placeholder
	 * and returns an array of their indexes.
	 *
	 * @private
	 * @param {Array} array The array to modify.
	 * @param {*} placeholder The placeholder to replace.
	 * @returns {Array} Returns the new array of placeholder indexes.
	 */
	function replaceHolders(array, placeholder) {
	  var index = -1,
	      length = array.length,
	      resIndex = -1,
	      result = [];

	  while (++index < length) {
	    if (array[index] === placeholder) {
	      array[index] = PLACEHOLDER;
	      result[++resIndex] = index;
	    }
	  }
	  return result;
	}

	module.exports = replaceHolders;


/***/ },
/* 59 */
/***/ function(module, exports, __webpack_require__) {

	var baseSetData = __webpack_require__(38),
	    now = __webpack_require__(60);

	/** Used to detect when a function becomes hot. */
	var HOT_COUNT = 150,
	    HOT_SPAN = 16;

	/**
	 * Sets metadata for `func`.
	 *
	 * **Note:** If this function becomes hot, i.e. is invoked a lot in a short
	 * period of time, it will trip its breaker and transition to an identity function
	 * to avoid garbage collection pauses in V8. See [V8 issue 2070](https://code.google.com/p/v8/issues/detail?id=2070)
	 * for more details.
	 *
	 * @private
	 * @param {Function} func The function to associate metadata with.
	 * @param {*} data The metadata.
	 * @returns {Function} Returns `func`.
	 */
	var setData = (function() {
	  var count = 0,
	      lastCalled = 0;

	  return function(key, value) {
	    var stamp = now(),
	        remaining = HOT_SPAN - (stamp - lastCalled);

	    lastCalled = stamp;
	    if (remaining > 0) {
	      if (++count >= HOT_COUNT) {
	        return key;
	      }
	    } else {
	      count = 0;
	    }
	    return baseSetData(key, value);
	  };
	}());

	module.exports = setData;


/***/ },
/* 60 */
/***/ function(module, exports, __webpack_require__) {

	var getNative = __webpack_require__(12);

	/* Native method references for those with the same name as other `lodash` methods. */
	var nativeNow = getNative(Date, 'now');

	/**
	 * Gets the number of milliseconds that have elapsed since the Unix epoch
	 * (1 January 1970 00:00:00 UTC).
	 *
	 * @static
	 * @memberOf _
	 * @category Date
	 * @example
	 *
	 * _.defer(function(stamp) {
	 *   console.log(_.now() - stamp);
	 * }, _.now());
	 * // => logs the number of milliseconds it took for the deferred function to be invoked
	 */
	var now = nativeNow || function() {
	  return new Date().getTime();
	};

	module.exports = now;


/***/ },
/* 61 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {var createCtorWrapper = __webpack_require__(41);

	/** Used to compose bitmasks for wrapper metadata. */
	var BIND_FLAG = 1;

	/**
	 * Creates a function that wraps `func` and invokes it with the optional `this`
	 * binding of `thisArg` and the `partials` prepended to those provided to
	 * the wrapper.
	 *
	 * @private
	 * @param {Function} func The function to partially apply arguments to.
	 * @param {number} bitmask The bitmask of flags. See `createWrapper` for more details.
	 * @param {*} thisArg The `this` binding of `func`.
	 * @param {Array} partials The arguments to prepend to those provided to the new function.
	 * @returns {Function} Returns the new bound function.
	 */
	function createPartialWrapper(func, bitmask, thisArg, partials) {
	  var isBind = bitmask & BIND_FLAG,
	      Ctor = createCtorWrapper(func);

	  function wrapper() {
	    // Avoid `arguments` object use disqualifying optimizations by
	    // converting it to an array before providing it `func`.
	    var argsIndex = -1,
	        argsLength = arguments.length,
	        leftIndex = -1,
	        leftLength = partials.length,
	        args = Array(leftLength + argsLength);

	    while (++leftIndex < leftLength) {
	      args[leftIndex] = partials[leftIndex];
	    }
	    while (argsLength--) {
	      args[leftIndex++] = arguments[++argsIndex];
	    }
	    var fn = (this && this !== global && this instanceof wrapper) ? Ctor : func;
	    return fn.apply(isBind ? thisArg : this, args);
	  }
	  return wrapper;
	}

	module.exports = createPartialWrapper;

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 62 */
/***/ function(module, exports, __webpack_require__) {

	var arrayCopy = __webpack_require__(44),
	    composeArgs = __webpack_require__(45),
	    composeArgsRight = __webpack_require__(46),
	    replaceHolders = __webpack_require__(58);

	/** Used to compose bitmasks for wrapper metadata. */
	var BIND_FLAG = 1,
	    CURRY_BOUND_FLAG = 4,
	    CURRY_FLAG = 8,
	    ARY_FLAG = 128,
	    REARG_FLAG = 256;

	/** Used as the internal argument placeholder. */
	var PLACEHOLDER = '__lodash_placeholder__';

	/* Native method references for those with the same name as other `lodash` methods. */
	var nativeMin = Math.min;

	/**
	 * Merges the function metadata of `source` into `data`.
	 *
	 * Merging metadata reduces the number of wrappers required to invoke a function.
	 * This is possible because methods like `_.bind`, `_.curry`, and `_.partial`
	 * may be applied regardless of execution order. Methods like `_.ary` and `_.rearg`
	 * augment function arguments, making the order in which they are executed important,
	 * preventing the merging of metadata. However, we make an exception for a safe
	 * common case where curried functions have `_.ary` and or `_.rearg` applied.
	 *
	 * @private
	 * @param {Array} data The destination metadata.
	 * @param {Array} source The source metadata.
	 * @returns {Array} Returns `data`.
	 */
	function mergeData(data, source) {
	  var bitmask = data[1],
	      srcBitmask = source[1],
	      newBitmask = bitmask | srcBitmask,
	      isCommon = newBitmask < ARY_FLAG;

	  var isCombo =
	    (srcBitmask == ARY_FLAG && bitmask == CURRY_FLAG) ||
	    (srcBitmask == ARY_FLAG && bitmask == REARG_FLAG && data[7].length <= source[8]) ||
	    (srcBitmask == (ARY_FLAG | REARG_FLAG) && bitmask == CURRY_FLAG);

	  // Exit early if metadata can't be merged.
	  if (!(isCommon || isCombo)) {
	    return data;
	  }
	  // Use source `thisArg` if available.
	  if (srcBitmask & BIND_FLAG) {
	    data[2] = source[2];
	    // Set when currying a bound function.
	    newBitmask |= (bitmask & BIND_FLAG) ? 0 : CURRY_BOUND_FLAG;
	  }
	  // Compose partial arguments.
	  var value = source[3];
	  if (value) {
	    var partials = data[3];
	    data[3] = partials ? composeArgs(partials, value, source[4]) : arrayCopy(value);
	    data[4] = partials ? replaceHolders(data[3], PLACEHOLDER) : arrayCopy(source[4]);
	  }
	  // Compose partial right arguments.
	  value = source[5];
	  if (value) {
	    partials = data[5];
	    data[5] = partials ? composeArgsRight(partials, value, source[6]) : arrayCopy(value);
	    data[6] = partials ? replaceHolders(data[5], PLACEHOLDER) : arrayCopy(source[6]);
	  }
	  // Use source `argPos` if available.
	  value = source[7];
	  if (value) {
	    data[7] = arrayCopy(value);
	  }
	  // Use source `ary` if it's smaller.
	  if (srcBitmask & ARY_FLAG) {
	    data[8] = data[8] == null ? source[8] : nativeMin(data[8], source[8]);
	  }
	  // Use source `arity` if one is not provided.
	  if (data[9] == null) {
	    data[9] = source[9];
	  }
	  // Use source `func` and merge bitmasks.
	  data[0] = source[0];
	  data[1] = newBitmask;

	  return data;
	}

	module.exports = mergeData;


/***/ },
/* 63 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, '__esModule', {
	  value: true
	});

	var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

	var _transition = __webpack_require__(64);

	var _transition2 = _interopRequireDefault(_transition);

	var _lodashArrayDifference = __webpack_require__(73);

	var _lodashArrayDifference2 = _interopRequireDefault(_lodashArrayDifference);

	var _lodashArrayUnique = __webpack_require__(83);

	var _lodashArrayUnique2 = _interopRequireDefault(_lodashArrayUnique);

	var _lodashLangIsArray = __webpack_require__(23);

	var _lodashLangIsArray2 = _interopRequireDefault(_lodashLangIsArray);

	var _lodashLangIsString = __webpack_require__(66);

	var _lodashLangIsString2 = _interopRequireDefault(_lodashLangIsString);

	var _parser = __webpack_require__(109);

	var _signal = __webpack_require__(65);

	var _signal2 = _interopRequireDefault(_signal);

	var STATE_DELIMITER = '.';

	var State = (function () {
	  function State(data) {
	    var _this = this;

	    var parent = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

	    _classCallCheck(this, State);

	    data = (0, _lodashLangIsString2['default'])(data) ? (0, _parser.parse)(data) : data;

	    this.id = data.id || 'root';

	    this._id = parent ? parent._id.concat(this.id) : [this.id];

	    this.states = data.states ? data.states.map(function (state) {
	      return new State(state, _this);
	    }) : [];

	    this.transitions = data.transitions ? data.transitions.map(function (transition) {
	      return new _transition2['default'](transition);
	    }) : [];

	    this.alphabet = this.getAlphabet();

	    this.initial = !!data.initial;

	    this.final = !!data.final;
	  }

	  _createClass(State, [{
	    key: 'mapStateRefs',
	    value: function mapStateRefs() {
	      var _this2 = this;

	      this.states = this.states.map(function (state) {
	        state.transitions = state.transitions.map(function (transition) {
	          transition.targetState = _this2.getState(transition.target);

	          return Object.freeze(transition);
	        });

	        return state.mapStateRefs();
	      });

	      return Object.freeze(this);
	    }
	  }, {
	    key: 'relativeId',
	    value: function relativeId() {
	      var fromState = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

	      return (0, _lodashArrayDifference2['default'])(this._id, fromState._id).join('.');
	    }
	  }, {
	    key: 'transition',
	    value: function transition() {
	      var fromState = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

	      var _this3 = this;

	      var signal = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];
	      var returnFlag = arguments.length <= 2 || arguments[2] === undefined ? true : arguments[2];

	      var substateIds = this.getSubstateIds(fromState);
	      var initialStates = this.states.filter(function (state) {
	        return state.initial;
	      });
	      var nextStates = [];
	      var currentSubstate = substateIds.length ? this.getState(substateIds[0]) : null;

	      if (substateIds.length) {
	        if (!currentSubstate) {
	          return [];
	        }

	        nextStates = currentSubstate.transition(substateIds.slice(1), signal, false);

	        if (!nextStates.length) {
	          nextStates = this.transitions.filter(function (transition) {
	            return transition.isValid(signal);
	          }).map(function (transition) {
	            return transition.targetState.initialStates();
	          }).reduce(function (a, b) {
	            return a.concat(b);
	          }, []);
	        }
	      } else if (initialStates.length) {
	        nextStates = initialStates.map(function (state) {
	          return state.transition(null, signal, false);
	        }).reduce(function (a, b) {
	          return a.concat(b);
	        }, []);
	      } else if (signal) {
	        nextStates = this.transitions.filter(function (transition) {
	          return transition.isValid(signal);
	        }).map(function (transition) {
	          return transition.targetState.initialStates();
	        }).reduce(function (a, b) {
	          return a.concat(b);
	        }, []);
	      } else {
	        nextStates = this.initialStates();
	      }

	      return returnFlag ? nextStates.map(function (state) {
	        return state.relativeId(_this3);
	      }) : nextStates;
	    }
	  }, {
	    key: 'initialStates',
	    value: function initialStates() {
	      var initialStates = this.states.filter(function (state) {
	        return state.initial;
	      });

	      return initialStates.length ? initialStates.map(function (state) {
	        return state.initialStates();
	      }).reduce(function (a, b) {
	        return a.concat(b);
	      }, []) : [this];
	    }
	  }, {
	    key: 'getSubstateIds',
	    value: function getSubstateIds(fromState) {
	      if (!fromState) return [];

	      if (fromState instanceof State) {
	        return fromState._id;
	      }

	      fromState = fromState || [];

	      return (0, _lodashLangIsArray2['default'])(fromState) ? fromState : (0, _lodashLangIsString2['default'])(fromState) ? fromState.split(STATE_DELIMITER) : false;
	    }
	  }, {
	    key: 'getState',
	    value: function getState(substates) {
	      if (substates instanceof State) {
	        return substates;
	      }

	      substates = this.getSubstateIds(substates);

	      if (!substates.length) {
	        return this;
	      }

	      var substate = this.states.find(function (state) {
	        return state.id === substates[0];
	      });

	      return substate ? substates.length > 1 ? substate.getState(substates.slice(1)) : substate : false;
	    }
	  }, {
	    key: 'getAlphabet',
	    value: function getAlphabet() {
	      return this.alphabet || (0, _lodashArrayUnique2['default'])(this.states.map(function (state) {
	        return state.getAlphabet();
	      }).concat(this.transitions.map(function (transition) {
	        return transition.event;
	      })).reduce(function (a, b) {
	        return a.concat(b);
	      }, []));
	    }
	  }, {
	    key: 'isValidSignal',
	    value: function isValidSignal(signal) {
	      if (!signal) return false;

	      var signalType = new _signal2['default'](signal).type;

	      return this.getAlphabet().indexOf(signalType) !== -1;
	    }
	  }]);

	  return State;
	})();

	exports['default'] = State;
	module.exports = exports['default'];

/***/ },
/* 64 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, '__esModule', {
	  value: true
	});

	var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

	var _signal = __webpack_require__(65);

	var _signal2 = _interopRequireDefault(_signal);

	var Transition = (function () {
	  function Transition(data, fromState) {
	    _classCallCheck(this, Transition);

	    this.event = data.event;

	    this.target = data.target;

	    this.cond = data.cond || function () {
	      return true;
	    };
	  }

	  _createClass(Transition, [{
	    key: 'isValid',
	    value: function isValid(signal) {
	      signal = new _signal2['default'](signal);

	      return signal.type === this.event && !!this.cond(signal);
	    }
	  }]);

	  return Transition;
	})();

	exports['default'] = Transition;
	module.exports = exports['default'];

/***/ },
/* 65 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, '__esModule', {
	  value: true
	});

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

	var _lodashLangIsString = __webpack_require__(66);

	var _lodashLangIsString2 = _interopRequireDefault(_lodashLangIsString);

	var _lodashLangIsPlainObject = __webpack_require__(67);

	var _lodashLangIsPlainObject2 = _interopRequireDefault(_lodashLangIsPlainObject);

	var _lodashObjectExtend = __webpack_require__(72);

	var _lodashObjectExtend2 = _interopRequireDefault(_lodashObjectExtend);

	var Signal = function Signal(data) {
	  _classCallCheck(this, Signal);

	  if (data instanceof Signal || (0, _lodashLangIsPlainObject2['default'])(data)) {
	    (0, _lodashObjectExtend2['default'])(this, data);
	  }

	  if ((0, _lodashLangIsString2['default'])(data)) {
	    this.type = data;
	  }
	};

	exports['default'] = Signal;
	module.exports = exports['default'];

/***/ },
/* 66 */
/***/ function(module, exports, __webpack_require__) {

	var isObjectLike = __webpack_require__(16);

	/** `Object#toString` result references. */
	var stringTag = '[object String]';

	/** Used for native method references. */
	var objectProto = Object.prototype;

	/**
	 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objToString = objectProto.toString;

	/**
	 * Checks if `value` is classified as a `String` primitive or object.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isString('abc');
	 * // => true
	 *
	 * _.isString(1);
	 * // => false
	 */
	function isString(value) {
	  return typeof value == 'string' || (isObjectLike(value) && objToString.call(value) == stringTag);
	}

	module.exports = isString;


/***/ },
/* 67 */
/***/ function(module, exports, __webpack_require__) {

	var baseForIn = __webpack_require__(68),
	    isArguments = __webpack_require__(22),
	    isObjectLike = __webpack_require__(16);

	/** `Object#toString` result references. */
	var objectTag = '[object Object]';

	/** Used for native method references. */
	var objectProto = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/**
	 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objToString = objectProto.toString;

	/**
	 * Checks if `value` is a plain object, that is, an object created by the
	 * `Object` constructor or one with a `[[Prototype]]` of `null`.
	 *
	 * **Note:** This method assumes objects created by the `Object` constructor
	 * have no inherited enumerable properties.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
	 * @example
	 *
	 * function Foo() {
	 *   this.a = 1;
	 * }
	 *
	 * _.isPlainObject(new Foo);
	 * // => false
	 *
	 * _.isPlainObject([1, 2, 3]);
	 * // => false
	 *
	 * _.isPlainObject({ 'x': 0, 'y': 0 });
	 * // => true
	 *
	 * _.isPlainObject(Object.create(null));
	 * // => true
	 */
	function isPlainObject(value) {
	  var Ctor;

	  // Exit early for non `Object` objects.
	  if (!(isObjectLike(value) && objToString.call(value) == objectTag && !isArguments(value)) ||
	      (!hasOwnProperty.call(value, 'constructor') && (Ctor = value.constructor, typeof Ctor == 'function' && !(Ctor instanceof Ctor)))) {
	    return false;
	  }
	  // IE < 9 iterates inherited properties before own properties. If the first
	  // iterated property is an object's own property then there are no inherited
	  // enumerable properties.
	  var result;
	  // In most environments an object's own properties are iterated before
	  // its inherited properties. If the last iterated property is an object's
	  // own property then there are no inherited enumerable properties.
	  baseForIn(value, function(subValue, key) {
	    result = key;
	  });
	  return result === undefined || hasOwnProperty.call(value, result);
	}

	module.exports = isPlainObject;


/***/ },
/* 68 */
/***/ function(module, exports, __webpack_require__) {

	var baseFor = __webpack_require__(69),
	    keysIn = __webpack_require__(25);

	/**
	 * The base implementation of `_.forIn` without support for callback
	 * shorthands and `this` binding.
	 *
	 * @private
	 * @param {Object} object The object to iterate over.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @returns {Object} Returns `object`.
	 */
	function baseForIn(object, iteratee) {
	  return baseFor(object, iteratee, keysIn);
	}

	module.exports = baseForIn;


/***/ },
/* 69 */
/***/ function(module, exports, __webpack_require__) {

	var createBaseFor = __webpack_require__(70);

	/**
	 * The base implementation of `baseForIn` and `baseForOwn` which iterates
	 * over `object` properties returned by `keysFunc` invoking `iteratee` for
	 * each property. Iteratee functions may exit iteration early by explicitly
	 * returning `false`.
	 *
	 * @private
	 * @param {Object} object The object to iterate over.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @param {Function} keysFunc The function to get the keys of `object`.
	 * @returns {Object} Returns `object`.
	 */
	var baseFor = createBaseFor();

	module.exports = baseFor;


/***/ },
/* 70 */
/***/ function(module, exports, __webpack_require__) {

	var toObject = __webpack_require__(71);

	/**
	 * Creates a base function for `_.forIn` or `_.forInRight`.
	 *
	 * @private
	 * @param {boolean} [fromRight] Specify iterating from right to left.
	 * @returns {Function} Returns the new base function.
	 */
	function createBaseFor(fromRight) {
	  return function(object, iteratee, keysFunc) {
	    var iterable = toObject(object),
	        props = keysFunc(object),
	        length = props.length,
	        index = fromRight ? length : -1;

	    while ((fromRight ? index-- : ++index < length)) {
	      var key = props[index];
	      if (iteratee(iterable[key], key, iterable) === false) {
	        break;
	      }
	    }
	    return object;
	  };
	}

	module.exports = createBaseFor;


/***/ },
/* 71 */
/***/ function(module, exports, __webpack_require__) {

	var isObject = __webpack_require__(15);

	/**
	 * Converts `value` to an object if it's not one.
	 *
	 * @private
	 * @param {*} value The value to process.
	 * @returns {Object} Returns the object.
	 */
	function toObject(value) {
	  return isObject(value) ? value : Object(value);
	}

	module.exports = toObject;


/***/ },
/* 72 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(9);


/***/ },
/* 73 */
/***/ function(module, exports, __webpack_require__) {

	var baseDifference = __webpack_require__(74),
	    baseFlatten = __webpack_require__(81),
	    isArrayLike = __webpack_require__(17),
	    isObjectLike = __webpack_require__(16),
	    restParam = __webpack_require__(32);

	/**
	 * Creates an array of unique `array` values not included in the other
	 * provided arrays using [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
	 * for equality comparisons.
	 *
	 * @static
	 * @memberOf _
	 * @category Array
	 * @param {Array} array The array to inspect.
	 * @param {...Array} [values] The arrays of values to exclude.
	 * @returns {Array} Returns the new array of filtered values.
	 * @example
	 *
	 * _.difference([1, 2, 3], [4, 2]);
	 * // => [1, 3]
	 */
	var difference = restParam(function(array, values) {
	  return (isObjectLike(array) && isArrayLike(array))
	    ? baseDifference(array, baseFlatten(values, false, true))
	    : [];
	});

	module.exports = difference;


/***/ },
/* 74 */
/***/ function(module, exports, __webpack_require__) {

	var baseIndexOf = __webpack_require__(75),
	    cacheIndexOf = __webpack_require__(77),
	    createCache = __webpack_require__(78);

	/** Used as the size to enable large array optimizations. */
	var LARGE_ARRAY_SIZE = 200;

	/**
	 * The base implementation of `_.difference` which accepts a single array
	 * of values to exclude.
	 *
	 * @private
	 * @param {Array} array The array to inspect.
	 * @param {Array} values The values to exclude.
	 * @returns {Array} Returns the new array of filtered values.
	 */
	function baseDifference(array, values) {
	  var length = array ? array.length : 0,
	      result = [];

	  if (!length) {
	    return result;
	  }
	  var index = -1,
	      indexOf = baseIndexOf,
	      isCommon = true,
	      cache = (isCommon && values.length >= LARGE_ARRAY_SIZE) ? createCache(values) : null,
	      valuesLength = values.length;

	  if (cache) {
	    indexOf = cacheIndexOf;
	    isCommon = false;
	    values = cache;
	  }
	  outer:
	  while (++index < length) {
	    var value = array[index];

	    if (isCommon && value === value) {
	      var valuesIndex = valuesLength;
	      while (valuesIndex--) {
	        if (values[valuesIndex] === value) {
	          continue outer;
	        }
	      }
	      result.push(value);
	    }
	    else if (indexOf(values, value, 0) < 0) {
	      result.push(value);
	    }
	  }
	  return result;
	}

	module.exports = baseDifference;


/***/ },
/* 75 */
/***/ function(module, exports, __webpack_require__) {

	var indexOfNaN = __webpack_require__(76);

	/**
	 * The base implementation of `_.indexOf` without support for binary searches.
	 *
	 * @private
	 * @param {Array} array The array to search.
	 * @param {*} value The value to search for.
	 * @param {number} fromIndex The index to search from.
	 * @returns {number} Returns the index of the matched value, else `-1`.
	 */
	function baseIndexOf(array, value, fromIndex) {
	  if (value !== value) {
	    return indexOfNaN(array, fromIndex);
	  }
	  var index = fromIndex - 1,
	      length = array.length;

	  while (++index < length) {
	    if (array[index] === value) {
	      return index;
	    }
	  }
	  return -1;
	}

	module.exports = baseIndexOf;


/***/ },
/* 76 */
/***/ function(module, exports) {

	/**
	 * Gets the index at which the first occurrence of `NaN` is found in `array`.
	 *
	 * @private
	 * @param {Array} array The array to search.
	 * @param {number} fromIndex The index to search from.
	 * @param {boolean} [fromRight] Specify iterating from right to left.
	 * @returns {number} Returns the index of the matched `NaN`, else `-1`.
	 */
	function indexOfNaN(array, fromIndex, fromRight) {
	  var length = array.length,
	      index = fromIndex + (fromRight ? 0 : -1);

	  while ((fromRight ? index-- : ++index < length)) {
	    var other = array[index];
	    if (other !== other) {
	      return index;
	    }
	  }
	  return -1;
	}

	module.exports = indexOfNaN;


/***/ },
/* 77 */
/***/ function(module, exports, __webpack_require__) {

	var isObject = __webpack_require__(15);

	/**
	 * Checks if `value` is in `cache` mimicking the return signature of
	 * `_.indexOf` by returning `0` if the value is found, else `-1`.
	 *
	 * @private
	 * @param {Object} cache The cache to search.
	 * @param {*} value The value to search for.
	 * @returns {number} Returns `0` if `value` is found, else `-1`.
	 */
	function cacheIndexOf(cache, value) {
	  var data = cache.data,
	      result = (typeof value == 'string' || isObject(value)) ? data.set.has(value) : data.hash[value];

	  return result ? 0 : -1;
	}

	module.exports = cacheIndexOf;


/***/ },
/* 78 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {var SetCache = __webpack_require__(79),
	    getNative = __webpack_require__(12);

	/** Native method references. */
	var Set = getNative(global, 'Set');

	/* Native method references for those with the same name as other `lodash` methods. */
	var nativeCreate = getNative(Object, 'create');

	/**
	 * Creates a `Set` cache object to optimize linear searches of large arrays.
	 *
	 * @private
	 * @param {Array} [values] The values to cache.
	 * @returns {null|Object} Returns the new cache object if `Set` is supported, else `null`.
	 */
	function createCache(values) {
	  return (nativeCreate && Set) ? new SetCache(values) : null;
	}

	module.exports = createCache;

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 79 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {var cachePush = __webpack_require__(80),
	    getNative = __webpack_require__(12);

	/** Native method references. */
	var Set = getNative(global, 'Set');

	/* Native method references for those with the same name as other `lodash` methods. */
	var nativeCreate = getNative(Object, 'create');

	/**
	 *
	 * Creates a cache object to store unique values.
	 *
	 * @private
	 * @param {Array} [values] The values to cache.
	 */
	function SetCache(values) {
	  var length = values ? values.length : 0;

	  this.data = { 'hash': nativeCreate(null), 'set': new Set };
	  while (length--) {
	    this.push(values[length]);
	  }
	}

	// Add functions to the `Set` cache.
	SetCache.prototype.push = cachePush;

	module.exports = SetCache;

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 80 */
/***/ function(module, exports, __webpack_require__) {

	var isObject = __webpack_require__(15);

	/**
	 * Adds `value` to the cache.
	 *
	 * @private
	 * @name push
	 * @memberOf SetCache
	 * @param {*} value The value to cache.
	 */
	function cachePush(value) {
	  var data = this.data;
	  if (typeof value == 'string' || isObject(value)) {
	    data.set.add(value);
	  } else {
	    data.hash[value] = true;
	  }
	}

	module.exports = cachePush;


/***/ },
/* 81 */
/***/ function(module, exports, __webpack_require__) {

	var arrayPush = __webpack_require__(82),
	    isArguments = __webpack_require__(22),
	    isArray = __webpack_require__(23),
	    isArrayLike = __webpack_require__(17),
	    isObjectLike = __webpack_require__(16);

	/**
	 * The base implementation of `_.flatten` with added support for restricting
	 * flattening and specifying the start index.
	 *
	 * @private
	 * @param {Array} array The array to flatten.
	 * @param {boolean} [isDeep] Specify a deep flatten.
	 * @param {boolean} [isStrict] Restrict flattening to arrays-like objects.
	 * @param {Array} [result=[]] The initial result value.
	 * @returns {Array} Returns the new flattened array.
	 */
	function baseFlatten(array, isDeep, isStrict, result) {
	  result || (result = []);

	  var index = -1,
	      length = array.length;

	  while (++index < length) {
	    var value = array[index];
	    if (isObjectLike(value) && isArrayLike(value) &&
	        (isStrict || isArray(value) || isArguments(value))) {
	      if (isDeep) {
	        // Recursively flatten arrays (susceptible to call stack limits).
	        baseFlatten(value, isDeep, isStrict, result);
	      } else {
	        arrayPush(result, value);
	      }
	    } else if (!isStrict) {
	      result[result.length] = value;
	    }
	  }
	  return result;
	}

	module.exports = baseFlatten;


/***/ },
/* 82 */
/***/ function(module, exports) {

	/**
	 * Appends the elements of `values` to `array`.
	 *
	 * @private
	 * @param {Array} array The array to modify.
	 * @param {Array} values The values to append.
	 * @returns {Array} Returns `array`.
	 */
	function arrayPush(array, values) {
	  var index = -1,
	      length = values.length,
	      offset = array.length;

	  while (++index < length) {
	    array[offset + index] = values[index];
	  }
	  return array;
	}

	module.exports = arrayPush;


/***/ },
/* 83 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(84);


/***/ },
/* 84 */
/***/ function(module, exports, __webpack_require__) {

	var baseCallback = __webpack_require__(85),
	    baseUniq = __webpack_require__(107),
	    isIterateeCall = __webpack_require__(31),
	    sortedUniq = __webpack_require__(108);

	/**
	 * Creates a duplicate-free version of an array, using
	 * [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
	 * for equality comparisons, in which only the first occurence of each element
	 * is kept. Providing `true` for `isSorted` performs a faster search algorithm
	 * for sorted arrays. If an iteratee function is provided it's invoked for
	 * each element in the array to generate the criterion by which uniqueness
	 * is computed. The `iteratee` is bound to `thisArg` and invoked with three
	 * arguments: (value, index, array).
	 *
	 * If a property name is provided for `iteratee` the created `_.property`
	 * style callback returns the property value of the given element.
	 *
	 * If a value is also provided for `thisArg` the created `_.matchesProperty`
	 * style callback returns `true` for elements that have a matching property
	 * value, else `false`.
	 *
	 * If an object is provided for `iteratee` the created `_.matches` style
	 * callback returns `true` for elements that have the properties of the given
	 * object, else `false`.
	 *
	 * @static
	 * @memberOf _
	 * @alias unique
	 * @category Array
	 * @param {Array} array The array to inspect.
	 * @param {boolean} [isSorted] Specify the array is sorted.
	 * @param {Function|Object|string} [iteratee] The function invoked per iteration.
	 * @param {*} [thisArg] The `this` binding of `iteratee`.
	 * @returns {Array} Returns the new duplicate-value-free array.
	 * @example
	 *
	 * _.uniq([2, 1, 2]);
	 * // => [2, 1]
	 *
	 * // using `isSorted`
	 * _.uniq([1, 1, 2], true);
	 * // => [1, 2]
	 *
	 * // using an iteratee function
	 * _.uniq([1, 2.5, 1.5, 2], function(n) {
	 *   return this.floor(n);
	 * }, Math);
	 * // => [1, 2.5]
	 *
	 * // using the `_.property` callback shorthand
	 * _.uniq([{ 'x': 1 }, { 'x': 2 }, { 'x': 1 }], 'x');
	 * // => [{ 'x': 1 }, { 'x': 2 }]
	 */
	function uniq(array, isSorted, iteratee, thisArg) {
	  var length = array ? array.length : 0;
	  if (!length) {
	    return [];
	  }
	  if (isSorted != null && typeof isSorted != 'boolean') {
	    thisArg = iteratee;
	    iteratee = isIterateeCall(array, isSorted, thisArg) ? undefined : isSorted;
	    isSorted = false;
	  }
	  iteratee = iteratee == null ? iteratee : baseCallback(iteratee, thisArg, 3);
	  return (isSorted)
	    ? sortedUniq(array, iteratee)
	    : baseUniq(array, iteratee);
	}

	module.exports = uniq;


/***/ },
/* 85 */
/***/ function(module, exports, __webpack_require__) {

	var baseMatches = __webpack_require__(86),
	    baseMatchesProperty = __webpack_require__(98),
	    bindCallback = __webpack_require__(29),
	    identity = __webpack_require__(30),
	    property = __webpack_require__(105);

	/**
	 * The base implementation of `_.callback` which supports specifying the
	 * number of arguments to provide to `func`.
	 *
	 * @private
	 * @param {*} [func=_.identity] The value to convert to a callback.
	 * @param {*} [thisArg] The `this` binding of `func`.
	 * @param {number} [argCount] The number of arguments to provide to `func`.
	 * @returns {Function} Returns the callback.
	 */
	function baseCallback(func, thisArg, argCount) {
	  var type = typeof func;
	  if (type == 'function') {
	    return thisArg === undefined
	      ? func
	      : bindCallback(func, thisArg, argCount);
	  }
	  if (func == null) {
	    return identity;
	  }
	  if (type == 'object') {
	    return baseMatches(func);
	  }
	  return thisArg === undefined
	    ? property(func)
	    : baseMatchesProperty(func, thisArg);
	}

	module.exports = baseCallback;


/***/ },
/* 86 */
/***/ function(module, exports, __webpack_require__) {

	var baseIsMatch = __webpack_require__(87),
	    getMatchData = __webpack_require__(95),
	    toObject = __webpack_require__(71);

	/**
	 * The base implementation of `_.matches` which does not clone `source`.
	 *
	 * @private
	 * @param {Object} source The object of property values to match.
	 * @returns {Function} Returns the new function.
	 */
	function baseMatches(source) {
	  var matchData = getMatchData(source);
	  if (matchData.length == 1 && matchData[0][2]) {
	    var key = matchData[0][0],
	        value = matchData[0][1];

	    return function(object) {
	      if (object == null) {
	        return false;
	      }
	      return object[key] === value && (value !== undefined || (key in toObject(object)));
	    };
	  }
	  return function(object) {
	    return baseIsMatch(object, matchData);
	  };
	}

	module.exports = baseMatches;


/***/ },
/* 87 */
/***/ function(module, exports, __webpack_require__) {

	var baseIsEqual = __webpack_require__(88),
	    toObject = __webpack_require__(71);

	/**
	 * The base implementation of `_.isMatch` without support for callback
	 * shorthands and `this` binding.
	 *
	 * @private
	 * @param {Object} object The object to inspect.
	 * @param {Array} matchData The propery names, values, and compare flags to match.
	 * @param {Function} [customizer] The function to customize comparing objects.
	 * @returns {boolean} Returns `true` if `object` is a match, else `false`.
	 */
	function baseIsMatch(object, matchData, customizer) {
	  var index = matchData.length,
	      length = index,
	      noCustomizer = !customizer;

	  if (object == null) {
	    return !length;
	  }
	  object = toObject(object);
	  while (index--) {
	    var data = matchData[index];
	    if ((noCustomizer && data[2])
	          ? data[1] !== object[data[0]]
	          : !(data[0] in object)
	        ) {
	      return false;
	    }
	  }
	  while (++index < length) {
	    data = matchData[index];
	    var key = data[0],
	        objValue = object[key],
	        srcValue = data[1];

	    if (noCustomizer && data[2]) {
	      if (objValue === undefined && !(key in object)) {
	        return false;
	      }
	    } else {
	      var result = customizer ? customizer(objValue, srcValue, key) : undefined;
	      if (!(result === undefined ? baseIsEqual(srcValue, objValue, customizer, true) : result)) {
	        return false;
	      }
	    }
	  }
	  return true;
	}

	module.exports = baseIsMatch;


/***/ },
/* 88 */
/***/ function(module, exports, __webpack_require__) {

	var baseIsEqualDeep = __webpack_require__(89),
	    isObject = __webpack_require__(15),
	    isObjectLike = __webpack_require__(16);

	/**
	 * The base implementation of `_.isEqual` without support for `this` binding
	 * `customizer` functions.
	 *
	 * @private
	 * @param {*} value The value to compare.
	 * @param {*} other The other value to compare.
	 * @param {Function} [customizer] The function to customize comparing values.
	 * @param {boolean} [isLoose] Specify performing partial comparisons.
	 * @param {Array} [stackA] Tracks traversed `value` objects.
	 * @param {Array} [stackB] Tracks traversed `other` objects.
	 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	 */
	function baseIsEqual(value, other, customizer, isLoose, stackA, stackB) {
	  if (value === other) {
	    return true;
	  }
	  if (value == null || other == null || (!isObject(value) && !isObjectLike(other))) {
	    return value !== value && other !== other;
	  }
	  return baseIsEqualDeep(value, other, baseIsEqual, customizer, isLoose, stackA, stackB);
	}

	module.exports = baseIsEqual;


/***/ },
/* 89 */
/***/ function(module, exports, __webpack_require__) {

	var equalArrays = __webpack_require__(90),
	    equalByTag = __webpack_require__(92),
	    equalObjects = __webpack_require__(93),
	    isArray = __webpack_require__(23),
	    isTypedArray = __webpack_require__(94);

	/** `Object#toString` result references. */
	var argsTag = '[object Arguments]',
	    arrayTag = '[object Array]',
	    objectTag = '[object Object]';

	/** Used for native method references. */
	var objectProto = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/**
	 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objToString = objectProto.toString;

	/**
	 * A specialized version of `baseIsEqual` for arrays and objects which performs
	 * deep comparisons and tracks traversed objects enabling objects with circular
	 * references to be compared.
	 *
	 * @private
	 * @param {Object} object The object to compare.
	 * @param {Object} other The other object to compare.
	 * @param {Function} equalFunc The function to determine equivalents of values.
	 * @param {Function} [customizer] The function to customize comparing objects.
	 * @param {boolean} [isLoose] Specify performing partial comparisons.
	 * @param {Array} [stackA=[]] Tracks traversed `value` objects.
	 * @param {Array} [stackB=[]] Tracks traversed `other` objects.
	 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
	 */
	function baseIsEqualDeep(object, other, equalFunc, customizer, isLoose, stackA, stackB) {
	  var objIsArr = isArray(object),
	      othIsArr = isArray(other),
	      objTag = arrayTag,
	      othTag = arrayTag;

	  if (!objIsArr) {
	    objTag = objToString.call(object);
	    if (objTag == argsTag) {
	      objTag = objectTag;
	    } else if (objTag != objectTag) {
	      objIsArr = isTypedArray(object);
	    }
	  }
	  if (!othIsArr) {
	    othTag = objToString.call(other);
	    if (othTag == argsTag) {
	      othTag = objectTag;
	    } else if (othTag != objectTag) {
	      othIsArr = isTypedArray(other);
	    }
	  }
	  var objIsObj = objTag == objectTag,
	      othIsObj = othTag == objectTag,
	      isSameTag = objTag == othTag;

	  if (isSameTag && !(objIsArr || objIsObj)) {
	    return equalByTag(object, other, objTag);
	  }
	  if (!isLoose) {
	    var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
	        othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');

	    if (objIsWrapped || othIsWrapped) {
	      return equalFunc(objIsWrapped ? object.value() : object, othIsWrapped ? other.value() : other, customizer, isLoose, stackA, stackB);
	    }
	  }
	  if (!isSameTag) {
	    return false;
	  }
	  // Assume cyclic values are equal.
	  // For more information on detecting circular references see https://es5.github.io/#JO.
	  stackA || (stackA = []);
	  stackB || (stackB = []);

	  var length = stackA.length;
	  while (length--) {
	    if (stackA[length] == object) {
	      return stackB[length] == other;
	    }
	  }
	  // Add `object` and `other` to the stack of traversed objects.
	  stackA.push(object);
	  stackB.push(other);

	  var result = (objIsArr ? equalArrays : equalObjects)(object, other, equalFunc, customizer, isLoose, stackA, stackB);

	  stackA.pop();
	  stackB.pop();

	  return result;
	}

	module.exports = baseIsEqualDeep;


/***/ },
/* 90 */
/***/ function(module, exports, __webpack_require__) {

	var arraySome = __webpack_require__(91);

	/**
	 * A specialized version of `baseIsEqualDeep` for arrays with support for
	 * partial deep comparisons.
	 *
	 * @private
	 * @param {Array} array The array to compare.
	 * @param {Array} other The other array to compare.
	 * @param {Function} equalFunc The function to determine equivalents of values.
	 * @param {Function} [customizer] The function to customize comparing arrays.
	 * @param {boolean} [isLoose] Specify performing partial comparisons.
	 * @param {Array} [stackA] Tracks traversed `value` objects.
	 * @param {Array} [stackB] Tracks traversed `other` objects.
	 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
	 */
	function equalArrays(array, other, equalFunc, customizer, isLoose, stackA, stackB) {
	  var index = -1,
	      arrLength = array.length,
	      othLength = other.length;

	  if (arrLength != othLength && !(isLoose && othLength > arrLength)) {
	    return false;
	  }
	  // Ignore non-index properties.
	  while (++index < arrLength) {
	    var arrValue = array[index],
	        othValue = other[index],
	        result = customizer ? customizer(isLoose ? othValue : arrValue, isLoose ? arrValue : othValue, index) : undefined;

	    if (result !== undefined) {
	      if (result) {
	        continue;
	      }
	      return false;
	    }
	    // Recursively compare arrays (susceptible to call stack limits).
	    if (isLoose) {
	      if (!arraySome(other, function(othValue) {
	            return arrValue === othValue || equalFunc(arrValue, othValue, customizer, isLoose, stackA, stackB);
	          })) {
	        return false;
	      }
	    } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, customizer, isLoose, stackA, stackB))) {
	      return false;
	    }
	  }
	  return true;
	}

	module.exports = equalArrays;


/***/ },
/* 91 */
/***/ function(module, exports) {

	/**
	 * A specialized version of `_.some` for arrays without support for callback
	 * shorthands and `this` binding.
	 *
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} predicate The function invoked per iteration.
	 * @returns {boolean} Returns `true` if any element passes the predicate check,
	 *  else `false`.
	 */
	function arraySome(array, predicate) {
	  var index = -1,
	      length = array.length;

	  while (++index < length) {
	    if (predicate(array[index], index, array)) {
	      return true;
	    }
	  }
	  return false;
	}

	module.exports = arraySome;


/***/ },
/* 92 */
/***/ function(module, exports) {

	/** `Object#toString` result references. */
	var boolTag = '[object Boolean]',
	    dateTag = '[object Date]',
	    errorTag = '[object Error]',
	    numberTag = '[object Number]',
	    regexpTag = '[object RegExp]',
	    stringTag = '[object String]';

	/**
	 * A specialized version of `baseIsEqualDeep` for comparing objects of
	 * the same `toStringTag`.
	 *
	 * **Note:** This function only supports comparing values with tags of
	 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
	 *
	 * @private
	 * @param {Object} object The object to compare.
	 * @param {Object} other The other object to compare.
	 * @param {string} tag The `toStringTag` of the objects to compare.
	 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
	 */
	function equalByTag(object, other, tag) {
	  switch (tag) {
	    case boolTag:
	    case dateTag:
	      // Coerce dates and booleans to numbers, dates to milliseconds and booleans
	      // to `1` or `0` treating invalid dates coerced to `NaN` as not equal.
	      return +object == +other;

	    case errorTag:
	      return object.name == other.name && object.message == other.message;

	    case numberTag:
	      // Treat `NaN` vs. `NaN` as equal.
	      return (object != +object)
	        ? other != +other
	        : object == +other;

	    case regexpTag:
	    case stringTag:
	      // Coerce regexes to strings and treat strings primitives and string
	      // objects as equal. See https://es5.github.io/#x15.10.6.4 for more details.
	      return object == (other + '');
	  }
	  return false;
	}

	module.exports = equalByTag;


/***/ },
/* 93 */
/***/ function(module, exports, __webpack_require__) {

	var keys = __webpack_require__(11);

	/** Used for native method references. */
	var objectProto = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/**
	 * A specialized version of `baseIsEqualDeep` for objects with support for
	 * partial deep comparisons.
	 *
	 * @private
	 * @param {Object} object The object to compare.
	 * @param {Object} other The other object to compare.
	 * @param {Function} equalFunc The function to determine equivalents of values.
	 * @param {Function} [customizer] The function to customize comparing values.
	 * @param {boolean} [isLoose] Specify performing partial comparisons.
	 * @param {Array} [stackA] Tracks traversed `value` objects.
	 * @param {Array} [stackB] Tracks traversed `other` objects.
	 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
	 */
	function equalObjects(object, other, equalFunc, customizer, isLoose, stackA, stackB) {
	  var objProps = keys(object),
	      objLength = objProps.length,
	      othProps = keys(other),
	      othLength = othProps.length;

	  if (objLength != othLength && !isLoose) {
	    return false;
	  }
	  var index = objLength;
	  while (index--) {
	    var key = objProps[index];
	    if (!(isLoose ? key in other : hasOwnProperty.call(other, key))) {
	      return false;
	    }
	  }
	  var skipCtor = isLoose;
	  while (++index < objLength) {
	    key = objProps[index];
	    var objValue = object[key],
	        othValue = other[key],
	        result = customizer ? customizer(isLoose ? othValue : objValue, isLoose? objValue : othValue, key) : undefined;

	    // Recursively compare objects (susceptible to call stack limits).
	    if (!(result === undefined ? equalFunc(objValue, othValue, customizer, isLoose, stackA, stackB) : result)) {
	      return false;
	    }
	    skipCtor || (skipCtor = key == 'constructor');
	  }
	  if (!skipCtor) {
	    var objCtor = object.constructor,
	        othCtor = other.constructor;

	    // Non `Object` object instances with different constructors are not equal.
	    if (objCtor != othCtor &&
	        ('constructor' in object && 'constructor' in other) &&
	        !(typeof objCtor == 'function' && objCtor instanceof objCtor &&
	          typeof othCtor == 'function' && othCtor instanceof othCtor)) {
	      return false;
	    }
	  }
	  return true;
	}

	module.exports = equalObjects;


/***/ },
/* 94 */
/***/ function(module, exports, __webpack_require__) {

	var isLength = __webpack_require__(20),
	    isObjectLike = __webpack_require__(16);

	/** `Object#toString` result references. */
	var argsTag = '[object Arguments]',
	    arrayTag = '[object Array]',
	    boolTag = '[object Boolean]',
	    dateTag = '[object Date]',
	    errorTag = '[object Error]',
	    funcTag = '[object Function]',
	    mapTag = '[object Map]',
	    numberTag = '[object Number]',
	    objectTag = '[object Object]',
	    regexpTag = '[object RegExp]',
	    setTag = '[object Set]',
	    stringTag = '[object String]',
	    weakMapTag = '[object WeakMap]';

	var arrayBufferTag = '[object ArrayBuffer]',
	    float32Tag = '[object Float32Array]',
	    float64Tag = '[object Float64Array]',
	    int8Tag = '[object Int8Array]',
	    int16Tag = '[object Int16Array]',
	    int32Tag = '[object Int32Array]',
	    uint8Tag = '[object Uint8Array]',
	    uint8ClampedTag = '[object Uint8ClampedArray]',
	    uint16Tag = '[object Uint16Array]',
	    uint32Tag = '[object Uint32Array]';

	/** Used to identify `toStringTag` values of typed arrays. */
	var typedArrayTags = {};
	typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
	typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
	typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
	typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
	typedArrayTags[uint32Tag] = true;
	typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
	typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
	typedArrayTags[dateTag] = typedArrayTags[errorTag] =
	typedArrayTags[funcTag] = typedArrayTags[mapTag] =
	typedArrayTags[numberTag] = typedArrayTags[objectTag] =
	typedArrayTags[regexpTag] = typedArrayTags[setTag] =
	typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;

	/** Used for native method references. */
	var objectProto = Object.prototype;

	/**
	 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objToString = objectProto.toString;

	/**
	 * Checks if `value` is classified as a typed array.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isTypedArray(new Uint8Array);
	 * // => true
	 *
	 * _.isTypedArray([]);
	 * // => false
	 */
	function isTypedArray(value) {
	  return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[objToString.call(value)];
	}

	module.exports = isTypedArray;


/***/ },
/* 95 */
/***/ function(module, exports, __webpack_require__) {

	var isStrictComparable = __webpack_require__(96),
	    pairs = __webpack_require__(97);

	/**
	 * Gets the propery names, values, and compare flags of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the match data of `object`.
	 */
	function getMatchData(object) {
	  var result = pairs(object),
	      length = result.length;

	  while (length--) {
	    result[length][2] = isStrictComparable(result[length][1]);
	  }
	  return result;
	}

	module.exports = getMatchData;


/***/ },
/* 96 */
/***/ function(module, exports, __webpack_require__) {

	var isObject = __webpack_require__(15);

	/**
	 * Checks if `value` is suitable for strict equality comparisons, i.e. `===`.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` if suitable for strict
	 *  equality comparisons, else `false`.
	 */
	function isStrictComparable(value) {
	  return value === value && !isObject(value);
	}

	module.exports = isStrictComparable;


/***/ },
/* 97 */
/***/ function(module, exports, __webpack_require__) {

	var keys = __webpack_require__(11),
	    toObject = __webpack_require__(71);

	/**
	 * Creates a two dimensional array of the key-value pairs for `object`,
	 * e.g. `[[key1, value1], [key2, value2]]`.
	 *
	 * @static
	 * @memberOf _
	 * @category Object
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the new array of key-value pairs.
	 * @example
	 *
	 * _.pairs({ 'barney': 36, 'fred': 40 });
	 * // => [['barney', 36], ['fred', 40]] (iteration order is not guaranteed)
	 */
	function pairs(object) {
	  object = toObject(object);

	  var index = -1,
	      props = keys(object),
	      length = props.length,
	      result = Array(length);

	  while (++index < length) {
	    var key = props[index];
	    result[index] = [key, object[key]];
	  }
	  return result;
	}

	module.exports = pairs;


/***/ },
/* 98 */
/***/ function(module, exports, __webpack_require__) {

	var baseGet = __webpack_require__(99),
	    baseIsEqual = __webpack_require__(88),
	    baseSlice = __webpack_require__(100),
	    isArray = __webpack_require__(23),
	    isKey = __webpack_require__(101),
	    isStrictComparable = __webpack_require__(96),
	    last = __webpack_require__(102),
	    toObject = __webpack_require__(71),
	    toPath = __webpack_require__(103);

	/**
	 * The base implementation of `_.matchesProperty` which does not clone `srcValue`.
	 *
	 * @private
	 * @param {string} path The path of the property to get.
	 * @param {*} srcValue The value to compare.
	 * @returns {Function} Returns the new function.
	 */
	function baseMatchesProperty(path, srcValue) {
	  var isArr = isArray(path),
	      isCommon = isKey(path) && isStrictComparable(srcValue),
	      pathKey = (path + '');

	  path = toPath(path);
	  return function(object) {
	    if (object == null) {
	      return false;
	    }
	    var key = pathKey;
	    object = toObject(object);
	    if ((isArr || !isCommon) && !(key in object)) {
	      object = path.length == 1 ? object : baseGet(object, baseSlice(path, 0, -1));
	      if (object == null) {
	        return false;
	      }
	      key = last(path);
	      object = toObject(object);
	    }
	    return object[key] === srcValue
	      ? (srcValue !== undefined || (key in object))
	      : baseIsEqual(srcValue, object[key], undefined, true);
	  };
	}

	module.exports = baseMatchesProperty;


/***/ },
/* 99 */
/***/ function(module, exports, __webpack_require__) {

	var toObject = __webpack_require__(71);

	/**
	 * The base implementation of `get` without support for string paths
	 * and default values.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @param {Array} path The path of the property to get.
	 * @param {string} [pathKey] The key representation of path.
	 * @returns {*} Returns the resolved value.
	 */
	function baseGet(object, path, pathKey) {
	  if (object == null) {
	    return;
	  }
	  if (pathKey !== undefined && pathKey in toObject(object)) {
	    path = [pathKey];
	  }
	  var index = 0,
	      length = path.length;

	  while (object != null && index < length) {
	    object = object[path[index++]];
	  }
	  return (index && index == length) ? object : undefined;
	}

	module.exports = baseGet;


/***/ },
/* 100 */
/***/ function(module, exports) {

	/**
	 * The base implementation of `_.slice` without an iteratee call guard.
	 *
	 * @private
	 * @param {Array} array The array to slice.
	 * @param {number} [start=0] The start position.
	 * @param {number} [end=array.length] The end position.
	 * @returns {Array} Returns the slice of `array`.
	 */
	function baseSlice(array, start, end) {
	  var index = -1,
	      length = array.length;

	  start = start == null ? 0 : (+start || 0);
	  if (start < 0) {
	    start = -start > length ? 0 : (length + start);
	  }
	  end = (end === undefined || end > length) ? length : (+end || 0);
	  if (end < 0) {
	    end += length;
	  }
	  length = start > end ? 0 : ((end - start) >>> 0);
	  start >>>= 0;

	  var result = Array(length);
	  while (++index < length) {
	    result[index] = array[index + start];
	  }
	  return result;
	}

	module.exports = baseSlice;


/***/ },
/* 101 */
/***/ function(module, exports, __webpack_require__) {

	var isArray = __webpack_require__(23),
	    toObject = __webpack_require__(71);

	/** Used to match property names within property paths. */
	var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\n\\]|\\.)*?\1)\]/,
	    reIsPlainProp = /^\w*$/;

	/**
	 * Checks if `value` is a property name and not a property path.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @param {Object} [object] The object to query keys on.
	 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
	 */
	function isKey(value, object) {
	  var type = typeof value;
	  if ((type == 'string' && reIsPlainProp.test(value)) || type == 'number') {
	    return true;
	  }
	  if (isArray(value)) {
	    return false;
	  }
	  var result = !reIsDeepProp.test(value);
	  return result || (object != null && value in toObject(object));
	}

	module.exports = isKey;


/***/ },
/* 102 */
/***/ function(module, exports) {

	/**
	 * Gets the last element of `array`.
	 *
	 * @static
	 * @memberOf _
	 * @category Array
	 * @param {Array} array The array to query.
	 * @returns {*} Returns the last element of `array`.
	 * @example
	 *
	 * _.last([1, 2, 3]);
	 * // => 3
	 */
	function last(array) {
	  var length = array ? array.length : 0;
	  return length ? array[length - 1] : undefined;
	}

	module.exports = last;


/***/ },
/* 103 */
/***/ function(module, exports, __webpack_require__) {

	var baseToString = __webpack_require__(104),
	    isArray = __webpack_require__(23);

	/** Used to match property names within property paths. */
	var rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\n\\]|\\.)*?)\2)\]/g;

	/** Used to match backslashes in property paths. */
	var reEscapeChar = /\\(\\)?/g;

	/**
	 * Converts `value` to property path array if it's not one.
	 *
	 * @private
	 * @param {*} value The value to process.
	 * @returns {Array} Returns the property path array.
	 */
	function toPath(value) {
	  if (isArray(value)) {
	    return value;
	  }
	  var result = [];
	  baseToString(value).replace(rePropName, function(match, number, quote, string) {
	    result.push(quote ? string.replace(reEscapeChar, '$1') : (number || match));
	  });
	  return result;
	}

	module.exports = toPath;


/***/ },
/* 104 */
/***/ function(module, exports) {

	/**
	 * Converts `value` to a string if it's not one. An empty string is returned
	 * for `null` or `undefined` values.
	 *
	 * @private
	 * @param {*} value The value to process.
	 * @returns {string} Returns the string.
	 */
	function baseToString(value) {
	  return value == null ? '' : (value + '');
	}

	module.exports = baseToString;


/***/ },
/* 105 */
/***/ function(module, exports, __webpack_require__) {

	var baseProperty = __webpack_require__(19),
	    basePropertyDeep = __webpack_require__(106),
	    isKey = __webpack_require__(101);

	/**
	 * Creates a function that returns the property value at `path` on a
	 * given object.
	 *
	 * @static
	 * @memberOf _
	 * @category Utility
	 * @param {Array|string} path The path of the property to get.
	 * @returns {Function} Returns the new function.
	 * @example
	 *
	 * var objects = [
	 *   { 'a': { 'b': { 'c': 2 } } },
	 *   { 'a': { 'b': { 'c': 1 } } }
	 * ];
	 *
	 * _.map(objects, _.property('a.b.c'));
	 * // => [2, 1]
	 *
	 * _.pluck(_.sortBy(objects, _.property(['a', 'b', 'c'])), 'a.b.c');
	 * // => [1, 2]
	 */
	function property(path) {
	  return isKey(path) ? baseProperty(path) : basePropertyDeep(path);
	}

	module.exports = property;


/***/ },
/* 106 */
/***/ function(module, exports, __webpack_require__) {

	var baseGet = __webpack_require__(99),
	    toPath = __webpack_require__(103);

	/**
	 * A specialized version of `baseProperty` which supports deep paths.
	 *
	 * @private
	 * @param {Array|string} path The path of the property to get.
	 * @returns {Function} Returns the new function.
	 */
	function basePropertyDeep(path) {
	  var pathKey = (path + '');
	  path = toPath(path);
	  return function(object) {
	    return baseGet(object, path, pathKey);
	  };
	}

	module.exports = basePropertyDeep;


/***/ },
/* 107 */
/***/ function(module, exports, __webpack_require__) {

	var baseIndexOf = __webpack_require__(75),
	    cacheIndexOf = __webpack_require__(77),
	    createCache = __webpack_require__(78);

	/** Used as the size to enable large array optimizations. */
	var LARGE_ARRAY_SIZE = 200;

	/**
	 * The base implementation of `_.uniq` without support for callback shorthands
	 * and `this` binding.
	 *
	 * @private
	 * @param {Array} array The array to inspect.
	 * @param {Function} [iteratee] The function invoked per iteration.
	 * @returns {Array} Returns the new duplicate free array.
	 */
	function baseUniq(array, iteratee) {
	  var index = -1,
	      indexOf = baseIndexOf,
	      length = array.length,
	      isCommon = true,
	      isLarge = isCommon && length >= LARGE_ARRAY_SIZE,
	      seen = isLarge ? createCache() : null,
	      result = [];

	  if (seen) {
	    indexOf = cacheIndexOf;
	    isCommon = false;
	  } else {
	    isLarge = false;
	    seen = iteratee ? [] : result;
	  }
	  outer:
	  while (++index < length) {
	    var value = array[index],
	        computed = iteratee ? iteratee(value, index, array) : value;

	    if (isCommon && value === value) {
	      var seenIndex = seen.length;
	      while (seenIndex--) {
	        if (seen[seenIndex] === computed) {
	          continue outer;
	        }
	      }
	      if (iteratee) {
	        seen.push(computed);
	      }
	      result.push(value);
	    }
	    else if (indexOf(seen, computed, 0) < 0) {
	      if (iteratee || isLarge) {
	        seen.push(computed);
	      }
	      result.push(value);
	    }
	  }
	  return result;
	}

	module.exports = baseUniq;


/***/ },
/* 108 */
/***/ function(module, exports) {

	/**
	 * An implementation of `_.uniq` optimized for sorted arrays without support
	 * for callback shorthands and `this` binding.
	 *
	 * @private
	 * @param {Array} array The array to inspect.
	 * @param {Function} [iteratee] The function invoked per iteration.
	 * @returns {Array} Returns the new duplicate free array.
	 */
	function sortedUniq(array, iteratee) {
	  var seen,
	      index = -1,
	      length = array.length,
	      resIndex = -1,
	      result = [];

	  while (++index < length) {
	    var value = array[index],
	        computed = iteratee ? iteratee(value, index, array) : value;

	    if (!index || seen !== computed) {
	      seen = computed;
	      result[++resIndex] = value;
	    }
	  }
	  return result;
	}

	module.exports = sortedUniq;


/***/ },
/* 109 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	module.exports = (function () {
	  "use strict";

	  /*
	   * Generated by PEG.js 0.9.0.
	   *
	   * http://pegjs.org/
	   */

	  function peg$subclass(child, parent) {
	    function ctor() {
	      this.constructor = child;
	    }
	    ctor.prototype = parent.prototype;
	    child.prototype = new ctor();
	  }

	  function peg$SyntaxError(message, expected, found, location) {
	    this.message = message;
	    this.expected = expected;
	    this.found = found;
	    this.location = location;
	    this.name = "SyntaxError";

	    if (typeof Error.captureStackTrace === "function") {
	      Error.captureStackTrace(this, peg$SyntaxError);
	    }
	  }

	  peg$subclass(peg$SyntaxError, Error);

	  function peg$parse(input) {
	    var options = arguments.length > 1 ? arguments[1] : {},
	        parser = this,
	        peg$FAILED = {},
	        peg$startRuleFunctions = { Machine: peg$parseMachine },
	        peg$startRuleFunction = peg$parseMachine,
	        peg$c0 = function peg$c0(states) {
	      if (states.length) {
	        states[0].initial = true;
	      }

	      return new Machine({ states: states });
	    },
	        peg$c1 = "{",
	        peg$c2 = { type: "literal", value: "{", description: "\"{\"" },
	        peg$c3 = "}",
	        peg$c4 = { type: "literal", value: "}", description: "\"}\"" },
	        peg$c5 = function peg$c5(states) {
	      if (states.length) {
	        states[0].initial = true;
	      }

	      return states;
	    },
	        peg$c6 = function peg$c6(id, final, states, transitions) {
	      return {
	        id: id,
	        final: !!final,
	        states: states || [],
	        transitions: transitions.map(function (t) {
	          return {
	            target: t.target === true ? id : t.target,
	            event: t.event
	          };
	        })
	      };
	    },
	        peg$c7 = function peg$c7(id) {
	      return id.join('');
	    },
	        peg$c8 = ".",
	        peg$c9 = { type: "literal", value: ".", description: "\".\"" },
	        peg$c10 = function peg$c10(target, subTarget) {
	      return [target, (subTarget || []).join('')].join('');
	    },
	        peg$c11 = "->",
	        peg$c12 = { type: "literal", value: "->", description: "\"->\"" },
	        peg$c13 = function peg$c13(target, event) {
	      return { target: target, event: event };
	    },
	        peg$c14 = "<-",
	        peg$c15 = { type: "literal", value: "<-", description: "\"<-\"" },
	        peg$c16 = function peg$c16(event) {
	      return { target: true, event: event };
	    },
	        peg$c17 = "(",
	        peg$c18 = { type: "literal", value: "(", description: "\"(\"" },
	        peg$c19 = ")",
	        peg$c20 = { type: "literal", value: ")", description: "\")\"" },
	        peg$c21 = function peg$c21(type) {
	      return type;
	    },
	        peg$c22 = "!",
	        peg$c23 = { type: "literal", value: "!", description: "\"!\"" },
	        peg$c24 = function peg$c24(final) {
	      return !!final;
	    },
	        peg$c25 = /^[ \n\t]/,
	        peg$c26 = { type: "class", value: "[ \\n\\t]", description: "[ \\n\\t]" },
	        peg$c27 = /^[a-z0-9_]/i,
	        peg$c28 = { type: "class", value: "[a-z0-9\\_]i", description: "[a-z0-9\\_]i" },
	        peg$c29 = function peg$c29(id) {
	      return id.join('');
	    },
	        peg$currPos = 0,
	        peg$savedPos = 0,
	        peg$posDetailsCache = [{ line: 1, column: 1, seenCR: false }],
	        peg$maxFailPos = 0,
	        peg$maxFailExpected = [],
	        peg$silentFails = 0,
	        peg$result;

	    if ("startRule" in options) {
	      if (!(options.startRule in peg$startRuleFunctions)) {
	        throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
	      }

	      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
	    }

	    function text() {
	      return input.substring(peg$savedPos, peg$currPos);
	    }

	    function location() {
	      return peg$computeLocation(peg$savedPos, peg$currPos);
	    }

	    function expected(description) {
	      throw peg$buildException(null, [{ type: "other", description: description }], input.substring(peg$savedPos, peg$currPos), peg$computeLocation(peg$savedPos, peg$currPos));
	    }

	    function error(message) {
	      throw peg$buildException(message, null, input.substring(peg$savedPos, peg$currPos), peg$computeLocation(peg$savedPos, peg$currPos));
	    }

	    function peg$computePosDetails(pos) {
	      var details = peg$posDetailsCache[pos],
	          p,
	          ch;

	      if (details) {
	        return details;
	      } else {
	        p = pos - 1;
	        while (!peg$posDetailsCache[p]) {
	          p--;
	        }

	        details = peg$posDetailsCache[p];
	        details = {
	          line: details.line,
	          column: details.column,
	          seenCR: details.seenCR
	        };

	        while (p < pos) {
	          ch = input.charAt(p);
	          if (ch === "\n") {
	            if (!details.seenCR) {
	              details.line++;
	            }
	            details.column = 1;
	            details.seenCR = false;
	          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
	            details.line++;
	            details.column = 1;
	            details.seenCR = true;
	          } else {
	            details.column++;
	            details.seenCR = false;
	          }

	          p++;
	        }

	        peg$posDetailsCache[pos] = details;
	        return details;
	      }
	    }

	    function peg$computeLocation(startPos, endPos) {
	      var startPosDetails = peg$computePosDetails(startPos),
	          endPosDetails = peg$computePosDetails(endPos);

	      return {
	        start: {
	          offset: startPos,
	          line: startPosDetails.line,
	          column: startPosDetails.column
	        },
	        end: {
	          offset: endPos,
	          line: endPosDetails.line,
	          column: endPosDetails.column
	        }
	      };
	    }

	    function peg$fail(expected) {
	      if (peg$currPos < peg$maxFailPos) {
	        return;
	      }

	      if (peg$currPos > peg$maxFailPos) {
	        peg$maxFailPos = peg$currPos;
	        peg$maxFailExpected = [];
	      }

	      peg$maxFailExpected.push(expected);
	    }

	    function peg$buildException(message, expected, found, location) {
	      function cleanupExpected(expected) {
	        var i = 1;

	        expected.sort(function (a, b) {
	          if (a.description < b.description) {
	            return -1;
	          } else if (a.description > b.description) {
	            return 1;
	          } else {
	            return 0;
	          }
	        });

	        while (i < expected.length) {
	          if (expected[i - 1] === expected[i]) {
	            expected.splice(i, 1);
	          } else {
	            i++;
	          }
	        }
	      }

	      function buildMessage(expected, found) {
	        function stringEscape(s) {
	          function hex(ch) {
	            return ch.charCodeAt(0).toString(16).toUpperCase();
	          }

	          return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\x08/g, '\\b').replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\f/g, '\\f').replace(/\r/g, '\\r').replace(/[\x00-\x07\x0B\x0E\x0F]/g, function (ch) {
	            return '\\x0' + hex(ch);
	          }).replace(/[\x10-\x1F\x80-\xFF]/g, function (ch) {
	            return '\\x' + hex(ch);
	          }).replace(/[\u0100-\u0FFF]/g, function (ch) {
	            return "\\u0" + hex(ch);
	          }).replace(/[\u1000-\uFFFF]/g, function (ch) {
	            return "\\u" + hex(ch);
	          });
	        }

	        var expectedDescs = new Array(expected.length),
	            expectedDesc,
	            foundDesc,
	            i;

	        for (i = 0; i < expected.length; i++) {
	          expectedDescs[i] = expected[i].description;
	        }

	        expectedDesc = expected.length > 1 ? expectedDescs.slice(0, -1).join(", ") + " or " + expectedDescs[expected.length - 1] : expectedDescs[0];

	        foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";

	        return "Expected " + expectedDesc + " but " + foundDesc + " found.";
	      }

	      if (expected !== null) {
	        cleanupExpected(expected);
	      }

	      return new peg$SyntaxError(message !== null ? message : buildMessage(expected, found), expected, found, location);
	    }

	    function peg$parseMachine() {
	      var s0, s1, s2;

	      s0 = peg$currPos;
	      s1 = [];
	      s2 = peg$parseState();
	      while (s2 !== peg$FAILED) {
	        s1.push(s2);
	        s2 = peg$parseState();
	      }
	      if (s1 !== peg$FAILED) {
	        peg$savedPos = s0;
	        s1 = peg$c0(s1);
	      }
	      s0 = s1;

	      return s0;
	    }

	    function peg$parseStates() {
	      var s0, s1, s2, s3, s4, s5, s6;

	      s0 = peg$currPos;
	      s1 = [];
	      s2 = peg$parsews();
	      while (s2 !== peg$FAILED) {
	        s1.push(s2);
	        s2 = peg$parsews();
	      }
	      if (s1 !== peg$FAILED) {
	        if (input.charCodeAt(peg$currPos) === 123) {
	          s2 = peg$c1;
	          peg$currPos++;
	        } else {
	          s2 = peg$FAILED;
	          if (peg$silentFails === 0) {
	            peg$fail(peg$c2);
	          }
	        }
	        if (s2 !== peg$FAILED) {
	          s3 = [];
	          s4 = peg$parseState();
	          while (s4 !== peg$FAILED) {
	            s3.push(s4);
	            s4 = peg$parseState();
	          }
	          if (s3 !== peg$FAILED) {
	            if (input.charCodeAt(peg$currPos) === 125) {
	              s4 = peg$c3;
	              peg$currPos++;
	            } else {
	              s4 = peg$FAILED;
	              if (peg$silentFails === 0) {
	                peg$fail(peg$c4);
	              }
	            }
	            if (s4 !== peg$FAILED) {
	              s5 = [];
	              s6 = peg$parsews();
	              while (s6 !== peg$FAILED) {
	                s5.push(s6);
	                s6 = peg$parsews();
	              }
	              if (s5 !== peg$FAILED) {
	                peg$savedPos = s0;
	                s1 = peg$c5(s3);
	                s0 = s1;
	              } else {
	                peg$currPos = s0;
	                s0 = peg$FAILED;
	              }
	            } else {
	              peg$currPos = s0;
	              s0 = peg$FAILED;
	            }
	          } else {
	            peg$currPos = s0;
	            s0 = peg$FAILED;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$FAILED;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$FAILED;
	      }

	      return s0;
	    }

	    function peg$parseState() {
	      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10;

	      s0 = peg$currPos;
	      s1 = [];
	      s2 = peg$parsews();
	      while (s2 !== peg$FAILED) {
	        s1.push(s2);
	        s2 = peg$parsews();
	      }
	      if (s1 !== peg$FAILED) {
	        s2 = peg$parseStateId();
	        if (s2 !== peg$FAILED) {
	          s3 = [];
	          s4 = peg$parsews();
	          while (s4 !== peg$FAILED) {
	            s3.push(s4);
	            s4 = peg$parsews();
	          }
	          if (s3 !== peg$FAILED) {
	            s4 = peg$parseFinalToken();
	            if (s4 === peg$FAILED) {
	              s4 = null;
	            }
	            if (s4 !== peg$FAILED) {
	              s5 = [];
	              s6 = peg$parsews();
	              while (s6 !== peg$FAILED) {
	                s5.push(s6);
	                s6 = peg$parsews();
	              }
	              if (s5 !== peg$FAILED) {
	                s6 = peg$parseStates();
	                if (s6 === peg$FAILED) {
	                  s6 = null;
	                }
	                if (s6 !== peg$FAILED) {
	                  s7 = [];
	                  s8 = peg$parsews();
	                  while (s8 !== peg$FAILED) {
	                    s7.push(s8);
	                    s8 = peg$parsews();
	                  }
	                  if (s7 !== peg$FAILED) {
	                    s8 = [];
	                    s9 = peg$parseTransition();
	                    while (s9 !== peg$FAILED) {
	                      s8.push(s9);
	                      s9 = peg$parseTransition();
	                    }
	                    if (s8 !== peg$FAILED) {
	                      s9 = [];
	                      s10 = peg$parsews();
	                      while (s10 !== peg$FAILED) {
	                        s9.push(s10);
	                        s10 = peg$parsews();
	                      }
	                      if (s9 !== peg$FAILED) {
	                        peg$savedPos = s0;
	                        s1 = peg$c6(s2, s4, s6, s8);
	                        s0 = s1;
	                      } else {
	                        peg$currPos = s0;
	                        s0 = peg$FAILED;
	                      }
	                    } else {
	                      peg$currPos = s0;
	                      s0 = peg$FAILED;
	                    }
	                  } else {
	                    peg$currPos = s0;
	                    s0 = peg$FAILED;
	                  }
	                } else {
	                  peg$currPos = s0;
	                  s0 = peg$FAILED;
	                }
	              } else {
	                peg$currPos = s0;
	                s0 = peg$FAILED;
	              }
	            } else {
	              peg$currPos = s0;
	              s0 = peg$FAILED;
	            }
	          } else {
	            peg$currPos = s0;
	            s0 = peg$FAILED;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$FAILED;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$FAILED;
	      }

	      return s0;
	    }

	    function peg$parseStateId() {
	      var s0, s1, s2;

	      s0 = peg$currPos;
	      s1 = [];
	      s2 = peg$parseidentifier();
	      if (s2 !== peg$FAILED) {
	        while (s2 !== peg$FAILED) {
	          s1.push(s2);
	          s2 = peg$parseidentifier();
	        }
	      } else {
	        s1 = peg$FAILED;
	      }
	      if (s1 !== peg$FAILED) {
	        peg$savedPos = s0;
	        s1 = peg$c7(s1);
	      }
	      s0 = s1;

	      return s0;
	    }

	    function peg$parseTargetId() {
	      var s0, s1, s2, s3, s4;

	      s0 = peg$currPos;
	      s1 = peg$parseStateId();
	      if (s1 !== peg$FAILED) {
	        s2 = peg$currPos;
	        if (input.charCodeAt(peg$currPos) === 46) {
	          s3 = peg$c8;
	          peg$currPos++;
	        } else {
	          s3 = peg$FAILED;
	          if (peg$silentFails === 0) {
	            peg$fail(peg$c9);
	          }
	        }
	        if (s3 !== peg$FAILED) {
	          s4 = peg$parseTargetId();
	          if (s4 !== peg$FAILED) {
	            s3 = [s3, s4];
	            s2 = s3;
	          } else {
	            peg$currPos = s2;
	            s2 = peg$FAILED;
	          }
	        } else {
	          peg$currPos = s2;
	          s2 = peg$FAILED;
	        }
	        if (s2 === peg$FAILED) {
	          s2 = null;
	        }
	        if (s2 !== peg$FAILED) {
	          peg$savedPos = s0;
	          s1 = peg$c10(s1, s2);
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$FAILED;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$FAILED;
	      }

	      return s0;
	    }

	    function peg$parseTransition() {
	      var s0, s1, s2, s3, s4;

	      s0 = peg$currPos;
	      if (input.substr(peg$currPos, 2) === peg$c11) {
	        s1 = peg$c11;
	        peg$currPos += 2;
	      } else {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) {
	          peg$fail(peg$c12);
	        }
	      }
	      if (s1 !== peg$FAILED) {
	        s2 = [];
	        s3 = peg$parsews();
	        while (s3 !== peg$FAILED) {
	          s2.push(s3);
	          s3 = peg$parsews();
	        }
	        if (s2 !== peg$FAILED) {
	          s3 = peg$parseTargetId();
	          if (s3 !== peg$FAILED) {
	            s4 = peg$parseSignal();
	            if (s4 === peg$FAILED) {
	              s4 = null;
	            }
	            if (s4 !== peg$FAILED) {
	              peg$savedPos = s0;
	              s1 = peg$c13(s3, s4);
	              s0 = s1;
	            } else {
	              peg$currPos = s0;
	              s0 = peg$FAILED;
	            }
	          } else {
	            peg$currPos = s0;
	            s0 = peg$FAILED;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$FAILED;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$FAILED;
	      }
	      if (s0 === peg$FAILED) {
	        s0 = peg$currPos;
	        if (input.substr(peg$currPos, 2) === peg$c14) {
	          s1 = peg$c14;
	          peg$currPos += 2;
	        } else {
	          s1 = peg$FAILED;
	          if (peg$silentFails === 0) {
	            peg$fail(peg$c15);
	          }
	        }
	        if (s1 !== peg$FAILED) {
	          s2 = [];
	          s3 = peg$parsews();
	          while (s3 !== peg$FAILED) {
	            s2.push(s3);
	            s3 = peg$parsews();
	          }
	          if (s2 !== peg$FAILED) {
	            s3 = peg$parseSignal();
	            if (s3 === peg$FAILED) {
	              s3 = null;
	            }
	            if (s3 !== peg$FAILED) {
	              peg$savedPos = s0;
	              s1 = peg$c16(s3);
	              s0 = s1;
	            } else {
	              peg$currPos = s0;
	              s0 = peg$FAILED;
	            }
	          } else {
	            peg$currPos = s0;
	            s0 = peg$FAILED;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$FAILED;
	        }
	      }

	      return s0;
	    }

	    function peg$parseSignal() {
	      var s0, s1, s2, s3, s4, s5, s6, s7, s8;

	      s0 = peg$currPos;
	      s1 = [];
	      s2 = peg$parsews();
	      while (s2 !== peg$FAILED) {
	        s1.push(s2);
	        s2 = peg$parsews();
	      }
	      if (s1 !== peg$FAILED) {
	        if (input.charCodeAt(peg$currPos) === 40) {
	          s2 = peg$c17;
	          peg$currPos++;
	        } else {
	          s2 = peg$FAILED;
	          if (peg$silentFails === 0) {
	            peg$fail(peg$c18);
	          }
	        }
	        if (s2 !== peg$FAILED) {
	          s3 = [];
	          s4 = peg$parsews();
	          while (s4 !== peg$FAILED) {
	            s3.push(s4);
	            s4 = peg$parsews();
	          }
	          if (s3 !== peg$FAILED) {
	            s4 = peg$parseidentifier();
	            if (s4 !== peg$FAILED) {
	              s5 = [];
	              s6 = peg$parsews();
	              while (s6 !== peg$FAILED) {
	                s5.push(s6);
	                s6 = peg$parsews();
	              }
	              if (s5 !== peg$FAILED) {
	                if (input.charCodeAt(peg$currPos) === 41) {
	                  s6 = peg$c19;
	                  peg$currPos++;
	                } else {
	                  s6 = peg$FAILED;
	                  if (peg$silentFails === 0) {
	                    peg$fail(peg$c20);
	                  }
	                }
	                if (s6 !== peg$FAILED) {
	                  s7 = [];
	                  s8 = peg$parsews();
	                  while (s8 !== peg$FAILED) {
	                    s7.push(s8);
	                    s8 = peg$parsews();
	                  }
	                  if (s7 !== peg$FAILED) {
	                    peg$savedPos = s0;
	                    s1 = peg$c21(s4);
	                    s0 = s1;
	                  } else {
	                    peg$currPos = s0;
	                    s0 = peg$FAILED;
	                  }
	                } else {
	                  peg$currPos = s0;
	                  s0 = peg$FAILED;
	                }
	              } else {
	                peg$currPos = s0;
	                s0 = peg$FAILED;
	              }
	            } else {
	              peg$currPos = s0;
	              s0 = peg$FAILED;
	            }
	          } else {
	            peg$currPos = s0;
	            s0 = peg$FAILED;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$FAILED;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$FAILED;
	      }

	      return s0;
	    }

	    function peg$parseFinalToken() {
	      var s0, s1;

	      s0 = peg$currPos;
	      if (input.charCodeAt(peg$currPos) === 33) {
	        s1 = peg$c22;
	        peg$currPos++;
	      } else {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) {
	          peg$fail(peg$c23);
	        }
	      }
	      if (s1 !== peg$FAILED) {
	        peg$savedPos = s0;
	        s1 = peg$c24(s1);
	      }
	      s0 = s1;

	      return s0;
	    }

	    function peg$parsews() {
	      var s0;

	      if (peg$c25.test(input.charAt(peg$currPos))) {
	        s0 = input.charAt(peg$currPos);
	        peg$currPos++;
	      } else {
	        s0 = peg$FAILED;
	        if (peg$silentFails === 0) {
	          peg$fail(peg$c26);
	        }
	      }

	      return s0;
	    }

	    function peg$parseidentifier() {
	      var s0, s1, s2;

	      s0 = peg$currPos;
	      s1 = [];
	      if (peg$c27.test(input.charAt(peg$currPos))) {
	        s2 = input.charAt(peg$currPos);
	        peg$currPos++;
	      } else {
	        s2 = peg$FAILED;
	        if (peg$silentFails === 0) {
	          peg$fail(peg$c28);
	        }
	      }
	      if (s2 !== peg$FAILED) {
	        while (s2 !== peg$FAILED) {
	          s1.push(s2);
	          if (peg$c27.test(input.charAt(peg$currPos))) {
	            s2 = input.charAt(peg$currPos);
	            peg$currPos++;
	          } else {
	            s2 = peg$FAILED;
	            if (peg$silentFails === 0) {
	              peg$fail(peg$c28);
	            }
	          }
	        }
	      } else {
	        s1 = peg$FAILED;
	      }
	      if (s1 !== peg$FAILED) {
	        peg$savedPos = s0;
	        s1 = peg$c29(s1);
	      }
	      s0 = s1;

	      return s0;
	    }

	    var State = __webpack_require__(63);
	    var Machine = __webpack_require__(7);

	    peg$result = peg$startRuleFunction();

	    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
	      return peg$result;
	    } else {
	      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
	        peg$fail({ type: "end", description: "end of input" });
	      }

	      throw peg$buildException(null, peg$maxFailExpected, peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null, peg$maxFailPos < input.length ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1) : peg$computeLocation(peg$maxFailPos, peg$maxFailPos));
	    }
	  }

	  return {
	    SyntaxError: peg$SyntaxError,
	    parse: peg$parse
	  };
	})();

/***/ },
/* 110 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, '__esModule', {
	  value: true
	});
	exports['default'] = machine;

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

	var _machine = __webpack_require__(7);

	var _machine2 = _interopRequireDefault(_machine);

	function machine(data) {
	  return new _machine2['default'](data, {
	    deterministic: false
	  });
	}

	module.exports = exports['default'];

/***/ },
/* 111 */
/***/ function(module, exports) {

	"use strict";

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});

	function stateReducer(machine) {
	  var initialState = machine.transition();

	  return function (state, signal) {
	    if (state === undefined) state = initialState;

	    if (!signal || !machine.isValidSignal(signal)) {
	      return state;
	    }

	    return machine.transition(state, signal);
	  };
	}

	exports["default"] = stateReducer;
	module.exports = exports["default"];

/***/ },
/* 112 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, '__esModule', {
	  value: true
	});

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

	var _lodashFunctionCurry = __webpack_require__(35);

	var _lodashFunctionCurry2 = _interopRequireDefault(_lodashFunctionCurry);

	function signalFilter(filter, stateReducer) {
	  if (filter === undefined) filter = function () {
	    return true;
	  };

	  return function (state, signal) {
	    if (!state) {
	      return stateReducer();
	    }

	    if (!filter(signal)) {
	      return state;
	    }

	    return stateReducer(state, signal);
	  };
	}

	exports['default'] = (0, _lodashFunctionCurry2['default'])(signalFilter);
	module.exports = exports['default'];

/***/ },
/* 113 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, '__esModule', {
	  value: true
	});

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

	var _matchesState = __webpack_require__(114);

	var _matchesState2 = _interopRequireDefault(_matchesState);

	var _lodashCollectionFind = __webpack_require__(116);

	var _lodashCollectionFind2 = _interopRequireDefault(_lodashCollectionFind);

	var _lodashCollectionFilter = __webpack_require__(123);

	var _lodashCollectionFilter2 = _interopRequireDefault(_lodashCollectionFilter);

	var _lodashCollectionMax = __webpack_require__(126);

	var _lodashCollectionMax2 = _interopRequireDefault(_lodashCollectionMax);

	var _lodashFunctionCurry = __webpack_require__(35);

	var _lodashFunctionCurry2 = _interopRequireDefault(_lodashFunctionCurry);

	var getMatchingStateId = function getMatchingStateId(stateMap, state) {
	  var result = Object.keys(stateMap).filter(function (stateId) {
	    return (0, _matchesState2['default'])(state, stateId);
	  });

	  if (result.length) {
	    return (0, _lodashCollectionMax2['default'])(result, function (s) {
	      return s.length;
	    });
	  }

	  return null;
	};

	var mapState = (0, _lodashFunctionCurry2['default'])(function (stateMap, state) {
	  var matchingStateId = getMatchingStateId(stateMap, state);

	  if (!matchingStateId) return null;

	  return stateMap[matchingStateId];
	});

	var mapOnEntry = (0, _lodashFunctionCurry2['default'])(function (stateMap, state) {
	  var prevState = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

	  // If state hasn't changed, don't do anything
	  if ((0, _matchesState2['default'])(prevState, state)) {
	    return null;
	  }

	  var matchingStateId = getMatchingStateId(stateMap, state);

	  if (matchingStateId !== state) {
	    return mapOnEntry(stateMap, matchingStateId, prevState);
	  }

	  return stateMap[matchingStateId];
	});

	var mapOnExit = (0, _lodashFunctionCurry2['default'])(function (stateMap, state) {
	  var prevState = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

	  // If state hasn't changed, don't do anything
	  if ((0, _matchesState2['default'])(state, prevState)) {
	    return null;
	  }

	  var matchingStateId = getMatchingStateId(stateMap, prevState);

	  if (matchingStateId !== prevState) {
	    return mapOnExit(stateMap, state, matchingStateId);
	  }

	  return stateMap[matchingStateId];
	});

	exports.mapState = mapState;
	exports.mapOnEntry = mapOnEntry;
	exports.mapOnExit = mapOnExit;

/***/ },
/* 114 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, '__esModule', {
	  value: true
	});

	var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

	exports['default'] = matchesState;

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

	var _lodashArrayUnion = __webpack_require__(115);

	var _lodashArrayUnion2 = _interopRequireDefault(_lodashArrayUnion);

	function matchesState(state, superState) {
	  if (state === superState) return true;

	  if (!state || !superState) return false;

	  var _map = [state, superState].map(function (ids) {
	    return ids.split('.').map(function (id, index) {
	      return id + index;
	    });
	  });

	  var _map2 = _slicedToArray(_map, 2);

	  var stateIds = _map2[0];
	  var superStateIds = _map2[1];

	  return (0, _lodashArrayUnion2['default'])(stateIds, superStateIds).length === stateIds.length;
	}

	module.exports = exports['default'];

/***/ },
/* 115 */
/***/ function(module, exports, __webpack_require__) {

	var baseFlatten = __webpack_require__(81),
	    baseUniq = __webpack_require__(107),
	    restParam = __webpack_require__(32);

	/**
	 * Creates an array of unique values, in order, from all of the provided arrays
	 * using [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
	 * for equality comparisons.
	 *
	 * @static
	 * @memberOf _
	 * @category Array
	 * @param {...Array} [arrays] The arrays to inspect.
	 * @returns {Array} Returns the new array of combined values.
	 * @example
	 *
	 * _.union([1, 2], [4, 2], [2, 1]);
	 * // => [1, 2, 4]
	 */
	var union = restParam(function(arrays) {
	  return baseUniq(baseFlatten(arrays, false, true));
	});

	module.exports = union;


/***/ },
/* 116 */
/***/ function(module, exports, __webpack_require__) {

	var baseEach = __webpack_require__(117),
	    createFind = __webpack_require__(120);

	/**
	 * Iterates over elements of `collection`, returning the first element
	 * `predicate` returns truthy for. The predicate is bound to `thisArg` and
	 * invoked with three arguments: (value, index|key, collection).
	 *
	 * If a property name is provided for `predicate` the created `_.property`
	 * style callback returns the property value of the given element.
	 *
	 * If a value is also provided for `thisArg` the created `_.matchesProperty`
	 * style callback returns `true` for elements that have a matching property
	 * value, else `false`.
	 *
	 * If an object is provided for `predicate` the created `_.matches` style
	 * callback returns `true` for elements that have the properties of the given
	 * object, else `false`.
	 *
	 * @static
	 * @memberOf _
	 * @alias detect
	 * @category Collection
	 * @param {Array|Object|string} collection The collection to search.
	 * @param {Function|Object|string} [predicate=_.identity] The function invoked
	 *  per iteration.
	 * @param {*} [thisArg] The `this` binding of `predicate`.
	 * @returns {*} Returns the matched element, else `undefined`.
	 * @example
	 *
	 * var users = [
	 *   { 'user': 'barney',  'age': 36, 'active': true },
	 *   { 'user': 'fred',    'age': 40, 'active': false },
	 *   { 'user': 'pebbles', 'age': 1,  'active': true }
	 * ];
	 *
	 * _.result(_.find(users, function(chr) {
	 *   return chr.age < 40;
	 * }), 'user');
	 * // => 'barney'
	 *
	 * // using the `_.matches` callback shorthand
	 * _.result(_.find(users, { 'age': 1, 'active': true }), 'user');
	 * // => 'pebbles'
	 *
	 * // using the `_.matchesProperty` callback shorthand
	 * _.result(_.find(users, 'active', false), 'user');
	 * // => 'fred'
	 *
	 * // using the `_.property` callback shorthand
	 * _.result(_.find(users, 'active'), 'user');
	 * // => 'barney'
	 */
	var find = createFind(baseEach);

	module.exports = find;


/***/ },
/* 117 */
/***/ function(module, exports, __webpack_require__) {

	var baseForOwn = __webpack_require__(118),
	    createBaseEach = __webpack_require__(119);

	/**
	 * The base implementation of `_.forEach` without support for callback
	 * shorthands and `this` binding.
	 *
	 * @private
	 * @param {Array|Object|string} collection The collection to iterate over.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @returns {Array|Object|string} Returns `collection`.
	 */
	var baseEach = createBaseEach(baseForOwn);

	module.exports = baseEach;


/***/ },
/* 118 */
/***/ function(module, exports, __webpack_require__) {

	var baseFor = __webpack_require__(69),
	    keys = __webpack_require__(11);

	/**
	 * The base implementation of `_.forOwn` without support for callback
	 * shorthands and `this` binding.
	 *
	 * @private
	 * @param {Object} object The object to iterate over.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @returns {Object} Returns `object`.
	 */
	function baseForOwn(object, iteratee) {
	  return baseFor(object, iteratee, keys);
	}

	module.exports = baseForOwn;


/***/ },
/* 119 */
/***/ function(module, exports, __webpack_require__) {

	var getLength = __webpack_require__(18),
	    isLength = __webpack_require__(20),
	    toObject = __webpack_require__(71);

	/**
	 * Creates a `baseEach` or `baseEachRight` function.
	 *
	 * @private
	 * @param {Function} eachFunc The function to iterate over a collection.
	 * @param {boolean} [fromRight] Specify iterating from right to left.
	 * @returns {Function} Returns the new base function.
	 */
	function createBaseEach(eachFunc, fromRight) {
	  return function(collection, iteratee) {
	    var length = collection ? getLength(collection) : 0;
	    if (!isLength(length)) {
	      return eachFunc(collection, iteratee);
	    }
	    var index = fromRight ? length : -1,
	        iterable = toObject(collection);

	    while ((fromRight ? index-- : ++index < length)) {
	      if (iteratee(iterable[index], index, iterable) === false) {
	        break;
	      }
	    }
	    return collection;
	  };
	}

	module.exports = createBaseEach;


/***/ },
/* 120 */
/***/ function(module, exports, __webpack_require__) {

	var baseCallback = __webpack_require__(85),
	    baseFind = __webpack_require__(121),
	    baseFindIndex = __webpack_require__(122),
	    isArray = __webpack_require__(23);

	/**
	 * Creates a `_.find` or `_.findLast` function.
	 *
	 * @private
	 * @param {Function} eachFunc The function to iterate over a collection.
	 * @param {boolean} [fromRight] Specify iterating from right to left.
	 * @returns {Function} Returns the new find function.
	 */
	function createFind(eachFunc, fromRight) {
	  return function(collection, predicate, thisArg) {
	    predicate = baseCallback(predicate, thisArg, 3);
	    if (isArray(collection)) {
	      var index = baseFindIndex(collection, predicate, fromRight);
	      return index > -1 ? collection[index] : undefined;
	    }
	    return baseFind(collection, predicate, eachFunc);
	  };
	}

	module.exports = createFind;


/***/ },
/* 121 */
/***/ function(module, exports) {

	/**
	 * The base implementation of `_.find`, `_.findLast`, `_.findKey`, and `_.findLastKey`,
	 * without support for callback shorthands and `this` binding, which iterates
	 * over `collection` using the provided `eachFunc`.
	 *
	 * @private
	 * @param {Array|Object|string} collection The collection to search.
	 * @param {Function} predicate The function invoked per iteration.
	 * @param {Function} eachFunc The function to iterate over `collection`.
	 * @param {boolean} [retKey] Specify returning the key of the found element
	 *  instead of the element itself.
	 * @returns {*} Returns the found element or its key, else `undefined`.
	 */
	function baseFind(collection, predicate, eachFunc, retKey) {
	  var result;
	  eachFunc(collection, function(value, key, collection) {
	    if (predicate(value, key, collection)) {
	      result = retKey ? key : value;
	      return false;
	    }
	  });
	  return result;
	}

	module.exports = baseFind;


/***/ },
/* 122 */
/***/ function(module, exports) {

	/**
	 * The base implementation of `_.findIndex` and `_.findLastIndex` without
	 * support for callback shorthands and `this` binding.
	 *
	 * @private
	 * @param {Array} array The array to search.
	 * @param {Function} predicate The function invoked per iteration.
	 * @param {boolean} [fromRight] Specify iterating from right to left.
	 * @returns {number} Returns the index of the matched value, else `-1`.
	 */
	function baseFindIndex(array, predicate, fromRight) {
	  var length = array.length,
	      index = fromRight ? length : -1;

	  while ((fromRight ? index-- : ++index < length)) {
	    if (predicate(array[index], index, array)) {
	      return index;
	    }
	  }
	  return -1;
	}

	module.exports = baseFindIndex;


/***/ },
/* 123 */
/***/ function(module, exports, __webpack_require__) {

	var arrayFilter = __webpack_require__(124),
	    baseCallback = __webpack_require__(85),
	    baseFilter = __webpack_require__(125),
	    isArray = __webpack_require__(23);

	/**
	 * Iterates over elements of `collection`, returning an array of all elements
	 * `predicate` returns truthy for. The predicate is bound to `thisArg` and
	 * invoked with three arguments: (value, index|key, collection).
	 *
	 * If a property name is provided for `predicate` the created `_.property`
	 * style callback returns the property value of the given element.
	 *
	 * If a value is also provided for `thisArg` the created `_.matchesProperty`
	 * style callback returns `true` for elements that have a matching property
	 * value, else `false`.
	 *
	 * If an object is provided for `predicate` the created `_.matches` style
	 * callback returns `true` for elements that have the properties of the given
	 * object, else `false`.
	 *
	 * @static
	 * @memberOf _
	 * @alias select
	 * @category Collection
	 * @param {Array|Object|string} collection The collection to iterate over.
	 * @param {Function|Object|string} [predicate=_.identity] The function invoked
	 *  per iteration.
	 * @param {*} [thisArg] The `this` binding of `predicate`.
	 * @returns {Array} Returns the new filtered array.
	 * @example
	 *
	 * _.filter([4, 5, 6], function(n) {
	 *   return n % 2 == 0;
	 * });
	 * // => [4, 6]
	 *
	 * var users = [
	 *   { 'user': 'barney', 'age': 36, 'active': true },
	 *   { 'user': 'fred',   'age': 40, 'active': false }
	 * ];
	 *
	 * // using the `_.matches` callback shorthand
	 * _.pluck(_.filter(users, { 'age': 36, 'active': true }), 'user');
	 * // => ['barney']
	 *
	 * // using the `_.matchesProperty` callback shorthand
	 * _.pluck(_.filter(users, 'active', false), 'user');
	 * // => ['fred']
	 *
	 * // using the `_.property` callback shorthand
	 * _.pluck(_.filter(users, 'active'), 'user');
	 * // => ['barney']
	 */
	function filter(collection, predicate, thisArg) {
	  var func = isArray(collection) ? arrayFilter : baseFilter;
	  predicate = baseCallback(predicate, thisArg, 3);
	  return func(collection, predicate);
	}

	module.exports = filter;


/***/ },
/* 124 */
/***/ function(module, exports) {

	/**
	 * A specialized version of `_.filter` for arrays without support for callback
	 * shorthands and `this` binding.
	 *
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} predicate The function invoked per iteration.
	 * @returns {Array} Returns the new filtered array.
	 */
	function arrayFilter(array, predicate) {
	  var index = -1,
	      length = array.length,
	      resIndex = -1,
	      result = [];

	  while (++index < length) {
	    var value = array[index];
	    if (predicate(value, index, array)) {
	      result[++resIndex] = value;
	    }
	  }
	  return result;
	}

	module.exports = arrayFilter;


/***/ },
/* 125 */
/***/ function(module, exports, __webpack_require__) {

	var baseEach = __webpack_require__(117);

	/**
	 * The base implementation of `_.filter` without support for callback
	 * shorthands and `this` binding.
	 *
	 * @private
	 * @param {Array|Object|string} collection The collection to iterate over.
	 * @param {Function} predicate The function invoked per iteration.
	 * @returns {Array} Returns the new filtered array.
	 */
	function baseFilter(collection, predicate) {
	  var result = [];
	  baseEach(collection, function(value, index, collection) {
	    if (predicate(value, index, collection)) {
	      result.push(value);
	    }
	  });
	  return result;
	}

	module.exports = baseFilter;


/***/ },
/* 126 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(127);


/***/ },
/* 127 */
/***/ function(module, exports, __webpack_require__) {

	var createExtremum = __webpack_require__(128),
	    gt = __webpack_require__(134);

	/** Used as references for `-Infinity` and `Infinity`. */
	var NEGATIVE_INFINITY = Number.NEGATIVE_INFINITY;

	/**
	 * Gets the maximum value of `collection`. If `collection` is empty or falsey
	 * `-Infinity` is returned. If an iteratee function is provided it's invoked
	 * for each value in `collection` to generate the criterion by which the value
	 * is ranked. The `iteratee` is bound to `thisArg` and invoked with three
	 * arguments: (value, index, collection).
	 *
	 * If a property name is provided for `iteratee` the created `_.property`
	 * style callback returns the property value of the given element.
	 *
	 * If a value is also provided for `thisArg` the created `_.matchesProperty`
	 * style callback returns `true` for elements that have a matching property
	 * value, else `false`.
	 *
	 * If an object is provided for `iteratee` the created `_.matches` style
	 * callback returns `true` for elements that have the properties of the given
	 * object, else `false`.
	 *
	 * @static
	 * @memberOf _
	 * @category Math
	 * @param {Array|Object|string} collection The collection to iterate over.
	 * @param {Function|Object|string} [iteratee] The function invoked per iteration.
	 * @param {*} [thisArg] The `this` binding of `iteratee`.
	 * @returns {*} Returns the maximum value.
	 * @example
	 *
	 * _.max([4, 2, 8, 6]);
	 * // => 8
	 *
	 * _.max([]);
	 * // => -Infinity
	 *
	 * var users = [
	 *   { 'user': 'barney', 'age': 36 },
	 *   { 'user': 'fred',   'age': 40 }
	 * ];
	 *
	 * _.max(users, function(chr) {
	 *   return chr.age;
	 * });
	 * // => { 'user': 'fred', 'age': 40 }
	 *
	 * // using the `_.property` callback shorthand
	 * _.max(users, 'age');
	 * // => { 'user': 'fred', 'age': 40 }
	 */
	var max = createExtremum(gt, NEGATIVE_INFINITY);

	module.exports = max;


/***/ },
/* 128 */
/***/ function(module, exports, __webpack_require__) {

	var arrayExtremum = __webpack_require__(129),
	    baseCallback = __webpack_require__(85),
	    baseExtremum = __webpack_require__(130),
	    isArray = __webpack_require__(23),
	    isIterateeCall = __webpack_require__(31),
	    toIterable = __webpack_require__(131);

	/**
	 * Creates a `_.max` or `_.min` function.
	 *
	 * @private
	 * @param {Function} comparator The function used to compare values.
	 * @param {*} exValue The initial extremum value.
	 * @returns {Function} Returns the new extremum function.
	 */
	function createExtremum(comparator, exValue) {
	  return function(collection, iteratee, thisArg) {
	    if (thisArg && isIterateeCall(collection, iteratee, thisArg)) {
	      iteratee = undefined;
	    }
	    iteratee = baseCallback(iteratee, thisArg, 3);
	    if (iteratee.length == 1) {
	      collection = isArray(collection) ? collection : toIterable(collection);
	      var result = arrayExtremum(collection, iteratee, comparator, exValue);
	      if (!(collection.length && result === exValue)) {
	        return result;
	      }
	    }
	    return baseExtremum(collection, iteratee, comparator, exValue);
	  };
	}

	module.exports = createExtremum;


/***/ },
/* 129 */
/***/ function(module, exports) {

	/**
	 * A specialized version of `baseExtremum` for arrays which invokes `iteratee`
	 * with one argument: (value).
	 *
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @param {Function} comparator The function used to compare values.
	 * @param {*} exValue The initial extremum value.
	 * @returns {*} Returns the extremum value.
	 */
	function arrayExtremum(array, iteratee, comparator, exValue) {
	  var index = -1,
	      length = array.length,
	      computed = exValue,
	      result = computed;

	  while (++index < length) {
	    var value = array[index],
	        current = +iteratee(value);

	    if (comparator(current, computed)) {
	      computed = current;
	      result = value;
	    }
	  }
	  return result;
	}

	module.exports = arrayExtremum;


/***/ },
/* 130 */
/***/ function(module, exports, __webpack_require__) {

	var baseEach = __webpack_require__(117);

	/**
	 * Gets the extremum value of `collection` invoking `iteratee` for each value
	 * in `collection` to generate the criterion by which the value is ranked.
	 * The `iteratee` is invoked with three arguments: (value, index|key, collection).
	 *
	 * @private
	 * @param {Array|Object|string} collection The collection to iterate over.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @param {Function} comparator The function used to compare values.
	 * @param {*} exValue The initial extremum value.
	 * @returns {*} Returns the extremum value.
	 */
	function baseExtremum(collection, iteratee, comparator, exValue) {
	  var computed = exValue,
	      result = computed;

	  baseEach(collection, function(value, index, collection) {
	    var current = +iteratee(value, index, collection);
	    if (comparator(current, computed) || (current === exValue && current === result)) {
	      computed = current;
	      result = value;
	    }
	  });
	  return result;
	}

	module.exports = baseExtremum;


/***/ },
/* 131 */
/***/ function(module, exports, __webpack_require__) {

	var isArrayLike = __webpack_require__(17),
	    isObject = __webpack_require__(15),
	    values = __webpack_require__(132);

	/**
	 * Converts `value` to an array-like object if it's not one.
	 *
	 * @private
	 * @param {*} value The value to process.
	 * @returns {Array|Object} Returns the array-like object.
	 */
	function toIterable(value) {
	  if (value == null) {
	    return [];
	  }
	  if (!isArrayLike(value)) {
	    return values(value);
	  }
	  return isObject(value) ? value : Object(value);
	}

	module.exports = toIterable;


/***/ },
/* 132 */
/***/ function(module, exports, __webpack_require__) {

	var baseValues = __webpack_require__(133),
	    keys = __webpack_require__(11);

	/**
	 * Creates an array of the own enumerable property values of `object`.
	 *
	 * **Note:** Non-object values are coerced to objects.
	 *
	 * @static
	 * @memberOf _
	 * @category Object
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property values.
	 * @example
	 *
	 * function Foo() {
	 *   this.a = 1;
	 *   this.b = 2;
	 * }
	 *
	 * Foo.prototype.c = 3;
	 *
	 * _.values(new Foo);
	 * // => [1, 2] (iteration order is not guaranteed)
	 *
	 * _.values('hi');
	 * // => ['h', 'i']
	 */
	function values(object) {
	  return baseValues(object, keys(object));
	}

	module.exports = values;


/***/ },
/* 133 */
/***/ function(module, exports) {

	/**
	 * The base implementation of `_.values` and `_.valuesIn` which creates an
	 * array of `object` property values corresponding to the property names
	 * of `props`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @param {Array} props The property names to get values for.
	 * @returns {Object} Returns the array of property values.
	 */
	function baseValues(object, props) {
	  var index = -1,
	      length = props.length,
	      result = Array(length);

	  while (++index < length) {
	    result[index] = object[props[index]];
	  }
	  return result;
	}

	module.exports = baseValues;


/***/ },
/* 134 */
/***/ function(module, exports) {

	/**
	 * Checks if `value` is greater than `other`.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to compare.
	 * @param {*} other The other value to compare.
	 * @returns {boolean} Returns `true` if `value` is greater than `other`, else `false`.
	 * @example
	 *
	 * _.gt(3, 1);
	 * // => true
	 *
	 * _.gt(3, 3);
	 * // => false
	 *
	 * _.gt(1, 3);
	 * // => false
	 */
	function gt(value, other) {
	  return value > other;
	}

	module.exports = gt;


/***/ }
/******/ ]);