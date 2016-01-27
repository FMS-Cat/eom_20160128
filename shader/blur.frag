precision highp float;

uniform float time;
uniform vec2 resolution;
uniform float iBlur;
uniform float blurCount;

uniform sampler2D textureRender;
uniform sampler2D textureBlur;

#define V vec2(0.,1.)
#define saturate(i) clamp(i,0.,1.)

void main() {
	vec2 uv = gl_FragCoord.xy / resolution;

	vec3 ret = V.xxx;
	if ( 0.0 != iBlur ) {
		ret += texture2D( textureBlur, uv ).xyz;
	}
	ret += texture2D( textureRender, uv ).xyz / blurCount;

	gl_FragColor = vec4( ret, 1.0 );
}
