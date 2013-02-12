// Generated by CoffeeScript 1.4.0
(function() {

  Meteor._CrdtManager = (function() {

    function _CrdtManager() {
      var getCrdtSnapshot;
      this.collections = [];
      getCrdtSnapshot = function(collProps, serializedCrdt) {
        var crdt;
        crdt = new Meteor._CrdtDocument(collProps, serializedCrdt);
        return crdt.snapshot();
      };
    }

    _CrdtManager.prototype.addCollection = function(name, props) {
      var crdtColl, snapshotColl;
      if (props == null) {
        props = {};
      }
      snapshotColl = new Meteor.Collection(name);
      crdtColl = new Meteor.Collection(name + 'Crdts');
      if (Meteor.isServer) {
        crdtColl._ensureIndex({
          crdtId: 1
        });
      }
      this.collections[name] = {
        snapshot: snapshotColl,
        crdts: crdtColl,
        props: props
      };
      return snapshotColl;
    };

    _CrdtManager.prototype.resetCollection = function(name) {
      if ((this.collections[name] != null) && Meteor.isServer) {
        this.collections[name].snapshot.remove({});
        this.collections[name].crdts.remove({});
        return true;
      } else {
        return false;
      }
    };

    _CrdtManager.prototype.findCrdt = function(name, crdtId) {
      return this.collections[name].crdts.findOne({
        crdtId: crdtId
      });
    };

    _CrdtManager.prototype.updatedCrdts = void 0;

    _CrdtManager.prototype.txRunning = function() {
      return this.updatedCrdts != null;
    };

    _CrdtManager.prototype.txStart = function() {
      console.assert(!this.txRunning(), 'Trying to start an already running transaction.');
      this.updatedCrdts = {};
      return true;
    };

    _CrdtManager.prototype.txCommit = function() {
      var collName, crdt, crdtColl, crdtId, crdtProps, mongoId, newSnapshot, oldSnapshot, serializedCrdt, snapshotColl, _ref, _ref1;
      console.assert(this.txRunning(), 'Trying to commit a non-existent transaction.');
      _ref = this.updatedCrdts;
      for (mongoId in _ref) {
        collName = _ref[mongoId];
        _ref1 = this.collections[collName], snapshotColl = _ref1.snapshot, crdtColl = _ref1.crdts, crdtProps = _ref1.props;
        serializedCrdt = crdtColl.findOne({
          _id: mongoId
        });
        console.assert(serializedCrdt != null);
        crdt = new Meteor._CrdtDocument(crdtProps, serializedCrdt);
        crdtId = crdt.crdtId;
        newSnapshot = crdt.snapshot();
        oldSnapshot = snapshotColl.findOne({
          _id: crdtId
        });
        if ((newSnapshot != null) && !(oldSnapshot != null)) {
          snapshotColl.insert(newSnapshot);
        }
        if ((newSnapshot != null) && (oldSnapshot != null)) {
          snapshotColl.update({
            _id: crdtId
          }, newSnapshot);
        }
        if ((oldSnapshot != null) && !(newSnapshot != null)) {
          snapshotColl.remove({
            _id: crdtId
          });
        }
      }
      this.updatedCrdts = void 0;
      return true;
    };

    _CrdtManager.prototype.txAbort = function() {
      return this.updatedCrdts = void 0;
    };

    _CrdtManager.prototype.insertObject = function(collection, crdtId, args, clock) {
      var crdt, entry, key, mongoId, serializedCrdt, value, _i, _len, _ref;
      console.assert(this.txRunning(), 'Trying to execute operation "crdts.insertObject" outside a transaction.');
      serializedCrdt = this.findCrdt(collection, crdtId);
      if (serializedCrdt != null) {
        if (!serializedCrdt.deleted) {
          Meteor.log["throw"]('crdt.tryingToUndeleteVisibleCrdt', {
            collection: collection,
            crdtId: crdtId
          });
        }
        this.collections[collection].crdts.update({
          crdtId: crdtId
        }, {
          $set: {
            deleted: false,
            clock: clock
          }
        });
        mongoId = serializedCrdt._id;
      } else {
        crdt = new Meteor._CrdtDocument(this.collections[collection].props);
        crdt.crdtId = crdtId;
        crdt.clock = clock;
        _ref = args.object;
        for (key in _ref) {
          value = _ref[key];
          if (_.isArray(value)) {
            for (_i = 0, _len = value.length; _i < _len; _i++) {
              entry = value[_i];
              crdt.append({
                key: key,
                value: entry
              });
            }
          } else {
            crdt.append({
              key: key,
              value: value
            });
          }
        }
        mongoId = this.collections[collection].crdts.insert(crdt.serialize());
      }
      this.updatedCrdts[mongoId] = collection;
      return crdtId;
    };

    _CrdtManager.prototype.removeObject = function(collection, crdtId, args, clock) {
      var serializedCrdt;
      console.assert(this.txRunning(), 'Trying to execute operation "crdts.removeObject" outside a transaction.');
      serializedCrdt = this.findCrdt(collection, crdtId);
      if (serializedCrdt == null) {
        Meteor.log["throw"]('crdt.tryingToDeleteNonexistentCrdt', {
          collection: collection,
          crdtId: crdtId
        });
      }
      if (serializedCrdt.deleted) {
        Meteor.log["throw"]('crdt.tryingToDeleteCrdtTwice', {
          collection: collection,
          crdtId: crdtId
        });
      }
      this.collections[collection].crdts.update({
        crdtId: crdtId
      }, {
        $set: {
          deleted: true,
          clock: clock
        }
      });
      this.updatedCrdts[serializedCrdt._id] = collection;
      return crdtId;
    };

    _CrdtManager.prototype.insertProperty = function(collection, crdtId, args, clock) {
      var crdt, index, serializedCrdt;
      console.assert(this.txRunning(), 'Trying to execute operation "crdts.insertProperty" outside ' + 'a transaction.');
      serializedCrdt = this.findCrdt(collection, crdtId);
      if (serializedCrdt == null) {
        Meteor.log["throw"]('crdt.tryingToInsertValueIntoNonexistentCrdt', {
          key: args.key,
          collection: collection,
          crdtId: crdtId
        });
      }
      crdt = new Meteor._CrdtDocument(this.collections[collection].props, serializedCrdt);
      index = crdt.append({
        key: args.key,
        value: args.value
      });
      this.collections[collection].crdts.update({
        crdtId: crdtId
      }, {
        $set: {
          properties: crdt.serialize().properties,
          clock: clock
        }
      });
      this.updatedCrdts[serializedCrdt._id] = collection;
      return index;
    };

    _CrdtManager.prototype.removeProperty = function(collection, crdtId, args, clock) {
      var crdt, deletedIndices, locator, serializedCrdt;
      locator = void 0;
      if (args.locator != null) {
        locator = args.locator;
      }
      console.assert(this.txRunning(), 'Trying to execute operation ' + '"crdts.removeProperty" outside a transaction.');
      serializedCrdt = this.findCrdt(collection, crdtId);
      if (serializedCrdt == null) {
        Meteor.log["throw"]('crdt.tryingToDeleteValueFromNonexistentCrdt', {
          key: args.key,
          locator: locator,
          collection: collection,
          crdtId: crdtId
        });
      }
      crdt = new Meteor._CrdtDocument(this.collections[collection].props, serializedCrdt);
      deletedIndices = crdt["delete"](args.key, locator);
      this.collections[collection].crdts.update({
        crdtId: crdtId
      }, {
        $set: {
          properties: crdt.serialize().properties,
          clock: clock
        }
      });
      this.updatedCrdts[serializedCrdt._id] = collection;
      return deletedIndices;
    };

    _CrdtManager.prototype.inverse = function(collection, crdtId, args, clock) {
      var crdt, deletedIndex, origArgs, origOp, origResult, serializedCrdt, undeletedIndices;
      origOp = args.op, origArgs = args.args, origResult = args.result;
      switch (origOp) {
        case 'insertObject':
          return this.removeObject(collection, crdtId, {}, clock);
        case 'removeObject':
          console.assert(this.txRunning(), 'Trying to execute operation "crdts.inverse(removeObject)" outside ' + 'a transaction.');
          serializedCrdt = this.findCrdt(collection, crdtId);
          if (serializedCrdt == null) {
            Meteor.log["throw"]('crdt.tryingToUndeleteNonexistentCrdt', {
              collection: collection,
              crdtId: crdtId
            });
          }
          if (!serializedCrdt.deleted) {
            Meteor.log.warning('crdt.tryingToUndeleteVisibleCrdt', {
              collection: collection,
              crdtId: crdtId
            });
          }
          this.collections[collection].crdts.update({
            crdtId: crdtId
          }, {
            $set: {
              deleted: false,
              clock: clock
            }
          });
          this.updatedCrdts[serializedCrdt._id] = collection;
          return true;
        case 'insertProperty':
          console.assert(this.txRunning(), 'Trying to execute operation "crdts.inverse(insertProperty)" ' + 'outside a transaction.');
          serializedCrdt = this.findCrdt(collection, crdtId);
          if (serializedCrdt == null) {
            Meteor.log["throw"]('crdt.tryingToDeleteValueFromNonexistentCrdt', {
              key: origArgs.key,
              locator: origResult,
              collection: collection,
              crdtId: crdtId
            });
          }
          crdt = new Meteor._CrdtDocument(this.collections[collection].props, serializedCrdt);
          deletedIndex = crdt.deleteIndex(origResult, origArgs.key);
          this.collections[collection].crdts.update({
            crdtId: crdtId
          }, {
            $set: {
              properties: crdt.serialize().properties,
              clock: clock
            }
          });
          this.updatedCrdts[serializedCrdt._id] = collection;
          return deletedIndex;
        case 'removeProperty':
          console.assert(this.txRunning(), 'Trying to execute operation "crdts.inverse(removeProperty)" ' + 'outside a transaction.');
          serializedCrdt = this.findCrdt(collection, crdtId);
          if (serializedCrdt == null) {
            Meteor.log["throw"]('crdt.tryingToUndeleteValueFromNonexistentCrdt', {
              key: origArgs.key,
              locator: origResult[0],
              collection: collection,
              crdtId: crdtId
            });
          }
          crdt = new Meteor._CrdtDocument(this.collections[collection].props, serializedCrdt);
          undeletedIndices = (function() {
            var _i, _len, _results;
            _results = [];
            for (_i = 0, _len = origResult.length; _i < _len; _i++) {
              deletedIndex = origResult[_i];
              _results.push(crdt.undeleteIndex(deletedIndex, origArgs.key));
            }
            return _results;
          })();
          this.collections[collection].crdts.update({
            crdtId: crdtId
          }, {
            $set: {
              properties: crdt.serialize().properties,
              clock: clock
            }
          });
          this.updatedCrdts[serializedCrdt._id] = collection;
          return undeletedIndices;
        default:
          return Meteor.log["throw"]('crdt.cannotInvert', {
            op: origOp
          });
      }
    };

    return _CrdtManager;

  })();

  Meteor._CrdtManager = new Meteor._CrdtManager;

  Meteor.VersionedCollection = (function() {

    function VersionedCollection(name, props) {
      var snapshot,
        _this = this;
      this.name = name;
      if (props == null) {
        props = {};
      }
      this.tx = Meteor.tx;
      snapshot = Meteor._CrdtManager.addCollection(this.name, props);
      _.each(['find', 'findOne'], function(method) {
        return _this[method] = function() {
          var args;
          args = _.toArray(arguments);
          return snapshot[method].apply(snapshot, args);
        };
      });
      if (Meteor.isServer) {
        this.reset = function() {
          return Meteor._CrdtManager.resetCollection(name);
        };
      }
    }

    VersionedCollection.prototype.insertOne = function(object) {
      var id;
      if (object._id != null) {
        id = object._id;
        object._id = void 0;
      } else {
        id = Meteor.uuid();
      }
      this.tx._addOperation({
        op: 'insertObject',
        collection: this.name,
        crdtId: id,
        args: {
          object: object
        }
      });
      return id;
    };

    VersionedCollection.prototype.removeOne = function(id) {
      this.tx._addOperation({
        op: 'removeObject',
        collection: this.name,
        crdtId: id
      });
      return id;
    };

    VersionedCollection.prototype.setProperty = function(id, key, value) {
      this.tx._addOperation({
        op: 'insertProperty',
        collection: this.name,
        crdtId: id,
        args: {
          key: key,
          value: value
        }
      });
      return id;
    };

    VersionedCollection.prototype.unsetProperty = function(id, key, locator) {
      var args;
      if (locator == null) {
        locator = void 0;
      }
      args = {
        key: key
      };
      if (locator != null) {
        args.locator = locator;
      }
      this.tx._addOperation({
        op: 'removeProperty',
        collection: this.name,
        crdtId: id,
        args: args
      });
      return id;
    };

    return VersionedCollection;

  })();

}).call(this);