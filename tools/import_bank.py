"""Build data/bank.json from Sheet read_range exports (files given as args; later files override earlier ones per tab)."""
import json,csv,io,sys,re,hashlib
out_path=sys.argv[1]; files=sys.argv[2:]
sets={}
for f in files:
    t=open(f).read(); t=t[t.index('{'):t.rindex('}')+1]
    d=json.loads(t,strict=False)
    for r in d['ranges']:
        n=int(r['sheet'].split()[-1])
        rows=list(csv.reader(io.StringIO(r['content'])))
        out=[]
        for row in rows[1:]:
            row=row+['']*(6-len(row))
            qid,en,typ,q,a,h=row[:6]
            if not qid.strip() or en.strip().upper()!='TRUE': continue
            out.append({'id':qid.strip(),'type':typ.strip() or 'mixed','prompt':q.replace('\r','').strip(),'answer':a.strip().replace('\u2212','-'),'hint':h.strip()})
        sets[str(n)]=out
ok=True
for k in sorted(sets,key=int):
    ids=[q['id'] for q in sets[k]]
    bad=[q for q in sets[k] if not re.fullmatch(r'-?\d+(\.\d+)?|-?\d+/\d+|-?\d+ ?r ?\d+',q['answer'])]
    print('Set',k,len(sets[k]),'DUP' if len(ids)!=len(set(ids)) else '', 'BAD',bad[:3] if bad else '')
    if bad or len(ids)!=len(set(ids)): ok=False
assert sorted(map(int,sets))==list(range(1,21)), sorted(sets)
v=hashlib.sha1(json.dumps(sets,sort_keys=True).encode()).hexdigest()[:12]
bank={'version':'2026-11-11-'+v,'sets':sets}
if ok: json.dump(bank,open(out_path,'w'),ensure_ascii=False); print('wrote',bank['version'])
else: sys.exit(1)
