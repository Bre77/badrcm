from splunk.clilib.cli_common import getMergedConf
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
            return self.json_error(f"Missing server field", "args", args)

        # Get the relevant uri and token for the server specified
        if args["query"]["server"] == "local":
            uri = self.LOCAL_URI
            token = self.AUTHTOKEN
        else:
            uri = f"https://{self.hostport(args['query']['server'])}"
            token = self.gettoken(args["query"]["server"])

        # GET
        if args["method"] == "GET":

            try:  # Check for required input
                [file, app, user] = self.getInput(args, ["file", "app", "user"])
            except Exception as e:
                return self.json_error(str(e), "args", args)

            stanza = args["query"].get("stanza", "")

            try:
                resp, content = simpleRequest(
                    f"{uri}/servicesNS/{user}/{app}/configs/conf-{file}/{stanza}?output_mode=json&count=0",
                    sessionKey=token,
                    raiseAllErrors=True,
                )

            except Exception as e:
                return self.json_error(
                    f"GET request to {uri}/servicesNS/{user}/{app}/configs/conf-{file}/{stanza} failed",
                    e.__class__.__name__,
                    str(e),
                )
            return self.json_response(
                self.handleConf(json.loads(content)["entry"], uri, token, file)
            )

        if args["method"] == "POST":
            if "tasks" not in args["form"]:
                try:
                    [file, stanza, attr, value] = self.getInput(
                        args, ["file", "stanza", "attr"], ["value"]
                    )
                except Exception as e:
                    return self.json_error(str(e), "args", args)

                stanza = urllib.parse.quote(stanza, safe="")

                try:
                    resp, content = simpleRequest(
                        f"{uri}/servicesNS/{user}/{app}/configs/conf-{file}/{stanza}?output_mode=json",
                        sessionKey=token,
                        postargs={attr: value},
                    )
                    if resp.status not in [200, 201, 409]:
                        return self.json_error(
                            f"Setting config {uri}/servicesNS/{user}/{app}/configs/conf-{file}/{stanza} failed",
                            resp.reason,
                            resp.status,
                        )
                    configs = json.loads(content)["entry"]
                except Exception as e:
                    return self.json_error(
                        f"POST request to {uri}/servicesNS/{user}/{app}/configs/conf-{file}/{stanza} failed",
                        e,
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
                return self.json_response(self.handleConf(configs, uri, token, file))

            # TASKS
            try:
                [user, tasks] = self.getInput(args, ["user"], ["tasks"])
            except Exception as e:
                return self.json_error(str(e), "args", args)

            tasks = json.loads(tasks)
            for task in tasks:
                l = len(task)
                if l == 1:  # Create App
                    [app] = task
                    try:
                        resp, content = simpleRequest(
                            f"{uri}/services/apps/local?output_mode=json",
                            sessionKey=token,
                            postargs=app,
                            raiseAllErrors=True,
                        )
                    except Exception as e:
                        return self.json_error(
                            f"POST request to {uri}/services/apps/local failed",
                            e,
                        )
                    continue
                if l == 3:  # Create Stanza
                    [app, conf, stanza] = task
                    try:
                        resp, content = simpleRequest(
                            f"{uri}/servicesNS/{user}/{app}/configs/conf-{conf}?output_mode=json",
                            sessionKey=token,
                            postargs={"name": stanza},
                            raiseAllErrors=True,
                        )
                    except Exception as e:
                        return self.json_error(
                            f"POST request to {uri}/servicesNS/{user}/{app}/configs/conf-{conf} failed",
                            e,
                        )
                    continue
                if l == 4:  # Create/Change Attributes
                    [app, conf, stanza, attr] = task
                    stanza = urllib.parse.quote(stanza, safe="")
                    try:
                        resp, content = simpleRequest(
                            f"{uri}/servicesNS/{user}/{app}/configs/conf-{conf}/{stanza}?output_mode=json",
                            sessionKey=token,
                            postargs=attr,
                            raiseAllErrors=True,
                        )
                        # Reload
                        try:
                            simpleRequest(
                                f"{uri}/servicesNS/{user}/{app}/configs/conf-{conf}/{stanza}/_reload",
                                method="POST",
                                sessionKey=token,
                            )
                        except Exception:
                            pass
                    except Exception as e:
                        return self.json_error(
                            f"POST request to {uri}/servicesNS/{user}/{app}/configs/conf-{conf}/{stanza} failed",
                            e,
                        )
                    continue
            return {"payload": "true", "status": 200}

        if args["method"] == "DELETE":
            for x in ["user", "app", "file", "stanza"]:  # Check required parameters
                if x not in form:
                    return self.json_error(f"Missing '{x}' parameter")
            try:
                stanza = urllib.parse.quote(stanza, safe="")
                simpleRequest(
                    f"{uri}/servicesNS/{user}/{app}/configs/conf-{file}/{stanza}",
                    method="DELETE",
                    sessionKey=token,
                    raiseAllErrors=True,
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
            _, resDefault = simpleRequest(
                f"{uri}/services/properties/{file}/default?output_mode=json&count=0",
                sessionKey=token,
                raiseAllErrors=True,
            )
            for default in json.loads(resDefault)["entry"]:
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
                    "can_write": s["acl"]["can_write"],
                    "owner": s["acl"]["owner"],
                    "sharing": s["acl"]["sharing"],
                    "roles": s["acl"]["perms"]["write"] if s["acl"]["perms"] else [],
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
