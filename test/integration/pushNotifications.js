'use strict';

var _ = require('lodash');
var async = require('async');

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var log = require('npmlog');
log.debug = log.verbose;
log.level = 'info';

var sjcl = require('sjcl');

var WalletService = require('../../lib/server');
var PushNotificationsService = require('../../lib/pushnotificationsservice');

var TestData = require('../testdata');
var helpers = require('./helpers');

describe('Push notifications', function() {
  var server, wallet, requestStub, pushNotificationsService, walletId;

  before(function(done) {
    helpers.before(done);
  });
  after(function(done) {
    helpers.after(done);
  });

  describe('Single wallet', function() {
    beforeEach(function(done) {
      helpers.beforeEach(function(res) {
        helpers.createAndJoinWallet(1, 1, function(s, w) {
          server = s;
          wallet = w;

          var i = 0;
          async.eachSeries(w.pocketeers, function(pocketeer, next) {
            helpers.getAuthServer(pocketeer.id, function(server) {
              async.parallel([

                function(done) {
                  server.savePreferences({
                    email: 'pocketeer' + (++i) + '@domain.com',
                    language: 'en',
                    unit: 'bit',
                  }, done);
                },
                function(done) {
                  server.pushNotificationsSubscribe({
                    token: '1234',
                    packageName: 'com.wallet',
                    platform: 'Android',
                  }, done);
                },
              ], next);

            });
          }, function(err) {
            should.not.exist(err);

            requestStub = sinon.stub();
            requestStub.yields();

            pushNotificationsService = new PushNotificationsService();
            pushNotificationsService.start({
              lockOpts: {},
              messageBroker: server.messageBroker,
              storage: helpers.getStorage(),
              request: requestStub,
              pushNotificationsOpts: {
                templatePath: './lib/templates',
                defaultLanguage: 'en',
                defaultUnit: 'btc',
                subjectPrefix: '',
                pushServerUrl: 'http://localhost:8000',
                authorizationKey: 'secret',
              },
            }, function(err) {
              should.not.exist(err);
              done();
            });
          });
        });
      });
    });

    it('should build each notifications using preferences of the pocketeers', function(done) {
      server.savePreferences({
        language: 'en',
        unit: 'bit',
      }, function(err) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);

          // Simulate incoming tx notification
          server._notify('NewIncomingTx', {
            txid: '999',
            address: address,
            amount: 12300000,
          }, {
            isGlobal: true
          }, function(err) {
            setTimeout(function() {
              var calls = requestStub.getCalls();
              var args = _.map(calls, function(c) {
                return c.args[0];
              });
              calls.length.should.equal(1);
              args[0].body.notification.title.should.contain('New payment received');
              args[0].body.notification.body.should.contain('123,000');
              args[0].body.notification.body.should.contain('bits');
              done();
            }, 100);
          });
        });
      });
    });

    it('should not notify auto-payments to creator', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Simulate incoming tx notification
        server._notify('NewIncomingTx', {
          txid: '999',
          address: address,
          amount: 12300000,
        }, {
          isGlobal: false
        }, function(err) {
          setTimeout(function() {
            var calls = requestStub.getCalls();
            calls.length.should.equal(0);
            done();
          }, 100);
        });
      });
    });

    it('should notify pocketeers when payment is received', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Simulate incoming tx notification
        server._notify('NewIncomingTx', {
          txid: '999',
          address: address,
          amount: 12300000,
        }, {
          isGlobal: true
        }, function(err) {
          setTimeout(function() {
            var calls = requestStub.getCalls();
            calls.length.should.equal(1);
            done();
          }, 100);
        });
      });
    });

    it('should notify pocketeers when tx is confirmed if they are subscribed', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        server.txConfirmationSubscribe({
          txid: '123'
        }, function(err) {
          should.not.exist(err);

          // Simulate tx confirmation notification
          server._notify('TxConfirmation', {
            txid: '123',
          }, function(err) {
            setTimeout(function() {
              var calls = requestStub.getCalls();
              calls.length.should.equal(1);
              done();
            }, 100);
          });
        });
      });
    });
  });

  describe('Shared wallet', function() {
    beforeEach(function(done) {
      helpers.beforeEach(function(res) {
        helpers.createAndJoinWallet(2, 3, function(s, w) {
          server = s;
          wallet = w;
          var i = 0;
          async.eachSeries(w.pocketeers, function(pocketeer, next) {
            helpers.getAuthServer(pocketeer.id, function(server) {
              async.parallel([

                function(done) {
                  server.savePreferences({
                    email: 'pocketeer' + (++i) + '@domain.com',
                    language: 'en',
                    unit: 'bit',
                  }, done);
                },
                function(done) {
                  server.pushNotificationsSubscribe({
                    token: '1234',
                    packageName: 'com.wallet',
                    platform: 'Android',
                  }, done);
                },
              ], next);

            });
          }, function(err) {
            should.not.exist(err);

            requestStub = sinon.stub();
            requestStub.yields();

            pushNotificationsService = new PushNotificationsService();
            pushNotificationsService.start({
              lockOpts: {},
              messageBroker: server.messageBroker,
              storage: helpers.getStorage(),
              request: requestStub,
              pushNotificationsOpts: {
                templatePath: './lib/templates',
                defaultLanguage: 'en',
                defaultUnit: 'btc',
                subjectPrefix: '',
                pushServerUrl: 'http://localhost:8000',
                authorizationKey: 'secret',
              },
            }, function(err) {
              should.not.exist(err);
              done();
            });
          });
        });
      });
    });

    it('should build each notifications using preferences of the pocketeers', function(done) {
      server.savePreferences({
        email: 'pocketeer1@domain.com',
        language: 'es',
        unit: 'btc',
      }, function(err) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);

          // Simulate incoming tx notification
          server._notify('NewIncomingTx', {
            txid: '999',
            address: address,
            amount: 12300000,
          }, {
            isGlobal: true
          }, function(err) {
            setTimeout(function() {
              var calls = requestStub.getCalls();
              var args = _.map(calls, function(c) {
                return c.args[0];
              });

              calls.length.should.equal(3);

              args[0].body.notification.title.should.contain('Nuevo pago recibido');
              args[0].body.notification.body.should.contain('0.123');

              args[1].body.notification.title.should.contain('New payment received');
              args[1].body.notification.body.should.contain('123,000');

              args[2].body.notification.title.should.contain('New payment received');
              args[2].body.notification.body.should.contain('123,000');
              done();
            }, 100);
          });
        });
      });
    });

    it('should notify pocketeers when payment is received', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Simulate incoming tx notification
        server._notify('NewIncomingTx', {
          txid: '999',
          address: address,
          amount: 12300000,
        }, {
          isGlobal: true
        }, function(err) {
          setTimeout(function() {
            var calls = requestStub.getCalls();
            calls.length.should.equal(3);

            done();
          }, 100);
        });
      });
    });

    it('should not notify auto-payments to creator', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);

        // Simulate incoming tx notification
        server._notify('NewIncomingTx', {
          txid: '999',
          address: address,
          amount: 12300000,
        }, {
          isGlobal: false
        }, function(err) {
          setTimeout(function() {
            var calls = requestStub.getCalls();
            calls.length.should.equal(2);

            done();
          }, 100);
        });
      });
    });

    it('should notify pocketeers a new tx proposal has been created', function(done) {
      helpers.stubUtxos(server, wallet, [1, 1], function() {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);
          server._notify('NewTxProposal', {
            txid: '999',
            address: address,
            amount: 12300000,
          }, {
            isGlobal: false
          }, function(err) {
            setTimeout(function() {
              var calls = requestStub.getCalls();
              calls.length.should.equal(2);

              done();
            }, 100);
          });
        });
      });
    });

    it('should notify pocketeers a tx has been finally rejected', function(done) {
      helpers.stubUtxos(server, wallet, 1, function() {
        var txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 0.8e8
          }],
          feePerKb: 100e2
        };

        var txpId;
        async.waterfall([

          function(next) {
            helpers.createAndPublishTx(server, txOpts, TestData.pocketeers[0].privKey_1H_0, function(tx) {
              next(null, tx);
            });
          },
          function(txp, next) {
            txpId = txp.id;
            async.eachSeries(_.range(1, 3), function(i, next) {
              var pocketeer = TestData.pocketeers[i];
              helpers.getAuthServer(pocketeer.id44btc, function(server) {
                server.rejectTx({
                  txProposalId: txp.id,
                }, next);
              });
            }, next);
          },
        ], function(err) {
          should.not.exist(err);

          setTimeout(function() {
            var calls = requestStub.getCalls();
            var args = _.map(_.takeRight(calls, 2), function(c) {
              return c.args[0];
            });

            args[0].body.notification.title.should.contain('Payment proposal rejected');
            done();
          }, 100);
        });
      });
    });

    it('should notify pocketeers a new outgoing tx has been created', function(done) {
      helpers.stubUtxos(server, wallet, 1, function() {
        var txOpts = {
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 0.8e8
          }],
          feePerKb: 100e2
        };

        var txp;
        async.waterfall([

          function(next) {
            helpers.createAndPublishTx(server, txOpts, TestData.pocketeers[0].privKey_1H_0, function(tx) {
              next(null, tx);
            });
          },
          function(t, next) {
            txp = t;
            async.eachSeries(_.range(1, 3), function(i, next) {
              var pocketeer = TestData.pocketeers[i];
              helpers.getAuthServer(pocketeer.id44btc, function(s) {
                server = s;
                var signatures = helpers.clientSign(txp, pocketeer.xPrivKey_44H_0H_0H);
                server.signTx({
                  txProposalId: txp.id,
                  signatures: signatures,
                }, function(err, t) {
                  txp = t;
                  next();
                });
              });
            }, next);
          },
          function(next) {
            helpers.stubBroadcast();
            server.broadcastTx({
              txProposalId: txp.id,
            }, next);
          },
        ], function(err) {
          should.not.exist(err);

          setTimeout(function() {
            var calls = requestStub.getCalls();
            var args = _.map(_.takeRight(calls, 2), function(c) {
              return c.args[0];
            });

            args[0].body.notification.title.should.contain('Payment sent');
            args[1].body.notification.title.should.contain('Payment sent');

            sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(server.pocketeerId)).should.not.equal(args[0].body.data.pocketeerId);
            sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(server.pocketeerId)).should.not.equal(args[1].body.data.pocketeerId);
            done();
          }, 100);
        });
      });
    });
  });

  describe('joinWallet', function() {
    beforeEach(function(done) {
      helpers.beforeEach(function(res) {
        server = new WalletService();
        var walletOpts = {
          name: 'my wallet',
          m: 1,
          n: 3,
          pubKey: TestData.keyPair.pub,
        };
        server.createWallet(walletOpts, function(err, wId) {
          should.not.exist(err);
          walletId = wId;
          should.exist(walletId);
          requestStub = sinon.stub();
          requestStub.yields();

          pushNotificationsService = new PushNotificationsService();
          pushNotificationsService.start({
            lockOpts: {},
            messageBroker: server.messageBroker,
            storage: helpers.getStorage(),
            request: requestStub,
            pushNotificationsOpts: {
              templatePath: './lib/templates',
              defaultLanguage: 'en',
              defaultUnit: 'btc',
              subjectPrefix: '',
              pushServerUrl: 'http://localhost:8000',
              authorizationKey: 'secret',
            },
          }, function(err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    it('should notify pocketeers when a new pocketeer just joined into your wallet except the one who joined', function(done) {
      async.eachSeries(_.range(3), function(i, next) {
        var pocketeerOpts = helpers.getSignedPocketeerOpts({
          walletId: walletId,
          name: 'pocketeer ' + (i + 1),
          xPubKey: TestData.pocketeers[i].xPubKey_44H_0H_0H,
          requestPubKey: TestData.pocketeers[i].pubKey_1H_0,
          customData: 'custom data ' + (i + 1),
        });

        server.joinWallet(pocketeerOpts, function(err, res) {
          if (err) return next(err);

          helpers.getAuthServer(res.pocketeerId, function(server) {
            server.pushNotificationsSubscribe({
              token: 'token:' + pocketeerOpts.name,
              packageName: 'com.wallet',
              platform: 'Android',
            }, next);
          });
        });
      }, function(err) {
        should.not.exist(err);
        setTimeout(function() {
          var calls = requestStub.getCalls();
          var args = _.filter(_.map(calls, function(call) {
            return call.args[0];
          }), function(arg) {
            return arg.body.notification.title == 'New pocketeer';
          });

          server.getWallet(null, function(err, wallet) {
            /*
              First call - pocketeer2 joined
              pocketeer2 should notify to pocketeer1
              pocketeer2 should NOT be notifyed
            */
            var hashedPocketeerIds = _.map(wallet.pocketeers, function(pocketeer) {
              return sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(pocketeer.id));
            });
            hashedPocketeerIds[0].should.equal((args[0].body.data.pocketeerId));
            hashedPocketeerIds[1].should.not.equal((args[0].body.data.pocketeerId));

            /*
              Second call - pocketeer3 joined
              pocketeer3 should notify to pocketeer1
            */
            hashedPocketeerIds[0].should.equal((args[1].body.data.pocketeerId));

            /*
              Third call - pocketeer3 joined
              pocketeer3 should notify to pocketeer2
            */
            hashedPocketeerIds[1].should.equal((args[2].body.data.pocketeerId));

            // pocketeer3 should NOT notify any other pocketeer
            hashedPocketeerIds[2].should.not.equal((args[1].body.data.pocketeerId));
            hashedPocketeerIds[2].should.not.equal((args[2].body.data.pocketeerId));
            done();
          });
        }, 100);
      });
    });
  });
});
