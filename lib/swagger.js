var debug = require('debug')('api-synth:swagger');
var _ = require('lodash');
var path = require('path');
var fs = require('fs');

function readFromDirectory(specDir){
	debug('reading spec', specDir);
	if(typeof specDir === 'object'){
		return specDir;
	}

	if(!fs.existsSync(specDir)){
		throw new Error(specDir + ' Does not exist');
	}

	var resourceListing = JSON.parse(fs.readFileSync(path.join(specDir, '_resources.json'), 'utf8'));
	var resourceSpecs = {};
	fs.readdirSync(specDir, function(){}).forEach(function(fname){
		if('_resources.json' === fname || !/\.json$/.test(fname)){return;}
		var fpath = path.join(specDir, fname);
		var fStats = fs.statSync(fpath);
		if(!fStats.isFile()){return;}
		try{
			var key = fname.replace(/\.json$/,'');
			resourceSpecs[key] = JSON.parse(fs.readFileSync(fpath, 'utf8'));
		}
		catch(ex){
			debug('Failed to load api description %s', fpath);
			debug(ex.stack);
		}
	});
	
	return {resourceListing: resourceListing, resourceSpecs:resourceSpecs};
}

module.exports = function(options, callback){
	var specs = options.specDir? readFromDirectory(options.specDir) : options.specs || {};

	//var resourceListing = specs.resourceListing;
	var resourceSpecs = specs.resourceSpecs;

	debug('Putting resource routes');

	var apiOperations = {};

	_.forEach(resourceSpecs, function(spec){
		_.forEach(spec.apis, function(apiSpec){
			_.forEach(apiSpec.operations, function(operation){
				apiOperations[operation.nickname] = {
					name: operation.nickname,
					parameters: operation.parameters,
					authorizationScheme:[],
					http:{
						method: operation.method.toLowerCase(),
						uri: path.join(spec.basePath, apiSpec.path || '')
					}
				};
			});
		});
	});
	
	callback(null, apiOperations);
};