import * as React from 'react';

type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [property: string]: JSONValue }
  | JSONValue[];

type RenderValueFn = (value: any, path: string[]) => JSX.Element | undefined;

export const JSONViz: React.FC<{
  valueKey: string;
  path: string[];
  value: JSONValue;
  renderValue?: RenderValueFn;
}> = ({ valueKey, path, value, renderValue = () => undefined }) => {
  const maybeRenderedValue = renderValue?.(value, path);

  if (maybeRenderedValue) {
    return maybeRenderedValue;
  }

  if (Array.isArray(value)) {
    return (
      <JSONArrayViz
        valueKey={valueKey}
        path={path.concat(valueKey)}
        value={value}
        renderValue={renderValue}
      />
    );
  }
  if (typeof value === 'object' && value !== null) {
    return (
      <JSONObjectViz
        valueKey={valueKey}
        path={path.concat(valueKey)}
        value={value as Record<string, JSONValue>}
        renderValue={renderValue}
      />
    );
  }

  return (
    <JSONPrimitiveViz
      valueKey={valueKey}
      path={path.concat(valueKey)}
      value={value}
      renderValue={renderValue}
    />
  );
};

const JSONObjectViz: React.FC<{
  valueKey: string;
  path: string[];
  value: Record<string, JSONValue>;
  renderValue: RenderValueFn;
}> = ({ valueKey, path, value, renderValue }) => {
  const isEmpty = Object.keys(value).length === 0 || undefined;

  return (
    <details
      open={Object.keys(value).length > 0 || undefined}
      data-xviz="json-object"
      data-xviz-json-empty={isEmpty}
    >
      <summary data-xviz="json-key">{valueKey}:</summary>
      <div data-xviz="json-value">
        {renderValue(value, path) ||
          Object.entries(value).map(([key, value]) => {
            return (
              <JSONViz
                valueKey={key}
                path={path.concat(key)}
                value={value}
                renderValue={renderValue}
              />
            );
          })}
      </div>
    </details>
  );
};

const JSONArrayViz: React.FC<{
  valueKey: string;
  path: string[];
  value: JSONValue[];
  renderValue: RenderValueFn;
}> = ({ valueKey, path, value, renderValue }) => {
  const isEmpty = value.length === 0 || undefined;
  return (
    <details
      open={value.length > 0 || undefined}
      data-xviz="json-array"
      data-xviz-json-empty={isEmpty}
    >
      <summary data-xviz="json-key">{valueKey}:</summary>
      <div data-xviz="json-value">
        {renderValue(value, path) ||
          value.map((childValue, i) => {
            return (
              <JSONViz
                valueKey={`${i}`}
                path={path.concat(`${i}`)}
                value={childValue}
                key={i}
                renderValue={renderValue}
              />
            );
          })}
      </div>
    </details>
  );
};

const JSONPrimitiveViz: React.FC<{
  valueKey: string;
  path: string[];
  value: string | number | boolean | null;
  renderValue: RenderValueFn;
}> = ({ valueKey, path, value, renderValue }) => {
  const valueType = typeof value;

  return (
    <div data-xviz={`json-primitive`} data-xviz-json-type={valueType}>
      <summary data-xviz="json-key">{valueKey}:</summary>

      {renderValue(value, path) || (
        <div data-xviz="json-value">{JSON.stringify(value)}</div>
      )}
    </div>
  );
};
