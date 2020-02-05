const script = document.createElement('script');

script.text = `
(() => {
  const sendMessage = (data) => {
    const sentData = Object.assign(data || {}, {
      from: 'injected-script'
    })

    window.postMessage({
      source: 'xstate-devtools',
      data: sentData
    }, '*');
  
  };

  let services = {};


  Object.defineProperty(window, '__XSTATE__', {
    value: {
      services: services,
      register: (service) => {

        services[service.sessionId] = {
          state: service.state,
          machine: service.machine.config,
          eventsLog: [],
          statesAfterEvent: []
        };

        sendMessage({
          type: 'state',
          state: 'what',
          eventData: 'lol',
          sessionId: service.sessionId
        })

        service.subscribe((state, ...args) => {
          const eventData = {
            event: state.event,
            time: Date.now()
          }

          services[service.sessionId].state = state;
          services[service.sessionId].eventsLog.push({ eventData: eventData })
          services[service.sessionId].statesAfterEvent.push(state)

          sendMessage({
            type: 'state',
            state: JSON.stringify(state),
            eventData: JSON.stringify(eventData),
            sessionId: service.sessionId
          })

        })

        window.addEventListener('message', (event) => {
          // Only accept messages from same frame
                
          if (event.source !== window) {
            return;
          }
        
          const message = event.data;
        
          // Only accept messages of correct format (our messages)
          if (
            typeof message !== 'object' ||
            message === null
          ) {
            return;
          }
        
          if (message.source === 'xstate-devtools' && message.data.from === 'content-script') {
            sendMessage({
              type: 'state',
              state: JSON.stringify(state),
              eventData: JSON.stringify(eventData),
              sessionId: service.sessionId
            })
          }
        });
      }
    },
  });
})();
`;
script.onload = () => {
  script.parentNode.removeChild(script);
};
(document.head || document.documentElement).appendChild(script);

/*
 * agent -> **content-script.js** -> background.js -> dev tools
 */
window.addEventListener('message', (event) => {
  // Only accept messages from same frame
  if (event.source !== window) {
    return;
  }

  const message = event.data;

  // Only accept messages of correct format (our messages)
  if (
    typeof message !== 'object' ||
    message === null
  ) {
    return;
  }

  if (message.source === 'xstate-devtools' && message.data.from === 'injected-script') {

    chrome.runtime.sendMessage(message);
  }
  
});
/*
 * agent <- **content-script.js** <- background.js <- dev tools
 */
chrome.runtime.onMessage.addListener((request) => {
  request.source = 'xstate-devtools';
  request.data.from = 'content-script'
  window.postMessage(request, '*');
});
