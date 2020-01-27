import React from 'react'
import { FixedSizeList as WindowedList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { format } from 'date-fns';
import styled from 'styled-components';
import JSONTree from 'react-json-tree';
import { diff } from 'deep-object-diff'

const EventsLogViewFrame = styled.div`
  display: flex;
  height: 100%;
  padding: 2px;

  & > div {
    border: 1px solid black;
  }

  & > div + div {
    margin-left: 2px;
  }

`

const EVENT_ROW_HEIGHT = 60 // 16 + 20 + 16 + 4 x 2 = 60

const AnimatedList = (props) => {
  const listRef = React.useRef();
  const scrollableContainerRef = React.useRef() 

  const scrollTo = (rowIndex) => {
    const scrollOffset = rowIndex * props.itemSize
    scrollableContainerRef.current.scrollTo({ 
      left: 0, 
      top: scrollOffset,
      behavior: 'smooth',
    });
  }

  React.useEffect(() => {
    scrollTo(props.itemCount - 1)
  }, [props.itemCount])

  
  return (
    <WindowedList 
      {...props} 
      ref={listRef}
      outerRef={scrollableContainerRef}
      layout="vertical"
    />
  );
}

const theme = {
  scheme: 'monokai',
  author: 'wimer hazenberg (http://www.monokai.nl)',
  base00: '#272822',
  base01: '#383830',
  base02: '#49483e',
  base03: '#75715e',
  base04: '#a59f85',
  base05: '#f8f8f2',
  base06: '#f5f4f1',
  base07: '#f9f8f5',
  base08: '#f92672',
  base09: '#fd971f',
  base0A: '#f4bf75',
  base0B: '#a6e22e',
  base0C: '#a1efe4',
  base0D: '#66d9ef',
  base0E: '#ae81ff',
  base0F: '#cc6633'
};

const EventDetails = ({event, time, extendedStateDiffData}) => {
  let eventPayload = Object.assign({}, event)
  delete eventPayload['type']

return (
    <>
      <h1>Event Details</h1>
      <h3>{time}</h3>
      <h2>{event.type}</h2>
      <h2>{JSON.stringify(eventPayload)}</h2>
      <hr/>
      <h1>Extended State Diff</h1>
      <JSONTree data={extendedStateDiffData} theme={theme} invertTheme hideRoot={true} />
    </>
  )
}


const EventsLog = ({eventsLog, machine}) => {
  const [chosenEventIndex, setChosenEvent] = React.useState(null)
  const [extendedStateDiffDataOnChosenEvent, setExtendedStateDiffDataOnChosenEvent] = React.useState({})

  console.log('eventsLog:', eventsLog)

  React.useEffect(() => {
    if (eventsLog.length > 0) {
      const newChosenEventIndex = eventsLog.length - 1
      setChosenEvent(newChosenEventIndex)

      const stateBeforeChosenEvent = chosenEventIndex === null || chosenEventIndex === 0
        ? machine.initialState
        : eventsLog[newChosenEventIndex - 1].stateAfter

      const extendedStateBeforeChosenEvent = stateBeforeChosenEvent.context
    
      const stateAfterChosenEvent = eventsLog[newChosenEventIndex].stateAfter
  
      const etendedStateAfterChosenEvent = stateAfterChosenEvent.context

      const theExtendedStateDiffOnChosenEvent = diff(extendedStateBeforeChosenEvent, etendedStateAfterChosenEvent) 
  
      setExtendedStateDiffDataOnChosenEvent(theExtendedStateDiffOnChosenEvent)
    }

  }, [eventsLog.length])


  return (
    <EventsLogViewFrame>
      <div style={{width: '20%'}}>
        <AutoSizer>
        {({ width, height }) => (
          <AnimatedList
            className="List"
            height={height}
            width={width}
            itemCount={eventsLog.length}
            itemSize={EVENT_ROW_HEIGHT}
            >
            {({ index, style }) => {
              const eventData = eventsLog[index].eventData;

              let eventPayload = Object.assign({}, eventData.event)
              delete eventPayload['type']

              return (
                <div
                  style={{
                    ...style,
                    pointerEvents: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    borderBottom: '1px solid #ddd',
                    margin: '4px',
                    backgroundColor: index === chosenEventIndex ? 'skyblue' : 'white'    
                  }}>
                  <div>
                    <h2 style={{margin: 0, fontSize: 16}}>{format(eventData.time, 'hh:mm:ss.SS')}</h2>
                    <h2 style={{margin: 0, fontSize: 20}}>{eventData.event.type}</h2>
                    <h2 style={{margin: 0, fontSize: 16}}>{JSON.stringify(eventPayload)}</h2>
                  </div>
                </div>
              );
            }}
          </AnimatedList>
        )}
      </AutoSizer>
    </div>
    <div style={{width: '80%', padding: '2px'}}>
      {chosenEventIndex !== null &&
      <EventDetails
        event={eventsLog[chosenEventIndex].eventData.event}
        time={format(eventsLog[chosenEventIndex].eventData.time, 'hh:mm:ss.SS')}
        extendedStateDiffData={extendedStateDiffDataOnChosenEvent}/>}
    </div>
  </EventsLogViewFrame>
  )
}

export default EventsLog