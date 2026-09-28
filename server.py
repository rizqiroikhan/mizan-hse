"""Mizan HSE MVP: dependency-free web server, SQLite storage and role-aware API."""
import argparse
import copy
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import threading
import uuid
from datetime import datetime, timedelta, timezone
from http import cookies
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / 'public'
LOCK = threading.RLock()
ROLES = ['staff', 'manager', 'supervisor', 'management']
ROLE_LABELS = {
    'staff': 'HSE Staff',
    # These internal IDs are retained for compatibility with existing data.
    # `manager` is the corrective-action operator; `supervisor` is the verifier.
    'manager': 'HSE Supervisor',
    'supervisor': 'HSE Manager',
    'management': 'Management',
}
CORRECTIVE_ACTION_ROLE = 'manager'
VERIFICATION_ROLE = 'supervisor'
SITES = [
    {'id': 'dukuh', 'name': 'JPM Dukuh Atas', 'city': 'Jakarta', 'code': 'JPM'},
    {'id': 'sentral', 'name': 'Sentral Office', 'city': 'Jakarta', 'code': 'SNT'},
    {'id': 'depot', 'name': 'East Operations Depot', 'city': 'Bekasi', 'code': 'EOD'},
]
P3K = [('Kasa steril terbungkus', 20), ('Perban 5 cm', 2), ('Perban 10 cm', 2), ('Plester 1,25 cm', 2), ('Plester cepat', 10), ('Kapas 25 gram', 1), ('Kain segitiga / mittela', 2), ('Gunting', 1), ('Peniti', 12), ('Sarung tangan sekali pakai', 2), ('Masker', 2), ('Pinset', 1), ('Lampu senter', 1), ('Gelas untuk cuci mata', 1), ('Kantong plastik bersih', 1), ('NaCl', 1), ('Povidone', 1), ('Alkohol 70%', 1), ('Buku panduan P3K', 1), ('Buku catatan', 1), ('Daftar isi kotak', 1)]

def item(key, label, **kwargs):
    return dict(id=key, label=label, **kwargs)

TEMPLATES = {
    'APAR': {'version': 1, 'name': 'APAR inspection', 'description': 'Monthly visual inspection · technical servicing is separate', 'items': [
        item('presence', 'Present at the registered location'), item('access', 'Accessible and unobstructed'),
        item('sign', 'Equipment ID and location sign visible'), item('label', 'Operating instructions readable and facing outward'),
        item('cylinder', 'Cylinder free from visible damage, corrosion and leakage'), item('handle', 'Handle and lever visibly undamaged'),
        item('seal', 'Safety pin and tamper seal intact'), item('hose', 'Hose / nozzle / horn intact and unobstructed'),
        item('gauge', 'Pressure within manufacturer operating range', conditional='gauge'),
        item('mount', 'Bracket or cabinet secure and accessible'), item('service', 'Required service and testing up to date'),
        item('weight', 'CO₂ weight meets equipment-specific criteria', conditional='co2'),
    ]},
    'Hydrant': {'version': 1, 'name': 'Hydrant inspection', 'description': 'Monthly condition check · 6 components', 'items': [
        item('box', 'Box hydrant'), item('hose', 'Fire hose'), item('coupling', 'Hose coupling'),
        item('rack', 'Hose rack'), item('nozzle', 'Nozzle'), item('valve', 'Valve / pillar hydrant'),
    ]},
    'P3K': {'version': 1, 'name': 'P3K inventory check', 'description': 'Monthly inventory · 21 supplies', 'items': [
        item('p3k_'+str(i+1), label, required=qty, expiry=i in (0, 15, 16, 17)) for i, (label, qty) in enumerate(P3K)
    ]},
    'Patrol': {'version': 1, 'name': 'Safety patrol', 'description': 'Proposed baseline checklist · plus free-form observations', 'items': [
        item('access', 'Emergency equipment accessible'), item('exits', 'Escape routes and exits clear'),
        item('housekeeping', 'Housekeeping / 5R satisfactory'), item('electrical', 'No visible unsafe cables or electrical conditions'),
        item('waste', 'Waste stored in the designated area'), item('signage', 'Safety signs visible and legible'),
    ]},
}

def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')

def today():
    return datetime.now().date().isoformat()

def password_hash(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 120000).hex()

class Problem(Exception):
    def __init__(self, message, status=400):
        self.message, self.status = message, status

