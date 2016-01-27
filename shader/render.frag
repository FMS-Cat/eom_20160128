precision highp float;

uniform float time;
uniform vec2 resolution;

uniform sampler2D noiseTexture;

#define PI 3.14159265
#define V vec2(0.,1.)
#define saturate(i) clamp(i,0.,1.)

#define MARCH_ITER 120
#define MARCH_MULTIPLIER 0.8
#define REFLECT_ITER 3

#define RAYDIST_INIT 1E-3
#define RAYLEN_MAX 1E2

// ------

vec2 p;

vec3 camPos;
vec3 camDir;
vec3 camSid;
vec3 camTop;

vec3 rayDir;
vec3 rayBeg;
float rayLen;
float rayLenSum;
vec3 rayPos;
vec4 rayCol;
vec4 rayMtl;
float rayDist;
float rayDistMin;

// ------

mat2 rotate2D( float _t ) {
  return mat2( cos( _t ), sin( _t ), -sin( _t ), cos( _t ) );
}

vec3 hash( vec3 _v ) {
  return fract( sin( vec3(
    dot( _v, vec3( 7.544, 6.791, 7.143 ) ) * 179.197,
    dot( _v, vec3( 6.943, 7.868, 7.256 ) ) * 176.465,
    dot( _v, vec3( 7.152, 7.276, 6.876 ) ) * 172.967
  ) ) * 2854.21 );
}

vec3 rotate( vec3 _p, vec3 _rot ) {
  vec3 p = _p;
  p.yz = rotate2D( _rot.x ) * p.yz;
  p.zx = rotate2D( _rot.y ) * p.zx;
  p.xy = rotate2D( _rot.z ) * p.xy;
  return p;
}

float expCurve( float _x, float _k ) {
  return sign( 0.5 - _x ) * ( exp( -abs( _x - 0.5 ) * _k ) - 1.0 ) * 0.5 + 0.5;
}

// ------

void setCamera() {
  camPos = V.xxy * 0.25;
  camDir = V.xxy * -1.0;
  vec3 camAir = V.xyx;
  camSid = normalize( cross( camDir, camAir ) );
  camTop = normalize( cross( camSid, camDir ) );
}

void initRay() {
  rayDir = normalize( camSid * p.x + camTop * p.y + camDir );
  rayDir = normalize( rayDir + hash( rayDir + time ) * 5E-3 );
  rayBeg = camPos;
  rayLen = RAYDIST_INIT;
  rayLenSum = 0.0;
  rayPos = rayBeg + rayDir * rayLen;
  rayCol = V.xxxy;
}

// ------

float distSphere( vec3 _p, float _r ) {
  return length( _p ) - _r;
}

float distPillar( vec2 _p, float _r ) {
  return length( _p ) - _r;
}

float distTube( vec2 _p, float _R, float _r ) {
  return max( distPillar( _p, _R ), -distPillar( _p, _r ) );
}

float distBox( in vec3 _pos, in vec3 _size ) {
  vec3 d = abs( _pos ) - _size;
  return min( max( d.x, max( d.y, d.z ) ), 0.0 ) + length( max( d, 0.0 ) );
}

vec3 spaceMod( vec3 _p, vec3 _rot, vec3 _shift, int iter ) {
  vec3 p = _p;

  for ( int i = 0; i < 100; i ++ ) {
    if ( iter <= i ) { break; }

    float intensity = pow( 2.0, -float( i ) );

    p = rotate( p, _rot );

    p.x = abs( p.x );
    p.z = abs( p.z );
    p = p - _shift * intensity;

    if ( p.y < p.z ) { p.yz = p.zy; }
    if ( p.x < p.z ) { p.zx = p.xz; }

    p = rotate( p, -_rot );
  }

  return p;
}

// ------

