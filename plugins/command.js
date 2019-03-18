/**
 * Created by J.Ivanov on 11/25/16.
 */

'use strict';

var Plugin = require('./../lib/plugin.js');

// class to handle/execute config commands (defined in the config file)
module.exports = class Command extends Plugin
{
    constructor(argv)
    {
        var parseOptions = {};
        super(argv, parseOptions);
    }
}
