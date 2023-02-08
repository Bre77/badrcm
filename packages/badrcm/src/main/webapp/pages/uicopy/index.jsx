import React from "react";

// Shared
import Inputs from "../../components/inputs";
import Copier from "./ui_copier";
import { DEFAULT_APP_CONTEXT, SYSTEM_USER_CONTEXT } from "../../shared/const";
import { useLocal } from "../../shared/helpers";
import Page from "../../shared/page";
import { StyledContainer } from "../../shared/styles";

const ViewCopy = () => {
  // State - Page Selectors
  const [uifolders, setUiFolders] = useLocal("BADRCM_edituifilter", ["nav", "views"]); //
  const [apps, setApps] = useLocal("BADRCM_editappfilter", ["search"]);

  const columns = [0, 1].map((z) => {
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

  // Table Expansion
  return (
    <StyledContainer>
      <Inputs {...{ uifolders, setUiFolders, apps, setApps, count: 2, setCount: false, columns }} />
      <br />
      <Copier {...{ apps, uifolders, columns }} />
    </StyledContainer>
  );
};

Page(
  <StyledContainer>
    <ViewCopy />
  </StyledContainer>
);
