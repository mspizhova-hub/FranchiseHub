// Логіка сторінки compare.html: пресети, порівняння, збереження/завантаження сценаріїв

// Пресети: multipliers для сценаріїв
const PRESETS = {
  basic: { renovation:1.0, equipment:1.0, furniture:1.0, marketing:1.0, salary:1.0 },
  extended: { renovation:1.15, equipment:1.25, furniture:1.1, marketing:1.3, salary:1.1 },
  premium: { renovation:1.4, equipment:1.6, furniture:1.3, marketing:1.8, salary:1.25 }
};

function getCompareInputs(){
  return {
    franchiseKey: el('franchise_cmp').value,
    cityKey: el('city_cmp').value,
    area: Math.max(10, Number(el('area_cmp').value) || 50),
    employees: Math.max(1, Math.round(Number(el('employees_cmp').value) || 1)),
    contingencyPercent: 10 // фіксований або можна додати input
  };
}

function buildCompareTable(items){
  // items: [{name, estimate}]
  const container = el('compare_table');
  if(!container) return;
  if(items.length === 0){
    container.innerHTML = '<p>Немає сценаріїв для порівняння</p>';
    return;
  }

  // Заголовки
  let html = '<table><thead><tr><th>Стаття</th>';
  items.forEach(it => html += `<th>${escapeHtml(it.name)}</th>`);
  html += '</tr></thead><tbody>';

  const rows = [
    { key:'pauschal', label:'Паушальний внесок' },
    { key:'renovation', label:'Ремонт (орієнтовно)' },
    { key:'equipment', label:'Обладнання' },
    { key:'furniture', label:'Меблі та облаштування' },
    { key:'initialMarketing', label:'Початковий маркетинг' },
    { key:'firstMonthSalaries', label:'Зарплата (перший місяць)' },
    { key:'subtotal', label:'Проміжок (без резерву)' },
    { key:'contingency', label:'Резерв' },
    { key:'total', label:'Орієнтовні стартові витрати' }
  ];

  rows.forEach(r=>{
    html += `<tr><td><strong>${r.label}</strong></td>`;
    items.forEach(it=>{
      const v = it.estimate[r.key] ?? 0;
      html += `<td>${formatMoney(Math.round(v))}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// Безпечна вставка тексту у HTML (проста)
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m] }) }

// Збереження поточного сценарію (на кнопку Save)
function saveCurrentScenario(nameInputId){
  const nameEl = el(nameInputId);
  if(!nameEl) return;
  const name = nameEl.value.trim();
  if(!name){
    alert('Введіть назву сценарію');
    return;
  }
  const inputs = getCompareInputs();
  // Беремо multipliers від preset, якщо користувач натискав preset — збережемо останні multipliers
  const lastPreset = nameEl.dataset.preset || 'basic';
  const multipliers = PRESETS[lastPreset] || PRESETS.basic;
  const scenario = {
    id: uid('sc'),
    name,
    franchiseKey: inputs.franchiseKey,
    cityKey: inputs.cityKey,
    area: inputs.area,
    employees: inputs.employees,
    contingencyPercent: inputs.contingencyPercent,
    multipliers
  };
  saveScenarioToStorage(scenario);
  renderSavedList();
  alert('Сценарій збережено');
}

// Рендер списку збережених сценаріїв
function renderSavedList(){
  const list = loadSavedScenarios();
  const container = el('saved_list');
  if(!container) return;
  if(list.length === 0){
    container.innerHTML = '<div>Немає збережених сценаріїв.</div>';
    return;
  }
  container.innerHTML = '';
  list.forEach(s=>{
    const div = document.createElement('div');
    div.className = 'saved-item';
    const left = document.createElement('div');
    left.innerHTML = `<strong>${escapeHtml(s.name)}</strong><div style="font-size:0.9rem;color:var(--muted)">${escapeHtml(s.franchiseKey)} — ${escapeHtml(s.cityKey)} — ${s.area} м² — ${s.employees} люд.</div>`;
    const right = document.createElement('div');
    const loadBtn = document.createElement('button'); loadBtn.textContent='Використати'; loadBtn.addEventListener('click', ()=>{
      // Додаємо сценарій до порівняння (один з трьох слотів — A,B,C)
      const slot = prompt('В який слот додати сценарій? Введіть A, B або C', 'A');
      if(!slot) return;
      const sslot = slot.trim().toUpperCase();
      if(!['A','B','C'].includes(sslot)){ alert('Неправильний слот'); return; }
      el('name_' + sslot.toLowerCase()).value = s.name;
      el('name_' + sslot.toLowerCase()).dataset.preset = 'custom';
      // Задаємо поля сторінки згідно сценарію
      el('franchise_cmp').value = s.franchiseKey;
      el('city_cmp').value = s.cityKey;
      el('area_cmp').value = s.area;
      el('employees_cmp').value = s.employees;
      // Зберігаємо multipliers тимчасово в data атрибуті name поля для подальшого збереження
      el('name_' + sslot.toLowerCase()).dataset.multipliers = JSON.stringify(s.multipliers);
      alert('Сценарій додано у слот ' + sslot);
    });
    const delBtn = document.createElement('button'); delBtn.textContent='Видалити'; delBtn.addEventListener('click', ()=>{
      if(!confirm('Видалити сценарій?')) return;
      removeScenarioFromStorage(s.id);
      renderSavedList();
    });
    right.appendChild(loadBtn);
    right.appendChild(delBtn);
    div.appendChild(left);
    div.appendChild(right);
    container.appendChild(div);
  });
}

// Обробник натискання preset кнопки
function applyPreset(key, targetNameInputId){
  const preset = PRESETS[key];
  if(!preset) return;
  // позначимо, який preset був застосований в полi name (для збереження)
  const nameInput = el(targetNameInputId);
  if(nameInput){
    nameInput.dataset.preset = key;
    nameInput.dataset.multipliers = JSON.stringify(preset);
  }
  // Для зручності — не змінюємо поля franchise/city/area/employees
}

// Збірка сценаріїв із трьох слотів та виконання розрахунку
function collectScenariosAndCompare(){
  const inputs = getCompareInputs();
  const names = [el('name_a').value.trim() || 'A', el('name_b').value.trim() || 'B', el('name_c').value.trim() || 'C'];
  const slots = ['a','b','c'];
  const items = slots.map((s, idx)=>{
    const nameEl = el('name_' + s);
    // multipliers або від data-multipliers або preset
    let multipliers = PRESETS.basic;
    if(nameEl && nameEl.dataset.multipliers){
      try{ multipliers = JSON.parse(nameEl.dataset.multipliers); }catch(e){}
    } else if(nameEl && nameEl.dataset.preset){
      multipliers = PRESETS[nameEl.dataset.preset] || PRESETS.basic;
    } else {
      // якщо користувач нічого не налаштував — для слотів використовуємо базовий для A, extended для B, premium для C
      multipliers = idx === 0 ? PRESETS.basic : (idx === 1 ? PRESETS.extended : PRESETS.premium);
    }

    const estimate = calculateEstimate({
      franchiseKey: inputs.franchiseKey,
      cityKey: inputs.cityKey,
      area: inputs.area,
      employees: inputs.employees,
      contingencyPercent: inputs.contingencyPercent,
      scenarioMultipliers: multipliers
    });
    return { name: names[idx], estimate };
  });

  buildCompareTable(items);
}

// Ініціалізація подій на сторінці compare.html
document.addEventListener('DOMContentLoaded', ()=>{
  if(!el('franchise_cmp')) return;
  // Наповнюємо селект
  populateFranchises();
  // Пресети
  document.querySelectorAll('.preset').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const key = e.target.dataset.key;
      // застосуємо preset до всіх слотів' name data (щоб при збереженні було видно який preset)
      ['name_a','name_b','name_c'].forEach(id=>{
        const nm = el(id);
        if(nm){
          nm.dataset.preset = key;
          nm.dataset.multipliers = JSON.stringify(PRESETS[key]);
        }
      });
      alert('Пресет застосовано: ' + key);
    });
  });

  // Кнопки збереження слотів
  el('save_a').addEventListener('click', ()=> saveCurrentScenario('name_a'));
  el('save_b').addEventListener('click', ()=> saveCurrentScenario('name_b'));
  el('save_c').addEventListener('click', ()=> saveCurrentScenario('name_c'));

  // Кнопка порівняти
  el('compare').addEventListener('click', collectScenariosAndCompare);

  // Рендер збережених сценаріїв
  renderSavedList();
});