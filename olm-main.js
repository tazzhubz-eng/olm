// ==UserScript==
// @name         TOOL HOC TAP v9.0 (khong dang nhap)
// @version      9.0.0-no-login
// @namespace    http://tampermonkey.net/
// @description  Auto lam bai OLM - menu chinh, khong co dang nhap
// @author       rebuild
// @match        *://*/*
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      *
// @run-at       document-start
// ==/UserScript==

/* OLM TOOL - MENU CHINH + AUTO LAM BAI (khong dang nhap) */
(function(){
  'use strict';
  if(window.__OLMTool) return;
  window.__OLMTool = true;

  /* ---------------- [A] BAT PAYLOAD JSON CUA TRANG ---------------- */

  /* ===== [SỬA LỖI] BẮT PAYLOAD JSON CỦA TRANG (phải chạy trước khi trang tải dữ liệu) =====
     Trang OLM tải danh sách câu hỏi bằng fetch/XHR rồi đưa vào state của React/Vue.
     Nếu chỉ dò window global thì dễ trượt -> tool báo "KHONG tim thay ID".
     Nay chặn response của chính trang để lấy đúng danh sách ID câu hỏi mà trang đang dùng.
     => Sau khi cài bản này: F5 lại trang rồi bấm "Auto" (hook phải chạy trước khi trang tải data). */
  var __CAP=[];
  function __absorb(text){
    try{
      if(!text || typeof text!=='string') return;
      if(text.length>8000000) return;
      var c=text.charAt(0);
      if(c!=='{' && c!=='[') return;
      var obj=null; try{ obj=JSON.parse(text); }catch(e){ return; }
      __CAP.push(obj);
      if(__CAP.length>60) __CAP.shift();
    }catch(e){}
  }
  try{
    var UW=(typeof unsafeWindow!=='undefined')? unsafeWindow : window;
    try{ UW.__THT_CAPTURED__=__CAP; }catch(e){}
    if(UW.fetch && !UW.fetch.__thtHooked){
      var _f=UW.fetch;
      var hooked=function(input, init){
        var p;
        try{ p=_f.call(this, input, init); }catch(e){ throw e; }
        try{
          p.then(function(res){
            try{ res.clone().text().then(function(t){ __absorb(t); }, function(){}); }catch(e){}
          }, function(){});
        }catch(e){}
        return p;
      };
      try{ hooked.__thtHooked=true; }catch(e){}
      UW.fetch=hooked;
    }
    if(UW.XMLHttpRequest && UW.XMLHttpRequest.prototype){
      var proto=UW.XMLHttpRequest.prototype;
      if(!proto.open.__thtHooked){
        var _open=proto.open, _send=proto.send;
        var open2=function(m,u){ try{ this.__thtUrl=String(u); }catch(e){} return _open.apply(this, arguments); };
        try{ open2.__thtHooked=true; }catch(e){}
        proto.open=open2;
        var send2=function(){
          try{
            this.addEventListener('load', function(){
              try{ var t=this.responseText; if(typeof t==='string' && t.length) __absorb(t); }catch(e){}
            });
          }catch(e){}
          return _send.apply(this, arguments);
        };
        try{ send2.__thtHooked=true; }catch(e){}
        proto.send=send2;
      }
    }
  }catch(e){}

  /* ---------------- [B] MENU CHINH + AUTO ---------------- */
  function __boot(){

    try { if (typeof unsafeWindow !== 'undefined' && !window.data_practice) window.data_practice = unsafeWindow.data_practice; } catch(e){}
    if (typeof window.copy === 'undefined') {
      window.copy = function(t){ try { navigator.clipboard.writeText(String(t)); } catch(e){} };
    }

    var panel = document.createElement('div');
    panel.id = 'tht-panel';
    panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:290px;background:#ffffff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.25);font-family:Segoe UI,Roboto,sans-serif;overflow:hidden;user-select:none;';
    panel.innerHTML =
      '<div id="tht-head" style="background:linear-gradient(135deg,#2563eb,#16a34a);color:#fff;padding:10px 14px;font-weight:600;font-size:13px;letter-spacing:.5px;cursor:move;display:flex;justify-content:space-between;align-items:center;border-radius:16px 16px 0 0;">' +
        '<span>TOOL HOC TAP v8.3</span>' +
        '<span id="tht-close" style="cursor:pointer;opacity:.85;font-size:16px;line-height:1;">&times;</span>' +
      '</div>' +
      '<div style="padding:14px;">' +
        '<button id="tht-btn" style="width:100%;padding:11px;border:none;border-radius:12px;background:#16a34a;color:#fff;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(22,163,74,.35);">Auto làm bài</button>' +
        '<button id="tht-diag" style="width:100%;margin-top:8px;padding:8px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;color:#475569;font-size:12px;cursor:pointer;">Chẩn đoán (copy log)</button>' +
        '<div id="tht-status" style="margin-top:10px;font-size:11px;color:#475569;max-height:180px;overflow-y:auto;line-height:1.5;word-break:break-word;"></div>' +
      '</div>';
    (document.body || document.documentElement).appendChild(panel);

    var statusEl = document.getElementById('tht-status');
    function appendStatus(){
      var line = Array.prototype.slice.call(arguments).map(function(a){ try{return String(a);}catch(e){return '';} }).join(' ');
      var div = document.createElement('div');
      div.textContent = line;
      statusEl.appendChild(div);
      statusEl.scrollTop = statusEl.scrollHeight;
    }

    var head = document.getElementById('tht-head');
    // [SỬA LỖI] bắt lỗi uncaught của TRANG (vd "Uncaught SyntaxError: Unexpected identifier"
    // do site tự eval script) và đưa vào panel -> biết ngay script nào hỏng, ở dòng nào.
    var __errSeen={};
    window.addEventListener('error', function(e){
      try{
        var msg=String((e && e.message) || 'error');
        var where=(e && e.filename ? e.filename : '?')+':'+(e && e.lineno ? e.lineno : '?')+':'+(e && e.colno ? e.colno : '?');
        var k=msg+'@'+where;
        if(__errSeen[k]) return;
        __errSeen[k]=1;
        appendStatus('⚠ Lỗi trang: '+msg+' @ '+where);
      }catch(err){}
    }, true);
    var dragging=false, ox=0, oy=0;
    head.addEventListener('mousedown', function(e){
      if (e.target.id === 'tht-close') return;
      dragging=true; var r = panel.getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top;
      panel.style.right='auto'; panel.style.bottom='auto'; panel.style.left=r.left+'px'; panel.style.top=r.top+'px';
    });
    window.addEventListener('mousemove', function(e){ if(!dragging) return; panel.style.left=(e.clientX-ox)+'px'; panel.style.top=(e.clientY-oy)+'px'; });
    window.addEventListener('mouseup', function(){ dragging=false; });
    document.getElementById('tht-close').addEventListener('click', function(){ panel.remove(); });

    var origLog = console.log.bind(console);
    console.log = function(){ appendStatus.apply(null, arguments); origLog.apply(console, arguments); };

    var __W = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    var __sleep = function(ms){ return new Promise(function(r){setTimeout(r,ms);}); };
    var log = console.log.bind(console);

    // [v7.9] hook sớm console.log của TRANG để bắt object qlib (runAll/correct/quizl_order)
    // trang OLM tự log ra khi mở từng câu -> giữ lại dùng làm đáp án chuẩn.
    try{
      var __ql0=__W.__qlib=__W.__qlib||{};
      if(__W.console && __W.console.log && !__W.console.log.__thtQlib){
        (function(){
          var orig=__W.console.log.bind(__W.console);
          var patched=function(){
            try{
              for(var i=0;i<arguments.length;i++){
                var a=arguments[i];
                if(a && typeof a==='object' && a.runAll && a.id_quiz!=null) __ql0[String(a.id_quiz)]=a;
              }
            }catch(e){}
            return orig.apply(null, arguments);
          };
          try{ patched.__thtQlib=true; }catch(e){}
          __W.console.log=patched;
        })();
      }
    }catch(e){}

    /* ===== [BỔ SUNG] giải mã nội dung API (XOR + base64, key 01.js/02.js) ===== */
    // Bản cũ gọi __xorDecode/__xorKeys nhưng KHÔNG hề định nghĩa 2 hàm này
    // => bấm Auto sẽ chết ngay khi parse API ("__xorDecode is not defined").
    var __OLM_XOR_KEY='1047823200';
    function __xorKeys(){ return [__OLM_XOR_KEY]; }
    function __xorDecode(b64, keys){
      var list=(keys && keys.length)? keys : [__OLM_XOR_KEY];
      var bin='';
      try{ bin=atob(String(b64||'')); }catch(e){ return b64; }
      for(var ki=0; ki<list.length; ki++){
        var key=String(list[ki]||'');
        if(!key) continue;
        try{
          var bytes=new Uint8Array(bin.length);
          for(var i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i) ^ key.charCodeAt(i % key.length);
          var out=new TextDecoder('utf-8').decode(bytes);
          if(out && /[<>]/.test(out)) return out;
        }catch(e){}
      }
      try{
        var k=String(list[0]||''), by2=new Uint8Array(bin.length);
        for(var j=0;j<bin.length;j++) by2[j]=bin.charCodeAt(j) ^ k.charCodeAt(j % k.length);
        return new TextDecoder('utf-8').decode(by2);
      }catch(e){ return b64; }
    }

    function __norm(s){
      return String(s||'').toLowerCase().replace(/[\u2212\u2013\u2014\u2015]/g,'-').replace(/[×⋅]/g,'*').replace(/÷/g,'/')
        .replace(/\[img:[^\]]*\]/g,'').replace(/https?:\/\/\S+/g,'').replace(/\\[a-z]+/g,'').replace(/[{}[\]]/g,'')
        .replace(/\$/g,'').replace(/@\w+(\.\w+)?@/g,'x').replace(/\s+/g,'');
    }
    /* [v8.3] bo dau tieng Viet de so khop "So tu nhien" ~ "so tu nhien" */
    function __fold(s){
      var x=String(s||'').toLowerCase();
      try{ if(x.normalize) return x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u0111/g,'d'); }catch(e){}
      return x.replace(/\u0111/g,'d');
    }
    function __bigrams(s){var m=new Map();for(var i=0;i<s.length-1;i++){var b=s.slice(i,i+2);m.set(b,(m.get(b)||0)+1);}return m;}
    function __diceRaw(a,b){
      if(!a||!b||a.length<3||b.length<3) return 0; if(a===b) return 1;
      var A=__bigrams(a),B=__bigrams(b),inter=0,sa=0,sb=0;
      A.forEach(function(v,k){sa+=v; if(B.has(k)) inter+=Math.min(v,B.get(k));});
      B.forEach(function(v){sb+=v;});
      return 2*inter/(sa+sb);
    }
    function __dice(a,b){ return __diceRaw(__norm(a),__norm(b)); }
    /* [v8.3] gia tri so trong 1 phuong an: "1,5" -> 1.5 ; "3/4" -> 0.75 ; "25%" -> 25 */
    function __numVal(s){
      var t=__unify(String(s||'')).toLowerCase();
      t=t.replace(/(\d)\s*,\s*(\d)/g,'$1.$2');
      t=t.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,'$1/$2').replace(/\\[a-z]+/g,'');
      var m=t.match(/-?\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?|-?\d+(?:\.\d+)?/);
      if(!m) return null;
      var raw=m[0].replace(/\s+/g,'');
      if(raw.indexOf('/')>=0){ var pp=raw.split('/'), dd=parseFloat(pp[1]); return (dd && !isNaN(dd)) ? parseFloat(pp[0])/dd : null; }
      var v=parseFloat(raw);
      return isNaN(v) ? null : v;
    }
    function __visible(el){
      // [BỔ SUNG] fallback khi trình duyệt/jsdom không layout: nếu cả document không có rect
      // thì coi như hiển thị (trước đây chỉ dùng ở isVisible, khiến __findTabPills không thấy tab).
      if(!el) return false;
      try{
        var r=el.getClientRects();
        if(r && r.length>0) return true;
        var b=document.body;
        if(b && b.getClientRects) return b.getClientRects().length===0;
        return true;
      }catch(e){ return true; }
    }

    function __unify(s){ return String(s||'').replace(/[\u2212\u2013\u2014\u2015]/g,'-').replace(/\u00D7/g,'*').replace(/\u22C5/g,'*').replace(/\u00F7/g,'/'); }
    function __fracKey(s){
      var x=__unify(s).toLowerCase();
      x=x.replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,'($1)/($2)');
      x=x.replace(/\\[a-z]+/g,'');
      x=x.replace(/[{}\[\]]/g,'');
      x=x.replace(/\$/g,'').replace(/@\w+(\.\w+)?@/g,'x').replace(/\s+/g,'');
      x=x.replace(/\(([^()]*)\)\/\(([^()]*)\)/g,'$1/$2');
      x=x.replace(/(\d+)\s*\/\s*(\d+)/g,'$1/$2');
      return x.replace(/[^0-9a-z\/*:+\-.=x]/g,'');
    }
    // [BỔ SUNG] bỏ nhãn phương án ở đầu ("A. ", "B) ", "c: ") trước khi so khớp.
    // Nhờ vậy API trả "2" vẫn khớp đúng DOM "B. 2" (trước đây __dice trả 0 vì chuỗi quá ngắn
    // -> tool có thể khoanh nhầm phương án).
    function __stripLead(s){
      return String(s||'').replace(/^\s*[A-Za-zÀ-ỹ]\s*[\.\):]\s*/,'').trim();
    }
    function __numSim(a,b){
      var fa=__fracKey(a), fb=__fracKey(b);
      if(fa && fa===fb) return 1;
      var sa=__stripLead(a), sb=__stripLead(b);
      if(sa!==String(a||'') || sb!==String(b||'')){
        var fa2=__fracKey(sa), fb2=__fracKey(sb);
        if(fa2 && fa2===fb2) return 1;
      }
      var d=Math.max(__dice(sa,sb), __dice(a,b));
      if(d<1){
        /* [v8.3] khác dấu / khác cách viết số vẫn khớp */
        var ga=__fold(__norm(sa)), gb=__fold(__norm(sb));
        if(ga && gb){
          if(ga===gb) return Math.max(d,0.99);
          var df=__diceRaw(ga,gb);
          if(df>d) d=df;
        }
        /* [v8.3] cung gia tri so -> khop, nhung chi khi phan chu con lai cung giong
           (tranh "So 2 la so nguyen to" ~ "So 2 la hop so") */
        var na=__numVal(sa), nb=__numVal(sb);
        if(na!=null && nb!=null && Math.abs(na-nb)<1e-9){
          var ra=__fold(__norm(sa)).replace(/[0-9.,/]/g,''), rb=__fold(__norm(sb)).replace(/[0-9.,/]/g,'');
          if(ra===rb || __diceRaw(ra,rb)>=0.9) d=Math.max(d,0.96);
        }
      }
      return d;
    }
    function __optSetScoreSim(domTexts, apiTexts){
      if(!domTexts.length || !apiTexts.length) return 0;
      var hit=0;
      domTexts.forEach(function(d){
        var best=0;
        apiTexts.forEach(function(a){ var s=__numSim(d,a); if(s>best) best=s; });
        hit+=best;
      });
      return hit/Math.max(domTexts.length, apiTexts.length);
    }
    // [BỔ SUNG] dạng Đúng/Sai kiểu "ô lật": bấm 1 lần = Đ, bấm 2 lần = S
    function __tfCellState(el){
      try{
        var sig=(String(el.textContent||'')+' '+String(el.className||'')+' '+String(el.getAttribute('data-tf-value')||'')+' '+String(el.getAttribute('aria-label')||'')+' '+String(el.getAttribute('data-value')||'')+' '+String(el.getAttribute('value')||'')+' '+String(el.getAttribute('aria-checked')||'')+' '+String(el.getAttribute('aria-pressed')||'')).toLowerCase();
        if(/\b(data-tf-value\s*=\s*"?1|đúng|dung|true)\b/.test(sig) || /(^|[^\w])đ([^\w]|$)/.test(sig)) return 'T';
        if(/\b(data-tf-value\s*=\s*"?0|sai|false)\b/.test(sig) || /(^|[^\w])s([^\w]|$)/.test(sig)) return 'F';
        // attr explicit
        var v=String(el.getAttribute('data-tf-value')||el.getAttribute('data-value')||'');
        if(v==='1' || v==='true') return 'T';
        if(v==='0' || v==='false') return 'F';
      }catch(e){}
      return '';
    }
    async function __clickTfToggleTo(cell, wantTrue){
      var want=wantTrue?'T':'F';
      for(var t=0;t<4;t++){
        var st=__tfCellState(cell);
        if(st===want) return true;
        __clickRobust(cell);
        await __sleep(80);
      }
      return __tfCellState(cell)===want;
    }
    function __optIsSelected(o){
      try{
        if(!o) return false;
        if(o.tagName==='INPUT' && (o.type==='radio'||o.type==='checkbox')) return !!o.checked;
        var inp=o.querySelector && o.querySelector('input[type=radio], input[type=checkbox]');
        if(inp && inp.checked) return true;
        var sig=String(o.className||'')+' '+(o.getAttribute('aria-checked')||'')+' '+(o.getAttribute('aria-selected')||'')+' '+(o.getAttribute('aria-pressed')||'')+' '+(o.getAttribute('data-checked')||'')+' '+(o.getAttribute('data-selected')||'');
        return /selected|active|checked|chosen|picked|true/i.test(sig);
      }catch(e){ return false; }
    }
    function __parseTop(el){ var m=(el.getAttribute('style')||'').match(/top:\s*(-?[\d.]+)em/); return m?parseFloat(m[1]):0; }
    function __mfracStr(mfracEl){
      var kids=[].slice.call(mfracEl.querySelectorAll('.vlist > span[style*="top"]')).filter(function(el){ return (el.textContent||'').replace(/\s+/g,' ').trim().length>0; });
      if(kids.length<2) return null;
      var numEl=kids.reduce(function(a,b){ return (__parseTop(b)<__parseTop(a))?b:a; });
      var denEl=kids.reduce(function(a,b){ return (__parseTop(b)>__parseTop(a))?b:a; });
      var num=(numEl.textContent||'').replace(/\s+/g,' ').trim();
      var den=(denEl.textContent||'').replace(/\s+/g,' ').trim();
      if(!num||!den) return null;
      return '\\dfrac{'+num+'}{'+den+'}';
    }
    function __katexExprStr(katexEl){
      var html=katexEl.querySelector('.katex-html')||katexEl;
      var s='';
      function walk(node){
        var children=node.childNodes||[];
        for(var i=0;i<children.length;i++){
          var child=children[i];
          if(child.nodeType===3){ s+=child.textContent; continue; }
          if(child.nodeType!==1) continue;
          var el=child;
          var cls=el.classList;
          if(cls && cls.contains('mfrac')){ var f=__mfracStr(el); s += (f!=null?f:(el.textContent||'').replace(/\s+/g,' ').trim()); continue; }
          if(cls && (cls.contains('frac-line')||cls.contains('vlist-s')||cls.contains('pstrut')||cls.contains('nulldelimiter')||cls.contains('mspace')||cls.contains('rule'))) continue;
          walk(el);
        }
      }
      walk(html);
      return s.replace(/\s+/g,' ').trim();
    }
    function __katexText(node){
      if(!node) return '';
      var clone=node.cloneNode(true);
      [].slice.call(clone.querySelectorAll('.mark')).forEach(function(m){ try{m.remove();}catch(e){} });
      [].slice.call(clone.querySelectorAll('.katex-mathml')).forEach(function(m){ try{m.remove();}catch(e){} });
      [].slice.call(clone.querySelectorAll('.katex')).forEach(function(k){
        var ann=k.querySelector('annotation[encoding="application/x-tex"]');
        if(ann){ k.replaceWith(document.createTextNode(ann.textContent)); return; }
        k.replaceWith(document.createTextNode(__katexExprStr(k)));
      });
      return (clone.textContent||'').replace(/\s+/g,' ').trim();
    }
    function __clickRobust(el){
      if(!el) return;
      try{ el.scrollIntoView({block:'center'}); }catch(e){}
      // [BỔ SUNG] chỉ click MỘT phần tử và chỉ phát MỘT sự kiện 'click'.
      // Bản cũ vừa dispatch 'click' vừa gọi el.click() (và click cả el + tổ tiên) => double-fire,
      // làm option vừa chọn đã bị bỏ chọn (lỗi hay gặp ở câu trắc nghiệm / tab).
      var target=el;
      try{
        if(el.tagName!=='INPUT' && el.tagName!=='SELECT' && el.tagName!=='TEXTAREA'){
          var anc=el.closest('button, a, [role=button], label, [onclick]');
          if(anc) target=anc;
        }
      }catch(e){}
      try{
        var r=target.getBoundingClientRect(), o={bubbles:true,cancelable:true,composed:true,view:window,clientX:r.left+r.width/2,clientY:r.top+r.height/2};
        ['pointerdown','mousedown','pointerup','mouseup'].forEach(function(ev){
          try{ target.dispatchEvent((ev.indexOf('pointer')===0?new PointerEvent(ev,o):new MouseEvent(ev,o))); }catch(e){}
        });
        try{ target.click(); }
        catch(e){ try{ target.dispatchEvent(new MouseEvent('click',o)); }catch(e2){} }
      }catch(e){}
    }
    function __collectRoots(){
      var roots=[], seen=new Set();
      function add(r){ if(r && !seen.has(r)){ seen.add(r); roots.push(r); } }
      function walk(r){ add(r); var all=[]; try{ all=r.querySelectorAll('*'); }catch(e){ return; } for(var i=0;i<all.length;i++){ if(all[i].shadowRoot) walk(all[i].shadowRoot); } }
      walk(document);
      try{ [].slice.call(document.querySelectorAll('iframe')).forEach(function(f){ try{ if(f.contentDocument) walk(f.contentDocument); }catch(e){} }); }catch(e){}
      return roots;
    }
    function __deepAll(sel){
      var roots=__collectRoots(), out=[];
      roots.forEach(function(r){ try{ out.push.apply(out, [].slice.call(r.querySelectorAll(sel))); }catch(e){} });
      return out;
    }
    async function __waitRender(ms){
      var t0=Date.now();
      while(Date.now()-t0<ms){
        var n=__deepAll('.qselect').length + __deepAll('input[data-accept]').length + __deepAll('.fill-me input').length + __deepAll('tr.tf-row').length
          + __deepAll('.dragtext[ind]').length + __deepAll('.drag-select').length + __selEls().length
          + __deepAll('.boxlink.left').length + __deepAll('.drag-item').length + __deepAll('ul.new_click li.new_item').length;
        if(n>=2) return n;
        await __sleep(120);
      }
      return __deepAll('.qselect').length;
    }
    function __textOf(node, dropSel){
      if(!node) return '';
      try{
        var wrap=document.createElement('div');
        wrap.appendChild(node.cloneNode(true));
        // [BỔ SUNG] luôn bỏ script/style/panel của tool: nếu stem quá ngắn, hàm phải leo lên
        // tổ tiên và trước đây nuốt luôn cả source userscript + chữ trong panel -> khớp sai câu.
        [].slice.call(wrap.querySelectorAll('script, style, noscript, #tht-panel')).forEach(function(x){ try{ x.remove(); }catch(e){} });
        if(dropSel) [].slice.call(wrap.querySelectorAll(dropSel)).forEach(function(x){ try{ x.remove(); }catch(e){} });
        return __norm(__katexText(wrap));
      }catch(e){ return ''; }
    }
    function __stemNear(el, dropSel){
      var quick=null; try{ quick=el.closest('.question-content')||el.closest('.itemx')||el.closest('.card-body'); }catch(e){}
      // [BỔ SUNG] hạ ngưỡng 8 -> 4 để stem ngắn ("Nêu số:", "Chọn màu"...) không bị leo lên body
      if(quick){ var s=__textOf(quick, dropSel); if(s.length>=4) return s; }
      var base='input, textarea, .qselect, .quiz-list, .exp, pre, [contenteditable], .mark';
      var node=el, best='';
      for(var i=0;i<12 && node;i++){
        var parent=null; try{ parent=node.parentElement || (node.parentNode && node.parentNode.host) || null; }catch(e){ parent=null; }
        if(!parent) break;
        var s=__textOf(parent, base);
        s=s.replace(/trảlời:?/g,'').replace(/answer:?/g,'').trim();
        if(s.length>=12 && !/^câu\d+\s*đ/i.test(s)){ best=s; break; }
        node=parent;
      }
      return best || __norm((el.getAttribute && (el.getAttribute('data-accept')||''))||'');
    }

    /* ===== Tim ID cau hoi ===== */
    function __collectIds(){
      var set=new Set(), de=__W.data_exam||{};
      var seen=new Set();
      function add(x){ var n=parseInt(String(x),10); if(n>1e6 && !seen.has(n)){ seen.add(n); set.add(n); } }
      if(de.list_id_quiz){ String(de.list_id_quiz).split(/[,\\s]+/).forEach(add); }
      if(Array.isArray(de.list_cate_quiz)){ de.list_cate_quiz.forEach(add); }
      if(Array.isArray(de.list_quiz)){ de.list_quiz.forEach(function(x){ if(x&&x.id_script!=null) add(x.id_script); }); }
      // [SỬA LỖI] KHÔNG thêm list_main_skill: đó là ID KỸ NĂNG (id_skill), không phải ID câu hỏi.
      // Bản cũ trộn skill vào danh sách quiz -> API nhận ID rác, trả rỗng/sai.
      try{
        var dp=__W.data_practice||window.data_practice||{};
        if(Array.isArray(dp.list_id_quiz)) dp.list_id_quiz.forEach(add);
        if(Array.isArray(dp.list_all)) dp.list_all.forEach(add);
      }catch(e){}
      // [BỔ SUNG] trang chu-de/courseware có thể để ID trong data_cate hoặc shell
      try{
        var dc=__W.data_cate||window.data_cate||{};
        if(dc.list_id_quiz) String(dc.list_id_quiz).split(/[,\\s]+/).forEach(add);
        if(Array.isArray(dc.list_id_quiz)) dc.list_id_quiz.forEach(add);
        if(Array.isArray(dc.list_all)) dc.list_all.forEach(function(x){ add(x&& (x.id_script||x.id||x)); });
        if(Array.isArray(dc.list_quiz)) dc.list_quiz.forEach(function(x){ add(x&& (x.id_script||x.id||x)); });
      }catch(e){}
      try{
        var shells=[__W.__OLM_COURSEWARE_ASSIGN_V2_SHELL__, __W.REACT_OLM_EDITOR, __W.OlmPartnerLearningProgress];
        shells.forEach(function(sh){
          if(!sh||typeof sh!=='object') return;
          try{
            if(sh.list_id_quiz) (Array.isArray(sh.list_id_quiz)?sh.list_id_quiz:String(sh.list_id_quiz).split(/[,\\s]+/)).forEach(add);
            if(Array.isArray(sh.list_all)) sh.list_all.forEach(function(x){ add(x&& (x.id_script||x.id||x)); });
            if(Array.isArray(sh.list_quiz)) sh.list_quiz.forEach(function(x){ add(x&& (x.id_script||x.id||x)); });
          }catch(e){}
        });
      }catch(e){}
      return [...set];
    }
    function __discover(){
      var cands=[], seen=new Set();
      var keyRe=/quiz|question|practice|test|review|exam|bank|data|list|lib|olm|chu_de|cau|bai|id_/i;
      function dig(obj,path,d){
        if(!obj||d>4) return;
        // [SỬA LỖI] loại trừ đường dẫn chứa "skill": list_main_skill là ID KỸ NĂNG
        // (vd 5099276443) đều là số > 1e6 -> bản cũ nuốt nhầm vào danh sách ID câu hỏi
        // -> API nhận ID rác, trả về rỗng/sai.
        if(/skill/i.test(path)) return;
        try{ if(seen.has(obj)) return; seen.add(obj); }catch(e){ return; }
        if(Array.isArray(obj)){
          if(obj.length&&obj.every(function(x){return typeof x==='number'&&x>1e6;})) cands.push({source:path,ids:obj.slice()});
          else if(obj.length&&obj.every(function(x){return x&&typeof x==='object';})){
            ['id_quiz','id_question','question_id','quiz_id','id'].forEach(function(k){
              if(obj.every(function(x){return typeof x[k]==='number'&&x[k]>1e6;})) cands.push({source:path+'.'+k,ids:obj.map(function(x){return x[k];})});
            });
          }
          obj.forEach(function(v,i){dig(v,path+'['+i+']',d+1);});
        } else if(typeof obj==='object'){
          Object.keys(obj).forEach(function(k){ if(d===0&&!keyRe.test(k)) return; dig(obj[k],path+'.'+k,d+1); });
        }
      }
      try{ dig(__W,'window',0); }catch(e){}
      try{
        Array.prototype.forEach.call(document.scripts||[],function(s,i){
          var t=s.textContent||'', re=/\[(\s*\d{9,}(\s*,\s*\d{9,})+\s*)\]/g,m;
          while((m=re.exec(t))) cands.push({source:'script#'+i+(s.id?'/'+s.id:''),ids:m[1].split(',').map(function(x){return parseInt(x.trim(),10);})});
        });
      }catch(e){}
      var set=new Set();
      cands.forEach(function(c){ c.ids.forEach(function(id){ set.add(id); }); });
      return {cands:cands, merged:[...set]};
    }
    /* ===== [BỔ SUNG] dò tham số API (id_subject / id_category / cv_q) trong mọi object global ===== */
    // Trang luyện tập có data_practice; trang ĐỀ THI (type_exam != 0) chỉ có data_exam/EXAM_UI
    // nên bản cũ rơi về mặc định id_subject=3, id_skill=5099276443 -> API trả rỗng.
    function __deepFindKey(obj, names, depth, seen){
      if(!obj || typeof obj!=='object' || depth<0) return null;
      try{ if(seen.has(obj)) return null; seen.add(obj); }catch(e){ return null; }
      for(var i=0;i<names.length;i++){
        var v; try{ v=obj[names[i]]; }catch(e){ continue; }
        if(v!=null && (typeof v==='number'||typeof v==='string') && String(v).trim()!=='') return String(v);
      }
      if(depth===0) return null;
      var keys=[]; try{ keys=Object.keys(obj); }catch(e){ return null; }
      for(var k=0;k<keys.length;k++){
        if(keys[k]==='window'||keys[k]==='self'||keys[k]==='top'||keys[k]==='parent'||keys[k]==='document') continue;
        var child; try{ child=obj[keys[k]]; }catch(e){ continue; }
        if(child && typeof child==='object'){
          var r=__deepFindKey(child, names, depth-1, seen);
          if(r!=null) return r;
        }
      }
      return null;
    }
    var __apiParamsCache=null;
    function __apiParams(dp){
      if(__apiParamsCache) return __apiParamsCache;
      var seen=new Set(), p={};
      dp=dp||{};
      p.id_subject = (dp.id_subject!=null? String(dp.id_subject) : null);
      p.id_category = (dp.id_category!=null? String(dp.id_category) : (dp.id_skill!=null? String(dp.id_skill):null));
      p.cv_q = (dp.cv_q!=null? String(dp.cv_q) : null);
      var sources=[__W.data_exam, __W.data_cate, __W.data_practice, __W.EXAM_UI, __W.EXAM_SMART, __W.CORE_OLM];
      for(var i=0;i<sources.length;i++){
        var s=sources[i];
        if(!s || typeof s!=='object') continue;
        if(p.id_subject==null) p.id_subject=__deepFindKey(s, ['id_subject','subject_id','idSubject'], 2, seen);
        if(p.id_category==null) p.id_category=__deepFindKey(s, ['id_category','category_id','idCategory','id_skill','idSkill'], 2, seen);
        if(p.cv_q==null) p.cv_q=__deepFindKey(s, ['cv_q','cvQ'], 2, seen);
      }
      if(p.id_subject==null){ try{ p.id_subject=__deepFindKey(__W, ['id_subject','subject_id'], 2, new Set()); }catch(e){} }
      if(p.id_subject==null) p.id_subject='3';
      if(p.id_category==null) p.id_category='5099276443';
      if(p.cv_q==null) p.cv_q='1';
      __apiParamsCache=p;
      return p;
    }
    function __dumpGlobals(){
      var n=[]; try{ Object.keys(__W).forEach(function(k){ if(/quiz|question|practice|test|review|exam|bank|data|list|lib|olm|chu_de|cau|bai/i.test(k)) n.push(k); }); }catch(e){}
      return n;
    }
    /* ===== [SỬA LỖI] DÒ ID CÂU HỎI — PHẢI ĐỌC WINDOW CỦA TRANG =====
       Bản cũ dò `window.data_practice`. Nhưng script này chạy trong SANDBOX của Tampermonkey
       nên `window` ở đây KHÔNG phải window của trang -> luôn rỗng -> "KHONG tim thay ID".
       01.js chạy thẳng trong console nên `window` của nó đúng là window của trang.
       Nay dò qua __W (unsafeWindow) + payload XHR đã bắt + quét sâu, đúng tinh thần 01.js. */
    var __urlIds={};
    try{ (String(location.pathname||'')+' '+String(location.search||'')).match(/\d{9,}/g).forEach(function(x){ __urlIds[x]=1; }); }catch(e){}
    function __isQuizId(x){
      var n=parseInt(String(x),10);
      if(!isFinite(n) || n<=1e6) return false;
      if(__urlIds[String(n)]) return false;      // id của chính trang (chu-de/category) -> loại
      return true;
    }
    // Lấy danh sách ID câu hỏi từ 1 object (01.js: data_practice.list_id_quiz / list_all[].id_script)
    function __pickIds(obj){
      if(!obj || typeof obj!=='object') return null;
      var arrProps=['list_id_quiz','listIdQuiz','list_cate_quiz','list_all','listAll','list_quiz','quiz_list','quizList','list','questions','questionIds','ids'];
      for(var p=0;p<arrProps.length;p++){
        var v; try{ v=obj[arrProps[p]]; }catch(e){ continue; }
        if(!Array.isArray(v)||!v.length) continue;
        var allObj=v.every(function(x){ return x && typeof x==='object'; });
        if(allObj){
          var mapped=v.map(function(x){ return x && (x.id_script||x.id_question||x.question_id||x.quiz_id||x.id); }).filter(function(x){ return __isQuizId(x); });
          if(mapped.length) return mapped.map(String);
          continue;
        }
        var nums=v.map(function(x){ return parseInt(String(x),10); }).filter(function(x){ return __isQuizId(x); });
        if(nums.length) return nums.map(String);
      }
      return null;
    }
    // Quét sâu 1 object: mảng toàn số = danh sách ID; field id_script/id_quiz/... = 1 ID
    function __deepQuizIds(root, out, seen, depth, path){
      if(!root || typeof root!=='object' || depth<0) return;
      try{ if(seen.has(root)) return; seen.add(root); }catch(e){ return; }
      if(Array.isArray(root)){
        var nums=root.filter(function(x){ return typeof x==='number' && __isQuizId(x); });
        if(nums.length && nums.length===root.length){ out.push({ids:nums, path:path}); return; }
        root.forEach(function(x,i){
          if(x && typeof x==='object'){
            ['id_script','id_quiz','id_question','question_id','quiz_id','id_qlib'].forEach(function(k){
              if(x[k]!=null && __isQuizId(x[k])) out.push({ids:[parseInt(String(x[k]),10)], path:path+'['+i+'].'+k});
            });
          }
        });
        return;
      }
      var keys=[]; try{ keys=Object.keys(root); }catch(e){ return; }
      for(var i=0;i<keys.length;i++){
        var k=keys[i], v; try{ v=root[k]; }catch(e){ continue; }
        if(v==null) continue;
        if(typeof v==='number' || typeof v==='string'){
          if(/^(id_script|id_quiz|id_question|question_id|quiz_id|id_qlib)$/i.test(k) && __isQuizId(v)) out.push({ids:[parseInt(String(v),10)], path:path+'.'+k});
          continue;
        }
        if(typeof v!=='object') continue;
        if(/skill/i.test(k)) continue;              // id kỹ năng, KHÔNG phải ID câu hỏi
        __deepQuizIds(v, out, seen, depth-1, path+'.'+k);
      }
    }
    // Xếp hạng các mảng ID tìm được: tên key có "quiz/question" + danh sách dài -> đúng nhất
    function __rankCandidates(cands){
      var scored=cands.map(function(c){
        var s=0;
        if(/quiz|question|cau|script|qlib/i.test(c.path)) s+=4;
        if(/list|ids/i.test(c.path)) s+=1;
        s+=Math.min(c.ids.length,30)/30;
        return {ids:c.ids, path:c.path, s:s};
      }).sort(function(a,b){ return b.s-a.s; });
      if(!scored.length) return [];
      var top=scored[0].s, res=[];
      scored.forEach(function(c){ if(c.s>=top-0.01 && res.length<4) res.push(c); });
      return res;
    }
    function __findQuizIds(allowDeep){
      var W=__W;
      var names=['data_practice','dataPractice','practice','practiceData','quizData','data_quiz','olmPractice','dataPracticeQuiz','practice_data','appData','pageData','data_exam','REVIEW_CATEGORY',
                 'data_cate','data_courseware','data_assignment',
                 '__OLM_COURSEWARE_ASSIGN_V2_SHELL__','OLM_COURSEWARE_ASSIGN_V2_SHELL__','REACT_OLM_EDITOR','OlmPartnerLearningProgress','OLM_COURSEWARE','__OLM_DATA__','CORE_OLM','EXAM_UI','EXAM_SMART'];
      // (1) global của TRANG — đúng chuỗi 01.js
      for(var i=0;i<names.length;i++){
        var o=null; try{ o=W[names[i]]; }catch(e){ o=null; }
        if(!o || typeof o!=='object') continue;
        var ids=__pickIds(o);
        if(ids && ids.length) return {ids:ids, src:names[i], dp:o};
      }
      // (2) script trong trang: list_id_quiz: [...]  (giống 01.js)
      try{
        var scripts=[].slice.call(document.scripts||[]);
        for(var i=0;i<scripts.length;i++){
          var t=scripts[i].textContent||'';
          if(!t) continue;
          var m=t.match(/list_id_quiz\s*[:=]\s*\[([^\]]*)\]/);
          if(m){
            var arr=[], re=/['"]?(\d+)['"]?/g, mm;
            while((mm=re.exec(m[1]))) if(__isQuizId(mm[1])) arr.push(mm[1]);
            if(arr.length) return {ids:arr, src:'script#'+i, dp:null};
          }
        }
      }catch(e){}
      // (3) payload JSON trang vừa tải (hook fetch/XHR) + các global lạ  [CHẬM - chỉ chạy 1 lần]
      if(!allowDeep) return {ids:[], src:'', dp:null};
      var cands=[];
      try{
        var cap=[]; try{ cap=W.__THT_CAPTURED__||[]; }catch(e){}
        try{ if(!cap.length) cap=window.__THT_CAPTURED__||[]; }catch(e){}
        cap.forEach(function(o,i){ __deepQuizIds(o, cands, new Set(), 5, 'payload['+i+']'); });
      }catch(e){}
      try{
        var keys=Object.keys(W);
        for(var i=0;i<keys.length;i++){
          var k=keys[i];
          if(/^(window|self|top|parent|document|location|navigator|localStorage|sessionStorage|console|crypto)$/i.test(k)) continue;
          if(/skill/i.test(k)) continue;
          var v; try{ v=W[k]; }catch(e){ continue; }
          if(!v || typeof v!=='object') continue;
          __deepQuizIds(v, cands, new Set(), 4, 'win.'+k);
        }
      }catch(e){}
      var ranked=__rankCandidates(cands);
      if(ranked.length){
        var ids=[], seen=new Set();
        ranked.forEach(function(c){ c.ids.forEach(function(id){ if(!seen.has(id)){ seen.add(id); ids.push(id); } }); });
        return {ids:ids.map(String), src:'deep:'+ranked[0].path, dp:null, cands:ranked};
      }
      // (4) attribute trong DOM
      try{
        var els=__deepAll('*'), found=[];
        els.forEach(function(el){
          for(var i=0;i<el.attributes.length;i++){
            var v=el.attributes[i].value||'';
            if(__isQuizId(v)) found.push(parseInt(v,10));
          }
        });
        if(found.length) return {ids:found.map(String), src:'dom-attr', dp:null};
      }catch(e){}
      return {ids:[], src:'', dp:null};
    }

    async function __prep(){
      appendStatus('🔍 dang gom ID (robust)...');
      // chờ trang gán data (React/Vue set data sau khi script chạy)
      var t0=Date.now(), found=null;
      while(Date.now()-t0<6000){
        found=__findQuizIds(false);
        if(found && found.ids && found.ids.length) break;
        await __sleep(300);
      }
      // quét sâu (payload + global + DOM) - chạy 1 lần vì khá chậm
      if(!found || !found.ids.length) found=__findQuizIds(true);
      if(!found || !found.ids.length){
        appendStatus('❌ KHONG tim thay ID. Bam "Chẩn đoán" rồi paste.');
        return false;
      }
      var dp=found.dp||{};
      var ap=__apiParams(dp);
      var subject=(dp.id_subject!=null?String(dp.id_subject):String(ap.id_subject||'3'));
      var category=(dp.id_category!=null?String(dp.id_category):(dp.id_skill!=null?String(dp.id_skill):String(ap.id_category||'5099276443')));
      var skill=(dp.id_skill!=null?String(dp.id_skill):category);
      var cv=(dp.cv_q!=null?String(dp.cv_q):String(ap.cv_q||'1'));
      var skills=null;
      try{ if(__W.data_exam && __W.data_exam.list_main_skill && typeof __W.data_exam.list_main_skill==='object') skills=__W.data_exam.list_main_skill; }catch(e){}
      // lưu trong SANDBOX (KHÔNG ghi đè object của trang) + nạp thẳng vào data_practice
      window.data_practice={
        list_id_quiz: found.ids,
        id_subject: subject,
        id_category: category,
        id_skill: skill,
        cv_q: cv,
        list_main_skill: skills || undefined
      };
      appendStatus('✅ Da gom '+found.ids.length+' ID cau hoi ('+found.src+', subject='+subject+', skill='+category+')');
      return true;
    }

    /* ===== Tab pills pagination ===== */
    function __findTabPills(){
      var pills=__deepAll('button,a,span,div,[role=button],label').filter(__visible).filter(function(el){
        var t=(el.textContent||'').trim(); return /^\d+\s*[-–—]\s*\d+$/.test(t) && t.length<=8;
      });
      var seen=new Set(), uniq=[];
      pills.forEach(function(p){ var t=(p.textContent||'').trim(); if(!seen.has(t)){ seen.add(t); uniq.push(p); } });
      uniq.sort(function(a,b){ try{return a.getBoundingClientRect().left - b.getBoundingClientRect().left;}catch(e){return 0;} });
      return uniq;
    }
    var __olmTabIdx=null;
    function __activeTabIdx(pills){
      // trả về index tab đang active, -1 nếu không nhận ra (để nơi gọi tự quyết định)
      var idx=-1;
      pills.forEach(function(p,i){
        var sig=(p.className||'')+' '+(p.getAttribute('aria-selected')||'')+' '+(p.getAttribute('aria-current')||'')+' '+(p.getAttribute('data-active')||'');
        if(/active|current|selected|chosen/i.test(sig)) idx=i;
      });
      return idx;
    }
    /* ===== [SỬA LỖI] nhận diện trang bài dạng VIDEO tương tác của OLM =====
       Trang video có đặc điểm: KHÔNG có tab phân trang (pill "1-3"), KHÔNG có #btn-next,
       KHÔNG có nút nộp bài -> nếu không nhận ra, nút "Auto" rơi vào nhánh fallback
       "chỉ trả lời đúng 1 câu" nên tool không làm được bài dạng video.
       Câu hỏi hiện đè lên video theo mốc thời gian, phải trả lời + bấm "Kiểm tra/Tiếp tục". */
    function __isVideoPage(){
      var hasVideo=false;
      try{
        hasVideo = __deepAll('video').some(__visible) || __deepAll('.video-js, .vjs, .plyr, .jwplayer, [class*="video-player"], [class*="interactive-video"], [class*="video_"], [data-video-id]').some(__visible);
      }catch(e){}
      if(!hasVideo){
        try{
          var frames=[].slice.call(document.querySelectorAll('iframe'));
          for(var i=0;i<frames.length;i++){
            var s=String(frames[i].src||'')+' '+(frames[i].className||'')+' '+(frames[i].id||'');
            if(/youtube|youtu\.be|vimeo|dailymotion|player|video|media/i.test(s)){ hasVideo=true; break; }
          }
        }catch(e){}
      }
      if(!hasVideo) return false;
      // Trang KHÔNG có tab phân trang và KHÔNG có #btn-next -> các luồng cũ (#autoLoop01 /
      // trả lời 1 câu) không chạy được ở đây -> chắc chắn là bài dạng video -> ưu tiên luồng video.
      try{ if(__findTabPills().length<2 && !findBtn('btn-next')) return true; }catch(e){}
      // [SỬA LỖI] nếu trang đang có CÂU HỎI TĨNH (không nằm trong overlay của video) thì đây là
      // trang bài thường có video -> KHÔNG chuyển sang luồng video (giữ nguyên hành vi cũ).
      try{
        var stat=__deepAll('.qselect, .quiz-list, .itemx, .question-content, input[data-accept], tr.tf-row').filter(__visible);
        for(var i=0;i<stat.length;i++){
          var inOverlay=false;
          try{
            inOverlay=!!stat[i].closest('[class*="overlay"], [class*="popup"], [class*="modal"], [class*="player"], [class*="video"], .video-js, .plyr, [id*="video"]');
          }catch(e){}
          if(!inOverlay) return false;
        }
      }catch(e){}
      return true;
    }
    async function __gotoNextPage(fp, pageIdx){
      var pills=__findTabPills();
      if(pills.length>=2){
        // [SỬA LỖI] đồng bộ theo tab đang active thật trên DOM: bản cũ giữ index cũ
        // (\_\_olmTabIdx không reset) nên lần chạy sau bắt đầu từ tab giữa, bỏ sót câu.
        var real=__activeTabIdx(pills);
        if(real>=0) __olmTabIdx=real;
        if(__olmTabIdx===null || __olmTabIdx===undefined) __olmTabIdx=0;
        var ai=__olmTabIdx;
        var next=pills[ai+1];
        if(!next){ appendStatus('🏁 Tab cuoi roi — xong.'); return 'done'; }
        appendStatus('  → Chuyen tab "'+(next.textContent||'').trim()+'"');
        __clickRobust(next);
        if(await __fpChanged(fp, 3500)){ __olmTabIdx=ai+1; return true; }
        appendStatus('  ⚠ Tab khong doi noi dung, thu lai...');
        __clickRobust(next);
        if(await __fpChanged(fp, 2000)){ __olmTabIdx=ai+1; return true; }
        // [BỔ SUNG] một số bài KHÓA chuyển tab nếu chưa "Kiểm tra" -> bấm kiểm tra rồi thử lại
        try{ await __clickDoneThenNext(); }catch(e){}
        if(await __fpChanged(fp, 2500)){ __olmTabIdx=ai+1; return true; }
        __clickRobust(next);
        if(await __fpChanged(fp, 2000)){ __olmTabIdx=ai+1; return true; }
        __olmTabIdx=ai+1;
        appendStatus('  ⚠ Tab nay khong doi noi dung — van sang tab ke tiep.');
        return 'force';
      }
      var next=[].slice.call(document.querySelectorAll('button,a,span,div,[role=button],label')).filter(__visible).filter(function(el){
        var t=(el.textContent||'').trim();
        return t.length<30 && /Câu\s*(sau|tiếp)|Tiếp(\s*theo)?|Next(\s*page)?|Sau\b|Trang\s*sau|→|›|»/i.test(t) && !/trước|prev|previous/i.test(t) && !/nộp\s*bài|lưu\s*bài|submit/i.test(t);
      });
      next.sort(function(a,b){ try{var A=a.getBoundingClientRect(),B=b.getBoundingClientRect(); return (B.width*B.height)-(A.width*A.height);}catch(e){return 0;} });
      for(var i=0;i<Math.min(2,next.length);i++){
        appendStatus('  → Bam "Câu sau" (lan '+(i+1)+')');
        __clickRobust(next[i]);
        if(await __fpChanged(fp, 3000)) return true;
      }
      return false;
    }
    // [BỔ SUNG] Mọi ô chọn (dropdown) dùng để trả lời.
    // 01.js chỉ bắt "select.select-option[ind]" -> BỎ SÓT dạng BẢNG THỐNG KÊ
    // (dropdown nằm trong <table>, không có class/ind) + các dropdown không chuẩn.
    function __selEls(){
      var out=[], seen=new Set();
      __deepAll('select').forEach(function(s){
        if(seen.has(s)) return; seen.add(s);
        try{
          if(s.closest && s.closest('#tht-panel')) return;
          if(!s.options || s.options.length<2) return;
          if(s.closest('form:not(.quiz-form), .search, .comment, .chat')) return;
          var hasInd=(s.getAttribute('ind')!=null)||s.classList.contains('select-option');
          var box=s.closest('.question-content,.itemx,.card-body,.quiz-list,.quiz-itm,.q-item,.quiz-question,.question-box,.fill-me,.card');
          var inCau=false;
          try{
            var td=s.closest('td');
            if(td){ var tb=td.closest('table'); if(tb && /câu\s*\(/i.test(tb.textContent||'')) inCau=true; }
          }catch(e){}
          if(!hasInd && !box && !inCau) return;   // select lạ không rõ -> bỏ qua cho an toàn
          out.push(s);
        }catch(e){}
      });
      return out;
    }
    // [BỔ SUNG] Chữ ký theo LOẠI bài (lấy từ 01.js): phân biệt chính xác hơn việc chỉ đếm phần tử.
    // Ví dụ 2 câu MCQ có cùng text phương án đầu thì phải phân biệt được bằng "ind".
    function __typeSig(){
      var vis=function(el){ try{ return isVisible(el); }catch(e){ return true; } };
      var link=__deepAll('.boxlink.left').filter(vis);
      if(link.length) return 'link:'+link.length+':'+__stemNear(link[0],'.boxlink, .link-list, .exp, pre').slice(0,40);
      var grp=__deepAll('.drag-item').filter(vis);
      if(grp.length) return 'group:'+grp.length+':'+__stemNear(grp[0],'.drag-item, ul.item-in, .group-list, .exp, pre').slice(0,40);
      var dm=__deepAll('.dragmore[ind]').filter(vis);
      if(dm.length) return 'dragmore:'+dm.map(function(x){return x.getAttribute('ind');}).join(',')+':'+__stemNear(dm[0],'.dragmore, .items-drag-box, #dragmore, .exp, pre').slice(0,40);
      var adv=__deepAll('ul.new_click li.new_item').filter(vis);
      if(adv.length) return 'advance:'+adv.length+':'+__stemNear(adv[0],'ul.new_click, .new_input, .advance, .exp, pre').slice(0,40);
      var drag=__deepAll('.dragtext[ind]').filter(vis);
      if(drag.length) return 'drag:'+drag.map(function(x){return x.getAttribute('ind');}).join(',')+':'+__stemNear(drag[0],'.dragtext, .item-drag, .exp, pre').slice(0,40);
      var sel=__selEls().filter(vis);
      if(sel.length) return 'select:'+sel.map(function(x,i){ return x.getAttribute('ind')!=null?x.getAttribute('ind'):i; }).join(',')+':'+__stemNear(sel[0],'select, .selecttext, .exp, pre').slice(0,40);
      var opts=__deepAll('.qselect').filter(vis);
      if(opts.length){ var o=opts[0]; var ind=o.getAttribute('ind')!=null?o.getAttribute('ind'):o.getAttribute('data-ind'); return 'mcq:'+ind+':'+__katexText(o).slice(0,40); }
      var tf=__deepAll('tr.tf-row, .tf-row').filter(vis);
      if(tf.length){ var t=__deepAll('.true-false, #true-false')[0]; return 'tf:'+__katexText(t||tf[0]).slice(0,40); }
      var fill=__deepAll('input[data-accept], .fill-me input, input[placeholder="?"]').filter(vis);
      if(fill.length) return 'fill:'+(fill[0].getAttribute('data-accept')||__katexText(fill[0].closest('.itemx')||fill[0]).slice(0,40));
      return '';
    }
    function __fpNow(){
      // [BỔ SUNG] fingerprint chỉ dựa vào NỘI DUNG trang (không lấy tab đang active),
      // vì class active của tab đổi ngay khi bấm nên bản cũ tưởng "đã chuyển trang" dù nội dung y nguyên.
      var vis=function(el){ try{ return isVisible(el); }catch(e){ return true; } };
      var opts=__deepAll('.qselect').filter(vis).map(function(o){return (o.textContent||'').slice(0,16);}).join('|');
      var fillEls=__deepAll('input[data-accept], input[placeholder="?"], .fill-me input, textarea').filter(vis);
      var inputs=fillEls.map(function(i){ return String((i.value||'').length); }).join(',');
      var tf=__deepAll('tr.tf-row').filter(vis).map(function(r){ return (r.textContent||'').replace(/\s+/g,' ').trim().slice(0,20); }).join('|');
      var other=__deepAll('.dragtext[ind], .dragmore[ind], .boxlink.left, .drag-item, ul.new_click li.new_item').filter(vis).length;
      return opts+'#'+inputs+'#'+tf+'#'+other+'#'+__typeSig();
    }
    async function __fpChanged(oldFp, timeout){
      var t1=Date.now();
      while(Date.now()-t1<timeout){
        await __sleep(120);
        var n=__fpNow();
        if(n && n!==oldFp) return true;
      }
      return false;
    }
    function __domGroups(){
      var okEl=function(el){
        try{ if(el.closest && el.closest('#tht-panel')) return false; }catch(e){}
        // [BỔ SUNG] loại phần tử thuộc widget kéo-thả (cột/thẻ chữ) khỏi nhóm MCQ,
        // nếu không tool sẽ coi các CỘT là phương án và bấm nhầm.
        try{ if(__isDragWidget(el)) return false; }catch(e){}
        return __visible(el);
      };
      var qs=__deepAll('.qselect').filter(okEl);
      if(!qs.length) qs=__deepAll('.quiz-itm, .quiz-list > li').filter(okEl);
      if(!qs.length){
        // [BỔ SUNG] đề dùng markup khác: nhận diện phương án dạng "A. ..." / "A) ..."
        qs=__deepAll('[class*="quiz-itm"], [class*="answer"], [class*="option"]').filter(function(el){
          if(!okEl(el)) return false;
          var t=__katexText(el);
          return t.length>0 && t.length<400;
        });
      }
      // [BỔ SUNG] radio/checkbox làm phương án trắc nghiệm
      if(!qs.length){
        qs=__deepAll('input[type=radio], input[type=checkbox]').filter(okEl).map(function(inp){
          try{ return inp.closest('label') || inp.parentElement || inp; }catch(e){ return inp; }
        });
      }
      if(!qs.length) return [];
      var optsIn=function(c){
        var a=[].slice.call(c.querySelectorAll('.qselect')).filter(__visible);
        if(a.length>=2) return a;
        // radio/checkbox nhóm
        var rc=[].slice.call(c.querySelectorAll('input[type=radio], input[type=checkbox]')).filter(__visible).map(function(inp){
          try{ return inp.closest('label') || inp.parentElement || inp; }catch(e){ return inp; }
        });
        if(rc.length>=2 && rc.length<=8){
          // dedupe by element
          var seen=new Set(), out=[]; rc.forEach(function(x){ if(!seen.has(x)){ seen.add(x); out.push(x); } });
          if(out.length>=2) return out;
        }
        var b=[].slice.call(c.querySelectorAll('.quiz-itm, .quiz-list > li, label, .option, [class*="answer"], [class*="choice"]')).filter(function(x){
          if(!__visible(x)) return false;
          var t=__katexText(x);
          return t.length>0 && t.length<500;
        });
        var labeled=b.filter(function(x){ return /^[A-Da-d][\.\)\:]\s*\S/.test(__katexText(x)); });
        if(labeled.length>=2 && labeled.length<=8) return labeled;
        if(b.length>=2 && b.length<=8) return b;
        return [];
      };
      var groups=[], used=new Set();
      var sels=['.quiz-itm','.quiz-list','tr','li','.question-content','.itemx','.card-body','.card','fieldset','.q-item','.quiz-question'];
      sels.forEach(function(sel){
        qs.forEach(function(el){
          if(used.has(el)) return;
          var c=null;
          try{ c=el.closest(sel); }catch(e){}
          if(!c||c===el) return;
          try{ if(c.querySelectorAll('.quiz-list, ol.quiz-list').length>1) return; }catch(e){}
          var inside=optsIn(c);
          if(inside.length<2||inside.length>8) return;
          inside.forEach(function(x){ used.add(x); });
          groups.push(inside);
        });
      });
      var left=qs.filter(function(el){ return !used.has(el); });
      if(left.length){
        var map=new Map();
        left.forEach(function(el){
          var anc=el.parentElement, chosen=null, d=0;
          while(anc && d<5){
            var n=0;
            try{ n=anc.querySelectorAll('.qselect, .quiz-itm, .quiz-list > li, input[type=radio], input[type=checkbox]').length; }catch(e){}
            if(n>=2 && n<=8){ chosen=anc; break; }
            anc=anc.parentElement; d++;
          }
          if(!chosen) chosen=el.parentElement||el;
          if(!map.has(chosen)) map.set(chosen,[]);
          map.get(chosen).push(el);
        });
        map.forEach(function(arr){ if(arr.length>=2) groups.push(arr); });
      }
      // gom theo tên radio (cùng name = 1 câu)
      try{
        var radios=__deepAll('input[type=radio]').filter(okEl);
        var byName=new Map();
        radios.forEach(function(r){ var n=r.getAttribute('name')||''; if(!n) return; if(!byName.has(n)) byName.set(n,[]); byName.get(n).push(r.closest('label')||r.parentElement||r); });
        byName.forEach(function(arr){
          if(arr.length<2) return;
          var uniq=[]; var s=new Set(); arr.forEach(function(x){ if(!s.has(x)){s.add(x); uniq.push(x);} });
          // nếu chưa nằm trong group nào
          var free=uniq.filter(function(x){ return !groups.some(function(g){ return g.indexOf(x)>=0; }); });
          if(free.length>=2) groups.push(free);
        });
      }catch(e){}
      if(!groups.length && qs.length>=2){
        for(var i=0;i<qs.length;i+=4) groups.push(qs.slice(i,i+4));
      }
      groups.sort(function(a,b){ try{return a[0].getBoundingClientRect().top - b[0].getBoundingClientRect().top;}catch(e){return 0;} });
      return groups;
    }

    function __setValue(inp,val){
      try{ inp.focus(); }catch(e){}
      try{
        // [BỔ SUNG] ô nhập dạng contenteditable (không có .value)
        if(inp.getAttribute && inp.getAttribute('contenteditable')!=null){
          inp.textContent=String(val);
        } else {
          var d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(inp),'value');
          if(d&&d.set) d.set.call(inp,String(val)); else inp.value=String(val);
        }
      }catch(e){ try{ inp.value=String(val); }catch(e){} }
      ['beforeinput','input','change','keyup'].forEach(function(ev){
        try{ inp.dispatchEvent(new Event(ev,{bubbles:true,composed:true})); }catch(e){}
      });
      try{ inp.blur(); }catch(e){}
    }
    // [SỬA LỖI] chuẩn hóa đáp án điền: bỏ phương án thay thế (actors||actresses, colour/color)
    // để điền đúng 1 giá trị; không phá chuỗi nhiều ô dạng số "5 | 7".
    function __pickFillAns(s){
      var v=String(s==null?'':s).replace(/\s+/g,' ').trim();
      if(!v) return v;
      if(v.indexOf('||')>=0) return v.split('||')[0].trim();
      if(v.indexOf('/')>=0){
        var parts=v.split('/').map(function(x){return x.trim();}).filter(function(x){return x.length;});
        if(parts.length>1 && /[A-Za-zÀ-ỹ]/.test(parts[0]) && /[A-Za-zÀ-ỹ]/.test(parts[1])) return parts[0];
      }
      if(v.indexOf('|')>=0){
        var parts2=v.split('|').map(function(x){return x.trim();}).filter(function(x){return x.length;});
        if(parts2.length>1){
          var allNum=parts2.every(function(x){ return /^-?[\d.,]+$/.test(x); });
          var looksAlt=parts2.every(function(x){ return /[A-Za-zÀ-ỹ]/.test(x) && x.split(/\s+/).length<=3; });
          if(!allNum && looksAlt) return parts2[0];
        }
      }
      return v;
    }

    /* ===== API fetch + parse (rich: 01.js) ===== */
    var apiItems = [];
    var __lastApiDebug = { calls: [] };
    // [BỔ SUNG] CSRF: ưu tiên meta, sau đó cookie XSRF-TOKEN (một số trang đề thi không có meta)
    function __csrfToken(){
      try{
        var meta=document.querySelector('meta[name="csrf-token"]');
        if(meta && meta.getAttribute('content')) return meta.getAttribute('content');
      }catch(e){}
      try{
        var m=document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
        if(m) return decodeURIComponent(m[1]);
      }catch(e){}
      return '';
    }
    // [BỔ SUNG] Gọi API theo từng "nhóm skill" + thử nhiều endpoint.
    // Trang ĐỀ THI (data_exam, type_exam != 0) không có data_practice nên bản cũ gửi
    // id_subject/id_skill mặc định -> API trả rỗng, không rõ lý do.
    async function __postQuizIds(ids, subject, skill, cv, endpoint, token){
      var body=ids.map(function(id,i){ return 'qlib_list['+i+']='+encodeURIComponent(id); });
      body.push('id_subject='+encodeURIComponent(subject));
      body.push('id_skill='+encodeURIComponent(skill));
      body.push('cv_q='+encodeURIComponent(cv));
      body.push('encodeXORBase64=true');
      var rec={endpoint:endpoint, ids:ids.length, skill:skill, status:0, note:''};
      try{
        var res=await fetch(endpoint,{
          method:'POST', credentials:'same-origin',
          headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-CSRF-TOKEN':token,'X-Requested-With':'XMLHttpRequest','Accept':'application/json, text/javascript, */*; q=0.01'},
          body:body.join('&')
        });
        var text=''; try{ if(typeof res.text==='function') text=await res.text(); }catch(e){ text=''; }
        rec.status=res.status;
        var data=null; try{ data=JSON.parse(text); }catch(e){}
        if(data==null && typeof res.json==='function'){ try{ data=await res.json(); }catch(e){ data=null; } }
        rec.note=(data==null? ('khong-phai-JSON: '+String(text).slice(0,160)) : ('json '+(Array.isArray(data)? data.length+' phan tu' : typeof data)));
        __lastApiDebug.calls.push(rec);
        return {ok:res.ok, status:res.status, data:data, text:text, endpoint:endpoint};
      }catch(e){
        rec.note='fetch-error: '+e.message;
        __lastApiDebug.calls.push(rec);
        return {ok:false, status:0, data:null, text:'', endpoint:endpoint, err:e.message};
      }
    }
    async function __runTool(){
      var dp=window.data_practice||{};
      var ids=Array.isArray(dp.list_id_quiz)?dp.list_id_quiz:[];
      if(!ids.length){ appendStatus('Khong co ID cau hoi.'); return []; }
      var ap=__apiParams(dp);
      var subject=dp.id_subject||ap.id_subject||'3';
      var baseSkill=dp.id_category||ap.id_category||'5099276443';
      var cv=dp.cv_q||ap.cv_q||'1';
      __lastApiDebug={calls:[], subject:subject, baseSkill:baseSkill, cv:cv, totalIds:ids.length};
      var token=__csrfToken();

      // [BỔ SUNG] Chia lô theo skill: API cần id_skill đúng với từng qlib
      var sm=null;
      try{ sm=dp.list_main_skill || ((__W.data_exam&&__W.data_exam.list_main_skill)||null); }catch(e){}
      var plan=[];
      if(sm && typeof sm==='object' && Object.keys(sm).length){
        var bySkill=new Map();
        ids.forEach(function(id){
          var arr=sm[id]; if(!arr) arr=sm[String(id)];
          var sk=(arr && arr.length)? String(arr[0]) : null;
          var key=sk||'__base__';
          if(!bySkill.has(key)) bySkill.set(key,[]);
          bySkill.get(key).push(id);
        });
        bySkill.forEach(function(arr,key){ plan.push({ids:arr, skill:(key==='__base__'? baseSkill : key)}); });
      } else {
        plan.push({ids:ids.slice(), skill:baseSkill});
      }

      var isExam=/\/exam|de-thi|de_thi|kiểm tra|kiem-tra/i.test(location.pathname+location.search);
      var endpoints=isExam
        ? ['/exam/question/get-question-of-ids','/course/question/get-question-of-ids']
        : ['/course/question/get-question-of-ids','/exam/question/get-question-of-ids'];
      var epOk=null, merged=[], errors=[];
      for(var pi=0; pi<plan.length; pi++){
        var chunk=plan[pi], got=null;
        var eps=epOk? [epOk] : endpoints;
        for(var ei=0; ei<eps.length; ei++){
          var r=await __postQuizIds(chunk.ids, subject, chunk.skill, cv, eps[ei], token);
          if(r.ok && Array.isArray(r.data) && r.data.length){ got=r.data; epOk=eps[ei]; break; }
          if(r.ok && Array.isArray(r.data) && !r.data.length && epOk===null){ epOk=eps[ei]; }
          if(!r.ok || r.data==null){
            errors.push(eps[ei]+' → HTTP '+r.status+' '+(r.data==null? String(r.text||'').slice(0,140) : ''));
          }
        }
        if(got) merged.push.apply(merged, got);
        else if(!errors.length) errors.push('nhóm skill '+chunk.skill+': API rỗng ('+chunk.ids.length+' ID)');
      }
      // Gộp + bỏ trùng theo nội dung (nếu API trả lặp giữa các lô)
      if(plan.length>1 && merged.length){
        var seenSig=new Set(), uniq=[];
        merged.forEach(function(q){
          var sig=String((q&&(q.id||q.id_quiz||q.content))||'').slice(0,80);
          if(sig && seenSig.has(sig)) return;
          if(sig) seenSig.add(sig);
          uniq.push(q);
        });
        merged=uniq;
      }
      if(!merged.length){
        appendStatus('❌ API khong tra du lieu. '+(errors[0]||'khong ro ly do'));
        if(errors.length>1) appendStatus('   '+errors.slice(1,3).join(' | '));
        try{ console.warn('[TOOL OLM] API debug:', __lastApiDebug); }catch(e){}
        return [];
      }
      return __buildItemsFromApi(merged);
    }

    /* ===== [BỔ SUNG v7.5] Dựng item đáp án từ dữ liệu API (tách ra để offline dùng lại) ===== */
    function __buildItemsFromApi(data){

      function decodeB64Xor(b64){ return __xorDecode(b64||'', __xorKeys()); }
      function htmlToNode(h){ var d=document.createElement('div'); d.innerHTML=h; return d; }
      // [BỔ SUNG v7.5] "drag-more-item" (kéo chữ vào ô) — đáp án nằm trong json_content,
      // không có trong HTML tĩnh. Port từ message.txt: lấy children của item có correct===true.
      function __nodeText(n){
        if(n==null) return '';
        if(typeof n==='string') return n;
        if(typeof n!=='object') return '';
        var parts=[];
        if(n.text!=null) parts.push(String(n.text));
        if(Array.isArray(n.children)) parts.push.apply(parts, n.children.map(__nodeText));
        // ghép thông minh: "nhà"+"cửa" -> "nhà cửa", nhưng "1"+"/"+"2" -> "1/2"
        var out='';
        parts.forEach(function(p){
          if(!p) return;
          if(out && /[0-9A-Za-zÀ-ỹ]$/.test(out) && /^[0-9A-Za-zÀ-ỹ]/.test(p)) out+=' ';
          out+=p;
        });
        return out;
      }
      function walkDragItems(n,out){
        if(!n||typeof n!=='object') return;
        if(n.type==='drag-more-item'){
          if(n.correct===true){
            var t=clean2(__nodeText(n));
            if(t) out.push(t);
          }
          return;
        }
        for(var k of Object.keys(n)){
          var v=n[k];
          if(Array.isArray(v)){ for(var it of v) walkDragItems(it,out); }
          else if(v&&typeof v==='object') walkDragItems(v,out);
        }
      }
      function clean2(s){ return String(s==null?'':s).replace(/\s+/g,' ').trim(); }
      function walkFill(n){
        if(!n||typeof n!=='object') return null;
        if(n.type==='fillme-input'&&n.content!=null) return String(n.content);
        for(var k of Object.keys(n)){
          var v=n[k], r=null;
          if(Array.isArray(v)){ for(var it of v){ r=walkFill(it); if(r!=null) return r; } }
          else if(v&&typeof v==='object'){ r=walkFill(v); if(r!=null) return r; }
        }
        return null;
      }
      function walkFills(n,out){
        if(!n||typeof n!=='object') return;
        if(n.type==='fillme-input'&&n.content!=null){ out.push(String(n.content)); return; }
        for(var k of Object.keys(n)){
          var v=n[k];
          if(Array.isArray(v)){ for(var it of v) walkFills(it,out); }
          else if(v&&typeof v==='object') walkFills(v,out);
        }
      }
      function walkTF(n,out){
        if(!n||typeof n!=='object') return;
        if(n.name==='true-false'&&Array.isArray(n.children)){ for(var c of n.children) out.push(c.correct===true); return; }
        for(var k of Object.keys(n)){
          var v=n[k];
          if(Array.isArray(v)){ for(var it of v) walkTF(it,out); }
          else if(v&&typeof v==='object') walkTF(v,out);
        }
      }
      function clean(s){ return (s||'').replace(/\s+/g,' ').trim(); }
      // [SỬA LỖI] đáp án điền có thể chứa nhiều phương án chấp nhận ("actors||actresses", "colour/color")
      // -> lấy đáp án chính (phần đầu) khi điền vào MỘT ô, không phá vỡ chuỗi nhiều ô "5 | 7".
      function __pickFillAns(s){
        var v=String(s==null?'':s).replace(/\s+/g,' ').trim();
        if(!v) return v;
        if(v.indexOf('||')>=0) return v.split('||')[0].trim();
        // "a/b" hoặc "a / b" là phương án thay thế (chữ) -> lấy phương án đầu
        if(v.indexOf('/')>=0){
          var parts=v.split('/').map(function(x){return x.trim();}).filter(function(x){return x.length;});
          if(parts.length>1 && /[A-Za-zÀ-ỹ]/.test(parts[0]) && /[A-Za-zÀ-ỹ]/.test(parts[1])) return parts[0];
        }
        // "a | b" chỉ coi là phương án thay thế khi không phải danh sách số/giá trị nhiều ô rõ ràng
        if(v.indexOf('|')>=0){
          var parts2=v.split('|').map(function(x){return x.trim();}).filter(function(x){return x.length;});
          if(parts2.length>1){
            var allNum=parts2.every(function(x){ return /^-?[\d.,]+$/.test(x); });
            var looksAlt=parts2.every(function(x){ return /[A-Za-zÀ-ỹ]/.test(x) && x.split(/\s+/).length<=3; });
            if(!allNum && looksAlt) return parts2[0];
          }
        }
        return v;
      }
      function parseInputs(spans){
        return spans.map(function(s){
          var parts=clean(s.textContent).split('||').map(function(x){return x.trim();}).filter(function(x){return x.length;});
          return {correct: parts[0]||'', opts: parts};
        });
      }

      // [SỬA LỖI] MỘT qlib_id có thể chứa NHIỀU câu (vd title "Pronunciation (3 câu)").
      // Bản cũ coi mỗi qlib = 1 câu -> đề 45 câu / 13 tab chỉ lấy được 13 đáp án (câu đầu mỗi bài),
      // 32 câu còn lại "KHÔNG khớp đáp án nào". Nay tách mỗi khối câu thành 1 item riêng.
      function walkTFSets(n,out){
        if(!n||typeof n!=='object') return;
        if(n.name==='true-false'&&Array.isArray(n.children)){ out.push(n.children.map(function(c){ return c.correct===true; })); return; }
        for(var k of Object.keys(n)){
          var v=n[k];
          if(Array.isArray(v)){ for(var it of v) walkTFSets(it,out); }
          else if(v&&typeof v==='object') walkTFSets(v,out);
        }
      }
      var WIDGET_SEL='ol.quiz-list, ol.true-false, .true-false, input[data-accept], .selecttext, .dragtext, .dragmore, .link-list, .group-list, .advance, ul.new_click';
      function splitQuestions(root){
        var conts=['.question-content','.itemx','.quiz-question','.question-box','.q-item'];
        for(var ci=0; ci<conts.length; ci++){
          var found=[]; try{ found=[...root.querySelectorAll(conts[ci])]; }catch(e){}
          found=found.filter(function(c){ try{ return !!c.querySelector(WIDGET_SEL); }catch(e){ return false; } });
          if(found.length>=1) return found;
        }
        // Không có khối câu rõ ràng -> gom theo "widget đáp án" (mỗi widget là 1 câu)
        var units=[];
        try{
          [...root.querySelectorAll(WIDGET_SEL)].forEach(function(m){
            var u=null;
            try{ u=m.closest('.question-content, .itemx, .card-body, .quiz-question, .question-box, .q-item'); }catch(e){}
            if(!u){
              // [SỬA LỖI] câu điền nhiều ô (vd "Nhap hai so: [5] va [7]"): gom về CÙNG một khối
              // cha (p/li/td/label) thay vì tách mỗi <input> thành 1 câu riêng.
              var isFillWidget=false;
              try{
                isFillWidget = /^(INPUT|TEXTAREA)$/.test(m.tagName||'') || m.getAttribute('contenteditable')==='true';
              }catch(e){}
              if(isFillWidget){
                try{ u=m.closest('p, li, td, label, .fill-me, div'); }catch(e){}
                if(u===root) u=null;
              }
            }
            if(!u){
              var node=m;
              for(var d=0; d<4 && node && node.parentElement && node.parentElement!==root; d++){
                var par=node.parentElement, n2=0;
                try{ n2=par.querySelectorAll(WIDGET_SEL).length; }catch(e){ break; }
                if(n2>1) break;
                node=par;
              }
              u=node;
              // [SỬA LỖI] nếu "unit" chính là widget (span.selecttext / input / ol...) thì bọc nó
              // cùng các phần tử đứng ngay trước (phần đề bài) vào 1 div. Bản trước giữ nguyên
              // span -> parseUnit không thấy .selecttext (querySelectorAll bỏ chính nó) nên
              // câu "thả xuống" bị mất đáp án và stem chỉ còn "Do||Xanh||Tim".
              if(u===m){
                try{
                  var doc2=root.ownerDocument||document;
                  var wrap=doc2.createElement('div');
                  var prev=m.previousElementSibling, pickedPrev=[];
                  while(prev && pickedPrev.length<6){
                    var hasW=false;
                    try{ hasW=!!prev.querySelector(WIDGET_SEL) || (prev.matches && prev.matches(WIDGET_SEL)); }catch(e){}
                    if(hasW) break;
                    pickedPrev.unshift(prev);
                    prev=prev.previousElementSibling;
                  }
                  pickedPrev.forEach(function(n){ wrap.appendChild(n.cloneNode(true)); });
                  wrap.appendChild(m.cloneNode(true));
                  u=wrap;
                }catch(e){}
              }
            }
            if(u && units.indexOf(u)<0) units.push(u);
          });
        }catch(e){}
        return units;
      }
      function parseUnit(root, q, tfSets, fillVals, seen){
        var isSelf=function(sel){ try{ return !!(root.matches && root.matches(sel)); }catch(e){ return false; } };
        var ol=isSelf('ol.quiz-list') ? root : root.querySelector('ol.quiz-list');
        var tfEl=isSelf('ol.true-false, .true-false') ? root : root.querySelector('ol.true-false, .true-false ol, ol[data-key].true-false, #true-false, .true-false');
        var expEl=root.querySelector('.exp');
        var item={kind:'mcq', bankTitle:q.title||'', stem:'', options:[], correctIdx:-1, correctIdxs:[], fill:null, fills:[], tf:null, exp:clean(expEl?expEl.textContent:''), drags:[], selects:[], dragmores:[], links:[], groups:[], advance:false};
        item.drags=parseInputs([...root.querySelectorAll('.dragtext')]);
        item.selects=parseInputs([...root.querySelectorAll('.selecttext')]);
        item.dragmores=parseInputs([...root.querySelectorAll('.dragmore')]);
        item.links=[...root.querySelectorAll('.link-list > li')].map(function(li){
          var parts=clean(li.textContent).split('||').map(function(x){return x.trim();}).filter(function(x){return x.length;});
          return {label: parts[parts.length-1]||'', raw: clean(li.textContent)};
        });
        item.groups=[...root.querySelectorAll('.group-list > li')].map(function(li){
          var parts=clean(li.textContent).split('||').map(function(x){return x.trim();}).filter(function(x){return x.length;});
          return {title: parts[0]||'', items: parts.slice(1)};
        });
        // [BỔ SUNG] dạng "cột" (Put the words into the correct columns) dùng markup khác
        // .group-list -> lấy thêm từ column-list / data-group để tool biết cột nào chứa chữ nào.
        if(!item.groups.length){
          var gl=root.querySelectorAll('.column-list > li, .col-list > li, .bucket-list > li, .drag-group > li, [data-group-list] > li');
          item.groups=[].map.call(gl, function(li){
            var parts=clean(li.textContent).split('||').map(function(x){return x.trim();}).filter(function(x){return x.length;});
            return {title: parts[0]||'', items: parts.slice(1)};
          }).filter(function(g){ return g.title && g.items.length; });
        }
        if(!item.groups.length){
          var zs=root.querySelectorAll('[data-group]');
          item.groups=[].map.call(zs, function(z){
            var title=clean(z.getAttribute('data-group')||'');
            var raw=clean(z.textContent||'');
            var items=[];
            if(raw.indexOf('||')>=0){
              items=raw.split('||').map(function(x){return x.trim();}).filter(function(x){return x.length;});
            } else {
              items=[].map.call(z.querySelectorAll('.drag-item, li, .item'), function(x){return clean(x.textContent);}).filter(Boolean);
            }
            return {title:title, items:items};
          }).filter(function(g){ return g.title && g.items.length; });
        }
        item.advance=!!root.querySelector('.advance');
        item.fills=[...root.querySelectorAll('input[data-accept]')].map(function(el){ return String(el.getAttribute('data-accept')||'').trim(); });
        if(tfEl){
          item.kind='tf';
          item.tf=[];
          // [SỬA LỖI] bài nhiều câu Đúng/Sai: lấy đúng bộ đáp án theo thứ tự câu
          if(tfSets && tfSets.length){
            var set=(tfSets.length>1 && seen.tfSeen<tfSets.length)? tfSets[seen.tfSeen] : tfSets[0];
            item.tf=set.slice();
          }
          // fallback: đọc class đáp án ngay trên HTML tĩnh (.correctAnswer / .correct)
          if(!item.tf.length){
            var tfLis=[].slice.call(root.querySelectorAll('.true-false li, #true-false li, ol[data-key] li'));
            var hasMark=tfLis.some(function(li){ return /(^|\s)(correctAnswer|correct|xcorrect)(\s|$)/i.test(li.className||''); });
            if(hasMark){
              item.tf=tfLis.map(function(li){ return /(^|\s)(correctAnswer|correct|xcorrect)(\s|$)/i.test(li.className||''); });
            }
          }
          var clone=root.cloneNode(true);
          if(clone.querySelector('.true-false')) clone.querySelector('.true-false').remove();
          if(clone.querySelector('#true-false')) clone.querySelector('#true-false').remove();
          if(clone.querySelector('.exp')) clone.querySelector('.exp').remove();
          if(clone.querySelector('pre')) clone.querySelector('pre').remove();
          item.stem=clean(clone.textContent);
        } else if(ol){
          item.kind='mcq';
          item.options=[...ol.children].map(function(li,i){
            // hỗ trợ câu NHIỀU đáp án: gom mọi <li class="correctAnswer"> vào correctIdxs.
            if(li.classList.contains('correctAnswer') || li.classList.contains('correct') || li.classList.contains('xcorrect')){
              item.correctIdxs.push(i);
              if(item.correctIdx<0) item.correctIdx=i;
            }
            return clean(li.textContent);
          });
          var clone=root.cloneNode(true);
          if(clone.querySelector('ol.quiz-list')) clone.querySelector('ol.quiz-list').remove();
          if(clone.querySelector('.exp')) clone.querySelector('.exp').remove();
          if(clone.querySelector('pre')) clone.querySelector('pre').remove();
          item.stem=clean(clone.textContent);
        } else {
          item.kind='fill';
          var clone=root.cloneNode(true);
          if(clone.querySelector('.exp')) clone.querySelector('.exp').remove();
          if(clone.querySelector('pre')) clone.querySelector('pre').remove();
          [].slice.call(clone.querySelectorAll('.dragtext, .selecttext')).forEach(function(n){ try{n.remove();}catch(e){} });
          item.stem=clean(clone.textContent);
          var inp=root.querySelector('input[data-accept]');
          if(inp) item.fill=String(inp.getAttribute('data-accept')||'').trim();
          // [SỬA LỖI] nhiều câu điền trong 1 bài -> lấy đáp án theo thứ tự câu
          if(!item.fills.length && fillVals && fillVals.length){
            var fv=(fillVals.length>1 && seen.fillSeen<fillVals.length)? [fillVals[seen.fillSeen]] : fillVals.slice();
            item.fills=fv.map(function(x){ return String(x==null?'':x).trim(); });
          }
          if(item.fill==null && item.fills.length) item.fill=item.fills[0];
          if(!item.fills.length && item.fill!=null) item.fills=[item.fill];
        }
        return item;
      }

      var items=[];
      data.forEach(function(q){
        var full=htmlToNode(decodeB64Xor(q.content||''));
        var tfSets=[];
        if(q.json_content){ try{ walkTFSets(JSON.parse(decodeB64Xor(q.json_content)), tfSets); }catch(e){} }
        var fillVals=[];
        if(q.json_content){ try{ walkFills(JSON.parse(decodeB64Xor(q.json_content)), fillVals); }catch(e){} }
        var dragVals=[];
        if(q.json_content){ try{ walkDragItems(JSON.parse(decodeB64Xor(q.json_content)), dragVals); }catch(e){} }
        var units=splitQuestions(full);
        if(!units.length) units=[full];
        var seen={tfSeen:0, fillSeen:0};
        units.forEach(function(unit){
          var item=parseUnit(unit, q, tfSets, fillVals, seen);
          if(!item) return;
          // [BỔ SUNG v7.5] đáp án "kéo chữ" lấy từ json_content (fallback khi HTML không có đáp án)
          if(dragVals.length) item.dragApi=dragVals.slice();
          if(item.kind==='tf') seen.tfSeen++;
          else if(item.kind==='fill') seen.fillSeen++;
          items.push(item);
        });
      });

      apiItems=items;
      appendStatus('Da lay '+items.length+' dap an ('+items.filter(function(b){return b.kind==='mcq';}).length+' trac nghiem, '+items.filter(function(b){return b.kind==='tf';}).length+' dung/sai, '+items.filter(function(b){return b.kind==='fill';}).length+' dien).');
      return items;
    }

    /* ===== 01.js helpers (unprefixed) for auto-loop ===== */
    var roots = __collectRoots();
    // redefine collectRoots/deepAll in 01 style
    function collectRoots(){
      var rts=[], seen=new Set();
      function addRoot(r){ if(r && !seen.has(r)){ seen.add(r); rts.push(r); } }
      function walkRoot(r){
        addRoot(r);
        var all=[]; try{ all=r.querySelectorAll('*'); }catch(e){ return; }
        for(var i=0;i<all.length;i++) if(all[i].shadowRoot) walkRoot(all[i].shadowRoot);
      }
      walkRoot(document);
      for(var f of document.querySelectorAll('iframe')){ try{ if(f.contentDocument) walkRoot(f.contentDocument); }catch(e){} }
      return rts;
    }
    function deepAll(sel){
      var rts=collectRoots();
      var out=[];
      for(var r of rts){ try{ out.push.apply(out, [].slice.call(r.querySelectorAll(sel))); }catch(e){} }
      return out;
    }
    function isVisible(el){
      if(!el) return false;
      try{
        if(el.getClientRects && el.getClientRects().length) return true;
        var body=document.body;
        if(body && body.getClientRects && body.getClientRects().length===0) return true;
        return false;
      }catch(e){ return true; }
    }
    function clean(s){ return (s||'').replace(/\s+/g,' ').trim(); }
    function unify(s){ return __unify(s); }
    function norm(s){ return __norm(s); }
    function fracKey(s){ return __fracKey(s); }
    function numSim(a,b){ return __numSim(a,b); }
    function bigrams(s){ return __bigrams(s); }
    function dice(a,b){ return __dice(a,b); }
    function katexText(node){ return __katexText(node); }
    function realClick(el){
      if(!el) return false;
      try{
        var r=el.getBoundingClientRect();
        var cx=r.left+r.width/2, cy=r.top+r.height/2;
        var opts={bubbles:true,cancelable:true,composed:true,view:window,clientX:cx,clientY:cy};
        el.dispatchEvent(new PointerEvent('pointerdown',opts));
        el.dispatchEvent(new MouseEvent('mousedown',opts));
        el.dispatchEvent(new PointerEvent('pointerup',opts));
        el.dispatchEvent(new MouseEvent('mouseup',opts));
        el.dispatchEvent(new MouseEvent('click',opts));
      }catch(e){ try{ el.click(); }catch(e2){} }
      return true;
    }
    function setNativeValue(el,value){
      if(!el) return false;
      try{ el.focus(); }catch(e){}
      try{
        var proto=Object.getPrototypeOf(el);
        var desc=Object.getOwnPropertyDescriptor(proto,'value');
        if(desc && desc.set) desc.set.call(el,value); else el.value=value;
      }catch(e){ try{ el.value=value; }catch(e2){} }
      var fire=function(type,Ctor){
        try{ el.dispatchEvent(new Ctor(type,{bubbles:true,cancelable:true,composed:true,data:value,inputType:'insertText'})); }
        catch(e){ try{ el.dispatchEvent(new Event(type,{bubbles:true,composed:true})); }catch(e2){} }
      };
      fire('beforeinput',InputEvent);
      fire('input',InputEvent);
      fire('change',Event);
      fire('keyup',KeyboardEvent);
      try{ el.blur(); }catch(e){}
      return true;
    }
    function findBtn(id){
      for(var r of collectRoots()){
        try{ var el=r.querySelector('#'+id); if(el && el.getClientRects && el.getClientRects().length) return el; }catch(e){}
      }
      for(var r of collectRoots()){
        try{ var el=r.querySelector('#'+id); if(el) return el; }catch(e){}
      }
      return null;
    }
    function waitFor(pred,ms,poll){
      poll=poll||120;
      var t0=Date.now();
      while(Date.now()-t0<ms){ if(pred()) return true; /* sync poll */ }
      // async version below
      return false;
    }
    async function waitPred(pred,ms,poll){
      poll=poll||120;
      var t0=Date.now();
      while(Date.now()-t0<ms){ if(pred()) return true; await new Promise(function(r){setTimeout(r,poll);}); }
      return false;
    }
    function groupBy(els,getKey){
      var map=new Map();
      for(var el of els){
        var k=null; try{ k=getKey(el); }catch(e){}
        if(!k) k=el;
        if(!map.has(k)) map.set(k,[]);
        map.get(k).push(el);
      }
      return [...map.values()];
    }
    function textOf(node,dropSel){
      if(!node) return '';
      try{
        var wrap=document.createElement('div');
        wrap.appendChild(node.cloneNode(true));
        // [BỔ SUNG] bỏ script/style/panel tool trước khi lấy text (tránh stem bị nhiễm source code)
        wrap.querySelectorAll('script, style, noscript, #tht-panel').forEach(function(x){ try{ x.remove(); }catch(e){} });
        if(dropSel) wrap.querySelectorAll(dropSel).forEach(function(x){ x.remove(); });
        return norm(__katexText(wrap));
      }catch(e){ return ''; }
    }
    function stemNear(el,dropSel){
      var quick=el.closest && (el.closest('.question-content')||el.closest('.itemx')||el.closest('.card-body'));
      if(quick){ var s=textOf(quick,dropSel); if(s.length>=4) return s; }
      var base='input, textarea, .qselect, .quiz-list, .exp, pre, [contenteditable], .mark';
      var node=el, best='';
      for(var i=0;i<12 && node;i++){
        var parent=null; try{ parent=node.parentElement || (node.parentNode && node.parentNode.host) || null; }catch(e){ parent=null; }
        if(!parent) break;
        var s=textOf(parent,base);
        s=s.replace(/trảlời:?/g,'').replace(/answer:?/g,'').trim();
        if(s.length>=12 && !/^câu\d+\s*đ/i.test(s)){ best=s; break; }
        node=parent;
      }
      return best || norm(el.getAttribute && (el.getAttribute('data-accept')||''));
    }

    var filledFills=new Set();

    /* ===== [BỔ SUNG] trạng thái + tiện ích dùng chung (port thêm từ 01.js/02.js) ===== */
    // Ghi nhớ phần tử đã trả lời trong TRANG hiện tại -> tránh bấm/điền lặp khi auto-loop
    // quét lại DOM nhiều lần (nguyên nhân bấm 2 lần làm bỏ chọn đáp án).
    var __answeredEls=new Set();
    // [BỔ SUNG] nhớ giá trị mình đã điền cho từng ô, kèm số tab. Khi sang tab khác mà DOM
    // bị dùng lại (React tái sử dụng node) thì xoá giá trị cũ để không "tưởng đã trả lời".
    var __fillOwner=new WeakMap();
    var __tabNo=-1;
    function __markAns(res){
      if(!res || !res.ok) return;
      if(res.el) __answeredEls.add(res.el);
      (res.els||[]).forEach(function(x){
        if(!x) return;
        if(x.nodeType===1){ __answeredEls.add(x); return; }
        if(x.el && x.el.nodeType===1){ __answeredEls.add(x.el); return; }
        if(x.sel){ __answeredEls.add(x.sel); return; }
        if(x.blank){ __answeredEls.add(x.blank); return; }
        if(x.li){ __answeredEls.add(x.li); return; }
        if(x.left){ __answeredEls.add(x.left); return; }
      });
      (res.inputs||[]).forEach(function(x){ if(x) __answeredEls.add(x); });
      if(res.input) __answeredEls.add(res.input);
    }
    function __pageSig(){
      var vis=function(el){ try{ return isVisible(el); }catch(e){ return true; } };
      // [BỔ SUNG] lấy cả CHỮ của khối câu hỏi: trước đây chỉ lấy option/input nên 2 trang khác nhau
      // nhưng cùng "không có qselect" (vd trang chọn-thả-xuống vs trang kéo-thả) bị coi là 1 trang.
      var parts=[];
      deepAll('.itemx, .question-content, .card-body').filter(vis).forEach(function(c){
        var t=clean(c.textContent);
        if(t) parts.push(t.slice(0,120));
      });
      var counts=['.qselect','input[data-accept]','.fill-me input','tr.tf-row','.dragtext[ind]','.dragmore[ind]','select.select-option[ind]','.boxlink.left','.drag-item','ul.new_click li.new_item']
        .map(function(s){ return deepAll(s).filter(vis).length; }).join(',');
      var vals=deepAll('input[data-accept], .fill-me input, input[data-fillme-placeholder]').filter(vis).map(function(i){ return String((i.value||'').length); }).join('.');
      return parts.join('|')+'#'+counts+'#'+vals;
    }
    // Bấm nút xác nhận trong hộp thoại (nộp bài / kiểm tra / cảnh báo) nếu có
    async function __confirmModal(){
      var pool=__deepAll('.modal button, .modal a, .modal-footer button, .swal2-confirm, .swal2-actions button, [role=dialog] button, [role=alertdialog] button, .dialog button, .popup button, .ant-modal button, .confirm button, .modal-dialog button').filter(isVisible);
      if(!pool.length) return false;
      var noRe=/(hủy|huỷ|cancel|đóng|close|quay lại|thoát|không|chưa|no\b)/i;
      var yesRe=/(đồng\s*ý|xác\s*nhận|chấp\s*nhận|tiếp\s*tục|nộp\s*bài|hoàn\s*thành|ok(ay)?\b|có\b|yes\b|confirm|agree|accept|submit)/i;
      var cands=pool.filter(function(b){ var t=clean(b.textContent)||clean(b.value); return yesRe.test(t) && !noRe.test(t); });
      if(!cands.length) cands=pool.filter(function(b){ return !noRe.test(clean(b.textContent)||clean(b.value)); });
      if(!cands.length) return false;
      __clickRobust(cands[cands.length-1]);
      await __sleep(180);
      return true;
    }
    // Tìm nút nộp bài / hoàn thành
    function __submitCandidates(){
      var list=[];
      ['btn-submit','btn-finish','btn-complete'].forEach(function(id){ var b=findBtn(id); if(b) list.push(b); });
      __deepAll('button, a, [role=button], input[type=submit]').filter(isVisible).forEach(function(el){
        var t=clean(el.textContent)||clean(el.value);
        if(t && t.length<40 && /nộp\s*bài|hoàn\s*thành|kết\s*thúc|submit|finish/i.test(t) && !/xem\s*lại|làm\s*lại|quay\s*lại/i.test(t)) list.push(el);
      });
      return list;
    }
    async function __submitIfPossible(){
      var list=__submitCandidates();
      var doneBtn=findBtn('btn-done');
      if(!list.length && doneBtn) list.push(doneBtn);
      if(!list.length) return false;
      var btn=list[0];
      try{ btn.style.outline='2px solid #2563eb'; }catch(e){}
      __clickRobust(btn);
      await __sleep(250);
      await __confirmModal();
      appendStatus('  → Đã bấm nộp bài / hoàn thành.');
      return true;
    }
    // "Kiểm tra" trước khi "Tiếp" (như 01.js/02.js)
    async function __clickDoneThenNext(){
      var doneBtn=findBtn('btn-done');
      if(!doneBtn) return;
      try{ doneBtn.style.outline='2px solid #2563eb'; }catch(e){}
      __clickRobust(doneBtn);
      await __sleep(250);
      await __confirmModal();
    }
    // In bảng đáp án ra console + copy clipboard (port từ 01.js/02.js mục 9)
    function __printAnswers(items){
      try{
        var rows=(items||[]).map(function(it,i){
          var ans='';
          if(it.tf && it.tf.length) ans='(Đúng/Sai) '+it.tf.map(function(b,k){ return ('abcd'[k]||String(k+1))+')'+(b?'Đ':'S'); }).join(' ');
          else if(it.links && it.links.length) ans='(nối) '+it.links.map(function(l){ return l.label; }).join(' | ');
          else if(it.groups && it.groups.length) ans='(nhóm) '+it.groups.map(function(g){ return g.title+': '+(g.items||[]).join(', '); }).join(' ; ');
          else if(it.dragmores && it.dragmores.length) ans='(kéo thả) '+it.dragmores.map(function(d){ return d.correct; }).join(' | ');
          else if(it.drags && it.drags.length) ans='(kéo thả/điền chữ) '+it.drags.map(function(d){ return d.correct; }).join(' | ');
          else if(it.selects && it.selects.length) ans='(chọn) '+it.selects.map(function(d){ return d.correct; }).join(' | ');
          // [BỔ SUNG v7.5] đáp án kéo chữ lấy từ json_content (drag-more-item)
          else if(it.dragApi && it.dragApi.length) ans='(kéo chữ) '+it.dragApi.join(' | ');
          // [BỔ SUNG] tránh lặp nhãn: nếu chữ đáp án đã có sẵn "B." thì không thêm "B. " lần nữa
          // (API OLM thường trả về option kèm tiền tố chữ cái).
          else if(it.correctIdxs && it.correctIdxs.length){
            var letters=it.correctIdxs.map(function(x){ return ('ABCD'[x]||String(x+1)); }).join(', ');
            var opt0=clean(it.options[it.correctIdxs[0]]||'');
            ans=letters+'. '+(/^[A-Za-z]\s*[.)]\s*/.test(opt0) ? opt0.replace(/^[A-Za-z]\s*[.)]\s*/,'') : opt0);
          }
          else if(it.correctIdx>=0){
            var letter=('ABCD'[it.correctIdx]||String(it.correctIdx+1));
            var opt1=clean(it.options[it.correctIdx]||'');
            ans=letter+'. '+(/^[A-Za-z]\s*[.)]\s*/.test(opt1) ? opt1.replace(/^[A-Za-z]\s*[.)]\s*/,'') : opt1);
          }
          else ans='(điền) '+((it.fills&&it.fills.length>1)?it.fills.join(' | '):(it.fill!=null?it.fill:''));
          return { 'Câu': String(i+1), 'Đáp án': ans, 'Nội dung': clean(it.stem||'').slice(0,60) };
        });
        try{ if(window.console && console.table) console.table(rows); }catch(e){}
        var text=rows.map(function(r){ return 'Câu '+r['Câu']+': '+r['Đáp án']; }).join('\n');
        try{ if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text); }catch(e){}
        appendStatus('📋 ĐÁP ÁN ('+rows.length+' câu) — đã copy vào clipboard.');
        return rows;
      }catch(e){ return []; }
    }

    function hasAnyQ(){
      return !!(deepAll('.qselect').length || deepAll('input[data-accept], .fill-me input').length || deepAll('tr.tf-row').length
        || deepAll('.dragtext[ind]').length || __selEls().length
        || deepAll('.boxlink.left').length || deepAll('.drag-item').length
        || deepAll('.dragmore[ind]').length || deepAll('ul.new_click li.new_item').length);
    }

    // matchInputItem from 01
    function inputOptsOf(it,kind){
      if(kind==='group') return (it.groups||[]).map(function(g){return g.title;});
      if(kind==='dragmore') return (it.dragmores||[]).reduce(function(a,x){return a.concat(x.opts);},[]);
      var arr = kind==='drag' ? it.drags : it.selects;
      return arr && arr.length ? arr.reduce(function(a,x){return a.concat(x.opts);},[]) : [];
    }
    function matchInputItem(kind, domOptTexts, stem){
      var best={s:0,j:-1};
      apiItems.forEach(function(it,j){
        var apiOpts=inputOptsOf(it,kind);
        if(!apiOpts.length) return;
        // optSetScoreSim
        var hit=0;
        for(var d of domOptTexts){ var b=0; for(var a of apiOpts) b=Math.max(b,numSim(d,a)); hit+=b; }
        var sOpt=hit/Math.max(domOptTexts.length,apiOpts.length);
        var sStem=stem? dice(stem, norm(it.stem)) : 0;
        var s=stem? 0.7*sOpt+0.3*sStem : sOpt;
        if(s>best.s) best={s:s,j:j};
      });
      return best;
    }

    function answerRegistered(res){
      if(!res || !res.ok) return false;
      if(res.kind==='fill'){
        var ins=res.inputs || (res.input?[res.input]:[]);
        var wants=res.wants || (res.want!=null?[res.want]:[]);
        if(!ins.length) return false;
        try{ return ins.every(function(inp,i){ return String(inp.value)===String(wants[i]); }); }catch(e){ return true; }
      }
      if(res.kind==='tf'){
        var els=res.els||[];
        if(!els.length) return false;
        var okAll=els.every(function(el){
          var cls=(el.className||'')+' '+(el.getAttribute('class')||'');
          return /selected|correct|xcorrect|active|checked/i.test(cls);
        });
        return okAll?true:null;
      }
      if(res.kind==='select'){
        return (res.els||[]).every(function(x){ return x && x.sel && String(x.sel.value)===String(x.val); });
      }
      if(res.kind==='drag'){
        var bs=(res.els||[]).map(function(x){return x&&x.blank;}).filter(Boolean);
        if(!bs.length) return false;
        return bs.every(function(b){ return !!(b.querySelector && b.querySelector('.drag-select')); });
      }
      if(res.kind==='dragmore'){
        var bs=(res.els||[]).map(function(x){return x&&x.blank;}).filter(Boolean);
        if(!bs.length) return (res.els||[]).length?true:false;
        return bs.every(function(b){ return !!(b.querySelector && b.querySelector('.drag-select')); });
      }
      if(res.kind==='link'){
        if(!(res.els||[]).length) return true;
        return deepAll('.lines line').length >= res.els.length ? true : null;
      }
      if(res.kind==='group'){
        if(!(res.els||[]).length) return true;
        var items=deepAll('.drag-item');
        return items.length ? items.every(function(li){ return !!(li.closest && li.closest('ul.ui-droppable')); }) : true;
      }
      if(res.kind==='advance'){
        if(!(res.els||[]).length) return true;
        var ins=deepAll('.new_input');
        if(!ins.length) return null;
        return ins.some(function(i){ return clean(i.textContent).length>0; }) ? true : null;
      }
      // [BỔ SUNG] câu nhiều đáp án: chỉ cần mọi ô đã bấm đều được đánh dấu
      if(res.kind==='mcq' && res.els && res.els.length){
        var okAll2=res.els.every(function(x){
          // [SỬA LỖI] câu dạng radio/checkbox: trạng thái nằm ở .checked, không nằm ở class
          try{ if(x.checked===true) return true; }catch(e){}
          try{ var ii=x.querySelector&&x.querySelector('input[type=radio], input[type=checkbox]'); if(ii&&ii.checked) return true; }catch(e){}
          var c=String(x.className||'')+' '+(x.getAttribute('class')||'')+' '+(x.getAttribute('aria-checked')||'')+(x.getAttribute('aria-selected')||'')+(x.getAttribute('aria-pressed')||'');
          return /selected|active|checked|chosen|correct|picked/i.test(c);
        });
        if(okAll2) return true;
      }
      var el=res.el;
      if(!el) return false;
      var cls=(el.className||'')+' '+(el.getAttribute('class')||'');
      if(/select|active|checked|chosen|correct|picked/i.test(cls)) return true;
      if(el.getAttribute('aria-checked')==='true' || el.getAttribute('aria-selected')==='true') return true;
      return null;
    }

    /* ===== [BỔ SUNG] KIỂU "KÉO TỪNG CHỮ VÀO CỘT" (Put the words into the correct columns) =====
       Ví dụ: cột go / do / play / collect — mỗi cột cần đúng những chữ (skating, board games...).
       01.js chỉ bắt `ul.item-in[data-group]` + `.drag-item` -> BỎ SÓT dạng này.
       Nay: tìm cột theo TIÊU ĐỀ (lấy từ API) + tìm chữ theo NỘI DUNG, rồi thử nhiều cách đặt:
       bấm chữ -> bấm cột, bấm cột -> bấm chữ, HTML5 drag&drop, kéo chuột. */
    function __isDragWidget(el){
      try{
        if(el.closest && el.closest('.drag-item, .drag-select, .dragtext, .dragmore, [data-group], .ui-droppable, .items-drag-box, .group-list, .column-list, .col-list, .new_click, .link-list, .boxlink')) return true;
      }catch(e){}
      return false;
    }
    function __zoneTitle(z){
      try{
        var g=z.getAttribute('data-group')||z.getAttribute('data-title')||z.getAttribute('data-name');
        if(g && clean(g)) return clean(g);
        var h=z.querySelector('.group-title, .col-title, .column-title, .title, .head, .header, thead, h1, h2, h3, h4, h5, h6');
        if(h) return clean(h.textContent||'');
        var p=z.parentElement;
        if(p){
          var zt=clean(z.textContent||'');
          var t=clean(p.textContent||'');
          if(zt && t.indexOf(zt)===0) t=t.slice(zt.length);
          t=clean(t);
          if(t && t.length<=40) return t;
        }
        return '';
      }catch(e){ return ''; }
    }
    // Tất cả "vùng đích" (cột): ưu tiên [data-group], sau đó các lớp drop
    function __columnZones(){
      var out=[], seen=new Set();
      __deepAll('[data-group], .ui-droppable, .dropzone, .droppable, .drop-target, .col-drop, .column-drop, ul[class*="col"], .bucket').forEach(function(z){
        if(seen.has(z)) return; seen.add(z);
        try{
          if(z.closest && z.closest('#tht-panel')) return;
          if(!__visible(z)) return;
          var t=__zoneTitle(z);
          if(!t || t.length>40) return;
          out.push({el:z, title:t});
        }catch(e){}
      });
      return out;
    }
    function __chipText(el){
      try{
        if(el.tagName==='INPUT' || el.tagName==='TEXTAREA'){
          if(el.value) return clean(el.value);
          var p=el.parentElement;
          if(p) return clean(p.textContent||'');
          return '';
        }
        return clean(el.textContent||'');
      }catch(e){ return ''; }
    }
    // Tìm "thẻ chữ" theo nội dung, chưa nằm trong cột nào
    function __findChip(txt, zones){
      var best=null, bestScore=0;
      __deepAll('.drag-item, .drag-select, [draggable="true"], .chip, .word, .item-word, .selecttext, .new_item, [data-value], input').forEach(function(el){
        try{
          if(el.closest && el.closest('#tht-panel')) return;
          if(!__visible(el)) return;
          for(var i=0;i<zones.length;i++){ if(zones[i].el.contains && zones[i].el.contains(el)) return; }
          var t=__chipText(el);
          if(!t) return;
          var s=numSim(t, txt);
          if(s>bestScore){ bestScore=s; best=el; }
        }catch(e){}
      });
      return (bestScore>=0.9)? best : null;
    }
    function __dragTo(src, dst){
      try{
        if(typeof DragEvent==='undefined' || typeof DataTransfer==='undefined') return false;
        var dt=new DataTransfer();
        var a=src.getBoundingClientRect(), b=dst.getBoundingClientRect();
        var ax=a.left+a.width/2, ay=a.top+a.height/2, bx=b.left+b.width/2, by=b.top+b.height/2;
        var mk=function(t,x,y){ try{ return new DragEvent(t,{bubbles:true,cancelable:true,composed:true,dataTransfer:dt,clientX:x,clientY:y}); }catch(e){ return null; } };
        src.dispatchEvent(mk('dragstart',ax,ay));
        dst.dispatchEvent(mk('dragenter',bx,by));
        dst.dispatchEvent(mk('dragover',bx,by));
        dst.dispatchEvent(mk('drop',bx,by));
        src.dispatchEvent(mk('dragend',bx,by));
        return true;
      }catch(e){ return false; }
    }
    function __mouseDrag(src, dst){
      try{
        var a=src.getBoundingClientRect(), b=dst.getBoundingClientRect();
        var ax=a.left+a.width/2, ay=a.top+a.height/2, bx=b.left+b.width/2, by=b.top+b.height/2;
        var o={bubbles:true,cancelable:true,composed:true,view:window,clientX:ax,clientY:ay,buttons:1};
        src.dispatchEvent(new MouseEvent('mousedown',o));
        src.dispatchEvent(new MouseEvent('mousemove',o));
        var o2={bubbles:true,cancelable:true,composed:true,view:window,clientX:bx,clientY:by,buttons:1};
        dst.dispatchEvent(new MouseEvent('mousemove',o2));
        dst.dispatchEvent(new MouseEvent('mouseup',o2));
        src.dispatchEvent(new MouseEvent('mouseup',o2));
        return true;
      }catch(e){ return false; }
    }
    function __placeChip(chip, zone){
      function inside(){
        try{
          if(zone.contains && zone.contains(chip)) return true;
          var t=__chipText(chip);
          if(t && clean(zone.textContent||'').indexOf(t)>=0) return true;
        }catch(e){}
        return false;
      }
      // (1) bấm CỘT rồi bấm CHỮ (đúng như 01.js làm cho dạng "phân nhóm")
      try{ __clickRobust(zone); __clickRobust(chip); }catch(e){}
      if(inside()) return true;
      try{ __clickRobust(chip); __clickRobust(zone); }catch(e){}   // (2) bấm chữ -> bấm cột
      if(inside()) return true;
      try{ __dragTo(chip, zone); }catch(e){}                        // (3) HTML5 drag & drop
      if(inside()) return true;
      try{ __mouseDrag(chip, zone); }catch(e){}                     // (4) kéo chuột thật
      if(inside()) return true;
      return false;
    }
    // Trả lời kiểu "kéo từng chữ vào cột". Trả về số chữ đã đặt.
    async function __answerColumns(){
      var zones=__columnZones();
      if(!zones.length) return 0;
      // tìm câu trong API có groups khớp tiêu đề các cột
      var best=null, bestScore=0;
      for(var j=0;j<apiItems.length;j++){
        var it=apiItems[j];
        if(!it.groups || !it.groups.length || it.groups.length>12) continue;
        var sc=0;
        it.groups.forEach(function(g){
          var nt=norm(g.title||''); if(!nt) return;
          zones.forEach(function(z){
            var nz=norm(z.title);
            if(nz===nt || (nt.length>=2 && nz.indexOf(nt)>=0)) sc++;
          });
        });
        if(sc>bestScore){ bestScore=sc; best=it; }
      }
      if(!best || bestScore<=0) return 0;
      var placed=0, missed=[];
      for(var gi=0; gi<best.groups.length; gi++){
        var g=best.groups[gi];
        var nt=norm(g.title||''); if(!nt) continue;
        var zone=null;
        zones.forEach(function(z){
          if(zone) return;
          var nz=norm(z.title);
          if(nz===nt || (nt.length>=2 && nz.indexOf(nt)>=0)) zone=z;
        });
        if(!zone){ missed.push(g.title); continue; }
        var gitems=g.items||[];
        for(var ii=0; ii<gitems.length; ii++){
          var chip=__findChip(gitems[ii], zones);
          if(!chip){ missed.push(gitems[ii]); continue; }
          if(__placeChip(chip, zone.el)) placed++;
          else missed.push(gitems[ii]);
          await __sleep(120);
        }
        // [BỔ SUNG] component OLM đọc nhóm HIỆN TẠI lúc chạy (fadeOut ~300ms)
        // -> phải chờ mỗi cột xong trước khi chuyển sang cột sau (như 01.js).
        await __sleep(340);
      }
      if(placed) appendStatus('  → Kéo vào cột: '+placed+' chữ'+(missed.length?(' (thiếu: '+missed.slice(0,4).join(', ')+')'):''));
      return placed;
    }
    async function answerCurrentOnce(onlySpecial){
      // [BỔ SUNG] kiểu "kéo từng chữ vào cột" (Put the words into the correct columns)
      // -> thử TRƯỚC, vì nếu không thì tool sẽ nhầm các cột là phương án MCQ và bấm bừa.
      try{
        var ncol=await __answerColumns();
        if(ncol) return {ok:true, kind:'columns', els:[], want:'columns', count:ncol};
      }catch(e){}
      var roots2=collectRoots();
      var all=function(sel){ var o=[]; for(var r of roots2){ try{ o.push.apply(o,[].slice.call(r.querySelectorAll(sel))); }catch(e){} } return o; };
      // select (dropdown) — lấy theo 01.js nhưng MỞ RỘNG tập dropdown + khớp theo NỘI DUNG
      // option thay vì theo thứ tự (bảng thống kê có nhiều dropdown, thứ tự DOM/API có thể lệch).
      var selEls=__selEls().filter(isVisible).filter(function(s){ return !__answeredEls.has(s); });
      if(selEls.length){
        var byInd=function(a,b){ var ia=parseInt(a.getAttribute('ind'),10), ib=parseInt(b.getAttribute('ind'),10); if(!isNaN(ia)&&!isNaN(ib)&&ia!==ib) return ia-ib; try{ return a.getBoundingClientRect().top - b.getBoundingClientRect().top; }catch(e){ return 0; } };
        var sels=selEls.slice().sort(byInd);
        var domOptTexts=[];
        for(var s of sels) for(var o of [...s.options]){ var t=clean(o.textContent); if(t) domOptTexts.push(t); }
        var stem=stemNear(sels[0],'select, .selecttext, .exp, pre');
        var p=matchInputItem('select',domOptTexts,stem);
        if(p.j>=0){
          var it=apiItems[p.j];
          var done=[], usedSel=[];
          for(var k=0;k<sels.length;k++){
            var sel=sels[k];
            var selTexts=[].slice.call(sel.options).map(function(o){ return clean(o.textContent); }).filter(Boolean);
            // tìm ô API khớp nhất theo TẬP OPTION của dropdown này (không theo thứ tự)
            var bi=-1, bs=0;
            (it.selects||[]).forEach(function(si,sj){
              if(usedSel.indexOf(sj)>=0) return;
              var sc=__optSetScoreSim(selTexts, si.opts||[]);
              if(sc>bs){ bs=sc; bi=sj; }
            });
            if(bi<0) bi=k;                                   // fallback: theo thứ tự
            var want=(it.selects[bi] && it.selects[bi].correct);
            if(want==null) continue;
            usedSel.push(bi);
            var opt=[...sel.options].find(function(o){ return norm(o.textContent)===norm(want); }) || [...sel.options].find(function(o){ return numSim(o.textContent,want)>=0.9; });
            if(!opt) continue;
            sel.style.outline='3px solid #16a34a';
            try{ sel.value=opt.value; }catch(e){ sel.value=opt.value; }
            try{ sel.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){}
            done.push({sel:sel,want:want,val:opt.value});
          }
          if(done.length) return {ok:true,kind:'select',els:done,want:it.selects.map(function(x){return x.correct;})};
        }
      }
      // drag
      var dragBlanks=all('.dragtext[ind]').filter(isVisible).filter(function(b){ return !b.querySelector('.drag-select') && !__answeredEls.has(b); });
      if(dragBlanks.length){
        var byInd2=function(a,b){ return (parseInt(a.getAttribute('ind'),10)||0)-(parseInt(b.getAttribute('ind'),10)||0); };
        dragBlanks=dragBlanks.slice().sort(byInd2);
        var b0=dragBlanks[0];
        var droot=(b0.getRootNode && b0.getRootNode()) || document;
        var blanksNow=function(){ return [...droot.querySelectorAll('.dragtext[ind]')].sort(byInd2); };
        var pool=function(){ return [...droot.querySelectorAll('.drag-select')].filter(function(o){ return isVisible(o) && !(o.closest && o.closest('.dragtext')); }); };
        var stem=stemNear(b0,'.dragtext, .item-drag, .exp, pre');
        var p=matchInputItem('drag', pool().map(function(o){return katexText(o);}), stem);
        if(p.j>=0){
          var it=apiItems[p.j];
          var done=[];
          for(var k=0;k<dragBlanks.length;k++){
            // [BỔ SUNG] lấy đúng ind của ô (không giả định ind === k) để khớp mảng đáp án API
            var ind=String(dragBlanks[k] && dragBlanks[k].getAttribute('ind'));
            var blank=blanksNow().find(function(b){ return String(b.getAttribute('ind'))===ind; });
            if(!blank) continue;
            var idx=parseInt(ind,10); if(isNaN(idx)) idx=k;
            var want=it.drags[idx] && it.drags[idx].correct;
            if(want==null) continue;
            if(blank.querySelector('.drag-select')){ done.push({blank:blank,want:want,filled:true}); continue; }
            realClick(blank);
            var opt=pool().find(function(o){ return norm(katexText(o))===norm(want); }) || pool().find(function(o){ return numSim(katexText(o),want)>=0.9; });
            if(!opt) continue;
            opt.style.outline='3px solid #16a34a';
            realClick(opt);
            __answeredEls.add(blank);
            done.push({blank:blank,want:want});
          }
          if(done.length) return {ok:true,kind:'drag',els:done,want:it.drags.map(function(x){return x.correct;})};
        }
      }
      // link
      var linkLefts=all('.boxlink.left').filter(isVisible).filter(function(l){ return !__answeredEls.has(l); });
      if(linkLefts.length){
        var lroot=(linkLefts[0].getRootNode && linkLefts[0].getRootNode()) || document;
        var linesNow=function(){ return [...lroot.querySelectorAll('.lines line')].length; };
        // [BỔ SUNG] so với TỔNG số mối bên trái (không phải số còn lại), tránh dừng sớm khi
        // một vài mối đã nối thành công ở lần chạy trước.
        var totalLefts='.boxlink.left';
        var allLefts=(function(){ try{ return [...lroot.querySelectorAll(totalLefts)]; }catch(e){ return []; } })();
        if(linesNow()>=allLefts.length && allLefts.length) return {ok:true,kind:'link',els:[],already:true};
        var rights=[...lroot.querySelectorAll('.boxlink.right')];
        var done=[];
        for(var left of linkLefts){
          var lid=left.getAttribute('id');
          if(lid==null) continue;
          var right=rights.find(function(r){ return r.getAttribute('id')===lid; });
          if(!right) continue;
          left.style.outline='3px solid #16a34a';
          realClick(left);
          realClick(right);
          __answeredEls.add(left);
          done.push({left:left,right:right,lid:lid});
        }
        if(done.length) return {ok:true,kind:'link',els:done,want:done.map(function(d){return d.lid;})};
      }
      // group
      var groupZones=all('ul.item-in[data-group]').filter(isVisible);
      var dragItemsAll=all('.drag-item').filter(isVisible);
      if(groupZones.length && dragItemsAll.length){
        var inPool=function(li){ return !(li.closest && li.closest('ul.ui-droppable')); };
        // [BỔ SUNG] chỉ coi là "xong" khi KHÔNG còn item nào chưa đặt (bỏ qua item đã đánh dấu).
        // Bản cũ chỉ kiểm tra inPool nên trên trang dùng <ul> thường (không phải ul.ui-droppable)
        // vẫn tưởng là còn item trong kho và đặt lại nhiều lần.
        if(!dragItemsAll.some(function(li){ return inPool(li) && !__answeredEls.has(li); })) return {ok:true,kind:'group',els:[],already:true};
        var domTitles=groupZones.map(function(z){ return String(z.getAttribute('data-group')||''); });
        var stem=stemNear(groupZones[0],'ul.item-in, .group-list, .exp, pre');
        var p=matchInputItem('group',domTitles,stem);
        if(p.j>=0){
          var it=apiItems[p.j];
          var groot=(groupZones[0].getRootNode && groupZones[0].getRootNode()) || document;
          var zonesNow=function(){ return [...groot.querySelectorAll('ul.item-in[data-group]')]; };
          var itemsNow=function(){ return [...groot.querySelectorAll('.drag-item')]; };
          var placed=new Set();
          var done=[];
          for(var grp of (it.groups||[])){
            var z=zonesNow().find(function(zz){ return norm(zz.getAttribute('data-group'))===norm(grp.title); }) || zonesNow().find(function(zz){ return norm(zz.getAttribute('data-group')).indexOf(norm(grp.title))>=0; });
            if(!z) continue;
            realClick(z);
            for(var txt of grp.items){
              var cand=itemsNow().filter(function(li){ return !placed.has(li) && !__answeredEls.has(li) && inPool(li); });
              var li=cand.find(function(x){ return norm(katexText(x))===norm(txt); }) || cand.find(function(x){ return numSim(katexText(x),txt)>=0.9; });
              if(!li) continue;
              realClick(li);
              placed.add(li);
              __answeredEls.add(li);
              done.push({li:li,group:grp.title,txt:txt});
            }
            if(done.length) await new Promise(function(r){setTimeout(r,340);});
          }
          if(done.length) return {ok:true,kind:'group',els:done,want:it.groups};
        }
      }
      // dragmore
      var dmBlanks=all('.dragmore[ind]').filter(isVisible).filter(function(b){ return !b.querySelector('.drag-select') && !__answeredEls.has(b); });
      if(dmBlanks.length){
        var byInd3=function(a,b){ return (parseInt(a.getAttribute('ind'),10)||0)-(parseInt(b.getAttribute('ind'),10)||0); };
        dmBlanks=dmBlanks.slice().sort(byInd3);
        var db0=dmBlanks[0];
        var droot2=(db0.getRootNode && db0.getRootNode()) || document;
        var blanksNow2=function(){ return [...droot2.querySelectorAll('.dragmore[ind]')].sort(byInd3); };
        var pool2=function(){ return [...droot2.querySelectorAll('.items-drag-box .drag-select')].filter(function(o){ return isVisible(o) && !(o.closest && o.closest('.dragmore')); }); };
        var stem=stemNear(db0,'.dragmore, .items-drag-box, #dragmore, .exp, pre');
        var p=matchInputItem('dragmore', pool2().map(function(o){return katexText(o);}), stem);
        if(p.j>=0){
          var it=apiItems[p.j];
          var done=[];
          for(var k=0;k<dmBlanks.length;k++){
            var ind=String((dmBlanks[k] && dmBlanks[k].getAttribute('ind')) || k);
            var blank=blanksNow2().find(function(b){ return String(b.getAttribute('ind'))===ind; });
            if(!blank) continue;
            var idx=parseInt(ind,10); if(isNaN(idx)) idx=k;
            var want=it.dragmores[idx] && it.dragmores[idx].correct;
            // [BỔ SUNG v7.5] HTML không kèm đáp án -> dùng drag-more-item (correct:true) từ API
            if(want==null && it.dragApi && it.dragApi[idx]!=null) want=it.dragApi[idx];
            if(want==null) continue;
            if(blank.querySelector('.drag-select')){ done.push({blank:blank,want:want,filled:true}); continue; }
            var sp=droot2.querySelector('.dragmore.selectpoint');
            if(sp && sp!==blank){ try{sp.classList.remove('selectpoint');}catch(e){} try{blank.classList.add('selectpoint');}catch(e){} }
            var opt=pool2().find(function(o){ return norm(katexText(o))===norm(want); }) || pool2().find(function(o){ return numSim(katexText(o),want)>=0.9; });
            if(!opt) continue;
            opt.style.outline='3px solid #16a34a';
            realClick(opt);
            done.push({blank:blank,want:want});
          }
          if(done.length) return {ok:true,kind:'dragmore',els:done,want:it.dragmores.map(function(x){return x.correct;})};
        }
      }
      // advance
      var advItems=all('ul.new_click li.new_item').filter(isVisible);
      if(advItems.length){
        var aroot=(advItems[0].getRootNode && advItems[0].getRootNode()) || document;
        var ins=[...aroot.querySelectorAll('.new_input')];
        if(ins.length && ins.every(function(i){ return clean(i.textContent).length; })) return {ok:true,kind:'advance',els:[],already:true};
        var stem=stemNear(advItems[0],'ul.new_click, .new_input, .advance, .exp, pre');
        var p=matchInputItem('drag', advItems.map(function(li){return katexText(li);}), stem);
        if(p.j>=0){
          var it=apiItems[p.j];
          var want=it.drags[0] && it.drags[0].correct;
          if(want!=null){
            var li=advItems.find(function(x){ return String(x.getAttribute('data-value'))===String(want); }) || advItems.find(function(x){ return norm(katexText(x))===norm(want); }) || advItems.find(function(x){ return numSim(katexText(x),want)>=0.9; });
            if(li){
              if(__answeredEls.has(li)) return {ok:true,kind:'advance',els:[],already:true};
              li.style.outline='3px solid #16a34a';
              realClick(li);
              return {ok:true,kind:'advance',els:[li],want:want};
            }
          }
        }
      }
      // [BỔ SUNG] custom dropdown/combobox (bấm mũi tên mở danh sách rồi chọn) - trang chu-de/courseware
      try{
        var ddTriggers=all('[aria-haspopup="listbox"], [aria-haspopup="true"], [role="combobox"], .dropdown-toggle, .select-trigger, [class*="dropdown"][class*="toggle"], [class*="select"][class*="arrow"], [class*="caret"]')
          .filter(isVisible).filter(function(el){ return !__answeredEls.has(el) && !(el.tagName==='SELECT'); });
        // thêm các nút mũi tên nhỏ cạnh ô chọn
        if(!ddTriggers.length){
          ddTriggers=all('button, [role=button], span, div').filter(isVisible).filter(function(el){
            if(__answeredEls.has(el)) return false;
            try{ if(el.closest && el.closest('#tht-panel')) return false; }catch(e){}
            var cls=(el.className||'').toLowerCase();
            var txt=clean(el.textContent||'');
            var hasArrow=/arrow|caret|chevron|dropdown|select|toggle/i.test(cls) || /▾|▼|▿|˅/.test(txt);
            return hasArrow && !!(el.closest && el.closest('.question-content, .itemx, .quiz-itm, .quiz-list, .q-item, .card-body'));
          });
        }
        if(ddTriggers.length){
          var trig=ddTriggers[0];
          var cont=null; try{ cont=trig.closest('.question-content, .itemx, .quiz-itm, .quiz-list, .q-item, .card-body')||trig.parentElement; }catch(e){}
          var stem=stemNear(trig, 'input, .qselect, .quiz-list, .exp, pre, [role=listbox]');
          // mở dropdown
          __clickRobust(trig);
          await __sleep(120);
          var optEls=all('[role="option"], [role="listbox"] li, [role="listbox"] div, .dropdown-menu li, .dropdown-menu [role=option], .dropdown-menu div, .select-options li, .select-options div, .options li, .options div, ul[aria-expanded] li')
            .filter(isVisible).filter(function(o){ return clean(o.textContent).length>0 && clean(o.textContent).length<300; });
          // nếu chưa thấy, thử click lần nữa
          if(!optEls.length){ __clickRobust(trig); await __sleep(120); optEls=all('[role="option"], [role="listbox"] li, .dropdown-menu li, .select-options li, .options li').filter(isVisible); }
          if(optEls.length){
            var texts=optEls.map(function(o){ return clean(katexText(o)); });
            // thử khớp với đáp án select/drag hoặc mcq text
            var best={s:0,j:-1,want:null};
            apiItems.forEach(function(it,j){
              var cands=[];
              if(it.selects && it.selects.length) it.selects.forEach(function(x){ cands=cands.concat(x.opts||[x.correct]); });
              if(it.drags && it.drags.length) it.drags.forEach(function(x){ cands=cands.concat(x.opts||[x.correct]); });
              if(it.options && it.options.length && it.correctIdx>=0) cands.push(it.options[it.correctIdx]);
              if(it.fill!=null) cands.push(String(it.fill));
              cands=cands.filter(Boolean);
              if(!cands.length) return;
              var sOpt=0; texts.forEach(function(t){ var b=0; cands.forEach(function(a){ b=Math.max(b,numSim(t,a)); }); sOpt+=b; }); sOpt/=Math.max(texts.length,cands.length);
              var sStem=stem?dice(stem,norm(it.stem)):0;
              var sc=stem?(0.7*sOpt+0.3*sStem):sOpt;
              if(sc>best.s) best={s:sc,j:j,want:cands};
            });
            if(best.j>=0 && best.want){
              var pick=null, pd=0;
              optEls.forEach(function(o){
                var t=clean(katexText(o));
                best.want.forEach(function(a){ var d=numSim(t,a); if(d>pd){ pd=d; pick=o; } });
              });
              if(pick && pd>=0.5){
                pick.style.outline='3px solid #16a34a';
                __clickRobust(pick);
                __answeredEls.add(trig);
                return {ok:true,kind:'dropdown',el:pick,want:clean(pick.textContent),score:best.s};
              }
            }
          }
        }
      }catch(e){}
      // [BỔ SUNG] chế độ "chỉ dạng đặc biệt": __olmFullAuto tự lo TF / trắc nghiệm / điền
      // theo từng khối để không điền nhầm trước.
      if(onlySpecial) return {ok:false};
      // tf
      var tfRowsAll=all('tr.tf-row, .tf-row').filter(isVisible);
      if(tfRowsAll.length){
        var rows=tfRowsAll.sort(function(a,b){ try{ return a.getBoundingClientRect().top - b.getBoundingClientRect().top; }catch(e){ return 0; } });
        var tfStem=stemNear(rows[0],'.true-false, #true-false, .tf-row, .exp, pre');
        // [BỔ SUNG] nếu stem rỗng thì dùng chữ mệnh đề .clause (như 01.js)
        if(!tfStem || tfStem.length<4){
          try{ var cl0=rows[0].querySelector('.clause'); if(cl0) tfStem=__norm(cl0.textContent||''); }catch(e){}
        }
        var best={s:-1,j:-1};
        apiItems.forEach(function(it,j){
          if(!it.tf || !it.tf.length) return;
          var s=dice(tfStem, norm(it.stem));
          if(it.tf.length !== rows.length) s -= 0.15;
          if(s>best.s) best={s:s,j:j};
        });
        if(best.j>=0){
          var it=apiItems[best.j];
          var clicks=[];
          for(var k=0;k<rows.length;k++){
            var want=it.tf[k];
            var row=rows[k];
            var spans=[].slice.call(row.querySelectorAll('[data-tf-value]'));
            var trueEl=spans.find(function(s){ return s.getAttribute('data-tf-value')==='1'; });
            var falseEl=spans.find(function(s){ return s.getAttribute('data-tf-value')==='0'; });
            if(trueEl || falseEl){
              var target=want?trueEl:falseEl;
              if(target && !__answeredEls.has(target)){
                target.style.outline='3px solid #16a34a';
                try{ target.scrollIntoView({block:'center'}); }catch(e){}
                realClick(target);
                clicks.push(target);
              }
            } else {
              // [BỔ SUNG] ô lật Đ/S: click 1 lần = Đ, 2 lần = S
              var cells=[].slice.call(row.querySelectorAll('td, .cell, [role=button], button, span, div')).filter(isVisible);
              var toggle=null;
              for(var ci=cells.length-1; ci>=0; ci--){
                var tx=clean(cells[ci].textContent||'');
                var st=__tfCellState(cells[ci]);
                if(st || tx.length<=3 || /^(đ|s|dung|sai|true|false|đúng)$/i.test(tx)){ toggle=cells[ci]; break; }
              }
              if(!toggle && cells.length>=2) toggle=cells[cells.length-1];
              if(toggle && !__answeredEls.has(toggle)){
                toggle.style.outline='3px solid #16a34a';
                await __clickTfToggleTo(toggle, !!want);
                clicks.push(toggle);
              }
            }
          }
          if(clicks.length) return {ok:true,kind:'tf',els:clicks,want:it.tf.slice()};
        }
      }
      // mcq/fill
      var qGroups=groupBy(all('.qselect'), function(el){ return el.closest('.question-content')||el.closest('.itemx')||el.closest('.card-body')||el.parentElement; });
      var __selectedRe=/selected|active|checked|chosen|picked/i;
      var mcqGroups=qGroups.map(function(els){ return els.filter(isVisible); })
        // [BỔ SUNG] bỏ qua câu đã trả lời (đã bấm / đã đánh dấu) để vòng lặp đi tiếp câu khác
        .filter(function(els){
          if(els.length<2) return false;
          return !els.some(function(o){
            try{
              var sig=String(o.className||'')+' '+(o.getAttribute('aria-checked')||'')+(o.getAttribute('aria-selected')||'')+(o.getAttribute('aria-pressed')||'');
              return __answeredEls.has(o) || __selectedRe.test(sig);
            }catch(e){ return false; }
          });
        })
        .sort(function(a,b){ try{ return a[0].getBoundingClientRect().top - b[0].getBoundingClientRect().top; }catch(e){ return 0; } });
      // [SỬA LỖI] fallback: câu hỏi dùng radio/checkbox (hoặc markup khác .qselect).
      // Bản cũ CHỈ tìm .qselect -> các câu dạng radio (Có/Không, A/B/C/D...) không bao giờ
      // được khoanh. Hay gặp ở câu hỏi overlay của bài dạng VIDEO.
      if(!mcqGroups.length){
        var rads=all('input[type=radio], input[type=checkbox]').filter(isVisible).filter(function(i){
          try{ return !(i.closest && i.closest('#tht-panel')); }catch(e){ return true; }
        });
        var byRName=new Map();
        rads.forEach(function(r, ri){
          var n=r.getAttribute('name');
          if(!n) n='__tht_solo_'+ri;
          if(!byRName.has(n)) byRName.set(n,[]);
          byRName.get(n).push(r);
        });
        var radGroups=[];
        byRName.forEach(function(arr){
          if(arr.length<2) return;
          var seen2=new Set(), uniq=[];
          arr.forEach(function(x){
            var lbl=null;
            try{
              lbl=x.closest('label');
              if(!lbl && x.id) lbl=document.querySelector('label[for="'+x.id+'"]');
              if(!lbl) lbl=x.parentElement||x;
            }catch(e){ lbl=x; }
            if(seen2.has(lbl)) return;
            seen2.add(lbl); uniq.push(lbl);
          });
          if(uniq.length>=2 && uniq.length<=8) radGroups.push(uniq);
        });
        mcqGroups=radGroups.sort(function(a,b){ try{ return a[0].getBoundingClientRect().top - b[0].getBoundingClientRect().top; }catch(e){ return 0; } });
      }
      var g=null;
      if(mcqGroups.length){
        var els=mcqGroups[0];
        g={kind:'mcq', domOpts: els.map(function(o){ return {el:o, ind: (o.getAttribute('ind') ?? o.getAttribute('data-ind')), text: katexText(o)}; }), stem: stemNear(els[0],'.qselect, .quiz-list, .exp, pre')};
      } else {
        // [BỔ SUNG] gom ô điền theo TỪNG KHỐI câu hỏi (hỗ trợ câu nhiều ô + nhiều câu/trang),
        // thay vì lấy toàn bộ input trên trang rồi điền lần lượt.
        var FILL_ANY2='input[data-accept], .fill-me input, input[data-fillme-placeholder], input[placeholder="?"], textarea, input[type=text], input[type=number], input:not([type]), [contenteditable="true"]';
        var fills=all(FILL_ANY2).filter(isVisible).filter(function(x){
          if(__answeredEls.has(x)) return false;
          if(x.getAttribute && x.getAttribute('data-accept')!=null) return true;
          try{ return !!(x.closest && (x.closest('.itemx')||x.closest('.question-content')||x.closest('.card-body')||x.closest('.fill-me'))); }catch(e){ return false; }
        });
        var fGroups=groupBy(fills, function(el){ return el.closest('.itemx')||el.closest('.question-content')||el.closest('.card-body')||el.closest('.fill-me')||el.parentElement; })
          .sort(function(a,b){ try{ return a[0].getBoundingClientRect().top - b[0].getBoundingClientRect().top; }catch(e){ return 0; } });
        if(fGroups.length){
          var ins=fGroups[0];
          g={kind:'fill', inputs:ins, input:ins[0], stem: stemNear(ins[0],'input, textarea, .qselect, .quiz-list, .exp, pre, [contenteditable]')};
        }
      }
      if(!g) return {ok:false};
      var best={s:0,j:-1};
      if(g.kind==='mcq'){
        var domTexts=g.domOpts.map(function(o){return o.text;});
        apiItems.forEach(function(it,j){
          if(!it.options || !it.options.length) return;
          var hit=0;
          for(var d of domTexts){ var b=0; for(var a of it.options) b=Math.max(b,numSim(d,a)); hit+=b; }
          var sOpt=hit/Math.max(domTexts.length,it.options.length);
          var sStem=g.stem? dice(g.stem, norm(it.stem)) : 0;
          var score=g.stem? 0.9*sOpt+0.1*sStem : sOpt;
          if(score>best.s) best={s:score,j:j};
        });
      } else {
        var lettersOf=function(s){ return (s||'').toLowerCase().replace(/\\[a-z]+/g,' ').replace(/[0-9@{}()\[\]_^\\/;,.\-+*=:]/g,' ').replace(/[^a-zà-ỹđ\s]/g,' ').replace(/\s+/g,' ').trim(); };
        var domLetters=lettersOf(g.stem||'');
        apiItems.forEach(function(it,j){
          if(!(it.fills && it.fills.length)) return;
          var sRaw=dice(g.stem||'', norm(it.stem));
          var sLet=domLetters? dice(domLetters, lettersOf(it.stem)) : 0;
          var s=Math.max(sRaw,sLet);
          if(s>best.s) best={s:s,j:j};
        });
        if(best.j<0 || (g.stem && best.s<0.25)){
          var only=apiItems.filter(function(it){ return it.fills && it.fills.length; });
          if(only.length===1) best={s:1,j:apiItems.indexOf(only[0])};
          else if(best.j<0){
            var done=new Set(filledFills);
            var next=only.find(function(it){ return !done.has(apiItems.indexOf(it)); });
            if(next) best={s:0.2,j:apiItems.indexOf(next)};
          }
        }
      }
      if(best.j<0) return {ok:false};
      var it=apiItems[best.j];
      if(g.kind==='fill' || (it.correctIdx<0 && !it.options.length)){
        var inputs=g.inputs||[g.input];
        var want=(it.fills && it.fills.length)? it.fills : (it.fill!=null?[it.fill]:[]);
        var done=[], wants=[];
        inputs.forEach(function(inp,k){
          var w=want[k];
          if(inp && w!=null){
            inp.style.outline='3px solid #16a34a';
            var cw=__pickFillAns(String(w));
            setNativeValue(inp,cw);
            done.push(inp); wants.push(cw);
          }
        });
        if(done.length){ filledFills.add(best.j); return {ok:true,kind:'fill',inputs:done,input:done[0],wants:wants,want:wants[0]}; }
        return {ok:false};
      }
      // [BỔ SUNG] câu trắc nghiệm có thể có NHIỀU đáp án đúng (correctIdxs).
      var wantsIdx=(it.correctIdxs && it.correctIdxs.length)? it.correctIdxs.slice() : (it.correctIdx>=0? [it.correctIdx] : []);
      var clicked=[];
      wantsIdx.forEach(function(wantIdx){
        var apiAns=it.options[wantIdx] || '';
        var pos=-1, posD=0;
        g.domOpts.forEach(function(o,i){
          var d=numSim(o.text,apiAns);
          var indBonus=(o.ind!=null && parseInt(o.ind,10)===wantIdx)?0.05:0;
          var d2=d+indBonus;
          if(d2>posD){ posD=d2; pos=i; }
        });
        if(pos<0 || posD<0.5){
          var byInd=g.domOpts.findIndex(function(o){ return o.ind!=null && parseInt(o.ind,10)===wantIdx; });
          if(byInd>=0) pos=byInd;
        }
        if(pos>=0){
          var el=g.domOpts[pos].el;
          if(__answeredEls.has(el)) return;
          el.style.outline='3px solid #16a34a';
          el.style.outlineOffset='2px';
          try{ el.scrollIntoView({block:'center'}); }catch(e){}
          realClick(el);
          clicked.push(el);
        }
      });
      if(clicked.length) return {ok:true,kind:'mcq',el:clicked[0],els:clicked,ind:(it.correctIdx>=0?it.correctIdx:null)};
      return {ok:false};
    }

    /* ===== Auto-loop (01 style) ===== */
    async function __autoLoop01(){
      if(!hasAnyQ() && !__submitCandidates().length) return;
      log('🤖 Bắt đầu auto-loop (chọn đáp án → Kiểm tra → Tiếp)...');
      var MAX_QUESTIONS=60, STEP_WAIT=3500;
      var loopAnswered=0;
      for(var n=0;n<MAX_QUESTIONS;n++){
        // chờ câu hỏi render; nếu trang không còn câu hỏi thì nộp bài
        if(!hasAnyQ()){
          await waitPred(function(){ return hasAnyQ() || __submitCandidates().length>0; }, STEP_WAIT);
        }
        if(!hasAnyQ()){
          // [BỔ SUNG] hết câu hỏi mà còn nút nộp -> bấm nộp + xác nhận hộp thoại
          if(await __submitIfPossible()) loopAnswered++;
          else log('🏁 Không còn câu hỏi — kết thúc.');
          break;
        }
        var res=null;
        for(var tries=0;tries<4;tries++){
          res=await answerCurrentOnce();
          if(!res || !res.ok){ await __sleep(100); continue; }
          await __sleep(120);
          var reg=answerRegistered(res);
          if(reg===true) break;
          if(reg===null && tries>=1) break;
          if(reg===false) await __sleep(100);
        }
        if(res && res.ok){ __markAns(res); loopAnswered++; }

        await __clickDoneThenNext();

        var before=__pageSig();
        var nextBtn=findBtn('btn-next');
        if(!nextBtn){
          // [BỔ SUNG] trang cuối không có "Tiếp" -> nộp bài / hoàn thành
          if(await __submitIfPossible()) loopAnswered++;
          else log('🏁 Không còn nút Tiếp — đã tới câu cuối.');
          break;
        }
        __clickRobust(nextBtn);
        var advanced=await waitPred(function(){ return __pageSig()!==before; }, STEP_WAIT);
        if(!advanced){
          // [BỔ SUNG] có thể bị hộp thoại chặn -> xác nhận rồi bấm Tiếp lại
          if(await __confirmModal()){
            __clickRobust(nextBtn);
            advanced=await waitPred(function(){ return __pageSig()!==before; }, 4000);
          }
        }
        if(!advanced){
          // thử nút "Câu sau / Tiếp theo / Next" khác nếu #btn-next bị disable
          var nav=await __gotoNextPage(before, 5000);
          advanced=(nav===true);
        }
        if(!advanced){ log('⚠️ Không chuyển được câu (nút Tiếp bị disabled?). Dừng auto-loop.'); break; }
        __answeredEls.clear();
      }
      log('🤖 Auto-loop xong. Đã trả lời '+loopAnswered+' lượt câu.');
    }

    /* ===== __olmFullAuto (tab path) ===== */
    async function __olmFullAuto(answers){
      __olmTabIdx=null;
      if(!answers||!answers.length){ appendStatus('(olm) khong co dap an.'); return; }
      // [BỔ SUNG] danh sách ô "nhập văn bản" rộng hơn (OLM dùng nhiều biến thể class/attr)
      var FILL_SEL='input[data-accept], .fill-me input, input.fill-me, .fill-blank input, input.fill-blank, input[data-fillme-placeholder], input[placeholder="?"], textarea, input[type=text], input[type=number], input[type=tel], input:not([type]), [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"], span.blank, div.blank, .dragtext input, .drop-text input';
      var __isTextFill=function(inp){
        if(!inp) return false;
        try{ if(inp.closest && inp.closest('#tht-panel, header, nav, footer')) return false; }catch(e){}
        // [BỔ SUNG] thẻ chữ kéo-thả cũng là <input> -> không được điền text vào
        try{ if(inp.closest && inp.closest('.drag-item, .drag-select, .dragtext, .dragmore, [data-group], .ui-droppable, .items-drag-box, .group-list, .column-list, .col-list, .new_click, .link-list')) return false; }catch(e){}
        if(inp.disabled || inp.readOnly) return false;
        if(inp.getAttribute && inp.getAttribute('aria-hidden')==='true') return false;
        var tag=(inp.tagName||'').toLowerCase();
        if(tag==='textarea') return true;
        if(inp.getAttribute && inp.getAttribute('contenteditable')!=null) return true;
        if(tag==='input'){
          var tp=(inp.getAttribute('type')||'text').toLowerCase();
          if(/^(button|submit|reset|checkbox|radio|hidden|file|image|range|color)$/.test(tp)) return false;
          return true;
        }
        // span/div.blank acting as editable
        try{ if(inp.isContentEditable) return true; }catch(e){}
        return false;
      };
      var fillVal=function(inp){
        try{
          if(inp.getAttribute && inp.getAttribute('contenteditable')!=null) return clean(inp.textContent);
          return String(inp.value==null? '' : inp.value);
        }catch(e){ return ''; }
      };
      // Xoá giá trị do tab TRƯỚC điền nếu DOM bị dùng lại cho câu khác
      var clearStaleFills=function(){
        try{
          __deepAll('input, textarea, [contenteditable], span.blank, div.blank').filter(isVisible).forEach(function(inp){
            if(!__isTextFill(inp)) return;
            var o=__fillOwner.get(inp);
            if(o && o.page!==__tabNo && fillVal(inp)===o.val){ try{ __setValue(inp,''); }catch(e){} }
          });
        }catch(e){}
      };
      var cands=answers.map(function(a,i){ return {
        i:i, used:false,
        kind: a.kind||'mcq',
        correctIdx: (typeof a.correctIdx==='number')?a.correctIdx:-1,
        correctIdxs: (a.correctIdxs&&a.correctIdxs.length)?a.correctIdxs.slice():((typeof a.correctIdx==='number'&&a.correctIdx>=0)?[a.correctIdx]:[]),
        opts: (a.options||[]).slice(),
        correct: (a.options && a.correctIdx>=0)? a.options[a.correctIdx] : '',
        fill: (a.fill==null)? (a.fills&&a.fills.length?a.fills[0]:null) : String(a.fill),
        fills: a.fills||[],
        tf: a.tf||null,
        stem: a.stem||''
      };}).filter(function(c){
        if(c.kind==='fill') return c.fill!=null || (c.fills&&c.fills.length);
        if(c.kind==='tf') return c.tf && c.tf.length;
        return c.correctIdx>=0 || (c.correctIdxs&&c.correctIdxs.length) || !!c.correct;
      });
      appendStatus('🤖 Auto OLM v7: '+answers.length+' dap an ('+cands.length+' kha dung)...');
      /* ===== [SỬA LỖI] helper dùng chung cho trang thường + trang VIDEO =====
         Trước đây logic "gom nhóm phương án -> khoanh" nằm inline trong vòng lặp trang,
         nên chế độ video (vốn chỉ gọi answerCurrentOnce) không dùng được -> bài dạng video
         không bao giờ được khoanh. Nay tách ra dùng chung. */

      // Gom nhóm phương án (DOM) -> đối tượng {opts, domOpts, stem, cont}
      var __buildGroupObjs=function(groups){
        return (groups||[]).map(function(opts){
          var domOpts=opts.map(function(el){
            var ind=el.getAttribute('ind'); if(ind==null) ind=el.getAttribute('data-ind');
            return {el:el, ind: ind==null?null:String(ind), text: __katexText(el)};
          });
          var cont=null;
          try{ cont=opts[0].closest('.quiz-itm, .question-content, tr, li, .card, .itemx, .card-body')||opts[0].parentElement; }catch(e){ cont=opts[0].parentElement; }
          var stem=__groupStem(cont, opts);
          if(!stem || stem.length<8) stem=__stemNear(opts[0], '.qselect, .quiz-list, .exp, pre');
          return {opts:opts, domOpts:domOpts, stem:stem, cont:cont};
        });
      };

      // [SỬA LỖI] khoanh đáp án cho các nhóm phương án.
      // BUG CŨ: apiAns = cand.correct || cand.opts[wantIdx] -> với câu NHIỀU đáp án đúng
      // (correctIdxs có >1 phần tử) mọi wantIdx đều trỏ về cand.correct (đáp án đầu tiên)
      // -> bấm trùng 1 phương án, bấm 2 lần thì bị BỎ CHỌN.
      var __answerGroupObjs=async function(gObjs, cands, answered){
        var picked=0, skipped=0;
        var pairs=[];
        gObjs.forEach(function(g, gi){
          if(g.domOpts.length<2) return;
          var domTexts=g.domOpts.map(function(o){return o.text;});
          cands.forEach(function(c, j){
            if(c.kind!=='mcq') return;
            var sOpt=__optSetScoreSim(domTexts, c.opts);
            var sStem=(g.stem && c.stem)?__dice(g.stem, c.stem):0;
            var s=(g.stem? (0.9*sOpt + 0.1*sStem) : sOpt) - (c.used? 0.12 : 0);
            pairs.push({gi:gi, j:j, s:s});
          });
        });
        pairs.sort(function(a,b){ return b.s-a.s; });
        var matchOf=new Map();
        var usedApi=new Set();
        pairs.forEach(function(p){
          if(p.s<0.3) return;
          if(matchOf.has(p.gi) || usedApi.has(p.j)) return;
          matchOf.set(p.gi, p.j);
          usedApi.add(p.j);
        });
        for(var gi=0; gi<gObjs.length; gi++){
          var g=gObjs[gi];
          var opts=g.opts;
          var already=opts.some(function(o){ return __optIsSelected(o); });
          if(already){
            opts.forEach(function(o){ answered.add(o); });
            appendStatus('  → Câu '+(gi+1)+' đã khoanh, bỏ qua.');
            continue;
          }
          var qnum='';
          try{ var mm=((g.cont&&g.cont.textContent)||'').match(/(?:Question|Câu)\s*(\d+)/i); if(mm) qnum='Q'+mm[1]; }catch(e){}
          var j=matchOf.get(gi);
          var cand=null;
          if(j!=null) cand=cands[j];
          if(!cand){
            // lấy ứng viên tốt nhất kể cả đã dùng (thay vì bỏ trắng câu)
            var bestAny={s:-99,j:-1};
            pairs.forEach(function(p){ if(p.gi===gi && p.s>bestAny.s) bestAny={s:p.s,j:p.j}; });
            if(bestAny.j>=0){ cand=cands[bestAny.j]; usedApi.add(bestAny.j); matchOf.set(gi,bestAny.j); }
          }
          if(!cand){
            // cùng cực: so từng đáp án trên DOM với MỌI đáp án đúng trong bảng
            var guess={d:0,i:-1};
            g.domOpts.forEach(function(o,i){
              cands.forEach(function(c){
                var a=c.correct || (c.opts && c.correctIdx>=0 ? c.opts[c.correctIdx] : '');
                if(!a) return;
                var d=__numSim(o.text, a);
                if(d>guess.d) guess={d:d,i:i};
              });
            });
            if(guess.i<0) guess={d:0,i:0};
            cand={opts:g.domOpts.map(function(o){return o.text;}), correctIdx:guess.i, correctIdxs:[guess.i], correct:g.domOpts[guess.i].text, used:false, kind:'mcq'};
            appendStatus('  ⚠ '+(qnum||('Câu '+(gi+1)))+' không khớp bảng đáp án — chọn phương án giống nhất.');
          }
          var done=false;
          if(cand){
            cand.used=true;
            var domOpts=g.domOpts;
            var wantsIdx=(cand.correctIdxs && cand.correctIdxs.length)? cand.correctIdxs.slice() : (cand.correctIdx>=0? [cand.correctIdx] : []);
            var clickedCount=0, lastPosD=0, selRe=/selected|active|checked|chosen|picked/i;
            for(var wi=0; wi<wantsIdx.length; wi++){
              var wantIdx=wantsIdx[wi];
              // [SỬA LỖI] lấy đúng đáp án theo chỉ số (xem ghi chú __answerGroupObjs)
              var apiAns=(cand.opts[wantIdx]!=null && cand.opts[wantIdx]!=='')? cand.opts[wantIdx] : (cand.correct||'');
              var pos=-1, posD=0;
              domOpts.forEach(function(o,i){
                var d=__numSim(o.text,apiAns);
                var indBonus=(o.ind!=null && parseInt(o.ind,10)===wantIdx)?0.05:0;
                var d2=d+indBonus;
                if(d2>posD){ posD=d2; pos=i; }
              });
              if(pos<0 || posD<0.5){
                var byInd=domOpts.findIndex(function(o){ return o.ind!=null && parseInt(o.ind,10)===wantIdx; });
                if(byInd>=0) pos=byInd;
              }
              if(pos<0 && domOpts.length) pos=0;
              if(pos>=0){
                var el=domOpts[pos].el;
                var pre=String(el.className||'')+' '+(el.getAttribute('aria-checked')||'')+(el.getAttribute('aria-selected')||'');
                if(!selRe.test(pre)){
                  for(var tryi=0; tryi<3; tryi++){
                    try{ el.style.outline='3px solid #16a34a'; el.style.outlineOffset='2px'; }catch(e){}
                    __clickRobust(el);
                    await __sleep(120);
                    var cls=String(el.className||'')+' '+(el.getAttribute('aria-checked')||'')+(el.getAttribute('aria-selected')||'');
                    if(selRe.test(cls)) break;
                  }
                }
                clickedCount++; lastPosD=posD;
              }
            }
            if(clickedCount){
              done=true; picked++;
              opts.forEach(function(o){ answered.add(o); });
              var label=wantsIdx.map(function(x){ return String.fromCharCode(65+x); }).join(',');
              appendStatus('  → '+(qnum||('Câu '+(gi+1)))+' chọn '+label+' (ind='+wantsIdx.join(',')+', p='+(lastPosD?lastPosD.toFixed(2):'0.00')+')'+(lastPosD<0.5?' ⚠ chọn theo tỉ lệ cao nhất':''));
            }
          }
          if(!done){ if(cand) cand.used=false; skipped++; }
          await __sleep(100);
        }
        return {picked:picked, skipped:skipped};
      };

      // Điền các ô nhập văn bản (tách từ vòng lặp trang để dùng lại cho chế độ video)
      var __answerFillInputs=function(fillInputs, cands, answered){
        var picked=0;
        var fillGroups=groupBy(fillInputs, function(el){
          try{
            return el.closest('.question-content, .q-item, .quiz-question, .question-box') ||
              el.closest('.itemx, .card-body, .fill-me, .fill-blank, .quiz-itm, .quiz-list, .exam-question') ||
              el.closest('p, li, td, label') || el.parentElement;
          }catch(e){ return el.parentElement; }
        });
        fillGroups.forEach(function(ins){
          var cont=null;
          try{ cont=ins[0].closest('.question-content, .q-item, .quiz-question, .question-box, .itemx, .card-body, .fill-me, .fill-blank')||ins[0].parentElement; }catch(e){}
          var gStem='';
          try{ gStem=__groupStem(cont||ins[0].parentElement, ins); }catch(e){}
          var best={s:-9,j:-1};
          cands.forEach(function(c,j){
            if(c.kind!=='fill') return;
            // bỏ qua item không có đáp án điền (vd item kéo thả/nối cặp cũng mang kind 'fill')
            if(!(c.fills && c.fills.length) && (c.fill==null || c.fill==='')) return;
            // KHÔNG loại vĩnh viễn đáp án đã dùng: trùng đề giữa các tab vẫn điền đúng
            var s=(gStem ? __dice(gStem, c.stem) : 0) - (c.used? 0.12 : 0);
            if(s>best.s) best={s:s,j:j};
          });
          if(best.j<0){ cands.forEach(function(c,j){ if(c.kind==='fill' && ((c.fills&&c.fills.length)||c.fill!=null) && best.j<0) best={s:0,j:j}; }); }
          if(best.j<0) return;
          var c=cands[best.j]; c.used=true;
          var wants=(c.fills && c.fills.length)? c.fills.slice() : (c.fill!=null? [String(c.fill)] : []);
          // 1 đáp án chứa nhiều giá trị (vd "5 | 7", "5;7") -> tách cho đủ số ô
          if(wants.length===1 && ins.length>1){
            var sp=String(wants[0]).split(/\s*[|;\/]\s*/).filter(function(x){ return x.length; });
            if(sp.length>1) wants=sp;
          }
          ins.forEach(function(inp,k){
            var w=wants[k];
            if(w==null) return;
            try{ inp.style.outline='3px solid #16a34a'; inp.style.outlineOffset='2px'; }catch(e){}
            var cw=__pickFillAns(String(w));
            __setValue(inp, cw);
            __fillOwner.set(inp, {val:cw, page:__tabNo});
            answered.add(inp);
          });
          picked++;
          appendStatus('  → điền "'+wants.join(' | ').slice(0,60)+'" (match='+best.s.toFixed(2)+')');
        });
        return {picked:picked};
      };

      /* ===== [SỬA LỖI] BÀI DẠNG VIDEO TƯƠNG TÁC =====
         Luồng thật của OLM dạng video: video chạy -> ở một mốc thời gian câu hỏi hiện đè lên
         -> người học trả lời -> bấm "Kiểm tra" -> bấm "Tiếp tục" -> video chạy tiếp.
         BUG CŨ: (1) trang video không có tab/next/nộp nên nút Auto chỉ trả lời 1 câu rồi dừng;
                 (2) vòng lặp cũ bấm "Tiếp tục/Tiếp" liên tục mỗi 350ms -> video bị tua, câu hỏi bị bỏ qua;
                 (3) vòng lặp cũ chỉ dùng answerCurrentOnce (chỉ biết .qselect) nên câu hỏi
                     dạng radio/checkbox trong overlay không bao giờ được khoanh. */
      var __findBtnByRe=function(re){
        try{
          var pool=__deepAll('button, a, [role=button], input[type=submit], .btn').filter(__visible).filter(function(el){
            if(el.closest && el.closest('#tht-panel')) return false;
            var t=String(el.textContent||el.value||'').replace(/\s+/g,' ').trim();
            if(!t || t.length>40) return false;
            return re.test(t);
          });
          return pool.length? pool[0] : null;
        }catch(e){ return null; }
      };
      // Có câu hỏi nào đang hiện trên màn hình không (kể cả dạng radio/checkbox)
      var __videoHasQuestion=function(){
        try{
          var notPanel=function(x){ try{ return !(x.closest && x.closest('#tht-panel')); }catch(e){ return true; } };
          // gộp selector để chỉ quét DOM 1 lần (trang OLM rất nặng, quét nhiều lần gây lag)
          var sel='.qselect, tr.tf-row, .tf-row, [data-tf-value], input[type=radio], input[type=checkbox], select.select-option[ind], .dragtext[ind], .dragmore[ind], .boxlink.left, .drag-item, ul.new_click li.new_item';
          if(__deepAll(sel).filter(__visible).some(notPanel)) return true;
        if(__selEls().filter(__visible).some(notPanel)) return true;   // dropdown trong bảng (dạng mới)
          if(__deepAll('input, textarea, [contenteditable]').filter(__visible).some(function(x){
            try{
              if(!__isTextFill(x)) return false;
              if(fillVal(x).length>0) return false;
              if(x.closest && x.closest('form, .search, .comment, .chat')) return false;
              return notPanel(x);
            }catch(e){ return false; }
          })) return true;
        }catch(e){}
        return false;
      };
      var __videoAuto=async function(){
        var n=0, idle=0;
        var t0=Date.now();
        var MAX_MS=45*60*1000;   // tối đa 45 phút cho 1 video
        var vstate=function(){
          try{
            var v=null; try{ v=__deepAll('video')[0]||null; }catch(e){}
            if(!v) return {has:false, ended:false, paused:false};
            var dur=Number(v.duration)||0, cur=Number(v.currentTime)||0;
            var ended=!!v.ended || (dur>0 && cur>=dur-0.3);
            return {has:true, ended:ended, paused:!!v.paused};
          }catch(e){ return {has:false, ended:false, paused:false}; }
        };
        while(Date.now()-t0 < MAX_MS){
          var answeredNow=false;
          // 1) các dạng đặc biệt: kéo-thả, thả-xuống, nối cặp, phân nhóm, advance
          try{
            for(var vs=0; vs<8; vs++){
              var vr=await answerCurrentOnce(true);
              if(!vr||!vr.ok||vr.already) break;
              __markAns(vr); n++; answeredNow=true;
              await __sleep(150);
            }
          }catch(e){}
          // 2) trắc nghiệm (kể cả radio/checkbox và markup không phải .qselect)
          try{
            var groups=__domGroups().filter(function(g){
              return !g.some(function(o){ return __optIsSelected(o) || __answeredEls.has(o); });
            });
            if(groups.length){
              var gObjs=__buildGroupObjs(groups);
              var r2=await __answerGroupObjs(gObjs, cands, answered);
              if(r2.picked){ n+=r2.picked; answeredNow=true; }
            }
          }catch(e){}
          // 3) ô điền văn bản
          try{
            var fills=__deepAll(FILL_SEL).concat(__deepAll('input, textarea, [contenteditable]')).filter(__visible).filter(function(inp){
              if(!__isTextFill(inp)) return false;
              if(fillVal(inp).length>0) return false;
              try{ if(inp.closest && inp.closest('#tht-panel, header, nav, footer')) return false; }catch(e){}
              return true;
            });
            (function(){ var seen=new Set(); fills=fills.filter(function(x){ if(seen.has(x)) return false; seen.add(x); return true; }); })();
            if(fills.length){
              var r3=__answerFillInputs(fills, cands, answered);
              if(r3.picked){ n+=r3.picked; answeredNow=true; }
            }
          }catch(e){}
          // 4) điều khiển nút: chỉ bấm "Kiểm tra" khi vừa trả lời, "Tiếp tục" khi video đang dừng.
          //    [SỬA LỖI] trước đây bấm "Tiếp" liên tục -> video bị tua mất câu hỏi.
          var st=vstate();
          var hasQ=__videoHasQuestion();
          try{
            if(answeredNow){
              var ck=__findBtnByRe(/kiểm tra|kiem tra|check|xác nhận|xac nhan|trả lời|tra loi|submit|gửi|gui|đồng ý|dong y|ok/i);
              if(ck){ __clickRobust(ck); await __sleep(350); }
            } else if(!hasQ && st.paused){
              var nx=__findBtnByRe(/tiếp tục|tiep tuc|continue|phát|play|tiếp theo|tiep theo|next/i);
              if(nx){ __clickRobust(nx); await __sleep(300); }
            } else if(hasQ && st.paused){
              var ck2=__findBtnByRe(/kiểm tra|kiem tra|check|xác nhận|xac nhan|tiếp tục|tiep tuc|continue|ok/i);
              if(ck2){ __clickRobust(ck2); await __sleep(300); }
            }
          }catch(e){}
          // 5) điều kiện dừng: video đã hết và không còn câu hỏi nào
          if(answeredNow){ idle=0; }
          else{
            idle++;
            if(st.has){
              if(st.ended && !hasQ) break;          // video xong + không còn câu -> thoát
              if(st.ended && idle>150) break;      // video xong nhưng còn câu -> chờ thêm rồi dừng
            } else if(idle>25) break;               // không thấy <video> -> dừng nếu lâu không có việc
          }
          await __sleep(400);
        }
        return n;
      };

      var picked=0, skipped=0, failStreak=0;
      var answered=new Set();
      __answeredEls.clear();
      __olmTabIdx=null;

      for(var page=0; page<40; page++){
        // [SỬA LỖI] trang VIDEO: câu hỏi hiện theo mốc thời gian -> chạy vòng lặp riêng.
        // Chỉ coi là bài video khi trang KHÔNG có tab phân trang (có tab thì đi luồng tab
        // như cũ, tránh chiếm nhầm trang bài có video + câu hỏi tĩnh).
        var isVideoHere=__isVideoPage() && __findTabPills().length<2;
        await __waitRender(isVideoHere? 1500 : 5000);
        await __sleep(120);
        // [SỬA LỖI] RESET trạng thái mỗi tab. Trước đây `answered` giữ nguyên qua các tab nên
        // khi OLM tái dùng node DOM cho tab sau, câu mới bị coi là "đã trả lời" -> bị bỏ qua
        // (đúng hiện tượng vài tab không khoanh / không điền).
        __tabNo=page;
        answered.clear();
        __answeredEls.clear();
        clearStaleFills();
        var fp=__fpNow();

        // [SỬA LỖI] BÀI DẠNG VIDEO TƯƠNG TÁC (OLM dạng video).
        // Trang video KHÔNG có tab phân trang / #btn-next / nút nộp nên trước đây nút "Auto"
        // rơi vào nhánh fallback chỉ trả lời 1 câu rồi dừng -> không làm được bài video.
        if(isVideoHere){
          var vn=await __videoAuto();
          picked+=vn;
          appendStatus('  ▶ Video: đã trả lời '+vn+' câu.');
          // [SỬA LỖI] chỉ nộp bài khi video ĐÃ kết thúc (tránh nộp sớm khi video còn chạy)
          try{
            var vs2=__deepAll('video')[0];
            var vEnded=vs2? (!!vs2.ended || (Number(vs2.duration||0)>0 && Number(vs2.currentTime||0)>=Number(vs2.duration)-0.3)) : true;
            if(vEnded) await __submitIfPossible();
          }catch(e){}
          break;
        }

        // [BỔ SUNG] các dạng đặc biệt (thả xuống / kéo thả / nối cặp / phân nhóm /
        // kéo thả mới / advance) do answerCurrentOnce (port 01.js) xử lý trước.
        var special=__selEls().concat(__deepAll('.dragtext[ind], .dragmore[ind], .boxlink.left, .drag-item, ul.new_click li.new_item')).filter(isVisible);
        if(special.length){
          for(var sp=0; sp<30; sp++){
            var spRes=await answerCurrentOnce(true);
            if(!spRes || !spRes.ok || spRes.already) break;
            __markAns(spRes);
            picked++;
            await __sleep(120);
          }
        }

        // TF pass — [SỬA LỖI] xử lý THEO TỪNG KHỐI câu (1 tab có thể có nhiều câu Đúng/Sai)
        // [BỔ SUNG] hỗ trợ dạng "bảng lựa chọn" ô lật: bấm 1 lần hiện Đ, bấm 2 lần hiện S.
        var tfRowsAll=__deepAll('tr.tf-row, .tf-row').filter(__visible);
        // bổ sung: hàng trong bảng Đúng/Sai không có class tf-row
        if(!tfRowsAll.length){
          tfRowsAll=__deepAll('.true-false tr, #true-false tr, table tr').filter(function(r){
            if(!__visible(r)) return false;
            if(r.querySelector('th')) return false;
            // có 2 nút data-tf-value hoặc có ô trống/lật kiểu Đ/S
            if(r.querySelectorAll('[data-tf-value]').length>=1) return true;
            var txt=clean(r.textContent||'');
            return txt.length>0 && txt.length<220 && (r.querySelectorAll('td, .cell, [role=button], button, span').length>=2);
          });
        }
        if(tfRowsAll.length){
          var tfGroups=groupBy(tfRowsAll, function(r){
            try{ return r.closest('.question-content, .q-item, .quiz-question, .question-box, .itemx, .card-body, .true-false, #true-false, table')||r.parentElement; }catch(e){ return r.parentElement; }
          });
          for(var tgi=0; tgi<tfGroups.length; tgi++){
            var tfRows=tfGroups[tgi];
            var rows=tfRows.slice().sort(function(a,b){ try{ return a.getBoundingClientRect().top - b.getBoundingClientRect().top; }catch(e){ return 0; } });
            var hasTwo=rows.some(function(r){ return r.querySelectorAll('[data-tf-value]').length>=2; });
            var chosenNow=false;
            if(hasTwo){
              chosenNow=rows.some(function(r){ return [].slice.call(r.querySelectorAll('[data-tf-value]')).some(function(s){ return /selected|active|checked|chosen|picked/i.test(String(s.className||'')); }); });
            } else {
              chosenNow=rows.length>0 && rows.every(function(r){
                var els=[].slice.call(r.querySelectorAll('td, .cell, [role=button], button, span')).filter(__visible);
                return els.some(function(e){ var st=__tfCellState(e); return st==='T'||st==='F'; });
              });
            }
            if(chosenNow && hasTwo){ rows.forEach(function(r){ [].slice.call(r.querySelectorAll('[data-tf-value]')).forEach(function(s){ answered.add(s); }); }); continue; }
            var tfStem=__stemNear(rows[0],'.true-false, #true-false, .tf-row, .exp, pre');
            // [BỔ SUNG] stem rỗng -> dùng chữ mệnh đề .clause (như 01.js)
            if(!tfStem || tfStem.length<4){
              try{ var cl1=rows[0].querySelector('.clause'); if(cl1) tfStem=__norm(cl1.textContent||''); }catch(e){}
            }
            var best={s:-1,j:-1};
            cands.forEach(function(c,j){
              if(c.kind!=='tf') return;
              if(!(c.tf && c.tf.length)) return;
              var s=__dice(tfStem, __norm(c.stem));
              if(c.tf.length!==rows.length) s-=0.2;
              if(c.used) s-=0.12;
              if(s>best.s) best={s:s,j:j};
            });
            if(best.j<0){
              var same=cands.map(function(c,j){return {c:c,j:j};}).filter(function(x){return x.c.kind==='tf'&&x.c.tf&&x.c.tf.length===rows.length;});
              if(same.length===1) best={s:0,j:same[0].j};
            }
            if(best.j<0) continue;
            var cand=cands[best.j]; cand.used=true;
            for(var k=0;k<rows.length;k++){
              var spans=[].slice.call(rows[k].querySelectorAll('[data-tf-value]'));
              var trueEl=spans.find(function(s){ return s.getAttribute('data-tf-value')==='1'; });
              var falseEl=spans.find(function(s){ return s.getAttribute('data-tf-value')==='0'; });
              if(trueEl || falseEl){
                var target = (cand.tf[k]) ? trueEl : falseEl;
                if(target){ target.style.outline='3px solid #16a34a'; __clickRobust(target); }
              } else {
                // [BỔ SUNG] ô lật: click 1 lần = Đ, 2 lần = S
                var cells=[].slice.call(rows[k].querySelectorAll('td, .cell, [role=button], button, span, div')).filter(__visible);
                var toggle=null;
                for(var ci=cells.length-1; ci>=0; ci--){
                  var tx=clean(cells[ci].textContent||'');
                  var st=__tfCellState(cells[ci]);
                  if(st || tx.length<=3 || /^(đ|s|dung|sai|true|false|đúng)$/i.test(tx)){ toggle=cells[ci]; break; }
                }
                if(!toggle && cells.length>=2) toggle=cells[cells.length-1];
                if(toggle){ toggle.style.outline='3px solid #16a34a'; await __clickTfToggleTo(toggle, !!cand.tf[k]); }
              }
            }
            picked++;
            rows.forEach(function(r){ [].slice.call(r.querySelectorAll('.qselect, [data-tf-value]')).forEach(function(o){ answered.add(o); }); });
            appendStatus('  → TF xong ('+rows.length+' mệnh đề, match='+best.s.toFixed(2)+')');
          }
        }

        // [SỬA LỖI] tăng số lượt quét trong 1 tab: OLM render lại sau mỗi lần bấm nên câu
        // cuối tab có thể chưa kịp hiện ở lượt trước -> quét lại tới khi không còn câu trống.
        for(var pass=0; pass<4; pass++){
          var groups=__domGroups();
          // [SỬA LỖI] tab chỉ có câu điền / kéo thả / nối cặp: KHÔNG được break ở đây,
          // vì pass điền + pass dạng đặc biệt nằm bên dưới (trước đây bị bỏ qua hoàn toàn).
          if(!groups.length){ if(pass===0) appendStatus('  (tab nay khong co trac nghiem)'); }
          var todo=groups.filter(function(g){ return !g.some(function(o){ return answered.has(o); }); });
          if(!todo.length && pass===0) appendStatus('  (khong con trac nghiem moi)');

          var gObjs=todo.map(function(opts){
            var domOpts=opts.map(function(el){
              var ind=el.getAttribute('ind'); if(ind==null) ind=el.getAttribute('data-ind');
              return {el:el, ind: ind==null?null:String(ind), text: __katexText(el)};
            });
            var cont=null;
            try{ cont=opts[0].closest('.quiz-itm, .question-content, tr, li, .card, .itemx, .card-body')||opts[0].parentElement; }catch(e){ cont=opts[0].parentElement; }
            var stem=__groupStem(cont, opts);
            if(!stem || stem.length<8) stem=__stemNear(opts[0], '.qselect, .quiz-list, .exp, pre');
            return {opts:opts, domOpts:domOpts, stem:stem, cont:cont};
          });

          // Fill pass — [SỬA LỖI] nhận diện ô "nhập văn bản" rộng hơn + chỉ điền ô đang TRỐNG
          // (không dựa vào set `answered` nữa, vì DOM có thể bị render lại).
          var fillInputs=__deepAll(FILL_SEL).concat(__deepAll('input, textarea, [contenteditable]')).filter(isVisible).filter(function(inp){
            if(!__isTextFill(inp)) return false;
            if(fillVal(inp).length>0) return false;
            // bỏ qua ô tìm kiếm / ô ngoài vùng bài làm nếu có dấu hiệu rõ
            try{
              var nm=(inp.getAttribute('name')||'')+(inp.getAttribute('id')||'')+(inp.getAttribute('placeholder')||'')+(inp.getAttribute('aria-label')||'');
              if(/search|tìm|comment|bình\s*luận|chat|nhắn/i.test(nm) && !(inp.closest && inp.closest('.itemx, .question-content, .quiz-itm, .quiz-list, .q-item'))) return false;
            }catch(e){}
            // chấp nhận nếu trong vùng câu hỏi hoặc là ô điền đáp án điển hình
            try{
              if(inp.closest && inp.closest('.itemx, .question-content, .card-body, .fill-me, .fill-blank, .quiz-itm, .quiz-list, .quiz-question, .q-item, .question-box, .exam-question, .dragtext, .drop-text')) return true;
            }catch(e){}
            if(inp.getAttribute && inp.getAttribute('data-accept')!=null) return true;
            // [BỔ SUNG] ô text trần trong nội dung chính (tránh bỏ sót như Q28/Q31) — loại trừ form rõ ràng không phải bài làm
            try{
              if(inp.closest && inp.closest('form, .search, .comment, .chat')) return false;
            }catch(e){}
            return true;
          });
          // dedupe
          (function(){ var seen=new Set(); fillInputs=fillInputs.filter(function(x){ if(seen.has(x)) return false; seen.add(x); return true; }); })();
          var fr=__answerFillInputs(fillInputs, cands, answered);
          picked+=fr.picked;

          // Global matching MCQ (dung chung voi che do video)
          var mr=await __answerGroupObjs(gObjs, cands, answered);
          picked+=mr.picked; skipped+=mr.skipped;
          if(pass===0) await __sleep(300);
        }

        // [BỔ SUNG] "chốt hạ": thả xuống nào còn trống thì thử điền lại (OLM render lại muộn)
        for(var sp2=0; sp2<12; sp2++){
          var spLeft=__selEls().filter(isVisible).filter(function(s){
            try{ if(s.closest && s.closest('#tht-panel')) return false; return String(s.value||'').length===0; }catch(e){ return false; }
          });
          if(!spLeft.length) break;
          var r2=await answerCurrentOnce();
          if(!r2 || !r2.ok || r2.already) break;
          __markAns(r2); picked++; await __sleep(100);
        }

        // [BỔ SUNG] quét lần cuối: điền nốt mọi ô nhập văn bản còn trống (không bỏ sót)
        try{
          var emptyFills=__deepAll('input, textarea, [contenteditable], span.blank, div.blank').filter(isVisible).filter(function(inp){
            if(!__isTextFill(inp)) return false;
            if(fillVal(inp).length>0) return false;
            try{
              var nm=(inp.getAttribute('name')||'')+(inp.getAttribute('id')||'')+(inp.getAttribute('placeholder')||'')+(inp.getAttribute('aria-label')||'');
              if(/search|tìm|comment|bình\s*luận|chat|nhắn/i.test(nm) && !(inp.closest && inp.closest('.itemx, .question-content, .quiz-itm, .quiz-list, .q-item'))) return false;
            }catch(e){}
            try{ if(inp.closest && inp.closest('form:not(.quiz-form), .search, .comment, .chat')){ if(!(inp.closest && inp.closest('.itemx, .question-content, .quiz-itm, .quiz-list'))) return false; } }catch(e){}
            return true;
          });
          (function(){ var seen=new Set(); emptyFills=emptyFills.filter(function(x){ if(seen.has(x)) return false; seen.add(x); return true; }); })();
          if(emptyFills.length){
            var eGroups=groupBy(emptyFills, function(el){
              try{ return el.closest('.question-content, .q-item, .quiz-question, .question-box') || el.closest('.itemx, .card-body, .fill-me, .fill-blank') || el.closest('p, li, td, label') || el.parentElement; }catch(e){ return el.parentElement; }
            });
            eGroups.forEach(function(ins){
              var cont=null; try{ cont=ins[0].closest('.question-content, .q-item, .quiz-question, .question-box, .itemx, .card-body, .fill-me')||ins[0].parentElement; }catch(e){}
              var gStem=''; try{ gStem=__groupStem(cont||ins[0].parentElement, ins); }catch(e){}
              var best={s:-99,j:-1};
              cands.forEach(function(c,j){
                if(c.kind!=='fill') return;
                if(!(c.fills && c.fills.length) && (c.fill==null || c.fill==='')) return;
                var s=(gStem?__dice(gStem,c.stem):0) - (c.used?0.12:0);
                if(s>best.s) best={s:s,j:j};
              });
              if(best.j<0){ cands.forEach(function(c,j){ if(c.kind==='fill' && ((c.fills&&c.fills.length)||c.fill!=null) && best.j<0) best={s:-1,j:j}; }); }
              if(best.j<0) return;
              var c=cands[best.j]; c.used=true;
              var wants=(c.fills && c.fills.length)? c.fills.slice() : [String(c.fill)];
              if(wants.length===1 && ins.length>1){ var sp=String(wants[0]).split(/\s*[|;\/]\s*/).filter(function(x){return x.length;}); if(sp.length>1) wants=sp; }
              ins.forEach(function(inp,k){ var w=wants[k]; if(w==null) return; try{ inp.style.outline='3px solid #16a34a'; inp.style.outlineOffset='2px'; }catch(e){} var cw=__pickFillAns(String(w)); __setValue(inp,cw); __fillOwner.set(inp,{val:cw,page:__tabNo}); });
              picked++; appendStatus('  → (bổ sung) điền "'+wants.join(' | ').slice(0,60)+'"');
            });
          }
          // [BỔ SUNG] quét lần cuối: khoanh nốt mọi nhóm trắc nghiệm chưa chọn
          var leftGroups=__domGroups().filter(function(g){ return !g.some(function(o){ return __optIsSelected(o); }); });
          for(var lg=0; lg<leftGroups.length; lg++){
            var lgOpts=leftGroups[lg];
            var guess={d:-1,i:0};
            lgOpts.forEach(function(o,i){
              var t=__katexText(o);
              cands.forEach(function(c){
                if(c.kind!=='mcq') return;
                var correctIdxs=(c.correctIdxs&&c.correctIdxs.length)?c.correctIdxs:((c.correctIdx>=0)?[c.correctIdx]:[]);
                (c.opts||[]).forEach(function(a,ai){
                  if(!a) return;
                  var isC=correctIdxs.indexOf(ai)>=0;
                  var d=__numSim(t,a) + (isC?0.03:0);
                  if(d>guess.d) guess={d:d,i:i};
                });
              });
            });
            var gel=lgOpts[guess.i]||lgOpts[0];
            if(gel){ try{ gel.style.outline='3px solid #16a34a'; gel.style.outlineOffset='2px'; }catch(e){} __clickRobust(gel); picked++; await __sleep(80); }
          }
          if(emptyFills.length || leftGroups.length) appendStatus('  → Quét bổ sung: điền '+(emptyFills.length||0)+' ô, khoanh '+(leftGroups.length||0)+' nhóm.');
        }catch(e){}

        await __sleep(120);
        // [SỬA LỖI] ưu tiên chuyển tab trước; chỉ bấm "Kiểm tra" nếu KHÔNG chuyển được
        // (một số bài khóa tab khi chưa kiểm tra -> bấm kiểm tra ở nhánh fallback).
        var fpAfter=__fpNow();
        var adv=await __gotoNextPage(fpAfter, page);
        if(adv==='done'){
          // tab cuối -> nộp bài + xác nhận hộp thoại
          await __submitIfPossible();
          break;
        }
        if(adv===false || adv==='force'){
          // chưa chuyển được hoặc nghi ngờ chưa đổi nội dung -> bấm Kiểm tra rồi thử lại
          try{ await __clickDoneThenNext(); }catch(e){}
          await __sleep(180);
          var adv2=await __gotoNextPage(__fpNow(), page);
          if(adv2===true || adv2==='done'){ adv=adv2; }
          else if(adv==='force'){ adv=adv2; } // giữ kết quả sau kiểm tra
        }
        if(adv==='done'){
          await __submitIfPossible();
          break;
        }
        if(adv===false){
          // [SỬA LỖI] chỉ nộp bài khi KHÔNG còn tab nào để đi tiếp — tránh nộp sớm khi 1 tab lỗi
          var pillsLeft=__findTabPills();
          if(pillsLeft.length>=2 && failStreak<3){
            failStreak++;
            if(__olmTabIdx!=null) __olmTabIdx++;
            appendStatus('  ⚠ Chưa chuyển được tab — thử tab kế tiếp ('+failStreak+'/3).');
            continue;
          }
          if(await __submitIfPossible()) break;
          appendStatus('⚠️ Không chuyển được trang — dừng. Đã khoanh '+picked+', bỏ '+skipped+'.'); break;
        }
        failStreak=0;
        __answeredEls.clear();
      }
      appendStatus('✅ Auto OLM xong. Đã khoanh '+picked+' đáp án (bỏ '+skipped+').');
    }

    function __groupStem(cont, opts){
      try{
        var c=(cont||opts[0]).cloneNode(true);
        [].slice.call(c.querySelectorAll('.qselect, .quiz-list, .exp, pre, .katex-mathml, [ind], [data-ind]')).forEach(function(x){ try{ x.remove(); }catch(e){} });
        // [SỬA LỖI] bỏ luôn label chứa radio/checkbox (là phương án, không phải đề bài)
        // -> stem lấy được đúng câu hỏi thay vì lẫn chữ "Có./Không." vào.
        [].slice.call(c.querySelectorAll('label')).forEach(function(x){
          try{ if(x.querySelector('input[type=radio], input[type=checkbox]')) x.remove(); }catch(e){}
        });
        return __katexText(c);
      }catch(e){ return ''; }
    }

    /* ============================================================
       [v7.7] HỆ THỐNG QUÉT DẠNG BÀI + DẠNG 2 (BÀI VIDEO TƯƠNG TÁC)
       ------------------------------------------------------------
       Luồng mới của nút "Auto làm bài":
         0) __scanMode()  -> quyết định chạy nhánh nào
         1) 'quiz' / 'quiz-tabs'      -> DẠNG 1: luồng cũ (__olmFullAuto / __autoLoop01)
         2) 'lesson'                  -> DẠNG 2a: bài học tương tác dạng web-component
                                        (<TYPE-*> + shadowRoot + jsonQuestion) -> __videoLessonRun()
            'video'                   -> DẠNG 2b: video thường, câu hỏi đè lên video -> luồng cũ
       Dạng 2a port từ message (2).txt: đáp án lấy từ API, ghi THẲNG vào el.userAnswer
       rồi bắn event 'shadow-dom-listen' (check-question / show-correct-answer).
       ============================================================ */

    // Danh sách phần tử web-component của bài tương tác (tagName dạng TYPE-xxxx)
    var __lessonTags=null, __lessonTick=0;
    function __lessonEls(forceFull){
      __lessonTick++;
      var full = !!forceFull || !__lessonTags || (__lessonTick % 6 === 0);
      var out=[], seen=new Set();
      try{
        var roots=__collectRoots();
        if(full){
          if(!__lessonTags) __lessonTags=new Set();
          roots.forEach(function(r){
            var all=[]; try{ all=r.querySelectorAll('*'); }catch(e){ return; }
            for(var i=0;i<all.length;i++){
              var t=String(all[i].tagName||'');
              if(/^TYPE-/i.test(t)) __lessonTags.add(t.toLowerCase());
            }
          });
        }
        if(!__lessonTags || !__lessonTags.size) return out;
        var sel=[]; __lessonTags.forEach(function(t){ sel.push(t); });
        var q=sel.join(',');
        roots.forEach(function(r){
          try{
            [].slice.call(r.querySelectorAll(q)).forEach(function(el){ if(!seen.has(el)){ seen.add(el); out.push(el); } });
          }catch(e){}
        });
      }catch(e){}
      return out;
    }

    // Quét trang: chờ render một chút rồi phân loại
    async function __scanMode(){
      appendStatus('🔎 Đang quét dạng bài...');
      for(var i=0;i<8;i++){
        if(__lessonEls(i===0).length) break;
        if(__findTabPills().length>=2) break;
        if(findBtn('btn-next')) break;
        if(__deepAll('.qselect, .dragtext[ind], .selecttext[ind], tr.tf-row').length) break;
        if(__deepAll('video').length) break;
        await __sleep(250);
      }
      // (a) web-component của bài học tương tác
      var les=__lessonEls(true);
      if(les.length){
        var withQ=les.filter(function(el){ try{ return el.jsonQuestion && typeof el.jsonQuestion==='object'; }catch(e){ return false; } });
        appendStatus('   · thấy '+les.length+' khối <TYPE-*> ('+withQ.length+' có jsonQuestion)');
        return 'lesson';
      }
      // (b) shadow DOM chứa widget đáp án -> cũng là dạng tương tác
      try{
        var hosts=__deepAll('*').filter(function(el){ return !!el.shadowRoot; });
        for(var h=0; h<hosts.length; h++){
          var sr=hosts[h].shadowRoot;
          if(!sr || !sr.querySelector) continue;
          if(sr.querySelector('.qselect[ind], .dragtext[ind], input[ind]')){
            appendStatus('   · shadow DOM có widget đáp án');
            return 'lesson';
          }
        }
      }catch(e){}
      // (c) đề dạng DANH SÁCH CÂU (#question-list .item-q / .question-hold + [data-id-quiz])
      if(__examIsListPage()){ appendStatus('   · có #question-list .item-q / .question-hold'); return 'exam-list'; }
      // (d) trang thường
      var pills=__findTabPills();
      if(pills.length>=2){ appendStatus('   · có '+pills.length+' tab phân trang'); return 'quiz-tabs'; }
      if(__isVideoPage()){ appendStatus('   · có video + câu hỏi đè lên'); return 'video'; }
      var nq=__deepAll('.qselect, input[data-accept], .dragtext[ind], .selecttext[ind], tr.tf-row, .boxlink.left, .drag-item, ul.new_click li.new_item').length;
      appendStatus('   · '+nq+' widget đáp án tĩnh');
      return 'quiz';
    }

    // [FIX] widget đáp án ở LIGHT DOM (bài tập hiện sẵn trên trang, không nằm trong shadow DOM của video)
    function __lightQWidgets(){
      var sel='.qselect, input[data-accept], .dragtext[ind], .selecttext[ind], tr.tf-row, .boxlink.left, .drag-item, ul.new_click li.new_item, select.select-option[ind]';
      var out=[];
      try{
        __deepAll(sel).forEach(function(el){
          try{
            var rn=el.getRootNode && el.getRootNode();
            if(rn && rn!==document) return;     // nằm trong shadow root -> dạng 2 lo
          }catch(e){}
          if(isVisible(el)) out.push(el);
        });
      }catch(e){}
      return out;
    }

    /* ---------- DẠNG 2: BÀI VIDEO TƯƠNG TÁC ----------
       Port NGUYÊN VĂN script console (message (2).txt), chạy y như khi dán vào F12:
       nạp đáp án từ API -> ghi thẳng vào el.userAnswer của từng <TYPE-*> (shadow DOM)
       -> bắn 'shadow-dom-listen' (check-question 120ms, show-correct-answer 400ms).
       Khác duy nhất: dùng constructor của TRANG (unsafeWindow) để event/DOM đúng realm,
       và đổi console.log -> panel. */
    var __videoLessonRunning=false;
    function __videoLessonRun(){
      if(__videoLessonRunning){ appendStatus('▶ DẠNG 2 đang chạy rồi.'); return; }
      __videoLessonRunning=true;

      var W=(typeof unsafeWindow!=='undefined')? unsafeWindow : window;
      var CW=W.CustomEvent||CustomEvent, EW=W.Event||Event;
      var DDP=W.DOMParser||DOMParser, TD=W.TextDecoder||TextDecoder;
      var USP=W.URLSearchParams||URLSearchParams;
      var MO=W.MutationObserver||(typeof MutationObserver!=='undefined'? MutationObserver : null);

      var clean=function(s){
        return String(s||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
      };
      var key=function(s){
        return String(s||'')
          .replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ')
          .replace(/[\u2019`]/g,"'").replace(/[\u2212\u2013\u2014]/g,'-').replace(/[$\\{}]/g,'')
          .replace(/[^a-zA-Z0-9-]/g,'').toLowerCase();
      };

      var html=document.documentElement.outerHTML;
      var csrfEl=document.querySelector('meta[name="csrf-token"]');
      var csrf=csrfEl? csrfEl.content : '';
      var ids=((html.match(/id_quizs\s*:\s*\[([^\]]+)\]/)||[])[1]||'')
        .split(',').map(function(s){ return s.trim().replace(/^["']|["']$/g,''); }).filter(Boolean);
      if(!csrf || !ids.length){
        appendStatus('⚠ Mở đúng trang bài olm.vn đã (không thấy csrf-token / id_quizs).');
        __videoLessonRunning=false;
        return;
      }

      var body=new USP();
      ids.forEach(function(id){ body.append('qlib_list[]', id); });
      body.append('id_subject','3');
      body.append('cv_q','1');

      var dec=function(s){
        return new TD().decode(Uint8Array.from(atob(s), function(c){ return c.charCodeAt(0); }));
      };
      var TEXT={}, CORRECT={}, DRAG_ID={};

      // --- DOM helpers ---
      // [FIX] walk qua cả iframe same-origin: một số bài học nhúng câu hỏi trong iframe
      var walk=function(root,out){
        out=out||[];
        var all=root.querySelectorAll('*');
        for(var i=0;i<all.length;i++){
          out.push(all[i]);
          if(all[i].shadowRoot) walk(all[i].shadowRoot,out);
          if(/^IFRAME$/i.test(all[i].tagName||'')){
            try{ if(all[i].contentDocument) walk(all[i].contentDocument,out); }catch(e){}
          }
        }
        return out;
      };
      var visible=function(el){
        if(!el || !el.isConnected) return false;
        var r=el.getBoundingClientRect();
        var st=getComputedStyle(el);
        return r.width>0 && r.height>0 &&
          st.display!=='none' && st.visibility!=='hidden' && st.opacity!=='0' &&
          r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth;
      };
      // [FIX] "đã render" = có kích thước + không bị ẩn, KHÔNG đòi phải nằm trong viewport.
      // Bài tập hiện sẵn (hiện cả loạt, có câu nằm dưới màn hình) trước đây bị visible() loại -> không làm.
      var rendered=function(el){
        if(!el || !el.isConnected) return false;
        try{
          var r=el.getBoundingClientRect();
          if(!(r.width>0 && r.height>0)) return false;
          var st=getComputedStyle(el);
          if(st.display==='none' || st.visibility==='hidden' || st.opacity==='0') return false;
          return true;
        }catch(e){ return false; }
      };
      var fire=function(action, extra){
        var detail={action:action};
        if(extra) for(var k in extra) detail[k]=extra[k];
        document.dispatchEvent(new CW('shadow-dom-listen',{detail:detail,bubbles:true,composed:true}));
      };

      // --- trả lời 1 lượt (giữ nguyên logic bản console) ---
      var auto=function(){
        var used=new Set(), total=0;
        var els=walk(document).filter(function(e){ return /^TYPE-/i.test(e.tagName||''); });

        for(var ei=0; ei<els.length; ei++){
          var el=els[ei];
          // [FIX] dùng rendered() thay visible(): câu đã hiện sẵn nhưng nằm ngoài viewport vẫn phải làm
          if(!rendered(el)) continue;

          var jq=el.jsonQuestion||{};
          if(!jq || typeof jq!=='object' || !Object.keys(jq).length) continue;   // chưa gán dữ liệu câu -> bỏ qua
          var s=JSON.stringify(jq);
          var qid=String(jq.id||jq.id_script||jq.question_id||jq._id||(s.match(/\b\d{12}\b/)||[])[0]||'');
          if(!TEXT[qid] && !(CORRECT[qid]&&CORRECT[qid].length)){
            var ks=Object.keys(TEXT), alt=null;
            for(var ki=0;ki<ks.length;ki++){ if(!used.has(ks[ki])){ alt=ks[ki]; break; } }
            qid=alt||qid;
          }
          used.add(qid);

          var answers=TEXT[qid]||[];
          var sig=answers.join('|')+'#'+(CORRECT[qid]||[]).join(',')+'#'+(DRAG_ID[qid]||[]).join(',');
          if(el.__olmAutoDone===sig) continue;

          var root=el.shadowRoot||el;
          var picked=0;
          el.userAnswer={selectedOptions:[],isMultipleChoice:false};

          var drags=[].slice.call(root.querySelectorAll('.dragtext[ind]'));
          if(drags.length){
            var ua={};
            drags.forEach(function(d,i){
              var raw=d.getAttribute('ind');
              var n=Number(raw);
              var idx=isFinite(n)? n : i;
              var arr=DRAG_ID[qid];
              ua[raw==null? String(i):raw]= (arr && arr[idx]!=null)? arr[idx] : '0';
              picked++;
            });
            el.userAnswer=ua;
            if(el.requestUpdate) el.requestUpdate();
          } else {
            var fills=[].slice.call(root.querySelectorAll('input[ind]'));
            if(fills.length){
              var ua2={};
              fills.forEach(function(inp,i){
                var raw=inp.getAttribute('ind');
                var n=Number(raw);
                var idx=isFinite(n)? n : i;
                var val=(answers[idx]!=null)? answers[idx] : '';
                ua2[raw==null? String(i):raw]=val;
                inp.value=val;
                try{ inp.dispatchEvent(new EW('input',{bubbles:true,composed:true})); }catch(e){}
                try{ inp.dispatchEvent(new EW('change',{bubbles:true,composed:true})); }catch(e){}
                picked++;
              });
              el.userAnswer=ua2;
              if(el.requestUpdate) el.requestUpdate();
            } else {
              var qsels=[].slice.call(root.querySelectorAll('.qselect[ind]'));
              if(qsels.length){
                var chosen=(CORRECT[qid]||[]).slice();
                if(!chosen.length){
                  answers.forEach(function(a){
                    var o=null;
                    for(var i=0;i<qsels.length;i++){ if(key(qsels[i].textContent)===key(a)){ o=qsels[i]; break; } }
                    if(o) chosen.push(Number(o.getAttribute('ind')));
                  });
                }
                chosen.forEach(function(i){
                  for(var k2=0;k2<qsels.length;k2++){
                    if(Number(qsels[k2].getAttribute('ind'))===i){
                      try{ qsels[k2].click(); picked++; }catch(e){}
                      break;
                    }
                  }
                });
              } else {
                [].slice.call(root.querySelectorAll('select'))
                  .filter(function(sel){ return sel.options && sel.options.length>1; })
                  .slice(0, answers.length||1)
                  .forEach(function(sel,i){
                    var kk=key(answers[i]);
                    var opts=[].slice.call(sel.options);
                    for(var oi=0; oi<opts.length; oi++){
                      if(key(opts[oi].text)===kk){
                        sel.selectedIndex=oi;
                        try{ sel.dispatchEvent(new EW('change',{bubbles:true,composed:true})); }catch(e){}
                        picked++;
                        break;
                      }
                    }
                  });
              }
            }
          }

          if(!picked) continue;
          el.__olmAutoDone=sig;
          total+=picked;
          appendStatus('  AUTO '+qid+' → '+picked+' đáp án');
        }

        if(!total) return;
        setTimeout(function(){ fire('check-question',{isShowConfirm:false}); },120);
        setTimeout(function(){ fire('show-correct-answer',{showGuideExp:false}); },400);
      };

      // --- nạp đáp án rồi theo dõi câu hỏi hiện lên (như bản console) ---
      (async function(){
        var paths=['/course/question/get-question-of-ids','/index.php/course/question/get-question-of-ids'];
        appendStatus('▶ DẠNG 2 — nạp đáp án ('+ids.length+' qlib)...');
        for(var pi=0; pi<paths.length; pi++){
          var r=null;
          try{
            r=await fetch(paths[pi],{
              method:'POST',
              headers:{'Content-Type':'application/x-www-form-urlencoded','X-CSRF-TOKEN':csrf},
              body:body
            });
          }catch(e){ r=null; }
          if(!r || !r.ok) continue;
          var arr=null;
          try{ arr=await r.json(); }catch(e){ arr=null; }
          if(!Array.isArray(arr)) continue;

          for(var qi=0; qi<arr.length; qi++){
            var q=arr[qi];
            var id=String(q.id);
            var t=[], dragIds=[], dragOff=0;
            var doc=null;
            try{ doc=new DDP().parseFromString(dec(q.content||''),'text/html'); }catch(e){ doc=null; }

            if(doc){
              [].slice.call(doc.querySelectorAll('.selecttext, .selectadvance, .dragtext')).forEach(function(el){
                var parts=String(el.textContent||'').split('||').map(clean).filter(Boolean);
                if(el.classList.contains('dragtext')){
                  dragIds.push(String(dragOff));
                  dragOff+=parts.length;
                  if(parts[0]) t.push(parts[0]);
                  return;
                }
                var c=el.classList.contains('selectadvance')? parts[1] : parts[0];
                if(c) t.push(c);
              });
              [].slice.call(doc.querySelectorAll('.correctAnswer')).forEach(function(el){
                t.push(clean(el.textContent));
              });
            }

            var idx=[];
            try{
              var j=typeof q.json_content==='string'? JSON.parse(q.json_content) : q.json_content;
              var lists=[];
              (function walkJ(n){
                if(!n || typeof n!=='object') return;
                if(Array.isArray(n)){ n.forEach(walkJ); return; }
                if(n.type==='olm-list' && Array.isArray(n.children)) lists.push(n);
                if(n.type==='fillme-input' && n.content){
                  var raw=String(n.content).split('||')[0]||'';
                  var c2=clean(raw);
                  var m=c2.match(/^\$\$([\s\S]+)\$\$$|^\$([\s\S]+)\$$/);
                  t.push(clean(m? (m[1]!=null? m[1] : m[2]) : raw));
                }
                if(n.correct===true){
                  var s2=(n.children||[]).map(function(c){ return c.text||''; }).join(' ');
                  if(String(s2).trim()) t.push(clean(s2));
                }
                Object.keys(n).forEach(function(k){ walkJ(n[k]); });
              })(j);
              lists.forEach(function(list){
                (list.children||[]).forEach(function(c,i){
                  var ok=c.correct===true || (Array.isArray(c.children) && c.children.some(function(x){ return x.correct===true; }));
                  if(ok && idx.indexOf(i)<0) idx.push(i);
                });
              });
            }catch(e){}

            TEXT[id]=t.filter(Boolean);
            CORRECT[id]=idx;
            DRAG_ID[id]=dragIds;
          }
          appendStatus('✅ API '+paths[pi]+': '+arr.length+' câu');
          break;
        }

        W.__OLM_TEXT=TEXT;
        W.__OLM_CORRECT=CORRECT;
        W.__OLM_DRAG_ID=DRAG_ID;
        W.__olmAuto=auto;
        appendStatus('Đã nạp '+Object.keys(TEXT).length+' câu.');

        var tmr=null;
        var schedule=function(){ clearTimeout(tmr); tmr=setTimeout(auto,200); };
        try{
          if(MO) new MO(schedule).observe(document.body,{
            childList:true, subtree:true, attributes:true, attributeFilter:['style','class','hidden']
          });
        }catch(e){}
        setInterval(schedule,500);
        schedule();
        appendStatus('Đang chờ câu hỏi hiện lên...');
      })();
    }

    /* ============================================================
       [v7.9] DẠNG 1b — ĐỀ DẠNG DANH SÁCH CÂU (kiểu olm_all_in_one)
       Dấu hiệu DOM:  .question-hold + [data-id-quiz] + #question-list .item-q
                      .qselect[data-ind] | tr.tf-row[data-id] .qselect[data-value]
                      select.select-option | .quiz-content | .quiz-itm
       Đáp án: API get-question-of-ids (id_skill lấy từ data_exam), phân loại
               TL / SEL / TN / TF / GROUP; ưu tiên window.__qlib[id].runAll nếu trang có
               (runAll cho đáp án từng câu con + quizl_order cho thứ tự nhóm bị đảo).
       Sau khi chọn còn KIỂM TRA lại DOM (mong đợi vs thực tế) để báo câu sai.
       ============================================================ */
    var __examItems=null;

    function __examIsListPage(){
      try{
        if(__deepAll('#question-list .item-q').length) return true;
        if(__deepAll('.question-hold [data-id-quiz]').length) return true;
      }catch(e){}
      return false;
    }

    // Hook console.log của TRANG: OLM tự log object qlib (có runAll/correct/quizl_order)
    function __hookQlib(){
      var W=__W;
      try{ W.__qlib=W.__qlib||{}; }catch(e){}
      try{
        if(W.console && W.console.log && !W.console.log.__thtQlib){
          var orig=W.console.log.bind(W.console);
          var patched=function(){
            try{
              for(var i=0;i<arguments.length;i++){
                var a=arguments[i];
                if(a && typeof a==='object' && a.runAll && a.id_quiz!=null) W.__qlib[String(a.id_quiz)]=a;
              }
            }catch(e){}
            return orig.apply(null, arguments);
          };
          try{ patched.__thtQlib=true; }catch(e){}
          W.console.log=patched;
        }
      }catch(e){}
      return (W.__qlib||{});
    }

    async function __examLoadItems(){
      var W=__W;
      var de={}; try{ de=W.data_exam||{}; }catch(e){ de={}; }
      var ids=[];
      try{ var f=__findQuizIds(false); if(f && f.ids && f.ids.length) ids=f.ids.slice(); }catch(e){}
      if(!ids.length){ try{ var f2=__findQuizIds(true); if(f2 && f2.ids) ids=f2.ids.slice(); }catch(e){} }
      if(!ids.length){
        ids=__deepAll('[data-id-quiz]').map(function(e){ return String(e.getAttribute('data-id-quiz')||''); })
          .filter(function(x){ return /^\d{4,}$/.test(x); });
        var uniq=[], seen=new Set();
        ids.forEach(function(x){ if(!seen.has(x)){ seen.add(x); uniq.push(x); } });
        ids=uniq;
      }
      if(!ids.length){ appendStatus('❌ Không thấy ID câu hỏi cho đề danh sách.'); return null; }
      var ap={}; try{ ap=__apiParams({}); }catch(e){}
      var subject=(de.id_subject!=null)? String(de.id_subject) : String(ap.id_subject||'3');
      var skill=(de.id_category!=null)? String(de.id_category) : ((de.idCate!=null)? String(de.idCate) : String(ap.id_category||''));
      var cv='1';
      var token=__csrfToken();
      var data=null;
      var eps=['/course/question/get-question-of-ids','/exam/question/get-question-of-ids'];
      for(var ei=0; ei<eps.length && !data; ei++){
        var r=null;
        try{ r=await __postQuizIds(ids, subject, skill, cv, eps[ei], token); }catch(e){ r=null; }
        if(r && r.ok && Array.isArray(r.data) && r.data.length) data=r.data;
      }
      if(!data){ appendStatus('❌ API rỗng cho đề danh sách.'); return null; }

      function stripT(s){ return String(s==null?'':s).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); }
      function textOfNode(n){
        if(!n) return '';
        if(typeof n==='string') return n;
        var o=n.text||'';
        var ch=n.children||[];
        for(var i=0;i<ch.length;i++) o+=textOfNode(ch[i]);
        return o;
      }

      var items=data.map(function(q){
        var html='';
        try{ html=__xorDecode(q.content||'', __xorKeys()); }catch(e){ html=''; }
        if(!html || !/[<>]/.test(html)){ try{ html=__xorDecode(q.content_i18n||'', __xorKeys()); }catch(e){} }
        var qt=Number(q.q_type);
        var content=stripT(html);
        var lis=[];
        try{
          (function walkJ(n){
            if(!n || typeof n!=='object') return;
            if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walkJ(n[i]); return; }
            if(n.type==='olm-list-item' && stripT(textOfNode(n))) lis.push(n);
            var ks=Object.keys(n);
            for(var k=0;k<ks.length;k++) walkJ(n[ks[k]]);
          })(JSON.parse(__xorDecode(q.json_content||'', __xorKeys())));
        }catch(e){}
        var stripText=function(n){ return stripT(textOfNode(n)); };

        // TL: tự luận — data-accept nằm ngay trong content
        var acceptRaw=[], m, re=/data-accept="([^"]*)"/gi;
        while((m=re.exec(html))) acceptRaw.push(String(m[1]).trim());
        var accepts=acceptRaw.map(function(s){ return String(s).split('||')[0].trim(); });
        if(accepts.length) return {id:String(q.id), kind:'TL', accepts:accepts, acceptRaw:acceptRaw, html:html};

        // SEL: thả xuống kiểu selecttext (đáp án luôn là option index 0)
        if(qt===11 && /selecttext/i.test(html)){
          var selOptions=[], re2=/<span class="selecttext[^>]*>([\s\S]*?)<\/span>/gi, m2;
          while((m2=re2.exec(html))){
            selOptions.push(stripT(m2[1]).split('||').map(function(s){ return s.trim(); }).filter(Boolean));
          }
          if(selOptions.length) return {id:String(q.id), kind:'SEL', selOptions:selOptions, html:html};
        }

        // TN: trắc nghiệm (1 nhóm đáp án)
        if(qt!==13 && qt!==21 && qt!==22){
          var ci=[];
          lis.forEach(function(it2,i){ if(it2.correct) ci.push(i); });
          return {id:String(q.id), kind:'TN', content:content, correctIndex:ci, options:lis.map(stripText), html:html};
        }

        // TF: đúng/sai
        if(qt===13){
          return {id:String(q.id), kind:'TF', content:content,
            tfAnswers:lis.map(function(it2){ return !!it2.correct; }), options:lis.map(stripText), html:html};
        }

        // GROUP: nhiều nhóm 4 đáp án (tiếng Anh q_type 21/22)
        var groups=[];
        var chunks=html.split(/<ol\b/i).slice(1);
        for(var gi=0; gi<chunks.length; gi++){
          var chunk=chunks[gi].split(/<\/ol>/i)[0];
          var re3=/<li\b([^>]*)>([\s\S]*?)<\/li>/gi, m3;
          var parsed=[];
          while((m3=re3.exec(chunk))){
            var txt=stripT(m3[2]);
            if(txt) parsed.push({text:txt, correct:/correctAnswer/.test(m3[1])});
          }
          if(parsed.length){
            var cidx=-1;
            for(var pi=0; pi<parsed.length; pi++){ if(parsed[pi].correct){ cidx=pi; break; } }
            groups.push({index:gi, options:parsed.map(function(p){ return p.text; }), correctIndex:cidx});
          }
        }
        if(!groups.length){
          for(var i4=0; i4<lis.length; i4+=4){
            var ch4=lis.slice(i4,i4+4);
            var cidx4=-1;
            for(var pi4=0; pi4<ch4.length; pi4++){ if(ch4[pi4].correct){ cidx4=pi4; break; } }
            groups.push({index:groups.length, options:ch4.map(stripText), correctIndex:cidx4});
          }
        }
        return {id:String(q.id), kind:'GROUP', content:content, groups:groups, html:html,
          options:groups.reduce(function(a,g){ return a.concat(g.options); }, [])};
      });
      __examItems=items;
      appendStatus('✅ Đề danh sách: '+items.length+' câu (subject '+subject+', skill '+(skill||'?')+').');
      return items;
    }

    function __examFindHold(it){
      var holds=__deepAll('.question-hold');
      for(var i=0;i<holds.length;i++){
        var e=null;
        try{ e=holds[i].querySelector('[data-id-quiz]'); }catch(err){ e=null; }
        if(e && String(e.getAttribute('data-id-quiz'))===it.id) return holds[i];
      }
      return null;
    }

    // chia .qselect thành từng nhóm (mỗi nhóm = 1 câu con) giống bản gốc
    function __examParts(zone, it){
      var qs=[].slice.call(zone.querySelectorAll('.qselect'));
      var lists=[].slice.call(zone.querySelectorAll('.quiz-list'));
      var gn=(it.groups && it.groups.length)? it.groups.length : 0;
      if(lists.length && lists.length>=gn){
        return lists.map(function(l){ return [].slice.call(l.querySelectorAll('.qselect')); });
      }
      var per=gn? (qs.length/gn) : 0;
      if(gn && isFinite(per) && per%1===0 && per>=4){
        var out=[];
        for(var i=0;i<gn;i++) out.push(qs.slice(i*per,(i+1)*per));
        return out;
      }
      return [qs];
    }

    function __examDien(hold, values){
      var list=(Object.prototype.toString.call(values)==='[object Array]')? values : [values];
      var zone=hold.querySelector('.quiz-content')||hold;
      var els=[].slice.call(zone.querySelectorAll('input[type="text"],input[type="number"],textarea,[contenteditable="true"]'))
        .filter(function(e){ return !e.disabled; });
      if(!els.length) return {ok:false, count:0, msg:'không thấy ô nhập'};
      els.forEach(function(el,i){
        if(list[i]===undefined) return;
        try{
          if(el.isContentEditable) el.textContent=list[i]; else el.value=list[i];
        }catch(e){}
        ['input','change','keyup'].forEach(function(t){ try{ el.dispatchEvent(new Event(t,{bubbles:true})); }catch(e){} });
      });
      return {ok:true, count:Math.min(list.length, els.length), value:list.join(' | ')};
    }

    // chọn đáp án cho 1 câu (giống window.chonCau của bản gốc + nhánh __qlib)
    function __examChonCau(it, hold){
      var W=__W;
      var zone=hold.querySelector('.quiz-content')||hold;

      // (0) ưu tiên dữ liệu nội bộ qlib: đáp án từng câu con + checker của trang
      try{
        var qlib=(W.__qlib||{})[it.id];
        if(qlib && qlib.runAll && qlib.runAll.length){
          var subs=[].slice.call(hold.querySelectorAll('.quiz-itm'));
          var done=0;
          qlib.runAll.forEach(function(t,gi){
            var c=t.correct;
            if(!c || !c.length) return;
            var z=subs[gi]||subs[0]||hold;
            if(typeof c[0]==='number'){
              var opts=[].slice.call(z.querySelectorAll('.qselect'));
              c.forEach(function(idx){
                var el=null;
                for(var i=0;i<opts.length;i++){ if(Number(opts[i].getAttribute('data-ind'))===idx){ el=opts[i]; break; } }
                if(el){ try{ el.click(); done++; }catch(e){} }
              });
            } else {
              var ins=[].slice.call(z.querySelectorAll('input[type="text"],input[type="number"],textarea,[contenteditable="true"]'))
                .filter(function(e){ return !e.disabled; });
              var srcx=(t.correctx && t.correctx.length)? t.correctx : c;
              ins.forEach(function(el,k){
                var v=(srcx[k]!==undefined)? srcx[k] : c[k];
                if(Object.prototype.toString.call(v)==='[object Array]') v=v[0];
                if(v===undefined) return;
                try{
                  if(el.isContentEditable) el.textContent=v; else el.value=v;
                }catch(e){}
                ['input','change','keyup'].forEach(function(ev){ try{ el.dispatchEvent(new Event(ev,{bubbles:true})); }catch(e){} });
                done++;
              });
            }
          });
          if(done){
            try{ if(W.jQuery && qlib.check) qlib.check(W.jQuery(hold)); }catch(e){}
            return {ok:true, count:done, msg:'qlib'};
          }
        }
      }catch(e){}

      if(it.kind==='TL'){
        var q2=(W.__qlib||{})[it.id];
        if(q2 && q2.runAll){
          var vals=[];
          q2.runAll.forEach(function(t){
            var src=t.correctx||t.correct||[];
            src.forEach(function(c){
              var v=(Object.prototype.toString.call(c)==='[object Array]')? c[0] : c;
              if(v!==undefined) vals.push(v);
            });
          });
          if(vals.length) return __examDien(hold, vals);
        }
        return __examDien(hold, it.accepts);
      }

      if(it.kind==='SEL'){
        var sels=[].slice.call(zone.querySelectorAll('select.select-option'));
        sels.forEach(function(s){
          try{ s.value='0'; s.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){}
        });
        return {ok:true, count:sels.length, total:sels.length};
      }

      if(it.kind==='TF'){
        var doneTf=0;
        [].slice.call(zone.querySelectorAll('.tf-row')).forEach(function(row){
          var i=Number(row.getAttribute('data-id'));
          var want=it.tfAnswers[i];
          var box=row.querySelector('.qselect');
          if(!box || want===undefined) return;
          var raw=box.getAttribute('data-value');
          var cur=(raw==='1')? true : ((raw==='0')? false : null);
          if(cur===null || cur!==want){
            try{ box.click(); doneTf++; }catch(e){}
            if(cur===null && !want){ try{ box.click(); }catch(e){} }
          }
        });
        return {ok:true, count:doneTf, msg:'đúng/sai'};
      }

      if(it.kind==='GROUP'){
        var parts=__examParts(zone, it);
        var q3=(W.__qlib||{})[it.id];
        var order=(q3 && q3.quizl_order && q3.quizl_order.length)? q3.quizl_order : it.groups.map(function(_,i){ return i; });
        var doneG=0;
        parts.forEach(function(part, gi){
          var orig=order[gi];
          var g=it.groups[orig!=null? orig : gi];
          if(!g || g.correctIndex<0) return;
          var target=null;
          for(var i=0;i<part.length;i++){ if(Number(part[i].getAttribute('data-ind'))===g.correctIndex){ target=part[i]; break; } }
          if(!target){
            var want=g.options[g.correctIndex];
            for(var j=0;j<part.length;j++){
              /* [v8.3] so khớp lỏng: bỏ dấu / khoảng trắng vẫn nhận đúng thẻ */
              if(__examSame(part[j].textContent, want) && part[j].getAttribute('data-tht-done')!=='1'){ target=part[j]; break; }
            }
          }
          if(target){ try{ target.click(); target.setAttribute('data-tht-done','1'); doneG++; }catch(e){} }
        });
        return {ok:true, count:doneG, msg:(it.groups.length+' nhóm'), total:it.groups.length};
      }

      // TN
      var qs=[].slice.call(zone.querySelectorAll('.qselect'));
      var doneN=0;
      (it.correctIndex||[]).forEach(function(ind){
        for(var i=0;i<qs.length;i++){
          if(Number(qs[i].getAttribute('data-ind'))===ind){ try{ qs[i].click(); doneN++; }catch(e){} break; }
        }
      });
      return {ok:true, count:doneN};
    }

    function __examNorm(s){ return String(s==null?'':s).replace(/\s+/g,' ').trim().toLowerCase(); }
    /* [v8.3] so sánh văn bản: chặt -> lỏng (bỏ dấu, bỏ khoảng trắng) -> gần đúng */
    function __examSame(a,b){
      a=__examNorm(a); b=__examNorm(b);
      if(a===b) return true;
      var fa=__fold(a), fb=__fold(b);
      if(fa===fb) return true;
      if(__examNormTight(a)===__examNormTight(b)) return true;
      if(Math.min(fa.length,fb.length)>=6 && __diceRaw(__examNormTight(fa),__examNormTight(fb))>=0.92) return true;
      return false;
    }
    function __examNormTight(s){ return String(s==null?'':s).replace(/\s+/g,'').toLowerCase(); }
    function __examIsPicked(el){
      try{
        var cls=String(el.className||'');
        var aria=String(el.getAttribute('aria-checked')||'').toLowerCase();
        var sel=String(el.getAttribute('data-selected')||'').toLowerCase();
        if(/selected|active|checked|picked|choose|chosen/i.test(cls)) return true;
        if(aria==='1'||aria==='true'||sel==='1'||sel==='true') return true;
        if(el.getAttribute('data-state')==='1' && el.getAttribute('data-value')===null) return true;
      }catch(e){}
      return false;
    }

    // kiểm tra lại DOM sau khi chọn (mong đợi vs thực tế)
    function __examKiemTra(it, hold){
      var z=hold.querySelector('.quiz-content')||hold;
      if(it.kind==='TL'){
        var els=[].slice.call(z.querySelectorAll('input[type="text"],input[type="number"],textarea,[contenteditable="true"]'))
          .filter(function(e){ return !e.disabled; });
        var got=els.map(function(e){ return __examNorm(e.isContentEditable? e.textContent : e.value); });
        var want=[];
        var alts=(it.acceptRaw&&it.acceptRaw.length)? it.acceptRaw : it.accepts;
        alts.forEach(function(s){ want.push(String(s).split('||').map(__examNorm)); });
        /* [v8.3] chấp nhận khác dấu / khác khoảng trắng khi kiểm tra lại */
        var okTl=(want.length===got.length) && want.every(function(al,i){
          if(!got[i]) return false;
          return al.some(function(w){ return w===got[i] || __examSame(w, got[i]); });
        });
        return {ok:okTl, expected:want.map(function(a){ return a[0]; }).join(' | '), actual:got.join(' | '),
          msg: okTl? '' : ('điền '+got.filter(Boolean).length+'/'+want.length+' ô')};
      }
      if(it.kind==='SEL'){
        var sels=[].slice.call(z.querySelectorAll('select.select-option'));
        var got2=sels.map(function(s){ return String(s.value); });
        var okSel=(got2.length===it.selOptions.length) && got2.every(function(v){ return v==='0'; });
        return {ok:okSel,
          expected: it.selOptions.map(function(o){ return o[0]; }).join(' | '),
          actual: got2.map(function(v,i){
            var o=it.selOptions[i], n=Number(v);
            return (o && o[n]!==undefined)? o[n] : v;
          }).join(' | '),
          msg: okSel? '' : ('chọn '+got2.filter(function(v){ return v==='0'; }).length+'/'+it.selOptions.length)};
      }
      if(it.kind==='TF'){
        var wantTf=(it.tfAnswers||[]).map(function(a){ return a? '1':'0'; });
        var gotTf=[].slice.call(z.querySelectorAll('.tf-row')).map(function(r){
          var b=r.querySelector('.qselect');
          if(!b) return '?';
          var v=b.getAttribute('data-value');
          return (v==='1'||v==='0')? v : '?';
        });
        var okTf=(wantTf.length===gotTf.length) && wantTf.every(function(v,i){ return v===gotTf[i]; });
        var fmtTf=function(arr){ return arr.map(function(v,i){ return (i+1)+':'+(v==='1'?'Đ':'S'); }).join(' '); };
        return {ok:okTf, expected:fmtTf(wantTf), actual:fmtTf(gotTf), msg: okTf? '' : 'trạng thái Đ/S chưa khớp'};
      }
      if(it.kind==='GROUP'){
        var parts2=__examParts(z, it);
        var q4=(__W.__qlib||{})[it.id];
        var order2=(q4 && q4.quizl_order && q4.quizl_order.length)? q4.quizl_order : it.groups.map(function(_,i){ return i; });
        var wantG=order2.map(function(orig){ return it.groups[orig]? it.groups[orig].correctIndex : -999; });
        var gotG=parts2.map(function(part){
          for(var i=0;i<part.length;i++){ if(__examIsPicked(part[i])) return Number(part[i].getAttribute('data-ind')); }
          return -999;
        });
        var okG=(wantG.length===gotG.length) && wantG.every(function(v,i){ return v===gotG[i]; });
        var fmtG=function(v){ return v===-999? '?' : (v>=0? String.fromCharCode(65+v) : '?'); };
        return {ok:okG, expected:wantG.map(fmtG).join(' '), actual:gotG.map(fmtG).join(' '),
          msg: okG? '' : ('đúng '+wantG.filter(function(v,i){ return v===gotG[i]; }).length+'/'+wantG.length)};
      }
      var qs2=[].slice.call(z.querySelectorAll('.qselect'));
      var wantN=(it.correctIndex||[]).slice().sort(function(a,b){ return a-b; });
      var gotN=qs2.filter(__examIsPicked).map(function(e){ return Number(e.getAttribute('data-ind')); })
        .sort(function(a,b){ return a-b; });
      var okN=(wantN.length===gotN.length) && wantN.every(function(v,i){ return v===gotN[i]; });
      var fmtN=function(v){ return v>=0? String.fromCharCode(65+v) : '?'; };
      return {ok:okN, expected:wantN.map(fmtN).join(', '), actual:gotN.map(fmtN).join(', '),
        msg: okN? '' : ('chọn '+gotN.length+'/'+wantN.length)};
    }

    // chạy toàn bộ đề danh sách: bấm từng nút #question-list .item-q -> chọn -> kiểm tra
    async function __examAuto(){
      __hookQlib();
      var items=__examItems||await __examLoadItems();
      if(!items || !items.length) return false;
      var btns=__deepAll('#question-list .item-q');
      var n=Math.max(btns.length, items.length);
      appendStatus('📋 DẠNG 1b: '+items.length+' câu · '+btns.length+' nút điều hướng.');
      var done={}, bad=[];
      /* [v8.3] tách 1 câu thành hàm để chạy lại các câu chưa khớp (tăng độ chính xác) */
      async function doOne(i, tag){
        if(btns[i]){
          __clickRobust(btns[i]);
          await __sleep(450);
        }
        var it=items[i];
        if(!it) return false;
        var hold=__examFindHold(it);
        if(!hold){
          appendStatus('  ⚠ câu '+(i+1)+': chưa render'+(tag||''));
          return false;
        }
        var r=null;
        try{ r=__examChonCau(it, hold); }catch(e){ r={ok:false,msg:('lỗi '+e.message)}; }
        await __sleep(80);
        var v=null;
        try{ v=__examKiemTra(it, hold); }catch(e){ v={ok:false, expected:'', actual:'', msg:('lỗi '+e.message)}; }
        if(v && v.ok){
          appendStatus('  ✓ câu '+(i+1)+' ['+it.kind+'] → '+((r&&r.count)||0)+' đáp án'+(tag||''));
          return true;
        }
        appendStatus('  ⚠ câu '+(i+1)+' ['+it.kind+'] '+(v?v.msg:'')+' (mong đợi '+(v?v.expected:'')+' / thực tế '+(v?v.actual:'')+')'+(tag||''));
        return false;
      }
      for(var i=0;i<n;i++){ if(await doOne(i, '')) done[i]=1; else bad.push(i); }
      /* làm lại tối đa 2 lượt những câu chưa khớp DOM */
      for(var round=0; round<2 && bad.length; round++){
        var list=bad.slice(); bad=[];
        appendStatus('🔁 Lượt '+(round+2)+': làm lại '+list.length+' câu chưa khớp…');
        for(var k=0;k<list.length;k++){
          if(await doOne(list[k], ' (lượt '+(round+2)+')')) done[list[k]]=1; else bad.push(list[k]);
        }
      }
      var okN=Object.keys(done).length;
      appendStatus('✅ DẠNG 1b xong: '+okN+'/'+n+' câu khớp DOM.'+
        (bad.length? (' Chưa khớp: '+bad.map(function(x){ return x+1; }).join(', ')) : ''));
      return okN>0;
    }

    async function __diagnostic(){
      var info={url:location.href, globals:__dumpGlobals(), data_exam:null, data_practice:null};
      // [SỬA LỖI] báo rõ tìm được ID ở đâu (data_practice / payload XHR / deep scan ...)
      try{
        var found=__findQuizIds(true);
        info.ids_source=found.src||'(khong tim thay)';
        info.ids_collected=found.ids||[];
        info.ids_count=(found.ids||[]).length;
        if(found.cands) info.ids_candidates=found.cands.map(function(c){ return {path:c.path, n:c.ids.length, score:+c.s.toFixed(2)}; });
      }catch(e){ info.ids_source='err:'+e.message; }
      // payload JSON bắt được từ fetch/XHR của trang
      try{
        var cap=[]; try{ cap=__W.__THT_CAPTURED__||[]; }catch(e){}
        try{ if(!cap.length) cap=window.__THT_CAPTURED__||[]; }catch(e){}
        info.captured_payloads=cap.length;
        info.captured_keys=cap.map(function(o){ return (o&&typeof o==='object')?Object.keys(o).slice(0,8).join(','):typeof o; }).slice(0,10);
      }catch(e){}
      try{ info.ids_collected_legacy=__collectIds(); }catch(e){}
      try{ info.data_exam=JSON.parse(JSON.stringify(__W.data_exam||{}, function(k,v){ return (typeof v==='number'||typeof v==='string'||typeof v==='boolean'||Array.isArray(v))?v:(v&&typeof v==='object'&&Object.keys(v).length<50)?v:undefined; })); }catch(e){ info.data_exam='err:'+e.message; }
      try{ info.data_practice=window.data_practice; }catch(e){}
      try{
        var opt=[...document.querySelectorAll('*')].filter(function(el){return __visible(el)&&/^[A-D][\.\)]\s*\S/.test((el.textContent||'').trim())&&(el.textContent||'').trim().length<80;}).slice(0,3).map(function(el){return el.className||'(no class)';});
        var next=[...document.querySelectorAll('button,a,span,div,[role=button]')].filter(function(el){return __visible(el)&&/Câu\s*sau|Tiếp\s*theo|Next/i.test((el.textContent||'').trim());}).slice(0,2).map(function(el){return (el.tagName+'.'+(el.className||'')).slice(0,80);});
        info.domOptions=opt; info.domNext=next; info.domTabs=__findTabPills().map(function(p){return (p.textContent||'').trim();});
      }catch(e){ info.domErr=e.message; }

      // [BỔ SUNG] thử gọi API thật để biết chính xác lỗi gì (HTTP mấy, body ra sao)
      var dp=window.data_practice||{};
      var ap=__apiParams(dp);
      var ids=(Array.isArray(dp.list_id_quiz)&&dp.list_id_quiz.length)?dp.list_id_quiz:((info.ids_collected&&info.ids_collected.length)?info.ids_collected:__collectIds().map(String));
      info.apiParams={subject:dp.id_subject||ap.id_subject, skill:dp.id_category||ap.id_category, cv:dp.cv_q||ap.cv_q, soCau:ids.length};
      try{
        var de=__W.data_exam||{};
        info.skillMap=(de.list_main_skill||null);
        info.type_exam=de.type_exam;
      }catch(e){}
      info.apiProbe=[];
      if(ids.length){
        var meta=document.querySelector('meta[name="csrf-token"]');
        var token=meta?(meta.getAttribute('content')||''):'';
        var probeIds=ids.slice(0,2);
        var isExam=/\/exam|de-thi|de_thi|kiem-tra/i.test(location.pathname+location.search);
        var eps=isExam? ['/exam/question/get-question-of-ids','/course/question/get-question-of-ids'] : ['/course/question/get-question-of-ids','/exam/question/get-question-of-ids'];
        var probeSkill=dp.id_category||ap.id_category;
        try{
          var sm=de.list_main_skill||{};
          var s0=sm[ids[0]]||sm[String(ids[0])];
          if(s0 && s0.length) probeSkill=String(s0[0]);
        }catch(e){}
        info.apiParams.probeSkill=probeSkill;
        appendStatus('🔎 Dang thu API ('+eps.length+' endpoint)...');
        for(var ei=0; ei<eps.length; ei++){
          var r=await __postQuizIds(probeIds, dp.id_subject||ap.id_subject, probeSkill, dp.cv_q||ap.cv_q, eps[ei], token);
          info.apiProbe.push({endpoint:eps[ei], status:r.status, kind:(Array.isArray(r.data)? 'array('+r.data.length+')' : (r.data==null? 'khong-JSON' : typeof r.data)), body:r.data==null? String(r.text||'').slice(0,400) : JSON.stringify(r.data).slice(0,200)});
        }
      }
      var txt=JSON.stringify(info,null,1);
      var copied=false;
      try{ await navigator.clipboard.writeText(txt); copied=true; }catch(e){}
      if(!copied){ try{ window.copy(txt); copied=true; }catch(e){} }
      appendStatus(copied? '📋 Đã copy diagnostic (có apiProbe). Paste cho mình nhé.' : 'Chẩn đoán: '+txt.slice(0,900));
    }

    /* ===== Chạy chính (button) ===== */
    var running=false;
    document.getElementById('tht-btn').addEventListener('click', async function(){
      if(running) return;
      running=true;
      var btn=document.getElementById('tht-btn'); btn.style.opacity='.6'; btn.style.cursor='not-allowed'; btn.textContent='Dang chay...';
      try{
        /* [v7.7] BƯỚC 0: QUÉT TRANG -> BIết LÀ DẠNG NÀO */
        var mode=await __scanMode();
        if(mode==='lesson'){
          /* DẠNG 2a: bài học tương tác / video (web-component + shadow DOM) */
          __videoLessonRun();
          // [FIX] bài tập hiện sẵn (hiện cả loạt trên trang) -> làm luôn bằng luồng dạng 1,
          // KHÔNG chuyển trang / KHÔNG bấm nộp để khỏi phá nhịp video.
          var statics=__lightQWidgets();
          if(statics.length){
            appendStatus('📝 Bài tập hiện sẵn: '+statics.length+' widget — làm luôn.');
            var okS=await __prep();
            if(okS){
              var ansS=await __runTool();
              if(ansS && ansS.length){
                __printAnswers(ansS);
                __answeredEls.clear();
                for(var sk=0; sk<80; sk++){
                  var rr=await answerCurrentOnce();
                  if(!rr || !rr.ok) break;
                  __markAns(rr);
                  await __sleep(120);
                }
                appendStatus('📝 Xong phần bài tập hiện sẵn.');
              }
            }
          }
          return;
        }
        if(mode==='exam-list'){
          /* DẠNG 1b: đề dạng danh sách câu — chọn + kiểm tra lại DOM từng câu */
          appendStatus('📋 DẠNG 1b — đề dạng danh sách câu (#question-list).');
          var okE=false;
          try{ okE=await __examAuto(); }catch(e){ appendStatus('⚠ LỖI dạng 1b: '+(e&&e.message?e.message:e)); }
          if(okE) return;
          appendStatus('↻ DẠNG 1b không khớp — chuyển sang luồng dạng 1 cũ.');
          mode='quiz';
        }
        appendStatus(mode==='video'
          ? '🎬 DẠNG 2b — video thường (câu hỏi đè lên video).'
          : '📝 DẠNG 1 — trắc nghiệm / điền / đúng-sai / kéo thả.');
        var ok=await __prep();
        if(ok){
          var answers=await __runTool();
          if(answers&&answers.length){
            __printAnswers(answers);
            appendStatus('Da lay '+answers.length+' dap an — bat dau khoanh...');
            await __sleep(200);
            __answeredEls.clear();
            // [SỬA LỖI] trang nhiều tab (vd 45 câu / 13 tab "1-3","4-6",...): ưu tiên TAB.
            // Bản cũ thấy #btn-next là chạy __autoLoop01 -> chỉ trả lời 1 câu rồi báo
            // "Không chuyển được câu (nút Tiếp bị disabled?)".
            __olmTabIdx=null;
            var pillsNow=__findTabPills();
            var hasTabs=pillsNow.length>=2;
            // [SỬA LỖI] bài dạng VIDEO (không có tab / #btn-next / nút nộp) -> phải vào
            // __olmFullAuto, vì chỉ ở đó mới có vòng lặp xử lý câu hỏi overlay của video.
            var isVideo=__isVideoPage();
            var nextEl=findBtn('btn-next');
            var nextUsable=!!nextEl && isVisible(nextEl) && !nextEl.disabled && !/disabled/i.test(String(nextEl.className||'')) && nextEl.getAttribute('aria-disabled')!=='true';
            if(hasTabs){
              await __olmFullAuto(answers);
            } else if(isVideo){
              // [SỬA LỖI] bài dạng VIDEO của OLM: không có câu hỏi tĩnh, không có tab,
              // không có #btn-next -> trước đây rơi vào nhánh fallback "chỉ trả lời 1 câu"
              // (hoặc __autoLoop01 -> bấm nộp sớm) nên không làm được bài video.
              // Bắt buộc vào __olmFullAuto (nơi có vòng lặp xử lý overlay của video).
              await __olmFullAuto(answers);
            } else if(nextUsable){
              await __autoLoop01();
            } else if(__submitCandidates().length){
              // [BỔ SUNG] trang chỉ có nút nộp bài -> vào auto-loop để nộp + xác nhận
              await __autoLoop01();
            } else {
              var r1=await answerCurrentOnce();
              if(r1 && r1.ok) __markAns(r1);
            }
          } else {
            appendStatus('API rong. Bam "Chẩn đoán" roi paste.');
          }
        }
      }catch(e){ appendStatus('LOI: '+(e&&e.message?e.message:e)); }
      finally{ running=false; btn.style.opacity='1'; btn.style.cursor='pointer'; btn.textContent='Auto làm bài'; }
    });
    document.getElementById('tht-diag').addEventListener('click', async function(){ try{ await __diagnostic(); }catch(e){ appendStatus('LOI chan doan: '+(e&&e.message?e.message:e)); } });
  }

  /* ---------------- [C] KHOI DONG ---------------- */
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', __boot, {once:true});
  } else {
    __boot();
  }
})();
