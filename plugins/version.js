/**
 * Created by J.Ivanov on 1/9/19.
 *
 * Displays the version number
 *
 */

'use strict';

var Plugin = require('./../lib/plugin.js');

// class to version command
module.exports = class Version extends Plugin
{
    constructor(argv)
    {
        var parseOptions = {};
        super(argv, parseOptions);
    }

    help()
    {
    }
}
