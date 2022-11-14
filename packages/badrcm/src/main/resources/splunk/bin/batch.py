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

        if args["method"] == "POST":
            try:
                [server, user] = self.getInput(args, ["server", "user"], [])
                tasks = json.loads(args["payload"])
            except Exception as e:
                return self.json_error(
                    "Missing one of the required fields: server, user",
                    "Internal",
                    str(e),
                    400,
                )

            for task in tasks:
                l = len(task)
                if l == 1:  # Create App
                    [app] = task
                    try:
                        resp, content = simpleRequest(
                            f"{uri}/services/apps/local?output_mode=json",
                            sessionKey=token,
                            postargs=app,
                        )
                        if resp.status not in [200, 201, 409]:
                            return self.json_error(
                                f"Adding {app['name']} on {server} returned {resp.status}",
                                resp.status,
                                json.loads(content)["messages"][0]["text"],
                            )
                    except Exception as e:
                        return self.json_error(
                            f"Adding {app['name']} on {server} failed",
                            e.__class__.__name__,
                            str(e),
                        )
                    continue
                if l == 3:  # Create Stanza
                    [app, conf, data] = task
                    try:
                        resp, content = simpleRequest(
                            f"{uri}/servicesNS/{user}/{app}/configs/conf-{conf}?output_mode=json",
                            sessionKey=token,
                            postargs=data,
                        )
                        if resp.status not in [200, 201, 409]:
                            return self.json_error(
                                f"Adding {stanza} to {app}/{conf}.conf on {server} returned {resp.status}",
                                resp.status,
                                json.loads(content)["messages"][0]["text"],
                            )
                    except Exception as e:
                        return self.json_error(
                            f"Adding {stanza} to {app}/{conf}.conf on {server} failed",
                            e.__class__.__name__,
                            str(e),
                        )
                    continue
                if l == 4:  # Create/Change Attributes
                    [app, conf, stanza, data] = task
                    stanza = urllib.parse.quote(stanza, safe="")
                    try:
                        resp, content = simpleRequest(
                            f"{uri}/servicesNS/{user}/{app}/configs/conf-{conf}/{stanza}?output_mode=json",
                            sessionKey=token,
                            postargs=data,
                        )
                        if resp.status not in [200, 201, 409]:
                            return self.json_error(
                                f"Adding attributes to {app}/{conf}.conf [{stanza}] on {server} returned {resp.status}",
                                resp.status,
                                json.loads(content)["messages"][0]["text"],
                            )
                    except Exception as e:
                        return self.json_error(
                            f"Adding attributes to {app}/{conf}.conf [{stanza}] on {server} failed",
                            e.__class__.__name__,
                            str(e),
                        )
                    continue
                if l == 5:  # Create/Change Attribute
                    [app, conf, stanza, attr, value] = task
                    stanza = urllib.parse.quote(stanza, safe="")
                    try:
                        resp, content = simpleRequest(
                            f"{uri}/servicesNS/{user}/{app}/configs/conf-{conf}/{stanza}?output_mode=json",
                            sessionKey=token,
                            postargs={attr: value},
                        )
                        if resp.status not in [200, 201, 409]:
                            return self.json_error(
                                f"Adding {attr} to {app}/{conf}.conf [{stanza}] on {server} returned {resp.status}",
                                resp.status,
                                str(content),
                            )
                    except Exception as e:
                        return self.json_error(
                            f"Adding {attr} to {app}/{conf}.conf [{stanza}] on {server} failed",
                            e.__class__.__name__,
                            str(e),
                        )
                    continue
            return {"payload": "", "status": 204}
        return self.json_error("Method Not Allowed", 405)
