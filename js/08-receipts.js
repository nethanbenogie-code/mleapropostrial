/* ============================================================
   MLEA POS v6.0 — 08-receipts.js
   Thermal + A4 receipt printing
   Part of a multi-file build. Load order matters — see index.html.
   Shares global scope with sibling modules (no import/export).
   ============================================================ */

// ════════════════════════════════════════════
// RECEIPT PRINTING
// ════════════════════════════════════════════
async function printRcpt(type){
  if(!lastSale){toast('No sale data','rose');return;}
  const sale=lastSale;const bir=getBIR();
  const sName=bir.name,addr=bir.address,tin=bir.tin;
  const accNo=bir.accNo,accDate=bir.accDate,accExp=bir.accExp,ptu=bir.ptu;
  const orLabel=bir.docType==='si'?'SALES INVOICE':'OFFICIAL RECEIPT';
  const orNum=sale.orNumber||('#'+sale.id);
  const dateStr=new Date().toLocaleString('en-PH');
  const footer=rcptFooter||'Thank you for your purchase!';
  const logo=getLogoDataURL();
  const barcodeURL=await generateBarcodeDataURL(orNum);
  const custLine=sale.customerName?`<div class="rw"><span class="b">Customer</span><span>${sale.customerName}</span></div>`:'';
  // Receipt hash + QR for tamper verification
  const hashVal=sale.receiptHash||(await generateReceiptHash(sale));
  const hashShort=hashVal?hashVal.slice(0,32)+'…':'';
  const qrContent=hashVal?buildVerifyQRContent({...sale,receiptHash:hashVal}):'';
  const qrURL=qrContent?await generateQRDataURL(qrContent):'';
  let html='';
  if(type==='thermal'){
    html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    @page{margin:0;size:80mm auto}*{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Courier New',Courier,monospace;font-size:11px;width:76mm;padding:4mm 2mm;color:#000;background:#fff}
    .c{text-align:center}.b{font-weight:bold}.lg{font-size:13px}
    .dv{border:none;border-top:1px dashed #000;margin:5px 0}
    .rw{display:flex;justify-content:space-between;margin:2px 0}
    .r3{display:flex;justify-content:space-between;margin:2px 0}
    .r3 span:first-child{flex:1}.r3 span:nth-child(2){width:30px;text-align:center}.r3 span:last-child{width:60px;text-align:right}
    img.bc{display:block;margin:4px auto;max-width:70mm;height:auto}
    </style></head><body>
    <div class="c b lg">${sName}</div>
    <div class="c">${addr}</div>
    <div class="c">TIN: ${tin}</div>
    <hr class="dv">
    <div class="c b">${orLabel}</div>
    <div class="c" style="font-size:9px">${dateStr}</div>
    <hr class="dv">
    <div class="rw"><span class="b">OR/SI No.:</span><span>${orNum}</span></div>
    <div class="rw"><span class="b">Branch</span><span>${sale.branchName||'Main'}</span></div>
    <div class="rw"><span class="b">Cashier</span><span>${sale.cashierName}</span></div>
    ${custLine}
    <div class="rw"><span class="b">Payment</span><span>${sale.paymentMethod.toUpperCase()}</span></div>
    <hr class="dv">
    <div class="r3"><span class="b">ITEM</span><span class="b">QTY</span><span class="b">AMT</span></div>
    <hr class="dv">
    ${(sale.items||[]).map(it=>`
      <div class="r3"><span>${it.name.substring(0,14)}</span><span>${it.quantity}</span><span>${fc(it.price*it.quantity)}</span></div>
      <div style="font-size:9px;color:#555;padding-left:2px">@ ${fc(it.price)} / ${it.unit||'pcs'}${it.vatExempt?' *VE':''}</div>`).join('')}
    <hr class="dv">
    ${(sale.discountAmount||0)>0?`
      <div class="rw"><span>Subtotal</span><span>${fc(sale.subtotalBeforeDiscount||sale.subtotal)}</span></div>
      <div class="rw"><span>${sale.discountType==='sc'?'SC Disc':sale.discountType==='pwd'?'PWD Disc':'Promo Disc'}</span><span>-${fc(sale.discountAmount)}</span></div>`:''}
    ${sale.vatType==='vat'?`
      <div class="rw"><span>VATable Sales</span><span>${fc(sale.vatableSales||0)}</span></div>
      <div class="rw"><span>VAT Amount (12%)</span><span>${fc(sale.tax||0)}</span></div>
      <div class="rw"><span>VAT-Exempt Sales</span><span>0.00</span></div>
      <div class="rw"><span>Zero-Rated Sales</span><span>0.00</span></div>`:
      `<div class="rw"><span>VAT-Exempt Sales</span><span>${fc(sale.subtotal||0)}</span></div>`}
    <hr class="dv">
    <div class="rw b lg"><span>TOTAL</span><span>${fc(sale.total)}</span></div>
    ${(sale.paymentMethod==='cash'||sale.paymentMethod==='split')?`
      <hr class="dv">
      <div class="rw"><span>Cash Tendered</span><span>${fc(sale.cashTendered||0)}</span></div>
      ${(sale.splitCard||0)>0?`<div class="rw"><span>Card</span><span>${fc(sale.splitCard)}</span></div>`:''}
      <div class="rw b"><span>CHANGE</span><span>${fc(sale.changeGiven||0)}</span></div>`:''}
    <hr class="dv">
    <div class="c" style="font-size:9px;margin-top:4px">${footer}</div>
    ${sale.vatType!=='vat'?'<div class="c" style="font-size:8px;margin-top:3px">NOT valid for claiming input taxes.</div>':''}
    ${barcodeURL?`<img class="bc" src="${barcodeURL}" alt="${orNum}">`:`<div class="c" style="letter-spacing:3px;font-size:9px;margin:4px 0">||| ${orNum} |||</div>`}
    ${qrURL?`<div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0"><img src="${qrURL}" style="width:52px;height:52px"><div style="flex:1;padding-left:6px;font-size:7px;color:#555;line-height:1.5">Verify receipt integrity:<br>Scan QR or check hash<br><span style="word-break:break-all">${hashShort}</span></div></div>`:''}
    <div class="c" style="font-size:8px;margin-top:4px;line-height:1.6">
      BIR Accred. No.: ${accNo}<br>
      Issued: ${accDate} | Expiry: ${accExp}<br>
      PTU No.: ${ptu}<br>MLEA POS v6.0
    </div>
    <div style="height:12mm"></div>
    </body></html>`;
  }else if(type==='a4'){
    const rows=(sale.items||[]).map((it,i)=>`
      <tr style="background:${i%2===0?'#f9f9f9':'#fff'}">
        <td style="padding:10px 14px">${i+1}</td>
        <td style="padding:10px 14px">${it.name}${it.vatExempt?' <em style="font-size:.8em;color:#888">[VAT-Exempt]</em>':''}${it.zeroRated?' <em style="font-size:.8em;color:#888">[Zero-Rated]</em>':''}</td>
        <td style="padding:10px 14px;text-align:center">${it.quantity} ${it.unit||'pcs'}</td>
        <td style="padding:10px 14px;text-align:right">${fc(it.price)}</td>
        <td style="padding:10px 14px;text-align:right;font-weight:600">${fc(it.price*it.quantity)}</td>
      </tr>`).join('');
    html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    @page{margin:15mm 12mm;size:A4}*{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#222;background:#fff}
    .hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #222}
    .sn{font-size:22px;font-weight:800;letter-spacing:-.5px}
    .su{font-size:11px;color:#666;margin-top:3px}
    .rl{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#999}
    .rn{font-size:24px;font-weight:800}
    .stamp{display:inline-block;border:3px solid #2dd4a0;color:#2dd4a0;padding:5px 16px;border-radius:6px;font-size:20px;font-weight:900;letter-spacing:4px;transform:rotate(-8deg);margin-top:6px}
    .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;padding:14px;background:#f5f5f5;border-radius:8px}
    .meta label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#999;display:block;margin-bottom:3px}
    .meta span{font-size:12px;font-weight:600}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    thead tr{background:#222;color:#fff}
    thead th{padding:10px 12px;text-align:left;font-size:10px;letter-spacing:.5px;text-transform:uppercase}
    tbody tr:last-child td{border-bottom:2px solid #222}
    .tots{margin-left:auto;width:300px}
    .tr{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:12px}
    .tr.grand{font-size:16px;font-weight:800;border-bottom:2px solid #222;padding-top:10px}
    .tr.chg{font-size:15px;font-weight:800;color:#2dd4a0;border-bottom:2px solid #2dd4a0}
    .tr.disc{color:#e74c3c}
    .bir-box{background:#fffbf0;border:1px solid #e8c96a;border-radius:6px;padding:12px 16px;margin-top:14px;font-size:10px;line-height:1.8;color:#555}
    .bir-box strong{color:#333;display:block;margin-bottom:4px;font-size:11px}
    .ftr{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:10px;color:#999}
    .nvn{font-size:9px;color:#666;text-align:center;margin-top:8px;padding:6px;border:1px dashed #ccc;border-radius:4px}
    .logo-img{height:56px;max-width:180px;object-fit:contain;margin-bottom:6px;display:block}
    .bc-img{height:28px;margin-top:6px;display:block}
    </style></head><body>
    <div class="hd">
      <div>
        ${logo?`<img class="logo-img" src="${logo}" alt="${sName}">`:''}
        <div class="sn">${sName}</div>
        <div class="su">${addr}</div>
        <div class="su">TIN: ${tin}</div>
        <div class="su">${dateStr}</div>
      </div>
      <div style="text-align:right">
        <div class="rl">${orLabel}</div>
        <div class="rn">${orNum}</div>
        ${barcodeURL?`<img class="bc-img" src="${barcodeURL}" alt="${orNum}">`:''}
        <div class="stamp">PAID</div>
      </div>
    </div>
    <div class="meta">
      <div><label>Cashier</label><span>${sale.cashierName}</span></div>
      <div><label>Payment</label><span>${sale.paymentMethod.toUpperCase()}</span></div>
      <div><label>${sale.customerName?'Customer':'Branch'}</label><span>${sale.customerName||sale.branchName||'HQ'}</span></div>
    </div>
    <table>
      <thead><tr>
        <th>#</th><th>Item</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Price</th>
        <th style="text-align:right">Amount</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="tots">
      ${(sale.discountAmount||0)>0?`
        <div class="tr"><span>Subtotal</span><span>${fc(sale.subtotalBeforeDiscount||sale.subtotal)}</span></div>
        <div class="tr disc"><span>${sale.discountType==='sc'?'Senior Citizen Discount':sale.discountType==='pwd'?'PWD Discount':'Promotional Discount'}</span><span>-${fc(sale.discountAmount)}</span></div>`:''}
      ${sale.vatType==='vat'?`
        <div class="tr"><span>VATable Sales</span><span>${fc(sale.vatableSales||0)}</span></div>
        <div class="tr"><span>VAT Amount (12%)</span><span>${fc(sale.tax||0)}</span></div>
        <div class="tr"><span>VAT-Exempt Sales</span><span>${fc(sale.vatExemptSales||0)}</span></div>
        <div class="tr"><span>Zero-Rated Sales</span><span>${fc(sale.zeroRatedSales||0)}</span></div>`:
        `<div class="tr"><span>Amount (Non-VAT)</span><span>${fc(sale.subtotal||0)}</span></div>`}
      <div class="tr grand"><span>TOTAL AMOUNT DUE</span><span>${fc(sale.total)}</span></div>
      ${(sale.paymentMethod==='cash'||sale.paymentMethod==='split')?`
        <div class="tr" style="margin-top:6px"><span>Cash Tendered</span><span style="color:#d4a853">${fc(sale.cashTendered||0)}</span></div>
        ${(sale.splitCard||0)>0?`<div class="tr"><span>Card</span><span style="color:#6fa3ef">${fc(sale.splitCard)}</span></div>`:''}
        <div class="tr chg"><span>CHANGE</span><span>${fc(sale.changeGiven||0)}</span></div>`:''}
    </div>
    ${sale.vatType!=='vat'?'<div class="nvn">This document is NOT valid for claiming input taxes.</div>':''}
    <div class="bir-box">
      <strong>BIR Accreditation Details</strong>
      Accreditation No.: ${accNo} &nbsp;|&nbsp; Date Issued: ${accDate} &nbsp;|&nbsp; Valid Until: ${accExp}<br>
      PTU (Permit to Use) No.: ${ptu}<br>
      Series: ${bir.prefix}-${bir.serFrom} to ${bir.prefix}-${bir.serTo}
    </div>
    ${hashVal?`<div style="margin-top:12px;padding:10px 14px;background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;display:flex;align-items:center;gap:14px">
      ${qrURL?`<img src="${qrURL}" style="width:72px;height:72px;flex-shrink:0">`:''}
      <div style="font-size:9px;color:#666;line-height:1.8;word-break:break-all">
        <strong style="color:#333;font-size:10px">Receipt Integrity Verification</strong><br>
        This receipt contains a SHA-256 cryptographic hash.<br>
        Hash: <span style="font-family:monospace;font-size:8px">${hashShort}</span><br>
        Scan QR to verify this receipt has not been altered.
      </div>
    </div>`:''}
    <div class="ftr">
      <div>${footer}</div>
      <div style="text-align:right">MLEA POS v6.0 (BIR-Ready)<br>${orNum} · ${dateStr}</div>
    </div>
    </body></html>`;
  }
  const frame=document.getElementById('printFrame');
  const doc=frame.contentDocument||frame.contentWindow.document;
  doc.open();doc.write(html);doc.close();
  setTimeout(()=>{frame.contentWindow.focus();frame.contentWindow.print();},400);
}

function reprintSale(id){
  const sale=DB.getById('sales',id);if(!sale){toast('Not found','rose');return;}lastSale=sale;
  openModal(`<h4 style="margin-bottom:16px">🖨 Reprint ${sale.orNumber||'#'+id}</h4>
    <div class="print-grid">
      <button class="print-btn" onclick="printRcpt('thermal');closeModal()"><span class="pico">🧾</span>Thermal</button>
      <button class="print-btn" onclick="printRcpt('a4');closeModal()"><span class="pico">📄</span>A4</button>
      <button class="print-btn" onclick="closeModal()" style="border-color:rgba(240,101,119,.25);color:var(--rose)"><span class="pico">✕</span>Cancel</button>
    </div>
    <button class="btn bd bbl" onclick="closeModal()" style="margin-top:4px">Close</button>`);
}

