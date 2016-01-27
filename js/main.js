( function() {

	'use strict';

	// ------

	var RANDOM_WIDTH = 1024;
	var RANDOM_HEIGHT = 1024;
	var BLUR_COUNT = 10;
	var renderMode = false;

	// ------

  var canvas = document.getElementById( 'canvas' );
	var gl = canvas.getContext( 'webgl' ) || canvas.getContext( 'experimental-webgl' );
	var glCat = new GLCat( gl );

	// ------

	var vbo = {};
	var framebuffer = {};
	var texture = {};
	var shader = {};
  var program = {};

	// ------

	var frame = 0;

  // ------

	var prepare = function() {

	  vbo.quad = glCat.createVertexbuffer( [ -1, -1, 3, -1, -1, 3 ] );

	  // ------

		framebuffer.render = glCat.createFloatFramebuffer( canvas.width, canvas.height );
		framebuffer.blur = glCat.createFloatFramebuffer( canvas.width, canvas.height );
		framebuffer.blurReturn = glCat.createFloatFramebuffer( canvas.width, canvas.height );

	  // ------

	  texture.random = glCat.createTexture();
		glCat.setTextureFromFloatArray( texture.random, RANDOM_WIDTH, RANDOM_HEIGHT, ( function() {
			var a = [];
			for ( var i = 0; i < RANDOM_WIDTH * RANDOM_HEIGHT * 4; i ++ ) {
				a.push( Math.random() );
			}
			return a;
		} )() );

	};

  // ------

  var update = function() {

		for ( var iBlur = 0; iBlur < BLUR_COUNT; iBlur ++ ) {
			var time = ( frame / 1000.0 ) % 1.0;

			{
	      glCat.useProgram( program.render );
	      gl.bindFramebuffer( gl.FRAMEBUFFER, framebuffer.render );
	      gl.viewport( 0, 0, canvas.width, canvas.height );

				glCat.clear();
				gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

	      glCat.attribute( 'position', vbo.quad, 2 );

				glCat.uniform1f( 'time', time );
	      glCat.uniform2fv( 'resolution', [ canvas.width, canvas.height ] );

	      glCat.uniformTexture( 'randomTexture', texture.random, 0 );

	      gl.drawArrays( gl.TRIANGLES, 0, vbo.quad.length / 2 );
			}

			{
	      glCat.useProgram( program.blur );
				gl.bindFramebuffer( gl.FRAMEBUFFER, framebuffer.blur );
	      gl.viewport( 0, 0, canvas.width, canvas.height );

				glCat.clear();
				gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

	      glCat.attribute( 'position', vbo.quad, 2 );

				glCat.uniform1f( 'time', time );
	      glCat.uniform2fv( 'resolution', [ canvas.width, canvas.height ] );
				glCat.uniform1f( 'iBlur', iBlur );
				glCat.uniform1f( 'blurCount', BLUR_COUNT );

				glCat.uniformTexture( 'textureRender', framebuffer.render.texture, 0 );
	      glCat.uniformTexture( 'textureBlur', framebuffer.blurReturn.texture, 1 );

	      gl.drawArrays( gl.TRIANGLES, 0, vbo.quad.length / 2 );
			}

			{
	      glCat.useProgram( program.return );
				if ( iBlur === BLUR_COUNT - 1 ) { gl.bindFramebuffer( gl.FRAMEBUFFER, null ); }
	      else { gl.bindFramebuffer( gl.FRAMEBUFFER, framebuffer.blurReturn ); }
	      gl.viewport( 0, 0, canvas.width, canvas.height );

				glCat.clear();
				gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

	      glCat.attribute( 'position', vbo.quad, 2 );

				glCat.uniform1f( 'time', time );
	      glCat.uniform2fv( 'resolution', [ canvas.width, canvas.height ] );
				glCat.uniform1f( 'blurCount', BLUR_COUNT );

	      glCat.uniformTexture( 'texture', framebuffer.blur.texture, 0 );

	      gl.drawArrays( gl.TRIANGLES, 0, vbo.quad.length / 2 );
			}

			frame ++;
		}

		if ( renderMode ) {
	    if ( 100 * BLUR_COUNT <= frame ) {
	      var url = canvas.toDataURL();
	      var a = document.createElement( 'a' );
	      a.download = ( '000' + frame ).slice( -4 ) + '.png';
	      a.href = url;
	      a.click();
	    }

			if ( frame === 200 * BLUR_COUNT ) {
				alert( 'done!' );
				return undefined;
			}
		}

		requestAnimationFrame( update );

  };

  // ------

  var ready = false;

	document.getElementById( 'button' ).addEventListener( 'click', function() {
		renderMode = document.getElementById( 'render-tick' ).checked;

    if ( ready && frame === 0 ) {
			prepare();
      update();
    }
  } );

  step( {

    0: function( _step ) {

			[
				'plane.vert',
				'render.frag',
				'blur.frag',
				'return.frag'
			].map( function( _name ) {
				requestText( './shader/' + _name, function( _text ) {
					shader[ _name ] = _text;
					_step();
				} );
			} );

		},

    4: function( _step ) {

			program.render = glCat.createProgram( shader[ 'plane.vert' ], shader[ 'render.frag' ] );
			program.blur = glCat.createProgram( shader[ 'plane.vert' ], shader[ 'blur.frag' ] );
			program.return = glCat.createProgram( shader[ 'plane.vert' ], shader[ 'return.frag' ] );

      ready = true;

    }

  } );

} )();
