from splunk.clilib.cli_common import getMergedConf
from splunk.rest import simpleRequest
from splunk import RESTException, SplunkdConnectionException
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common


class servers(common.RestHandler):
    def handle(self, in_string):
        args = self.getArgs(in_string)

        # Crash for debugging
        if args.get("path_info") == "crash":
            raise Exception("CRASH")

        if args["method"] == "GET":

            config = getMergedConf(self.APP_NAME)
            config.pop("default")
            config = {
                k: v for (k, v) in config.items() if not self.makebool(v["disabled"])
            }

            # If a specific server is requested, return details
            if "server" in args["query"]:
                server = args["query"]["server"]
                if server == "local":
                    return self.json_response(
                        self.getserver(self.LOCAL_URI, self.AUTHTOKEN)
                    )

                token = self.gettoken(server)
                if type(token) is dict:
                    return token
                return self.json_response(
                    self.getserver(
                        f"https://{self.hostport(server)}",
                        token,
                    )
                )

            # Just return all avaliable servers as an array
            return self.json_response([*config])

        if args["method"] == "POST":
            try:  # Check for required input
                [server, token, share] = self.getInput(
                    args, ["server"], ["token", "share"]
                )
            except Exception as e:
                return self.json_error(
                    "Missing one of the required fields: server, token, share",
                    "Internal",
                    str(e),
                    400,
                )

            try:
                resp, _ = simpleRequest(
                    f"https://{self.hostport(server)}/services",
                    sessionKey=token,
                    raiseAllErrors=True,
                    timeout=5,
                )
            except (RESTException, SplunkdConnectionException) as e:
                return self.json_issue(e)
            except Exception as e:
                return self.json_error(
                    f"POST request to https://{self.hostport(server)}/services failed",
                    e.__class__.__name__,
                    str(e),
                )

            # Add Server
            user_context = "nobody" if share == "true" else self.USER
            sharing = "app" if share == "true" else "user"
            self.logger.info(
                f"Adding {server} for app {self.APP_NAME} user {user_context}"
            )

            # Config
            try:
                resp, _ = simpleRequest(
                    f"{self.LOCAL_URI}/servicesNS/{user_context}/{self.APP_NAME}/configs/conf-{self.APP_NAME}",
                    sessionKey=self.AUTHTOKEN,
                    postargs={"name": server},
                    raiseAllErrors=True,
                )
            except Exception as e:
                return self.json_error(
                    f"POST request to {self.LOCAL_URI}/servicesNS/{user_context}/{self.APP_NAME}/configs/conf-{self.APP_NAME} failed",
                    e.__class__.__name__,
                    str(e),
                )

            # Password Storage
            try:
                resp, _ = simpleRequest(
                    f"{self.LOCAL_URI}/servicesNS/{user_context}/{self.APP_NAME}/storage/passwords",
                    sessionKey=self.AUTHTOKEN,
                    postargs={
                        "realm": self.APP_NAME,
                        "name": server.replace(":", "_"),
                        "password": token,
                    },
                )

                if resp.status == 409:  # Already exists, so update instead
                    resp, _ = simpleRequest(
                        f"{self.LOCAL_URI}/servicesNS/{self.USER}/{self.APP_NAME}/storage/passwords/{self.APP_NAME}%3A{server.replace(':','_')}%3A?output_mode=json&count=1",
                        sessionKey=self.AUTHTOKEN,
                        postargs={"password": token},
                        raiseAllErrors=True,
                    )
            except Exception as e:
                return self.json_error(
                    f"POST request to {self.LOCAL_URI}/servicesNS/{user_context}/{self.APP_NAME}/storage/passwords failed",
                    e.__class__.__name__,
                    e,
                )

            # Password ACL
            try:
                resp, _ = simpleRequest(
                    f"{self.LOCAL_URI}/servicesNS/{self.USER}/{self.APP_NAME}/storage/passwords/{self.APP_NAME}%3A{server.replace(':','_')}%3A/acl?output_mode=json",
                    sessionKey=self.AUTHTOKEN,
                    postargs={"owner": self.USER, "sharing": sharing},
                )
                if resp.status not in [200, 201]:
                    return self.json_error(
                        "Failed to update auth token access control",
                        resp.status,
                        resp.reason,
                    )
            except Exception as e:
                return self.json_error(
                    f"POST request to {self.LOCAL_URI}/servicesNS/{self.USER}/{self.APP_NAME}/storage/passwords/{self.APP_NAME}%3A{server.replace(':','_')}%3A/acl failed",
                    e.__class__.__name__,
                    e,
                )

            return self.json_response({}, 204)

        if args["method"] == "DELETE":
            if "server" not in args["query"]:
                return self.json_error("Missing server field", 400, str(e), 400)
            server = args["query"]["server"]

            # Config
            try:
                resp, _ = simpleRequest(
                    f"{self.LOCAL_URI}/servicesNS/{self.USER}/badrcm/configs/conf-{self.APP_NAME}/{server}",
                    method="DELETE",
                    sessionKey=self.AUTHTOKEN,
                    raiseAllErrors=True,
                )
            except Exception as e:
                return self.json_error(
                    f"DELETE request to {self.LOCAL_URI}/servicesNS/{self.USER}/badrcm/configs/conf-{self.APP_NAME}/{server} failed",
                    e.__class__.__name__,
                    str(e),
                )

            # Password Storage
            try:
                resp, _ = simpleRequest(
                    f"{self.LOCAL_URI}/servicesNS/{self.USER}/badrcm/storage/passwords/{self.APP_NAME}:{server.replace(':', '_')}:",
                    sessionKey=self.AUTHTOKEN,
                    method="DELETE",
                    raiseAllErrors=True,
                )

            except Exception as e:
                return self.json_error(
                    f"DELETE request to {self.LOCAL_URI}/servicesNS/{self.USER}/badrcm/storage/passwords failed",
                    e.__class__.__name__,
                    str(e),
                )

            return self.json_response({}, 204)

        return self.json_error("Method Not Allowed", 405)

    def getserver(self, uri, token):

        # Get all enabled Apps
        apps = {}
        try:
            _, resApps = simpleRequest(
                f"{uri}/services/apps/local?output_mode=json&count=0",
                sessionKey=token,
                raiseAllErrors=True,
            )
            for x in json.loads(resApps)["entry"]:
                if not x["content"]["disabled"]:
                    apps[x["name"]] = [
                        x["content"].get("label"),
                        [0, 1][x["content"].get("visible")],
                        x["content"].get("version"),
                    ]

        except Exception as e:
            self.logger.error(f"Request to {uri}/services/apps/local threw error {e}")

        # Get all Users
        users = {}
        try:
            _, resUsers = simpleRequest(
                f"{uri}/services/authentication/users?output_mode=json&count=0",
                sessionKey=token,
                raiseAllErrors=True,
            )
            for x in json.loads(resUsers)["entry"]:
                users[x["name"]] = [
                    x["content"].get("realname"),
                    x["content"].get("defaultApp"),
                ]
        except Exception as e:
            self.logger.error(
                f"Request to {uri}/services/authentication/users threw error {e}"
            )

        # Get all Conf file names
        files = []
        try:
            _, resFiles = simpleRequest(
                f"{uri}/services/properties?output_mode=json&count=0",
                sessionKey=token,
                raiseAllErrors=True,
            )
            files = [f["name"] for f in json.loads(resFiles)["entry"]]
        except Exception as e:
            self.logger.error(f"Request to {uri}/services/properties threw error {e}")

        # Get all roles and their imported roles
        all_roles = {}
        try:
            _, resRoles = simpleRequest(
                f"{uri}/services/authorization/roles?output_mode=json&count=0",
                sessionKey=token,
                raiseAllErrors=True,
            )
            for role in json.loads(resRoles)["entry"]:
                all_roles[role["name"]] = role["content"]["imported_roles"]
        except Exception as e:
            self.logger.error(
                f"Request to {uri}/services/authorization/roles threw error {e}"
            )

        # Get current context and resolve imported roles
        username = None
        realname = None
        roles = []
        try:
            _, resContext = simpleRequest(
                f"{uri}/services/authentication/current-context?output_mode=json&count=1",
                sessionKey=token,
                raiseAllErrors=True,
            )
            rights = json.loads(resContext)["entry"][0]
            username = rights["content"]["username"]
            realname = rights["content"]["realname"]
            roles = self.rolerecursive(all_roles, rights["content"]["roles"], [])
        except Exception as e:
            self.logger.error(
                f"Request to {uri}/services/authentication/current-context threw error {e}"
            )

        return {
            "apps": apps,
            "users": users,
            "files": files,
            "username": username,
            "realname": realname,
            "roles": roles,
        }

    def rolerecursive(self, all_roles, new_roles, my_roles):
        for role in new_roles:
            if role not in my_roles:
                my_roles.append(role)
                my_roles = self.rolerecursive(all_roles, all_roles[role], my_roles)
        return my_roles
