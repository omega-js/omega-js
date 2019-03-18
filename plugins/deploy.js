/**
 * Created by J.Ivanov on 11/26/16.
 */

'use strict';

var fs = require('fs-extra');
var Plugin = require('./../lib/plugin.js');

module.exports = class Deploy extends Plugin
{
    constructor(argv)
    {
        var parseOptions = {};
        super(argv, parseOptions);

        this.loadEnvironment();

        this.baseUrl = "";
        this.endpoints = [];
        this.apiKeys = [];

        if (!this.conf.projectRootPath)
        {
            this.error(301, 'Can NOT locate the project root path. Please make sure you are within a project folder.');
        }
    }

// omg deploy all - both front and backend
// omg deploy frontend
// omg deploy backend
// omg deploy project = deploy all
// delayed deploy?
    isCommand(commandName)
    {
        // if command exists in deploy i.e. target then add a method to the object dynamically for that target
        if (this.conf.deploy.hasOwnProperty(commandName))
        { // found deployment target in the CONF params
            this[commandName] = this.deployTarget.bind(this, this.conf.deploy[commandName]); // create a method for that target within this context
            return true; // return that it is a valid command
        }

        return super.isCommand(commandName);
    }

    deployTarget(target, params)
    { // deploys a particular target
        var result = {
            success: false, // whether the deployment was successful
            output: [], // array with stdout of every command (including errors if any)
            error: null // last error object if any
        };

        // add passed command line params
        this.processParams(params,['profile', 'stage']);

        //console.log("Deploy.deployTarget("+JSON.stringify(target)+"), params= ", params);

        if (!Array.isArray(target)) target = [target];

        /*else if( (typeof A === "object") && (A !== null) )
         it is an object, so it likely contains profiles/environments
         or just use various targets as environments like backend_dev, backend_staging, etc.
         */

        var promiseFactories = [];
        for (let cmd of target)
        {
            //console.log("cmd= "+cmd);
            if (this.isCommand(cmd))
            {
                promiseFactories.push( () => this[cmd](params) );
            }
            else {
                promiseFactories.push( () => this.execShell(cmd) );
            }
        }

        var sequence = Promise.resolve();
        promiseFactories.forEach(function (promiseFactory) {
            sequence = sequence.then(promiseFactory).then((stdout) => result.output.push(stdout));
        });

        // now finalize
        sequence = sequence.then( () => {
                result.success = true;
                return result;
            });

        // add errors handling
        sequence = sequence.catch((err) => {
                                    result.error = err;
                                    console.log(err.toString());
                                    this.error(300, "Deployment sequence failed, deployment NOT completed");
                            });


        return sequence;
    }
    
    extractApiKeys(data)
    { // extracts from data string and returns an array with API keys;
        // for sls they are found between "api keys:" and "endpoints:"
        var result = [];
        var marker1 = "api keys:";
        var marker2 = "endpoints:";

        if (typeof data === 'string' || data instanceof String) {
            var p1 = data.indexOf(marker1);
            var p2 = data.indexOf(marker2);

            if ((p1 >= 0 ) && (p2 >= 0)) {
                var s = data.substring(p1 + marker1.length + 1, p2).trim();
                if (s != "None")
                {
                    result = s.split("\n");
                }
            }
        }

        return result;
    }

    extractAllEndpoints(data)
    { // extracts from data string and returns an array with the endpoints
        // for sls they are found between "endpoints:" and "functions:"
        var result = [];
        var marker1 = "endpoints:";
        var marker2 = "functions:";

        if (typeof data === 'string' || data instanceof String) {
            var p1 = data.indexOf(marker1);
            var p2 = data.indexOf(marker2);

            if ((p1 >= 0 ) && (p2 >= 0)) {
                var s = data.substring(p1 + marker1.length + 1, p2).trim();
                if (s != "None")
                {
                    result = s.split("\n");
                }
            }
        }

        return result;
    }
    extractServiceEndpoint(data)
    { // extracts from data string and returns the main service endpoint (base URL)
        // for sls they are found between "endpoints:" and "functions:"
        this.baseUrl = "";
        var marker1 = "ServiceEndpoint:";
        var marker2 = "\n";

        if (typeof data === 'string' || data instanceof String) {
            var p1 = data.indexOf(marker1);

            if (p1 >= 0) {
                var p2 = data.indexOf(marker2,p1);

                if (p2 >= 0) {
                    var s = data.substring(p1 + marker1.length + 1, p2).trim();
                    if (s) this.baseUrl = s;
                }
            }
        }

        return this.baseUrl;
    }

    backend()
    { // deploys backend
        console.log("\nBACKEND: Deployment started\n");
        // - cd to backend
        // sls deploy -v or sls deploy

        var result = false;
        var response;
        var backendPath = this.getBackendPath();
        var envName = "default"; // default env name

        // retrieve stage name - cmd line param first, then stageFrontend, then stage, finally profile (default)
        var stage = (this.params._.length >= 3 ? stage = this.params._[2] : null) || this.conf.stageBackend || this.conf.stage || this.conf.profile;
        if (stage.length > 0)
        {
            envName = stage;
            stage = " --stage=" + stage;
        } // add stage to the deploy command
        else
        {
            stage = "";
            envName = "default";
        }

        var target = ["serverless deploy -v" +  stage];

        return Promise.resolve()
            .then( () => this.cdBackendPath())
            .then( () => this.deployTarget(target, this.params))
            .then( (response) => {
                // deployment succeded, now extract the endpoints
                var apiKeys = this.extractApiKeys(response.output[0]);
                var endpoints = this.extractAllEndpoints(response.output[0]);
                this.extractServiceEndpoint(response.output[0]);

                console.log("\nBACKEND: Deployment completed successfully!\n");

                if (!this.environment.hasOwnProperty(envName)) this.environment[envName] = {}; // add the env if it is not already there
                this.environment[envName].baseUrl = this.baseUrl;
                if (apiKeys.length > 0) this.environment[envName].apiKey = apiKeys[0];
                else this.environment[envName].apiKey = "";

                this.saveEnvironment();

                return response;
            })
            .catch( (err) => {
                this.error(302, "BACKEND: Deployment failed!\n");
            });
    }

    frontend()
    { // deploys frontend
        console.log("\nFRONTEND: Deployment started\n");
        // cd to frontend & au build & sync s3
        // make sure each of the commands works before executing the next one
        var result = false;
        var response;
        var frontendPath = this.getFrontendPath();

        // retrieve stage name - cmd line param first, then stageFrontend, then stage, finally profile (default)
        var stage = (this.params._.length >= 3 ? stage = this.params._[2] : null) || this.conf.stageFrontend || this.conf.stage || this.conf.profile; // cmd line param first, then stageFrontend, then stage, finally profile (default)
        var s3name = this.conf.s3BucketName;

        if (!s3name)
        {
            if ( (this.conf.s3Bucket) && (stage) )
            {
                s3name = this.conf.s3Bucket + stage;
            }
        }

        var target = [
            "au build" + (stage.length > 0 ? " --env=" + stage : ""),
            "aws --profile " + stage + " s3 sync scripts s3://" + s3name + "/scripts/",
            "aws --profile " + stage + " s3 cp index.html s3://" + s3name
        ];

        return Promise.resolve()
                .then( () => {

                if (!stage)
                {
                    let err = "\nPlease set up a valid stage in the Omega configuration file";
                    console.log(err);
                    throw err;
                }
                if (!s3name)
                {
                    let err = "\nPlease set up a valid S3 bucket in the Omega configuration file";
                    console.log(err);
                    throw err;
                }

                return this.cdFrontendPath();
            })
            .then( () => this.deployTarget(target, this.params))
            .then( (response) => {
                console.log("\n\nYour application has been deployed to:");
                console.log("http://" + s3name + ".s3-website-us-east-1.amazonaws.com/\n");
                console.log("\nFRONTEND: Deployment completed successfully!\n");
                return response;
            })
            .catch( (err) => {
                console.error(303, "FRONTEND: Deployment failed!\n");
            });
    }

    project()
    { // deploys full project i.e. all targets
        //console.log("Deploy.project, params= ", this.params);
        return this.all();
    }

    all()
    { // deploys all i.e. all targets
        //console.log("Deploy.all, params= ", this.params);
        
        var target = ["backend", "frontend"];
        
        return this.deployTarget(target, this.params);
    }
        
}
