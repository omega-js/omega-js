/**
 * Created by J.Ivanov on 11/24/16.
 */

'use strict';

const VERSION = "0.0.1";

var fs = require('fs-extra');
var path = require('path');
var parseArgs = require('minimist'); // module to aid command line args parsing
var child = require('child_process');

// That is OmegaJS Base class that implements some common features
// While not strictly necessary you may want to always inherit this one (or a descendant) in order to access those features
class Base
{
    constructor()
    {
        this.version = VERSION;
        this.defaults = {
            pathSeparator: this.getPathSeparator(),
            workingPath: process.cwd() + "/",
            omegaPath: path.normalize(__dirname + "/../"),
            dotOmegaDir: '.omega/',
            languageFileName: 'language.json',
            templatesDir : "templates/",
            projectTemplatesDir : "projects/",
            pluginsDir : "plugins/",
            jsonConfFileName: "omega.json",
            confPath: "", // full path of the CONF file that is being used
            envFileName: "env.js", // file name of the env vars file, default path is the project root path
            backendDir: "backend/",
            frontendDir: "frontend/",
            s3Bucket: "", // S3 bucket name to deploy frontend to, will get the stage appended if available
            s3BucketName: "", // S3 exact bucket name to deploy frontend to
            profile: "", // profile to use (if no stage is given), as a synonym of stage for now
            stage: "", // stage to deploy to (both back and frontend), default is dev (set in default omega.json)
            stageBackend: "", // stage to deploy BACKEND to (overrides the generic stage)
            stageFrontend: "", // stage to deploy FRONTEND to (overrides the generic stage)
            deploy: { // deploy targets with a sequence of commands to execute
                back: "backend", // short for backend
                front: "frontend", // short for frontend
            },
            language: {}, // text/messages in the corresponding language
            environment: {}, // optional env vars, paths, etc. to be merged to the generated environment
            commands: {} // optional user defined commands (as a sequence)
        };
        this.defaults.templatesDir = this.defaults.omegaPath + this.defaults.templatesDir;
        this.defaults.templatesProjectsDir = this.defaults.templatesDir + this.defaults.projectTemplatesDir;
        this.defaults.pluginsDir = this.defaults.omegaPath + this.defaults.pluginsDir;

        this.conf = this.defaults;

        if (!("projectRootPath" in this.conf)) this.conf.projectRootPath = this.findProjectRoot();

        this.environment = {};
        this.loadConfiguration();
        this.loadLanguage();
    }
    isCommand(commandName)
    { // returns commandName if the command is an existing one, FALSE otherwise
        return ( (commandName in this) && (typeof this[commandName] === 'function') );
    }
    parseCommandLineArgs(argv, parseOptions)
    {
        this.argv = argv;
        if (!parseOptions) parseOptions={};
        this.parseOptions = parseOptions;
        this.params = parseArgs(argv.slice(2),parseOptions);

        return this.params;
    }
    isPath(path, permissions)
    { // validates a path, returns True if valid, error message (string) otherwise
        if (!permissions) permissions = fs.R_OK; // default is to check for read permissions
        try
        {
            fs.accessSync(path, permissions);
            return true;
        } catch (e) {
            return e.message;
        }
    }
    // logging
    log(msg)
    {
        console.log(msg);
    }
    // displays an error message screen
    error(msgId, msgText)
    {
        if (!msgId)
        {
            throw new Error("Reached error() with no error code defined!");
        }

        if (msgText)
            console.log("ERROR: #" + msgId + " - " + msgText);
        else
            console.log("ERROR: #" + msgId);
        process.exit(msgId); // terminate with failure code
    }

