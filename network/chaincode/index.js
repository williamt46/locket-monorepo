'use strict';

const IntegrityContract = require('./lib/integrityContract');
const ConInSeContract = require('./lib/consentContract');

module.exports.IntegrityContract = IntegrityContract;
module.exports.ConInSeContract = ConInSeContract;
module.exports.contracts = [ IntegrityContract, ConInSeContract ];
