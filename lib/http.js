var _ = require('lodash');
var express = require('express');

var runStack = require('./run-stack');

/**
 * initialize an api instance
 */
var HttpHandler = module.exports = function(api){

	function handler(req, res, next){
		return handler._router(req, res, next);
	}

	handler.__proto__ = HttpHandler;
	handler.api = api;
	handler._router = express.Router();

	handler._middlewareStacks = {};
	
	return handler;
};

HttpHandler.use = function(route, fn, priority){
	var self = this;

	if(typeof route === 'function'){
		priority = fn;
		fn = route;
		route = undefined;
	}

	if(!fn || typeof fn !== 'function'){
		throw new Error('expecting middleware function');
	}

	route = route || '';
	priority = priority || 0;

	var stack = self._middlewareStacks[route] || [];
	stack.push({priority:priority, route:route, fn: fn});
	self._middlewareStacks[route] = _.sortBy(stack, 'priority');
};

HttpHandler.mapCommand = function(operation, runCommand){
	var self = this;

	if(!operation.http || !operation.http.uri){
		return;
	}
	//translate the url template to express routepath by changing {paramName} to :paramName
	var routePath = operation.http.uri;
	_.forEach(routePath.match(/\{\w+\}/g), function(p){
		routePath = routePath.replace(p, p.replace('{', ':').replace('}', ''));
	});
	operation.http.routePath = routePath;

	self._router[operation.http.method](
		routePath,
		function(req, res, next){
			req.operation = operation;
			req.command = self._makeHttpCommand(req, res, operation);

			var stack = self._middlewareStacks[''] || [];
			stack = stack.concat(self._middlewareStacks[operation.name]||[]);

			runStack(stack, req, res, next);
		},
		function(req, res, next){
			var command = self._makeHttpCommand(req, res, operation);
			self.api.runCommand(command, function(err, response, metaResponse){
				if(err){
					err.errorId = err.errorId || 500;
					next(err);
				}

				metaResponse = metaResponse || {};
				metaResponse.http = metaResponse.http || {};

				var headers = metaResponse.http.headers ||{};
				var status = metaResponse.http.status || metaResponse.status || 200;

				var negotiation = _.extend({
					'default': function(){
						res.send(response);
					}
				}, _.mapValues(_.extend(req.negotiation || {}, metaResponse.http.negotiation||{}), function makeFormatter(f){
					return function(){
						if(typeof f === 'function'){
							f(res, response, status, headers);
						}
						else{
							return res.send(f);
						}
					};
				}));

				res.status(status).set(headers || {});

				if(Object.keys(negotiation).length > 1 && req.headers.accept){
					res.format(negotiation);
				}
				else{
					negotiation.default();
				}
			});
		}
	);
};

HttpHandler._makeHttpCommand = function(req, res, operation){
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
		id: operation.name,
		operation: operation,
		params: params,
		http: {
			req:req,
			res: res
		}
	};

	return command;
};