const { chromium } = require('playwright');
const { createApp } = require('../server');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
(async () => {
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'weather-live-preview-'));
 const output=path.join(process.cwd(), 'test-results/live');
 await fs.mkdir(output,{recursive:true});
 await fs.writeFile(path.join(dir,'settings.json'),JSON.stringify({weatherProvider:'open-meteo',mapProvider:'osm',startingLat:'13.94',startingLon:'121.62'}),{mode:0o600});
 const app=createApp({settingsFile:path.join(dir,'settings.json')});
 const server=app.listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 let browser;
 try {
  browser=await chromium.launch({executablePath:process.env.BROWSER_PATH,headless:true});
  const context=await browser.newContext({viewport:{width:800,height:480},timezoneId:'Asia/Manila',locale:'en-US',deviceScaleFactor:1});
  const page=await context.newPage();
  const errors=[],responses=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{const u=new URL(r.url());if(u.hostname!=='127.0.0.1'||u.pathname.startsWith('/api/'))responses.push({host:u.hostname,path:u.pathname,status:r.status()});});
  const base=`http://127.0.0.1:${server.address().port}`;
  await page.goto(base);
  await page.getByText('Weather: Open-Meteo (model estimate)',{exact:true}).waitFor({timeout:45000});
  await page.locator('canvas').nth(1).waitFor();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('img.leaflet-tile-loaded')).some(i=>i.src.includes('tile.openstreetmap.org')),{},{timeout:30000});
  // Wait for requested visible imagery to settle; never prefetch off-screen tiles.
  await page.waitForLoadState('networkidle',{timeout:20000}).catch(()=>{});
  await page.screenshot({path:path.join(output,'pi-weather-station-live-touchscreen.png')});
  await page.setViewportSize({width:390,height:844});
  await page.waitForLoadState('networkidle',{timeout:15000}).catch(()=>{});
  await page.screenshot({path:path.join(output,'pi-weather-station-live-phone.png'),fullPage:true});
  await page.getByRole('button',{name:'Open settings',exact:true}).click();
  await page.getByLabel('Weather provider',{exact:true}).waitFor();
  await page.locator('.animate-enter-done').waitFor();
  await page.screenshot({path:path.join(output,'pi-weather-station-no-account-settings.png')});
  const summary={capturedAt:new Date().toISOString(),location:'Lucena, Philippines (example coordinates 13.94, 121.62)',simulated:false,viewport:[800,480],phoneViewport:[390,844],errors,services:responses.reduce((a,r)=>{const k=r.host+(r.host==='127.0.0.1'?r.path:'');if(!a[k])a[k]={statuses:[],requests:0};if(!a[k].statuses.includes(r.status))a[k].statuses.push(r.status);a[k].requests++;return a;},{})};
  await fs.writeFile(path.join(output,'capture-check.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary));
 } finally {
  if(browser)await browser.close();
  await new Promise(r=>{server.closeAllConnections();server.close(r);});
  await fs.rm(dir,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
