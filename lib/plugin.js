/**
 * Created by J.Ivanov on 11/25/16.
 */

'use strict';

var Base = require('./base.js');

// base class for all plugins/entities
module.exports = class Plugin extends Base
{
    constructor(argv, parseOptions)
    {
        super();
        this.parseCommandLineArgs(argv, parseOptions);
    }

    help()
    { // default help method
        this.error(12, "Method/command not part of the plugin!");
    }
    //executeBefore

    //executeAfter
}
