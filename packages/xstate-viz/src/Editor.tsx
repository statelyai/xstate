import { UnControlled, Controlled as CodeMirror } from "react-codemirror2";

// import 'codemirror/mode/json/json';
import { useState, useEffect } from "react";

if (typeof window !== "undefined" && typeof window.navigator !== "undefined") {
  require("codemirror/mode/javascript/javascript");
}

const Editor: React.FC<{
  value: string;
  className?: string;
  onChange?: (value: string) => void;
  controlled?: boolean;
}> = ({ value, className, onChange, controlled = false }) => {
  useEffect(() => {
    onChange?.(value);
  }, []);

  // const CodeMirror = controlled ? Controlled : UnControlled;

  return (
    <div data-xviz="editor">
      <CodeMirror
        value={value}
        className={className}
        options={{
          mode: {
            name: "javascript",
            json: true,
          },
          theme: "material-ocean",
          lineNumbers: true,
          tabSize: 2,
        }}
        onBeforeChange={(editor, data, value) => {
          onChange?.(value);
        }}
      ></CodeMirror>
    </div>
  );
};

export default Editor;
