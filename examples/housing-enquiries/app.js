(() => {
  'use strict';

  const statuses = ['new', 'contacted', 'quoted', 'booked', 'closed'];
  const priorities = ['normal', 'high', 'urgent'];
  const $ = (selector) => document.querySelector(selector);
  const authView = $('#auth-view');
  const appView = $('#app-view');
  const globalMessage = $('#global-message');
  const authMessage = $('#auth-message');
  const enquiryMessage = $('#enquiry-message');
  const enquiryForm = $('#enquiry-form');
  const list = $('#enquiry-list');
  const loading = $('#list-loading');
  const emptyState = $('#empty-state');
  let currentUser = null;
  let enquiries = [];
  let editingId = null;

  async function api(path, options = {}) {
    const config = { credentials: 'same-origin', ...options };
    config.headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
    const response = await fetch(`api/${path}`, config);
    let data = {};
    try { data = await response.json(); } catch (_) { data = {}; }
    if (!response.ok) {
      const message = data.message || data.error || (response.status === 401 ? 'Please sign in to continue.' : `Request failed (${response.status}).`);
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function showMessage(element, text, type = 'error') {
    element.textContent = text;
    element.className = `${element === globalMessage ? 'global-message' : 'form-message'} message-${type}`;
    element.hidden = false;
  }
  function clearMessage(element) { element.textContent = ''; element.hidden = true; element.className = element === globalMessage ? 'global-message' : 'form-message'; }
  function showGlobalError(error, fallback) { showMessage(globalMessage, error && error.message ? error.message : fallback, 'error'); }
  function setSignedIn(user) {
    currentUser = user;
    const signedIn = Boolean(user);
    authView.hidden = signedIn;
    appView.hidden = !signedIn;
    $('#account-area').hidden = !signedIn;
    $('#account-email').textContent = signedIn ? user.email : '';
    clearMessage(globalMessage);
    if (!signedIn) clearMessage(enquiryMessage);
  }
  function formatMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '$0';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  }
  function humanStatus(status) { return statuses.includes(status) ? status.charAt(0).toUpperCase() + status.slice(1) : 'New'; }
  function normalisePriority(priority) { return priorities.includes(priority) ? priority : 'normal'; }
  function makeElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function addMeta(container, text) {
    const item = makeElement('span', 'meta-item');
    const dot = makeElement('span', 'meta-dot', '·');
    dot.setAttribute('aria-hidden', 'true');
    item.append(dot, document.createTextNode(text));
    container.append(item);
  }
  function dateLabel(value) {
    if (!value) return 'Date not set';
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? String(value) : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
  }
  function renderEnquiries() {
    list.replaceChildren();
    const filter = $('#priority-filter').value;
    const visibleEnquiries = enquiries.filter((enquiry) => filter === 'all' || normalisePriority(enquiry.priority) === filter);
    const hasItems = visibleEnquiries.length > 0;
    emptyState.hidden = hasItems || loading.hidden === false;
    if (!hasItems) {
      const heading = emptyState.querySelector('h3');
      const copy = emptyState.querySelector('p');
      if (enquiries.length && filter !== 'all') {
        heading.textContent = 'No matching enquiries';
        copy.textContent = `There are no ${filter} priority enquiries. Choose another priority to see more.`;
      } else {
        heading.textContent = 'No enquiries yet';
        copy.textContent = 'Your next conversation can start here. Add an enquiry using the form.';
      }
      return;
    }
    const fragment = document.createDocumentFragment();
    visibleEnquiries.forEach((enquiry) => {
      const card = makeElement('article', 'enquiry-card');
      card.dataset.enquiryId = String(enquiry.id);
      card.setAttribute('aria-label', `Enquiry from ${enquiry.name || 'unnamed contact'}`);

      const top = makeElement('div', 'card-top');
      const identity = makeElement('div', 'card-identity');
      const title = makeElement('h3', 'card-title', enquiry.name || 'Unnamed contact');
      const priorityValue = normalisePriority(enquiry.priority);
      const priority = makeElement('span', `priority-badge priority-${priorityValue}`, priorityValue);
      priority.setAttribute('aria-label', `Priority: ${priorityValue}`);
      title.append(priority);
      identity.append(title, makeElement('div', 'card-email', enquiry.email || ''));
      const status = document.createElement('select');
      status.className = 'status-control';
      status.setAttribute('aria-label', `Status for ${enquiry.name || 'enquiry'}`);
      status.dataset.action = 'status';
      statuses.forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = humanStatus(value);
        status.append(option);
      });
      status.value = statuses.includes(enquiry.status) ? enquiry.status : 'new';
      top.append(identity, status);
      card.append(top);

      const meta = makeElement('div', 'card-meta');
      if (enquiry.city) addMeta(meta, enquiry.city);
      addMeta(meta, `${dateLabel(enquiry.arrival)} – ${dateLabel(enquiry.departure)}`);
      addMeta(meta, formatMoney(enquiry.budget));
      card.append(meta);
      if (enquiry.notes) card.append(makeElement('p', 'card-notes', enquiry.notes));

      const bottom = makeElement('div', 'card-bottom');
      const created = enquiry.created_at ? new Date(enquiry.created_at) : null;
      const createdText = created && !Number.isNaN(created.getTime()) ? `Added ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(created)}` : '';
      bottom.append(makeElement('span', 'card-date', createdText));
      const actions = makeElement('div', 'card-actions');
      const edit = makeElement('button', 'text-button', 'Edit');
      edit.type = 'button'; edit.dataset.action = 'edit'; edit.setAttribute('aria-label', `Edit enquiry from ${enquiry.name || 'unnamed contact'}`);
      const remove = makeElement('button', 'text-button delete', 'Delete');
      remove.type = 'button'; remove.dataset.action = 'delete'; remove.setAttribute('aria-label', `Delete enquiry from ${enquiry.name || 'unnamed contact'}`);
      actions.append(edit, remove);
      bottom.append(actions);
      card.append(bottom);
      fragment.append(card);
    });
    list.append(fragment);
  }
  function renderDashboard(data) {
    $('#total-count').textContent = String(data.total ?? 0);
    $('#active-count').textContent = String(data.active ?? 0);
    $('#booked-count').textContent = String(data.booked ?? 0);
    $('#pipeline-budget').textContent = formatMoney(data.pipeline_budget ?? 0);
    $('#urgent-count').textContent = String(data.urgent ?? 0);
  }
  async function refreshData() {
    if (!currentUser) return;
    loading.hidden = false;
    emptyState.hidden = true;
    list.replaceChildren();
    clearMessage(globalMessage);
    try {
      const [dashboard, result] = await Promise.all([api('dashboard'), api('enquiries')]);
      renderDashboard(dashboard);
      enquiries = Array.isArray(result.enquiries) ? result.enquiries : [];
      loading.hidden = true;
      renderEnquiries();
    } catch (error) {
      loading.hidden = true;
      enquiries = [];
      renderEnquiries();
      showGlobalError(error, 'Could not load your enquiries. Please try again.');
    }
  }
  function resetEnquiryForm() {
    enquiryForm.reset();
    $('#enquiry-status').value = 'new';
    $('#enquiry-priority').value = 'normal';
    editingId = null;
    $('#form-title').textContent = 'Add an enquiry';
    $('#form-eyebrow').textContent = 'New record';
    $('#save-enquiry').textContent = 'Save enquiry';
    $('#cancel-edit').hidden = true;
  }
  function startEdit(enquiry) {
    editingId = enquiry.id;
    const fields = ['name', 'email', 'city', 'arrival', 'departure', 'budget', 'status', 'priority', 'notes'];
    fields.forEach((name) => {
      const input = enquiryForm.elements.namedItem(name);
      input.value = name === 'priority' ? normalisePriority(enquiry[name]) : (enquiry[name] == null ? '' : String(enquiry[name]));
    });
    $('#form-title').textContent = 'Edit enquiry';
    $('#form-eyebrow').textContent = 'Update record';
    $('#save-enquiry').textContent = 'Save changes';
    $('#cancel-edit').hidden = false;
    clearMessage(enquiryMessage);
    $('#form-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('#enquiry-name').focus({ preventScroll: true });
  }
  function formPayload() {
    const formData = new FormData(enquiryForm);
    const arrival = String(formData.get('arrival') || '');
    const departure = String(formData.get('departure') || '');
    if (arrival && departure && departure < arrival) throw new Error('Departure must be on or after arrival.');
    const budget = Number(formData.get('budget'));
    if (!Number.isFinite(budget) || budget < 0) throw new Error('Enter a valid, non-negative budget.');
    return {
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      city: String(formData.get('city') || '').trim(),
      arrival,
      departure,
      budget,
      status: String(formData.get('status') || 'new'),
      priority: normalisePriority(String(formData.get('priority') || 'normal')),
      notes: String(formData.get('notes') || '').trim()
    };
  }

  $('#auth-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage(authMessage);
    const action = event.submitter && event.submitter.id === 'register' ? 'register' : 'login';
    const email = $('#auth-email').value.trim();
    const password = $('#auth-password').value;
    if (password.length < 10) { showMessage(authMessage, 'Password must be at least 10 characters.', 'error'); return; }
    const buttons = [$('#login'), $('#register')];
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const result = await api(`auth/${action}`, { method: 'POST', body: JSON.stringify({ email, password }) });
      if (!result.user) throw new Error('The server did not return an account. Please try again.');
      setSignedIn(result.user);
      $('#auth-password').value = '';
      await refreshData();
    } catch (error) {
      showMessage(authMessage, error.message || 'Unable to sign in. Please try again.', 'error');
    } finally { buttons.forEach((button) => { button.disabled = false; }); }
  });

  $('#logout').addEventListener('click', async () => {
    clearMessage(globalMessage);
    const button = $('#logout');
    button.disabled = true;
    try {
      await api('auth/logout', { method: 'POST', body: JSON.stringify({}) });
      enquiries = [];
      setSignedIn(null);
      resetEnquiryForm();
      $('#auth-password').value = '';
    } catch (error) { showGlobalError(error, 'Could not sign out. Please try again.'); }
    finally { button.disabled = false; }
  });

  enquiryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage(enquiryMessage);
    let payload;
    try { payload = formPayload(); }
    catch (error) { showMessage(enquiryMessage, error.message, 'error'); return; }
    const saveButton = $('#save-enquiry');
    saveButton.disabled = true;
    try {
      if (editingId !== null) {
        await api(`enquiries/${encodeURIComponent(String(editingId))}`, { method: 'PATCH', body: JSON.stringify(payload) });
        resetEnquiryForm();
        showMessage(globalMessage, 'Enquiry updated.', 'success');
      } else {
        await api('enquiries', { method: 'POST', body: JSON.stringify(payload) });
        resetEnquiryForm();
        showMessage(globalMessage, 'Enquiry saved.', 'success');
      }
      await refreshData();
    } catch (error) { showMessage(enquiryMessage, error.message || 'Could not save this enquiry. Please try again.', 'error'); }
    finally { saveButton.disabled = false; }
  });

  $('#cancel-edit').addEventListener('click', () => { resetEnquiryForm(); clearMessage(enquiryMessage); $('#enquiry-name').focus(); });
  $('#refresh-enquiries').addEventListener('click', refreshData);
  $('#priority-filter').addEventListener('change', renderEnquiries);
  list.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const card = button.closest('[data-enquiry-id]');
    if (!card) return;
    const id = card.dataset.enquiryId;
    const enquiry = enquiries.find((item) => String(item.id) === id);
    if (button.dataset.action === 'edit' && enquiry) { startEdit(enquiry); return; }
    if (button.dataset.action === 'delete') {
      const name = enquiry && enquiry.name ? enquiry.name : 'this enquiry';
      if (!window.confirm(`Delete the enquiry for ${name}? This cannot be undone.`)) return;
      button.disabled = true;
      try {
        await api(`enquiries/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (String(editingId) === id) resetEnquiryForm();
        showMessage(globalMessage, 'Enquiry deleted.', 'success');
        await refreshData();
      } catch (error) { showGlobalError(error, 'Could not delete this enquiry. Please try again.'); button.disabled = false; }
    }
  });
  list.addEventListener('change', async (event) => {
    const control = event.target.closest('select[data-action="status"]');
    if (!control) return;
    const card = control.closest('[data-enquiry-id]');
    if (!card) return;
    control.disabled = true;
    try {
      await api(`enquiries/${encodeURIComponent(card.dataset.enquiryId)}`, { method: 'PATCH', body: JSON.stringify({ status: control.value }) });
      showMessage(globalMessage, 'Enquiry status updated.', 'success');
      await refreshData();
    } catch (error) { showGlobalError(error, 'Could not update the enquiry status. Please try again.'); await refreshData(); }
    finally { control.disabled = false; }
  });

  (async function initialize() {
    try {
      const result = await api('auth/me');
      if (result.user) {
        setSignedIn(result.user);
        await refreshData();
      } else setSignedIn(null);
    } catch (error) {
      setSignedIn(null);
      if (error.status !== 401) showMessage(authMessage, error.message || 'Could not check your session. Please try signing in.', 'error');
    }
  })();
})();
