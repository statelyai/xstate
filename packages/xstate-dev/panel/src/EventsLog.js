import React from 'react'
import { FixedSizeList as WindowedList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { format } from 'date-fns';

const EVENT_ROW_HEIGHT = 50

const AnimatedList = React.memo((props) => {
  const listRef = React.useRef();
  const scrollableContainerRef = React.useRef() 

  const scrollTo = (rowIndex) => {
    const scrollOffset = rowIndex * props.itemSize
    // note that my list is vertical which is why I am feeding this to the "top" prop.
    scrollableContainerRef.current.scrollTo({ 
      left: 0, 
      top: scrollOffset,
      behavior: 'smooth',
    });
  }

  React.useEffect(() => {
    console.log('triggered', props.itemCount)
    scrollTo(props.itemCount - 1)
  }, [
    props.itemCount
  ])

  
  return (
    <WindowedList 
      {...props} 
      ref={listRef}
      outerRef={scrollableContainerRef}
      layout="vertical"
    />
  );
}, ((prevProps, nextProps) => prevProps.itemCount === nextProps.itemCount))


const EventsLog = React.memo(({events}) => {
  console.log('EventsLog: events:', events)

  return (
    <AutoSizer>
    {({ width, height }) => (
      <AnimatedList
        className="List"
        height={height}
        width={width}
        itemCount={events.length}
        itemSize={EVENT_ROW_HEIGHT}
        >
        {({ index, style }) => {
          const eventData = events[index];
          return (
            <div
              style={{
                ...style,
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid #ddd',
                padding: '0 0.5em',      
              }}>
              <div>
                <h3>{format(eventData.time, 'hh:mm:ss.SS')}</h3>
                <h2>{JSON.stringify(eventData.event)}</h2>
              </div>
            </div>
          );
        }}
      </AnimatedList>
    )}
  </AutoSizer>
  )
}, ((prevProps, nextProps) => { prevProps.events.length === nextProps.events.length }))

export default EventsLog