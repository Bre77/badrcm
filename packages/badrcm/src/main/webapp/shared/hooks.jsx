import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchGet, restPost } from "./fetch";

//const BASE_CONTEXT = { apps: {}, files: [], realname: null, roles: [], username: null, users: {} };

export const useQueryServers = (options = {}) =>
  useQuery(["servers"], () => fetchGet("servers"), {
    placeholderData: [],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    ...options,
  });
export const useQueryContext = (server, options = {}) =>
  useQuery({
    queryKey: ["servers", server],
    queryFn: () => fetchGet("servers", { server }),
    enabled: !!server,
    ...options,
  });

export const useQueriesContext = (servers, options = {}) =>
  useQueries({
    queries: servers.map((server) => ({
      queryKey: ["servers", server],
      queryFn: () => fetchGet("servers", { server }),
      enabled: !!server,
      ...options,
    })),
  });

export const useQueryConfig = ({ server, appcontext, usercontext }, file, options = {}) =>
  useQuery({
    queryKey: ["configs", server, file, appcontext, usercontext],
    queryFn: () => fetchGet("configs", { server, app: appcontext, user: usercontext, file }),
    enabled: !!server,
    ...options,
  });

export const useQueriesConfig = (columns, files, options = {}) =>
  useQueries({
    queries: files.flatMap((file) =>
      columns.map(({ server, appcontext, usercontext }) => ({
        queryKey: ["configs", server, file, appcontext, usercontext],
        queryFn: () => fetchGet("configs", { server, app: appcontext, user: usercontext, file }),
        enabled: !!server,
        ...options,
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
