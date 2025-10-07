/* app.js - Controle de Contas simples (localStorage) */

(() => {
    // elementos
    const monthSelect = document.getElementById('monthSelect');
    const billForm = document.getElementById('billForm');
    const billsList = document.getElementById('billsList');
    const emptyMsg = document.getElementById('emptyMsg');
    const totalAllEl = document.getElementById('totalAll');
    const totalPaidEl = document.getElementById('totalPaid');
    const totalPendingEl = document.getElementById('totalPending');
  
    const nameInput = document.getElementById('name');
    const valueInput = document.getElementById('value');
    const dueDateInput = document.getElementById('dueDate');
    const billIdInput = document.getElementById('billId');
    const submitBtn = document.getElementById('submitBtn');
    const clearBtn = document.getElementById('clearBtn');
  
    // localStorage key
    const STORAGE_KEY = 'minhas_contas_v1';
  
    // state
    let bills = loadBills(); // array de {id, name, value, dueDate (ISO), paid:bool, paidAt:ISO|null}
    let editingId = null;
  
    // --- init ---
    setMonthToCurrent();
    render();
  
    // eventos
    monthSelect.addEventListener('change', render);
    billForm.addEventListener('submit', onSubmit);
    clearBtn.addEventListener('click', resetForm);
  
    // --- funções ---
    function setMonthToCurrent() {
      const now = new Date();
      const y = now.getFullYear();
      const m = (now.getMonth() + 1).toString().padStart(2,'0');
      monthSelect.value = `${y}-${m}`;
    }
  
    function loadBills() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(b => ({...b}));
      } catch (e) {
        console.error('Erro ao carregar bills', e);
        return [];
      }
    }
  
    function saveBills() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
    }
  
    function onSubmit(e) {
      e.preventDefault();
      const name = nameInput.value.trim();
      const valueStr = valueInput.value;
      const dueDate = dueDateInput.value;
  
      if (!name || !valueStr || !dueDate) {
        alert('Preencha todos os campos.');
        return;
      }
  
      const value = roundToTwo(parseFloat(valueStr));
      if (isNaN(value) || value < 0) {
        alert('Valor inválido.');
        return;
      }
  
      if (editingId) {
        // editar
        const idx = bills.findIndex(b => b.id === editingId);
        if (idx >= 0) {
          bills[idx].name = name;
          bills[idx].value = value;
          bills[idx].dueDate = dueDate;
          // manter status pago/pending
          saveBills();
          editingId = null;
          submitBtn.textContent = 'Adicionar';
          animateFlash('Conta editada com sucesso!');
        }
      } else {
        // adicionar
        const bill = {
          id: cryptoId(),
          name,
          value,
          dueDate,
          paid: false,
          paidAt: null,
          createdAt: new Date().toISOString()
        };
        bills.unshift(bill);
        animateFlash('Conta adicionada!');
      }
  
      saveBills();
      resetForm();
      render();
    }
  
    function resetForm(){
      billForm.reset();
      billIdInput.value = '';
      editingId = null;
      submitBtn.textContent = 'Adicionar';
    }
  
    function render() {
      const month = monthSelect.value; // format YYYY-MM
      const [year, monthNum] = (month || '').split('-').map(Number);
  
      // filtrar por mês (vencimento)
      const filtered = bills.filter(b => {
        if (!b.dueDate) return false;
        const d = new Date(b.dueDate + 'T00:00:00');
        return d.getFullYear() === year && (d.getMonth()+1) === monthNum;
      });
  
      // ordenar por data crescente
      filtered.sort((a,b) => (new Date(a.dueDate) - new Date(b.dueDate)));
  
      // limpar lista
      billsList.innerHTML = '';
  
      if (filtered.length === 0) {
        emptyMsg.style.display = 'block';
      } else {
        emptyMsg.style.display = 'none';
      }
  
      // render itens
      filtered.forEach(b => {
        const li = document.createElement('li');
        li.classList.add('fade-in');
        if (b.paid) li.classList.add('paid-item');
  
        // left
        const left = document.createElement('div');
        left.className = 'item-left';
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.textContent = initials(b.name);
        const info = document.createElement('div');
        info.className = 'item-info';
        const nameEl = document.createElement('div');
        nameEl.className = 'name';
        nameEl.textContent = b.name;
        const dueEl = document.createElement('div');
        dueEl.className = 'due';
        dueEl.textContent = formatDate(b.dueDate);
  
        info.appendChild(nameEl);
        info.appendChild(dueEl);
        left.appendChild(avatar);
        left.appendChild(info);
  
        // right
        const right = document.createElement('div');
        right.className = 'item-right';
  
        const amount = document.createElement('div');
        amount.className = 'amount';
        amount.textContent = formatCurrency(b.value);
        if (b.paid) amount.classList.add('paid');
  
        const badge = document.createElement('div');
        badge.className = `badge ${b.paid ? 'paid' : 'pending'}`;
        badge.textContent = b.paid ? 'Pago' : 'Pendente';
  
        // actions
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'icon-btn';
        toggleBtn.title = b.paid ? 'Marcar como pendente' : 'Marcar como pago';
        toggleBtn.innerHTML = b.paid ? '↺' : '✔';
        toggleBtn.addEventListener('click', () => togglePaid(b.id, li));
  
        const editBtn = document.createElement('button');
        editBtn.className = 'icon-btn';
        editBtn.title = 'Editar';
        editBtn.innerHTML = '✎';
        editBtn.addEventListener('click', () => startEdit(b.id));
  
        const delBtn = document.createElement('button');
        delBtn.className = 'icon-btn';
        delBtn.title = 'Excluir';
        delBtn.innerHTML = '🗑';
        delBtn.addEventListener('click', () => removeBill(b.id, li));
  
        right.appendChild(amount);
        right.appendChild(badge);
        right.appendChild(toggleBtn);
        right.appendChild(editBtn);
        right.appendChild(delBtn);
  
        li.appendChild(left);
        li.appendChild(right);
        billsList.appendChild(li);
      });
  
      updateTotalsForMonth(month);
    }
  
    function updateTotalsForMonth(month) {
      const [year, monthNum] = (month || '').split('-').map(Number);
      const filtered = bills.filter(b => {
        if (!b.dueDate) return false;
        const d = new Date(b.dueDate + 'T00:00:00');
        return d.getFullYear() === year && (d.getMonth()+1) === monthNum;
      });
  
      // soma
      let totalAll = 0;
      let totalPaid = 0;
      let totalPending = 0;
      for (const b of filtered) {
        // fazer soma simples, guardando round a cada passo para evitar erros de float
        totalAll = roundToTwo(totalAll + b.value);
        if (b.paid) totalPaid = roundToTwo(totalPaid + b.value);
        else totalPending = roundToTwo(totalPending + b.value);
      }
  
      totalAllEl.textContent = formatCurrency(totalAll);
      totalPaidEl.textContent = formatCurrency(totalPaid);
      totalPendingEl.textContent = formatCurrency(totalPending);
    }
  
    // marca pago <-> pendente
    function togglePaid(id, itemEl) {
      const i = bills.findIndex(b => b.id === id);
      if (i < 0) return;
      bills[i].paid = !bills[i].paid;
      bills[i].paidAt = bills[i].paid ? new Date().toISOString() : null;
      // animação de destaque
      if (itemEl) {
        itemEl.classList.add('paid-item');
        setTimeout(() => {
          if (!bills[i].paid) itemEl.classList.remove('paid-item');
        }, 400);
      }
      saveBills();
      render();
    }
  
    // editar
    function startEdit(id) {
      const b = bills.find(x => x.id === id);
      if (!b) return;
      editingId = id;
      nameInput.value = b.name;
      valueInput.value = String(b.value);
      dueDateInput.value = b.dueDate;
      submitBtn.textContent = 'Salvar';
      window.scrollTo({top:0,behavior:'smooth'});
    }
  
    // remover com animação
    function removeBill(id, itemEl) {
      if (!confirm('Excluir esta conta? Esta ação não pode ser desfeita.')) return;
      if (itemEl) {
        itemEl.classList.remove('fade-in');
        itemEl.classList.add('fade-out');
        setTimeout(() => {
          bills = bills.filter(b => b.id !== id);
          saveBills();
          render();
          animateFlash('Conta excluída');
        }, 280);
      } else {
        bills = bills.filter(b => b.id !== id);
        saveBills();
        render();
      }
    }
  
    // utilidades
    function cryptoId() {
      // id curto
      return 'b_' + Math.random().toString(36).slice(2,9);
    }
  
    function initials(text) {
      const parts = text.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
  
    function formatDate(iso) {
      const d = new Date(iso + 'T00:00:00');
      return d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric'});
    }
  
    function formatCurrency(v) {
      return new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(v);
    }
  
    function roundToTwo(n) {
      // evita erros de ponto flutuante; retorna número com duas casas (não string)
      return Math.round((n + Number.EPSILON) * 100) / 100;
    }
  
    function animateFlash(text) {
      // pequeno feedback no botão submit
      const original = submitBtn.textContent;
      submitBtn.textContent = text;
      submitBtn.disabled = true;
      setTimeout(() => {
        submitBtn.textContent = original;
        submitBtn.disabled = false;
        // pequeno efeito
        submitBtn.animate([{ transform: 'scale(0.98)' }, { transform: 'scale(1)'}], { duration: 220 });
      }, 700);
    }
  
  })();
  
