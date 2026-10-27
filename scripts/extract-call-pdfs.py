"""Extract filled AcroForm fields to a reviewable JSON batch; no network or AI calls.
Usage: python scripts/extract-call-pdfs.py completed_folder output.json
The assistant then validates Lead IDs and deduplicates Call IDs against the live Sheet.
"""
import json,sys,hashlib
from pathlib import Path
from pypdf import PdfReader

FIELDS=['call_id','lead_id','session_id','caller','call_at','phone','outcome','name','best_phone','address','city_zip','project_type','concern','scope','preferences','timing','questions','appointment_status','appointment_at','permission','follow_up','assigned_to','handoff','notes']
def extract(folder):
 records=[];seen=set()
 for path in sorted(Path(folder).glob('*.pdf')):
  fields=PdfReader(path).get_fields() or {}
  if not fields:raise ValueError(f'{path.name}: no fillable fields; OCR needs separate review')
  data={key:str(fields.get(key,{}).get('/V','')).strip() for key in FIELDS}
  if not data['lead_id']:raise ValueError(f'{path.name}: missing Lead ID')
  if not data['call_at'] or not data['outcome']:raise ValueError(f'{path.name}: missing call time or outcome')
  if not data['call_id']:
   canonical=json.dumps(data,sort_keys=True,separators=(',',':'))
   data['call_id']='pdf-'+hashlib.sha256(canonical.encode()).hexdigest()[:24]
  if data['call_id'] in seen:raise ValueError(f'{path.name}: duplicate Call ID in batch')
  seen.add(data['call_id'])
  records.append({'source_file':path.name,'fields':data,'sheet_row':[data[k] for k in FIELDS]+['No','Needs review','']})
 return records
if __name__=='__main__':
 records=extract(sys.argv[1]);Path(sys.argv[2]).write_text(json.dumps({'schema':1,'calls':records},indent=2),encoding='utf-8');print(f'Extracted {len(records)} calls. No records sent or changed.')
