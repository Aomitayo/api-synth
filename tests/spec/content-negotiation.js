'use strict';

/*global describe, it, before */

var fs = require('fs');
var expect = require('chai').expect;
var supertest = require('supertest');
var apiSynth = require(__dirname + '/../../');

var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var multipart = require('connect-multiparty');

describe('Without Content negotiation', function(){
	var app;
	var api;
	before(function(done){
		api = apiSynth();
		api.useSpec('swagger', {specDir: __dirname + '/../fixtures/swagger'}, done);
	});

	before(function(){
		api.hooks.register('sayHello', function(command, cb){
			cb(null, 'hello world', {
				status:200
			});
		});

		app = require('express')();
		app.use(bodyParser.urlencoded({extended:true}));
		app.use(bodyParser.json({type:['*/json']}));
		app.use(multipart());
		app.use(cookieParser());
		app.use(api.http);
	});	

	it('Return result from hook', function(done){
		supertest(app)
		.get('/hello')
		.expect(200)
		.end(function(err, res){
			expect(res.text).to.equal('hello world');
			done(err);
		});
	});
});

describe('Content negotiation at rest end point', function(){
	var app;
	var api;
	
	before(function(done){
		api = apiSynth();
		api.useSpec('swagger', {specDir: __dirname + '/../fixtures/swagger'}, done);
	});

	before(function(){
		api.hooks.register('sayHello', function(command, cb){
			cb(null, 'hello world', { http:{
				status:200,
				negotiation:{
					'application/html5': 'hello world html',
					'application/json':{resources: 'hello world property'},
					'application/vnd.rest-spec': function(res, body, status, headers){
						res.send(body + ' function');
					}
				}
			}});
		});

		app = require('express')();
		app.use(bodyParser.urlencoded({extended:true}));
		app.use(bodyParser.json({type:['*/json']}));
		app.use(multipart());
		app.use(cookieParser());
		app.use(api.http);
	});	

	it('Will return result from hook by default', function(done){
		supertest(app)
		.get('/hello')
		.expect(200)
		.end(function(err, res){
			expect(res.text).to.equal('hello world');
			done(err);
		});
	});

	it('Will use appropriate format when given recognized accept header', function(done){
		supertest(app)
		.get('/hello')
		.set({'Accept':'application/html5'})
		.expect(200)
		.end(function(err, res){
			expect(res.text).to.equal('hello world html');
			done(err);
		});
	});

	it('Will return json when format is mapped to an object', function(done){
		supertest(app)
		.get('/hello')
		.set({'Accept':'application/json'})
		.expect(200)
		.end(function(err, res){
			expect(res.body).to.have.property('resources', 'hello world property');
			done(err);
		});
	});


	it('Will call formatter function when format is mapped to a function', function(done){
		supertest(app)
		.get('/hello')
		.set({'Accept':'application/vnd.rest-spec'})
		.expect(200)
		.end(function(err, res){
			expect(res.text).to.equal('hello world function');
			done(err);
		});
	});
});

describe('Content negotiation by middleware', function(){
	var app;
	var api;
	
	before(function(done){
		api = apiSynth();
		api.useSpec('swagger', {specDir: __dirname + '/../fixtures/swagger'}, done);
	});

	before(function(){
		api.http.use(function negotiator(req, res, next){
			req.negotiation = {
				'application/html5': 'hello world html',
				'application/json':{resources: 'hello world property'},
				'application/vnd.rest-spec': function(res, body, status, headers){
					res.send(body + ' function');
				}
			};

			next();
		});
		

		api.hooks.register('sayHello', function(command, cb){
			cb(null, 'hello world', {status:200});
		});

		app = require('express')();
		app.use(bodyParser.urlencoded({extended:true}));
		app.use(bodyParser.json({type:['*/json']}));
		app.use(multipart());
		app.use(cookieParser());
		app.use(api.http);
	});	

	it('Will return result from hook by default', function(done){
		supertest(app)
		.get('/hello')
		.expect(200)
		.end(function(err, res){
			expect(res.text).to.equal('hello world');
			done(err);
		});
	});

	it('Will use appropriate format when given recognized accept header', function(done){
		supertest(app)
		.get('/hello')
		.set({'Accept':'application/html5'})
		.expect(200)
		.end(function(err, res){
			expect(res.text).to.equal('hello world html');
			done(err);
		});
	});

	it('Will return json when format is mapped to an object', function(done){
		supertest(app)
		.get('/hello')
		.set({'Accept':'application/json'})
		.expect(200)
		.end(function(err, res){
			expect(res.body).to.have.property('resources', 'hello world property');
			done(err);
		});
	});


	it('Will call formatter function when format is mapped to a function', function(done){
		supertest(app)
		.get('/hello')
		.set({'Accept':'application/vnd.rest-spec'})
		.expect(200)
		.end(function(err, res){
			expect(res.text).to.equal('hello world function');
			done(err);
		});
	});
});