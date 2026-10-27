"use strict";
// Native mobile apps (Expo, React Native), like superapp: the owner asks for an iPhone or Android
// app and gets real native screens, not a website in a wrapper.
// - The code is React Native (View, Text, Pressable, FlatList…) with a small kit
//   (src/components/native.jsx) and the design's colours in src/theme.js.
// - The preview runs the same code in the browser through react-native-web (MIT), in the phone frame.
// - "Run on your phone" uploads the code to Expo Snack (snack-sdk, MIT) and shows a QR code the
//   free Expo Go app opens; the download is a ready Expo project (npx expo start).
// Left out of this first version: the Kairoq backend (sign-in, saved records) on the phone,
// native-only modules (camera, AR, notifications), App Store and Google Play publishing.
const clip=(v,n)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);

// A request for a phone app. "Build a mobile app:" is what Kairoq's home page sends.
function wanted(text){
 const t=String(text||'');
 return /^Build a mobile app:/i.test(t)||/\b(iphone|ios|android|native|mobile|phone)\s+(app|application)\b/i.test(t)||/\bapp store\b|\bplay store\b|\bexpo\b|\breact native\b/i.test(t);
}
function enabled(meta){return Boolean(meta&&meta.native&&meta.native.enabled)}
const SDK=()=>process.env.KAIROQ_EXPO_SDK||require('snack-content').defaultSdkVersion;

