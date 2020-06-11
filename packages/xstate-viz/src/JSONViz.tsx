import * as React from 'react';

type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [property: string]: JSONValue }
  | JSONValue[];

export const JSONViz: React.FC<{ valueKey: string; value: JSONValue }> = ({
  valueKey,
  value
}) => {
  if (Array.isArray(value)) {
    return <JSONArrayViz valueKey={valueKey} value={value} />;
  }
  if (typeof value === 'object' && value !== null) {
    return (
      <JSONObjectViz
        valueKey={valueKey}
        value={value as Record<string, JSONValue>}
      />
    );
  }

  return <JSONPrimitiveViz valueKey={valueKey} value={value} />;
};

const JSONObjectViz: React.FC<{
  valueKey: string;
  value: Record<string, JSONValue>;
}> = ({ valueKey, value }) => {
  return (
    <details
      open={Object.keys(value).length > 0 || undefined}
      data-xviz="json-object"
    >
      <summary data-xviz="json-key">{valueKey}</summary>
      <div data-xviz="json-value">
        {Object.entries(value).map(([key, value]) => {
          return <JSONViz valueKey={key} value={value} />;
        })}
      </div>
    </details>
  );
};

const JSONArrayViz: React.FC<{ valueKey: string; value: JSONValue[] }> = ({
  valueKey,
  value
}) => {
  return (
    <details open={value.length > 0 || undefined} data-xviz="json-array">
      <summary data-xviz="json-key">{valueKey}</summary>
      <div data-xviz="json-value">
        {value.map((childValue, i) => {
          return <JSONViz valueKey={'i'} value={childValue} key={i} />;
        })}
      </div>
    </details>
  );
};

const JSONPrimitiveViz: React.FC<{
  valueKey: string;
  value: string | number | boolean | null;
}> = ({ valueKey, value }) => {
  const valueType = typeof value;

  return (
    <div data-xviz={`json-primitive`} data-xviz-json-type={valueType}>
      <strong data-xviz="json-key">{valueKey}</strong>
      <div data-xviz="json-value">{JSON.stringify(value)}</div>
    </div>
  );
};