float distFunc( vec3 _p ) {
  rayMtl = V.xxxx;
  float dist = 1E9;

  for ( int i = 0; i < 3; i ++ ) {
    float t = mod( time + float( i ) * 0.1, 1.0 );
    float phase = exp( -t * 8.0 );
    float phase2 = pow( t, 4.0 );
    float phase3 = sin( t * PI );
    vec3 p = rotate( _p, vec3( 1.0 - phase2 * 0.3, 2.0 - phase + phase2 * 1.8, 0.0 ) );

    vec3 rot = vec3( 1.1 + float( i ) * 0.1 - phase2 * 0.3, 3.3, 0.2 + phase * PI * 0.05 );
    p = spaceMod( p, rot, 0.12 * V.yyy, 2 );
    rot = vec3( 3.4, 1.8, 2.5 + phase * PI * 0.05 );
    p = spaceMod( p, rot, 0.12 * V.yyy, 2 );
    rot = vec3( 1.4, 3.2, 2.8 + phase * PI * 0.05 );
    p = spaceMod( p, rot, 0.12 * V.yyy, 2 );

    float distC = distBox( p, vec3( 4.0, 1.0, 1.0 ) * 0.03 * phase3 );

    if ( distC < dist ) {
      dist = distC;
      rayMtl.x = float( i );
    }
  }

  return dist;
}

vec3 normalFunc( vec3 _p, float _d ) {
  vec2 d = V * _d;
  return normalize( vec3(
    distFunc( _p + d.yxx ) - distFunc( _p - d.yxx ),
    distFunc( _p + d.xyx ) - distFunc( _p - d.xyx ),
    distFunc( _p + d.xxy ) - distFunc( _p - d.xxy )
  ) );
}

void march() {
  rayDistMin = 1E8;

  for ( int iMarch = 0; iMarch < MARCH_ITER; iMarch ++ ) {
    rayDist = distFunc( rayPos );
    if ( iMarch == 0 ) { rayDistMin = rayDist; }
    else { rayDistMin = min( rayDist, rayDistMin ); }

    rayLen += min( rayDist * MARCH_MULTIPLIER, 4.0 );
    rayPos = rayBeg + rayDir * rayLen;

    if ( abs( rayDist ) < RAYDIST_INIT * 0.1 || RAYLEN_MAX < rayLen ) { break; }
  }

  rayLenSum += rayLen;
}

void shade() {
  vec3 fogCol = vec3( 0.0, 0.0, 0.0 );
  float decay = exp( -rayLenSum * 1.0 );

  if ( rayDist < RAYDIST_INIT ) {
    vec3 nor = normalFunc( rayPos, 1E-4 );

    vec3 mtlDif = V.yyy * 0.2;

    float edge = length( normalFunc( rayPos, 1E-4 * rayLen ) - normalFunc( rayPos, 8E-3 * rayLen ) );
    edge = expCurve( edge * 2.0, 5.0 );
    vec3 ligPos = vec3( -2.0, 4.0, 5.0 );
    vec3 ligDir = normalize( rayPos - ligPos );

    vec3 dif = saturate( dot( ligDir, -nor ) * 0.5 + 0.5 ) * 1.6 * mtlDif;
    float r = 0.5 + edge * 0.5;

    rayCol.xyz += mix(
      fogCol,
      mix(
        dif,
        V.yyy * 1.3,
        edge
      ),
      decay
    ) * rayCol.w * r;
    rayCol.w *= ( 1.0 - r );

  } else {
    rayCol.xyz += fogCol * rayCol.w * ( 1.0 - decay );
    rayCol.w = 0.0;
  }
}

void reflect() {
  vec3 nor = normalFunc( rayPos, 1E-4 );
  rayDir = reflect( rayDir, nor );
  rayLen = RAYDIST_INIT;
  rayPos = rayBeg + rayDir * rayLen;
}

void main() {
  p = ( gl_FragCoord.xy * 2.0 - resolution ) / resolution.x;

  setCamera();
  initRay();

  for ( int iRefl = 0; iRefl < REFLECT_ITER; iRefl ++ ) {
    march();
    shade();
    if ( rayCol.w < 0.01 ) { break; }
    reflect();
  }

  gl_FragColor = vec4( rayCol.xyz, 1.0 );
}
