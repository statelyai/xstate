import * as React from 'react';

type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [property: string]: JSONValue }
  | JSONValue[];

type RenderValueFn = (value: any, path: string[]) => JSX.Element | undefined;

export interface JsonVizOptions {
  initialOpen: (value: JSONValue, path: string[]) => boolean;
}

export const defaultJsonVizOptions: JsonVizOptions = {
  initialOpen: (value, path) => {
    if (path[path.length - 1].startsWith('_')) {
      return false;
    }

    if (Array.isArray(value) && value.length === 0) {
      return false;
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      Object.keys(value).length === 0
    ) {
      return false;
    }

    return true;
  }
};

const JSONVizContext = React.createContext<
  { value: JSONValue } & JsonVizOptions
>(null as any);

export const JSONViz: React.FC<{
  valueKey: string;
  path: string[];
  value: JSONValue;
  renderValue?: RenderValueFn;
  options?: Partial<JsonVizOptions>;
}> = ({
  valueKey,
  path,
  value,
  renderValue = () => undefined,
  options = defaultJsonVizOptions
}) => {
  const resolvedJsonVizOptions = {
    ...defaultJsonVizOptions,
    ...options
  };

  const maybeRenderedValue = renderValue?.(value, path);

  if (maybeRenderedValue) {
    return maybeRenderedValue;
  }

  let component: React.ReactNode;

  if (Array.isArray(value)) {
    component = (
      <JSONArrayViz
        valueKey={valueKey}
        path={path.concat(valueKey)}
        value={value}
        renderValue={renderValue}
      />
    );
  } else if (typeof value === 'object' && value !== null) {
    component = (
      <JSONObjectViz
        valueKey={valueKey}
        path={path.concat(valueKey)}
        value={value as Record<string, JSONValue>}
        renderValue={renderValue}
      />
    );
  } else {
    component = (
      <JSONPrimitiveViz
        valueKey={valueKey}
        path={path.concat(valueKey)}
        value={value}
        renderValue={renderValue}
      />
    );
  }

  return (
    <JSONVizContext.Provider value={{ value, ...resolvedJsonVizOptions }}>
      {component}
    </JSONVizContext.Provider>
  );
};

export const JSONObjectViz: React.FC<{
  valueKey: string;
  path: string[];
  value: Record<string, JSONValue>;
  renderValue: RenderValueFn;
}> = ({ valueKey, path, value, renderValue }) => {
  const options = React.useContext(JSONVizContext);
  const isEmpty = Object.keys(value).length === 0 || undefined;

  return (
    <details
      open={options.initialOpen(value, path) || undefined}
      data-xviz="json-object"
      data-xviz-json-empty={isEmpty}
    >
      <summary data-xviz="json-key">{valueKey}:</summary>
      <div data-xviz="json-value">
        {renderValue(value, path) ||
          Object.entries(value).map(([key, value]) => {
            return (
              <JSONViz
                key={key}
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

export const JSONPrimitiveViz: React.FC<{
  valueKey: string;
  path: string[];
  value: string | number | boolean | null;
  renderValue?: RenderValueFn;
}> = ({ valueKey, path, value, renderValue }) => {
  const valueType = typeof value;

  return (
    <div data-xviz={`json-primitive`} data-xviz-json-type={valueType}>
      <summary data-xviz="json-key">{valueKey}:</summary>

      {renderValue?.(value, path) || (
        <div data-xviz="json-value">{JSON.stringify(value)}</div>
      )}
    </div>
  );
};

export const JSONCustomViz: React.FC<{
  valueKey: string;
  path: string[];
  type?: string;
}> = ({ valueKey, path, children, type = 'custom' }) => {
  return (
    <div data-xviz={`json-${type}`} data-xviz-json-type={type}>
      <summary data-xviz="json-key">{valueKey}:</summary>

      <div data-xviz="json-value">{children}</div>
    </div>
  );
};
