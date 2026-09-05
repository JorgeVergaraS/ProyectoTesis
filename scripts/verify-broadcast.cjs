// Local E2E: npm install playwright (or supply NODE_PATH to a tooling installation).
// Requires Angular, Spring and LiveKit running. Uses generated media, never real devices.
const { chromium } = require('playwright');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const origin = process.env.NEXO_TEST_URL || 'http://127.0.0.1:4200';

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const errors = [];
  const contexts = [];
  let hostToken, currentId;
  async function api(path, token, method = 'GET', body) {
    const response = await fetch(origin + '/api' + path, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.ok(response.ok, `API ${method} ${path}: ${response.status}`);
    return response.status === 204 ? null : response.json();
  }
  async function account(role) {
    const credentialsPath = `.tmp/sfu-${role}.json`;
    let registration;
    if (fs.existsSync(credentialsPath)) {
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      registration = await api('/auth/login', null, 'POST', credentials);
    } else {
      const credentials = { email: `sfu-${role}-${randomUUID()}@nexo.test`, password: randomUUID() };
      registration = await api('/auth/register', null, 'POST', {...credentials, displayName: `Prueba SFU ${role}`});
      fs.writeFileSync(credentialsPath, JSON.stringify(credentials), {mode:0o600});
    }
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    contexts.push(context);
    await context.addInitScript(({ token }) => {
      sessionStorage.setItem('nexo.auth.local-token', token);
      sessionStorage.setItem('nexo.auth.session-kind', 'local');
      window.__mediaRequests = 0;
      window.__tracks = [];
      window.__peers = [];
      window.__rtcDiagnostics = [];
      const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      const NativePeer = window.RTCPeerConnection;
      window.RTCPeerConnection = class extends NativePeer {
        constructor(...args) { super(...args); window.__peers.push(this); }
        close() {
          const candidates = description => (description?.sdp || '').split('\r\n').filter(line => line.startsWith('a=candidate:'));
          window.__rtcDiagnostics.push({state:this.connectionState, ice:this.iceConnectionState, local:candidates(this.localDescription), remote:candidates(this.remoteDescription)});
          super.close();
        }
      };
      async function synthetic(constraints) {
        window.__mediaRequests++;
        // Exercise Chromium's permission/ICE behavior with its built-in fake devices.
        const permissionStream = await nativeGetUserMedia({audio:true});
        permissionStream.getTracks().forEach(track => track.stop());
        const tracks = [];
        if (constraints.video) {
          const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
          const ctx = canvas.getContext('2d');
          let tick = 0;
          const draw = () => { ctx.fillStyle = '#235a84'; ctx.fillRect(0,0,640,360); ctx.fillStyle = '#fff'; ctx.font = '24px sans-serif'; ctx.fillText('Nexo · Video de prueba ' + tick++, 40,180); };
          draw();
          const timer = setInterval(draw, 100);
          const track = canvas.captureStream(10).getVideoTracks()[0];
          track.addEventListener('ended', () => clearInterval(timer)); tracks.push(track);
        }
        if (constraints.audio) {
          const ctx = new AudioContext(); await ctx.resume();
          const oscillator = ctx.createOscillator(); oscillator.frequency.value = 440;
          const destination = ctx.createMediaStreamDestination(); oscillator.connect(destination); oscillator.start();
          const track = destination.stream.getAudioTracks()[0]; tracks.push(track);
        }
        window.__tracks.push(...tracks);
        return new MediaStream(tracks);
      }
      navigator.mediaDevices.getUserMedia = synthetic;
      navigator.mediaDevices.getDisplayMedia = () => synthetic({ video: true });
      navigator.mediaDevices.enumerateDevices = async () => [];
    }, { token: registration.accessToken });
    const page = await context.newPage();
    page.on('response', response => { if (response.status() >= 400) console.error('HTTP', response.status(), new URL(response.url()).pathname); });
    page.on('console', message => { if (message.type() === 'error') console.error('BROWSER', message.text().replace(/eyJ[A-Za-z0-9_.-]+/g, '[token]')); });
    page.on('console', message => { if (message.type() === 'warning' && message.text().startsWith('Broadcast connection:')) console.error(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    return { page, token: registration.accessToken };
  }
  try {
    const host = await account('anfitrion'); hostToken = host.token;
    const viewer = await account('espectador');
    const workspace = await api('/workspace', host.token);
    const channel = workspace.channels.find(c => c.slug === 'general');
    assert.ok(channel);
    await host.page.goto(origin + '/profile');
    await host.page.getByRole('button', { name: 'Preparar transmisión' }).click();
    if (process.env.NEXO_TEST_DEBUG) {
      host.page.on('console', message => { if (message.type() === 'info' && /^(STOP|STATE)/.test(message.text())) console.log(message.text()); });
      await host.page.evaluate(() => {
        const component = window.ng.getComponent(document.querySelector('nexo-broadcast-studio'));
        const stop = component.broadcast.stop.bind(component.broadcast);
        component.broadcast.stop = (...args) => { console.info('STOP', new Error().stack); return stop(...args); };
        const stateSet = component.broadcast.state.set.bind(component.broadcast.state);
        component.broadcast.state.set = value => { console.info('STATE', value); return stateSet(value); };
      });
    }
    await viewer.page.goto(origin + '/?conversation=' + channel.id);
    for (const source of ['CAMERA', 'SCREEN']) {
      if (source === 'SCREEN') await host.page.getByRole('button', { name: 'Pantalla Pantalla y micrófono', exact: true }).click();
      await host.page.getByRole('button', { name: 'Preparar vista previa' }).click();
      await host.page.getByPlaceholder('¿Qué vas a compartir?').fill('Prueba ' + source);
      await host.page.getByRole('button', { name: 'Iniciar transmisión', exact: true }).click();
      await host.page.getByText('En vivo · Los miembros pueden verte y escucharte', {exact: true}).waitFor({timeout: 45000});
      const active = await api(`/conversations/${channel.id}/broadcasts/active`, host.token);
      currentId = active.find(b => b.title === 'Prueba ' + source)?.id;
      assert.ok(currentId, 'Live entry persisted');
      await viewer.page.getByRole('button', {name:'Ver transmisión',exact:true}).click();
      await viewer.page.waitForFunction(() => {
        const video = document.querySelector('nexo-broadcast-viewer video');
        return video && video.videoWidth > 0 && video.currentTime > 0;
      }, {timeout: 45000});
      await viewer.page.waitForFunction(async () => {
        let audio = 0, video = 0;
        for (const peer of window.__peers) {
          for (const stat of (await peer.getStats()).values()) {
            if (stat.type !== 'inbound-rtp') continue;
            if (stat.kind === 'audio') audio += stat.bytesReceived || 0;
            if (stat.kind === 'video') video += stat.bytesReceived || 0;
          }
        }
        return audio > 1000 && video > 1000;
      }, {timeout: 45000});
      assert.equal(await viewer.page.evaluate(() => window.__mediaRequests), 0, 'Viewer must not capture devices');
      const viewerCannotPublish = await viewer.page.evaluate(async () => {
        const component = window.ng.getComponent(document.querySelector('nexo-broadcast-viewer'));
        const canvas = document.createElement('canvas'); canvas.width=160; canvas.height=90;
        const track = canvas.captureStream(1).getVideoTracks()[0];
        try { await component.media.room.localParticipant.publishTrack(track); return false; }
        catch { return true; }
        finally { track.stop(); }
      });
      assert.equal(viewerCannotPublish, true, 'SFU must reject publication by a viewer');
      await host.page.getByRole('button', {name:'Silenciar',exact:true}).click();
      assert.equal(await host.page.evaluate(() => window.__tracks.filter(t => t.kind === 'audio' && t.readyState === 'live').every(t => !t.enabled)), true);
      await host.page.getByRole('button', {name:'Activar micrófono',exact:true}).click();
      await viewer.page.screenshot({path: '.tmp/broadcast-' + source.toLowerCase() + '.png', fullPage:true});
      await host.page.getByRole('button', {name:'Finalizar transmisión',exact:true}).click();
      await viewer.page.getByText('La transmisión finalizó.', {exact:true}).waitFor({timeout:15000});
      assert.equal(await host.page.evaluate(() => window.__tracks.every(t => t.readyState === 'ended')), true);
      console.log(source + ': audio/video received, viewer read-only, mute/resume, remote end and tracks released: PASS');
      currentId = null;
    }
    await host.page.getByRole('button', { name: 'Cámara Cámara y micrófono', exact: true }).click();
    await host.page.getByRole('button', { name: 'Preparar vista previa' }).click();
    await host.page.getByPlaceholder('¿Qué vas a compartir?').fill('Prueba cierre inesperado');
    await host.page.getByRole('button', {name:'Iniciar transmisión',exact:true}).click();
    await host.page.getByText('En vivo · Los miembros pueden verte y escucharte', {exact:true}).waitFor({timeout:45000});
    currentId = (await api(`/conversations/${channel.id}/broadcasts/active`, host.token)).find(b => b.title === 'Prueba cierre inesperado').id;
    await viewer.page.getByRole('button', {name:'Ver transmisión',exact:true}).click();
    await viewer.page.locator('nexo-broadcast-viewer').waitFor();
    await host.page.close({runBeforeUnload:false});
    console.log('Host closed unexpectedly; checking server lease cleanup (up to 110 seconds)…');
    await viewer.page.getByText('La transmisión finalizó.', {exact:true}).waitFor({timeout:110000});
    assert.equal((await api(`/conversations/${channel.id}/broadcasts/active`, viewer.token)).some(b => b.id === currentId), false);
    currentId = null;
    console.log('Unexpected host closure and server room cleanup: PASS');
    assert.deepEqual(errors, [], 'Browser runtime errors');
  } catch (error) {
    console.error('Runtime errors:', errors);
    if (contexts[0]?.pages()[0] && !contexts[0].pages()[0].isClosed()) console.error('RTC:', JSON.stringify(await contexts[0].pages()[0].evaluate(() => window.__rtcDiagnostics)));
    for (let i=0; i<contexts.length; i++) {
      const page = contexts[i].pages()[0];
      if (page && !page.isClosed()) { console.error('PAGE '+i+': '+(await page.locator('body').innerText()).slice(-5000)); await page.screenshot({path:'.tmp/broadcast-failure-'+i+'.png'}); }
    }
    throw error;
  } finally {
    if (hostToken && currentId) await api('/broadcasts/' + currentId + '/end', hostToken, 'POST').catch(() => {});
    await browser.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode=1; });