class Store:
    def __init__(self, path):
        self.path = str(path)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript('''CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, role TEXT, salt TEXT, hash TEXT);
              CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT, expires TEXT);
              CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT);
              CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, user_id TEXT, result TEXT);''')
            for role in ROLES:
                if not db.execute('SELECT 1 FROM users WHERE id=?', (role,)).fetchone():
                    salt = secrets.token_hex(16)
                    db.execute('INSERT INTO users VALUES (?,?,?,?,?)', (role, ROLE_LABELS[role], role, salt, password_hash(os.environ.get('MIZAN_DEMO_PASSWORD', 'MizanDemo2026!'), salt)))
            # Role IDs are stable storage identifiers. Normalize their display names
            # for existing databases without rewriting immutable activity history.
            for role, name in ROLE_LABELS.items():
                db.execute('UPDATE users SET name=? WHERE id=? AND role=?', (name, role, role))
            if not db.execute('SELECT 1 FROM state').fetchone():
                db.execute('INSERT INTO state VALUES (1,?)', (json.dumps(self.seed()),))
            else:
                state = json.loads(db.execute('SELECT data FROM state WHERE id=1').fetchone()[0])
                changed = False
                for finding in state.get('findings', []):
                    if finding.get('owner') == 'HSE Manager':
                        finding['owner'] = ROLE_LABELS[CORRECTIVE_ACTION_ROLE]
                        changed = True
                if changed:
                    db.execute('UPDATE state SET data=? WHERE id=1', (json.dumps(state),))

    def connect(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        return db

    def seed(self):
        state = {'sites': SITES, 'templates': TEMPLATES, 'assets': [], 'inspections': [], 'findings': [], 'flags': [], 'activity': [], 'revision': 1, 'demo': True}
        day = datetime.now().date()
        for site_index, site in enumerate(SITES):
            for kind, count in [('APAR', 6), ('Hydrant', 3), ('P3K', 2)]:
                for n in range(1, count+1):
                    aid = f"{site['code']}-{kind.upper()}-{n:02}"
                    asset = {'id': aid, 'siteId': site['id'], 'type': kind, 'zone': f'Zone {(n-1)%3+1}', 'name': f'{kind} {n:02}', 'subtype': 'CO2' if kind == 'APAR' and n == 6 else 'Dry chemical' if kind == 'APAR' else '', 'capacity': '5 kg' if kind == 'APAR' else '', 'serial': f'DEMO-{site_index+1}{n:03}', 'serviceDue': (day+timedelta(days=22+n*12)).isoformat() if kind == 'APAR' else '', 'expiryDate': '', 'dueDate': (day+timedelta(days=4)).isoformat(), 'revision': 1}
                    state['assets'].append(asset)
                    # Representative fictional data, not imported inspection results.
                    if n <= (4 if kind == 'APAR' else 2):
                        date = (day-timedelta(days=1+site_index+n)).isoformat()
                        answers = []
                        for idx, q in enumerate(TEMPLATES[kind]['items']):
                            status = 'na' if q.get('conditional') == 'co2' else 'pass'
                            if idx == 1 and n == 2:
                                status = 'fail'
                            answers.append({'id': q['id'], 'status': status, 'note': 'Illustrative finding; sample evidence only.' if status == 'fail' else 'Not fitted on this equipment type' if status == 'na' else '', 'quantity': q.get('required'), 'expiry': ''})
                        iid = 'demo-'+aid
                        inspection = {'id': iid, 'siteId': site['id'], 'assetId': aid, 'type': kind, 'zone': asset['zone'], 'period': day.strftime('%Y-%m'), 'date': date, 'status': 'approved', 'answers': answers, 'photos': [], 'observations': [], 'inspector': 'Demo inspector', 'createdBy': 'staff', 'createdAt': date+'T09:00:00+00:00', 'updatedAt': now(), 'revision': 1, 'templateVersion': 1, 'sample': True}
                        state['inspections'].append(inspection)
                        if n == 2:
                            title = {'APAR': 'Access to extinguisher obstructed', 'Hydrant': 'Fire hose needs replacement', 'P3K': 'First aid supplies below required quantity'}[kind]
                            state['findings'].append({'id': 'f-'+aid, 'inspectionId': iid, 'assetId': aid, 'siteId': site['id'], 'title': title, 'detail': 'Demonstration finding. Inspect the actual equipment before use.', 'severity': 'high' if kind == 'Hydrant' else 'medium', 'status': 'awaiting_verification' if site_index == 0 and kind == 'P3K' else 'in_progress' if kind == 'APAR' else 'open', 'dueDate': (day+timedelta(days=-2 if kind == 'Hydrant' else 3)).isoformat(), 'owner': ROLE_LABELS[CORRECTIVE_ACTION_ROLE], 'photos': [], 'completion': 'Supplies replenished (demonstration).' if site_index == 0 and kind == 'P3K' else '', 'evidence': [], 'history': [], 'revision': 1, 'createdAt': date, 'sample': True})
        state['activity'] = [{'id': 'welcome', 'text': 'Demo workspace created with fictional inspection results', 'actor': 'System', 'at': now()}]
        return state

    def login(self, user_id, password):
        with self.connect() as db:
            row = db.execute('SELECT * FROM users WHERE id=?', (user_id,)).fetchone()
            if not row or not hmac.compare_digest(row['hash'], password_hash(password, row['salt'])):
                raise Problem('Incorrect account or password.', 401)
            token = secrets.token_urlsafe(32)
            db.execute('INSERT INTO sessions VALUES (?,?,?)', (token, user_id, (datetime.now(timezone.utc)+timedelta(days=7)).isoformat()))
            return token, {'id': row['id'], 'name': row['name'], 'role': row['role']}

    def user(self, token):
        with self.connect() as db:
            row = db.execute('SELECT u.id,u.name,u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE token=? AND expires>?', (token, now())).fetchone()
            if not row:
                raise Problem('Please sign in online to continue synchronizing.', 401)
            return dict(row)

    def state(self):
        with self.connect() as db:
            state = json.loads(db.execute('SELECT data FROM state WHERE id=1').fetchone()[0])
            state['serverTime'] = now()
            return state

    def apply(self, user, op):
        if not isinstance(op, dict) or not isinstance(op.get('id'), str) or not 8 <= len(op['id']) <= 100:
            raise Problem('A unique operation ID is required.')
        with LOCK, self.connect() as db:
            prior = db.execute('SELECT * FROM operations WHERE id=?', (op['id'],)).fetchone()
            if prior:
                if prior['user_id'] != user['id']:
                    raise Problem('Operation belongs to another account.', 403)
                return json.loads(prior['result'])
            state = json.loads(db.execute('SELECT data FROM state WHERE id=1').fetchone()[0])
            result = self.mutate(state, user, op)
            state['revision'] += 1
            state['activity'].insert(0, {'id': str(uuid.uuid4()), 'text': result['message'], 'actor': user['name'], 'at': now()})
            state['activity'] = state['activity'][:100]
            db.execute('UPDATE state SET data=? WHERE id=1', (json.dumps(state),))
            db.execute('INSERT INTO operations VALUES (?,?,?)', (op['id'], user['id'], json.dumps(result)))
            return result

    def mutate(self, s, u, op):
        kind, d = op.get('kind'), op.get('data', {})
        def allow(*roles):
            if u['role'] not in roles:
                raise Problem('Your role cannot perform this action.', 403)
        def get(collection, ident):
            obj = next((x for x in s[collection] if x['id'] == ident), None)
            if not obj:
                raise Problem('Record not found.', 404)
            if op.get('expectedRevision') != obj['revision']:
                raise Problem('This record changed since your last sync. Your changes are preserved locally. Refresh and review before retrying.', 409)
            return obj
        if kind == 'create_inspection':
            allow('staff', 'manager', 'supervisor')
            self.validate_inspection(s, d)
            if any(x['id'] == d['id'] for x in s['inspections']):
                raise Problem('Inspection already exists.', 409)
            ins = {k: copy.deepcopy(d.get(k)) for k in ('id', 'siteId', 'assetId', 'type', 'zone', 'period', 'date', 'answers', 'photos', 'observations', 'weight', 'referenceWeight', 'minimumWeight', 'notes', 'missing')}
            ins.update(status='submitted', inspector=u['name'], createdBy=u['id'], createdAt=now(), updatedAt=now(), revision=1, templateVersion=TEMPLATES[d['type']]['version'])
            flags = []
            if d['date'][:7] != d['period']:
                flags.append('Inspection date differs from the scheduled period')
            if d['date'] > today():
                flags.append('Inspection date is in the future; check device date')
            if any(x['assetId'] == d.get('assetId') and x['period'] == d['period'] and x['type'] == d['type'] for x in s['inspections']) and d.get('assetId'):
                flags.append('Potential duplicate inspection for this equipment and period')
            asset = next((x for x in s['assets'] if x['id'] == d.get('assetId')), None)
            if asset and asset['siteId'] != d['siteId']:
                flags.append('Equipment site differs from inspection site')
            for a in d['answers']:
                q = next(x for x in TEMPLATES[d['type']]['items'] if x['id'] == a['id'])
                if a['status'] == 'pass' and q.get('required') and a.get('quantity', 0) < q['required']:
                    flags.append(f"Pass conflicts with quantity: {q['label']}")
                if a['status'] == 'pass' and a.get('expiry') and a['expiry'] < d['date']:
                    flags.append(f"Pass conflicts with expiry: {q['label']}")
                if a['id'] == 'service' and a['status'] == 'pass' and asset and asset.get('serviceDue') and asset['serviceDue'] < d['date']:
                    flags.append('Pass conflicts with overdue equipment service')
                if a['id'] == 'weight' and a['status'] == 'pass' and d.get('minimumWeight') is not None and float(d['weight']) < float(d['minimumWeight']):
                    flags.append('Pass conflicts with the minimum acceptable CO₂ weight')
            for reason in flags:
                s['flags'].append({'id': str(uuid.uuid4()), 'inspectionId': ins['id'], 'siteId': ins['siteId'], 'reason': reason, 'status': 'open', 'revision': 1, 'createdAt': now()})
            failed = [a for a in d['answers'] if a['status'] in ('fail', 'missing', 'expired')]
            findings = [('Equipment missing', d.get('notes', ''), 'high')] if d.get('missing') else [(next(q['label'] for q in TEMPLATES[d['type']]['items'] if q['id'] == a['id']), a['note'], 'medium') for a in failed]
            findings += [(o['title'], o.get('note', ''), o.get('severity', 'medium')) for o in d.get('observations', []) if o.get('condition') == 'unsafe']
            for title, detail, severity in findings:
                s['findings'].insert(0, {'id': str(uuid.uuid4()), 'inspectionId': ins['id'], 'assetId': ins.get('assetId'), 'siteId': ins['siteId'], 'title': title, 'detail': detail, 'severity': severity, 'status': 'open', 'dueDate': (datetime.now().date()+timedelta(days=7)).isoformat(), 'owner': ROLE_LABELS[CORRECTIVE_ACTION_ROLE], 'photos': d.get('photos', []), 'completion': '', 'evidence': [], 'history': [], 'revision': 1, 'createdAt': now()})
            s['inspections'].insert(0, ins)
            return {'message': f"{d['type']} inspection submitted · {len(findings)} findings", 'id': ins['id'], 'flags': len(flags)}
        if kind == 'review_inspection':
            allow('manager', 'supervisor')
            ins = get('inspections', d['id'])
            if ins['status'] != 'submitted':
                raise Problem('Only submitted inspections can be reviewed.')
            if d.get('decision') not in ('approved', 'returned'):
                raise Problem('Select an approval decision.')
            if d['decision'] == 'approved' and any(f['inspectionId'] == ins['id'] and f['status'] == 'open' for f in s['flags']):
                raise Problem('Resolve the data review flags before approval.')
            if d['decision'] == 'returned' and not d.get('note', '').strip():
                raise Problem('Provide a reason for returning the inspection.')
            ins.update(status=d['decision'], reviewNote=d.get('note', ''), reviewer=u['name'], reviewedAt=now(), revision=ins['revision']+1)
            return {'message': f"{ins['type']} inspection {d['decision']}"}
        if kind == 'finding_action':
            f = get('findings', d['id'])
            action = d.get('action')
            if action in ('start', 'complete'):
                allow(CORRECTIVE_ACTION_ROLE)
                if f['status'] not in ('open', 'in_progress'):
                    raise Problem('This finding is not available for corrective work.')
                if action == 'complete':
                    if not d.get('note', '').strip() or not d.get('evidence'):
                        raise Problem('Completion notes and at least one evidence photo are required.')
                    self.photos(d['evidence'])
                    f.update(status='awaiting_verification', completion=d['note'], evidence=d['evidence'], completedBy=u['id'])
                else:
                    f['status'] = 'in_progress'
            elif action in ('verify', 'reject'):
                allow(VERIFICATION_ROLE)
                if f['status'] != 'awaiting_verification':
                    raise Problem('The finding must await verification first.')
                if f.get('completedBy') == u['id']:
                    raise Problem('You cannot verify your own corrective work.', 403)
                if not d.get('note', '').strip():
                    raise Problem('A verification or rejection note is required.')
                f.update(status='closed' if action == 'verify' else 'in_progress', verifiedBy=u['name'] if action == 'verify' else None, verifiedAt=now() if action == 'verify' else None)
            else:
                raise Problem('Unknown finding action.')
            f['history'].append({'action': action, 'note': d.get('note', ''), 'actor': u['name'], 'at': now()})
            f['revision'] += 1
            return {'message': f"Corrective action: {f['title']} · {f['status'].replace('_', ' ')}"}
        if kind == 'resolve_flag':
            allow('manager', 'supervisor')
            f = get('flags', d['id'])
            if not d.get('note', '').strip():
                raise Problem('Document the reason for resolving this flag.')
            if f['status'] != 'open':
                raise Problem('This flag has already been resolved.')
            f.update(status='resolved', resolution=d['note'], reviewer=u['name'], resolvedAt=now(), revision=f['revision']+1)
            return {'message': 'Data review flag resolved with a recorded explanation'}
        if kind == 'create_asset':
            allow('manager', 'supervisor')
            for field in ('id', 'name', 'siteId', 'type', 'zone', 'dueDate'):
                if not isinstance(d.get(field), str) or not d[field].strip():
                    raise Problem(f'{field} is required.')
            if d['type'] not in ('APAR', 'Hydrant', 'P3K') or d['siteId'] not in [x['id'] for x in s['sites']]:
                raise Problem('Invalid equipment type or site.')
            if any(x['id'].lower() == d['id'].lower() for x in s['assets']):
                raise Problem('Equipment ID already exists.', 409)
            for field in ('dueDate', 'serviceDue', 'expiryDate'):
                if d.get(field):
                    self.date(d[field])
            asset = {k: d.get(k, '') for k in ('id', 'name', 'siteId', 'type', 'zone', 'subtype', 'capacity', 'serial', 'dueDate', 'serviceDue', 'expiryDate')}
            asset['revision'] = 1
            s['assets'].append(asset)
            return {'message': f"Equipment {d['id']} registered"}
        raise Problem('Unknown operation.')

    @staticmethod
    def date(value):
        try:
            datetime.strptime(value, '%Y-%m-%d')
        except (TypeError, ValueError):
            raise Problem('Use a valid date in YYYY-MM-DD format.')

    @staticmethod
    def photos(values):
        if not isinstance(values, list) or len(values) > 8:
            raise Problem('Attach up to 8 photos.')
        for value in values:
            if not isinstance(value, dict) or not isinstance(value.get('data'), str) or not value['data'].startswith(('data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/webp;base64,')) or len(value['data']) > 2_000_000:
                raise Problem('Use JPEG, PNG or WebP evidence under 1.5 MB per photo.')

    def validate_inspection(self, s, d):
        if not isinstance(d.get('id'), str) or not 8 <= len(d['id']) <= 100:
            raise Problem('Inspection ID is required.')
        if d.get('type') not in TEMPLATES or d.get('siteId') not in [x['id'] for x in s['sites']]:
            raise Problem('Select a valid checklist and site.')
        self.date(d.get('date'))
        try:
            datetime.strptime(d.get('period', ''), '%Y-%m')
        except (TypeError, ValueError):
            raise Problem('A valid inspection period is required.')
        if d['type'] != 'Patrol':
            asset = next((x for x in s['assets'] if x['id'] == d.get('assetId')), None)
            if not asset or asset['type'] != d['type']:
                raise Problem('Select equipment matching the checklist type.')
        elif not d.get('zone', '').strip():
            raise Problem('Enter the patrol area.')
        self.photos(d.get('photos', []))
        answers = d.get('answers', [])
        expected = {q['id'] for q in TEMPLATES[d['type']]['items']}
        if not isinstance(answers, list) or len(answers) != len(expected) or {a.get('id') for a in answers} != expected:
            raise Problem('Every checklist question needs exactly one answer.')
        if d.get('missing'):
            if d['type'] == 'Patrol' or not d.get('notes', '').strip() or not d.get('photos') or any(a.get('status') != 'missing' for a in answers):
                raise Problem('Missing equipment requires all checks marked missing, a note and a location photo.')
        for a in answers:
            if a.get('status') not in ('pass', 'fail', 'na', 'missing', 'expired'):
                raise Problem('Complete every required checklist answer.')
            if a['status'] != 'pass' and not str(a.get('note', '')).strip():
                raise Problem('A reason is required for every failed, missing, expired or N/A answer.')
            q = next(q for q in TEMPLATES[d['type']]['items'] if q['id'] == a['id'])
            if q.get('required') and a['status'] not in ('na', 'missing') and (not isinstance(a.get('quantity'), (int, float)) or a['quantity'] < 0):
                raise Problem('Enter a non-negative actual quantity for each P3K supply.')
            if a.get('expiry'):
                self.date(a['expiry'])
            if a['id'] == 'weight' and a['status'] in ('pass', 'fail'):
                try:
                    if any(float(d.get(k, -1)) <= 0 for k in ('weight', 'referenceWeight', 'minimumWeight')):
                        raise ValueError()
                except (ValueError, TypeError):
                    raise Problem('Enter measured, reference and minimum acceptable CO₂ weights in kg.')
                if not d.get('photos'):
                    raise Problem('Attach weighing evidence for a CO₂ weight check.')
        observations = d.get('observations', [])
        if not isinstance(observations, list) or len(observations) > 30:
            raise Problem('Use up to 30 observations per inspection.')
        for o in observations:
            if not o.get('title', '').strip() or o.get('condition') not in ('safe', 'unsafe') or o.get('severity', 'medium') not in ('low', 'medium', 'high', 'critical'):
                raise Problem('Each observation needs a title, condition and valid severity.')
        if (any(a['status'] in ('fail', 'missing', 'expired') for a in answers) or any(o['condition'] == 'unsafe' for o in observations)) and not d.get('photos'):
            raise Problem('Attach at least one evidence photo for failed checks or unsafe observations.')

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'")
        if self.path.endswith(('sw.js', '.html')) or self.path == '/':
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def reply(self, value, status=200, cookie=None):
        data = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def token(self):
        jar = cookies.SimpleCookie()
        try:
            jar.load(self.headers.get('Cookie', ''))
            return jar['mizan_session'].value if 'mizan_session' in jar else ''
        except cookies.CookieError:
            return ''

    def do_GET(self):
        try:
            if self.path == '/api/health':
                return self.reply({'ok': True})
            if self.path == '/api/session':
                return self.reply({'user': self.server.store.user(self.token())})
            if self.path == '/api/state':
                self.server.store.user(self.token())
                return self.reply(self.server.store.state())
            if self.path.startswith('/api/'):
                raise Problem('Endpoint not found.', 404)
            return super().do_GET()
        except Problem as e:
            self.reply({'error': e.message}, e.status)

    def do_POST(self):
        try:
            # Same-origin JSON only; session cookie is HttpOnly and SameSite=Strict.
            origin = self.headers.get('Origin')
            if origin and origin.split('://', 1)[-1] != self.headers.get('Host'):
                raise Problem('Cross-origin requests are not allowed.', 403)
            if 'application/json' not in self.headers.get('Content-Type', ''):
                raise Problem('JSON request required.', 415)
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1 or length > 18_000_000:
                raise Problem('Request too large or empty.', 413)
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise Problem('JSON object required.')
            secure = '; Secure' if os.environ.get('MIZAN_SECURE_COOKIE') == '1' else ''
            if self.path == '/api/login':
                token, user = self.server.store.login(str(data.get('user', '')), str(data.get('password', '')))
                return self.reply({'user': user}, cookie=f'mizan_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800{secure}')
            user = self.server.store.user(self.token())
            if self.path == '/api/logout':
                with self.server.store.connect() as db:
                    db.execute('DELETE FROM sessions WHERE token=?', (self.token(),))
                return self.reply({'ok': True}, cookie=f'mizan_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0{secure}')
            if self.path == '/api/operations':
                return self.reply(self.server.store.apply(user, data))
            raise Problem('Endpoint not found.', 404)
        except Problem as e:
            self.reply({'error': e.message}, e.status)
        except (ValueError, TypeError, KeyError):
            self.reply({'error': 'Invalid request data.'}, 400)
        except Exception as e:
            print('Server error:', repr(e), flush=True)
            self.reply({'error': 'The server could not save this change. Your local copy is retained.'}, 500)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', default=8080, type=int)
    parser.add_argument('--db', default=str(ROOT / 'data' / 'mizan.sqlite3'))
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.store = Store(args.db)
    print(f'Mizan HSE running at http://{args.host}:{args.port}', flush=True)
    server.serve_forever()

if __name__ == '__main__':
    main()
