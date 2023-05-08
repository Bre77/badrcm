import React, { useReducer } from "react";

// Components
import Card from "@splunk/react-ui/Card";
import CardLayout from "@splunk/react-ui/CardLayout";
import Switch from "@splunk/react-ui/Switch";
import Tooltip from "@splunk/react-ui/Tooltip";
import Link from "@splunk/react-ui/Link";
import P from "@splunk/react-ui/Paragraph";

// Shared
import { localSave, options, wrapSetValue } from "../../shared/helpers";
import Page from "../../shared/page";

const Options = () => {
  const [ops, setOps] = useReducer((prev, value) => {
    const x = { ...prev, ...value };
    localSave("BADRCM_options", x);
    return x;
  }, options);
  const handleOps = wrapSetValue(setOps);

  const handleLocalCache = (e, { value }) => {
    !value.localcache && window.localStorage.removeItem("BADRCM_cache");
    setOps(value);
  };
  const handleLocalInput = (e, { value }) => {
    !value.localinput &&
      Object.keys(window.localStorage)
        .filter((x) => x.startsWith("BADRCM_") && x !== "BADRCM_cache" && x !== "BADRCM_disclaimer")
        .forEach((x) => window.localStorage.removeItem(x));
    setOps(value);
  };

  return (
    <CardLayout cardMinWidth={400} wrapCards>
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
        </Card.Body>
      </Card>
      <Card>
        <Card.Header title="Cache" />
        <Card.Body>
          This application stores user input and API results to your browsers{" "}
          <Link openInNewContext to="https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage">
            Local Storage
          </Link>{" "}
          to improve the user experience, page load times, and reduces load on the Splunk servers.
          <br />
          <br />
          <Switch appearance="toggle" selected={ops.localcache} value={{ localcache: !ops.localcache }} onClick={handleLocalCache}>
            Local API Cache{" "}
            <Tooltip content="Improves page load time and reduces Splunk server load by storing API responses in your browsers Local Storage. Turning this off will also delete cached queries." />
          </Switch>
          <Switch appearance="toggle" selected={ops.localinput} value={{ localinput: !ops.localinput }} onClick={handleLocalInput}>
            Local Input Memory{" "}
            <Tooltip content="Remember the servers and contexts you select using your browsers Local Storage. Turning this off will also delete stored inputs." />
          </Switch>
        </Card.Body>
      </Card>
      <Card>
        <Card.Header title="Disclaimer" />
        <Card.Body>
          <P>
            Changes can result in serious problems such as platform issues, data loss, or complete outages. You are responsible for the changes you make, and
            should understand the implications.
          </P>
          <P>
            Splunk are not responsible for outages you cause, and you should always engage Splunk Cloud Support to assist with major changes in Splunk Cloud.
          </P>
        </Card.Body>
      </Card>
      <Card>
        <Card.Header title="Legal" />
        <Card.Body>
          <P>
            This application is offered under the Splunk general terms for third party applications avaliable at{" "}
            <Link to="https://www.splunk.com/en_us/legal/splunk-general-terms.html#third-party" openInNewContext>
              https://www.splunk.com/en_us/legal/splunk-general-terms.html#third-party
            </Link>
          </P>
          <P>
            The{" "}
            <Link to="https://bre77.au/" openInNewContext>
              developer of this application
            </Link>{" "}
            accepts no responsibility or liability for damages or downtime that you may incur of any kind.
          </P>
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
