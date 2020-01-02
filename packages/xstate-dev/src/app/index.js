const tabId = chrome.devtools.inspectedWindow.tabId.toString();
const backgroundPort = chrome.runtime.connect({ name: tabId });

console.log(backgroundPort, tabId);

backgroundPort.postMessage({
  name: 'init',
  tabId: chrome.devtools.inspectedWindow.tabId
});

backgroundPort.onMessage.addListener(message => {
  document.write(JSON.stringify(message));
});
