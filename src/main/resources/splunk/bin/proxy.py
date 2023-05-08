from splunk.rest import simpleRequest
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common


class proxy(common.RestHandler):
    # MAIN HANDLE
    def handle(self, in_string):
        args = self.getArgs(in_string)

        # Crash for debugging
        if args.get("path_info") == "crash":
            raise Exception("CRASH")

        # Ensure server is specified, as its required by every method here
        try:  # Check for required input
            [server, path] = self.getInput(args, ["server", "path"])
        except Exception as e:
            return self.json_error(
                "Missing one of the required fields: server, path",
                "Internal",
                str(e),
                400,
            )

        # Get the relevant uri and token for the server specified
        if args["query"]["server"] == "local":
            uri = self.LOCAL_URI
            token = self.AUTHTOKEN
        else:
            uri = f"https://{self.hostport(args['query']['server'])}"
            token = self.gettoken(args["query"]["server"])
        if type(token) is dict:
            return token

        if args["method"] == "GET":
            try:
                resp, content = simpleRequest(
                    f"{uri}/services/{path}?output_mode=json", sessionKey=token
                )
                if resp.status != 200:
                    return self.json_error(
                        f"Proxying {path} on {server} returned {resp.status}",
                        resp.status,
                        json.loads(content)["messages"][0]["text"],
                    )
            except Exception as e:
                return self.json_error(
                    f"Proxying {uri}/services/{path} failed",
                    e.__class__.__name__,
                    str(e),
                )
            output = {}
            for value in json.loads(content)["entry"]:
                output[value["name"]] = value["content"]
            return self.json_response(output)
        return self.json_error("Method Not Allowed", 405)
