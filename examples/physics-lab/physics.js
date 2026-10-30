"use strict";
/** Reference numerical physics for Kairoq acceptance tests. SI units. */
const g=9.80665;
function finite(v,name){if(typeof v!=="number"||!Number.isFinite(v))throw Error(name+" must be finite");return v}
function projectile({speed,angleDeg,gravity=g,height=0}){
 finite(speed,"speed");finite(angleDeg,"angleDeg");finite(gravity,"gravity");finite(height,"height");
 if(speed<0||gravity<=0||height<0||Math.abs(angleDeg)>90)throw Error("Invalid physical input");
 const a=angleDeg*Math.PI/180,vx=speed*Math.cos(a),vy=speed*Math.sin(a);
 const time=(vy+Math.sqrt(vy*vy+2*gravity*height))/gravity;
 const range=vx*time,peak=height+Math.max(0,vy)**2/(2*gravity);
 return {flightTime:time,range,maxHeight:peak,vx,vy};
}
function atTime({speed,angleDeg,gravity=g,height=0},t){finite(t,"time");if(t<0)throw Error("Time cannot be negative");const p=projectile({speed,angleDeg,gravity,height});return{x:p.vx*t,y:height+p.vy*t-0.5*gravity*t*t}}
module.exports={projectile,atTime,g};
