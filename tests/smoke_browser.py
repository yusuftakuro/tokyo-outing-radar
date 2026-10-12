"""Run with: python3 tests/smoke_browser.py (Playwright + Chromium required)"""
import contextlib
import http.server
import os
import socketserver
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

@contextlib.contextmanager
def site():
    old=os.getcwd();os.chdir(ROOT)
    class Server(socketserver.ThreadingMixIn,http.server.HTTPServer): daemon_threads=True
    server=Server(('127.0.0.1',0),Handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try: yield f'http://127.0.0.1:{server.server_port}'
    finally: server.shutdown();server.server_close();os.chdir(old)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    def mount():
        html=(ROOT/'index.html').read_text()
        import re
        html=re.sub(r'<script src="[^"]+"></script>', '', html)
        page.set_content(html)
        page.add_style_tag(content=(ROOT/'styles.css').read_text())
        for file in ['data/events.js','data/areas.js','app.js']:
            page.add_script_tag(content=(ROOT/file).read_text())
    mount()
    assert page.locator('h1').first.inner_text()=='今日、東京で何がある？'
    assert page.locator('#todayEvents .event-item').count()>=4
    page.locator('#settingsButton').click()
    page.locator('#origin').select_option('立川')
    page.locator('#budget').select_option('0')
    page.locator('#settingsForm button[type=submit]').click()
    assert '立川から' in page.locator('#conditions').inner_text()
    assert '無料' in page.locator('#conditions').inner_text()
    page.locator('#recommendButton').click()
    assert page.locator('#result').is_visible()
    first=page.locator('#resultArea').inner_text()
    page.locator('#nextButton').click()
    assert page.locator('#resultArea').inner_text()!=first
    page.locator('#detailButton').click()
    assert page.locator('#detail').is_visible()
    assert page.locator('#detailBody a').count()>=2
    page.locator('#detailBack').click()
    assert page.locator('#result').is_visible()
    page.locator('#resultBack').click()
    assert page.locator('#home').is_visible()
    page.screenshot(path=str(ROOT.parent/'tokyo_radar_home_test.png'),full_page=True)
    assert errors==[],errors
    print('PASS: browser DOM home, settings, recommendation, next, detail, back; no page errors')
    page2=browser.new_page(viewport={'width':390,'height':844})
    page2.set_content('<html><head></head><body></body></html>')
    page2.evaluate("""() => {const RealDate=Date; const fixed=new RealDate('2026-10-13T11:00:00+09:00').valueOf(); window.Date=class extends RealDate {constructor(...args){super(...(args.length?args:[fixed]));} static now(){return fixed;}};}""")
    import re
    html=re.sub(r'<script src="[^"]+"></script>', '',(ROOT/'index.html').read_text())
    page2.set_content(html)
    for file in ['data/events.js','data/areas.js','app.js']:
        page2.add_script_tag(content=(ROOT/file).read_text())
    assert page2.locator('#todayEvents .event-item').count()==0
    assert 'まだ登録されていません' in page2.locator('#freshnessNotice').inner_text()
    page2.locator('#recommendButton').click()
    assert page2.locator('#result').is_visible()
    assert '街歩き' in page2.locator('#resultBody').inner_text()
    print('PASS: expired events hidden; evergreen fallback works')
    browser.close()
