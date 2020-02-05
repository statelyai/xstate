let connections = new Map();

/*
 * agent -> content-script.js -> **background.js** -> dev tools
 */
chrome.runtime.onMessage.addListener((request, sender) => {
  if (sender.tab) {
    const { id: tabId } = sender.tab;

    if (Array.from( connections.keys() ).includes(tabId)) {
      connections.get(tabId).postMessage(request);
    }
  } else {
    console.log('sender.tab not defined.');
  }
  return true;
});

/*
 * agent <- content-script.js <- **background.js** <- dev tools
 */
chrome.runtime.onConnect.addListener((port) => {
  const {name: tabId} = port;
  connections.set(Number(tabId), port)

  port.onDisconnect.addListener(() => {
    if (Array.from( connections.keys() ).includes(tabId)) {
      connections.delete(tabId)
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, { status }) => {
  if (Array.from( connections.keys() ).includes(tabId)) {
    const panelPort = connections.get(tabId);

    if (status === 'loading') {
      panelPort.postMessage({
        type: 'pageStartedLoading'
      });
    } else if (status === 'complete') {
      panelPort.postMessage({
        type: 'pageFinishedLoading'
      });
      // panelPort.disconnect();
      // delete connections[tabId];
    }
  

    // connections[tabId].postMessage({
    //   source: 'xstate-devtools',
    //   name: 'reloaded'
    // });
  }
});

// when tab is closed, remove the tabid from `tabs`
chrome.tabs.onRemoved.addListener(tabId => {
  if (Array.from( connections.keys() ).includes(tabId)) {
    connections.delete(tabId)
  }
});

