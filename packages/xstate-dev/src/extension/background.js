var connections = {};

/*
 * agent -> content-script.js -> **background.js** -> dev tools
 */
chrome.runtime.onMessage.addListener(function(request, sender) {
  if (sender.tab) {
    var tabId = sender.tab.id;
    if (tabId in connections) {
      connections[tabId].postMessage(request);
    } else {
      console.log(
        'Tab not found in connection list.',
        request,
        sender,
        connections
      );
    }
  } else {
    console.log('sender.tab not defined.');
  }
  return true;
});

/*
 * agent <- content-script.js <- **background.js** <- dev tools
 */
chrome.runtime.onConnect.addListener(function(port) {
  console.log({ port });
  // Listen to messages sent from the DevTools page
  port.onMessage.addListener(function(request) {
    console.log('incoming message from dev tools page', request);

    // Register initial connection
    if (request.name === 'init') {
      connections[request.tabId] = port;

      port.onDisconnect.addListener(function() {
        delete connections[request.tabId];
      });

      return;
    }

    // Otherwise, broadcast to agent
    chrome.tabs.sendMessage(request.tabId, {
      name: request.name,
      data: request.data
    });
  });
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  console.log(tabId, connections, changeInfo);
  if (tabId in connections && changeInfo.status === 'complete') {
    // TODO: reload connection to page somehow...?
    connections[tabId].postMessage({
      source: 'xstate-devtools',
      name: 'reloaded'
    });
  }
});
