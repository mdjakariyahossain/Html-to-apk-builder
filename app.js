const source=document.getElementById('source'),status=document.getElementById('fileStatus'),message=document.getElementById('message');
let selectedFile=null;
source.addEventListener('change',()=>{selectedFile=source.files[0]||null;status.textContent=selectedFile?`নির্বাচিত: ${selectedFile.name} (${(selectedFile.size/1024).toFixed(1)} KB)`:'কোনো ফাইল নির্বাচন করা হয়নি';});
function safeId(v){return /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/i.test(v);}
document.getElementById('buildBtn').addEventListener('click',async()=>{
 message.textContent='';const name=document.getElementById('appName').value.trim(),appId=document.getElementById('appId').value.trim(),html=document.getElementById('htmlCode').value.trim();
 if(!name){message.textContent='অ্যাপের নাম লিখো।';return;}
 if(!safeId(appId)){message.textContent='সঠিক Package name দাও, যেমন com.example.myapp';return;}
 if(!selectedFile&&!html){message.textContent='একটি HTML বা ZIP ফাইল নির্বাচন করো, অথবা HTML কোড পেস্ট করো।';return;}
 if(typeof JSZip==='undefined'){message.textContent='ZIP লাইব্রেরি লোড হয়নি। ইন্টারনেট সংযোগ দিয়ে আবার চেষ্টা করো।';return;}
 const zip=new JSZip();let webFiles={};
 try{
  if(selectedFile&&/\.zip$/i.test(selectedFile.name)){
   const input=await JSZip.loadAsync(selectedFile);
   for(const [path,file] of Object.entries(input.files)){if(!file.dir&&!path.startsWith('__MACOSX/'))webFiles[path.replace(/^\/+/,'')]=await file.async('uint8array');}
   if(!Object.keys(webFiles).some(p=>p.split('/').pop()==='index.html'))throw Error('ZIP-এর মধ্যে index.html পাওয়া যায়নি।');
  }else if(selectedFile){webFiles['index.html']=await selectedFile.text();}
  else webFiles['index.html']=html;
  for(const [path,data] of Object.entries(webFiles))zip.file('www/'+path,data);
  zip.file('package.json',JSON.stringify({name:'html-to-android-app',version:'1.0.0',private:true,scripts:{'build:android':'npx cap sync android'},dependencies:{'@capacitor/android':'^6.2.1','@capacitor/core':'^6.2.1'},devDependencies:{'@capacitor/cli':'^6.2.1'}},null,2));
  zip.file('capacitor.config.json',JSON.stringify({appId,appName:name,webDir:'www',bundledWebRuntime:false},null,2));
  zip.file('.github/workflows/build-apk.yml',workflow);
  zip.file('README-BN.md',readme(name));
  const blob=await zip.generateAsync({type:'blob'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='android-project-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.zip';a.click();URL.revokeObjectURL(url);
  message.textContent='Project ZIP তৈরি হয়েছে! এবার ZIP extract করে GitHub repository-তে upload করো।';
 }catch(e){message.textContent='সমস্যা: '+e.message;}
});
const workflow=`name: Build Android APK
on:
  workflow_dispatch:
  push:
    branches: [ main ]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
      - name: Setup Android SDK
        uses: android-actions/setup-android@v3
      - name: Install dependencies
        run: npm install
      - name: Add Android platform
        run: npx cap add android
      - name: Sync web assets
        run: npx cap sync android
      - name: Build debug APK
        working-directory: android
        run: chmod +x gradlew && ./gradlew assembleDebug
      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: android-debug-apk
          path: android/app/build/outputs/apk/debug/app-debug.apk
`;
function readme(name){return `# ${name} — Android APK project
## বাংলায় APK build করার নিয়ম
1. এই ZIP extract করো।
2. GitHub-এ একটি নতুন repository তৈরি করো।
3. Extract করা সব ফাইল repository-র root-এ upload/commit করো (শুধু ZIP ফাইলটি নয়)।
4. repository-র Actions tab খোলো। প্রথমবার GitHub Actions enable করতে হতে পারে।
5. **Build Android APK** workflow নির্বাচন করে **Run workflow** চাপো। main branch-এ push করলেও build শুরু হবে।
6. Build শেষ হলে workflow run-এর নিচের **Artifacts** থেকে \`android-debug-apk\` download করো।
7. Artifact ZIP extract করলে \`app-debug.apk\` পাবে।

## গুরুত্বপূর্ণ
- এটি একটি **debug APK**, পরীক্ষা ও sideload করার জন্য। Play Store release-এর জন্য আলাদা signed release build ও keystore দরকার।
- ZIP project-এ \`www/index.html\` থাকতে হবে। আপলোড করা ZIP-এর ভেতরের HTML/CSS/JS ফাইলগুলো \`www/\`-এ রাখা হয়।
- Android APK তৈরি করতে GitHub Actions-এ internet access ও Android SDK build environment লাগে।
- GitHub account-এ repository এবং Actions ব্যবহারের অনুমতি থাকতে হবে।
`;}
