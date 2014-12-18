var debug = require('debug')('api-synth');
var _ = require('lodash');
var express =  require('express');
var hooks = require('phased-hooks');

exports.strategies = {
	swagger: require('./lib/swagger')
};

function hookDispatcher(hooks){
	return function dispatchAsHook(command, cb){
		debug('%s executing', command.id, command.params);

		hooks.execute(command.id, [command], {}, function(err, data, exdata){
			debug('%s done', command.id, err, data, exdata);
			if(err){
				err.errorId = err.errorId || 500;
				cb(err, err.errorId);
			}
			else{
				data = data || {};
				exdata = exdata || {};
				var status = exdata.status || 200;
				var headers = exdata.http;
				//var formatters
				cb(null, status, data, headers, exdata.negotiate);
			}
		});
	};
}

exports.useSpec =
exports.useSpecs = function(specType, options, dispatch){
	var router = express.Router();
	return exports.putSpecs(router, specType, options, dispatch);
};

exports.putSpec =
exports.putSpecs = function(router, specType, options, dispatch){
	var strategy = this.strategies[specType];
	dispatch = dispatch || hookDispatcher(hooks);

	if(!strategy){
		throw new Error( specType + ' is not a supported specification type');
	}

	router.hooks = hooks;

	strategy(options, function(verb, routePath, commandFn){
		router[verb](routePath, function(req, res, next){
			var command = _.extend({
				http: {
					req:req,
					res: res
				}
			}, commandFn(req));

			debug('calling %s for %s %s', command.id, verb, routePath);
			
			if(!command.id){
				var err = new Error('Commands should have id properties');
				err.errorId = 500;
				return next(err);
			}
			
			dispatch(command, function (err, status, body, headers, negotiate){
				if(err){
					next(err);
				}
				else{
					negotiate = _.extend({
						'default': function(){
							res.send(body);
						}
					}, _.mapValues(_.extend(req.negotiate || {}, negotiate||{}), function makeFormatter(f){
						return function(){
							if(typeof f === 'function'){
								f(res, body, status, headers);
							}
							else{
								return res.send(f);
							}
						};
					}));

					res.status(status).set(headers || {});

					if(Object.keys(negotiate).length > 1 && req.headers.accept){
						res.format(negotiate);
					}
					else{
						negotiate.default();
					}
				}
			});
		});
	});

	return router;
};

exports.hooks = hooks;