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


class batch(common.RestHandler):
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

        
        if args["method"] == "POST":
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
