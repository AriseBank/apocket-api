'use strict';

var _ = require('lodash');
var util = require('util');
var $ = require('preconditions').singleton();
var Uuid = require('uuid');

var Address = require('./address');
var Pocketeer = require('./pocketeer');
var AddressManager = require('./addressmanager');

var Common = require('../common');
var Constants = Common.Constants,
  Defaults = Common.Defaults,
  Utils = Common.Utils;

function Wallet() {};

Wallet.create = function(opts) {
  opts = opts || {};

  var x = new Wallet();

  $.shouldBeNumber(opts.m);
  $.shouldBeNumber(opts.n);
  $.checkArgument(Utils.checkValueInCollection(opts.coin, Constants.COINS));
  $.checkArgument(Utils.checkValueInCollection(opts.network, Constants.NETWORKS));

  x.version = '1.0.0';
  x.createdOn = Math.floor(Date.now() / 1000);
  x.id = opts.id || Uuid.v4();
  x.name = opts.name;
  x.m = opts.m;
  x.n = opts.n;
  x.singleAddress = !!opts.singleAddress;
  x.status = 'pending';
  x.publicKeyRing = [];
  x.addressIndex = 0;
  x.pocketeers = [];
  x.pubKey = opts.pubKey;
  x.coin = opts.coin;
  x.network = opts.network;
  x.derivationStrategy = opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP45;
  x.addressType = opts.addressType || Constants.SCRIPT_TYPES.P2SH;

  x.addressManager = AddressManager.create({
    derivationStrategy: x.derivationStrategy,
  });
  x.scanStatus = null;

  return x;
};

Wallet.fromObj = function(obj) {
  var x = new Wallet();

  $.shouldBeNumber(obj.m);
  $.shouldBeNumber(obj.n);

  x.version = obj.version;
  x.createdOn = obj.createdOn;
  x.id = obj.id;
  x.name = obj.name;
  x.m = obj.m;
  x.n = obj.n;
  x.singleAddress = !!obj.singleAddress;
  x.status = obj.status;
  x.publicKeyRing = obj.publicKeyRing;
  x.pocketeers = _.map(obj.pocketeers, function(pocketeer) {
    return Pocketeer.fromObj(pocketeer);
  });
  x.pubKey = obj.pubKey;
  x.coin = obj.coin || Defaults.COIN;
  x.network = obj.network;
  x.derivationStrategy = obj.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP45;
  x.addressType = obj.addressType || Constants.SCRIPT_TYPES.P2SH;
  x.addressManager = AddressManager.fromObj(obj.addressManager);
  x.scanStatus = obj.scanStatus;

  return x;
};

Wallet.prototype.toObject = function() {
  var x = _.cloneDeep(this);
  x.isShared = this.isShared();
  return x;
};

/**
 * Get the maximum allowed number of required pocketeers.
 * This is a limit imposed by the maximum allowed size of the scriptSig.
 * @param {number} totalPocketeers - the total number of pocketeers
 * @return {number}
 */
Wallet.getMaxRequiredPocketeers = function(totalPocketeers) {
  return Wallet.POCKETEER_PAIR_LIMITS[totalPocketeers];
};

Wallet.verifyPocketeerLimits = function(m, n) {
  return (n >= 1 && n <= 15) && (m >= 1 && m <= n);
};

Wallet.prototype.isShared = function() {
  return this.n > 1;
};


Wallet.prototype._updatePublicKeyRing = function() {
  this.publicKeyRing = _.map(this.pocketeers, function(pocketeer) {
    return _.pick(pocketeer, ['xPubKey', 'requestPubKey']);
  });
};

Wallet.prototype.addPocketeer = function(pocketeer) {
  $.checkState(pocketeer.coin == this.coin);

  this.pocketeers.push(pocketeer);
  if (this.pocketeers.length < this.n) return;

  this.status = 'complete';
  this._updatePublicKeyRing();
};

Wallet.prototype.addPocketeerRequestKey = function(pocketeerId, requestPubKey, signature, restrictions, name) {
  $.checkState(this.pocketeers.length == this.n);

  var c = this.getPocketeer(pocketeerId);

  //new ones go first
  c.requestPubKeys.unshift({
    key: requestPubKey.toString(),
    signature: signature,
    selfSigned: true,
    restrictions: restrictions || {},
    name: name || null,
  });
};

Wallet.prototype.getPocketeer = function(pocketeerId) {
  return _.find(this.pocketeers, {
    id: pocketeerId
  });
};

Wallet.prototype.isComplete = function() {
  return this.status == 'complete';
};

Wallet.prototype.isScanning = function() {
  return this.scanning;
};

Wallet.prototype.createAddress = function(isChange) {
  $.checkState(this.isComplete());

  var self = this;

  var path = this.addressManager.getNewAddressPath(isChange);
  var address = Address.derive(self.id, this.addressType, this.publicKeyRing, path, this.m, this.coin, this.network, isChange);
  return address;
};


module.exports = Wallet;
