from splunk.persistconn.application import PersistentServerConnectionApplication
from splunk.clilib.cli_common import getMergedConf
from splunk.rest import simpleRequest
from splunk.clilib.bundle_paths import make_splunkhome_path
import json
import logging
import sys

APP_NAME = "badrcm"
ATTR_BLACKLIST = ['eai:acl', 'eai:appName', 'eai:userName', 'maxDist', 'priority', 'sourcetype', 'termFrequencyWeightedDist']

logger = logging.getLogger('splunk.appserver.badrcm.req')

# Cached data
cached_servers = {}
cached_defaults = {}

class req(PersistentServerConnectionApplication):
    def __init__(self, command_line, command_arg):
        PersistentServerConnectionApplication.__init__(self)

    def fixval(self,value):
        if type(value) is str:
            if value.lower() in ["true","1"]:
                return True
            if value.lower() in ["false","0"]:
                return False
        return value

    def getserver(self,uri,token):
        output = {}
        try:
            _, resApps = simpleRequest(f"{uri}/services/apps/local?output_mode=json&count=0", sessionKey=token, method='GET', raiseAllErrors=True)
            output["apps"] = [{"name": x['name'], "label":x['content'].get('label'), "visable":x['content'].get('visible'), "details":x['content'].get('details'), "version":x['content'].get('version')} for x in json.loads(resApps)['entry'] if not x['content']['disabled']]
        except Exception as e:
            logger.error(f"Request to {uri}/services/apps/local threw error {e}")

        try:
            _, resUsers = simpleRequest(f"{uri}/services/authentication/users?output_mode=json&count=0", sessionKey=token, method='GET', raiseAllErrors=True)
            output["users"] = [{"name": x['name'], "realname": x['content'].get('realname'), "defaultApp":x['content'].get('defaultApp')} for x in json.loads(resUsers)['entry']]
        except Exception as e:
            logger.error(f"Request to {uri}/services/authentication/users threw error {e}")
        
        return output

    def handleConf(self,configs):
        try:
            serverResponse, resDefault = simpleRequest(f"{uri}/services/properties/{form['file']}/default?output_mode=json&count=0", sessionKey=token, method='GET', raiseAllErrors=False)
            defaults = {}
            for default in json.loads(resDefault)['entry']:
                defaults[default['name']] = self.fixval(default['content'])
        except Exception:
            defaults = {}

        defaults = {}
        output = {}

        for stanza in configs:
            app = stanza['acl']['app']
            if app not in output:
                output[app] = {}
            output[app][stanza['name']] = {
                'acl':{
                    'can_write':stanza['acl']['can_write'],
                    'owner':stanza['acl']['owner'],
                    'sharing':stanza['acl']['sharing']
                },
                'attr':{}
            } #'id':stanza['id'],
            for attr in stanza['content']:
                value = self.fixval(stanza['content'][attr])
                if attr in ATTR_BLACKLIST or (attr in defaults and value == defaults[attr]):
                    continue
                output[app][stanza['name']]['attr'][attr] = value
        return {'payload': json.dumps(output, separators=(',', ':')), 'status': 200}

    def gettoken(self, server):
            _, resPasswords = simpleRequest(f"{self.LOCAL_URI}/servicesNS/{self.USER}/{APP_NAME}/storage/passwords/%3A{server}%3A?output_mode=json&count=1", sessionKey=self.AUTHTOKEN, method='GET', raiseAllErrors=True)
            return json.loads(resPasswords)['entry'][0]['content']['clear_password']

    def errorhandle(self, message, status=400):
        logger.error(message)
        return {'payload': message, 'status': status}

    def handle(self, in_string):
        global cached_servers, cached_defaults
        #try:
        args = json.loads(in_string)

        if args['method'] != "POST":
            return {'payload': {'message': "Service running."}, 'status': 200 }

        self.USER = args['session']['user']
        self.AUTHTOKEN = args['session']['authtoken']
        self.LOCAL_URI = args['server']['rest_uri']

        # Process Form
        form = {}
        for x in args['form']:
            form[x[0]] = x[1]

        if "a" not in form:
            logger.warn("Request was missing 'a' parameter")
            return {'payload': "Missing 'a' parameter", 'status': 200 }

        # Helpful crash for debugging
        if form['a'] == "crash":
            raise("restart")

        # Dump the args
        if form['a'] == "args":
            return {'payload': json.dumps(args, separators=(',', ':')), 'status': 200}

        # Dump the config
        if form['a'] == "config":
            c = getMergedConf(APP_NAME)
            del c['default']
            for server in c:
                c[server]['acs'] = self.fixval(c[server]['acs'])
                c[server]['verify'] = self.fixval(c[server]['verify'])
            return {'payload': json.dumps(c, separators=(',', ':')), 'status': 200}
        
        # Get metadata for all configured servers
        if form['a'] == "getservers":
            output = {
                args['server']['hostname']: {**self.getserver(self.LOCAL_URI,self.AUTHTOKEN), 'port':'local'}
            }
            config = getMergedConf(APP_NAME)
            for host in config:
                if host == "default":
                    continue
                token = self.gettoken(host)
                output[host] = {**self.getserver(f"https://{host}:8089",token),**config[host]}
            cached_servers = output
            return {'payload': json.dumps(output, separators=(',', ':')), 'status': 200}

        if form['a'] == "getcachedservers":
            return {'payload': json.dumps(cached_servers, separators=(',', ':')), 'status': 200}

        # Add a new server and get its base metadata
        if form['a'] == "addserver":
            for x in ['server','token','shared']: # Check required parameters
                if x not in form:
                    logger.warn(f"Request to 'addserver' was missing '{x}' parameter")
                    return {'payload': "Missing '{x}' parameter", 'status': 400}

            # Test server
            try:
                _, res = simpleRequest(f"{form['server']}:8089/services", sessionKey=form['token'], raiseAllErrors=True)
            except Exception as e:
                return self.errorhandle(f"Connection to new server {form['server']} failed with error {e}")

            # Add Server
            user_context = "nobody" if form['shared'] else self.USER
            try:
                _, resPassword = simpleRequest(f"{self.LOCAL_URI}/servicesNS/{user_context}/{APP_NAME}/storage/passwords", sessionKey=self.AUTHTOKEN, postargs={'name': form['server'], 'password': form['token']}, method='POST', raiseAllErrors=True)
                _, resConfig = simpleRequest(f"{self.LOCAL_URI}/servicesNS/{user_context}/{APP_NAME}/configs/conf-{APP_NAME}", sessionKey=self.AUTHTOKEN, postargs={'name': form['server']}, method='POST', raiseAllErrors=True)
            except Exception as e:
                return self.errorhandle(f"Adding new server {form['server']} threw error {e}")    
            
            try:
                output = self.getserver(f"https://{form['server']}:8089",form['token'])
                return {'payload': json.dumps(output, separators=(',', ':')), 'status': 200}
            except Exception as e:
                return self.errorhandle(f"Getting data from new server {form['server']} threw error {e}")

        # HELPER - Get Server Context
        if 'server' in form:
            # Validate "server"
            if form['server'] in [args['server']['hostname'],"local"]:
                uri = self.LOCAL_URI
                token = self.AUTHTOKEN
            else:
                uri = f"https://{form['server']}:8089"
                token = self.gettoken(form['server'])
        else:
            logger.warn("Request was missing 'server' parameter")
            return {'payload': "Missing 'server' parameter", 'status': 400}

        # Get config of a single server
        if form['a'] == "getconf":
            for x in ['server','file','user','app']: # Check required parameters
                if x not in form:
                    logger.warn(f"Request to 'getconf' was missing '{x}' parameter")
                    return {'payload': "Missing '{x}' parameter", 'status': 400}
            serverResponse, resConfig = simpleRequest(f"{uri}/servicesNS/{form['user']}/{form['app']}/configs/conf-{form['file']}/{form.get('stanza','')}?output_mode=json&count=0", sessionKey=token, method='GET', raiseAllErrors=True)
            configs = json.loads(resConfig)['entry']
            return self.handleConf(configs)
        
        # Change a config and process the response
        if form['a'] == "setconf":
            for x in ['server','file','stanza','attr','value']: # Check required parameters
                if x not in form:
                    logger.warn(f"Request to 'setconf' was missing '{x}' parameter")
                    return {'payload': "Missing '{x}' parameter", 'status': 400}
            postargs = {form['attr']: form['value']}
            serverResponse, resConfig = simpleRequest(f"{uri}/servicesNS/{form['user']}/{form['app']}/configs/conf-{form['file']}/{form['stanza']}?output_mode=json", sessionKey=token, method='POST', raiseAllErrors=True, postargs=postargs)
            configs = json.loads(resConfig)['entry']

            return self.handleConf(configs)

        if form['a'] == "getfiles":
            if 'server' not in form:
                logger.warn(f"Request to 'getfiles' was missing 'server' parameter")
                return {'payload': "Missing 'server' parameter", 'status': 400}
            try:
                serverResponse, resConfig = simpleRequest(f"{uri}/services/properties?output_mode=json", sessionKey=token, method='GET', raiseAllErrors=True)
                output = [f['name'] for f in json.loads(resConfig)['entry']]
                return {'payload': json.dumps(output, separators=(',', ':')), 'status': 200}
            except Exception as e:
                logger.error(f"Request to {uri}/services/apps/local threw error {e}")

        return {'payload': "No Action Requested", 'status': 400}
        #except Exception as ex:
        #    return {'payload': json.dumps(ex), 'status': 500}
