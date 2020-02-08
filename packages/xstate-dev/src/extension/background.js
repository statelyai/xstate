let connections = new Map();

const possibleMessageTypesFromContentScript = [
  'retrievingInitialServices',
  'registerService',
  'stateUpdate'
]

/*
 * agent -> content-script.js -> **background.js** -> dev tools
 */
chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.tab && message.source === 'xstate-devtools') {

    if (message.data && possibleMessageTypesFromContentScript.includes(message.data.type)) {
      const { id: tabId } = sender.tab;
      
      if (Array.from( connections.keys() ).includes(tabId)) {
    
        connections.get(tabId).postMessage(message);
      }  
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
  const {name: stringifiedTabId} = port;
  const tabId = Number(stringifiedTabId)
  connections.set(tabId, port)

  console.log('background sending getCurrentServices to content', tabId)

  chrome.tabs.sendMessage(
    tabId,
    {
      source: 'xstate-devtools',
      data: {
        type: 'getCurrentServices'
      }
  })


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

