'use strict';

/*global describe, it, before */

var fs = require('fs');
var expect = require('chai').expect;
var supertest = require('supertest');
var routing = require(__dirname + '/../../');

var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var multipart = require('connect-multiparty');

describe('rest spec routing', function(){
	it('Creates routes from swagger spec', function(){
		var router = routing.useSpec('swagger', {specDir: __dirname + '/../fixtures/swagger'});
		expect(router.stack).to.have.length(5);
	});
});

describe('rest spec commands and callbacks', function(){
	var app;
	before(function(){
		var router = routing.useSpec('swagger', {specDir: __dirname + '/../fixtures/swagger'});

		router.hooks.register('sayHello', function(command, cb){
			cb(null, 'hello world', {status:200});
		});

		router.hooks.register('helloPerson', function(command, cb){
			cb(null, 'hello ' + command.params.person);
		});

		router.hooks.register('helloPersonData', function(command, cb){
			if(command.params.hellodata){
				cb(null, 'hello ' + fs.readFileSync(command.params.hellodata.path, 'utf8'));
			}
			else{
				cb(null, {error:'Invalid data'}, {status:400});
			}
		});

		app = require('express')();
		app.use(bodyParser.urlencoded({extended:true}));
		app.use(bodyParser.json({type:['*/json']}));
		app.use(multipart());
		app.use(cookieParser());
		app.use(router);
	});	

	it('Routes http actions', function(done){
		supertest(app)
		.get('/hello')
		.expect(200)
		.end(function(err, res){
			expect(res.text).to.equal('hello world');
			done(err);
		});
	});

	it('routes http path parameters', function(done){
		supertest(app)
		.get('/hello/john')
		.expect(200)
		.end(function(err, res){
			expect(res.text).to.equal('hello john');
			done(err);
		});
	});

	it('routes http file parameters', function(done){
		supertest(app)
		.post('/hello/john')
		.attach('hellodata', __dirname +'/../fixtures/textfile.txt')
		.expect(200)
		.end(function(err, res){
			expect(res.text).to.equal('hello john with data');
			done(err);
		});
	});
	it('routes http file parameters to undefined', function(done){
		supertest(app)
		.post('/hello/john')
		.expect(400)
		.end(function(err, res){
			expect(res.body.error).to.equal('Invalid data');
			done(err);
		});
	});
});