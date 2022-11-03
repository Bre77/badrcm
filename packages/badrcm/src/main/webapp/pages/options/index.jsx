import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useReducer } from "react";

// Components
import Card from "@splunk/react-ui/Card";
import CardLayout from "@splunk/react-ui/CardLayout";
import ControlGroup from "@splunk/react-ui/ControlGroup";
import RadioBar from "@splunk/react-ui/RadioBar";
import Switch from "@splunk/react-ui/Switch";
import Tooltip from "@splunk/react-ui/Tooltip";

// Shared
import { localDel, useLocal, wrapSetValue } from "../../shared/helpers";
import Page from "../../shared/page";

/*const useLocalOption = (key, fallback) =>
  useReducer((prev, ) => {
    console.log(prev, value, value2);
    window.localStorage.setItem(key, !value);
    return !value;
  }, window.localStorage.getItem(key) || fallback);*/

const Options = () => {
  const [sort, setNoSort] = useLocal("BADRCM_option_sort", true);
  const handleSort = wrapSetValue(setNoSort);
  const [full, setFull] = useLocal("BADRCM_option_full", true);
  const handleFull = wrapSetValue(setFull);
  const [cloud, setCloud] = useLocal("BADRCM_option_cloud", true);
  const handleCloud = (_, { value }) => {
    setCloud(value);
    !value && localDel("BADRCM_disclaimer");
  };
  const [dangerous, setDangerous] = useLocal("BADRCM_option_dangerous", true);
  const handleDangerous = wrapSetValue(setDangerous);

  return (
    <CardLayout cardMaxWidth={400} wrapCards>
      <Card>
        <Card.Header title="Options" />
        <Card.Body>
          These are saved to your browsers local storage, and only modify your experience with the app locally.
          <br />
          <br />
          <Switch appearance="toggle" selected={sort} value={!sort} onClick={handleSort}>
            Case Insensitive Sort <Tooltip content="Helps find things alphabetically, instead of Splunk's ASCII sort." />
          </Switch>
          <Switch appearance="toggle" selected={full} value={!full} onClick={handleFull}>
            Full Featured Mode <Tooltip content="Can improve page performance by removing secondary functions like add, move, remove, and delete." />
          </Switch>
          <Switch appearance="toggle" selected={cloud} value={!cloud} onClick={handleCloud}>
            Splunk Cloud Compliance{" "}
            <Tooltip content="Certain features are disabled when targeting Splunk Cloud to keep Splunk happy, but they dont have to be." />
          </Switch>
          <Switch appearance="toggle" selected={dangerous} value={!dangerous} onClick={handleDangerous}>
            Dangerous Mode <Tooltip content="The oposite of Safe Mode, enables write and delete." />
          </Switch>
        </Card.Body>
      </Card>
    </CardLayout>
  );
};

Page(<Options />);
