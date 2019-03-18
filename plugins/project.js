/**
 * Created by J.Ivanov on 11/25/16.
 */

'use strict';

var fs = require('fs-extra');
var Plugin = require('./../lib/plugin.js');
var path = require('path');

module.exports = class Project extends Plugin
{
    constructor(argv)
    {
        var parseOptions = {};
        parseOptions.alias = {
            'template' : ['t', 'fromtemplate', 'from-template', 'templatefrom', 'template-from', 'temlate'], // aliases for --template=
            'templatePath' : ['templatepath', 'template-path', 'template-dir', 'templatedir', 'template-folder', 'templatefolder'], // aliases for --templatepath=
            'projectPath' : ['projectpath', 'project-path', 'project-dir', 'projectdir', 'project-folder', 'projectfolder'], // aliases for --projectpath=
        };
        super(argv, parseOptions);
    }

// omg project create project_folder (optional) -
// omg project create project_folder -t=template_name
// omg project create project_folder --template=template_name
// omg project create project_folder --template_path=template_path
// same but with from-template and from_template and fromtemplate
// need template, project name? project folder
    create()
    {
        //console.log("Project.create, params= ", this.params);

        console.log("Current workind dir = "+process.cwd());

        var projectName = this.params[0];
        var templatePath = this.getTemplatePath();
        var projectPath = this.getProjectPath();

        //console.log("projectPath= ", projectPath);

        //console.log("projectPath normalized= ", path.normalize(projectPath));

        if (templatePath && projectPath)
        {
            this.log('Setting up your new project.');

            var intervalId = setInterval(function() { process.stdout.write('.'); }, 800);

            // copies the template into the new project
            return fs.copy(templatePath, projectPath)
                .then(() => {
                    clearInterval(intervalId);
                    process.stdout.write('done!\n');
                    this.log("Success - project created!")
                })
                .catch((err) => {
                    clearInterval(intervalId);
                    this.log(err.toString());
                });
        }
        else
        {
            console.error("ERROR: Can NOT create a new project - invalid parameters. Please make sure you properly specify template and project path!")
        }
    }

    remove()
    {
        console.log("Project.remove, params= ", this.params);
    }

    init()
    { // inits a new project based on existing folder structure
        console.log("Project.init, params= ", this.params);
    }

    install()
    { // installs dependencies
        if (this.params._.length <= 2)
        { // no param specified, execute both
            return this.installFrontend()
                .then( () => installBackend());
        }
        else if (this.params._[2] == "backend")
        {
            return this.installBackend();
        }
        else if (this.params._[2] == "frontend")
        {
            return this.installFrontend();
        }
        else
        {
            this.error(201, "Can NOT identify target to install dependencies for!\n");
        }
    }

    push()
    { // git add -u + git commit -m "" + git push origin branch_name (remember branch name)
        console.log("Project.push, params= ", this.params);
    }

    deploy()
    { // that is omg deploy all (i.e. both front and backend)
        console.log("Project.deploy, params= ", this.params);
    }

    getTemplatePath()
    {
        var template = '';
        var templatePath = '';

        if (this.params.templatePath) templatePath = this.params.templatePath; // explicitly entered via param
        else if (this.params.template) template = this.params.template; // explicitly entered via param
        // else if // found in conf file
        // else if // found a default template, should I ask for confirmation?
        else
        { // none found, therefore ask for it

        }

        if (template)
        { // template found, compose to templatePath
            templatePath = this.conf.templatesProjectsDir + template;
        }

        // validate template path
        if (templatePath)
        {
            if (this.isPath(templatePath) !== true)
            {
                console.log('ERROR: Invalid template');
                templatePath='';
            }
        }
        else
        {
            console.log('ERROR: no template found');
            templatePath='';
        }

        return templatePath
    }

    getProjectPath()
    {
        var projectPath = '';

        if (this.params.projectPath) projectPath = this.params.projectPath; // explicitly entered via param
        else if (this.params._[2]) projectPath = this.params._[2]; // implicitly entered as the 3 arg
        // else if // found in conf file
        else
        { // none found, therefore ask for it

        }

        return projectPath;
    }

    // installs project dependencies for the backend
    installBackend()
    {
        this.log("\nBACKEND: Project dependencies - install started\n");

        var result = false;
        var response;

        return this.cdBackendPath()
                .then( () => this.execShell("npm install"))
                .then( () => this.log("\nBACKEND: Project dependencies installed successfully!\n"))
                .catch( (err) => {
                    console.log(err);
                    this.error(202, "BACKEND: Installing project dependencies FAILED!\n");
                });
    }

    // installs project dependencies for the frontend
    installFrontend()
    {
        this.log("\nFRONTEND: Project dependencies - install started\n");

        var result = false;
        var response;

        return this.cdFrontendPath()
                .then( () => this.execShell("npm install"))
                .then( () => this.log("\nFRONTEND: Project dependencies installed successfully!\n"))
                .catch( (err) => {
                    this.log(err); // log the error
                    this.error(203, "FRONTEND: Installing project dependencies FAILED!\n");
            });
    }
}
