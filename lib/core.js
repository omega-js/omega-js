/**
 * Created by J.Ivanov on 11/24/16.
 */

'use strict';

var Base = require('./base.js');

module.exports = class Core extends Base
{
    constructor() {
        super();
        this.plugin = false; // entity/plugin object
        this.command = false; // command to execute on the entity
        this.args = false; // full command line args (as entered)
        this.params = false; // command line params (after parsing)

        this.log("version: " + this.version);
        this.log("Using CONF file: " +  this.conf.confPath);
        this.log("Project root path: " + (this.conf.projectRootPath || "not found") );
    }
    // parses command line params
    parse(args)
    {
        let result = false;
        let plugin = false; // the entity/plugin name we are going to work on
        let command = false;

        // some default params and their aliases
        let parseOptions = {};
        parseOptions.alias = {
            'version' : ['v'], // aliases for --version
        };

        this.args = args;
        this.params = this.parseCommandLineArgs(args, parseOptions);

        if (this.params.version)
        { // version param set
            this.params._=["version"]; // set to run the version plugin
        }

        if (this.params._.length <= 0)
        {
            this.help();
            return;
        }
        else if (this.params._.length == 1)
        {
            plugin = this.params._[0];
        }
        else if (this.params._.length >= 2)
        {
            /*if (this.isConfigCommand((this.params._[0]))
            {
                plugin = this.params._[0];
                command = this.params._[1];
            }*/
            if (this.isPlugin(this.params._[0]))
            {
                plugin = this.params._[0];
                command = this.params._[1];
            }
            else
            {
                plugin = this.params._[1];
                command = this.params._[0];
            }
        }

        if (this.isPlugin(plugin))
        { // now check for valid command i.e. method exists in entity
            this.plugin = new (require(this.getPluginPathByName(plugin)))(this.args);

            if (command)
            {
                if (this.plugin.isCommand(command))
                {
                    this.command = command;
                    result = true;
                }
                else
                {
                    this.error(11, "Method/command not part of the plugin (plugin name: "+plugin+")!"); // invalid command on that plugin/entity
                }

            }
            else
            {
                result = true; // success
            }
        }
        else
        {
            this.error(10, "Invalid command/plugin to execute!"); // invalid plugin/entity
        }

        //console.log("PLUGIN= ", plugin);
        //console.log("COMMAND= ", this.command);
        //console.log("PARAMS= ", this.params);

        return result;
    }

    //  executes command
    execute(plugin, command, params)
    {
        let result = false;

        if (!plugin) plugin = this.plugin;
        if (!command) command = this.command;
        if (!params) params = this.params;

        if (plugin.isCommand(command))
        {
            result = plugin[command](params);
        }
        else
        { // by default, if the command is NOT found, display help()
            plugin.help();
        }

        return result;
    }

    // displays help screen
    help()
    {
        console.log("\n\nHELP:");
        console.log("\nomg project create -t=template_name project_folder/");
        console.log("\nomg deploy target [stage]");
        console.log("\nomg deploy back");
        console.log("omg deploy frontend dev");

        console.log("\n\n");

    }

    // checks whether pluginName is a valid entity/plugin, returns True if so, otherwise returns False
    isPlugin(pluginName)
    {
        return (this.isPath(this.getPluginPathByName(pluginName)) === true ? true : false);
    }

    getPluginPathByName(pluginName)
    {
        return this.conf.pluginsDir+pluginName.toLowerCase()+'.js';
    }

    process(args)
    {
        if (this.parse(args))
        {
            this.execute();
        }
    }
}
