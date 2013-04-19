var mongoose = require( 'mongoose' );

var regSchema = new mongoose.Schema({
  regId: { type: String, index: { unique: true, required: true } },
  appKey: { type: String},
  deviceFingerprint: { type: String},
  lastUpdateAt: { type: Date }
}, { id: false } );

regSchema.methods.toDataObject = function () {
  return {
    regId: this.regId,
    appKey: this.appKey,
    deviceFingerprint: this.deviceFingerprint,
    lastUpdateAt: this.lastUpdateAt
  };
};

var Regs = mongoose.model( "registrations", regSchema );

module.exports = new Class({

  initialize: function ( url ) {
    this.url = url;
  },

  ready: function ( callback ) {
    mongoose.connect( this.url, function( err ) {
      callback( err );
    });
  },
    
  update: function ( regid, appkey, devicefingerprint, callback ) {
    Regs.findOne( { regId: regid } ).exec( function(err, result) {
      if ( !err ) {
        if ( result ) {
          result.lastUpdateAt = new Date();
          result.save( function ( e ) {
            callback( e );
          });
          return;
        }
        var reg = new Regs({
          regId: regid,
          appKey: appkey,
          deviceFingerprint: devicefingerprint,
          lastUpdateAt: new Date()
        });
        reg.save(function ( e ) {
          callback( e );
        });
        return;
      }
      callback( err );
    });
  }
});
