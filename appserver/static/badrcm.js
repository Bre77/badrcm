const REST_ENDPOINT = `/${window.$C.LOCALE}/splunkd/__raw/services/badrcm?output_mode=json`
const CSRF = /splunkweb_csrf_token_\d+=(\d+)/.exec(document.cookie)[1]
const DEFAULT_APP_CONTEXT = {name:'-', label:"All"}
const SYSTEM_APP_CONTEXT = {name:'system', label:"System"}
const DEFAULT_USER_CONTEXT = {name:'nobody', realname:"Nobody"}
const SHOW_OPTIONS = ['All','Different','Missing']
const COLUMNS_MAX = 8
const CONF_FILES = ['props', 'inputs', 'outputs', 'transforms', 'app', 'server', 'authentication', 'authorize', 'badacs', 'badrcm', 'collections', 'commands', 'datamodels', 'eventtypes', 'fields', 'global-banner', 'health', 'indexes', 'limits', 'macros', 'passwords', 'savedsearches', 'serverclass', 'tags', 'web']
const SPLUNK_CLOUD_BLACKLIST = ['server','limits']
const DELIM = "\0"

function ISORT(a,b){
    return a.localeCompare(b, undefined, {sensitivity: 'base'})
}

function imgError(image){
    image.onerror = "";
    image.src = `${STATIC_PREFIX}/appIcon.png`;
    return true;
}

