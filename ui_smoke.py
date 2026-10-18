import sys
from playwright.sync_api import sync_playwright
URL="http://localhost:8765/index.html"
OUT=sys.argv[1] if len(sys.argv)>1 else "/tmp"
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
    ctx=b.new_context(viewport={"width":1200,"height":800},accept_downloads=True)
    pg=ctx.new_page()
    pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.on("console",lambda m:m.type=="error" and errs.append(m.text))
    pg.goto(URL)
    pg.fill("#sn","محل الاختبار"); pg.fill("#sp","secret1"); pg.click("text=بدء الاستخدام")
    pg.wait_for_selector("nav a")
    # quick add product
    pg.goto(URL+"#quick"); pg.wait_for_selector("#f_name")
    pg.fill("#f_name","قميص اختبار"); pg.fill("#f_cat","قمصان"); pg.fill("#f_cost","5000"); pg.fill("#f_price","10000")
    pg.fill("#f_sizes","M L"); pg.fill("#f_colors","أزرق, أبيض"); pg.fill("#f_q","5")
    pg.uncheck("#f_pr"); pg.click("text=توليد الأصناف"); pg.click("text=حفظ >> nth=-1")
    pg.wait_for_selector("text=تم الحفظ")
    # sale
    pg.goto(URL+"#pos"); pg.wait_for_selector("#q")
    pg.fill("#q","قميص"); pg.wait_for_selector(".item"); pg.click(".item >> nth=0")
    pg.click(".item >> nth=0") if pg.query_selector(".item") else None
    pg.fill("#got","20000")
    pg.screenshot(path=OUT+"/pos.png")
    pg.evaluate("window.print=()=>{}")
    pg.click("text=إتمام البيع")
    pg.wait_for_selector("text=تم البيع")
    # held
    pg.fill("#q","قميص"); pg.wait_for_selector(".item"); pg.click(".item >> nth=1")
    pg.click("text=تعليق الفاتورة"); pg.wait_for_selector("text=المعلّقة (1)")
    pg.click("text=المعلّقة (1)"); pg.click(".dlg .item"); pg.wait_for_selector("text=السلة (1)")
    # pages
    for h in ["home","products","stock","sales","customers","expenses","reports","users","settings","labels","import"]:
        pg.goto(URL+"#"+h); pg.wait_for_timeout(300)
        if h in("home","reports","settings"): pg.screenshot(path=f"{OUT}/{h}.png")
    # reload persistence
    pg.goto(URL+"#products"); pg.reload(); pg.wait_for_selector("text=قميص اختبار")
    # dark + phone
    pg.click("[aria-label='الوضع الليلي']"); pg.set_viewport_size({"width":390,"height":780}); pg.goto(URL+"#pos"); pg.wait_for_timeout(300)
    pg.screenshot(path=OUT+"/phone_dark.png")
    # backup download
    pg.goto(URL+"#settings")
    with pg.expect_download() as d: pg.click("text=تنزيل نسخة احتياطية")
    print("download:",d.value.suggested_filename)
    pg.goto(URL+"#products");
    with pg.expect_download() as d: pg.click("text=CSV")
    print("csv:",d.value.suggested_filename)
    # logout/login
    pg.click("header >> text=خروج"); pg.fill("#lu","admin"); pg.fill("#lp","secret1"); pg.click("form button.big"); pg.wait_for_selector("nav a")
    b.close()
print("ERRORS:",errs)
