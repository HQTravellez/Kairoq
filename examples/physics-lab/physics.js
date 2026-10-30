"use strict";
const g=9.80665;
function check(value,name,min=0){if(typeof value!=="number"||!Number.isFinite(value)||value<min)throw Error(name+" must be finite and >= "+min);return value}
function projectile({speed,angleDeg,gravity=g,height=0}){check(speed,"speed");check(angleDeg,"angleDeg",-90);check(gravity,"gravity",0.000001);check(height,"height");if(angleDeg>90)throw Error("Angle outside -90 to 90");const a=angleDeg*Math.PI/180,vx=speed*Math.cos(a),vy=speed*Math.sin(a),flightTime=(vy+Math.sqrt(vy*vy+2*gravity*height))/gravity;return{flightTime,range:vx*flightTime,maxHeight:height+Math.max(0,vy)**2/(2*gravity),vx,vy}}
function atTime(o,t){check(t,"time");const p=projectile(o);return{x:p.vx*t,y:(o.height||0)+p.vy*t-0.5*(o.gravity||g)*t*t}}
function pendulum({length,gravity=g,amplitudeDeg=10}){check(length,"length",0.000001);check(gravity,"gravity",0.000001);check(amplitudeDeg,"amplitude");if(amplitudeDeg>20)throw Error("Small-angle model supports amplitudes ≤20 degrees");const period=2*Math.PI*Math.sqrt(length/gravity);return{period,frequency:1/period,angularFrequency:2*Math.PI/period}}
function pendulumAtTime(o,t){check(t,"time");const p=pendulum(o);return{angleDeg:(o.amplitudeDeg??10)*Math.cos(p.angularFrequency*t)}}
function spring({mass,stiffness,amplitude=0.1}){check(mass,"mass",0.000001);check(stiffness,"stiffness",0.000001);check(amplitude,"amplitude");const omega=Math.sqrt(stiffness/mass),period=2*Math.PI/omega;return{period,frequency:1/period,omega,maxEnergy:0.5*stiffness*amplitude**2}}
function springAtTime(o,t){check(t,"time");const r=spring(o),x=(o.amplitude??0.1)*Math.cos(r.omega*t),v=-(o.amplitude??0.1)*r.omega*Math.sin(r.omega*t);return{displacement:x,velocity:v,kinetic:0.5*o.mass*v*v,potential:0.5*o.stiffness*x*x}}
module.exports={g,projectile,atTime,pendulum,pendulumAtTime,spring,springAtTime};
