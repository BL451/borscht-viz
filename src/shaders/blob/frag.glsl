precision mediump float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform float u_z;
uniform float u_level;
uniform bool u_ssao;

#define MAX_STEPS 25
#define MAX_DIST 10.
#define SURF_DIST.01

// SDFs and operations from Inigo Quilez:
// https://iquilezles.org/articles/distfunctions/

float sdSphere(vec4 s,vec3 p){
    return length(p-s.xyz)-s.w;
}

float sdPlane(vec3 p){
    // Assumes you want a plane with normal vec3(0, 1, 0) at y=0;
    return p.y;
}

float opSmoothUnion(float d1,float d2,float k)
{
    float h=clamp(.5+.5*(d2-d1)/k,0.,1.);
    return mix(d2,d1,h)-k*h*(1.-h);
}

// Much of the content below is informed by these tutorials + my comments and some modifications:
// https://www.youtube.com/watch?v=PGtv-dBi2wE&list=PLGmrMu-IwbgtMxMiV3x4IrHPlPmg7FD-P&index=2
// https://www.youtube.com/watch?v=2YZClgDWCaM
// https://www.youtube.com/watch?v=6zYTrFRVGiU

// Gets the distance to all objects in the scene, essentially where we set up the scene
// This is a few spheres and a ground plane that morph together using a smooth union operation
float GetDist(vec3 p){
    // x, y, z, r of the spheres
    float so=0.;
    float d=10.;
    for(float i=0.;i<13.;i++){
        vec4 so=vec4(u_level*sin(.2*i+u_z)*cos(i+.5*u_z),1.+u_level*sin(i*.1)*sin(i+.8*u_z),5.+u_level*cos(i*.6)*sin(i+.55*u_z),.1+.3*abs(sin(u_z+i)));
        d=opSmoothUnion(d,sdSphere(so,p),u_level*abs(.4*sin(i)));
    }
    //float planeDist = sdPlane(p);
    
    //d = opSmoothUnion(d, planeDist, 0.3);
    return d;
}

// March the ray!
float RayMarch(vec3 ro,vec3 rd){
    float dO=0.;
    
    for(int i=0;i<MAX_STEPS;i++){
        // Ray origin + ray direction * distance from the origin
        vec3 p=ro+rd*dO;
        // Get the distance to the scene
        float dS=GetDist(p);
        dO+=dS;
        // Either past the max distance or collided with a surface
        if(dO>MAX_DIST||dS<SURF_DIST)break;
    }
    return dO;
}

// Used to get soft shadows
float RayMarchSoft(vec3 ro,vec3 rd){
    float dO=.15;
    
    float res=1.;
    for(int i=0;i<MAX_STEPS;i++){
        // Ray origin + ray direction * distance from the origin
        vec3 p=ro+rd*dO;
        // Get the distance to the scene
        float dS=GetDist(p);
        if(dS<.01)return 0.;
        dO+=dS;
        // This value is the main thing that tracks the proximity to a surface and allows us to get the softness
        res=min(res,3.*dS/dO);
        if(dO>MAX_DIST)break;
    }
    return res;
}

// Get normal by testing another point very close and getting the slope
vec3 GetNormal(vec3 p){
    float d=GetDist(p);
    vec2 e=vec2(.01,0);
    // e.xyy == vec3(.01, 0, 0), etc. Just a faster way to write by swizzling
    vec3 n=d-vec3(GetDist(p-e.xyy),
    GetDist(p-e.yxy),
    GetDist(p-e.yyx));
    
    return normalize(n);
}

// Ambient occlusion
float ao(vec3 p,vec3 n){
    float e=.01;
    float res=0.;
    // Starting weight for the arithmetic series (1/2 + 1/4 + 1/8 + ...)
    float weight=.5;
    
    // Increasing or decreasing the iteration count affects resolution
    for(int i=0;i<8;++i){
        float d=e*float(i);
        // Weight is used to give priority to terms earlier in the sequence
        res+=weight*(1.-(d-GetDist(p+d*n)));
        weight*=.5;
    }
    
    return res;
}

float GetLight(vec3 p,vec3 lightPos,bool soft_shadow){
    // Move the light around
    //lightPos.xz += vec2(sin(0.5*u_z), cos(0.5*u_z))*3.;
    // Normalized direction vector between the light and the surface point
    vec3 l=normalize(lightPos-p);
    // Normal vector of the surface point
    vec3 n=GetNormal(p);
    
    float dif=clamp(dot(n,l),0.,1.);
    // Hard shadow calculation
    // Ray march from point p in the direction of the light, need to increase the distance slightly otherwise almost everything appears to be in shadow
    float d=0.;
    if(soft_shadow){
        float d=RayMarchSoft(p+n*SURF_DIST,l);
        dif*=d;
        float indirectLight=(1.-ao(p,n));
        dif+=indirectLight;
    }else{
        d=RayMarch(p+n*SURF_DIST*1.5,l);
        if(d<length(lightPos-p))dif*=.1;
    }
    
    return dif;
}

void main(){
    vec2 uv=(gl_FragCoord.xy-.5*u_resolution.xy)/u_resolution.y;
    uv.y=-uv.y;
    
    vec3 col=vec3(0);
    
    // Ray origin
    vec3 ro=vec3(0,1,0);
    // Ray direction
    vec3 rd=normalize(vec3(uv.x,uv.y,1));
    
    float d=RayMarch(ro,rd);
    
    vec3 p=ro+rd*d;
    
    /*
    // Diffuse lighting
    float dif = GetLight(p, vec3(0,4,5), u_ssao);
    //dif = max(dif, GetLight(p, vec3(-2,4,6), u_ssao));
    // Modify contrast
    
    float s_c = 0.3;
    float boost = 0.15;
    if (dif < s_c){
        dif += boost*(s_c-dif);
    }
    */
    
    // Distance is greater than 1 so we need to scale it to see anything, put this into col if you want to show a depth map rather than lighting
    d/=8.;
    d=pow(d,2.);
    d=1.-d;
    
    col+=vec3(d,0.,0.);
    gl_FragColor=vec4(col,1.);
}