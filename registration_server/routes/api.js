exports.register = function (app, dataAccessor) {

  function getRegistrationId( appKey, deviceFingerprint ) {
    var shasum = require('crypto').createHash( 'sha1' );
    shasum.update( appKey );
    shasum.update( deviceFingerprint );
    return shasum.digest( 'hex' );
  }

  app.post("/register", function (req, res) {

    res.set('Content-Type', 'application/json');

    var message = {};
    var appKey = req.body.appKey;
    var deviceFingerprint = req.body.deviceFingerprint;

    if (!appKey) {
      message.msg = "App key missed.";
      res.send(400, JSON.stringify(message));
      return;
    }

    if (!deviceFingerprint) {
      message.msg = "Device fingerprint missed.";
      res.send(400, JSON.stringify(message));
      return;
    }

    message.regId = getRegistrationId( appKey, deviceFingerprint );

    dataAccessor.update( message.regId, appKey, deviceFingerprint, function(err) {
      if ( err ) {
        res.send( 500 );
      } else {
        res.send( 200, JSON.stringify(message) );
      }
    });

  });
};
