import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchGet, restPost, handleRes } from "./fetch";
import { splunkdPath, username } from "@splunk/splunk-utils/config";
import { defaultFetchInit } from "@splunk/splunk-utils/fetch";

//const BASE_CONTEXT = { apps: {}, files: [], realname: null, roles: [], username: null, users: {} };

export const useQueryServers = (options = {}) =>
  useQuery(
    ["servers"],
    () =>
      fetch(`${splunkdPath}/servicesNS/${username}/badrcm/configs/conf-badrcm?output_mode=json&count=0&search=disabled%3Dfalse`, defaultFetchInit)
        .then(handleRes)
        .then((data) => data.entry.map((x) => ({ name: x.name, author: x.author }))),
    {
      placeholderData: [],
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      staleTime: 60000,
      ...options,
    }
  );
export const useQueryContext = (server, options = {}) =>
  useQuery({
    queryKey: ["servers", server],
    queryFn: () => fetchGet("servers", { server }),
    enabled: !!server,
    staleTime: 60000,
    ...options,
  });

export const useQueriesContext = (servers, options = {}) =>
  useQueries({
    queries: servers.map((server) => ({
      queryKey: ["servers", server],
      queryFn: () => fetchGet("servers", { server }),
      enabled: !!server,
      staleTime: 60000,
      ...options,
    })),
  });

export const useQueryConfig = ({ server, appcontext, usercontext }, file, options = {}) =>
  useQuery({
    queryKey: ["configs", server, file, appcontext, usercontext],
    queryFn: () => fetchGet("configs", { server, app: appcontext, user: usercontext, file }),
    staleTime: 15000,
    ...options,
    enabled: !!server && !!file && !!appcontext && !!usercontext && options.enabled,
  });

export const useQueriesConfig = (columns, files, options = {}) =>
  useQueries({
    queries: files.flatMap((file) =>
      columns.map(({ server, appcontext, usercontext }) => ({
        queryKey: ["configs", server, file, appcontext, usercontext],
        queryFn: () => fetchGet("configs", { server, app: appcontext, user: usercontext, file }),
        staleTime: 15000,
        ...options,
        enabled: !!server && !!file && !!appcontext && !!usercontext && options.enabled,
      }))
    ),
  });

export const useMutateConfig = (server, usercontext, appcontext, app, file, stanza, success) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => {
      return restPost("configs", { server, user: usercontext, app, file, stanza }, body);
    },
    onSuccess: (config) => {
      queryClient.setQueryData(["configs", server, file, appcontext, usercontext], (prev) =>
        Object.entries(config).reduce(
          (prev, [app, stanzas]) =>
            Object.entries(stanzas).reduce((prev, [stanza, content]) => {
              prev[app][stanza] = content;
              return prev;
            }, prev),
          prev
        )
      );
      success && success();
    },
  });
};

export const useMutateAcl = (server, usercontext, appcontext, app, file, stanza, acl, key, success) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value) => {
      return restPost(
        "acl",
        { server, file, user: usercontext, app, stanza },
        { sharing: acl.sharing, owner: acl.owner, "perms.read": acl.readers, "perms.write": acl.writers, [key]: value || values }
      );
    },
    onSuccess: (acl) => {
      queryClient.setQueryData(["configs", server, file, appcontext, usercontext], (prev) => {
        prev[app][stanza].acl = acl;
        return prev;
      });
      success && success();
    },
  });
};