Vue.prototype.localStorage = window.localStorage
Vue.use(KeenUI);
const vue = new Vue(
{
    el: '#vue',
    data: {
        startup: true,
        addserver_host: "",
        addserver_host_error: "",
        addserver_auth: "",
        addserver_auth_error: "",
        addserver_shared: true,
        addserver_loading: false,

        base_loading: 1,
        conf_data: {}, // Splunk Config responses
        conf_model: {}, // View Model
        conf_servers: {},
        conf_tick: {}, // Selected for actions
        conf_hide: {}, // Hidden - persist to local storage
        conf_setting_apps: [],
        setting_columns_option: "2",
        conf_setting_files: [CONF_FILES[0]],
        //conf_setting_files_options: CONF_FILES,
        conf_setting_show: SHOW_OPTIONS[0],
        conf_setting_show_options: SHOW_OPTIONS,
        conf_columns: Array.from({length:COLUMNS_MAX}, u => ({
            server: '',
            app: DEFAULT_APP_CONTEXT,
            user: DEFAULT_USER_CONTEXT,
            loading: 0,
        })),
        conf_app_label: 'label',
        conf_user_label: 'realname',
        conf_add_col: null,
        conf_add_file: "",
        conf_add_app: "",
        conf_add_stanza: "",
        conf_add_attrs: [""],
        conf_add_loading: false,
        conf_copy_col: null,
        conf_paste_col: null,
        conf_copy_tasks: [],
        conf_copy_loading: false,
        conf_move_col: null,
        conf_remove_col: null,
        conf_export_col: null,
        conf_export_loading: false,
        idxc_columns: Array.from({length:COLUMNS_MAX}, u => ({
            server: '',
            loading: 0,
        })),
        idxc_loading: false,
        idxc_data: {},
        idxc_model: {},
        idxc_hide: {},
        idxc_tick: {},
        idxc_attr: ['frozenTimePeriodInSecs','maxTotalDataSizeMB', 'maxGlobalRawDataSizeMB'],
        
        VALID_ATTR: RegExp('^[^#=]+=[^=]+$'),
        DEFAULT_APP_CONTEXT: DEFAULT_APP_CONTEXT,
        SYSTEM_APP_CONTEXT: SYSTEM_APP_CONTEXT,
        DEFAULT_USER_CONTEXT: DEFAULT_USER_CONTEXT,
        CONF_COLUMN_OFFSET: 3,
        CONF_SAME: Symbol(),
        CONF_DIFF: Symbol(),
        SHARING_ICON: {
            'global':"public",
            'app':"web_asset",
            'user':"account_circle",
            'system': "settings",
        },
        SPLUNKD_PATH: `/${window.$C.LOCALE}/splunkd/__raw/servicesNS/${window.$C.USERNAME}`,
    },
    computed: {
        servers(){
            const servers = Object.keys(this.conf_servers).filter(server => !this.conf_servers[server].hasOwnProperty('error'))
            console.log("SERVERS",servers)
            return servers
        },
        conf_apps(){
            // Definitive list of all known apps, grouped together
            let apps = {
                'system': {'name': 'system', 'label':{}, 'url': "", 'version':{}, 'visable': {}}
            }
            for (const [server,data] of Object.entries(this.conf_servers)){
                for (const app of data.apps){
                    
                    if(!apps.hasOwnProperty(app.name)){
                        apps[app.name] = {'name': app.name, 'label':{}, 'url': "", 'version':{}, 'visable': {}}
                    } 
                    if(app.label){
                        apps[app.name].label[server] = app.label
                    }
                    if(app.details){
                        apps[app.name].url = app.details
                    }
                    if(app.version){
                        apps[app.name].version[server] = app.version
                    }
                    if(app.visable){
                        apps[app.name].visable[server] = app.visable
                    }
                }
            }
            return apps
        },
        conf_setting_apps_options(){
            // Dropdown list of App Options
            return this.Aus(["system", ...Object.values(this.conf_servers).map(s => s.apps.map(a => a.name).flat()).flat()]) 
        },
        conf_setting_files_options(){
            // Dropdown list of File Options
            return this.Aus(Object.values(this.conf_servers).map(s => s.files).flat())
        },
        setting_columns_options() {
            // Dropdown list of Column Options (as a string)
            let start = 2
            let end = COLUMNS_MAX
            return [...Array(end-start+1).keys()].map(i => String(i + start));
        },
        setting_columns() {
            // The column option, but as a number
            return Number(this.setting_columns_option)
        }
    },
    methods: {
        //
        // Home
        //
        AddServer(){
            this.addserver_loading = true
            this.addserver_host = this.addserver_host.trim()
            this.addserver_auth = this.addserver_auth.trim()
            this.Request('addserver',{server:this.addserver_host, token:this.addserver_auth, shared:this.addserver_shared})
            .then(resp => {
                this.$set(this.conf_servers,this.addserver_host,resp)
                this.addserver_host = ""
                this.addserver_auth = ""
                this.addserver_shared = true
                this.addserver_loading = false
            }, e => {
                console.log(e)
                this.addserver_loading = false
                this.addserver_host_error = e.message
            })
        },
        //
        // Config Tab
        //
        ConfChangeValue(c,f,a,s,x){
            //form['file'] and form['server'] and form['stanza'] and form['attr'] and form['value']
            // All Apps uses confs own app, not context
            const key = this.ConfKey(this.conf_columns[c],f)
            let options = {
                server: this.conf_columns[c].server,
                user: this.conf_columns[c].user.name,
                app: (this.conf_columns[c].app.name == DEFAULT_APP_CONTEXT.name ? a : this.conf_columns[c].app.name),
                file: f,
                stanza: s,
                attr: x,
                value: this.conf_data[key][a][s].attr[x]
            }
            return this.Request('setconf',options).then(resp => {
                for (const respapp in resp){
                    if(resp[respapp][s]){
                        this.$set(this.conf_data[key][respapp],s,resp[respapp][s])
                    } else console.warn(`Stanza ${s} wasnt found in response`,resp)
                }

                // For all active columns of the same file not including this one
                let tasks = []
                for (const target of Object.keys(this.conf_data)){
                    if (target == key) continue // Dont grab what we just changed
                    const [server, app, user, file] = target.split('|')
                    if (server !== this.conf_columns[c].server || file !== f) continue // Only grab same server and file
                    tasks.push(this.Request('getconf',{'file': file, 'server': server, 'app': app, 'user': user, 'stanza':s}).then(resp => {
                        for (const respapp in resp){
                            if(resp[respapp][s]){
                                this.$set(this.conf_data[target][respapp],s,resp[respapp][s])
                            } else console.warn(`Stanza ${s} wasnt found in response`,resp)
                        }
                    }))
                }
                return Promise.all(tasks)
            }).then(()=>{
                this.ConfModelUpdate()
            })
            
        },
        ConfModelUpdate(){
            // Generates the merged view of configuration used for display
            console.time('ConfModelUpdate')
            let model = {}
            // DECOM let app_labels = {}
            // DECOM app_labels[this.SYSTEM_APP_CONTEXT.name] = new Set([this.SYSTEM_APP_CONTEXT.label])

            const columns = Object.entries(this.conf_columns.slice(0,this.setting_columns)).filter(c => c[1].server).map(c => {
                c[0] = parseInt(c[0])
                return c
            }) //Add Required CSS Column Offset
            for (const file of this.conf_setting_files){
                // Get all data
                let data = []
                for (const [index,column] of columns){
                    const cd = this.conf_data[this.ConfKey(column,file)]
                    if (!cd) continue
                    data.push(cd)
                }
                if (data.length === 0) continue

                // Create file parent
                model[file] = {
                    apps: {},
                    key: file,
                    state: null,
                }

                // Add tick placeholder
                if (!this.conf_tick.hasOwnProperty(model[file].key)) this.$set(this.conf_tick,model[file].key,false)
                    
                // Get all apps
                const apps = this.Aus(data.map(d => Object.keys(d)).flat())
                for (const app of apps){
                    // Create app parent
                    model[file].apps[app] = {
                        stanzas: {},
                        cols: {},
                        //label: this.Aus(Object.values(this.conf_apps[app].label)).join(" / "),
                        url: this.conf_apps[app].url,
                        key: `${file}|${app}`,
                        state: null,
                    }

                    // Create app in options list if requried
                    // DECOM if (!app_labels[app]) app_labels[app] = new Set()

                    // Get app columns
                    for (const [index, column] of columns){
                        const label = this.conf_apps[app].label[column.server]
                        if (label){
                            model[file].apps[app].cols[index] = {
                                'label': label
                            }
                            const version = this.conf_apps[app].version[column.server]
                            if (version){
                                model[file].apps[app].cols[index]['version'] = version
                            }
                        }

                        // Get Labels
                        // DECOM const y = this.conf_apps[app].label[column.server]
                        // DECOM if (y) app_labels[app].add(y)
                    }

                    // Add tick placeholder
                    if (!this.conf_tick.hasOwnProperty(model[file].apps[app].key)) this.$set(this.conf_tick,model[file].apps[app].key,false)

                    // Get all stanzas
                    const stanzas = this.Aus(data.map(d => Object.keys(d[app] || {})).flat())
                    for (const stanza of stanzas){
                        // Create stanza parent
                        model[file].apps[app].stanzas[stanza] = {
                            attrs: {},
                            cols: {},
                            key: `${file}|${app}|${stanza}`,
                            state: null,
                        }

                        // Get stanza columns
                        for (const [index, column] of columns){
                            const x = this.GetChild(this.conf_data[this.ConfKey(column,file)],[app,stanza,'acl'])
                            if (x !== undefined){
                                // Figure out if this stanza can be changed - If user is owner, if role = * or if user has role
                                x.authorized = (x.owner == this.conf_servers[column.server].rights.username) || x.roles.some(role => {
                                    return role == "*" || this.conf_servers[column.server].rights.roles.includes(role)
                                })
                                // Splunk Cloud Guardrails
                                x.safe = !(column.server.endsWith(".splunkcloud.com") && SPLUNK_CLOUD_BLACKLIST.includes(file))
                                
                                x.edit = x.can_write && x.authorized && x.safe
                                model[file].apps[app].stanzas[stanza].cols[index] = x
                            }
                        }

                        // Add tick placeholder
                        if (!this.conf_tick.hasOwnProperty(model[file].apps[app].stanzas[stanza].key)) this.$set(this.conf_tick,model[file].apps[app].stanzas[stanza].key,false)

                        // Get all attributes
                        const attrs = this.Aus(data.map(d => Object.keys(this.GetChild(d,[app,stanza,'attr'],{}))).flat())
                        for (const attr of attrs){

                            // Create attribute parent
                            model[file].apps[app].stanzas[stanza].attrs[attr] = {
                                cols: {},
                                key: `${file}|${app}|${stanza}|${attr}`,
                                state: null,
                            }

                            let miss = false
                            let diff = false
                            let first                             

                            // Get all values

                            for (const [index, column] of columns){
                                value = this.GetChild(this.conf_data[this.ConfKey(column,file)],[app,stanza,'attr',attr])
                                if(value !== undefined){
                                    if(first === undefined){
                                        first = value
                                    } else {
                                        diff = diff || first !== value
                                    }
                                    // Get attribute columns (values)
                                    model[file].apps[app].stanzas[stanza].attrs[attr].cols[index] = {
                                        value: value,
                                        key: this.ConfKey(column,file),
                                        edit: model[file].apps[app].stanzas[stanza].cols[index].edit
                                    }
                                } else {
                                    miss = true
                                }
                            }
                            if (diff){
                                model[file].apps[app].stanzas[stanza].attrs[attr].state = this.CONF_DIFF
                                model[file].apps[app].stanzas[stanza].state = this.CONF_DIFF
                                model[file].apps[app].state = this.CONF_DIFF
                                model[file].state = this.CONF_DIFF
                            }
                            else if (!miss && columns.length>1) {
                                if(!model[file].apps[app].stanzas[stanza].attrs[attr].state) model[file].apps[app].stanzas[stanza].attrs[attr].state =  this.CONF_SAME
                                if(!model[file].apps[app].stanzas[stanza].state) model[file].apps[app].stanzas[stanza].state = this.CONF_SAME
                                if(!model[file].apps[app].state) model[file].apps[app].state = this.CONF_SAME
                                if(!model[file].state) model[file].state = this.CONF_SAME
                            }

                            // Add tick placeholder
                            if (!this.conf_tick.hasOwnProperty(model[file].apps[app].stanzas[stanza].attrs[attr].key)) this.$set(this.conf_tick,model[file].apps[app].stanzas[stanza].attrs[attr].key,false)
                        }
                    }
                }
            }
            console.timeEnd('ConfModelUpdate')
            this.$set(this,'conf_model',model)

            // Reformat App Options list
            /*const app_options = Object.keys(app_labels).sort().map(name => ({
                name: name,
                label: Array.from(app_labels[name]).join(" / ")
            }))
            this.$set(this,'conf_setting_apps_options',app_options)*/
        },
        ConfKey(c,f){
            // Returns a standardised key for conf_data
            return `${c.server}|${c.app.name || c.app}|${c.user.name || c.user}|${f}`
        },
        ConfFixImage(event){
            image = event.srcElement
            
            image.parentNode.removeChild(image)
            /*image.onerror = "";
            image.src = "{{SPLUNKWEB_URL_PREFIX}}/static/app/badrcm/appIcon.png";*/
            return true;
        },
        ConfCheckColumnOptions(c){
            // Ensures Column Options are valid when changed.
            if(!c.server || !this.conf_servers.hasOwnProperty(c.server)){
                c.app = DEFAULT_APP_CONTEXT
                c.user = DEFAULT_USER_CONTEXT
            } else {
                if(c.app != DEFAULT_APP_CONTEXT && !this.conf_servers[c.server].apps.hasOwnProperty(c.app)){
                    console.warn(`${c.app.name || c.app} wasnt found in ${c.server} apps, changing to ${DEFAULT_APP_CONTEXT}`)
                    c.app = DEFAULT_APP_CONTEXT
                }
                if(c.user != DEFAULT_USER_CONTEXT && !this.conf_servers[c.server].users.hasOwnProperty(c.user)){
                    console.warn(`${c.user.name || c.user} wasnt found in ${c.server} apps, changing to ${DEFAULT_USER_CONTEXT}`)
                    c.user = DEFAULT_USER_CONTEXT
                }
            }
        },
        ConfChangeOptions(column,force=false){
            // Ensures conf_data and conf_model are updated to reflect the Column Options
            const columns = column ? [column] : this.conf_columns
            let tasks = []
            for(const c of columns){
                if(!c.server) continue // Ignore unselected
                for (const f of this.conf_setting_files){
                    const key = this.ConfKey(c,f)
                    if(!force && this.conf_data.hasOwnProperty(key)) continue // Have data already
                    
                    c.loading += 1
                    const task = this.Request('getconf',{
                        file: f,
                        server: c.server,
                        app: c.app.name,
                        user: c.user.name,
                    }).then(resp => {
                        this.$set(this.conf_data,key,resp)
                        c.loading -= 1
                    })
                    tasks.push(task)
                }
            }
            return Promise.all(tasks).then(this.ConfModelUpdate)
        },
        ConfChangeFiles(){
            localStorage.setItem('badrcm_conf_setting_files', this.conf_setting_files.join(DELIM))
        },
        ConfChangeApps(){
            localStorage.setItem('badrcm_conf_setting_apps', this.conf_setting_apps.join(DELIM))
        },
        ConfChangeShow(){
            localStorage.setItem('badrcm_conf_setting_show', this.conf_setting_show)
        },
        ConfChangeColumns(){
            localStorage.setItem('badrcm_setting_columns_option', this.setting_columns_option)
        },
        ConfShowHide(key){
            this.$set(this.conf_hide,key,!this.conf_hide[key])
            localStorage.setItem('badrcm_conf_hide', Object.entries(this.conf_hide).filter(x => x[1]).map(x => x[0]).join(DELIM))
        },
        ConfChangeTick(key){
            console.time(`ConfChangeTick ${key}`)

            // Mirror Children
            const prefix = key+'|'
            for (const child of Object.keys(this.conf_tick)){
                if (child.startsWith(prefix)) this.$set(this.conf_tick,child,this.conf_tick[key])
            }
            // Untick parents
            if(this.conf_tick[key] == false){
                let parents = key.split('|')
                parents.pop()
                while(parents.length){
                    this.$set(this.conf_tick,parents.join('|'), false)
                    parents.pop()
                }
            }
            console.timeEnd(`ConfChangeTick ${key}`)
        },
        ConfGetStanza(c){
            // Gets selected Stanzas as an array
            if(!c) return []
            console.time(`ConfGetStanza ${c.server}`)
            let selected = []
            for (const [key,ticked] of Object.entries(this.conf_tick)){
                if(!ticked) continue
                const p = key.split('|')
                if(p.length !== 3) continue
                if(this.GetChild(this.conf_data[this.ConfKey(c,p[0])],[p[1],p[2]]) == undefined) continue
                selected.push(p)
            }
            console.timeEnd(`ConfGetStanza ${c.server}`)
            return selected
        },
        ConfGetSelected(c){
            // Gets selected Attributes and Values as an object
            if(!c) return {}
            console.time(`ConfGetSelected ${c.server}`)
            let selected = {}
            for (const [key,ticked] of Object.entries(this.conf_tick)){
                // Check is actually ticked
                if(!ticked) continue

                // Check is attribute
                const p = key.split('|')
                if(p.length !== 4) continue

                // Check File is visible
                if(!this.conf_setting_files.includes(p[0])) continue

                // Check App is visible
                if(!this.conf_setting_apps.includes(p[1])) continue
                
                // Check Attribute has a value
                const value = this.GetChild(this.conf_data[this.ConfKey(c,p[0])],[p[1],p[2],'attr',p[3]])
                if(value == undefined) continue
                
                // Create Object Tree
                if(!selected[p[0]]) selected[p[0]] = {[p[1]]: {[p[2]]: {[p[3]]: value}}}
                else if(!selected[p[0]][p[1]]) selected[p[0]][p[1]] = {[p[2]]: {[p[3]]: value}}
                else if(!selected[p[0]][p[1]][p[2]]) selected[p[0]][p[1]][p[2]] = {[p[3]]: value}
                else selected[p[0]][p[1]][p[2]][p[3]] = value

            }
            console.timeEnd(`ConfGetSelected ${c.server}`)
            return selected
        },
        ConfGetFiles(c, newline="<br>", folder="default"){
            let files = {}
            let data = this.ConfGetSelected(c)

            for (const conf in data){
                for (const app in data[conf]){
                    if (!files.hasOwnProperty(app)){
                        files[app] = {'default': {}}
                    }
                    body = ""
                    for (const stanza in data[conf][app]){
                        body += `[${stanza}]${newline}`
                        for (const attr in data[conf][app][stanza]){
                            let value = String(data[conf][app][stanza][attr]).replace(/\n/g,`\\${newline}`)
                            body += `${attr} = ${value}${newline}`
                        }
                        body += newline
                    }
                    files[app]['default'][`${conf}.conf`] = body
                }
            }
            return files
        },
        ConfDownloadFiles(c){
            this.conf_export_loading = true
            let files = this.ConfGetFiles(c,"\n")
            var zip = new JSZip();
            for (const app in files){
                var zip_app = zip.folder(app)
                for (const folder in files[app]){
                    var zip_app_folder = zip_app.folder(folder);
                    for (const conf in files[app][folder]){
                        zip_app_folder.file(`${conf}`,files[app][folder][conf])
                    }
                }
            }
            return zip.generateAsync({type:"blob"}).then((content)=>{
                this.$refs.export.close()
                this.conf_export_loading = false
                window.location.assign(window.URL.createObjectURL(content));
            });
        },
        ConfCopyTasks(){
            let source = this.conf_copy_col
            let target = this.conf_paste_col
            if(!source || !target) return []

            const conf = this.ConfGetSelected(source)

            console.time(`ConfCopyTasks ${source.server} ${target.server}`)
            let tasks = []
            let description = []

            for (const file in conf){
                const data = this.conf_data[this.ConfKey(target,file)]
                if(!data){
                    console.warn(`The file {file} doesnt exist on {target.server}`)
                    description.push({'class': 'error', 'text': `${file}.conf does not exist on this Splunk Server.`})
                    continue
                }

                for (const app in conf[file]){
                    if(this.GetChild(data,[app]) == undefined){
                        description.push({'class': 'create', 'text': `${app}/${file}.conf`})
                        const newapp = {
                            name: app,
                            author: window.$C.USERNAME,
                        }
                        const label = this.conf_apps[app].label[source]
                        if (label) newapp.label = label
                        const version = this.conf_apps[app].version[source]
                        if (version) newapp.version = version
                        const visable = this.conf_apps[app].visable[source]
                        if (visable) newapp.visable = visable

                        tasks.push([newapp])
                    } else description.push({'class': 'skip', 'text': `${app}/${file}.conf`})

                    for (const stanza in conf[file][app]){
                        if(this.GetChild(data,[app,stanza]) == undefined){
                            description.push({'class': 'create', 'text': `[${stanza}]`})
                            tasks.push([app,file,stanza])
                        } else description.push({'class': 'skip', 'text': `[${stanza}]`})

                        attrs = {}
                        for (const attr in conf[file][app][stanza]){
                            const value = this.GetChild(data,[app,stanza,'attr',attr])
                            if(value == undefined){
                                description.push({'class': 'create', 'text': `${attr} = ${conf[file][app][stanza][attr]}`})
                                attrs[attr] = conf[file][app][stanza][attr]
                            } else if(value !== conf[file][app][stanza][attr]){
                                description.push({'class': 'modify', 'text': `${attr} = ${conf[file][app][stanza][attr]} (was ${value})`})
                                attrs[attr] = conf[file][app][stanza][attr]
                            } else if(value !== conf[file][app][stanza][attr]) tasks.push({'class': 'skip', 'text': `${attr} = ${conf[file][app][stanza][attr]}`})
                        }
                        if (attrs !== {}){
                            tasks.push([app,file,stanza,attrs])
                        }
                    }
                }
            }
            console.timeEnd(`ConfCopyTasks ${source.server} ${target.server}`)
            this.$set(this,'conf_copy_tasks',tasks)
            return description
        },
        ConfCopy(){
            this.conf_copy_loading = true
            const options = {
                server: this.conf_paste_col.server,
                user: this.conf_paste_col.user.name,
                tasks: JSON.stringify(this.conf_copy_tasks)
            }
            return this.Request('tasks',options).then(()=>{
                this.conf_copy_loading = false // Order important
                Vue.nextTick(()=>{
                    this.$refs.copy.close() // Order important
                    this.conf_copy_col = null
                    this.conf_paste_col = null
                    this.conf_copy_tasks = []
                })
                return this.ConfChangeOptions(this.conf_paste_col,true)
            }, ()=>{
                this.conf_copy_loading = false
            })
        },
        ConfMove(c){

        },
        ConfAdd(c){
            this.conf_add_loading = true
            let tasks = []
            if (!this.conf_data[vue.ConfKey(this.conf_add_col,this.conf_add_file)].hasOwnProperty(this.conf_add_app) || !this.conf_data[vue.ConfKey(this.conf_add_col,this.conf_add_file)][this.conf_add_app].hasOwnProperty(this.conf_add_stanza)){
                tasks.push([this.conf_add_app,this.conf_add_file,this.conf_add_stanza])
            }
            let attrs = {}
            for (const line of this.conf_add_attrs){
                if (!this.VALID_ATTR.test(line)){
                    console.warn(`Skipping line ${line}`)
                    continue
                }
                const [attr,value] = line.split("=")
                attrs[attr.trim()] = value.trim()
            }
            tasks.push([this.conf_add_app,this.conf_add_file,this.conf_add_stanza,attrs])
            const options = {
                server: this.conf_add_col.server,
                user: this.conf_add_col.user.name,
                tasks: JSON.stringify(tasks)
            }
            return this.Request('tasks',options).then(()=>{
                this.conf_add_loading = false
                Vue.nextTick(()=>{
                    this.$refs.add.close()
                    this.conf_add_col = null
                    this.conf_add_file = ''
                    this.conf_add_app = ''
                    this.conf_add_stanza = ''
                    this.conf_add_attrs = [""]
                })
            }, ()=>{
                this.conf_add_loading = false
            }).then(()=>{
                return this.ConfChangeOptions(this.conf_paste_col,true)
            })
        },
        ConfAddLine(i){
            if(this.conf_add_attrs[i+1] == undefined && this.VALID_ATTR.test(this.conf_add_attrs[i])) this.conf_add_attrs.push('')
        },
        ConfRemove(){
            this.conf_remove_loading = true
            return Promise.all(this.ConfGetStanza(this.conf_remove_col).map(x => {
                const options = {
                    server: this.conf_remove_col.server,
                    user: this.conf_remove_col.user.name,
                    file: x[0],
                    app: x[1],
                    stanza: x[2]
                }
                return this.Request('delstanza',options).then(()=>{
                    // Cleanup Ticks
                    const key = x.join('|')
                    this.$remove(this.conf_tick,key)
                    for (const child of Object.keys(this.conf_tick)){
                        if (child.startsWith(key)) this.$remove(this.conf_tick,child)
                    }
                    
                })
            })).then(()=>{
                this.conf_remove_loading = false
                Vue.nextTick(()=>{
                    this.$refs.remove.close()
                    this.conf_remove_col = null
                })
            }, ()=>{
                this.conf_remove_loading = false
            }).then(()=>{
                return this.ConfChangeOptions(this.conf_paste_col,true)
            })
        },
        //
        // Index Cluster
        //
        IdxcChangeOptions(column,force=false){
            console.log(column)
            const columns = column ? [column] : this.idxc_columns
            let tasks = []
            for(const c of columns){
                if(!c.server) continue // Ignore unselected
                    
                if(!force && this.idxc_data.hasOwnProperty(c.server)) continue // Have data already
                
                c.loading += 1
                const task = this.Request('getidxc',{
                    server: c.server,
                }).then(resp => {
                    this.$set(this.idxc_data,c.server,resp)
                    c.loading -= 1
                }, reject => {
                    this.$set(this.idxc_data,c.server,null)
                    c.loading -= 1
                })
                tasks.push(task)
            }
            return Promise.all(tasks).then(this.IdxcModelUpdate)
        },
        IdxcModelUpdate(){
            console.time("IdxcModelUpdate")
            let model = {}
            let names = new Set()
            let columns = []
            for(const [i,c] of Object.entries(this.idxc_columns)){ 
                if(i >= this.setting_columns) break
                if(!c.server) continue
                columns.push([parseInt(i),c])
                for(const name in this.idxc_data[c.server]){
                    names.add(name)
                }
            }
            console.log(columns, names)
            for(const name of names){ //Array.from(names).sort(ISORT)
                model[name] = {
                    cols:{},
                    attr:{},
                    static_attr:{}
                }

                let attributes = new Set()
                for(const [i,c] of columns){
                    if(!this.idxc_data[c.server].hasOwnProperty(name)) continue
                    model[name].cols[i+this.CONF_COLUMN_OFFSET] = this.idxc_data[c.server][name].acl
                    for(const attr in this.idxc_data[c.server][name].attr){
                        if(this.idxc_attr.includes(attr)) continue
                        attributes.add(attr)
                    }
                }
                for(const attr of this.idxc_attr){
                    model[name].attr[attr] = {cols:{}, key:`${name}|${attr}`}
                    for(const [i,c] of columns){
                        if(!this.idxc_data[c.server].hasOwnProperty(name)) continue
                        //if(!this.idxc_data[c.server][name].attr.hasOwnProperty(attr)) continue
                        model[name].attr[attr].cols[i+this.CONF_COLUMN_OFFSET] = c
                    }
                }
                for(const attr of attributes){ //Array.from(attributes).sort(ISORT)
                    model[name].static_attr[attr] = {cols:{}, bool:false, key:`${name}|${attr}`}
                    for(const [i,c] of columns){
                        if(!this.idxc_data[c.server].hasOwnProperty(name)) continue
                        if(!this.idxc_data[c.server][name].attr.hasOwnProperty(attr)) continue //Attr might be optional
                        model[name].static_attr[attr].cols[i+this.CONF_COLUMN_OFFSET] = c
                    }
                }
            }
            this.$set(this,'idxc_model',model)
            console.timeEnd("IdxcModelUpdate")
        },
        IdxcShowHide(key){
            this.$set(this.idxc_hide,key,!this.idxc_hide[key])
            localStorage.setItem('badrcm_idxc_hide', Object.entries(this.idxc_hide).filter(x => x[1]).map(x => x[0]).join(DELIM))
        },
        IdxcChangeTick(key){
            console.time(`IdxcChangeTick ${key}`)

            // Mirror Children
            const prefix = key+'|'
            for (const child of Object.keys(this.idxc_tick)){
                if (child.startsWith(prefix)) this.$set(this.idxc_tick,child,this.idxc_tick[key])
            }
            // Untick parents
            if(this.idxc_tick[key] == false){
                let parents = key.split('|')
                parents.pop()
                while(parents.length){
                    this.$set(this.idxc_tick,parents.join('|'), false)
                    parents.pop()
                }
            }
            console.timeEnd(`IdxcChangeTick ${key}`)
        },
        IdxcChangeValue(server,index,attr){
            console.log(server,index,attr)
            let options = {
                server: server,
                index: index,
                'frozenTimePeriodInSecs': this.idxc_data[server][index].attr.frozenTimePeriodInSecs,
                'maxTotalDataSizeMB': this.idxc_data[server][index].attr.maxTotalDataSizeMB,
                'maxGlobalRawDataSizeMB': this.idxc_data[server][index].attr.maxGlobalRawDataSizeMB,
            }
            console.log(options)
            return this.Request('setidxc',options).then(resp => {
                for (const respidx in resp){
                    this.$set(this.idxc_data[server],respidx,resp[respidx])
                }
            })
        },
        //
        // Generic Helpers
        //
        Aus(a){ //Arrays Unique Sorted 
            return Array.from(new Set(a)).sort(ISORT)
        },
        Options(){
            return Array.from(new Set([...arguments].flat()))
        },
        Request(action,data={}) {
            let form = new URLSearchParams()
            form.append('a', action)
            for (x in data){
                form.append(x, data[x])
            }
            console.info('Request',form.toString())
            const p = performance.now()
            return fetch(REST_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-Splunk-Form-Key': CSRF,
                },
                body: form
            })
            .catch(e => {
                console.warn(e)
                this.$refs.errorbar.createSnackbar({
                    message: e.message
                });
                return Promise.reject({ cause: 'local', message: e.message });
            })
            .then(resp => {
                console.log('Response', resp.status, resp.statusText, Math.round(performance.now()-p), 'ms')
                json = resp.json().catch(e => {
                    console.warn(e)
                    return resp.text().then(text =>{
                        this.$refs.errorbar.createSnackbar({
                            message: text
                        });
                        return Promise.reject({ cause: 'parse', message: text });
                    })
                    
                })
                if (resp.status == 200){
                    return json
                } else {
                    return json.then(data => {
                        console.warn(resp.status, data)
                        this.$refs.errorbar.createSnackbar({
                            message: data.message
                        });
                        return Promise.reject({ cause: resp.status, message: data.message})
                    })
                }
            })
        },
        GetChild(object, keys, def=undefined) {
            if (object === undefined) return def
            for (const key of keys){
                if (object.hasOwnProperty(key)){
                    object = object[key]
                } else return def
            }
            return object
        },
    },
    mounted() {
        // Force disclaimer if it hasnt been accepted
        if (!localStorage.badrcm_disclaimer){
            this.$refs.disclaimer.open()
        }

        // Remember previous setttings
        if(localStorage.badrcm_setting_columns_option){
            this.$set(this, 'setting_columns_option', localStorage.getItem('badrcm_setting_columns_option'))
        }
        if(localStorage.badrcm_conf_hide){
            let conf_hide = localStorage.getItem('badrcm_conf_hide').split(DELIM).reduce((a,b)=>{
                a[b] = true
                return a
            },{})
            this.$set(this, 'conf_hide', conf_hide)
        }

        // Load base data
        this.base_loading = 1
        this.Request('getservers').then(resp => {
            this.$set(this,'conf_servers',resp)
        }).catch(e => {
            console.error("FATAL ERROR, Failed to get servers")
        }).then(x => {
            // Remember previous setttings
            if(localStorage.badrcm_conf_setting_files){
                this.$set(this, 'conf_setting_files', localStorage.getItem('badrcm_conf_setting_files').split(DELIM))
            }
            if(localStorage.badrcm_conf_setting_apps){
                this.$set(this, 'conf_setting_apps', localStorage.getItem('badrcm_conf_setting_apps').split(DELIM))
            }
            this.base_loading = 0
            this.startup = false
        })
    },
    watch: {       
        /*conf_hide(next,prev){
            console.log('badrcm_conf_hide',next)
            if(next) localStorage.setItem('badrcm_conf_hide', Object.entries(next).filter(x => x[1]).map(x => x[0]).join(DELIM))
        }*/
    }
})