import React from "react";

// Main Components
import Inputs from "../../components/inputs.jsx";
import Editor from "./editor";

// Shared
import { COLUMN_INDEX, DEFAULT_APP_CONTEXT, SYSTEM_USER_CONTEXT } from "../../shared/const";
import { useLocal } from "../../shared/helpers";
import Page from "../../shared/page";
import { StyledContainer } from "../../shared/styles";

const ConfigEdit = () => {
  // State - Page Selectors
  const [files, setFiles] = useLocal("BADRCM_editfilefilter", ["props", "transforms"]); //
  const [apps, setApps] = useLocal("BADRCM_editappfilter", ["search"]);
  const [count, setCount] = useLocal("BADRCM_editcolumncount", 2);

  const allcolumns = COLUMN_INDEX.map((z) => {
    const [server, setServer] = useLocal(`BADRCM_editserver${z}`);
    const [appcontext, setAppContext] = useLocal(`BADRCM_editappcontext${z}`, DEFAULT_APP_CONTEXT.name);
    const [usercontext, setUserContext] = useLocal(`BADRCM_editusercontext${z}`, SYSTEM_USER_CONTEXT.name);

    return {
      server,
      setServer,
      appcontext,
      setAppContext,
      usercontext,
      setUserContext,
    };
  });

  const columns = allcolumns.slice(0, count);

  // Table Expansion
  return (
    <StyledContainer>
      <Inputs {...{ files, setFiles, apps, setApps, count, setCount, columns }} />
      <br />
      <Editor {...{ apps, files, columns }} />
    </StyledContainer>
  );
};

Page(<ConfigEdit />);
