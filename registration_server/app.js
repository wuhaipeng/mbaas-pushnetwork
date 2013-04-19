require('mootools');

var express = require( 'express' );
var app = express();

app.configure( function() {
  app.use( express.bodyParser() );
  app.use( express.methodOverride() );
  app.use( app.router );
});

require( './lib/dataAccessorFactory' ).build( function ( err, dataAccessor ) {
    if ( err ) {
        console.error( err );
        process.exit( 1 );
    }
    
    require( './routes/api' ).register( app, dataAccessor );
    
    var port = process.env.REGISTRATION_SERVER_PORT || 9999;
    app.listen( port, function() {
        console.log( "Registration server is listening on port " + port );
    } );
}); 
