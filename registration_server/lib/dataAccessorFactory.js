exports.build = function ( done ) {
    var dataAccessor;
    if ( process.env.REGISTRATION_SERVER_MONGODB_URL ) {
      var DbClass = require( './mongodb' );
      dataAccessor = new DbClass( process.env.REGISTRATION_SERVER_MONGODB_URL );
    } else {
      console.error( "Missed datastore information." );
      process.exit( 1 );
    }

    dataAccessor.ready( function( err ) {
      done( err, dataAccessor );
    });
};
