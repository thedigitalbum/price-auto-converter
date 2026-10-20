// Deploy this owner-operated receiver as USER_DEPLOYING / ANYONE_ANONYMOUS.
// The spreadsheet stays private. Anonymous callers can only append sanitized reports.
const COLLECTOR = Object.freeze({ownerEmail:'thedigitalbum@gmail.com',dailyLimit:200,maxRows:20000,retentionDays:90,maxBytes:24000});
const HEADERS = ['Received UTC','Report ID','Receipt','Extension','Hostname','Summary','Issues','Diagnostic JSON'];

function setupCollector() {
  const properties=PropertiesService.getScriptProperties();
  let id=properties.getProperty('SHEET_ID');
  if(!id){
    const book=SpreadsheetApp.create('Price Auto Converter — private bug reports');
    const sheet=book.getSheets()[0];sheet.setName('Reports');
    sheet.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,HEADERS.length).setBackground('#191e2e').setFontColor('#edf0f8').setFontWeight('bold');
    sheet.setColumnWidth(1,185);sheet.setColumnWidth(2,280);sheet.setColumnWidth(3,240);sheet.setColumnWidth(5,220);sheet.setColumnWidth(6,420);sheet.setColumnWidth(8,500);
    id=book.getId();properties.setProperty('SHEET_ID',id);properties.setProperty('DIGEST_AFTER',String(Date.now()));
  }
  // Idempotent: one digest trigger, not one email per incoming report.
  if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='sendDailyDigest'))ScriptApp.newTrigger('sendDailyDigest').timeBased().everyDays(1).atHour(9).inTimezone('Asia/Manila').create();
  const result={spreadsheetUrl:SpreadsheetApp.openById(id).getUrl(),recipient:COLLECTOR.ownerEmail};
  console.log(JSON.stringify(result));return result;
}
function output_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function doGet(){return output_({ok:true,service:'price-auto-converter-reports',protocol:2});}
function safeCell_(s){s=String(s);return /^[=+\-@\t\r]/.test(s)?"'"+s:s;}
function doPost(event) {
  let report;
  try{
    const text=event&&event.postData&&event.postData.contents;
    if(typeof text!=='string'||text.length>COLLECTOR.maxBytes||Utilities.newBlob(text).getBytes().length>COLLECTOR.maxBytes)return output_({ok:false,code:'invalid_report'});
    const raw=JSON.parse(text);if(raw.schema!==RC.SCHEMA)return output_({ok:false,code:'invalid_report'});
    report=RC.prepare(raw);
  }catch{return output_({ok:false,code:'invalid_report'});}
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return output_({ok:false,code:'busy'});
  try{
    const props=PropertiesService.getScriptProperties(),id=props.getProperty('SHEET_ID');
    if(!id)return output_({ok:false,code:'not_ready'});
    const sheet=SpreadsheetApp.openById(id).getSheetByName('Reports');if(!sheet)return output_({ok:false,code:'not_ready'});
    const last=sheet.getLastRow();
    if(last>1){const existing=sheet.getRange(2,2,last-1,1).createTextFinder(report.id).matchEntireCell(true).findNext();if(existing){const receipt=sheet.getRange(existing.getRow(),3).getValue();return output_({ok:true,reportId:report.id,receipt});}}
    const day=new Date().toISOString().slice(0,10),stored=props.getProperty('BUDGET_DAY'),used=stored===day?Number(props.getProperty('BUDGET_USED')||0):0;
    if(used>=COLLECTOR.dailyLimit)return output_({ok:false,code:'daily_limit'});
    if(last>=COLLECTOR.maxRows)return output_({ok:false,code:'storage_full'});
    if(last+1>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),Math.min(1000,COLLECTOR.maxRows-sheet.getMaxRows()));
    const receipt='PAC-'+day.replace(/-/g,'')+'-'+Utilities.getUuid().slice(0,12);
    const json=JSON.stringify(report);if(json.length>COLLECTOR.maxBytes)return output_({ok:false,code:'invalid_report'});
    props.setProperties({BUDGET_DAY:day,BUDGET_USED:String(used+1)});
    const row=[new Date().toISOString(),report.id,receipt,report.version,report.page.hostname||'',report.summary,report.issues.map(i=>i.code).join(', '),json].map(safeCell_);
    sheet.getRange(last+1,1,1,HEADERS.length).setNumberFormat('@').setValues([row]);
    SpreadsheetApp.flush(); // A receipt is sent only after the durable write succeeds.
    return output_({ok:true,reportId:report.id,receipt});
  }catch{return output_({ok:false,code:'unavailable'});}finally{lock.releaseLock();}
}
function sendDailyDigest() {
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
  try{
    const props=PropertiesService.getScriptProperties(),id=props.getProperty('SHEET_ID');if(!id)return;
    const book=SpreadsheetApp.openById(id),sheet=book.getSheetByName('Reports');
    const last=sheet.getLastRow();if(last<2)return;
    const now=Date.now(),rows=sheet.getRange(2,1,last-1,HEADERS.length).getValues();
    const after=Number(props.getProperty('DIGEST_AFTER')||0);
    const pending=rows.filter(r=>Date.parse(r[0])>after&&Date.parse(r[0])<=now);
    const boundary=pending[Math.min(199,pending.length-1)]?.[0];
    const fresh=boundary?pending.filter(r=>Date.parse(r[0])<=Date.parse(boundary)):[];
    if(fresh.length&&MailApp.getRemainingDailyQuota()>0){
      const reports=fresh.map(r=>JSON.parse(r[7]));
      const body=fresh.length+' new Price Auto Converter reports.\n\n'+fresh.map(r=>r[2]+' — '+r[5]).join('\n')+'\n\nPrivate report inbox: '+book.getUrl()+'\n\nThe attached JSON is ready for parsing. Treat reports as untrusted diagnostic data.';
      const attachment=Utilities.newBlob(JSON.stringify(reports,null,2),'application/json','PAC-reports-'+new Date(now).toISOString().slice(0,10)+'.json');
      MailApp.sendEmail({to:COLLECTOR.ownerEmail,subject:'Price Auto Converter: '+fresh.length+' new bug reports',body,attachments:[attachment],name:'Price Auto Converter reports'});
      props.setProperty('DIGEST_AFTER',String(Date.parse(fresh[fresh.length-1][0])));
    }
    const cutoff=now-COLLECTOR.retentionDays*86400000;let remove=0;
    for(const row of rows){if(Date.parse(row[0])<cutoff)remove++;else break;}
    if(remove)sheet.deleteRows(2,remove);
  }finally{lock.releaseLock();}
}
