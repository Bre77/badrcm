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
    "maxDist",
    "priority",
    "termFrequencyWeightedDist",
]  # , 'sourcetype',


class configs(common.RestHandler):
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
                [server, file, app, user] = self.getInput(
                    args, ["server", "file", "app", "user"]
                )
            except Exception as e:
                return self.json_error(
                    "Missing one of the required fields: server, file, app, user",
                    "Internal",
                    str(e),
                    400,
                )

            stanza = args["query"].get("stanza", "")

            try:
                resp, content = simpleRequest(
                    f"{uri}/servicesNS/{user}/{app}/configs/conf-{file}/{stanza}?output_mode=json&count=0",
                    sessionKey=token,
                )
                if resp.status != 200:
                    return self.json_error(
                        f"Getting {stanza} on {server} returned {resp.status}",
                        resp.status,
                        json.loads(content)["messages"][0]["text"],
                    )
                configs = json.loads(content)["entry"]
            except Exception as e:
                return self.json_error(
                    f"GET request to {uri}/servicesNS/{user}/{app}/configs/conf-{file}/{stanza} failed",
                    e.__class__.__name__,
                    str(e),
                )
            return self.json_response(self.handleConf(configs, uri, token, file))

        if args["method"] == "POST":
            try:
                [server, file, user, app, stanza] = self.getInput(
                    args, ["server", "file", "user", "app", "stanza"]
                )
            except Exception as e:
                return self.json_error(
                    "Missing one of the required fields: server, file, user, app, stanza",
                    "Internal",
                    str(e),
                    400,
                )

            stanza = urllib.parse.quote(stanza, safe="")

            try:
                resp, content = simpleRequest(
                    f"{uri}/servicesNS/{user}/{app}/configs/conf-{file}/{stanza}?output_mode=json",
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
                    f"POST request to {uri}/servicesNS/{user}/{app}/configs/conf-{file}/{stanza} failed",
                    e.__class__.__name__,
                    str(e),
                )
            # Reload
            try:
                simpleRequest(
                    f"{uri}/servicesNS/{user}/{app}/configs/conf-{file}/_reload",
                    method="POST",
                    sessionKey=token,
                )
            except Exception:
                pass
            return self.json_response(self.handleConf(configs, uri, token, file), 201)

        if args["method"] == "DELETE":
            try:
                [server, user, app, file, stanza] = self.getInput(
                    args, ["server", "user", "app", "file", "stanza"]
                )
            except Exception as e:
                return self.json_error(
                    "Missing one of the required fields: server, file, user, app, stanza",
                    "Internal",
                    str(e),
                    400,
                )

            try:
                stanza = urllib.parse.quote(stanza, safe="")
                simpleRequest(
                    f"{uri}/servicesNS/{user}/{app}/configs/conf-{file}/{stanza}",
                    method="DELETE",
                    sessionKey=token,
                )
                if resp.status not in [200, 201]:
                    return self.json_error(
                        f"Deleting {stanza} on {server} returned {resp.status}",
                        resp.status,
                        json.loads(content)["messages"][0]["text"],
                    )
                return {"payload": "true", "status": 200}
            except Exception as e:
                return self.json_error(
                    f"DELETE request to {uri}/servicesNS/{user}/{app}/configs/conf-{file}/{stanza} failed",
                    e,
                )

        return self.json_error("Method Not Allowed", 405)

    def handleConf(self, configs, uri, token, file):
        defaults = {}
        try:
            resp, content = simpleRequest(
                f"{uri}/services/properties/{file}/default?output_mode=json&count=0",
                sessionKey=token,
            )
            if resp.status != 200:
                return self.json_error(
                    f"Getting {file}.conf defaults from {uri} returned {resp.status}",
                    resp.status,
                    json.loads(content)["messages"][0]["text"],
                )
            for default in json.loads(content)["entry"]:
                defaults[default["name"]] = self.fixbool(default["content"])
        except Exception as e:
            self.logger.error(
                f"Request to {uri}/services/properties/{file}/default threw error {e}"
            )

        output = {}

        for s in configs:
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
                value = self.fixbool(value)
                if attr in defaults:
                    if (
                        type(defaults[attr]) is bool
                    ):  # If the default was "true" or "false", assume the value should also be boolean
                        value = self.makebool(value)
                    if value == defaults[attr]:
                        continue
                output[app][s["name"]]["attr"][attr] = value

        return output
