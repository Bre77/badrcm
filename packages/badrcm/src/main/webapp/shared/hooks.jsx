import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchGet, restPost } from "./fetch";

//const BASE_CONTEXT = { apps: {}, files: [], realname: null, roles: [], username: null, users: {} };

export const useQueryServers = (options = {}) =>
  useQuery(["servers"], () => fetchGet("servers"), {
    placeholderData: [],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 60000,
    ...options,
  });
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

/*if (app && ![...Object.keys(context.data.apps), SYSTEM_APP_CONTEXT.name].includes(app)) {
  console.log("Resetting App Context", app, "didnt exist");
  setApp(null);
}
if (user && ![...Object.keys(context.data.users), SYSTEM_USER_CONTEXT.name].includes(user)) {
  console.log("Resetting User Context", user, "didnt exist");
  setUser(null);
}
if (file && !context.data.files.includes(file)) {
  console.log("Resetting File Context", file, "didnt exist");
  setFile(null);
}*/

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