    // removes comments from a string (not fool proof, but will handle a lof of cases)
    removeComments(str) {
        return str.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '');
    }

    // loads JSON file, strips comments out of it
    loadJson(filePath)
    {
        var result = '';

        try
        {
            result = fs.readFileSync(filePath, 'utf8'); // read the file
            result = this.removeComments(result); // clean up / remove comments from it
        }
        catch (e)
        {
            result = ""; // invalid file
            this.log("Can NOT read from file "+filePath+".\n");
        }

        return result;
    }

    // loads configuration file
    loadConfiguration()
    {
        var conf;
        var confFile = "";

        // checks current path first, then project root path, finally Omega path, using F_OK to catch permission issues
        if (this.isPath(this.conf.workingPath + this.conf.jsonConfFileName,fs.F_OK) === true)
        {
            confFile = this.conf.workingPath + this.conf.jsonConfFileName;
        }
        else if (this.isPath(this.conf.projectRootPath + this.conf.jsonConfFileName,fs.F_OK) === true)
        {
            confFile = this.conf.projectRootPath + this.conf.jsonConfFileName;
        }
        else if (this.isPath(this.conf.omegaPath + this.conf.jsonConfFileName,fs.F_OK) === true)
        {
            confFile = this.conf.omegaPath + this.conf.jsonConfFileName;
        }

        if (confFile)
        {
            try
            {
                conf = JSON.parse(this.loadJson(confFile));
            }
            catch (e)
            {
                conf = ""; // invalid file
                this.log("Invalid or inaccessible configuration file "+confFile+", skipping it...\n");
            }
        }

        if (conf)
        {
            this.conf = this.mergeObjects(this.conf, conf);
            this.conf.confPath = confFile;
        }
    }

    // loads text/messages from the corresponding language file
    loadLanguage()
    {
        var language;
        var languagePath = "";

        // checks current path first, then Omega path, using F_OK to catch permission issues
        if (this.isPath(this.conf.workingPath + this.conf.languageFileName,fs.F_OK) === true)
        {
            languagePath = this.conf.workingPath + this.conf.languageFileName;
        }
        else if (this.isPath(this.conf.omegaPath + this.conf.languageFileName,fs.F_OK) === true)
        {
            languagePath = this.conf.omegaPath + this.conf.languageFileName;
        }

        if (languagePath)
        {
            try
            {
                language = JSON.parse(fs.readFileSync(languagePath, 'utf8'));
            }
            catch (e)
            {
                language = ""; // invalid file
                this.log("Invalid or inaccessible language file "+languagePath+", skipping it...\n");
            }
        }

        if (language)
        {
            this.log("Using language file: " +  languagePath);
            this.language = language;
        }
    }

    // loads environemnt file
    loadEnvironment()
    {
        var env;
        var envFile = "";

        if (this.isPath(this.conf.projectRootPath + this.conf.envFileName,fs.F_OK) === true)
        {
            envFile = this.conf.projectRootPath + this.conf.envFileName;
        }

        if (envFile)
        {
            try
            {
                let envSt = fs.readFileSync(envFile, 'utf8');
                envSt = envSt.substr(envSt.indexOf("{"));
                env = JSON.parse(envSt);
            }
            catch (e)
            {
                env = ""; // invalid file
                this.log("Invalid or inaccessible environment file "+envFile+", skipping it...\n");
            }
        }

        if (env)
        {
            this.environment = env;
            this.environment = this.mergeObjects(this.environment, this.conf.environment);
            this.log("Successfully processed environment vars from " + envFile);
        }
    }
    // saves environment file from environment object
    saveEnvironment()
    {
        var env = this.environment;
        var envFile = "";

        if (this.conf.projectRootPath)
        {
            if (this.isPath(this.conf.projectRootPath, fs.W_OK) === true)
            {
                envFile = this.conf.projectRootPath + this.conf.envFileName;
            }

            if (envFile) {
                try {
                    fs.writeFileSync(envFile, "module.exports = " + JSON.stringify(env), 'utf8');
                    this.log("Environment vars saved to " + envFile);
                }
                catch (e) {
                    this.log("Can NOT save the environment configuration file (details: " + e.toString() + ")");
                }
            }
            else
            {
                this.log("Can NOT save the environment configuration file (invalid or inaccessible environment path/file " + envFile + ")");
            }
        }
        else
        {
            this.log("Can NOT save the environment configuration file (no project root path located)");
        }
    }


    // processes (i.e. adds to conf) the passed params); allowedParams is an array with params allowed for processing
    processParams(params, allowedParams)
    {
        var readyToMergeParams = {};
        if (params)
        {
            if (allowedParams) {
                for (var key of allowedParams)
                    if (params.hasOwnProperty(key))
                        readyToMergeParams[key] = params[key];
            }
            else
                readyToMergeParams = params;
            this.conf = this.mergeObjects(this.conf, readyToMergeParams);
        }
    }

    // searches for the project root starting from the working (current) path and traversing up to /
    // returns the project root or false if not found
    findProjectRoot(startPath)
    {
        if (!startPath) startPath = this.conf.workingPath;

        if (this.isProjectRoot(startPath)) return startPath; // found

        var newPath = path.normalize(startPath+'../');
        if (startPath == newPath) return false; // not found

        return this.findProjectRoot(newPath);
    }
    // checks whether the given path is the project root one (must contain .omega/ dir)
    isProjectRoot(path)
    {
        return (this.isPath(path+this.conf.dotOmegaDir) == true);
    }

    getBackendPath()
    {
        return path.normalize(this.conf.projectRootPath + this.conf.backendDir);
    }

    getFrontendPath()
    {
        return path.normalize(this.conf.projectRootPath + this.conf.frontendDir);
    }

    // promisified CD backend path
    cdBackendPath()
    {
        var backendPath = this.getBackendPath();

        return new Promise( (resolve, reject) => {
                try {
                    process.chdir(backendPath);
                    return resolve();
                }
            catch (err)
            {
                this.log("\nCan NOT change to the backend folder");
                return reject();
            }
        });
    }

    // promisified CD frontend path
    cdFrontendPath()
    {
        var frontendPath = this.getFrontendPath();

        return new Promise( (resolve, reject) => {
                try {
                    process.chdir(frontendPath);
                    return resolve();
                }
                catch (err)
                {
                    this.log("\nCan NOT change to the frontend folder");
                    return reject();
                }
        });
    }


    // helper functions to attempt to detect various OSes
    isOsWin()
    {
      return (/^win/.test(process.platform));
    }
    isOsX()
    {
      return (process.platform === 'darwin');
    }
    isOsNix() // *nix OS
    {
      return (process.platform === 'linux');
    }

    // helper function to detect if the passed item is indeed an object, returns True if that is the case, False otherwise
    isObject(item)
    {
        return item === Object(item);
    }

    // helper function to detect if the passed obj is an empty one i.e. {}, returns True if that is the case, False otherwise
    isEmptyObject(obj)
    {
        return (Object.keys(obj).length === 0 && obj.constructor === Object)
    };

    // helper function to obtain the correct path separator based on the OS
    getPathSeparator()
    {
        if(this.isOsWin) return '\\';
        else if(this.isOsX  || this.isOsNix) return '/';
        
        return '/'; // default to *nix system
    }

    // helper to perform a deep merge of 2 objects, overwriting values on the first object
    // the result is in the first object
    mergeObjects(o1, o2)
    {
        for (var key in o2) {
            if (o2.hasOwnProperty(key)) { // the key does belong to object 2
                if ( o2[key].constructor==Object )
                { // the value is an object
                    if (!(key in o1))
                        o1[key] = {};
                    o1[key] = this.mergeObjects(o1[key], o2[key]);
                }
                else
                {
                    o1[key] = o2[key];
                }
            }
        }

        return o1;
    }

    // checks whether command is a command defined in the JSON config file
    isConfigCommand(command)
    {
        return this.config.commands.hasOwnProperty(command);
    }

    // promisified function to execute a shell command and capture the output
    // options could contain:
    // showCommand: True or False
    // showOutput: True or False
    execShell(cmd, options)
    {
        var showCommand = true;
        var showOutput = true;

        if ( (options) && (isObject(options)) )
        { // we have options object passed
            if (options.hasOwnProperty("showCommand")) showCommand = options.showCommand;
            if (options.hasOwnProperty("showOutput")) showOutput = options.showOutput;
        }

        if (showCommand) {
            console.log("#", cmd); // display the command to execute
        }

        return new Promise( (resolve, reject) => {
                var childProcess = child.exec(cmd, {stdio: "inherit"}, function (err, stdout, stderr) {

                    if (err)
                        return reject(err);

                    if (stderr)
                        return reject(stderr);

                    resolve(stdout);
                });
                if (showOutput) {
                    childProcess.stdout.on('data', function (data) {
                            process.stdout.write(data);
                    });
                }
        });
    } // end execShell

    // promisified function to execute a sequence of commands
    // commands is either an array of strings with commands or a single string (for a single command)
    // options could contain:
    // showCommand: True or False
    // showOutput: True or False
    execCommandSequence(commands, options)
    {
        if (!Array.isArray(commands)) commands = [commands];

        var promiseFactories = [];
        for (let cmd of commands)
        {
            if (cmd)
            {
                promiseFactories.push( () => this.execShell(cmd, options) );
            }
            else {
                promiseFactories.push( () => True ); // no command, just return True
            }
        }

        var sequence = Promise.resolve();
        promiseFactories.forEach(function (promiseFactory) {
            sequence = sequence.then(promiseFactory);
        });

        return sequence;
    }


    } // end Base class


module.exports = Base;