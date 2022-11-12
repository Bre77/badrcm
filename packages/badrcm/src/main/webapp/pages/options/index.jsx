import React, { useReducer } from "react";

// Components
import Card from "@splunk/react-ui/Card";
import CardLayout from "@splunk/react-ui/CardLayout";
import Button from "@splunk/react-ui/Button";
import Switch from "@splunk/react-ui/Switch";
import Tooltip from "@splunk/react-ui/Tooltip";
import Link from "@splunk/react-ui/Link";

// Shared
import { localSave, options, wrapSetValue } from "../../shared/helpers";
import Page from "../../shared/page";

/*const useLocalOption = (key, fallback) =>
  useReducer((prev, ) => {
    console.log(prev, value, value2);
    window.localStorage.setItem(key, !value);
    return !value;
  }, window.localStorage.getItem(key) || fallback);*/

const Options = () => {
  const [ops, setOps] = useReducer((prev, value) => {
    const x = { ...prev, ...value };
    localSave("BADRCM_options", x);
    return x;
  }, options);
  const handleOps = wrapSetValue(setOps);

  const handleDeleteCache = () => window.localStorage.removeItem("BADRCM_cache");
  const handleDeleteMemory = () =>
    Object.keys(window.localStorage)
      .filter((x) => x.startsWith("BADRCM_") && x !== "BADRCM_cache" && x !== "BADRCM_disclaimer")
      .forEach((x) => window.localStorage.removeItem(x));

  return (
    <CardLayout cardMaxWidth={400} wrapCards>
      <Card>
        <Card.Header title="Options" />
        <Card.Body>
          These are saved to your browsers local storage, and only modify your experience with the app locally.
          <br />
          <br />
          <Switch appearance="toggle" selected={ops.sort} value={{ sort: !ops.sort }} onClick={handleOps}>
            Case Insensitive Sort <Tooltip content="Helps find things alphabetically, instead of Splunk's ASCII sort." />
          </Switch>
          <Switch appearance="toggle" selected={ops.fullmode} value={{ fullmode: !ops.fullmode }} onClick={handleOps}>
            Full Featured Mode <Tooltip content="Can improve page performance by removing secondary functions like add, move, remove, and delete." />
          </Switch>
          <Switch appearance="toggle" selected={ops.cloudsafe} value={{ cloudsafe: !ops.cloudsafe }} onClick={handleOps}>
            Splunk Cloud Compliance{" "}
            <Tooltip content="Certain features are disabled when targeting Splunk Cloud to keep Splunk happy, but they dont have to be." />
          </Switch>
          <Switch appearance="toggle" selected={ops.localcache} value={{ localcache: !ops.localcache }} onClick={handleOps}>
            Local API Cache{" "}
            <Tooltip content="Improves page load time and reduces Splunk server load by storing API responses in your browsers Local Storage." />
          </Switch>
        </Card.Body>
      </Card>
      <Card>
        <Card.Header title="Cache" />
        <Card.Body>
          This application stores user input and the results of API calls to your browsers{" "}
          <Link openInNewContext to="https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage">
            Local Storage
          </Link>{" "}
          to improve page load performance, and reduces load on your Splunk servers.
          <br />
          <br />
          <Button onClick={handleDeleteCache}>Delete API Cache</Button>
          <br />
          <br />
          <Button onClick={handleDeleteMemory}>Delete User Inputs</Button>
        </Card.Body>
      </Card>
    </CardLayout>
  );
};

Page(<Options />);
/*<RadioBar onChange={handleOps} value={ops.sort}>
            <RadioBar.Option value={{ sort: "isort" }} label="Case Insensitive" />
            <RadioBar.Option value={{ sort: "sort" }} label="Case Sensitive" />
            <RadioBar.Option value={{ sort: "nosort" }} label="None" />
          </RadioBar>*/
