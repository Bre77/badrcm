from splunk.persistconn.application import PersistentServerConnectionApplication
from splunk.clilib.cli_common import getMergedConf
from splunk.rest import simpleRequest
import json
import logging

#import sys, os
#sys.path.append(os.path.join(os.environ['SPLUNK_HOME'],'etc','apps','SA-VSCode','bin'))
#import splunk_debug as dbg
#dbg.enable_debugging(timeout=25)

APP_NAME = "badrcm"
ATTR_BLACKLIST = ['eai:acl', 'eai:appName', 'eai:userName', 'maxDist', 'priority', 'termFrequencyWeightedDist'] #, 'sourcetype', 

logger = logging.getLogger(f"splunk.appserver.{APP_NAME}.req")

class req(PersistentServerConnectionApplication):
    def __init__(self, command_line, command_arg):
        PersistentServerConnectionApplication.__init__(self)

    def fixbool(self,value):
        if type(value) is str:
            if value.lower() == "true": #in ["true","1"]:
                return True
            if value.lower() == "false": #in ["false","0"]:
                return False
        return value

    def makebool(self,value):
        if type(value) is str:
            if value.lower() in ["true","1"]:
                return True
            if value.lower() in ["false","0"]:
                return False
        return value

    def getserver(self,uri,token):
        output = {}
        # Get all enabled Apps
        try:
            _, resApps = simpleRequest(f"{uri}/services/apps/local?output_mode=json&count=0", sessionKey=token, raiseAllErrors=True)
            output["apps"] = [{
                "name": x['name'],
                "label":x['content'].get('label'),
                "visable":x['content'].get('visible'),
                "details":x['content'].get('details'),
                "version":x['content'].get('version')
            } for x in json.loads(resApps)['entry'] if not x['content']['disabled']]
        except Exception as e:
            logger.error(f"Request to {uri}/services/apps/local threw error {e}")
            output["apps"] = []

        # Get all Users
        try:
            _, resUsers = simpleRequest(f"{uri}/services/authentication/users?output_mode=json&count=0", sessionKey=token, raiseAllErrors=True)
            output["users"] = [{
                "name": x['name'],
                "realname": x['content'].get('realname'),
                "defaultApp":x['content'].get('defaultApp')
            } for x in json.loads(resUsers)['entry']]
        except Exception as e:
            logger.error(f"Request to {uri}/services/authentication/users threw error {e}")
            output["users"] = []

        # Get all Conf file names
        try:
            _, resFiles = simpleRequest(f"{uri}/services/properties?output_mode=json&count=0", sessionKey=token, raiseAllErrors=True)
            output["files"] = [f['name'] for f in json.loads(resFiles)['entry']]
        except Exception as e:
            logger.error(f"Request to {uri}/services/properties threw error {e}")
            output["files"] = []

        # Get all roles and their imported roles
        all_roles = {}
        try:
            _, resRoles = simpleRequest(f"{uri}/services/authorization/roles?output_mode=json&count=0", sessionKey=token, raiseAllErrors=True)
            for role in json.loads(resRoles)['entry']:
                all_roles[role['name']] = role['content']['imported_roles']
        except Exception as e:
            logger.error(f"Request to {uri}/services/authorization/roles threw error {e}")

        # Get current context and resolve imported roles
        try:
            _, resContext = simpleRequest(f"{uri}/services/authentication/current-context?output_mode=json&count=1", sessionKey=token, raiseAllErrors=True)
            rights = json.loads(resContext)['entry'][0]
            output["rights"] = {
                'username': rights['content']['username'],
                'realname': rights['content']['realname'],
                'roles': self.rolerecursive(all_roles,rights['content']['roles'],[])
            }
        except Exception as e:
            logger.error(f"Request to {uri}/services/authentication/current-context threw error {e}")
            output["rights"] = {'username':"FAILED",'roles':[]}
        
        return output

    def rolerecursive(self,all_roles,new_roles,my_roles):
        for role in new_roles:
            if role not in my_roles:
                my_roles.append(role)
                my_roles = self.rolerecursive(all_roles,all_roles[role],my_roles)
        return my_roles

    def handleConf(self,configs,uri,token,conf):
        defaults = {}
        try:
            _, resDefault = simpleRequest(f"{uri}/services/properties/{conf}/default?output_mode=json&count=0", sessionKey=token, raiseAllErrors=False)
            for default in json.loads(resDefault)['entry']:
                defaults[default['name']] = self.fixbool(default['content'])
        except Exception as e:
            logger.error(f"Request to {uri}/services/properties/{conf}/default threw error {e}")
        
        output = {}

        for stanza in configs:
            app = stanza['acl']['app']
            if app not in output:
                output[app] = {}
            output[app][stanza['name']] = {
                'acl':{
                    'can_write':stanza['acl']['can_write'],
                    'owner':stanza['acl']['owner'],
                    'sharing':stanza['acl']['sharing'],
                    'roles':stanza['acl']['perms']['write'] if stanza['acl']['perms'] else []
                },
                'attr':{}
            }
            for attr in stanza['content']:
                value = stanza['content'][attr]
                if attr in ATTR_BLACKLIST:
                    continue
                value = self.fixbool(value)
                if attr in defaults:
                    if type(defaults[attr]) is bool: #If the default was "true" or "false", assume the value should also be boolean
                        value = self.makebool(value)
                    if value == defaults[attr]:
                        continue
                
                output[app][stanza['name']]['attr'][attr] = value
        return {'payload': json.dumps(output, separators=(',', ':')), 'status': 200}

    def gettoken(self, server):
        _, resPasswords = simpleRequest(f"{self.LOCAL_URI}/servicesNS/{self.USER}/{APP_NAME}/storage/passwords/{APP_NAME}%3A{server}%3A?output_mode=json&count=1", sessionKey=self.AUTHTOKEN, raiseAllErrors=True)
        return json.loads(resPasswords)['entry'][0]['content']['clear_password']

    def errorhandle(self, message, error="", status=400):
        logger.error(f"app={APP_NAME} user={self.USER} status={status} message=\"{message}\" error=\"{error}\"")
        return {'payload': json.dumps({'message':message, 'error':str(error)}, separators=(',', ':')), 'status': status}

    def handle(self, in_string):
        global cached_defaults
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
            raise(Exception)

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
            return {'payload': json.dumps(output, separators=(',', ':')), 'status': 200}

        # Add a new server and get its base metadata
        if form['a'] == "addserver":
            for x in ['server','token','shared']: # Check required parameters
                if x not in form:
                    logger.warn(f"Request to 'addserver' was missing '{x}' parameter")
                    return {'payload': "Missing '{x}' parameter", 'status': 400}

            # Test server
            try:
                simpleRequest(f"https://{form['server']}:8089/services", sessionKey=form['token'], raiseAllErrors=True)
            except Exception as e:
                return self.errorhandle(f"Connection to new server '{form['server']}' failed", e)

            # Add Server
            user_context = "nobody" if form['shared'] == "true" else self.USER
            logger.info(f"Adding {form['server']} for user {user_context}")

            config = getMergedConf(APP_NAME)
            if form['server'] not in config:
                try:
                    _, resConfig = simpleRequest(f"{self.LOCAL_URI}/servicesNS/{user_context}/{APP_NAME}/configs/conf-{APP_NAME}", sessionKey=self.AUTHTOKEN, postargs={'name': form['server']}, raiseAllErrors=True)
                except Exception as e:
                    return self.errorhandle(f"Adding new server '{form['server']}' failed", e)    
            try:
                resp, resPassword = simpleRequest(f"{self.LOCAL_URI}/servicesNS/{user_context}/{APP_NAME}/storage/passwords", sessionKey=self.AUTHTOKEN, postargs={'realm': APP_NAME, 'name': form['server'], 'password': form['token']}, raiseAllErrors=True)
            except Exception as e:
                if resp.status == 409:
                    try:
                        _, resPasswords = simpleRequest(f"{self.LOCAL_URI}/servicesNS/{self.USER}/{APP_NAME}/storage/passwords/{APP_NAME}%3A{server}%3A?output_mode=json&count=1", sessionKey=self.AUTHTOKEN, postargs={'password': form['token']}, raiseAllErrors=True)
                    except Exception as e:
                        return self.errorhandle(f"Updating token for server '{form['server']}' failed", e) 
                return self.errorhandle(f"Adding token for server '{form['server']}' failed", e)    
            
            try:
                output = self.getserver(f"https://{form['server']}:8089",form['token'])
                return {'payload': json.dumps(output, separators=(',', ':')), 'status': 200}
            except Exception as e:
                return self.errorhandle(f"Getting data from new server '{form['server']}' failed", e)

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
            return self.errorhandle("Missing 'server' parameter")

        # Get config of a single server
        if form['a'] == "getconf":
            for x in ['server','file','user','app']: # Check required parameters
                if x not in form:
                    return self.errorhandle("Missing '{x}' parameter")
            try:
                resp, content = simpleRequest(f"{uri}/servicesNS/{form['user']}/{form['app']}/configs/conf-{form['file']}/{form.get('stanza','')}?output_mode=json&count=0", sessionKey=token, raiseAllErrors=True)
                configs = json.loads(content)['entry']
                return self.handleConf(configs,uri,token,form['file'])
            except Exception as e:
                return self.errorhandle(f"GET request to {uri}/servicesNS/{form['user']}/{form['app']}/configs/conf-{form['file']}/{form.get('stanza','')} failed",e)
        
        # Change a config and process the response
        if form['a'] == "setconf":
            for x in ['server','file','stanza','attr','value']: # Check required parameters
                if x not in form:
                    return self.errorhandle("Missing '{x}' parameter")
            postargs = {form['attr']: form['value']}
            try:
                resp, content = simpleRequest(f"{uri}/servicesNS/{form['user']}/{form['app']}/configs/conf-{form['file']}/{form['stanza']}?output_mode=json", sessionKey=token, postargs=postargs,  raiseAllErrors=True,)
                configs = json.loads(content)['entry']
                return self.handleConf(configs,uri,token,form['file'])
            except Exception as e:
                return self.errorhandle(f"POST request to {uri}/servicesNS/{form['user']}/{form['app']}/configs/conf-{form['file']}/{form.get('stanza','')} failed",e,resp.status)

        return {'payload': "No Action Requested", 'status': 400}
        #except Exception as ex:
        #    return {'payload': json.dumps(ex), 'status': 500}
