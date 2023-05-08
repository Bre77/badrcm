from splunk.rest import simpleRequest
import json
import sys
import os
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common

ATTR_BLACKLIST = [
    "eai:acl",
    "eai:appName",
    "eai:userName",
    "eai:type",
    "rootNode",
    "disabled",
]

class ui(common.RestHandler):
    # MAIN HANDLE
    def handle(self, in_string):
        args = self.getArgs(in_string)

        # Crash for debugging
        if args.get("path_info") == "crash":
            raise Exception("CRASH")

        # Ensure server is specified, as its required by every method here
        if "server" not in args["query"]:
            return self.json_error("Missing server field", 400, str(e), 400)

        # Get the relevant uri and token for the server specified
        if args["query"]["server"] == "local":
            uri = self.LOCAL_URI
            token = self.AUTHTOKEN
        else:
            uri = f"https://{self.hostport(args['query']['server'])}"
            token = self.gettoken(args["query"]["server"])
        if type(token) is dict:
            return token

        # GET
        if args["method"] == "GET":

            try:  # Check for required input
                [server, folder, app, user] = self.getInput(
                    args, ["server", "folder", "app", "user"]
                )
            except Exception as e:
                return self.json_error(
                    "Missing one of the required fields: server, folder, app, user",
                    "Internal",
                    str(e),
                    400,
                )

            file = args["query"].get("file", "")

            try:
                resp, content = simpleRequest(
                    f"{uri}/servicesNS/{user}/{app}/data/ui/{folder}/{file}?output_mode=json&count=0",
                    sessionKey=token,
                )
                if resp.status != 200:
                    return self.json_error(
                        f"Getting {file} on {server} returned {resp.status}",
                        resp.status,
                        json.loads(content)["messages"][0]["text"],
                    )
                uis = json.loads(content)["entry"]
            except Exception as e:
                return self.json_error(
                    f"GET request to {uri}/servicesNS/{user}/{app}/data/ui/{folder}/{file} failed",
                    e.__class__.__name__,
                    str(e),
                )
            return self.json_response(self.handleUI(uis))

        if args["method"] == "POST":
            try:
                [server, folder, file, user, app] = self.getInput(
                    args, ["server", "folder", "file", "user", "app"]
                )
            except Exception as e:
                return self.json_error(
                    "Missing one of the required fields: server, folder, file, user, app",
                    "Internal",
                    str(e),
                    400,
                )

            file = urllib.parse.quote(file, safe="")

            try:
                resp, content = simpleRequest(
                    f"{uri}/servicesNS/{user}/{app}/data/ui/{folder}/{file}?output_mode=json",
                    sessionKey=token,
                    postargs=args["form"],
                )
                if resp.status not in [200, 201, 409]:
                    return self.json_error(
                        f"Modifying {stanza} on {server} returned {resp.status}",
                        resp.status,
                        json.loads(content)["messages"][0]["text"],
                    )
                configs = json.loads(content)["entry"]
            except Exception as e:
                return self.json_error(
                    f"POST request to {uri}/servicesNS/{user}/{app}/data/ui/{folder}/{file} failed",
                    e.__class__.__name__,
                    str(e),
                )
            # Reload
            try:
                simpleRequest(
                    f"{uri}/servicesNS/{user}/{app}/data/ui/{folder}/{file}/_reload",
                    method="POST",
                    sessionKey=token,
                )
            except Exception:
                pass
            return self.json_response(self.handleUI(uri), 201)

        if args["method"] == "DELETE":
            try:
                [server, user, app, folder, file] = self.getInput(
                    args, ["server", "user", "app", "folder", "file"]
                )
            except Exception as e:
                return self.json_error(
                    "Missing one of the required fields: server, folder, file, user, app",
                    "Internal",
                    str(e),
                    400,
                )

            try:
                file = urllib.parse.quote(file, safe="")
                simpleRequest(
                    f"{uri}/servicesNS/{user}/{app}/data/ui/{folder}/{file}",
                    method="DELETE",
                    sessionKey=token,
                )
                if resp.status not in [200, 201]:
                    return self.json_error(
                        f"Deleting {file} on {server} returned {resp.status}",
                        resp.status,
                        json.loads(content)["messages"][0]["text"],
                    )
                return {"payload": "true", "status": 200}
            except Exception as e:
                return self.json_error(
                    f"DELETE request to {uri}/servicesNS/{user}/{app}/data/ui/{folder}/{file} failed",
                    e,
                )

        return self.json_error("Method Not Allowed", 405)

    def handleUI(self, uis):

        output = {}

        for s in uis:
            app = s["acl"]["app"]

            if app not in output:
                output[app] = {}
            output[app][s["name"]] = {
                "acl": {
                    "sharing": s["acl"]["sharing"],
                    "owner": s["acl"]["owner"],
                    "write": [0, 1][s["acl"]["can_write"]],
                    "change": [0, 1][s["acl"]["can_change_perms"]],
                    "readers": s["acl"]["perms"].get("read", [])
                    if s["acl"]["perms"]
                    else [],
                    "writers": s["acl"]["perms"].get("write", [])
                    if s["acl"]["perms"]
                    else [],
                    "share": [
                        [0, 1][s["acl"]["can_share_global"]],
                        [0, 1][s["acl"]["can_share_app"]],
                        [0, 1][s["acl"]["can_share_user"]],
                    ],
                },
                "attr": {},
            }
            for attr in s["content"]:
                value = s["content"][attr]
                if attr in ATTR_BLACKLIST:
                    continue
                #value = self.fixbool(value)
                output[app][s["name"]]["attr"][attr] = value

        return output
