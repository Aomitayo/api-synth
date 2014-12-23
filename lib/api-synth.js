'use strict';

var debug= require('debug');
var _ = require('lodash');
var httpHandler = require('./http');
var hooks = require('phased-hooks');

/**
 * initialize an api instance
 */
function ApiSynth(){

	this.http = httpHandler(this);
	this.hooks = hooks;
	this._operations = {};
}

ApiSynth.prototype.useSpec = function(strategy, options, callback){
	var self = this;
	//parse spec;
	this.specStrategies[strategy](options, function(err, operations){
		//merge spec
		_.forEach(operations, function(operation, key){
			if(_.isUndefined(self._operations[key])){
				if(operation.http && operation.http.uri){
					self.http.mapCommand(operation, self._runCommand);
				}
				self._operations[operation.name] = operation;
			}
			else{
				throw new Error( key + ' is already defined');
			}
		});
		(callback || _.noop)();
	});
};

ApiSynth.prototype.specStrategies = {
	swagger: require('./swagger')
};

ApiSynth.prototype.runCommand = function(command, callback){
	debug('%s executing', command.id, command.params);

	hooks.execute(command.id, [command], {}, callback);
};

module.exports = function(){
	return new ApiSynth();
};
