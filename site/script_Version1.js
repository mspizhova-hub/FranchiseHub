// Дані франшиз (приблизні/демонстраційні)
const FRANCHISES = {
  "Кав'ярня": {
    pauschal: 20000,
    basePerM2: { renovation: 120, equipment: 400, furniture: 80 }, // грн за м2 (приблизно)
    baseMonthlySalaryPerEmployee: 12000,
    marketing: 4000
  },
  "Магазин одягу": {
    pauschal: 30000,
    basePerM2: { renovation: 100, equipment: 250, furniture: 120 },
    baseMonthlySalaryPerEmployee: 10000,
    marketing: 6000
  },
  "Сервісний центр": {
    pauschal: 25000,
    basePerM2: { renovation: 150, equipment: 500, furniture: 60 },
    baseMonthlySalaryPerEmployee: 14000,
    marketing: 3000
  }
};

// Множники по містах
const CITY_MULTIPLIERS = {
  small: 0.8,
  regional: 1.0,
  big: 1.4,
  capital: 1.8
};

function el(id){ return document.getElementById(id) }

function populateFranchises(){
  const sel = el('franchise');
  const selCmp = el('franchise_cmp');
  Object.keys(FRANCHISES).forEach(key=>{
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    if(sel) sel.appendChild(opt);
    if(selCmp) selCmp.appendChild(opt.cloneNode(true));
  });
}

function formatMoney(n){
  return new Intl.NumberFormat('uk-UA', { style:'currency', currency:'UAH', maximumFractionDigits:0 }).format(n);
}

// calculateEstimate повертає об'єкт із детальним кошторисом
function calculateEstimate({ franchiseKey, cityKey='regional', area=50, employees=3, contingencyPercent=10, scenarioMultipliers={} }){
  const franchise = FRANCHISES[franchiseKey];
  if(!franchise) return null;
  const cityMult = CITY_MULTIPLIERS[cityKey] || 1;

  // multipliers можуть змінювати статті:
  const m = {
    renovation: scenarioMultipliers.renovation ?? 1,
    equipment: scenarioMultipliers.equipment ?? 1,
    furniture: scenarioMultipliers.furniture ?? 1,
    marketing: scenarioMultipliers.marketing ?? 1,
    salary: scenarioMultipliers.salary ?? 1
  };

  const pauschal = franchise.pauschal;
  const renovation = franchise.basePerM2.renovation * area * cityMult * m.renovation;
  const equipment = franchise.basePerM2.equipment * area * cityMult * m.equipment;
  const furniture = franchise.basePerM2.furniture * area * cityMult * m.furniture;
  const initialMarketing = franchise.marketing * cityMult * m.marketing;
  const firstMonthSalaries = franchise.baseMonthlySalaryPerEmployee * employees * cityMult * m.salary;

  const subtotal = pauschal + renovation + equipment + furniture + initialMarketing + firstMonthSalaries;
  const contingency = subtotal * (contingencyPercent / 100);
  const total = Math.round(subtotal + contingency);

  return {
    pauschal, renovation, equipment, furniture, initialMarketing, firstMonthSalaries, subtotal, contingency, total
  };
}

// Функції роботи з localStorage для збережених сценаріїв
const STORAGE_KEY = 'franchise_saved_scenarios';

function loadSavedScenarios(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return [];
    return JSON.parse(raw);
  }catch(e){
    console.warn('Cannot parse saved scenarios', e);
    return [];
  }
}

function saveScenarioToStorage(scenario){
  // scenario: { id, name, franchiseKey, cityKey, area, employees, contingencyPercent, multipliers }
  const list = loadSavedScenarios();
  // якщо id існує — оновлюємо, інакше додаємо
  const idx = list.findIndex(s => s.id === scenario.id);
  if(idx >= 0) list[idx] = scenario;
  else list.push(scenario);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function removeScenarioFromStorage(id){
  const list = loadSavedScenarios().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// Помічник для генерації ID
function uid(prefix='id'){
  return prefix + '_' + Math.random().toString(36).slice(2,9);
}

// Приватні: якщо сторінка index.html, підключаємо стандартну логіку
document.addEventListener('DOMContentLoaded', ()=>{
  // Контролюємо слайдер contingency, якщо є
  const c = el('contingency');
  if(c){
    el('contingencyVal').textContent = c.value + '%';
    c.addEventListener('input', (e)=> el('contingencyVal').textContent = e.target.value + '%');
  }

  // Якщо це основна сторінка — заповнюємо селект і навішуємо обробники
  if(el('franchise')){
    populateFranchises();
    const calcBtn = el('calculate');
    if(calcBtn) calcBtn.addEventListener('click', ()=>{
      const franchiseKey = el('franchise').value;
      const cityKey = el('city').value;
      const area = Math.max(10, Number(el('area').value) || 50);
      const employees = Math.max(1, Math.round(Number(el('employees').value) || 1));
      const contingencyPercent = Number(el('contingency').value);

      const res = calculateEstimate({ franchiseKey, cityKey, area, employees, contingencyPercent });
      const summary = el('summary');
      if(!res){ summary.innerHTML = '<p>Невірні параметри</p>'; return; }

      summary.innerHTML = `
        <div class="card">
          <div class="summary-row"><div>Паушальний внесок</div><div>${formatMoney(res.pauschal)}</div></div>
          <div class="summary-row"><div>Ремонт (орієнтовно)</div><div>${formatMoney(Math.round(res.renovation))}</div></div>
          <div class="summary-row"><div>Обладнання</div><div>${formatMoney(Math.round(res.equipment))}</div></div>
          <div class="summary-row"><div>Меблі та облаштування</div><div>${formatMoney(Math.round(res.furniture))}</div></div>
          <div class="summary-row"><div>Початковий маркетинг</div><div>${formatMoney(Math.round(res.initialMarketing))}</div></div>
          <div class="summary-row"><div>Зарплата (перший місяць, ${employees} співробітник(и))</div><div>${formatMoney(Math.round(res.firstMonthSalaries))}</div></div>
          <div class="summary-row"><div>Проміжок (без резерву)</div><div>${formatMoney(Math.round(res.subtotal))}</div></div>
          <div class="summary-row"><div>Резерв (${contingencyPercent}%)</div><div>${formatMoney(Math.round(res.contingency))}</div></div>
          <div class="summary-row total"><div>Орієнтовні стартові витрати</div><div>${formatMoney(res.total)}</div></div>
        </div>
        <p style="margin-top:10px;color:var(--muted)">Це приблизний розрахунок для "${franchiseKey}" у вибраному місті. Для точного бюджету потрібні детальні вимоги франчайзера, договір, оцінка місця та кошторис від підрядників.</p>
      `;
    });

    const resetBtn = el('reset');
    if(resetBtn) resetBtn.addEventListener('click', ()=>{
      el('franchise').selectedIndex = 0;
      el('city').value = 'regional';
      el('area').value = 50;
      el('employees').value = 3;
      el('contingency').value = 10;
      el('contingencyVal').textContent = '10%';
      document.getElementById('summary').innerHTML = '<p>Виберіть параметри й натисніть «Порахувати».</p>';
    });
  }

  // Якщо це сторінка порівняння — ініціалізуємо селекти
  if(el('franchise_cmp')){
    populateFranchises();
  }
});
