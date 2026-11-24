const SUPABASE_URL='https://keukmuwfkavdxgqyerrc.supabase.co';
const SUPABASE_KEY='sb_publishable_NBv-E8TlWx5Zz2bBGO35zw_-ya7-o7k';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let categories = [], tournaments = [], profiles = [], admin = false;
let editingTournament = null;
const openTournaments = () => tournaments.filter(t => t.registration_open);
function resetTournamentEditor() {
  editingTournament = null;
  $('tournamentForm').reset();
  $('saveTournament').textContent = 'Create tournament';
  $('cancelTournament').classList.add('hidden');
}
$('cancelTournament').onclick = resetTournamentEditor;
const message=(id,s)=>$(id).textContent=s;
const safeImg=url=>/^https:\/\//i.test(url||'')?'<img class="avatar" src="'+esc(url)+'" alt="Gamer photo" loading="lazy">':'';
function tournamentPoster(tournament) {
  const url = tournament.image_url?.trim();
  if (!url || !/^https:\/\//i.test(url)) return '';
  return '<img data-tournament-poster src="' + esc(url) + '" alt="' +
    esc(tournament.title + ' poster') + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" ' +
    'style="display:block;width:auto;max-width:100%;max-height:32rem;height:auto;margin-bottom:12px;border-radius:10px">';
}

$('publicTournaments').addEventListener('error', event => {
  if (event.target.matches('[data-tournament-poster]')) event.target.remove();
}, true);
async function loadPublic(){let [c,t,p]=await Promise.all([db.from('sc_public_categories').select('*').order('name').order('id'),db.from('sc_public_tournaments').select('*').order('tournament_date').order('id'),db.from('sc_public_profiles').select('*').order('registration_id')]);if(c.error||t.error||p.error){message('registrationNotice','Database setup needed: '+(c.error||t.error||p.error).message);return}const selectedCategory = $('publicCategory').value;
const selectedTournament = $('publicTournament').value;
const adminCategory = $('adminCategory').value;
categories=c.data||[];tournaments=t.data||[];profiles=p.data||[];const opts=categories.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');$('publicCategory').innerHTML='<option value="">Choose a game</option>'+opts;$('adminCategory').innerHTML='<option value="">Choose a game</option>'+opts;$('publicCategory').value = selectedCategory;
$('adminCategory').value = adminCategory;
renderTournamentOptions();
$('publicTournament').value = selectedTournament;
$('publicTournaments').innerHTML=tournaments.map(x=>'<div class="item">'+tournamentPoster(x)+'<strong>'+esc(x.title)+'</strong><p class="muted">'+esc(categories.find(c=>c.id===x.category_id)?.name||'Game')+' • '+esc(x.tournament_date||'Date TBA')+' • '+esc(x.venue||'Venue TBA')+' • '+esc(x.registration_fee)+' KES registration'+(x.prize_pool == null ? '' : ' • '+esc(x.prize_pool)+' KES prize pool')+'</p></div>').join('')||'<p class="muted">No tournaments yet.</p>';renderProfiles();if(admin)renderAdminLists()}
function renderTournamentOptions(){let selected=$('publicCategory').value;$('publicTournament').innerHTML='<option value="">Choose a tournament</option>'+openTournaments().filter(t=>String(t.category_id)===selected).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.title)+'</option>').join('')}
$('publicCategory').addEventListener('change',renderTournamentOptions);
$('publicForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),b=e.target.querySelector('button');b.disabled=true;message('registrationNotice','Submitting...');const {data,error}=await db.rpc('sc_submit_registration',{p_name:String(f.get('name')).trim(),p_tag:String(f.get('tag')).trim(),p_country:String(f.get('country')).trim(),p_tournament_id:$('publicTournament').value,p_payment_reference:String(f.get('payment')||'').trim()||null});b.disabled=false;if(error){message('registrationNotice','Could not register: '+error.message);return}message('registrationNotice','Registration submitted! Your reference ID: '+data+'. Approval and payment verification are pending.');e.target.reset();renderTournamentOptions()};
function renderProfiles(){const q=$('searchInput').value.trim().toLowerCase();$('gamerList').innerHTML=profiles.filter(p=>!q||[p.gamer_name,p.gamer_tag,p.registration_id].some(v=>String(v||'').toLowerCase().includes(q))).map(p=>'<div class="item"><strong>'+esc(p.gamer_name)+'</strong> <span class="tag">Approved</span><p class="muted">'+esc(p.gamer_tag||'')+' • '+esc(p.country||'')+'</p><button class="secondary" data-profile="'+esc(p.registration_id)+'">Open profile</button></div>').join('')||'<p class="muted">No approved gamers found.</p>'}
$('searchInput').oninput=renderProfiles;$('searchButton').onclick=renderProfiles;
$('gamerList').onclick=e=>{let b=e.target.closest('[data-profile]');if(b)viewProfile(b.dataset.profile)};
async function viewProfile(id) {
let p = profiles.find(x => String(x.registration_id) === id);
if (!p && /^[0-9a-f-]{36}$/i.test(id)) {
  const response = await db.from('sc_public_profiles').select('*').eq('registration_id', id).maybeSingle();
  if (response.error) {
    message('profileView', 'The profile could not be loaded.');
    return;
  }
  p = response.data;
}
if (!p) {
  message('profileView', 'This approved gamer profile is unavailable.');
  return;
}history.replaceState(null,'',location.pathname+'?gamer='+encodeURIComponent(id)+'#gamers');$('profileView').innerHTML='<div class="profile"><div class="pill">SC FIFA • APPROVED GAMER</div>'+safeImg(p.photo_url)+'<h2>'+esc(p.gamer_name)+'</h2><p>'+esc(p.gamer_tag||'')+' • '+esc(p.country||'')+'</p><p class="muted">'+esc(tournaments.find(t=>t.id===p.tournament_id)?.title||'Tournament')+'</p><div id="qr" class="qr"></div><p class="muted">Scan to open this approved profile.</p></div>';if(window.QRCode)new window.QRCode($('qr'),{text:location.origin+location.pathname+'?gamer='+encodeURIComponent(id)+'#gamers',width:160,height:160});else $('qr').textContent='QR generator unavailable';
$('profileView').scrollIntoView({block: 'start'});
}
async function isAdmin() {
  const {data: {session}} = await db.auth.getSession();
  if (!session) return false;
  const {data, error} = await db.from('admins').select('user_id')
    .eq('user_id', session.user.id).maybeSingle();
  return !error && Boolean(data);
}
async function checkAdmin(){admin=await isAdmin();$('adminContent').classList.toggle('hidden',!admin);$('loginForm').classList.toggle('hidden',admin);if(admin){message('adminNotice','Organizer signed in.');await loadAdmin()}else message('adminNotice','Organizer account required.');}
$('loginForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await db.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error){message('adminNotice',error.message);return}await checkAdmin();if(!admin)await db.auth.signOut()};
$('logout').onclick=async()=>{await db.auth.signOut();admin=false;registrations=[];window.scGamerMap={};$('registrationList').replaceChildren();resetTournamentEditor();$('adminContent').classList.add('hidden');$('loginForm').classList.remove('hidden');message('adminNotice','Signed out.')};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.adminTab').forEach(x=>x.classList.toggle('hidden',x.id!==b.dataset.tab))});
let registrations=[];
async function loadAdmin(){const {data,error}=await db.from('registrations').select('id,gamer_id,tournament_id,payment_status,payment_reference,status,created_at').order('created_at',{ascending:false});if(error){message('adminNotice','Admin data unavailable: '+error.message);return}registrations=data||[];let ids=[...new Set(registrations.map(r=>r.gamer_id))];let gamerMap={};if(ids.length){const res=await db.from('gamers').select('id,gamer_name,gamer_tag').in('id',ids);if(res.error){message('adminNotice','Gamer lookup failed: '+res.error.message);return}gamerMap=Object.fromEntries((res.data||[]).map(g=>[g.id,g]))}window.scGamerMap=gamerMap;renderAdminLists()}
function renderAdminLists(){if(!admin)return;$('registrationList').innerHTML=registrations.map(r=>'<div class="item"><strong>'+esc(window.scGamerMap?.[r.gamer_id]?.gamer_name||'Gamer')+'</strong> <span class="tag">'+esc(r.status||'pending')+'</span><p class="muted">'+esc(tournaments.find(t=>t.id===r.tournament_id)?.title||'Tournament')+' • Payment: '+esc(r.payment_status||'unverified')+' • Reference: '+esc(r.payment_reference||'not provided')+'</p><div class="actions"><button class="green" data-status="approved" data-id="'+esc(r.id)+'">Approve</button><button class="danger" data-status="rejected" data-id="'+esc(r.id)+'">Reject</button><button class="secondary" data-payment="verified" data-id="'+esc(r.id)+'">Mark payment verified</button><button class="secondary" data-payment="pending" data-id="'+esc(r.id)+'">Mark payment pending</button></div></div>').join('')||'<p class="muted">No registrations yet.</p>';$('categoryList').innerHTML=categories.map(c=>'<div class="item">'+esc(c.name)+'</div>').join('');$('tournamentList').innerHTML=tournaments.map(t=>'<div class="item"><strong>'+esc(t.title)+'</strong><p class="muted">'+(t.registration_open?'Registration open':'Registration closed')+'</p><div class="actions"><button class="secondary" data-tournament-edit="'+esc(t.id)+'">Edit</button><button class="secondary" data-tournament-toggle="'+esc(t.id)+'">'+(t.registration_open?'Close registration':'Open registration')+'</button></div></div>').join('')}
$('registrationList').onclick=async e=>{let b=e.target.closest('[data-status], [data-payment]');if(!b||!admin)return;const changes = b.dataset.status ? {status:b.dataset.status} : {payment_status:b.dataset.payment};const {error}=await db.from('registrations').update(changes).eq('id',b.dataset.id).select('id').single();if(error){message('adminNotice',error.message);return}await loadAdmin();await loadPublic()};
$('categoryForm').onsubmit=async e=>{e.preventDefault();if(!admin)return;const f=new FormData(e.target),{error}=await db.from('game_categories').insert({name:String(f.get('name')).trim(),image_url:String(f.get('image_url')||'')||null});if(error){message('adminNotice',error.message);return}e.target.reset();await loadPublic()};
$('tournamentList').onclick = async event => {
  const button = event.target.closest('[data-tournament-edit], [data-tournament-toggle]');
  if (!admin || !button) return;
  const tournament = tournaments.find(t => String(t.id) === (button.dataset.tournamentEdit || button.dataset.tournamentToggle));
  if (!tournament) return;
  if (button.dataset.tournamentEdit) {
    editingTournament = tournament.id;
    const form = $('tournamentForm');
    for (const name of ['title', 'tournament_date', 'venue', 'registration_fee', 'prize_pool', 'image_url']) {
      form.elements.namedItem(name).value = tournament[name] ?? '';
    }
    $('adminCategory').value = tournament.category_id;
    $('saveTournament').textContent = 'Save tournament';
    $('cancelTournament').classList.remove('hidden');
    form.elements.namedItem('title').focus();
    return;
  }
  button.disabled = true;
  const {error} = await db.from('tournaments')
    .update({registration_open: !tournament.registration_open})
    .eq('id', tournament.id).select('id').single();
  button.disabled = false;
  if (error) {
    message('adminNotice', error.message);
    return;
  }
  await loadPublic();
  message('adminNotice', tournament.registration_open ? 'Registration closed.' : 'Registration opened.');
};

$('tournamentForm').onsubmit = async event => {
  event.preventDefault();
  if (!admin) return;
  const form = new FormData(event.target);
  const tournament = {
    title: String(form.get('title')).trim(),
    category_id: $('adminCategory').value,
    tournament_date: form.get('tournament_date') || null,
    venue: String(form.get('venue')).trim(),
    registration_fee: Number(form.get('registration_fee')),
    prize_pool: Number(form.get('prize_pool')),
    image_url: String(form.get('image_url')).trim() || null
  };
  if (!tournament.title || !tournament.category_id) {
    message('adminNotice', 'Enter a title and choose a category.');
    return;
  }
  const button = $('saveTournament');
  button.disabled = true;
  const table = db.from('tournaments');
  const query = editingTournament === null
    ? table.insert(tournament)
    : table.update(tournament).eq('id', editingTournament);
  const {error} = await query.select('id').single();
  button.disabled = false;
  if (error) {
    message('adminNotice', error.message);
    return;
  }
  resetTournamentEditor();
  await loadPublic();
  message('adminNotice', 'Tournament saved.');
};
(async () => {
  const id = new URLSearchParams(location.search).get('gamer');
  await loadPublic();
  if (id) await viewProfile(id);
  await checkAdmin();
})();
