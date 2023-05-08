import React, { useState } from "react";
import Button from "@splunk/react-ui/Button";
import Progress from "@splunk/react-ui/Progress";

export const AsyncButton = (props) => {
  const [running, setRunning] = useState(false);

  const action = (e, x) => {
    setRunning(true);
    return props.onClick(e, x).then(setRunning(false));
  };

  return <Button {...props} onClick={action} disabled={running} />;
};

export const ConfigProgress = ({ configs }) => {
  const progress = configs.reduce((loaded, config) => (loaded -= config.isFetching), configs.length) / configs.length;
  return <Progress percentage={progress * 100} />;
};