// ---------- the design as React Native values ----------
function hex(v,fallback){return /^#[0-9a-f]{6}$/i.test(String(v||''))?String(v):fallback}
function themeFile(design){
 const p=(design&&design.palette)||{};
 const r=Math.max(0,Math.min(24,parseFloat(String((design&&design.radius)||'12'))*(/rem$/.test(String(design&&design.radius||''))?16:1)||12));
 const t={background:hex(p.background,'#ffffff'),text:hex(p.foreground,'#111111'),primary:hex(p.primary,'#1f4ed8'),onPrimary:'#ffffff',surface:hex(p.secondary||p.muted,'#f2f2f4'),muted:hex(p.muted,'#f4f4f5'),accent:hex(p.accent,hex(p.primary,'#1f4ed8'))};
 // Text on the main colour: white or near-black, whichever reads better.
 const lum=h=>{const n=parseInt(h.slice(1),16),c=[n>>16&255,n>>8&255,n&255].map(x=>{x/=255;return x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};
 t.onPrimary=lum(t.primary)>0.4?'#111111':'#ffffff';
 return `// The app's design (colours from the design brief). Use these, never hard-coded colours.
export const colors = ${JSON.stringify({...t,subtle:'rgba(0,0,0,0.55)',line:'rgba(0,0,0,0.08)'},null,2)};
export const radius = ${Math.round(r)};
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const type = {
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
};
`;
}

// ---------- the starter ----------
const MAIN=`// The preview in the browser: the same React Native code through react-native-web (Kairoq).
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
const style = document.createElement('style');
style.textContent = 'html,body,#root{height:100%;margin:0}#root{display:flex;flex-direction:column}';
document.head.append(style);
createRoot(document.getElementById('root')).render(<App />);
`;
const KIT=`// Kairoq's native kit: the building blocks of an iPhone and Android app, in the app's design.
// Screen (safe area, large title, scrolling), Button, Card, ListRow, Field, TabBar.
import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, SafeAreaView, StyleSheet } from 'react-native';
import { colors, radius, space, type } from '../theme.js';

export function Screen({ title, subtitle, children, scroll = true, footer }) {
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={s.safe}>
      <Body style={s.body} contentContainerStyle={scroll ? s.content : undefined}>
        {title ? <Text style={s.title} accessibilityRole="header">{title}</Text> : null}
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        {children}
      </Body>
      {footer}
    </SafeAreaView>
  );
}
export function Button({ title, onPress, variant = 'primary', disabled }) {
  const ghost = variant !== 'primary';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={({ pressed }) => [s.button, ghost ? s.ghost : s.primary, (pressed || disabled) && { opacity: 0.7 }]}>
      <Text style={[s.buttonText, { color: ghost ? colors.text : colors.onPrimary }]}>{title}</Text>
    </Pressable>
  );
}
export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function ListRow({ title, subtitle, right, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.muted }]}>
      <View style={{ flex: 1 }}>
        <Text style={type.body}>{title}</Text>
        {subtitle ? <Text style={[type.small, { color: colors.subtle }]}>{subtitle}</Text> : null}
      </View>
      {right ? <Text style={[type.small, { color: colors.subtle }]}>{right}</Text> : null}
    </Pressable>
  );
}
export function Field({ label, ...props }) {
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Text style={[type.small, { color: colors.subtle }]}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.subtle} style={s.field} accessibilityLabel={label} {...props} />
    </View>
  );
}
// Bottom tabs: tabs = [{ key, label }], the screen for the active one is shown above.
export function TabBar({ tabs, active, onChange }) {
  return (
    <View style={s.tabs} accessibilityRole="tablist">
      {tabs.map((t) => (
        <Pressable key={t.key} onPress={() => onChange(t.key)} accessibilityRole="tab" accessibilityState={{ selected: t.key === active }} style={s.tab}>
          <View style={[s.dot, t.key === active && { backgroundColor: colors.primary }]} />
          <Text style={[s.tabText, t.key === active && { color: colors.text, fontWeight: '600' }]}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },
  title: { ...type.title, color: colors.text, marginTop: space.sm },
  subtitle: { ...type.body, color: colors.subtle, marginTop: -space.sm },
  button: { minHeight: 50, borderRadius: radius, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  primary: { backgroundColor: colors.primary },
  ghost: { backgroundColor: colors.muted },
  buttonText: { fontSize: 17, fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderRadius: radius, padding: space.md, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: space.sm, paddingHorizontal: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  field: { minHeight: 48, borderRadius: radius, paddingHorizontal: space.md, backgroundColor: colors.muted, color: colors.text, fontSize: 16 },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.background, paddingBottom: 6 },
  tab: { flex: 1, alignItems: 'center', paddingTop: 8, gap: 4, minHeight: 50 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'transparent' },
  tabText: { fontSize: 12, color: colors.subtle },
});
`;
const APP=name=>`// ${clip(name,60)}: the app's first screen (Kairoq starter).
import React from 'react';
import { Text } from 'react-native';
import { Screen, Card } from './components/native.jsx';
import { type } from './theme.js';

export default function App() {
  return (
    <Screen title=${JSON.stringify(clip(name,40)||'My app')}>
      <Card><Text style={type.body}>Describe your app in the chat and Kairoq will build it.</Text></Card>
    </Screen>
  );
}
`;
function starterFiles(name,design){
 return{'src/main.jsx':MAIN,'src/App.jsx':APP(name),'src/theme.js':themeFile(design),'src/components/native.jsx':KIT};
}
const KIT_FILES=['src/main.jsx','src/components/native.jsx'];
function isKitFile(n,code){return(n==='src/main.jsx'&&code===MAIN)||(n==='src/components/native.jsx'&&code===KIT)}

// ---------- what the builder is told ----------
function promptNote(meta){
 if(!enabled(meta))return'';
 return`

This project is a NATIVE MOBILE APP (Expo, React Native) for iPhone and Android, not a website. It overrides the web rules above:
- Use only react and react-native: View, Text, Pressable, ScrollView, FlatList, SectionList, TextInput, Image (with a uri), Switch, Modal, ActivityIndicator, SafeAreaView, StyleSheet, Platform, Alert, Linking. No HTML elements (div, span, button, img, a, form, input), no className or Tailwind, no CSS files, no react-router, no lucide-react, no window or document, no kairoq imports (the backend is not on the phone yet; keep data in component state with clear sample data).
- Start from the kit in src/components/native.jsx (Screen, Button, Card, ListRow, Field, TabBar) and the design values in src/theme.js (colors, radius, space, type). Never hard-code colours; every style goes in StyleSheet.create.
- Navigation: 2 to 5 main sections in a bottom TabBar, kept in App.jsx state; a detail screen opens by state (no navigation library). Large titles, 16 px side padding, touch targets at least 44 px, the system font.
- Keep src/main.jsx as it is (it only starts the browser preview). One file per screen in src/screens/.`;
}
// The first build of a native app: a finished app with its main screens, not a web page.
const FIRST_BUILD=`This is the first build of a NATIVE MOBILE APP (React Native, see the native rules). Deliver the whole first version the request describes, finished and designed:
- 2 to 5 main sections in a bottom TabBar (App.jsx keeps the active tab in state), one file per screen in src/screens/, each screen in the kit's Screen with a large title.
- Lists with ListRow or FlatList, detail views opened by state with a back button, forms with Field and Button that validate and confirm (Alert or an on-screen message), empty states that say what to do.
- Sample data in src/data/ that sounds real for this business, clearly sample where facts are unknown; never invented reviews or numbers presented as real.
- Use the colours, radius and spacing in src/theme.js; the system font; generous spacing; nothing that looks like a website (no hero banners, no footers, no navigation bars at the top with links).
In "message", say in two or three sentences what you built and what to try first.`;
// Mistakes that only show on the phone: HTML elements, Tailwind classes, web-only imports.
function problems(files){
 const out=[];
 for(const [n,code] of Object.entries(files||{})){
  if(!/^src\/.*\.(jsx?|tsx?)$/.test(n)||n==='src/main.jsx'||typeof code!=='string')continue;
  const html=/<(div|span|button|img|a|form|input|section|header|footer|main|nav|ul|li|p|h[1-6])[\s>/]/.exec(code);
  if(html)out.push(n+' uses the HTML element <'+html[1]+'>; this is a native app: use View, Text, Pressable, Image or TextInput from react-native.');
  if(/\bclassName=/.test(code))out.push(n+' uses className; native apps style with StyleSheet.create and the values in src/theme.js.');
  const web=/from\s+['"](react-router-dom|lucide-react|framer-motion|kairoq[^'"]*|react-dom[^'"]*)['"]/.exec(code);
  if(web)out.push(n+' imports '+web[1]+', which does not run in a native app. Use react-native and the kit instead.');
 }
 return out.slice(0,8);
}

// ---------- on the phone: Expo Snack and Expo Go ----------
// The project as a Snack: App.js starts src/App; .jsx files become .js (Snack's bundler) and the
// imports follow. The browser-only main.jsx and CSS files stay out.
function snackFiles(files){
 const out={'App.js':{type:'CODE',contents:"export { default } from './src/App';\n"}};
 const rename=n=>n.replace(/\.jsx$/,'.js');
 for(const [n,code] of Object.entries(files||{})){
  if(!/^src\/.*\.(jsx?|json)$/.test(n)||n==='src/main.jsx'||typeof code!=='string')continue;
  out[rename(n)]={type:'CODE',contents:code.replace(/(from\s+['"]\.{1,2}\/[^'"]+?)\.jsx(['"])/g,'$1$2').replace(/(import\(\s*['"]\.{1,2}\/[^'"]+?)\.jsx(['"])/g,'$1$2')};
 }
 return out;
}
// Uploads the version to Expo's servers; returns the link Expo Go opens and the Snack page.
async function runOnPhone(meta,files,{fetchImpl}={}){
 const {Snack,setSnackSDKFetch}=require('snack-sdk');
 if(fetchImpl&&setSnackSDKFetch)setSnackSDKFetch(fetchImpl);
 const snack=new Snack({name:clip(meta.name,60)||'Kairoq app',description:'Made with Kairoq',sdkVersion:SDK(),files:snackFiles(files),dependencies:{}});
 try{
  const saved=await snack.saveAsync();
  const page='https://snack.expo.dev/'+(saved.hashId||saved.id);
  return{exp_url:saved.url,snack_url:page,sdk:SDK(),qr:require('./react-mobile').qrSvg(saved.url)};
 }finally{try{snack.setOnline&&snack.setOnline(false)}catch{}}
}

// ---------- the download: a ready Expo project ----------
function expoProject(files,meta){
 const slug=clip(meta.name,40).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'app';
 const sdk=SDK(),major=sdk.split('.')[0];
 const out={};
 for(const [n,f] of Object.entries(snackFiles(files)))out[n]=f.contents;
 out['package.json']=JSON.stringify({name:slug,version:'1.0.0',main:'expo/AppEntry.js',private:true,scripts:{start:'expo start',android:'expo start --android',ios:'expo start --ios',web:'expo start --web'},dependencies:{expo:'~'+major+'.0.0',react:'*','react-native':'*'}},null,2)+'\n';
 out['app.json']=JSON.stringify({expo:{name:clip(meta.name,45)||'App',slug,version:'1.0.0',orientation:'portrait',userInterfaceStyle:'light',ios:{supportsTablet:true},android:{}}},null,2)+'\n';
 out['babel.config.js']="module.exports = function (api) {\n  api.cache(true);\n  return { presets: ['babel-preset-expo'] };\n};\n";
 out['README.md']=`# ${clip(meta.name,60)||'App'}\n\nMade with Kairoq. A React Native app built with Expo.\n\n1. Install Node.js 20 or newer.\n2. In this folder run \`npm install\`, then \`npx expo install --fix\` (it sets react and react-native to the versions this Expo SDK needs), then \`npx expo start\`.\n3. Scan the QR code with the Expo Go app (iPhone camera or Android) to open it on your phone.\n\nTo publish to the App Store and Google Play, use EAS Build: https://docs.expo.dev/build/introduction/\n`;
 return out;
}
module.exports={FIRST_BUILD,wanted,enabled,themeFile,starterFiles,KIT_FILES,isKitFile,promptNote,problems,snackFiles,runOnPhone,expoProject,SDK,MAIN,KIT};
