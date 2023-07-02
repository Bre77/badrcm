import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient, QueryClientProvider, useIsFetching } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { persistQueryClient, removeOldestQuery } from "@tanstack/react-query-persist-client";
import React, { useState } from "react";
import { createGlobalStyle } from "styled-components";

// Shared
import { options } from "./helpers";

// Splunk UI
import layout from "@splunk/react-page";
import ToastMessages from "@splunk/react-toast-notifications/ToastMessages";
import Button from "@splunk/react-ui/Button";
import Link from "@splunk/react-ui/Link";
import Modal from "@splunk/react-ui/Modal";
import P from "@splunk/react-ui/Paragraph";
import Progress from "@splunk/react-ui/Progress";
import { getUserTheme } from "@splunk/splunk-utils/themes";
import variables from "@splunk/themes/variables";

// Theme based background colour
const GlobalStyle = createGlobalStyle`
    body {
        background-color: ${variables.backgroundColorPage};
    }
`;

// The disclaimer to make Splunk happy
const Disclaimer = () => {
  const [open, setOpen] = useState(!window.localStorage.getItem("BADRCM_disclaimer"));

  const close = () => {
    setOpen(false);
    window.localStorage.setItem("BADRCM_disclaimer", Date.now());
  };
  // prettier-ignore
  return (
    <Modal open={open} initialFocus="container" style={{ width: "600px" }}>
      <Modal.Header title="Disclaimer" />
      <Modal.Body>
        <P>
          This application is offered under the Splunk general terms for third party applications avaliable at <Link to="https://www.splunk.com/en_us/legal/splunk-general-terms.html#third-party" openInNewContext>https://www.splunk.com/en_us/legal/splunk-general-terms.html#third-party</Link>
        </P>
        <P>
          Brett Adams' Dangerous Remote Configuration Manager (BADRCM) allows administrators to read, write, and modify Splunk configuration to the fullest extent
          of your account and the authentication tokens it's configured with.
        </P>
        <P>
          Changes can result in serious problems such as platform issues, data loss, or complete outages. You are responsible for the changes you make, and should
          understand the implications.
        </P>
        <P>Splunk are not responsible for outages you cause, and you should always engage Splunk Cloud Support to assist with major changes in Splunk Cloud.</P>
        <P>
          By default all users with the admin or sc_admin role on this Search Head have access to this application, but any servers and auth tokens you configure are not shared.
        </P>
        <P>
          The <Link to="https://bre77.au/" openInNewContext>developer of this application</Link> accepts no responsibility or liability for damages or downtime that you may incur of any kind.
        </P>
      </Modal.Body>
      <Modal.Footer>
        <Button appearance="secondary" label="Get Me Out Of Here" to="/" />
        <Button appearance="primary" onClick={close} label="I Understand" />
      </Modal.Footer>
    </Modal>
  );
};

// Global isFetching bar
const Loading = () => {
  const isFetching = useIsFetching();
  return isFetching ? <Progress percentage={100} /> : <div style={{ height: "3px" }}></div>;
};

// Setup the query client with defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      cacheTime: 300000, // 5 minutes
      retry: false, //process.env.NODE_ENV === "production",
      refetchOnMount: true,
      staleTime: 300000,
      //notifyOnChangeProps: "tracked",
      //refetchOnWindowFocus: process.env.NODE_ENV === "production",
    },
  },
});

// If enabled, setup LocalStorage cache with compression
if (options.localcache) {
  persistQueryClient({
    queryClient,
    persister: createSyncStoragePersister({
      storage: window.localStorage,
      key: "BADRCM_cache",
      retry: removeOldestQuery,
      /*serialize: (data) => {
        console.time("Compressing");
        let z = compress(JSON.stringify(data));
        console.timeEnd("Compressing");
        return z;
      },
      deserialize: (data) => {
        console.time("Decompressing");
        let z = JSON.parse(decompress(data));
        console.timeEnd("Decompressing");
        return z;
      },*/
      serialize: (data) => {
        //console.time("Cache Compressing");
        let z = JSON.stringify(data);
        //console.timeEnd("Cache Compressing");
        return z;
      },
      deserialize: (data) => {
        //console.time("Cache Decompressing");
        let z = {};
        try {
          z = JSON.parse(data);
        } catch {}
        //console.timeEnd("Cache Decompressing");
        return z;
      },
    }),
  });
}

// Return the page
export default (component) =>
  getUserTheme()
    .then((theme) => {
      layout(
        <>
          <GlobalStyle />
          <QueryClientProvider client={queryClient}>
            <Loading />
            {component}
            <ReactQueryDevtools />
          </QueryClientProvider>
          <ToastMessages />
          <Disclaimer />
        </>,
        { theme }
      );
    })
    .catch((e) => {
      const errorEl = document.createElement("span");
      errorEl.innerHTML = e;
      document.body.appendChild(errorEl);
    });
