const fs=require('fs'),vm=require('vm');
const path=require('path');
const mobile=process.env.BEATFALL_TEST_MOBILE || path.resolve(__dirname,'../mobile');
const root=path.join(mobile,'node_modules')+'/';
const babel=require(root+'@babel/core');
let src=fs.readFileSync(process.env.BEATFALL_TEST_CAPTURE || path.join(mobile,'src/Capture.js'),'utf8').replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm,'').replace('export default function Capture','function Capture');
src=babel.transformSync(src,{configFile:false,babelrc:false,plugins:[require(root+'@babel/plugin-transform-react-jsx')]}).code+'\nthis.Capture=Capture;';
let checks=0;function assert(ok,msg){if(!ok)throw Error(msg);checks++;console.log('PASS '+msg);}
function harness(){
 let slots=[],at=0,tree,saved=[],fail=false,promote=false,effects=[];
 const hook=v=>{let i=at++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];};
 const element=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(Boolean)});
 const ctx={__DEV__:false,React:{createElement:element},useState:hook,useRef:v=>hook({current:v})[0],useEffect:()=>{},useCallback:f=>f,useColorScheme:()=> 'light',useSafeAreaInsets:()=>({top:0,bottom:0}),palette:()=>({}),radius:{},font:{},StyleSheet:{create:x=>x},Platform:{OS:'ios'},UIManager:{},LayoutAnimation:{configureNext(){},create(){} ,Types:{easeInEaseOut:1},Properties:{opacity:1}},Keyboard:{dismiss(){}},Haptics:{impactAsync:async()=>{},notificationAsync:async()=>{},ImpactFeedbackStyle:{Light:1},NotificationFeedbackType:{Error:1,Success:1}},Alert:{alert(){}},SYNC_ENABLED:true,BUILD:'test',Lockup:'Lockup',Account:'Account',ScriptSheet:'ScriptSheet',useScripts:()=>({scripts:[{id:'old',name:'Old title'}],reload(){}}),rememberScript:()=>{},lastScript:async()=>({project:{id:'remote',name:'New title'}}),runSync:async()=>({promoted:promote,sent:0}),photos:{fromCamera:async()=>({uri:'photo'}),fromLibrary:async()=>({uri:'library'}),drop(){}},store:{list:async()=>saved,counts:async()=>({waiting:saved.length,total:saved.length}),sentTally:async()=>0,add:async(text,script,pic)=>{if(fail)throw Error('disk');saved.push({text,script,pic});}},setTimeout:()=>{}};
 for(const name of ['FlatList','Image','KeyboardAvoidingView','Pressable','Text','TextInput','View'])ctx[name]=name;
 vm.createContext(ctx);vm.runInContext(src,ctx);
 ctx.useEffect=(fn,deps)=>{const [previous,set]=hook(null);if(!previous||!deps||deps.some((v,i)=>v!==previous[i])){set(deps||[]);effects.push(fn);}};
 function render(){at=0;tree=ctx.Capture({email:'test@example.com'});const run=effects;effects=[];run.forEach(fn=>fn());return tree;}
 function all(node=tree){return [node,...(node.children||[]).flatMap(c=>typeof c==='object'?all(c):[])];}
 const find=(type,test=()=>true)=>all().find(n=>n.type===type&&test(n.props));
 const input=()=>find('TextInput');const picker=()=>find('ScriptSheet');
 const button=label=>find('Pressable',p=>p.accessibilityLabel===label);
 const select=p=>{picker().props.onPick(p);picker().props.onClose();render();};
 return {render,input,picker,button,select,saved,setFail:v=>fail=v,setPromote:v=>promote=v};
}
(async()=>{
 const h=harness();h.render();
 assert(!h.input().props.editable,'initial capture locked despite existing project');
 h.input().props.onChangeText('unfiled paste');h.render();assert(h.input().props.value==='','unselected paste cannot enter draft');
 assert(h.button('Take a photograph for this note').props.disabled,'camera locked before title');
 assert(h.button('Choose a picture from this phone').props.disabled,'library locked before title');
 h.select({id:'a',name:'Starting Over'});assert(h.input().props.editable,'explicit existing title unlocks capture');
 h.input().props.onChangeText('first note');h.render();await h.button('Keep this note').props.onPress();h.render();
 assert(h.saved[0].script.id==='a'&&h.saved[0].text==='first note','saved note keeps selected project');
 assert(!h.input().props.editable&&h.input().props.value==='','successful Keep clears draft and locks next note');
 h.setPromote(true);await h.button('Send 1 notes to your account').props.onPress();h.render();assert(!h.input().props.editable,'Send promotion cannot unlock next capture');
 h.select({id:'local:new',name:'New Day'});h.input().props.onChangeText('second note');h.render();h.setFail(true);await h.button('Keep this note').props.onPress();h.render();
 assert(h.input().props.editable&&h.input().props.value==='second note','failed save preserves title and draft');
 h.setFail(false);await h.button('Keep this note').props.onPress();h.render();assert(h.saved[1].script.id==='local:new','new title is preserved for next saved note');
 h.select({id:'a',name:'Starting Over'});await h.button('Take a photograph for this note').props.onPress();h.render();await h.button('Keep this note').props.onPress();h.render();
 assert(h.saved[2].pic.uri==='photo'&&h.saved[2].text==='','photo-only note saves under selected title');
 assert(!h.input().props.editable,'photo Keep requires another title selection');
 console.log(checks+' capture behavior checks passed');
})().catch(e=>{console.error(e);process.exit(1);});
