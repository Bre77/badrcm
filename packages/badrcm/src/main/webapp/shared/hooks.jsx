import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchGet, restChange } from "./fetch";

//const BASE_CONTEXT = { apps: {}, files: [], realname: null, roles: [], username: null, users: {} };

export const useServers = (options = {}) => useQuery(["servers"], () => fetchGet("servers"), { placeholderData: [], ...options });
export const useContext = (server, options = {}) =>
  useQuery(
    server
      ? {
          queryKey: ["servers", server],
          queryFn: () => fetchGet("servers", { server }),
          ...options,
        }
      : { queryKey: ["servers", null], queryFn: () => Promise.resolve(null) }
  );

export const useContexts = (servers, options = {}) =>
  useQueries({
    queries: servers.map((server) =>
      server
        ? {
            queryKey: ["servers", server],
            queryFn: () => fetchGet("servers", { server }),
            ...options,
          }
        : { queryKey: ["servers", null], queryFn: () => Promise.resolve(null) }
    ),
  });

export const useConfig = ({ server, appcontext, usercontext }, file, options = {}) =>
  useQuery(
    server
      ? {
          queryKey: ["configs", server, file, appcontext, usercontext],
          queryFn: () => fetchGet("configs", { server, app: appcontext, user: usercontext, file }),
          ...options,
        }
      : { queryKey: ["configs", null], queryFn: () => Promise.resolve(null) }
  );

export const useConfigs = (columns, files, options = {}) =>
  useQueries({
    queries: files.flatMap((file) =>
      columns.map(({ server, appcontext, usercontext }) =>
        server
          ? {
              queryKey: ["configs", server, file, appcontext, usercontext],
              queryFn: () => fetchGet("configs", { server, app: appcontext, user: usercontext, file }),
              ...options,
            }
          : { queryKey: ["configs", null], queryFn: () => Promise.resolve(null) }
      )
    ),
  });

export const useMutateConfig = (server, usercontext, appcontext, app, file, stanza, success) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => {
      return restChange("configs", { server, user: usercontext, app, file, stanza }, body);
    },
    onSuccess: (config) => {
      queryClient.setQueryData(["configs", server, file, appcontext, usercontext], (prev) => {
        prev[app][stanza] = config[app][stanza];
        return prev;
      });
      success && success();
    },
  });
};
