import React, { useState } from "react";
import Button from "@splunk/react-ui/Button";

export const AsyncButton = (props) => {
  const [running, setRunning] = useState(false);

  const action = (e, x) => {
    setRunning(true);
    return props.onClick(e, x).then(setRunning(false));
  };

  return <Button {...props} onClick={action} disabled={running} />;
};
