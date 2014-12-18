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

	var resourceListing = specs.resourceListing;
	var resourceSpecs = specs.resourceSpecs;

	debug('Putting resource routes');

	_.forEach(resourceSpecs, function(spec){
		_.forEach(spec.apis, function(apiSpec){
			_.forEach(apiSpec.operations, function(operation){
				var verb = operation.method.toLowerCase();
				var routePath = path.join(spec.basePath, apiSpec.path || '');
				
				//translate the url template by changing {paramName} to :paramName
				_.forEach(routePath.match(/\{\w+\}/g), function(p){
					routePath = routePath.replace(p, p.replace('{', ':').replace('}', ''));
				});
				
				debug('Routing %s %s to %s', verb, routePath, operation.nickname);
				
				callback(verb, routePath, function(req){
					var params = {};
					_.forEach(operation.parameters, function(p){
						if(p.paramType === 'path'){
							params[p.name] = req.params[p.name];
						}
						else if(p.paramType === 'query'){
							params[p.name] = req.query[p.name];
						}
						else if(p.paramType === 'header'){
							params[p.name] = req.header(p.name);
						}
						else if(p.paramType === 'form'){
							params[p.name] = req.body[p.name];
						}
						else if(p.paramType === 'body'){
							params.body = req.body;
						}
						else if(p.paramType === 'file'){
							params[p.name] = (req.files||{})[p.name];
						}
					});

					var command = {
						id: operation.nickname,
						specType: 'swagger',
						resourceListing: resourceListing,
						resourceSpecs:resourceSpecs,
						params: params
					};

					return command;
				});
			});
		});
	});
};