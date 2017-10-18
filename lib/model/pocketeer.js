'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');
var util = require('util');
var Uuid = require('uuid');
var sjcl = require('sjcl');

var Address = require('./address');
var AddressManager = require('./addressmanager');
var Bitcore = require('bitcore-lib');

var Common = require('../common');
var Constants = Common.Constants,
  Defaults = Common.Defaults,
  Utils = Common.Utils;

function Pocketeer() {};

Pocketeer._xPubToPocketeerId = function(coin, xpub) {
  var str = coin == Defaults.COIN ? xpub : coin + xpub;
  var hash = sjcl.hash.sha256.hash(str);
  return sjcl.codec.hex.fromBits(hash);
};

Pocketeer.create = function(opts) {
  opts = opts || {};
  $.checkArgument(opts.xPubKey, 'Missing pocketeer extended public key')
    .checkArgument(opts.requestPubKey, 'Missing pocketeer request public key')
    .checkArgument(opts.signature, 'Missing pocketeer request public key signature');

  $.checkArgument(Utils.checkValueInCollection(opts.coin, Constants.COINS));

  opts.pocketeerIndex = opts.pocketeerIndex || 0;

  var x = new Pocketeer();

  x.version = 2;
  x.createdOn = Math.floor(Date.now() / 1000);
  x.coin = opts.coin;
  x.xPubKey = opts.xPubKey;
  x.id = Pocketeer._xPubToPocketeerId(opts.coin, x.xPubKey);
  x.name = opts.name;
  x.requestPubKey = opts.requestPubKey;
  x.signature = opts.signature;
  x.requestPubKeys = [{
    key: opts.requestPubKey,
    signature: opts.signature,
  }];

  var derivationStrategy = opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP45;
  if (AddressManager.supportsPocketeerBranches(derivationStrategy)) {
    x.addressManager = AddressManager.create({
      derivationStrategy: derivationStrategy,
      pocketeerIndex: opts.pocketeerIndex,
    });
  }

  x.customData = opts.customData;

  return x;
};

Pocketeer.fromObj = function(obj) {
  var x = new Pocketeer();

  x.version = obj.version;
  x.createdOn = obj.createdOn;
  x.coin = obj.coin || Defaults.COIN;
  x.id = obj.id;
  x.name = obj.name;
  x.xPubKey = obj.xPubKey;
  x.requestPubKey = obj.requestPubKey;
  x.signature = obj.signature;

  if (parseInt(x.version) == 1) {
    x.requestPubKeys = [{
      key: x.requestPubKey,
      signature: x.signature,
    }];
    x.version = 2;
  } else {
    x.requestPubKeys = obj.requestPubKeys;
  }

  if (obj.addressManager) {
    x.addressManager = AddressManager.fromObj(obj.addressManager);
  }
  x.customData = obj.customData;

  return x;
};

Pocketeer.prototype.createAddress = function(wallet, isChange) {
  $.checkState(wallet.isComplete());

  var path = this.addressManager.getNewAddressPath(isChange);
  var address = Address.derive(wallet.id, wallet.addressType, wallet.publicKeyRing, path, wallet.m, wallet.coin, wallet.network, isChange);
  return address;
};

module.exports = Pocketeer;
