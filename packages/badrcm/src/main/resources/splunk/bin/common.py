from splunk.persistconn.application import PersistentServerConnectionApplication
from splunk.rest import simpleRequest
import json
import logging


class RestHandler(PersistentServerConnectionApplication):
    APP_NAME = "badrcm"

    def __init__(self, command_line, command_arg, logger=None):
        self.logger = logger
        if self.logger == None:
            self.logger = logging.getLogger(f"splunk.appserver.{self.APP_NAME}")

        PersistentServerConnectionApplication.__init__(self)

        self.logger.info("Starting a BADRCM handler")

    def fixbool(self, value):
        if type(value) is str:
            if value.lower() == "true":  # in ["true","1"]:
                return True
            if value.lower() == "false":  # in ["false","0"]:
                return False
        return value

    def makebool(self, value):
        if type(value) is str:
            if value.lower() in ["true", "1"]:
                return True
            if value.lower() in ["false", "0"]:
                return False
        return value

    def json_response(self, data, status=200):
        return {
            "payload": json.dumps(data, separators=(",", ":")),
            "status": status,
            "headers": {"Content-Type": "application/json"},
        }

    def json_error(self, context, error_code=None, error_message=None, status=500):
        self.logger.error(
            f'file={__file__} app={self.APP_NAME} user={self.USER} context={status} error_code="{error_code}" error_message="{error_message}"'
        )
        return {
            "payload": json.dumps(
                {
                    "context": context,
                    "error_code": error_code,
                    "error_message": error_message,
                },
                separators=(",", ":"),
            ),
            "status": status,
            "headers": {"Content-Type": "application/json"},
        }

    def json_issue(self, e, status=400):
        return {
            "payload": json.dumps(
                {"class": e.__class__.__name__, "args": e.args}, separators=(",", ":")
            ),
            "status": status,
            "headers": {"Content-Type": "application/json"},
        }

    def gettoken(self, server):
        try:
            _, resPasswords = simpleRequest(
                f"{self.LOCAL_URI}/servicesNS/{self.USER}/{self.APP_NAME}/storage/passwords/{self.APP_NAME}%3A{server.replace(':','_')}%3A?output_mode=json&count=1",
                sessionKey=self.AUTHTOKEN,
                raiseAllErrors=True,
            )
            return json.loads(resPasswords)["entry"][0]["content"]["clear_password"]
        except Exception as e:
            return self.json_error(
                f"GET request to {self.LOCAL_URI}/servicesNS/{self.USER}/{self.APP_NAME}/storage/passwords/{self.APP_NAME}%3A{server.replace(':','_')}%3A failed",
                e.__class__.__name__,
                str(e),
            )

    def getArgs(self, in_string):
        args = json.loads(in_string)

        self.USER = args["session"]["user"]
        self.AUTHTOKEN = args["session"]["authtoken"]
        self.LOCAL_URI = args["server"]["rest_uri"]

        args["form"] = dict(args.get("form", []))
        args["query"] = dict(args.get("query", []))

        # self.HASH = args["query"].get("hash")

        return args

    def hostport(self, server):
        x = server.split(":")
        return f"{x[0]}:{int(x[1]) if len(x) > 1 else 8089}"

    def checkinput(self, args, query=[], form=[]):
        issues = []
        for field in query:
            if field not in args["query"]:
                issues.push(f"Missing {field} from query")
        for field in form:
            if field not in args["form"]:
                issues.push(f"Missing {field} from form")
        return issues.join(". ")

    def getInput(self, args, query=[], form=[]):
        issues = []
        output = []
        for field in query:
            if field in args["query"]:
                output.append(args["query"][field])
            else:
                issues.append(f"Missing {field} from query")
        for field in form:
            if field in args["form"]:
                output.append(args["form"][field])
            else:
                issues.append(f"Missing {field} from form")
        if issues:
            raise Exception(". ".join(issues))
        else:
            return output
