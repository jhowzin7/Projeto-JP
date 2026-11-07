const COLUMNS = [
  {id:'todo', name:'A Fazer', color:'var(--c1)'},
  {id:'doing', name:'Em Andamento', color:'var(--c2)'},
  {id:'done', name:'Concluído', color:'var(--c3)'}
];
const KEY = 'kanban-tasks-v1';
const storageStatus = document.getElementById('storageStatus');
let tasks = load();
let dragId = null;

function load(){
  const fallback = [
    {id:uid(), title:'Bem-vindo ao Kanban', desc:'Arraste este card para outra coluna.', status:'todo'},
    {id:uid(), title:'Criar uma tarefa', desc:'Use o botão no topo da página.', status:'doing'}
  ];
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return fallback;
    const data = JSON.parse(raw);
    if(!Array.isArray(data)) return fallback;
    return data.filter(task => task && typeof task.id === 'string'
      && typeof task.title === 'string' && typeof task.desc === 'string'
      && COLUMNS.some(column => column.id === task.status));
  }catch(error){
    showStorageError('Não foi possível carregar as tarefas salvas.');
    return fallback;
  }
}
function save(){
  try{
    localStorage.setItem(KEY, JSON.stringify(tasks));
    storageStatus.textContent = '';
    storageStatus.classList.remove('error');
  }catch(error){
    showStorageError('Não foi possível salvar as alterações neste navegador.');
  }
}
function showStorageError(message){
  storageStatus.textContent = message;
  storageStatus.classList.add('error');
}
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

const board = document.getElementById('board');

function render(){
  board.innerHTML = COLUMNS.map((col,i)=>{
    const items = tasks.filter(t=>t.status===col.id);
    return `<section class="column" data-col="${col.id}">
      <div class="col-head"><span class="dot" style="background:${col.color}"></span>${col.name}<span class="count">${items.length}</span></div>
      <div class="list">${items.length ? items.map(t=>cardHTML(t,i)).join('') : '<div class="empty">Solte um card aqui</div>'}</div>
    </section>`;
  }).join('');
}

function cardHTML(t,i){
  const prev = i>0 ? `<button class="icon" data-move="${t.id}" data-dir="-1" aria-label="Mover para a esquerda">←</button>` : '';
  const next = i<COLUMNS.length-1 ? `<button class="icon" data-move="${t.id}" data-dir="1" aria-label="Mover para a direita">→</button>` : '';
  return `<article class="card" draggable="true" data-id="${t.id}">
    <div class="card-top"><h3>${esc(t.title)}</h3>
      <button class="icon" data-del="${t.id}" aria-label="Deletar tarefa" title="Deletar">✕</button></div>
    ${t.desc ? `<p>${esc(t.desc)}</p>` : ''}
    <div class="moves">${prev}${next}</div>
  </article>`;
}

board.addEventListener('dragstart', e=>{
  const card = e.target.closest('.card'); if(!card) return;
  dragId = card.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  try{ e.dataTransfer.setData('text/plain', dragId); }catch(_){}
  setTimeout(()=>card.classList.add('dragging'),0);
});
board.addEventListener('dragend', ()=>{
  dragId = null;
  document.querySelectorAll('.dragging').forEach(c=>c.classList.remove('dragging'));
  document.querySelectorAll('.over').forEach(c=>c.classList.remove('over'));
});
board.addEventListener('dragover', e=>{
  const col = e.target.closest('.column'); if(!col || !dragId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.over').forEach(c=>{ if(c!==col) c.classList.remove('over'); });
  col.classList.add('over');
});
board.addEventListener('dragleave', e=>{
  const col = e.target.closest('.column');
  if(col && !col.contains(e.relatedTarget)) col.classList.remove('over');
});
board.addEventListener('drop', e=>{
  const col = e.target.closest('.column'); if(!col || !dragId) return;
  e.preventDefault();
  const task = tasks.find(t=>t.id===dragId); if(!task) return;
  const over = e.target.closest('.card');
  tasks = tasks.filter(t=>t.id!==dragId);
  task.status = col.dataset.col;
  let idx = tasks.length;
  if(over && over.dataset.id !== dragId){
    const r = over.getBoundingClientRect();
    const before = e.clientY < r.top + r.height/2;
    const ti = tasks.findIndex(t=>t.id===over.dataset.id);
    if(ti>-1) idx = before ? ti : ti+1;
  }
  tasks.splice(idx,0,task);
  save(); render();
});

board.addEventListener('click', e=>{
  const del = e.target.closest('[data-del]');
  if(del){ tasks = tasks.filter(t=>t.id!==del.dataset.del); save(); render(); return; }
  const mv = e.target.closest('[data-move]');
  if(mv){
    const t = tasks.find(x=>x.id===mv.dataset.move);
    if(!t) return;
    const i = COLUMNS.findIndex(c=>c.id===t.status) + Number(mv.dataset.dir);
    if(COLUMNS[i]){ t.status = COLUMNS[i].id; save(); render(); }
  }
});

const modal = document.getElementById('modal');
const form = document.getElementById('form');
const titleEl = document.getElementById('title');
const descEl = document.getElementById('desc');
document.getElementById('addBtn').onclick = ()=>{ form.reset(); modal.showModal(); titleEl.focus(); };
document.getElementById('cancel').onclick = ()=>modal.close();
modal.addEventListener('click', e=>{ if(e.target===modal) modal.close(); });
form.addEventListener('submit', e=>{
  e.preventDefault();
  const title = titleEl.value.trim(); if(!title) return;
  tasks.push({id:uid(), title, desc:descEl.value.trim(), status:'todo'});
  save(); render(); modal.close();
});

render();
save();
