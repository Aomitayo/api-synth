'use strict';

/* global describe, it, before, beforeEach */

var _ = require('lodash');
var fs = require('fs');
var expect = require('chai').expect;
var supertest = require('supertest');
var sinon = require('sinon');
var sinonChai =  require('sinon-chai');
var chai = require('chai');
chai.use(sinonChai);
var apiSynth = require(__dirname + '/../../');

var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var multipart = require('connect-multiparty');

describe('Rest API synth', function(){
	it('Creates unique instances', function(){
		var api1 = apiSynth();
		var api2 = apiSynth();
		expect(api1).to.not.equal(api2);
	});

	describe('For Swagger 1.2 spec', function(){
		var api;
		before(function(done){
			api = apiSynth();
			api.useSpec('swagger', {specDir: __dirname + '/../fixtures/swagger'}, done);
		});

		it('Identifies Specified Operations', function(){
			expect(_.keys(api._operations)).to.have.length(5);
		});
	});
});

describe('Api-synth middleware system', function(){
	var app;
	var api;

	beforeEach(function(done){
		api = apiSynth();
		api.useSpec('swagger', {specDir: __dirname + '/../fixtures/swagger'}, done);
	});

	beforeEach(function(){
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

	it('Api has connect middleware as a property', function(){
		var api = apiSynth();
		expect(api.http).to.be.a('function');
		expect(api.http).to.have.length(3);
	});

	
	it('Can insert and use global http middleware', function(done){
		var stub = sinon.stub().callsArgWith(2, null, {});
		api.http.use(stub);
		expect(api.http._middlewareStacks['']).to.have.length(1);

		supertest(app)
		.get('/hello')
		.expect(200)
		.end(function(err, res){
			expect(res.text).to.equal('hello world');
			expect(stub).to.have.been.calledOnce;
			done(err);
		});
	});

	it('Can insert operation-specific http middleware', function(done){
		var stub = sinon.stub().callsArgWith(2, null, {});
		api.http.use('sayHello', stub);
		expect(api.http._middlewareStacks['sayHello']).to.have.length(1);

		supertest(app)
		.get('/hello')
		.expect(200)
		.end(function(err, res){
			expect(res.text).to.equal('hello world');
			expect(stub).to.have.been.calledOnce;
			done(err);
		});
	});

	it('Can insert both global and operation-specific http middleware', function(done){
		var stubGobal = sinon.stub().callsArgWith(2, null, {});
		var stubOperation = sinon.stub().callsArgWith(2, null, {});

		api.http.use(stubGobal);
		api.http.use('sayHello', stubOperation);

		supertest(app)
		.get('/hello')
		.expect(200)
		.end(function(err, res){
			expect(res.text).to.equal('hello world');
			expect(stubGobal).to.have.been.calledOnce;
			expect(stubOperation).to.have.been.calledOnce;
			done(err);
		});
	});

	it('Middleware can access operation', function(done){
		var stub = sinon.stub().callsArgWith(2, null, {});
		api.http.use('sayHello', stub);

		supertest(app)
		.get('/hello')
		.expect(200)
		.end(function(err, res){
			expect(res.text).to.equal('hello world');
			expect(stub).to.have.been.calledOnce;
			expect(stub.args[0][0]).to.have.property('operation');
			done(err);
		});
	});

	it('Middleware can access operation authorization specifications', function(done){
		var stub = sinon.stub().callsArgWith(2, null, {});
		api.http.use('sayHello', stub);

		supertest(app)
		.get('/hello')
		.expect(200)
		.end(function(err, res){
			expect(res.text).to.equal('hello world');
			expect(stub).to.have.been.calledOnce;
			expect(stub.args[0][0]).to.have.property('operation');
			expect(stub.args[0][0].operation).to.have.property('authRestrictions');
			expect(stub.args[0][0].operation.authRestrictions).to.have.length(1);
			expect(stub.args[0][0].operation.authRestrictions[0]).to.have.property('type', 'oauth2');
			done(err);
		});
	});
});

describe('rest spec commands and callbacks', function(){
	var app;
	var api;
	before(function(done){
		api = apiSynth();
		api.useSpec('swagger', {specDir: __dirname + '/../fixtures/swagger'}, done);
	});

	before(function(){
		api.hooks.register('sayHello', function(command, cb){
			cb(null, 'hello world', {status:200});
		});

		api.hooks.register('helloPerson', function(command, cb){
			cb(null, 'hello ' + command.params.person);
		});

		api.hooks.register('helloPersonData', function(command, cb){
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
		app.use(api.http);
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