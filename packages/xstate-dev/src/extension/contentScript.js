const script = document.createElement('script');
script.text = `
(() => {
  const sendMessage = (name, data) => {
    window.postMessage({
      source: 'xstate-devtools',
      name: name,
      data: data || {}
    }, '*');
  };

  let services = {};

  Object.defineProperty(window, '__XSTATE__', {
    value: {
      services: services,
      register: (service) => {
        services[service.sessionId] = {
          state: service.state,
          machine: service.machine.config
        };

        service.subscribe((state) => {
          services[service.sessionId].state = state;
          sendMessage('state', {
            type: 'state',
            state: JSON.stringify(state),
            sessionId: service.sessionId
          })
        })

        service.onEvent(event => {
          const eventData = {
            event: event,
            time: Date.now()
          }

          if (services[service.sessionId].eventsData !== undefined) {
            services[service.sessionId].eventsData.push(eventData)
          } else {
            services[service.sessionId].eventsData = [eventData]
          }
           
          sendMessage('event', {
            type: 'event',
            eventData: JSON.stringify(eventData),
            sessionId: service.sessionId
          })
        })
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
    message === null ||
    message.source !== 'xstate-devtools'
  ) {
    return;
  }

  console.log('contentScript received:', event);

  chrome.runtime.sendMessage(message);
});
/*
 * agent <- **content-script.js** <- background.js <- dev tools
 */
chrome.runtime.onMessage.addListener((request) => {
  console.log('coming from chrome runtime', request);
  request.source = 'xstate-devtools';
  window.postMessage(request, '*');
});
