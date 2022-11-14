from splunk.persistconn.application import PersistentServerConnectionApplication
from splunk.clilib.cli_common import getMergedConf
from splunk.rest import simpleRequest
import json
import logging
import urllib.parse

#import sys, os
#sys.path.append(os.path.join(os.environ['SPLUNK_HOME'],'etc','apps','SA-VSCode','bin'))
#import splunk_debug as dbg
#dbg.enable_debugging(timeout=25)

APP_NAME = "badrcm"
ATTR_BLACKLIST = ['eai:acl', 'eai:appName', 'eai:userName', 'maxDist', 'priority', 'termFrequencyWeightedDist', '_rcvbuf'] #, 'sourcetype', 

logger = logging.getLogger(f"splunk.appserver.{APP_NAME}")

class badrcm(PersistentServerConnectionApplication):
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
        _, resPasswords = simpleRequest(f"{self.LOCAL_URI}/servicesNS/{self.USER}/{APP_NAME}/storage/passwords/{APP_NAME}%3A{server.replace(':','_')}%3A?output_mode=json&count=1", sessionKey=self.AUTHTOKEN, raiseAllErrors=True)
        return json.loads(resPasswords)['entry'][0]['content']['clear_password']

    def errorhandle(self, message, error="", status=0):
        logger.error(f"mode=read app={APP_NAME} user={self.USER} status={status} message=\"{message}\" error=\"{error}\"")
        if status < 400:
            status = 400
        return {'payload': json.dumps({'message':message, 'error':str(error)}, separators=(',', ':')), 'status': status}

    def hostport(self,server):
        x = server.split(":")
        return [x[0], int(x[1]) if len(x) > 1 else 8089]

    # MAIN HANDLE
    def handle(self, in_string):
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
        
        # Get metadata for all configured servers
        if form['a'] == "getservers":
            output = {}
            try:
                config = getMergedConf(APP_NAME)
                for server in config:
                    if server == "default":
                        continue
                    if config[server]['disabled'] != "false":
                        output[server] = {'error': "Disabled in badrcm.conf", 'apps':[], 'users':[], 'files':[], 'rights':{}}
                        continue
                    if server == "local":
                        output[server] = self.getserver(self.LOCAL_URI,self.AUTHTOKEN)
                        continue

                    [host, port] = self.hostport(server)
                    try:
                        output[server] = self.getserver(f"https://{host}:{port}",self.gettoken(server))
                    except Exception as e:
                        output[server] = {'error': str(e), 'apps':[], 'users':[], 'files':[], 'rights':{}}
                    #output[server] = {**self.getserver(f"https://{host}:{port}",token),**config[host]}
                
                return {'payload': json.dumps(output, separators=(',', ':')), 'status': 200}
            except Exception as e:
                return self.errorhandle(f"Getting servers failed", e)

        # server is required from here
        if 'server' not in form:
            return self.errorhandle("Missing 'server' parameter")

        [host, port] = self.hostport(form['server'])

        # Add a new server and get its base metadata
        if form['a'] == "addserver":
            for x in ['token','shared']: # Check required parameters
                if x not in form:
                    logger.warn(f"Request to 'addserver' was missing '{x}' parameter")
                    return {'payload': "Missing '{x}' parameter", 'status': 400}

            # Test server
            try:
                simpleRequest(f"https://{host}:{port}/services", sessionKey=form['token'], raiseAllErrors=True)
            except Exception as e:
                return self.errorhandle(f"Connection to new server '{form['server']}' failed", e)

            # Add Server
            user_context = "nobody" if form['shared'] == "true" else self.USER
            sharing = "app" if form['shared'] == "true" else "user"
            logger.info(f"Adding {form['server']} for user {user_context}")

            # Config
            try:
                resp, _ = simpleRequest(f"{self.LOCAL_URI}/servicesNS/{user_context}/{APP_NAME}/configs/conf-{APP_NAME}", sessionKey=self.AUTHTOKEN, postargs={'name': form['server']})
                if resp.status not in [200,201,409]:
                    return self.errorhandle(f"Adding new server '{form['server']}' failed", resp.reason, resp.status)
            except Exception as e:
                return self.errorhandle(f"POST request to {self.LOCAL_URI}/servicesNS/{user_context}/{APP_NAME}/configs/conf-{APP_NAME} failed", e)
                        
            
            # Password Storage
            try:
                resp, _ = simpleRequest(f"{self.LOCAL_URI}/servicesNS/{user_context}/{APP_NAME}/storage/passwords", sessionKey=self.AUTHTOKEN, postargs={'realm': APP_NAME, 'name': form['server'].replace(':','_'), 'password': form['token']})
                if resp.status not in [200,201,409]:
                    return self.errorhandle(f"Adding token for server '{form['server']}' failed", resp.reason, resp.status) 
                if resp.status == 409:
                    resp, _ = simpleRequest(f"{self.LOCAL_URI}/servicesNS/{self.USER}/{APP_NAME}/storage/passwords/{APP_NAME}%3A{form['server'].replace(':','_')}%3A?output_mode=json&count=1", sessionKey=self.AUTHTOKEN, postargs={'password': form['token']})
                    if resp.status not in [200,201]:
                        return self.errorhandle(f"Updating token for server '{form['server']}' failed", resp.reason, resp.status) 
            except Exception as e:
                return self.errorhandle(f"POST request to {self.LOCAL_URI}/servicesNS/{user_context}/{APP_NAME}/storage/passwords failed", e)  
            
            # Password ACL
            try:
                resp, _ = simpleRequest(f"{self.LOCAL_URI}/servicesNS/{self.USER}/{APP_NAME}/storage/passwords/{APP_NAME}%3A{form['server'].replace(':','_')}%3A/acl?output_mode=json", sessionKey=self.AUTHTOKEN, postargs={'owner': self.USER, 'sharing': sharing})
                if resp.status not in [200,201]:
                    return self.errorhandle(f"Setting ACL sharing to {sharing} for token of '{form['server']}' failed", resp.reason, resp.status) 
            except Exception as e:
                return self.errorhandle(f"POST request to {self.LOCAL_URI}/servicesNS/{self.USER}/{APP_NAME}/storage/passwords/{APP_NAME}%3A{form['server'].replace(':','_')}%3A/acl failed", e)    

            try:
                output = self.getserver(f"https://{host}:{port}",form['token'])
                return {'payload': json.dumps(output, separators=(',', ':')), 'status': 200}
            except Exception as e:
                return self.errorhandle(f"Getting data from new server '{form['server']}' failed", e)
        
        # Validate "server"
        if form['server'] == "local":
            uri = self.LOCAL_URI
            token = self.AUTHTOKEN
        else:
            uri = f"https://{host}:{port}"
            token = self.gettoken(form['server'])
        

        # Get config of a single server
        if form['a'] == "getconf":
            for x in ['file','user','app']: # Check required parameters
                if x not in form:
                    return self.errorhandle(f"Missing '{x}' parameter")
            try:
                resp, content = simpleRequest(f"{uri}/servicesNS/{form['user']}/{form['app']}/configs/conf-{form['file']}/{form.get('stanza','')}?output_mode=json&count=0", sessionKey=token)
                if resp.status != 200:
                    return self.errorhandle(f"Getting config {uri}/servicesNS/{form['user']}/{form['app']}/configs/conf-{form['file']}/{form.get('stanza','')} failed", resp.reason, resp.status) 
                configs = json.loads(content)['entry']
                return self.handleConf(configs,uri,token,form['file'])
            except Exception as e:
                return self.errorhandle(f"GET request to {uri}/servicesNS/{form['user']}/{form['app']}/configs/conf-{form['file']}/{form.get('stanza','')} failed",e)
        
        # WRITE
        
        # Change a single config and process the response
        if form['a'] == "setconf":
            for x in ['file','stanza','attr','value']: # Check required parameters
                if x not in form:
                    return self.errorhandle(f"Missing '{x}' parameter")
            postargs = {form['attr']: form['value']}
            stanza = urllib.parse.quote(form['stanza'],safe='')
            try:
                resp, content = simpleRequest(f"{uri}/servicesNS/{form['user']}/{form['app']}/configs/conf-{form['file']}/{stanza}?output_mode=json", sessionKey=token, postargs=postargs)
                if resp.status not in [200,201,409]:
                    return self.errorhandle(f"Setting config {uri}/servicesNS/{form['user']}/{form['app']}/configs/conf-{form['file']}/{stanza} failed", resp.reason, resp.status) 
                configs = json.loads(content)['entry']
            except Exception as e:
                return self.errorhandle(f"POST request to {uri}/servicesNS/{form['user']}/{form['app']}/configs/conf-{form['file']}/{stanza} failed",e)
            #Reload
            try:
                simpleRequest(f"{uri}/servicesNS/{form['user']}/{form['app']}/configs/conf-{form['file']}/_reload", method="POST", sessionKey=token)
            except Exception:
                pass
            return self.handleConf(configs,uri,token,form['file'])

        # Perform multiple tasks sequentially
        if form['a'] == "tasks":
            for x in ['user','tasks']: # Check required parameters
                if x not in form:
                    return self.errorhandle(f"Missing '{x}' parameter")
            tasks = json.loads(form['tasks'])
            for task in tasks:
                l = len(task)
                if l == 1: #Create App
                    [app] = task
                    try:
                        resp, content = simpleRequest(f"{uri}/services/apps/local?output_mode=json", sessionKey=token, postargs=app, raiseAllErrors=True)
                    except Exception as e:
                        return self.errorhandle(f"POST request to {uri}/services/apps/local failed",e)
                    continue
                if l == 3: #Create Stanza
                    [app,conf,stanza] = task
                    try:
                        resp, content = simpleRequest(f"{uri}/servicesNS/{form['user']}/{app}/configs/conf-{conf}?output_mode=json", sessionKey=token, postargs={'name':stanza}, raiseAllErrors=True)
                    except Exception as e:
                        return self.errorhandle(f"POST request to {uri}/servicesNS/{form['user']}/{app}/configs/conf-{conf} failed",e)
                    continue
                if l == 4: #Create/Change Attributes
                    [app,conf,stanza,attr] = task
                    stanza = urllib.parse.quote(stanza,safe='')
                    try:
                        resp, content = simpleRequest(f"{uri}/servicesNS/{form['user']}/{app}/configs/conf-{conf}/{stanza}?output_mode=json", sessionKey=token, postargs=attr, raiseAllErrors=True)
                        #Reload
                        try:
                            simpleRequest(f"{uri}/servicesNS/{form['user']}/{app}/configs/conf-{conf}/{stanza}/_reload", method="POST", sessionKey=token)
                        except Exception:
                            pass
                    except Exception as e:
                        return self.errorhandle(f"POST request to {uri}/servicesNS/{form['user']}/{app}/configs/conf-{conf}/{stanza} failed",e)
                    continue
            return {'payload': 'true', 'status': 200}
                
        if form['a'] == "delstanza":
            for x in ['user','app','file','stanza']: # Check required parameters
                if x not in form:
                    return self.errorhandle(f"Missing '{x}' parameter")
            try:
                stanza = urllib.parse.quote(form['stanza'],safe='')
                simpleRequest(f"{uri}/servicesNS/{form['user']}/{form['app']}/configs/conf-{form['file']}/{stanza}", method='DELETE', sessionKey=token, raiseAllErrors=True)
                return {'payload': "true", 'status': 200} 
            except Exception as e:
                return self.errorhandle(f"DELETE request to {uri}/servicesNS/{form['user']}/{form['app']}/configs/conf-{form['file']}/{stanza} failed",e)

        #https://docs.splunk.com/Documentation/SplunkCloud/latest/Admin/ManageIndexesClassic
        if form['a'] == "getidxc":
            endpoint = "cluster_blaster_indexes/sh_indexes_manager" if ".splunkcloud.com" in form['server'] else "cluster/master/indexes"
            
            try:
                resp, content = simpleRequest(f"{uri}/services/{endpoint}?output_mode=json", sessionKey=token)
                logger.info(str(content))
                data = json.loads(content)
                if resp.status != 200:
                    try:
                        return self.errorhandle(data["messages"][0]["text"], resp.reason, resp.status)
                    except Exception:
                        return self.errorhandle(str(content), resp.reason, resp.status)
                
                output = {}
                for index in data['entry']:
                    output[index['name']] = {
                        'acl': {
                            'app': index['acl']['app'],
                            'owner': index['acl']['owner'],
                            'can_write': index['acl']['can_write'],
                            'perms': index['acl']['can_write']
                        },
                        'attr': {attr:value for (attr,value) in index['content'].items() if not attr.startswith('eai')}
                    }

                return {'payload': json.dumps(output, separators=(',', ':')), 'status': 200} 
            except Exception as e:
                return self.errorhandle(f"GET request to {uri}/services/{endpoint} failed",e)

        if form['a'] == "setidxc":
            for x in ['index','frozenTimePeriodInSecs','maxTotalDataSizeMB','maxGlobalRawDataSizeMB']: # Check required parameters
                if x not in form:
                    return self.errorhandle(f"Missing '{x}' parameter")
            endpoint = "cluster_blaster_indexes/sh_indexes_manager" if ".splunkcloud.com" in form['server'] else "cluster/master/indexes"

            data = {
                'frozenTimePeriodInSecs': form['frozenTimePeriodInSecs'],
                'maxTotalDataSizeMB': form['maxTotalDataSizeMB'],
                'maxGlobalRawDataSizeMB': form['maxGlobalRawDataSizeMB']
            }
            
            try:
                resp, content = simpleRequest(f"{uri}/services/{endpoint}/{form['index']}?output_mode=json", sessionKey=token, postargs=data)
                logger.info(str(content))
                data = json.loads(content)
                if resp.status not in [200,201,202]:
                    try:
                        return self.errorhandle(data["messages"][0]["text"], resp.reason, resp.status)
                    except Exception:
                        return self.errorhandle(str(content), resp.reason, resp.status)
                
                output = {}
                for index in data['entry']:
                    output[index['name']] = {
                        'acl': {
                            'app': index['acl']['app'],
                            'owner': index['acl']['owner'],
                            'can_write': index['acl']['can_write'],
                            'perms': index['acl']['can_write']
                        },
                        'attr': {attr:value for (attr,value) in index['content'].items() if not attr.startswith('eai')}
                    }

                return {'payload': json.dumps(output, separators=(',', ':')), 'status': 200} 
            except Exception as e:
                return self.errorhandle(f"POST request to {uri}/services/{endpoint}/{form['index']} failed",e)

        return self.errorhandle("No action requested")
        #except Exception as ex:
        #    return {'payload': json.dumps(ex), 'status': 500}
